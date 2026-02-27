CREATE TABLE IF NOT EXISTS migration_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','paused','completed','cancelled','failed')),
  mode TEXT NOT NULL DEFAULT 'full' CHECK(mode IN ('full','continuous')),
  total_accounts INTEGER NOT NULL DEFAULT 0,
  completed_accounts INTEGER NOT NULL DEFAULT 0,
  failed_accounts INTEGER NOT NULL DEFAULT 0,
  sync_interval INTEGER NOT NULL DEFAULT 300,
  src_host TEXT NOT NULL DEFAULT '',
  src_port INTEGER NOT NULL DEFAULT 993,
  dst_host TEXT NOT NULL DEFAULT '',
  dst_port INTEGER NOT NULL DEFAULT 993,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  src_email TEXT NOT NULL,
  src_password TEXT NOT NULL,
  dst_email TEXT NOT NULL,
  dst_password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','paused','cancelled','skipped')),
  total_messages INTEGER NOT NULL DEFAULT 0,
  migrated_messages INTEGER NOT NULL DEFAULT 0,
  failed_messages INTEGER NOT NULL DEFAULT 0,
  skipped_messages INTEGER NOT NULL DEFAULT 0,
  current_folder TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_job_id ON accounts(job_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

CREATE TABLE IF NOT EXISTS folder_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL,
  uid_validity INTEGER,
  last_uid INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  migrated_messages INTEGER NOT NULL DEFAULT 0,
  failed_messages INTEGER NOT NULL DEFAULT 0,
  skipped_messages INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','skipped')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, folder_path)
);

CREATE INDEX IF NOT EXISTS idx_folder_state_account_id ON folder_state(account_id);

CREATE TABLE IF NOT EXISTS migration_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder_path TEXT,
  message_uid INTEGER,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  retryable INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_migration_errors_account_id ON migration_errors(account_id);
