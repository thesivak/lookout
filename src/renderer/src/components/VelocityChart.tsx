import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Award, Users } from 'lucide-react'
import { subWeeks, format, startOfWeek } from 'date-fns'
import Card from './ui/Card'

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

interface VelocityChartProps {
  data: VelocityMetrics[]
  benchmarks?: TeamBenchmarks
  className?: string
  title?: string
}

export default function VelocityChart({
  data,
  benchmarks,
  className = '',
  title = 'Velocity Trend'
}: VelocityChartProps): JSX.Element {
  // Find max value for scaling
  const maxValue = useMemo(() => {
    const values = data.map((d) => d.commitsPerWeek)
    if (benchmarks) {
      values.push(benchmarks.average, benchmarks.max)
    }
    return Math.max(...values, 1)
  }, [data, benchmarks])

  // Calculate average
  const average = useMemo(() => {
    const sum = data.reduce((acc, d) => acc + d.commitsPerWeek, 0)
    return data.length > 0 ? Math.round((sum / data.length) * 10) / 10 : 0
  }, [data])

  // Get current trend
  const currentTrend = data.length > 0 ? data[data.length - 1] : null

  const TrendIcon =
    currentTrend?.trend === 'up'
      ? TrendingUp
      : currentTrend?.trend === 'down'
        ? TrendingDown
        : Minus

  const trendColor =
    currentTrend?.trend === 'up'
      ? 'text-success'
      : currentTrend?.trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground'

  // Week labels - show actual dates like "Dec 2" for the start of each week
  const weekLabels = useMemo(() => {
    const now = new Date()
    return data.map((_, i) => {
      const weeksAgo = data.length - 1 - i
      if (weeksAgo === 0) return 'This wk'
      const weekStart = startOfWeek(subWeeks(now, weeksAgo), { weekStartsOn: 1 }) // Monday start
      return format(weekStart, 'MMM d')
    })
  }, [data])

  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {currentTrend && (
          <div className={`flex items-center gap-1 text-[12px] ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            {currentTrend.trend !== 'stable' && (
              <span>{Math.abs(Math.round(currentTrend.trendPercent))}%</span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative mb-2">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-border/30" />
          ))}
        </div>

        {/* Bars */}
        <div className="relative flex h-36 items-end gap-1.5 px-1">
          {data.length > 0 ? (
            data.map((week, i) => {
              const height = (week.commitsPerWeek / maxValue) * 100
              const isLast = i === data.length - 1
              const weeksAgo = data.length - 1 - i
              const now = new Date()
              const weekStart = startOfWeek(subWeeks(now, weeksAgo), { weekStartsOn: 1 })
              const weekEnd = new Date(weekStart)
              weekEnd.setDate(weekEnd.getDate() + 6)
              const dateRangeLabel = weeksAgo === 0
                ? 'This week'
                : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`

              return (
                <div
                  key={i}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center"
                >
                  <div
                    className={`w-full rounded-t-sm transition-all cursor-pointer ${
                      isLast
                        ? 'bg-gradient-to-t from-accent to-accent/70'
                        : 'bg-gradient-to-t from-accent/50 to-accent/30'
                    } group-hover:from-accent group-hover:to-accent/60`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] text-background group-hover:block whitespace-nowrap shadow-lg z-10">
                    <div className="text-[9px] opacity-70 mb-0.5">{dateRangeLabel}</div>
                    <div className="font-medium">{week.commitsPerWeek} commits</div>
                    <div className="text-[9px] opacity-70">
                      +{week.additions} / -{week.deletions}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-[12px]">
              No velocity data yet
            </div>
          )}
        </div>

        {/* X-axis labels */}
        {data.length > 0 && (
          <div className="flex gap-1.5 px-1 mt-1">
            {weekLabels.map((label, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Average line indicator */}
      {benchmarks && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
          <span>Team avg: {benchmarks.average}/week</span>
          <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-center border-t border-border/50 pt-4 mt-2">
        <div>
          <p className="text-[20px] font-bold tabular-nums">{average}</p>
          <p className="text-[10px] text-muted-foreground">Avg/Week</p>
        </div>
        <div>
          <p className="text-[20px] font-bold tabular-nums">
            {data.length > 0 ? data[data.length - 1].commitsPerWeek : 0}
          </p>
          <p className="text-[10px] text-muted-foreground">This Week</p>
        </div>
        <div>
          <p className="text-[20px] font-bold tabular-nums">{Math.max(...data.map((d) => d.commitsPerWeek), 0)}</p>
          <p className="text-[10px] text-muted-foreground">Peak</p>
        </div>
      </div>
    </Card>
  )
}

/**
 * Team benchmarks display component
 */
export function TeamBenchmarksCard({
  benchmarks,
  className = ''
}: {
  benchmarks: TeamBenchmarks
  className?: string
}): JSX.Element {
  const rankDisplay =
    benchmarks.yourRank > 0
      ? benchmarks.yourRank <= 3
        ? ['', '1st', '2nd', '3rd'][benchmarks.yourRank]
        : `${benchmarks.yourRank}th`
      : '-'

  const percentileColor =
    benchmarks.percentile >= 75
      ? 'text-success'
      : benchmarks.percentile >= 50
        ? 'text-accent'
        : 'text-muted-foreground'

  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="text-[14px] font-semibold">Team Benchmarks</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          This week
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Your position */}
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <div className="flex items-center gap-2">
            <Award className={`h-5 w-5 ${percentileColor}`} />
            <div>
              <p className="text-[11px] text-muted-foreground">Your Position</p>
              <p className="text-[16px] font-bold">
                {rankDisplay}
                <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                  of {benchmarks.totalMembers}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Percentile */}
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Percentile</p>
          <p className={`text-[16px] font-bold ${percentileColor}`}>
            Top {100 - benchmarks.percentile}%
          </p>
        </div>

        {/* Your commits */}
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Your Commits</p>
          <p className="text-[16px] font-bold">{benchmarks.yourCommits}</p>
        </div>

        {/* Team average */}
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <p className="text-[11px] text-muted-foreground">Team Average</p>
          <p className="text-[16px] font-bold">{benchmarks.average}</p>
        </div>
      </div>

      {/* Progress bar showing position */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>Max: {benchmarks.max}</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted">
          {/* Team average marker */}
          <div
            className="absolute top-0 h-2 w-0.5 bg-muted-foreground"
            style={{ left: `${(benchmarks.average / benchmarks.max) * 100}%` }}
          />
          {/* Your position */}
          <div
            className="absolute top-0 h-2 rounded-full bg-accent transition-all"
            style={{ width: `${(benchmarks.yourCommits / benchmarks.max) * 100}%` }}
          />
        </div>
      </div>
    </Card>
  )
}

/**
 * Activity by repo display component
 */
export function ActivityByRepoCard({
  data,
  className = ''
}: {
  data: Array<{
    repoId: number
    repoName: string
    authors: Array<{ email: string; name: string; commits: number }>
  }>
  className?: string
}): JSX.Element {
  return (
    <Card className={`p-5 ${className}`}>
      <h3 className="mb-4 text-[14px] font-semibold">Who's Working on What</h3>

      <div className="space-y-4 max-h-64 overflow-y-auto">
        {data.map((repo) => (
          <div key={repo.repoId}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-medium">{repo.repoName}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {repo.authors.reduce((sum, a) => sum + a.commits, 0)} commits
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {repo.authors.slice(0, 5).map((author) => (
                <div
                  key={author.email}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background-secondary px-2 py-0.5"
                >
                  <div className="h-4 w-4 rounded-full bg-accent/30 flex items-center justify-center text-[8px] font-medium text-accent">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px]">{author.name.split(' ')[0]}</span>
                  <span className="text-[10px] text-muted-foreground">{author.commits}</span>
                </div>
              ))}
              {repo.authors.length > 5 && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  +{repo.authors.length - 5} more
                </span>
              )}
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-4">
            No activity data available
          </p>
        )}
      </div>
    </Card>
  )
}
