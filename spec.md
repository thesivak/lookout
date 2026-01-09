# Lookout - Product Specification

Lookout is a lightweight desktop application that helps developers generate AI-powered summaries of their Git work for standups and team visibility. The app runs entirely locally, using Claude Code in headless mode for AI processing, ensuring privacy and eliminating the need for external API calls.

## 1. Core Value Proposition

- **For Individual Developers:** Generate shareable standup summaries of your work (previous day/week/month) with a single click
- **For Team Leads:** View consolidated work summaries across all team members in monitored repositories
- **Privacy-First:** All processing happens locally using Claude Code headless mode - no analytics, no external data transmission

---

## 2. Tech Stack

### Frontend
- **Electron** - Cross-platform desktop application framework
- **React** - UI component library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tooling and HMR

### Backend/Process Management
- **Node.js** - Runtime for Electron main process
- **child_process** - Execute Git commands and Claude Code headless mode

### Git Integration
- **simple-git** or native `git` CLI - Git operations and log parsing

### AI Integration
- **Claude Code (headless mode)** - Local AI processing via `-p` flag
  - No API keys required
  - Privacy-first local processing
  - Requires Claude Max subscription
  - Uses stdin (`-p -`) for prompt passing to handle large commit histories

### Data Storage
- **SQLite via better-sqlite3** - Full relational database for summaries, history, and configuration
- **App data directory** - All data stored in `~/Library/Application Support/Lookout/` (macOS) or equivalent

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **electron-builder** - App packaging and distribution

---

## 3. Target Users

### Primary Users
- **Software Engineers** who need to report their daily/weekly work in standups
- **Team Leads** who want visibility into team productivity and contributions
- **Remote Workers** who need to communicate async about their progress

### User Requirements
- Users must have Claude Code installed locally (Claude Max subscribers)
- Users must have Git installed and configured
- Users work with local Git repositories

---

## 4. Application Architecture

### App Lifecycle
- **Login item with system tray** - Starts at login, lives in tray, spawns main window on demand
- **Background auto-generation** - Generates summaries on configurable daily schedule
- **Notifications** - System notification + tray badge when summaries are ready

### Visual Design
- **Dark theme only** - Modern, minimal/clean aesthetic (like Linear)
- **Focus on content** - Lots of whitespace, emphasis on readability

### Navigation
- **Tabs at top** - Primary navigation between "My Work" and "Team" views
- **Dashboard as home** - Stats, recent activity, contribution graph, and quick actions

---

## 5. Features (MVP)

### 5.1 Dashboard Overview

**Description:** The home screen providing immediate visibility into activity and quick access to summary generation.

**Components:**
1. **Contribution Graph** - GitHub-style activity visualization showing:
   - Commit activity across all repos (primary)
   - Summary generation markers (overlaid)
2. **Basic Stats Display** - Key numbers: total commits, lines changed, repos active
3. **Recent Summaries** - List of recent summaries with quick access
4. **Quick Generate Button** - Prominent CTA with time range selector
5. **Pending/Scheduled** - Show any scheduled but not yet generated summaries

### 5.2 Personal Work Overview ("My Work" Tab)

**Description:** Generate an AI-powered summary of the user's own commits across all imported repositories.

**User Flow:**
1. User imports local Git repositories into the app (manual folder picker)
2. User selects time range (previous day, previous week, previous month, or custom range)
3. User clicks "Generate My Overview"
4. App collects commit data for commits authored by the current Git user (from global git config)
5. App sends commit data to Claude Code (headless mode) for summarization
6. User receives a formatted, editable summary
7. User can inline-edit the summary before copying/exporting

**Technical Requirements:**
- Parse `git log` output filtering by author from global git config
- Include all branches (not just default branch)
- Filter by date range using local system timezone
- Handle merge commits separately - count them distinctly and mention "merged X PRs" in summary
- Extract: commit messages, files changed, additions/deletions (no actual code diffs)
- Generate summary using Claude Code `-p` flag with chunked processing (one Claude call per repo)
- Display summary with inline editing capability
- Copy-to-clipboard and Markdown file export functionality

**Output Format:**
```markdown
## Work Summary - [Date Range]

### Highlights
- [Key accomplishments]

### Repositories
#### [Repo Name]
- [Summary of changes]
- Files: X changed, +Y/-Z lines
- Merged: X pull requests

### Key Commits
- [Significant commits with context]
```

### 5.3 Team Work Overview ("Team" Tab)

**Description:** View work summaries for all contributors across imported repositories.

**User Flow:**
1. User clicks "Fetch Latest" to update remote references
2. App runs `git fetch --all` on all imported repositories (parallel processing)
3. User selects time range and clicks "Generate Team Overview"
4. App collects commits from all authors (no filtering - includes everyone)
5. App groups commits by author and generates summaries
6. User can view individual or consolidated team summaries

**Technical Requirements:**
- Run `git fetch --all` to get latest remote changes
- Parse `git log` for all commits in the time range across all branches
- Group commits by author (email/name)
- Auto-detect author identity groupings (same person with multiple emails), allow user override
- Generate per-author summaries using Claude Code (chunked by repo)
- Option to generate consolidated team summary

**Output Format:**
```markdown
## Team Overview - [Date Range]

### [Author Name]
- Commits: X
- Summary: [AI-generated summary]
- Merged: Y pull requests

### [Author Name]
- Commits: Y
- Summary: [AI-generated summary]

---
### Team Highlights
[Consolidated AI-generated insights]
```

### 5.4 Repository Management

**Description:** Import and manage local Git repositories for summary generation.

**Features:**
- **Manual folder picker** - Browse and select individual repo folders
- **Flat list display** - Simple list of repos, no grouping/folders/tags
- **Soft warning** - Warn if importing many repos but allow it
- **Relocate prompt** - When repo becomes unavailable (deleted, moved, drive disconnected), prompt user to point to new location or remove
- **Monorepo handling** - Treat as single repo, no special path filtering

### 5.5 Summary History

**Description:** Browse and access previously generated summaries.

**Features:**
- **Calendar picker** - Visual calendar showing days with summaries, click to view
- **Filter controls** - Narrow down by repository or author
- **Permanent storage** - Keep all summaries forever in SQLite database
- **Inline editing** - Edit historical summaries
- **Regeneration** - Replace original when regenerating (no versioning)

### 5.6 Scheduled Generation

**Description:** Automatic background summary generation.

**Features:**
- **Fixed daily time** - User sets a specific time for daily generation
- **Background execution** - Runs when app is in tray, doesn't require window open
- **Notifications** - System notification + tray badge when complete
- **Check on startup** - Verify Claude Code is installed and working, show setup help if missing

### 5.7 Export Options

**Description:** Ways to share and export generated summaries.

**Supported Formats:**
- **Clipboard** - Copy Markdown to clipboard
- **Markdown file** - Export as .md file

### 5.8 Prompt Customization

**Description:** Control how AI generates summaries.

**Features:**
- **Preset templates** - Choose from: 'Technical', 'Manager-friendly', 'Casual standup', etc.
- **Advanced editing** - Power users can modify the full prompt template
- **Per-summary selection** - Choose template before generating

---

## 6. Claude Code Integration

### Execution Approach
Based on proven pattern from sivaces project - folder-based prompt storage with stdin execution.

### Prompt Folder Structure
Location: `~/Library/Application Support/Lookout/prompts/`

Each generation creates a folder with full context in name:
```
prompts/
├── personal-2026-01-01-to-2026-01-08/
│   ├── system-prompt.md      # Instructions for Claude
│   ├── user-prompt.md        # Git commit data to analyze
│   ├── metadata.json         # Execution metadata
│   ├── response.json         # Claude's response
│   └── streaming-log.jsonl   # Real-time output stream
└── team-2026-01-08-to-2026-01-08/
    └── [same structure]
```

### Execution Details
```typescript
const args = [
  '-p', '-',                          // Read prompt from stdin (handles large data)
  '--output-format', 'stream-json',   // Streaming output
  '--max-turns', '1',
  '--verbose',
]

if (systemPrompt) {
  args.push('--system-prompt', systemPromptPath)
}

const proc = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
})

proc.stdin.write(userPrompt)
proc.stdin.end()
```

### Error Handling
- **Retry with backoff** - Automatically retry 2-3 times with exponential backoff on failures
- **Startup check** - Verify Claude Code installed on app launch
- **Graceful degradation** - Show helpful error if Claude Code unavailable

### Debug Data
- **Keep forever** - All prompt folders retained for debugging
- **Stored in app data** - Hidden in system app data directory

---

## 7. User Interface Details

### Progress Indication
- **Progress bar with percentage** - Show overall progress (e.g., "Processing repo 3/10")
- **Per-repo status** - Visual indicator for each repo (pending/processing/done)

### Empty States
- **No commits found** - Friendly message when selected time range has no commits
- **No repos imported** - Guide to import first repository

### Keyboard Shortcuts
- **Basic only** - Standard shortcuts (copy, close, navigation)
- No command palette

### Onboarding
- **Minimal** - Jump straight to import repos, learn by doing
- No setup wizard or tutorial overlays

---

## 8. Data & Privacy

### Storage
- **SQLite database** - All summaries, settings, repo configs stored locally
- **App data directory** - Standard OS location for application data
- **No sync** - Each machine has independent data, no cloud sync

### Privacy
- **No analytics** - Zero telemetry or usage tracking
- **No external calls** - All AI processing via local Claude Code
- **User responsibility** - User decides what repos to import, app doesn't filter sensitive commits

### User Identity
- **Global git config** - Use `user.email` from global git config to identify "my" commits
- **Identity auto-detection** - Suggest groupings for multiple emails (same person), user can override

---

## 9. Application Updates

- **Manual download** - Check for updates manually, download from website
- No auto-update mechanism

---

## 10. Technical Constraints

### Git Handling
- **All branches** - Include commits from all local/remote branches
- **Merge commits** - Track separately, summarize as "merged X PRs"
- **Edge cases ignored** - Only support repos in normal state (no special handling for rebase in progress, detached HEAD, etc.)

### Performance
- **Parallel processing** - Process multiple repos simultaneously
- **Chunked AI calls** - One Claude Code invocation per repository
- **Soft limits** - Warn user if importing many repos but allow it

### Time Handling
- **Local timezone** - All date ranges use system timezone
- **Flexible ranges** - Previous day, previous week, previous month, custom date range

---

## 11. Out of Scope (MVP)

- Slack integration
- Cloud sync between machines
- Rich data visualizations (charts beyond contribution graph)
- Repository grouping/tagging
- Monorepo path filtering
- Git edge case handling (rebases, detached HEAD)
- Opt-in analytics
- Auto-updates
- Light theme
