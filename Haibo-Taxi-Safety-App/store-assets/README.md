# store-assets/ — Play Store launch kit

Everything the Play Console listing needs, in one place. Read the
**launch-runbook.md** first — it's the step-by-step for verification day.

## Contents

| File | Purpose | Status |
| --- | --- | --- |
| [`launch-runbook.md`](./launch-runbook.md) | End-to-end checklist from `eas login` to `eas submit` | ✅ Ready |
| [`play-store-listing.md`](./play-store-listing.md) | Short + full description, category, screenshot plan, pricing | ✅ Ready |
| [`data-safety.md`](./data-safety.md) | Every answer for Play Console's Data Safety form, derived from the actual schema + permissions | ✅ Ready |
| [`eas-secrets-setup.md`](./eas-secrets-setup.md) | One-time `eas secret:create` commands before the first build | ✅ Ready |
| [`feature-graphic.svg`](./feature-graphic.svg) / [`.png`](./feature-graphic.png) | 1024×500 Play Store hero | ✅ Baseline drafted, designer can iterate |
| [`app-icon-512.png`](./app-icon-512.png) | 512×512 app icon for Play Console upload | ✅ Generated from `assets/images/icon.png` |

## What is NOT here yet

| Item | Blocker | How to unblock |
| --- | --- | --- |
| **Phone screenshots** (2–8, 1080×2340 portrait) | Need a built APK running on a device/emulator | Run `eas build --platform android --profile preview`, install the APK, capture per the plan in `play-store-listing.md` |
| **Play Console service account JSON** | Account verification | After Google verifies: Play Console → Setup → API access → Download key. Save as `../play-service-account.json` (gitignored) |
| **Production keystore backup** | Depends on first `eas build --profile production` | After first build: `eas credentials --platform android --action download --profile production`. Stash in 1Password — losing this means the app can never update under this package name. |
| **Mirror `/privacy` + `/terms` to `haibo.africa`** | WordPress work | Post-launch polish — the Azure URLs work for submission |

## Privacy & terms are already live

Play Console can point at these right now:

- https://haibo-command-center.azurewebsites.net/privacy (2054 words, POPIA)
- https://haibo-command-center.azurewebsites.net/terms (1942 words)

## Re-rasterising the feature graphic

If you edit `feature-graphic.svg`, regenerate the PNG:

```bash
node /tmp/svg-to-png.mjs \
  store-assets/feature-graphic.svg \
  store-assets/feature-graphic.png \
  1024 500
```

The `svg-to-png.mjs` helper uses playwright under the hood — works wherever
Chromium is installed. If you move to a different machine, the one-liner
recipe lives in commit `6440ec6`.
