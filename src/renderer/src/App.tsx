import { useState, useEffect, createContext, useContext } from 'react'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import MyWork from './pages/MyWork'
import Team from './pages/Team'
import Repos from './pages/Repos'
import History from './pages/History'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { Loader2 } from 'lucide-react'

export type TabId = 'dashboard' | 'my-work' | 'team' | 'repos' | 'history' | 'settings'

interface AuthUser {
  id: number
  githubId: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
}

interface NavigationContextType {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const NavigationContext = createContext<NavigationContextType | null>(null)
const AuthContext = createContext<AuthContextType | null>(null)

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const result = await window.api.oauth.check()
        if (result.authenticated && result.user) {
          setUser(result.user)
          setAuthState('authenticated')
        } else {
          setAuthState('unauthenticated')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setAuthState('unauthenticated')
      }
    }
    checkAuth()
  }, [])

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

  const handleLoginSuccess = async () => {
    const result = await window.api.oauth.check()
    if (result.authenticated && result.user) {
      setUser(result.user)
      setAuthState('authenticated')
      // Navigate to repos page to import repositories
      setActiveTab('repos')
    }
  }

  const handleLogout = async () => {
    await window.api.oauth.logout()
    setUser(null)
    setAuthState('unauthenticated')
  }

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

  // Show loading screen while checking auth
  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (authState === 'unauthenticated') {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: true, logout: handleLogout }}>
      <NavigationContext.Provider value={{ activeTab, setActiveTab }}>
        <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
          {renderPage()}
        </AppShell>
      </NavigationContext.Provider>
    </AuthContext.Provider>
  )
}

export default App
