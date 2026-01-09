import { TabId } from '../../App'
import {
  LayoutDashboard,
  Sparkles,
  Users,
  FolderGit2,
  History,
  Settings
} from 'lucide-react'

interface SidebarProps {
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
  { id: 'my-work', label: 'My Work', icon: Sparkles },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'repos', label: 'Repositories', icon: FolderGit2 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export default function Sidebar({ activeTab, onTabChange }: SidebarProps): JSX.Element {
  return (
    <aside className="titlebar-no-drag flex h-full w-sidebar flex-col border-r border-border bg-sidebar">
      {/* Traffic light spacing */}
      <div className="titlebar-drag-region h-12 flex-shrink-0" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-accent-foreground shadow-md'
                    : 'text-sidebar-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                    isActive
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                  strokeWidth={isActive ? 2 : 1.75}
                />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Powered by Claude
        </p>
      </div>
    </aside>
  )
}
