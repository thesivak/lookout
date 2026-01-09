/**
 * Pre-generation service for background summary generation on app launch
 */

import { BrowserWindow } from 'electron'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { getDatabase } from './database'
import { getCommitsWithStats } from './git'
import { generateSummary, getDefaultTemplates, buildUserPrompt } from './claude'
import { categorizeCommit, calculateBreakdown, summarizeBreakdown } from './categorization'

export type PregenStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PregenState {
  status: PregenStatus
  personalSummaryId: number | null
  teamSummaryId: number | null
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
}

let state: PregenState = {
  status: 'idle',
  personalSummaryId: null,
  teamSummaryId: null,
  error: null,
  startedAt: null,
  completedAt: null
}

let mainWindow: BrowserWindow | null = null

/**
 * Set the main window reference for sending IPC notifications
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

/**
 * Get current pre-generation state
 */
export function getPregenState(): PregenState {
  return { ...state }
}

/**
 * Check if today's summaries already exist
 */
function checkExistingSummaries(): { personal: number | null; team: number | null } {
  const db = getDatabase()
  const today = format(new Date(), 'yyyy-MM-dd')

  const personal = db
    .prepare(
      `
      SELECT id FROM summaries
      WHERE type = 'personal'
        AND DATE(created_at) = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get(today) as { id: number } | undefined

  const team = db
    .prepare(
      `
      SELECT id FROM summaries
      WHERE type = 'team'
        AND DATE(created_at) = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get(today) as { id: number } | undefined

  return {
    personal: personal?.id || null,
    team: team?.id || null
  }
}

/**
 * Run pre-generation in background
 */
export async function runBackgroundPregeneration(): Promise<void> {
  // Check if already running
  if (state.status === 'running') {
    console.log('Pre-generation already running')
    return
  }

  // Check if summaries already exist
  const existing = checkExistingSummaries()
  if (existing.personal && existing.team) {
    console.log('Today\'s summaries already exist, skipping pre-generation')
    state = {
      status: 'completed',
      personalSummaryId: existing.personal,
      teamSummaryId: existing.team,
      error: null,
      startedAt: null,
      completedAt: new Date()
    }
    notifyRenderer()
    return
  }

  // Check if pre-generation is enabled in settings
  const db = getDatabase()
  const pregenerationEnabled = db
    .prepare("SELECT value FROM settings WHERE key = 'pregeneration_enabled'")
    .get() as { value: string } | undefined

  // Default to enabled if not set
  if (pregenerationEnabled?.value === 'false') {
    console.log('Pre-generation disabled in settings')
    return
  }

  // Check if we have any repos
  const repos = db.prepare('SELECT COUNT(*) as count FROM repositories WHERE is_available = 1').get() as { count: number }
  if (repos.count === 0) {
    console.log('No repositories available, skipping pre-generation')
    return
  }

  // Start pre-generation
  state = {
    status: 'running',
    personalSummaryId: existing.personal,
    teamSummaryId: existing.team,
    error: null,
    startedAt: new Date(),
    completedAt: null
  }
  notifyRenderer()

  console.log('Starting background pre-generation...')

  try {
    // Get date range (yesterday)
    const now = new Date()
    const yesterday = subDays(now, 1)
    const dateFrom = startOfDay(yesterday)
    const dateTo = endOfDay(yesterday)

    // Get all repos
    const allRepos = db
      .prepare('SELECT id, path, name FROM repositories WHERE is_available = 1')
      .all() as Array<{ id: number; path: string; name: string }>

    // Collect commits from all repos
    const repoCommits: Array<{
      repoName: string
      repoId: number
      commits: Awaited<ReturnType<typeof getCommitsWithStats>>
    }> = []

    for (const repo of allRepos) {
      try {
        const commits = await getCommitsWithStats(repo.path, dateFrom, dateTo)
        if (commits.length > 0) {
          repoCommits.push({ repoName: repo.name, repoId: repo.id, commits })
        }
      } catch (error) {
        console.error(`Failed to get commits from ${repo.name}:`, error)
      }
    }

    // No commits found
    if (repoCommits.length === 0 || repoCommits.every(r => r.commits.length === 0)) {
      console.log('No commits found for pre-generation period')
      state = {
        ...state,
        status: 'completed',
        completedAt: new Date()
      }
      notifyRenderer()
      return
    }

    // Get git user for personal summary filtering
    const { getGlobalGitUser } = await import('./git')
    const gitUser = getGlobalGitUser()

    // Categorize all commits
    const allCommits = repoCommits.flatMap(r => r.commits)
    const categories = allCommits.map(c => categorizeCommit(c.message, undefined, c.isMerge).category)
    const breakdown = calculateBreakdown(categories)
    const breakdownSummary = summarizeBreakdown(breakdown)

    // Generate personal summary if not exists
    if (!existing.personal && gitUser.email) {
      try {
        console.log('Generating personal summary...')

        const personalCommits = repoCommits.map(r => ({
          ...r,
          commits: r.commits.filter(c =>
            c.authorEmail.toLowerCase() === gitUser.email.toLowerCase()
          )
        })).filter(r => r.commits.length > 0)

        if (personalCommits.length > 0) {
          const template = getDefaultTemplates()['casual-standup'] || getDefaultTemplates()['technical']
          const userPrompt = buildUserPrompt(
            personalCommits.map(r => ({
              repoName: r.repoName,
              commits: r.commits
            })),
            dateFrom,
            dateTo,
            gitUser.name
          )

          // Add category breakdown to prompt
          const enhancedPrompt = `${userPrompt}\n\n**Work Breakdown:** ${breakdownSummary}`

          const result = await generateSummary({
            systemPrompt: template.systemPrompt,
            userPrompt: enhancedPrompt
          })

          if (result.content) {
            // Save to database
            const totalCommits = personalCommits.reduce((sum, r) => sum + r.commits.length, 0)
            const mergeCommits = personalCommits.reduce((sum, r) =>
              sum + r.commits.filter(c => c.isMerge).length, 0)

            const insertResult = db.prepare(`
              INSERT INTO summaries (type, date_from, date_to, content, prompt_template, commit_count, merge_count, repos_included, is_scheduled, category_breakdown)
              VALUES ('personal', ?, ?, ?, 'casual-standup', ?, ?, ?, 1, ?)
            `).run(
              dateFrom.toISOString(),
              dateTo.toISOString(),
              result.content,
              totalCommits,
              mergeCommits,
              JSON.stringify(personalCommits.map(r => r.repoName)),
              JSON.stringify(breakdown)
            )

            state.personalSummaryId = insertResult.lastInsertRowid as number
            console.log('Personal summary generated:', state.personalSummaryId)
          }
        }
      } catch (error) {
        console.error('Failed to generate personal summary:', error)
      }
    }

    // Generate team summary if not exists
    if (!existing.team) {
      try {
        console.log('Generating team summary...')

        // Get excluded contributors
        const excludedEmails = db
          .prepare(`
            SELECT ce.email FROM contributor_emails ce
            JOIN contributor_profiles cp ON ce.profile_id = cp.id
            WHERE cp.is_excluded = 1
          `)
          .all() as Array<{ email: string }>

        const excludedSet = new Set(excludedEmails.map(e => e.email.toLowerCase()))

        const teamCommits = repoCommits.map(r => ({
          ...r,
          commits: r.commits.filter(c => !excludedSet.has(c.authorEmail.toLowerCase()))
        })).filter(r => r.commits.length > 0)

        if (teamCommits.length > 0) {
          const template = getDefaultTemplates()['technical']
          const userPrompt = buildUserPrompt(
            teamCommits.map(r => ({
              repoName: r.repoName,
              commits: r.commits
            })),
            dateFrom,
            dateTo
          )

          // Add category breakdown to prompt
          const enhancedPrompt = `${userPrompt}\n\n**Work Breakdown:** ${breakdownSummary}`

          const result = await generateSummary({
            systemPrompt: template.systemPrompt,
            userPrompt: enhancedPrompt
          })

          if (result.content) {
            const totalCommits = teamCommits.reduce((sum, r) => sum + r.commits.length, 0)
            const mergeCommits = teamCommits.reduce((sum, r) =>
              sum + r.commits.filter(c => c.isMerge).length, 0)

            const insertResult = db.prepare(`
              INSERT INTO summaries (type, date_from, date_to, content, prompt_template, commit_count, merge_count, repos_included, is_scheduled, category_breakdown)
              VALUES ('team', ?, ?, ?, 'technical', ?, ?, ?, 1, ?)
            `).run(
              dateFrom.toISOString(),
              dateTo.toISOString(),
              result.content,
              totalCommits,
              mergeCommits,
              JSON.stringify(teamCommits.map(r => r.repoName)),
              JSON.stringify(breakdown)
            )

            state.teamSummaryId = insertResult.lastInsertRowid as number
            console.log('Team summary generated:', state.teamSummaryId)
          }
        }
      } catch (error) {
        console.error('Failed to generate team summary:', error)
      }
    }

    state = {
      ...state,
      status: 'completed',
      completedAt: new Date()
    }
    console.log('Background pre-generation completed')
  } catch (error) {
    console.error('Pre-generation failed:', error)
    state = {
      ...state,
      status: 'failed',
      error: String(error),
      completedAt: new Date()
    }
  }

  notifyRenderer()
}

/**
 * Notify renderer of state change
 */
function notifyRenderer(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pregeneration:status', state)
  }
}

/**
 * Get pre-generated summary if available
 */
export function getPregenSummary(type: 'personal' | 'team'): { id: number; content: string } | null {
  const id = type === 'personal' ? state.personalSummaryId : state.teamSummaryId
  if (!id) return null

  const db = getDatabase()
  const summary = db.prepare('SELECT id, content FROM summaries WHERE id = ?').get(id) as
    | { id: number; content: string }
    | undefined

  return summary || null
}
