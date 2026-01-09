export const schema = `
-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TEXT,
    is_available INTEGER DEFAULT 1
);

-- Authors table (for identity grouping)
CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    canonical_author_id INTEGER,
    is_current_user INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canonical_author_id) REFERENCES authors(id)
);

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('personal', 'team', 'author')),
    author_id INTEGER,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    content TEXT NOT NULL,
    prompt_template TEXT NOT NULL,
    commit_count INTEGER DEFAULT 0,
    merge_count INTEGER DEFAULT 0,
    repos_included TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_scheduled INTEGER DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES authors(id)
);

-- Summary-Repository junction (which repos contributed to summary)
CREATE TABLE IF NOT EXISTS summary_repos (
    summary_id INTEGER NOT NULL,
    repo_id INTEGER NOT NULL,
    commit_count INTEGER DEFAULT 0,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    PRIMARY KEY (summary_id, repo_id),
    FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE,
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if not exist
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('scheduled_time', '08:00'),
    ('scheduled_enabled', 'false'),
    ('default_prompt_template', 'technical'),
    ('date_range_default', 'previous_day');

-- Prompt templates (custom user templates)
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,
    is_builtin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Generation history (for debugging)
CREATE TABLE IF NOT EXISTS generation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_id INTEGER,
    prompt_folder TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'error')),
    error_message TEXT,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_summaries_date_range ON summaries(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON summaries(type);
CREATE INDEX IF NOT EXISTS idx_summaries_author ON summaries(author_id);
CREATE INDEX IF NOT EXISTS idx_authors_email ON authors(email);
CREATE INDEX IF NOT EXISTS idx_generation_logs_status ON generation_logs(status);

-- Contributor profiles for aliasing multiple emails under one identity
CREATE TABLE IF NOT EXISTS contributor_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    is_excluded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Email-to-profile mapping
CREATE TABLE IF NOT EXISTS contributor_emails (
    email TEXT PRIMARY KEY,
    profile_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0,
    original_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES contributor_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contributor_emails_profile ON contributor_emails(profile_id);
`
