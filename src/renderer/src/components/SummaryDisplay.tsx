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

  if (sections.length === 0 && content.trim()) {
    sections.push({
      type: 'overview',
      title: 'Summary',
      content: content.trim()
    })
  }

  return sections
}

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

const sectionConfig: Record<ParsedSection['type'], { icon: typeof CheckCircle2; color: string; bg: string }> = {
  overview: { icon: Zap, color: 'text-accent', bg: 'bg-accent-subtle' },
  themes: { icon: Target, color: 'text-blue-500', bg: 'bg-blue-50' },
  accomplishments: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success-subtle' },
  technical: { icon: FileCode, color: 'text-purple-500', bg: 'bg-purple-50' },
  assessment: { icon: BarChart3, color: 'text-amber-500', bg: 'bg-amber-50' },
  other: { icon: GitCommit, color: 'text-muted-foreground', bg: 'bg-muted' }
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-3 text-[17px] font-semibold tracking-tight">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 mt-4 text-[15px] font-semibold tracking-tight">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-3 text-[14px] font-medium">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 text-[13px] leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 list-inside list-decimal space-y-1.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children)
    const isAccomplishment = text.match(/^[✅☑️✓⬜]/u)

    if (isAccomplishment) {
      return (
        <li className="flex items-start gap-2 py-0.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <span className="text-[13px]">{text.replace(/^[✅☑️✓⬜]\s*/u, '')}</span>
        </li>
      )
    }

    return (
      <li className="flex items-start gap-2 py-0.5">
        <span className="text-muted-foreground">•</span>
        <span className="text-[13px]">{children}</span>
      </li>
    )
  },
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">{children}</code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-border bg-muted/50">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border/50">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="transition-colors hover:bg-card-hover">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-accent/50 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  )
}

function SectionCard({ section }: { section: ParsedSection }) {
  const config = sectionConfig[section.type]
  const Icon = config.icon

  return (
    <Card variant="inset" className="p-4 transition-all hover:shadow-subtle">
      <div className="mb-3 flex items-start gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <h3 className="pt-0.5 text-[14px] font-semibold">{section.title}</h3>
      </div>
      <div className="prose max-w-none">
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
    <div className="mb-5 flex flex-wrap gap-2">
      {stats.repo && (
        <div className="flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-[12px] text-accent">
          <FileCode className="h-3.5 w-3.5" />
          <span className="font-medium">{stats.repo}</span>
        </div>
      )}
      {stats.commits && (
        <div className="flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1 text-[12px] text-success">
          <GitCommit className="h-3.5 w-3.5" />
          <span className="font-medium">{stats.commits} commits</span>
        </div>
      )}
      {stats.lines && (
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="font-medium">{stats.lines} lines</span>
        </div>
      )}
    </div>
  )
}

export default function SummaryDisplay({ content, isStreaming }: SummaryDisplayProps) {
  const { sections, stats, title, date } = useMemo(() => {
    const parsed = parseSummary(content)

    const firstLine = content.split('\n')[0] || ''
    let title = ''
    let date = ''

    const titleMatch = firstLine.match(/^(?:#+\s*)?(.+?Summary)(?::\s*(.+))?$/i)
    if (titleMatch) {
      title = titleMatch[1]
      date = titleMatch[2] || ''
    }

    const overview = parsed.find(s => s.type === 'overview')
    const stats = overview ? extractStats(overview.content) : {}

    return { sections: parsed, stats, title, date }
  }, [content])

  if (!content.trim()) {
    return null
  }

  if (isStreaming && content.length < 100) {
    return (
      <div className="prose max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
        <span className="ml-1 inline-block h-4 w-1.5 animate-pulse-subtle rounded-sm bg-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {(title || date) && (
        <div className="border-b border-border/50 pb-4">
          {title && <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>}
          {date && <p className="mt-0.5 text-[12px] text-muted-foreground">{date}</p>}
        </div>
      )}

      <StatsBar stats={stats} />

      <div className="grid gap-3">
        {sections.map((section, i) => (
          <SectionCard key={i} section={section} />
        ))}
      </div>

      {isStreaming && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="h-2 w-2 animate-pulse-subtle rounded-full bg-accent" />
          Generating...
        </div>
      )}
    </div>
  )
}
