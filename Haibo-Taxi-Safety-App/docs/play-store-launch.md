# Play Store launch checklist

Short, surgical list of what's left before we can ship Haibo! publicly
to the Play Store. Organised as `[x]` (done) / `[ ]` (outstanding) so
you can knock them off one at a time.

---

## 1. Code / config (do before the build)

- [x] `app.json` has correct package id (`com.haibo.africa.haiboapp`), scheme (`haibo-taxi`), applinks, permission strings.
- [x] `eas.json` has a `production` profile with `buildType: app-bundle` and `autoIncrement: true`.
- [x] Removed the dead `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` from `eas.json`. The client never references the public key directly — it calls `/api/paystack/initialize` and `/api/paystack/status` on the server, so the only Paystack key that matters for production is the **server-side secret** below. If you later wire up the Paystack React Native SDK for native pay sheets (skipping the WebBrowser hosted checkout), add `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` back as an EAS secret at that point.
- [ ] **Set `PAYSTACK_SECRET_KEY` on Azure** to the `sk_live_…` value. This is the ONLY Paystack key switch required for launch. Verify via Azure → App Service (`haibo-api-prod`) → Configuration → Application settings. After save, restart the app service so `process.env` refreshes.
- [ ] Set `PAYSTACK_WEBHOOK_URL` in the Paystack dashboard to `https://haibo-api-prod.azurewebsites.net/api/paystack/webhook` and flip the Live mode toggle so `transfer.success` / `transfer.failed` fire against production.
- [ ] `REFERRAL_SHARE_BASE_URL`, `VENDOR_SHARE_BASE_URL`, `INVITE_SHARE_BASE_URL`, `DRIVER_SHARE_BASE_URL` on the Azure app — these drive the hosted QR URLs that scan to Haibo's web shim. Default of `https://app.haibo.africa` is fine; confirm DNS is pointing at the right endpoint.
- [ ] Bump `app.json` → `expo.version` from `1.0.0` to whatever the first public cut is (e.g. `1.0.0` is fine for initial release; just confirm it matches what you list on Play Console).
- [ ] Apply pending migrations to the production DB **in order**: `0001_role_system_foundation`, `0002_kyc_documents`, `0003_paystack_transfers`, `0004_vendor_kyc_rejection_reason`. Run via `npm run db:migrate` from the deploy environment, not locally against prod.
- [ ] Seed the admin treasury user if not already bootstrapped — `server/services/payments.ts#ensureAdminTreasury()` does this lazily on boot but it's worth confirming `SELECT id FROM users WHERE phone='+0000000TREASURY'` returns a row.
- [ ] Confirm `play-service-account.json` at the repo root is the Play Console service account (uploaded via Play Console → Settings → API access). Do NOT commit it — add to `.gitignore` if it isn't already.

## 2. Play Console account state

Per the saved note in memory: Play Console account ID `4940235816238029775` ("Haibo! Africa") is created but **identity + developer verification is still pending**. Nothing can be submitted until that clears.

- [ ] Finish identity verification (ID document, D-U-N-S or business registration).
- [ ] Finish developer verification (2-hop email, tax form).
- [ ] Set up payments profile if you plan to take paid downloads or in-app purchases. Not needed for free download + Paystack flow.

## 3. Play Console listing (first-time app)

- [ ] Create the app in Play Console → All apps → Create app.
  - App name: `Haibo!` (22 chars max)
  - Default language: `en-ZA`
  - App or game: App · Free · Contains ads: No · In-app purchases: **Yes** (wallet top-ups)
- [ ] Complete **Data safety** form. We collect: phone, location, photos, device id, payment info (via Paystack). Data is encrypted in transit (HTTPS everywhere). Users can request deletion via Settings → Delete account (POPIA §24).
- [ ] Complete **Content rating** questionnaire. Expect PEGI 3 / ESRB Everyone — the SOS/panic content is safety, not violence.
- [ ] Set **Target audience**: 18+ (since wallet / KYC).
- [ ] **Government apps**: No.
- [ ] **News apps**: No.
- [ ] **COVID-19 contact tracing**: No.
- [ ] **Ads**: No (no ad SDK shipped).

## 4. Store assets (what you actually need to upload)

All dimensions are the exact sizes Play Console requires — crop to these.

- [ ] **App icon**: 512×512 PNG, no alpha. The source `assets/images/icon.svg` has been swapped to the new Haibo mark — regenerate every PNG derivative before building:

  ```bash
  # Using @resvg/resvg-js (zero-dep, stable on CI) — install once:
  npm i -D @resvg/resvg-js
  # Then from the repo root:
  node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');const svg=fs.readFileSync('assets/images/icon.svg');[1024,512,256,192].forEach(w=>{const r=new Resvg(svg,{fitTo:{mode:'width',value:w}});fs.writeFileSync(\`assets/images/icon-\${w}.png\`,r.render().asPng())})"
  ```

  Then manually re-save the four app-icon PNGs from the new `icon-1024.png`:
    - `assets/images/icon.png`            (1024×1024, square)
    - `assets/images/splash-icon.png`     (1024×1024, transparent background, logo only)
    - `assets/images/favicon.png`         (48×48 or 64×64)
    - `assets/images/android-icon-foreground.png` (1024×1024, 432px safe-zone)
    - `assets/images/android-icon-background.png` (solid brand backdrop — colour was `#E6F4FE` — consider updating to match the new green accent or white)
    - `assets/images/android-icon-monochrome.png` (1024×1024, white-on-transparent silhouette for Material You theming)

  `expo-splash-screen` also reads the `image`, `imageWidth`, and `backgroundColor` fields in `app.json` — if the logo's new aspect ratio (≈537:644) changes the visual balance, bump `imageWidth` from `200` to whatever looks right on-device. The in-app `LogoSplash` component already uses the new SVG directly, so the transition from native splash → React Native shell will be seamless once the native PNG is regenerated to match.
- [ ] **Feature graphic**: 1024×500 JPG/PNG. Horizontal banner shown at the top of the listing. Rose gradient background + white wordmark + a phone framing the home map.
- [ ] **Phone screenshots** — 2 minimum, 8 recommended. Size 1080×1920 or 1080×2400. Suggested order:
  1. Home + map with rank pins
  2. Community hub tiles
  3. Pusha reels feed
  4. Pay vendor / pay driver (show the QR scan flow)
  5. Send package (Haibo Hub)
  6. Driver or owner dashboard (show fare balance)
  7. Settings → Language picker (multilingual story: isiZulu, Sesotho)
  8. SOS emergency screen
- [ ] **Tablet screenshots** — required only if you check "works on tablets". `supportsTablet: true` is set in `app.json` for iOS — for Android, omit this form factor to skip.
- [ ] **Short description** (80 chars): `Safer minibus taxis across Mzansi. Routes, rides, community, safety.`
- [ ] **Full description** (4000 chars): pull from `command-center/src/pages/public/HomePage.tsx` hero + feature list so web and store stay consistent.

## 5. Policy URLs (must be live before submission)

- [ ] Privacy policy: `https://app.haibo.africa/privacy` — served from the command-center's public shell. Confirm it resolves in incognito.
- [ ] Terms of service: `https://app.haibo.africa/terms` — same check.
- [ ] Support contact: `support@haibo.africa` — confirm it's a real mailbox with someone reading it.

## 6. The build

Run from the project root with EAS CLI logged in (`eas whoami`).

```bash
# Production Android App Bundle (goes to Play Console)
eas build --platform android --profile production

# Wait for the green tick, download the .aab link, then upload.
# eas submit can do the upload for you if play-service-account.json is in place:
eas submit --platform android --profile production --latest
```

## 7. First upload → closed testing → production

Play's modern flow gates production behind a testing track — plan on ~2 weeks before you can push the public toggle.

1. Upload the first .aab to **Internal testing**. Add yourself + the Haibo team as testers. Install via the Play link on a real device. Smoke test: register → OTP → ProfileSetup → pay a vendor → check wallet.
2. Promote to **Closed testing** and invite 12+ external testers who actually use the app for ≥14 days. This is a Play requirement for new developer accounts (Aug 2024 policy). Keep them engaged in a WhatsApp group.
3. After the 14-day external-testing window, Play lets you submit for **Production review**. Reviews take 3-7 days typically.

## 8. Post-launch (first 48 hours)

- [ ] Monitor **Crashlytics / Sentry** (if wired) — not currently shipped, consider adding before v1.1.
- [ ] Watch `server/routes/admin.ts#system-metrics` dashboard for active user count, SOS alerts, withdrawal volume.
- [ ] Pin the Paystack dashboard in a tab for live transfer monitoring.
- [ ] Keep `npm run db:migrate` on the launch-day deploy branch only — don't cherry-pick new migrations to production before closed testing catches regressions.

---

**Known follow-ups to ship in v1.1** (not blocking launch):

- In-app universal QR scanner (needs `expo-camera` dep + EAS rebuild).
- KYC review queue realtime socket (admin has to poll right now).
- Role switcher haptic-to-toast confirmation.
- Sentry / Crashlytics wiring for prod error visibility.
