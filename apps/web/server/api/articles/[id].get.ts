import { getArticleById, getWordStatus, articleInObsidian } from "../../utils/maimemo"
import { probeNas } from "../../utils/nasHealth"

/**
 * GET /api/articles/:id — parsed article + (for maimemo) word-status buckets.
 * `id` is a bare date (YYYY-MM-DD), `maimemo:<date>`, or `import:<id>`.
 */
export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(getRouterParam(event, "id")!)
  const isMaimemo = !id.startsWith("import:")
  const date = id.startsWith("maimemo:") ? id.slice("maimemo:".length) : id

  // Articles in the Obsidian vault are local — serve without the NAS. Only gate
  // on a NAS probe when the article isn't local (legacy dates live on the NAS),
  // so a stale mount can't block reading recent articles.
  if (isMaimemo && !articleInObsidian(date) && !(await probeNas())) {
    throw createError({
      statusCode: 503,
      statusMessage: "NAS not reachable (stale mount?). Remount the NAS and retry.",
    })
  }

  const article = getArticleById(id)

  let words: Awaited<ReturnType<typeof getWordStatus>> | null = null
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
