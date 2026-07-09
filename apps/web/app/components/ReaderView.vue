<script setup lang="ts">
import type { ParsedArticle, WordNote } from "@voxic/core"
import { useReaderStore } from "~/stores/reader"
import { usePlayerStore } from "~/stores/player"

const props = defineProps<{ article: ParsedArticle }>()
const reader = useReaderStore()
const player = usePlayerStore()

const active = ref<{ word: string; note: WordNote | null; x: number; y: number } | null>(null)

function onWordClick(payload: { word: string; note: WordNote | null; x: number; y: number }) {
  active.value = payload
}

const showTranslation = ref<Record<number, boolean>>({})
function toggleTranslation(idx: number) {
  showTranslation.value[idx] = !showTranslation.value[idx]
}

async function playAll() {
  // MaiMemo articles stream the cron-generated MP3 (instant); imports synthesize.
  if (props.article.source.kind === "maimemo") {
    await player.playArticle(props.article.source.date)
  } else if (reader.ttsText) {
    await player.playText(reader.ttsText)
  }
}
</script>

<template>
  <article class="prose-reading mx-auto max-w-prose px-4 py-6">
    <!-- Summary card -->
    <header class="mb-6 not-prose">
      <h1 class="text-2xl font-bold mb-1">{{ article.meta.title }}</h1>
      <div class="flex flex-wrap gap-2 text-sm text-ink-500 dark:text-ink-300">
        <span class="chip bg-ink-100 dark:bg-ink-800">{{ article.source.kind === "maimemo" ? article.source.date : "imported" }}</span>
        <span v-if="article.meta.forgetCount !== undefined" class="chip" style="background:#fde2e2;color:#b91c1c">
          🗑️ {{ article.meta.forgetCount }} forgot
        </span>
        <span v-if="article.meta.vagueCount !== undefined" class="chip" style="background:#fef3c7;color:#92400e">
          🌀 {{ article.meta.vagueCount }} vague
        </span>
        <span v-if="reader.words" class="chip bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {{ reader.words.progress.finished }}/{{ reader.words.progress.total }} · {{ reader.words.progress.studyMin }}min
        </span>
      </div>
      <button class="btn-primary mt-3" :disabled="player.isLoading" @click="playAll">
        <span v-if="player.isLoading">Synthesizing…</span>
        <span v-else>▶ Play article</span>
      </button>
      <p v-if="player.error" class="mt-2 text-sm text-red-500">{{ player.error }}</p>
    </header>

    <!-- Parts -->
    <section v-for="(part, pi) in article.parts" :key="pi" class="mb-8">
      <h2 class="text-xl font-semibold mb-3">{{ part.title }}</h2>

      <InteractiveParagraph
        v-for="(para, idx) in part.paragraphs"
        :key="idx"
        :paragraph="para"
        :note-index="article.noteIndex"
        @word-click="onWordClick"
      />

      <details v-if="part.translation" class="mt-3">
        <summary class="cursor-pointer text-sm text-brand-600 dark:text-brand-300" @click.prevent="toggleTranslation(pi)">
          {{ showTranslation[pi] ? "Hide" : "Show" }} 中文翻译
        </summary>
        <p v-if="showTranslation[pi]" class="mt-2 text-ink-600 dark:text-ink-300 leading-relaxed">{{ part.translation }}</p>
      </details>
    </section>

    <!-- Floating definition panel -->
    <DefinitionPanel
      v-if="active"
      :word="active.word"
      :note="active.note"
      :x="active.x"
      :y="active.y"
      @close="active = null"
    />
  </article>
</template>
