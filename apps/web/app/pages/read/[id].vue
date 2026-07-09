<script setup lang="ts">
import { useReaderStore } from "~/stores/reader"

const route = useRoute()
const reader = useReaderStore()

const id = computed(() => decodeURIComponent(route.params.id as string))

// If the store already holds this article (e.g. just imported), use it;
// otherwise fetch from the server.
await useAsyncData(`article:${id.value}`, async () => {
  const storeArticle = reader.article
  const storeId =
    storeArticle?.source.kind === "import"
      ? storeArticle.source.id
      : storeArticle?.source.kind === "maimemo"
        ? storeArticle.source.date
        : null
  if (storeArticle && storeId === id.value) return storeArticle
  await reader.loadArticle(id.value)
  return reader.article
})

useHead(() => ({
  title: reader.article ? reader.article.meta.title : "Reading",
}))
</script>

<template>
  <div class="reader-page">
    <p v-if="reader.loading" class="mx-auto max-w-prose px-4 py-10 text-ink-400">Loading…</p>
    <p v-else-if="reader.error" class="mx-auto max-w-prose px-4 py-10 text-red-500">
      ⚠ {{ reader.error }}
    </p>
    <ReaderView v-else-if="reader.article" :article="reader.article" />
    <p v-else class="mx-auto max-w-prose px-4 py-10 text-ink-400">No article.</p>
  </div>
</template>
