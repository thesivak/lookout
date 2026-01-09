import { ipcMain } from 'electron'
import {
  getGlobalGitUser,
  getRepoGitUser,
  getCommitsWithStats,
  getAllAuthors,
  fetchAll,
  getRepoStats,
  getCommitActivityByDay,
  CommitData,
  AuthorData,
  RepoStats,
  GitUser
} from '../services/git'
import { getDatabase } from '../services/database'

export function registerGitHandlers(): void {
  // Get git user (tries global config, then repo configs)
  ipcMain.handle('git:get-user', async (): Promise<GitUser> => {
    // Try global config first
    const globalUser = getGlobalGitUser()
    if (globalUser.email) {
      return globalUser
    }

    // Fallback: try to get user from one of the imported repositories
    const db = getDatabase()
    const repos = db
      .prepare('SELECT path FROM repositories WHERE is_available = 1 LIMIT 5')
      .all() as { path: string }[]

    for (const repo of repos) {
      const repoUser = getRepoGitUser(repo.path)
      if (repoUser.email) {
        return repoUser
      }
    }

    return { name: '', email: '' }
  })

  // Get commits from a single repo
  ipcMain.handle(
    'git:get-commits',
    async (
      _,
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<CommitData[]> => {
      return getCommitsWithStats(
        repoPath,
        new Date(dateFrom),
        new Date(dateTo),
        authorEmail
      )
    }
  )

  // Get commits from all repos
  ipcMain.handle(
    'git:get-all-commits',
    async (
      _,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<{ repoName: string; repoPath: string; commits: CommitData[] }[]> => {
      const db = getDatabase()
      const repos = db
        .prepare('SELECT * FROM repositories WHERE is_available = 1')
        .all() as { id: number; path: string; name: string }[]

      const results = await Promise.all(
        repos.map(async (repo) => {
          const commits = await getCommitsWithStats(
            repo.path,
            new Date(dateFrom),
            new Date(dateTo),
            authorEmail
          )
          return {
            repoName: repo.name,
            repoPath: repo.path,
            commits
          }
        })
      )

      return results.filter((r) => r.commits.length > 0)
    }
  )

  // Get authors from a repo
  ipcMain.handle(
    'git:get-authors',
    async (
      _,
      repoPath: string,
      dateFrom?: string,
      dateTo?: string
    ): Promise<AuthorData[]> => {
      return getAllAuthors(
        repoPath,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      )
    }
  )

  // Get all authors from all repos
  ipcMain.handle(
    'git:get-all-authors',
    async (_, dateFrom?: string, dateTo?: string): Promise<AuthorData[]> => {
      const db = getDatabase()
      const repos = db
        .prepare('SELECT * FROM repositories WHERE is_available = 1')
        .all() as { path: string }[]

      const authorMap = new Map<string, AuthorData>()

      await Promise.all(
        repos.map(async (repo) => {
          const authors = await getAllAuthors(
            repo.path,
            dateFrom ? new Date(dateFrom) : undefined,
            dateTo ? new Date(dateTo) : undefined
          )

          for (const author of authors) {
            const key = author.email.toLowerCase()
            const existing = authorMap.get(key)
            if (existing) {
              existing.commitCount += author.commitCount
            } else {
              authorMap.set(key, { ...author })
            }
          }
        })
      )

      return Array.from(authorMap.values()).sort((a, b) => b.commitCount - a.commitCount)
    }
  )

  // Fetch all remotes for all repos
  ipcMain.handle('git:fetch-all', async (): Promise<{ success: boolean; errors: string[] }> => {
    const db = getDatabase()
    const repos = db
      .prepare('SELECT * FROM repositories WHERE is_available = 1')
      .all() as { path: string; name: string }[]

    const errors: string[] = []

    await Promise.all(
      repos.map(async (repo) => {
        try {
          await fetchAll(repo.path)
        } catch (error) {
          errors.push(`${repo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      })
    )

    return { success: errors.length === 0, errors }
  })

  // Get repo stats
  ipcMain.handle(
    'git:get-stats',
    async (
      _,
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<RepoStats> => {
      return getRepoStats(repoPath, new Date(dateFrom), new Date(dateTo), authorEmail)
    }
  )

  // Get aggregated stats for all repos
  ipcMain.handle(
    'git:get-all-stats',
    async (
      _,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<RepoStats> => {
      const db = getDatabase()
      const repos = db
        .prepare('SELECT * FROM repositories WHERE is_available = 1')
        .all() as { path: string }[]

      const aggregated: RepoStats = {
        totalCommits: 0,
        mergeCommits: 0,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        authors: []
      }

      const authorMap = new Map<string, AuthorData>()

      await Promise.all(
        repos.map(async (repo) => {
          const stats = await getRepoStats(
            repo.path,
            new Date(dateFrom),
            new Date(dateTo),
            authorEmail
          )

          aggregated.totalCommits += stats.totalCommits
          aggregated.mergeCommits += stats.mergeCommits
          aggregated.additions += stats.additions
          aggregated.deletions += stats.deletions
          aggregated.filesChanged += stats.filesChanged

          for (const author of stats.authors) {
            const key = author.email.toLowerCase()
            const existing = authorMap.get(key)
            if (existing) {
              existing.commitCount += author.commitCount
            } else {
              authorMap.set(key, { ...author })
            }
          }
        })
      )

      aggregated.authors = Array.from(authorMap.values()).sort(
        (a, b) => b.commitCount - a.commitCount
      )

      return aggregated
    }
  )

  // Get activity by day (for contribution graph)
  ipcMain.handle(
    'git:get-activity',
    async (
      _,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<Record<string, number>> => {
      const db = getDatabase()
      const repos = db
        .prepare('SELECT * FROM repositories WHERE is_available = 1')
        .all() as { path: string }[]

      const aggregated = new Map<string, number>()

      await Promise.all(
        repos.map(async (repo) => {
          const activity = await getCommitActivityByDay(
            repo.path,
            new Date(dateFrom),
            new Date(dateTo),
            authorEmail
          )

          for (const [date, count] of activity) {
            const existing = aggregated.get(date) || 0
            aggregated.set(date, existing + count)
          }
        })
      )

      return Object.fromEntries(aggregated)
    }
  )
}
