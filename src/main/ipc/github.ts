/**
 * GitHub IPC handlers
 */

import { ipcMain } from 'electron'
import { subDays } from 'date-fns'
import {
  initOctokit,
  validateToken,
  getGitHubToken,
  saveGitHubToken,
  removeGitHubToken,
  detectGitHubRepos,
  syncRepository,
  getPRsInRange,
  getReviewsInRange,
  GitHubRepo,
  GitHubPR
} from '../services/github'
import { getDatabase } from '../services/database'
import {
  buildCollaborationGraph,
  getCollaborationStats,
  getTopCollaborators,
  getEnhancedReviewMetrics
} from '../services/collaboration'

export function registerGitHubHandlers(): void {
  /**
   * Set GitHub token
   */
  ipcMain.handle('github:set-token', async (_, token: string) => {
    try {
      // Validate token first
      const user = await validateToken(token)
      if (!user) {
        return { success: false, error: 'Invalid token' }
      }

      // Save token and initialize Octokit
      saveGitHubToken(token)
      initOctokit(token)

      return { success: true, user }
    } catch (error) {
      console.error('Failed to set GitHub token:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Check if GitHub token is set and valid
   */
  ipcMain.handle('github:check-token', async () => {
    try {
      const token = getGitHubToken()
      if (!token) {
        return { connected: false }
      }

      const user = await validateToken(token)
      if (user) {
        initOctokit(token)
        return { connected: true, user }
      }

      return { connected: false }
    } catch (error) {
      console.error('Failed to check GitHub token:', error)
      return { connected: false }
    }
  })

  /**
   * Remove GitHub token
   */
  ipcMain.handle('github:disconnect', async () => {
    try {
      removeGitHubToken()
      return { success: true }
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Detect which repositories are GitHub repos
   */
  ipcMain.handle('github:detect-repos', async () => {
    try {
      const repos = await detectGitHubRepos()
      return { success: true, repos }
    } catch (error) {
      console.error('Failed to detect GitHub repos:', error)
      return { success: false, error: String(error), repos: [] }
    }
  })

  /**
   * Get GitHub status for all repos
   */
  ipcMain.handle('github:get-repo-status', async () => {
    try {
      const db = getDatabase()
      const repos = db
        .prepare(
          `
        SELECT id, name, path, is_github, github_owner, github_repo, last_github_sync
        FROM repositories
        WHERE is_github = 1
      `
        )
        .all() as Array<{
        id: number
        name: string
        path: string
        is_github: number
        github_owner: string | null
        github_repo: string | null
        last_github_sync: string | null
      }>

      return {
        success: true,
        repos: repos.map((r) => ({
          id: r.id,
          name: r.name,
          owner: r.github_owner,
          repo: r.github_repo,
          lastSync: r.last_github_sync
        }))
      }
    } catch (error) {
      console.error('Failed to get GitHub repo status:', error)
      return { success: false, error: String(error), repos: [] }
    }
  })

  /**
   * Sync a specific repository
   */
  ipcMain.handle('github:sync-repo', async (_, repoId: number) => {
    try {
      const db = getDatabase()
      const repo = db
        .prepare(
          `
        SELECT id, github_owner, github_repo
        FROM repositories
        WHERE id = ? AND is_github = 1
      `
        )
        .get(repoId) as {
        id: number
        github_owner: string
        github_repo: string
      } | null

      if (!repo) {
        return { success: false, error: 'Repository not found or not a GitHub repo' }
      }

      // Initialize Octokit if needed
      const token = getGitHubToken()
      if (!token) {
        return { success: false, error: 'GitHub not connected' }
      }
      initOctokit(token)

      // Sync last 30 days of data
      const since = subDays(new Date(), 30)
      const githubRepo: GitHubRepo = {
        owner: repo.github_owner,
        repo: repo.github_repo,
        repoId: repo.id
      }

      const stats = await syncRepository(githubRepo, since)

      return { success: true, stats }
    } catch (error) {
      console.error('Failed to sync GitHub repo:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Sync all GitHub repositories
   */
  ipcMain.handle('github:sync-all', async () => {
    try {
      const token = getGitHubToken()
      if (!token) {
        return { success: false, error: 'GitHub not connected' }
      }
      initOctokit(token)

      const db = getDatabase()
      const repos = db
        .prepare(
          `
        SELECT id, github_owner, github_repo
        FROM repositories
        WHERE is_github = 1
      `
        )
        .all() as Array<{
        id: number
        github_owner: string
        github_repo: string
      }>

      const since = subDays(new Date(), 30)
      const results: Array<{ repoId: number; stats: { prs: number; reviews: number; issues: number } }> = []

      for (const repo of repos) {
        const githubRepo: GitHubRepo = {
          owner: repo.github_owner,
          repo: repo.github_repo,
          repoId: repo.id
        }

        try {
          const stats = await syncRepository(githubRepo, since)
          results.push({ repoId: repo.id, stats })
        } catch (error) {
          console.error(`Failed to sync repo ${repo.id}:`, error)
        }
      }

      return { success: true, results }
    } catch (error) {
      console.error('Failed to sync all GitHub repos:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Get PRs for a date range
   */
  ipcMain.handle(
    'github:get-prs',
    async (_, options: { repoId?: number; dateFrom: string; dateTo: string }) => {
      try {
        const db = getDatabase()

        if (options.repoId) {
          const prs = getPRsInRange(options.repoId, options.dateFrom, options.dateTo)
          return { success: true, prs }
        }

        // Get PRs from all GitHub repos
        const repos = db
          .prepare('SELECT id FROM repositories WHERE is_github = 1')
          .all() as Array<{ id: number }>

        const allPrs: Array<GitHubPR & { repoId: number }> = []
        for (const repo of repos) {
          const prs = getPRsInRange(repo.id, options.dateFrom, options.dateTo)
          allPrs.push(...prs.map((pr) => ({ ...pr, repoId: repo.id })))
        }

        return { success: true, prs: allPrs }
      } catch (error) {
        console.error('Failed to get PRs:', error)
        return { success: false, error: String(error), prs: [] }
      }
    }
  )

  /**
   * Get reviews for a date range
   */
  ipcMain.handle(
    'github:get-reviews',
    async (_, options: { dateFrom: string; dateTo: string }) => {
      try {
        const reviews = getReviewsInRange(options.dateFrom, options.dateTo)
        return { success: true, reviews }
      } catch (error) {
        console.error('Failed to get reviews:', error)
        return { success: false, error: String(error), reviews: [] }
      }
    }
  )

  /**
   * Get issues for a date range
   */
  ipcMain.handle(
    'github:get-issues',
    async (_, options: { repoId?: number; dateFrom: string; dateTo: string }) => {
      try {
        const db = getDatabase()

        let query = `
          SELECT * FROM github_issues
          WHERE synced_at BETWEEN ? AND ?
        `
        const params: (string | number)[] = [options.dateFrom, options.dateTo]

        if (options.repoId) {
          query += ' AND repo_id = ?'
          params.push(options.repoId)
        }

        query += ' ORDER BY synced_at DESC'

        const issues = db.prepare(query).all(...params)
        return { success: true, issues }
      } catch (error) {
        console.error('Failed to get issues:', error)
        return { success: false, error: String(error), issues: [] }
      }
    }
  )

  /**
   * Get collaboration graph data
   */
  ipcMain.handle(
    'github:get-collaboration-graph',
    async (_, options: { dateFrom: string; dateTo: string }) => {
      try {
        const graph = buildCollaborationGraph(options.dateFrom, options.dateTo)
        return { success: true, graph }
      } catch (error) {
        console.error('Failed to get collaboration graph:', error)
        return { success: false, error: String(error), graph: { nodes: [], edges: [] } }
      }
    }
  )

  /**
   * Get collaboration stats
   */
  ipcMain.handle(
    'github:get-collaboration-stats',
    async (_, options: { dateFrom: string; dateTo: string }) => {
      try {
        const stats = getCollaborationStats(options.dateFrom, options.dateTo)
        return { success: true, stats }
      } catch (error) {
        console.error('Failed to get collaboration stats:', error)
        return {
          success: false,
          error: String(error),
          stats: { totalReviews: 0, totalReviewers: 0, averageReviewsPerPR: 0, topReviewer: null }
        }
      }
    }
  )

  /**
   * Get top collaborators
   */
  ipcMain.handle(
    'github:get-top-collaborators',
    async (_, options: { dateFrom: string; dateTo: string; limit?: number }) => {
      try {
        const collaborators = getTopCollaborators(options.dateFrom, options.dateTo, options.limit)
        return { success: true, collaborators }
      } catch (error) {
        console.error('Failed to get top collaborators:', error)
        return { success: false, error: String(error), collaborators: [] }
      }
    }
  )

  /**
   * Get enhanced review metrics (time-based, quality, and health indicators)
   */
  ipcMain.handle(
    'github:get-enhanced-review-metrics',
    async (_, options: { dateFrom: string; dateTo: string }) => {
      try {
        const metrics = getEnhancedReviewMetrics(options.dateFrom, options.dateTo)
        return { success: true, metrics }
      } catch (error) {
        console.error('Failed to get enhanced review metrics:', error)
        return {
          success: false,
          error: String(error),
          metrics: {
            avgTimeToFirstReview: null,
            avgTimeToMerge: null,
            medianTimeToFirstReview: null,
            medianTimeToMerge: null,
            approvalRate: 0,
            changesRequestedRate: 0,
            avgReviewRounds: 0,
            selfMergeRate: 0,
            stalePRCount: 0,
            reviewLoadBalance: 100,
            reviewerStats: [],
            pendingReviewers: []
          }
        }
      }
    }
  )
}
