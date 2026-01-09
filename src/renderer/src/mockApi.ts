// Mock API for browser testing (when Electron APIs are not available)
// This allows testing the UI without requiring Electron context

import type { Api } from '../../preload/index'

// Counter for generating unique IDs (avoids Date.now() collisions in tests)
let nextId = 1000

function generateId(): number {
  return nextId++
}

const mockRepos = [
  { id: 1, name: 'lookout', path: '/Users/mireksivak/CODE/lookout', available: true, addedAt: new Date().toISOString() },
  { id: 2, name: 'my-project', path: '/Users/mireksivak/CODE/my-project', available: true, addedAt: new Date().toISOString() },
  { id: 3, name: 'old-repo', path: '/Users/mireksivak/CODE/old-repo', available: false, addedAt: new Date().toISOString() },
]

const mockSummaries = [
  {
    id: 1,
    type: 'personal' as const,
    prompt_template: 'technical',
    content: '## Work Summary\n\n- Fixed authentication bug in user login flow\n- Added unit tests for payment processing\n- Refactored database queries for better performance\n- Updated documentation for API endpoints',
    date_from: '2026-01-02',
    date_to: '2026-01-08',
    commit_count: 15,
    merge_count: 2,
    created_at: '2026-01-08T10:30:00Z'
  },
  {
    id: 2,
    type: 'personal' as const,
    prompt_template: 'manager',
    content: '## Weekly Update\n\nThis week I focused on improving system reliability and user experience.\n\n**Key Achievements:**\n- Resolved critical login issue affecting 5% of users\n- Improved checkout speed by 30%\n- Delivered new dashboard analytics feature',
    date_from: '2025-12-26',
    date_to: '2026-01-01',
    commit_count: 22,
    merge_count: 3,
    created_at: '2026-01-01T09:00:00Z'
  },
  {
    id: 3,
    type: 'team' as const,
    prompt_template: 'technical',
    content: '## Team Summary\n\n### Alice\n- Implemented new search functionality\n- Fixed pagination bugs\n\n### Bob\n- Updated CI/CD pipeline\n- Added monitoring alerts\n\n### Charlie\n- Refactored authentication module\n- Added rate limiting',
    date_from: '2026-01-02',
    date_to: '2026-01-08',
    commit_count: 45,
    merge_count: 8,
    created_at: '2026-01-08T11:00:00Z'
  }
]

const mockContributors = [
  { id: 1, displayName: 'Alice Smith', emails: [{ email: 'alice@example.com', originalName: 'Alice Smith' }], isExcluded: false, createdAt: '2026-01-01' },
  { id: 2, displayName: 'Bob Jones', emails: [{ email: 'bob@example.com', originalName: 'Bob Jones' }, { email: 'bob.jones@work.com', originalName: 'Bob J' }], isExcluded: false, createdAt: '2026-01-01' },
  { id: 3, displayName: 'Dependabot', emails: [{ email: 'dependabot@github.com', originalName: 'dependabot[bot]' }], isExcluded: true, createdAt: '2026-01-01' },
]

const mockSettings = {
  autoLaunch: 'false',
  scheduledEnabled: 'false',
  scheduledTime: '09:00',
  defaultTemplate: 'technical',
  defaultDateRange: 'last7'
}

const generateActivity = () => {
  const activity: Record<string, number> = {}
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    // Random activity with some days having no commits
    activity[dateStr] = Math.random() > 0.4 ? Math.floor(Math.random() * 10) : 0
  }
  return activity
}

// Event listeners storage
const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

export const mockApi: Api = {
  repos: {
    list: async () => mockRepos,
    addDialog: async () => {
      // Simulate adding a new repo
      const newRepo = { id: generateId(), name: 'new-repo', path: '/path/to/new-repo', available: true, addedAt: new Date().toISOString() }
      mockRepos.push(newRepo)
      return newRepo
    },
    add: async (path: string) => {
      const name = path.split('/').pop() || 'unknown'
      const newRepo = { id: generateId(), name, path, available: true, addedAt: new Date().toISOString() }
      mockRepos.push(newRepo)
      return newRepo
    },
    remove: async (id: number) => {
      const idx = mockRepos.findIndex(r => r.id === id)
      if (idx !== -1) mockRepos.splice(idx, 1)
    },
    relocate: async (id: number) => {
      const repo = mockRepos.find(r => r.id === id)
      if (repo) {
        repo.available = true
        return repo
      }
      return null
    }
  },

  settings: {
    getAll: async () => mockSettings,
    get: async (key: string) => mockSettings[key as keyof typeof mockSettings] || null,
    set: async (key: string, value: string) => {
      (mockSettings as Record<string, string>)[key] = value
    },
    setMany: async (settings: Record<string, string>) => {
      Object.assign(mockSettings, settings)
    }
  },

  git: {
    getUser: async () => ({ name: 'Test User', email: 'test@example.com' }),
    getCommits: async () => [
      { hash: 'abc123', message: 'Fix authentication bug', date: '2026-01-08', additions: 50, deletions: 20 },
      { hash: 'def456', message: 'Add unit tests', date: '2026-01-07', additions: 200, deletions: 10 },
    ],
    getAllCommits: async () => [
      { repoName: 'lookout', repoPath: '/path/to/lookout', commits: [
        { hash: 'abc123', message: 'Fix authentication bug', date: '2026-01-08', additions: 50, deletions: 20 },
      ]},
    ],
    getAuthors: async () => [
      { name: 'Alice Smith', email: 'alice@example.com', commitCount: 45 },
      { name: 'Bob Jones', email: 'bob@example.com', commitCount: 32 },
      { name: 'Charlie Brown', email: 'charlie@example.com', commitCount: 18 },
    ],
    getAllAuthors: async () => [
      { name: 'Alice Smith', email: 'alice@example.com', commitCount: 45 },
      { name: 'Bob Jones', email: 'bob@example.com', commitCount: 32 },
      { name: 'Charlie Brown', email: 'charlie@example.com', commitCount: 18 },
      { name: 'Test User', email: 'test@example.com', commitCount: 28 },
    ],
    fetchAll: async () => ({ success: true, errors: [] }),
    getStats: async () => ({ totalCommits: 15, mergeCommits: 2, additions: 500, deletions: 150, filesChanged: 25, authors: [] }),
    getAllStats: async () => ({ totalCommits: 45, mergeCommits: 8, additions: 1500, deletions: 400, filesChanged: 80, authors: [] }),
    getActivity: async () => generateActivity()
  },

  app: {
    setAutoLaunch: async () => true,
    getAutoLaunch: async () => false,
    onNavigate: (callback) => {
      if (!listeners['navigate']) listeners['navigate'] = []
      listeners['navigate'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['navigate'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['navigate'].splice(idx, 1)
      }
    },
    onTriggerGenerate: (callback) => {
      if (!listeners['trigger-generate']) listeners['trigger-generate'] = []
      listeners['trigger-generate'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['trigger-generate'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['trigger-generate'].splice(idx, 1)
      }
    },
    onScheduledGeneration: (callback) => {
      if (!listeners['scheduled-generation']) listeners['scheduled-generation'] = []
      listeners['scheduled-generation'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['scheduled-generation'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['scheduled-generation'].splice(idx, 1)
      }
    }
  },

  contributors: {
    listProfiles: async () => mockContributors,
    getProfile: async (id: number) => mockContributors.find(c => c.id === id) || null,
    createProfile: async (displayName, emails) => {
      const newProfile = { id: generateId(), displayName, emails, isExcluded: false, createdAt: new Date().toISOString() }
      mockContributors.push(newProfile)
      return newProfile
    },
    updateProfile: async (id, displayName) => {
      const profile = mockContributors.find(c => c.id === id)
      if (profile) {
        profile.displayName = displayName
        return profile
      }
      return null
    },
    deleteProfile: async () => {},
    addEmailToProfile: async () => {},
    removeEmail: async () => {},
    setPrimaryEmail: async () => {},
    setExcluded: async (id, isExcluded) => {
      const profile = mockContributors.find(c => c.id === id)
      if (profile) profile.isExcluded = isExcluded
    },
    getExcludedEmails: async () => mockContributors.filter(c => c.isExcluded).flatMap(c => c.emails.map(e => e.email)),
    getDisplayNameMap: async () => {
      const map: Record<string, string> = {}
      mockContributors.forEach(c => c.emails.forEach(e => { map[e.email] = c.displayName }))
      return map
    },
    getProfileByEmail: async (email) => mockContributors.find(c => c.emails.some(e => e.email === email)) || null,
    quickExclude: async (email, originalName) => {
      const newProfile = { id: generateId(), displayName: originalName, emails: [{ email, originalName }], isExcluded: true, createdAt: new Date().toISOString() }
      mockContributors.push(newProfile)
      return newProfile
    },
    merge: async (displayName, emails) => {
      const newProfile = { id: generateId(), displayName, emails, isExcluded: false, createdAt: new Date().toISOString() }
      mockContributors.push(newProfile)
      return newProfile
    }
  },

  summaries: {
    checkClaude: async () => true,
    getTemplates: async () => ({
      technical: { name: 'Technical', description: 'Detailed technical summary', systemPrompt: '' },
      manager: { name: 'Manager-Friendly', description: 'High-level business summary', systemPrompt: '' },
      casual: { name: 'Casual Standup', description: 'Brief casual summary', systemPrompt: '' }
    }),
    generate: (request) => {
      // Simulate streaming generation
      setTimeout(() => {
        listeners['summaries:generate:progress']?.forEach(cb => cb({ stage: 'collecting', message: 'Collecting commits...', progress: 10 }))
      }, 100)
      setTimeout(() => {
        listeners['summaries:generate:progress']?.forEach(cb => cb({ stage: 'analyzing', message: 'Analyzing changes...', progress: 40 }))
      }, 500)
      setTimeout(() => {
        listeners['summaries:generate:text']?.forEach(cb => cb('## Work Summary\n\n'))
      }, 800)
      setTimeout(() => {
        listeners['summaries:generate:text']?.forEach(cb => cb('- Fixed authentication bug\n'))
      }, 1000)
      setTimeout(() => {
        listeners['summaries:generate:text']?.forEach(cb => cb('- Added new features\n'))
      }, 1200)
      setTimeout(() => {
        listeners['summaries:generate:progress']?.forEach(cb => cb({ stage: 'generating', message: 'Generating summary...', progress: 80 }))
      }, 1300)
      setTimeout(() => {
        listeners['summaries:generate:text']?.forEach(cb => cb('- Improved performance\n'))
      }, 1400)
      setTimeout(() => {
        const newSummary = {
          id: generateId(),
          type: request.type,
          prompt_template: request.template,
          content: '## Work Summary\n\n- Fixed authentication bug\n- Added new features\n- Improved performance\n',
          date_from: request.dateFrom,
          date_to: request.dateTo,
          commit_count: 15,
          merge_count: 2,
          created_at: new Date().toISOString()
        }
        mockSummaries.unshift(newSummary as typeof mockSummaries[0])
        listeners['summaries:generate:complete']?.forEach(cb => cb(newSummary))
      }, 1800)
    },
    list: async (type, limit) => {
      let results = mockSummaries
      if (type) results = results.filter(s => s.type === type)
      if (limit) results = results.slice(0, limit)
      return results
    },
    get: async (id) => mockSummaries.find(s => s.id === id) || null,
    update: async (id, content) => {
      const summary = mockSummaries.find(s => s.id === id)
      if (summary) {
        summary.content = content
        return summary
      }
      return null
    },
    delete: async (id) => {
      const idx = mockSummaries.findIndex(s => s.id === id)
      if (idx !== -1) mockSummaries.splice(idx, 1)
    },
    byDate: async (dateFrom, dateTo) => mockSummaries.filter(s => s.dateFrom >= dateFrom && s.dateTo <= dateTo),
    onProgress: (callback) => {
      if (!listeners['summaries:generate:progress']) listeners['summaries:generate:progress'] = []
      listeners['summaries:generate:progress'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['summaries:generate:progress'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['summaries:generate:progress'].splice(idx, 1)
      }
    },
    onText: (callback) => {
      if (!listeners['summaries:generate:text']) listeners['summaries:generate:text'] = []
      listeners['summaries:generate:text'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['summaries:generate:text'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['summaries:generate:text'].splice(idx, 1)
      }
    },
    onComplete: (callback) => {
      if (!listeners['summaries:generate:complete']) listeners['summaries:generate:complete'] = []
      listeners['summaries:generate:complete'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['summaries:generate:complete'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['summaries:generate:complete'].splice(idx, 1)
      }
    },
    onError: (callback) => {
      if (!listeners['summaries:generate:error']) listeners['summaries:generate:error'] = []
      listeners['summaries:generate:error'].push(callback as (...args: unknown[]) => void)
      return () => {
        const idx = listeners['summaries:generate:error'].indexOf(callback as (...args: unknown[]) => void)
        if (idx !== -1) listeners['summaries:generate:error'].splice(idx, 1)
      }
    }
  },

  on: (channel, callback) => {
    if (!listeners[channel]) listeners[channel] = []
    listeners[channel].push(callback)
    return () => {
      const idx = listeners[channel].indexOf(callback)
      if (idx !== -1) listeners[channel].splice(idx, 1)
    }
  },

  once: (channel, callback) => {
    const onceCallback = (...args: unknown[]) => {
      callback(...args)
      const idx = listeners[channel]?.indexOf(onceCallback)
      if (idx !== undefined && idx !== -1) listeners[channel].splice(idx, 1)
    }
    if (!listeners[channel]) listeners[channel] = []
    listeners[channel].push(onceCallback)
  }
}

// Install mock API if real API is not available
export function installMockApi(): void {
  if (typeof window !== 'undefined' && !window.api) {
    console.log('[Mock API] Installing mock API for browser testing')
    ;(window as unknown as { api: Api }).api = mockApi
  }
}
