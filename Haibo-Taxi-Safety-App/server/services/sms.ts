/**
 * SMS delivery via BulkSMS (https://www.bulksms.com/developer/json/v1/).
 *
 * BulkSMS is a South African aggregator with direct peering into Vodacom,
 * MTN, Cell C and Telkom — chosen over Azure Communication Services because
 * ACS requires a US/UK sender number routed internationally to reach SA
 * recipients and ACS new-tenant phone-number quotas were blocking launch.
 *
 * Auth is HTTP Basic with `${tokenId}:${tokenSecret}`. The sender field is
 * an alphanumeric ID ("HAIBO" by default) — SA networks accept alphanumeric
 * senders up to 11 chars without pre-registration for transactional traffic.
 *
 * In dev (NODE_ENV !== "production") without credentials set, OTPs fall
 * through to stdout so local testing works. In production, missing creds
 * returns `{ success: false }` so callers can surface a real error instead
 * of silently leaving the user waiting for a code that never arrives.
 */

const TOKEN_ID = process.env.BULKSMS_TOKEN_ID;
const TOKEN_SECRET = process.env.BULKSMS_TOKEN_SECRET;
const SENDER = process.env.BULKSMS_SENDER || "HAIBO";

const BULKSMS_ENDPOINT = "https://api.bulksms.com/v1/messages";

export interface SendSmsResult {
  success: boolean;
  error?: string;
}

function buildAuthHeader(): string | null {
  if (!TOKEN_ID || !TOKEN_SECRET) return null;
  const creds = Buffer.from(`${TOKEN_ID}:${TOKEN_SECRET}`).toString("base64");
  return `Basic ${creds}`;
}

interface BulkSmsResponseItem {
  id?: string;
  status?: { type?: string; subtype?: string };
}

async function sendViaBulkSms(
  to: string,
  body: string,
): Promise<SendSmsResult> {
  const auth = buildAuthHeader();
  if (!auth) {
    return { success: false, error: "BulkSMS credentials not configured" };
  }

  try {
    const res = await fetch(BULKSMS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        body,
        from: SENDER,
        // UNICODE lets us pass the full character set if marketing copy ever
        // needs to — a few bytes more per SMS but avoids silent truncation
        // of accented characters in user names etc.
        encoding: "UNICODE",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return {
        success: false,
        error: `BulkSMS ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as BulkSmsResponseItem[];
    const first = data[0];
    if (!first) {
      return { success: false, error: "BulkSMS returned an empty response" };
    }
    // BulkSMS returns `status.type = "ACCEPTED"` when the message is queued
    // for delivery. Any other status (REJECTED, FAILED, etc.) means the
    // submission failed — surface it so callers know not to claim success.
    const statusType = first.status?.type;
    if (statusType && statusType !== "ACCEPTED") {
      return {
        success: false,
        error: `BulkSMS status: ${statusType}${
          first.status?.subtype ? `/${first.status.subtype}` : ""
        }`,
      };
    }
    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "BulkSMS request failed";
    return { success: false, error: message };
  }
}

export async function sendOtpSms(
  phone: string,
  code: string,
): Promise<SendSmsResult> {
  const isDev = process.env.NODE_ENV !== "production";
  const configured = Boolean(TOKEN_ID && TOKEN_SECRET);

  if (!configured) {
    if (isDev) {
      // Dev fallback — stdout is the delivery channel for local testing.
      // Never gate prod on this: a misconfigured production SMS pipeline
      // must be visible, not silently degraded.
      console.log(`[OTP] (dev fallback) Code for ${phone}: ${code}`);
      console.warn(
        "[SMS] BulkSMS not configured — OTP logged to console only",
      );
      return { success: true };
    }
    console.error(
      "[SMS] BULKSMS_TOKEN_ID / BULKSMS_TOKEN_SECRET missing in production",
    );
    return { success: false, error: "SMS delivery not configured" };
  }

  const result = await sendViaBulkSms(
    phone,
    `Your Haibo verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
  );

  if (result.success) {
    // Never log the code itself — only the phone. Azure captures stdout
    // and anyone with log access would otherwise be able to read OTPs
    // in flight (POPIA leak + credential exposure).
    console.log(`[SMS] OTP sent to ${phone}`);
  } else {
    console.error(`[SMS] Failed to send OTP to ${phone}: ${result.error}`);
  }
  return result;
}

export async function sendSms(
  phone: string,
  message: string,
): Promise<SendSmsResult> {
  const configured = Boolean(TOKEN_ID && TOKEN_SECRET);
  if (!configured) {
    console.warn(`[SMS] Would send to ${phone}: ${message}`);
    return { success: false, error: "SMS not configured" };
  }
  return sendViaBulkSms(phone, message);
}
