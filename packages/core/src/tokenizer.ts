import type { Token, WordStatusLookup, WordTarget } from "./types"

/**
 * Regex for an English word: letters + apostrophes (don't, it's) + hyphens
 * (well-known). Accented Latin letters are included for borrowed words.
 */
const WORD_RE = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ''-]*/g
/** Emoji ranges (sufficient for the markers used in articles, e.g. 🗑️). */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u

/** Build the lower-cased lookup key for a word token. */
export function wordKey(word: string): string {
  return word.toLowerCase().replace(/[''`]/g, "'").replace(/^-|-$/g, "")
}

export interface TokenizeOptions {
  /** Word-status lookup to flag target words during tokenization. */
  wordStatus?: WordStatusLookup
  /** Explicit bolded words (lower-cased) to mark as `bold` targets. */
  boldWords?: Set<string>
}

/** Tokenize a sentence (no newlines) into ordered tokens. */
export function tokenizeSentence(text: string, opts: TokenizeOptions = {}): Token[] {
  const tokens: Token[] = []
  let i = 0
  const ws = opts.wordStatus
  const bold = opts.boldWords

  while (i < text.length) {
    const ch = text[i]!

    // whitespace
    if (/\s/.test(ch)) {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j]!)) j++
      tokens.push({ type: "space", value: text.slice(i, j), start: i, end: j })
      i = j
      continue
    }

    // emoji (may be multi-codepoint, e.g. 🗑️ = U+1F5D1 + U+FE0F)
    if (EMOJI_RE.test(ch)) {
      let j = i + 1
      while (j < text.length && EMOJI_RE.test(text[j]!)) j++
      tokens.push({ type: "emoji", value: text.slice(i, j), start: i, end: j })
      i = j
      continue
    }

    // word
    WORD_RE.lastIndex = i
    const m = WORD_RE.exec(text)
    if (m && m.index === i) {
      const value = m[0]
      const key = wordKey(value)
      let target: WordTarget | undefined
      // Mastery status takes precedence over bold: a forgotten word must show
      // its red-wavy underline even if the article also bolded it.
      if (ws?.forget.has(key)) target = "forget"
      else if (ws?.vague.has(key)) target = "vague"
      else if (bold?.has(key)) target = "bold"
      else if (ws?.familiar.has(key)) target = "familiar"
      tokens.push({ type: "word", value, key, start: i, end: i + value.length, target })
      i += value.length
      continue
    }

    // punctuation / other single char
    tokens.push({ type: "punct", value: ch, start: i, end: i + 1 })
    i += 1
  }

  return tokens
}

/**
 * Split a paragraph into sentences at sentence-ending punctuation followed by
 * whitespace, preserving the punctuation. Keeps abbreviations simple (no
 * full abbreviation list — articles are the primary source and are clean).
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return []
  const sentences: string[] = []
  // Match up to (and including) a sentence terminator + trailing space/quote.
  const re = /[^.!?]*[.!?]+["')\]]*\s*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim()) sentences.push(m[0].replace(/\s+$/, ""))
    last = re.lastIndex
  }
  if (last < text.length) {
    const tail = text.slice(last).trim()
    if (tail) sentences.push(tail)
  }
  return sentences
}

/** Tokenize a full paragraph: returns sentences, each with tokens. */
export function tokenizeParagraph(text: string, opts: TokenizeOptions = {}) {
  const sentences = splitSentences(text)
  return sentences.map((s) => ({ text: s, tokens: tokenizeSentence(s, opts) }))
}
