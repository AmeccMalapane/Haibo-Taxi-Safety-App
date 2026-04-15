import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Verify Paystack webhook signature (HMAC-SHA512).
 * Uses timingSafeEqual to avoid exposing secret length via short-circuit
 * comparison, and guards against length-mismatch throws.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!PAYSTACK_SECRET || !signature) return false;

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body)
    .digest("hex");

  if (hash.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Initialize a Paystack transaction (generate checkout URL).
 */
export async function initializeTransaction(params: {
  email: string;
  amount: number; // in kobo/cents (R50 = 5000)
  reference?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}): Promise<{ success: boolean; authorization_url?: string; reference?: string; error?: string }> {
  if (!PAYSTACK_SECRET) {
    return { success: false, error: "Paystack not configured" };
  }

  const reference = params.reference || `HB-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        reference,
        currency: "ZAR",
        metadata: params.metadata || {},
        callback_url: params.callbackUrl,
      }),
    });

    const data = await res.json();

    if (data.status) {
      return {
        success: true,
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      };
    }

    return { success: false, error: data.message || "Failed to initialize transaction" };
  } catch (error: any) {
    console.error("[Paystack] Initialize error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify a transaction by reference via Paystack API.
 */
export async function verifyTransaction(reference: string): Promise<{
  verified: boolean;
  amount?: number;
  email?: string;
  status?: string;
  metadata?: Record<string, any>;
  error?: string;
}> {
  if (!PAYSTACK_SECRET) {
    return { verified: false, error: "Paystack not configured" };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const data = await res.json();

    if (data.status && data.data.status === "success") {
      return {
        verified: true,
        amount: data.data.amount, // in kobo/cents
        email: data.data.customer?.email,
        status: data.data.status,
        metadata: data.data.metadata,
      };
    }

    return { verified: false, status: data.data?.status, error: data.message };
  } catch (error: any) {
    console.error("[Paystack] Verify error:", error.message);
    return { verified: false, error: error.message };
  }
}
