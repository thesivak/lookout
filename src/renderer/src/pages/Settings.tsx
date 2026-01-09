import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import {
  Clock,
  FileText,
  Save,
  Power,
  Monitor,
  Check,
  Info,
  Keyboard
} from 'lucide-react'

interface Settings {
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

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<Settings>({
    scheduled_time: '09:00',
    scheduled_enabled: 'false',
    default_prompt_template: 'technical',
    date_range_default: 'previous_day'
  })
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure Lookout preferences</p>
        </div>
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
      </div>

      {/* System Integration */}
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

      {/* Scheduled Generation */}
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

      {/* Default Template */}
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
            {
              value: 'technical',
              label: 'Technical',
              desc: 'Detailed, code-focused summaries'
            },
            {
              value: 'manager-friendly',
              label: 'Manager-Friendly',
              desc: 'High-level, business-oriented'
            },
            {
              value: 'casual-standup',
              label: 'Casual Standup',
              desc: 'Brief, conversational tone'
            }
          ].map((template) => (
            <button
              key={template.value}
              onClick={() =>
                setSettings({ ...settings, default_prompt_template: template.value })
              }
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

      {/* Default Date Range */}
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

      {/* Keyboard Shortcuts */}
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

      {/* About */}
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
    </div>
  )
}
