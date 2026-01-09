import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { History as HistoryIcon, Trash2, Copy, Download, Check, Eye, GitCommit } from 'lucide-react'
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
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">History</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Browse and access previously generated summaries
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Summary List */}
        <Card className="h-fit p-4">
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            All Summaries
          </h2>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-[13px]">Loading...</span>
              </div>
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <HistoryIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No summaries yet</p>
            </div>
          ) : (
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto">
              {summaries.map((summary) => (
                <button
                  key={summary.id}
                  onClick={() => setSelectedSummary(summary)}
                  className={`w-full rounded-lg p-3 text-left transition-all ${
                    selectedSummary?.id === summary.id
                      ? 'bg-accent text-white'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <p className="text-[13px] font-medium">
                    {format(new Date(summary.date_from), 'MMM d')} -{' '}
                    {format(new Date(summary.date_to), 'MMM d')}
                  </p>
                  <div className={`mt-1 flex items-center gap-2 text-[11px] ${
                    selectedSummary?.id === summary.id
                      ? 'text-white/70'
                      : 'text-muted-foreground'
                  }`}>
                    <span className="capitalize">{summary.type}</span>
                    <span>·</span>
                    <span>{summary.commit_count} commits</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Summary Detail */}
        <Card className="p-5">
          {selectedSummary ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border/50 pb-4">
                <div>
                  <h2 className="text-[17px] font-semibold">
                    {format(new Date(selectedSummary.date_from), 'MMM d')} -{' '}
                    {format(new Date(selectedSummary.date_to), 'MMM d, yyyy')}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
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
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(selectedSummary)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(selectedSummary.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-[12px]">
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                  <GitCommit className="h-3.5 w-3.5" />
                  {selectedSummary.commit_count} commits
                </span>
                {selectedSummary.merge_count > 0 && (
                  <span className="rounded-md bg-muted px-2 py-1">{selectedSummary.merge_count} merges</span>
                )}
                <span className="rounded-md bg-muted px-2 py-1 capitalize">{selectedSummary.prompt_template}</span>
              </div>

              {/* Content */}
              <div className="prose max-w-none">
                <ReactMarkdown>{selectedSummary.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Eye className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Select a summary to view details
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
