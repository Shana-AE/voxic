<script setup lang="ts">
import type { ParsedArticle } from "@voxic/core"
import { useReaderStore } from "~/stores/reader"

const emit = defineEmits<{ imported: [article: ParsedArticle] }>()
const reader = useReaderStore()

const text = ref("")
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (!text.value.trim()) return
  loading.value = true
  error.value = null
  try {
    const { article } = await $fetch<{ article: ParsedArticle }>("/api/import", {
      method: "POST",
      body: { text: text.value },
    })
    reader.setArticle(article)
    emit("imported", article)
    text.value = ""
    await navigateTo(`/read/${encodeURIComponent(article.source.kind === "import" ? article.source.id : "")}`)  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="import-panel">
    <h2 class="text-lg font-semibold mb-2">Read any text</h2>
    <p class="text-sm text-ink-500 dark:text-ink-400 mb-3">
      Paste an English article, lyrics, or notes — every word becomes clickable, with TTS playback.
    </p>
    <textarea
      v-model="text"
      class="import-textarea"
      rows="6"
      placeholder="Paste English text here…"
      :disabled="loading"
    />
    <div class="mt-2 flex items-center gap-3">
      <button class="btn-primary" :disabled="loading || !text.trim()" @click="submit">
        {{ loading ? "Loading…" : "Read it" }}
      </button>
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.import-panel {
  background: var(--bg, #fff);
  border: 1px solid rgba(120, 130, 150, 0.2);
  border-radius: 12px;
  padding: 1rem 1.1rem;
}
.dark .import-panel {
  background: #0e1018;
  border-color: rgba(255, 255, 255, 0.08);
}
.import-textarea {
  width: 100%;
  resize: vertical;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid rgba(120, 130, 150, 0.35);
  border-radius: 8px;
  padding: 0.6rem 0.7rem;
  font-size: 0.95rem;
  line-height: 1.6;
}
.import-textarea:focus {
  outline: 2px solid #1f5be0;
  outline-offset: 1px;
}
</style>
