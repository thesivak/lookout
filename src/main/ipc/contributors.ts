import { ipcMain } from 'electron'
import { getDatabase } from '../services/database'

export interface ContributorProfile {
  id: number
  displayName: string
  isExcluded: boolean
  emails: ContributorEmail[]
  createdAt: string
  updatedAt: string
}

export interface ContributorEmail {
  email: string
  profileId: number
  isPrimary: boolean
  originalName: string
  createdAt: string
}

interface ProfileRow {
  id: number
  display_name: string
  is_excluded: number
  created_at: string
  updated_at: string
}

interface EmailRow {
  email: string
  profile_id: number
  is_primary: number
  original_name: string
  created_at: string
}

function rowToProfile(row: ProfileRow, emails: ContributorEmail[]): ContributorProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    isExcluded: row.is_excluded === 1,
    emails,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToEmail(row: EmailRow): ContributorEmail {
  return {
    email: row.email,
    profileId: row.profile_id,
    isPrimary: row.is_primary === 1,
    originalName: row.original_name,
    createdAt: row.created_at
  }
}

export function registerContributorHandlers(): void {
  const db = getDatabase()

  // List all profiles with their emails
  ipcMain.handle('contributors:list-profiles', async (): Promise<ContributorProfile[]> => {
    const profiles = db.prepare('SELECT * FROM contributor_profiles ORDER BY display_name').all() as ProfileRow[]

    return profiles.map((profile) => {
      const emails = db
        .prepare('SELECT * FROM contributor_emails WHERE profile_id = ? ORDER BY is_primary DESC, email')
        .all(profile.id) as EmailRow[]
      return rowToProfile(profile, emails.map(rowToEmail))
    })
  })

  // Get a single profile by ID
  ipcMain.handle('contributors:get-profile', async (_, id: number): Promise<ContributorProfile | null> => {
    const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(id) as ProfileRow | undefined
    if (!profile) return null

    const emails = db
      .prepare('SELECT * FROM contributor_emails WHERE profile_id = ? ORDER BY is_primary DESC, email')
      .all(id) as EmailRow[]
    return rowToProfile(profile, emails.map(rowToEmail))
  })

  // Create a new profile with emails
  ipcMain.handle(
    'contributors:create-profile',
    async (_, displayName: string, emails: Array<{ email: string; originalName: string }>): Promise<ContributorProfile> => {
      const result = db.prepare(
        'INSERT INTO contributor_profiles (display_name) VALUES (?)'
      ).run(displayName)

      const profileId = result.lastInsertRowid as number

      // Add emails to the profile
      const insertEmail = db.prepare(
        'INSERT INTO contributor_emails (email, profile_id, is_primary, original_name) VALUES (?, ?, ?, ?)'
      )

      for (let i = 0; i < emails.length; i++) {
        const { email, originalName } = emails[i]
        insertEmail.run(email.toLowerCase(), profileId, i === 0 ? 1 : 0, originalName)
      }

      // Return the created profile
      const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(profileId) as ProfileRow
      const emailRows = db
        .prepare('SELECT * FROM contributor_emails WHERE profile_id = ?')
        .all(profileId) as EmailRow[]

      return rowToProfile(profile, emailRows.map(rowToEmail))
    }
  )

  // Update profile display name
  ipcMain.handle(
    'contributors:update-profile',
    async (_, id: number, displayName: string): Promise<ContributorProfile | null> => {
      db.prepare(
        'UPDATE contributor_profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(displayName, id)

      const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(id) as ProfileRow | undefined
      if (!profile) return null

      const emails = db
        .prepare('SELECT * FROM contributor_emails WHERE profile_id = ?')
        .all(id) as EmailRow[]

      return rowToProfile(profile, emails.map(rowToEmail))
    }
  )

  // Delete a profile (emails are cascaded)
  ipcMain.handle('contributors:delete-profile', async (_, id: number): Promise<void> => {
    db.prepare('DELETE FROM contributor_profiles WHERE id = ?').run(id)
  })

  // Add email to existing profile
  ipcMain.handle(
    'contributors:add-email-to-profile',
    async (_, profileId: number, email: string, originalName: string): Promise<void> => {
      db.prepare(
        'INSERT INTO contributor_emails (email, profile_id, is_primary, original_name) VALUES (?, ?, 0, ?)'
      ).run(email.toLowerCase(), profileId, originalName)

      // Update profile timestamp
      db.prepare(
        'UPDATE contributor_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(profileId)
    }
  )

  // Remove email from profile
  ipcMain.handle('contributors:remove-email', async (_, email: string): Promise<void> => {
    // Get the profile ID before deleting
    const emailRow = db.prepare('SELECT profile_id FROM contributor_emails WHERE email = ?').get(email.toLowerCase()) as { profile_id: number } | undefined

    if (emailRow) {
      db.prepare('DELETE FROM contributor_emails WHERE email = ?').run(email.toLowerCase())

      // Check if profile has any remaining emails
      const remaining = db.prepare('SELECT COUNT(*) as count FROM contributor_emails WHERE profile_id = ?').get(emailRow.profile_id) as { count: number }

      // If no emails left, delete the profile
      if (remaining.count === 0) {
        db.prepare('DELETE FROM contributor_profiles WHERE id = ?').run(emailRow.profile_id)
      } else {
        // Update profile timestamp
        db.prepare(
          'UPDATE contributor_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(emailRow.profile_id)
      }
    }
  })

  // Set primary email for a profile
  ipcMain.handle(
    'contributors:set-primary-email',
    async (_, profileId: number, email: string): Promise<void> => {
      const transaction = db.transaction(() => {
        // Clear existing primary
        db.prepare('UPDATE contributor_emails SET is_primary = 0 WHERE profile_id = ?').run(profileId)
        // Set new primary
        db.prepare('UPDATE contributor_emails SET is_primary = 1 WHERE profile_id = ? AND email = ?').run(profileId, email.toLowerCase())
        // Update profile timestamp
        db.prepare('UPDATE contributor_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(profileId)
      })
      transaction()
    }
  )

  // Set exclusion status
  ipcMain.handle(
    'contributors:set-excluded',
    async (_, id: number, isExcluded: boolean): Promise<void> => {
      db.prepare(
        'UPDATE contributor_profiles SET is_excluded = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(isExcluded ? 1 : 0, id)
    }
  )

  // Get all excluded emails (for summary generation)
  ipcMain.handle('contributors:get-excluded-emails', async (): Promise<string[]> => {
    const rows = db.prepare(`
      SELECT ce.email
      FROM contributor_emails ce
      JOIN contributor_profiles cp ON ce.profile_id = cp.id
      WHERE cp.is_excluded = 1
    `).all() as { email: string }[]

    return rows.map((r) => r.email)
  })

  // Get display name map (email -> display name) for summaries
  ipcMain.handle('contributors:get-display-name-map', async (): Promise<Record<string, string>> => {
    const rows = db.prepare(`
      SELECT ce.email, cp.display_name
      FROM contributor_emails ce
      JOIN contributor_profiles cp ON ce.profile_id = cp.id
    `).all() as { email: string; display_name: string }[]

    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.email] = row.display_name
    }
    return map
  })

  // Get profile by email
  ipcMain.handle('contributors:get-profile-by-email', async (_, email: string): Promise<ContributorProfile | null> => {
    const emailRow = db.prepare('SELECT profile_id FROM contributor_emails WHERE email = ?').get(email.toLowerCase()) as { profile_id: number } | undefined
    if (!emailRow) return null

    const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(emailRow.profile_id) as ProfileRow
    const emails = db
      .prepare('SELECT * FROM contributor_emails WHERE profile_id = ?')
      .all(emailRow.profile_id) as EmailRow[]

    return rowToProfile(profile, emails.map(rowToEmail))
  })

  // Quick exclude: create a profile for an email and mark it excluded
  ipcMain.handle(
    'contributors:quick-exclude',
    async (_, email: string, originalName: string): Promise<ContributorProfile> => {
      // Check if email already has a profile
      const existing = db.prepare('SELECT profile_id FROM contributor_emails WHERE email = ?').get(email.toLowerCase()) as { profile_id: number } | undefined

      if (existing) {
        // Just mark the existing profile as excluded
        db.prepare('UPDATE contributor_profiles SET is_excluded = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.profile_id)

        const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(existing.profile_id) as ProfileRow
        const emails = db.prepare('SELECT * FROM contributor_emails WHERE profile_id = ?').all(existing.profile_id) as EmailRow[]
        return rowToProfile(profile, emails.map(rowToEmail))
      }

      // Create new excluded profile
      const result = db.prepare(
        'INSERT INTO contributor_profiles (display_name, is_excluded) VALUES (?, 1)'
      ).run(originalName)

      const profileId = result.lastInsertRowid as number

      db.prepare(
        'INSERT INTO contributor_emails (email, profile_id, is_primary, original_name) VALUES (?, ?, 1, ?)'
      ).run(email.toLowerCase(), profileId, originalName)

      const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(profileId) as ProfileRow
      const emails = db.prepare('SELECT * FROM contributor_emails WHERE profile_id = ?').all(profileId) as EmailRow[]

      return rowToProfile(profile, emails.map(rowToEmail))
    }
  )

  // Merge multiple emails into a single profile
  ipcMain.handle(
    'contributors:merge',
    async (_, displayName: string, emailsToMerge: Array<{ email: string; originalName: string }>): Promise<ContributorProfile> => {
      const transaction = db.transaction(() => {
        // Find any existing profiles for these emails
        const existingProfileIds = new Set<number>()
        for (const { email } of emailsToMerge) {
          const row = db.prepare('SELECT profile_id FROM contributor_emails WHERE email = ?').get(email.toLowerCase()) as { profile_id: number } | undefined
          if (row) {
            existingProfileIds.add(row.profile_id)
          }
        }

        // Create the new merged profile
        const result = db.prepare(
          'INSERT INTO contributor_profiles (display_name) VALUES (?)'
        ).run(displayName)
        const newProfileId = result.lastInsertRowid as number

        // Move or insert all emails to the new profile
        for (let i = 0; i < emailsToMerge.length; i++) {
          const { email, originalName } = emailsToMerge[i]
          const emailLower = email.toLowerCase()

          // Delete from old profile if exists
          db.prepare('DELETE FROM contributor_emails WHERE email = ?').run(emailLower)

          // Insert into new profile
          db.prepare(
            'INSERT INTO contributor_emails (email, profile_id, is_primary, original_name) VALUES (?, ?, ?, ?)'
          ).run(emailLower, newProfileId, i === 0 ? 1 : 0, originalName)
        }

        // Delete old profiles that are now empty
        for (const oldProfileId of existingProfileIds) {
          const remaining = db.prepare('SELECT COUNT(*) as count FROM contributor_emails WHERE profile_id = ?').get(oldProfileId) as { count: number }
          if (remaining.count === 0) {
            db.prepare('DELETE FROM contributor_profiles WHERE id = ?').run(oldProfileId)
          }
        }

        return newProfileId
      })

      const newProfileId = transaction()

      const profile = db.prepare('SELECT * FROM contributor_profiles WHERE id = ?').get(newProfileId) as ProfileRow
      const emails = db.prepare('SELECT * FROM contributor_emails WHERE profile_id = ?').all(newProfileId) as EmailRow[]

      return rowToProfile(profile, emails.map(rowToEmail))
    }
  )
}
