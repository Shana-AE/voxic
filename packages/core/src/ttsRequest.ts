import type { Voice } from "./types"
import { splitSentences } from "./tokenizer"

/** Base URL of the GPT-SoVITS API (e.g. http://127.0.0.1:9880). */
export type TtsBase = string

/** Infer the reference-audio language from a voice name's suffix (e.g. "Lancet-2_en" → "en"). */
export function langFromVoiceName(name: string): "en" | "ja" | "zh" | "ko" {
  if (name.endsWith("_ja")) return "ja"
  if (name.endsWith("_zh")) return "zh"
  if (name.endsWith("_ko")) return "ko"
  return "en"
}

/** Generic prompt sentence per language (matches the working maimemo TTS script). */
export function promptTextForLang(lang: "en" | "ja" | "zh" | "ko"): string {
  switch (lang) {
    case "ja":
      return "これは音声のテストサンプルです。"
    case "zh":
      return "这是一个语音测试样本。"
    case "ko":
      return "이것은 음성 테스트 샘플입니다."
    case "en":
    default:
      return "This is a voice test sample."
  }
}

/** Build the /register_speaker URL (idempotent; cached voices return instantly). */
export function buildRegisterSpeakerUrl(base: TtsBase, voice: Voice): string {
  const u = new URL(base)
  u.pathname = "/register_speaker"
  u.searchParams.set("name", voice.name)
  u.searchParams.set("gpt_model_path", voice.gpt)
  u.searchParams.set("sovits_model_path", voice.sov)
  return u.toString()
}

/** Optional GPT-SoVITS sampling overrides (lower = more deterministic/stable). */
export interface TtsParams {
  topK?: number
  topP?: number
  temperature?: number
  speed?: number
}

/** Build the root GET / TTS request URL for a single text chunk. */
export function buildTtsUrl(
  base: TtsBase,
  text: string,
  voice: Voice,
  params?: TtsParams,
  textLang?: "en" | "ja" | "zh" | "ko",
): string {
  const lang = langFromVoiceName(voice.name)
  const tLang = textLang ?? lang
  const u = new URL(base)
  u.pathname = "/"
  u.searchParams.set("refer_wav_path", voice.ref)
  u.searchParams.set("prompt_text", promptTextForLang(lang))
  u.searchParams.set("prompt_language", lang)
  u.searchParams.set("text", text)
  u.searchParams.set("text_language", tLang)
  u.searchParams.set("spk", voice.name)
  if (params?.topK != null) u.searchParams.set("top_k", String(params.topK))
  if (params?.topP != null) u.searchParams.set("top_p", String(params.topP))
  if (params?.temperature != null) u.searchParams.set("temperature", String(params.temperature))
  if (params?.speed != null) u.searchParams.set("speed", String(params.speed))
  return u.toString()
}

/**
 * Split text into TTS chunks at sentence boundaries, staying under maxLen chars
 * per chunk (GPT-SoVITS GET URLs cap text length). Short tails merge into the
 * previous chunk.
 */
export function splitForTts(text: string, maxLen = 800): string[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []

  const chunks: string[] = []
  let current = ""
  for (const s of sentences) {
    if (s.length > maxLen) {
      // Force-split an over-long sentence at word boundaries.
      if (current) {
        chunks.push(current)
        current = ""
      }
      const words = s.split(/\s+/)
      let sub = ""
      for (const w of words) {
        if (sub.length + w.length + 1 > maxLen) {
          if (sub) chunks.push(sub)
          sub = w
        } else {
          sub = sub ? `${sub} ${w}` : w
        }
      }
      if (sub) current = sub
      continue
    }
    if (current.length + s.length + 1 > maxLen) {
      chunks.push(current)
      current = s
    } else {
      current = current ? `${current} ${s}` : s
    }
  }
  if (current) chunks.push(current)

  // Merge a too-short trailing chunk into the previous one, but only if the
  // combined length stays within maxLen (don't create over-long chunks).
  if (chunks.length > 1) {
    const last = chunks.at(-1)!
    const prev = chunks.at(-2)!
    if (last.length < 50 && prev.length + last.length + 1 <= maxLen) {
      chunks[chunks.length - 2] = `${prev} ${last}`
      chunks.pop()
    }
  }
  return chunks
}

/** Deterministic cache key for a (text + voice) synthesis request. */
export function ttsCacheKey(text: string, voiceName: string): string {
  // djb2 hash — short, collision-resistant enough for a local cache.
  const input = `${voiceName}::${text}`
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
}
