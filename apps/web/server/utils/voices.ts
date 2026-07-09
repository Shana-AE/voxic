import { readFileSync, existsSync } from "node:fs"
import { useRuntimeConfig } from "#imports"
import { buildVoiceCatalog, parseVoiceListFile } from "@voxic/core"
import type { VoiceCatalog } from "@voxic/core"

let _catalog: VoiceCatalog | null = null
let _loadedAt = 0
const TTL_MS = 60_000 // refresh the catalog at most once per minute

/** Load + normalize the voice catalog from NAS (voice_rotation.json). */
export function getVoiceCatalog(force = false): VoiceCatalog {
  const cfg = useRuntimeConfig()
  const now = Date.now()
  if (_catalog && !force && now - _loadedAt < TTL_MS) return _catalog

  if (!existsSync(cfg.voiceRotationPath)) {
    throw createError({
      statusCode: 503,
      statusMessage: `voice_rotation.json not found at ${cfg.voiceRotationPath}`,
    })
  }

  const raw = JSON.parse(readFileSync(cfg.voiceRotationPath, "utf8"))
  let voiceList = new Set<string>()
  if (existsSync(cfg.voiceListPath)) {
    voiceList = parseVoiceListFile(readFileSync(cfg.voiceListPath, "utf8"))
  }
  _catalog = buildVoiceCatalog(raw, voiceList)
  _loadedAt = now
  return _catalog
}

/** Look up a single voice by name (used by the TTS proxy). */
export function findVoice(name: string) {
  const cat = getVoiceCatalog()
  return [...cat.voiceList, ...cat.other, ...cat.base].find((v) => v.name === name) ?? null
}
