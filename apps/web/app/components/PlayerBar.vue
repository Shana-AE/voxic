<script setup lang="ts">
import { usePlayerStore } from "~/stores/player"
import { useStorage } from "@vueuse/core"

const player = usePlayerStore()

const audio = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const persistedRate = useStorage("voxic:rate", 1)

watch(
  () => player.audioUrl,
  () => {
    nextTick(() => {
      const el = audio.value
      if (!el) return
      el.playbackRate = player.playbackRate
      if (player.isPlaying) el.play().catch(() => {})
    })
  },
)

watch(
  () => player.isPlaying,
  (playing) => {
    const el = audio.value
    if (!el) return
    if (playing) el.play().catch(() => {})
    else el.pause()
  },
)

watch(
  () => player.playbackRate,
  (rate) => {
    persistedRate.value = rate
    if (audio.value) audio.value.playbackRate = rate
  },
)

onMounted(() => {
  player.playbackRate = persistedRate.value
  player.loadCatalog()
})

function onTimeUpdate() {
  currentTime.value = audio.value?.currentTime ?? 0
}
function onLoaded() {
  duration.value = audio.value?.duration ?? 0
}
function onEnded() {
  player.onEnded()
}
function seek(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (audio.value) audio.value.currentTime = val
  currentTime.value = val
}

function toggleRate() {
  const rates = [1, 0.75, 0.5, 1.25, 1.5]
  const i = rates.indexOf(player.playbackRate)
  player.playbackRate = rates[(i + 1) % rates.length]!
}

function fmt(s: number): string {
  if (!s || !isFinite(s)) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const repeatLabel = computed(() => (player.repeatMode === "on" ? "↻¹" : "↻"))
</script>

<template>
  <Transition name="slide-up">
    <div v-if="player.hasAudio || player.isLoading" class="player-bar fixed bottom-0 inset-x-0 z-40">
      <div class="player-inner">
        <div class="now-playing">
          <span v-if="player.isLoading" class="text-sm text-ink-400">Synthesizing…</span>
          <template v-else>
            <span class="voice-tag">{{ player.voice || "—" }}</span>
            <span class="time">{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>
          </template>
        </div>

        <div class="controls">
          <button
            class="play-btn"
            :disabled="!player.hasAudio"
            @click="player.toggle()"
          >{{ player.isPlaying ? "⏸" : "▶" }}</button>
          <button
            class="btn-ghost"
            :class="{ 'text-brand-500': player.repeatMode === 'on' }"
            @click="player.cycleRepeat()"
          >{{ repeatLabel }}</button>
          <button class="btn-ghost text-xs" @click="toggleRate">{{ player.playbackRate }}×</button>
        </div>

        <input
          class="scrubber"
          type="range"
          min="0"
          :max="duration || 0"
          :value="currentTime"
          :disabled="!player.hasAudio"
          @input="seek"
        >
      </div>

      <p v-if="player.error" class="player-error">{{ player.error }}</p>

      <audio
        ref="audio"
        :src="player.audioUrl ?? undefined"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoaded"
        @ended="onEnded"
      />
    </div>
  </Transition>
</template>

<style scoped>
.player-inner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  background: var(--bg, rgba(255, 255, 255, 0.96));
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(120, 130, 150, 0.25);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
}
.dark .player-inner {
  background: rgba(12, 14, 20, 0.96);
  border-top-color: rgba(255, 255, 255, 0.08);
}
.now-playing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  min-width: 0;
}
.voice-tag {
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 9rem;
  color: var(--fg);
}
.time {
  font-size: 0.72rem;
  color: #636e80;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.controls {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}
.play-btn {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 0;
  background: #1f5be0;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.play-btn:disabled {
  opacity: 0.4;
}
.btn-ghost {
  font-size: 0.95rem;
  padding: 0.3rem 0.45rem;
}
.scrubber {
  flex: 1;
  min-width: 0;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(120, 130, 150, 0.3);
  border-radius: 4px;
  cursor: pointer;
}
.scrubber::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1f5be0;
}
.scrubber::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: #1f5be0;
}
.player-error {
  margin: 0;
  padding: 0.2rem 0.9rem 0.5rem;
  font-size: 0.78rem;
  color: #d64545;
}

@media (max-width: 640px) {
  .player-inner {
    flex-wrap: wrap;
  }
  .scrubber {
    order: 5;
    flex-basis: 100%;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
