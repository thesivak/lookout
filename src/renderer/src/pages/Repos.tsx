import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FolderGit2, Plus, Trash2, AlertCircle, FolderSearch } from 'lucide-react'

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Repositories</h1>
          <p className="text-sm text-muted-foreground">
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
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Repository List */}
      <Card className="divide-y divide-border">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading repositories...</p>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4 p-6">
            <FolderGit2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No repositories added</p>
              <p className="text-sm text-muted-foreground">
                Add your first Git repository to start generating summaries
              </p>
            </div>
            <Button onClick={handleAddRepo}>
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
            </Button>
          </div>
        ) : (
          repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    repo.is_available ? 'bg-accent/20' : 'bg-destructive/20'
                  }`}
                >
                  <FolderGit2
                    className={`h-5 w-5 ${
                      repo.is_available ? 'text-accent' : 'text-destructive'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium">{repo.name}</p>
                  <p className="text-sm text-muted-foreground">{repo.path}</p>
                  {!repo.is_available && (
                    <p className="text-xs text-destructive">Repository not found</p>
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
                    <FolderSearch className="mr-2 h-4 w-4" />
                    Relocate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRepo(repo.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
