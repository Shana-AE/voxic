import { ensureCards } from "../../../utils/cards"
import type { WordStatus } from "../../../utils/cards"

/**
 * POST /api/words/:date/generate — generate + cache AI fields for the date's
 * forget/vague words. Body optional: { statuses?, concurrency?, limit? }.
 * `limit` caps how many are generated this call (batched UI). Cached per word
 * forever, so each word is generated only once.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, "date")!
  const body = (await readBody<{ statuses?: WordStatus[]; concurrency?: number; limit?: number }>(
    event,
  ).catch(() => ({}) as { statuses?: WordStatus[]; concurrency?: number; limit?: number })) as {
    statuses?: WordStatus[]
    concurrency?: number
    limit?: number
  }
  const statuses: WordStatus[] = body.statuses?.length ? body.statuses : ["FORGET", "VAGUE"]
  const concurrency = body.concurrency ?? 4
  const limit = body.limit
  const result = await ensureCards(date, statuses, concurrency, limit)
  return { date, ...result }
})
