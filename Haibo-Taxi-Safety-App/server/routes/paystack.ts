import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, walletTransactions, transactions, withdrawalRequests } from "../../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { verifyWebhookSignature, initializeTransaction, verifyTransaction } from "../services/paystack";
import { notifyUser } from "../services/notifications";

const router = Router();

// GET /api/paystack/status — Check if Paystack is configured (authenticated)
router.get("/status", authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({
    configured: !!process.env.PAYSTACK_SECRET_KEY,
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
    // Raw body captured by the express.json verify callback in index.ts.
    // Re-serializing req.body would reorder keys and break the HMAC —
    // signature verification must run against the exact bytes Paystack
    // sent. If rawBody is somehow missing, fall back gracefully but log.
    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) {
      console.error("[Paystack Webhook] rawBody missing — signature cannot be verified");
      res.status(400).json({ error: "Missing request body" });
      return;
    }

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

        // Same race-safe credit path as /api/wallet/topup — the client
        // and the webhook can fire concurrently on the same reference.
        // INSERT ... ON CONFLICT on transactions.reference (unique) acts
        // as the load-bearing gate; walletTransactions has no unique
        // constraint, so touching it before the gate could double-credit.
        let credited = false;
        try {
          await db.transaction(async (tx) => {
            const [claim] = await tx
              .insert(transactions)
              .values({
                userId,
                amount: amountInRands,
                type: "wallet_topup",
                status: "completed",
                reference,
                description: `Wallet top-up via Paystack`,
                completedAt: new Date(),
              })
              .onConflictDoNothing({ target: transactions.reference })
              .returning();

            if (!claim) return; // Already processed by /topup or a prior webhook.

            await tx
              .update(users)
              .set({
                walletBalance: sql`${users.walletBalance} + ${amountInRands}`,
              })
              .where(eq(users.id, userId));

            await tx.insert(walletTransactions).values({
              userId,
              type: "topup",
              amount: amountInRands,
              description: `Wallet top-up R${amountInRands.toFixed(2)}`,
              status: "completed",
              paymentReference: reference,
            });

            credited = true;
          });
        } catch (txErr) {
          console.error(`[Paystack Webhook] Credit transaction failed: ${reference}`, txErr);
          break;
        }

        if (!credited) {
          console.log(`[Paystack Webhook] Already processed: ${reference}`);
          break;
        }

        // Receipt push — fire-and-forget, don't let a slow push block the
        // 200 we owe Paystack (or they retry).
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

      case "transfer.success": {
        // Paystack has confirmed the bank delivered. Move the matching
        // withdrawal_request to 'completed' and notify the user. Keyed
        // by transfer_code rather than our own reference because only
        // transfer_code is guaranteed to be on Paystack's event shape.
        const transferCode = event.data?.transfer_code as string | undefined;
        if (!transferCode) {
          console.warn("[Paystack Webhook] transfer.success without transfer_code");
          break;
        }

        // Conditional UPDATE gates idempotency — if the webhook fires
        // twice (Paystack retries) only the first hit sees a returning()
        // row, subsequent hits no-op. Targets status='processing' so we
        // can't overwrite a row that's already been reconciled.
        const [settled] = await db
          .update(withdrawalRequests)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(withdrawalRequests.paystackTransferCode, transferCode),
              eq(withdrawalRequests.status, "processing"),
            ),
          )
          .returning();

        if (!settled) {
          console.log(
            `[Paystack Webhook] transfer.success already processed: ${transferCode}`,
          );
          break;
        }

        // Flip the pending wallet_transactions row (created on /withdraw)
        // to 'completed' so the user's history stops showing the "pending"
        // pill. We match on the negative amount + userId + type since
        // there's no stable foreign key from wallet_transactions → withdrawal_requests.
        // Best-effort — if the match misses (older rows, schema drift),
        // the money movement is still correct, only the history display
        // is slightly off.
        try {
          await db
            .update(walletTransactions)
            .set({ status: "completed" })
            .where(
              and(
                eq(walletTransactions.userId, settled.userId),
                eq(walletTransactions.amount, -Number(settled.amount)),
                eq(walletTransactions.status, "pending"),
              ),
            );
        } catch (walletErr) {
          console.warn(
            "[Paystack Webhook] Could not flip wallet_transactions to completed:",
            walletErr,
          );
        }

        try {
          await notifyUser({
            userId: settled.userId,
            type: "payment",
            title: "Withdrawal paid",
            body: `R${Number(settled.amount).toFixed(2)} has landed in your bank account.`,
          });
        } catch (notifyErr) {
          console.log("[Paystack Webhook] transfer.success notify failed:", notifyErr);
        }

        console.log(`[Paystack Webhook] Transfer completed: ${transferCode}`);
        break;
      }

      case "transfer.failed":
      case "transfer.reversed": {
        // The bank rejected the transfer (or Paystack reversed it after
        // the fact — same user-visible outcome). Refund the balance to
        // the requesting user on the correct sub-balance (fare vs.
        // wallet) and flag the row as 'failed' with the gateway reason.
        const transferCode = event.data?.transfer_code as string | undefined;
        const reason =
          (event.data?.reason as string | undefined) ||
          (event.data?.gateway_response as string | undefined) ||
          (event.event === "transfer.reversed"
            ? "Transfer reversed by Paystack"
            : "Transfer failed");

        if (!transferCode) {
          console.warn(
            "[Paystack Webhook] transfer.failed/reversed without transfer_code",
          );
          break;
        }

        // Whole refund path in a single transaction so we can never
        // flip status without crediting, or credit without flipping.
        try {
          await db.transaction(async (tx) => {
            const [claimed] = await tx
              .update(withdrawalRequests)
              .set({
                status: "failed",
                failureReason: reason,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(
                    withdrawalRequests.paystackTransferCode,
                    transferCode,
                  ),
                  eq(withdrawalRequests.status, "processing"),
                ),
              )
              .returning();

            if (!claimed) {
              // Already reconciled — idempotent no-op.
              return;
            }

            // Refund to the correct sub-balance. balanceType='fare'
            // was deducted from fareBalance in /withdraw, so we credit
            // it back to fareBalance, not walletBalance.
            if (claimed.balanceType === "fare") {
              await tx
                .update(users)
                .set({
                  fareBalance: sql`${users.fareBalance} + ${claimed.amount}`,
                })
                .where(eq(users.id, claimed.userId));
            } else {
              await tx
                .update(users)
                .set({
                  walletBalance: sql`${users.walletBalance} + ${claimed.amount}`,
                })
                .where(eq(users.id, claimed.userId));
            }

            await tx.insert(walletTransactions).values({
              userId: claimed.userId,
              type: "transfer_received",
              amount: Number(claimed.amount),
              description: `Withdrawal failed — refund (R${Number(
                claimed.amount,
              ).toFixed(2)})`,
              status: "completed",
              balanceAffected: claimed.balanceType || "wallet",
            });

            // Surface the failure to the user so they know their money
            // didn't leave — without this they'd think the transfer was
            // in progress forever.
            try {
              await notifyUser({
                userId: claimed.userId,
                type: "payment",
                title: "Withdrawal could not be completed",
                body: `We've refunded R${Number(claimed.amount).toFixed(
                  2,
                )} to your Haibo wallet. Please check your bank details and try again.`,
              });
            } catch (notifyErr) {
              console.log(
                "[Paystack Webhook] transfer.failed notify failed:",
                notifyErr,
              );
            }
          });
        } catch (txErr) {
          console.error(
            `[Paystack Webhook] Failed to process transfer.failed for ${transferCode}:`,
            txErr,
          );
        }

        console.log(
          `[Paystack Webhook] Transfer ${event.event}: ${transferCode} — ${reason}`,
        );
        break;
      }

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
