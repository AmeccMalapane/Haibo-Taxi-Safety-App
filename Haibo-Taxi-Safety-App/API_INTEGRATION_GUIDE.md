# API Integration Guide for Haibo Command Center

## Authentication API

### Login Endpoint
```typescript
// POST /auth/login
interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'association' | 'driver';
    companyName?: string;
    avatar?: string;
  };
}

// Implementation
async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data;
}
```

### Register Endpoint
```typescript
// POST /auth/register
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'owner' | 'association';
  companyName?: string;
  registrationNumber?: string;
}

interface RegisterResponse extends LoginResponse {}

async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

## Taxi Management API

### Register Taxi
```typescript
// POST /taxis
interface TaxiRegistrationRequest {
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  insuranceProvider: string;
  policyNumber: string;
  expiryDate: string; // ISO date format
  documents: File[];
}

interface TaxiRegistrationResponse {
  id: string;
  plateNumber: string;
  status: 'pending' | 'verified' | 'rejected';
  registrationId: string;
  verificationStatus: {
    documentsVerified: boolean;
    insuranceVerified: boolean;
    registrationVerified: boolean;
  };
}

async function registerTaxi(data: TaxiRegistrationRequest): Promise<TaxiRegistrationResponse> {
  const formData = new FormData();
  
  // Add form fields
  Object.entries({
    plateNumber: data.plateNumber,
    vin: data.vin,
    make: data.make,
    model: data.model,
    year: data.year.toString(),
    color: data.color,
    registrationNumber: data.registrationNumber,
    insuranceProvider: data.insuranceProvider,
    policyNumber: data.policyNumber,
    expiryDate: data.expiryDate,
  }).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Add files
  data.documents.forEach((file) => {
    formData.append('documents', file);
  });

  const token = localStorage.getItem('token');
  const response = await fetch('/api/taxis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to register taxi');
  }

  return response.json();
}
```

### Get Taxis List
```typescript
// GET /taxis?page=1&limit=10&status=active
interface TaxisListRequest {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive' | 'pending' | 'suspended';
  search?: string;
  sortBy?: 'plateNumber' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface TaxisListResponse {
  data: Taxi[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

async function getTaxis(params: TaxisListRequest): Promise<TaxisListResponse> {
  const queryString = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryString.append(key, String(value));
    }
  });

  const token = localStorage.getItem('token');
  const response = await fetch(`/api/taxis?${queryString.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch taxis');
  }

  return response.json();
}
```

### Get Taxi Details
```typescript
// GET /taxis/:id
interface TaxiDetailsResponse {
  id: string;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  ownerID: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  insurance: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    verified: boolean;
  };
  documents: Document[];
  compliance: ComplianceStatus;
  earnings: {
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

async function getTaxiDetails(id: string): Promise<TaxiDetailsResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/taxis/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch taxi details');
  }

  return response.json();
}
```

## Driver Management API

### Register Driver
```typescript
// POST /drivers
interface DriverRegistrationRequest {
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string; // ISO date
  licenseType: string;
  taxiId: string;
  emergencyContact: string;
  emergencyPhone: string;
}

interface DriverRegistrationResponse {
  id: string;
  name: string;
  email: string;
  licenseNumber: string;
  status: 'active' | 'pending' | 'suspended';
}

async function registerDriver(data: DriverRegistrationRequest): Promise<DriverRegistrationResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/drivers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

### Get Driver Performance
```typescript
// GET /drivers/:id/performance
interface DriverPerformanceResponse {
  id: string;
  name: string;
  rating: number;
  completedRides: number;
  cancellations: number;
  acceptanceRate: number;
  safetyRating: number;
  incidentCount: number;
  commendationCount: number;
  lastReview: Date;
  performance: {
    week: {
      rides: number;
      rating: number;
      earnings: number;
    };
    month: {
      rides: number;
      rating: number;
      earnings: number;
    };
  };
}

async function getDriverPerformance(id: string): Promise<DriverPerformanceResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/drivers/${id}/performance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch driver performance');
  }

  return response.json();
}
```

## Analytics API

### Get Earnings Analytics
```typescript
// GET /analytics/earnings?period=month&taxiId=?
interface EarningsRequest {
  period: 'day' | 'week' | 'month' | 'year';
  taxiId?: string;
  startDate?: string;
  endDate?: string;
}

interface EarningsData {
  labels: string[];
  data: number[];
  total: number;
  average: number;
  max: number;
  min: number;
  trend: number; // percentage change
}

async function getEarningsAnalytics(params: EarningsRequest): Promise<EarningsData> {
  const queryString = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryString.append(key, String(value));
  });

  const token = localStorage.getItem('token');
  const response = await fetch(`/api/analytics/earnings?${queryString.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch earnings analytics');
  }

  return response.json();
}
```

### Get Compliance Metrics
```typescript
// GET /analytics/compliance-metrics
interface ComplianceMetricsResponse {
  overallRate: number;
  documentStatus: {
    verified: number;
    pending: number;
    expired: number;
    rejected: number;
  };
  issuesSummary: {
    critical: number;
    warning: number;
    info: number;
  };
  upcomingExpirations: {
    daysUntilExpiry: number;
    documentType: string;
    itemCount: number;
  }[];
  complianceHistory: {
    date: Date;
    rate: number;
  }[];
}

async function getComplianceMetrics(): Promise<ComplianceMetricsResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/analytics/compliance-metrics', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch compliance metrics');
  }

  return response.json();
}
```

## Document Upload API

### Upload Document
```typescript
// POST /taxis/:id/documents
interface DocumentUploadRequest {
  file: File;
  documentType: 'registration' | 'insurance' | 'license' | 'inspection' | 'tax_clearance';
  expiryDate?: string;
  notes?: string;
}

interface DocumentUploadResponse {
  id: string;
  url: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  uploadedAt: Date;
  verificationMessage?: string;
}

async function uploadDocument(
  taxiId: string,
  data: DocumentUploadRequest
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('documentType', data.documentType);
  if (data.expiryDate) formData.append('expiryDate', data.expiryDate);
  if (data.notes) formData.append('notes', data.notes);

  const token = localStorage.getItem('token');
  const response = await fetch(`/api/taxis/${taxiId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload document');
  }

  return response.json();
}
```

## Admin API

### Get System Metrics
```typescript
// GET /admin/system-metrics
interface SystemMetricsResponse {
  totalFleets: number;
  activeVehicles: number;
  totalOwners: number;
  totalDrivers: number;
  systemUptime: number;
  avgComplianceRate: number;
  totalEarnings: number;
  pendingVerifications: number;
  activeAlerts: number;
  recentActivity: {
    timestamp: Date;
    action: string;
    actor: string;
    target: string;
  }[];
}

async function getSystemMetrics(): Promise<SystemMetricsResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/admin/system-metrics', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch system metrics');
  }

  return response.json();
}
```

### Suspend Fleet
```typescript
// POST /admin/suspend-fleet
interface SuspendFleetRequest {
  fleetId: string;
  reason: string;
  duration?: number; // in hours, 0 for indefinite
  notifyOwner?: boolean;
}

interface SuspendFleetResponse {
  success: boolean;
  message: string;
  suspensionId: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

async function suspendFleet(data: SuspendFleetRequest): Promise<SuspendFleetResponse> {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/admin/suspend-fleet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to suspend fleet');
  }

  return response.json();
}
```

## Error Handling Pattern

```typescript
// Generic error handler
async function handleApiRequest<T>(
  requestFn: () => Promise<Response>,
  errorMessage: string
): Promise<T> {
  try {
    const response = await requestFn();

    if (response.status === 401) {
      // Handle token expiration
      refreshToken();
      // Retry request
      const retryResponse = await requestFn();
      if (!retryResponse.ok) {
        throw new Error(errorMessage);
      }
      return retryResponse.json();
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error(errorMessage, error);
    throw error;
  }
}

// Usage
const result = await handleApiRequest(
  () => fetch('/api/taxis'),
  'Failed to fetch taxis'
);
```

## Caching Strategy

```typescript
class ApiCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheDuration: number = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheDuration;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

const apiCache = new ApiCache();

// Use in API calls
async function getTaxis(): Promise<Taxi[]> {
  const cacheKey = 'taxis';
  const cached = apiCache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchTaxis();
  apiCache.set(cacheKey, data);
  return data;
}
```

## Rate Limiting

```typescript
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number = 10;
  private windowMs: number = 60 * 1000; // 1 minute

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const validAttempts = attempts.filter((t) => now - t < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }
}

const limiter = new RateLimiter();

// Use in API calls
async function getTaxis(): Promise<Taxi[]> {
  if (!limiter.isAllowed('get-taxis')) {
    throw new Error('Too many requests. Please try again later.');
  }

  return fetchTaxis();
}
```
