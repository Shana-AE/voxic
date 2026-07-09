import { getEudicToken } from "../../utils/config"

/** POST /api/eudic/word { word, star?, contextLine? } — save a word to Eudic. */
export default defineEventHandler(async (event) => {
  const token = getEudicToken()
  if (!token) {
    throw createError({ statusCode: 503, statusMessage: "EUDIC_TOKEN not configured" })
  }
  const body = await readBody<{ word: string; star?: number; contextLine?: string }>(event)
  if (!body?.word) throw createError({ statusCode: 400, statusMessage: "word is required" })

  const res = await $fetch<{
    word?: string
    message?: string
  }>("https://api.frdic.com/api/open/v1/studylist/word", {
    method: "POST",
    headers: { Authorization: token, "User-Agent": "Mozilla/5.0", "Content-Type": "application/json" },
    body: {
      language: "en",
      word: body.word,
      star: body.star ?? 0,
      context_line: body.contextLine ?? "",
      category_ids: [],
    },
  })
  return { ok: true, result: res }
})
