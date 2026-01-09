/**
 * Commit categorization service
 * Analyzes commit messages and file paths to determine work type
 */

export type CommitCategory =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'test'
  | 'docs'
  | 'chore'
  | 'merge'
  | 'other'

export interface CategoryResult {
  category: CommitCategory
  confidence: number
  reason: string
}

export interface CategoryBreakdown {
  feature: number
  bugfix: number
  refactor: number
  test: number
  docs: number
  chore: number
  merge: number
  other: number
  total: number
}

// Conventional commit prefixes with high confidence
const CONVENTIONAL_PREFIXES: Record<string, CommitCategory> = {
  feat: 'feature',
  feature: 'feature',
  add: 'feature',
  fix: 'bugfix',
  bugfix: 'bugfix',
  hotfix: 'bugfix',
  bug: 'bugfix',
  refactor: 'refactor',
  refact: 'refactor',
  cleanup: 'refactor',
  clean: 'refactor',
  test: 'test',
  tests: 'test',
  spec: 'test',
  docs: 'docs',
  doc: 'docs',
  readme: 'docs',
  chore: 'chore',
  build: 'chore',
  ci: 'chore',
  deps: 'chore',
  dependency: 'chore',
  dependencies: 'chore',
  style: 'chore',
  lint: 'chore',
  format: 'chore',
  perf: 'refactor',
  performance: 'refactor',
  optimize: 'refactor',
  wip: 'other',
  merge: 'merge',
  revert: 'other'
}

// Keywords that suggest specific categories
const KEYWORD_PATTERNS: Array<{ pattern: RegExp; category: CommitCategory; confidence: number }> =
  [
    // Feature keywords
    { pattern: /\b(implement|add|create|introduce|new)\b/i, category: 'feature', confidence: 0.7 },
    { pattern: /\b(feature|enhancement)\b/i, category: 'feature', confidence: 0.8 },

    // Bugfix keywords
    { pattern: /\b(fix|resolve|repair|correct|patch)\b/i, category: 'bugfix', confidence: 0.75 },
    { pattern: /\b(bug|issue|error|crash|broken)\b/i, category: 'bugfix', confidence: 0.7 },

    // Refactor keywords
    { pattern: /\b(refactor|restructure|reorganize|simplify)\b/i, category: 'refactor', confidence: 0.8 },
    { pattern: /\b(improve|enhance|optimize)\b/i, category: 'refactor', confidence: 0.6 },
    { pattern: /\b(move|rename|extract)\b/i, category: 'refactor', confidence: 0.6 },

    // Test keywords
    { pattern: /\b(test|spec|coverage)\b/i, category: 'test', confidence: 0.7 },

    // Docs keywords
    { pattern: /\b(document|documentation|readme|comment)\b/i, category: 'docs', confidence: 0.8 },
    { pattern: /\b(typo|spelling)\b/i, category: 'docs', confidence: 0.5 },

    // Chore keywords
    { pattern: /\b(update|upgrade|bump)\s+(\w+\s+)?(version|dependency|package)/i, category: 'chore', confidence: 0.8 },
    { pattern: /\b(config|configuration|setup)\b/i, category: 'chore', confidence: 0.6 }
  ]

// File path patterns
const FILE_PATH_PATTERNS: Array<{ pattern: RegExp; category: CommitCategory; confidence: number }> =
  [
    // Test files
    { pattern: /test[s]?\//i, category: 'test', confidence: 0.9 },
    { pattern: /__tests__\//i, category: 'test', confidence: 0.9 },
    { pattern: /\.test\.[jt]sx?$/i, category: 'test', confidence: 0.9 },
    { pattern: /\.spec\.[jt]sx?$/i, category: 'test', confidence: 0.9 },
    { pattern: /\.(test|spec)\.(ts|js|tsx|jsx)$/i, category: 'test', confidence: 0.9 },

    // Documentation files
    { pattern: /^docs?\//i, category: 'docs', confidence: 0.9 },
    { pattern: /readme/i, category: 'docs', confidence: 0.85 },
    { pattern: /\.md$/i, category: 'docs', confidence: 0.7 },
    { pattern: /changelog/i, category: 'docs', confidence: 0.8 },
    { pattern: /contributing/i, category: 'docs', confidence: 0.8 },

    // Config/chore files
    { pattern: /^\.github\//i, category: 'chore', confidence: 0.85 },
    { pattern: /^\.circleci\//i, category: 'chore', confidence: 0.85 },
    { pattern: /^\.gitlab-ci/i, category: 'chore', confidence: 0.85 },
    { pattern: /package(-lock)?\.json$/i, category: 'chore', confidence: 0.7 },
    { pattern: /yarn\.lock$/i, category: 'chore', confidence: 0.8 },
    { pattern: /dockerfile/i, category: 'chore', confidence: 0.75 },
    { pattern: /docker-compose/i, category: 'chore', confidence: 0.75 },
    { pattern: /\.(eslint|prettier|babel|tsconfig)/i, category: 'chore', confidence: 0.8 }
  ]

/**
 * Categorize a commit by analyzing its message
 */
export function categorizeByMessage(message: string): CategoryResult {
  const normalizedMessage = message.trim().toLowerCase()

  // Check for merge commits first
  if (normalizedMessage.startsWith('merge')) {
    return { category: 'merge', confidence: 0.95, reason: 'Merge commit detected' }
  }

  // Check conventional commit format: "type: message" or "type(scope): message"
  const conventionalMatch = normalizedMessage.match(/^(\w+)(?:\([^)]+\))?[:\s]/)
  if (conventionalMatch) {
    const prefix = conventionalMatch[1]
    if (prefix in CONVENTIONAL_PREFIXES) {
      return {
        category: CONVENTIONAL_PREFIXES[prefix],
        confidence: 0.95,
        reason: `Conventional commit prefix: ${prefix}`
      }
    }
  }

  // Check for square bracket format: "[type] message" or "[TYPE] message"
  const bracketMatch = normalizedMessage.match(/^\[(\w+)\]/)
  if (bracketMatch) {
    const prefix = bracketMatch[1].toLowerCase()
    if (prefix in CONVENTIONAL_PREFIXES) {
      return {
        category: CONVENTIONAL_PREFIXES[prefix],
        confidence: 0.9,
        reason: `Bracket prefix: ${prefix}`
      }
    }
  }

  // Check keyword patterns
  for (const { pattern, category, confidence } of KEYWORD_PATTERNS) {
    if (pattern.test(message)) {
      return {
        category,
        confidence,
        reason: `Keyword match: ${pattern.source}`
      }
    }
  }

  return { category: 'other', confidence: 0.5, reason: 'No clear category detected' }
}

/**
 * Categorize by analyzing file paths
 */
export function categorizeByFiles(files: string[]): CategoryResult | null {
  if (!files || files.length === 0) return null

  const categoryCounts: Partial<Record<CommitCategory, { count: number; confidence: number }>> = {}

  for (const file of files) {
    for (const { pattern, category, confidence } of FILE_PATH_PATTERNS) {
      if (pattern.test(file)) {
        if (!categoryCounts[category]) {
          categoryCounts[category] = { count: 0, confidence: 0 }
        }
        categoryCounts[category]!.count++
        categoryCounts[category]!.confidence = Math.max(
          categoryCounts[category]!.confidence,
          confidence
        )
      }
    }
  }

  // Find the dominant category
  let dominant: { category: CommitCategory; count: number; confidence: number } | null = null
  for (const [cat, data] of Object.entries(categoryCounts)) {
    if (!dominant || data.count > dominant.count) {
      dominant = { category: cat as CommitCategory, ...data }
    }
  }

  if (dominant && dominant.count >= files.length * 0.5) {
    return {
      category: dominant.category,
      confidence: dominant.confidence,
      reason: `File path analysis: ${dominant.count}/${files.length} files match ${dominant.category}`
    }
  }

  return null
}

/**
 * Categorize a commit using both message and file path analysis
 */
export function categorizeCommit(
  message: string,
  files?: string[],
  isMerge?: boolean
): CategoryResult {
  // Handle merge commits
  if (isMerge) {
    return { category: 'merge', confidence: 0.95, reason: 'Merge commit flag' }
  }

  // Get message-based categorization
  const messageResult = categorizeByMessage(message)

  // If message categorization is high confidence, use it
  if (messageResult.confidence >= 0.85) {
    return messageResult
  }

  // Try file-based categorization
  if (files && files.length > 0) {
    const fileResult = categorizeByFiles(files)
    if (fileResult) {
      // If file result is higher confidence, use it
      if (fileResult.confidence > messageResult.confidence) {
        return fileResult
      }
      // If both are similar, combine the reasoning
      if (fileResult.confidence >= 0.7 && messageResult.confidence >= 0.6) {
        return {
          category: messageResult.category,
          confidence: Math.min(0.95, (messageResult.confidence + fileResult.confidence) / 2 + 0.1),
          reason: `Combined: ${messageResult.reason} + ${fileResult.reason}`
        }
      }
    }
  }

  return messageResult
}

/**
 * Calculate category breakdown from a list of categorized commits
 */
export function calculateBreakdown(
  categories: CommitCategory[]
): CategoryBreakdown {
  const breakdown: CategoryBreakdown = {
    feature: 0,
    bugfix: 0,
    refactor: 0,
    test: 0,
    docs: 0,
    chore: 0,
    merge: 0,
    other: 0,
    total: categories.length
  }

  for (const cat of categories) {
    breakdown[cat]++
  }

  return breakdown
}

/**
 * Format breakdown as percentages
 */
export function formatBreakdownAsPercentages(breakdown: CategoryBreakdown): Record<string, string> {
  const result: Record<string, string> = {}
  const nonMergeTotal = breakdown.total - breakdown.merge

  if (nonMergeTotal === 0) {
    return { merge: '100%' }
  }

  const categories: (keyof Omit<CategoryBreakdown, 'total'>)[] = [
    'feature',
    'bugfix',
    'refactor',
    'test',
    'docs',
    'chore',
    'other'
  ]

  for (const cat of categories) {
    if (breakdown[cat] > 0) {
      const percentage = Math.round((breakdown[cat] / nonMergeTotal) * 100)
      result[cat] = `${percentage}%`
    }
  }

  return result
}

/**
 * Generate a human-readable summary of the breakdown
 */
export function summarizeBreakdown(breakdown: CategoryBreakdown): string {
  const parts: string[] = []
  const nonMergeTotal = breakdown.total - breakdown.merge

  if (nonMergeTotal === 0) {
    return breakdown.merge > 0 ? `${breakdown.merge} merge commits` : 'No commits'
  }

  const formatPart = (count: number, label: string): string | null => {
    if (count === 0) return null
    const pct = Math.round((count / nonMergeTotal) * 100)
    return `${pct}% ${label}`
  }

  const featurePart = formatPart(breakdown.feature, 'feature work')
  const bugfixPart = formatPart(breakdown.bugfix, 'bug fixes')
  const refactorPart = formatPart(breakdown.refactor, 'refactoring')
  const testPart = formatPart(breakdown.test, 'tests')
  const docsPart = formatPart(breakdown.docs, 'documentation')
  const chorePart = formatPart(breakdown.chore, 'chores')

  const allParts = [featurePart, bugfixPart, refactorPart, testPart, docsPart, chorePart].filter(
    Boolean
  ) as string[]

  if (allParts.length === 0) {
    return `${nonMergeTotal} commits`
  }

  return allParts.join(', ')
}
