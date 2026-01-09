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

Lookout is an Electron desktop app that generates AI-powered summaries of Git activity using Claude Code CLI. It follows standard Electron architecture with three processes:

### Process Structure

```
src/
├── main/           # Main process (Node.js)
│   ├── index.ts    # App entry, window management, menu, tray
│   ├── services/   # Core business logic
│   │   ├── database.ts  # SQLite via better-sqlite3
│   │   ├── git.ts       # Git operations via simple-git
│   │   ├── claude.ts    # Claude Code CLI integration (spawns `claude` process)
│   │   └── scheduler.ts # Scheduled summary generation
│   ├── ipc/        # IPC handlers (repos, settings, git, summaries, contributors)
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
        │   └── ui/           # Button, Card
        ├── globals.css       # Tailwind + CSS custom properties (theming)
        └── mockApi.ts        # Mock API for development/testing
```

### Key Data Flow

1. **Summary Generation**: MyWork/Team page → `window.api.summaries.generate()` → IPC → `claude.ts` → spawns `claude` CLI with streaming JSON output → streams back via IPC events
2. **Git Data**: `git.ts` uses simple-git to query local repos, aggregates commits/stats across multiple repositories
3. **Contributor Aliasing**: Multiple git emails can be grouped under one profile (`contributor_profiles` + `contributor_emails` tables)

### Database

SQLite database at `~/Library/Application Support/lookout/lookout.db`. Key tables:
- `repositories` - tracked git repos
- `summaries` - generated summaries with date ranges
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

## Testing

Tests use Vitest with React Testing Library. Mock API in `src/renderer/src/mockApi.ts` provides test fixtures.

```bash
npm run test                                    # Watch mode
npm run test:run -- src/renderer/src/__tests__/mockApi.test.ts  # Single file
```
