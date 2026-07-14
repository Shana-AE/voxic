import { listMaimemoArticles, listCachedImports } from "../../utils/maimemo"
import { probeNas } from "../../utils/nasHealth"

/** GET /api/articles — list all articles (Obsidian + NAS + cached imports). */
export default defineEventHandler(async () => {
  // Obsidian is local (always scanned); NAS is gated on a health probe so a
  // stale mount can't hang the event loop.
  const nasOk = await probeNas()
  const maimemo = listMaimemoArticles(nasOk)
  const imports = listCachedImports()
  const nasError = nasOk ? null : "NAS unreachable — showing Obsidian articles only."
  return { maimemo, imports, nasError }
})
