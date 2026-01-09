import { useEffect, useState, useCallback } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { GitCommit, FolderGit2, FileText, TrendingUp, Sparkles } from 'lucide-react'
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

      // Load weekly stats - don't filter by author to show all activity
      let weeklyStats: RepoStats = {
        totalCommits: 0,
        mergeCommits: 0,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        authors: []
      }

      if (repos.length > 0) {
        // Get all commits, not filtered by author
        weeklyStats = await window.api.git.getAllStats(dateFrom, dateTo)
      }

      // Load activity for contribution graph (last 365 days for a year view)
      // Don't filter by author to show all activity
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

  // Simple contribution graph component
  const ContributionGraph = () => {
    const weeks = 52
    const days = 7
    const now = new Date()

    // Generate grid of days
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

    // Get intensity level (0-4)
    const getLevel = (count: number): number => {
      if (count === 0) return 0
      if (count <= 2) return 1
      if (count <= 5) return 2
      if (count <= 10) return 3
      return 4
    }

    const levelColors = [
      'bg-muted',
      'bg-accent/30',
      'bg-accent/50',
      'bg-accent/70',
      'bg-accent'
    ]

    return (
      <div className="overflow-x-auto">
        <div className="flex gap-0.5">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`h-2.5 w-2.5 rounded-sm ${levelColors[getLevel(day.count)]}`}
                  title={`${day.date}: ${day.count} commits`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          {levelColors.map((color, i) => (
            <div key={i} className={`h-2.5 w-2.5 rounded-sm ${color}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your Git activity and summaries
            {gitUser && (
              <span className="ml-2">
                ({gitUser.name})
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setActiveTab('my-work')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Summary
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/20 p-2">
              <FolderGit2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.totalRepos}</p>
              <p className="text-sm text-muted-foreground">Repositories</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/20 p-2">
              <GitCommit className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.weeklyCommits}</p>
              <p className="text-sm text-muted-foreground">Commits (7d)</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/20 p-2">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.totalSummaries}</p>
              <p className="text-sm text-muted-foreground">Summaries</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                <span className="text-success">+{stats.weeklyAdditions}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">-{stats.weeklyDeletions}</span>
              </p>
              <p className="text-sm text-muted-foreground">Lines (7d)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contribution Graph */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-medium">Activity</h2>
        {Object.keys(activity).length > 0 ? (
          <ContributionGraph />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {stats.totalRepos === 0
                ? 'Import repositories to see your activity'
                : 'No commits found in your repositories'}
            </p>
          </div>
        )}
      </Card>

      {/* Recent Summaries */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-medium">Recent Summaries</h2>
        {recentSummaries.length > 0 ? (
          <div className="space-y-3">
            {recentSummaries.map((summary) => (
              <div
                key={summary.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(summary.date_from), 'MMM d')} -{' '}
                    {format(new Date(summary.date_to), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.commit_count} commits, {summary.prompt_template} template
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(summary.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No summaries generated yet. Click "Generate Summary" to get started.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
