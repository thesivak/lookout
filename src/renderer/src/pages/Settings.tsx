import { useEffect, useState, useCallback } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import {
  Clock,
  FileText,
  Save,
  Monitor,
  Check,
  Info,
  Keyboard,
  Users,
  Settings as SettingsIcon,
  UserCog,
  Trash2,
  EyeOff,
  Eye,
  Plus,
  X,
  Merge,
  Edit2,
  Github,
  RefreshCw,
  Link,
  Unlink,
  AlertCircle,
  CheckCircle2,
  GitPullRequest,
  MessageSquare,
  CircleDot,
  Loader2,
  AlertTriangle,
  Database,
  RotateCcw
} from 'lucide-react'

interface SettingsData {
  scheduled_time: string
  scheduled_enabled: string
  default_prompt_template: string
  date_range_default: string
}

// macOS-style toggle switch
function Toggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative h-[22px] w-[40px] rounded-full transition-all duration-200 disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? 'left-[20px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

type SettingsSection = 'general' | 'github' | 'templates' | 'contributors' | 'shortcuts' | 'about' | 'dangerzone'

interface DangerZoneStats {
  summaries: number
  repositories: number
  commits: number
  pullRequests: number
  reviews: number
  contributorProfiles: number
}

interface GitHubUser {
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

interface GitHubRepoStatus {
  id: number
  name: string
  owner: string | null
  repo: string | null
  lastSync: string | null
}

interface ContributorProfile {
  id: number
  displayName: string
  isExcluded: boolean
  emails: ContributorEmail[]
  createdAt: string
  updatedAt: string
}

interface ContributorEmail {
  email: string
  profileId: number
  isPrimary: boolean
  originalName: string
  createdAt: string
}

interface UnaliasedContributor {
  email: string
  name: string
  commitCount: number
}

export default function Settings(): JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [settings, setSettings] = useState<SettingsData>({
    scheduled_time: '09:00',
    scheduled_enabled: 'false',
    default_prompt_template: 'technical',
    date_range_default: 'previous_day'
  })
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Contributors state
  const [profiles, setProfiles] = useState<ContributorProfile[]>([])
  const [unaliasedContributors, setUnaliasedContributors] = useState<UnaliasedContributor[]>([])
  const [contributorsLoading, setContributorsLoading] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set())
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeDisplayName, setMergeDisplayName] = useState('')
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showCreateAliasModal, setShowCreateAliasModal] = useState(false)
  const [createAliasTarget, setCreateAliasTarget] = useState<UnaliasedContributor | null>(null)
  const [createAliasName, setCreateAliasName] = useState('')

  // GitHub state
  const [githubToken, setGithubToken] = useState('')
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null)
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [githubRepos, setGithubRepos] = useState<GitHubRepoStatus[]>([])
  const [githubLoading, setGithubLoading] = useState(false)
  const [syncingRepoId, setSyncingRepoId] = useState<number | null>(null)
  const [syncAllLoading, setSyncAllLoading] = useState(false)

  // Danger zone state
  const [dangerZoneStats, setDangerZoneStats] = useState<DangerZoneStats | null>(null)
  const [dangerZoneLoading, setDangerZoneLoading] = useState(false)
  const [dangerZoneAction, setDangerZoneAction] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [actionInProgress, setActionInProgress] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const [data, launch] = await Promise.all([
          window.api.settings.getAll(),
          window.api.app.getAutoLaunch()
        ])
        setSettings(data)
        setAutoLaunch(launch)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const loadContributors = useCallback(async () => {
    try {
      setContributorsLoading(true)
      const [profilesData, authorsData] = await Promise.all([
        window.api.contributors.listProfiles(),
        window.api.git.getAllAuthors()
      ])
      setProfiles(profilesData)

      const profiledEmails = new Set(
        profilesData.flatMap((p) => p.emails.map((e) => e.email.toLowerCase()))
      )
      const unaliased = authorsData.filter(
        (author) => !profiledEmails.has(author.email.toLowerCase())
      )
      setUnaliasedContributors(unaliased)
    } catch (error) {
      console.error('Failed to load contributors:', error)
    } finally {
      setContributorsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSection === 'contributors') {
      loadContributors()
    }
  }, [activeSection, loadContributors])

  const handleSave = async () => {
    try {
      setSaving(true)
      await Promise.all([
        window.api.settings.setMany(settings),
        window.api.app.setAutoLaunch(autoLaunch)
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  // GitHub handlers
  const loadGitHubStatus = useCallback(async () => {
    try {
      setGithubLoading(true)
      const [tokenResult] = await Promise.all([
        window.api.github.checkToken()
      ])
      if (tokenResult.connected && tokenResult.user) {
        setGithubUser(tokenResult.user)
        // Auto-detect GitHub repos for any that haven't been detected yet
        await window.api.github.detectRepos()
      }
      // Now get the updated repo status
      const reposResult = await window.api.github.getRepoStatus()
      if (reposResult.success) {
        setGithubRepos(reposResult.repos)
      }
    } catch (error) {
      console.error('Failed to load GitHub status:', error)
    } finally {
      setGithubLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSection === 'github') {
      loadGitHubStatus()
    }
  }, [activeSection, loadGitHubStatus])

  const handleGitHubConnect = async () => {
    if (!githubToken.trim()) return
    try {
      setGithubConnecting(true)
      setGithubError(null)
      const result = await window.api.github.setToken(githubToken.trim())
      if (result.success && result.user) {
        setGithubUser(result.user)
        setGithubToken('')
        // Auto-detect GitHub repos
        const detectResult = await window.api.github.detectRepos()
        if (detectResult.success) {
          await loadGitHubStatus()
        }
      } else {
        setGithubError(result.error || 'Failed to connect to GitHub')
      }
    } catch (error) {
      setGithubError('Failed to connect to GitHub')
      console.error('GitHub connection error:', error)
    } finally {
      setGithubConnecting(false)
    }
  }

  const handleGitHubDisconnect = async () => {
    try {
      await window.api.github.disconnect()
      setGithubUser(null)
      setGithubRepos([])
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error)
    }
  }

  const handleSyncRepo = async (repoId: number) => {
    try {
      setSyncingRepoId(repoId)
      const result = await window.api.github.syncRepo(repoId)
      if (result.success) {
        await loadGitHubStatus()
      }
    } catch (error) {
      console.error('Failed to sync repo:', error)
    } finally {
      setSyncingRepoId(null)
    }
  }

  const handleSyncAll = async () => {
    try {
      setSyncAllLoading(true)
      await window.api.github.syncAll()
      await loadGitHubStatus()
    } catch (error) {
      console.error('Failed to sync all repos:', error)
    } finally {
      setSyncAllLoading(false)
    }
  }

  // Contributors handlers
  const handleToggleExclusion = async (profile: ContributorProfile) => {
    try {
      await window.api.contributors.setExcluded(profile.id, !profile.isExcluded)
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, isExcluded: !p.isExcluded } : p))
      )
    } catch (error) {
      console.error('Failed to toggle exclusion:', error)
    }
  }

  const handleQuickExclude = async (contributor: UnaliasedContributor) => {
    try {
      const newProfile = await window.api.contributors.quickExclude(
        contributor.email,
        contributor.name
      )
      setProfiles((prev) => [...prev, newProfile])
      setUnaliasedContributors((prev) =>
        prev.filter((c) => c.email.toLowerCase() !== contributor.email.toLowerCase())
      )
    } catch (error) {
      console.error('Failed to exclude contributor:', error)
    }
  }

  const handleDeleteProfile = async (profileId: number) => {
    try {
      const profile = profiles.find((p) => p.id === profileId)
      await window.api.contributors.deleteProfile(profileId)
      setProfiles((prev) => prev.filter((p) => p.id !== profileId))
      if (profile) {
        const newUnaliased = profile.emails.map((e) => ({
          email: e.email,
          name: e.originalName,
          commitCount: 0
        }))
        setUnaliasedContributors((prev) => [...prev, ...newUnaliased])
      }
    } catch (error) {
      console.error('Failed to delete profile:', error)
    }
  }

  const handleRemoveEmailFromProfile = async (email: string) => {
    try {
      await window.api.contributors.removeEmail(email)
      await loadContributors()
    } catch (error) {
      console.error('Failed to remove email:', error)
    }
  }

  const handleToggleSelect = (email: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev)
      if (next.has(email)) {
        next.delete(email)
      } else {
        next.add(email)
      }
      return next
    })
  }

  const handleStartMerge = () => {
    if (selectedForMerge.size < 2) return
    const firstEmail = Array.from(selectedForMerge)[0]
    const firstContributor = unaliasedContributors.find(
      (c) => c.email.toLowerCase() === firstEmail.toLowerCase()
    )
    setMergeDisplayName(firstContributor?.name || '')
    setShowMergeModal(true)
  }

  const handleConfirmMerge = async () => {
    if (!mergeDisplayName.trim() || selectedForMerge.size < 2) return
    try {
      const emailsToMerge = Array.from(selectedForMerge).map((email) => {
        const contributor = unaliasedContributors.find(
          (c) => c.email.toLowerCase() === email.toLowerCase()
        )
        return { email, originalName: contributor?.name || email }
      })
      await window.api.contributors.merge(mergeDisplayName.trim(), emailsToMerge)
      setShowMergeModal(false)
      setSelectedForMerge(new Set())
      setMergeDisplayName('')
      await loadContributors()
    } catch (error) {
      console.error('Failed to merge contributors:', error)
    }
  }

  const handleStartEdit = (profile: ContributorProfile) => {
    setEditingProfileId(profile.id)
    setEditingName(profile.displayName)
  }

  const handleSaveEdit = async () => {
    if (!editingProfileId || !editingName.trim()) return
    try {
      await window.api.contributors.updateProfile(editingProfileId, editingName.trim())
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfileId ? { ...p, displayName: editingName.trim() } : p
        )
      )
      setEditingProfileId(null)
      setEditingName('')
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingProfileId(null)
    setEditingName('')
  }

  const handleStartCreateAlias = (contributor: UnaliasedContributor) => {
    setCreateAliasTarget(contributor)
    setCreateAliasName(contributor.name)
    setShowCreateAliasModal(true)
  }

  const handleConfirmCreateAlias = async () => {
    if (!createAliasTarget || !createAliasName.trim()) return
    try {
      const newProfile = await window.api.contributors.createProfile(createAliasName.trim(), [
        { email: createAliasTarget.email, originalName: createAliasTarget.name }
      ])
      setProfiles((prev) => [...prev, newProfile])
      setUnaliasedContributors((prev) =>
        prev.filter((c) => c.email.toLowerCase() !== createAliasTarget.email.toLowerCase())
      )
      setShowCreateAliasModal(false)
      setCreateAliasTarget(null)
      setCreateAliasName('')
    } catch (error) {
      console.error('Failed to create alias:', error)
    }
  }

  const sections = [
    { id: 'general' as const, label: 'General', icon: SettingsIcon },
    { id: 'github' as const, label: 'GitHub', icon: Github },
    { id: 'templates' as const, label: 'Templates', icon: FileText },
    { id: 'contributors' as const, label: 'Contributors', icon: Users },
    { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
    { id: 'about' as const, label: 'About', icon: Info },
    { id: 'dangerzone' as const, label: 'Danger Zone', icon: AlertTriangle, isDanger: true }
  ]

  // Load danger zone stats
  const loadDangerZoneStats = useCallback(async () => {
    try {
      setDangerZoneLoading(true)
      const result = await window.api.dangerzone.getStats()
      if (result.success && result.stats) {
        setDangerZoneStats(result.stats)
      }
    } catch (error) {
      console.error('Failed to load danger zone stats:', error)
    } finally {
      setDangerZoneLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSection === 'dangerzone') {
      loadDangerZoneStats()
    }
  }, [activeSection, loadDangerZoneStats])

  // Danger zone actions
  const handleDangerAction = async (action: string) => {
    setActionInProgress(true)
    try {
      switch (action) {
        case 'clear-summaries':
          await window.api.dangerzone.clearSummaries()
          break
        case 'clear-github':
          await window.api.dangerzone.clearGitHub()
          break
        case 'clear-commits':
          await window.api.dangerzone.clearCommits()
          break
        case 'reset-settings':
          await window.api.dangerzone.resetSettings()
          break
        case 'reset-database':
          await window.api.dangerzone.resetDatabase()
          // Restart app after database reset
          await window.api.dangerzone.restartApp()
          break
      }
      setDangerZoneAction(null)
      setConfirmText('')
      await loadDangerZoneStats()
    } catch (error) {
      console.error(`Failed to execute ${action}:`, error)
    } finally {
      setActionInProgress(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-[13px]">Loading...</span>
        </div>
      </div>
    )
  }

  const totalProfiles = profiles.length
  const excludedCount = profiles.filter((p) => p.isExcluded).length

  return (
    <div className="animate-fade-in flex gap-8">
      {/* Sidebar */}
      <div className="w-44 flex-shrink-0">
        <nav className="space-y-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                activeSection === section.id
                  ? 'isDanger' in section && section.isDanger
                    ? 'bg-destructive text-white'
                    : 'bg-accent text-white'
                  : 'isDanger' in section && section.isDanger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Configure Lookout preferences</p>
          </div>
          {activeSection !== 'contributors' && activeSection !== 'shortcuts' && activeSection !== 'about' && activeSection !== 'github' && (
            <Button onClick={handleSave} disabled={saving}>
              {saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </>
              )}
            </Button>
          )}
        </div>

        {/* General Section */}
        {activeSection === 'general' && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle">
                  <Monitor className="h-4 w-4 text-accent" />
                </div>
                <h2 className="text-[15px] font-semibold">System Integration</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium">Launch at Login</p>
                    <p className="text-[12px] text-muted-foreground">
                      Start Lookout automatically when you log in
                    </p>
                  </div>
                  <Toggle checked={autoLaunch} onChange={setAutoLaunch} />
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-[12px] text-muted-foreground">
                  Lookout runs in your menu bar. Close the window to minimize to tray, or use{' '}
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">Cmd+Q</kbd> to quit.
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-subtle">
                  <Clock className="h-4 w-4 text-success" />
                </div>
                <h2 className="text-[15px] font-semibold">Scheduled Generation</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium">Enable Daily Generation</p>
                    <p className="text-[12px] text-muted-foreground">
                      Automatically generate a summary each day
                    </p>
                  </div>
                  <Toggle
                    checked={settings.scheduled_enabled === 'true'}
                    onChange={(checked) =>
                      setSettings({ ...settings, scheduled_enabled: checked ? 'true' : 'false' })
                    }
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium">Time</label>
                    <input
                      type="time"
                      value={settings.scheduled_time}
                      onChange={(e) => setSettings({ ...settings, scheduled_time: e.target.value })}
                      disabled={settings.scheduled_enabled !== 'true'}
                      className="rounded-lg border border-input-border bg-input px-3 py-1.5 text-[13px] disabled:opacity-50"
                    />
                  </div>
                  {settings.scheduled_enabled === 'true' && (
                    <p className="mt-5 text-[12px] text-muted-foreground">
                      Summary generated daily at {settings.scheduled_time}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* GitHub Section */}
        {activeSection === 'github' && (
          <div className="space-y-5">
            {/* Connection status */}
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#24292f]">
                  <Github className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold">GitHub Integration</h2>
                  <p className="text-[12px] text-muted-foreground">
                    Connect to GitHub for PRs, reviews, and issue tracking
                  </p>
                </div>
                {githubUser && (
                  <div className="flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-[12px] font-medium text-success">Connected</span>
                  </div>
                )}
              </div>

              {githubLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : githubUser ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background-secondary p-3">
                    <img
                      src={`${githubUser.avatarUrl}${githubUser.avatarUrl.includes('?') ? '&' : '?'}s=80`}
                      alt={githubUser.login}
                      className="h-10 w-10 min-w-[40px] flex-shrink-0 rounded-full border border-border bg-muted object-cover"
                      onError={(e) => {
                        // Fallback to default avatar on error
                        e.currentTarget.src = `https://github.com/${githubUser.login}.png?size=80`
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-[13px] font-medium">
                        {githubUser.name || githubUser.login}
                      </p>
                      <p className="text-[12px] text-muted-foreground">@{githubUser.login}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleGitHubDisconnect}>
                      <Unlink className="mr-1.5 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/40 p-3 text-[12px] text-muted-foreground">
                    <p className="mb-2">
                      Create a{' '}
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:user"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline hover:no-underline"
                      >
                        Personal Access Token
                      </a>{' '}
                      with <code className="rounded bg-muted px-1">repo</code> and{' '}
                      <code className="rounded bg-muted px-1">read:user</code> scopes.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="flex-1 rounded-lg border border-input-border bg-input px-3 py-2 font-mono text-[13px] placeholder:text-muted-foreground/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGitHubConnect()
                      }}
                    />
                    <Button onClick={handleGitHubConnect} disabled={!githubToken.trim() || githubConnecting}>
                      {githubConnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link className="mr-2 h-4 w-4" />
                      )}
                      Connect
                    </Button>
                  </div>

                  {githubError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive-subtle p-3 text-[12px] text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {githubError}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Repository sync */}
            {githubUser && (
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold">Repository Sync</h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Sync PRs, reviews, and issues from your GitHub repositories
                    </p>
                  </div>
                  {githubRepos.filter((r) => r.owner).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncAll}
                      disabled={syncAllLoading}
                    >
                      {syncAllLoading ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Sync All
                    </Button>
                  )}
                </div>

                {githubRepos.length === 0 ? (
                  <div className="rounded-lg bg-muted/40 p-6 text-center">
                    <Github className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-[13px] font-medium">No GitHub repositories found</p>
                    <p className="text-[12px] text-muted-foreground">
                      Add repositories with GitHub remotes to sync data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {githubRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Github className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{repo.name}</p>
                          {repo.owner && repo.repo ? (
                            <p className="text-[12px] text-muted-foreground">
                              {repo.owner}/{repo.repo}
                            </p>
                          ) : (
                            <p className="text-[12px] text-muted-foreground/50 italic">
                              Not linked to GitHub
                            </p>
                          )}
                        </div>
                        {repo.owner && repo.repo && (
                          <>
                            <div className="text-[11px] text-muted-foreground">
                              {repo.lastSync ? (
                                <span>
                                  Last sync:{' '}
                                  {new Date(repo.lastSync.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              ) : (
                                <span className="text-amber-500">Never synced</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncRepo(repo.id)}
                              disabled={syncingRepoId === repo.id}
                            >
                              {syncingRepoId === repo.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Features overview */}
            <Card className="p-5">
              <h2 className="mb-4 text-[15px] font-semibold">What you get with GitHub</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background-secondary p-4">
                  <GitPullRequest className="mb-2 h-5 w-5 text-accent" />
                  <p className="text-[13px] font-medium">Pull Requests</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Track merged PRs, reviews given and received
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background-secondary p-4">
                  <MessageSquare className="mb-2 h-5 w-5 text-success" />
                  <p className="text-[13px] font-medium">Code Reviews</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    See review comments and collaboration patterns
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background-secondary p-4">
                  <CircleDot className="mb-2 h-5 w-5 text-purple-500" />
                  <p className="text-[13px] font-medium">Issues</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Track issues opened and resolved
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Templates Section */}
        {activeSection === 'templates' && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <h2 className="text-[15px] font-semibold">Default Template</h2>
              </div>
              <p className="mb-4 text-[12px] text-muted-foreground">
                Choose the default style for generated summaries
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'technical', label: 'Technical', desc: 'Detailed, code-focused' },
                  { value: 'manager-friendly', label: 'Manager-Friendly', desc: 'High-level, business-oriented' },
                  { value: 'casual-standup', label: 'Casual', desc: 'Brief, conversational' }
                ].map((template) => (
                  <button
                    key={template.value}
                    onClick={() => setSettings({ ...settings, default_prompt_template: template.value })}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      settings.default_prompt_template === template.value
                        ? 'border-accent bg-accent-subtle shadow-subtle'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <p className="text-[13px] font-medium">{template.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{template.desc}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 text-[15px] font-semibold">Default Date Range</h2>
              <p className="mb-4 text-[12px] text-muted-foreground">
                Pre-selected range when generating summaries
              </p>
              <div className="segmented-control">
                {[
                  { value: 'previous_day', label: 'Yesterday' },
                  { value: 'previous_week', label: 'Last 7 Days' },
                  { value: 'previous_month', label: 'Last 30 Days' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings({ ...settings, date_range_default: option.value })}
                    className={`segmented-control-item ${settings.date_range_default === option.value ? 'segmented-control-item-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Contributors Section */}
        {activeSection === 'contributors' && (
          <div className="space-y-5">
            <div className="flex gap-4 text-[12px]">
              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                <UserCog className="h-3.5 w-3.5 text-accent" />
                {totalProfiles} profiles
              </span>
              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                <Users className="h-3.5 w-3.5" />
                {unaliasedContributors.length} unaliased
              </span>
              {excludedCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-md bg-destructive-subtle px-2 py-1 text-destructive">
                  <EyeOff className="h-3.5 w-3.5" />
                  {excludedCount} excluded
                </span>
              )}
            </div>

            {contributorsLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-[13px]">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                {profiles.length > 0 && (
                  <Card className="p-5">
                    <h2 className="mb-4 text-[15px] font-semibold">Contributor Profiles</h2>
                    <div className="space-y-2.5">
                      {[...profiles]
                        .sort((a, b) => {
                          if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1
                          return a.displayName.localeCompare(b.displayName)
                        })
                        .map((profile) => (
                          <div
                            key={profile.id}
                            className={`rounded-xl border p-4 transition-all ${
                              profile.isExcluded
                                ? 'border-destructive/20 bg-destructive-subtle/50 opacity-60'
                                : 'border-border/60'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {editingProfileId === profile.id ? (
                                  <div className="mb-2 flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="rounded-lg border border-input-border bg-input px-2 py-1 text-[13px]"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit()
                                        if (e.key === 'Escape') handleCancelEdit()
                                      }}
                                    />
                                    <button onClick={handleSaveEdit} className="rounded p-1 hover:bg-muted">
                                      <Check className="h-4 w-4 text-success" />
                                    </button>
                                    <button onClick={handleCancelEdit} className="rounded p-1 hover:bg-muted">
                                      <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className={`text-[13px] font-medium ${profile.isExcluded ? 'line-through' : ''}`}>
                                      {profile.displayName}
                                    </span>
                                    <button
                                      onClick={() => handleStartEdit(profile)}
                                      className="rounded p-0.5 opacity-50 hover:bg-muted hover:opacity-100"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {profile.emails.map((email) => (
                                    <span
                                      key={email.email}
                                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                                    >
                                      {email.email}
                                      {profile.emails.length > 1 && (
                                        <button
                                          onClick={() => handleRemoveEmailFromProfile(email.email)}
                                          className="ml-0.5 rounded-full p-0.5 hover:bg-card"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleExclusion(profile)}
                                  className={`rounded-lg p-2 transition-colors ${
                                    profile.isExcluded
                                      ? 'bg-success-subtle text-success hover:bg-success-subtle/80'
                                      : 'bg-destructive-subtle text-destructive hover:bg-destructive-subtle/80'
                                  }`}
                                  title={profile.isExcluded ? 'Include' : 'Exclude'}
                                >
                                  {profile.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  className="rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                )}

                {unaliasedContributors.length > 0 && (
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-[15px] font-semibold">Unaliased Contributors</h2>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Select multiple to merge into one profile
                        </p>
                      </div>
                      {selectedForMerge.size >= 2 && (
                        <Button onClick={handleStartMerge} size="sm">
                          <Merge className="mr-1.5 h-3.5 w-3.5" />
                          Merge ({selectedForMerge.size})
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {unaliasedContributors.map((contributor) => {
                        const isSelected = selectedForMerge.has(contributor.email.toLowerCase())
                        return (
                          <div
                            key={contributor.email}
                            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                              isSelected ? 'border-accent bg-accent-subtle' : 'border-border/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(contributor.email.toLowerCase())}
                                className="h-4 w-4 rounded border-input-border accent-accent"
                              />
                              <div>
                                <p className="text-[13px] font-medium">{contributor.name}</p>
                                <p className="text-[12px] text-muted-foreground">{contributor.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[12px] text-muted-foreground">
                                {contributor.commitCount} commits
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartCreateAlias(contributor)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Alias
                              </Button>
                              <button
                                onClick={() => handleQuickExclude(contributor)}
                                className="rounded-lg bg-destructive-subtle p-2 text-destructive hover:bg-destructive-subtle/80"
                              >
                                <EyeOff className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}

                {profiles.length === 0 && unaliasedContributors.length === 0 && (
                  <Card className="p-5">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="mt-3 text-[13px] font-medium">No contributors found</p>
                      <p className="text-[12px] text-muted-foreground">
                        Import repositories to see contributors
                      </p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Shortcuts Section */}
        {activeSection === 'shortcuts' && (
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="text-[15px] font-semibold">Keyboard Shortcuts</h2>
            </div>
            <div className="space-y-2">
              {[
                { action: 'Generate Summary', keys: 'Cmd+G' },
                { action: 'Dashboard', keys: 'Cmd+1' },
                { action: 'My Work', keys: 'Cmd+2' },
                { action: 'Settings', keys: 'Cmd+,' }
              ].map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5"
                >
                  <span className="text-[13px]">{shortcut.action}</span>
                  <kbd className="rounded bg-card px-2 py-1 font-mono text-[11px] shadow-subtle">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* About Section */}
        {activeSection === 'about' && (
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="text-[15px] font-semibold">About Lookout</h2>
            </div>
            <div className="space-y-2 text-[13px]">
              <p>
                <span className="text-muted-foreground">Version:</span>{' '}
                <span className="font-medium">1.0.0</span>
              </p>
              <p className="text-muted-foreground">
                Lookout generates AI-powered summaries of your Git commits using Claude.
              </p>
              <p className="pt-2 text-[12px] text-muted-foreground">
                Made with Claude by Anthropic
              </p>
            </div>
          </Card>
        )}

        {/* Danger Zone Section */}
        {activeSection === 'dangerzone' && (
          <div className="space-y-5">
            {/* Warning Banner */}
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-[13px] font-medium text-destructive">Proceed with caution</p>
                <p className="text-[12px] text-muted-foreground">
                  Actions in this section are destructive and cannot be undone.
                </p>
              </div>
            </div>

            {/* Stats Overview */}
            {dangerZoneLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dangerZoneStats && (
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h2 className="text-[15px] font-semibold">Current Data</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.summaries}</p>
                    <p className="text-[11px] text-muted-foreground">Summaries</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.commits}</p>
                    <p className="text-[11px] text-muted-foreground">Synced Commits</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.pullRequests}</p>
                    <p className="text-[11px] text-muted-foreground">Pull Requests</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.reviews}</p>
                    <p className="text-[11px] text-muted-foreground">Reviews</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.repositories}</p>
                    <p className="text-[11px] text-muted-foreground">Repositories</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-[20px] font-semibold">{dangerZoneStats.contributorProfiles}</p>
                    <p className="text-[11px] text-muted-foreground">Contributors</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Danger Actions */}
            <div className="space-y-3">
              {/* Clear Summaries */}
              <div className="rounded-xl border border-destructive/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                      <FileText className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Clear All Summaries</p>
                      <p className="text-[12px] text-muted-foreground">
                        Delete all generated summaries ({dangerZoneStats?.summaries || 0} total)
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => setDangerZoneAction('clear-summaries')}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Clear Commits */}
              <div className="rounded-xl border border-destructive/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                      <GitPullRequest className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Clear Synced Commits</p>
                      <p className="text-[12px] text-muted-foreground">
                        Remove cached commit data ({dangerZoneStats?.commits || 0} commits)
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => setDangerZoneAction('clear-commits')}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Clear GitHub Data */}
              <div className="rounded-xl border border-destructive/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                      <Github className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Clear GitHub Data</p>
                      <p className="text-[12px] text-muted-foreground">
                        Remove all GitHub PRs, reviews, and disconnect your account
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => setDangerZoneAction('clear-github')}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Reset Settings */}
              <div className="rounded-xl border border-destructive/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                      <RotateCcw className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Reset Settings</p>
                      <p className="text-[12px] text-muted-foreground">
                        Restore all settings to their default values
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => setDangerZoneAction('reset-settings')}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Reset Database - Most destructive */}
              <div className="rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/20">
                      <Database className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-destructive">Reset Everything</p>
                      <p className="text-[12px] text-muted-foreground">
                        Delete database and start fresh. App will restart.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => setDangerZoneAction('reset-database')}
                  >
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    Reset All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated">
            <h3 className="text-[17px] font-semibold">Merge Contributors</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Merging {selectedForMerge.size} contributors into one profile
            </p>
            <input
              type="text"
              value={mergeDisplayName}
              onChange={(e) => setMergeDisplayName(e.target.value)}
              placeholder="Display name"
              className="mt-4 w-full rounded-lg border border-input-border bg-input px-3 py-2 text-[13px]"
              autoFocus
            />
            <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-muted/50 p-3">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Emails to merge:</p>
              {Array.from(selectedForMerge).map((email) => (
                <div key={email} className="text-[12px]">{email}</div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMergeModal(false)
                  setMergeDisplayName('')
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmMerge} disabled={!mergeDisplayName.trim()}>
                <Merge className="mr-2 h-4 w-4" />
                Merge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Alias Modal */}
      {showCreateAliasModal && createAliasTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated">
            <h3 className="text-[17px] font-semibold">Create Alias</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Set a display name for <span className="font-medium">{createAliasTarget.email}</span>
            </p>
            <input
              type="text"
              value={createAliasName}
              onChange={(e) => setCreateAliasName(e.target.value)}
              placeholder="Display name"
              className="mt-4 w-full rounded-lg border border-input-border bg-input px-3 py-2 text-[13px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateAlias()
                if (e.key === 'Escape') {
                  setShowCreateAliasModal(false)
                  setCreateAliasTarget(null)
                  setCreateAliasName('')
                }
              }}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateAliasModal(false)
                  setCreateAliasTarget(null)
                  setCreateAliasName('')
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmCreateAlias} disabled={!createAliasName.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Confirmation Modal */}
      {dangerZoneAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-destructive">
                  {dangerZoneAction === 'clear-summaries' && 'Clear All Summaries?'}
                  {dangerZoneAction === 'clear-commits' && 'Clear Synced Commits?'}
                  {dangerZoneAction === 'clear-github' && 'Clear GitHub Data?'}
                  {dangerZoneAction === 'reset-settings' && 'Reset Settings?'}
                  {dangerZoneAction === 'reset-database' && 'Reset Everything?'}
                </h3>
                <p className="text-[13px] text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-[12px] text-destructive">
              {dangerZoneAction === 'clear-summaries' && (
                <p>This will permanently delete all {dangerZoneStats?.summaries || 0} generated summaries.</p>
              )}
              {dangerZoneAction === 'clear-commits' && (
                <p>This will remove {dangerZoneStats?.commits || 0} cached commits. They will be re-synced when needed.</p>
              )}
              {dangerZoneAction === 'clear-github' && (
                <p>This will delete all GitHub PRs, reviews, issues, and disconnect your GitHub account.</p>
              )}
              {dangerZoneAction === 'reset-settings' && (
                <p>This will reset all preferences to their default values. Your data will remain intact.</p>
              )}
              {dangerZoneAction === 'reset-database' && (
                <p>This will delete ALL data including summaries, repositories, settings, and GitHub data. The app will restart.</p>
              )}
            </div>

            {/* Type to confirm for database reset */}
            {dangerZoneAction === 'reset-database' && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] text-muted-foreground">
                  Type <span className="font-mono font-medium text-destructive">RESET</span> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESET"
                  className="w-full rounded-lg border border-destructive/30 bg-input px-3 py-2 font-mono text-[13px] placeholder:text-muted-foreground/50"
                  autoFocus
                />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDangerZoneAction(null)
                  setConfirmText('')
                }}
                disabled={actionInProgress}
              >
                Cancel
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => handleDangerAction(dangerZoneAction)}
                disabled={
                  actionInProgress ||
                  (dangerZoneAction === 'reset-database' && confirmText !== 'RESET')
                }
              >
                {actionInProgress ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                {actionInProgress ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
