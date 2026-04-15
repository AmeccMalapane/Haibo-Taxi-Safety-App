import { SmsClient } from "@azure/communication-sms";

const CONNECTION_STRING = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const SENDER_NUMBER = process.env.AZURE_SMS_SENDER_NUMBER;

let smsClient: SmsClient | null = null;

function getClient(): SmsClient | null {
  if (!CONNECTION_STRING) {
    console.warn("[SMS] AZURE_COMMUNICATION_CONNECTION_STRING not set — SMS disabled");
    return null;
  }
  if (!smsClient) {
    smsClient = new SmsClient(CONNECTION_STRING);
  }
  return smsClient;
}

export interface SendSmsResult {
  success: boolean;
  error?: string;
}

/**
 * Send an OTP code via Azure Communication Services SMS.
 *
 * In dev (NODE_ENV !== "production") without SMS configured, the code is
 * logged to stdout as a fallback delivery channel and success is returned
 * so local testing works. In production, failure returns { success: false }
 * so the caller can surface a real error instead of silently leaving the
 * user waiting for a code that never arrives.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SendSmsResult> {
  const client = getClient();
  const isDev = process.env.NODE_ENV !== "production";

  if (!client || !SENDER_NUMBER) {
    if (isDev) {
      // Dev fallback — stdout is the delivery channel for local testing.
      // In prod we refuse to fall back: a misconfigured production SMS
      // pipeline must be visible, not silently degraded.
      console.log(`[OTP] (dev fallback) Code for ${phone}: ${code}`);
      console.warn("[SMS] SMS not configured — OTP logged to console only");
      return { success: true };
    }
    console.error(
      "[SMS] AZURE_COMMUNICATION_CONNECTION_STRING / AZURE_SMS_SENDER_NUMBER missing in production",
    );
    return { success: false, error: "SMS delivery not configured" };
  }

  try {
    const sendResults = await client.send({
      from: SENDER_NUMBER,
      to: [phone],
      message: `Your Haibo verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
    });

    const result = sendResults[0];

    if (result.successful) {
      // Never log the code itself — only the phone + message id. Azure
      // captures stdout and anyone with log access would otherwise be
      // able to read OTPs in flight (POPIA leak + credential exposure).
      console.log(`[SMS] OTP sent to ${phone} (messageId: ${result.messageId})`);
      return { success: true };
    }
    console.error(`[SMS] Failed to send to ${phone}: ${result.errorMessage}`);
    return { success: false, error: result.errorMessage || "SMS delivery failed" };
  } catch (error: any) {
    console.error(`[SMS] Error sending OTP to ${phone}:`, error.message);
    return { success: false, error: error.message || "SMS delivery error" };
  }
}

/**
 * Send a generic SMS message (for SOS alerts, delivery updates, etc.)
 */
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const client = getClient();

  if (!client || !SENDER_NUMBER) {
    console.warn(`[SMS] Would send to ${phone}: ${message}`);
    return { success: false, error: "SMS not configured" };
  }

  try {
    const sendResults = await client.send({
      from: SENDER_NUMBER,
      to: [phone],
      message,
    });

    const result = sendResults[0];
    return {
      success: result.successful,
      error: result.errorMessage || undefined,
    };
  } catch (error: any) {
    console.error(`[SMS] Error sending to ${phone}:`, error.message);
    return { success: false, error: error.message };
  }
}
