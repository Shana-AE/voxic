import { getPgPool } from "./postgres"
import { useDb, schema } from "../db"
import { generateCardFields } from "./ai"
import { eq } from "drizzle-orm"
import type { WordStatusResult } from "./maimemo"

/** A word's status from MaiMemo (FORGET/VAGUE/FAMILIAR, occasionally other). */
export type WordStatus = "FORGET" | "VAGUE" | "FAMILIAR" | string

export interface WordCard {
  word: string
  status: WordStatus
  phonetic: string | null
  cnDef: string | null
  exampleEn: string | null
  exampleZh: string | null
  /** True once AI fields have been generated+cached. */
  generated: boolean
}

/** Read a date's words + statuses from Postgres (primary word source). Retries once on connection drop. */
export async function getDateWords(date: string): Promise<{ word: string; status: WordStatus }[]> {
  const pg = getPgPool()
  if (!pg) return []
  const query = () =>
    pg!.query<{ spelling: string; first_response: string | null }>(
      `SELECT spelling, first_response
       FROM maimemo.daily_items
      WHERE study_date = $1 AND spelling IS NOT NULL AND spelling <> ''`,
      [date],
    )
  let res
  try {
    res = await query()
  } catch (e) {
    // NAS/WiFi connection drops — retry once.
    console.warn(`[cards] PG query failed, retrying: ${(e as Error).message}`)
    res = await query()
  }
  return res.rows
    .map((r) => ({ word: r.spelling.trim(), status: (r.first_response ?? "FAMILIAR") as WordStatus }))
    .filter((r) => r.word.length > 0)
}

/** All cards for a date: PG words joined with cached AI fields (if generated). */
export async function getCards(date: string): Promise<{ progress: WordStatusResult["progress"] | null; cards: WordCard[] }> {
  const db = useDb()
  const words = await getDateWords(date)
  const cards: WordCard[] = []
  for (const { word, status } of words) {
    const cached = db.select().from(schema.wordCards).where(eq(schema.wordCards.word, word)).get()
    cards.push({
      word,
      status,
      phonetic: cached?.phonetic ?? null,
      cnDef: cached?.cnDef ?? null,
      exampleEn: cached?.exampleEn ?? null,
      exampleZh: cached?.exampleZh ?? null,
      generated: !!cached,
    })
  }
  return { progress: null, cards }
}

/**
 * Generate + cache AI fields for words that are missing them. By default only
 * FORGET/VAGUE words (the ones worth studying); pass statuses to override.
 * Runs with limited concurrency to be gentle on the gateway.
 */
export async function ensureCards(
  date: string,
  statuses: WordStatus[] = ["FORGET", "VAGUE"],
  concurrency = 4,
  limit?: number,
): Promise<{ generated: number; alreadyCached: number; total: number; remaining: number }> {
  const db = useDb()
  const { cards } = await getCards(date)
  let todo = cards.filter((c) => statuses.includes(c.status) && !c.generated)
  const remaining = todo.length
  if (typeof limit === "number" && limit > 0) todo = todo.slice(0, limit)
  if (todo.length === 0) {
    const inScope = cards.filter((c) => statuses.includes(c.status))
    return { generated: 0, alreadyCached: inScope.filter((c) => c.generated).length, total: cards.length, remaining: 0 }
  }

  let generated = 0
  let cursor = 0
  async function worker() {
    while (cursor < todo.length) {
      const i = cursor++
      const card = todo[i]!
      const fields = await generateCardFields(card.word)
      db.insert(schema.wordCards)
        .values({
          word: card.word,
          phonetic: fields.phonetic,
          cnDef: fields.cnDef,
          exampleEn: fields.exampleEn,
          exampleZh: fields.exampleZh,
          generatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: schema.wordCards.word,
          set: {
            phonetic: fields.phonetic,
            cnDef: fields.cnDef,
            exampleEn: fields.exampleEn,
            exampleZh: fields.exampleZh,
            generatedAt: Date.now(),
          },
        })
        .run()
      generated++
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()))
  return { generated, alreadyCached: 0, total: cards.length, remaining: remaining - generated }
}

/** Mark these words' cards as needing regeneration (deletes the cache). */
export function invalidateCards(words: string[]): void {
  const db = useDb()
  for (const w of words) {
    db.delete(schema.wordCards).where(eq(schema.wordCards.word, w)).run()
  }
}
