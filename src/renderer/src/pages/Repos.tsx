import { useEffect, useState, useCallback } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import {
  Github,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Lock,
  Globe,
  Star,
  GitFork,
  Check,
  X
} from 'lucide-react'

interface Repository {
  id: number
  path: string
  name: string
  created_at: string
  is_available: boolean
  is_github?: boolean
  github_owner?: string | null
  github_repo?: string | null
  github_full_name?: string | null
  is_local?: boolean
}

interface GitHubRepo {
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

export default function Repos(): JSX.Element {
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [githubRepos, setGitHubRepos] = useState<GitHubRepo[]>([])
  const [githubLoading, setGitHubLoading] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [importing, setImporting] = useState(false)

  const loadRepos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.repos.list()
      setRepos(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRepos()
  }, [loadRepos])

  const handleRemoveRepo = async (id: number) => {
    try {
      await window.api.repos.remove(id)
      setRepos((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove repository')
    }
  }

  const handleOpenImportModal = async () => {
    setShowImportModal(true)
    setGitHubLoading(true)
    setSelectedRepos(new Set())
    setSearchQuery('')

    try {
      const result = await window.api.oauth.listRepos({ perPage: 100, sort: 'pushed' })
      if (result.success && result.repos) {
        setGitHubRepos(result.repos)
      } else {
        setError(result.error || 'Failed to fetch GitHub repositories')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GitHub repositories')
    } finally {
      setGitHubLoading(false)
    }
  }

  const handleToggleSelect = (fullName: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) {
        next.delete(fullName)
      } else {
        next.add(fullName)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    const allSelected = filteredGitHubRepos.every((repo) => selectedRepos.has(repo.fullName))

    if (allSelected) {
      setSelectedRepos(new Set())
    } else {
      setSelectedRepos(new Set(filteredGitHubRepos.map((repo) => repo.fullName)))
    }
  }

  const handleImport = async () => {
    if (selectedRepos.size === 0) return

    setImporting(true)

    try {
      const reposToImport = Array.from(selectedRepos).map((fullName) => {
        const repo = githubRepos.find((r) => r.fullName === fullName)!
        return {
          owner: repo.owner,
          repo: repo.name,
          name: repo.name
        }
      })

      const result = await window.api.repos.importGitHubBatch(reposToImport)

      if (result.success > 0) {
        await loadRepos()
      }

      if (result.failed > 0 && result.errors.length > 0) {
        setError(`Imported ${result.success}, failed ${result.failed}: ${result.errors[0]}`)
      }

      setShowImportModal(false)
      setSelectedRepos(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import repositories')
    } finally {
      setImporting(false)
    }
  }

  // Filter GitHub repos based on search and already imported
  const importedFullNames = new Set(repos.map((r) => r.github_full_name).filter(Boolean))
  const filteredGitHubRepos = githubRepos.filter((repo) => {
    const matchesSearch =
      searchQuery === '' ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const notImported = !importedFullNames.has(repo.fullName)
    return matchesSearch && notImported
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Repositories</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Import GitHub repositories for summary generation
          </p>
        </div>
        <Button onClick={handleOpenImportModal}>
          <Plus className="mr-2 h-4 w-4" />
          Import from GitHub
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-subtle p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <span className="flex-1 text-[13px] text-destructive">{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Repository List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">Loading repositories...</span>
            </div>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle">
              <Github className="h-7 w-7 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium">No repositories imported</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Import your GitHub repositories to start generating summaries
              </p>
            </div>
            <Button onClick={handleOpenImportModal} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Import from GitHub
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-card-hover"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24292f]">
                    <Github className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium">{repo.name}</p>
                      <CheckCircle className="h-3.5 w-3.5 text-success" />
                    </div>
                    {repo.github_full_name ? (
                      <p className="text-[12px] text-muted-foreground">{repo.github_full_name}</p>
                    ) : (
                      <p className="truncate text-[12px] text-muted-foreground">{repo.path}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRepo(repo.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-elevated">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-[17px] font-semibold">Import GitHub Repositories</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Select repositories to track
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full rounded-lg border border-input-border bg-input py-2 pl-10 pr-4 text-[13px] placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Repository List */}
            <div className="flex-1 overflow-y-auto p-4">
              {githubLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-[13px]">Loading repositories...</span>
                  </div>
                </div>
              ) : filteredGitHubRepos.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Github className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-[13px] font-medium">No repositories found</p>
                  <p className="text-[12px] text-muted-foreground">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'All repositories have been imported'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Select All */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-[12px] text-muted-foreground">
                      {filteredGitHubRepos.length} repositories available
                    </span>
                    <button
                      onClick={handleSelectAll}
                      className="text-[12px] font-medium text-accent hover:underline"
                    >
                      {filteredGitHubRepos.every((repo) => selectedRepos.has(repo.fullName))
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>

                  {filteredGitHubRepos.map((repo) => {
                    const isSelected = selectedRepos.has(repo.fullName)
                    return (
                      <button
                        key={repo.id}
                        onClick={() => handleToggleSelect(repo.fullName)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border transition-all ${
                            isSelected
                              ? 'border-accent bg-accent text-white'
                              : 'border-input-border bg-input'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium">{repo.name}</span>
                            {repo.isPrivate ? (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Globe className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-[12px] text-muted-foreground">{repo.owner}</p>
                          {repo.description && (
                            <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                              {repo.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-accent" />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {repo.stargazersCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="h-3 w-3" />
                              {repo.forksCount}
                            </span>
                            <span>Updated {formatDate(repo.pushedAt)}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border p-5">
              <span className="text-[13px] text-muted-foreground">
                {selectedRepos.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedRepos.size === 0 || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Import ({selectedRepos.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
