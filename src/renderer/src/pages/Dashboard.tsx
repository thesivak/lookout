import { useEffect, useState, useCallback } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { GitCommit, FolderGit2, FileText, TrendingUp, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigation } from '../App'

interface DashboardStats {
  totalRepos: number
  totalSummaries: number
  weeklyCommits: number
  weeklyAdditions: number
  weeklyDeletions: number
}

export default function Dashboard(): JSX.Element {
  const { setActiveTab } = useNavigation()
  const [stats, setStats] = useState<DashboardStats>({
    totalRepos: 0,
    totalSummaries: 0,
    weeklyCommits: 0,
    weeklyAdditions: 0,
    weeklyDeletions: 0
  })
  const [recentSummaries, setRecentSummaries] = useState<Summary[]>([])
  const [activity, setActivity] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [gitUser, setGitUser] = useState<GitUser | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)

      // Load git user
      const user = await window.api.git.getUser()
      setGitUser(user)

      // Load repos
      const repos = await window.api.repos.list()

      // Load recent summaries
      const summaries = await window.api.summaries.list('personal', 5)
      setRecentSummaries(summaries)

      // Calculate date range (last 7 days)
      const now = new Date()
      const weekAgo = startOfDay(subDays(now, 7))
      const dateFrom = weekAgo.toISOString()
      const dateTo = endOfDay(now).toISOString()

      // Load weekly stats
      let weeklyStats: RepoStats = {
        totalCommits: 0,
        mergeCommits: 0,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        authors: []
      }

      if (repos.length > 0) {
        weeklyStats = await window.api.git.getAllStats(dateFrom, dateTo)
      }

      // Load activity for contribution graph
      const yearAgo = startOfDay(subDays(now, 365))
      const activityData = repos.length > 0
        ? await window.api.git.getActivity(yearAgo.toISOString(), dateTo)
        : {}
      setActivity(activityData)

      setStats({
        totalRepos: repos.length,
        totalSummaries: summaries.length,
        weeklyCommits: weeklyStats.totalCommits,
        weeklyAdditions: weeklyStats.additions,
        weeklyDeletions: weeklyStats.deletions
      })
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Contribution graph component with amber accent
  const ContributionGraph = () => {
    const weeks = 52
    const days = 7
    const now = new Date()

    const grid: { date: string; count: number }[][] = []
    for (let w = 0; w < weeks; w++) {
      const week: { date: string; count: number }[] = []
      for (let d = 0; d < days; d++) {
        const daysAgo = (weeks - 1 - w) * 7 + (6 - d)
        const date = subDays(now, daysAgo)
        const dateStr = format(date, 'yyyy-MM-dd')
        week.push({ date: dateStr, count: activity[dateStr] || 0 })
      }
      grid.push(week)
    }

    const getLevel = (count: number): number => {
      if (count === 0) return 0
      if (count <= 2) return 1
      if (count <= 5) return 2
      if (count <= 10) return 3
      return 4
    }

    // Amber-based colors for the contribution graph
    const levelColors = [
      'bg-muted/40',
      'bg-amber-900/40',
      'bg-amber-700/60',
      'bg-amber-500/80',
      'bg-amber-400'
    ]

    return (
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`h-[11px] w-[11px] rounded-sm ${levelColors[getLevel(day.count)]} transition-all hover:ring-1 hover:ring-accent/50`}
                  title={`${day.date}: ${day.count} commits`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span>Less</span>
          {levelColors.map((color, i) => (
            <div key={i} className={`h-[11px] w-[11px] rounded-sm ${color}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-[13px]">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {gitUser ? `Welcome back, ${gitUser.name}` : 'Overview of your Git activity'}
          </p>
        </div>
        <Button onClick={() => setActiveTab('my-work')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Summary
        </Button>
      </div>

      {/* Stats Cards - with better visual hierarchy */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group p-5 transition-all hover:border-accent/30 hover:shadow-glow-accent">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle border border-accent/20">
              <FolderGit2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-[28px] font-bold tracking-tight">{stats.totalRepos}</p>
              <p className="text-[12px] font-medium text-muted-foreground">Repositories</p>
            </div>
          </div>
        </Card>

        <Card className="group p-5 transition-all hover:border-success/30">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-subtle border border-success/20">
              <GitCommit className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-[28px] font-bold tracking-tight">{stats.weeklyCommits}</p>
              <p className="text-[12px] font-medium text-muted-foreground">Commits (7d)</p>
            </div>
          </div>
        </Card>

        <Card className="group p-5 transition-all hover:border-accent/30 hover:shadow-glow-accent">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle border border-accent/20">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-[28px] font-bold tracking-tight">{stats.totalSummaries}</p>
              <p className="text-[12px] font-medium text-muted-foreground">Summaries</p>
            </div>
          </div>
        </Card>

        <Card className="group p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border-subtle">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[24px] font-bold tracking-tight">
                <span className="text-success">+{stats.weeklyAdditions}</span>
                <span className="mx-1 text-muted-foreground/50">/</span>
                <span className="text-destructive">-{stats.weeklyDeletions}</span>
              </p>
              <p className="text-[12px] font-medium text-muted-foreground">Lines (7d)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Graph */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Activity</h2>
          <span className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Last 12 months
          </span>
        </div>
        {Object.keys(activity).length > 0 ? (
          <ContributionGraph />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border bg-background-secondary/50">
            <p className="text-[13px] text-muted-foreground">
              {stats.totalRepos === 0
                ? 'Add repositories to see your activity'
                : 'No commits found in your repositories'}
            </p>
          </div>
        )}
      </Card>

      {/* Recent Summaries */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Recent Summaries</h2>
          {recentSummaries.length > 0 && (
            <button
              onClick={() => setActiveTab('history')}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent-subtle"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {recentSummaries.length > 0 ? (
          <div className="space-y-2">
            {recentSummaries.map((summary) => (
              <button
                key={summary.id}
                onClick={() => setActiveTab('history')}
                className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-background-secondary p-4 text-left transition-all hover:border-border hover:bg-card"
              >
                <div>
                  <p className="text-[14px] font-medium">
                    {format(new Date(summary.date_from), 'MMM d')} -{' '}
                    {format(new Date(summary.date_to), 'MMM d, yyyy')}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {summary.commit_count} commits
                  </p>
                </div>
                <span className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground border border-border-subtle">
                  {summary.prompt_template}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background-secondary/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle border border-accent/20">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-muted-foreground">No summaries yet</p>
              <button
                onClick={() => setActiveTab('my-work')}
                className="mt-1 text-[12px] font-medium text-accent hover:underline"
              >
                Generate your first summary
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
