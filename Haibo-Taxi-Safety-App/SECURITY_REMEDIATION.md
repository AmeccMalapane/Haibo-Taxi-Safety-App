# Security Remediation — Action Items

_Generated 2026-04-13 alongside the audit + code-fix sprint._

This document lists the **manual** steps you need to take that code changes can't do for you. Everything in the companion commit is done; this is the human side.

---

## 🔴 P0 — Do today

### 1. Rotate all production secrets

Assume every credential that was ever on disk in this repo is compromised. Rotate:

| Service | Where | What to rotate |
|---|---|---|
| **Paystack** | dashboard.paystack.com → Settings → API Keys | Secret key `sk_live_*` — revoke old, generate new |
| **Azure PostgreSQL** | Azure Portal → `haibo-db-prod` → Reset password | `haiboadmin` password |
| **JWT secrets** | Generate locally: `openssl rand -hex 64` | `JWT_SECRET` and `JWT_REFRESH_SECRET` |
| **Mapbox** | account.mapbox.com → Access Tokens | Public token (rotate anyway — can scope it) |
| **Google Maps (Android + iOS)** | Google Cloud Console → APIs & Services → Credentials | Both keys in `app.json` |
| **Firebase (google-services.json)** | Firebase Console → Project Settings → General | Re-download new config (and set SHA-256 fingerprint restrictions) |
| **Azure Storage** | Azure Portal → `sthaibomedia` → Access keys → Rotate | Storage account key |
| **Azure SignalR** | Azure Portal → Keys → Regenerate | Primary access key |
| **Azure Communication Services** | Azure Portal → Keys → Regenerate | Primary access key |
| **Azure service principal** (from `AZURE_CREDENTIALS.json` in your Downloads) | Azure AD → App registrations → Certificates & secrets | Revoke client secret, generate new |

### 2. Move secrets out of the repo

- **Server side** (Azure App Service): set each secret as an **App Setting** in `haibo-api-prod` → Configuration. The Node process reads them as `process.env.*` — no code change needed.
- **Mobile side**: use **EAS Secrets** (`eas secret:create`) for any key the client needs at build time. Remove hardcoded values from `eas.json` and reference them via `$SECRET_NAME`.
- **Google Maps keys in `app.json`**: move to `app.config.ts` (dynamic) and read from env. Restrict the keys to the app bundle ID / SHA-256 in Google Cloud Console.

### 3. Purge committed secret from git history

Only `google-services.json` was in the index (already removed in this commit). Its history still contains the old Firebase keys until you rewrite the history.

**Recommended:** use `git filter-repo` (not `filter-branch`, which is deprecated and slower):

```bash
# Install if needed:
brew install git-filter-repo

# Back up the repo first:
cp -r Haibo-Taxi-Safety-App Haibo-Taxi-Safety-App-backup

# Purge the file from all history:
cd Haibo-Taxi-Safety-App
git filter-repo --path google-services.json --invert-paths

# Force push (ONLY after rotating Firebase keys — purging without rotating is useless):
git push origin main --force
```

Coordinate with anyone else who has the repo cloned — they'll need to re-clone.

### 4. Install a pre-commit hook to prevent recurrence

```bash
# Using pre-commit (https://pre-commit.com)
pip install pre-commit
cat > .pre-commit-config.yaml <<'EOF'
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
EOF
pre-commit install
```

Also enable **GitHub secret scanning + push protection** in the repo settings (free for public repos, included for private repos on paid plans).

---

## 🟡 P1 — This week

### 5. Run `db:push` after deploy

The schema changes in this sprint (`otpCodes.attempts`, new `sos_alerts` table) need to hit the production database. In a low-traffic window:

```bash
# Make sure DATABASE_URL points at prod, then:
npm run db:push
```

**Verify** the changes with `npm run db:studio` or `psql` before closing the ticket.

### 6. Deploy the server changes

Push to `main` — GitHub Actions will auto-deploy to `haibo-api-prod`. Watch the deployment logs:

```bash
az webapp log tail --name haibo-api-prod --resource-group <your-rg>
```

If the server fails to start, it will now be because `JWT_SECRET` isn't set in App Service config — that's the fail-fast change in `middleware/auth.ts`. Set it and re-deploy.

### 7. Add `ALLOWED_ORIGINS` env var on Azure

In `haibo-api-prod` → Configuration, add:

```
ALLOWED_ORIGINS=https://haibo.africa,https://app.haibo.africa,https://command.haibo.africa
```

(Adjust for whichever domains your Command Center and web front-ends actually use.) Without this, production CORS will reject all browser-origin requests after these fixes — by design.

### 8. Verify mobile client changes

The audit flagged ~59% of screens as potentially using mock data. You still need to:

- Confirm every screen is using React Query hooks against the live API
- Add token refresh flow (currently missing)
- Add guest SOS path (unauthenticated users must be able to trigger SOS — this is a safety app)

None of this was in the code-fix sprint — it's a separate mobile verification pass.

---

## 🟢 P2 — Next week

### 9. Add foreign keys + indexes to the Drizzle schema

The 51 tables currently have zero FK constraints and no indexes on hot columns (`userId`, `driverId`, `taxiId`, `locationId`). Generate a migration with real FKs and composite indexes before the data grows further. Run in a low-traffic window; back up first.

### 10. Archive doc sprawl

There are 49 markdown files in the repo root. Keep: `ARCHITECTURE_OVERVIEW.md`, `API_INTEGRATION_GUIDE.md`, `SETUP_GUIDE.md`, `ANDROID_APK_BUILD_GUIDE.md`, `design_guidelines.md`, plus this file. Move the rest to `docs/archive/`.

### 11. Decide the fate of `command-center/` and `scripts/fb-sync/`

Both appear orphaned. Either wire them into CI/CD or archive them.

---

## What the code sprint changed

Summary of edits in this commit (for your records):

**Auth hardening:**
- `server/middleware/auth.ts` — Removed JWT fallback secret; server now exits on missing `JWT_SECRET`
- `server/index.ts` — Production CORS now rejects unknown origins (dev stays permissive)
- `server/services/realtime.ts` — Socket.IO CORS aligned with HTTP CORS policy

**Endpoint access control (12 routes):**
- `drivers.ts` — `GET /:id` now requires auth
- `rides.ts` — `GET /`, `GET /:id` now require auth
- `locations.ts` — `GET /` and `/nearby` use `optionalAuth` (pre-login browsing preserved); `GET /:id` requires auth
- `community.ts` — Posts use `optionalAuth` (public social wall preserved, but trackable)
- `deliveries.ts` — `GET /:id`, `PUT /:id/status`, `GET /packages/track/:trackingNumber` now require auth; ownership checks added
- `paystack.ts` — `GET /status` now requires auth; removed public-key leak
- `taxis.ts` — `GET /:id` and `PUT /:id` now enforce owner-or-admin

**OTP + reset-password:**
- `server/middleware/rateLimit.ts` — Added `otpSendPhoneRateLimit` (3/hour per phone), `financialRateLimit`, `sosRateLimit`
- `shared/schema.ts` — `otpCodes.attempts` column added
- `server/routes/auth.ts` — OTP send invalidates prior unverified codes; verify-otp tracks failed attempts and burns the code after 5 failures; reset-password now enforces 10-minute TTL via `createdAt` check

**Financial + SOS rate limits:**
- `wallet.ts` — `/transfer` rate-limited (10/hour per user)
- `notifications.ts` — `/sos` rate-limited (3/minute per user) + lat/lon range validation

**SOS audit trail:**
- `shared/schema.ts` — New `sos_alerts` table (immutable log)
- `server/services/notifications.ts` — **Fixed runtime bug**: code was importing a non-existent `emergencyContacts` table and would have crashed on first SOS. Now uses the inline `users.emergencyContactPhone` field. Every alert is persisted to `sos_alerts`.
- `server/services/realtime.ts` — WS `sos:trigger` now routes through `sendSOSAlert` so WebSocket-triggered alerts also hit the audit table and SMS flow. Added lat/lon validation and per-user rate limiting.

**Socket.IO hardening:**
- `services/realtime.ts` — `location:update` validates coordinates and throttles to 1 update per 2s per driver; `sos:trigger` rate-limited to 1/minute per user; throttle state cleaned up on disconnect

**Hygiene:**
- `.gitignore` — Added blocks for all common secret file patterns
- `google-services.json` — Removed from git index (local file preserved)
