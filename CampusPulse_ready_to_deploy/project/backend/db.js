// SQLite data layer for CampusFeedback.
// Uses Node's built-in "node:sqlite" module (ships with Node 22.5+,
// no flag needed since 22.13+) — zero extra npm packages, no native
// binaries to compile/download, so it just works on any machine with
// a reasonably recent Node.js. On first boot it creates campus.db next
// to this file and, if it's empty, seeds it once from data.json.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "campus.db");
const SEED_PATH = path.join(__dirname, "data.json");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

// Migration: older databases created before the severity-escalation feature
// won't have the baseSeverity column yet. Add it and backfill from the
// existing severity value so escalation has a stable starting point.
function migrate() {
  const columns = db.prepare("PRAGMA table_info(issues)").all();
  const hasBaseSeverity = columns.some((c) => c.name === "baseSeverity");
  if (!hasBaseSeverity) {
    db.exec("ALTER TABLE issues ADD COLUMN baseSeverity INTEGER NOT NULL DEFAULT 1");
    db.exec("UPDATE issues SET baseSeverity = severity");
    console.log("Migrated campus.db: added baseSeverity column.");
  }
}
migrate();

function seedIfEmpty() {
  const { c: userCount } = db.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (userCount > 0 || !fs.existsSync(SEED_PATH)) return;

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, role)
    VALUES (?, ?, ?, ?)
  `);

  const insertIssue = db.prepare(`
    INSERT INTO issues
      (id, title, description, location, severity, baseSeverity, priority, category,
       department, status, duplicateCount, createdBy, createdAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReport = db.prepare(`
    INSERT INTO issue_reports (id, issueId, description, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const u of seed.users || []) {
      insertUser.run(u.id, u.name, u.email, u.role);
    }
    for (const i of seed.issues || []) {
      // Seed data predates baseSeverity; treat the seeded severity as the
      // original report and let escalation take it from there.
      insertIssue.run(
        i.id, i.title, i.description, i.location, i.severity, i.baseSeverity ?? i.severity,
        i.priority, i.category, i.department, i.status, i.duplicateCount, i.createdBy, i.createdAt
      );
      // The founding report of each seed issue is on record (it's the issue's
      // own description), so store that one as report #1. Any duplicateCount
      // above 1 in the seed data predates per-report storage and stays as a
      // bare number — no invented text for those.
      insertReport.run(`${i.id}-R1`, i.id, i.description, i.createdBy, i.createdAt);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log(`Seeded ${DB_PATH} from data.json (${seed.users?.length || 0} users, ${seed.issues?.length || 0} issues).`);
}

seedIfEmpty();
