import { getVoiceCatalog } from "../utils/voices"

/** GET /api/voices — grouped voice catalog (voice_list pinned to top). */
export default defineEventHandler(() => {
  try {
    return getVoiceCatalog()
  } catch (e) {
    throw createError({ statusCode: 503, statusMessage: (e as Error).message })
  }
})
