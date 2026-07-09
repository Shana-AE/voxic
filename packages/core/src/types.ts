/**
 * @voxic/core — shared domain types.
 *
 * These shapes are produced by the article parser and consumed by the Nuxt
 * web app (server routes + client components). Keeping them in the core package
 * means the web app and tests share one source of truth.
 */

/** A single rendered token inside a sentence. */
export interface Token {
  /** Token kind. */
  type: "word" | "punct" | "space" | "emoji"
  /** Raw text of the token. */
  value: string
  /** Lower-cased lookup key for words (strips apostrophes for lookup). */
  key?: string
  /** Character offset within the source sentence text. */
  start: number
  end: number
  /** Why this word is highlighted, if it is. */
  target?: WordTarget
}

/** How a word was flagged as a learning target. */
export type WordTarget = "forget" | "vague" | "familiar" | "bold"

/** A sentence: its full text plus its tokens. */
export interface Sentence {
  text: string
  tokens: Token[]
}

/** A paragraph of English text, split into sentences. */
export interface Paragraph {
  text: string
  sentences: Sentence[]
}

/** A parsed word-note block from the article (the 📖 Word Notes callout). */
export interface WordNote {
  word: string
  /** Lower-cased lookup key. */
  key: string
  isForgotten: boolean
  phonetic?: string
  meaning?: string
  usage?: string
  contexts?: string
  example?: string
  collocation?: string
  confusable?: string
  memoryTip?: string
  /** Raw markdown of the note block (for fallback rendering). */
  raw: string
}

/** A titled section of the story with English paragraphs + translation + notes. */
export interface ArticlePart {
  title: string
  /** Title split into clickable tokens (cleaned of markdown/emoji). */
  titleTokens: Token[]
  paragraphs: Paragraph[]
  /** Collapsible Chinese translation if present. */
  translation?: string
  /** Word-note blocks attached to this part. */
  notes: WordNote[]
}

/** Today's review summary extracted from the `> [!info]` callout. */
export interface ArticleSummary {
  studied?: number
  total?: number
  studyMin?: number
  forget: string[]
  vague: string[]
  familiar: string[]
}

/** Article frontmatter metadata. */
export interface ArticleMeta {
  date: string
  title: string
  tags: string[]
  forgetCount?: number
  vagueCount?: number
  familiarCount?: number
}

/** The fully-parsed article — the canonical structure used by the reader UI. */
export interface ParsedArticle {
  meta: ArticleMeta
  summary: ArticleSummary
  parts: ArticlePart[]
  /** All word notes flattened, keyed for O(1) lookup. */
  noteIndex: Record<string, WordNote>
  /** Words flagged forgotten/vague/familiar (lower-cased sets). */
  wordStatus: WordStatusSets
  /** Source identifier: "maimemo" date or "import". */
  source: { kind: "maimemo"; date: string } | { kind: "import"; id: string }
}

/** Lower-cased word → status lookup (internal, Set-based for O(1) tokenizing). */
export interface WordStatusLookup {
  forget: Set<string>
  vague: Set<string>
  familiar: Set<string>
}

/** Lower-cased word → status sets (serializable — arrays survive JSON). */
export interface WordStatusSets {
  forget: string[]
  vague: string[]
  familiar: string[]
}

/** Tiered dictionary lookup result. */
export interface DictEntry {
  word: string
  /** Which provider answered. */
  source: "embedded" | "eudic" | "freedict" | "none"
  /** Chinese translation / gloss (Eudic exp or embedded meaning). */
  exp?: string
  /** Phonetic transcription. */
  phonetic?: string
  /** Structured definitions (from Free Dictionary API). */
  definitions?: DictDefinition[]
  /** Audio pronunciation URL (Free Dictionary API). */
  audio?: string
  /** Whether the word is already saved in the Eudic wordbook. */
  saved?: boolean
  /** Star rating if saved in Eudic. */
  star?: number
}

export interface DictDefinition {
  partOfSpeech?: string
  text: string
  example?: string
}

/** A normalized voice available for TTS. */
export interface Voice {
  name: string
  /** Display label (character name without _lang suffix). */
  label: string
  lang: string
  gpt: string
  sov: string
  ref: string
  refOk: boolean
  /** Group for the selector; "voice_list" pinned to top. */
  group: "voice_list" | "other" | "base"
}

/** Grouped voice catalog returned by /api/voices. */
export interface VoiceCatalog {
  voiceList: Voice[]
  other: Voice[]
  base: Voice[]
}

/** A synthesized TTS segment (one sentence → one audio item). */
export interface TtsSegment {
  id: string
  text: string
  /** URL the client can stream/play. */
  audioUrl: string
  /** Duration in seconds, if known. */
  duration?: number
}

/** Manifest returned by the TTS synthesize endpoint. */
export interface TtsManifest {
  voice: string
  cacheKey: string
  segments: TtsSegment[]
}
