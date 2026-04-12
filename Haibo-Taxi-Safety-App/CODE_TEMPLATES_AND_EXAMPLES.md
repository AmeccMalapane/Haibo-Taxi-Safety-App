# Haibo Command Center - Code Templates & Examples

## Quick Copy-Paste Ready Components

### 1. Basic API Service Class

```typescript
// src/utils/api.ts
class ApiService {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.getToken()) {
      headers['Authorization'] = `Bearer ${this.getToken()}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired, clear and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T>(endpoint: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: any = {};
    if (this.getToken()) {
      headers['Authorization'] = `Bearer ${this.getToken()}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return response.json();
  }
}

export const api = new ApiService();
```

### 2. Auth Store (Zustand)

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'association' | 'driver';
  companyName?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      set({
        user: data.user,
        token: data.token,
        isLoading: false,
      });

      localStorage.setItem('token', data.token);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const result = await response.json();
      set({
        user: result.user,
        token: result.token,
        isLoading: false,
      });

      localStorage.setItem('token', result.token);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('token');
  },

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
}));
```

### 3. useApi Custom Hook

```typescript
// src/hooks/useApi.ts
import { useState, useEffect } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string, options?: RequestInit) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
          ...(token && { 'Authorization': `Bearer ${token}` }),
        };

        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          throw new Error('API request failed');
        }

        const data = await response.json();

        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const refetch = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return { ...state, refetch };
}
```

### 4. useForm Custom Hook

```typescript
// src/hooks/useForm.ts
import { useState } from 'react';

interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void>;
  validate?: (values: T) => Record<string, string>;
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
) {
  const [values, setValues] = useState<T>(options.initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(options.initialValues);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setValues((prev) => ({
      ...prev,
      [name]: fieldValue,
    }));

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (options.validate) {
      const validationErrors = options.validate(values);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await options.onSubmit(values);
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFieldValue = (name: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setValues(options.initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    isDirty,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    resetForm,
  };
}
```

### 5. Reusable TextInput Component

```typescript
// src/components/TextInput.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className: string }>;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, required, icon: Icon, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-semibold text-gray-700">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
        )}

        <div className="relative">
          {Icon && <Icon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />}
          <input
            ref={ref}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              Icon ? 'pl-10' : ''
            } ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-[#E72369] focus:border-transparent'
            } ${className}`}
            {...props}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}

        {hint && !error && <p className="text-gray-500 text-sm">{hint}</p>}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';
```

### 6. Dashboard Tab Template

```typescript
// src/pages/dashboards/DashboardTemplate.tsx
import React, { useState } from 'react';

type TabId = 'tab1' | 'tab2' | 'tab3';

const tabs: { id: TabId; label: string }[] = [
  { id: 'tab1', label: 'Overview' },
  { id: 'tab2', label: 'Details' },
  { id: 'tab3', label: 'Analytics' },
];

export const DashboardTemplate: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('tab1');

  const handleNavigate = (tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold gradient-primary-text mb-2">Dashboard Title</h1>
          <p className="text-gray-600">Subtitle or description</p>
        </div>
        <button className="gradient-primary text-white font-semibold px-6 py-3 rounded-lg hover:shadow-lg transition-all duration-300">
          Action Button
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tab1' && (
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-6 gradient-primary-text">Tab 1 Content</h2>
          {/* Content */}
        </div>
      )}

      {activeTab === 'tab2' && (
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-6 gradient-primary-text">Tab 2 Content</h2>
          {/* Content */}
        </div>
      )}

      {activeTab === 'tab3' && (
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-6 gradient-primary-text">Tab 3 Content</h2>
          {/* Content */}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleNavigate(tab.id)}
              className={`px-4 py-4 font-medium transition-all duration-300 whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#E72369] text-[#E72369]'
                  : 'border-transparent text-gray-600 hover:text-[#E72369]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 7. Data Table Component

```typescript
// src/components/DataTable.tsx
import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id?: string; [key: string]: any }>({
  columns,
  data,
  title,
  onRowClick,
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof T) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;

    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-6 py-3 text-left text-sm font-semibold text-gray-700"
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-gray-900"
                    >
                      {col.label}
                      {sortField === col.key ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr
                key={row.id || index}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-6 py-4 text-sm text-gray-900">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
}
```

### 8. Environment Variables Template

```bash
# .env.local
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_APP_NAME=Haibo Command Center
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development

# Feature flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_EXPORT=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

### 9. TypeScript Types Template

```typescript
// src/types/domain.ts
export interface Taxi {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: Date;
  taxiId: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: Date;
}

export interface Document {
  id: string;
  type: 'registration' | 'insurance' | 'license' | 'inspection';
  url: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  expiryDate?: Date;
  uploadedAt: Date;
}
```

### 10. Test Template

```typescript
// src/components/__tests__/TextInput.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextInput } from '../TextInput';

describe('TextInput', () => {
  it('should render input with label', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should handle input change', async () => {
    render(<TextInput />);
    const input = screen.getByRole('textbox');
    
    await userEvent.type(input, 'test@example.com');
    expect(input).toHaveValue('test@example.com');
  });

  it('should display error message', () => {
    render(<TextInput error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should show required indicator', () => {
    render(<TextInput label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
```

## Development Workflow Example

### Building the Owner Dashboard Earnings Tab

1. **Create the component**:
```bash
touch src/components/EarningsAnalytics.tsx
```

2. **Add the hook**:
```bash
touch src/hooks/useEarningsData.ts
```

3. **Implement the hook**:
```typescript
// src/hooks/useEarningsData.ts
export const useEarningsData = (period: string) => {
  return useApi(`/api/analytics/earnings?period=${period}`);
};
```

4. **Build the component**:
```typescript
// src/components/EarningsAnalytics.tsx
export const EarningsAnalytics: React.FC = () => {
  const [period, setPeriod] = useState('month');
  const { data, loading } = useEarningsData(period);
  
  // Render component with charts and metrics
};
```

5. **Integrate into dashboard**:
```typescript
// In OwnerDashboard.tsx
{activeTab === 'earnings' && <EarningsAnalytics />}
```

6. **Add tests**:
```bash
touch src/components/__tests__/EarningsAnalytics.test.tsx
```

7. **Test locally**:
```bash
npm run dev
# Navigate to /dashboard and click Earnings tab
```

---

All templates are production-ready and follow Haibo's design system and best practices. Customize as needed for specific requirements.
