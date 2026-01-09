import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[13px] font-semibold transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.97]',
          // Variants
          {
            // Primary (filled accent - amber)
            'bg-accent text-accent-foreground shadow-md hover:bg-accent/90 hover:shadow-lg':
              variant === 'default',
            // Secondary (filled muted)
            'bg-card text-foreground border border-card-border shadow-card hover:bg-card-hover hover:shadow-card-hover':
              variant === 'secondary',
            // Outline
            'border border-border bg-transparent text-foreground hover:bg-card hover:border-card-border':
              variant === 'outline',
            // Ghost
            'text-muted-foreground hover:bg-card hover:text-foreground':
              variant === 'ghost',
            // Destructive
            'bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90':
              variant === 'destructive'
          },
          // Sizes
          {
            'h-10 px-5 py-2': size === 'default',
            'h-8 px-3 text-[12px]': size === 'sm',
            'h-12 px-7 text-[14px]': size === 'lg',
            'h-10 w-10 p-0': size === 'icon'
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export default Button
