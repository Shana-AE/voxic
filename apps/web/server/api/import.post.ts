import { cacheImportedText } from "../utils/maimemo"

/** POST /api/import { text } — parse + cache arbitrary English text. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ text?: string }>(event)
  const text = (body?.text ?? "").trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: "text is required" })
  if (text.length > 50_000) {
    throw createError({ statusCode: 413, statusMessage: "text too long (max 50000 chars)" })
  }
  const article = cacheImportedText(text)
  return { article }
})
