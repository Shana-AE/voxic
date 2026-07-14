import { useRuntimeConfig } from "#imports"
import { getAiKey } from "./config"

/** A generated flashcard for a single word. */
export interface WordCardFields {
  phonetic: string | null
  cnDef: string | null
  exampleEn: string | null
  exampleZh: string | null
}

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Call the OpenAI-compatible AI gateway (Qiniu → deepseek-v4-flash). Tries the
 * primary model, then the fallback model if set. Returns the assistant text.
 */
export async function aiChat(messages: ChatMessage[]): Promise<string> {
  const cfg = useRuntimeConfig()
  const key = getAiKey()
  if (!key) throw new Error("AI key not configured (set NUXT_AI_API_KEY or QINIU_AI_API_KEY in secrets)")

  const models = [cfg.aiModel, cfg.aiFallbackModel].filter((m): m is string => !!m)
  if (models.length === 0) throw new Error("No AI model configured")

  let lastErr: unknown
  for (const model of models) {
    try {
      const res = await $fetch<{ choices?: Array<{ message?: { content?: string } }> }>(
        `${cfg.aiBaseUrl}/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: { model, messages, temperature: 0.3, max_tokens: 400 },
          timeout: 60_000,
        },
      )
      const text = res.choices?.[0]?.message?.content ?? ""
      if (text) return text
      lastErr = new Error("empty response")
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(`AI chat failed for all models: ${(lastErr as Error).message}`)
}

const CARD_SYSTEM = `You are a bilingual (English↔Chinese) vocabulary assistant for a Chinese learner of English.
For the given English word, return STRICT JSON only (no markdown, no prose) with these fields:
{"phonetic": "IPA, no slashes", "cn_def": "concise Chinese definition(s)", "example_en": "one natural example sentence using the word", "example_zh": "Chinese translation of the example"}
Keep cn_def short. example_en must actually contain the word. Output ONLY the JSON object.`

/**
 * Generate flashcard fields for a word via the AI gateway. Returns null fields
 * on failure rather than throwing (so one bad word doesn't fail a batch).
 */
export async function generateCardFields(word: string): Promise<WordCardFields> {
  const empty: WordCardFields = { phonetic: null, cnDef: null, exampleEn: null, exampleZh: null }
  try {
    const raw = await aiChat([
      { role: "system", content: CARD_SYSTEM },
      { role: "user", content: word },
    ])
    // Extract the JSON object even if wrapped in stray text/markdown.
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return empty
    const parsed = JSON.parse(match[0]) as Record<string, string>
    return {
      phonetic: parsed.phonetic?.trim() || null,
      cnDef: parsed.cn_def?.trim() || null,
      exampleEn: parsed.example_en?.trim() || null,
      exampleZh: parsed.example_zh?.trim() || null,
    }
  } catch {
    return empty
  }
}
