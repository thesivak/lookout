import simpleGit, { SimpleGit, DefaultLogFields, LogResult } from 'simple-git'
import { execSync } from 'child_process'
import { format } from 'date-fns'

export interface CommitData {
  hash: string
  authorName: string
  authorEmail: string
  date: string
  message: string
  isMerge: boolean
  additions: number
  deletions: number
  filesChanged: number
}

export interface AuthorData {
  email: string
  name: string
  commitCount: number
}

export interface RepoStats {
  totalCommits: number
  mergeCommits: number
  additions: number
  deletions: number
  filesChanged: number
  authors: AuthorData[]
}

export interface GitUser {
  name: string
  email: string
}

/**
 * Get the current git user from global config
 */
export function getGlobalGitUser(): GitUser {
  try {
    // Try global config first
    const name = execSync('git config --global user.name', { encoding: 'utf-8' }).trim()
    const email = execSync('git config --global user.email', { encoding: 'utf-8' }).trim()
    if (name && email) {
      return { name, email }
    }
  } catch {
    // Global config not available
  }

  try {
    // Fallback to system/default config (without --global flag)
    const name = execSync('git config user.name', { encoding: 'utf-8' }).trim()
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim()
    if (name && email) {
      return { name, email }
    }
  } catch {
    // No config available
  }

  return { name: '', email: '' }
}

/**
 * Get git user from a specific repository's local config
 */
export function getRepoGitUser(repoPath: string): GitUser {
  try {
    const name = execSync('git config user.name', { cwd: repoPath, encoding: 'utf-8' }).trim()
    const email = execSync('git config user.email', { cwd: repoPath, encoding: 'utf-8' }).trim()
    return { name, email }
  } catch {
    return { name: '', email: '' }
  }
}

/**
 * Check if a path is a valid git repository
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    const git = simpleGit(path)
    return await git.checkIsRepo()
  } catch {
    return false
  }
}

/**
 * Format date for git --since/--until options
 */
function formatDateForGit(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}

/**
 * Get commits from a repository within a date range using simple-git
 */
export async function getCommits(
  repoPath: string,
  dateFrom: Date,
  dateTo: Date,
  authorEmail?: string
): Promise<CommitData[]> {
  const git: SimpleGit = simpleGit(repoPath)

  try {
    const options: Record<string, string | null> = {
      '--all': null,
      '--since': formatDateForGit(dateFrom),
      '--until': formatDateForGit(dateTo)
    }

    if (authorEmail) {
      options['--author'] = authorEmail
    }

    const log: LogResult<DefaultLogFields> = await git.log(options)

    return log.all.map((commit) => {
      const isMerge = commit.message.toLowerCase().startsWith('merge')

      return {
        hash: commit.hash,
        authorName: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date,
        message: commit.message,
        isMerge,
        additions: 0,
        deletions: 0,
        filesChanged: 0
      }
    })
  } catch (error) {
    console.error(`Failed to get commits from ${repoPath}:`, error)
    return []
  }
}

/**
 * Get commits with file stats using raw git command
 */
export async function getCommitsWithStats(
  repoPath: string,
  dateFrom: Date,
  dateTo: Date,
  authorEmail?: string
): Promise<CommitData[]> {
  const git: SimpleGit = simpleGit(repoPath)

  try {
    // Use simple-git's log with stat option
    const options: Record<string, string | null> = {
      '--all': null,
      '--since': formatDateForGit(dateFrom),
      '--until': formatDateForGit(dateTo),
      '--stat': null
    }

    if (authorEmail) {
      options['--author'] = authorEmail
    }

    const log = await git.log(options)

    return log.all.map((commit) => {
      const isMerge = commit.message.toLowerCase().startsWith('merge')

      // Try to get stats from diff if available
      let additions = 0
      let deletions = 0
      let filesChanged = 0

      if (commit.diff) {
        filesChanged = commit.diff.files?.length ?? 0
        commit.diff.files?.forEach((file) => {
          additions += file.insertions ?? 0
          deletions += file.deletions ?? 0
        })
      }

      return {
        hash: commit.hash,
        authorName: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date,
        message: commit.message,
        isMerge,
        additions,
        deletions,
        filesChanged
      }
    })
  } catch (error) {
    console.error(`Failed to get commits from ${repoPath}:`, error)
    return []
  }
}

/**
 * Get all unique authors from a repository
 */
export async function getAllAuthors(
  repoPath: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<AuthorData[]> {
  const git: SimpleGit = simpleGit(repoPath)

  try {
    const options: Record<string, string | null> = {
      '--all': null
    }

    if (dateFrom) {
      options['--since'] = formatDateForGit(dateFrom)
    }
    if (dateTo) {
      options['--until'] = formatDateForGit(dateTo)
    }

    const log = await git.log(options)

    // Group commits by author email
    const authorMap = new Map<string, AuthorData>()

    for (const commit of log.all) {
      const email = commit.author_email.toLowerCase()
      const existing = authorMap.get(email)
      if (existing) {
        existing.commitCount++
      } else {
        authorMap.set(email, {
          email: commit.author_email,
          name: commit.author_name,
          commitCount: 1
        })
      }
    }

    return Array.from(authorMap.values()).sort((a, b) => b.commitCount - a.commitCount)
  } catch (error) {
    console.error(`Failed to get authors from ${repoPath}:`, error)
    return []
  }
}

/**
 * Fetch all remote branches
 */
export async function fetchAll(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath)
  await git.fetch(['--all'])
}

/**
 * Get repository stats for a date range
 */
export async function getRepoStats(
  repoPath: string,
  dateFrom: Date,
  dateTo: Date,
  authorEmail?: string
): Promise<RepoStats> {
  const commits = await getCommits(repoPath, dateFrom, dateTo, authorEmail)

  const authorMap = new Map<string, AuthorData>()

  let totalCommits = 0
  let mergeCommits = 0
  let additions = 0
  let deletions = 0
  let filesChanged = 0

  for (const commit of commits) {
    totalCommits++
    if (commit.isMerge) mergeCommits++
    additions += commit.additions
    deletions += commit.deletions
    filesChanged += commit.filesChanged

    // Aggregate by author
    const key = commit.authorEmail.toLowerCase()
    const existing = authorMap.get(key)
    if (existing) {
      existing.commitCount++
    } else {
      authorMap.set(key, {
        email: commit.authorEmail,
        name: commit.authorName,
        commitCount: 1
      })
    }
  }

  return {
    totalCommits,
    mergeCommits,
    additions,
    deletions,
    filesChanged,
    authors: Array.from(authorMap.values()).sort((a, b) => b.commitCount - a.commitCount)
  }
}

/**
 * Get commit activity by day (for contribution graph)
 */
export async function getCommitActivityByDay(
  repoPath: string,
  dateFrom: Date,
  dateTo: Date,
  authorEmail?: string
): Promise<Map<string, number>> {
  const commits = await getCommits(repoPath, dateFrom, dateTo, authorEmail)
  const activity = new Map<string, number>()

  for (const commit of commits) {
    // Extract date from ISO string (YYYY-MM-DD)
    const date = commit.date.substring(0, 10)
    const count = activity.get(date) || 0
    activity.set(date, count + 1)
  }

  return activity
}
