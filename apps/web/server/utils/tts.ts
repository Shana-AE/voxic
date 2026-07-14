import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { useRuntimeConfig } from "#imports"
import { buildRegisterSpeakerUrl, buildTtsUrl, splitForTts, ttsCacheKey, type TtsParams } from "@voxic/core"
import { findVoice } from "./voices"
import { useDb, schema } from "../db"

const registeredVoices = new Set<string>()

/** Resolve the TTS cache directory, creating it if missing. */
function cacheDir(): string {
  const cfg = useRuntimeConfig()
  const dir = cfg.ttsCacheDir.startsWith("/")
    ? cfg.ttsCacheDir
    : resolve(process.cwd(), cfg.ttsCacheDir)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Idempotently register a voice's weights with the GPT-SoVITS server. */
async function ensureVoiceRegistered(voiceName: string, base: string) {
  if (registeredVoices.has(voiceName)) return
  const voice = findVoice(voiceName)
  if (!voice) throw createError({ statusCode: 404, statusMessage: `Unknown voice: ${voiceName}` })
  const url = buildRegisterSpeakerUrl(base, voice)
  try {
    await $fetch<{ code: number; message: string }>(url, { timeout: 120_000 })
    registeredVoices.add(voiceName)
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `register_speaker failed for ${voiceName} — is GPT-SoVITS running at ${base}?`,
    })
  }
}

/** Call GPT-SoVITS for one text chunk, returning WAV bytes. */
async function synthesizeWav(
  text: string,
  voiceName: string,
  base: string,
  params?: TtsParams,
  textLang?: "en" | "zh",
): Promise<Buffer> {
  const voice = findVoice(voiceName)!
  const url = buildTtsUrl(base, text, voice, params, textLang)
  const buf = await $fetch<ArrayBuffer>(url, {
    responseType: "arrayBuffer",
    timeout: 300_000,
  })
  return Buffer.from(buf)
}

/** Convert WAV bytes to MP3 via ffmpeg, returning MP3 bytes. */
function wavToMp3(wav: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-f", "wav",
      "-i", "pipe:0",
      "-codec:a", "libmp3lame",
      "-b:a", "96k",
      "-f", "mp3",
      "pipe:1",
    ])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    proc.stdin.on("error", reject)
    proc.stdout.on("data", (c) => chunks.push(c))
    proc.stderr.on("data", (c) => errChunks.push(c))
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(errChunks).toString()}`))
      else resolve(Buffer.concat(chunks))
    })
    proc.stdin.end(wav)
  })
}

/**
 * Synthesize a single word/short phrase for real-time pronunciation on click.
 *
 * GPT-SoVITS is a sentence-level model: a bare isolated word is too short, so
 * the phoneme/duration predictor hallucinates filler ("emmm"). To avoid this:
 *  - FRAME single words as "word. word." (a lone word with no spaces gets a
 *    period + repetition) to give the model prosodic context;
 *  - LOWER sampling randomness (temperature/top_k/top_p) for stability.
 * Longer phrases (containing spaces) are sent as-is. Cached by framed text.
 */
export async function synthesizeWord(text: string, voiceName: string): Promise<string> {
  const cfg = useRuntimeConfig()
  const base = cfg.gptsovitsBase
  const voice = findVoice(voiceName)
  if (!voice) throw createError({ statusCode: 404, statusMessage: `Unknown voice: ${voiceName}` })
  if (!voice.refOk) {
    throw createError({ statusCode: 400, statusMessage: `Voice ${voiceName} has no reference audio` })
  }

  // Frame single words; leave phrases untouched.
  const trimmed = text.trim().replace(/[.!?]+$/, "")
  const framed = /\s/.test(trimmed) ? trimmed : `${trimmed}. ${trimmed}.`
  const key = ttsCacheKey(framed, voiceName)
  const dir = cacheDir()
  const mp3Path = join(dir, `${key}.mp3`)

  // Disk cache: if the file exists, serve immediately.
  if (existsSync(mp3Path)) return mp3Path

  await ensureVoiceRegistered(voiceName, base)

  // Low-randomness params for cleaner isolated-word pronunciation.
  const params: TtsParams = { temperature: 0.1, topK: 5, topP: 0.5 }

  let wav: Buffer
  try {
    wav = await synthesizeWav(framed, voiceName, base, params)
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `GPT-SoVITS synthesis failed: ${(e as Error).message}`,
    })
  }
  const mp3 = await wavToMp3(wav)
  writeFileSync(mp3Path, mp3)

  const db = useDb()
  db.insert(schema.ttsCache)
    .values({
      cacheKey: key,
      voice: voiceName,
      segIndex: 0,
      text: framed,
      audioPath: mp3Path,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({ target: schema.ttsCache.cacheKey, set: { audioPath: mp3Path } })
    .run()

  return mp3Path
}

/**
 * Synthesize arbitrary text in a given language — powers the 随身听 listen mode
 * for both English (spelling/example_en) and Chinese (释义/example_zh) fields.
 * Lone English words are framed for clean pronunciation; sentences and all
 * Chinese text are sent as-is. Cached on disk by (lang, text, voice).
 */
export async function synthesizeText(
  text: string,
  voiceName: string,
  lang: "en" | "zh" = "en",
): Promise<string> {
  const cfg = useRuntimeConfig()
  const base = cfg.gptsovitsBase
  const voice = findVoice(voiceName)
  if (!voice) throw createError({ statusCode: 404, statusMessage: `Unknown voice: ${voiceName}` })
  if (!voice.refOk) {
    throw createError({ statusCode: 400, statusMessage: `Voice ${voiceName} has no reference audio` })
  }

  const trimmed = text.trim().replace(/[.!?]+$/, "")
  const loneEnWord = lang === "en" && !/\s/.test(trimmed)
  const framed = loneEnWord ? `${trimmed}. ${trimmed}.` : trimmed
  const key = ttsCacheKey(`${lang}::${framed}`, voiceName)
  const dir = cacheDir()
  const mp3Path = join(dir, `${key}.mp3`)

  if (existsSync(mp3Path)) return mp3Path

  await ensureVoiceRegistered(voiceName, base)
  const params: TtsParams = loneEnWord ? { temperature: 0.1, topK: 5, topP: 0.5 } : { temperature: 0.3 }

  let wav: Buffer
  try {
    wav = await synthesizeWav(framed, voiceName, base, params, lang === "zh" ? "zh" : undefined)
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: `GPT-SoVITS synthesis failed: ${(e as Error).message}`,
    })
  }
  const mp3 = await wavToMp3(wav)
  writeFileSync(mp3Path, mp3)

  const db = useDb()
  db.insert(schema.ttsCache)
    .values({
      cacheKey: key,
      voice: voiceName,
      segIndex: 0,
      text: framed,
      audioPath: mp3Path,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({ target: schema.ttsCache.cacheKey, set: { audioPath: mp3Path } })
    .run()

  return mp3Path
}

/**
 * Synthesize a longer text block into a single concatenated MP3 (for imported
 * text that has no cron media). Returns the on-disk path. Slower than streaming
 * the cron file, but imports are user-initiated and usually short.
 */
export async function synthesizeFull(text: string, voiceName: string): Promise<string> {
  const cfg = useRuntimeConfig()
  const base = cfg.gptsovitsBase
  const voice = findVoice(voiceName)
  if (!voice) throw createError({ statusCode: 404, statusMessage: `Unknown voice: ${voiceName}` })
  if (!voice.refOk) {
    throw createError({ statusCode: 400, statusMessage: `Voice ${voiceName} has no reference audio` })
  }

  const key = ttsCacheKey(text, voiceName)
  const dir = cacheDir()
  const mp3Path = join(dir, `${key}.mp3`)
  if (existsSync(mp3Path)) return mp3Path

  await ensureVoiceRegistered(voiceName, base)
  const chunks = splitForTts(text)
  if (chunks.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No text to synthesize" })
  }

  // Synthesize each chunk → WAV → MP3, then concatenate with ffmpeg.
  const partPaths: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const partPath = join(dir, `${key}.${i}.mp3`)
    if (!existsSync(partPath)) {
      const wav = await synthesizeWav(chunks[i]!, voiceName, base)
      const mp3 = await wavToMp3(wav)
      writeFileSync(partPath, mp3)
    }
    partPaths.push(partPath)
  }

  if (partPaths.length === 1) {
    // Single chunk: rename to the final path.
    const { renameSync } = await import("node:fs")
    renameSync(partPaths[0]!, mp3Path)
  } else {
    await concatMp3(partPaths, mp3Path)
  }

  const db = useDb()
  db.insert(schema.ttsCache)
    .values({
      cacheKey: key,
      voice: voiceName,
      segIndex: 0,
      text,
      audioPath: mp3Path,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({ target: schema.ttsCache.cacheKey, set: { audioPath: mp3Path } })
    .run()

  return mp3Path
}

/** Concatenate MP3 files with ffmpeg's concat demuxer. */
function concatMp3(parts: string[], out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    import("node:fs").then(({ writeFileSync, unlinkSync }) => {
      const listFile = join(out, "..", `_concat_${Date.now()}.txt`)
      writeFileSync(listFile, parts.map((p) => `file '${p}'`).join("\n"))
      const proc = spawn("ffmpeg", [
        "-y", "-f", "concat", "-safe", "0", "-i", listFile,
        "-c", "copy", out,
      ])
      const err: Buffer[] = []
      proc.stderr.on("data", (c) => err.push(c))
      proc.on("close", (code) => {
        try { unlinkSync(listFile) } catch {}
        if (code !== 0) reject(new Error(`ffmpeg concat exited ${code}: ${Buffer.concat(err).toString()}`))
        else resolve()
      })
    })
  })
}
