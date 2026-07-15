<script setup lang="ts">
interface WordCard {
  word: string
  status: string
  phonetic: string | null
  cnDef: string | null
  exampleEn: string | null
  exampleZh: string | null
  generated: boolean
}

const route = useRoute()
const date = computed(() => route.params.date as string)

const { data, pending, refresh } = await useFetch<{
  date: string
  progress: { finished: number; total: number; studyMin: number } | null
  cards: WordCard[]
  generated: number
  total: number
}>(() => `/api/words/${date.value}`)

const generating = ref(false)
const genResult = ref<string | null>(null)
const BATCH = 40

async function generate() {
  generating.value = true
  genResult.value = null
  try {
    const res = await $fetch<{ generated: number; remaining: number }>(
      `/api/words/${date.value}/generate`,
      { method: "POST", body: { limit: BATCH }, timeout: 300_000 },
    )
    genResult.value =
      res.generated === 0
        ? `All caught up (${res.remaining} remaining).`
        : `Generated ${res.generated}. ${res.remaining} left — click again for more.`
    await refresh()
  } catch (e) {
    genResult.value = `Failed: ${(e as Error).message}`
  } finally {
    generating.value = false
  }
}

function labelFor(status: string): string {
  if (status === "FORGET") return "🗑️ forgot"
  if (status === "VAGUE") return "🌀 vague"
  if (status === "FAMILIAR") return "✅ ok"
  return status.toLowerCase().replace(/_/g, " ")
}
function classFor(status: string): string {
  if (status === "FORGET") return "st-forget"
  if (status === "VAGUE") return "st-vague"
  if (status === "FAMILIAR") return "st-familiar"
  return "st-other"
}

// English word pronunciation (real-time, cached).
function pronounce(word: string, e: MouseEvent) {
  const player = usePlayerStore()
  const audio = new Audio(
    `/api/tts/word?word=${encodeURIComponent(word)}&voice=${encodeURIComponent(player.voice)}`,
  )
  audio.playbackRate = player.playbackRate
  audio.play().catch(() => {})
  ;(e.currentTarget as HTMLElement).classList.add("played")
}

const forgetVague = computed(() => (data.value?.cards ?? []).filter((c) => c.status === "FORGET" || c.status === "VAGUE"))
const ungeneratedCount = computed(() => forgetVague.value.filter((c) => !c.generated).length)
</script>

<template>
  <div class="words-page mx-auto max-w-4xl px-4 py-6">
    <header class="mb-5">
      <NuxtLink to="/" class="back">← Articles</NuxtLink>
      <h1 class="text-2xl font-bold mt-1">Word cards · {{ date }}</h1>
      <p v-if="data?.progress" class="text-sm text-ink-500 dark:text-ink-400 mt-1">
        {{ data.progress.finished }}/{{ data.progress.total }} studied · {{ data.progress.studyMin }} min ·
        {{ data.generated }}/{{ data.total }} cards generated
      </p>
      <div class="flex items-center gap-3 mt-3">
        <button class="btn-primary" :disabled="generating" @click="generate">
          {{ generating ? "Generating…" : `Generate cards (${ungeneratedCount} left)` }}
        </button>
        <NuxtLink v-if="date" :to="`/read/${date}`" class="btn-ghost text-sm">Read article →</NuxtLink>
        <span v-if="genResult" class="text-sm text-ink-500">{{ genResult }}</span>
      </div>
    </header>

    <p v-if="pending" class="text-ink-400">Loading…</p>
    <p v-else-if="!data?.cards.length" class="text-ink-400">
      No word data for {{ date }} (the MaiMemo day may not be closed yet — try after 04:00).
    </p>

    <template v-else>
      <ListenMode :cards="data.cards" :date="date" />

      <div class="card-grid">
      <article
        v-for="c in data.cards"
        :key="c.word"
        class="card"
        :class="classFor(c.status)"
      >
        <div class="card-head">
          <button class="card-word" :title="`Pronounce ${c.word}`" @click="pronounce(c.word, $event)">{{ c.word }}</button>
          <span class="status">{{ labelFor(c.status) }}</span>
        </div>
        <div v-if="c.phonetic" class="phon">/{{ c.phonetic }}/</div>
        <div v-if="c.cnDef" class="cn">{{ c.cnDef }}</div>
        <div v-if="c.exampleEn" class="ex-en">{{ c.exampleEn }}</div>
        <div v-if="c.exampleZh" class="ex-zh">{{ c.exampleZh }}</div>
        <div v-if="!c.generated" class="ungenerated">— not generated —</div>
      </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back {
  text-decoration: none;
  font-size: 0.85rem;
  color: #1f5be0;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.75rem;
}
.card {
  background: var(--bg, #fff);
  border: 1px solid rgba(120, 130, 150, 0.25);
  border-left: 4px solid #aeb6c2;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
}
.dark .card {
  background: #0e1018;
  border-color: rgba(255, 255, 255, 0.08);
}
.card.st-forget { border-left-color: #d64545; }
.card.st-vague { border-left-color: #b8860b; }
.card.st-familiar { border-left-color: #3a9b3a; opacity: 0.7; }
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.card-word {
  font-size: 1.1rem;
  font-weight: 700;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.card-word:hover { text-decoration: underline; }
.status {
  font-size: 0.68rem;
  white-space: nowrap;
  color: #636e80;
}
.phon {
  font-size: 0.82rem;
  color: #636e80;
  margin: 0.1rem 0 0.35rem;
}
.cn {
  font-size: 0.92rem;
  margin-bottom: 0.35rem;
}
.ex-en {
  font-size: 0.85rem;
  font-style: italic;
  color: var(--fg);
}
.ex-zh {
  font-size: 0.8rem;
  color: #636e80;
  margin-top: 0.15rem;
}
.ungenerated {
  font-size: 0.75rem;
  color: #aeb6c2;
}
.card-word.played { color: #1f5be0; }
</style>
