import { lookupWord, embeddedProvider, eudicProvider, freeDictProvider } from "@voxic/core"
import { getEudicToken } from "../../utils/config"

/**
 * GET /api/dict/:word — tiered dictionary lookup.
 * Query: ?noteIndex=<json> (embedded notes from the current article) — optional.
 */
export default defineEventHandler(async (event) => {
  const word = getRouterParam(event, "word")!
  const token = getEudicToken()

  // Embedded notes may be POSTed for richer lookup; here we accept a query param
  // carrying a pre-parsed note for the word (sent by the client when available).
  const noteParam = getQuery(event).note as string | undefined
  const notes: Record<string, { meaning?: string; phonetic?: string }> = {}
  if (noteParam) {
    try {
      const parsed = JSON.parse(noteParam)
      if (parsed && typeof parsed.word === "string") {
        notes[parsed.word.toLowerCase()] = {
          meaning: parsed.meaning,
          phonetic: parsed.phonetic,
        }
      }
    } catch {
      // ignore malformed note
    }
  }

  const providers = [
    embeddedProvider(notes as any),
    eudicProvider(token),
    freeDictProvider(),
  ]

  return await lookupWord(word, providers)
})
