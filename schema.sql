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
  cycle_days INTEGER NOT NULL DEFAULT 1,
  complete_date TEXT,
  next_date TEXT NOT NULL,
  remind_time_1 TEXT NOT NULL DEFAULT '08:00',
  remind_time_2 TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_slot1_date TEXT,
  last_slot2_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, id);

-- 2026-09-13: 置顶功能
ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

-- 2026-09-13: 评论增加电话字段
ALTER TABLE comments ADD COLUMN phone TEXT NOT NULL DEFAULT '';
