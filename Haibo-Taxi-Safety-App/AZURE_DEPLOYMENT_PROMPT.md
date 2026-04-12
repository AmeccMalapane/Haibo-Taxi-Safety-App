# ☁️ Haibo App: Azure Deployment Prompt

> **Project:** Haibo! Taxi Safety App  
> **Bundle ID:** `com.haibo.africa.haiboapp`  
> **Stack:** Node.js + Express + PostgreSQL (Drizzle ORM) + React Native (Expo)  
> **Region:** South Africa North (Johannesburg)

---

## 📋 Azure Resource Group

**Resource Group Name:** `rg-haibo-app-prod`  
**Region:** South Africa North  

All resources below must be created inside this resource group for billing and management clarity.

---

## 1. Azure Database for PostgreSQL — Flexible Server

> Powers the entire Haibo data layer: users, drivers, wallets, events, community posts, and taxi ranks.

| Setting | Value |
| :--- | :--- |
| **Server Name** | `haibo-db-prod` |
| **Region** | South Africa North |
| **Version** | PostgreSQL 15 |
| **Compute Tier** | Burstable, B1ms (1 vCore, 2 GB RAM) — scale up later |
| **Storage** | 32 GB (auto-grow enabled) |
| **Admin Username** | `haiboadmin` |
| **Admin Password** | *(set a strong password, store in Key Vault)* |
| **Firewall** | Allow Azure services + your dev IP |
| **SSL** | Enforce SSL (required) |

**Post-Creation Steps:**
1. Copy the **Connection String** from the portal.
2. Format it as: `postgresql://haiboadmin:<password>@haibo-db-prod.postgres.database.azure.com:5432/haibo_prod?sslmode=require`
3. Store this as `DATABASE_URL` in Azure Key Vault.
4. Run Drizzle migrations:
```bash
DATABASE_URL="<connection_string>" npx drizzle-kit push
```

**Key Tables Created:**
- `users` — Commuters and drivers with wallet balances
- `driver_profiles` — Plate numbers, Haibo Pay reference codes, GPS tracking
- `wallet_transactions` — Full financial ledger
- `withdrawal_requests` — EFT withdrawals with 2FA flags
- `events` / `event_rsvps` — Paid event promotions and ticket bookings
- `community_posts` — Social feed with media URLs
- `group_rides` / `group_ride_participants` — Trip marketplace
- `location_updates` — Real-time driver GPS coordinates
- `transactions` — Payment ledger (ride payments, top-ups, withdrawals)

---

## 2. Azure App Service — Backend API

> Hosts the Express.js API that powers all client-server communication.

| Setting | Value |
| :--- | :--- |
| **App Name** | `haibo-api-prod` |
| **Region** | South Africa North |
| **Runtime** | Node.js 20 LTS |
| **Plan** | B1 (Basic) — 1 core, 1.75 GB RAM |
| **OS** | Linux |
| **Deployment** | GitHub Actions (from `AmeccMalapane/Haibo-Taxi-Safety-App`) |

**Environment Variables to Set:**
```
DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://haibo-keyvault.vault.azure.net/secrets/DATABASE-URL)
PAYSTACK_SECRET_KEY=@Microsoft.KeyVault(SecretUri=https://haibo-keyvault.vault.azure.net/secrets/PAYSTACK-SECRET-KEY)
JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://haibo-keyvault.vault.azure.net/secrets/JWT-SECRET)
FIREBASE_SERVICE_ACCOUNT=@Microsoft.KeyVault(SecretUri=https://haibo-keyvault.vault.azure.net/secrets/FIREBASE-SERVICE-ACCOUNT)
AZURE_STORAGE_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://haibo-keyvault.vault.azure.net/secrets/AZURE-STORAGE-CONNECTION)
NODE_ENV=production
PORT=8080
```

**API Endpoints to Deploy:**
| Endpoint | Purpose |
| :--- | :--- |
| `POST /api/auth/register` | User registration (commuter/driver) |
| `POST /api/auth/login` | Phone + OTP login |
| `POST /api/driver/register` | Driver onboarding with plate number |
| `POST /api/driver/location-update` | GPS coordinate streaming |
| `GET /api/community/posts` | Community feed |
| `POST /api/community/posts` | Create community post with media |
| `POST /api/events/create` | Create event (R50 promotion fee) |
| `POST /api/events/book-ticket` | Purchase event tickets |
| `GET /api/wallet/balance` | Wallet balance |
| `POST /api/wallet/topup` | Paystack top-up |
| `POST /api/wallet/withdraw` | EFT withdrawal request |
| `GET /api/ranks/nearby` | Location-based taxi rank search |
| `POST /api/ratings/driver` | Submit driver rating |
| `POST /api/rides/create` | Post a group ride |
| `POST /api/rides/book` | Book a seat on a group ride |

---

## 3. Azure Blob Storage — Media & Assets

> Stores community photos, event posters, driver profile images, and lost & found uploads.

| Setting | Value |
| :--- | :--- |
| **Account Name** | `haibomediaprod` |
| **Region** | South Africa North |
| **Performance** | Standard |
| **Redundancy** | LRS (Locally Redundant) |
| **Access Tier** | Hot |

**Containers to Create:**
| Container | Access Level | Purpose |
| :--- | :--- | :--- |
| `community-media` | Blob (public read) | Community post images |
| `event-posters` | Blob (public read) | Event promotion images |
| `driver-photos` | Private | Driver profile and vehicle photos |
| `lost-found` | Blob (public read) | Lost & Found item images |
| `group-ride-posters` | Blob (public read) | Group ride route posters |

**Upload URL Pattern:**
```
https://haibomediaprod.blob.core.windows.net/{container}/{userId}/{timestamp}_{filename}
```

---

## 4. Azure SignalR Service — Real-Time Features

> Powers live driver tracking, community feed updates, and group ride chat.

| Setting | Value |
| :--- | :--- |
| **Name** | `haibo-signalr-prod` |
| **Region** | South Africa North |
| **Tier** | Free (up to 20 concurrent connections) — upgrade to Standard later |
| **Service Mode** | Serverless |

**Real-Time Channels:**
| Channel | Purpose |
| :--- | :--- |
| `driver-location-{driverId}` | Live GPS tracking for commuters |
| `community-feed` | Instant post, like, and comment updates |
| `group-ride-{rideId}` | Chat and booking updates for group rides |
| `rank-availability-{rankId}` | Live driver count at taxi ranks |

---

## 5. Azure Key Vault — Secrets Management

> Securely stores all API keys, database credentials, and tokens.

| Setting | Value |
| :--- | :--- |
| **Name** | `haibo-keyvault` |
| **Region** | South Africa North |
| **SKU** | Standard |

**Secrets to Store:**
| Secret Name | Description |
| :--- | :--- |
| `DATABASE-URL` | PostgreSQL connection string |
| `PAYSTACK-SECRET-KEY` | Paystack API secret for payments |
| `PAYSTACK-PUBLIC-KEY` | Paystack public key for client-side |
| `JWT-SECRET` | JSON Web Token signing secret |
| `FIREBASE-SERVICE-ACCOUNT` | Firebase Admin SDK JSON (for push notifications) |
| `AZURE-STORAGE-CONNECTION` | Blob Storage connection string |
| `GOOGLE-MAPS-API-KEY` | Google Maps API key for traffic data |
| `SIGNALR-CONNECTION-STRING` | SignalR connection string |

---

## 6. Azure Communication Services — Email & SMS

> Handles event renewal reminders, OTP codes, and ticket confirmations.

| Setting | Value |
| :--- | :--- |
| **Name** | `haibo-comms-prod` |
| **Region** | Global |

**Use Cases:**
| Trigger | Channel | Template |
| :--- | :--- | :--- |
| Event promotion expires in 24h | Email | "Your Haibo event ad expires tomorrow. Renew for R50." |
| Ticket purchase confirmed | Email + SMS | "Your ticket for {event} is confirmed. Reference: {ref}" |
| Withdrawal processed | SMS | "Your withdrawal of R{amount} has been processed." |
| OTP verification | SMS | "Your Haibo verification code is: {code}" |

---

## 7. Azure Application Insights — Monitoring

> Tracks API performance, errors, and user engagement.

| Setting | Value |
| :--- | :--- |
| **Name** | `haibo-insights-prod` |
| **Region** | South Africa North |
| **Linked To** | `haibo-api-prod` (App Service) |

**Key Metrics to Monitor:**
- API response times (target: < 200ms)
- Failed requests (target: < 1%)
- Active WebSocket connections (SignalR)
- Database query performance

---

## 🔐 Security Checklist

- [ ] Enable **Managed Identity** on App Service to access Key Vault without hardcoded credentials
- [ ] Enable **SSL/TLS** on all endpoints
- [ ] Configure **CORS** to only allow `com.haibo.africa.haiboapp` and the Command Center domain
- [ ] Enable **Azure DDoS Protection** (Basic tier is free)
- [ ] Set up **Backup** for PostgreSQL (daily, 7-day retention)
- [ ] Enable **Diagnostic Logging** on all resources

---

## 🚀 Deployment Order

1. **Resource Group** → `rg-haibo-app-prod`
2. **Key Vault** → `haibo-keyvault` (store secrets first)
3. **PostgreSQL** → `haibo-db-prod` (run Drizzle migrations)
4. **Blob Storage** → `haibomediaprod` (create containers)
5. **SignalR** → `haibo-signalr-prod`
6. **App Service** → `haibo-api-prod` (deploy API, link to Key Vault)
7. **Communication Services** → `haibo-comms-prod`
8. **Application Insights** → `haibo-insights-prod`

---

## 💰 Estimated Monthly Cost (South Africa North)

| Service | Tier | Est. Cost (ZAR) |
| :--- | :--- | :--- |
| PostgreSQL Flexible | B1ms | ~R450/mo |
| App Service | B1 | ~R250/mo |
| Blob Storage | Standard LRS | ~R50/mo |
| SignalR | Free | R0 |
| Key Vault | Standard | ~R15/mo |
| Communication Services | Pay-as-you-go | ~R100/mo |
| Application Insights | Free tier | R0 |
| **Total** | | **~R865/mo** |

> Costs scale with usage. Start with these tiers and upgrade as your user base grows.

---

## 📱 Client-Side Configuration

Update `client/lib/config.ts` with:
```typescript
export const API_BASE_URL = 'https://haibo-api-prod.azurewebsites.net';
export const STORAGE_BASE_URL = 'https://haibomediaprod.blob.core.windows.net';
export const SIGNALR_URL = 'https://haibo-signalr-prod.service.signalr.net';
```

---

*This deployment prompt is designed for the Haibo! Taxi Safety App by Haibo! Africa.*
