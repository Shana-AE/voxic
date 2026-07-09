import type { Voice, VoiceCatalog } from "./types"

/** Raw shape of voice_rotation.json on the NAS. */
interface RawVoiceRotation {
  voices: Array<{
    name: string
    gpt: string
    sov: string
    ref: string
    ref_ok?: boolean
  }>
}

/** Split "Lancet-2_en" → { label: "Lancet-2", lang: "en" }. */
function splitName(name: string): { label: string; lang: string } {
  const idx = name.lastIndexOf("_")
  if (idx > 0 && /^[a-z]{2,3}$/i.test(name.slice(idx + 1))) {
    return { label: name.slice(0, idx), lang: name.slice(idx + 1).toLowerCase() }
  }
  return { label: name, lang: "en" }
}

/**
 * Normalize the voice_rotation JSON into a grouped catalog.
 *
 * Ordering (voice_list pinned to top, English first within each group):
 *   1. voice_list + ref_ok + English
 *   2. voice_list + ref_ok + other langs
 *   3. voice_list + !ref_ok (broken refs, shown but disabled)
 *   4. other (non-voice_list) + ref_ok + English
 *   5. other + ref_ok + other langs
 *
 * @param raw        parsed voice_rotation.json
 * @param voiceList  set of names from voice_list_local.txt (the trained catalog)
 */
export function buildVoiceCatalog(
  raw: RawVoiceRotation,
  voiceListNames: Set<string> = new Set(),
): VoiceCatalog {
  const voices: Voice[] = (raw.voices ?? []).map((v) => {
    const { label, lang } = splitName(v.name)
    const inList = voiceListNames.has(v.name)
    return {
      name: v.name,
      label,
      lang,
      gpt: v.gpt,
      sov: v.sov,
      ref: v.ref,
      refOk: v.ref_ok !== false,
      group: inList ? "voice_list" : "other",
    }
  })

  const enFirst = (a: Voice, b: Voice) => {
    if (a.lang === "en" && b.lang !== "en") return -1
    if (a.lang !== "en" && b.lang === "en") return 1
    return a.label.localeCompare(b.label)
  }
  const okFirst = (a: Voice, b: Voice) => {
    if (a.refOk === b.refOk) return 0
    return a.refOk ? -1 : 1
  }
  const cmp = (a: Voice, b: Voice) => okFirst(a, b) || enFirst(a, b)

  const voiceList = voices.filter((v) => v.group === "voice_list").sort(cmp)
  const other = voices.filter((v) => v.group === "other").sort(cmp)

  return {
    voiceList,
    other,
    // Base/pretrained models are configured separately (no trained weights);
    // left empty unless explicitly provided.
    base: [],
  }
}

/** Parse voice_list_local.txt (one name per line) into a Set. */
export function parseVoiceListFile(content: string): Set<string> {
  return new Set(
    content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#")),
  )
}
