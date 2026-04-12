# Haibo App — Email Communication Services Configuration

## Overview

The Azure Email Communication Service has been fully configured and linked to the Haibo App's Communication Services resource. All sender addresses are active and ready to send transactional emails for event renewals, payment confirmations, safety alerts, and general notifications.

---

## Active Resources

| Resource | Name | Region | Status |
| :--- | :--- | :--- | :--- |
| Email Communication Service | `haibo-email-prod` | Global (Africa data) | Succeeded |
| Azure-Managed Domain | `AzureManagedDomain` | Global | Verified & Active |
| Linked Communication Service | `haibo-comms-prod` | South Africa North | Connected |

---

## Configured Sender Addresses

The following sender usernames have been created and are ready to use immediately. Each is mapped to a specific function within the Haibo App ecosystem.

| Display Name | Sender Address | Use Case |
| :--- | :--- | :--- |
| **Haibo App** | `DoNotReply@e9b540c7-cbe6-44f7-94db-d7077e43599c.azurecomm.net` | General notifications, OTP verification, account alerts |
| **Haibo Events** | `events@e9b540c7-cbe6-44f7-94db-d7077e43599c.azurecomm.net` | Event promotion confirmations, 7-day renewal reminders, ticket receipts |
| **Haibo Pay** | `payments@e9b540c7-cbe6-44f7-94db-d7077e43599c.azurecomm.net` | Payment confirmations, withdrawal receipts, wallet top-up alerts |
| **Haibo Safety** | `safety@e9b540c7-cbe6-44f7-94db-d7077e43599c.azurecomm.net` | SOS alerts, emergency contact notifications, safety report confirmations |

---

## Web App Environment Variables

All email sender addresses have been injected into the `haibo-api-prod` App Service as environment variables, ready for your server code to consume.

| Variable | Value |
| :--- | :--- |
| `AZURE_COMMS_CONNECTION_STRING` | `endpoint=https://haibo-comms-prod.africa.communication.azure.com/;accesskey=...` |
| `AZURE_EMAIL_SENDER` | `DoNotReply@e9b540c7-...azurecomm.net` |
| `AZURE_EMAIL_SENDER_GENERAL` | `DoNotReply@e9b540c7-...azurecomm.net` |
| `AZURE_EMAIL_SENDER_EVENTS` | `events@e9b540c7-...azurecomm.net` |
| `AZURE_EMAIL_SENDER_PAYMENTS` | `payments@e9b540c7-...azurecomm.net` |
| `AZURE_EMAIL_SENDER_SAFETY` | `safety@e9b540c7-...azurecomm.net` |
| `AZURE_EMAIL_DISPLAY_NAME` | `Haibo App` |

---

## Server-Side Usage Example

Below is a Node.js example showing how to send an email from your backend using the Azure Communication Services Email SDK.

```typescript
// Install: npm install @azure/communication-email
import { EmailClient } from "@azure/communication-email";

const connectionString = process.env.AZURE_COMMS_CONNECTION_STRING!;
const emailClient = new EmailClient(connectionString);

// Example: Send Event Renewal Reminder
async function sendEventRenewalEmail(recipientEmail: string, eventTitle: string) {
  const message = {
    senderAddress: process.env.AZURE_EMAIL_SENDER_EVENTS!,
    content: {
      subject: `Your Haibo Event "${eventTitle}" Expires Soon — Renew Now!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #E8364F, #FF6B6B); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0;">Haibo Events</h1>
          </div>
          <div style="padding: 24px; background: #f9f9f9;">
            <h2>Your event ad is expiring!</h2>
            <p>Your promoted event <strong>"${eventTitle}"</strong> will expire in <strong>24 hours</strong>.</p>
            <p>Renew it now for just <strong>R50.00</strong> to keep it visible for another 7 days.</p>
            <a href="https://haibo.africa/events/renew" 
               style="display: inline-block; background: #E8364F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Renew Event Ad
            </a>
          </div>
          <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
            <p>Haibo App — Keeping South Africa Moving Safely</p>
          </div>
        </div>
      `,
    },
    recipients: {
      to: [{ address: recipientEmail }],
    },
  };

  const poller = await emailClient.beginSend(message);
  const result = await poller.pollUntilDone();
  console.log("Email sent:", result.id);
}

// Example: Send Payment Confirmation
async function sendPaymentConfirmation(recipientEmail: string, amount: string, reference: string) {
  const message = {
    senderAddress: process.env.AZURE_EMAIL_SENDER_PAYMENTS!,
    content: {
      subject: `Haibo Pay — Payment Confirmed (${reference})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #E8364F, #FF6B6B); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0;">Haibo Pay</h1>
          </div>
          <div style="padding: 24px; background: #f9f9f9;">
            <h2>Payment Confirmed</h2>
            <p>Your payment of <strong>R${amount}</strong> has been processed successfully.</p>
            <p><strong>Reference:</strong> ${reference}</p>
            <p>This amount has been credited to the driver's Haibo Pay wallet.</p>
          </div>
          <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
            <p>Haibo App — Keeping South Africa Moving Safely</p>
          </div>
        </div>
      `,
    },
    recipients: {
      to: [{ address: recipientEmail }],
    },
  };

  const poller = await emailClient.beginSend(message);
  const result = await poller.pollUntilDone();
  console.log("Payment email sent:", result.id);
}

// Example: Send Safety Alert
async function sendSafetyAlert(recipientEmail: string, userName: string, location: string) {
  const message = {
    senderAddress: process.env.AZURE_EMAIL_SENDER_SAFETY!,
    content: {
      subject: `URGENT: SOS Alert from ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #FF0000, #E8364F); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0;">HAIBO SAFETY ALERT</h1>
          </div>
          <div style="padding: 24px; background: #fff3f3;">
            <h2 style="color: #E8364F;">Emergency SOS Triggered</h2>
            <p><strong>${userName}</strong> has triggered an SOS alert.</p>
            <p><strong>Location:</strong> ${location}</p>
            <p>Please contact them immediately or alert the nearest authorities.</p>
            <a href="https://maps.google.com/?q=${encodeURIComponent(location)}" 
               style="display: inline-block; background: #E8364F; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Location on Map
            </a>
          </div>
        </div>
      `,
    },
    recipients: {
      to: [{ address: recipientEmail }],
    },
  };

  const poller = await emailClient.beginSend(message);
  const result = await poller.pollUntilDone();
  console.log("Safety alert sent:", result.id);
}
```

---

## Custom Domain Setup (Optional — For Professional Branding)

When you are ready to send emails from `noreply@haibo.africa` instead of the Azure-managed domain, follow these steps:

1. **Add a Custom Domain** in the Azure Portal under Email Communication Services > Domains > Add Custom Domain.
2. **Verify DNS Records** by adding the following to your domain registrar (e.g., GoDaddy, Namecheap):
   - **TXT Record** for domain ownership verification
   - **CNAME Records** for DKIM1 and DKIM2 authentication
   - **SPF Record** for sender policy framework
3. **Create Sender Usernames** on the custom domain (e.g., `noreply@haibo.africa`, `events@haibo.africa`).
4. **Link the Custom Domain** to the Communication Service.
5. **Update Environment Variables** in the Web App to use the new sender addresses.

---

## Email Sending Limits (Azure Free Tier)

| Metric | Free Tier Limit |
| :--- | :--- |
| Emails per hour | 10 |
| Emails per day | 100 |
| Emails per month | 1,000 |

For production scale, upgrade to a **Pay-As-You-Go** plan at approximately **R0.004 per email** (R4 per 1,000 emails).
