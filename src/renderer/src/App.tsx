import { useState, useEffect, createContext, useContext } from 'react'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import MyWork from './pages/MyWork'
import Team from './pages/Team'
import Repos from './pages/Repos'
import History from './pages/History'
import Settings from './pages/Settings'

export type TabId = 'dashboard' | 'my-work' | 'team' | 'repos' | 'history' | 'settings'

interface NavigationContextType {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  // Listen for navigation events from system tray
  useEffect(() => {
    const unsubNavigate = window.api.app.onNavigate((tab) => {
      if (['dashboard', 'my-work', 'team', 'repos', 'history', 'settings'].includes(tab)) {
        setActiveTab(tab as TabId)
      }
    })

    return () => {
      unsubNavigate()
    }
  }, [])

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'my-work':
        return <MyWork />
      case 'team':
        return <Team />
      case 'repos':
        return <Repos />
      case 'history':
        return <History />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <NavigationContext.Provider value={{ activeTab, setActiveTab }}>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPage()}
      </AppShell>
    </NavigationContext.Provider>
  )
}

export default App
