import { contextBridge, ipcRenderer } from 'electron'
import type { Repository } from '../main/ipc/repos'
import type { Settings } from '../main/ipc/settings'
import type { CommitData, AuthorData, RepoStats, GitUser } from '../main/services/git'
import type { Summary, GenerateRequest } from '../main/ipc/summaries'
import type { ContributorProfile } from '../main/ipc/contributors'

// OAuth types for renderer
interface GitHubOAuthUser {
  id: number
  githubId: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  bio: string | null
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface GitHubRepoInfo {
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
}

// Custom APIs for renderer
const api = {
  oauth: {
    check: (): Promise<{ authenticated: boolean; user: GitHubOAuthUser | null }> =>
      ipcRenderer.invoke('oauth:check'),
    getUser: (): Promise<GitHubOAuthUser | null> =>
      ipcRenderer.invoke('oauth:get-user'),
    startDeviceFlow: (): Promise<{ success: boolean; deviceCode?: DeviceCodeResponse; error?: string }> =>
      ipcRenderer.invoke('oauth:start-device-flow'),
    openVerificationUrl: (url: string): Promise<void> =>
      ipcRenderer.invoke('oauth:open-verification-url', url),
    pollForToken: (deviceCode: string, interval: number): Promise<{ success: boolean; user?: GitHubOAuthUser; error?: string }> =>
      ipcRenderer.invoke('oauth:poll-for-token', deviceCode, interval),
    cancelPolling: (): Promise<void> =>
      ipcRenderer.invoke('oauth:cancel-polling'),
    logout: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('oauth:logout'),
    listRepos: (options?: { perPage?: number; page?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' }): Promise<{ success: boolean; repos?: GitHubRepoInfo[]; error?: string }> =>
      ipcRenderer.invoke('oauth:list-repos', options),
    onPollingStatus: (callback: (status: string) => void) => {
      const sub = (_: Electron.IpcRendererEvent, status: string) => callback(status)
      ipcRenderer.on('oauth:polling-status', sub)
      return () => ipcRenderer.removeListener('oauth:polling-status', sub)
    }
  },

  repos: {
    list: (): Promise<Repository[]> => ipcRenderer.invoke('repos:list'),
    addDialog: (): Promise<Repository | null> => ipcRenderer.invoke('repos:add-dialog'),
    add: (path: string): Promise<Repository> => ipcRenderer.invoke('repos:add', path),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('repos:remove', id),
    relocate: (id: number): Promise<Repository | null> => ipcRenderer.invoke('repos:relocate', id),
    importGitHub: (options: { owner: string; repo: string; name: string }): Promise<Repository> =>
      ipcRenderer.invoke('repos:import-github', options),
    importGitHubBatch: (repos: Array<{ owner: string; repo: string; name: string }>): Promise<{ success: number; failed: number; errors: string[] }> =>
      ipcRenderer.invoke('repos:import-github-batch', repos)
  },

  settings: {
    getAll: (): Promise<Settings> => ipcRenderer.invoke('settings:get-all'),
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
    setMany: (settings: Record<string, string>): Promise<void> =>
      ipcRenderer.invoke('settings:set-many', settings)
  },

  git: {
    getUser: (): Promise<GitUser> => ipcRenderer.invoke('git:get-user'),
    getCommits: (
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<CommitData[]> =>
      ipcRenderer.invoke('git:get-commits', repoPath, dateFrom, dateTo, authorEmail),
    getAllCommits: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<{ repoName: string; repoPath: string; commits: CommitData[] }[]> =>
      ipcRenderer.invoke('git:get-all-commits', dateFrom, dateTo, authorEmail),
    getAuthors: (
      repoPath: string,
      dateFrom?: string,
      dateTo?: string
    ): Promise<AuthorData[]> =>
      ipcRenderer.invoke('git:get-authors', repoPath, dateFrom, dateTo),
    getAllAuthors: (dateFrom?: string, dateTo?: string): Promise<AuthorData[]> =>
      ipcRenderer.invoke('git:get-all-authors', dateFrom, dateTo),
    fetchAll: (): Promise<{ success: boolean; errors: string[] }> =>
      ipcRenderer.invoke('git:fetch-all'),
    getStats: (
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<RepoStats> =>
      ipcRenderer.invoke('git:get-stats', repoPath, dateFrom, dateTo, authorEmail),
    getAllStats: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<RepoStats> =>
      ipcRenderer.invoke('git:get-all-stats', dateFrom, dateTo, authorEmail),
    getActivity: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ): Promise<Record<string, number>> =>
      ipcRenderer.invoke('git:get-activity', dateFrom, dateTo, authorEmail),
    getDiff: (repoPath: string, hash: string): Promise<{ success: boolean; diff?: unknown; error?: string }> =>
      ipcRenderer.invoke('git:get-diff', repoPath, hash),
    getDiffBetween: (repoPath: string, fromHash: string, toHash: string): Promise<{ success: boolean; files?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('git:get-diff-between', repoPath, fromHash, toHash)
  },

  commits: {
    sync: (options: { repoId?: number; dateFrom: string; dateTo: string; authorEmail?: string }): Promise<{ success: boolean; synced: number; error?: string }> =>
      ipcRenderer.invoke('commits:sync', options),
    list: (options: { repoId?: number; dateFrom?: string; dateTo?: string; authorEmail?: string; category?: string; limit?: number; offset?: number }): Promise<{ success: boolean; commits: unknown[]; error?: string }> =>
      ipcRenderer.invoke('commits:list', options),
    breakdown: (options: { repoId?: number; dateFrom: string; dateTo: string; authorEmail?: string }): Promise<{ success: boolean; breakdown: unknown; error?: string }> =>
      ipcRenderer.invoke('commits:breakdown', options),
    byCategory: (options: { dateFrom: string; dateTo: string; authorEmail?: string }): Promise<{ success: boolean; grouped: unknown; breakdown: unknown; error?: string }> =>
      ipcRenderer.invoke('commits:by-category', options),
    recategorize: (): Promise<{ success: boolean; updated: number; error?: string }> =>
      ipcRenderer.invoke('commits:recategorize')
  },

  pregeneration: {
    getStatus: (): Promise<{ status: string; personalSummaryId: number | null; teamSummaryId: number | null; error: string | null }> =>
      ipcRenderer.invoke('pregeneration:status'),
    getSummary: (type: 'personal' | 'team'): Promise<{ success: boolean; summary: { id: number; content: string } | null }> =>
      ipcRenderer.invoke('pregeneration:get-summary', type),
    trigger: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('pregeneration:trigger'),
    onStatus: (callback: (state: { status: string; personalSummaryId: number | null; teamSummaryId: number | null }) => void) => {
      const sub = (_: Electron.IpcRendererEvent, state: unknown) => callback(state as { status: string; personalSummaryId: number | null; teamSummaryId: number | null })
      ipcRenderer.on('pregeneration:status', sub)
      return () => ipcRenderer.removeListener('pregeneration:status', sub)
    }
  },

  app: {
    setAutoLaunch: (enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke('app:set-auto-launch', enabled),
    getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('app:get-auto-launch'),
    onNavigate: (callback: (tab: string) => void) => {
      const sub = (_: Electron.IpcRendererEvent, tab: string) => callback(tab)
      ipcRenderer.on('navigate', sub)
      return () => ipcRenderer.removeListener('navigate', sub)
    },
    onTriggerGenerate: (callback: () => void) => {
      const sub = () => callback()
      ipcRenderer.on('trigger-generate', sub)
      return () => ipcRenderer.removeListener('trigger-generate', sub)
    },
    onScheduledGeneration: (callback: () => void) => {
      const sub = () => callback()
      ipcRenderer.on('scheduled-generation', sub)
      return () => ipcRenderer.removeListener('scheduled-generation', sub)
    }
  },

  contributors: {
    listProfiles: (): Promise<ContributorProfile[]> =>
      ipcRenderer.invoke('contributors:list-profiles'),
    getProfile: (id: number): Promise<ContributorProfile | null> =>
      ipcRenderer.invoke('contributors:get-profile', id),
    createProfile: (
      displayName: string,
      emails: Array<{ email: string; originalName: string }>
    ): Promise<ContributorProfile> =>
      ipcRenderer.invoke('contributors:create-profile', displayName, emails),
    updateProfile: (id: number, displayName: string): Promise<ContributorProfile | null> =>
      ipcRenderer.invoke('contributors:update-profile', id, displayName),
    deleteProfile: (id: number): Promise<void> =>
      ipcRenderer.invoke('contributors:delete-profile', id),
    addEmailToProfile: (profileId: number, email: string, originalName: string): Promise<void> =>
      ipcRenderer.invoke('contributors:add-email-to-profile', profileId, email, originalName),
    removeEmail: (email: string): Promise<void> =>
      ipcRenderer.invoke('contributors:remove-email', email),
    setPrimaryEmail: (profileId: number, email: string): Promise<void> =>
      ipcRenderer.invoke('contributors:set-primary-email', profileId, email),
    setExcluded: (id: number, isExcluded: boolean): Promise<void> =>
      ipcRenderer.invoke('contributors:set-excluded', id, isExcluded),
    getExcludedEmails: (): Promise<string[]> =>
      ipcRenderer.invoke('contributors:get-excluded-emails'),
    getDisplayNameMap: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('contributors:get-display-name-map'),
    getProfileByEmail: (email: string): Promise<ContributorProfile | null> =>
      ipcRenderer.invoke('contributors:get-profile-by-email', email),
    quickExclude: (email: string, originalName: string): Promise<ContributorProfile> =>
      ipcRenderer.invoke('contributors:quick-exclude', email, originalName),
    merge: (
      displayName: string,
      emails: Array<{ email: string; originalName: string }>
    ): Promise<ContributorProfile> =>
      ipcRenderer.invoke('contributors:merge', displayName, emails)
  },

  github: {
    setToken: (token: string): Promise<{ success: boolean; user?: { login: string; name: string | null; email: string | null; avatarUrl: string }; error?: string }> =>
      ipcRenderer.invoke('github:set-token', token),
    checkToken: (): Promise<{ connected: boolean; user?: { login: string; name: string | null; email: string | null; avatarUrl: string } }> =>
      ipcRenderer.invoke('github:check-token'),
    disconnect: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('github:disconnect'),
    detectRepos: (): Promise<{ success: boolean; repos: Array<{ repoId: number; owner: string; repo: string }>; error?: string }> =>
      ipcRenderer.invoke('github:detect-repos'),
    getRepoStatus: (): Promise<{ success: boolean; repos: Array<{ id: number; name: string; owner: string | null; repo: string | null; lastSync: string | null }>; error?: string }> =>
      ipcRenderer.invoke('github:get-repo-status'),
    syncRepo: (repoId: number): Promise<{ success: boolean; stats?: { prs: number; reviews: number; issues: number }; error?: string }> =>
      ipcRenderer.invoke('github:sync-repo', repoId),
    syncAll: (): Promise<{ success: boolean; results?: Array<{ repoId: number; stats: { prs: number; reviews: number; issues: number } }>; error?: string }> =>
      ipcRenderer.invoke('github:sync-all'),
    getPRs: (options: { repoId?: number; dateFrom: string; dateTo: string }): Promise<{ success: boolean; prs: unknown[]; error?: string }> =>
      ipcRenderer.invoke('github:get-prs', options),
    getReviews: (options: { dateFrom: string; dateTo: string }): Promise<{ success: boolean; reviews: unknown[]; error?: string }> =>
      ipcRenderer.invoke('github:get-reviews', options),
    getIssues: (options: { repoId?: number; dateFrom: string; dateTo: string }): Promise<{ success: boolean; issues: unknown[]; error?: string }> =>
      ipcRenderer.invoke('github:get-issues', options),
    getCollaborationGraph: (options: { dateFrom: string; dateTo: string }): Promise<{ success: boolean; graph: { nodes: unknown[]; edges: unknown[] }; error?: string }> =>
      ipcRenderer.invoke('github:get-collaboration-graph', options),
    getCollaborationStats: (options: { dateFrom: string; dateTo: string }): Promise<{ success: boolean; stats: { totalReviews: number; totalReviewers: number; averageReviewsPerPR: number; topReviewer: { name: string; count: number } | null }; error?: string }> =>
      ipcRenderer.invoke('github:get-collaboration-stats', options),
    getTopCollaborators: (options: { dateFrom: string; dateTo: string; limit?: number }): Promise<{ success: boolean; collaborators: Array<{ user: string; avatar: string | null; interactions: number }>; error?: string }> =>
      ipcRenderer.invoke('github:get-top-collaborators', options),
    getEnhancedReviewMetrics: (options: { dateFrom: string; dateTo: string }): Promise<{
      success: boolean
      metrics: {
        avgTimeToFirstReview: number | null
        avgTimeToMerge: number | null
        medianTimeToFirstReview: number | null
        medianTimeToMerge: number | null
        approvalRate: number
        changesRequestedRate: number
        avgReviewRounds: number
        selfMergeRate: number
        stalePRCount: number
        reviewLoadBalance: number
        reviewerStats: Array<{
          name: string
          avatar: string | null
          reviewsGiven: number
          avgResponseTimeHours: number | null
          approvalRate: number
        }>
        pendingReviewers: Array<{
          name: string
          avatar: string | null
          pendingCount: number
        }>
      }
      error?: string
    }> => ipcRenderer.invoke('github:get-enhanced-review-metrics', options)
  },

  summaries: {
    checkClaude: (): Promise<boolean> => ipcRenderer.invoke('summaries:check-claude'),
    getTemplates: (): Promise<Record<string, { name: string; description: string; systemPrompt: string }>> =>
      ipcRenderer.invoke('summaries:get-templates'),
    generate: (request: GenerateRequest): void => ipcRenderer.send('summaries:generate', request),
    list: (type?: 'personal' | 'team', limit?: number): Promise<Summary[]> =>
      ipcRenderer.invoke('summaries:list', type, limit),
    get: (id: number): Promise<Summary | null> => ipcRenderer.invoke('summaries:get', id),
    update: (id: number, content: string): Promise<Summary | null> =>
      ipcRenderer.invoke('summaries:update', id, content),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('summaries:delete', id),
    byDate: (dateFrom: string, dateTo: string): Promise<Summary[]> =>
      ipcRenderer.invoke('summaries:by-date', dateFrom, dateTo),
    onProgress: (callback: (data: { stage: string; message: string; progress?: number }) => void) => {
      const sub = (_: Electron.IpcRendererEvent, data: { stage: string; message: string; progress?: number }) => callback(data)
      ipcRenderer.on('summaries:generate:progress', sub)
      return () => ipcRenderer.removeListener('summaries:generate:progress', sub)
    },
    onText: (callback: (text: string) => void) => {
      const sub = (_: Electron.IpcRendererEvent, text: string) => callback(text)
      ipcRenderer.on('summaries:generate:text', sub)
      return () => ipcRenderer.removeListener('summaries:generate:text', sub)
    },
    onComplete: (callback: (summary: Summary) => void) => {
      const sub = (_: Electron.IpcRendererEvent, summary: Summary) => callback(summary)
      ipcRenderer.on('summaries:generate:complete', sub)
      return () => ipcRenderer.removeListener('summaries:generate:complete', sub)
    },
    onError: (callback: (error: string) => void) => {
      const sub = (_: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('summaries:generate:error', sub)
      return () => ipcRenderer.removeListener('summaries:generate:error', sub)
    }
  },

  velocity: {
    getTrend: (options: { profileId?: number; weeks?: number }): Promise<{ success: boolean; trend: unknown[]; error?: string }> =>
      ipcRenderer.invoke('velocity:get-trend', options),
    getBenchmarks: (userEmail?: string): Promise<{ success: boolean; benchmarks: { average: number; median: number; max: number; yourCommits: number; yourRank: number; totalMembers: number; percentile: number }; error?: string }> =>
      ipcRenderer.invoke('velocity:get-benchmarks', userEmail),
    getActivityByRepo: (options: { dateFrom: string; dateTo: string }): Promise<{ success: boolean; activity: unknown[]; error?: string }> =>
      ipcRenderer.invoke('velocity:get-activity-by-repo', options),
    saveSnapshot: (profileId?: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('velocity:save-snapshot', profileId)
  },

  dangerzone: {
    getStats: (): Promise<{
      success: boolean
      stats: {
        summaries: number
        repositories: number
        commits: number
        pullRequests: number
        reviews: number
        contributorProfiles: number
      } | null
      error?: string
    }> => ipcRenderer.invoke('dangerzone:get-stats'),
    clearSummaries: (): Promise<{ success: boolean; deleted?: number; error?: string }> =>
      ipcRenderer.invoke('dangerzone:clear-summaries'),
    clearGitHub: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('dangerzone:clear-github'),
    clearCommits: (): Promise<{ success: boolean; deleted?: number; error?: string }> =>
      ipcRenderer.invoke('dangerzone:clear-commits'),
    resetSettings: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('dangerzone:reset-settings'),
    resetDatabase: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('dangerzone:reset-database'),
    restartApp: (): Promise<void> =>
      ipcRenderer.invoke('dangerzone:restart-app')
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },

  once: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.api = api
}

export type Api = typeof api
