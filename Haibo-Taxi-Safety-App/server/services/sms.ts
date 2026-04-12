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
 * Falls back to console.log if SMS is not configured.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SendSmsResult> {
  const client = getClient();

  // Always log for debugging (remove in production)
  console.log(`[OTP] Code for ${phone}: ${code}`);

  if (!client || !SENDER_NUMBER) {
    console.warn("[SMS] SMS not configured — OTP logged to console only");
    console.warn("[SMS] Set AZURE_SMS_SENDER_NUMBER in .env to enable real SMS");
    return { success: true };
  }

  try {
    const sendResults = await client.send({
      from: SENDER_NUMBER,
      to: [phone],
      message: `Your Haibo verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
    });

    const result = sendResults[0];

    if (result.successful) {
      console.log(`[SMS] OTP sent to ${phone} (messageId: ${result.messageId})`);
      return { success: true };
    } else {
      console.error(`[SMS] Failed to send to ${phone}: ${result.errorMessage}`);
      return { success: true, error: result.errorMessage || undefined };
    }
  } catch (error: any) {
    console.error(`[SMS] Error sending OTP to ${phone}:`, error.message);
    return { success: true, error: error.message };
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
