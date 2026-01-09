/// <reference types="vite/client" />

interface Repository {
  id: number
  path: string
  name: string
  created_at: string
  last_accessed_at: string | null
  is_available: boolean
}

interface Settings {
  scheduled_time: string
  scheduled_enabled: string
  default_prompt_template: string
  date_range_default: string
  [key: string]: string
}

interface CommitData {
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

interface AuthorData {
  email: string
  name: string
  commitCount: number
}

interface RepoStats {
  totalCommits: number
  mergeCommits: number
  additions: number
  deletions: number
  filesChanged: number
  authors: AuthorData[]
}

interface GitUser {
  name: string
  email: string
}

interface RepoCommits {
  repoName: string
  repoPath: string
  commits: CommitData[]
}

interface Summary {
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

interface GenerateRequest {
  type: 'personal' | 'team'
  dateFrom: string
  dateTo: string
  template: string
  authorEmail?: string
}

interface PromptTemplate {
  name: string
  description: string
  systemPrompt: string
}

interface GenerationProgress {
  stage: string
  message: string
  progress?: number
}

interface ContributorEmail {
  email: string
  profileId: number
  isPrimary: boolean
  originalName: string
  createdAt: string
}

interface ContributorProfile {
  id: number
  displayName: string
  isExcluded: boolean
  emails: ContributorEmail[]
  createdAt: string
  updatedAt: string
}

interface Api {
  app: {
    setAutoLaunch: (enabled: boolean) => Promise<boolean>
    getAutoLaunch: () => Promise<boolean>
    onNavigate: (callback: (tab: string) => void) => () => void
    onTriggerGenerate: (callback: () => void) => () => void
    onScheduledGeneration: (callback: () => void) => () => void
  }
  repos: {
    list: () => Promise<Repository[]>
    addDialog: () => Promise<Repository | null>
    add: (path: string) => Promise<Repository>
    remove: (id: number) => Promise<void>
    relocate: (id: number) => Promise<Repository | null>
  }
  settings: {
    getAll: () => Promise<Settings>
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    setMany: (settings: Record<string, string>) => Promise<void>
  }
  git: {
    getUser: () => Promise<GitUser>
    getCommits: (
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ) => Promise<CommitData[]>
    getAllCommits: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ) => Promise<RepoCommits[]>
    getAuthors: (
      repoPath: string,
      dateFrom?: string,
      dateTo?: string
    ) => Promise<AuthorData[]>
    getAllAuthors: (dateFrom?: string, dateTo?: string) => Promise<AuthorData[]>
    fetchAll: () => Promise<{ success: boolean; errors: string[] }>
    getStats: (
      repoPath: string,
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ) => Promise<RepoStats>
    getAllStats: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ) => Promise<RepoStats>
    getActivity: (
      dateFrom: string,
      dateTo: string,
      authorEmail?: string
    ) => Promise<Record<string, number>>
  }
  contributors: {
    listProfiles: () => Promise<ContributorProfile[]>
    getProfile: (id: number) => Promise<ContributorProfile | null>
    createProfile: (
      displayName: string,
      emails: Array<{ email: string; originalName: string }>
    ) => Promise<ContributorProfile>
    updateProfile: (id: number, displayName: string) => Promise<ContributorProfile | null>
    deleteProfile: (id: number) => Promise<void>
    addEmailToProfile: (profileId: number, email: string, originalName: string) => Promise<void>
    removeEmail: (email: string) => Promise<void>
    setPrimaryEmail: (profileId: number, email: string) => Promise<void>
    setExcluded: (id: number, isExcluded: boolean) => Promise<void>
    getExcludedEmails: () => Promise<string[]>
    getDisplayNameMap: () => Promise<Record<string, string>>
    getProfileByEmail: (email: string) => Promise<ContributorProfile | null>
    quickExclude: (email: string, originalName: string) => Promise<ContributorProfile>
    merge: (
      displayName: string,
      emails: Array<{ email: string; originalName: string }>
    ) => Promise<ContributorProfile>
  }
  summaries: {
    checkClaude: () => Promise<boolean>
    getTemplates: () => Promise<Record<string, PromptTemplate>>
    generate: (request: GenerateRequest) => void
    list: (type?: 'personal' | 'team', limit?: number) => Promise<Summary[]>
    get: (id: number) => Promise<Summary | null>
    update: (id: number, content: string) => Promise<Summary | null>
    delete: (id: number) => Promise<void>
    byDate: (dateFrom: string, dateTo: string) => Promise<Summary[]>
    onProgress: (callback: (data: GenerationProgress) => void) => () => void
    onText: (callback: (text: string) => void) => () => void
    onComplete: (callback: (summary: Summary) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  once: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
