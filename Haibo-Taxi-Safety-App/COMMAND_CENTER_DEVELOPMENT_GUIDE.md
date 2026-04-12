# Haibo Command Center - Comprehensive Development Guide

## Overview
The Haibo Command Center is a multi-dashboard enterprise application for managing taxi fleets, drivers, owners, and compliance across South Africa's transportation network.

## Project Structure

```
command-center/
├── src/
│   ├── pages/
│   │   ├── dashboards/
│   │   │   ├── OwnerDashboard.tsx      # Taxi owner fleet management
│   │   │   ├── AdminDashboard.tsx      # System admin controls
│   │   │   └── AssociationDashboard.tsx # Association member portal
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   └── shared/
│   │       ├── NotFound.tsx
│   │       └── Unauthorized.tsx
│   ├── components/
│   │   ├── TaxiRegistrationForm.tsx    # Vehicle registration
│   │   ├── DocumentUpload.tsx          # Document management
│   │   ├── DataTable.tsx               # Reusable data tables
│   │   ├── Charts/
│   │   │   ├── BarChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   └── PieChart.tsx
│   │   └── Forms/
│   │       ├── DriverManagementForm.tsx
│   │       └── ComplianceForm.tsx
│   ├── utils/
│   │   ├── api.ts                      # API client functions
│   │   ├── auth.ts                     # Authentication utilities
│   │   └── validation.ts               # Form validation
│   ├── stores/
│   │   ├── authStore.ts                # Auth state management
│   │   ├── dashboardStore.ts           # Dashboard state
│   │   └── fleetStore.ts               # Fleet data state
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDashboard.ts
│   │   └── useApi.ts
│   ├── styles/
│   │   ├── globals.css                 # Global styles
│   │   ├── variables.css               # CSS variables
│   │   └── components.css              # Component styles
│   ├── types/
│   │   ├── api.ts                      # API types
│   │   ├── domain.ts                   # Domain models
│   │   └── ui.ts                       # UI types
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── images/
│   └── icons/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Core Features

### 1. Owner Dashboard (`OwnerDashboard.tsx`)

**Purpose**: Manage taxi fleet operations

**Tabs**:
- **Overview**: Key metrics (earnings, active taxis, drivers, pending documents, compliance, safety rating)
- **Register Taxi**: Add new vehicles to fleet
- **Documents**: Upload and verify documents
- **Earnings**: Analytics and financial reports
- **Drivers**: Manage drivers and performance
- **Compliance**: Track regulatory requirements

**Key Components**:
- `StatsCard`: Display metrics with icons and trends
- `TaxiRegistrationForm`: Vehicle registration with document upload
- `EarningsChart`: Revenue analytics
- `ComplianceTracker`: Document expiry and status tracking

### 2. Admin Dashboard (`AdminDashboard.tsx`)

**Purpose**: System-wide fleet and owner management

**Tabs**:
- **Overview**: System metrics (total fleets, vehicles, owners, drivers, compliance rate, earnings)
- **Fleet Monitoring**: Real-time fleet status and performance
- **Owner Management**: Owner profiles and metrics
- **Compliance**: Regulatory compliance tools
- **Emergency**: Critical system controls

**Features**:
- Real-time monitoring of all fleets
- Owner compliance tracking
- System alerts and notifications
- Emergency suspension controls
- Data export functionality

### 3. Association Dashboard (`AssociationDashboard.tsx`)

**Purpose**: Association-level member management

**Features**:
- Member fleet aggregation
- Collective analytics
- Financial reporting
- Member directory
- Group compliance tracking

## API Integration

### Backend Endpoints

```typescript
// Authentication
POST /auth/login
POST /auth/register
POST /auth/refresh-token
POST /auth/logout

// Taxi Operations
GET /taxis                              // List all taxis
POST /taxis                             // Register new taxi
GET /taxis/:id                          // Get taxi details
PUT /taxis/:id                          // Update taxi
DELETE /taxis/:id                       // Delete taxi
POST /taxis/:id/documents               // Upload documents
GET /taxis/:id/documents                // List documents
POST /taxis/:id/verify-documents        // Verify documents

// Drivers
GET /drivers                            // List drivers
POST /drivers                           // Register driver
GET /drivers/:id                        // Get driver details
PUT /drivers/:id                        // Update driver
DELETE /drivers/:id                     // Delete driver
GET /drivers/:id/performance            // Driver performance metrics

// Owner Operations
GET /owners                             // List all owners
POST /owners                            // Create owner profile
GET /owners/:id                         // Get owner details
PUT /owners/:id                         // Update owner
GET /owners/:id/fleets                  // Get owner's fleets
GET /owners/:id/earnings                // Get earnings data
GET /owners/:id/compliance              // Get compliance status

// Analytics
GET /analytics/earnings                 // Earnings data
GET /analytics/fleet-performance        // Fleet performance
GET /analytics/compliance-metrics       // Compliance metrics
GET /analytics/driver-ratings           // Driver ratings

// Admin Operations
GET /admin/system-metrics               // System-wide metrics
GET /admin/fleets                       // All fleets
GET /admin/owners                       // All owners
POST /admin/suspend-fleet               // Suspend operations
POST /admin/revoke-license              // Revoke license
POST /admin/send-alert                  // Send system alert
```

## Type Definitions

```typescript
// Domain Models
interface Taxi {
  id: string;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  ownerID: string;
  registrationNumber: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  compliance: ComplianceStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: Date;
  taxiId: string;
  rating: number;
  status: 'active' | 'inactive' | 'suspended';
  safetyRecord: SafetyRecord;
  createdAt: Date;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  registrationNumber: string;
  status: 'active' | 'pending' | 'suspended';
  taxis: Taxi[];
  complianceRate: number;
  createdAt: Date;
}

interface Document {
  id: string;
  type: 'registration' | 'insurance' | 'license' | 'inspection';
  entityId: string;
  entityType: 'taxi' | 'driver' | 'owner';
  url: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  expiryDate?: Date;
  uploadedAt: Date;
  verifiedAt?: Date;
}

interface ComplianceStatus {
  rate: number;
  documents: DocumentStatus[];
  violations: Violation[];
  lastAudited: Date;
}

interface SafetyRecord {
  rating: number;
  incidents: Incident[];
  commendations: number;
  lastReview: Date;
}
```

## Form Validation

### Taxi Registration
- **Plate Number**: Must match format "XX ### XX" (e.g., "CA 123 GP")
- **VIN**: Exactly 17 characters
- **Make/Model**: Non-empty strings
- **Year**: Between 1980 and current year + 1
- **Registration Number**: Unique, non-empty
- **Insurance**: Valid provider and policy number with future expiry date
- **Documents**: At least one PDF/image file, max 5MB each

### Driver Registration
- **Name**: Full name, 2-50 characters
- **Email**: Valid email format
- **Phone**: Valid South African phone number (+27...)
- **License Number**: Valid format
- **License Expiry**: Must be in the future

### Owner Registration
- **Company Name**: Non-empty, 2-100 characters
- **Registration Number**: Must be valid South African business registration
- **Email**: Valid and unique
- **Phone**: Valid South African number

## State Management (Zustand)

```typescript
// Auth Store
interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// Dashboard Store
interface DashboardStore {
  metrics: DashboardMetrics;
  loading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
  setMetrics: (metrics: DashboardMetrics) => void;
}

// Fleet Store
interface FleetStore {
  taxis: Taxi[];
  drivers: Driver[];
  loading: boolean;
  error: string | null;
  fetchTaxis: () => Promise<void>;
  fetchDrivers: () => Promise<void>;
  registerTaxi: (data: TaxiData) => Promise<void>;
  registerDriver: (data: DriverData) => Promise<void>;
}
```

## Styling System

### Color Scheme
- **Primary**: #E72369 (Haibo Pink/Red)
- **Secondary**: #EA4F52 (Haibo Coral)
- **Success**: #28A745
- **Warning**: #FFA000
- **Error**: #D32F2F
- **Info**: #0288D1

### Typography
- **Headings**: Bold weights (700)
- **Body**: Regular weights (400-500)
- **Accent**: Semibold weights (600)

### Spacing
- Use Tailwind's default spacing: 4px base unit
- Padding/Margins: Multiples of 4 (4, 8, 12, 16, 20, 24, 28, 32...)

## Development Workflow

### 1. Component Creation
```bash
# Create component structure
touch src/components/MyComponent.tsx
# Add TypeScript interface
# Add Tailwind classes
# Add prop validation
# Add Storybook story (optional)
```

### 2. API Integration
```bash
# Add API function in utils/api.ts
# Define TypeScript types in types/api.ts
# Create custom hook (if needed) in hooks/useMyHook.ts
# Integrate in component
```

### 3. Testing
```bash
# Create test file
touch src/components/MyComponent.test.tsx
# Run tests
npm run test
```

### 4. Deployment
```bash
# Build production bundle
npm run build
# Analyze bundle size
npm run analyze
# Deploy to server
npm run deploy
```

## Performance Optimization

- **Code Splitting**: Lazy load heavy components
- **Memoization**: Use React.memo for expensive components
- **Image Optimization**: Use Next.js Image component
- **Caching**: Implement API response caching
- **Bundle Analysis**: Regular bundle size audits

## Security Considerations

- **Authentication**: JWT-based auth with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Validation**: Server-side and client-side validation
- **HTTPS**: All API communication encrypted
- **XSS Prevention**: React automatically escapes JSX
- **CSRF Protection**: Include CSRF tokens in state-changing requests

## Best Practices

1. **Component Organization**
   - Keep components small and focused
   - One component per file (unless closely related)
   - Use index.ts for barrel exports

2. **State Management**
   - Use Zustand for global state
   - Use useState for local component state
   - Avoid prop drilling - use context when needed

3. **API Calls**
   - Use custom hooks for data fetching
   - Implement proper error handling
   - Show loading states
   - Cache responses appropriately

4. **Form Handling**
   - Validate on both client and server
   - Show helpful error messages
   - Provide feedback on success
   - Handle edge cases

5. **Accessibility**
   - Use semantic HTML
   - Include ARIA labels where needed
   - Ensure keyboard navigation works
   - Test with screen readers

## Testing Strategy

```typescript
// Component Testing
describe('TaxiRegistrationForm', () => {
  it('should validate plate number format', async () => {
    // Test implementation
  });

  it('should upload documents successfully', async () => {
    // Test implementation
  });

  it('should show error messages on validation failure', async () => {
    // Test implementation
  });
});

// Integration Testing
describe('Owner Dashboard', () => {
  it('should load metrics on mount', async () => {
    // Test implementation
  });

  it('should switch between tabs', async () => {
    // Test implementation
  });
});

// E2E Testing
describe('Taxi Registration Flow', () => {
  it('should complete full registration workflow', async () => {
    // Test implementation
  });
});
```

## Future Enhancements

- [ ] Real-time notifications via WebSockets
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Machine learning for fraud detection
- [ ] Integration with payment systems
- [ ] Multi-language support
- [ ] Offline capabilities
- [ ] Advanced reporting and BI tools
- [ ] Driver training portal
- [ ] Customer feedback system
- [ ] Integration with traffic authorities
- [ ] Automated compliance checking

## Resources

- [Haibo Design System](./design_guidelines.md)
- [API Documentation](./docs/API.md)
- [Component Library](./storybook/README.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
