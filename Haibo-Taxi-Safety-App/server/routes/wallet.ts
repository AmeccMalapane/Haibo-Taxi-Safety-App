import { Router, Response } from "express";
import { db } from "../db";
import {
  users, walletTransactions, p2pTransfers, sponsorships,
  transactions, withdrawalRequests, paymentMethods,
} from "../../shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sensitiveRateLimit } from "../middleware/rateLimit";
import { verifyTransaction } from "../services/paystack";
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
router.post("/transfer", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    res.json({ message: "Withdrawal request submitted", withdrawal });
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: "Withdrawal request failed" });
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
