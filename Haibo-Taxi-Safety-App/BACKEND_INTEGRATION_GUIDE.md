# 🚀 Haibo App: Backend & Cloud Integration Guide

This guide provides the final implementation logic and architecture required to connect the Haibo App to live backend services. Use these prompts and instructions once you have topped up your credits to finalize the ecosystem.

---

## 🚖 1. Driver Tracking & Haibo Pay
**Objective:** Establish driver identity, real-time tracking, and digital payments.

### Implementation Steps:
1. **Persistence:** Connect the `OnboardingScreen` driver form to the `POST /api/driver/register` endpoint.
   - Save `taxiPlateNumber` and `name` to the `driver_profiles` table.
   - Generate the `payReferenceCode` using the logic: `HB-${plateNumber.replace(/\s/g, '').toUpperCase()}`.
2. **Haibo Pay Integration:**
   - Use the `payReferenceCode` as the unique identifier for Paystack sub-accounts.
   - Link the `WalletScreen` transactions to the `transactions` table in the database.
3. **GPS Tracking:**
   - Activate the background location logic in `client/lib/tracking.ts`.
   - Stream coordinates to `POST /api/driver/location-update` every 60 seconds.

**Database Schema Update:**
```sql
ALTER TABLE driver_profiles ADD COLUMN pay_reference_code TEXT UNIQUE;
ALTER TABLE driver_profiles ADD COLUMN current_latitude REAL;
ALTER TABLE driver_profiles ADD COLUMN current_longitude REAL;
ALTER TABLE driver_profiles ADD COLUMN last_location_update TIMESTAMP;
```

---

## 🤝 2. Community Backend & Media
**Objective:** Transform the community tray into a real-time social hub.

### Implementation Steps:
1. **Cloud Storage (S3/Firebase):**
   - Update `client/components/CommunityTray.tsx` to upload selected images to your cloud bucket before posting.
   - Store the resulting `imageUrl` in the `community_posts` table.
2. **Real-time Feed:**
   - Replace the `AsyncStorage` mock in `client/lib/storage.ts` with a `useQuery` hook fetching from `GET /api/community/posts`.
   - Implement WebSocket support for instant "Like" and "Comment" updates.
3. **Notifications:**
   - Configure Expo Push Notifications to trigger when a user's post receives engagement.

---

## 🎫 3. Events & Ticket Processing
**Objective:** Monetize events and provide a seamless booking experience.

### Implementation Steps:
1. **Paid Promotion (R50):**
   - When a user clicks "Promote Event", initiate a Paystack transaction for R50.00.
   - Upon success, update `is_promoted` to `true` and set `promotion_expiry` to `now() + 7 days`.
2. **Ticket Booking:**
   - Connect the "Buy Ticket" form to `POST /api/events/book-ticket`.
   - Deduct the `ticketPrice` from the user's `wallet_transactions` and issue a digital QR ticket.
3. **Web Command Center Sync:**
   - Ensure the `events` table is accessible via the Haibo Web Admin dashboard for moderation.

---

## 💳 4. Wallet & Secure Withdrawals
**Objective:** Provide a safe way for drivers and users to access their funds.

### Implementation Steps:
1. **EFT Verification:**
   - Integrate a bank verification API (like Paystack's Resolve Account) to validate account numbers before withdrawal.
2. **2FA Security:**
   - Implement a "Withdrawal PIN" or SMS OTP requirement for any withdrawal request over R100.
3. **Ledger Sync:**
   - Ensure every withdrawal creates a `pending` entry in `withdrawal_requests` and a corresponding `frozen` transaction in the wallet until processed.

---

## 📍 5. Detailed Rank Info & Maps
**Objective:** Provide real-time utility for commuters at taxi ranks.

### Implementation Steps:
1. **Live Traffic:**
   - Use the Google Maps Traffic Layer API to display congestion markers near rank locations.
2. **Dynamic Availability:**
   - Query the `location_updates` table to count how many "Active Drivers" are currently within 500m of a specific rank.
   - Display this as "Live Availability" on the Rank Detail screen.

---

**Note:** All UI components are already prepared and styled with the **Rose Red** branding and **ClarifyUX** principles. You only need to swap the `mockData` for these live API calls.
