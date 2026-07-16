import { createReadStream } from "node:fs"
import { synthesizeText } from "../../utils/tts"

/**
 * GET /api/tts/say?text=<t>&voice=<v>&lang=<en|zh> — synthesize arbitrary text
 * (word, phrase, or sentence) in EN or ZH. Used by the 随身听 listen mode for
 * each card field. Lone English words are framed for clean output; Chinese and
 * sentences go as-is. Cached on disk, so repeats are instant. Streams the MP3.
 */
export default defineEventHandler(async (event) => {
  const text = (getQuery(event).text as string | undefined)?.trim()
  const voice = (getQuery(event).voice as string | undefined)?.trim()
  const lang = ((getQuery(event).lang as string | undefined) ?? "en").trim() === "zh" ? "zh" : "en"
  if (!text) throw createError({ statusCode: 400, statusMessage: "text is required" })
  if (!voice) throw createError({ statusCode: 400, statusMessage: "voice is required" })
  if (text.length > 500) throw createError({ statusCode: 400, statusMessage: "text too long" })

  const path = await synthesizeText(text, voice, lang)
  setResponseHeader(event, "Content-Type", "audio/mpeg")
  setResponseHeader(event, "Cache-Control", "public, max-age=300, must-revalidate")
  return sendStream(event, createReadStream(path))
})
