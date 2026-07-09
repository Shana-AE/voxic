<script setup lang="ts">
import type { WordNote, DictEntry } from "@voxic/core"
import { usePlayerStore } from "~/stores/player"
import { useElementSize } from "@vueuse/core"

const props = defineProps<{
  word: string
  note?: WordNote | null
  x: number
  y: number
}>()
const emit = defineEmits<{ close: []; "save-eudic": [word: string] }>()
const player = usePlayerStore()

const entry = ref<DictEntry | null>(null)
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)

// Real-time word pronunciation (short text = fast; cached on the server).
const pronounceEl = ref<HTMLAudioElement | null>(null)
const pronLoading = ref(false)
async function pronounce() {
  if (!player.voice) await player.loadCatalog()
  if (!player.voice || !pronounceEl.value) return
  pronLoading.value = true
  pronounceEl.value.src = `/api/tts/word?word=${encodeURIComponent(props.word)}&voice=${encodeURIComponent(player.voice)}`
  pronounceEl.value.playbackRate = player.playbackRate
  try {
    await pronounceEl.value.play()
  } catch {
    /* autoplay may block until interaction; ignore */
  } finally {
    pronLoading.value = false
  }
}

async function fetchDef() {
  loading.value = true
  try {
    const noteParam = props.note
      ? encodeURIComponent(JSON.stringify({ word: props.note.word, meaning: props.note.meaning, phonetic: props.note.phonetic }))
      : undefined
    entry.value = await $fetch<DictEntry>(
      `/api/dict/${encodeURIComponent(props.word)}`,
      noteParam ? { query: { note: noteParam } } : {},
    )
  } catch {
    entry.value = { word: props.word, source: "none" }
  } finally {
    loading.value = false
  }
}

async function saveToEudic() {
  saving.value = true
  try {
    await $fetch("/api/eudic/word", {
      method: "POST",
      body: { word: props.word },
    })
    saved.value = true
    emit("save-eudic", props.word)
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

// Position: clamp into the viewport using the panel's MEASURED size (the
// content height varies; a static estimate overflows near edges). Measure the
// rendered element reactively; fall back to an estimate before first paint.
const panelEl = ref<HTMLElement | null>(null)
const { height: measuredH } = useElementSize(panelEl)

const panelStyle = computed(() => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const w = Math.min(320, vw - 16)
  const h = measuredH.value || 260
  let left = props.x - w / 2
  left = Math.max(8, Math.min(left, vw - w - 8))
  let top = props.y + 24
  if (top + h > vh - 8) top = Math.max(8, props.y - h - 24) // flip above
  if (top + h > vh - 8) top = 8 // neither fits → pin to top, scroll inside
  return { left: `${left}px`, top: `${top}px`, width: `${w}px` }
})

onMounted(fetchDef)
watch(() => props.word, fetchDef)

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}
onMounted(() => window.addEventListener("keydown", onKey))
onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
</script>

<template>
  <div class="def-overlay" @click="$emit('close')">
    <div ref="panelEl" class="def-panel" :style="panelStyle" @click.stop>
      <div class="def-header">
        <span class="def-word">{{ word }}</span>
        <span v-if="entry?.phonetic || note?.phonetic" class="def-phon">
          /{{ entry?.phonetic || note?.phonetic }}/
        </span>
        <button class="pron-btn" :disabled="pronLoading || !player.voice" title="Pronounce" @click="pronounce">
          {{ pronLoading ? "…" : "🔊" }}
        </button>
        <button class="def-close" aria-label="Close" @click="$emit('close')">×</button>
      </div>
      <audio ref="pronounceEl" preload="none" />

      <div v-if="note" class="def-note">
        <p v-if="note.meaning" class="def-meaning">{{ note.meaning }}</p>
        <p v-if="note.usage" class="def-usage"><b>Usage:</b> {{ note.usage }}</p>
        <p v-if="note.example" class="def-example">{{ note.example }}</p>
        <p v-if="note.collocation" class="def-coll"><b>Collocation:</b> {{ note.collocation }}</p>
        <p v-if="note.memoryTip" class="def-tip">💡 {{ note.memoryTip }}</p>
      </div>

      <div v-if="loading" class="word-popover-skeleton">Loading…</div>
      <div v-else-if="entry && entry.source !== 'none'" class="def-dict">
        <p v-if="entry.exp && !note" class="def-meaning">{{ entry.exp }}</p>
        <ul v-if="entry.definitions?.length" class="def-defs">
          <li v-for="(d, i) in entry.definitions.slice(0, 4)" :key="i">
            <span v-if="d.partOfSpeech" class="def-pos">{{ d.partOfSpeech }}</span>
            {{ d.text }}
          </li>
        </ul>
        <audio v-if="entry.audio" :src="entry.audio" controls class="def-audio" />
      </div>
      <p v-else class="def-none">No definition found.</p>

      <div class="def-actions">
        <span v-if="entry?.saved" class="chip bg-ink-100 dark:bg-ink-800">★ saved in Eudic</span>
        <button
          v-else
          class="btn-primary btn-sm"
          :disabled="saving || saved"
          @click="saveToEudic"
        >
          {{ saved ? "Saved ✓" : saving ? "Saving…" : "Save to Eudic" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.def-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  /* transparent so the word stays visible; click anywhere closes */
  background: transparent;
}
.def-panel {
  position: fixed;
  z-index: 51;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--bg, #fff);
  color: var(--fg, #1a1d24);
  border: 1px solid rgba(120, 130, 150, 0.3);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  padding: 0.85rem 0.95rem;
}
.dark .def-panel {
  background: #12141c;
  border-color: rgba(255, 255, 255, 0.1);
}
.def-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.def-word {
  font-size: 1.15rem;
  font-weight: 700;
}
.def-phon {
  color: #636e80;
  font-size: 0.9rem;
}
.def-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  color: inherit;
}
.pron-btn {
  border: 0;
  background: rgba(31, 91, 224, 0.12);
  border-radius: 6px;
  width: 1.7rem;
  height: 1.7rem;
  font-size: 0.95rem;
  cursor: pointer;
  line-height: 1;
}
.pron-btn:hover {
  background: rgba(31, 91, 224, 0.22);
}
.pron-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.def-note p,
.def-dict p {
  margin: 0.25rem 0;
  font-size: 0.92rem;
}
.def-meaning {
  font-weight: 600;
}
.def-example {
  font-style: italic;
  color: #4e5767;
}
.dark .def-example {
  color: #aeb6c2;
}
.def-defs {
  list-style: none;
  padding: 0;
  margin: 0.3rem 0;
}
.def-defs li {
  font-size: 0.88rem;
  margin: 0.2rem 0;
}
.def-pos {
  font-style: italic;
  color: #1f5be0;
  margin-right: 0.4rem;
}
.dark .def-pos {
  color: #599dff;
}
.def-audio {
  width: 100%;
  height: 32px;
  margin-top: 0.3rem;
}
.def-actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
}
.btn-sm {
  font-size: 0.8rem;
  padding: 0.3rem 0.7rem;
}
</style>
