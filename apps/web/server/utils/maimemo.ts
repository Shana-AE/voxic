import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { useRuntimeConfig } from "#imports"
import { parseArticle, parseImportedText } from "@voxic/core"
import type { ParsedArticle } from "@voxic/core"
import { useDb, schema } from "../db"
import { eq, desc } from "drizzle-orm"
import { getPgPool } from "./postgres"

/** A lightweight article-listing entry (no body). */
export interface ArticleListItem {
  id: string
  date: string
  title: string
  source: "maimemo" | "import"
  forgetCount?: number
  vagueCount?: number
  familiarCount?: number
}

/** Resolve the NAS maimemo root, throwing a friendly error if not mounted. */
function nasRoot(): string {
  const cfg = useRuntimeConfig()
  if (!existsSync(cfg.maimemoNasRoot)) {
    throw createError({
      statusCode: 503,
      statusMessage: `NAS not mounted at ${cfg.maimemoNasRoot}`,
    })
  }
  return cfg.maimemoNasRoot
}

/** Resolve the Obsidian vault base for MaiMemo articles (env-driven; null if unset). */
function obsidianBase(): string | null {
  const cfg = useRuntimeConfig()
  const p = cfg.obsidianArticlesPath
  return p ? p.replace(/^~(?=$|\/|\\)/, "") : null
}

/** Full path to a date's article inside the Obsidian vault. */
function obsidianArticleFile(date: string): string | null {
  const base = obsidianBase()
  if (!base) return null
  return join(base, date.slice(0, 4), date.slice(5, 7), `MaiMemo Daily Story - ${date}.md`)
}

/** True if the date's article exists locally in the Obsidian vault (no NAS needed). */
export function articleInObsidian(date: string): boolean {
  const f = obsidianArticleFile(date)
  return !!f && existsSync(f)
}

/**
 * Find a daily-story article file for a date (YYYY-MM-DD). Obsidian is checked
 * first (local, reliable — the cron now persists there), then the NAS as a
 * fallback for legacy dates. Returns null if neither has it.
 */
function findArticleFile(date: string): string | null {
  const obs = obsidianArticleFile(date)
  if (obs && existsSync(obs)) return obs

  let root: string
  try {
    root = nasRoot()
  } catch {
    return null
  }
  const y = date.slice(0, 4)
  const m = date.slice(5, 7)
  const d = date.slice(8, 10)
  for (const c of [join(root, y, m, `${d}-article.md`), join(root, y, m, `${d}.md`)]) {
    if (existsSync(c)) return c
  }
  return null
}

/** Scan the NAS for daily-story articles (legacy/parallel source). */
export function listNasArticles(): ArticleListItem[] {
  const root = nasRoot()
  const items: ArticleListItem[] = []
  for (const year of readdirSync(root).filter((d) => /^\d{4}$/.test(d))) {
    const months = readdirSync(join(root, year)).filter((d) => /^\d{2}$/.test(d))
    for (const month of months) {
      const dir = join(root, year, month)
      for (const f of readdirSync(dir)) {
        const m = /^(\d{2})-article\.md$/.exec(f)
        if (!m) continue
        const date = `${year}-${month}-${m[1]}`
        const { title, forgetCount, vagueCount, familiarCount } = peekMeta(join(dir, f))
        items.push({ id: date, date, title, source: "maimemo", forgetCount, vagueCount, familiarCount })
      }
    }
  }
  return items
}

/** Scan the Obsidian vault for daily-story articles (new primary source). */
function listObsidianArticles(): ArticleListItem[] {
  const base = obsidianBase()
  if (!base || !existsSync(base)) return []
  const items: ArticleListItem[] = []
  for (const year of readdirSync(base).filter((d) => /^\d{4}$/.test(d))) {
    const months = readdirSync(join(base, year)).filter((d) => /^\d{2}$/.test(d))
    for (const month of months) {
      const dir = join(base, year, month)
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        continue
      }
      for (const f of entries) {
        const m = /^MaiMemo Daily Story - (\d{4}-\d{2}-\d{2})\.md$/.exec(f)
        if (!m) continue
        const date = m[1]!
        const { title, forgetCount, vagueCount, familiarCount } = peekMeta(join(dir, f))
        items.push({ id: date, date, title, source: "maimemo", forgetCount, vagueCount, familiarCount })
      }
    }
  }
  return items
}

/**
 * List MaiMemo articles from both sources, merged + deduped by date (newest
 * first). Obsidian is always scanned (local); the NAS is only scanned when
 * `scanNas` is true (caller gates this on a probeNas check to avoid hanging on
 * a stale mount).
 */
export function listMaimemoArticles(scanNas: boolean): ArticleListItem[] {
  const now = Date.now()
  // Articles change once daily — cache the list briefly so navigating the UI
  // doesn't re-run the (potentially slow) NAS readdirSync on every request.
  if (_listCache && now - _listCache.at < LIST_CACHE_TTL) {
    return _listCache.items
  }
  const byDate = new Map<string, ArticleListItem>()
  for (const it of listObsidianArticles()) byDate.set(it.date, it)
  if (scanNas) {
    try {
      for (const it of listNasArticles()) {
        if (!byDate.has(it.date)) byDate.set(it.date, it)
      }
    } catch {
      // NAS read failed — keep Obsidian results.
    }
  }
  const items = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
  _listCache = { items, at: now }
  return items
}

const LIST_CACHE_TTL = 5 * 60 * 1000
let _listCache: { items: ArticleListItem[]; at: number } | null = null

/** Read just enough frontmatter for a list entry (no full parse). */
function peekMeta(path: string): Pick<ArticleListItem, "title" | "forgetCount" | "vagueCount" | "familiarCount"> {
  try {
    const text = readFileSync(path, "utf8")
    const titleMatch = /^#\s+(.+)$/m.exec(text)
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)
    const meta: Pick<ArticleListItem, "title" | "forgetCount" | "vagueCount" | "familiarCount"> = {
      title: titleMatch ? titleMatch[1]!.trim() : "Untitled",
    }
    if (fm) {
      const fc = /forget_count:\s*(\d+)/.exec(fm[1]!)
      const vc = /vague_count:\s*(\d+)/.exec(fm[1]!)
      const fic = /familiar_count:\s*(\d+)/.exec(fm[1]!)
      if (fc) meta.forgetCount = Number(fc[1]!)
      if (vc) meta.vagueCount = Number(vc[1]!)
      if (fic) meta.familiarCount = Number(fic[1]!)
    }
    return meta
  } catch {
    return { title: "Untitled" }
  }
}

/** Read + parse an article by date, caching the parsed result in SQLite. */
export function getArticle(date: string): ParsedArticle {
  const db = useDb()
  const id = `maimemo:${date}`
  const cached = db.select().from(schema.articles).where(eq(schema.articles.id, id)).get()
  const file = findArticleFile(date)

  if (cached && file) {
    // Reuse cache unless the source file is newer.
    const mtime = statSync(file).mtimeMs
    if (cached.updatedAt >= mtime) {
      return JSON.parse(cached.parsedJson) as ParsedArticle
    }
  }

  if (!file) {
    throw createError({ statusCode: 404, statusMessage: `No article for ${date}` })
  }

  const markdown = readFileSync(file, "utf8")
  const parsed = parseArticle(markdown, { kind: "maimemo", date })
  const now = Date.now()
  const parsedJson = JSON.stringify(parsed)

  db.insert(schema.articles)
    .values({
      id,
      date,
      title: parsed.meta.title,
      source: "maimemo",
      forgetCount: parsed.meta.forgetCount,
      vagueCount: parsed.meta.vagueCount,
      familiarCount: parsed.meta.familiarCount,
      rawMarkdown: markdown,
      parsedJson,
      createdAt: cached?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.articles.id,
      set: { title: parsed.meta.title, parsedJson, rawMarkdown: markdown, updatedAt: now },
    })
    .run()

  return parsed
}

/**
 * Find the cron-generated article audio on NAS. The maimemo_tts_random cron
 * writes `DD-article_<voice>.mp3` per day. Prefers an `_en` voice; otherwise
 * the most recently modified file. Returns the path + parsed voice name.
 */
export function findArticleMedia(date: string): { path: string; voice: string } | null {
  let root: string
  try {
    root = nasRoot()
  } catch {
    return null
  }
  const y = date.slice(0, 4)
  const m = date.slice(5, 7)
  const d = date.slice(8, 10)
  const dir = join(root, y, m)
  if (!existsSync(dir)) return null
  const candidates = readdirSync(dir).filter(
    (f) => f.startsWith(`${d}-article_`) && f.endsWith(".mp3"),
  )
  if (candidates.length === 0) return null
  const en = candidates.find((f) => f.endsWith("_en.mp3"))
  const chosen = en
    ?? [...candidates].sort(
      (a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs,
    )[0]!
  const voice = chosen.replace(/^\d{2}-article_/, "").replace(/\.mp3$/, "")
  return { path: join(dir, chosen), voice }
}

/** Fetch a cached article by its id (imports + re-reading cached maimemo). */
export function getCachedArticle(id: string): ParsedArticle {
  const db = useDb()
  const row = db.select().from(schema.articles).where(eq(schema.articles.id, id)).get()
  if (!row) throw createError({ statusCode: 404, statusMessage: `Article ${id} not cached` })
  return JSON.parse(row.parsedJson) as ParsedArticle
}

/**
 * Unified accessor: fetch a parsed article by id. A bare date (YYYY-MM-DD) or
 * `maimemo:<date>` resolves against the NAS; `import:<id>` reads from cache.
 */
export function getArticleById(id: string): ParsedArticle {
  if (id.startsWith("import:")) return getCachedArticle(id)
  const date = id.startsWith("maimemo:") ? id.slice("maimemo:".length) : id
  return getArticle(date)
}

/** Shape returned for a day's word-status data (used by the reader summary). */
export interface WordStatusResult {
  date: string
  progress: { finished: number; total: number; studyMin: number }
  buckets: { FORGET: string[]; VAGUE: string[]; FAMILIAR: string[] }
}

/**
 * Read a day's word-status data. Postgres is primary (maimemo.daily_snapshots
 * + daily_items, written by the 03:30 cron); the NAS JSON is a fallback for
 * pre-migration dates (≤ 2026-07-08) or when PG is unavailable.
 */
export async function getWordStatus(date: string): Promise<WordStatusResult | null> {
  const pg = getPgPool()
  if (pg) {
    try {
      const pgResult = await getWordStatusFromPg(pg, date)
      if (pgResult) return pgResult
    } catch (e) {
      console.warn(`[maimemo] PG word-status failed for ${date}, falling back to NAS:`, (e as Error).message)
    }
  }
  return getWordStatusFromNas(date)
}

/** Postgres path: one snapshot row + the day's items grouped by first_response. */
async function getWordStatusFromPg(pg: import("pg").Pool, date: string): Promise<WordStatusResult | null> {
  const snap = await pg.query(
    `SELECT finished_count, target_count, study_time_ms
       FROM maimemo.daily_snapshots
      WHERE study_date = $1
      LIMIT 1`,
    [date],
  )
  if (snap.rowCount === 0 || !snap.rows[0]) return null
  const s = snap.rows[0] as { finished_count: number; target_count: number; study_time_ms: string | number }
  const items = await pg.query(
    `SELECT first_response, spelling
       FROM maimemo.daily_items
      WHERE study_date = $1 AND spelling IS NOT NULL AND spelling <> ''`,
    [date],
  )
  const buckets = { FORGET: [] as string[], VAGUE: [] as string[], FAMILIAR: [] as string[] }
  for (const row of items.rows as Array<{ first_response: string | null; spelling: string }>) {
    const key = (row.first_response ?? "OTHER").toUpperCase() as keyof typeof buckets
    if (key in buckets) buckets[key].push(row.spelling.trim())
  }
  return {
    date,
    progress: {
      finished: s.finished_count,
      total: s.target_count,
      studyMin: Math.floor(Number(s.study_time_ms) / 60000),
    },
    buckets,
  }
}

/** NAS-JSON fallback (pre-migration dates or PG outage). */
function getWordStatusFromNas(date: string): WordStatusResult | null {
  let root: string
  try {
    root = nasRoot()
  } catch {
    return null
  }
  const y = date.slice(0, 4)
  const m = date.slice(5, 7)
  const d = date.slice(8, 10)
  const path = join(root, y, m, `${d}.json`)
  if (!existsSync(path)) return null
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    date: string
    progress: { finished: number; total: number; study_time: number }
    items: Array<{ voc_spelling: string; first_response: string; is_new: boolean }>
  }
  const buckets = { FORGET: [] as string[], VAGUE: [] as string[], FAMILIAR: [] as string[] }
  for (const it of data.items) {
    const sp = (it.voc_spelling || "").trim()
    if (!sp) continue
    ;(buckets[it.first_response as keyof typeof buckets] ?? (buckets.FORGET as string[])).push(sp)
  }
  return {
    date,
    progress: {
      finished: data.progress.finished,
      total: data.progress.total,
      studyMin: Math.floor(data.progress.study_time / 60000),
    },
    buckets,
  }
}

/** Parse arbitrary pasted text and cache it under a synthetic id. */
export function cacheImportedText(text: string): ParsedArticle {
  const db = useDb()
  const id = `import:${Date.now().toString(36)}`
  const parsed = parseImportedText(text, id)
  const now = Date.now()
  db.insert(schema.articles)
    .values({
      id,
      date: parsed.meta.date,
      title: parsed.meta.title,
      source: "import",
      rawMarkdown: text,
      parsedJson: JSON.stringify(parsed),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return parsed
}

/** List cached import articles (newest first). */
export function listCachedImports(): ArticleListItem[] {
  const db = useDb()
  const rows = db.select().from(schema.articles).where(eq(schema.articles.source, "import")).orderBy(desc(schema.articles.createdAt)).all()
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    source: "import" as const,
    forgetCount: r.forgetCount ?? undefined,
    vagueCount: r.vagueCount ?? undefined,
    familiarCount: r.familiarCount ?? undefined,
  }))
}
