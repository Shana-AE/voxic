import { getArticleById, getWordStatus } from "../../utils/maimemo"

/**
 * GET /api/articles/:id — parsed article + (for maimemo) word-status buckets.
 * `id` is a bare date (YYYY-MM-DD), `maimemo:<date>`, or `import:<id>`.
 */
export default defineEventHandler((event) => {
  const id = decodeURIComponent(getRouterParam(event, "id")!)
  const article = getArticleById(id)

  let words: Awaited<ReturnType<typeof getWordStatus>> | null = null
  // Word-status buckets only exist for maimemo articles.
  if (article.source.kind === "maimemo") {
    try {
      words = getWordStatus(article.source.date)
    } catch {
      words = null
    }
  }

  return { article, words }
})
