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
