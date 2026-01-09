import { TabId } from '../../App'
import {
  LayoutDashboard,
  User,
  Users,
  FolderGit2,
  History,
  Settings
} from 'lucide-react'

interface TopNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

interface NavItem {
  id: TabId
  label: string
  icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-work', label: 'My Work', icon: User },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'repos', label: 'Repos', icon: FolderGit2 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export default function TopNav({ activeTab, onTabChange }: TopNavProps): JSX.Element {
  return (
    <nav className="titlebar-no-drag flex items-center gap-1 border-b border-border px-4 pb-2">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
