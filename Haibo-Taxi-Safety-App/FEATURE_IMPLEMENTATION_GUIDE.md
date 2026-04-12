# Haibo Command Center - Feature Implementation Guide

## Feature: Taxi Registration with AI Document Verification

### Overview
Owners can register new taxis with comprehensive vehicle and insurance information, upload required documents, and have them automatically verified using AI.

### Components Involved
- `TaxiRegistrationForm.tsx` - Main form component
- `DocumentUpload.tsx` - Document upload with preview
- `FileUpload.tsx` - Drag-and-drop file upload
- `ValidationUtil.ts` - Form validation

### Implementation Steps

#### Step 1: Create Form Component
```typescript
// src/components/TaxiRegistrationForm.tsx
import React, { useState } from 'react';
import { Upload, Check, AlertCircle } from 'lucide-react';

export const TaxiRegistrationForm: React.FC = () => {
  const [formData, setFormData] = useState({
    plateNumber: '',
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    registrationNumber: '',
    insuranceProvider: '',
    policyNumber: '',
    expiryDate: '',
    documents: [],
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate plate number format: "XX ### XX"
    if (!formData.plateNumber.match(/^[A-Z]{2} \d{1,3} [A-Z]{2}$/)) {
      newErrors.plateNumber = 'Invalid plate format (e.g., CA 123 GP)';
    }

    // Validate VIN (17 characters)
    if (formData.vin.length !== 17) {
      newErrors.vin = 'VIN must be 17 characters';
    }

    // Validate year
    if (formData.year < 1980 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Invalid year';
    }

    // Validate expiry date
    if (new Date(formData.expiryDate) <= new Date()) {
      newErrors.expiryDate = 'Policy must not be expired';
    }

    // Validate documents
    if (formData.documents.length === 0) {
      newErrors.documents = 'At least one document required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Create FormData for multipart upload
      const formDataRequest = new FormData();
      
      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== 'documents') {
          formDataRequest.append(key, String(value));
        }
      });

      // Add files
      formData.documents.forEach((file) => {
        formDataRequest.append('documents', file);
      });

      // Submit to API
      const response = await fetch('/api/taxis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formDataRequest,
      });

      if (!response.ok) {
        throw new Error('Failed to register taxi');
      }

      setSuccess(true);
      // Reset form
      setFormData({
        plateNumber: '',
        vin: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        registrationNumber: '',
        insuranceProvider: '',
        policyNumber: '',
        expiryDate: '',
        documents: [],
      });
    } catch (error) {
      setErrors({ submit: 'Failed to submit form' });
    } finally {
      setLoading(false);
    }
  };

  // Form JSX...
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

#### Step 2: Add Document Verification
```typescript
// src/utils/documentVerification.ts
export interface VerificationResult {
  documentType: string;
  status: 'verified' | 'rejected' | 'pending';
  confidence: number;
  extractedData: Record<string, any>;
  issues?: string[];
}

export async function verifyDocument(
  file: File,
  documentType: string
): Promise<VerificationResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await fetch('/api/verify-document', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Document verification failed');
  }

  return response.json();
}

export async function verifyAllDocuments(
  files: File[],
  documentTypes: string[]
): Promise<VerificationResult[]> {
  const results = await Promise.all(
    files.map((file, index) =>
      verifyDocument(file, documentTypes[index])
    )
  );

  return results;
}
```

#### Step 3: Integrate with Dashboard
```typescript
// src/pages/dashboards/OwnerDashboard.tsx
import { TaxiRegistrationForm } from '@components/TaxiRegistrationForm';

export const OwnerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      {activeTab === 'register' && (
        <TaxiRegistrationForm />
      )}
      {/* Other tabs */}
    </div>
  );
};
```

### Testing
```typescript
// src/components/__tests__/TaxiRegistrationForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaxiRegistrationForm } from '../TaxiRegistrationForm';

describe('TaxiRegistrationForm', () => {
  it('should validate plate number format', async () => {
    render(<TaxiRegistrationForm />);
    
    const plateInput = screen.getByPlaceholderText('e.g., CA 123 GP');
    await userEvent.type(plateInput, 'INVALID');
    fireEvent.blur(plateInput);

    expect(screen.getByText(/Invalid plate format/)).toBeInTheDocument();
  });

  it('should require at least one document', async () => {
    render(<TaxiRegistrationForm />);
    
    const submitButton = screen.getByText('Submit Registration');
    fireEvent.click(submitButton);

    expect(screen.getByText(/at least one document/i)).toBeInTheDocument();
  });

  it('should submit form successfully', async () => {
    render(<TaxiRegistrationForm />);
    
    // Fill form
    await userEvent.type(screen.getByPlaceholderText('e.g., CA 123 GP'), 'CA 123 GP');
    // ... fill other fields
    
    // Upload document
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/upload/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Submit
    const submitButton = screen.getByText('Submit Registration');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/successfully submitted/i)).toBeInTheDocument();
    });
  });
});
```

---

## Feature: Fleet Analytics Dashboard

### Overview
Display comprehensive analytics about fleet performance, earnings, and compliance.

### Components Involved
- `EarningsChart.tsx` - Revenue visualization
- `ComplianceChart.tsx` - Compliance metrics
- `PerformanceMetrics.tsx` - Key metrics display
- Charts library (BarChart, LineChart, PieChart)

### Implementation Steps

#### Step 1: Create Analytics Hook
```typescript
// src/hooks/useAnalytics.ts
import { useState, useEffect } from 'react';

interface AnalyticsData {
  earnings: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  compliance: {
    rate: number;
    trend: number[];
  };
  performance: {
    ridesCompleted: number;
    cancellationRate: number;
    avgRating: number;
  };
}

export const useAnalytics = (period: 'day' | 'week' | 'month') => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(
          `/api/analytics?period=${period}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to fetch analytics');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [period]);

  return { data, loading, error };
};
```

#### Step 2: Create Analytics Component
```typescript
// src/components/EarningsAnalytics.tsx
import React from 'react';
import { LineChart } from './Charts/LineChart';
import { useAnalytics } from '@hooks/useAnalytics';
import { LoadingSpinner } from './LoadingSpinner';

export const EarningsAnalytics: React.FC = () => {
  const [period, setPeriod] = React.useState<'day' | 'week' | 'month'>('month');
  const { data, loading, error } = useAnalytics(period);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  const labels = generateLabels(period);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {(['day', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              period === p
                ? 'bg-[#E72369] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <LineChart
        title="Earnings Over Time"
        labels={labels}
        datasets={[
          {
            label: 'Earnings',
            data: data.earnings[period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'],
            borderColor: '#E72369',
            backgroundColor: 'rgba(231, 35, 105, 0.1)',
          },
        ]}
      />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Total Earnings"
          value={`R ${getTotalEarnings(data).toLocaleString()}`}
        />
        <MetricCard
          title="Avg per Day"
          value={`R ${getAverageEarnings(data).toLocaleString()}`}
        />
        <MetricCard
          title="Best Day"
          value={`R ${Math.max(...data.earnings.daily).toLocaleString()}`}
        />
      </div>
    </div>
  );
};
```

#### Step 3: Export Data
```typescript
// src/utils/export.ts
export function exportToPDF(data: any, filename: string): void {
  // Implementation using jsPDF or similar
  // Generate PDF report and download
}

export function exportToCSV(data: any[], filename: string): void {
  const csv = convertArrayToCSV(data);
  downloadFile(csv, filename, 'text/csv');
}

export function exportToExcel(data: any[], filename: string): void {
  // Implementation using xlsx or similar
  // Generate Excel file and download
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
```

---

## Feature: Driver Management System

### Overview
Manage drivers, track performance, assign to taxis, and monitor safety ratings.

### Components Involved
- `DriverRegistrationForm.tsx` - Driver signup
- `DriverManagementTable.tsx` - Driver list
- `DriverPerformanceCard.tsx` - Individual driver metrics
- `DriverAssignmentModal.tsx` - Assign driver to taxi

### Implementation Steps

#### Step 1: Driver Registration Form
```typescript
// src/components/DriverRegistrationForm.tsx
import React, { useState } from 'react';
import { TextInput, Select, DateInput, Checkbox, Button } from '@components/Form';

interface DriverData {
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseType: string;
  taxiId: string;
}

export const DriverRegistrationForm: React.FC = () => {
  const [formData, setFormData] = useState<DriverData>({
    name: '',
    email: '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
    licenseType: 'professional',
    taxiId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.includes('@')) newErrors.email = 'Valid email required';
    if (!/^\+27\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Valid South African phone number required';
    }
    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }
    if (new Date(formData.licenseExpiry) <= new Date()) {
      newErrors.licenseExpiry = 'License must not be expired';
    }
    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      // Success - reset form and show confirmation
      setFormData({
        name: '',
        email: '',
        phone: '',
        licenseNumber: '',
        licenseExpiry: '',
        licenseType: 'professional',
        taxiId: '',
      });
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to register driver',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8 shadow-sm">
      <h2 className="text-2xl font-bold mb-6 gradient-primary-text">Register Driver</h2>

      <div className="space-y-6">
        <TextInput
          label="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
        />

        <TextInput
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          required
        />

        <TextInput
          label="Phone Number"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          error={errors.phone}
          placeholder="+27 123 456 7890"
          required
        />

        <TextInput
          label="License Number"
          value={formData.licenseNumber}
          onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
          error={errors.licenseNumber}
          required
        />

        <DateInput
          label="License Expiry Date"
          value={formData.licenseExpiry}
          onChange={(date) => setFormData({ ...formData, licenseExpiry: date })}
          error={errors.licenseExpiry}
          minDate={new Date().toISOString().split('T')[0]}
          required
        />

        <Select
          label="License Type"
          options={[
            { value: 'professional', label: 'Professional' },
            { value: 'learner', label: 'Learner' },
          ]}
          value={formData.licenseType}
          onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
        />

        <Checkbox
          label="I agree to the Terms of Service"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
        />
        {errors.terms && (
          <div className="text-red-600 text-sm">{errors.terms}</div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
        >
          Register Driver
        </Button>
      </div>
    </form>
  );
};
```

#### Step 2: Driver Performance Tracking
```typescript
// src/components/DriverPerformanceCard.tsx
import React, { useEffect, useState } from 'react';
import { Star, TrendingUp, AlertCircle } from 'lucide-react';

interface DriverPerformance {
  id: string;
  name: string;
  rating: number;
  completedRides: number;
  cancellations: number;
  acceptanceRate: number;
  safetyRating: number;
  earnings: number;
  status: 'active' | 'suspended' | 'training';
}

interface DriverPerformanceCardProps {
  driverId: string;
  onViewDetails: (id: string) => void;
}

export const DriverPerformanceCard: React.FC<DriverPerformanceCardProps> = ({
  driverId,
  onViewDetails,
}) => {
  const [performance, setPerformance] = useState<DriverPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const response = await fetch(`/api/drivers/${driverId}/performance`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          setPerformance(await response.json());
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [driverId]);

  if (loading) return <div>Loading...</div>;
  if (!performance) return null;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{performance.name}</h3>
          <p className="text-gray-600 text-sm">ID: {performance.id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          performance.status === 'active'
            ? 'bg-green-100 text-green-700'
            : performance.status === 'suspended'
            ? 'bg-red-100 text-red-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {performance.status.charAt(0).toUpperCase() + performance.status.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-gray-600 text-sm">Rating</p>
          <div className="flex items-center gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(performance.rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
            <span className="font-semibold ml-2">{performance.rating}</span>
          </div>
        </div>
        <div>
          <p className="text-gray-600 text-sm">Completed Rides</p>
          <p className="text-2xl font-bold mt-1">{performance.completedRides}</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">Acceptance Rate</p>
          <p className="text-2xl font-bold mt-1">{performance.acceptanceRate}%</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">Earnings</p>
          <p className="text-2xl font-bold mt-1">R {performance.earnings.toLocaleString()}</p>
        </div>
      </div>

      {performance.safetyRating < 3 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">Safety rating needs improvement</p>
        </div>
      )}

      <button
        onClick={() => onViewDetails(driverId)}
        className="w-full border-2 border-[#E72369] text-[#E72369] font-semibold py-2 rounded-lg hover:bg-[#E72369]/5 transition-all duration-300"
      >
        View Profile
      </button>
    </div>
  );
};
```

---

## Feature: Compliance Tracking

### Overview
Monitor document expiration dates, regulatory compliance status, and issue resolution.

### Implementation Steps

#### Step 1: Compliance Status Component
```typescript
// src/components/ComplianceStatus.tsx
import React from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ComplianceIssue {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  dueDate?: string;
  resolution?: string;
}

interface ComplianceStatusProps {
  issues: ComplianceIssue[];
  overallRate: number;
  onResolveIssue: (issueId: string) => void;
}

export const ComplianceStatus: React.FC<ComplianceStatusProps> = ({
  issues,
  overallRate,
  onResolveIssue,
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg p-8 shadow-sm">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 gradient-primary-text">Compliance Status</h2>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#E72369]">{overallRate}%</div>
            <p className="text-gray-600 text-sm">Overall Compliance</p>
          </div>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-[#E72369] to-[#EA4F52] h-4 rounded-full transition-all"
                style={{ width: `${overallRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No compliance issues</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Issues ({issues.length})</h3>
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`border-l-4 p-4 rounded flex items-start gap-4 ${
                issue.type === 'critical'
                  ? 'border-red-500 bg-red-50'
                  : issue.type === 'warning'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-blue-500 bg-blue-50'
              }`}
            >
              {getIcon(issue.type)}
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{issue.title}</h4>
                <p className="text-gray-600 text-sm mt-1">{issue.description}</p>
                {issue.dueDate && (
                  <p className="text-xs text-gray-500 mt-2">Due: {issue.dueDate}</p>
                )}
              </div>
              <button
                onClick={() => onResolveIssue(issue.id)}
                className="whitespace-nowrap px-4 py-2 bg-white border border-gray-300 rounded font-semibold text-sm hover:bg-gray-50 transition"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

This feature implementation guide provides templates for the major features. Each feature should follow the same pattern:

1. Define clear data models and types
2. Create main component(s)
3. Add supporting utilities and hooks
4. Integrate with appropriate dashboard
5. Add validation and error handling
6. Include tests

All components should follow the design system and use the reusable components from the component library.
