# Google Play Data Safety form — Haibo!

Answers for the questionnaire at Play Console → App content → Data safety.
Based on actual code behaviour as of 2026-04-16.

## Top-level

| Question | Answer |
| --- | --- |
| Does your app collect or share any user data? | **Yes** |
| Is all data collected encrypted in transit? | **Yes** (HTTPS/TLS to haibo-api-prod.azurewebsites.net) |
| Do you provide a way for users to request data deletion? | **Yes** — in-app account deletion in Profile → Settings, plus email support at hello@haibo.africa |

## Data types collected

### Location
- **Precise location**: collected
  - Purposes: App functionality (taxi rank finder, SOS location, trip share)
  - Collected: Yes
  - Shared: No
  - Required: No (optional — app works without, but SOS and rank finder degrade)

### Personal info
- **Name**: collected (profile setup)
- **Email address**: collected (auth)
- **Phone number**: collected (auth via OTP)
- **User IDs**: collected (internal user ID)
  - Purposes: Account management, app functionality
  - Shared: No
  - Required: Yes for auth-gated features

### Financial info
- **User payment info**: collected ONLY via Paystack (tokenized — we never store PAN)
- **Purchase history**: collected (wallet transaction log)
  - Purposes: App functionality, fraud prevention
  - Shared with Paystack: Yes (processor)
  - Required: Yes for wallet features (optional to use wallet at all)

### Photos and videos
- **Photos**: collected (profile pic, driver KYC, community post images, incident report photos)
- **Videos**: collected (Phusha reels)
  - Purposes: App functionality
  - Shared: No (public posts are visible to other users within the app)
  - Required: No

### Audio
- **Voice or sound recordings**: collected (SOS voice note, incident report audio)
  - Purposes: App functionality, safety
  - Shared: No
  - Required: No

### Messages
- **Other in-app messages**: collected (community posts, comments)
  - Purposes: App functionality
  - Shared: Visible to other users within the app
  - Required: No

### Contacts
- **Contacts**: NOT collected from device phonebook.
  - Emergency contacts are entered MANUALLY in the app; we never read the OS contacts list.

### App activity
- **App interactions**: collected (analytics for crash/usage)
- **In-app search history**: NOT collected
  - Purposes: Analytics, crash reporting
  - Shared: No
  - Required: No

### App info and performance
- **Crash logs**: collected
- **Diagnostics**: collected
  - Purposes: Analytics, crash reporting
  - Shared: No (or Sentry if enabled — declare if so)
  - Required: No

### Device or other IDs
- **Device IDs**: collected (Expo push notification token — not an advertising ID)
  - Purposes: App functionality (notifications)
  - Shared: Firebase/Expo push servers
  - Required: No

## Data NOT collected (explicitly)

- Approximate location (we use precise)
- Email content
- SMS / call logs
- Health / fitness data
- Financial account info (no bank statements, income, etc.)
- Sexual orientation, race/ethnicity, religious beliefs, political affiliations
- Web browsing history
- Biometric raw data (Face ID / fingerprint stays in OS secure enclave — we only see "success/fail")
- Advertising IDs

## Security practices

- Data is encrypted in transit: **yes** (TLS 1.2+)
- Users can request data deletion: **yes**
- You have committed to Google Play Families Policy: **no** (not a kids app)
- Data is encrypted at rest in Azure PostgreSQL: **yes** (note for reviewer — not asked in form but worth documenting)
