import { contextBridge, ipcRenderer } from 'electron'
import type { Repository } from '../main/ipc/repos'
import type { Settings } from '../main/ipc/settings'
import type { CommitData, AuthorData, RepoStats, GitUser } from '../main/services/git'
import type { Summary, GenerateRequest } from '../main/ipc/summaries'

// Custom APIs for renderer
const api = {
  repos: {
    list: (): Promise<Repository[]> => ipcRenderer.invoke('repos:list'),
    addDialog: (): Promise<Repository | null> => ipcRenderer.invoke('repos:add-dialog'),
    add: (path: string): Promise<Repository> => ipcRenderer.invoke('repos:add', path),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('repos:remove', id),
    relocate: (id: number): Promise<Repository | null> => ipcRenderer.invoke('repos:relocate', id)
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
      ipcRenderer.invoke('git:get-activity', dateFrom, dateTo, authorEmail)
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
