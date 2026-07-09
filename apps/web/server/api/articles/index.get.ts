import { listNasArticles, listCachedImports } from "../../utils/maimemo"

/** GET /api/articles — list all articles (MaiMemo daily stories + cached imports). */
export default defineEventHandler((event) => {
  let maimemo: Awaited<ReturnType<typeof listNasArticles>> = []
  let imports = listCachedImports()
  let nasError: string | null = null

  try {
    maimemo = listNasArticles()
  } catch (e) {
    // NAS may be unmounted; still return imports + the error for the UI.
    nasError = (e as Error).message
  }

  return { maimemo, imports, nasError }
})
