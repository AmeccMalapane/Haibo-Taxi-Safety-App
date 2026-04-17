import { Router, Response } from "express";
import { db } from "../db";
import {
  users, walletTransactions, p2pTransfers, sponsorships,
  transactions, withdrawalRequests, paymentMethods, vendorProfiles,
} from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sensitiveRateLimit, financialRateLimit } from "../middleware/rateLimit";
import { verifyTransaction } from "../services/paystack";
import { emitToAdmins } from "../services/realtime";
import { notifyUser } from "../services/notifications";
import { parsePagination, paginationResponse } from "../utils/helpers";
import { processPayment } from "../services/payments";
import { driverProfiles, ownerProfiles } from "../../shared/schema";

const router = Router();

// Wallet amounts are stored as real (single-precision float) in the users
// table, so precision degrades beyond ~7 significant digits. Cap per-
// transaction amounts well below that to keep the ledger honest and to
// bound the blast radius of abuse. R100,000 is far above any realistic
// fare/top-up while still below the FICA enhanced-due-diligence threshold.
// Tighter limits (e.g. single withdrawals) apply on top of this.
const MAX_TRANSACTION_AMOUNT = 100_000;

// Normalize + guard a user-supplied amount field. Rejects non-numbers,
// NaN, Infinity, non-positive values, and anything beyond the cap.
// Rounds to 2 decimal places to avoid float drift from the client.
function validateAmount(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, error: "Amount must be a finite number" };
  }
  if (raw <= 0) {
    return { ok: false, error: "Amount must be greater than zero" };
  }
  if (raw > MAX_TRANSACTION_AMOUNT) {
    return {
      ok: false,
      error: `Amount exceeds the R${MAX_TRANSACTION_AMOUNT.toLocaleString()} per-transaction limit`,
    };
  }
  // Round to cents so downstream math and display stay consistent even
  // when a client sends fractional amounts like 12.3456789.
  return { ok: true, value: Math.round(raw * 100) / 100 };
}

// GET /api/wallet/balance - Get wallet balance
router.get("/balance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select({ walletBalance: users.walletBalance })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ balance: result[0].walletBalance || 0 });
  } catch (error: any) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

// GET /api/wallet/transactions - Get transaction history
router.get("/transactions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const results = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, req.user!.userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit).offset(offset);

    const [totalResult] = await db.select({ count: count() })
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, req.user!.userId));

    res.json({
      data: results,
      pagination: paginationResponse(totalResult.count, { page, limit, offset }),
    });
  } catch (error: any) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /api/wallet/topup - Top up wallet (Paystack verified)
router.post("/topup", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount: rawAmount, paymentReference } = req.body;
    const userId = req.user!.userId;

    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    if (!paymentReference || typeof paymentReference !== "string") {
      res.status(400).json({ error: "Payment reference is required" });
      return;
    }

    // Early idempotency short-circuit — if a completed transaction for
    // this reference already exists, we skip the Paystack verify roundtrip
    // and return success. Still doesn't fully close the race with the
    // webhook (hence the ON CONFLICT guard below), but saves an external
    // API call in the common retry case.
    const existing = await db
      .select()
      .from(transactions)
      .where(eq(transactions.reference, paymentReference))
      .limit(1);

    if (existing.length > 0 && existing[0].status === "completed") {
      res.json({ message: "Top-up already processed", alreadyProcessed: true });
      return;
    }

    // Verify the payment with Paystack before touching the ledger.
    const verification = await verifyTransaction(paymentReference);

    if (!verification.verified) {
      res.status(400).json({
        error: "Payment verification failed",
        details: verification.error,
      });
      return;
    }

    const verifiedAmount = (verification.amount || 0) / 100;

    // The webhook and this client-driven path can race — both see no
    // completed transaction and both try to credit. Wrap the whole thing
    // in a transaction AND gate on `transactions.reference` (unique) via
    // INSERT ... ON CONFLICT DO NOTHING. The loser of the race gets an
    // empty returning() array and the whole transaction aborts, leaving
    // the wallet untouched. walletTransactions has no unique constraint
    // so this gate is load-bearing.
    let txn: typeof walletTransactions.$inferSelect | undefined;
    let alreadyProcessed = false;
    try {
      await db.transaction(async (tx) => {
        const [claim] = await tx
          .insert(transactions)
          .values({
            userId,
            amount: verifiedAmount,
            type: "wallet_topup",
            status: "completed",
            reference: paymentReference,
            description: `Wallet top-up`,
            completedAt: new Date(),
          })
          .onConflictDoNothing({ target: transactions.reference })
          .returning();

        if (!claim) {
          alreadyProcessed = true;
          return;
        }

        await tx
          .update(users)
          .set({
            walletBalance: sql`${users.walletBalance} + ${verifiedAmount}`,
          })
          .where(eq(users.id, userId));

        const [walletTxn] = await tx
          .insert(walletTransactions)
          .values({
            userId,
            type: "topup",
            amount: verifiedAmount,
            description: `Wallet top-up of R${verifiedAmount.toFixed(2)}`,
            status: "completed",
            paymentReference,
          })
          .returning();
        txn = walletTxn;
      });
    } catch (txErr) {
      console.error("Top-up transaction error:", txErr);
      res.status(500).json({ error: "Top-up failed" });
      return;
    }

    if (alreadyProcessed) {
      res.json({ message: "Top-up already processed", alreadyProcessed: true });
      return;
    }

    res.json({
      message: "Top-up successful",
      amount: verifiedAmount,
      transaction: txn,
    });
  } catch (error: any) {
    console.error("Top-up error:", error);
    res.status(500).json({ error: "Top-up failed" });
  }
});

// POST /api/wallet/transfer - P2P transfer
router.post("/transfer", authMiddleware, financialRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { recipientPhone, recipientUsername, amount: rawAmount, message } = req.body;
    const senderId = req.user!.userId;

    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    if (!recipientPhone && !recipientUsername) {
      res.status(400).json({ error: "Recipient phone or username is required" });
      return;
    }

    // Resolve recipient outside the transaction — read-only lookup, no
    // need to hold a connection while we walk the phone index.
    let recipient;
    if (recipientPhone) {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.phone, recipientPhone))
        .limit(1);
      recipient = result[0];
    }

    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    if (recipient.id === senderId) {
      res.status(400).json({ error: "You can't transfer to yourself" });
      return;
    }

    // Wrap the money movement + ledger writes in a single DB transaction
    // so partial failures can't leave the ledger inconsistent. The
    // conditional deduct guards against TOCTOU races — two concurrent
    // transfers attempting to drain the same balance will have one
    // updateCount === 0 and roll back. This closes the double-spend
    // window where a SELECT-then-UPDATE pattern would succeed for both.
    let senderSnapshot: typeof users.$inferSelect | undefined;
    let transferRow: typeof p2pTransfers.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        const deduct = await tx
          .update(users)
          .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
          .where(
            and(
              eq(users.id, senderId),
              sql`${users.walletBalance} >= ${amount}`,
            ),
          )
          .returning();

        if (deduct.length === 0) {
          // Either the sender vanished (unlikely — authMiddleware just
          // verified them) or the balance was insufficient. Throw to
          // abort the transaction and surface an explicit 400.
          throw new Error("INSUFFICIENT_FUNDS");
        }
        senderSnapshot = deduct[0];

        const credit = await tx
          .update(users)
          .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
          .where(eq(users.id, recipient!.id))
          .returning();
        if (credit.length === 0) throw new Error("RECIPIENT_MISSING");

        const [transfer] = await tx
          .insert(p2pTransfers)
          .values({
            senderId,
            recipientId: recipient!.id,
            recipientPhone: recipient!.phone,
            amount,
            message: message || null,
            status: "completed",
          })
          .returning();
        transferRow = transfer;

        await tx.insert(walletTransactions).values([
          {
            userId: senderId,
            type: "transfer_sent",
            amount: -amount,
            description: `Transfer to ${recipient!.phone}`,
            status: "completed",
            relatedUserId: recipient!.id,
            relatedUserPhone: recipient!.phone,
          },
          {
            userId: recipient!.id,
            type: "transfer_received",
            amount,
            description: `Transfer from ${senderSnapshot!.phone}`,
            status: "completed",
            relatedUserId: senderId,
            relatedUserPhone: senderSnapshot!.phone,
          },
        ]);
      });
    } catch (txErr: any) {
      if (txErr?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      if (txErr?.message === "RECIPIENT_MISSING") {
        res.status(404).json({ error: "Recipient not found" });
        return;
      }
      throw txErr;
    }

    res.json({ message: "Transfer successful", transfer: transferRow });
  } catch (error: any) {
    console.error("Transfer error:", error);
    res.status(500).json({ error: "Transfer failed" });
    return;
  }
});

// POST /api/wallet/pay-vendor - Pay a Haibo Vault vendor by reference code.
// Same money rail as /transfer but looks the recipient up by vendorRef
// instead of phone, tags the p2pTransfers row so we can classify it as a
// sale, and increments the vendor's sales counters for the directory/CC.
//
// Post-Phase-C: routes through processPayment() so the 15% platform fee
// automatically lands in the admin treasury and the vendor sees the
// net amount in their wallet. All the TOCTOU + double-entry accounting
// lives in services/payments.ts now.
router.post("/pay-vendor", authMiddleware, financialRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { vendorRef, amount: rawAmount, message } = req.body;

    if (!vendorRef || typeof vendorRef !== "string") {
      res.status(400).json({ error: "vendorRef is required" });
      return;
    }
    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    // Look up the vendor. Suspended vendors must not accept payments; we
    // return a deliberate "vendor not found" so the sender can't tell the
    // difference between "never existed" and "was suspended".
    const [vendor] = await db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.vendorRef, vendorRef))
      .limit(1);

    if (!vendor || vendor.status === "suspended") {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }

    if (vendor.userId === req.user!.userId) {
      res.status(400).json({ error: "You can't pay yourself" });
      return;
    }

    // Resolve vendor's user row for labelling — read-only, no need to
    // hold this inside the transaction.
    const [vendorUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);
    if (!vendorUser) {
      res.status(404).json({ error: "Vendor account missing" });
      return;
    }

    // Hand off to the payments service. Splits 85/15, writes both
    // ledger rows + vendor counters + p2pTransfers row, all atomically.
    let result;
    try {
      result = await processPayment({
        senderId: req.user!.userId,
        recipientId: vendor.userId,
        amount,
        type: "vendor_sale",
        message: message || null,
        context: { vendorRef: vendor.vendorRef },
      });
    } catch (err: any) {
      if (err?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      throw err;
    }

    // Fire-and-forget push receipt to the vendor.
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    const buyerLabel = sender?.displayName || sender?.phone || "a customer";
    notifyUser({
      userId: vendor.userId,
      type: "payment",
      title: `R${result.netAmount.toFixed(2)} received`,
      body: `${buyerLabel} paid you on Haibo${message ? `: "${message}"` : ""}`,
      data: {
        kind: "vendor_sale",
        amount: String(result.netAmount),
        vendorRef: vendor.vendorRef,
      },
    }).catch((err) => console.error("Vendor sale notify error:", err));

    res.json({
      message: "Payment successful",
      gross: result.grossAmount,
      fee: result.feeAmount,
      net: result.netAmount,
      vendor: {
        vendorRef: vendor.vendorRef,
        businessName: vendor.businessName,
        vendorType: vendor.vendorType,
      },
    });
    return;
  } catch (error: any) {
    console.error("Pay vendor error:", error);
    res.status(500).json({ error: "Payment failed" });
    return;
  }
});

// ─── POST /api/wallet/pay-driver ────────────────────────────────────────
// Passenger pays a driver for a ride via Haibo Pay. Routes through
// processPayment() with type='fare' so the 15% platform fee lands in
// the admin treasury and the driver's 85% share credits their
// fareBalance (owner's money until settlement).
//
// Driver lookup: either driverUserId directly, or taxi plate for the
// passenger-scans-plate QR flow. Plate is normalised + matched against
// driverProfiles.taxiPlateNumber.
router.post("/pay-driver", authMiddleware, financialRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { driverUserId, taxiPlateNumber, amount: rawAmount, message } = req.body;

    if (!driverUserId && !taxiPlateNumber) {
      res.status(400).json({ error: "Provide driverUserId or taxiPlateNumber" });
      return;
    }
    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    // Resolve driver.
    let driverId: string | null = null;
    if (driverUserId) {
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, driverUserId))
        .limit(1);
      if (profile) driverId = profile.userId;
    } else if (taxiPlateNumber) {
      const normalized = String(taxiPlateNumber).toUpperCase().replace(/[\s-]/g, "");
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.taxiPlateNumber, normalized))
        .limit(1);
      if (profile) driverId = profile.userId;
    }

    if (!driverId) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }
    if (driverId === req.user!.userId) {
      res.status(400).json({ error: "You can't pay yourself" });
      return;
    }

    let result;
    try {
      result = await processPayment({
        senderId: req.user!.userId,
        recipientId: driverId,
        amount,
        type: "fare",
        message: message || null,
        context: { via: taxiPlateNumber ? "plate_qr" : "driver_id" },
      });
    } catch (err: any) {
      if (err?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      throw err;
    }

    // Notify the driver. Because the money landed in fareBalance (owner's
    // money), phrase the receipt to make that clear — the driver sees
    // earnings accrue, not spendable cash.
    notifyUser({
      userId: driverId,
      type: "payment",
      title: `R${result.netAmount.toFixed(2)} fare received`,
      body:
        result.recipientBalance === "fare"
          ? `Added to your fare balance. Settle to your owner from the dashboard.`
          : `Added to your wallet.`,
      data: {
        kind: "fare_payment",
        amount: String(result.netAmount),
      },
    }).catch((err) => console.error("Driver fare notify error:", err));

    res.json({
      message: "Fare paid",
      gross: result.grossAmount,
      fee: result.feeAmount,
      net: result.netAmount,
      recipientBalance: result.recipientBalance,
    });
    return;
  } catch (error: any) {
    console.error("Pay driver error:", error);
    res.status(500).json({ error: "Payment failed" });
    return;
  }
});

// POST /api/wallet/withdraw - Request EFT withdrawal
//
// Role-aware routing (Phase C):
//   balanceType='wallet' (default)
//     → debits walletBalance, money lands in the caller's own bank
//   balanceType='fare' (drivers only — settles the owner's share)
//     → debits fareBalance
//     → routeToUserId = driver's linked owner (driver_profiles.ownerId)
//     → money lands in the OWNER's bank account, not the driver's
//     → bank fields (bankCode/accountNumber) are IGNORED — we pull them
//       from owner_profiles so a compromised driver session can't reroute
//       their fleet's money to a fake account
//
// Solo operator detection: if driverProfiles.ownerId === userId (the
// driver also owns their taxi), we skip the owner-lookup and use the
// bank fields from the request body — same UX as any other self-
// withdrawal.
router.post("/withdraw", authMiddleware, sensitiveRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { amount: rawAmount, bankCode: rawBankCode, accountNumber: rawAccountNumber, accountName, narration, balanceType: rawBalanceType } = req.body;
    const userId = req.user!.userId;

    const balanceType: "wallet" | "fare" =
      rawBalanceType === "fare" ? "fare" : "wallet";

    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    // Resolve routing + bank details up front so we know where the money
    // is going before freezing any balance.
    let routeToUserId = userId;
    let bankCode = rawBankCode as string | undefined;
    let accountNumber = rawAccountNumber as string | undefined;
    let resolvedAccountName = accountName as string | undefined;

    if (balanceType === "fare") {
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        res.status(400).json({ error: "Fare withdrawals are for drivers only" });
        return;
      }
      if (profile.linkStatus !== "active" || !profile.ownerId) {
        res.status(400).json({
          error: "Your driver account isn't linked to an owner yet. Redeem an owner invitation code first.",
        });
        return;
      }

      // Solo operator — driver owns their own taxi. Skip owner lookup,
      // use caller-supplied bank fields like a regular self-withdrawal.
      if (profile.ownerId === userId) {
        if (!bankCode || !accountNumber) {
          res.status(400).json({ error: "Bank code and account number are required" });
          return;
        }
      } else {
        // Regular driver — pull owner's bank from their profile. Reject
        // if owner hasn't saved bank details yet so the money doesn't
        // vanish into a pending state.
        const [owner] = await db
          .select()
          .from(ownerProfiles)
          .where(eq(ownerProfiles.userId, profile.ownerId))
          .limit(1);

        if (!owner || !owner.bankCode || !owner.accountNumber) {
          res.status(400).json({
            error: "Your owner hasn't added their payout bank yet. Ask them to finish setup first.",
          });
          return;
        }

        routeToUserId = profile.ownerId;
        bankCode = owner.bankCode;
        accountNumber = owner.accountNumber;
        resolvedAccountName = owner.accountName || undefined;
      }
    } else {
      // Regular (walletBalance) withdrawal — caller must supply bank details.
      if (!bankCode || !accountNumber) {
        res.status(400).json({ error: "Bank code and account number are required" });
        return;
      }
    }

    // Atomic balance freeze + withdrawal request creation. Same pattern
    // as /transfer — concurrent submissions could drain the wallet below
    // zero without a conditional UPDATE guard. Transaction ensures the
    // balance can never be frozen without a corresponding request row.
    let withdrawal: typeof withdrawalRequests.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        const balanceColumn = balanceType === "fare" ? users.fareBalance : users.walletBalance;

        const deduct = await tx
          .update(users)
          .set(
            balanceType === "fare"
              ? { fareBalance: sql`${users.fareBalance} - ${amount}` }
              : { walletBalance: sql`${users.walletBalance} - ${amount}` },
          )
          .where(
            and(
              eq(users.id, userId),
              sql`${balanceColumn} >= ${amount}`,
            ),
          )
          .returning();

        if (deduct.length === 0) throw new Error("INSUFFICIENT_FUNDS");

        const [row] = await tx
          .insert(withdrawalRequests)
          .values({
            userId,
            routeToUserId,
            balanceType,
            amount,
            bankCode: bankCode!,
            accountNumber: accountNumber!,
            accountName: resolvedAccountName || null,
            narration:
              narration ||
              (balanceType === "fare" && routeToUserId !== userId
                ? `Driver settlement to owner`
                : `Haibo withdrawal`),
            status: "pending",
            requires2FA: amount > 100,
          })
          .returning();
        withdrawal = row;

        await tx.insert(walletTransactions).values({
          userId,
          type: balanceType === "fare" ? "driver_settlement" : "withdrawal_out",
          amount: -amount,
          description:
            balanceType === "fare" && routeToUserId !== userId
              ? `Settlement to owner - R${amount.toFixed(2)}`
              : `Withdrawal request - R${amount.toFixed(2)}`,
          status: "pending",
          balanceAffected: balanceType,
          relatedUserId: routeToUserId !== userId ? routeToUserId : null,
        });
      });
    } catch (txErr: any) {
      if (txErr?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      throw txErr;
    }

    // Fan out to Command Center so the approval queue lights up in realtime.
    // Surface routeToUserId + balanceType so admins can distinguish a
    // driver settlement (→ owner's bank) from a regular withdrawal.
    emitToAdmins("withdrawal:requested", {
      id: withdrawal!.id,
      userId,
      userPhone: req.user!.phone,
      amount,
      bankCode,
      accountNumber,
      balanceType,
      routeToUserId,
      requires2FA: withdrawal!.requires2FA,
      requestedAt: withdrawal!.requestedAt,
    });

    res.json({ message: "Withdrawal request submitted", withdrawal });
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: "Withdrawal request failed" });
  }
});

// GET /api/wallet/withdrawals/me — list the caller's own withdrawal
// requests so the mobile wallet can show a status strip (pending /
// approved / rejected) while they wait for the EFT to clear. Ops
// approves via /api/admin/withdrawals which fires a notifyUser push,
// but push delivery is fragile (FCM token rot, permission revoked)
// so this endpoint is the canonical source of truth the client can
// always pull on refresh.
router.get("/withdrawals/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Number((req.query as any).limit) || 20;
    const limit = Math.min(Math.max(rawLimit, 1), 50);

    const rows = await db
      .select({
        id: withdrawalRequests.id,
        amount: withdrawalRequests.amount,
        status: withdrawalRequests.status,
        bankCode: withdrawalRequests.bankCode,
        accountNumber: withdrawalRequests.accountNumber,
        accountName: withdrawalRequests.accountName,
        narration: withdrawalRequests.narration,
        requestedAt: withdrawalRequests.requestedAt,
        approvedAt: withdrawalRequests.approvedAt,
        completedAt: withdrawalRequests.completedAt,
        rejectionReason: withdrawalRequests.rejectionReason,
      })
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, req.user!.userId))
      .orderBy(desc(withdrawalRequests.requestedAt))
      .limit(limit);

    res.json({ data: rows });
  } catch (error: any) {
    console.error("Get own withdrawals error:", error);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

// GET /api/wallet/payment-methods - List payment methods
router.get("/payment-methods", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const methods = await db.select().from(paymentMethods)
      .where(eq(paymentMethods.userId, req.user!.userId))
      .orderBy(desc(paymentMethods.createdAt));

    res.json({ data: methods });
  } catch (error: any) {
    console.error("Get payment methods error:", error);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

export default router;
