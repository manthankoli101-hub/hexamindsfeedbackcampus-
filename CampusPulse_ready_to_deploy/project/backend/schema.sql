-- CampusFeedback database schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role  TEXT NOT NULL CHECK (role IN ('student', 'admin'))
);

CREATE TABLE IF NOT EXISTS issues (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  location       TEXT NOT NULL,
  severity       INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 4),
  baseSeverity   INTEGER NOT NULL DEFAULT 1 CHECK (baseSeverity BETWEEN 1 AND 4),
  priority       INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 4),
  category       TEXT NOT NULL,
  department     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Assigned'
                 CHECK (status IN ('Submitted', 'Assigned', 'In Progress', 'Resolved')),
  duplicateCount INTEGER NOT NULL DEFAULT 1,
  createdBy      TEXT NOT NULL REFERENCES users(id),
  createdAt      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_location ON issues(location);
CREATE INDEX IF NOT EXISTS idx_issues_status   ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_createdBy ON issues(createdBy);

-- Individual reports filed against an issue. The first report that creates
-- an issue AND every later duplicate report grouped under it each get a row
-- here, so the admin can see every student's own comment, not just a count.
-- Rows created before this table existed (old duplicates that only bumped
-- issues.duplicateCount) have no corresponding row here — issues.duplicateCount
-- remains the source of truth for "how many reports total", this table is
-- "what did each individual report say" for reports filed from now on.
CREATE TABLE IF NOT EXISTS issue_reports (
  id          TEXT PRIMARY KEY,
  issueId     TEXT NOT NULL REFERENCES issues(id),
  description TEXT NOT NULL,
  createdBy   TEXT NOT NULL REFERENCES users(id),
  createdAt   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_issueId ON issue_reports(issueId);
