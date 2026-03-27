'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

const useTabsContext = () => {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tab components must be used within a Tabs component')
  }
  return context
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value: controlledValue, onValueChange, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
    const isControlled = controlledValue !== undefined
    const value = isControlled ? controlledValue : uncontrolledValue

    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue)
        }
        onValueChange?.(newValue)
      },
      [isControlled, onValueChange]
    )

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn('w-full', className)} {...props} />
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500',
      className
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { value: tabValue, onValueChange } = useTabsContext()
    const isActive = tabValue === value

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onValueChange(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-white text-navy-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: tabValue } = useTabsContext()
    const isActive = tabValue === value

    return (
      isActive && (
        <div
          ref={ref}
          className={cn(
            'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2',
            className
          )}
          {...props}
        />
      )
    )
  }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
