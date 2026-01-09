import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { History as HistoryIcon, Trash2, Copy, Download, Check, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function History(): JSX.Element {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null)
  const [copied, setCopied] = useState(false)

  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.summaries.list(undefined, 50)
      setSummaries(data)
    } catch (error) {
      console.error('Failed to load summaries:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this summary?')) return
    try {
      await window.api.summaries.delete(id)
      setSummaries((prev) => prev.filter((s) => s.id !== id))
      if (selectedSummary?.id === id) {
        setSelectedSummary(null)
      }
    } catch (error) {
      console.error('Failed to delete summary:', error)
    }
  }

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = (summary: Summary) => {
    const filename = `summary-${format(new Date(summary.date_from), 'yyyy-MM-dd')}-to-${format(new Date(summary.date_to), 'yyyy-MM-dd')}.md`
    const blob = new Blob([summary.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">
          Browse and access previously generated summaries
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Summary List */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">All Summaries</h2>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <HistoryIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No summaries yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {summaries.map((summary) => (
                <button
                  key={summary.id}
                  onClick={() => setSelectedSummary(summary)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedSummary?.id === summary.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <p className="font-medium">
                    {format(new Date(summary.date_from), 'MMM d')} -{' '}
                    {format(new Date(summary.date_to), 'MMM d, yyyy')}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{summary.type}</span>
                    <span>•</span>
                    <span>{summary.commit_count} commits</span>
                    <span>•</span>
                    <span>{summary.prompt_template}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Summary Detail */}
        <Card className="p-6">
          {selectedSummary ? (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">
                    {format(new Date(selectedSummary.date_from), 'MMM d')} -{' '}
                    {format(new Date(selectedSummary.date_to), 'MMM d, yyyy')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Generated {format(new Date(selectedSummary.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(selectedSummary.content)}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(selectedSummary)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedSummary.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{selectedSummary.commit_count} commits</span>
                {selectedSummary.merge_count > 0 && (
                  <span>{selectedSummary.merge_count} merges</span>
                )}
                <span className="capitalize">{selectedSummary.prompt_template} template</span>
              </div>

              {/* Content */}
              <div className="prose prose-invert max-w-none border-t border-border pt-4">
                <ReactMarkdown>{selectedSummary.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <Eye className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a summary to view details
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
