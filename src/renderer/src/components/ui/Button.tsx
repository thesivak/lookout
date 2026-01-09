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
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-[13px] font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.98]',
          // Variants
          {
            // Primary (filled accent)
            'bg-accent text-accent-foreground shadow-subtle hover:bg-accent/90 active:bg-accent/85':
              variant === 'default',
            // Secondary (filled muted)
            'bg-muted text-foreground shadow-subtle hover:bg-muted/80':
              variant === 'secondary',
            // Outline
            'border border-input-border bg-card text-foreground shadow-subtle hover:bg-muted/50':
              variant === 'outline',
            // Ghost
            'text-muted-foreground hover:bg-muted/60 hover:text-foreground':
              variant === 'ghost',
            // Destructive
            'bg-destructive text-destructive-foreground shadow-subtle hover:bg-destructive/90':
              variant === 'destructive'
          },
          // Sizes
          {
            'h-9 px-4 py-2': size === 'default',
            'h-8 px-3': size === 'sm',
            'h-11 px-6 text-[14px]': size === 'lg',
            'h-9 w-9 p-0': size === 'icon'
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
