import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { schema } from '../db/schema'

let db: Database.Database | null = null

export function getAppDataPath(): string {
  return join(app.getPath('userData'))
}

export function getPromptsPath(): string {
  return join(getAppDataPath(), 'prompts')
}

export function getDatabasePath(): string {
  return join(getAppDataPath(), 'lookout.db')
}

export function initDatabase(): Database.Database {
  if (db) return db

  // Ensure app data directory exists
  const appDataPath = getAppDataPath()
  if (!existsSync(appDataPath)) {
    mkdirSync(appDataPath, { recursive: true })
  }

  // Ensure prompts directory exists
  const promptsPath = getPromptsPath()
  if (!existsSync(promptsPath)) {
    mkdirSync(promptsPath, { recursive: true })
  }

  // Create/open database
  const dbPath = getDatabasePath()
  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(schema)

  console.log(`Database initialized at: ${dbPath}`)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// Alias for convenience
export const getDb = getDatabase

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
