import { defineStore } from "pinia"
import type { VoiceCatalog } from "@voxic/core"

export type RepeatMode = "off" | "on"

/**
 * TTS playback state. Plays a single audio source: either the cron-generated
 * article MP3 (instant) or a synthesized MP3 for imported text. Per-word
 * pronunciation is handled separately (DefinitionPanel) via /api/tts/word.
 */
export const usePlayerStore = defineStore("player", () => {
  const audioUrl = ref<string | null>(null)
  const voice = ref<string>("") // the playing audio's voice (cron voice or synth voice)
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const repeatMode = ref<RepeatMode>("off")
  const playbackRate = ref(1)

  const catalog = ref<VoiceCatalog | null>(null)
  const hasAudio = computed(() => !!audioUrl.value)

  /** Load the voice catalog (called once on app mount). */
  async function loadCatalog() {
    if (catalog.value) return
    try {
      catalog.value = await $fetch<VoiceCatalog>("/api/voices")
      if (!voice.value) {
        const firstEn = catalog.value.voiceList.find((v) => v.lang === "en" && v.refOk)
        voice.value = firstEn?.name ?? catalog.value.voiceList[0]?.name ?? ""
      }
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  /** Play the cron-generated article audio (instant, no synthesis). */
  async function playArticle(date: string) {
    isLoading.value = true
    error.value = null
    try {
      const media = await $fetch<{ found: boolean; voice: string | null; audioUrl: string | null }>(
        `/api/articles/${encodeURIComponent(date)}/media`,
      )
      if (!media.found || !media.audioUrl) {
        error.value = "No audio for this date — the cron hasn't generated one yet."
        audioUrl.value = null
        return
      }
      audioUrl.value = media.audioUrl
      voice.value = media.voice ?? voice.value
      isPlaying.value = true
    } catch (e) {
      error.value = (e as Error).message
      audioUrl.value = null
      isPlaying.value = false
    } finally {
      isLoading.value = false
    }
  }

  /** Synthesize + play arbitrary text (for imported text). Slower. */
  async function playText(text: string) {
    if (!voice.value) await loadCatalog()
    if (!voice.value) {
      error.value = "No voice selected"
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const res = await $fetch<{ audioUrl: string; voice: string }>("/api/tts/synthesize", {
        method: "POST",
        body: { text, voice: voice.value },
      })
      audioUrl.value = res.audioUrl
      voice.value = res.voice
      isPlaying.value = true
    } catch (e) {
      error.value = (e as Error).message
      audioUrl.value = null
      isPlaying.value = false
    } finally {
      isLoading.value = false
    }
  }

  function play() {
    if (hasAudio.value) isPlaying.value = true
  }
  function pause() {
    isPlaying.value = false
  }
  function toggle() {
    if (hasAudio.value) isPlaying.value = !isPlaying.value
  }
  function onEnded() {
    if (repeatMode.value === "on") {
      isPlaying.value = true
      return
    }
    isPlaying.value = false
  }
  function clear() {
    audioUrl.value = null
    isPlaying.value = false
  }
  function cycleRepeat() {
    repeatMode.value = repeatMode.value === "off" ? "on" : "off"
  }

  return {
    audioUrl,
    voice,
    isPlaying,
    isLoading,
    error,
    repeatMode,
    playbackRate,
    catalog,
    hasAudio,
    loadCatalog,
    playArticle,
    playText,
    play,
    pause,
    toggle,
    onEnded,
    clear,
    cycleRepeat,
  }
})
