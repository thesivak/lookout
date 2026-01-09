import { TabId } from '../../App'
import {
  LayoutDashboard,
  User,
  Users,
  FolderGit2,
  History,
  Settings,
  Sparkles
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
    <aside className="titlebar-no-drag flex h-full w-sidebar flex-col border-r border-border/50 bg-sidebar">
      {/* Traffic light spacing */}
      <div className="titlebar-drag-region h-8 flex-shrink-0" />

      {/* App branding */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-2">
        <div className="titlebar-no-drag flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-blue-600 shadow-subtle">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Lookout</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-sidebar-foreground hover:bg-muted/60'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-muted-foreground group-hover:text-sidebar-foreground'
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
      <div className="border-t border-border/50 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Powered by Claude
        </p>
      </div>
    </aside>
  )
}
