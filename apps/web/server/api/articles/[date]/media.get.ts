import { findArticleMedia } from "../../../utils/maimemo"
import { probeNas } from "../../../utils/nasHealth"

/**
 * GET /api/articles/:date/media — metadata for the cron-generated article MP3.
 * Returns { found, voice, audioUrl } so the client can stream via /audio.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, "date")!
  if (!(await probeNas())) {
    return { found: false, voice: null, audioUrl: null }
  }
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
