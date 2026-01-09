import { useState, useEffect, useCallback } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Users, RefreshCw, Sparkles, Loader2, User } from 'lucide-react'

type DateRange = 'yesterday' | 'week' | 'month'

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date()
  switch (range) {
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    case 'week':
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) }
    case 'month':
      return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) }
  }
}

export default function Team(): JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [authors, setAuthors] = useState<AuthorData[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; errors: string[] } | null>(
    null
  )

  const loadAuthors = useCallback(async () => {
    try {
      setLoading(true)
      const range = getDateRange(dateRange)
      const authorData = await window.api.git.getAllAuthors(
        range.from.toISOString(),
        range.to.toISOString()
      )
      setAuthors(authorData)
    } catch (error) {
      console.error('Failed to load authors:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  const handleFetchAll = async () => {
    try {
      setFetching(true)
      setFetchResult(null)
      const result = await window.api.git.fetchAll()
      setFetchResult(result)
      // Reload authors after fetch
      await loadAuthors()
    } catch (error) {
      setFetchResult({ success: false, errors: [String(error)] })
    } finally {
      setFetching(false)
    }
  }

  const totalCommits = authors.reduce((sum, a) => sum + a.commitCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            View work summaries for all contributors
          </p>
        </div>
        <Button variant="outline" onClick={handleFetchAll} disabled={fetching}>
          {fetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Latest
            </>
          )}
        </Button>
      </div>

      {/* Fetch Result */}
      {fetchResult && (
        <div
          className={`rounded-lg p-3 text-sm ${
            fetchResult.success
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {fetchResult.success
            ? 'Successfully fetched latest changes from all repositories'
            : `Fetch completed with errors: ${fetchResult.errors.join(', ')}`}
        </div>
      )}

      {/* Date Range */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Time Range:</span>
        <div className="flex gap-2">
          <Button
            variant={dateRange === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('yesterday')}
          >
            Yesterday
          </Button>
          <Button
            variant={dateRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('week')}
          >
            Last 7 Days
          </Button>
          <Button
            variant={dateRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('month')}
          >
            Last 30 Days
          </Button>
        </div>
      </div>

      {/* Team Members */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Contributors</h2>
            <p className="text-sm text-muted-foreground">
              {authors.length} contributors, {totalCommits} total commits
            </p>
          </div>
          <Button disabled>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Team Summary
          </Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : authors.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-4">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No contributors found</p>
              <p className="text-sm text-muted-foreground">
                Import repositories to see team contributors
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {authors.map((author, index) => (
              <div
                key={author.email}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{author.name}</p>
                    <p className="text-sm text-muted-foreground">{author.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{author.commitCount}</p>
                  <p className="text-xs text-muted-foreground">commits</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
