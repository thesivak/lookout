/**
 * Collaboration service
 * Builds collaboration graphs from GitHub review data and commit patterns
 */

import { getDatabase } from './database'
import { format } from 'date-fns'

export interface CollaborationNode {
  id: string
  name: string
  avatar: string | null
  reviewsGiven: number
  reviewsReceived: number
  prsOpened: number
  prsMerged: number
  commits: number
}

export interface CollaborationEdge {
  from: string // reviewer login
  to: string // PR author login
  weight: number // total interactions
  reviewsGiven: number
  prsReviewed: number[] // PR numbers
}

export interface CollaborationGraph {
  nodes: CollaborationNode[]
  edges: CollaborationEdge[]
}

/**
 * Build collaboration graph from GitHub review data
 */
export function buildCollaborationGraph(dateFrom: string, dateTo: string): CollaborationGraph {
  const db = getDatabase()

  // Get all reviews in date range
  const reviews = db
    .prepare(
      `
    SELECT
      r.reviewer,
      r.reviewer_avatar,
      r.pr_number,
      r.state,
      r.submitted_at,
      p.author,
      p.author_avatar,
      p.state as pr_state,
      p.repo_id
    FROM github_reviews r
    JOIN github_pull_requests p ON r.repo_id = p.repo_id AND r.pr_number = p.pr_number
    WHERE r.submitted_at >= ? AND r.submitted_at <= ?
  `
    )
    .all(dateFrom, dateTo) as Array<{
    reviewer: string
    reviewer_avatar: string | null
    pr_number: number
    state: string
    submitted_at: string
    author: string
    author_avatar: string | null
    pr_state: string
    repo_id: number
  }>

  // Get PR stats
  const prs = db
    .prepare(
      `
    SELECT
      author,
      author_avatar,
      state,
      merged_at
    FROM github_pull_requests
    WHERE created_at >= ? AND created_at <= ?
  `
    )
    .all(dateFrom, dateTo) as Array<{
    author: string
    author_avatar: string | null
    state: string
    merged_at: string | null
  }>

  // Get commit counts by author (from contributor_profiles or raw commits)
  const commits = db
    .prepare(
      `
    SELECT
      LOWER(author_email) as email,
      author_name,
      COUNT(*) as count
    FROM commits
    WHERE date >= ? AND date <= ?
    GROUP BY LOWER(author_email)
  `
    )
    .all(dateFrom, dateTo) as Array<{
    email: string
    author_name: string
    count: number
  }>

  // Build nodes map
  const nodesMap = new Map<string, CollaborationNode>()

  // Get display name mapping from contributor profiles
  const displayNameMap = getGitHubToDisplayNameMap()

  // Helper to get display name or fall back to GitHub handle
  const getDisplayName = (githubLogin: string): string => {
    return displayNameMap.get(githubLogin.toLowerCase()) || githubLogin
  }

  // Add reviewers and authors from reviews
  for (const review of reviews) {
    // Reviewer node
    if (!nodesMap.has(review.reviewer)) {
      nodesMap.set(review.reviewer, {
        id: review.reviewer,
        name: getDisplayName(review.reviewer),
        avatar: review.reviewer_avatar,
        reviewsGiven: 0,
        reviewsReceived: 0,
        prsOpened: 0,
        prsMerged: 0,
        commits: 0
      })
    }
    nodesMap.get(review.reviewer)!.reviewsGiven++

    // Author node (review received)
    if (!nodesMap.has(review.author)) {
      nodesMap.set(review.author, {
        id: review.author,
        name: getDisplayName(review.author),
        avatar: review.author_avatar,
        reviewsGiven: 0,
        reviewsReceived: 0,
        prsOpened: 0,
        prsMerged: 0,
        commits: 0
      })
    }
    nodesMap.get(review.author)!.reviewsReceived++
  }

  // Add PR authors and stats
  for (const pr of prs) {
    if (!nodesMap.has(pr.author)) {
      nodesMap.set(pr.author, {
        id: pr.author,
        name: getDisplayName(pr.author),
        avatar: pr.author_avatar,
        reviewsGiven: 0,
        reviewsReceived: 0,
        prsOpened: 0,
        prsMerged: 0,
        commits: 0
      })
    }
    nodesMap.get(pr.author)!.prsOpened++
    if (pr.state === 'merged' || pr.merged_at) {
      nodesMap.get(pr.author)!.prsMerged++
    }
  }

  // Try to match commits to GitHub users via email
  const emailToGithub = getEmailToGitHubMap()
  for (const commit of commits) {
    const githubLogin = emailToGithub.get(commit.email.toLowerCase())
    if (githubLogin && nodesMap.has(githubLogin)) {
      nodesMap.get(githubLogin)!.commits += commit.count
    }
  }

  // Build edges map
  const edgesMap = new Map<string, CollaborationEdge>()

  for (const review of reviews) {
    // Skip self-reviews
    if (review.reviewer === review.author) continue

    const edgeKey = `${review.reviewer}->${review.author}`
    if (!edgesMap.has(edgeKey)) {
      edgesMap.set(edgeKey, {
        from: review.reviewer,
        to: review.author,
        weight: 0,
        reviewsGiven: 0,
        prsReviewed: []
      })
    }

    const edge = edgesMap.get(edgeKey)!
    edge.weight++
    edge.reviewsGiven++
    if (!edge.prsReviewed.includes(review.pr_number)) {
      edge.prsReviewed.push(review.pr_number)
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values())
  }
}

/**
 * Get map of email to GitHub username
 */
function getEmailToGitHubMap(): Map<string, string> {
  const db = getDatabase()
  const map = new Map<string, string>()

  // From contributor profiles with github_username
  const profiles = db
    .prepare(
      `
    SELECT ce.email, cp.github_username
    FROM contributor_emails ce
    JOIN contributor_profiles cp ON ce.profile_id = cp.id
    WHERE cp.github_username IS NOT NULL
  `
    )
    .all() as Array<{ email: string; github_username: string }>

  for (const profile of profiles) {
    map.set(profile.email.toLowerCase(), profile.github_username)
  }

  return map
}

/**
 * Get map of GitHub username to display name from contributor profiles
 */
function getGitHubToDisplayNameMap(): Map<string, string> {
  const db = getDatabase()
  const map = new Map<string, string>()

  const profiles = db
    .prepare(
      `
    SELECT github_username, display_name
    FROM contributor_profiles
    WHERE github_username IS NOT NULL
  `
    )
    .all() as Array<{ github_username: string; display_name: string }>

  for (const profile of profiles) {
    map.set(profile.github_username.toLowerCase(), profile.display_name)
  }

  return map
}

/**
 * Get top collaborators (most interactions)
 */
export function getTopCollaborators(
  dateFrom: string,
  dateTo: string,
  limit: number = 5
): Array<{ user: string; avatar: string | null; interactions: number }> {
  const graph = buildCollaborationGraph(dateFrom, dateTo)

  // Sum interactions per user (use node.name which already has display names)
  const interactions = new Map<string, { name: string; avatar: string | null; count: number }>()

  for (const node of graph.nodes) {
    interactions.set(node.id, {
      name: node.name,
      avatar: node.avatar,
      count: node.reviewsGiven + node.reviewsReceived
    })
  }

  return Array.from(interactions.entries())
    .map(([, data]) => ({ user: data.name, avatar: data.avatar, interactions: data.count }))
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, limit)
}

/**
 * Get collaboration stats summary
 */
export function getCollaborationStats(
  dateFrom: string,
  dateTo: string
): {
  totalReviews: number
  totalReviewers: number
  averageReviewsPerPR: number
  topReviewer: { name: string; count: number } | null
} {
  const db = getDatabase()

  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total_reviews,
      COUNT(DISTINCT reviewer) as total_reviewers
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
  `
    )
    .get(dateFrom, dateTo) as { total_reviews: number; total_reviewers: number }

  const prCount = db
    .prepare(
      `
    SELECT COUNT(DISTINCT pr_number || '-' || repo_id) as count
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
  `
    )
    .get(dateFrom, dateTo) as { count: number }

  const topReviewer = db
    .prepare(
      `
    SELECT reviewer as name, COUNT(*) as count
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
    GROUP BY reviewer
    ORDER BY count DESC
    LIMIT 1
  `
    )
    .get(dateFrom, dateTo) as { name: string; count: number } | undefined

  // Get display name for top reviewer
  let topReviewerResult: { name: string; count: number } | null = null
  if (topReviewer) {
    const displayNameMap = getGitHubToDisplayNameMap()
    topReviewerResult = {
      name: displayNameMap.get(topReviewer.name.toLowerCase()) || topReviewer.name,
      count: topReviewer.count
    }
  }

  return {
    totalReviews: stats.total_reviews,
    totalReviewers: stats.total_reviewers,
    averageReviewsPerPR: prCount.count > 0 ? stats.total_reviews / prCount.count : 0,
    topReviewer: topReviewerResult
  }
}

/**
 * Enhanced review metrics with time-based and quality analysis
 */
export interface EnhancedReviewMetrics {
  // Time-based metrics (in hours)
  avgTimeToFirstReview: number | null
  avgTimeToMerge: number | null
  medianTimeToFirstReview: number | null
  medianTimeToMerge: number | null

  // Quality metrics
  approvalRate: number
  changesRequestedRate: number
  avgReviewRounds: number

  // Health indicators
  selfMergeRate: number
  stalePRCount: number
  reviewLoadBalance: number // 0-100, higher = more evenly distributed

  // Reviewer breakdown
  reviewerStats: Array<{
    name: string
    avatar: string | null
    reviewsGiven: number
    avgResponseTimeHours: number | null
    approvalRate: number
  }>

  // Bottleneck detection
  pendingReviewers: Array<{
    name: string
    avatar: string | null
    pendingCount: number
  }>
}

export function getEnhancedReviewMetrics(
  dateFrom: string,
  dateTo: string
): EnhancedReviewMetrics {
  const db = getDatabase()
  const displayNameMap = getGitHubToDisplayNameMap()

  // Get PRs with their first review time and merge time
  const prsWithTiming = db
    .prepare(
      `
    SELECT
      p.repo_id,
      p.pr_number,
      p.author,
      p.created_at,
      p.merged_at,
      p.state,
      (
        SELECT MIN(r.submitted_at)
        FROM github_reviews r
        WHERE r.repo_id = p.repo_id AND r.pr_number = p.pr_number
      ) as first_review_at,
      (
        SELECT COUNT(*)
        FROM github_reviews r
        WHERE r.repo_id = p.repo_id AND r.pr_number = p.pr_number
      ) as review_count
    FROM github_pull_requests p
    WHERE p.created_at >= ? AND p.created_at <= ?
  `
    )
    .all(dateFrom, dateTo) as Array<{
    repo_id: number
    pr_number: number
    author: string
    created_at: string
    merged_at: string | null
    state: string
    first_review_at: string | null
    review_count: number
  }>

  // Calculate time to first review (in hours)
  const timeToFirstReviews: number[] = []
  const timeToMerges: number[] = []
  let selfMergeCount = 0
  let mergedCount = 0

  for (const pr of prsWithTiming) {
    if (pr.first_review_at && pr.created_at) {
      const created = new Date(pr.created_at).getTime()
      const firstReview = new Date(pr.first_review_at).getTime()
      const hours = (firstReview - created) / (1000 * 60 * 60)
      if (hours >= 0) {
        timeToFirstReviews.push(hours)
      }
    }

    if (pr.merged_at && pr.created_at) {
      const created = new Date(pr.created_at).getTime()
      const merged = new Date(pr.merged_at).getTime()
      const hours = (merged - created) / (1000 * 60 * 60)
      if (hours >= 0) {
        timeToMerges.push(hours)
        mergedCount++
        if (pr.review_count === 0) {
          selfMergeCount++
        }
      }
    }
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const median = (arr: number[]) => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  // Review state breakdown
  const reviewStates = db
    .prepare(
      `
    SELECT state, COUNT(*) as count
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
    GROUP BY state
  `
    )
    .all(dateFrom, dateTo) as Array<{ state: string; count: number }>

  const totalReviewsByState = reviewStates.reduce((sum, r) => sum + r.count, 0)
  const approvedCount = reviewStates.find((r) => r.state === 'approved')?.count || 0
  const changesRequestedCount = reviewStates.find((r) => r.state === 'changes_requested')?.count || 0

  // Average review rounds per PR
  const reviewRoundsData = db
    .prepare(
      `
    SELECT repo_id || '-' || pr_number as pr_key, COUNT(*) as rounds
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
    GROUP BY repo_id, pr_number
  `
    )
    .all(dateFrom, dateTo) as Array<{ pr_key: string; rounds: number }>

  const avgReviewRounds =
    reviewRoundsData.length > 0
      ? reviewRoundsData.reduce((sum, r) => sum + r.rounds, 0) / reviewRoundsData.length
      : 0

  // Stale PRs - open PRs without a review in >3 days
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const stalePRs = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM github_pull_requests p
    WHERE p.state = 'open'
      AND p.created_at <= ?
      AND NOT EXISTS (
        SELECT 1 FROM github_reviews r
        WHERE r.repo_id = p.repo_id AND r.pr_number = p.pr_number
      )
  `
    )
    .get(threeDaysAgo.toISOString()) as { count: number }

  // Review load balance
  const reviewerCounts = db
    .prepare(
      `
    SELECT reviewer, COUNT(*) as count
    FROM github_reviews
    WHERE submitted_at >= ? AND submitted_at <= ?
    GROUP BY reviewer
  `
    )
    .all(dateFrom, dateTo) as Array<{ reviewer: string; count: number }>

  let reviewLoadBalance = 100
  if (reviewerCounts.length > 1) {
    const counts = reviewerCounts.map((r) => r.count).sort((a, b) => a - b)
    const totalReviews = counts.reduce((a, b) => a + b, 0)
    const mean = totalReviews / counts.length
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 0
    reviewLoadBalance = Math.max(0, Math.min(100, Math.round(100 - cv * 50)))
  }

  // Per-reviewer stats
  const reviewerDetails = db
    .prepare(
      `
    SELECT
      r.reviewer,
      r.reviewer_avatar,
      COUNT(*) as review_count,
      SUM(CASE WHEN r.state = 'approved' THEN 1 ELSE 0 END) as approvals,
      AVG(
        CASE
          WHEN p.created_at IS NOT NULL
          THEN (julianday(r.submitted_at) - julianday(p.created_at)) * 24
          ELSE NULL
        END
      ) as avg_response_hours
    FROM github_reviews r
    JOIN github_pull_requests p ON r.repo_id = p.repo_id AND r.pr_number = p.pr_number
    WHERE r.submitted_at >= ? AND r.submitted_at <= ?
    GROUP BY r.reviewer
    ORDER BY review_count DESC
    LIMIT 10
  `
    )
    .all(dateFrom, dateTo) as Array<{
    reviewer: string
    reviewer_avatar: string | null
    review_count: number
    approvals: number
    avg_response_hours: number | null
  }>

  // Authors with open PRs waiting for review
  const pendingReviewers = db
    .prepare(
      `
    SELECT
      p.author as name,
      p.author_avatar as avatar,
      COUNT(*) as pending_count
    FROM github_pull_requests p
    WHERE p.state = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM github_reviews r
        WHERE r.repo_id = p.repo_id AND r.pr_number = p.pr_number
      )
    GROUP BY p.author
    ORDER BY pending_count DESC
    LIMIT 5
  `
    )
    .all() as Array<{ name: string; avatar: string | null; pending_count: number }>

  return {
    avgTimeToFirstReview: avg(timeToFirstReviews),
    avgTimeToMerge: avg(timeToMerges),
    medianTimeToFirstReview: median(timeToFirstReviews),
    medianTimeToMerge: median(timeToMerges),

    approvalRate: totalReviewsByState > 0 ? (approvedCount / totalReviewsByState) * 100 : 0,
    changesRequestedRate:
      totalReviewsByState > 0 ? (changesRequestedCount / totalReviewsByState) * 100 : 0,
    avgReviewRounds,

    selfMergeRate: mergedCount > 0 ? (selfMergeCount / mergedCount) * 100 : 0,
    stalePRCount: stalePRs.count,
    reviewLoadBalance,

    reviewerStats: reviewerDetails.map((r) => ({
      name: displayNameMap.get(r.reviewer.toLowerCase()) || r.reviewer,
      avatar: r.reviewer_avatar,
      reviewsGiven: r.review_count,
      avgResponseTimeHours: r.avg_response_hours,
      approvalRate: r.review_count > 0 ? (r.approvals / r.review_count) * 100 : 0
    })),

    pendingReviewers: pendingReviewers.map((r) => ({
      name: displayNameMap.get(r.name.toLowerCase()) || r.name,
      avatar: r.avatar,
      pendingCount: r.pending_count
    }))
  }
}
