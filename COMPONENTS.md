# PEV CRM UI Components

This document describes all the shared UI components available in the PEV CRM project.

## UI Components (`/src/components/ui/`)

### Button

Versatile button component with multiple variants and sizes.

**Variants:**
- `default` - Navy background (primary action)
- `secondary` - Gray background
- `outline` - Border only style
- `ghost` - No background
- `destructive` - Red background (dangerous actions)

**Sizes:**
- `sm` - Small (9px height)
- `default` - Medium (10px height)
- `lg` - Large (12px height)

**Usage:**
```tsx
import { Button } from '@/components/ui/button'

export function Example() {
  return (
    <>
      <Button>Default Button</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline" size="sm">Small Outline</Button>
      <Button variant="destructive" size="lg">Delete</Button>
      <Button variant="ghost">Ghost Button</Button>
    </>
  )
}
```

### Card

Container component for grouping related content. Includes subcomponents for structure.

**Subcomponents:**
- `Card` - Main container
- `CardHeader` - Header section with padding
- `CardTitle` - Title element
- `CardDescription` - Subtitle or description
- `CardContent` - Main content area
- `CardFooter` - Footer section

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description or subtitle</CardDescription>
      </CardHeader>
      <CardContent>
        Main card content goes here
      </CardContent>
    </Card>
  )
}
```

### Badge

Small label/tag component for status indicators and categories.

**Variants:**
- `default` - Navy background
- `success` - Green background
- `warning` - Orange background
- `destructive` - Red background
- `secondary` - Gray background
- `outline` - Border only

**Usage:**
```tsx
import { Badge } from '@/components/ui/badge'

export function Example() {
  return (
    <>
      <Badge>Default</Badge>
      <Badge variant="success">Active</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="destructive">Archived</Badge>
    </>
  )
}
```

### Input

Text input field with styling and validation support.

**Usage:**
```tsx
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export function Example() {
  const [value, setValue] = useState('')

  return (
    <Input
      type="text"
      placeholder="Enter text..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
```

### Select

Select dropdown component for choosing from predefined options.

**Usage:**
```tsx
import { Select } from '@/components/ui/select'

export function Example() {
  return (
    <Select>
      <option value="">Select an option</option>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
    </Select>
  )
}
```

### Table

Data table component with multiple subcomponents for building structured tables.

**Subcomponents:**
- `Table` - Main table wrapper
- `TableHeader` - Header section
- `TableBody` - Body section
- `TableRow` - Row element
- `TableHead` - Header cell
- `TableCell` - Data cell
- `TableFooter` - Footer section (optional)

**Usage:**
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function Example() {
  const data = [
    { name: 'John', email: 'john@example.com' },
    { name: 'Jane', email: 'jane@example.com' },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.email}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Tabs

Tab navigation component with content panels.

**Subcomponents:**
- `Tabs` - Main container (with defaultValue)
- `TabsList` - Tab list container
- `TabsTrigger` - Individual tab button
- `TabsContent` - Content panel for each tab

**Usage:**
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function Example() {
  return (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for tab 1</TabsContent>
      <TabsContent value="tab2">Content for tab 2</TabsContent>
    </Tabs>
  )
}
```

## Shared Components (`/src/components/shared/`)

### StatsCard

Reusable card component for displaying statistics on dashboards.

**Props:**
- `title` - Card title
- `value` - Main metric value
- `subtitle` - Optional secondary text
- `icon` - Optional icon component
- `trend` - 'up' or 'down' for trend indicator
- `trendValue` - Trend percentage or value

**Usage:**
```tsx
import { StatsCard } from '@/components/shared/stats-card'
import { Users } from 'lucide-react'

export function DashboardExample() {
  return (
    <StatsCard
      title="Total Clients"
      value="1,234"
      subtitle="vs last month"
      icon={<Users size={20} />}
      trend="up"
      trendValue="12%"
    />
  )
}
```

### StatusBadge

Status badge with predefined colors for specific CRM statuses.

**Dossier Statuses:**
- `prospect` - Gray
- `client_en_cours` - Orange
- `client_finalise` - Green

**Facturation Statuses:**
- `à émettre` - Red
- `émise` - Orange
- `payée` - Green

**KYC Statuses:**
- `non` - Red
- `en_cours` - Orange
- `oui` - Green

**Usage:**
```tsx
import { StatusBadge } from '@/components/shared/status-badge'

export function Example() {
  return (
    <>
      <StatusBadge status="prospect" />
      <StatusBadge status="client_en_cours" />
      <StatusBadge status="payée" />
      <StatusBadge status="oui" />
    </>
  )
}
```

### DataTable

Generic data table component with sorting, filtering, and pagination.

**Props:**
- `data` - Array of data objects
- `columns` - Column definitions array
- `searchField` - Field to search by (optional)
- `searchPlaceholder` - Search input placeholder
- `pageSize` - Initial page size (default: 10)
- `className` - Additional CSS classes
- `rowClassName` - CSS for rows (string or function)
- `onRowClick` - Row click handler

**Column Definition:**
```typescript
interface ColumnDefinition<T> {
  key: keyof T           // Data key
  label: string          // Column header label
  sortable?: boolean     // Enable sorting
  render?: (value, row) => ReactNode  // Custom renderer
}
```

**Usage:**
```tsx
import { DataTable } from '@/components/shared/data-table'

export function ClientsTable() {
  const clients = [
    { id: 1, name: 'Acme Corp', status: 'Active', email: 'contact@acme.com' },
    { id: 2, name: 'Tech Ltd', status: 'Prospect', email: 'info@tech.com' },
  ]

  const columns = [
    { key: 'name' as const, label: 'Name', sortable: true },
    { key: 'status' as const, label: 'Status', sortable: true },
    {
      key: 'email' as const,
      label: 'Email',
      render: (value) => <a href={`mailto:${value}`}>{value}</a>
    },
  ]

  return (
    <DataTable
      data={clients}
      columns={columns}
      searchField="name"
      searchPlaceholder="Search clients..."
      pageSize={25}
    />
  )
}
```

## Design System

All components follow the PEV CRM design system:

### Colors
- **Primary (Navy):** `bg-navy-600`, `text-navy-700`
- **Success (Green):** `bg-green-100`, `text-green-800`
- **Warning (Orange):** `bg-orange-100`, `text-orange-800`
- **Destructive (Red):** `bg-red-600`, `text-red-800`
- **Secondary (Gray):** `bg-gray-100`, `text-gray-800`

### Typography
- All components use Tailwind's default font stack
- Consistent spacing and padding throughout

### Interactions
- Focus rings: Navy (`focus-visible:ring-navy-500`)
- Hover states: Subtle background changes
- Disabled states: Reduced opacity and disabled cursor

## Styling

All components use Tailwind CSS with the `cn()` utility function from `/lib/utils.ts` for proper class merging and deduplication.

To customize component styles, pass additional Tailwind classes via the `className` prop:

```tsx
<Button className="text-lg px-8">Large Button</Button>
<Card className="bg-blue-50">Custom Card</Card>
```

## TypeScript Support

All components are fully typed with TypeScript and include:
- Proper prop interfaces
- Forward ref support
- Generic type parameters where applicable
- Type-safe variant systems using `class-variance-authority`
