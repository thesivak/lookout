import { useState, useEffect, useCallback } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SummaryDisplay from '../components/SummaryDisplay'
import { Users, RefreshCw, Sparkles, Loader2, User, AlertCircle, Copy, Download, Check } from 'lucide-react'

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

export default function Team(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; errors: string[] } | null>(
    null
  )
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ message: string; progress?: number } | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Team members aggregated by profile
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

      // Load profiles and git authors in parallel
      const [profiles, authorData] = await Promise.all([
        window.api.contributors.listProfiles(),
        window.api.git.getAllAuthors(
          range.from.toISOString(),
          range.to.toISOString()
        )
      ])

      // Create a map of email -> commit count from git authors
      const commitsByEmail = new Map<string, number>()
      authorData.forEach(author => {
        commitsByEmail.set(author.email.toLowerCase(), author.commitCount)
      })

      // Aggregate commits for each non-excluded profile
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
        .filter(member => member.commitCount > 0) // Only show members with commits in the date range
        .sort((a, b) => b.commitCount - a.commitCount) // Sort by commit count desc

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
      // No authorEmail - include all authors for team summary
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
      // Reload team members after fetch
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            View work summaries for your team members
          </p>
        </div>
        <Button variant="outline" onClick={handleFetchAll} disabled={fetching}>
          {fetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          className={`rounded-lg p-3 text-sm ${
            fetchResult.success
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {fetchResult.success
            ? 'Successfully fetched latest changes from all repositories'
            : `Fetch completed with errors: ${fetchResult.errors.join(', ')}`}
        </div>
      )}

      {/* Date Range */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Time Range:</span>
        <div className="flex gap-2">
          <Button
            variant={dateRange === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('yesterday')}
          >
            Yesterday
          </Button>
          <Button
            variant={dateRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('week')}
          >
            Last 7 Days
          </Button>
          <Button
            variant={dateRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('month')}
          >
            Last 30 Days
          </Button>
        </div>
      </div>

      {/* Team Members */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}, {totalCommits} total commits
            </p>
          </div>
          <Button onClick={handleGenerateTeamSummary} disabled={generating || teamMembers.length === 0}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No team members configured</p>
              <p className="text-sm text-muted-foreground">
                Go to Contributors to add team members
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.emails[0]}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{member.commitCount}</p>
                  <p className="text-xs text-muted-foreground">commits</p>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Team Summary Result */}
      {displayContent && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="text-sm text-muted-foreground">
                {generating ? 'Generating team summary...' : (
                  summary ? (
                    <>
                      Team summary for{' '}
                      <span className="font-medium text-foreground">
                        {summary.date_from === summary.date_to
                          ? format(new Date(summary.date_from), 'MMM d, yyyy')
                          : `${format(new Date(summary.date_from), 'MMM d')} - ${format(new Date(summary.date_to), 'MMM d, yyyy')}`
                        }
                      </span>
                    </>
                  ) : 'Team summary'
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

            <SummaryDisplay content={displayContent} isStreaming={generating} />

            {summary && (
              <div className="mt-6 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>{summary.commit_count} commits analyzed</span>
                {summary.merge_count > 0 && <span>{summary.merge_count} merges</span>}
                <span>Generated {format(new Date(summary.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
