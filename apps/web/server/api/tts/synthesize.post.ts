import { synthesizeFull } from "../../utils/tts"

/**
 * POST /api/tts/synthesize { text, voice } — synthesize a text block into a
 * single MP3 (for imported text with no cron media). Returns { audioUrl }.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ text: string; voice: string }>(event)
  if (!body?.text?.trim()) throw createError({ statusCode: 400, statusMessage: "text is required" })
  if (!body?.voice) throw createError({ statusCode: 400, statusMessage: "voice is required" })
  const path = await synthesizeFull(body.text, body.voice)
  const key = path.split("/").pop()!.replace(/\.mp3$/, "")
  return { audioUrl: `/api/tts/audio/${key}.mp3`, voice: body.voice }
})
