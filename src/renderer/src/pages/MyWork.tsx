import { useState, useEffect, useCallback } from 'react'
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SummaryDisplay from '../components/SummaryDisplay'
import { Calendar, Sparkles, Copy, Download, AlertCircle, Check, Loader2 } from 'lucide-react'

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

  // Check Claude installation and get git user on mount
  useEffect(() => {
    window.api.summaries.checkClaude().then(setClaudeInstalled)
    window.api.git.getUser().then(setGitUser)
  }, [])

  // Set up event listeners for generation progress
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

  // Listen for trigger-generate from tray/shortcuts
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Work</h1>
          <p className="text-sm text-muted-foreground">
            Generate AI-powered summaries of your commits
            {gitUser && (
              <span className="ml-2 text-xs">
                ({gitUser.name} &lt;{gitUser.email}&gt;)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Claude not installed warning */}
      {claudeInstalled === false && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Claude Code not installed</p>
            <p className="text-xs">
              Lookout requires Claude Code to generate summaries. Please install it first.
            </p>
          </div>
        </div>
      )}

      {/* Generation Controls */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Time Range</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateRange === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('yesterday')}
                disabled={generating}
              >
                Yesterday
              </Button>
              <Button
                variant={dateRange === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('week')}
                disabled={generating}
              >
                Last 7 Days
              </Button>
              <Button
                variant={dateRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('month')}
                disabled={generating}
              >
                Last 30 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={generating}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Custom
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {(() => {
                const range = getDateRange(dateRange)
                return `${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`
              })()}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Template</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={template === 'technical' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTemplate('technical')}
                disabled={generating}
              >
                Technical
              </Button>
              <Button
                variant={template === 'manager-friendly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTemplate('manager-friendly')}
                disabled={generating}
              >
                Manager-Friendly
              </Button>
              <Button
                variant={template === 'casual-standup' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTemplate('casual-standup')}
                disabled={generating}
              >
                Casual Standup
              </Button>
            </div>
          </div>

          <div className="pt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{progress.message}</span>
              {progress.progress !== undefined && (
                <span className="text-muted-foreground">{Math.round(progress.progress)}%</span>
              )}
            </div>
            {progress.progress !== undefined && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Area */}
      {displayContent ? (
        <Card className="p-6">
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="text-sm text-muted-foreground">
                {generating ? 'Generating your summary...' : (
                  summary ? (
                    <>
                      Summary for{' '}
                      <span className="font-medium text-foreground">
                        {summary.date_from === summary.date_to
                          ? format(new Date(summary.date_from), 'MMM d, yyyy')
                          : `${format(new Date(summary.date_from), 'MMM d')} - ${format(new Date(summary.date_to), 'MMM d, yyyy')}`
                        }
                      </span>
                    </>
                  ) : 'Your work summary'
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Styled summary display */}
            <SummaryDisplay content={displayContent} isStreaming={generating} />

            {/* Stats footer */}
            {summary && (
              <div className="mt-6 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>{summary.commit_count} commits analyzed</span>
                {summary.merge_count > 0 && <span>{summary.merge_count} merges</span>}
                <span>Generated {format(new Date(summary.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Your generated summary will appear here
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
