import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FolderGit2, Plus, Trash2, AlertCircle, FolderSearch, CheckCircle } from 'lucide-react'

interface Repository {
  id: number
  path: string
  name: string
  created_at: string
  is_available: boolean
}

export default function Repos(): JSX.Element {
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRepos = async () => {
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
  }

  useEffect(() => {
    loadRepos()
  }, [])

  const handleAddRepo = async () => {
    try {
      const repo = await window.api.repos.addDialog()
      if (repo) {
        setRepos((prev) => [...prev, repo])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository')
    }
  }

  const handleRemoveRepo = async (id: number) => {
    try {
      await window.api.repos.remove(id)
      setRepos((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove repository')
    }
  }

  const handleRelocate = async (id: number) => {
    try {
      const repo = await window.api.repos.relocate(id)
      if (repo) {
        setRepos((prev) => prev.map((r) => (r.id === id ? repo : r)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to relocate repository')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Repositories</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Manage Git repositories for summary generation
          </p>
        </div>
        <Button onClick={handleAddRepo}>
          <Plus className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-subtle p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <span className="text-[13px] text-destructive">{error}</span>
        </div>
      )}

      {/* Repository List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-[13px]">Loading repositories...</span>
            </div>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle">
              <FolderGit2 className="h-7 w-7 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium">No repositories added</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Add your first Git repository to start generating summaries
              </p>
            </div>
            <Button onClick={handleAddRepo} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
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
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      repo.is_available ? 'bg-accent-subtle' : 'bg-destructive-subtle'
                    }`}
                  >
                    <FolderGit2
                      className={`h-5 w-5 ${
                        repo.is_available ? 'text-accent' : 'text-destructive'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium">{repo.name}</p>
                      {repo.is_available && (
                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                      )}
                    </div>
                    <p className="truncate text-[12px] text-muted-foreground">{repo.path}</p>
                    {!repo.is_available && (
                      <p className="text-[11px] text-destructive">Repository not found</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!repo.is_available && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRelocate(repo.id)}
                    >
                      <FolderSearch className="mr-1.5 h-3.5 w-3.5" />
                      Relocate
                    </Button>
                  )}
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
    </div>
  )
}
