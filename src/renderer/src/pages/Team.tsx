import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SummaryDisplay from '../components/SummaryDisplay'
import VelocityChart, { TeamBenchmarksCard, ActivityByRepoCard } from '../components/VelocityChart'
import CollaborationGraph, {
  ReviewOverviewCard,
  PRCycleTimesCard,
  ReviewQualityCard,
  TopReviewersCard,
  EnhancedReviewMetrics
} from '../components/CollaborationGraph'
import { getQuickActionConfig } from '../components/QuickActions'
import {
  Users,
  RefreshCw,
  Sparkles,
  User,
  AlertCircle,
  Copy,
  Download,
  Check,
  TrendingUp,
  GitPullRequest,
  BarChart3,
  Network
} from 'lucide-react'

type DateRange = 'yesterday' | 'week' | 'month'
type ViewMode = 'summary' | 'insights' | 'activity'

interface VelocityMetrics {
  commitsPerWeek: number
  additions: number
  deletions: number
  filesChanged: number
  trend: 'up' | 'down' | 'stable'
  trendPercent: number
}

interface TeamBenchmarks {
  average: number
  median: number
  max: number
  yourCommits: number
  yourRank: number
  totalMembers: number
  percentile: number
}

interface CollaborationNode {
  id: string
  name: string
  avatar: string | null
  reviewsGiven: number
  reviewsReceived: number
  prsOpened: number
  prsMerged: number
  commits: number
}

interface CollaborationEdge {
  from: string
  to: string
  weight: number
  reviewsGiven: number
  prsReviewed: number[]
}

interface CollaborationStats {
  totalReviews: number
  totalReviewers: number
  averageReviewsPerPR: number
  topReviewer: { name: string; count: number } | null
}

interface ActivityByRepo {
  repoId: number
  repoName: string
  authors: Array<{ email: string; name: string; commits: number }>
}

interface Summary {
  id: number
  content: string
  date_from: string
  date_to: string
  commit_count: number
  merge_count: number
  created_at: string
}

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
  options: { value: T; label: string; icon?: React.ReactNode }[]
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
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function Team(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [viewMode, setViewMode] = useState<ViewMode>('insights')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; errors: string[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ message: string; progress?: number } | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Team members
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: number
    displayName: string
    emails: string[]
    commitCount: number
  }>>([])

  // Insights data
  const [velocityTrend, setVelocityTrend] = useState<VelocityMetrics[]>([])
  const [teamBenchmarks, setTeamBenchmarks] = useState<TeamBenchmarks | null>(null)
  const [collaborationGraph, setCollaborationGraph] = useState<{ nodes: CollaborationNode[]; edges: CollaborationEdge[] }>({ nodes: [], edges: [] })
  const [collaborationStats, setCollaborationStats] = useState<CollaborationStats | null>(null)
  const [enhancedMetrics, setEnhancedMetrics] = useState<EnhancedReviewMetrics | null>(null)
  const [activityByRepo, setActivityByRepo] = useState<ActivityByRepo[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const quickActionProcessed = useRef(false)

  // Load user email for benchmarks
  useEffect(() => {
    window.api.git.getUser().then((user) => {
      if (user.email) setUserEmail(user.email)
    })
  }, [])

  // Check for quick action config and auto-generate
  useEffect(() => {
    if (quickActionProcessed.current) return

    const config = getQuickActionConfig()
    if (config && config.type === 'team' && config.autoGenerate) {
      quickActionProcessed.current = true

      // Map quick action date range to our DateRange type
      const dateRangeMap: Record<string, DateRange> = {
        yesterday: 'yesterday',
        today: 'yesterday',
        week: 'week',
        last_week: 'week'
      }
      const mappedDateRange = dateRangeMap[config.dateRange] || 'week'

      // Set the date range and switch to summary view
      setDateRange(mappedDateRange)
      setViewMode('summary')

      // Trigger generation after state updates
      setTimeout(() => {
        const range = getDateRange(mappedDateRange)
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
      }, 100)
    }
  }, [])

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

  const loadInsights = useCallback(async () => {
    try {
      setInsightsLoading(true)
      const range = getDateRange(dateRange)
      const dateFrom = format(range.from, 'yyyy-MM-dd')
      const dateTo = format(range.to, 'yyyy-MM-dd')

      const [velocityResult, benchmarksResult, graphResult, statsResult, enhancedMetricsResult, activityResult] = await Promise.all([
        window.api.velocity.getTrend({ weeks: 8 }),
        window.api.velocity.getBenchmarks(userEmail || undefined),
        window.api.github.getCollaborationGraph({ dateFrom, dateTo }),
        window.api.github.getCollaborationStats({ dateFrom, dateTo }),
        window.api.github.getEnhancedReviewMetrics({ dateFrom, dateTo }),
        window.api.velocity.getActivityByRepo({ dateFrom, dateTo })
      ])

      if (velocityResult.success) {
        setVelocityTrend(velocityResult.trend as VelocityMetrics[])
      }
      if (benchmarksResult.success) {
        setTeamBenchmarks(benchmarksResult.benchmarks)
      }
      if (graphResult.success) {
        setCollaborationGraph(graphResult.graph as { nodes: CollaborationNode[]; edges: CollaborationEdge[] })
      }
      if (statsResult.success) {
        setCollaborationStats(statsResult.stats)
      }
      if (enhancedMetricsResult.success) {
        setEnhancedMetrics(enhancedMetricsResult.metrics as EnhancedReviewMetrics)
      }
      if (activityResult.success) {
        setActivityByRepo(activityResult.activity as ActivityByRepo[])
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setInsightsLoading(false)
    }
  }, [dateRange, userEmail])

  useEffect(() => {
    loadTeamMembers()
    if (viewMode === 'insights' || viewMode === 'activity') {
      loadInsights()
    }
  }, [loadTeamMembers, loadInsights, viewMode])

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
      setSummary(sum as Summary)
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

      // Fetch from git remotes
      const result = await window.api.git.fetchAll()

      // Sync commits to database for velocity/insights
      const range = getDateRange('month') // Sync last 30 days
      await window.api.commits.sync({
        dateFrom: format(range.from, 'yyyy-MM-dd'),
        dateTo: format(range.to, 'yyyy-MM-dd')
      })

      // Also sync GitHub data if connected
      try {
        await window.api.github.syncAll()
      } catch {
        // GitHub sync is optional
      }

      setFetchResult(result)
      await loadTeamMembers()
      await loadInsights()
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
          <h1 className="text-[24px] font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Track team velocity, collaboration, and activity
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
              Sync Data
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
            ? 'Successfully synced data from all repositories'
            : `Sync completed with errors: ${fetchResult.errors.join(', ')}`}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium">View</span>
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'insights', label: 'Insights', icon: <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> },
              { value: 'activity', label: 'Activity', icon: <Network className="mr-1.5 h-3.5 w-3.5" /> },
              { value: 'summary', label: 'Summary', icon: <Sparkles className="mr-1.5 h-3.5 w-3.5" /> }
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium">Period</span>
          <SegmentedControl
            value={dateRange}
            onChange={setDateRange}
            options={[
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'week', label: '7 Days' },
              { value: 'month', label: '30 Days' }
            ]}
          />
        </div>
      </div>

      {/* Insights View */}
      {viewMode === 'insights' && (
        <div className="space-y-6">
          {insightsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-[13px]">Loading insights...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Velocity and Benchmarks */}
              <div className="grid gap-5 lg:grid-cols-2">
                <VelocityChart
                  data={velocityTrend}
                  benchmarks={teamBenchmarks || undefined}
                  title="Team Velocity"
                />
                {teamBenchmarks && (
                  <TeamBenchmarksCard benchmarks={teamBenchmarks} />
                )}
              </div>

              {/* Collaboration Network */}
              <CollaborationGraph
                nodes={collaborationGraph.nodes}
                edges={collaborationGraph.edges}
              />

              {/* Code Review Metrics - 2x2 Grid */}
              {collaborationStats && enhancedMetrics && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <ReviewOverviewCard
                    basicStats={collaborationStats}
                    metrics={enhancedMetrics}
                  />
                  <PRCycleTimesCard metrics={enhancedMetrics} />
                  <ReviewQualityCard metrics={enhancedMetrics} />
                  <TopReviewersCard metrics={enhancedMetrics} />
                </div>
              )}

              {/* Quick stats */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle">
                      <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-[22px] font-bold">{teamMembers.length}</p>
                      <p className="text-[11px] text-muted-foreground">Active Members</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-subtle">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-[22px] font-bold">{totalCommits}</p>
                      <p className="text-[11px] text-muted-foreground">Total Commits</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-500/20">
                      <GitPullRequest className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[22px] font-bold">
                        {collaborationGraph.nodes.reduce((sum, n) => sum + n.prsOpened, 0)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">PRs Opened</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
                      <Network className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[22px] font-bold">
                        {collaborationStats?.totalReviews || 0}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Code Reviews</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Activity View */}
      {viewMode === 'activity' && (
        <div className="space-y-6">
          {insightsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-[13px]">Loading activity...</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Activity by repo */}
              <ActivityByRepoCard data={activityByRepo} />

              {/* Team members */}
              <Card className="p-5">
                <h3 className="mb-4 text-[14px] font-semibold">Team Members</h3>
                {loading ? (
                  <div className="flex h-40 items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-[13px] text-muted-foreground">No active team members</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-background-secondary p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium">{member.displayName}</p>
                            <p className="text-[11px] text-muted-foreground">{member.emails[0]}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[16px] font-bold">{member.commitCount}</p>
                          <p className="text-[10px] text-muted-foreground">commits</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className="space-y-5">
          {/* Team Members */}
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold">Team Members</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col items-center rounded-lg border border-border-subtle bg-background-secondary px-2 py-2.5 transition-all hover:border-border hover:bg-card"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-subtle border border-accent/20 text-accent mb-1.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[11px] font-medium text-center truncate w-full">{member.displayName}</p>
                    <p className="text-[15px] font-bold tabular-nums leading-tight">{member.commitCount}</p>
                    <p className="text-[9px] text-muted-foreground">commits</p>
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
      )}
    </div>
  )
}
