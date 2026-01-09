import { ipcMain, BrowserWindow } from 'electron'
import { getDatabase } from '../services/database'

function notifySettingsChanged(key: string, value: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('settings:changed', key, value)
  }
}

export interface Settings {
  scheduled_time: string
  scheduled_enabled: string
  default_prompt_template: string
  date_range_default: string
  [key: string]: string
}

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle('settings:get-all', async (): Promise<Settings> => {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]

    const settings: Settings = {
      scheduled_time: '08:00',
      scheduled_enabled: 'false',
      default_prompt_template: 'technical',
      date_range_default: 'previous_day'
    }

    for (const row of rows) {
      settings[row.key] = row.value
    }

    return settings
  })

  // Get a single setting
  ipcMain.handle('settings:get', async (_, key: string): Promise<string | null> => {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  // Set a setting
  ipcMain.handle('settings:set', async (_, key: string, value: string): Promise<void> => {
    const db = getDatabase()
    db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
    ).run(key, value, value)

    // Notify about the change
    notifySettingsChanged(key, value)
  })

  // Set multiple settings
  ipcMain.handle('settings:set-many', async (_, settings: Record<string, string>): Promise<void> => {
    const db = getDatabase()
    const stmt = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
    )

    const transaction = db.transaction((items: [string, string][]) => {
      for (const [key, value] of items) {
        stmt.run(key, value, value)
      }
    })

    transaction(Object.entries(settings))
  })
}
