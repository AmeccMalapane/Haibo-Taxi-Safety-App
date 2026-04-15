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

    // Atomic money movement — same pattern as /transfer. Conditional
    // deduct guards against TOCTOU double-spend; transaction rollback
    // guarantees the ledger is never partially written.
    let sender: typeof users.$inferSelect | undefined;
    let transfer: typeof p2pTransfers.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        const deduct = await tx
          .update(users)
          .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
          .where(
            and(
              eq(users.id, req.user!.userId),
              sql`${users.walletBalance} >= ${amount}`,
            ),
          )
          .returning();

        if (deduct.length === 0) throw new Error("INSUFFICIENT_FUNDS");
        sender = deduct[0];

        const credit = await tx
          .update(users)
          .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
          .where(eq(users.id, vendor.userId))
          .returning();
        if (credit.length === 0) throw new Error("VENDOR_USER_MISSING");

        const [transferRow] = await tx
          .insert(p2pTransfers)
          .values({
            senderId: req.user!.userId,
            recipientId: vendor.userId,
            recipientPhone: vendorUser.phone,
            amount,
            message: message || null,
            status: "completed",
            vendorRef: vendor.vendorRef,
          })
          .returning();
        transfer = transferRow;

        await tx.insert(walletTransactions).values([
          {
            userId: req.user!.userId,
            type: "vendor_payment",
            amount: -amount,
            description: `Paid ${vendor.businessName}`,
            status: "completed",
            relatedUserId: vendor.userId,
            relatedUserPhone: vendorUser.phone,
          },
          {
            userId: vendor.userId,
            type: "vendor_sale",
            amount,
            description: `Sale via ${sender!.phone}`,
            status: "completed",
            relatedUserId: req.user!.userId,
            relatedUserPhone: sender!.phone,
          },
        ]);

        // Vendor sales counters — inside the same transaction so a
        // failed wallet credit won't leave the counters stale.
        await tx
          .update(vendorProfiles)
          .set({
            salesCount: sql`${vendorProfiles.salesCount} + 1`,
            totalSales: sql`${vendorProfiles.totalSales} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(vendorProfiles.id, vendor.id));
      });
    } catch (txErr: any) {
      if (txErr?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      if (txErr?.message === "VENDOR_USER_MISSING") {
        res.status(404).json({ error: "Vendor account missing" });
        return;
      }
      throw txErr;
    }

    // Fire-and-forget push receipt to the vendor. Don't await — a
    // slow FCM call shouldn't delay the buyer's 200 response, and the
    // transaction itself is already committed at this point. The
    // notifications service persists to the DB even when FCM is
    // misconfigured, so the vendor still sees the receipt in-app.
    const buyerLabel =
      sender.displayName || sender.phone || "a customer";
    notifyUser({
      userId: vendor.userId,
      type: "payment",
      title: `R${Number(amount).toFixed(2)} received`,
      body: `${buyerLabel} paid you on Haibo${message ? `: "${message}"` : ""}`,
      data: {
        kind: "vendor_sale",
        transferId: transfer.id,
        amount: String(amount),
        vendorRef: vendor.vendorRef,
      },
    }).catch((err) => {
      // Never let receipt failures bubble — they're best-effort.
      console.error("Vendor sale notify error:", err);
    });

    res.json({
      message: "Payment successful",
      transfer,
      vendor: {
        vendorRef: vendor.vendorRef,
        businessName: vendor.businessName,
        vendorType: vendor.vendorType,
      },
    });
  } catch (error: any) {
    console.error("Pay vendor error:", error);
    res.status(500).json({ error: "Payment failed" });
  }
});

// POST /api/wallet/withdraw - Request EFT withdrawal
router.post("/withdraw", authMiddleware, sensitiveRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { amount: rawAmount, bankCode, accountNumber, accountName, narration } = req.body;
    const userId = req.user!.userId;

    if (!bankCode || !accountNumber) {
      res.status(400).json({ error: "Bank code and account number are required" });
      return;
    }
    const amountCheck = validateAmount(rawAmount);
    if (amountCheck.ok === false) {
      res.status(400).json({ error: amountCheck.error });
      return;
    }
    const amount = amountCheck.value;

    // Atomic balance freeze + withdrawal request creation. Same pattern
    // as /transfer — concurrent withdrawal submissions could both pass a
    // SELECT-then-UPDATE balance check and drain the wallet below zero.
    // The conditional UPDATE on walletBalance >= amount eliminates that
    // race, and wrapping in a transaction ensures the balance can never
    // be frozen without a corresponding withdrawalRequests row to refund
    // it if the submission fails downstream.
    let withdrawal: typeof withdrawalRequests.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        const deduct = await tx
          .update(users)
          .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
          .where(
            and(
              eq(users.id, userId),
              sql`${users.walletBalance} >= ${amount}`,
            ),
          )
          .returning();

        if (deduct.length === 0) throw new Error("INSUFFICIENT_FUNDS");

        const [row] = await tx
          .insert(withdrawalRequests)
          .values({
            userId,
            amount,
            bankCode,
            accountNumber,
            accountName: accountName || null,
            narration: narration || `Haibo withdrawal`,
            status: "pending",
            requires2FA: amount > 100,
          })
          .returning();
        withdrawal = row;

        await tx.insert(walletTransactions).values({
          userId,
          type: "transfer_sent",
          amount: -amount,
          description: `Withdrawal request - R${amount.toFixed(2)}`,
          status: "pending",
        });
      });
    } catch (txErr: any) {
      if (txErr?.message === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      throw txErr;
    }

    // Fan out to Command Center so the approval queue lights up in realtime
    emitToAdmins("withdrawal:requested", {
      id: withdrawal!.id,
      userId,
      userPhone: req.user!.phone,
      amount,
      bankCode,
      accountNumber,
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
