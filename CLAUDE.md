# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Electron app in development mode (hot reload)
npm run build        # Build for production
npm run build:mac    # Build macOS distributable
npm run build:win    # Build Windows distributable
npm run build:linux  # Build Linux distributable

npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage report
```

## Architecture Overview

Lookout is an Electron desktop app that generates AI-powered summaries of Git activity using Claude Code CLI. It integrates with GitHub for enhanced team analytics including PR tracking, code review metrics, and collaboration insights. Follows standard Electron architecture with three processes:

### Process Structure

```
src/
├── main/           # Main process (Node.js)
│   ├── index.ts    # App entry, window management, menu, tray
│   ├── services/   # Core business logic
│   │   ├── database.ts     # SQLite via better-sqlite3
│   │   ├── git.ts          # Git operations via simple-git
│   │   ├── claude.ts       # Claude Code CLI integration (spawns `claude` process)
│   │   ├── scheduler.ts    # Scheduled summary generation
│   │   ├── pregeneration.ts # Background AI summary generation
│   │   ├── github.ts       # GitHub API integration (PRs, reviews, issues)
│   │   ├── velocity.ts     # Team velocity tracking and charts
│   │   ├── collaboration.ts # Code review collaboration metrics
│   │   └── categorization.ts # Commit categorization (feature, bugfix, etc.)
│   ├── ipc/        # IPC handlers
│   │   ├── repos.ts        # Repository management (auto-detects GitHub remotes)
│   │   ├── settings.ts     # App settings
│   │   ├── git.ts          # Git operations
│   │   ├── summaries.ts    # Summary generation
│   │   ├── contributors.ts # Contributor profiles
│   │   ├── commits.ts      # Commit sync and categorization
│   │   ├── velocity.ts     # Velocity data endpoints
│   │   ├── github.ts       # GitHub sync operations
│   │   ├── pregeneration.ts # Pregeneration status and triggers
│   │   └── dangerzone.ts   # Destructive operations (clear data, reset DB)
│   ├── db/schema.ts # SQLite schema definition
│   └── tray.ts     # System tray menu
├── preload/        # Preload script - exposes `window.api` to renderer
│   └── index.ts    # All IPC bridge definitions (type-safe API surface)
└── renderer/       # React frontend (Vite)
    └── src/
        ├── App.tsx           # Tab-based navigation with NavigationContext
        ├── pages/            # Dashboard, MyWork, Team, Repos, History, Settings
        ├── components/
        │   ├── layout/       # AppShell, Sidebar
        │   ├── ui/           # Button, Card
        │   ├── VelocityChart.tsx      # Weekly commit velocity visualization
        │   └── CollaborationGraph.tsx # Code review relationship graph
        ├── globals.css       # Tailwind + CSS custom properties (theming)
        └── mockApi.ts        # Mock API for development/testing
```

### Key Data Flow

1. **Summary Generation**: MyWork/Team page → `window.api.summaries.generate()` → IPC → `claude.ts` → spawns `claude` CLI with streaming JSON output → streams back via IPC events
2. **Pregeneration**: On app startup, `pregeneration.ts` generates yesterday's summaries in background → stored in DB → Dashboard displays pre-generated content
3. **Git Data**: `git.ts` uses simple-git to query local repos, aggregates commits/stats across multiple repositories
4. **GitHub Sync**: When adding repos, auto-detects GitHub remotes → `github.ts` syncs PRs, reviews, issues via Octokit → enables collaboration metrics
5. **Velocity Tracking**: `commits.ts` syncs and categorizes commits → `velocity.ts` aggregates weekly snapshots → VelocityChart renders trends
6. **Contributor Aliasing**: Multiple git emails can be grouped under one profile (`contributor_profiles` + `contributor_emails` tables)

### Database

SQLite database at `~/Library/Application Support/lookout/lookout.db`. Key tables:
- `repositories` - tracked git repos (with `is_github`, `github_owner`, `github_repo` fields)
- `summaries` - generated summaries with date ranges
- `commits` - persisted commits with categorization (feature, bugfix, refactor, test, docs, chore)
- `velocity_snapshots` - weekly velocity aggregates per contributor
- `github_pull_requests` - synced PRs with state, labels, CI status
- `github_reviews` - code review data (reviewer, state, timestamps)
- `github_issues` - synced issues
- `contributor_profiles` / `contributor_emails` - email-to-identity mapping
- `settings` - key-value app settings

### Styling

- Tailwind CSS with custom design system in `globals.css`
- CSS custom properties for theming (supports light/dark mode)
- macOS-native appearance: `titleBarStyle: 'hiddenInset'`, traffic light positioning

### IPC Pattern

All renderer↔main communication goes through typed IPC:
- Preload script (`src/preload/index.ts`) defines the full API surface
- Main process handlers in `src/main/ipc/*.ts`
- Renderer accesses via `window.api.*`

### Key Features

- **GitHub Integration**: Auto-detects GitHub repos on add, syncs PRs/reviews/issues for team insights
- **Team Velocity**: Weekly commit charts with actual date ranges, category breakdown, team benchmarks
- **Collaboration Graph**: Visualizes who reviews whose code, review load distribution
- **Review Metrics**: Time-to-first-review, time-to-merge, approval rates per reviewer
- **Pregeneration**: Background generation of yesterday's summaries on app startup
- **Danger Zone**: Settings section for destructive operations (clear summaries, commits, GitHub data, reset DB)

## Testing

Tests use Vitest with React Testing Library. Mock API in `src/renderer/src/mockApi.ts` provides test fixtures.

```bash
npm run test                                    # Watch mode
npm run test:run -- src/renderer/src/__tests__/mockApi.test.ts  # Single file
```
