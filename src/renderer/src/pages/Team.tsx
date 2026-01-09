import { useState, useEffect, useCallback } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SummaryDisplay from '../components/SummaryDisplay'
import { Users, RefreshCw, Sparkles, User, AlertCircle, Copy, Download, Check } from 'lucide-react'

type DateRange = 'yesterday' | 'week' | 'month'

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date()
  switch (range) {
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    case 'week':
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) }
    case 'month':
      return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) }
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

export default function Team(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; errors: string[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ message: string; progress?: number } | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [teamMembers, setTeamMembers] = useState<Array<{
    id: number
    displayName: string
    emails: string[]
    commitCount: number
  }>>([])

  const loadTeamMembers = useCallback(async () => {
    try {
      setLoading(true)
      const range = getDateRange(dateRange)

      const [profiles, authorData] = await Promise.all([
        window.api.contributors.listProfiles(),
        window.api.git.getAllAuthors(
          range.from.toISOString(),
          range.to.toISOString()
        )
      ])

      const commitsByEmail = new Map<string, number>()
      authorData.forEach(author => {
        commitsByEmail.set(author.email.toLowerCase(), author.commitCount)
      })

      const members = profiles
        .filter(profile => !profile.isExcluded)
        .map(profile => {
          const emails = profile.emails.map(e => e.email)
          const commitCount = emails.reduce((sum, email) => {
            return sum + (commitsByEmail.get(email.toLowerCase()) || 0)
          }, 0)

          return {
            id: profile.id,
            displayName: profile.displayName,
            emails,
            commitCount
          }
        })
        .filter(member => member.commitCount > 0)
        .sort((a, b) => b.commitCount - a.commitCount)

      setTeamMembers(members)
    } catch (error) {
      console.error('Failed to load team members:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadTeamMembers()
  }, [loadTeamMembers])

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

  const handleGenerateTeamSummary = useCallback(() => {
    if (generating) return

    const range = getDateRange(dateRange)
    setGenerating(true)
    setError(null)
    setSummary(null)
    setStreamingContent('')
    setProgress({ message: 'Starting team summary generation...' })

    window.api.summaries.generate({
      type: 'team',
      dateFrom: range.from.toISOString(),
      dateTo: range.to.toISOString(),
      template: 'technical'
    })
  }, [dateRange, generating])

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
      const filename = `team-summary-${format(range.from, 'yyyy-MM-dd')}-to-${format(range.to, 'yyyy-MM-dd')}.md`
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [summary, streamingContent, dateRange])

  const handleFetchAll = async () => {
    try {
      setFetching(true)
      setFetchResult(null)
      const result = await window.api.git.fetchAll()
      setFetchResult(result)
      await loadTeamMembers()
    } catch (error) {
      setFetchResult({ success: false, errors: [String(error)] })
    } finally {
      setFetching(false)
    }
  }

  const totalCommits = teamMembers.reduce((sum, m) => sum + m.commitCount, 0)
  const displayContent = summary?.content || streamingContent

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Team</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            View work summaries for your team members
          </p>
        </div>
        <Button variant="secondary" onClick={handleFetchAll} disabled={fetching}>
          {fetching ? (
            <>
              <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Latest
            </>
          )}
        </Button>
      </div>

      {/* Fetch Result */}
      {fetchResult && (
        <div
          className={`rounded-xl border p-3 text-[13px] ${
            fetchResult.success
              ? 'border-success/30 bg-success-subtle text-success'
              : 'border-destructive/30 bg-destructive-subtle text-destructive'
          }`}
        >
          {fetchResult.success
            ? 'Successfully fetched latest changes from all repositories'
            : `Fetch completed with errors: ${fetchResult.errors.join(', ')}`}
        </div>
      )}

      {/* Date Range */}
      <div className="flex items-center gap-4">
        <span className="text-[13px] font-medium">Time Range</span>
        <SegmentedControl
          value={dateRange}
          onChange={setDateRange}
          options={[
            { value: 'yesterday', label: 'Yesterday' },
            { value: 'week', label: 'Last 7 Days' },
            { value: 'month', label: 'Last 30 Days' }
          ]}
        />
      </div>

      {/* Team Members */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Team Members</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} with {totalCommits} total commits
            </p>
          </div>
          <Button onClick={handleGenerateTeamSummary} disabled={generating || teamMembers.length === 0}>
            {generating ? (
              <>
                <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Team Summary
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-[13px]">Loading...</span>
            </div>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium">No team members configured</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Go to Settings to add contributor profiles
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:border-border hover:shadow-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-accent">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{member.displayName}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {member.emails[0]}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[17px] font-semibold tabular-nums">{member.commitCount}</p>
                  <p className="text-[11px] text-muted-foreground">commits</p>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Team Summary Result */}
      {displayContent && (
        <Card className="p-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="text-[13px] text-muted-foreground">
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
                    Generating team summary...
                  </span>
                ) : summary ? (
                  <>
                    Team summary for{' '}
                    <span className="font-medium text-foreground">
                      {summary.date_from === summary.date_to
                        ? format(new Date(summary.date_from), 'MMM d, yyyy')
                        : `${format(new Date(summary.date_from), 'MMM d')} - ${format(new Date(summary.date_to), 'MMM d, yyyy')}`}
                    </span>
                  </>
                ) : (
                  'Team summary'
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

            <SummaryDisplay content={displayContent} isStreaming={generating} />

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
      )}
    </div>
  )
}
