# Lookout

AI-powered Git work summaries for standups and status updates.

Lookout is a macOS desktop app that analyzes your Git commit history across multiple repositories and generates intelligent summaries using Claude. Perfect for daily standups, weekly reports, or keeping track of what your team has been working on.

## Features

- **Multi-repo tracking** — Add any number of local Git repositories and get unified activity views
- **AI-powered summaries** — Generate natural language summaries of your work using Claude Code
- **Personal & team views** — Summaries for your own commits or your entire team's activity
- **Contribution graph** — Visual heatmap of your Git activity over the past year
- **Contributor management** — Alias multiple Git emails to a single identity, exclude bots
- **Scheduled generation** — Automatically generate daily summaries at a set time
- **Summary templates** — Technical, manager-friendly, or casual standup formats
- **Export & copy** — Copy summaries to clipboard or export as Markdown files
- **System tray** — Quick access from the menu bar, stays running in background

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

1. **Add repositories** — Go to Repositories and add your local Git repos
2. **Generate a summary** — Go to My Work, select a date range, and click Generate Summary
3. **View team activity** — The Team page shows all contributors and can generate team-wide summaries
4. **Configure settings** — Set up scheduled generation, choose default templates, manage contributors

## How It Works

Lookout uses [simple-git](https://github.com/steveukx/git-js) to query your local repositories for commit data. When you generate a summary, it:

1. Collects commits from all tracked repos for the selected date range
2. Builds a structured prompt with commit messages, stats, and metadata
3. Streams the prompt to Claude Code CLI (`claude -p`)
4. Displays the AI-generated summary with real-time streaming

All data stays local — commits are read directly from your Git repos, and summaries are stored in a local SQLite database.

## Tech Stack

- **Electron** — Desktop app framework
- **React 19** — UI framework
- **Vite** — Build tool via electron-vite
- **Tailwind CSS** — Styling
- **better-sqlite3** — Local database
- **simple-git** — Git operations
- **Claude Code CLI** — AI summary generation

## License

MIT
