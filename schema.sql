CREATE TABLE IF NOT EXISTS scheduled_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  weekday INTEGER,
  monthday INTEGER,
  month INTEGER,
  send_time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_send_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once','daily','weekly','monthly','yearly')),
  completed INTEGER NOT NULL DEFAULT 0,
  last_notified_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, id);

-- 2026-09-13: 置顶功能
ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
