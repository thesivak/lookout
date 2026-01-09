# Lookout

AI-powered Git work summaries for standups and status updates.

Lookout is a macOS desktop app that analyzes your Git commit history across multiple repositories and generates intelligent summaries using Claude. It integrates with GitHub for team analytics including PR tracking, code review metrics, and collaboration insights. Perfect for daily standups, weekly reports, or keeping track of what your team has been working on.

## Features

- **Multi-repo tracking** — Add any number of local Git repositories and get unified activity views
- **AI-powered summaries** — Generate natural language summaries of your work using Claude Code
- **Personal & team views** — Summaries for your own commits or your entire team's activity
- **GitHub integration** — Auto-detects GitHub repos and syncs PRs, code reviews, and issues
- **Team velocity** — Visual charts showing weekly commit trends with category breakdowns
- **Collaboration graph** — See who reviews whose code and review load distribution
- **Code review metrics** — Time-to-first-review, time-to-merge, approval rates per reviewer
- **Commit categorization** — Automatically classifies commits (feature, bugfix, refactor, docs, etc.)
- **Background pregeneration** — Yesterday's summaries generated automatically on startup
- **Contribution graph** — Visual heatmap of your Git activity over the past year
- **Contributor management** — Alias multiple Git emails to a single identity, exclude bots
- **Scheduled generation** — Automatically generate daily summaries at a set time
- **Summary templates** — Technical, manager-friendly, or casual standup formats
- **Export & copy** — Copy summaries to clipboard or export as Markdown files
- **System tray** — Quick access from the menu bar, stays running in background
- **Danger zone** — Safely manage your data with clear summaries, reset database options

## Requirements

- macOS (Windows/Linux builds available but untested)
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- Git repositories on your local machine

## Installation

Download the latest release from the [Releases](https://github.com/thesivak/lookout/releases) page, or build from source:

```bash
git clone https://github.com/thesivak/lookout.git
cd lookout
npm install
npm run build:mac
```

The built app will be in the `dist/` folder.

## Development

```bash
npm install
npm run dev
```

This starts the Electron app with hot reload for the renderer process.

### Running Tests

```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

### Building

```bash
npm run build:mac   # macOS
npm run build:win   # Windows
npm run build:linux # Linux
```

## Usage

1. **Add repositories** — Go to Repositories and add your local Git repos (GitHub repos are auto-detected)
2. **Connect GitHub** — In Settings, add your GitHub token to enable PR and review syncing
3. **Generate a summary** — Go to My Work, select a date range, and click Generate Summary
4. **View team insights** — The Team page shows velocity charts, collaboration graphs, and review metrics
5. **Check your dashboard** — Yesterday's summary is pre-generated automatically on startup
6. **Configure settings** — Set up scheduled generation, templates, contributors, and data management

## How It Works

Lookout uses [simple-git](https://github.com/steveukx/git-js) to query your local repositories for commit data. When you generate a summary, it:

1. Collects commits from all tracked repos for the selected date range
2. Categorizes commits by type (feature, bugfix, refactor, docs, etc.)
3. Builds a structured prompt with commit messages, stats, and metadata
4. Streams the prompt to Claude Code CLI (`claude -p`)
5. Displays the AI-generated summary with real-time streaming

For GitHub-connected repos, Lookout also syncs:
- Pull requests with state, labels, and CI status
- Code reviews with reviewer, approval state, and timestamps
- Issues for cross-referencing with commits

This enables team analytics like velocity tracking, collaboration graphs, and review metrics (time-to-first-review, approval rates).

All data stays local — commits are read directly from your Git repos, GitHub data is synced via API, and everything is stored in a local SQLite database.

## Tech Stack

- **Electron** — Desktop app framework
- **React 19** — UI framework
- **Vite** — Build tool via electron-vite
- **Tailwind CSS** — Styling
- **better-sqlite3** — Local database
- **simple-git** — Git operations
- **Octokit** — GitHub API integration
- **Claude Code CLI** — AI summary generation

## License

MIT
