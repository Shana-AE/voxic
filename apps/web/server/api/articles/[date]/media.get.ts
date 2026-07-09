import { findArticleMedia } from "../../../utils/maimemo"

/**
 * GET /api/articles/:date/media — metadata for the cron-generated article MP3.
 * Returns { found, voice, audioUrl } so the client can stream via /audio.
 */
export default defineEventHandler((event) => {
  const date = getRouterParam(event, "date")!
  const media = findArticleMedia(date)
  if (!media) {
    return { found: false, voice: null, audioUrl: null }
  }
  return {
    found: true,
    voice: media.voice,
    audioUrl: `/api/articles/${encodeURIComponent(date)}/audio`,
  }
})
