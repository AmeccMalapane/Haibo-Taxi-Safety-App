# EAS environment variables — required before builds

Uses the current `eas env:*` commands (the older `eas secret:*` commands
are deprecated in `eas-cli` v16+).

## Already set on this project

As of 2026-04-16, `eas env:list --environment production` shows:

- `EXPO_PUBLIC_MAPBOX_TOKEN` (plaintext) — set for production, preview, development
- `GOOGLE_MAPS_API_KEY` (sensitive)
- `GOOGLE_MAPS_API_KEY_IOS` (sensitive)
- `GOOGLE_SERVICES_JSON` (sensitive, file type)
- `GOOGLE_SERVICE_INFO_PLIST` (sensitive, file type)

## If you need to re-create any of them

```bash
# Auth (one per machine) — or set EXPO_TOKEN in your shell
eas login

# Mapbox publishable token (client-safe, URL-restricted in Mapbox dashboard)
eas env:create \
  --scope project \
  --name EXPO_PUBLIC_MAPBOX_TOKEN \
  --value "pk.eyJ1...YOUR_MAPBOX_PUBLISHABLE_TOKEN" \
  --type string \
  --visibility plaintext \
  --environment production --environment preview --environment development \
  --force

# Paystack — swap pk_test → pk_live before wallet launch:
# eas env:create --scope project --name EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY \
#   --value "pk_live_..." --type string --visibility plaintext \
#   --environment production --force

# Firebase files (when rotating):
# eas env:create --scope project --name GOOGLE_SERVICES_JSON \
#   --type file --value ./google-services.json --visibility sensitive \
#   --environment production --force
#
# eas env:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \
#   --type file --value ./GoogleService-Info.plist --visibility sensitive \
#   --environment production --force
```

## Why secrets (not hardcoded in eas.json)

- `pk.` Mapbox tokens and `pk_` Paystack keys are publishable/client-safe in
  principle, but committing them triggers GitHub's push protection and gets
  noisy in gitleaks.
- EAS secrets let us rotate without a code change.
- `google-services.json` and `GoogleService-Info.plist` are **not** client-safe
  and must go through EAS file secrets — never commit them.

## Verify

```bash
eas env:list --environment production
eas env:list --environment preview
```

The five vars above should appear before running `eas build --profile production`.
