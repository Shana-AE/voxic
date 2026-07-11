import { getVoiceCatalog } from "../utils/voices"
import { probeNas } from "../utils/nasHealth"

/** GET /api/voices — grouped voice catalog (voice_list pinned to top). */
export default defineEventHandler(async () => {
  if (!(await probeNas())) {
    throw createError({
      statusCode: 503,
      statusMessage: "NAS not reachable (stale mount?). voice_rotation.json is on the NAS.",
    })
  }
  try {
    return getVoiceCatalog()
  } catch (e) {
    throw createError({ statusCode: 503, statusMessage: (e as Error).message })
  }
})
