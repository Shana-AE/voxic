import { listNasArticles, listCachedImports } from "../../utils/maimemo"
import { probeNas } from "../../utils/nasHealth"

/** GET /api/articles — list all articles (MaiMemo daily stories + cached imports). */
export default defineEventHandler(async (event) => {
  let maimemo: Awaited<ReturnType<typeof listNasArticles>> = []
  const imports = listCachedImports()
  let nasError: string | null = null

  // Guard the synchronous NAS scan: a stale mount would otherwise hang the
  // event loop. Fail fast with a friendly message; imports still return.
  if (await probeNas()) {
    try {
      maimemo = listNasArticles()
    } catch (e) {
      nasError = (e as Error).message
    }
  } else {
    nasError = "NAS not reachable (stale mount?). Remount the NAS and refresh."
  }

  return { maimemo, imports, nasError }
})
