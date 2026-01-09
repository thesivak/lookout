import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SummaryDisplay from '../components/SummaryDisplay'
import { Calendar, Sparkles, Copy, Download, AlertCircle, Check } from 'lucide-react'
import { getQuickActionConfig } from '../components/QuickActions'

type DateRange = 'yesterday' | 'week' | 'month' | 'custom'
type Template = 'technical' | 'manager-friendly' | 'casual-standup'

interface DateRangeValue {
  from: Date
  to: Date
}

function getDateRange(range: DateRange): DateRangeValue {
  const now = new Date()
  switch (range) {
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    case 'week':
      return { from: startOfDay(subWeeks(now, 1)), to: endOfDay(subDays(now, 1)) }
    case 'month':
      return { from: startOfDay(subMonths(now, 1)), to: endOfDay(subDays(now, 1)) }
    case 'custom':
      return { from: startOfDay(subWeeks(now, 1)), to: endOfDay(now) }
  }
}

// macOS-style segmented control
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={`segmented-control-item ${value === option.value ? 'segmented-control-item-active' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function MyWork(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [template, setTemplate] = useState<Template>('technical')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ message: string; progress?: number } | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claudeInstalled, setClaudeInstalled] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [gitUser, setGitUser] = useState<GitUser | null>(null)
  const quickActionProcessed = useRef(false)

  useEffect(() => {
    window.api.summaries.checkClaude().then(setClaudeInstalled)
    window.api.git.getUser().then(setGitUser)
  }, [])

  // Check for quick action config and auto-generate
  useEffect(() => {
    if (quickActionProcessed.current) return

    const config = getQuickActionConfig()
    if (config && config.type === 'personal' && config.autoGenerate) {
      quickActionProcessed.current = true

      // Map quick action date range to our DateRange type
      const dateRangeMap: Record<string, DateRange> = {
        yesterday: 'yesterday',
        today: 'yesterday', // fallback
        week: 'week',
        last_week: 'week'
      }
      const mappedDateRange = dateRangeMap[config.dateRange] || 'week'

      // Map template
      const templateMap: Record<string, Template> = {
        technical: 'technical',
        'manager-friendly': 'manager-friendly',
        'casual-standup': 'casual-standup'
      }
      const mappedTemplate = templateMap[config.template] || 'technical'

      // Set the config and trigger generation after a short delay
      setDateRange(mappedDateRange)
      setTemplate(mappedTemplate)

      // Trigger generation after state updates
      setTimeout(() => {
        const range = getDateRange(mappedDateRange)
        setGenerating(true)
        setError(null)
        setSummary(null)
        setStreamingContent('')
        setProgress({ message: 'Starting generation...' })

        window.api.summaries.generate({
          type: 'personal',
          dateFrom: range.from.toISOString(),
          dateTo: range.to.toISOString(),
          template: mappedTemplate,
          authorEmail: undefined // gitUser might not be loaded yet
        })
      }, 100)
    }
  }, [])

  useEffect(() => {
    const unsubProgress = window.api.summaries.onProgress((data) => {
      setProgress(data)
    })

    const unsubText = window.api.summaries.onText((text) => {
      setStreamingContent((prev) => prev + text)
    })

    const unsubComplete = window.api.summaries.onComplete((sum) => {
      setGenerating(false)
      setProgress(null)
      setSummary(sum)
      setStreamingContent('')
    })

    const unsubError = window.api.summaries.onError((err) => {
      setGenerating(false)
      setProgress(null)
      setError(err)
    })

    return () => {
      unsubProgress()
      unsubText()
      unsubComplete()
      unsubError()
    }
  }, [])

  const handleGenerate = useCallback(() => {
    if (generating) return

    const range = getDateRange(dateRange)
    setGenerating(true)
    setError(null)
    setSummary(null)
    setStreamingContent('')
    setProgress({ message: 'Starting generation...' })

    window.api.summaries.generate({
      type: 'personal',
      dateFrom: range.from.toISOString(),
      dateTo: range.to.toISOString(),
      template,
      authorEmail: gitUser?.email || undefined
    })
  }, [dateRange, template, gitUser, generating])

  useEffect(() => {
    const unsubTrigger = window.api.app.onTriggerGenerate(() => {
      handleGenerate()
    })

    const unsubScheduled = window.api.app.onScheduledGeneration(() => {
      handleGenerate()
    })

    return () => {
      unsubTrigger()
      unsubScheduled()
    }
  }, [handleGenerate])

  const handleCopy = useCallback(async () => {
    const content = summary?.content || streamingContent
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [summary, streamingContent])

  const handleExport = useCallback(() => {
    const content = summary?.content || streamingContent
    if (content) {
      const range = getDateRange(dateRange)
      const filename = `work-summary-${format(range.from, 'yyyy-MM-dd')}-to-${format(range.to, 'yyyy-MM-dd')}.md`
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [summary, streamingContent, dateRange])

  const displayContent = summary?.content || streamingContent

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">My Work</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Generate AI-powered summaries of your commits
          {gitUser && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">
              {gitUser.email}
            </span>
          )}
        </p>
      </div>

      {/* Claude not installed warning */}
      {claudeInstalled === false && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-subtle p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-[13px] font-medium text-destructive">Claude Code not installed</p>
            <p className="text-[12px] text-destructive/80">
              Lookout requires Claude Code to generate summaries.
            </p>
          </div>
        </div>
      )}

      {/* Generation Controls */}
      <Card className="p-5">
        <div className="space-y-5">
          <div>
            <label className="mb-2.5 block text-[13px] font-medium">Time Range</label>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                value={dateRange}
                onChange={setDateRange}
                disabled={generating}
                options={[
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'week', label: 'Last 7 Days' },
                  { value: 'month', label: 'Last 30 Days' }
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={generating}
                className="gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                Custom
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {(() => {
                const range = getDateRange(dateRange)
                return `${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`
              })()}
            </p>
          </div>

          <div className="border-t border-border/50 pt-5">
            <label className="mb-2.5 block text-[13px] font-medium">Template Style</label>
            <SegmentedControl
              value={template}
              onChange={setTemplate}
              disabled={generating}
              options={[
                { value: 'technical', label: 'Technical' },
                { value: 'manager-friendly', label: 'Manager-Friendly' },
                { value: 'casual-standup', label: 'Casual' }
              ]}
            />
          </div>

          <div className="border-t border-border/50 pt-5">
            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </span>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate My Summary
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress */}
      {generating && progress && (
        <Card className="p-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">{progress.message}</span>
              {progress.progress !== undefined && (
                <span className="font-medium">{Math.round(progress.progress)}%</span>
              )}
            </div>
            {progress.progress !== undefined && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-subtle p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <span className="text-[13px] text-destructive">{error}</span>
        </div>
      )}

      {/* Result Area */}
      {displayContent ? (
        <Card className="p-5">
          <div className="space-y-4">
            {/* Actions Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="text-[13px] text-muted-foreground">
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
                    Generating your summary...
                  </span>
                ) : summary ? (
                  <>
                    Summary for{' '}
                    <span className="font-medium text-foreground">
                      {summary.date_from === summary.date_to
                        ? format(new Date(summary.date_from), 'MMM d, yyyy')
                        : `${format(new Date(summary.date_from), 'MMM d')} - ${format(new Date(summary.date_to), 'MMM d, yyyy')}`}
                    </span>
                  </>
                ) : (
                  'Your work summary'
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
            </div>

            {/* Summary content */}
            <SummaryDisplay content={displayContent} isStreaming={generating} />

            {/* Stats footer */}
            {summary && (
              <div className="flex items-center gap-3 border-t border-border/50 pt-4 text-[12px] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1">{summary.commit_count} commits</span>
                {summary.merge_count > 0 && (
                  <span className="rounded-md bg-muted px-2 py-1">{summary.merge_count} merges</span>
                )}
                <span className="ml-auto">
                  {format(new Date(summary.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">
                Your generated summary will appear here
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">
                Select a time range and template above
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
