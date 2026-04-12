import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

const WITHDRAWAL_2FA_THRESHOLD = 100; // R100 - require 2FA above this

export function walletRoutes(db: any) {
  const router = Router();

  // Get wallet balance
  router.get("/balance/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const [user] = await db.select().from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        balance: user.walletBalance || 0,
        currency: "R",
        phone: user.phone,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get balance", message: error.message });
    }
  });

  // Get transaction history
  router.get("/transactions/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit: limitParam } = req.query;
      const limit = parseInt(limitParam as string) || 50;

      const transactions = await db.select().from(schema.walletTransactions)
        .where(eq(schema.walletTransactions.userId, userId))
        .orderBy(desc(schema.walletTransactions.createdAt))
        .limit(limit);

      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get transactions", message: error.message });
    }
  });

  // Top up wallet (Paystack integration point)
  router.post("/topup", async (req, res) => {
    try {
      const { userId, amount, paymentReference } = req.body;

      if (!userId || !amount || amount < 10) {
        return res.status(400).json({ error: "userId and amount (min R10) are required" });
      }

      if (amount > 50000) {
        return res.status(400).json({ error: "Maximum top-up is R50,000" });
      }

      // In production: Verify Paystack payment reference here
      // const paystackVerification = await verifyPaystackTransaction(paymentReference);

      // Update wallet balance
      await db.update(schema.users).set({
        walletBalance: sql`COALESCE(wallet_balance, 0) + ${amount}`,
      }).where(eq(schema.users.id, userId));

      // Record transaction
      const [transaction] = await db.insert(schema.walletTransactions).values({
        userId,
        type: "topup",
        amount,
        description: "Wallet top-up via Paystack",
        status: "completed",
        paymentReference: paymentReference || `TOP-${Date.now()}`,
      }).returning();

      // Get updated balance
      const [user] = await db.select().from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      res.json({
        transaction,
        newBalance: user?.walletBalance || 0,
        currency: "R",
        message: `Successfully added R${amount.toFixed(2)} to your wallet`,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Top-up failed", message: error.message });
    }
  });

  // Transfer funds (P2P)
  router.post("/transfer", async (req, res) => {
    try {
      const { senderId, recipientPhone, amount, message } = req.body;

      if (!senderId || !recipientPhone || !amount) {
        return res.status(400).json({ error: "senderId, recipientPhone, and amount are required" });
      }

      // Get sender
      const [sender] = await db.select().from(schema.users)
        .where(eq(schema.users.id, senderId))
        .limit(1);

      if (!sender || (sender.walletBalance || 0) < amount) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      // Find recipient
      const [recipient] = await db.select().from(schema.users)
        .where(eq(schema.users.phone, recipientPhone))
        .limit(1);

      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Deduct from sender
      await db.update(schema.users).set({
        walletBalance: sql`wallet_balance - ${amount}`,
      }).where(eq(schema.users.id, senderId));

      // Add to recipient
      await db.update(schema.users).set({
        walletBalance: sql`COALESCE(wallet_balance, 0) + ${amount}`,
      }).where(eq(schema.users.id, recipient.id));

      // Record transactions for both
      await db.insert(schema.walletTransactions).values([
        {
          userId: senderId,
          type: "transfer_sent",
          amount: -amount,
          description: `Transfer to ${recipientPhone}`,
          status: "completed",
          relatedUserId: recipient.id,
          relatedUserPhone: recipientPhone,
        },
        {
          userId: recipient.id,
          type: "transfer_received",
          amount,
          description: `Transfer from ${sender.phone}`,
          status: "completed",
          relatedUserId: senderId,
          relatedUserPhone: sender.phone,
        },
      ]);

      // Record P2P transfer
      await db.insert(schema.p2pTransfers).values({
        senderId,
        recipientId: recipient.id,
        recipientPhone,
        amount,
        message: message || null,
        status: "completed",
      });

      res.json({
        message: `R${amount.toFixed(2)} sent to ${recipientPhone}`,
        currency: "R",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Transfer failed", message: error.message });
    }
  });

  // Request withdrawal (EFT)
  router.post("/withdraw", async (req, res) => {
    try {
      const { userId, amount, bankCode, accountNumber, accountName, otpCode } = req.body;

      if (!userId || !amount || !bankCode || !accountNumber) {
        return res.status(400).json({ error: "userId, amount, bankCode, and accountNumber are required" });
      }

      // 2FA check for amounts over R100
      if (amount > WITHDRAWAL_2FA_THRESHOLD) {
        if (!otpCode) {
          // Send OTP for verification
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const [user] = await db.select().from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

          if (user) {
            await db.insert(schema.otpCodes).values({
              phone: user.phone,
              code,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });
          }

          return res.status(202).json({
            message: "2FA required for withdrawals over R100. OTP sent to your phone.",
            requires2FA: true,
          });
        }

        // Verify OTP
        const [user] = await db.select().from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (user) {
          const [otp] = await db.select().from(schema.otpCodes)
            .where(eq(schema.otpCodes.phone, user.phone))
            .orderBy(desc(schema.otpCodes.createdAt))
            .limit(1);

          if (!otp || otp.code !== otpCode || new Date() > otp.expiresAt) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
          }
        }
      }

      // Check balance
      const [user] = await db.select().from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user || (user.walletBalance || 0) < amount) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      // In production: Verify bank account via Paystack Resolve Account API
      // const bankVerification = await paystackResolveAccount(accountNumber, bankCode);

      // Create withdrawal request (pending)
      const [withdrawal] = await db.insert(schema.withdrawalRequests).values({
        userId,
        amount,
        bankCode,
        accountNumber,
        accountName: accountName || null,
        narration: `Haibo Pay withdrawal - ${new Date().toISOString().split("T")[0]}`,
        status: "pending",
        reference: `WD-${Date.now()}`,
      }).returning();

      // Freeze the amount (deduct from balance, mark as frozen in transaction)
      await db.update(schema.users).set({
        walletBalance: sql`wallet_balance - ${amount}`,
      }).where(eq(schema.users.id, userId));

      // Record frozen transaction
      await db.insert(schema.walletTransactions).values({
        userId,
        type: "payment",
        amount: -amount,
        description: `Withdrawal (pending EFT) - Ref: ${withdrawal.reference}`,
        status: "pending",
        paymentReference: withdrawal.reference,
        metadata: { withdrawalId: withdrawal.id, frozen: true },
      });

      res.json({
        withdrawal,
        message: `Withdrawal of R${amount.toFixed(2)} initiated. Funds will reflect within 24-48 hours.`,
        estimatedArrival: "24-48 hours",
        currency: "R",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Withdrawal failed", message: error.message });
    }
  });

  // Get withdrawal history
  router.get("/withdrawals/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const withdrawals = await db.select().from(schema.withdrawalRequests)
        .where(eq(schema.withdrawalRequests.userId, userId))
        .orderBy(desc(schema.withdrawalRequests.createdAt));

      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get withdrawals", message: error.message });
    }
  });

  // Verify bank account (Paystack integration point)
  router.post("/verify-bank", async (req, res) => {
    try {
      const { accountNumber, bankCode } = req.body;

      // In production: Call Paystack Resolve Account API
      // const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      //   headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      // });

      // Simulated response
      res.json({
        verified: true,
        accountName: "Account Holder",
        bankName: bankCode,
        message: "Bank account verified successfully",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Bank verification failed", message: error.message });
    }
  });

  return router;
}
