import { useMemo } from 'react'
import { Users, ArrowRight, GitPullRequest, MessageSquare, Clock, CheckCircle, AlertTriangle, BarChart3, Timer, GitMerge } from 'lucide-react'
import Card from './ui/Card'

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

interface CollaborationGraphProps {
  nodes: CollaborationNode[]
  edges: CollaborationEdge[]
  className?: string
}

export default function CollaborationGraph({
  nodes,
  edges,
  className = ''
}: CollaborationGraphProps): JSX.Element {
  // Sort nodes by activity
  const sortedNodes = useMemo(() => {
    return [...nodes].sort(
      (a, b) =>
        b.reviewsGiven + b.reviewsReceived + b.prsOpened - (a.reviewsGiven + a.reviewsReceived + a.prsOpened)
    )
  }, [nodes])

  // Get top edges (most interactions)
  const topEdges = useMemo(() => {
    return [...edges].sort((a, b) => b.weight - a.weight).slice(0, 10)
  }, [edges])

  // Calculate max weight for scaling
  const maxWeight = useMemo(() => {
    return Math.max(...edges.map((e) => e.weight), 1)
  }, [edges])

  if (nodes.length === 0) {
    return (
      <Card className={`p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-accent" />
          <h3 className="text-[14px] font-semibold">Collaboration Network</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[13px] font-medium">No collaboration data yet</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Connect GitHub and sync repositories to see collaboration patterns
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="text-[14px] font-semibold">Collaboration Network</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {nodes.length} people
        </span>
      </div>

      {/* Top Contributors */}
      <div className="mb-5">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">TOP CONTRIBUTORS</p>
        <div className="flex flex-wrap gap-2">
          {sortedNodes.slice(0, 6).map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2"
            >
              {node.avatar ? (
                <img
                  src={`${node.avatar}${node.avatar.includes('?') ? '&' : '?'}s=48`}
                  alt={node.name}
                  className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent flex-shrink-0">
                  {node.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[12px] font-medium truncate max-w-[100px]">{node.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" />
                    {node.reviewsGiven}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitPullRequest className="h-3 w-3" />
                    {node.prsOpened}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Relationships */}
      {topEdges.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">REVIEW RELATIONSHIPS</p>
          <div className="space-y-1.5">
            {topEdges.slice(0, 5).map((edge, i) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)
              const widthPercent = (edge.weight / maxWeight) * 100

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2"
                >
                  {/* Reviewer */}
                  <div className="flex items-center gap-1.5 min-w-[90px]">
                    {fromNode?.avatar ? (
                      <img
                        src={`${fromNode.avatar}${fromNode.avatar.includes('?') ? '&' : '?'}s=40`}
                        alt={fromNode?.name || edge.from}
                        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-medium text-accent flex-shrink-0">
                        {(fromNode?.name || edge.from).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[11px] font-medium truncate">{fromNode?.name || edge.from}</span>
                  </div>

                  {/* Arrow with weight */}
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-accent/60 rounded-full transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-1.5 min-w-[90px]">
                    {toNode?.avatar ? (
                      <img
                        src={`${toNode.avatar}${toNode.avatar.includes('?') ? '&' : '?'}s=40`}
                        alt={toNode?.name || edge.to}
                        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center text-[9px] font-medium text-success flex-shrink-0">
                        {(toNode?.name || edge.to).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[11px] font-medium truncate">{toNode?.name || edge.to}</span>
                  </div>

                  {/* Review count */}
                  <span className="text-[10px] text-muted-foreground min-w-[50px] text-right">
                    {edge.reviewsGiven} review{edge.reviewsGiven !== 1 ? 's' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[16px] font-bold">{edges.reduce((sum, e) => sum + e.reviewsGiven, 0)}</p>
          <p className="text-[10px] text-muted-foreground">Total Reviews</p>
        </div>
        <div>
          <p className="text-[16px] font-bold">{nodes.reduce((sum, n) => sum + n.prsOpened, 0)}</p>
          <p className="text-[10px] text-muted-foreground">PRs Opened</p>
        </div>
        <div>
          <p className="text-[16px] font-bold">{nodes.reduce((sum, n) => sum + n.prsMerged, 0)}</p>
          <p className="text-[10px] text-muted-foreground">PRs Merged</p>
        </div>
      </div>
    </Card>
  )
}

/**
 * Compact collaboration summary card
 */
export function CollaborationSummaryCard({
  stats,
  className = ''
}: {
  stats: {
    totalReviews: number
    totalReviewers: number
    averageReviewsPerPR: number
    topReviewer: { name: string; count: number } | null
  }
  className?: string
}): JSX.Element {
  // Calculate review health score (0-100)
  const healthScore = Math.min(100, Math.round(
    (stats.averageReviewsPerPR >= 1 ? 40 : stats.averageReviewsPerPR * 40) +
    (stats.totalReviewers >= 3 ? 30 : stats.totalReviewers * 10) +
    (stats.totalReviews >= 10 ? 30 : stats.totalReviews * 3)
  ))

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Work'
  const healthColor = healthScore >= 80 ? 'text-success' : healthScore >= 60 ? 'text-accent' : healthScore >= 40 ? 'text-amber-500' : 'text-destructive'

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-success" />
        <h3 className="text-[14px] font-semibold">Code Review Stats</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Total Reviews</p>
          <p className="text-[18px] font-bold">{stats.totalReviews}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Active Reviewers</p>
          <p className="text-[18px] font-bold">{stats.totalReviewers}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Avg Reviews/PR</p>
          <p className="text-[18px] font-bold">{stats.averageReviewsPerPR.toFixed(1)}</p>
        </div>
        {stats.topReviewer && (
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <p className="text-[11px] text-muted-foreground">Top Reviewer</p>
            <p className="text-[13px] font-bold truncate">{stats.topReviewer.name}</p>
            <p className="text-[10px] text-muted-foreground">{stats.topReviewer.count} reviews</p>
          </div>
        )}
      </div>

      {/* Review Health Score */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground">REVIEW HEALTH</span>
          <span className={`text-[12px] font-semibold ${healthColor}`}>{healthLabel}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              healthScore >= 80 ? 'bg-success' : healthScore >= 60 ? 'bg-accent' : healthScore >= 40 ? 'bg-amber-500' : 'bg-destructive'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {stats.totalReviews === 0
            ? 'No reviews yet. Start reviewing PRs to improve team collaboration.'
            : stats.averageReviewsPerPR < 1
              ? 'Consider having more reviewers per PR for better code quality.'
              : stats.totalReviewers < 3
                ? 'Great review coverage! Consider involving more team members.'
                : 'Healthy review culture with good team participation.'}
        </p>
      </div>
    </Card>
  )
}

/**
 * Enhanced review metrics interface
 */
export interface EnhancedReviewMetrics {
  avgTimeToFirstReview: number | null
  avgTimeToMerge: number | null
  medianTimeToFirstReview: number | null
  medianTimeToMerge: number | null
  approvalRate: number
  changesRequestedRate: number
  avgReviewRounds: number
  selfMergeRate: number
  stalePRCount: number
  reviewLoadBalance: number
  reviewerStats: Array<{
    name: string
    avatar: string | null
    reviewsGiven: number
    avgResponseTimeHours: number | null
    approvalRate: number
  }>
  pendingReviewers: Array<{
    name: string
    avatar: string | null
    pendingCount: number
  }>
}

/**
 * Format hours into readable time string
 */
function formatHours(hours: number | null): string {
  if (hours === null) return '-'
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`
  } else {
    const days = hours / 24
    return `${days.toFixed(1)}d`
  }
}

/**
 * Calculate health score from metrics
 */
function calculateHealthScore(
  metrics: EnhancedReviewMetrics,
  basicStats: { averageReviewsPerPR: number }
): number {
  let score = 0

  if (metrics.avgTimeToFirstReview !== null) {
    if (metrics.avgTimeToFirstReview < 4) score += 25
    else if (metrics.avgTimeToFirstReview < 24) score += 15
    else if (metrics.avgTimeToFirstReview < 48) score += 5
  }

  if (basicStats.averageReviewsPerPR >= 1.5) score += 20
  else if (basicStats.averageReviewsPerPR >= 1) score += 15
  else if (basicStats.averageReviewsPerPR >= 0.5) score += 5

  if (metrics.selfMergeRate < 10) score += 20
  else if (metrics.selfMergeRate < 25) score += 10
  else if (metrics.selfMergeRate < 50) score += 5

  if (metrics.reviewLoadBalance > 70) score += 20
  else if (metrics.reviewLoadBalance > 50) score += 10
  else if (metrics.reviewLoadBalance > 30) score += 5

  if (metrics.stalePRCount === 0) score += 15
  else if (metrics.stalePRCount <= 2) score += 10
  else if (metrics.stalePRCount <= 5) score += 5

  return Math.min(100, score)
}

/**
 * Card 1: Review Overview - Key stats + health score
 */
export function ReviewOverviewCard({
  basicStats,
  metrics,
  className = ''
}: {
  basicStats: {
    totalReviews: number
    totalReviewers: number
    averageReviewsPerPR: number
    topReviewer: { name: string; count: number } | null
  }
  metrics: EnhancedReviewMetrics
  className?: string
}): JSX.Element {
  const healthScore = useMemo(() => calculateHealthScore(metrics, basicStats), [metrics, basicStats])
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Work'
  const healthColor = healthScore >= 80 ? 'text-success' : healthScore >= 60 ? 'text-accent' : healthScore >= 40 ? 'text-amber-500' : 'text-destructive'
  const healthBgColor = healthScore >= 80 ? 'bg-success' : healthScore >= 60 ? 'bg-accent' : healthScore >= 40 ? 'bg-amber-500' : 'bg-destructive'

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-success" />
        <h3 className="text-[14px] font-semibold">Review Overview</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Total Reviews</p>
          <p className="text-[20px] font-bold">{basicStats.totalReviews}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Active Reviewers</p>
          <p className="text-[20px] font-bold">{basicStats.totalReviewers}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Avg Reviews/PR</p>
          <p className="text-[20px] font-bold">{basicStats.averageReviewsPerPR.toFixed(1)}</p>
        </div>
        {basicStats.topReviewer && (
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <p className="text-[11px] text-muted-foreground">Top Reviewer</p>
            <p className="text-[13px] font-bold truncate">{basicStats.topReviewer.name}</p>
            <p className="text-[10px] text-muted-foreground">{basicStats.topReviewer.count} reviews</p>
          </div>
        )}
      </div>

      {/* Review Health Score */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground">REVIEW HEALTH</span>
          <span className={`text-[12px] font-semibold ${healthColor}`}>{healthLabel}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${healthBgColor}`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {basicStats.totalReviews === 0
            ? 'No reviews yet. Start reviewing PRs to improve team collaboration.'
            : healthScore >= 80
              ? 'Excellent review culture with fast turnaround.'
              : healthScore >= 60
                ? 'Good review practices. Keep it up!'
                : 'Room for improvement in review processes.'}
        </p>
      </div>
    </Card>
  )
}

/**
 * Card 2: PR Cycle Times - Time metrics + stale PR alerts
 */
export function PRCycleTimesCard({
  metrics,
  className = ''
}: {
  metrics: EnhancedReviewMetrics
  className?: string
}): JSX.Element {
  const timeToFirstReviewLabel = metrics.avgTimeToFirstReview !== null
    ? metrics.avgTimeToFirstReview < 4 ? 'Fast' : metrics.avgTimeToFirstReview < 24 ? 'Good' : 'Slow'
    : null
  const timeToFirstReviewColor = metrics.avgTimeToFirstReview !== null
    ? metrics.avgTimeToFirstReview < 4 ? 'text-success' : metrics.avgTimeToFirstReview < 24 ? 'text-accent' : 'text-amber-500'
    : 'text-muted-foreground'

  const timeToMergeLabel = metrics.avgTimeToMerge !== null
    ? metrics.avgTimeToMerge < 24 ? 'Fast' : metrics.avgTimeToMerge < 72 ? 'Good' : 'Slow'
    : null
  const timeToMergeColor = metrics.avgTimeToMerge !== null
    ? metrics.avgTimeToMerge < 24 ? 'text-success' : metrics.avgTimeToMerge < 72 ? 'text-accent' : 'text-amber-500'
    : 'text-muted-foreground'

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-accent" />
        <h3 className="text-[14px] font-semibold">PR Cycle Times</h3>
      </div>

      <div className="space-y-4">
        {/* Time to First Review */}
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-muted-foreground">Time to First Review</p>
            {timeToFirstReviewLabel && (
              <span className={`text-[10px] font-medium ${timeToFirstReviewColor}`}>{timeToFirstReviewLabel}</span>
            )}
          </div>
          <p className="text-[24px] font-bold">{formatHours(metrics.avgTimeToFirstReview)}</p>
          {metrics.medianTimeToFirstReview !== null && (
            <p className="text-[10px] text-muted-foreground">Median: {formatHours(metrics.medianTimeToFirstReview)}</p>
          )}
        </div>

        {/* Time to Merge */}
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-muted-foreground">Time to Merge</p>
            {timeToMergeLabel && (
              <span className={`text-[10px] font-medium ${timeToMergeColor}`}>{timeToMergeLabel}</span>
            )}
          </div>
          <p className="text-[24px] font-bold">{formatHours(metrics.avgTimeToMerge)}</p>
          {metrics.medianTimeToMerge !== null && (
            <p className="text-[10px] text-muted-foreground">Median: {formatHours(metrics.medianTimeToMerge)}</p>
          )}
        </div>

        {/* Stale PRs Alert */}
        {metrics.stalePRCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
            <Timer className="h-4 w-4 text-destructive flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-destructive">Stale PRs</p>
              <p className="text-[10px] text-muted-foreground">
                {metrics.stalePRCount} PR{metrics.stalePRCount !== 1 ? 's' : ''} waiting &gt;3 days for review
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Card 3: Review Quality - Quality metrics + alerts
 */
export function ReviewQualityCard({
  metrics,
  className = ''
}: {
  metrics: EnhancedReviewMetrics
  className?: string
}): JSX.Element {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle className="h-4 w-4 text-success" />
        <h3 className="text-[14px] font-semibold">Review Quality</h3>
      </div>

      <div className="space-y-4">
        {/* Approval Rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px]">Approval Rate</span>
            <span className="text-[12px] font-semibold">{metrics.approvalRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${metrics.approvalRate}%` }}
            />
          </div>
        </div>

        {/* Changes Requested Rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px]">Changes Requested</span>
            <span className="text-[12px] font-semibold">{metrics.changesRequestedRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${metrics.changesRequestedRate}%` }}
            />
          </div>
        </div>

        {/* Review Load Balance */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">Load Balance</span>
              <span className="text-[9px] text-muted-foreground">(higher = more even)</span>
            </div>
            <span className="text-[12px] font-semibold">{metrics.reviewLoadBalance}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                metrics.reviewLoadBalance >= 70 ? 'bg-success' : metrics.reviewLoadBalance >= 40 ? 'bg-accent' : 'bg-amber-500'
              }`}
              style={{ width: `${metrics.reviewLoadBalance}%` }}
            />
          </div>
        </div>

        {/* Self-Merge Alert */}
        {metrics.selfMergeRate > 20 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mt-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-amber-500">High Self-Merge Rate</p>
              <p className="text-[10px] text-muted-foreground">
                {metrics.selfMergeRate.toFixed(0)}% of PRs merged without review
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Card 4: Top Reviewers - Reviewer leaderboard with response times
 */
export function TopReviewersCard({
  metrics,
  className = ''
}: {
  metrics: EnhancedReviewMetrics
  className?: string
}): JSX.Element {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="text-[14px] font-semibold">Top Reviewers</h3>
        {metrics.reviewerStats.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {metrics.reviewerStats.length} active
          </span>
        )}
      </div>

      {metrics.reviewerStats.length > 0 ? (
        <div className="space-y-2">
          {metrics.reviewerStats.map((reviewer, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                {i + 1}
              </div>
              {reviewer.avatar ? (
                <img
                  src={`${reviewer.avatar}${reviewer.avatar.includes('?') ? '&' : '?'}s=32`}
                  alt={reviewer.name}
                  className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-[11px] font-medium text-accent flex-shrink-0">
                  {reviewer.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">{reviewer.name}</p>
                <p className="text-[10px] text-muted-foreground">{reviewer.reviewsGiven} reviews</p>
              </div>
              {reviewer.avgResponseTimeHours !== null && (
                <div className="text-right">
                  <p className="text-[12px] font-semibold">{formatHours(reviewer.avgResponseTimeHours)}</p>
                  <p className="text-[9px] text-muted-foreground">avg response</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted mb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-[12px] text-muted-foreground">No reviewer data yet</p>
        </div>
      )}
    </Card>
  )
}

/**
 * Legacy: Enhanced review metrics card (all-in-one)
 * Kept for backwards compatibility
 */
export function EnhancedReviewMetricsCard({
  metrics,
  basicStats,
  className = ''
}: {
  metrics: EnhancedReviewMetrics
  basicStats: {
    totalReviews: number
    totalReviewers: number
    averageReviewsPerPR: number
    topReviewer: { name: string; count: number } | null
  }
  className?: string
}): JSX.Element {
  return (
    <div className={`grid gap-4 ${className}`}>
      <ReviewOverviewCard basicStats={basicStats} metrics={metrics} />
    </div>
  )
}
