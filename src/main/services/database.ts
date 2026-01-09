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

  // Run migrations
  runMigrations(db)

  console.log(`Database initialized at: ${dbPath}`)

  return db
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  // Migration: Convert excluded_contributors setting to contributor_profiles
  migrateExcludedContributors(database)
}

/**
 * Migrate existing excluded_contributors JSON setting to contributor_profiles table
 */
function migrateExcludedContributors(database: Database.Database): void {
  // Check if migration already done
  const migrationDone = database
    .prepare("SELECT value FROM settings WHERE key = 'excluded_contributors_migrated'")
    .get() as { value: string } | undefined

  if (migrationDone) return

  // Get old excluded_contributors setting
  const oldSetting = database
    .prepare("SELECT value FROM settings WHERE key = 'excluded_contributors'")
    .get() as { value: string } | undefined

  if (oldSetting?.value) {
    try {
      const excludedEmails: string[] = JSON.parse(oldSetting.value)

      if (excludedEmails.length > 0) {
        const transaction = database.transaction(() => {
          for (const email of excludedEmails) {
            // Check if email already has a profile
            const existing = database
              .prepare('SELECT profile_id FROM contributor_emails WHERE email = ?')
              .get(email.toLowerCase()) as { profile_id: number } | undefined

            if (existing) {
              // Mark existing profile as excluded
              database
                .prepare('UPDATE contributor_profiles SET is_excluded = 1 WHERE id = ?')
                .run(existing.profile_id)
            } else {
              // Create a new excluded profile (use email as display name initially)
              const result = database
                .prepare('INSERT INTO contributor_profiles (display_name, is_excluded) VALUES (?, 1)')
                .run(email)

              const profileId = result.lastInsertRowid

              // Link the email to the profile
              database
                .prepare('INSERT INTO contributor_emails (email, profile_id, is_primary, original_name) VALUES (?, ?, 1, ?)')
                .run(email.toLowerCase(), profileId, email)
            }
          }
        })

        transaction()
        console.log(`Migrated ${excludedEmails.length} excluded contributors to profiles`)
      }
    } catch (e) {
      console.error('Failed to migrate excluded contributors:', e)
    }
  }

  // Mark migration as complete
  database
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('excluded_contributors_migrated', 'true')")
    .run()
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
