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
  Loader2,
  Trash2,
  EyeOff,
  Eye,
  Plus,
  X,
  Merge,
  Edit2
} from 'lucide-react'

interface SettingsData {
  scheduled_time: string
  scheduled_enabled: string
  default_prompt_template: string
  date_range_default: string
}

// Toggle switch component
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
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

type SettingsSection = 'general' | 'templates' | 'contributors' | 'shortcuts' | 'about'

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

  // Load contributors when that section is active
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
    { id: 'templates' as const, label: 'Templates', icon: FileText },
    { id: 'contributors' as const, label: 'Contributors', icon: Users },
    { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
    { id: 'about' as const, label: 'About', icon: Info }
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalProfiles = profiles.length
  const excludedCount = profiles.filter((p) => p.isExcluded).length

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0">
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure Lookout preferences</p>
          </div>
          {activeSection !== 'contributors' && activeSection !== 'shortcuts' && activeSection !== 'about' && (
            <Button onClick={handleSave} disabled={saving}>
              {saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
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
          <>
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-medium">System Integration</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Launch at Login</p>
                    <p className="text-sm text-muted-foreground">
                      Start Lookout automatically when you log in
                    </p>
                  </div>
                  <Toggle checked={autoLaunch} onChange={setAutoLaunch} />
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p>
                    Lookout runs in your menu bar. Close the window to minimize to tray, or use{' '}
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Cmd+Q</kbd> to quit
                    completely.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-success" />
                <h2 className="text-lg font-medium">Scheduled Generation</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Daily Generation</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate a summary each day
                    </p>
                  </div>
                  <Toggle
                    checked={settings.scheduled_enabled === 'true'}
                    onChange={(checked) =>
                      setSettings({
                        ...settings,
                        scheduled_enabled: checked ? 'true' : 'false'
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Generation Time</label>
                    <input
                      type="time"
                      value={settings.scheduled_time}
                      onChange={(e) => setSettings({ ...settings, scheduled_time: e.target.value })}
                      disabled={settings.scheduled_enabled !== 'true'}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    />
                  </div>
                  {settings.scheduled_enabled === 'true' && (
                    <p className="mt-6 text-sm text-muted-foreground">
                      A summary will be generated daily at {settings.scheduled_time}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Templates Section */}
        {activeSection === 'templates' && (
          <>
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-medium">Default Template</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Choose the default style for generated summaries
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'technical', label: 'Technical', desc: 'Detailed, code-focused summaries' },
                  { value: 'manager-friendly', label: 'Manager-Friendly', desc: 'High-level, business-oriented' },
                  { value: 'casual-standup', label: 'Casual Standup', desc: 'Brief, conversational tone' }
                ].map((template) => (
                  <button
                    key={template.value}
                    onClick={() => setSettings({ ...settings, default_prompt_template: template.value })}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      settings.default_prompt_template === template.value
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <p className="font-medium">{template.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{template.desc}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium">Default Date Range</h2>
                <p className="text-sm text-muted-foreground">
                  Pre-selected range when generating summaries
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'previous_day', label: 'Yesterday' },
                  { value: 'previous_week', label: 'Last 7 Days' },
                  { value: 'previous_month', label: 'Last 30 Days' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.date_range_default === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSettings({ ...settings, date_range_default: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Contributors Section */}
        {activeSection === 'contributors' && (
          <>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-accent" />
                <span>{totalProfiles} profiles</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{unaliasedContributors.length} unaliased</span>
              </div>
              {excludedCount > 0 && (
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-destructive" />
                  <span>{excludedCount} excluded</span>
                </div>
              )}
            </div>

            {contributorsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {profiles.length > 0 && (
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-medium">Contributor Profiles</h2>
                    <div className="space-y-3">
                      {[...profiles]
                        .sort((a, b) => {
                          if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1
                          return a.displayName.localeCompare(b.displayName)
                        })
                        .map((profile) => (
                          <div
                            key={profile.id}
                            className={`rounded-lg border p-4 transition-colors ${
                              profile.isExcluded
                                ? 'border-destructive/30 bg-destructive/5 opacity-60'
                                : 'border-border'
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
                                      className="rounded border border-input bg-background px-2 py-1 text-sm"
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
                                    <span className={`font-medium ${profile.isExcluded ? 'line-through' : ''}`}>
                                      {profile.displayName}
                                    </span>
                                    <button
                                      onClick={() => handleStartEdit(profile)}
                                      className="rounded p-1 opacity-50 hover:bg-muted hover:opacity-100"
                                      title="Edit name"
                                    >
                                      <Edit2 className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {profile.emails.map((email) => (
                                    <div
                                      key={email.email}
                                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                                    >
                                      <span>{email.email}</span>
                                      {profile.emails.length > 1 && (
                                        <button
                                          onClick={() => handleRemoveEmailFromProfile(email.email)}
                                          className="ml-1 rounded-full p-0.5 hover:bg-background"
                                          title="Remove email from profile"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleExclusion(profile)}
                                  className={`rounded-lg p-2 transition-colors ${
                                    profile.isExcluded
                                      ? 'bg-success/10 text-success hover:bg-success/20'
                                      : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                  }`}
                                  title={profile.isExcluded ? 'Include in summaries' : 'Exclude from summaries'}
                                >
                                  {profile.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  className="rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  title="Delete profile"
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
                  <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-medium">Unaliased Contributors</h2>
                        <p className="text-sm text-muted-foreground">
                          Contributors without a profile. Select multiple to merge.
                        </p>
                      </div>
                      {selectedForMerge.size >= 2 && (
                        <Button onClick={handleStartMerge}>
                          <Merge className="mr-2 h-4 w-4" />
                          Merge Selected ({selectedForMerge.size})
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {unaliasedContributors.map((contributor) => {
                        const isSelected = selectedForMerge.has(contributor.email.toLowerCase())
                        return (
                          <div
                            key={contributor.email}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                              isSelected ? 'border-accent bg-accent/5' : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(contributor.email.toLowerCase())}
                                className="h-4 w-4 rounded border-input"
                              />
                              <div>
                                <p className="font-medium">{contributor.name}</p>
                                <p className="text-sm text-muted-foreground">{contributor.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {contributor.commitCount} commits
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartCreateAlias(contributor)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Create Alias
                              </Button>
                              <button
                                onClick={() => handleQuickExclude(contributor)}
                                className="rounded-lg bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/20"
                                title="Exclude from summaries"
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
                  <Card className="p-6">
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="font-medium">No contributors found</p>
                      <p className="text-sm text-muted-foreground">
                        Import repositories to see contributors
                      </p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {/* Shortcuts Section */}
        {activeSection === 'shortcuts' && (
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span>Generate Summary</span>
                <kbd className="rounded bg-muted px-2 py-1 text-xs">Cmd+G</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span>Dashboard</span>
                <kbd className="rounded bg-muted px-2 py-1 text-xs">Cmd+1</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span>My Work</span>
                <kbd className="rounded bg-muted px-2 py-1 text-xs">Cmd+2</kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span>Settings</span>
                <kbd className="rounded bg-muted px-2 py-1 text-xs">Cmd+,</kbd>
              </div>
            </div>
          </Card>
        )}

        {/* About Section */}
        {activeSection === 'about' && (
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium">About Lookout</h2>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground">Version:</span> 1.0.0
              </p>
              <p>
                Lookout generates AI-powered summaries of your Git commits using Claude Code.
              </p>
              <p className="pt-2">
                Made with Claude by Anthropic
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-medium">Merge Contributors</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Merging {selectedForMerge.size} contributors into one profile. Choose a display name:
            </p>
            <input
              type="text"
              value={mergeDisplayName}
              onChange={(e) => setMergeDisplayName(e.target.value)}
              placeholder="Display name"
              className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2"
              autoFocus
            />
            <div className="mb-4 max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Emails to merge:</p>
              {Array.from(selectedForMerge).map((email) => (
                <div key={email} className="text-sm">{email}</div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-medium">Create Alias</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Set a display name for <span className="font-medium">{createAliasTarget.email}</span>
            </p>
            <input
              type="text"
              value={createAliasName}
              onChange={(e) => setCreateAliasName(e.target.value)}
              placeholder="Display name"
              className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2"
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
            <div className="flex justify-end gap-2">
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
    </div>
  )
}
