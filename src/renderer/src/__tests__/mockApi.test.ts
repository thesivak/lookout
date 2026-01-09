import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mockApi, installMockApi } from '../mockApi'

describe('mockApi', () => {
  describe('repos', () => {
    it('should list repositories', async () => {
      const repos = await mockApi.repos.list()
      expect(repos).toBeInstanceOf(Array)
      expect(repos.length).toBeGreaterThan(0)
      expect(repos[0]).toHaveProperty('id')
      expect(repos[0]).toHaveProperty('name')
      expect(repos[0]).toHaveProperty('path')
      expect(repos[0]).toHaveProperty('available')
    })

    it('should add a repository via dialog', async () => {
      const initialRepos = await mockApi.repos.list()
      const initialCount = initialRepos.length

      const newRepo = await mockApi.repos.addDialog()
      expect(newRepo).toHaveProperty('id')
      expect(newRepo).toHaveProperty('name', 'new-repo')
      expect(newRepo?.available).toBe(true)

      const updatedRepos = await mockApi.repos.list()
      expect(updatedRepos.length).toBe(initialCount + 1)
    })

    it('should add a repository by path', async () => {
      const path = '/Users/test/my-awesome-project'
      const newRepo = await mockApi.repos.add(path)

      expect(newRepo).toHaveProperty('name', 'my-awesome-project')
      expect(newRepo).toHaveProperty('path', path)
      expect(newRepo?.available).toBe(true)
    })

    it('should remove a repository', async () => {
      // Create a repo specifically for this test to avoid state dependencies
      const testRepo = await mockApi.repos.add('/test/remove-me')
      const reposBeforeRemove = await mockApi.repos.list()
      const countBefore = reposBeforeRemove.length

      await mockApi.repos.remove(testRepo.id)

      const reposAfterRemove = await mockApi.repos.list()
      expect(reposAfterRemove.length).toBe(countBefore - 1)
      expect(reposAfterRemove.find(r => r.id === testRepo.id)).toBeUndefined()
    })

    it('should relocate an unavailable repository', async () => {
      const repos = await mockApi.repos.list()
      const unavailableRepo = repos.find(r => !r.available)

      if (unavailableRepo) {
        const relocated = await mockApi.repos.relocate(unavailableRepo.id)
        expect(relocated?.available).toBe(true)
      }
    })

    it('should return null when relocating non-existent repo', async () => {
      const result = await mockApi.repos.relocate(999999)
      expect(result).toBeNull()
    })
  })

  describe('settings', () => {
    it('should get all settings', async () => {
      const settings = await mockApi.settings.getAll()
      expect(settings).toHaveProperty('autoLaunch')
      expect(settings).toHaveProperty('scheduledEnabled')
      expect(settings).toHaveProperty('scheduledTime')
      expect(settings).toHaveProperty('defaultTemplate')
      expect(settings).toHaveProperty('defaultDateRange')
    })

    it('should get a specific setting', async () => {
      const value = await mockApi.settings.get('defaultTemplate')
      expect(value).toBe('technical')
    })

    it('should return null for non-existent setting', async () => {
      const value = await mockApi.settings.get('nonExistentKey')
      expect(value).toBeNull()
    })

    it('should set a setting value', async () => {
      await mockApi.settings.set('autoLaunch', 'true')
      const value = await mockApi.settings.get('autoLaunch')
      expect(value).toBe('true')
    })

    it('should set multiple settings at once', async () => {
      await mockApi.settings.setMany({
        scheduledEnabled: 'true',
        scheduledTime: '10:00'
      })

      const enabled = await mockApi.settings.get('scheduledEnabled')
      const time = await mockApi.settings.get('scheduledTime')

      expect(enabled).toBe('true')
      expect(time).toBe('10:00')
    })
  })

  describe('git', () => {
    it('should get user info', async () => {
      const user = await mockApi.git.getUser()
      expect(user).toHaveProperty('name')
      expect(user).toHaveProperty('email')
    })

    it('should get commits', async () => {
      const commits = await mockApi.git.getCommits('', '', '')
      expect(commits).toBeInstanceOf(Array)
      expect(commits[0]).toHaveProperty('hash')
      expect(commits[0]).toHaveProperty('message')
      expect(commits[0]).toHaveProperty('date')
    })

    it('should get all commits across repos', async () => {
      const allCommits = await mockApi.git.getAllCommits('', '')
      expect(allCommits).toBeInstanceOf(Array)
      expect(allCommits[0]).toHaveProperty('repoName')
      expect(allCommits[0]).toHaveProperty('repoPath')
      expect(allCommits[0]).toHaveProperty('commits')
    })

    it('should get authors', async () => {
      const authors = await mockApi.git.getAuthors('', '', '')
      expect(authors).toBeInstanceOf(Array)
      expect(authors[0]).toHaveProperty('name')
      expect(authors[0]).toHaveProperty('email')
      expect(authors[0]).toHaveProperty('commitCount')
    })

    it('should get all authors across repos', async () => {
      const authors = await mockApi.git.getAllAuthors('', '')
      expect(authors).toBeInstanceOf(Array)
      expect(authors.length).toBeGreaterThan(0)
    })

    it('should fetch all repos', async () => {
      const result = await mockApi.git.fetchAll()
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('errors')
      expect(result.errors).toBeInstanceOf(Array)
    })

    it('should get stats', async () => {
      const stats = await mockApi.git.getStats('', '', '')
      expect(stats).toHaveProperty('totalCommits')
      expect(stats).toHaveProperty('mergeCommits')
      expect(stats).toHaveProperty('additions')
      expect(stats).toHaveProperty('deletions')
      expect(stats).toHaveProperty('filesChanged')
    })

    it('should get all stats with correct schema', async () => {
      const stats = await mockApi.git.getAllStats('', '')
      expect(stats).toHaveProperty('totalCommits', 45)
      expect(stats).toHaveProperty('mergeCommits', 8)
      expect(stats).toHaveProperty('additions', 1500)
      expect(stats).toHaveProperty('deletions', 400)
      expect(stats).toHaveProperty('filesChanged', 80)
      expect(stats).toHaveProperty('authors')
    })

    it('should get activity map', async () => {
      const activity = await mockApi.git.getActivity()
      expect(typeof activity).toBe('object')
      const keys = Object.keys(activity)
      expect(keys.length).toBeGreaterThan(0)
      // Check date format
      expect(keys[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('app', () => {
    it('should set auto launch', async () => {
      const result = await mockApi.app.setAutoLaunch(true)
      expect(result).toBe(true)
    })

    it('should get auto launch status', async () => {
      const result = await mockApi.app.getAutoLaunch()
      expect(typeof result).toBe('boolean')
    })

    it('should register and unregister navigate listener', () => {
      const callback = vi.fn()
      const unsubscribe = mockApi.app.onNavigate(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should register and unregister trigger generate listener', () => {
      const callback = vi.fn()
      const unsubscribe = mockApi.app.onTriggerGenerate(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should register and unregister scheduled generation listener', () => {
      const callback = vi.fn()
      const unsubscribe = mockApi.app.onScheduledGeneration(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })

  describe('contributors', () => {
    it('should list contributor profiles', async () => {
      const profiles = await mockApi.contributors.listProfiles()
      expect(profiles).toBeInstanceOf(Array)
      expect(profiles[0]).toHaveProperty('id')
      expect(profiles[0]).toHaveProperty('displayName')
      expect(profiles[0]).toHaveProperty('emails')
      expect(profiles[0]).toHaveProperty('isExcluded')
    })

    it('should get a specific profile', async () => {
      const profiles = await mockApi.contributors.listProfiles()
      const profile = await mockApi.contributors.getProfile(profiles[0].id)
      expect(profile).not.toBeNull()
      expect(profile?.id).toBe(profiles[0].id)
    })

    it('should return null for non-existent profile', async () => {
      const profile = await mockApi.contributors.getProfile(999999)
      expect(profile).toBeNull()
    })

    it('should create a new profile', async () => {
      const emails = [{ email: 'new@example.com', originalName: 'New User' }]
      const profile = await mockApi.contributors.createProfile('New User', emails)

      expect(profile).toHaveProperty('id')
      expect(profile.displayName).toBe('New User')
      expect(profile.emails).toEqual(emails)
      expect(profile.isExcluded).toBe(false)
    })

    it('should update a profile', async () => {
      const profiles = await mockApi.contributors.listProfiles()
      const updated = await mockApi.contributors.updateProfile(profiles[0].id, 'Updated Name')

      expect(updated?.displayName).toBe('Updated Name')
    })

    it('should return null when updating non-existent profile', async () => {
      const result = await mockApi.contributors.updateProfile(999999, 'Test')
      expect(result).toBeNull()
    })

    it('should set excluded status', async () => {
      const profiles = await mockApi.contributors.listProfiles()
      const profile = profiles.find(p => !p.isExcluded)

      if (profile) {
        await mockApi.contributors.setExcluded(profile.id, true)
        const updated = await mockApi.contributors.getProfile(profile.id)
        expect(updated?.isExcluded).toBe(true)
      }
    })

    it('should get excluded emails', async () => {
      const emails = await mockApi.contributors.getExcludedEmails()
      expect(emails).toBeInstanceOf(Array)
    })

    it('should get display name map', async () => {
      const map = await mockApi.contributors.getDisplayNameMap()
      expect(typeof map).toBe('object')
    })

    it('should get profile by email', async () => {
      const profiles = await mockApi.contributors.listProfiles()
      const testEmail = profiles[0].emails[0].email

      const profile = await mockApi.contributors.getProfileByEmail(testEmail)
      expect(profile).not.toBeNull()
    })

    it('should return null for unknown email', async () => {
      const profile = await mockApi.contributors.getProfileByEmail('unknown@nowhere.com')
      expect(profile).toBeNull()
    })

    it('should quick exclude a contributor', async () => {
      const profile = await mockApi.contributors.quickExclude('bot@github.com', 'SomeBot')

      expect(profile.isExcluded).toBe(true)
      expect(profile.displayName).toBe('SomeBot')
    })

    it('should merge contributors', async () => {
      const emails = [
        { email: 'alice@work.com', originalName: 'Alice' },
        { email: 'alice@personal.com', originalName: 'A. Smith' }
      ]
      const merged = await mockApi.contributors.merge('Alice Smith', emails)

      expect(merged.displayName).toBe('Alice Smith')
      expect(merged.emails).toHaveLength(2)
    })
  })

  describe('summaries', () => {
    it('should check Claude availability', async () => {
      const available = await mockApi.summaries.checkClaude()
      expect(available).toBe(true)
    })

    it('should get templates', async () => {
      const templates = await mockApi.summaries.getTemplates()
      expect(templates).toHaveProperty('technical')
      expect(templates).toHaveProperty('manager')
      expect(templates).toHaveProperty('casual')
      expect(templates.technical).toHaveProperty('name')
      expect(templates.technical).toHaveProperty('description')
    })

    it('should list summaries', async () => {
      const summaries = await mockApi.summaries.list()
      expect(summaries).toBeInstanceOf(Array)
      expect(summaries[0]).toHaveProperty('id')
      expect(summaries[0]).toHaveProperty('type')
      expect(summaries[0]).toHaveProperty('content')
      // Check snake_case format
      expect(summaries[0]).toHaveProperty('date_from')
      expect(summaries[0]).toHaveProperty('date_to')
      expect(summaries[0]).toHaveProperty('commit_count')
      expect(summaries[0]).toHaveProperty('prompt_template')
    })

    it('should filter summaries by type', async () => {
      const personalSummaries = await mockApi.summaries.list('personal')
      personalSummaries.forEach(s => {
        expect(s.type).toBe('personal')
      })
    })

    it('should limit summaries', async () => {
      const limited = await mockApi.summaries.list(undefined, 1)
      expect(limited.length).toBeLessThanOrEqual(1)
    })

    it('should get a specific summary', async () => {
      const summaries = await mockApi.summaries.list()
      const summary = await mockApi.summaries.get(summaries[0].id)
      expect(summary).not.toBeNull()
      expect(summary?.id).toBe(summaries[0].id)
    })

    it('should return null for non-existent summary', async () => {
      const summary = await mockApi.summaries.get(999999)
      expect(summary).toBeNull()
    })

    it('should update a summary', async () => {
      const summaries = await mockApi.summaries.list()
      const newContent = '## Updated Content'

      const updated = await mockApi.summaries.update(summaries[0].id, newContent)
      expect(updated?.content).toBe(newContent)
    })

    it('should delete a summary', async () => {
      const summaries = await mockApi.summaries.list()
      const initialCount = summaries.length
      const idToDelete = summaries[summaries.length - 1].id

      await mockApi.summaries.delete(idToDelete)

      const updatedSummaries = await mockApi.summaries.list()
      expect(updatedSummaries.length).toBe(initialCount - 1)
    })

    it('should register event listeners for generation', () => {
      const progressCb = vi.fn()
      const textCb = vi.fn()
      const completeCb = vi.fn()
      const errorCb = vi.fn()

      const unsubProgress = mockApi.summaries.onProgress(progressCb)
      const unsubText = mockApi.summaries.onText(textCb)
      const unsubComplete = mockApi.summaries.onComplete(completeCb)
      const unsubError = mockApi.summaries.onError(errorCb)

      expect(typeof unsubProgress).toBe('function')
      expect(typeof unsubText).toBe('function')
      expect(typeof unsubComplete).toBe('function')
      expect(typeof unsubError).toBe('function')

      unsubProgress()
      unsubText()
      unsubComplete()
      unsubError()
    })

    describe('generate with streaming', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should emit progress events during generation', async () => {
        const progressCb = vi.fn()
        const unsub = mockApi.summaries.onProgress(progressCb)

        mockApi.summaries.generate({
          type: 'personal',
          template: 'technical',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-08'
        })

        // Advance through the progress events
        await vi.advanceTimersByTimeAsync(100)
        expect(progressCb).toHaveBeenCalledWith(
          expect.objectContaining({ stage: 'collecting', progress: 10 })
        )

        await vi.advanceTimersByTimeAsync(400)
        expect(progressCb).toHaveBeenCalledWith(
          expect.objectContaining({ stage: 'analyzing', progress: 40 })
        )

        unsub()
      })

      it('should emit text events during generation', async () => {
        const textCb = vi.fn()
        const unsub = mockApi.summaries.onText(textCb)

        mockApi.summaries.generate({
          type: 'personal',
          template: 'technical',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-08'
        })

        await vi.advanceTimersByTimeAsync(1000)
        expect(textCb).toHaveBeenCalled()

        unsub()
      })

      it('should emit complete event with summary', async () => {
        const completeCb = vi.fn()
        const unsub = mockApi.summaries.onComplete(completeCb)

        mockApi.summaries.generate({
          type: 'personal',
          template: 'technical',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-08'
        })

        await vi.advanceTimersByTimeAsync(2000)
        expect(completeCb).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'personal',
            prompt_template: 'technical'
          })
        )

        unsub()
      })
    })
  })

  describe('generic event handlers', () => {
    it('should register and trigger on listener', () => {
      const callback = vi.fn()
      const unsub = mockApi.on('test-channel', callback)

      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('should register once listener', () => {
      const callback = vi.fn()
      mockApi.once('test-once-channel', callback)
      // once doesn't return unsubscribe, just void
    })
  })
})

describe('installMockApi', () => {
  beforeEach(() => {
    // Ensure window.api is undefined before each test
    delete (window as Record<string, unknown>).api
  })

  it('should install mock API when window.api is undefined', () => {
    expect((window as Record<string, unknown>).api).toBeUndefined()

    installMockApi()

    expect((window as Record<string, unknown>).api).toBeDefined()
    expect((window as Record<string, unknown>).api).toBe(mockApi)
  })

  it('should not override existing window.api', () => {
    const existingApi = { repos: { list: () => [] } }
    ;(window as Record<string, unknown>).api = existingApi

    installMockApi()

    expect((window as Record<string, unknown>).api).toBe(existingApi)
  })
})
