import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-navy-600 text-white hover:bg-navy-700 focus-visible:ring-navy-600',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500',
        outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus-visible:ring-gray-400',
        ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
        destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        default: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'button'

    if (asChild) {
      return React.cloneElement(props.children as React.ReactElement, {
        className: cn(buttonVariants({ variant, size }), className),
      })
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
