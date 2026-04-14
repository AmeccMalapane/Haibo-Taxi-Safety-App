import * as WebBrowser from "expo-web-browser";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export type PaystackTopupResult =
  | { status: "success"; amount: number; reference: string }
  | { status: "cancelled"; reference: string }
  | { status: "failed"; message: string; reference?: string };

export async function checkPaystackStatus(): Promise<boolean> {
  if (!getApiUrl()) return false;
  try {
    const data = await apiRequest("/api/paystack/status", { method: "GET" });
    return !!data?.configured;
  } catch {
    return false;
  }
}

/**
 * Runs a full Paystack top-up from the client:
 *   1. POST /api/paystack/initialize   → server creates a pending txn + returns authorization_url
 *   2. WebBrowser.openBrowserAsync    → user pays on Paystack's hosted checkout
 *   3. GET /api/paystack/verify/:ref  → regardless of how the browser closed, the server
 *                                        verifies with Paystack and credits the wallet
 *                                        (with idempotency). Webhook may have already run.
 *
 * The server is the source of truth for wallet balance. The caller should refetch
 * balance + transactions after a "success" result — never mutate local state here.
 */
export async function runPaystackTopup(opts: {
  email: string;
  amount: number;
  purpose?: string;
}): Promise<PaystackTopupResult> {
  const { email, amount, purpose = "haibo_wallet_topup" } = opts;

  let reference: string | undefined;

  try {
    const init = await apiRequest("/api/paystack/initialize", {
      method: "POST",
      body: JSON.stringify({ email, amount, purpose }),
    });

    if (!init?.success || !init.authorization_url || !init.reference) {
      return {
        status: "failed",
        message: init?.message || "Failed to initialize payment",
      };
    }

    reference = init.reference;

    await WebBrowser.openBrowserAsync(init.authorization_url, {
      showTitle: true,
      enableBarCollapsing: true,
    });

    // Verify regardless of how the browser closed. The previous code only
    // verified on cancel/dismiss, which masked real failures on iOS where
    // a completed payment returns `success` — and credited the local wallet
    // for cancelled payments.
    const verify = await apiRequest(`/api/paystack/verify/${reference}`, {
      method: "GET",
    });

    if (verify?.verified) {
      return {
        status: "success",
        amount: verify.amount ?? amount,
        reference: reference!,
      };
    }

    return { status: "cancelled", reference: reference! };
  } catch (err: any) {
    return {
      status: "failed",
      message: err?.message || "Payment could not be completed",
      reference,
    };
  }
}
