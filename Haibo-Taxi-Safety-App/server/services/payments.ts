/**
 * Payments service — the single source of truth for how money moves
 * between users on Haibo.
 *
 * Before Phase C, payments were scattered across routes (pay-vendor in
 * wallet.ts, topups in paystack.ts, nothing for fares or Hub). This
 * service centralises four patterns:
 *
 *   1. Fare payment       → 85% to driver.fareBalance, 15% to treasury
 *   2. Hub delivery       → same split, driver side = assigned driver
 *   3. Vendor sale        → 85% to vendor.walletBalance, 15% to treasury
 *   4. Peer-to-peer gift  → 100% to recipient.walletBalance (no fee)
 *
 * Each recipient credit lands in the correct sub-balance:
 *   - Drivers:  fareBalance  (owner's money, routed on withdrawal)
 *   - Others:   walletBalance (their own, direct withdrawal)
 *
 * Both sides of each payment are written in a single DB transaction so
 * the ledger never ends up half-posted. Every wallet_transactions row
 * also carries parent_transaction_id + balance_affected so ops can audit
 * which real-world event the fee and credit rows belong to.
 */

import { db } from "../db";
import {
  users,
  walletTransactions,
  p2pTransfers,
  driverProfiles,
  vendorProfiles,
} from "../../shared/schema";
import { eq, sql, and } from "drizzle-orm";

// ─── Configuration ────────────────────────────────────────────────────

/** Platform fee as a percentage (15% = 0.15). Applied to fares, Hub
 *  deliveries, and vendor sales. Topups and peer-to-peer gifts are
 *  excluded. Configurable via HAIBO_PLATFORM_FEE_PCT env var so ops can
 *  tune without a deploy (min 0%, max 25%). */
const DEFAULT_FEE_PCT = 0.15;
function getPlatformFeePct(): number {
  const raw = Number(process.env.HAIBO_PLATFORM_FEE_PCT);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_FEE_PCT;
  if (raw > 0.25) return 0.25;
  return raw;
}

/** Stable phone + display-name for the treasury user so ops can find
 *  it in any admin UI that filters by phone. The phone is deliberately
 *  out-of-band (not a valid SA number) so no real user can ever collide. */
const TREASURY_PHONE = "+0000000TREASURY";
const TREASURY_DISPLAY_NAME = "Haibo Treasury";

let cachedTreasuryId: string | null = null;

// ─── Treasury bootstrap ───────────────────────────────────────────────

/**
 * Idempotent — returns the treasury user's ID, creating it on first call.
 * Called once on server boot (see server/index.ts) AND lazily on every
 * payment so a DB restore or misconfig can't crash the payment path.
 *
 * The treasury user has role='admin' so role-gated endpoints (future
 * phases) don't need a separate case. It has no phone the passenger
 * can dial, no displayName the UI might show publicly, and no tokens
 * that could log in — it's a ledger slot, nothing more.
 */
export async function ensureAdminTreasury(): Promise<string> {
  if (cachedTreasuryId) return cachedTreasuryId;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, TREASURY_PHONE))
    .limit(1);

  if (existing) {
    cachedTreasuryId = existing.id;
    return existing.id;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      phone: TREASURY_PHONE,
      displayName: TREASURY_DISPLAY_NAME,
      role: "admin",
      isVerified: true,
      walletBalance: 0,
      fareBalance: 0,
    })
    .returning({ id: users.id });

  cachedTreasuryId = inserted.id;
  console.log(`[payments] Created admin treasury user: ${inserted.id}`);
  return inserted.id;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** 2-decimal rounding — cents precision. JS floats bite us on payment
 *  math otherwise (R100 × 0.15 = 14.999999999999998 without this). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Detect whether a user is a linked, active driver. If so, their
 *  fare credits land in fareBalance (owner's money) instead of
 *  walletBalance. Pending/suspended drivers fall back to walletBalance
 *  so they don't lose money in limbo — ops can reconcile later. */
async function getDriverLinkStatus(
  userId: string,
): Promise<"active" | null> {
  const [row] = await db
    .select({ linkStatus: driverProfiles.linkStatus })
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, userId))
    .limit(1);
  return row?.linkStatus === "active" ? "active" : null;
}

// ─── Payment types ────────────────────────────────────────────────────

export type PaymentType =
  | "fare" // passenger → driver ride fare
  | "hub_delivery" // sender → driver package delivery fee
  | "vendor_sale" // customer → vendor Haibo Pay
  | "p2p_gift"; // peer-to-peer transfer, no fee

export interface ProcessPaymentInput {
  /** Who is paying (debits this user's walletBalance). */
  senderId: string;
  /** Who gets the net amount. */
  recipientId: string;
  /** Full amount before platform fee. Must be >= 1. */
  amount: number;
  type: PaymentType;
  /** Optional note surfaced in the recipient's activity feed. */
  message?: string | null;
  /** Optional free-form context (e.g. deliveryId, rideId, vendorRef)
   *  persisted to the metadata column for audit. */
  context?: Record<string, any>;
}

export interface ProcessPaymentResult {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  recipientBalance: "wallet" | "fare";
  /** Parent transaction ID — shared between the sender row, recipient
   *  row, and fee row so audit queries can group them. */
  parentTransactionId: string;
}

// ─── The main processor ───────────────────────────────────────────────

/**
 * Atomically move money between two users, with platform-fee split
 * when applicable. Throws on insufficient funds (caller handles with
 * 400 INSUFFICIENT_FUNDS), self-payment, or bad amounts.
 */
export async function processPayment(
  input: ProcessPaymentInput,
): Promise<ProcessPaymentResult> {
  const { senderId, recipientId, type, message, context } = input;
  const gross = round2(input.amount);

  if (gross <= 0) throw new Error("INVALID_AMOUNT");
  if (senderId === recipientId) throw new Error("SELF_PAYMENT");

  // Compute the split. P2P gifts are fee-free; everything else takes
  // the platform cut off the top.
  const feePct = type === "p2p_gift" ? 0 : getPlatformFeePct();
  const fee = round2(gross * feePct);
  const net = round2(gross - fee);

  // Where does the recipient's share land?
  //   • Fare / Hub delivery → driver's fareBalance (if active driver)
  //   • Vendor sale         → vendor's walletBalance (direct revenue)
  //   • P2P gift            → recipient's walletBalance
  let recipientBalance: "wallet" | "fare" = "wallet";
  if (type === "fare" || type === "hub_delivery") {
    const link = await getDriverLinkStatus(recipientId);
    if (link === "active") recipientBalance = "fare";
    // else: recipient isn't an active driver → fall back to wallet so
    //       the money isn't lost. Ops can rebalance manually.
  }

  // Treasury ID lazily bootstrapped so a new install works without a
  // separate seed step.
  const treasuryId = fee > 0 ? await ensureAdminTreasury() : null;

  // Shared parent id so sender + recipient + fee rows join cleanly.
  // Generated here so we can echo it back to the caller without a
  // round-trip to read any row's id.
  const { randomUUID } = await import("crypto");
  const parentTransactionId = randomUUID();

  await db.transaction(async (tx) => {
    // 1. Debit sender (conditional, TOCTOU-safe).
    const deducted = await tx
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} - ${gross}` })
      .where(
        and(
          eq(users.id, senderId),
          sql`${users.walletBalance} >= ${gross}`,
        ),
      )
      .returning({ id: users.id });
    if (deducted.length === 0) throw new Error("INSUFFICIENT_FUNDS");

    // 2. Credit recipient — choose the right sub-balance.
    if (recipientBalance === "fare") {
      await tx
        .update(users)
        .set({ fareBalance: sql`${users.fareBalance} + ${net}` })
        .where(eq(users.id, recipientId));
    } else {
      await tx
        .update(users)
        .set({ walletBalance: sql`${users.walletBalance} + ${net}` })
        .where(eq(users.id, recipientId));
    }

    // 3. Credit treasury with the fee (if any).
    if (treasuryId && fee > 0) {
      await tx
        .update(users)
        .set({ walletBalance: sql`${users.walletBalance} + ${fee}` })
        .where(eq(users.id, treasuryId));
    }

    // 4. Ledger rows. Order matters only for the order in activity
    //    feeds (created_at defaults to now()); parent_transaction_id
    //    ties them all together.
    const senderTypeMap: Record<PaymentType, string> = {
      fare: "payment",
      hub_delivery: "payment",
      vendor_sale: "vendor_payment",
      p2p_gift: "transfer_sent",
    };
    const recipientTypeMap: Record<PaymentType, string> = {
      fare: "fare_in",
      hub_delivery: "hub_delivery_in",
      vendor_sale: "vendor_revenue_in",
      p2p_gift: "transfer_received",
    };

    await tx.insert(walletTransactions).values([
      {
        id: parentTransactionId, // reuse parent as sender row id so the join still works
        userId: senderId,
        type: senderTypeMap[type],
        amount: -gross,
        description: message || `Paid R${gross.toFixed(2)}`,
        status: "completed",
        relatedUserId: recipientId,
        balanceAffected: "wallet",
        metadata: context as any,
      },
      {
        userId: recipientId,
        type: recipientTypeMap[type],
        amount: net,
        description: message || `Received R${net.toFixed(2)}`,
        status: "completed",
        relatedUserId: senderId,
        balanceAffected: recipientBalance,
        parentTransactionId,
        metadata: context as any,
      },
    ]);

    if (treasuryId && fee > 0) {
      await tx.insert(walletTransactions).values({
        userId: treasuryId,
        type: "platform_fee_out",
        amount: fee,
        description: `Platform fee (${type}) from ${senderId.slice(0, 8)}…`,
        status: "completed",
        relatedUserId: senderId,
        balanceAffected: "wallet",
        parentTransactionId,
        metadata: { feePct, parentType: type, ...(context || {}) } as any,
      });
    }

    // 5. p2pTransfers row for backward compat (vendor directory counters,
    //    existing admin queries that aggregate sales via this table).
    //    Fee comes OUT of the transfer — transfer.amount reflects what
    //    the recipient actually received, not the gross. If a future
    //    admin report needs gross, it can multiply by the fee-inverse.
    if (type === "vendor_sale") {
      const [vendor] = await tx
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.userId, recipientId))
        .limit(1);
      if (vendor) {
        await tx
          .insert(p2pTransfers)
          .values({
            senderId,
            recipientId,
            amount: net,
            message: message || null,
            status: "completed",
            vendorRef: vendor.vendorRef,
          });
        await tx
          .update(vendorProfiles)
          .set({
            salesCount: sql`${vendorProfiles.salesCount} + 1`,
            totalSales: sql`${vendorProfiles.totalSales} + ${net}`,
            updatedAt: new Date(),
          })
          .where(eq(vendorProfiles.id, vendor.id));
      }
    } else if (type === "p2p_gift" || type === "fare") {
      // Gifts + fares: record in p2pTransfers too so driver earnings
      // queries (/me/earnings) still find them. Fare rows have vendorRef
      // null so the existing isNull(vendorRef) predicate picks them up.
      await tx.insert(p2pTransfers).values({
        senderId,
        recipientId,
        amount: net,
        message: message || null,
        status: "completed",
      });
    }
  });

  return {
    grossAmount: gross,
    feeAmount: fee,
    netAmount: net,
    recipientBalance,
    parentTransactionId,
  };
}
