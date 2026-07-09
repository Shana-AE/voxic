import { createReadStream } from "node:fs"
import { synthesizeWord } from "../../utils/tts"

/**
 * GET /api/tts/word?word=<w>&voice=<v> — real-time per-word pronunciation.
 * Frames single words ("word. word.") + low-randomness params to avoid the
 * "emmm" artifacts GPT-SoVITS produces on lone short inputs. Cached, so the
 * first click synthesizes (~1s) and repeats are instant. Streams the MP3.
 */
export default defineEventHandler(async (event) => {
  const word = (getQuery(event).word as string | undefined)?.trim()
  const voice = (getQuery(event).voice as string | undefined)?.trim()
  if (!word) throw createError({ statusCode: 400, statusMessage: "word is required" })
  if (!voice) throw createError({ statusCode: 400, statusMessage: "voice is required" })
  if (word.length > 200) throw createError({ statusCode: 400, statusMessage: "text too long" })

  const path = await synthesizeWord(word, voice)
  setResponseHeader(event, "Content-Type", "audio/mpeg")
  setResponseHeader(event, "Cache-Control", "public, max-age=86400, immutable")
  return sendStream(event, createReadStream(path))
})

