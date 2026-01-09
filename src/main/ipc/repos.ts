import { ipcMain, dialog } from 'electron'
import { getDatabase } from '../services/database'
import { existsSync } from 'fs'
import { basename, join } from 'path'
import { execSync } from 'child_process'
import { parseGitHubRemote } from '../services/github'

export interface Repository {
  id: number
  path: string
  name: string
  created_at: string
  last_accessed_at: string | null
  is_available: boolean
  is_github?: boolean
  github_owner?: string | null
  github_repo?: string | null
  github_full_name?: string | null
  is_local?: boolean
}

function isGitRepository(path: string): boolean {
  return existsSync(join(path, '.git'))
}

/**
 * Detect if a repository is a GitHub repo and extract owner/repo info
 */
function detectGitHubInfo(repoPath: string): { owner: string; repo: string } | null {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()

    return parseGitHubRemote(remoteUrl)
  } catch {
    // Not a git repo or no origin remote
    return null
  }
}

/**
 * Update repository with GitHub info if detected
 */
function updateGitHubInfo(repoId: number, repoPath: string): void {
  const db = getDatabase()
  const githubInfo = detectGitHubInfo(repoPath)

  if (githubInfo) {
    db.prepare(`
      UPDATE repositories
      SET is_github = 1, github_owner = ?, github_repo = ?
      WHERE id = ?
    `).run(githubInfo.owner, githubInfo.repo, repoId)
  }
}

export function registerRepoHandlers(): void {
  // List all repositories
  ipcMain.handle('repos:list', async (): Promise<Repository[]> => {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM repositories ORDER BY name ASC').all() as Repository[]

    // Check availability for each repo
    return rows.map((repo) => {
      // GitHub-only repos are always available
      const isGitHubOnly = repo.is_local === 0 || (repo.path && repo.path.startsWith('github://'))

      return {
        ...repo,
        is_available: isGitHubOnly ? true : (existsSync(repo.path) && isGitRepository(repo.path))
      }
    })
  })

  // Add a repository via folder picker
  ipcMain.handle('repos:add-dialog', async (): Promise<Repository | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a Git Repository'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const path = result.filePaths[0]

    // Validate it's a git repo
    if (!isGitRepository(path)) {
      throw new Error('Selected folder is not a Git repository')
    }

    const db = getDatabase()
    const name = basename(path)

    try {
      const stmt = db.prepare(
        'INSERT INTO repositories (path, name) VALUES (?, ?) RETURNING *'
      )
      const repo = stmt.get(path, name) as Repository

      // Detect and store GitHub info
      updateGitHubInfo(repo.id, path)

      return { ...repo, is_available: true }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        throw new Error('Repository already added')
      }
      throw error
    }
  })

  // Add a repository by path (programmatic)
  ipcMain.handle('repos:add', async (_, path: string): Promise<Repository> => {
    if (!isGitRepository(path)) {
      throw new Error('Path is not a Git repository')
    }

    const db = getDatabase()
    const name = basename(path)

    try {
      const stmt = db.prepare(
        'INSERT INTO repositories (path, name) VALUES (?, ?) RETURNING *'
      )
      const repo = stmt.get(path, name) as Repository

      // Detect and store GitHub info
      updateGitHubInfo(repo.id, path)

      return { ...repo, is_available: true }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        throw new Error('Repository already added')
      }
      throw error
    }
  })

  // Remove a repository
  ipcMain.handle('repos:remove', async (_, id: number): Promise<void> => {
    const db = getDatabase()
    db.prepare('DELETE FROM repositories WHERE id = ?').run(id)
  })

  // Import a GitHub repository (no local clone required)
  ipcMain.handle('repos:import-github', async (_, options: {
    owner: string
    repo: string
    name: string
  }): Promise<Repository> => {
    const db = getDatabase()
    const { owner, repo, name } = options
    const fullName = `${owner}/${repo}`
    // Use a placeholder path for GitHub-only repos
    const path = `github://${fullName}`

    try {
      const stmt = db.prepare(`
        INSERT INTO repositories (path, name, is_github, github_owner, github_repo, github_full_name, is_local)
        VALUES (?, ?, 1, ?, ?, ?, 0)
        RETURNING *
      `)
      const result = stmt.get(path, name, owner, repo, fullName) as Repository
      return { ...result, is_available: true }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        throw new Error('Repository already added')
      }
      throw error
    }
  })

  // Batch import multiple GitHub repositories
  ipcMain.handle('repos:import-github-batch', async (_, repos: Array<{
    owner: string
    repo: string
    name: string
  }>): Promise<{ success: number; failed: number; errors: string[] }> => {
    const db = getDatabase()
    let success = 0
    let failed = 0
    const errors: string[] = []

    const insertStmt = db.prepare(`
      INSERT INTO repositories (path, name, is_github, github_owner, github_repo, github_full_name, is_local)
      VALUES (?, ?, 1, ?, ?, ?, 0)
    `)

    for (const { owner, repo, name } of repos) {
      const fullName = `${owner}/${repo}`
      const path = `github://${fullName}`

      try {
        insertStmt.run(path, name, owner, repo, fullName)
        success++
      } catch (error: unknown) {
        failed++
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
          errors.push(`${fullName} already added`)
        } else {
          errors.push(`Failed to add ${fullName}`)
        }
      }
    }

    return { success, failed, errors }
  })

  // Update repository path (for relocated repos)
  ipcMain.handle('repos:relocate', async (_, id: number): Promise<Repository | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Locate Repository'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const newPath = result.filePaths[0]

    if (!isGitRepository(newPath)) {
      throw new Error('Selected folder is not a Git repository')
    }

    const db = getDatabase()
    const stmt = db.prepare(
      'UPDATE repositories SET path = ?, name = ? WHERE id = ? RETURNING *'
    )
    const repo = stmt.get(newPath, basename(newPath), id) as Repository
    return { ...repo, is_available: true }
  })
}
