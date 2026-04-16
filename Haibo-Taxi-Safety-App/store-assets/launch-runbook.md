# Haibo! — Play Store launch-day runbook

Run top-to-bottom the day Play Console account verification clears.
Everything above **§4 Upload** can be done in parallel; §4 onward is serial.

## 1. Credentials & secrets (one-time)

From this machine, in the repo root:

```bash
cd Haibo-Taxi-Safety-App

# EAS auth
eas login

# Set the project secrets the build reads (see store-assets/eas-secrets-setup.md)
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN \
  --value "pk.eyJ...$(from .env)" --type string --force
eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json --force
eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \
  --type file --value ./GoogleService-Info.plist --force

# Verify
eas secret:list --scope project
```

## 2. Generate a production build

```bash
eas build --platform android --profile production --non-interactive
```

First run will prompt to generate a keystore via EAS managed credentials.
Say **yes** — EAS stores and reuses it for every subsequent build. Losing
this keystore means the app can never be updated under this package name
again, so back it up after the build:

```bash
eas credentials --platform android          # view
eas credentials --platform android \
  --action download --profile production    # download keystore locally
```

Stash the downloaded keystore in 1Password / a secure vault. Do NOT commit.

## 3. Capture screenshots from the preview build

While the production build runs, fire a preview APK on a device or emulator:

```bash
eas build --platform android --profile preview --non-interactive
```

When the APK lands, install and capture these eight screenshots at
1080×2340 portrait (see `play-store-listing.md` for the plan).

## 4. Upload to Play Console

At this point the Play Console account is verified and you can create
the app. In Play Console:

1. **Create app** → name "Haibo! Taxi Safety", default lang English (SA),
   app or game "App", free or paid "Free".
2. **Store listing** → copy short + full description from
   `play-store-listing.md`, upload 512px icon, 1024×500 feature graphic,
   2–8 phone screenshots.
3. **Policies / App content**:
   - **Privacy policy URL**: `https://haibo-command-center.azurewebsites.net/privacy`
   - **Data safety**: answer using `data-safety.md`
   - **Content rating**: fill questionnaire → target PEGI 3 / Everyone
   - **Target audience**: 13+
   - **Ads**: no
   - **Data safety "is all data encrypted in transit"**: yes
4. **App category**: Maps & Navigation (primary) / Travel & Local (secondary).
5. **Production → Countries**: South Africa only.
6. **Download "API access" service account JSON** from Play Console →
   Setup → API access. Save as `Haibo-Taxi-Safety-App/play-service-account.json`
   (gitignored).

Then upload the AAB:

```bash
eas submit --platform android --profile production --non-interactive
```

This targets the **internal** track with **draft** status (see `eas.json`).
Bump to "closed testing" or "production" from the Play Console UI once a
few testers have smoked it.

## 5. Post-launch (first 48 hours)

- Watch Play Console → Release → Overview for crash-free rate and ANRs.
- Watch Azure Application Insights for server error spikes.
- Keep BulkSMS balance ≥ R500 until onboarding stabilises (OTP traffic spikes
  on launch day).
- Watch support@haibo.africa and privacy@haibo.africa for user mail.
- Mirror `/privacy` and `/terms` to `haibo.africa/privacy` + `haibo.africa/terms`
  via WordPress so the Play Console URL moves off `azurewebsites.net` (content
  stays identical — point WP at the same markdown source or export from the
  React route).

## 6. What CAN'T be done until Play Console verification clears

- Cannot create the app entry in Play Console
- Cannot generate the service account JSON (needs "API access" page, which
  is gated on account verification)
- `eas submit` will therefore fail until §4.6 is done

Everything in §1–§3 can run today without Play Console access — so you can
arrive at verification day with a signed AAB, screenshots, and all store
copy already in hand.
