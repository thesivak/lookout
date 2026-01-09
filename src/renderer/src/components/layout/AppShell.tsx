import { ReactNode } from 'react'
import { TabId } from '../../App'
import Sidebar from './Sidebar'

interface AppShellProps {
  children: ReactNode
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function AppShell({ children, activeTab, onTabChange }: AppShellProps): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-sidebar">
      {/* Sidebar with integrated titlebar */}
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background-secondary">
        {/* Titlebar drag region */}
        <div className="titlebar-drag-region h-8 flex-shrink-0" />

        {/* Main content */}
        <main className="flex-1 overflow-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
