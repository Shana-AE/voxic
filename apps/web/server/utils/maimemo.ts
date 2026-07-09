import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { useRuntimeConfig } from "#imports"
import { parseArticle, parseImportedText } from "@voxic/core"
import type { ParsedArticle } from "@voxic/core"
import { useDb, schema } from "../db"
import { eq, desc } from "drizzle-orm"

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

/** Find a daily-story article file on the NAS for a given date (YYYY-MM-DD). */
function findArticleFile(date: string): string | null {
  const root = nasRoot()
  const y = date.slice(0, 4)
  const m = date.slice(5, 7)
  const d = date.slice(8, 10)
  const candidates = [
    join(root, y, m, `${d}-article.md`),
    join(root, y, m, `${d}.md`),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

/** Scan the NAS for all daily-story articles, newest first. */
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
        const path = join(dir, f)
        const { title, forgetCount, vagueCount, familiarCount } = peekMeta(path)
        items.push({ id: date, date, title, source: "maimemo", forgetCount, vagueCount, familiarCount })
      }
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date))
}

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

/** Read the word-status JSON for a date (FORGET/VAGUE/FAMILIAR buckets). */
export function getWordStatus(date: string) {
  const root = nasRoot()
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
