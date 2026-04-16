# EAS secrets — required before the first build

Run this once per project. EAS will inject these as environment variables
into every `eas build` invocation for every profile.

Values to source from `.env` (gitignored):

```bash
eas login   # once per machine

eas secret:create --scope project \
  --name EXPO_PUBLIC_MAPBOX_TOKEN \
  --value "pk.eyJ1...YOUR_MAPBOX_PUBLISHABLE_TOKEN" \
  --type string \
  --force

# Optional (recommended for wallet launch — swap test → live):
# eas secret:create --scope project \
#   --name EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY \
#   --value "pk_live_..." \
#   --type string \
#   --force
#
# Also needed once Firebase push is wired in:
# eas secret:create --scope project \
#   --name GOOGLE_SERVICES_JSON \
#   --type file \
#   --value ./google-services.json
#
# eas secret:create --scope project \
#   --name GOOGLE_SERVICE_INFO_PLIST \
#   --type file \
#   --value ./GoogleService-Info.plist
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
eas secret:list --scope project
```

All four (MAPBOX, PAYSTACK, GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST)
should appear before running `eas build --profile production`.
