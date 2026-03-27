import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-navy-100 text-navy-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-orange-100 text-orange-800',
        destructive: 'bg-red-100 text-red-800',
        secondary: 'bg-gray-100 text-gray-800',
        outline: 'border border-gray-300 text-gray-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge, badgeVariants }
