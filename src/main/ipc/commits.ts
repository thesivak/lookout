/**
 * Commits IPC handlers for syncing and querying categorized commits
 */

import { ipcMain } from 'electron'
import { getDatabase } from '../services/database'
import { getCommitsWithStats, getCommitFiles } from '../services/git'
import { categorizeCommit, calculateBreakdown, CommitCategory, CategoryBreakdown } from '../services/categorization'

interface StoredCommit {
  id: number
  hash: string
  repo_id: number
  author_email: string
  author_name: string
  date: string
  message: string
  is_merge: number
  additions: number
  deletions: number
  files_changed: number
  files_list: string | null
  category: CommitCategory
  created_at: string
}

export function registerCommitHandlers(): void {
  /**
   * Sync commits from git to database with categorization
   */
  ipcMain.handle(
    'commits:sync',
    async (
      _,
      options: {
        repoId?: number
        dateFrom: string
        dateTo: string
        authorEmail?: string
      }
    ) => {
      try {
        const db = getDatabase()
        let repos: Array<{ id: number; path: string; name: string }>

        if (options.repoId) {
          const repo = db
            .prepare('SELECT id, path, name FROM repositories WHERE id = ? AND is_available = 1')
            .get(options.repoId) as { id: number; path: string; name: string } | undefined

          if (!repo) {
            return { success: false, error: 'Repository not found', synced: 0 }
          }
          repos = [repo]
        } else {
          repos = db
            .prepare('SELECT id, path, name FROM repositories WHERE is_available = 1')
            .all() as Array<{ id: number; path: string; name: string }>
        }

        let totalSynced = 0

        for (const repo of repos) {
          try {
            // Get commits from git
            const commits = await getCommitsWithStats(
              repo.path,
              new Date(options.dateFrom),
              new Date(options.dateTo),
              options.authorEmail
            )

            for (const commit of commits) {
              // Try to get file list for better categorization
              let filesList: string[] = []
              try {
                filesList = await getCommitFiles(repo.path, commit.hash)
              } catch {
                // Ignore errors getting files
              }

              // Categorize the commit
              const { category } = categorizeCommit(
                commit.message,
                filesList,
                commit.isMerge
              )

              // Insert or update commit
              db.prepare(`
                INSERT OR REPLACE INTO commits
                (hash, repo_id, author_email, author_name, date, message,
                 is_merge, additions, deletions, files_changed, files_list, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                commit.hash,
                repo.id,
                commit.authorEmail,
                commit.authorName,
                commit.date,
                commit.message,
                commit.isMerge ? 1 : 0,
                commit.additions,
                commit.deletions,
                commit.filesChanged,
                filesList.length > 0 ? JSON.stringify(filesList) : null,
                category
              )

              totalSynced++
            }
          } catch (error) {
            console.error(`Failed to sync commits for repo ${repo.name}:`, error)
          }
        }

        return { success: true, synced: totalSynced }
      } catch (error) {
        console.error('Failed to sync commits:', error)
        return { success: false, error: String(error), synced: 0 }
      }
    }
  )

  /**
   * List commits with filters
   */
  ipcMain.handle(
    'commits:list',
    async (
      _,
      options: {
        repoId?: number
        dateFrom?: string
        dateTo?: string
        authorEmail?: string
        category?: CommitCategory
        limit?: number
        offset?: number
      }
    ) => {
      try {
        const db = getDatabase()
        let query = 'SELECT * FROM commits WHERE 1=1'
        const params: (string | number)[] = []

        if (options.repoId) {
          query += ' AND repo_id = ?'
          params.push(options.repoId)
        }

        if (options.dateFrom) {
          query += ' AND date >= ?'
          params.push(options.dateFrom)
        }

        if (options.dateTo) {
          query += ' AND date <= ?'
          params.push(options.dateTo)
        }

        if (options.authorEmail) {
          query += ' AND LOWER(author_email) = LOWER(?)'
          params.push(options.authorEmail)
        }

        if (options.category) {
          query += ' AND category = ?'
          params.push(options.category)
        }

        query += ' ORDER BY date DESC'

        if (options.limit) {
          query += ' LIMIT ?'
          params.push(options.limit)
        }

        if (options.offset) {
          query += ' OFFSET ?'
          params.push(options.offset)
        }

        const commits = db.prepare(query).all(...params) as StoredCommit[]

        return {
          success: true,
          commits: commits.map((c) => ({
            ...c,
            isMerge: c.is_merge === 1,
            filesList: c.files_list ? JSON.parse(c.files_list) : []
          }))
        }
      } catch (error) {
        console.error('Failed to list commits:', error)
        return { success: false, error: String(error), commits: [] }
      }
    }
  )

  /**
   * Get category breakdown for a date range
   */
  ipcMain.handle(
    'commits:breakdown',
    async (
      _,
      options: {
        repoId?: number
        dateFrom: string
        dateTo: string
        authorEmail?: string
      }
    ) => {
      try {
        const db = getDatabase()
        let query = `
          SELECT category, COUNT(*) as count
          FROM commits
          WHERE date >= ? AND date <= ?
        `
        const params: (string | number)[] = [options.dateFrom, options.dateTo]

        if (options.repoId) {
          query += ' AND repo_id = ?'
          params.push(options.repoId)
        }

        if (options.authorEmail) {
          query += ' AND LOWER(author_email) = LOWER(?)'
          params.push(options.authorEmail)
        }

        query += ' GROUP BY category'

        const rows = db.prepare(query).all(...params) as Array<{
          category: CommitCategory
          count: number
        }>

        // Convert to breakdown format
        const breakdown: CategoryBreakdown = {
          feature: 0,
          bugfix: 0,
          refactor: 0,
          test: 0,
          docs: 0,
          chore: 0,
          merge: 0,
          other: 0,
          total: 0
        }

        for (const row of rows) {
          breakdown[row.category] = row.count
          breakdown.total += row.count
        }

        return { success: true, breakdown }
      } catch (error) {
        console.error('Failed to get breakdown:', error)
        return { success: false, error: String(error), breakdown: null }
      }
    }
  )

  /**
   * Get commits grouped by category
   */
  ipcMain.handle(
    'commits:by-category',
    async (
      _,
      options: {
        dateFrom: string
        dateTo: string
        authorEmail?: string
      }
    ) => {
      try {
        const db = getDatabase()
        let query = `
          SELECT * FROM commits
          WHERE date >= ? AND date <= ?
        `
        const params: (string | number)[] = [options.dateFrom, options.dateTo]

        if (options.authorEmail) {
          query += ' AND LOWER(author_email) = LOWER(?)'
          params.push(options.authorEmail)
        }

        query += ' ORDER BY category, date DESC'

        const commits = db.prepare(query).all(...params) as StoredCommit[]

        // Group by category
        const grouped: Record<CommitCategory, typeof commits> = {
          feature: [],
          bugfix: [],
          refactor: [],
          test: [],
          docs: [],
          chore: [],
          merge: [],
          other: []
        }

        for (const commit of commits) {
          grouped[commit.category].push(commit)
        }

        // Calculate breakdown
        const categories = commits.map((c) => c.category)
        const breakdown = calculateBreakdown(categories)

        return { success: true, grouped, breakdown }
      } catch (error) {
        console.error('Failed to get commits by category:', error)
        return { success: false, error: String(error), grouped: null, breakdown: null }
      }
    }
  )

  /**
   * Recategorize all commits (useful after updating categorization logic)
   */
  ipcMain.handle('commits:recategorize', async () => {
    try {
      const db = getDatabase()
      const commits = db.prepare('SELECT id, message, is_merge, files_list FROM commits').all() as Array<{
        id: number
        message: string
        is_merge: number
        files_list: string | null
      }>

      let updated = 0

      for (const commit of commits) {
        const filesList = commit.files_list ? JSON.parse(commit.files_list) : []
        const { category } = categorizeCommit(commit.message, filesList, commit.is_merge === 1)

        db.prepare('UPDATE commits SET category = ? WHERE id = ?').run(category, commit.id)
        updated++
      }

      return { success: true, updated }
    } catch (error) {
      console.error('Failed to recategorize commits:', error)
      return { success: false, error: String(error), updated: 0 }
    }
  })
}
