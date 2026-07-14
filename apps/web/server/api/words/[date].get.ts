import { getCards } from "../../utils/cards"
import { getWordStatus } from "../../utils/maimemo"

/** GET /api/words/:date — the day's word cards (PG words + cached AI fields) + progress. */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, "date")!
  const { cards } = await getCards(date)
  let progress = null
  try {
    const w = await getWordStatus(date)
    progress = w?.progress ?? null
  } catch {
    // ignore — cards still return
  }
  const generated = cards.filter((c) => c.generated).length
  return { date, progress, cards, generated, total: cards.length }
})
