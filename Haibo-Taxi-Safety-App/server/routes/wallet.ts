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
    const { amount, paymentReference } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }

    if (!paymentReference) {
      res.status(400).json({ error: "Payment reference is required" });
      return;
    }

    // Check idempotency — don't double-credit
    const existing = await db.select().from(transactions)
      .where(eq(transactions.reference, paymentReference))
      .limit(1);

    if (existing.length > 0 && existing[0].status === "completed") {
      res.json({ message: "Top-up already processed", alreadyProcessed: true });
      return;
    }

    // Verify the payment with Paystack API
    const verification = await verifyTransaction(paymentReference);

    if (!verification.verified) {
      res.status(400).json({ error: "Payment verification failed", details: verification.error });
      return;
    }

    const verifiedAmount = (verification.amount || 0) / 100; // cents to rands

    // Create wallet transaction
    const [txn] = await db.insert(walletTransactions).values({
      userId: req.user!.userId,
      type: "topup",
      amount: verifiedAmount,
      description: `Wallet top-up of R${verifiedAmount.toFixed(2)}`,
      status: "completed",
      paymentReference,
    }).returning();

    // Update user balance
    await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${verifiedAmount}` })
      .where(eq(users.id, req.user!.userId));

    // Record in main transactions table
    await db.insert(transactions).values({
      userId: req.user!.userId,
      amount: verifiedAmount,
      type: "wallet_topup",
      status: "completed",
      reference: paymentReference,
      description: `Wallet top-up`,
      completedAt: new Date(),
    });

    res.json({ message: "Top-up successful", amount: verifiedAmount, transaction: txn });
  } catch (error: any) {
    console.error("Top-up error:", error);
    res.status(500).json({ error: "Top-up failed" });
  }
});

// POST /api/wallet/transfer - P2P transfer
router.post("/transfer", authMiddleware, financialRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { recipientPhone, recipientUsername, amount, message } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }

    if (!recipientPhone && !recipientUsername) {
      res.status(400).json({ error: "Recipient phone or username is required" });
      return;
    }

    // Check sender balance
    const [sender] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!sender || (sender.walletBalance || 0) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    // Find recipient
    let recipient;
    if (recipientPhone) {
      const result = await db.select().from(users).where(eq(users.phone, recipientPhone)).limit(1);
      recipient = result[0];
    }

    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    // Deduct from sender
    await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
      .where(eq(users.id, req.user!.userId));

    // Add to recipient
    await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
      .where(eq(users.id, recipient.id));

    // Record transfer
    const [transfer] = await db.insert(p2pTransfers).values({
      senderId: req.user!.userId,
      recipientId: recipient.id,
      recipientPhone: recipient.phone,
      amount,
      message: message || null,
      status: "completed",
    }).returning();

    // Record wallet transactions for both parties
    await db.insert(walletTransactions).values([
      {
        userId: req.user!.userId,
        type: "transfer_sent",
        amount: -amount,
        description: `Transfer to ${recipient.phone}`,
        status: "completed",
        relatedUserId: recipient.id,
        relatedUserPhone: recipient.phone,
      },
      {
        userId: recipient.id,
        type: "transfer_received",
        amount,
        description: `Transfer from ${sender.phone}`,
        status: "completed",
        relatedUserId: req.user!.userId,
        relatedUserPhone: sender.phone,
      },
    ]);

    res.json({ message: "Transfer successful", transfer });
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
    const { vendorRef, amount, message } = req.body;

    if (!vendorRef || typeof vendorRef !== "string") {
      res.status(400).json({ error: "vendorRef is required" });
      return;
    }
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }

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

    // Check sender balance
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    if (!sender || (sender.walletBalance || 0) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    // Resolve vendor's user row for the transfer description
    const [vendorUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);
    if (!vendorUser) {
      res.status(404).json({ error: "Vendor account missing" });
      return;
    }

    // Money movement — deduct + credit
    await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
      .where(eq(users.id, req.user!.userId));

    await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
      .where(eq(users.id, vendor.userId));

    // Record the P2P row — vendorRef tag lets /api/admin/p2p-transfers
    // classify this as a "sale" in reports without a second table.
    const [transfer] = await db
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

    // Wallet transactions — both sides
    await db.insert(walletTransactions).values([
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
        description: `Sale via ${sender.phone}`,
        status: "completed",
        relatedUserId: req.user!.userId,
        relatedUserPhone: sender.phone,
      },
    ]);

    // Update vendor sales counters. Using sql`` so concurrent sales
    // increment atomically rather than racing on a read-modify-write.
    await db
      .update(vendorProfiles)
      .set({
        salesCount: sql`${vendorProfiles.salesCount} + 1`,
        totalSales: sql`${vendorProfiles.totalSales} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(vendorProfiles.id, vendor.id));

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
    const { amount, bankCode, accountNumber, accountName, narration } = req.body;

    if (!amount || amount <= 0 || !bankCode || !accountNumber) {
      res.status(400).json({ error: "Amount, bank code, and account number are required" });
      return;
    }

    // Check balance
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user || (user.walletBalance || 0) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    // Freeze the amount
    await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
      .where(eq(users.id, req.user!.userId));

    const [withdrawal] = await db.insert(withdrawalRequests).values({
      userId: req.user!.userId,
      amount,
      bankCode,
      accountNumber,
      accountName: accountName || null,
      narration: narration || `Haibo withdrawal`,
      status: "pending",
      requires2FA: amount > 100,
    }).returning();

    // Record wallet transaction
    await db.insert(walletTransactions).values({
      userId: req.user!.userId,
      type: "transfer_sent",
      amount: -amount,
      description: `Withdrawal request - R${amount.toFixed(2)}`,
      status: "pending",
    });

    // Fan out to Command Center so the approval queue lights up in realtime
    emitToAdmins("withdrawal:requested", {
      id: withdrawal.id,
      userId: req.user!.userId,
      userPhone: req.user!.phone,
      amount,
      bankCode,
      accountNumber,
      requires2FA: withdrawal.requires2FA,
      requestedAt: withdrawal.requestedAt,
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
