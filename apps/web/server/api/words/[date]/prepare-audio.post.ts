import { getCards } from "../../../utils/cards"
import { synthesizeText } from "../../../utils/tts"

interface PrepBody {
  enVoice?: string
  zhVoice?: string
  fields?: { pronounce?: boolean; spell?: boolean; cnDef?: boolean; exampleEn?: boolean; exampleZh?: boolean }
  concurrency?: number
}

/**
 * POST /api/words/:date/prepare-audio — pre-synthesize (and cache on disk) the
 * 随身听 field segments for the day's forget/vague cards, using the correct
 * per-language voices. After this runs, the listen-mode player starts instantly
 * (every segment is already cached). Body: { enVoice, zhVoice, fields }.
 */
export default defineEventHandler(async (event) => {
  const date = getRouterParam(event, "date")!
  const body = (await readBody<PrepBody>(event).catch(
    () => ({}) as PrepBody,
  )) as PrepBody
  const enVoice = body.enVoice
  const zhVoice = body.zhVoice
  const f = body.fields ?? { pronounce: true, spell: true, cnDef: true, exampleEn: true, exampleZh: true }
  const concurrency = Math.min(body.concurrency ?? 2, 2) // GPT-SoVITS serializes anyway

  const { cards } = await getCards(date)
  const scope = cards.filter((c) => c.generated && (c.status === "FORGET" || c.status === "VAGUE"))

  const LETTER_NAMES: Record<string, string> = {
    a: "ay", b: "bee", c: "cee", d: "dee", e: "ee", f: "eff", g: "gee",
    h: "aitch", i: "eye", j: "jay", k: "kay", l: "el", m: "em", n: "en",
    o: "oh", p: "pee", q: "cue", r: "ar", s: "ess", t: "tee", u: "you",
    v: "vee", w: "double-u", x: "ex", y: "why", z: "zee",
  }
  const spellLetters = (w: string) =>
    w.toLowerCase().split("").map((c) => LETTER_NAMES[c] ?? c).join(". ") + "."

  const segs: Array<{ text: string; voice: string; lang: "en" | "zh" }> = []
  for (const c of scope) {
    if (f.pronounce && enVoice) segs.push({ text: c.word, voice: enVoice, lang: "en" })
    if (f.spell && enVoice) segs.push({ text: spellLetters(c.word), voice: enVoice, lang: "en" })
    if (f.cnDef && c.cnDef && zhVoice) segs.push({ text: c.cnDef, voice: zhVoice, lang: "zh" })
    if (f.exampleEn && c.exampleEn && enVoice) segs.push({ text: c.exampleEn, voice: enVoice, lang: "en" })
    if (f.exampleZh && c.exampleZh && zhVoice) segs.push({ text: c.exampleZh, voice: zhVoice, lang: "zh" })
  }

  let prepared = 0
  let cursor = 0
  async function worker() {
    while (cursor < segs.length) {
      const s = segs[cursor++]!
      try {
        await synthesizeText(s.text, s.voice, s.lang)
        prepared++
      } catch (e) {
        console.warn(`[prepare] synth failed for "${s.text.slice(0, 20)}":`, (e as Error).message)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, segs.length) }, () => worker()))

  return { date, prepared, total: segs.length }
})
