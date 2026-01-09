import { ReactNode } from 'react'
import { TabId } from '../../App'
import TopNav from './TopNav'

interface AppShellProps {
  children: ReactNode
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function AppShell({ children, activeTab, onTabChange }: AppShellProps): JSX.Element {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Titlebar drag region for macOS */}
      <div className="titlebar-drag-region h-8 flex-shrink-0" />

      {/* Navigation */}
      <TopNav activeTab={activeTab} onTabChange={onTabChange} />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  )
}
