/**
 * GitHub OAuth service using Device Flow
 * Device flow is ideal for desktop apps - no client secret needed
 */

import { Octokit } from '@octokit/rest'
import { getDatabase } from './database'
import { shell } from 'electron'

// GitHub OAuth App Client ID - public, safe to expose
// Users can create their own OAuth app at https://github.com/settings/developers
const GITHUB_CLIENT_ID = 'Ov23li1jKLs78pVDVxr3' // Lookout OAuth App

export interface GitHubOAuthUser {
  id: number
  githubId: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  bio: string | null
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

let currentOctokit: Octokit | null = null
let pollingInterval: NodeJS.Timeout | null = null

/**
 * Get the current Octokit instance (for authenticated requests)
 */
export function getAuthenticatedOctokit(): Octokit | null {
  return currentOctokit
}

/**
 * Initialize Octokit with stored token
 */
export async function initializeOAuth(): Promise<GitHubOAuthUser | null> {
  const user = getCurrentUser()
  if (!user) return null

  const token = getStoredToken(user.id)
  if (!token) return null

  try {
    currentOctokit = new Octokit({ auth: token })
    // Verify token is still valid
    await currentOctokit.users.getAuthenticated()
    return user
  } catch (error) {
    console.error('Stored token is invalid:', error)
    currentOctokit = null
    return null
  }
}

/**
 * Start the GitHub Device Flow authentication
 * Returns device code info for user to authorize
 */
export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'repo read:user user:email'
    })
  })

  if (!response.ok) {
    throw new Error('Failed to start device flow')
  }

  return response.json()
}

/**
 * Open the GitHub verification URL in the user's browser
 */
export function openVerificationUrl(url: string): void {
  shell.openExternal(url)
}

/**
 * Poll for the access token after user authorizes
 */
export async function pollForToken(
  deviceCode: string,
  interval: number,
  onProgress?: (status: string) => void
): Promise<OAuthTokenResponse> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        })

        const data = await response.json()

        if (data.error) {
          if (data.error === 'authorization_pending') {
            onProgress?.('Waiting for authorization...')
            return // Keep polling
          } else if (data.error === 'slow_down') {
            // Increase interval
            onProgress?.('Slowing down...')
            return
          } else if (data.error === 'expired_token') {
            if (pollingInterval) clearInterval(pollingInterval)
            pollingInterval = null
            reject(new Error('Authorization expired. Please try again.'))
            return
          } else if (data.error === 'access_denied') {
            if (pollingInterval) clearInterval(pollingInterval)
            pollingInterval = null
            reject(new Error('Access denied by user.'))
            return
          } else {
            if (pollingInterval) clearInterval(pollingInterval)
            pollingInterval = null
            reject(new Error(data.error_description || data.error))
            return
          }
        }

        if (data.access_token) {
          if (pollingInterval) clearInterval(pollingInterval)
          pollingInterval = null
          resolve(data)
        }
      } catch (error) {
        if (pollingInterval) clearInterval(pollingInterval)
        pollingInterval = null
        reject(error)
      }
    }

    // Start polling
    pollingInterval = setInterval(poll, interval * 1000)
    poll() // Initial call
  })
}

/**
 * Cancel ongoing polling
 */
export function cancelPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

/**
 * Complete the OAuth flow - fetch user info and store credentials
 */
export async function completeOAuth(tokenResponse: OAuthTokenResponse): Promise<GitHubOAuthUser> {
  const octokit = new Octokit({ auth: tokenResponse.access_token })

  // Fetch user info
  const { data: githubUser } = await octokit.users.getAuthenticated()

  // Get primary email if not public
  let email = githubUser.email
  if (!email) {
    try {
      const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser()
      const primary = emails.find(e => e.primary)
      email = primary?.email || null
    } catch {
      // Email access might be denied
    }
  }

  const db = getDatabase()

  // Clear any existing "current" user
  db.prepare('UPDATE github_users SET is_current = 0').run()

  // Upsert user
  db.prepare(`
    INSERT INTO github_users (github_id, login, name, email, avatar_url, bio, is_current, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(github_id) DO UPDATE SET
      login = excluded.login,
      name = excluded.name,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      bio = excluded.bio,
      is_current = 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    githubUser.id,
    githubUser.login,
    githubUser.name,
    email,
    githubUser.avatar_url,
    githubUser.bio
  )

  // Get the user's DB id
  const user = db.prepare('SELECT id FROM github_users WHERE github_id = ?').get(githubUser.id) as { id: number }

  // Store the token
  db.prepare(`
    INSERT INTO github_oauth_tokens (user_id, access_token, token_type, scope, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      token_type = excluded.token_type,
      scope = excluded.scope,
      updated_at = CURRENT_TIMESTAMP
  `).run(user.id, tokenResponse.access_token, tokenResponse.token_type, tokenResponse.scope)

  // Set the global Octokit instance
  currentOctokit = octokit

  // Remove old PAT-based token if it exists
  db.prepare("DELETE FROM settings WHERE key = 'github_token'").run()

  return {
    id: user.id,
    githubId: githubUser.id,
    login: githubUser.login,
    name: githubUser.name,
    email: email,
    avatarUrl: githubUser.avatar_url,
    bio: githubUser.bio
  }
}

/**
 * Get the current logged-in user
 */
export function getCurrentUser(): GitHubOAuthUser | null {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT id, github_id, login, name, email, avatar_url, bio
    FROM github_users
    WHERE is_current = 1
  `).get() as {
    id: number
    github_id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string | null
    bio: string | null
  } | undefined

  if (!row) return null

  return {
    id: row.id,
    githubId: row.github_id,
    login: row.login,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    bio: row.bio
  }
}

/**
 * Get stored access token for a user
 */
export function getStoredToken(userId: number): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT access_token FROM github_oauth_tokens WHERE user_id = ?').get(userId) as {
    access_token: string
  } | undefined

  return row?.access_token || null
}

/**
 * Log out the current user
 */
export function logout(): void {
  const db = getDatabase()

  // Clear current user flag
  db.prepare('UPDATE github_users SET is_current = 0').run()

  // Clear the Octokit instance
  currentOctokit = null
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return currentOctokit !== null && getCurrentUser() !== null
}

/**
 * Fetch user's GitHub repositories
 */
export async function fetchUserRepositories(options?: {
  perPage?: number
  page?: number
  sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  affiliation?: string
}): Promise<Array<{
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  isPrivate: boolean
  defaultBranch: string
  updatedAt: string
  pushedAt: string | null
  language: string | null
  stargazersCount: number
  forksCount: number
}>> {
  const octokit = getAuthenticatedOctokit()
  if (!octokit) throw new Error('Not authenticated')

  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: options?.perPage || 100,
    page: options?.page || 1,
    sort: options?.sort || 'pushed',
    affiliation: options?.affiliation || 'owner,collaborator,organization_member'
  })

  return data.map(repo => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    description: repo.description,
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at || '',
    pushedAt: repo.pushed_at,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count
  }))
}

/**
 * Fetch commits for a GitHub repository (without local clone)
 */
export async function fetchRepoCommits(
  owner: string,
  repo: string,
  options?: {
    since?: string
    until?: string
    author?: string
    perPage?: number
    page?: number
  }
): Promise<Array<{
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
    login?: string
    avatarUrl?: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}>> {
  const octokit = getAuthenticatedOctokit()
  if (!octokit) throw new Error('Not authenticated')

  const { data } = await octokit.repos.listCommits({
    owner,
    repo,
    since: options?.since,
    until: options?.until,
    author: options?.author,
    per_page: options?.perPage || 100,
    page: options?.page || 1
  })

  return data.map(commit => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: {
      name: commit.commit.author?.name || 'Unknown',
      email: commit.commit.author?.email || '',
      date: commit.commit.author?.date || '',
      login: commit.author?.login,
      avatarUrl: commit.author?.avatar_url
    },
    committer: {
      name: commit.commit.committer?.name || 'Unknown',
      email: commit.commit.committer?.email || '',
      date: commit.commit.committer?.date || ''
    }
  }))
}

/**
 * Fetch detailed commit info (with stats)
 */
export async function fetchCommitDetails(
  owner: string,
  repo: string,
  sha: string
): Promise<{
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
    login?: string
  }
  stats: {
    additions: number
    deletions: number
    total: number
  }
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    changes: number
  }>
}> {
  const octokit = getAuthenticatedOctokit()
  if (!octokit) throw new Error('Not authenticated')

  const { data } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: sha
  })

  return {
    sha: data.sha,
    message: data.commit.message,
    author: {
      name: data.commit.author?.name || 'Unknown',
      email: data.commit.author?.email || '',
      date: data.commit.author?.date || '',
      login: data.author?.login
    },
    stats: {
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
      total: data.stats?.total || 0
    },
    files: (data.files || []).map(file => ({
      filename: file.filename,
      status: file.status || 'modified',
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    }))
  }
}
