/**
 * Danger Zone IPC handlers for destructive operations
 */

import { ipcMain, app } from 'electron'
import { getDatabase, getDatabasePath, closeDatabase, initDatabase } from '../services/database'
import { unlinkSync, existsSync } from 'fs'
import { removeGitHubToken } from '../services/github'

export function registerDangerZoneHandlers(): void {
  /**
   * Clear all summaries from the database
   */
  ipcMain.handle('dangerzone:clear-summaries', async () => {
    try {
      const db = getDatabase()
      const result = db.prepare('DELETE FROM summaries').run()
      return { success: true, deleted: result.changes }
    } catch (error) {
      console.error('Failed to clear summaries:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Clear all GitHub data (PRs, reviews, issues, token)
   */
  ipcMain.handle('dangerzone:clear-github', async () => {
    try {
      const db = getDatabase()

      // Clear GitHub tables
      db.prepare('DELETE FROM github_pull_requests').run()
      db.prepare('DELETE FROM github_reviews').run()
      db.prepare('DELETE FROM github_issues').run()

      // Reset GitHub flags on repositories
      db.prepare(`
        UPDATE repositories
        SET is_github = 0, github_owner = NULL, github_repo = NULL, last_github_sync = NULL
      `).run()

      // Remove GitHub token
      removeGitHubToken()

      return { success: true }
    } catch (error) {
      console.error('Failed to clear GitHub data:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Clear all synced commits from the database
   */
  ipcMain.handle('dangerzone:clear-commits', async () => {
    try {
      const db = getDatabase()
      const result = db.prepare('DELETE FROM synced_commits').run()
      return { success: true, deleted: result.changes }
    } catch (error) {
      console.error('Failed to clear commits:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Reset all settings to defaults
   */
  ipcMain.handle('dangerzone:reset-settings', async () => {
    try {
      const db = getDatabase()

      // Keep migration markers but reset user settings
      const migrationKeys = [
        'excluded_contributors_migrated',
        'github_columns_migrated',
        'summary_categories_migrated'
      ]

      db.prepare(`
        DELETE FROM settings
        WHERE key NOT IN (${migrationKeys.map(() => '?').join(', ')})
      `).run(...migrationKeys)

      return { success: true }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Delete the entire database and restart fresh
   * This is the most destructive operation
   */
  ipcMain.handle('dangerzone:reset-database', async () => {
    try {
      const dbPath = getDatabasePath()

      // Close the database connection
      closeDatabase()

      // Delete database files
      if (existsSync(dbPath)) {
        unlinkSync(dbPath)
      }
      if (existsSync(dbPath + '-wal')) {
        unlinkSync(dbPath + '-wal')
      }
      if (existsSync(dbPath + '-shm')) {
        unlinkSync(dbPath + '-shm')
      }

      // Reinitialize database with fresh schema
      initDatabase()

      return { success: true }
    } catch (error) {
      console.error('Failed to reset database:', error)
      return { success: false, error: String(error) }
    }
  })

  /**
   * Get database statistics for the danger zone UI
   */
  ipcMain.handle('dangerzone:get-stats', async () => {
    try {
      const db = getDatabase()

      const summaryCount = (db.prepare('SELECT COUNT(*) as count FROM summaries').get() as { count: number }).count
      const repoCount = (db.prepare('SELECT COUNT(*) as count FROM repositories').get() as { count: number }).count
      const commitCount = (db.prepare('SELECT COUNT(*) as count FROM synced_commits').get() as { count: number }).count
      const prCount = (db.prepare('SELECT COUNT(*) as count FROM github_pull_requests').get() as { count: number }).count
      const reviewCount = (db.prepare('SELECT COUNT(*) as count FROM github_reviews').get() as { count: number }).count
      const profileCount = (db.prepare('SELECT COUNT(*) as count FROM contributor_profiles').get() as { count: number }).count

      return {
        success: true,
        stats: {
          summaries: summaryCount,
          repositories: repoCount,
          commits: commitCount,
          pullRequests: prCount,
          reviews: reviewCount,
          contributorProfiles: profileCount
        }
      }
    } catch (error) {
      console.error('Failed to get danger zone stats:', error)
      return { success: false, error: String(error), stats: null }
    }
  })

  /**
   * Restart the application
   */
  ipcMain.handle('dangerzone:restart-app', async () => {
    app.relaunch()
    app.exit(0)
  })
}
