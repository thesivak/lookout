import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'inset' | 'elevated'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl text-card-foreground',
        {
          // Default - subtle border with white background
          'border border-border/60 bg-card shadow-subtle':
            variant === 'default',
          // Inset - for nested content, no shadow
          'border border-border/40 bg-card':
            variant === 'inset',
          // Elevated - more prominent shadow
          'border border-border/40 bg-card shadow-medium':
            variant === 'elevated'
        },
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export default Card
