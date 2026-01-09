/**
 * GitHub API integration service using Octokit
 */

import { Octokit } from '@octokit/rest'
import { getDatabase } from './database'

// Types
export interface GitHubRepo {
  owner: string
  repo: string
  repoId: number // Local DB repo ID
}

export interface GitHubPR {
  number: number
  title: string
  description: string | null
  author: string
  authorAvatar: string | null
  state: 'open' | 'closed' | 'merged'
  labels: string[]
  linkedIssues: number[]
  additions: number
  deletions: number
  changedFiles: number
  commits: string[]
  createdAt: string
  mergedAt: string | null
  ciStatus: 'success' | 'failure' | 'pending' | null
}

export interface GitHubReview {
  prNumber: number
  reviewer: string
  reviewerAvatar: string | null
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed'
  body: string | null
  submittedAt: string
}

export interface GitHubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  labels: string[]
  author: string
  closedAt: string | null
}

export interface GitHubContributor {
  login: string
  email: string | null
  name: string | null
  avatarUrl: string
}

export interface GitHubUser {
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

let octokitInstance: Octokit | null = null

/**
 * Initialize Octokit with a GitHub token
 */
export function initOctokit(token: string): Octokit {
  octokitInstance = new Octokit({ auth: token })
  return octokitInstance
}

/**
 * Get the current Octokit instance
 */
export function getOctokit(): Octokit | null {
  return octokitInstance
}

/**
 * Parse GitHub remote URL to extract owner and repo
 * Supports formats:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo
 */
export function parseGitHubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // HTTPS format
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  // SSH format
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  return null
}

/**
 * Validate GitHub token and get user info
 */
export async function validateToken(token: string): Promise<GitHubUser | null> {
  try {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.users.getAuthenticated()

    return {
      login: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url
    }
  } catch (error) {
    console.error('Failed to validate GitHub token:', error)
    return null
  }
}

/**
 * Fetch pull requests for a repository
 * Optimized to minimize API calls - skips detailed info, CI status, and commits list
 */
export async function fetchPullRequests(
  repo: GitHubRepo,
  since: Date
): Promise<GitHubPR[]> {
  const octokit = getOctokit()
  if (!octokit) throw new Error('GitHub not initialized')

  const prs: GitHubPR[] = []

  try {
    // Fetch PRs updated since the given date
    const { data } = await octokit.pulls.list({
      owner: repo.owner,
      repo: repo.repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    })

    for (const pr of data) {
      const updatedAt = new Date(pr.updated_at)
      if (updatedAt < since) break

      // Extract linked issues from PR body
      const linkedIssues: number[] = []
      if (pr.body) {
        const issueRefs = pr.body.match(/#(\d+)/g)
        if (issueRefs) {
          linkedIssues.push(...issueRefs.map((ref) => parseInt(ref.slice(1))))
        }
      }

      // Determine if merged
      const state: 'open' | 'closed' | 'merged' =
        pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed'

      // Use data from list endpoint (no extra API calls)
      // Note: additions/deletions/changedFiles not available from list, set to 0
      prs.push({
        number: pr.number,
        title: pr.title,
        description: pr.body,
        author: pr.user?.login || 'unknown',
        authorAvatar: pr.user?.avatar_url || null,
        state,
        labels: pr.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        linkedIssues,
        additions: 0, // Would require extra API call
        deletions: 0,
        changedFiles: 0,
        commits: [], // Would require extra API call
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        ciStatus: null // Would require extra API call
      })
    }

    console.log(`Fetched ${prs.length} PRs for ${repo.owner}/${repo.repo}`)
  } catch (error) {
    console.error(`Failed to fetch PRs for ${repo.owner}/${repo.repo}:`, error)
  }

  return prs
}

/**
 * Fetch reviews for a pull request
 */
export async function fetchReviews(
  repo: GitHubRepo,
  prNumber: number
): Promise<GitHubReview[]> {
  const octokit = getOctokit()
  if (!octokit) throw new Error('GitHub not initialized')

  try {
    const { data } = await octokit.pulls.listReviews({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber,
      per_page: 100
    })

    return data.map((review) => ({
      prNumber,
      reviewer: review.user?.login || 'unknown',
      reviewerAvatar: review.user?.avatar_url || null,
      state: mapReviewState(review.state),
      body: review.body,
      submittedAt: review.submitted_at || new Date().toISOString()
    }))
  } catch (error) {
    console.error(`Failed to fetch reviews for PR #${prNumber}:`, error)
    return []
  }
}

function mapReviewState(
  state: string
): 'approved' | 'changes_requested' | 'commented' | 'dismissed' {
  switch (state.toUpperCase()) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes_requested'
    case 'DISMISSED':
      return 'dismissed'
    default:
      return 'commented'
  }
}

/**
 * Fetch issues for a repository
 */
export async function fetchIssues(repo: GitHubRepo, since: Date): Promise<GitHubIssue[]> {
  const octokit = getOctokit()
  if (!octokit) throw new Error('GitHub not initialized')

  try {
    const { data } = await octokit.issues.listForRepo({
      owner: repo.owner,
      repo: repo.repo,
      state: 'all',
      since: since.toISOString(),
      per_page: 100
    })

    // Filter out pull requests (GitHub API returns PRs as issues)
    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        author: issue.user?.login || 'unknown',
        closedAt: issue.closed_at
      }))
  } catch (error) {
    console.error(`Failed to fetch issues for ${repo.owner}/${repo.repo}:`, error)
    return []
  }
}

/**
 * Fetch contributors for a repository
 */
export async function fetchContributors(repo: GitHubRepo): Promise<GitHubContributor[]> {
  const octokit = getOctokit()
  if (!octokit) throw new Error('GitHub not initialized')

  try {
    const { data } = await octokit.repos.listContributors({
      owner: repo.owner,
      repo: repo.repo,
      per_page: 100
    })

    return data.map((contributor) => ({
      login: contributor.login || 'unknown',
      email: null, // Not available from this endpoint
      name: null,
      avatarUrl: contributor.avatar_url || ''
    }))
  } catch (error) {
    console.error(`Failed to fetch contributors for ${repo.owner}/${repo.repo}:`, error)
    return []
  }
}

/**
 * Sync a repository's GitHub data to the database
 * Optimized: Only fetches reviews for merged PRs to reduce API calls
 */
export async function syncRepository(repo: GitHubRepo, since: Date): Promise<{
  prs: number
  reviews: number
  issues: number
}> {
  const db = getDatabase()
  const stats = { prs: 0, reviews: 0, issues: 0 }

  console.log(`Syncing ${repo.owner}/${repo.repo}...`)

  // Fetch and save PRs
  const prs = await fetchPullRequests(repo, since)

  // Batch insert PRs first (no individual API calls)
  for (const pr of prs) {
    db.prepare(`
      INSERT OR REPLACE INTO github_pull_requests
      (repo_id, pr_number, title, description, author, author_avatar, state, labels,
       linked_issues, additions, deletions, changed_files, commits, ci_status,
       created_at, merged_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      repo.repoId,
      pr.number,
      pr.title,
      pr.description,
      pr.author,
      pr.authorAvatar,
      pr.state,
      JSON.stringify(pr.labels),
      JSON.stringify(pr.linkedIssues),
      pr.additions,
      pr.deletions,
      pr.changedFiles,
      JSON.stringify(pr.commits),
      pr.ciStatus,
      pr.createdAt,
      pr.mergedAt
    )
    stats.prs++
  }

  // Only fetch reviews for merged PRs (reduces API calls significantly)
  const mergedPRs = prs.filter((pr) => pr.state === 'merged').slice(0, 10) // Limit to 10 most recent
  for (const pr of mergedPRs) {
    try {
      const reviews = await fetchReviews(repo, pr.number)
      for (const review of reviews) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO github_reviews
            (repo_id, pr_number, reviewer, reviewer_avatar, state, body, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            repo.repoId,
            review.prNumber,
            review.reviewer,
            review.reviewerAvatar,
            review.state,
            review.body,
            review.submittedAt
          )
          stats.reviews++
        } catch {
          // Ignore duplicate key errors
        }
      }
    } catch (error) {
      console.error(`Failed to fetch reviews for PR #${pr.number}:`, error)
    }
  }

  // Fetch and save issues
  const issues = await fetchIssues(repo, since)
  for (const issue of issues) {
    db.prepare(`
      INSERT OR REPLACE INTO github_issues
      (repo_id, issue_number, title, state, labels, author, closed_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      repo.repoId,
      issue.number,
      issue.title,
      issue.state,
      JSON.stringify(issue.labels),
      issue.author,
      issue.closedAt
    )
    stats.issues++
  }

  // Update last sync time
  db.prepare(`
    UPDATE repositories
    SET last_github_sync = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(repo.repoId)

  console.log(`Synced ${repo.owner}/${repo.repo}: ${stats.prs} PRs, ${stats.reviews} reviews, ${stats.issues} issues`)

  return stats
}

/**
 * Get GitHub token from settings
 */
export function getGitHubToken(): string | null {
  const db = getDatabase()
  const result = db.prepare("SELECT value FROM settings WHERE key = 'github_token'").get() as
    | { value: string }
    | undefined

  return result?.value || null
}

/**
 * Save GitHub token to settings
 */
export function saveGitHubToken(token: string): void {
  const db = getDatabase()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('github_token', ?)").run(token)
}

/**
 * Remove GitHub token from settings
 */
export function removeGitHubToken(): void {
  const db = getDatabase()
  db.prepare("DELETE FROM settings WHERE key = 'github_token'").run()
  octokitInstance = null
}

/**
 * Detect which repositories are GitHub repos
 */
export async function detectGitHubRepos(): Promise<
  Array<{ repoId: number; owner: string; repo: string }>
> {
  const db = getDatabase()
  const repos = db.prepare('SELECT id, path FROM repositories').all() as Array<{
    id: number
    path: string
  }>

  const { execSync } = await import('child_process')
  const results: Array<{ repoId: number; owner: string; repo: string }> = []

  for (const repo of repos) {
    try {
      const remoteUrl = execSync('git remote get-url origin', {
        cwd: repo.path,
        encoding: 'utf-8'
      }).trim()

      const parsed = parseGitHubRemote(remoteUrl)
      if (parsed) {
        results.push({
          repoId: repo.id,
          owner: parsed.owner,
          repo: parsed.repo
        })

        // Update database
        db.prepare(`
          UPDATE repositories
          SET is_github = 1, github_owner = ?, github_repo = ?
          WHERE id = ?
        `).run(parsed.owner, parsed.repo, repo.id)
      }
    } catch {
      // Not a git repo or no origin remote
    }
  }

  return results
}

/**
 * Get PRs for a date range from database
 */
export function getPRsInRange(
  repoId: number,
  dateFrom: string,
  dateTo: string
): GitHubPR[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM github_pull_requests
    WHERE repo_id = ?
      AND (created_at BETWEEN ? AND ? OR merged_at BETWEEN ? AND ?)
    ORDER BY created_at DESC
  `).all(repoId, dateFrom, dateTo, dateFrom, dateTo) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    number: row.pr_number as number,
    title: row.title as string,
    description: row.description as string | null,
    author: row.author as string,
    authorAvatar: row.author_avatar as string | null,
    state: row.state as 'open' | 'closed' | 'merged',
    labels: JSON.parse((row.labels as string) || '[]'),
    linkedIssues: JSON.parse((row.linked_issues as string) || '[]'),
    additions: row.additions as number,
    deletions: row.deletions as number,
    changedFiles: row.changed_files as number,
    commits: JSON.parse((row.commits as string) || '[]'),
    createdAt: row.created_at as string,
    mergedAt: row.merged_at as string | null,
    ciStatus: row.ci_status as 'success' | 'failure' | 'pending' | null
  }))
}

/**
 * Get reviews for a date range from database
 */
export function getReviewsInRange(
  dateFrom: string,
  dateTo: string
): Array<GitHubReview & { repoId: number }> {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM github_reviews
    WHERE submitted_at BETWEEN ? AND ?
    ORDER BY submitted_at DESC
  `).all(dateFrom, dateTo) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    repoId: row.repo_id as number,
    prNumber: row.pr_number as number,
    reviewer: row.reviewer as string,
    reviewerAvatar: row.reviewer_avatar as string | null,
    state: row.state as 'approved' | 'changes_requested' | 'commented' | 'dismissed',
    body: row.body as string | null,
    submittedAt: row.submitted_at as string
  }))
}
