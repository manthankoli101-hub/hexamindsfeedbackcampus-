import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------
// Lightweight "AI" helpers — text classification, duplicate detection,
// priority scoring. Pure JS, unchanged in behaviour from the prototype;
// only the storage underneath is now SQLite instead of a JSON file.
// ---------------------------------------------------------------------

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const toks = (s) => new Set(norm(s).split(" ").filter((x) => x.length > 2));

// Words that show up across almost every complaint in this domain
// ("water", "leak", "block"...) carry little distinguishing power — two
// reports sharing only these look similar but usually aren't the same
// issue (e.g. "water filter leakage" vs "water leakage in washroom").
// They're down-weighted instead of ignored, so a report that's ONLY
// generic words still contributes a little, but specific, distinguishing
// words ("filter", "washroom", "projector") drive the match.
const LOW_SIGNAL_WORDS = new Set([
  "water", "leak", "leaks", "leaking", "leakage", "block", "wing", "near",
  "area", "issue", "issues", "problem", "problems", "please", "fix",
  "floor", "room", "campus", "college", "the", "and", "not", "working"
]);
const LOW_SIGNAL_WEIGHT = 0.25;
const weightOf = (t) => (LOW_SIGNAL_WORDS.has(t) ? LOW_SIGNAL_WEIGHT : 1);

function similarity(a, b) {
  const A = toks(a), B = toks(b);
  if (!A.size || !B.size) return 0;
  const union = new Set([...A, ...B]);
  let interWeight = 0, unionWeight = 0;
  for (const t of union) {
    const w = weightOf(t);
    unionWeight += w;
    if (A.has(t) && B.has(t)) interWeight += w;
  }
  return unionWeight ? interWeight / unionWeight : 0;
}

function analyze(description, location, severity) {
  const t = norm(`${description} ${location}`);
  let category = "General Service", department = "Campus Administration";

  if (/water|leak|tap|cooler|drinking/.test(t)) { category = "Water / Maintenance"; department = "Maintenance"; }
  else if (/wifi|wi-fi|internet|network/.test(t)) { category = "Connectivity"; department = "IT Services"; }
  else if (/projector|computer|printer|av|smart board/.test(t)) { category = "Classroom Equipment"; department = "IT / AV Support"; }
  else if (/light|wire|electric|socket|power/.test(t)) { category = "Electrical"; department = "Electrical Maintenance"; }
  else if (/clean|garbage|toilet|washroom|dust/.test(t)) { category = "Cleaning"; department = "Housekeeping"; }

  const hazard = /exposed wire|gas leak|fire|smoke|live wire/.test(t);
  return { category, department, hazardDetected: hazard, recommendedSeverity: hazard ? 4 : Number(severity) };
}

// Two reports only count as duplicates of each other if they're at the
// SAME location (picked from the same dropdown, so this is an exact,
// reliable signal) AND the wording is similar enough once generic
// maintenance words are down-weighted. The threshold is intentionally
// higher than before so loosely related reports ("water filter leakage"
// vs "water leakage in washroom") land as separate issues.
const DUPLICATE_MATCH_THRESHOLD = 0.4;

function priority(severity, duplicateCount, pop = 1000) {
  const pct = (duplicateCount / pop) * 100;
  if (severity === 4) return 4;
  if (severity === 3) return 3;
  if (severity === 2) return pct >= 5 ? 3 : 2;
  if (severity === 1) return pct > 5 ? 3 : pct >= 2 ? 2 : 1;
  return 1;
}

// As more students report the same issue, it's treated as more severe —
// every 3 extra duplicate reports bumps severity by 1 level above what was
// originally reported. baseSeverity (the level the first reporter picked)
// never changes; only this derived value does.
//
// Crowd size alone is capped at severity 3 (priority P3): a flood of
// duplicate reports shouldn't auto-promote something to hazard-level (P4)
// just because a lot of people complained — that could be gamed, and P4 is
// meant to mean "genuinely dangerous", not "popular". The cap only lifts
// once the report count is overwhelming (DUPLICATE_HAZARD_THRESHOLD), or
// if the issue was reported as a hazard (severity 4) from the start —
// e.g. an exposed wire or gas leak skips the cap entirely.
const DUPLICATE_HAZARD_THRESHOLD = 60;

function escalateSeverity(baseSeverity, duplicateCount) {
  const base = Number(baseSeverity);
  const bumps = Math.floor(Math.max(0, duplicateCount - 1) / 3);
  let escalated = Math.min(4, base + bumps);

  if (base < 4 && escalated >= 4 && duplicateCount < DUPLICATE_HAZARD_THRESHOLD) {
    escalated = 3;
  }
  return escalated;
}

// ---------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------

const stmt = {
  findUserByEmail: db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)"),
  allIssues: db.prepare("SELECT * FROM issues ORDER BY priority DESC, createdAt DESC"),
  issueById: db.prepare("SELECT * FROM issues WHERE id = ?"),
  openIssues: db.prepare("SELECT * FROM issues WHERE status != 'Resolved'"),
  issueCount: db.prepare("SELECT COUNT(*) AS c FROM issues"),
  insertIssue: db.prepare(`
    INSERT INTO issues
      (id, title, description, location, severity, baseSeverity, priority, category,
       department, status, duplicateCount, createdBy, createdAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  bumpDuplicate: db.prepare("UPDATE issues SET duplicateCount = ?, severity = ?, priority = ? WHERE id = ?"),
  updateStatus: db.prepare("UPDATE issues SET status = ? WHERE id = ?"),
  maxIssueId: db.prepare("SELECT id FROM issues WHERE id LIKE 'ISS-%'"),
  reportsByIssue: db.prepare("SELECT r.*, u.name AS studentName FROM issue_reports r JOIN users u ON u.id = r.createdBy WHERE r.issueId = ? ORDER BY r.createdAt ASC"),
  insertReport: db.prepare(`
    INSERT INTO issue_reports (id, issueId, description, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `),
  maxReportId: db.prepare("SELECT id FROM issue_reports WHERE issueId = ?")
};

// Generates the next report id for a given issue (ISS-102-R1, -R2, ...) based
// on how many reports already exist under it, so duplicates from the same
// issue never collide.
function nextReportId(issueId) {
  const existing = stmt.maxReportId.all(issueId);
  let max = 0;
  for (const row of existing) {
    const m = /-R(\d+)$/.exec(row.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${issueId}-R${max + 1}`;
}

// Generates the next ISS-### id based on the highest existing numeric
// suffix, so it never collides even after issues are added out of order.
function nextIssueId() {
  let max = 100;
  for (const row of stmt.maxIssueId.all()) {
    const n = Number(row.id.slice(4));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `ISS-${max + 1}`;
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/login", (req, res) => {
  const user = stmt.findUserByEmail.get(String(req.body.email || ""));
  if (!user) return res.status(401).json({ message: "Use a registered demo account." });
  res.json({ user });
});

app.get("/api/issues", (req, res) => {
  res.json(stmt.allIssues.all());
});

app.get("/api/issues/:id", (req, res) => {
  const issue = stmt.issueById.get(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue not found" });
  res.json(issue);
});

app.post("/api/issues", (req, res) => {
  const { description, location, severity, createdBy = "u1" } = req.body;

  if (!description?.trim() || !location?.trim() || !severity) {
    return res.status(400).json({ message: "Description, location and severity are required." });
  }

  const analysis = analyze(description, location, severity);
  const normalizedLocation = location.trim().toLowerCase();

  let best = null, score = 0;
  for (const existing of stmt.openIssues.all()) {
    if (existing.location.trim().toLowerCase() !== normalizedLocation) continue;
    const s = similarity(description, existing.description);
    if (s > score) { score = s; best = existing; }
  }

  if (best && score >= DUPLICATE_MATCH_THRESHOLD) {
    const duplicateCount = best.duplicateCount + 1;
    const newSeverity = escalateSeverity(best.baseSeverity, duplicateCount);
    const newPriority = priority(newSeverity, duplicateCount);
    stmt.bumpDuplicate.run(duplicateCount, newSeverity, newPriority, best.id);
    stmt.insertReport.run(
      nextReportId(best.id), best.id, description.trim(), createdBy, new Date().toISOString()
    );
    const updated = stmt.issueById.get(best.id);
    return res.status(201).json({ mode: "duplicate", similarity: Math.round(score * 100), issue: updated, analysis });
  }

  const id = nextIssueId();
  const baseSeverity = analysis.recommendedSeverity;
  const issue = {
    id,
    title: description.trim().slice(0, 50),
    description: description.trim(),
    location: location.trim(),
    severity: escalateSeverity(baseSeverity, 1),
    baseSeverity,
    priority: priority(escalateSeverity(baseSeverity, 1), 1),
    category: analysis.category,
    department: analysis.department,
    status: "Assigned",
    duplicateCount: 1,
    createdBy,
    createdAt: new Date().toISOString()
  };

  stmt.insertIssue.run(
    issue.id, issue.title, issue.description, issue.location, issue.severity, issue.baseSeverity,
    issue.priority, issue.category, issue.department, issue.status,
    issue.duplicateCount, issue.createdBy, issue.createdAt
  );
  stmt.insertReport.run(`${issue.id}-R1`, issue.id, issue.description, issue.createdBy, issue.createdAt);
  res.status(201).json({ mode: "new", similarity: Math.round(score * 100), issue, analysis });
});

// All individual reports grouped under one issue — this is what powers the
// "every student's own comment" view on the admin issue page. Reports filed
// before this table existed (old duplicates that only bumped
// issues.duplicateCount) won't have a row here; issues.duplicateCount is
// still the total count, this list is just what's on record with text.
app.get("/api/issues/:id/reports", (req, res) => {
  const issue = stmt.issueById.get(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue not found" });
  res.json(stmt.reportsByIssue.all(req.params.id));
});

app.patch("/api/issues/:id/status", (req, res) => {
  const allowed = ["Submitted", "Assigned", "In Progress", "Resolved"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid status" });

  const issue = stmt.issueById.get(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue not found" });

  stmt.updateStatus.run(req.body.status, req.params.id);
  res.json(stmt.issueById.get(req.params.id));
});

app.listen(PORT, () => console.log(`CampusFeedback API (SQLite): http://localhost:${PORT}`));
