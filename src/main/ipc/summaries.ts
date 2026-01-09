import { ipcMain, BrowserWindow } from 'electron'
import { getDatabase } from '../services/database'
import {
  checkClaudeInstalled,
  generateSummary,
  getDefaultTemplates,
  buildUserPrompt,
  ClaudeStreamEvent
} from '../services/claude'
import { getCommitsWithStats } from '../services/git'

export interface Summary {
  id: number
  type: 'personal' | 'team' | 'author'
  author_id: number | null
  date_from: string
  date_to: string
  content: string
  prompt_template: string
  commit_count: number
  merge_count: number
  repos_included: string
  created_at: string
  updated_at: string
  is_scheduled: boolean
}

export interface GenerateRequest {
  type: 'personal' | 'team'
  dateFrom: string
  dateTo: string
  template: string
  authorEmail?: string
}

export function registerSummaryHandlers(): void {
  // Check if Claude Code is installed
  ipcMain.handle('summaries:check-claude', async (): Promise<boolean> => {
    return checkClaudeInstalled()
  })

  // Get available templates
  ipcMain.handle(
    'summaries:get-templates',
    async (): Promise<Record<string, { name: string; description: string; systemPrompt: string }>> => {
      return getDefaultTemplates()
    }
  )

  // Generate summary (with streaming progress)
  ipcMain.on('summaries:generate', async (event, request: GenerateRequest) => {
    const { type, dateFrom, dateTo, template, authorEmail } = request
    const window = BrowserWindow.fromWebContents(event.sender)

    try {
      // Get commits from all repos
      const db = getDatabase()
      const repos = db
        .prepare('SELECT * FROM repositories WHERE is_available = 1')
        .all() as { id: number; path: string; name: string }[]

      if (repos.length === 0) {
        event.sender.send('summaries:generate:error', 'No repositories imported')
        return
      }

      // Send progress update
      event.sender.send('summaries:generate:progress', {
        stage: 'collecting',
        message: 'Collecting commits from repositories...'
      })

      // Collect commits from all repos
      const repoCommits: Array<{
        repoName: string
        repoPath: string
        commits: Awaited<ReturnType<typeof getCommitsWithStats>>
      }> = []

      let totalCommits = 0
      let totalMerges = 0

      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i]
        event.sender.send('summaries:generate:progress', {
          stage: 'collecting',
          message: `Processing ${repo.name}... (${i + 1}/${repos.length})`,
          progress: ((i + 1) / repos.length) * 50
        })

        const commits = await getCommitsWithStats(
          repo.path,
          new Date(dateFrom),
          new Date(dateTo),
          authorEmail
        )

        if (commits.length > 0) {
          repoCommits.push({
            repoName: repo.name,
            repoPath: repo.path,
            commits
          })
          totalCommits += commits.length
          totalMerges += commits.filter((c) => c.isMerge).length
        }
      }

      if (totalCommits === 0) {
        event.sender.send('summaries:generate:error', 'No commits found in the selected date range')
        return
      }

      // Get template
      const templates = getDefaultTemplates()
      const selectedTemplate = templates[template] || templates.technical
      const systemPrompt = selectedTemplate.systemPrompt

      // Build user prompt
      const userPrompt = buildUserPrompt(
        repoCommits.map((r) => ({ repoName: r.repoName, commits: r.commits })),
        new Date(dateFrom),
        new Date(dateTo),
        authorEmail
      )

      // Send progress update
      event.sender.send('summaries:generate:progress', {
        stage: 'generating',
        message: 'Generating summary with Claude...',
        progress: 50
      })

      // Generate with Claude
      let fullContent = ''

      for await (const streamEvent of generateSummary({
        systemPrompt,
        userPrompt,
        templateName: template,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        type
      })) {
        if (streamEvent.type === 'text' && streamEvent.content) {
          fullContent += streamEvent.content
          event.sender.send('summaries:generate:text', streamEvent.content)
        } else if (streamEvent.type === 'error') {
          event.sender.send('summaries:generate:error', streamEvent.error)
          return
        }
      }

      if (!fullContent) {
        event.sender.send('summaries:generate:error', 'No content generated')
        return
      }

      // Save to database
      const repoIds = repos.map((r) => r.id)
      const stmt = db.prepare(`
        INSERT INTO summaries (type, date_from, date_to, content, prompt_template, commit_count, merge_count, repos_included)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
      const summary = stmt.get(
        type,
        dateFrom,
        dateTo,
        fullContent,
        template,
        totalCommits,
        totalMerges,
        JSON.stringify(repoIds)
      ) as Summary

      // Send completion
      event.sender.send('summaries:generate:complete', summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      event.sender.send('summaries:generate:error', message)
    }
  })

  // List summaries
  ipcMain.handle(
    'summaries:list',
    async (_, type?: 'personal' | 'team', limit = 50): Promise<Summary[]> => {
      const db = getDatabase()
      let query = 'SELECT * FROM summaries'
      const params: unknown[] = []

      if (type) {
        query += ' WHERE type = ?'
        params.push(type)
      }

      query += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)

      return db.prepare(query).all(...params) as Summary[]
    }
  )

  // Get single summary
  ipcMain.handle('summaries:get', async (_, id: number): Promise<Summary | null> => {
    const db = getDatabase()
    return (db.prepare('SELECT * FROM summaries WHERE id = ?').get(id) as Summary) || null
  })

  // Update summary content
  ipcMain.handle(
    'summaries:update',
    async (_, id: number, content: string): Promise<Summary | null> => {
      const db = getDatabase()
      const stmt = db.prepare(`
        UPDATE summaries
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING *
      `)
      return (stmt.get(content, id) as Summary) || null
    }
  )

  // Delete summary
  ipcMain.handle('summaries:delete', async (_, id: number): Promise<void> => {
    const db = getDatabase()
    db.prepare('DELETE FROM summaries WHERE id = ?').run(id)
  })

  // Get summaries by date range
  ipcMain.handle(
    'summaries:by-date',
    async (_, dateFrom: string, dateTo: string): Promise<Summary[]> => {
      const db = getDatabase()
      return db
        .prepare(
          'SELECT * FROM summaries WHERE date_from >= ? AND date_to <= ? ORDER BY created_at DESC'
        )
        .all(dateFrom, dateTo) as Summary[]
    }
  )
}
