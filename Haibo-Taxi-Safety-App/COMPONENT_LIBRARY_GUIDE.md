# Haibo Command Center - Component Library Guide

## Overview
This guide documents all reusable components in the Command Center application with usage examples and props documentation.

## Data Display Components

### StatsCard
Displays a metric with icon, value, and optional trend indicator.

```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className: string }>;
  color: string; // CSS color or hex
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  onClick?: () => void;
}

// Usage
<StatsCard
  title="Total Earnings"
  value="R 45,230"
  icon={TrendingUp}
  color="#E72369"
  trend={{ value: 12, direction: 'up' }}
/>
```

### DataTable
Flexible table component with sorting, pagination, and filtering.

```typescript
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
}

interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

// Usage
<DataTable
  title="Taxis"
  columns={[
    { key: 'plateNumber', label: 'Plate Number', sortable: true },
    { key: 'make', label: 'Make', sortable: true },
    { key: 'status', label: 'Status', render: (status) => (
      <StatusBadge status={status} />
    )},
  ]}
  data={taxis}
  pagination={{
    page: 1,
    pageSize: 10,
    total: 100,
    onPageChange: (page) => fetchTaxis(page),
  }}
/>
```

### StatusBadge
Shows status with color coding.

```typescript
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'verified' | 'rejected';
  size?: 'sm' | 'md' | 'lg';
}

// Usage
<StatusBadge status="active" size="md" />
<StatusBadge status="pending" />
```

### ProgressBar
Shows progress with optional label.

```typescript
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Usage
<ProgressBar value={85} label="Compliance" showPercentage />
```

### MetricCard
Card displaying a single metric with optional chart.

```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  subvalue?: string;
  icon?: React.ComponentType<{ className: string }>;
  chart?: {
    type: 'line' | 'bar' | 'area';
    data: number[];
    labels?: string[];
  };
  footer?: string;
}

// Usage
<MetricCard
  title="Weekly Earnings"
  value="R 5,230"
  subvalue="+12% from last week"
  icon={DollarSign}
  chart={{
    type: 'line',
    data: [1200, 1400, 1100, 1800, 1600, 1900, 2100],
  }}
/>
```

## Form Components

### TextInput
Enhanced text input with validation and error display.

```typescript
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className: string }>;
  clearable?: boolean;
  onClear?: () => void;
}

// Usage
<TextInput
  label="Email Address"
  type="email"
  placeholder="user@example.com"
  error={errors.email}
  required
  hint="We'll never share your email"
/>
```

### Select
Dropdown select component.

```typescript
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: {
    value: string | number;
    label: string;
    disabled?: boolean;
  }[];
  placeholder?: string;
  searchable?: boolean;
}

// Usage
<Select
  label="Vehicle Make"
  options={[
    { value: 'toyota', label: 'Toyota' },
    { value: 'ford', label: 'Ford' },
    { value: 'honda', label: 'Honda' },
  ]}
  placeholder="Select make..."
/>
```

### DateInput
Date picker component.

```typescript
interface DateInputProps {
  label?: string;
  value?: string;
  onChange?: (date: string) => void;
  error?: string;
  minDate?: string;
  maxDate?: string;
  hint?: string;
  required?: boolean;
}

// Usage
<DateInput
  label="Insurance Expiry Date"
  minDate={new Date().toISOString().split('T')[0]}
  error={errors.expiryDate}
  required
/>
```

### FileUpload
Drag-and-drop file upload component.

```typescript
interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  onFilesSelected?: (files: File[]) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

// Usage
<FileUpload
  label="Upload Documents"
  accept=".pdf,.jpg,.png"
  multiple
  maxSize={5242880} // 5MB
  onFilesSelected={(files) => handleFileUpload(files)}
  hint="PDF, JPG, or PNG (max 5MB)"
/>
```

### Checkbox
Checkbox input with label.

```typescript
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
}

// Usage
<Checkbox
  label="I agree to the terms and conditions"
  description="Please read our terms before proceeding"
/>
```

### Radio
Radio button group component.

```typescript
interface RadioProps {
  label?: string;
  name: string;
  value: string | number;
  checked?: boolean;
  onChange?: (value: string | number) => void;
  error?: string;
  disabled?: boolean;
}

// Radio Group
interface RadioGroupProps {
  label?: string;
  name: string;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options: {
    value: string | number;
    label: string;
    description?: string;
  }[];
  error?: string;
}

// Usage
<RadioGroup
  label="Vehicle Status"
  name="status"
  options={[
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending Verification' },
  ]}
/>
```

### Textarea
Multi-line text input component.

```typescript
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
}

// Usage
<Textarea
  label="Additional Notes"
  placeholder="Enter any additional information..."
  maxLength={500}
  showCharCount
/>
```

## Modal & Dialog Components

### Modal
Full-screen modal dialog.

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: {
    primaryButton?: {
      label: string;
      onClick: () => void;
      loading?: boolean;
      disabled?: boolean;
    };
    secondaryButton?: {
      label: string;
      onClick: () => void;
    };
  };
}

// Usage
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Confirm Action"
  size="md"
  footer={{
    primaryButton: {
      label: 'Confirm',
      onClick: handleConfirm,
      loading: isLoading,
    },
    secondaryButton: {
      label: 'Cancel',
      onClick: onClose,
    },
  }}
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

### Dialog
Lightweight dialog component.

```typescript
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
}

// Usage
<Dialog isOpen={isOpen} onClose={onClose}>
  {/* Dialog content */}
</Dialog>
```

### Toast/Notification
Non-blocking notification component.

```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, 0 for persistent
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Usage in component
const { showToast } = useToast();

// Show toast
showToast({
  type: 'success',
  title: 'Success!',
  message: 'Taxi registered successfully',
  duration: 3000,
});
```

## Chart Components

### BarChart
Bar chart component.

```typescript
interface BarChartProps {
  title?: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[];
  height?: number;
  responsive?: boolean;
  onClick?: (datasetIndex: number, index: number) => void;
}

// Usage
<BarChart
  title="Weekly Earnings"
  labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
  datasets={[
    {
      label: 'Earnings',
      data: [1200, 1400, 1100, 1800, 1600, 1900, 2100],
      backgroundColor: '#E72369',
    },
  ]}
  height={300}
/>
```

### LineChart
Line chart component.

```typescript
interface LineChartProps {
  title?: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    borderWidth?: number;
  }[];
  height?: number;
  responsive?: boolean;
  showGrid?: boolean;
}

// Usage
<LineChart
  title="Compliance Rate Over Time"
  labels={['Week 1', 'Week 2', 'Week 3', 'Week 4']}
  datasets={[
    {
      label: 'Compliance Rate',
      data: [90, 92, 91, 95],
      borderColor: '#28A745',
      backgroundColor: 'rgba(40, 167, 69, 0.1)',
    },
  ]}
/>
```

### PieChart
Pie/Donut chart component.

```typescript
interface PieChartProps {
  title?: string;
  labels: string[];
  data: number[];
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  donut?: boolean;
}

// Usage
<PieChart
  title="Fleet Status Distribution"
  labels={['Active', 'Pending', 'Suspended']}
  data={[80, 15, 5]}
  colors={['#28A745', '#FFA000', '#D32F2F']}
  donut
/>
```

## Navigation Components

### Tabs
Tab navigation component.

```typescript
interface TabsProps {
  tabs: {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className: string }>;
  }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'underline' | 'pills';
}

// Usage
<Tabs
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details', icon: Settings },
    { id: 'documents', label: 'Documents' },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

### Breadcrumbs
Breadcrumb navigation component.

```typescript
interface BreadcrumbsProps {
  items: {
    label: string;
    href?: string;
    onClick?: () => void;
  }[];
}

// Usage
<Breadcrumbs
  items={[
    { label: 'Dashboard', href: '/' },
    { label: 'Fleets', href: '/fleets' },
    { label: 'Taxi CA 123 GP' },
  ]}
/>
```

### Pagination
Pagination component.

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisible?: number;
}

// Usage
<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(total / pageSize)}
  onPageChange={setCurrentPage}
  showFirstLast
/>
```

## Loading & Feedback Components

### LoadingSpinner
Loading spinner component.

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

// Usage
<LoadingSpinner size="md" color="#E72369" />
```

### SkeletonLoader
Skeleton loading placeholder.

```typescript
interface SkeletonLoaderProps {
  count?: number;
  height?: number;
  circle?: boolean;
  style?: React.CSSProperties;
}

// Usage
<SkeletonLoader count={3} height={100} />
```

### Alert
Alert/notification banner component.

```typescript
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Usage
<Alert
  type="warning"
  title="Attention Required"
  message="Your insurance policy will expire in 5 days"
  action={{
    label: 'Renew Now',
    onClick: handleRenewal,
  }}
/>
```

### Empty State
Empty state component for no data scenarios.

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Usage
<EmptyState
  icon={<Inbox className="w-16 h-16 text-gray-400" />}
  title="No Data Available"
  description="There's no data to display yet."
  action={{
    label: 'Get Started',
    onClick: handleStart,
  }}
/>
```

## Button Components

### Button
Standard button component.

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

// Usage
<Button variant="primary" size="lg" icon={<Plus />}>
  Add New Taxi
</Button>

<Button variant="outline" disabled>
  Disabled
</Button>

<Button variant="danger" loading={isLoading}>
  {isLoading ? 'Deleting...' : 'Delete'}
</Button>
```

### IconButton
Button with only icon.

```typescript
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className: string }>;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  variant?: 'default' | 'ghost' | 'danger';
}

// Usage
<IconButton icon={Edit} tooltip="Edit" />
<IconButton icon={Trash} tooltip="Delete" variant="danger" />
```

## Custom Hooks

### useApi
Hook for API requests with loading and error states.

```typescript
interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  cache?: boolean;
}

const { data, loading, error, refetch } = useApi<Taxi[]>(
  '/api/taxis',
  { cache: true }
);
```

### useForm
Hook for form state management.

```typescript
interface UseFormOptions {
  initialValues: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  validate?: (values: Record<string, any>) => Record<string, string>;
}

const { values, errors, touched, isDirty, handleChange, handleSubmit, setFieldValue } = useForm(
  {
    initialValues: { email: '', password: '' },
    validate: validateForm,
    onSubmit: handleSubmit,
  }
);
```

### useAuth
Hook for authentication state.

```typescript
const { user, token, login, logout, isAuthenticated, isLoading } = useAuth();
```

### useModal
Hook for modal state management.

```typescript
const { isOpen, open, close, toggle } = useModal();

return (
  <>
    <Button onClick={open}>Open Modal</Button>
    <Modal isOpen={isOpen} onClose={close}>
      {/* Modal content */}
    </Modal>
  </>
);
```

### useLocalStorage
Hook for local storage state.

```typescript
const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
```

## Styling Guidelines

All components use Tailwind CSS classes and follow these patterns:

- **Primary Color**: `#E72369` (Haibo Pink) - Use `gradient-primary` class
- **Secondary Color**: `#EA4F52` (Haibo Coral)
- **Spacing**: Use Tailwind spacing (4px, 8px, 12px, etc.)
- **Rounded Corners**: Default `rounded-lg`, adjust as needed
- **Shadows**: Use `shadow-sm` for subtle depth
- **Borders**: Use `border-gray-300` for default, adjust color for states
- **Focus States**: Use `focus:ring-2 focus:ring-[#E72369]`
- **Transitions**: Use `transition-all duration-300` for smooth animations

## Best Practices

1. **Prop Drilling**: Use context or custom hooks to avoid deep prop drilling
2. **Type Safety**: Always define TypeScript interfaces for props
3. **Error Handling**: Provide clear error messages to users
4. **Loading States**: Show spinners or skeletons during async operations
5. **Accessibility**: Include ARIA labels, keyboard navigation, and semantic HTML
6. **Testing**: Write unit tests for components
7. **Documentation**: Include JSDoc comments for public APIs
8. **Performance**: Use React.memo, useMemo, and useCallback appropriately
9. **Reusability**: Create generic components that can be used in multiple contexts
10. **Consistency**: Follow established patterns and naming conventions
