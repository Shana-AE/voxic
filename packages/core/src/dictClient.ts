import type { DictDefinition, DictEntry, WordNote } from "./types"

/** A dictionary provider: given a word, return a partial entry or null. */
export interface DictProvider {
  name: DictEntry["source"]
  lookup(word: string): Promise<Omit<DictEntry, "word" | "source"> | null>
}

/** Provider that reads from already-parsed article word notes (zero network). */
export function embeddedProvider(notes: Record<string, WordNote>): DictProvider {
  return {
    name: "embedded",
    async lookup(word) {
      const note = notes[word.toLowerCase()]
      if (!note) return null
      return {
        exp: note.meaning,
        phonetic: note.phonetic,
        audio: undefined,
        saved: false,
      }
    },
  }
}

/** Eudic studylist provider — only resolves words already saved in the wordbook. */
export function eudicProvider(token: string, fetchImpl: typeof fetch = fetch): DictProvider {
  return {
    name: "eudic",
    async lookup(word) {
      if (!token) return null
      try {
        const url = `https://api.frdic.com/api/open/v1/studylist/word?language=en&word=${encodeURIComponent(word)}`
        const res = await fetchImpl(url, {
          headers: { Authorization: token, "User-Agent": "Mozilla/5.0" },
        })
        if (!res.ok) return null
        const data = (await res.json()) as {
          word?: string
          exp?: string
          star?: number
          message?: string
        }
        if (!data || data.message || !data.word) return null
        return { exp: data.exp, saved: true, star: data.star }
      } catch {
        return null
      }
    },
  }
}

/** Free Dictionary API provider — definitions + phonetics + audio for common words. */
export function freeDictProvider(fetchImpl: typeof fetch = fetch): DictProvider {
  return {
    name: "freedict",
    async lookup(word) {
      try {
        const res = await fetchImpl(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
        )
        if (!res.ok) return null
        const entries = (await res.json()) as Array<{
          phonetic?: string
          phonetics?: Array<{ text?: string; audio?: string }>
          meanings?: Array<{
            partOfSpeech?: string
            definitions?: Array<{ definition: string; example?: string }>
          }>
        }>
        if (!Array.isArray(entries) || entries.length === 0) return null
        const first = entries[0]!
        const phonetic =
          first.phonetic ?? first.phonetics?.find((p) => p.text)?.text ?? undefined
        const audio = first.phonetics?.find((p) => p.audio)?.audio || undefined
        const definitions: DictDefinition[] = []
        for (const e of entries) {
          for (const m of e.meanings ?? []) {
            for (const d of m.definitions ?? []) {
              definitions.push({
                partOfSpeech: m.partOfSpeech,
                text: d.definition,
                example: d.example,
              })
            }
          }
        }
        return { phonetic, audio, definitions }
      } catch {
        return null
      }
    },
  }
}

/**
 * Tiered dictionary lookup. Providers are tried in order; the first non-null
 * result wins. Eudic "saved" status is merged in even when a later provider
 * supplies the definition, so the UI can always show save state.
 */
export async function lookupWord(
  word: string,
  providers: DictProvider[],
): Promise<DictEntry> {
  const key = word.toLowerCase()
  let saved = false
  let star: number | undefined
  let eudicExp: string | undefined

  for (const p of providers) {
    const result = await p.lookup(key)
    if (!result) continue

    // Track Eudic save state separately so it can merge into a freedict result.
    if (p.name === "eudic") {
      saved = !!result.saved
      star = result.star
      eudicExp = result.exp
      if (eudicExp) {
        return { word, source: "eudic", exp: eudicExp, saved, star }
      }
      continue
    }

    // embedded / freedict result
    return {
      word,
      source: p.name,
      exp: result.exp ?? eudicExp,
      phonetic: result.phonetic,
      definitions: result.definitions,
      audio: result.audio,
      saved,
      star,
    }
  }

  return { word, source: "none", saved, star }
}
