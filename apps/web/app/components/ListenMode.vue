<script setup lang="ts">
import { usePlayerStore } from "~/stores/player"

interface WordCard {
  word: string
  status: string
  cnDef: string | null
  exampleEn: string | null
  exampleZh: string | null
  generated: boolean
}

const props = defineProps<{ cards: WordCard[] }>()

const player = usePlayerStore()
const audio = ref<HTMLAudioElement | null>(null)

const repeat = ref(1)
const fields = reactive({ spelling: true, cnDef: true, exampleEn: true, exampleZh: true })
const currentIndex = ref(-1)
const isPlaying = ref(false)

// English fields use the selected voice; Chinese fields auto-pick a _zh voice.
const zhVoice = computed(() => {
  const cat = player.catalog
  if (!cat) return ""
  return (
    [...cat.voiceList, ...cat.other].find((v) => v.lang === "zh" && v.refOk)?.name ??
    [...cat.voiceList, ...cat.other].find((v) => v.lang === "ja" && v.refOk)?.name ??
    player.voice
  )
})

interface Item { word: string; label: string; text: string; lang: "en" | "zh"; voice: string }

/** Build the sequential playlist from the generated study cards. */
const playlist = computed<Item[]>(() => {
  const scope = props.cards.filter((c) => c.generated && (c.status === "FORGET" || c.status === "VAGUE"))
  const out: Item[] = []
  for (const c of scope) {
    for (let r = 0; r < repeat.value; r++) {
      if (fields.spelling) out.push({ word: c.word, label: "spelling", text: c.word, lang: "en", voice: player.voice })
      if (fields.cnDef && c.cnDef) out.push({ word: c.word, label: "释义", text: c.cnDef, lang: "zh", voice: zhVoice.value })
      if (fields.exampleEn && c.exampleEn) out.push({ word: c.word, label: "example", text: c.exampleEn, lang: "en", voice: player.voice })
      if (fields.exampleZh && c.exampleZh) out.push({ word: c.word, label: "译文", text: c.exampleZh, lang: "zh", voice: zhVoice.value })
    }
  }
  return out
})

const current = computed(() => (currentIndex.value >= 0 ? playlist.value[currentIndex.value] ?? null : null))
const ready = computed(() => playlist.value.length > 0)

function loadItem(i: number) {
  const item = playlist.value[i]
  const el = audio.value
  if (!item || !el) return
  el.src = `/api/tts/say?text=${encodeURIComponent(item.text)}&voice=${encodeURIComponent(item.voice)}&lang=${item.lang}`
  el.playbackRate = player.playbackRate
}

watch(currentIndex, (i) => {
  if (i >= 0) {
    loadItem(i)
    nextTick(() => {
      if (isPlaying.value) audio.value?.play().catch(() => {})
    })
  }
})

function play() {
  if (!ready.value) return
  if (currentIndex.value < 0) currentIndex.value = 0
  else {
    isPlaying.value = true
    audio.value?.play().catch(() => {})
  }
}
function pause() {
  isPlaying.value = false
  audio.value?.pause()
}
function toggle() {
  if (isPlaying.value) pause()
  else play()
}
function next() {
  if (currentIndex.value < playlist.value.length - 1) currentIndex.value++
  else stop()
}
function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}
function stop() {
  isPlaying.value = false
  currentIndex.value = -1
  if (audio.value) audio.value.src = ""
}
function onEnded() {
  if (currentIndex.value < playlist.value.length - 1) next()
  else stop()
}

// Re-sync if settings change while stopped.
watch([repeat, fields], () => {
  if (currentIndex.value < 0) return
  // clamp index, reload current
  if (currentIndex.value >= playlist.value.length) stop()
  else loadItem(currentIndex.value)
})
</script>

<template>
  <section class="listen">
    <div class="listen-head">
      <span class="title">🎧 随身听</span>
      <span v-if="current" class="now">{{ current.word }} · <b>{{ current.label }}</b></span>
      <span v-else-if="ready" class="now muted">{{ playlist.length }} segments queued</span>
      <span v-else class="now muted">generate cards first</span>
    </div>

    <div class="settings">
      <label class="rep">Repeat
        <select v-model.number="repeat" class="sel">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="3">3×</option>
          <option :value="5">5×</option>
        </select>
      </label>
      <label class="tgl" :class="{ on: fields.spelling }"><input v-model="fields.spelling" type="checkbox">spelling</label>
      <label class="tgl" :class="{ on: fields.cnDef }"><input v-model="fields.cnDef" type="checkbox">释义</label>
      <label class="tgl" :class="{ on: fields.exampleEn }"><input v-model="fields.exampleEn" type="checkbox">example</label>
      <label class="tgl" :class="{ on: fields.exampleZh }"><input v-model="fields.exampleZh" type="checkbox">译文</label>
    </div>

    <div class="controls">
      <button class="btn-ghost" :disabled="!ready" @click="prev">⏮</button>
      <button class="play-btn" :disabled="!ready" @click="toggle">{{ isPlaying ? "⏸" : "▶" }}</button>
      <button class="btn-ghost" :disabled="!ready" @click="next">⏭</button>
      <button class="btn-ghost" :disabled="!ready" @click="stop">⏹</button>
      <span v-if="currentIndex >= 0" class="pos">{{ currentIndex + 1 }}/{{ playlist.length }}</span>
    </div>

    <audio ref="audio" preload="auto" @ended="onEnded" />
  </section>
</template>

<style scoped>
.listen {
  position: sticky;
  top: 3.6rem;
  z-index: 20;
  background: var(--bg, #fff);
  border: 1px solid rgba(120, 130, 150, 0.25);
  border-radius: 12px;
  padding: 0.7rem 0.85rem;
  margin-bottom: 1rem;
}
.dark .listen { background: #0e1018; border-color: rgba(255,255,255,0.08); }
.listen-head { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.4rem; }
.title { font-weight: 700; }
.now { font-size: 0.9rem; }
.now.muted { color: #636e80; }
.settings { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.rep { font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem; }
.sel { background: transparent; color: inherit; border: 1px solid rgba(120,130,150,0.4); border-radius: 6px; padding: 0.15rem; font-size: 0.8rem; }
.tgl { font-size: 0.78rem; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid rgba(120,130,150,0.3); cursor: pointer; user-select: none; opacity: 0.6; }
.tgl.on { background: rgba(31,91,224,0.15); border-color: #1f5be0; color: #1f5be0; opacity: 1; }
.tgl input { display: none; }
.controls { display: flex; align-items: center; gap: 0.3rem; }
.play-btn { width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 0; background: #1f5be0; color: #fff; cursor: pointer; }
.play-btn:disabled { opacity: 0.4; }
.btn-ghost { background: transparent; border: 0; color: inherit; font-size: 1rem; cursor: pointer; padding: 0.3rem 0.5rem; }
.btn-ghost:disabled { opacity: 0.3; }
.pos { margin-left: auto; font-size: 0.75rem; color: #636e80; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .settings { gap: 0.35rem; } }
</style>
