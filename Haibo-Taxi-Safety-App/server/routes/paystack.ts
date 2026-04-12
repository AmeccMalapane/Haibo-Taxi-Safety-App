import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, walletTransactions, transactions } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { verifyWebhookSignature, initializeTransaction, verifyTransaction } from "../services/paystack";
import { notifyUser } from "../services/notifications";

const router = Router();

// GET /api/paystack/status — Check if Paystack is configured
router.get("/status", (req, res: Response) => {
  res.json({
    configured: !!process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
  });
});

// POST /api/paystack/initialize — Create a payment checkout session
router.post("/initialize", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { email, amount, purpose } = req.body;

    if (!email || !amount) {
      res.status(400).json({ error: "Email and amount are required" });
      return;
    }

    const amountInCents = Math.round(amount * 100); // Convert Rands to cents

    const result = await initializeTransaction({
      email,
      amount: amountInCents,
      metadata: {
        userId: req.user!.userId,
        phone: req.user!.phone,
        purpose: purpose || "haibo_wallet_topup",
      },
    });

    if (result.success) {
      // Record pending transaction
      await db.insert(transactions).values({
        userId: req.user!.userId,
        amount: amount,
        type: "wallet_topup",
        status: "pending",
        reference: result.reference,
        description: `Wallet top-up R${amount}`,
      });

      res.json({
        success: true,
        authorization_url: result.authorization_url,
        reference: result.reference,
      });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error: any) {
    console.error("Paystack initialize error:", error);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// GET /api/paystack/verify/:reference — Verify a transaction after redirect
router.get("/verify/:reference", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    const result = await verifyTransaction(reference);

    if (result.verified) {
      const amountInRands = (result.amount || 0) / 100;

      // Check if already processed (idempotency)
      const existing = await db.select().from(transactions)
        .where(eq(transactions.reference, reference))
        .limit(1);

      if (existing.length > 0 && existing[0].status === "completed") {
        res.json({ verified: true, alreadyProcessed: true });
        return;
      }

      // Credit wallet
      await db.update(users)
        .set({ walletBalance: sql`${users.walletBalance} + ${amountInRands}` })
        .where(eq(users.id, req.user!.userId));

      // Update transaction status
      await db.update(transactions)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(transactions.reference, reference));

      // Record in wallet transactions
      await db.insert(walletTransactions).values({
        userId: req.user!.userId,
        type: "topup",
        amount: amountInRands,
        description: `Wallet top-up via Paystack`,
        status: "completed",
        paymentReference: reference,
      });

      res.json({ verified: true, amount: amountInRands });
    } else {
      res.json({ verified: false, status: result.status, error: result.error });
    }
  } catch (error: any) {
    console.error("Paystack verify error:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// POST /api/paystack/webhook — Paystack webhook handler (no auth — signed by Paystack)
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("[Paystack Webhook] Invalid signature — rejected");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const event = req.body;
    console.log(`[Paystack Webhook] Event: ${event.event}`, event.data?.reference);

    switch (event.event) {
      case "charge.success": {
        const data = event.data;
        const reference = data.reference;
        const amountInRands = data.amount / 100;
        const userId = data.metadata?.userId;

        if (!userId || !reference) {
          console.warn("[Paystack Webhook] Missing userId or reference in metadata");
          break;
        }

        // Check idempotency — don't double-credit
        const existing = await db.select().from(transactions)
          .where(eq(transactions.reference, reference))
          .limit(1);

        if (existing.length > 0 && existing[0].status === "completed") {
          console.log(`[Paystack Webhook] Already processed: ${reference}`);
          break;
        }

        // Credit wallet
        await db.update(users)
          .set({ walletBalance: sql`${users.walletBalance} + ${amountInRands}` })
          .where(eq(users.id, userId));

        // Update or create transaction record
        if (existing.length > 0) {
          await db.update(transactions)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(transactions.reference, reference));
        } else {
          await db.insert(transactions).values({
            userId,
            amount: amountInRands,
            type: "wallet_topup",
            status: "completed",
            reference,
            description: `Wallet top-up via Paystack`,
            completedAt: new Date(),
          });
        }

        // Record in wallet transactions
        await db.insert(walletTransactions).values({
          userId,
          type: "topup",
          amount: amountInRands,
          description: `Wallet top-up R${amountInRands.toFixed(2)}`,
          status: "completed",
          paymentReference: reference,
        });

        // Send push notification
        try {
          await notifyUser({
            userId,
            type: "payment",
            title: "Top-up successful",
            body: `R${amountInRands.toFixed(2)} has been added to your Haibo wallet.`,
            data: { reference, amount: String(amountInRands) },
          });
        } catch (notifyErr) {
          console.log("[Paystack Webhook] Push notification failed:", notifyErr);
        }

        console.log(`[Paystack Webhook] Credited R${amountInRands} to user ${userId}`);
        break;
      }

      case "charge.failed": {
        const data = event.data;
        const reference = data.reference;
        const userId = data.metadata?.userId;

        if (reference) {
          await db.update(transactions)
            .set({ status: "failed", failureReason: data.gateway_response || "Payment failed" })
            .where(eq(transactions.reference, reference));
        }

        if (userId) {
          await notifyUser({
            userId,
            type: "payment",
            title: "Payment failed",
            body: "Your wallet top-up could not be processed. Please try again.",
          });
        }

        console.log(`[Paystack Webhook] Payment failed: ${reference}`);
        break;
      }

      case "transfer.success":
      case "transfer.failed":
        console.log(`[Paystack Webhook] Transfer event: ${event.event}`);
        break;

      default:
        console.log(`[Paystack Webhook] Unhandled event: ${event.event}`);
    }

    // Always respond 200 to Paystack (they retry on non-200)
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[Paystack Webhook] Error:", error);
    // Still return 200 to prevent Paystack retries on our error
    res.status(200).json({ received: true });
  }
});

export default router;
