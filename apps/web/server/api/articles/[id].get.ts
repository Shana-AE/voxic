import { getArticleById, getWordStatus } from "../../utils/maimemo"
import { probeNas } from "../../utils/nasHealth"

/**
 * GET /api/articles/:id — parsed article + (for maimemo) word-status buckets.
 * `id` is a bare date (YYYY-MM-DD), `maimemo:<date>`, or `import:<id>`.
 */
export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(getRouterParam(event, "id")!)
  const isMaimemo = !id.startsWith("import:")

  // MaiMemo articles live on the NAS — guard against a stale mount so a hung
  // readdirSync can't freeze the event loop. Imports come from SQLite (no NAS).
  if (isMaimemo && !(await probeNas())) {
    throw createError({
      statusCode: 503,
      statusMessage: "NAS not reachable (stale mount?). Remount the NAS and retry.",
    })
  }

  const article = getArticleById(id)

  let words: Awaited<ReturnType<typeof getWordStatus>> | null = null
  // Word-status buckets only exist for maimemo articles. Postgres primary,
  // NAS-JSON fallback — never let a data-source hiccup break article loading.
  if (article.source.kind === "maimemo") {
    try {
      words = await getWordStatus(article.source.date)
    } catch (e) {
      console.warn(`[articles] word-status failed for ${id}:`, (e as Error).message)
      words = null
    }
  }

  return { article, words }
})
