'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface ColumnDefinition<T> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: any, row: T) => React.ReactNode
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: ColumnDefinition<T>[]
  searchField?: keyof T
  searchPlaceholder?: string
  pageSize?: number
  className?: string
  rowClassName?: string | ((row: T) => string)
  onRowClick?: (row: T) => void
}

type SortDirection = 'asc' | 'desc' | null

export const DataTable = React.forwardRef<
  HTMLTableElement,
  DataTableProps<any>
>(
  (
    {
      data,
      columns,
      searchField,
      searchPlaceholder = 'Search...',
      pageSize: initialPageSize = 50,
      className,
      rowClassName,
      onRowClick,
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = React.useState('')
    const [sortColumn, setSortColumn] = React.useState<string | null>(null)
    const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
    const [currentPage, setCurrentPage] = React.useState(0)
    const [pageSize, setPageSize] = React.useState(initialPageSize)

    // Filter data by search query
    const filteredData = React.useMemo(() => {
      if (!searchQuery || !searchField) return data

      return data.filter((item) =>
        String(item[searchField])
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    }, [data, searchQuery, searchField])

    // Sort data
    const sortedData = React.useMemo(() => {
      if (!sortColumn || !sortDirection) return filteredData

      const sorted = [...filteredData].sort((a, b) => {
        const aValue = a[sortColumn]
        const bValue = b[sortColumn]

        // Handle null/undefined
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return 1
        if (bValue == null) return -1

        // Handle different types
        if (typeof aValue === 'string') {
          const comparison = aValue.localeCompare(String(bValue))
          return sortDirection === 'asc' ? comparison : -comparison
        }

        if (typeof aValue === 'number') {
          const comparison = aValue - Number(bValue)
          return sortDirection === 'asc' ? comparison : -comparison
        }

        // Default comparison
        const comparison = aValue === bValue ? 0 : aValue < bValue ? -1 : 1
        return sortDirection === 'asc' ? comparison : -comparison
      })

      return sorted
    }, [filteredData, sortColumn, sortDirection])

    // Pagination
    const totalPages = Math.ceil(sortedData.length / pageSize)
    const paginatedData = React.useMemo(
      () => sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
      [sortedData, currentPage, pageSize]
    )

    // Reset to first page when data changes
    React.useEffect(() => {
      setCurrentPage(0)
    }, [searchQuery, pageSize])

    const handleSort = (columnKey: string) => {
      if (sortColumn === columnKey) {
        // Cycle through: asc -> desc -> null
        if (sortDirection === 'asc') {
          setSortDirection('desc')
        } else if (sortDirection === 'desc') {
          setSortColumn(null)
          setSortDirection(null)
        }
      } else {
        setSortColumn(columnKey)
        setSortDirection('asc')
      }
    }

    const getSortIndicator = (columnKey: string) => {
      if (sortColumn !== columnKey) return null
      return sortDirection === 'asc' ? '↑' : '↓'
    }

    return (
      <div className={cn('space-y-4', className)}>
        {/* Search bar */}
        {searchField && (
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        )}

        {/* Table */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table ref={ref}>
            <TableHeader>
              <TableRow className="hover:bg-gray-50">
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    className={column.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
                    onClick={() =>
                      column.sortable && handleSort(String(column.key))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <span className="text-xs text-gray-400">
                          {getSortIndicator(String(column.key))}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    className={cn(
                      'hover:bg-gray-50 cursor-pointer',
                      typeof rowClassName === 'function'
                        ? rowClassName(row)
                        : rowClassName
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <TableCell key={String(column.key)}>
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {currentPage * pageSize + 1} to{' '}
              {Math.min((currentPage + 1) * pageSize, sortedData.length)} of{' '}
              {sortedData.length} results
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Per page:</label>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {currentPage + 1} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage === totalPages - 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage === totalPages - 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
DataTable.displayName = 'DataTable'
