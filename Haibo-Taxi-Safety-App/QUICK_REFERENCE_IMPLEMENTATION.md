# Quick Reference - Critical Gaps Implementation

**Last Updated**: January 28, 2026  
**Status**: Ready for Integration

---

## 📱 Authentication Reference

### Mobile App - OTP Flow
```typescript
// Step 1: Request OTP
POST /api/auth/request-otp
{
  "phone": "+27123456789"
}

// Response
{
  "success": true,
  "message": "OTP sent successfully",
  "devCode": "123456" // Only in dev mode
}

// Step 2: Verify OTP
POST /api/auth/verify-otp
{
  "phone": "+27123456789",
  "code": "123456"
}

// Response
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "user-123",
    "phone": "+27123456789",
    "displayName": "John Doe",
    "role": "commuter",
    "isVerified": true
  }
}
```

### Web/Command Center - Email/Password Flow
```typescript
// Registration
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "displayName": "John Doe"
}

// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "owner"
  }
}
```

### Link Accounts (Phone + Email)
```typescript
POST /api/auth/link-email
Headers: {
  "Authorization": "Bearer {token}"
}
{
  "email": "newemail@example.com",
  "password": "NewPassword123!"
}
```

---

## 🔐 API Security Template

### Protecting Routes
```typescript
import { authenticate, authorize } from "./middleware/auth";

// Everyone (authenticated)
app.get("/api/profile", authenticate, (req, res) => {
  // req.user = { userId, phone, role }
});

// Only drivers
app.post("/api/driver/earnings", 
  authenticate, 
  authorize("driver"), 
  (req, res) => {
    // Only drivers can access
  }
);

// Only admins
app.delete("/api/admin/users/:id",
  authenticate,
  authorize("admin"),
  (req, res) => {
    // Only admins
  }
);

// Owner or Admin
app.get("/api/taxi/:id",
  authenticate,
  authorizeOwnerOrAdmin(req => req.params.id),
  (req, res) => {
    // Owner can only access their own
    // Admin can access all
  }
);
```

---

## 💳 Payment Integration

### Initiate Payment
```typescript
POST /api/payments/initiate
{
  "userId": "user-123",
  "amount": 500,
  "email": "user@example.com",
  "description": "Wallet top-up",
  "reference": "ref_123" // optional
}

// Response
{
  "success": true,
  "authorizationUrl": "https://checkout.paystack.com/...",
  "data": {
    "reference": "ref_123"
  }
}
```

### Verify Payment
```typescript
POST /api/payments/verify
{
  "reference": "ref_123"
}

// Response
{
  "success": true,
  "status": "success",
  "amount": 500
}
```

### Get Transactions
```typescript
GET /api/payments/transactions/user-123
Headers: {
  "Authorization": "Bearer {token}"
}

// Response
{
  "success": true,
  "transactions": [
    {
      "id": "txn-1",
      "amount": 500,
      "type": "wallet_topup",
      "status": "completed",
      "createdAt": "2026-01-28T10:00:00Z"
    }
  ]
}
```

### Paystack Webhook Configuration
```
Set in Paystack Dashboard:
  Webhook URL: https://your-domain.com/api/payments/paystack-webhook
  Events to listen:
    - charge.success
    - charge.failed
    - transfer.success
    - transfer.failed
    - subscription.create
    - subscription.disable
```

---

## 🔔 Notifications API

### Send to User
```typescript
POST /api/notifications/send
Headers: {
  "Authorization": "Bearer {token}"
}
{
  "userId": "user-123",
  "title": "Payment Received",
  "body": "You received R500 from John",
  "data": {
    "type": "payment",
    "amount": "500"
  }
}
```

### Send to Role (Admin Only)
```typescript
POST /api/notifications/send-by-role
Headers: {
  "Authorization": "Bearer {admin-token}"
}
{
  "role": "driver",
  "title": "New Earning Opportunity",
  "body": "Check out the new route",
  "data": { }
}
```

### Emergency Alert
```typescript
POST /api/notifications/emergency
Headers: {
  "Authorization": "Bearer {token}"
}
{
  "message": "Accident reported on Main Street",
  "latitude": -33.9249,
  "longitude": 18.4241
}
```

### Ride Update
```typescript
POST /api/notifications/ride
Headers: {
  "Authorization": "Bearer {token}"
}
{
  "userId": "passenger-123",
  "status": "pickup", // or "arriving", "dropoff"
  "driverName": "John Smith",
  "eta": 5 // minutes (optional)
}
```

### Payment Notification
```typescript
POST /api/notifications/payment
Headers: {
  "Authorization": "Bearer {token}"
}
{
  "userId": "user-123",
  "amount": 250.50,
  "type": "payment_received", // payment_sent, wallet_topup
  "reference": "txn-123"
}
```

---

## 📊 Database Tables - New

### taxi_drivers
```sql
CREATE TABLE taxi_drivers (
  id UUID PRIMARY KEY,
  taxi_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  role TEXT NOT NULL, -- owner, associate, substitute
  assigned_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### payment_methods
```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- card, bank_account, mobile_money
  provider TEXT NOT NULL, -- paystack, stripe, mtn
  token TEXT NOT NULL, -- tokenized (never raw)
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL, -- wallet_topup, ride_payment, etc
  status TEXT NOT NULL, -- pending, completed, failed
  reference TEXT UNIQUE,
  completed_at TIMESTAMP
);
```

### location_updates
```sql
CREATE TABLE location_updates (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  speed REAL,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### withdrawal_requests
```sql
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL, -- pending, approved, completed
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  requested_at TIMESTAMP DEFAULT NOW()
);
```

### group_ride_chats
```sql
CREATE TABLE group_ride_chats (
  id UUID PRIMARY KEY,
  group_ride_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing Commands

### Test Mobile OTP Auth
```bash
# Request OTP
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+27123456789"}'

# Verify OTP (get code from response)
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+27123456789", "code": "123456"}'
```

### Test Web Email Auth
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Password123!", "displayName": "Test User"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Password123!"}'
```

### Test Protected Route
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Payment Flow
```bash
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reference": "ref_123"}'
```

### Test Notifications
```bash
curl -X POST http://localhost:5000/api/notifications/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "title": "Test", "body": "Hello World"}'
```

---

## 🔧 Environment Variables

Create `.env` file:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/haibo

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-key-change-this

# Firebase (for push notifications)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json

# Paystack Payment Gateway
PAYSTACK_PUBLIC_KEY=pk_test_1234567890abcdef
PAYSTACK_SECRET_KEY=sk_test_1234567890abcdef

# Environment
NODE_ENV=development
PORT=5000

# Twilio (for OTP)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Replit (optional)
REPLIT_DEV_DOMAIN=your-app.replit.dev
```

---

## 📝 Roles Reference

```typescript
type UserRole = 'commuter' | 'driver' | 'owner' | 'association' | 'admin';

// Commuter: Regular app user
// Driver: Drives taxis for owners
// Owner: Owns taxis, manages drivers
// Association: Manages taxi associations
// Admin: Platform admin
```

---

## ✅ Pre-Production Checklist

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Firebase service account configured
- [ ] Paystack webhooks configured
- [ ] JWT secret changed (production)
- [ ] HTTPS enforced
- [ ] CORS configured for production domains
- [ ] Rate limiting tested
- [ ] Authentication flow tested
- [ ] Payment flow tested
- [ ] Notifications tested
- [ ] Error logging configured

---

**For detailed implementation**, see:
- [CRITICAL_GAPS_INTEGRATION_PLAN.md](./CRITICAL_GAPS_INTEGRATION_PLAN.md)
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)
