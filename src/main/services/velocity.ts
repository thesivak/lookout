/**
 * Velocity tracking service
 * Calculates and stores velocity metrics for individuals and teams
 */

import { startOfWeek, format, subWeeks } from 'date-fns'
import { getDatabase } from './database'

export interface VelocityMetrics {
  commitsPerWeek: number
  additions: number
  deletions: number
  filesChanged: number
  trend: 'up' | 'down' | 'stable'
  trendPercent: number
}

export interface WeeklyVelocity {
  weekStart: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  categoryBreakdown: Record<string, number>
}

export interface TeamBenchmarks {
  average: number
  median: number
  max: number
  yourCommits: number
  yourRank: number
  totalMembers: number
  percentile: number
}

/**
 * Calculate velocity for a specific week
 */
export function calculateWeeklyVelocity(
  profileId: number | null,
  weekStart: Date
): WeeklyVelocity {
  const db = getDatabase()
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEnd = format(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  let query = `
    SELECT
      COUNT(*) as commits,
      SUM(additions) as additions,
      SUM(deletions) as deletions,
      SUM(files_changed) as files_changed
    FROM commits
    WHERE date >= ? AND date < ?
  `
  const params: (string | number)[] = [weekStartStr, weekEnd]

  if (profileId !== null) {
    // Get emails for this profile
    const emails = db
      .prepare('SELECT email FROM contributor_emails WHERE profile_id = ?')
      .all(profileId) as Array<{ email: string }>

    if (emails.length > 0) {
      const placeholders = emails.map(() => '?').join(', ')
      query += ` AND LOWER(author_email) IN (${placeholders})`
      params.push(...emails.map((e) => e.email.toLowerCase()))
    }
  }

  const result = db.prepare(query).get(...params) as {
    commits: number
    additions: number
    deletions: number
    files_changed: number
  }

  // Get category breakdown
  let categoryQuery = `
    SELECT category, COUNT(*) as count
    FROM commits
    WHERE date >= ? AND date < ?
  `
  const categoryParams: (string | number)[] = [weekStartStr, weekEnd]

  if (profileId !== null) {
    const emails = db
      .prepare('SELECT email FROM contributor_emails WHERE profile_id = ?')
      .all(profileId) as Array<{ email: string }>

    if (emails.length > 0) {
      const placeholders = emails.map(() => '?').join(', ')
      categoryQuery += ` AND LOWER(author_email) IN (${placeholders})`
      categoryParams.push(...emails.map((e) => e.email.toLowerCase()))
    }
  }

  categoryQuery += ' GROUP BY category'

  const categories = db.prepare(categoryQuery).all(...categoryParams) as Array<{
    category: string
    count: number
  }>

  const categoryBreakdown: Record<string, number> = {}
  for (const cat of categories) {
    categoryBreakdown[cat.category] = cat.count
  }

  return {
    weekStart: weekStartStr,
    commits: result.commits || 0,
    additions: result.additions || 0,
    deletions: result.deletions || 0,
    filesChanged: result.files_changed || 0,
    categoryBreakdown
  }
}

/**
 * Save velocity snapshot for a week
 */
export function saveVelocitySnapshot(profileId: number | null, weekStart: Date): void {
  const db = getDatabase()
  const velocity = calculateWeeklyVelocity(profileId, weekStart)

  db.prepare(`
    INSERT OR REPLACE INTO velocity_snapshots
    (profile_id, week_start, commits, additions, deletions, files_changed, category_breakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    profileId,
    velocity.weekStart,
    velocity.commits,
    velocity.additions,
    velocity.deletions,
    velocity.filesChanged,
    JSON.stringify(velocity.categoryBreakdown)
  )
}

/**
 * Get velocity trend for a profile/team over N weeks
 */
export function getVelocityTrend(profileId: number | null, weeks: number = 8): VelocityMetrics[] {
  const db = getDatabase()
  const results: VelocityMetrics[] = []

  const now = new Date()
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })

  for (let i = 0; i < weeks; i++) {
    const weekStart = subWeeks(currentWeekStart, i)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')

    // Try to get from cache
    const cached = db
      .prepare(
        `
      SELECT * FROM velocity_snapshots
      WHERE profile_id ${profileId === null ? 'IS NULL' : '= ?'}
        AND week_start = ?
    `
      )
      .get(...(profileId === null ? [weekStartStr] : [profileId, weekStartStr])) as
      | {
          commits: number
          additions: number
          deletions: number
          files_changed: number
        }
      | undefined

    let velocity: WeeklyVelocity

    if (cached) {
      velocity = {
        weekStart: weekStartStr,
        commits: cached.commits,
        additions: cached.additions,
        deletions: cached.deletions,
        filesChanged: cached.files_changed,
        categoryBreakdown: {}
      }
    } else {
      // Calculate and cache
      velocity = calculateWeeklyVelocity(profileId, weekStart)
      saveVelocitySnapshot(profileId, weekStart)
    }

    // Calculate trend vs previous week
    const prevWeekIndex = i + 1
    let trend: 'up' | 'down' | 'stable' = 'stable'
    let trendPercent = 0

    if (prevWeekIndex < weeks && results.length > 0) {
      const prevCommits = results[results.length - 1].commitsPerWeek
      if (prevCommits > 0) {
        trendPercent = ((velocity.commits - prevCommits) / prevCommits) * 100
        trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable'
      }
    }

    results.push({
      commitsPerWeek: velocity.commits,
      additions: velocity.additions,
      deletions: velocity.deletions,
      filesChanged: velocity.filesChanged,
      trend,
      trendPercent
    })
  }

  return results.reverse() // Return chronological order (oldest first)
}

/**
 * Get anonymized team benchmarks
 */
export function getTeamBenchmarks(userEmail?: string): TeamBenchmarks {
  const db = getDatabase()

  // Get current week range
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEnd = format(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  // Get commit counts per author for this week
  const authorCounts = db
    .prepare(
      `
    SELECT LOWER(author_email) as email, COUNT(*) as commits
    FROM commits
    WHERE date >= ? AND date < ?
    GROUP BY LOWER(author_email)
    ORDER BY commits DESC
  `
    )
    .all(weekStartStr, weekEnd) as Array<{ email: string; commits: number }>

  if (authorCounts.length === 0) {
    return {
      average: 0,
      median: 0,
      max: 0,
      yourCommits: 0,
      yourRank: 0,
      totalMembers: 0,
      percentile: 0
    }
  }

  const counts = authorCounts.map((a) => a.commits)
  const total = counts.reduce((sum, c) => sum + c, 0)
  const average = total / counts.length
  const sortedCounts = [...counts].sort((a, b) => a - b)
  const median =
    sortedCounts.length % 2 === 0
      ? (sortedCounts[sortedCounts.length / 2 - 1] + sortedCounts[sortedCounts.length / 2]) / 2
      : sortedCounts[Math.floor(sortedCounts.length / 2)]
  const max = Math.max(...counts)

  // Find user's rank
  let yourCommits = 0
  let yourRank = 0
  if (userEmail) {
    const userEntry = authorCounts.find((a) => a.email === userEmail.toLowerCase())
    if (userEntry) {
      yourCommits = userEntry.commits
      yourRank = authorCounts.findIndex((a) => a.email === userEmail.toLowerCase()) + 1
    }
  }

  // Calculate percentile
  const percentile =
    yourRank > 0 ? Math.round(((authorCounts.length - yourRank + 1) / authorCounts.length) * 100) : 0

  return {
    average: Math.round(average * 10) / 10,
    median,
    max,
    yourCommits,
    yourRank,
    totalMembers: authorCounts.length,
    percentile
  }
}

/**
 * Get activity breakdown by repository
 * Only includes commits from contributors with configured profiles (not excluded)
 */
export function getActivityByRepo(
  dateFrom: string,
  dateTo: string
): Array<{
  repoId: number
  repoName: string
  authors: Array<{ email: string; name: string; commits: number }>
}> {
  const db = getDatabase()

  // Join with contributor_emails and contributor_profiles to:
  // 1. Only include commits from aliased contributors
  // 2. Group by profile (aggregating multiple emails for same person)
  // 3. Use profile display_name instead of raw git author name
  const repos = db
    .prepare(
      `
    SELECT r.id, r.name,
           p.id as profile_id,
           p.display_name,
           COUNT(*) as commits
    FROM commits c
    JOIN repositories r ON c.repo_id = r.id
    JOIN contributor_emails ce ON LOWER(c.author_email) = LOWER(ce.email)
    JOIN contributor_profiles p ON ce.profile_id = p.id
    WHERE c.date >= ? AND c.date <= ?
      AND p.is_excluded = 0
    GROUP BY r.id, p.id
    ORDER BY r.name, commits DESC
  `
    )
    .all(dateFrom, dateTo) as Array<{
    id: number
    name: string
    profile_id: number
    display_name: string
    commits: number
  }>

  // Group by repo
  const repoMap = new Map<
    number,
    {
      repoId: number
      repoName: string
      authors: Array<{ email: string; name: string; commits: number }>
    }
  >()

  for (const row of repos) {
    if (!repoMap.has(row.id)) {
      repoMap.set(row.id, {
        repoId: row.id,
        repoName: row.name,
        authors: []
      })
    }
    repoMap.get(row.id)!.authors.push({
      email: String(row.profile_id), // Use profile ID as identifier
      name: row.display_name,
      commits: row.commits
    })
  }

  return Array.from(repoMap.values())
}
