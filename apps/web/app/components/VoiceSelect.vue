<script setup lang="ts">
import { usePlayerStore } from "~/stores/player"
import { useStorage, onClickOutside } from "@vueuse/core"
import type { Voice } from "@voxic/core"

const player = usePlayerStore()

// Persist the chosen voice across sessions.
const saved = useStorage("voxic:voice", "")
watch(
  () => player.voice,
  (v) => {
    if (v) saved.value = v
  },
)
onMounted(() => {
  if (saved.value && !player.voice) player.voice = saved.value
})

const open = ref(false)
const search = ref("")
const langOnly = useStorage("voxic:lang-only", true) // EN-only by default
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const currentLabel = computed(() => {
  const all = [...(player.catalog?.voiceList ?? []), ...(player.catalog?.other ?? []), ...(player.catalog?.base ?? [])]
  const v = all.find((x) => x.name === player.voice)
  return v ? `${v.label} (${v.lang})` : "Select voice"
})

const filtered = computed<Voice[]>(() => {
  const all = [...(player.catalog?.voiceList ?? []), ...(player.catalog?.other ?? []), ...(player.catalog?.base ?? [])]
  let list = all.filter((v) => v.refOk)
  if (langOnly.value) list = list.filter((v) => v.lang === "en")
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((v) => v.label.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
  return list
})

interface Group { letter: string; voices: Voice[] }
const grouped = computed<Group[]>(() => {
  const map = new Map<string, Voice[]>()
  for (const v of filtered.value) {
    const first = (v.label[0] ?? "#").toUpperCase()
    const key = /[A-Z]/.test(first) ? first : "其他"
    const arr = map.get(key) ?? []
    arr.push(v)
    map.set(key, arr)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "其他" ? 1 : b[0] === "其他" ? -1 : a[0].localeCompare(b[0])))
    .map(([letter, voices]) => ({ letter, voices: voices.sort((a, b) => a.label.localeCompare(b.label)) }))
})

function choose(v: Voice) {
  player.voice = v.name
  open.value = false
  search.value = ""
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false
}
</script>

<template>
  <div ref="root" class="voice-select" @keydown="onKey">
    <button class="trigger" :disabled="!player.catalog" @click="open = !open">
      <span class="trigger-label">{{ currentLabel }}</span>
      <span class="trigger-caret">▾</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="voice-panel">
        <div class="panel-head">
          <input
            v-model="search"
            class="search"
            type="search"
            placeholder="Search voices…"
            autofocus
          >
          <button class="lang-toggle" :class="{ active: langOnly }" @click="langOnly = !langOnly">
            {{ langOnly ? "EN only" : "All langs" }}
          </button>
        </div>

        <p v-if="!player.catalog" class="empty">Loading voices…</p>
        <p v-else-if="!grouped.length" class="empty">No voices match “{{ search }}”.</p>

        <div v-else class="groups">
          <div v-for="g in grouped" :key="g.letter" class="group">
            <div class="letter">{{ g.letter }}</div>
            <button
              v-for="v in g.voices"
              :key="v.name"
              class="voice-item"
              :class="{ active: v.name === player.voice }"
              @click="choose(v)"
            >
              <span class="v-label">{{ v.label }}</span>
              <span class="v-lang" :class="`lang-${v.lang}`">{{ v.lang }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 11rem;
  background: var(--bg, #fff);
  color: var(--fg, #1a1d24);
  border: 1px solid rgba(120, 130, 150, 0.35);
  border-radius: 8px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.trigger:disabled {
  opacity: 0.5;
}
.dark .trigger {
  background: #12141c;
  border-color: rgba(255, 255, 255, 0.12);
}
.trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trigger-caret {
  font-size: 0.7rem;
  opacity: 0.7;
}

.voice-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: 3.4rem;
  z-index: 60;
  width: min(92vw, 30rem);
  max-height: min(70vh, 34rem);
  display: flex;
  flex-direction: column;
  background: var(--bg, #fff);
  color: var(--fg, #1a1d24);
  border: 1px solid rgba(120, 130, 150, 0.3);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: panel-in 0.12s ease-out;
}
@keyframes panel-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.dark .voice-panel {
  background: #12141c;
  border-color: rgba(255, 255, 255, 0.1);
}
.panel-head {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem;
  border-bottom: 1px solid rgba(120, 130, 150, 0.2);
}
.search {
  flex: 1;
  background: transparent;
  color: inherit;
  border: 1px solid rgba(120, 130, 150, 0.3);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}
.search:focus {
  outline: 2px solid #1f5be0;
  outline-offset: -1px;
}
.lang-toggle {
  border: 1px solid rgba(120, 130, 150, 0.3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}
.lang-toggle.active {
  background: #1f5be0;
  color: #fff;
  border-color: #1f5be0;
}
.groups {
  overflow-y: auto;
  padding: 0.25rem 0;
}
.group {
  padding: 0.15rem 0;
}
.letter {
  position: sticky;
  top: 0;
  background: var(--bg, #fff);
  font-size: 0.72rem;
  font-weight: 700;
  color: #636e80;
  padding: 0.3rem 0.7rem;
  border-bottom: 1px solid rgba(120, 130, 150, 0.12);
}
.dark .letter {
  background: #12141c;
  color: #aeb6c2;
}
.voice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.4rem 0.7rem;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
}
.voice-item:hover {
  background: rgba(31, 91, 224, 0.1);
}
.voice-item.active {
  background: rgba(31, 91, 224, 0.18);
  font-weight: 600;
}
.v-lang {
  font-size: 0.68rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: rgba(120, 130, 150, 0.18);
  color: #636e80;
}
.lang-en {
  background: rgba(31, 91, 224, 0.16);
  color: #1f5be0;
}
.empty {
  padding: 1rem;
  text-align: center;
  color: #636e80;
  font-size: 0.85rem;
}
</style>
