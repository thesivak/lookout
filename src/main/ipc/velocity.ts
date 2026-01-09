/**
 * Velocity IPC handlers
 */

import { ipcMain } from 'electron'
import {
  getVelocityTrend,
  getTeamBenchmarks,
  getActivityByRepo,
  saveVelocitySnapshot
} from '../services/velocity'
import { startOfWeek } from 'date-fns'

export function registerVelocityHandlers(): void {
  /**
   * Get velocity trend for a profile or team
   */
  ipcMain.handle(
    'velocity:get-trend',
    async (_, options: { profileId?: number; weeks?: number }) => {
      try {
        const trend = getVelocityTrend(options.profileId ?? null, options.weeks ?? 8)
        return { success: true, trend }
      } catch (error) {
        console.error('Failed to get velocity trend:', error)
        return { success: false, error: String(error), trend: [] }
      }
    }
  )

  /**
   * Get team benchmarks
   */
  ipcMain.handle('velocity:get-benchmarks', async (_, userEmail?: string) => {
    try {
      const benchmarks = getTeamBenchmarks(userEmail)
      return { success: true, benchmarks }
    } catch (error) {
      console.error('Failed to get team benchmarks:', error)
      return {
        success: false,
        error: String(error),
        benchmarks: {
          average: 0,
          median: 0,
          max: 0,
          yourCommits: 0,
          yourRank: 0,
          totalMembers: 0,
          percentile: 0
        }
      }
    }
  })

  /**
   * Get activity by repo
   */
  ipcMain.handle(
    'velocity:get-activity-by-repo',
    async (_, options: { dateFrom: string; dateTo: string }) => {
      try {
        const activity = getActivityByRepo(options.dateFrom, options.dateTo)
        return { success: true, activity }
      } catch (error) {
        console.error('Failed to get activity by repo:', error)
        return { success: false, error: String(error), activity: [] }
      }
    }
  )

  /**
   * Save velocity snapshot for current week
   */
  ipcMain.handle('velocity:save-snapshot', async (_, profileId?: number) => {
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      saveVelocitySnapshot(profileId ?? null, weekStart)
      return { success: true }
    } catch (error) {
      console.error('Failed to save velocity snapshot:', error)
      return { success: false, error: String(error) }
    }
  })
}
