# Haibo Pay, Hub, and Group Rides Implementation Guide

## 📋 Overview

This document outlines the complete implementation of three major integrated systems for the Haibo Taxi Safety App:

1. **Haibo Pay** - Digital wallet and P2P transfer system powered by Paystack
2. **Haibo Hub** - Package delivery system leveraging the taxi network
3. **Group Rides** - Community transportation scheduling with safety verification

---

## 🏦 Haibo Pay System

### Features Implemented

#### 1. **Wallet Top-Up**
- Users can add money to their wallet via Paystack
- Minimum: R10, Maximum: R50,000
- Real-time balance updates
- Transaction history tracking

**API Endpoints:**
- `POST /api/wallet/topup/initialize` - Start payment flow
- `POST /api/wallet/topup/verify` - Confirm payment and add funds

#### 2. **P2P Transfers**
- Send money directly to another user
- Transfer via phone number or user ID
- Optional message support
- Instant wallet updates

**API Endpoints:**
- `POST /api/wallet/transfer/send` - Initiate transfer
- `GET /api/wallet/transfers/:userId` - Get transfer history

#### 3. **Sponsorships**
- Sponsor others for:
  - Job interviews
  - Education expenses
  - Emergency assistance
  - General support

**API Endpoints:**
- `POST /api/wallet/sponsorship/create` - Create sponsorship request
- `POST /api/wallet/sponsorship/accept/:id` - Accept and process sponsorship
- `GET /api/wallet/sponsorships/:userId` - View sponsorship history

#### 4. **Emergency Transfers**
- Quick transfer to emergency contacts
- Flagged for priority handling
- Tracked separately in transaction history

**API Endpoints:**
- `POST /api/wallet/emergency-transfer` - Send emergency funds

#### 5. **Wallet Management**
- View balance anytime
- Complete transaction history with filters
- Transaction types: topup, transfer, payment, sponsorship, etc.

**API Endpoints:**
- `GET /api/wallet/balance/:userId` - Get current balance
- `GET /api/wallet/transactions/:userId` - View transaction history

### Database Schema

**walletTransactions Table:**
```typescript
{
  id: UUID (primary key)
  userId: UUID (foreign key)
  type: 'topup' | 'transfer_sent' | 'transfer_received' | 'payment' | 'refund' | 'sponsorship_sent' | 'sponsorship_received'
  amount: Real (in Rands)
  description: Text
  status: 'pending' | 'completed' | 'failed'
  paymentReference: Text (Paystack reference)
  relatedUserId: UUID (for transfers)
  metadata: JSONB
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**p2pTransfers Table:**
```typescript
{
  id: UUID
  senderId: UUID
  recipientId: UUID | null
  recipientPhone: Text
  recipientUsername: Text
  amount: Real
  message: Text (optional)
  status: 'pending' | 'completed' | 'rejected'
  createdAt: Timestamp
}
```

**sponsorships Table:**
```typescript
{
  id: UUID
  sponsorId: UUID
  recipientId: UUID | null
  recipientPhone: Text
  type: 'job_interview' | 'education' | 'emergency' | 'general'
  amount: Real
  reason: Text
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Timestamp
}
```

### Client Integration

**WalletScreen.tsx** - Main wallet interface
- Balance display with gradient card
- Quick action buttons (Add Money, Transfer)
- Tab navigation (Balance, Transfer, History)
- Transaction list with categorized icons
- Real-time balance updates

**Features:**
- Responsive design matching app branding (#E72369 → #EA4F52)
- Uses Nunito font family
- Proper error handling and validation
- Loading states for async operations

---

## 📦 Haibo Hub - Package Delivery System

### Features Implemented

#### 1. **Create Delivery**
- Package description
- Pickup and dropoff locations
- Estimated amount
- Optional insurance (R15)
- Confirmation code generation

**API Endpoints:**
- `POST /api/hub/create` - Create new delivery
- `GET /api/hub/deliveries/:userId` - View sent packages

#### 2. **Accept Delivery (Driver)**
- Drivers can accept pending deliveries
- Plate number linking
- Driver contact info recorded
- Real-time status updates

**API Endpoints:**
- `POST /api/hub/accept/:deliveryId` - Accept delivery
- `POST /api/hub/start/:deliveryId` - Begin delivery
- `POST /api/hub/complete/:deliveryId` - Mark delivered with photo

#### 3. **Live Tracking**
- Real-time GPS location updates
- Detailed tracking history
- Rank-based location names
- Current location display

**API Endpoints:**
- `POST /api/hub/track/update` - Send tracking update
- `GET /api/hub/track/:deliveryId` - Get full tracking history

#### 4. **Payment Processing**
- Paystack integration for delivery fees
- Insurance add-on (R15)
- Payment verification and recording
- Wallet transaction creation

**API Endpoints:**
- `POST /api/hub/payment/initialize` - Start payment
- `POST /api/hub/payment/verify` - Confirm payment

#### 5. **Driver Profiles**
- Driver registration with plate number
- License and insurance tracking
- Safety rating system
- Vehicle details (color, model, year)
- Verification status

**API Endpoints:**
- `POST /api/hub/driver/register` - Register as driver
- `GET /api/hub/driver/:plateNumber` - Get driver profile

### Database Schema

**deliveries Table:**
```typescript
{
  id: UUID
  senderId: UUID
  driverId: UUID | null
  driverPhone: Text | null
  taxiPlateNumber: Text (required)
  description: Text
  pickupRank: Text
  dropoffRank: Text
  amount: Real
  status: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'completed' | 'failed'
  paymentReference: Text | null
  confirmationCode: Text
  photoVerification: Text (URL) | null
  insuranceIncluded: Boolean
  insuranceAmount: Real (default 0)
  trackingUrl: Text | null
  currentLocation: JSONB (latitude, longitude)
  createdAt: Timestamp
  acceptedAt: Timestamp | null
  deliveredAt: Timestamp | null
}
```

**driverProfiles Table:**
```typescript
{
  id: UUID
  userId: UUID (unique)
  taxiPlateNumber: Text (unique)
  licenseNumber: Text
  licenseExpiry: Timestamp | null
  insuranceNumber: Text | null
  insuranceExpiry: Timestamp | null
  safetyRating: Real (default 5)
  totalRatings: Integer
  totalRides: Integer
  acceptanceRate: Real
  isVerified: Boolean
  vehicleColor: Text
  vehicleModel: Text
  vehicleYear: Integer
  createdAt: Timestamp
}
```

### Client Integration

**HubScreen.tsx** - Main Hub interface
- Send package form with location inputs
- Delivery history with status tracking
- Confirmation code display
- Driver contact information
- Track button for real-time updates

---

## 🚗 Group Rides - Community Transportation

### Features Implemented

#### 1. **Create Group Ride**
- Title and description
- Ride type: scheduled, odd hours, school, staff transport
- Pickup/dropoff locations
- Date and time scheduling
- Max passenger count
- Cost per person (split payment)

**API Endpoints:**
- `POST /api/rides/create` - Create new ride
- `POST /api/rides/assign-driver/:rideId` - Assign verified driver
- `POST /api/rides/start/:rideId` - Start journey
- `POST /api/rides/complete/:rideId` - Mark completed

#### 2. **Browse & Join**
- Search available rides by location
- View ride details and driver info
- See available seats
- Join confirmed rides
- View driver safety rating

**API Endpoints:**
- `GET /api/rides/available` - List open rides with filtering
- `GET /api/rides/:rideId` - Get ride details with participants
- `POST /api/rides/join/:rideId` - Join ride (pending payment)
- `POST /api/rides/cancel-participation/:participantId` - Cancel participation

#### 3. **Payment Processing**
- Split payment collection
- Paystack integration per participant
- Driver payment distribution
- Automatic wallet transfers

**API Endpoints:**
- `POST /api/rides/payment/initialize` - Start payment
- `POST /api/rides/payment/verify` - Process payment

#### 4. **In-Ride Chat**
- Real-time messaging between participants
- User identification with names
- Chat history retrieval
- Group communication

**API Endpoints:**
- `POST /api/rides/chat/send` - Send message
- `GET /api/rides/chat/:rideId` - Get chat history

#### 5. **Live Tracking**
- Driver location sharing
- Participant visibility
- Route tracking
- Real-time updates

**API Endpoints:**
- `POST /api/rides/track/update` - Update location
- `GET /api/rides/track/:rideId` - Get location history

#### 6. **Safety & Ratings**
- Driver verification system
- Safety ratings (1-5 stars)
- Review system post-ride
- Verified badge display
- Historical ratings

**API Endpoints:**
- `POST /api/rides/driver/rate` - Submit driver rating

### Database Schema

**groupRides Table:**
```typescript
{
  id: UUID
  organizerId: UUID
  title: Text
  description: Text | null
  pickupLocation: Text
  dropoffLocation: Text
  scheduledDate: Timestamp
  maxPassengers: Integer
  costPerPerson: Real | null
  rideType: 'scheduled' | 'odd_hours' | 'school_transport' | 'staff_transport'
  driverId: UUID | null
  driverPlateNumber: Text | null
  driverSafetyRating: Real | null
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  paymentMethod: 'split' | 'sponsor' | 'individual'
  sponsorId: UUID | null
  isVerifiedDriver: Boolean
  createdAt: Timestamp
  startedAt: Timestamp | null
  completedAt: Timestamp | null
}
```

**groupRideParticipants Table:**
```typescript
{
  id: UUID
  rideId: UUID
  userId: UUID
  status: 'pending' | 'confirmed' | 'joined' | 'completed' | 'cancelled'
  amountPaid: Real | null
  paymentStatus: 'pending' | 'completed' | 'failed'
  paymentReference: Text | null
  createdAt: Timestamp
}
```

**driverRatings Table:**
```typescript
{
  id: UUID
  driverId: UUID
  userId: UUID
  rideId: UUID | null
  rating: Integer (1-5)
  review: Text | null
  createdAt: Timestamp
}
```

### Client Integration

**GroupRidesScreen.tsx** - Main Group Rides interface
- Browse available rides with search
- Create new ride with full scheduling
- Ride type selection (scheduled, odd hours, etc.)
- Join ride with payment flow
- My rides tab showing user's rides
- Create tab for ride scheduling

---

## 🔧 Server Setup & Integration

### Environment Variables Required

```env
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
DATABASE_URL=your_postgresql_url
```

### API Route Registration

All routes are registered in `server/routes.ts`:

```typescript
app.use("/api/wallet", walletRoutes);
app.use("/api/hub", hubRoutes);
app.use("/api/rides", groupRidesRoutes);
```

### Database Migration

Run migrations to create all new tables:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## 🎨 Design System Compliance

### Colors
- **Primary:** #E72369 (Pink/Red)
- **Accent:** #EA4F52 (Coral Red)
- **Success:** #10B981
- **Warning:** #FFA500
- **Error:** #EF4444
- **Info:** #3B82F6

### Typography
- **Font Family:** Nunito
- **Headings:** Bold, 24px+
- **Body:** Regular, 14px
- **Labels:** Semibold, 12-14px

### Spacing
- **XS:** 4px
- **SM:** 8px
- **MD:** 12px
- **LG:** 16px
- **XL:** 24px

### Border Radius
- **SM:** 4px
- **MD:** 8px
- **LG:** 12px
- **XL:** 16px

---

## 🔒 Security Features

### Transaction Security
- All payments processed through Paystack
- Encrypted payment references
- Status verification before wallet updates
- Transaction logging with metadata

### User Verification
- Phone-based authentication (OTP)
- Driver verification system (license, insurance)
- Safety rating system
- Verified driver badges

### Data Privacy
- User phone numbers used only for transfers
- Optional emergency contact transfers
- Metadata storage for audit trails
- Secure payment reference handling

---

## 📱 Client Features

### WalletScreen
- ✅ Balance display with gradient card
- ✅ Add money with Paystack
- ✅ P2P transfers
- ✅ Sponsorship requests
- ✅ Transaction history
- ✅ Emergency transfers

### HubScreen
- ✅ Create package delivery
- ✅ View delivery history
- ✅ Confirmation codes
- ✅ Driver contact info
- ✅ Track packages
- ✅ Payment processing

### GroupRidesScreen
- ✅ Browse available rides
- ✅ Create scheduled rides
- ✅ Join rides with payment
- ✅ View ride details
- ✅ In-ride chat
- ✅ Driver ratings

---

## 🚀 Implementation Checklist

### Backend
- ✅ Database schema creation
- ✅ API route implementation (Wallet)
- ✅ API route implementation (Hub)
- ✅ API route implementation (Group Rides)
- ✅ Paystack service enhancement
- ✅ Error handling & validation
- ✅ Route registration in main app

### Frontend
- ✅ WalletScreen component
- ✅ HubScreen enhanced implementation
- ✅ GroupRidesScreen component
- ✅ UI consistency with design system
- ✅ Navigation integration
- ✅ Error handling & user feedback

### Testing
- ⚠️ Unit tests (recommended)
- ⚠️ Integration tests (recommended)
- ⚠️ Payment flow testing (recommended)

---

## 📝 Next Steps

1. **Test Payment Flow**
   - Set up Paystack test keys
   - Test topup flow end-to-end
   - Verify webhook integration

2. **Driver Onboarding**
   - Create driver verification flow
   - Implement license upload
   - Set up verification approval process

3. **Push Notifications**
   - Notify when delivery accepted
   - Notify when ride accepted
   - Notify on ride start
   - Notify on delivery completion

4. **Analytics**
   - Track transaction volumes
   - Monitor payment success rates
   - Track user engagement
   - Driver performance metrics

5. **Support Features**
   - Customer support chat
   - Transaction dispute resolution
   - Refund processing
   - Support escalation

---

## 📞 Support

For implementation questions or issues:
1. Check existing test endpoints
2. Review Paystack documentation
3. Check database schema constraints
4. Review error logs for details

---

**Last Updated:** January 2025
**Implementation Status:** Complete
**Testing Status:** Ready for integration testing
