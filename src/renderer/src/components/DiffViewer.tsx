import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Minus, File, FileX, FilePlus, FileEdit } from 'lucide-react'
import hljs from 'highlight.js'

interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

interface FileDiff {
  path: string
  status: 'added' | 'deleted' | 'modified' | 'renamed'
  oldPath?: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

interface DiffViewerProps {
  files: FileDiff[]
  className?: string
  defaultExpanded?: boolean
}

export default function DiffViewer({
  files,
  className = '',
  defaultExpanded = true
}: DiffViewerProps): JSX.Element {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    defaultExpanded ? new Set(files.map((f) => f.path)) : new Set()
  )

  const toggleFile = (path: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFiles(newExpanded)
  }

  const getStatusIcon = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return <FilePlus className="h-4 w-4 text-success" />
      case 'deleted':
        return <FileX className="h-4 w-4 text-destructive" />
      case 'renamed':
        return <FileEdit className="h-4 w-4 text-accent" />
      default:
        return <File className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return 'bg-success/10 border-success/30'
      case 'deleted':
        return 'bg-destructive/10 border-destructive/30'
      default:
        return 'bg-card border-border'
    }
  }

  // Total stats
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Summary */}
      <div className="flex items-center gap-4 px-1 text-[12px] text-muted-foreground">
        <span>{files.length} file{files.length !== 1 ? 's' : ''} changed</span>
        <span className="flex items-center gap-1 text-success">
          <Plus className="h-3 w-3" />
          {totalAdditions}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <Minus className="h-3 w-3" />
          {totalDeletions}
        </span>
      </div>

      {/* File list */}
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.path}
            className={`rounded-lg border overflow-hidden ${getStatusColor(file.status)}`}
          >
            {/* File header */}
            <button
              onClick={() => toggleFile(file.path)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              {expandedFiles.has(file.path) ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {getStatusIcon(file.status)}
              <span className="flex-1 font-mono text-[12px] truncate">
                {file.oldPath && file.oldPath !== file.path ? (
                  <>
                    <span className="text-muted-foreground">{file.oldPath}</span>
                    <span className="mx-1 text-accent">→</span>
                    {file.path}
                  </>
                ) : (
                  file.path
                )}
              </span>
              <span className="flex items-center gap-2 text-[11px]">
                {file.additions > 0 && (
                  <span className="text-success">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-destructive">-{file.deletions}</span>
                )}
              </span>
            </button>

            {/* Diff content */}
            {expandedFiles.has(file.path) && (
              <div className="border-t border-border bg-background-secondary overflow-x-auto">
                {file.hunks.map((hunk, i) => (
                  <DiffHunk key={i} hunk={hunk} filePath={file.path} />
                ))}
                {file.hunks.length === 0 && (
                  <div className="px-4 py-3 text-[12px] text-muted-foreground italic">
                    Binary file or no content changes
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface DiffHunkProps {
  hunk: DiffHunk
  filePath: string
}

function DiffHunk({ hunk, filePath }: DiffHunkProps): JSX.Element {
  const lines = useMemo(() => {
    const result: Array<{
      type: 'add' | 'delete' | 'context' | 'header'
      content: string
      oldLineNo?: number
      newLineNo?: number
    }> = []

    const rawLines = hunk.content.split('\n')
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart

    for (const line of rawLines) {
      if (line.startsWith('@@')) {
        result.push({ type: 'header', content: line })
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        result.push({ type: 'add', content: line.slice(1), newLineNo: newLine++ })
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        result.push({ type: 'delete', content: line.slice(1), oldLineNo: oldLine++ })
      } else if (line.startsWith(' ') || line === '') {
        result.push({
          type: 'context',
          content: line.slice(1) || '',
          oldLineNo: oldLine++,
          newLineNo: newLine++
        })
      }
    }

    return result
  }, [hunk])

  // Get file extension for syntax highlighting
  const extension = filePath.split('.').pop() || ''
  const language = getLanguageFromExtension(extension)

  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <tbody>
        {lines.map((line, i) => {
          if (line.type === 'header') {
            return (
              <tr key={i} className="bg-accent-subtle/30">
                <td colSpan={3} className="px-3 py-1 text-accent">
                  {line.content}
                </td>
              </tr>
            )
          }

          const bgClass =
            line.type === 'add'
              ? 'bg-success/10'
              : line.type === 'delete'
                ? 'bg-destructive/10'
                : ''

          const textClass =
            line.type === 'add'
              ? 'text-success'
              : line.type === 'delete'
                ? 'text-destructive'
                : ''

          // Highlight code
          let highlightedContent = line.content
          if (language && line.content) {
            try {
              highlightedContent = hljs.highlight(line.content, { language }).value
            } catch {
              // Fallback to plain text
            }
          }

          return (
            <tr key={i} className={bgClass}>
              <td className="w-10 select-none border-r border-border px-2 py-0 text-right text-muted-foreground/50">
                {line.oldLineNo || ''}
              </td>
              <td className="w-10 select-none border-r border-border px-2 py-0 text-right text-muted-foreground/50">
                {line.newLineNo || ''}
              </td>
              <td className={`px-2 py-0 whitespace-pre ${textClass}`}>
                <span className="select-none mr-1">
                  {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                </span>
                <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function getLanguageFromExtension(ext: string): string | null {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    makefile: 'makefile'
  }

  return map[ext.toLowerCase()] || null
}

/**
 * Compact file diff summary component (for inline use)
 */
export function DiffSummary({
  files,
  onClick
}: {
  files: FileDiff[]
  onClick?: () => void
}): JSX.Element {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px] hover:bg-muted transition-colors"
    >
      <span className="text-muted-foreground">{files.length} files</span>
      <span className="flex items-center gap-0.5 text-success">
        <Plus className="h-3 w-3" />
        {totalAdditions}
      </span>
      <span className="flex items-center gap-0.5 text-destructive">
        <Minus className="h-3 w-3" />
        {totalDeletions}
      </span>
    </button>
  )
}
