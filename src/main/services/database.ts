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

  // Migration: Add GitHub-related columns
  migrateGitHubColumns(database)

  // Migration: Add category_breakdown to summaries
  migrateSummaryCategories(database)

  // Migration: Make repos work without local paths (GitHub-centric)
  migrateGitHubCentricRepos(database)
}

/**
 * Add GitHub-related columns to repositories and contributor_profiles
 */
function migrateGitHubColumns(database: Database.Database): void {
  const migrationKey = 'github_columns_migrated'
  const migrationDone = database
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(migrationKey) as { value: string } | undefined

  if (migrationDone) return

  try {
    // Add columns to repositories
    const repoColumns = [
      'ALTER TABLE repositories ADD COLUMN is_github INTEGER DEFAULT 0',
      'ALTER TABLE repositories ADD COLUMN github_owner TEXT',
      'ALTER TABLE repositories ADD COLUMN github_repo TEXT',
      'ALTER TABLE repositories ADD COLUMN last_github_sync TEXT'
    ]

    for (const sql of repoColumns) {
      try {
        database.exec(sql)
      } catch (e) {
        // Column may already exist, ignore
      }
    }

    // Add columns to contributor_profiles
    const profileColumns = [
      'ALTER TABLE contributor_profiles ADD COLUMN avatar_url TEXT',
      'ALTER TABLE contributor_profiles ADD COLUMN github_username TEXT'
    ]

    for (const sql of profileColumns) {
      try {
        database.exec(sql)
      } catch (e) {
        // Column may already exist, ignore
      }
    }

    database
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(migrationKey, 'true')

    console.log('GitHub columns migration completed')
  } catch (e) {
    console.error('Failed to migrate GitHub columns:', e)
  }
}

/**
 * Add category_breakdown column to summaries
 */
function migrateSummaryCategories(database: Database.Database): void {
  const migrationKey = 'summary_categories_migrated'
  const migrationDone = database
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(migrationKey) as { value: string } | undefined

  if (migrationDone) return

  try {
    database.exec('ALTER TABLE summaries ADD COLUMN category_breakdown TEXT')
  } catch (e) {
    // Column may already exist, ignore
  }

  database
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(migrationKey, 'true')

  console.log('Summary categories migration completed')
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

/**
 * Migrate to GitHub-centric repos (make local path optional)
 */
function migrateGitHubCentricRepos(database: Database.Database): void {
  const migrationKey = 'github_centric_repos_migrated'
  const migrationDone = database
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(migrationKey) as { value: string } | undefined

  if (migrationDone) return

  try {
    // Make path column nullable and add full_name for GitHub repos
    // SQLite doesn't support ALTER COLUMN, so we need to work around the UNIQUE constraint
    // We'll add a new column for GitHub full name (owner/repo)
    const columns = [
      'ALTER TABLE repositories ADD COLUMN github_full_name TEXT',
      'ALTER TABLE repositories ADD COLUMN is_local INTEGER DEFAULT 1'
    ]

    for (const sql of columns) {
      try {
        database.exec(sql)
      } catch (e) {
        // Column may already exist, ignore
      }
    }

    // Update existing GitHub repos to set github_full_name
    database.exec(`
      UPDATE repositories
      SET github_full_name = github_owner || '/' || github_repo,
          is_local = 1
      WHERE github_owner IS NOT NULL AND github_repo IS NOT NULL
    `)

    database
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(migrationKey, 'true')

    console.log('GitHub-centric repos migration completed')
  } catch (e) {
    console.error('Failed to migrate to GitHub-centric repos:', e)
  }
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
