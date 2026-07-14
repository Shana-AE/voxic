import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

/**
 * Cached daily-story articles. The raw markdown + the parsed JSON are stored so
 * the reader works even when the NAS is briefly unmounted. `date` is the
 * MaiMemo study date (YYYY-MM-DD); imports use a synthetic id.
 */
export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(), // "maimemo" | "import"
  forgetCount: integer("forget_count"),
  vagueCount: integer("vague_count"),
  familiarCount: integer("familiar_count"),
  rawMarkdown: text("raw_markdown").notNull(),
  parsedJson: text("parsed_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

/** Tracks synthesized TTS audio files on disk (one row per segment). */
export const ttsCache = sqliteTable("tts_cache", {
  cacheKey: text("cache_key").primaryKey(),
  voice: text("voice").notNull(),
  segIndex: integer("seg_index").notNull(),
  text: text("text").notNull(),
  audioPath: text("audio_path").notNull(),
  duration: integer("duration"),
  createdAt: integer("created_at").notNull(),
})

/**
 * AI-generated flashcard data per word (DeepSeek via Qiniu). Generated once,
 * cached forever (a word's definition/example don't change). Powers the
 * daily-words card page + 随身听 audio mode.
 */
export const wordCards = sqliteTable("word_cards", {
  word: text("word").primaryKey(),
  phonetic: text("phonetic"),
  cnDef: text("cn_def"),
  exampleEn: text("example_en"),
  exampleZh: text("example_zh"),
  generatedAt: integer("generated_at").notNull(),
})


/**
 * Per-word spaced-repetition state (phase 2 review drills). SM-2 fields.
 * Populated from MaiMemo FORGET/VAGUE buckets; updated as the user drills.
 */
export const reviewState = sqliteTable("review_state", {
  word: text("word").primaryKey(),
  status: text("status").notNull(), // "forget" | "vague" | "familiar" | "learned"
  /** SM-2 ease factor (multiplied by 1000 as integer). */
  ease: integer("ease").notNull().default(2500),
  intervalDays: integer("interval_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  dueAt: integer("due_at").notNull(),
  lastReviewedAt: integer("last_reviewed_at"),
  updatedAt: integer("updated_at").notNull(),
})
