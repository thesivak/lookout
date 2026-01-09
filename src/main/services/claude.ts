import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { getPromptsPath, getAppDataPath } from './database'
import { format } from 'date-fns'

export interface ClaudeStreamEvent {
  type: 'text' | 'result' | 'error' | 'system'
  content?: string
  result?: string
  error?: string
}

export interface GenerationOptions {
  systemPrompt: string
  userPrompt: string
  templateName: string
  dateFrom: Date
  dateTo: Date
  type: 'personal' | 'team'
}

export interface GenerationResult {
  success: boolean
  content?: string
  error?: string
  promptFolder: string
}

/**
 * Check if Claude Code is installed
 */
export async function checkClaudeInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill()
      resolve(false)
    }, 5000)
  })
}

/**
 * Create a prompt folder with all artifacts
 */
export function createPromptFolder(
  type: 'personal' | 'team',
  dateFrom: Date,
  dateTo: Date
): string {
  const promptsPath = getPromptsPath()
  const dateFromStr = format(dateFrom, 'yyyy-MM-dd')
  const dateToStr = format(dateTo, 'yyyy-MM-dd')
  const timestamp = format(new Date(), 'HHmmss')
  const folderName = `${type}-${dateFromStr}-to-${dateToStr}-${timestamp}`
  const folderPath = join(promptsPath, folderName)

  mkdirSync(folderPath, { recursive: true })

  return folderPath
}

/**
 * Save prompt artifacts to folder
 */
export function savePromptArtifacts(
  folderPath: string,
  systemPrompt: string,
  userPrompt: string,
  metadata: Record<string, unknown>
): void {
  writeFileSync(join(folderPath, 'system-prompt.md'), systemPrompt)
  writeFileSync(join(folderPath, 'user-prompt.md'), userPrompt)
  writeFileSync(join(folderPath, 'metadata.json'), JSON.stringify(metadata, null, 2))
}

/**
 * Save response to folder
 */
export function saveResponse(folderPath: string, response: string): void {
  writeFileSync(join(folderPath, 'response.md'), response)
}

/**
 * Save streaming log to folder
 */
export function appendStreamingLog(folderPath: string, event: ClaudeStreamEvent): void {
  const logPath = join(folderPath, 'streaming-log.jsonl')
  const line = JSON.stringify(event) + '\n'

  if (existsSync(logPath)) {
    const existing = readFileSync(logPath, 'utf-8')
    writeFileSync(logPath, existing + line)
  } else {
    writeFileSync(logPath, line)
  }
}

/**
 * Generate summary using Claude Code with streaming
 */
export async function* generateSummary(
  options: GenerationOptions
): AsyncGenerator<ClaudeStreamEvent> {
  const { systemPrompt, userPrompt, templateName, dateFrom, dateTo, type } = options

  // Create prompt folder
  const promptFolder = createPromptFolder(type, dateFrom, dateTo)

  // Save artifacts
  savePromptArtifacts(promptFolder, systemPrompt, userPrompt, {
    templateName,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    type,
    startedAt: new Date().toISOString()
  })

  // Write system prompt to file for Claude Code
  const systemPromptPath = join(promptFolder, 'system-prompt.md')

  // Build Claude Code arguments
  const args = [
    '-p', '-', // Read prompt from stdin
    '--output-format', 'stream-json',
    '--max-turns', '1',
    '--verbose',
    '--system-prompt', systemPromptPath
  ]

  let proc: ChildProcess

  try {
    proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    yield { type: 'error', error: 'Failed to spawn Claude Code process' }
    return
  }

  // Write user prompt to stdin
  if (proc.stdin) {
    proc.stdin.write(userPrompt)
    proc.stdin.end()
  }

  // Track full response
  let fullResponse = ''

  // Parse streaming JSON output
  if (proc.stdout) {
    const rl = createInterface({ input: proc.stdout })

    for await (const line of rl) {
      try {
        const event = JSON.parse(line)

        // Handle different event types from Claude Code stream-json format
        if (event.type === 'assistant' && event.message?.content) {
          // Extract text from content array
          for (const block of event.message.content) {
            if (block.type === 'text') {
              fullResponse += block.text
              const streamEvent: ClaudeStreamEvent = { type: 'text', content: block.text }
              appendStreamingLog(promptFolder, streamEvent)
              yield streamEvent
            }
          }
        } else if (event.type === 'content_block_delta' && event.delta?.text) {
          fullResponse += event.delta.text
          const streamEvent: ClaudeStreamEvent = { type: 'text', content: event.delta.text }
          appendStreamingLog(promptFolder, streamEvent)
          yield streamEvent
        } else if (event.type === 'result') {
          const streamEvent: ClaudeStreamEvent = { type: 'result', result: fullResponse }
          appendStreamingLog(promptFolder, streamEvent)
          yield streamEvent
        } else if (event.type === 'system' || event.type === 'init') {
          const streamEvent: ClaudeStreamEvent = { type: 'system', content: JSON.stringify(event) }
          appendStreamingLog(promptFolder, streamEvent)
        }
      } catch {
        // Non-JSON line, skip
      }
    }
  }

  // Capture stderr for errors
  let stderr = ''
  if (proc.stderr) {
    const errRl = createInterface({ input: proc.stderr })
    for await (const line of errRl) {
      stderr += line + '\n'
    }
  }

  // Wait for process to exit
  const exitCode = await new Promise<number>((resolve) => {
    proc.on('exit', (code) => resolve(code ?? 1))
    proc.on('error', () => resolve(1))
  })

  // Save response
  if (fullResponse) {
    saveResponse(promptFolder, fullResponse)
  }

  // Check for errors
  if (exitCode !== 0) {
    const errorEvent: ClaudeStreamEvent = {
      type: 'error',
      error: stderr || `Claude exited with code ${exitCode}`
    }
    appendStreamingLog(promptFolder, errorEvent)
    yield errorEvent
  } else if (fullResponse) {
    // Final result event
    yield { type: 'result', result: fullResponse }
  }
}

/**
 * Generate summary with retry logic
 */
export async function generateSummaryWithRetry(
  options: GenerationOptions,
  maxRetries = 3,
  onProgress?: (event: ClaudeStreamEvent) => void
): Promise<GenerationResult> {
  let lastError: string | undefined
  const promptFolder = createPromptFolder(options.type, options.dateFrom, options.dateTo)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let fullContent = ''

    try {
      for await (const event of generateSummary(options)) {
        if (onProgress) {
          onProgress(event)
        }

        if (event.type === 'text' && event.content) {
          fullContent += event.content
        } else if (event.type === 'result' && event.result) {
          return {
            success: true,
            content: event.result,
            promptFolder
          }
        } else if (event.type === 'error') {
          lastError = event.error
          break
        }
      }

      // If we got content but no explicit result, use the accumulated content
      if (fullContent) {
        return {
          success: true,
          content: fullContent,
          promptFolder
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Wait before retry with exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError || 'Generation failed after all retries',
    promptFolder
  }
}

/**
 * Get default prompt templates
 */
export function getDefaultTemplates(): Record<string, { name: string; description: string; systemPrompt: string }> {
  return {
    technical: {
      name: 'Technical',
      description: 'Detailed technical summary with code changes and architecture impacts',
      systemPrompt: `You are a technical writer creating a Git work summary for developers.

Your task is to analyze the provided commit data and generate a clear, structured summary.

Guidelines:
- Focus on technical details and code changes
- Group related commits by feature or area of code
- Highlight architectural changes or significant refactors
- Mention specific files or modules affected
- Note any breaking changes or API modifications
- Be concise but comprehensive

Output format:
Use markdown with the following structure:
## Work Summary - [Date Range]

### Highlights
- Key accomplishments (3-5 bullet points)

### By Repository
For each repository with commits:
#### [Repository Name]
- Summary of changes
- Key commits with context
- Stats: X commits, +Y/-Z lines

### Technical Notes
Any important technical details or considerations`
    },
    'manager-friendly': {
      name: 'Manager-Friendly',
      description: 'High-level summary suitable for status updates and non-technical stakeholders',
      systemPrompt: `You are creating a work summary for a manager or non-technical stakeholder.

Your task is to analyze the provided commit data and generate a clear, high-level summary.

Guidelines:
- Focus on business impact and user-facing changes
- Avoid technical jargon
- Highlight completed features and fixed bugs
- Group work by project or initiative
- Mention collaboration with team members
- Be brief and scannable

Output format:
Use markdown with the following structure:
## Work Summary - [Date Range]

### Completed This Period
- Feature/task descriptions in plain language

### In Progress
- Ongoing work if apparent from commits

### Key Metrics
- Repositories: X
- Commits: Y
- Areas of focus`
    },
    'casual-standup': {
      name: 'Casual Standup',
      description: 'Brief, conversational format for daily standups',
      systemPrompt: `You are helping someone prepare for their daily standup meeting.

Your task is to create a brief, conversational summary of their recent work.

Guidelines:
- Keep it short and to the point
- Use casual, conversational language
- Focus on what was accomplished and what's next
- Mention any blockers if apparent
- Make it easy to read aloud in 30 seconds

Output format:
Use markdown:
## Yesterday's Work

**What I did:**
- Brief bullet points

**What I'm working on next:**
- Based on commit patterns

**Any blockers:**
- Only if apparent from the work`
    }
  }
}

/**
 * Build user prompt from commit data
 */
export function buildUserPrompt(
  commits: Array<{
    repoName: string
    commits: Array<{
      hash: string
      authorName: string
      authorEmail: string
      date: string
      message: string
      isMerge: boolean
      additions: number
      deletions: number
      filesChanged: number
    }>
  }>,
  dateFrom: Date,
  dateTo: Date,
  authorName?: string
): string {
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} to ${format(dateTo, 'MMM d, yyyy')}`

  let prompt = `# Git Commit Data for Analysis

Date Range: ${dateRange}
${authorName ? `Author: ${authorName}` : ''}

## Repositories and Commits

`

  for (const repo of commits) {
    prompt += `### ${repo.repoName}\n\n`

    let totalAdditions = 0
    let totalDeletions = 0
    let mergeCount = 0

    for (const commit of repo.commits) {
      if (commit.isMerge) {
        mergeCount++
        prompt += `- [MERGE] ${commit.message}\n`
      } else {
        prompt += `- ${commit.message} (${commit.hash.slice(0, 7)})\n`
        prompt += `  Files: ${commit.filesChanged}, +${commit.additions}/-${commit.deletions}\n`
      }
      totalAdditions += commit.additions
      totalDeletions += commit.deletions
    }

    prompt += `\n**Summary:** ${repo.commits.length} commits, ${mergeCount} merges, +${totalAdditions}/-${totalDeletions} lines\n\n`
  }

  prompt += `
## Instructions

Please generate a comprehensive summary of this work. Focus on:
1. The main themes and areas of work
2. Key accomplishments
3. Notable technical changes
4. Overall productivity and impact`

  return prompt
}
