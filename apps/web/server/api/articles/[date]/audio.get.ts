import { existsSync, createReadStream, statSync } from "node:fs"
import { findArticleMedia } from "../../../utils/maimemo"

/** GET /api/articles/:date/audio — stream the cron-generated article MP3. */
export default defineEventHandler((event) => {
  const date = getRouterParam(event, "date")!
  const media = findArticleMedia(date)
  if (!media || !existsSync(media.path)) {
    throw createError({ statusCode: 404, statusMessage: `No audio for ${date}` })
  }
  const size = statSync(media.path).size
  setResponseHeader(event, "Content-Type", "audio/mpeg")
  setResponseHeader(event, "Content-Length", size)
  setResponseHeader(event, "Cache-Control", "public, max-age=3600")
  return sendStream(event, createReadStream(media.path))
})
