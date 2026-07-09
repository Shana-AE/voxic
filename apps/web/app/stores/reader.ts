import { defineStore } from "pinia"
import type { ParsedArticle } from "@voxic/core"

interface WordStatusResult {
  date: string
  progress: { finished: number; total: number; studyMin: number }
  buckets: { FORGET: string[]; VAGUE: string[]; FAMILIAR: string[] }
}

export const useReaderStore = defineStore("reader", () => {
  const article = ref<ParsedArticle | null>(null)
  const words = ref<WordStatusResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Build the plain-English text to send to TTS (all parts concatenated). */
  const ttsText = computed(() => {
    if (!article.value) return ""
    return article.value.parts
      .flatMap((p) => p.paragraphs.map((para) => para.text))
      .join("\n")
      .trim()
  })

  async function loadArticle(id: string) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ article: ParsedArticle; words: WordStatusResult | null }>(
        `/api/articles/${encodeURIComponent(id)}`,
      )
      article.value = data.article
      words.value = data.words
    } catch (e) {
      error.value = (e as Error).message
      article.value = null
      words.value = null
    } finally {
      loading.value = false
    }
  }

  function setArticle(parsed: ParsedArticle) {
    article.value = parsed
    words.value = null
  }

  return { article, words, loading, error, ttsText, loadArticle, setArticle }
})
