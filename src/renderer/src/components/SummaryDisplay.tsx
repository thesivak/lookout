import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Card from './ui/Card'
import {
  CheckCircle2,
  GitCommit,
  FileCode,
  TrendingUp,
  Zap,
  Target,
  BarChart3
} from 'lucide-react'

interface SummaryDisplayProps {
  content: string
  isStreaming?: boolean
}

interface ParsedSection {
  type: 'overview' | 'themes' | 'accomplishments' | 'technical' | 'assessment' | 'other'
  title: string
  content: string
}

// Parse summary into structured sections
function parseSummary(content: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const lines = content.split('\n')

  let currentSection: ParsedSection | null = null
  let buffer: string[] = []

  const flushSection = () => {
    if (currentSection && buffer.length > 0) {
      currentSection.content = buffer.join('\n').trim()
      if (currentSection.content) {
        sections.push(currentSection)
      }
    }
    buffer = []
  }

  for (const line of lines) {
    const lowerLine = line.toLowerCase()

    // Detect section headers
    if (line.match(/^#+\s/) || line.match(/^[A-Z][^a-z]*:/)) {
      flushSection()

      let type: ParsedSection['type'] = 'other'
      if (lowerLine.includes('overview') || lowerLine.includes('summary:')) {
        type = 'overview'
      } else if (lowerLine.includes('theme') || lowerLine.includes('areas of work')) {
        type = 'themes'
      } else if (lowerLine.includes('accomplishment') || lowerLine.includes('key achievement')) {
        type = 'accomplishments'
      } else if (lowerLine.includes('technical') || lowerLine.includes('notable')) {
        type = 'technical'
      } else if (lowerLine.includes('assessment') || lowerLine.includes('productivity') || lowerLine.includes('impact')) {
        type = 'assessment'
      }

      currentSection = {
        type,
        title: line.replace(/^#+\s*/, '').replace(/:$/, ''),
        content: ''
      }
    } else {
      buffer.push(line)
    }
  }

  flushSection()

  // If no sections detected, return whole content as overview
  if (sections.length === 0 && content.trim()) {
    sections.push({
      type: 'overview',
      title: 'Summary',
      content: content.trim()
    })
  }

  return sections
}

// Extract stats from overview text
function extractStats(content: string): { commits?: string; lines?: string; repo?: string } {
  const stats: { commits?: string; lines?: string; repo?: string } = {}

  const commitMatch = content.match(/(\d+)\s*commits?/i)
  if (commitMatch) stats.commits = commitMatch[1]

  const linesMatch = content.match(/([+-]?\d+[/-][+-]?\d+)\s*lines?/i)
  if (linesMatch) stats.lines = linesMatch[1]

  const repoMatch = content.match(/(?:on|in)\s+(?:the\s+)?(\*\*[^*]+\*\*|`[^`]+`|[\w-]+)\s+repo/i)
  if (repoMatch) stats.repo = repoMatch[1].replace(/[*`]/g, '')

  return stats
}

// Section icon and color mapping
const sectionConfig: Record<ParsedSection['type'], { icon: typeof CheckCircle2; color: string; bg: string }> = {
  overview: { icon: Zap, color: 'text-accent', bg: 'bg-accent/10' },
  themes: { icon: Target, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  accomplishments: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  technical: { icon: FileCode, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  assessment: { icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  other: { icon: GitCommit, color: 'text-muted-foreground', bg: 'bg-muted/10' }
}

// Custom markdown components for better styling
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-semibold mb-3">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-semibold mb-2 mt-4">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-medium mb-2 mt-3">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="space-y-2 mb-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="space-y-2 mb-4 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children)
    // Check if it's an accomplishment item (starts with emoji or checkbox)
    const isAccomplishment = text.match(/^[✅☑️✓⬜]/u)

    if (isAccomplishment) {
      return (
        <li className="flex items-start gap-2 py-1">
          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          <span>{text.replace(/^[✅☑️✓⬜]\s*/u, '')}</span>
        </li>
      )
    }

    return (
      <li className="flex items-start gap-2 py-1">
        <span className="text-muted-foreground">•</span>
        <span>{children}</span>
      </li>
    )
  },
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-muted-foreground italic">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">{children}</code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/50 border-b border-border">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-3">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-accent pl-4 my-4 text-muted-foreground italic">
      {children}
    </blockquote>
  )
}

function SectionCard({ section }: { section: ParsedSection }) {
  const config = sectionConfig[section.type]
  const Icon = config.icon

  return (
    <Card className="p-5 transition-all hover:shadow-lg">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <h3 className="text-lg font-semibold pt-1">{section.title}</h3>
      </div>
      <div className="prose prose-invert max-w-none text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {section.content}
        </ReactMarkdown>
      </div>
    </Card>
  )
}

function StatsBar({ stats }: { stats: { commits?: string; lines?: string; repo?: string } }) {
  if (!stats.commits && !stats.lines && !stats.repo) return null

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {stats.repo && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent">
          <FileCode className="h-4 w-4" />
          <span className="font-medium">{stats.repo}</span>
        </div>
      )}
      {stats.commits && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success">
          <GitCommit className="h-4 w-4" />
          <span className="font-medium">{stats.commits} commits</span>
        </div>
      )}
      {stats.lines && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="font-medium">{stats.lines} lines</span>
        </div>
      )}
    </div>
  )
}

export default function SummaryDisplay({ content, isStreaming }: SummaryDisplayProps) {
  const { sections, stats, title, date } = useMemo(() => {
    const parsed = parseSummary(content)

    // Try to extract title and date from first line
    const firstLine = content.split('\n')[0] || ''
    let title = ''
    let date = ''

    const titleMatch = firstLine.match(/^(?:#+\s*)?(.+?Summary)(?::\s*(.+))?$/i)
    if (titleMatch) {
      title = titleMatch[1]
      date = titleMatch[2] || ''
    }

    // Extract stats from overview section
    const overview = parsed.find(s => s.type === 'overview')
    const stats = overview ? extractStats(overview.content) : {}

    return { sections: parsed, stats, title, date }
  }, [content])

  if (!content.trim()) {
    return null
  }

  // For very short streaming content, show simple view
  if (isStreaming && content.length < 100) {
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
        <span className="inline-block w-2 h-5 bg-accent animate-pulse ml-1" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {(title || date) && (
        <div className="border-b border-border pb-4">
          {title && <h1 className="text-2xl font-bold">{title}</h1>}
          {date && <p className="text-muted-foreground mt-1">{date}</p>}
        </div>
      )}

      {/* Stats badges */}
      <StatsBar stats={stats} />

      {/* Sections as cards */}
      <div className="grid gap-4">
        {sections.map((section, i) => (
          <SectionCard key={i} section={section} />
        ))}
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse" />
          Generating...
        </div>
      )}
    </div>
  )
}
