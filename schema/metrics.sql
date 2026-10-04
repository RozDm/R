-- Page-view counter per post slug.
CREATE TABLE IF NOT EXISTS views (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- Visitor counts per ISO 3166-1 alpha-2 country code.
CREATE TABLE IF NOT EXISTS geo (
  country TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- Contact-form submissions: doubles as rate-limit source (count per ip in a
-- window) and as a backup copy in case the e-mail leg fails.
CREATE TABLE IF NOT EXISTS contact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  ip TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_ip_at ON contact (ip, at);
CREATE INDEX IF NOT EXISTS contact_email_at ON contact (email, at);
