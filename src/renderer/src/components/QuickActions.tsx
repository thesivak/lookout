import { useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import { Coffee, Users, Calendar, Briefcase, Zap, ChevronRight } from 'lucide-react'
import { useNavigation } from '../App'

export interface QuickAction {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  type: 'personal' | 'team'
  template: string
  dateRange: 'yesterday' | 'today' | 'week' | 'last_week'
  color: 'accent' | 'success' | 'muted'
}

const defaultActions: QuickAction[] = [
  {
    id: 'daily-standup',
    label: 'Daily Stand-up',
    description: "Yesterday's work in standup format",
    icon: Coffee,
    type: 'personal',
    template: 'casual-standup',
    dateRange: 'yesterday',
    color: 'accent'
  },
  {
    id: 'team-summary',
    label: 'Team Summary',
    description: "Team's recent activity overview",
    icon: Users,
    type: 'team',
    template: 'technical',
    dateRange: 'yesterday',
    color: 'success'
  },
  {
    id: 'weekly-report',
    label: 'Weekly Report',
    description: 'Your work from the past week',
    icon: Calendar,
    type: 'personal',
    template: 'technical',
    dateRange: 'week',
    color: 'muted'
  },
  {
    id: 'manager-update',
    label: 'Manager Update',
    description: 'High-level summary for your manager',
    icon: Briefcase,
    type: 'personal',
    template: 'manager-friendly',
    dateRange: 'week',
    color: 'muted'
  }
]

interface QuickActionsProps {
  onAction?: (action: QuickAction) => void
  className?: string
}

export default function QuickActions({ onAction, className = '' }: QuickActionsProps): JSX.Element {
  const { setActiveTab } = useNavigation()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleActionClick = async (action: QuickAction) => {
    setLoadingAction(action.id)

    try {
      if (onAction) {
        onAction(action)
      } else {
        // Default behavior: navigate to appropriate page with preset config
        // Store the action config in sessionStorage for the destination page to pick up
        sessionStorage.setItem(
          'quickActionConfig',
          JSON.stringify({
            type: action.type,
            template: action.template,
            dateRange: action.dateRange,
            autoGenerate: true
          })
        )

        // Navigate to the appropriate page
        if (action.type === 'personal') {
          setActiveTab('my-work')
        } else {
          setActiveTab('team')
        }
      }
    } finally {
      setLoadingAction(null)
    }
  }

  const getColorClasses = (color: QuickAction['color']) => {
    switch (color) {
      case 'accent':
        return {
          icon: 'bg-accent-subtle border-accent/20 text-accent',
          hover: 'hover:border-accent/30 hover:shadow-glow-accent'
        }
      case 'success':
        return {
          icon: 'bg-success-subtle border-success/20 text-success',
          hover: 'hover:border-success/30'
        }
      default:
        return {
          icon: 'bg-muted border-border-subtle text-muted-foreground',
          hover: 'hover:border-border'
        }
    }
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <h2 className="text-[16px] font-semibold">Quick Actions</h2>
        </div>
        <span className="rounded-lg bg-accent-subtle px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/20">
          One-click
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {defaultActions.map((action) => {
          const Icon = action.icon
          const colors = getColorClasses(action.color)
          const isLoading = loadingAction === action.id

          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={isLoading}
              className={`group flex items-center gap-3 rounded-xl border border-border-subtle bg-background-secondary p-4 text-left transition-all ${colors.hover} disabled:opacity-60`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${colors.icon}`}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{action.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Get quick action configuration from session storage (used by destination pages)
 */
export function getQuickActionConfig(): {
  type: 'personal' | 'team'
  template: string
  dateRange: string
  autoGenerate: boolean
} | null {
  try {
    const config = sessionStorage.getItem('quickActionConfig')
    if (config) {
      sessionStorage.removeItem('quickActionConfig') // Clear after reading
      return JSON.parse(config)
    }
  } catch {
    // Ignore parsing errors
  }
  return null
}
