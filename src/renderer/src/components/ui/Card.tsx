import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'inset' | 'elevated' | 'interactive'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl text-card-foreground',
        {
          // Default - clear border with elevation
          'border border-card-border bg-card shadow-card':
            variant === 'default',
          // Inset - for nested content, subtle background
          'border border-border-subtle bg-background-secondary':
            variant === 'inset',
          // Elevated - more prominent with stronger shadow
          'border border-card-border bg-card shadow-medium':
            variant === 'elevated',
          // Interactive - hover effects
          'border border-card-border bg-card shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-border':
            variant === 'interactive'
        },
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export default Card
