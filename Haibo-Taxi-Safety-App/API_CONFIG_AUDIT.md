# Haibo App — API Configuration Audit Report
**Date:** February 25, 2026

---

## Azure Infrastructure Status

| Service | Endpoint | Status |
|---------|----------|--------|
| App Service | `haibo-api-prod.azurewebsites.net` | **Running** (200 OK) — Default Azure landing page (no app code deployed yet) |
| PostgreSQL | `haibo-db-prod.postgres.database.azure.com` | Provisioned |
| Blob Storage | `sthaibomedia` (3 containers) | Provisioned |
| SignalR | `haibo-signalr-prod` | Provisioned |
| Communication Services | `haibo-comms-prod` | Provisioned |

---

## Configuration Findings

### 1. App Service — No Backend Code Deployed
The Azure App Service at `haibo-api-prod.azurewebsites.net` is returning the **default Azure welcome page**, meaning no Express/Node.js API server has been deployed yet. The app will operate in **offline/demo mode** using mock data until the backend is deployed.

**Action Required:** Deploy the Haibo API server code to the App Service. The `BACKEND_INTEGRATION_GUIDE.md` contains all the endpoint specifications.

### 2. EXPO_PUBLIC_DOMAIN — Now Configured
Added `EXPO_PUBLIC_DOMAIN=haibo-api-prod.azurewebsites.net` to both `preview` and `production` build profiles in `eas.json`. The app's `query-client.ts` gracefully falls back to offline/demo mode when the API returns errors.

### 3. Paystack — Test Keys Present
Paystack test public key is configured: `pk_test_1652390c7d5a1cc8d50b67bcc185cc064c00f805`
**Note:** This is a test key. For production, replace with a live Paystack key.

### 4. Google Maps API — Configured
Google Maps API key is injected at build time via the `GOOGLE_MAPS_API_KEY`
EAS environment variable. The `app.config.js` dynamic config reads it and
passes it to both `ios.config.googleMapsApiKey` and
`android.config.googleMaps.apiKey`. See `app.config.js` for the wiring.
(Previous key was rotated 2026-04-13.)

### 5. Mock Data — Preserved
As requested, all mock data remains in place. The app uses `AsyncStorage`-based local data for:
- Community posts
- Taxi routes and ranks
- Events
- Wallet transactions
- Driver profiles

The `query-client.ts` is designed to gracefully fall back to local/mock data when the API is unavailable.

---

## Command Center Integration

The app is now **linked** to the Haibo Command Center via `EXPO_PUBLIC_DOMAIN`. When the backend API is deployed:
- API calls will automatically route to `https://haibo-api-prod.azurewebsites.net`
- Mock data will continue to work as fallback
- No code changes needed — just deploy the backend

---

## Corrections Needed (Summary)

1. **Deploy backend API code** to Azure App Service (currently showing default page)
2. **Replace Paystack test key** with live key when ready for production payments
3. **Configure custom domain** `haibo.africa` DNS records at your registrar (records already generated)
4. **Set up SignalR connection** for real-time driver tracking once backend is live
