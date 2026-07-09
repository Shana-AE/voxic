import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { useRuntimeConfig } from "#imports"
import * as schema from "./schema"

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _raw: Database.Database | null = null

/** Resolve the SQLite path relative to the app root (handles relative paths). */
function resolveDbPath(): string {
  const cfg = useRuntimeConfig()
  const p = cfg.dbPath
  return p.startsWith("/") ? p : resolve(process.cwd(), p)
}

/** Get the Drizzle-wrapped SQLite database (singleton). */
export function useDb() {
  if (_db) return _db
  const path = resolveDbPath()
  mkdirSync(dirname(path), { recursive: true })
  _raw = new Database(path)
  _raw.pragma("journal_mode = WAL")
  _raw.pragma("foreign_keys = ON")
  _db = drizzle(_raw, { schema })
  initSchema(_raw)
  return _db
}

/** Create tables if missing (lightweight; avoids a separate migration step in dev). */
function initSchema(raw: Database.Database) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      forget_count INTEGER,
      vague_count INTEGER,
      familiar_count INTEGER,
      raw_markdown TEXT NOT NULL,
      parsed_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date);

    CREATE TABLE IF NOT EXISTS tts_cache (
      cache_key TEXT PRIMARY KEY,
      voice TEXT NOT NULL,
      seg_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      duration INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_state (
      word TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      ease INTEGER NOT NULL DEFAULT 2500,
      interval_days INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `)
}

export { schema }
