/**
 * Pre-generation IPC handlers
 */

import { ipcMain } from 'electron'
import {
  getPregenState,
  getPregenSummary,
  runBackgroundPregeneration
} from '../services/pregeneration'

export function registerPregenerationHandlers(): void {
  /**
   * Get current pre-generation status
   */
  ipcMain.handle('pregeneration:status', async () => {
    return getPregenState()
  })

  /**
   * Get pre-generated summary if available
   */
  ipcMain.handle('pregeneration:get-summary', async (_, type: 'personal' | 'team') => {
    const summary = getPregenSummary(type)
    return { success: true, summary }
  })

  /**
   * Manually trigger pre-generation
   */
  ipcMain.handle('pregeneration:trigger', async () => {
    try {
      await runBackgroundPregeneration()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
