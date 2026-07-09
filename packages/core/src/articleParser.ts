import type {
  ArticleMeta,
  ArticlePart,
  ArticleSummary,
  Paragraph,
  ParsedArticle,
  Token,
  WordNote,
  WordStatusLookup,
  WordStatusSets,
} from "./types"
import { tokenizeParagraph, tokenizeSentence, wordKey } from "./tokenizer"

/** Strip markdown emphasis/emoji noise from English paragraph text. */
function cleanInline(text: string): { text: string; boldWords: Set<string> } {
  const boldWords = new Set<string>()
  // Capture **bold** words before stripping.
  const boldRe = /\*\*([^*]+)\*\*/g
  let m: RegExpExecArray | null
  while ((m = boldRe.exec(text)) !== null) {
    // A bold span may be a phrase; record each word in it.
    for (const w of m[1]!.match(/[A-Za-zÀ-ÿ''-]+/g) ?? []) boldWords.add(wordKey(w))
  }
  // Strip bold markers and the 🗑️/🌀/✅/📊/📖 inline emojis that clutter TTS/reading.
  let out = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, "")
  out = out.replace(/\s+/g, " ").trim()
  return { text: out, boldWords }
}

/** Clean a `## ` title (strip markdown/emoji) and tokenize it into clickable tokens. */
function makeTitle(raw: string, lookup: WordStatusLookup): { title: string; titleTokens: Token[] } {
  const { text, boldWords } = cleanInline(raw)
  return { title: text, titleTokens: tokenizeSentence(text, { wordStatus: lookup, boldWords }) }
}

/** Parse simple YAML frontmatter into a record (handles `key: value` + list items). */
function parseFrontmatter(raw: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  let curKey: string | null = null
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    const listMatch = /^\s+-\s+(.+)$/.exec(line)
    if (listMatch && curKey) {
      const prev = out[curKey]
      const arr = Array.isArray(prev) ? prev : prev ? [prev] : []
      arr.push(listMatch[1]!.trim())
      out[curKey] = arr
      continue
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (kv) {
      curKey = kv[1]!
      const val = kv[2]!.trim()
      out[curKey] = val
    }
  }
  return out
}

/** Extract a comma-separated word list from inside **bold** spans on a line. */
function extractBoldWordList(line: string): string[] {
  const words: string[] = []
  const re = /\*\*([^*]+)\*\*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    for (const w of m[1]!.match(/[A-Za-zÀ-ÿ''-]+/g) ?? []) words.push(wordKey(w))
  }
  return words
}

/** Parse the `> [!info]` summary callout into structured summary + word sets. */
function parseSummaryCallout(lines: string[]): {
  summary: ArticleSummary
  lookup: WordStatusLookup
} {
  const summary: ArticleSummary = { forget: [], vague: [], familiar: [] }
  const lookup: WordStatusLookup = {
    forget: new Set(),
    vague: new Set(),
    familiar: new Set(),
  }
  for (const raw of lines) {
    const line = raw.replace(/^>\s?/, "")
    const studied = /Studied[^]*?(\d[\d,]*)\s*word/i.exec(line)
    if (studied) summary.studied = Number(studied[1]!.replace(/,/g, ""))
    const total = /(\d[\d,]*)\s*\/\s*(\d[\d,]*)/.exec(line)
    if (total && summary.total === undefined) {
      summary.total = Number(total[2]!.replace(/,/g, ""))
    }
    const time = /Time[^]*?(\d[\d,]*)\s*min/i.exec(line)
    if (time) summary.studyMin = Number(time[1]!.replace(/,/g, ""))

    // Word lists appear after the em dash "—"; the label (e.g. **Forgot**) is
    // also bold, so only extract from the tail to avoid capturing label words.
    const dashIdx = line.indexOf("—")
    const tail = dashIdx >= 0 ? line.slice(dashIdx + 1) : ""
    if (/Forgot/i.test(line) || /🗑️/u.test(line)) {
      const w = extractBoldWordList(tail)
      summary.forget = w
      w.forEach((x) => lookup.forget.add(x))
    } else if (/Vague/i.test(line) || /🌀/u.test(line)) {
      const w = extractBoldWordList(tail)
      summary.vague = w
      w.forEach((x) => lookup.vague.add(x))
    } else if (/Familiar/i.test(line) || /✅/u.test(line)) {
      const w = extractBoldWordList(tail)
      summary.familiar = w
      w.forEach((x) => lookup.familiar.add(x))
    }
  }
  return { summary, lookup }
}

/** Parse a single `> **word** ...` note header + following field lines. */
function parseWordNote(headerLine: string, fieldLines: string[], raw: string): WordNote {
  // headerLine like: "**pomposity** 🗑️ /pɒmˈpɒsəti/"  (already stripped of leading "> ")
  const wordMatch = /^\*\*([^*]+)\*\*/.exec(headerLine)
  const word = wordMatch ? wordMatch[1]!.trim() : headerLine.trim()
  const isForgotten = /🗑️/u.test(headerLine)
  const phonMatch = /\/([^/]+)\//.exec(headerLine)
  const phonetic = phonMatch ? phonMatch[1]!.trim() : undefined

  const note: WordNote = {
    word,
    key: wordKey(word),
    isForgotten,
    phonetic,
    raw,
  }

  for (const fl of fieldLines) {
    const fm = /^-\s+\*\*([^*]+)\*\*\s*[:：]\s*(.*)$/.exec(fl)
    if (!fm) continue
    const field = fm[1]!.trim().toLowerCase()
    const val = fm[2]!.trim()
    switch (field) {
      case "meaning":
        note.meaning = val
        break
      case "usage note":
      case "usage":
        note.usage = val
        break
      case "common contexts":
      case "contexts":
        note.contexts = val
        break
      case "example":
        note.example = val
        break
      case "collocation":
        note.collocation = val
        break
      case "confusable":
        note.confusable = val
        break
      case "memory tip":
      case "tip":
        note.memoryTip = val
        break
    }
  }
  return note
}

/** Parse a `> [!note]` callout body into WordNote[]. */
function parseNoteCallout(body: string[]): WordNote[] {
  const notes: WordNote[] = []
  let i = 0
  while (i < body.length) {
    const line = body[i]!
    const stripped = line.replace(/^>\s?/, "")
    // A note header starts with "**word**" and is not a field line ("- **...**:").
    if (/^\*\*[^*]+\*\*/.test(stripped) && !/^-\s/.test(stripped)) {
      const rawLines: string[] = [line]
      const fieldLines: string[] = []
      let j = i + 1
      while (j < body.length) {
        const fl = body[j]!.replace(/^>\s?/, "")
        if (/^\*\*[^*]+\*\*/.test(fl) && !/^-\s/.test(fl)) break
        if (!fl.trim()) {
          rawLines.push(body[j]!)
          j++
          continue
        }
        fieldLines.push(fl)
        rawLines.push(body[j]!)
        j++
      }
      notes.push(parseWordNote(stripped, fieldLines, rawLines.join("\n")))
      i = j
    } else {
      i++
    }
  }
  return notes
}

interface CalloutBlock {
  type: "info" | "quote" | "note" | "other"
  title?: string
  body: string[] // raw lines including leading "> "
}

/** Group consecutive `>` lines into callout blocks. */
function extractCallouts(lines: string[]): { text: string[]; callouts: CalloutBlock[] } {
  const text: string[] = []
  const callouts: CalloutBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (/^>\s?/.test(line)) {
      const block: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        block.push(lines[i]!)
        i++
      }
      const header = block[0]!.replace(/^>\s?/, "")
      const cm = /^\[!([^\]]+)\]\s*-?\s*(.*)$/.exec(header)
      const type = cm ? (cm[1]!.toLowerCase() as CalloutBlock["type"]) : "other"
      const title = cm ? cm[2] : header
      const body = type !== "other" ? block.slice(1) : block
      callouts.push({ type: (type as CalloutBlock["type"]) || "other", title, body })
    } else {
      text.push(line)
      i++
    }
  }
  return { text, callouts }
}

/**
 * Parse a daily-story markdown article into the canonical ParsedArticle.
 * Accepts arbitrary English text too (produces a single untitled part).
 */
export function parseArticle(markdown: string, source: ParsedArticle["source"]): ParsedArticle {
  // 1. Frontmatter
  let body = markdown
  let meta: ArticleMeta = {
    date: source.kind === "maimemo" ? source.date : new Date().toISOString().slice(0, 10),
    title: "Untitled",
    tags: [],
  }
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(markdown)
  if (fmMatch) {
    const fm = parseFrontmatter(fmMatch[1]!)
    if (typeof fm.date === "string") meta.date = fm.date
    if (typeof fm.forget_count === "string") meta.forgetCount = Number(fm.forget_count)
    if (typeof fm.vague_count === "string") meta.vagueCount = Number(fm.vague_count)
    if (typeof fm.familiar_count === "string") meta.familiarCount = Number(fm.familiar_count)
    if (Array.isArray(fm.tags)) meta.tags = fm.tags
    body = markdown.slice(fmMatch[0]!.length)
  }

  // 2. Title
  const titleMatch = /^#\s+(.+)$/m.exec(body)
  if (titleMatch) {
    meta.title = titleMatch[1]!.trim()
    body = body.slice(0, titleMatch.index!) + body.slice(titleMatch.index! + titleMatch[0]!.length)
  }

  // 3. Split into parts by ## headers (but keep callouts associated)
  const lines = body.split("\n")
  let summary: ArticleSummary = { forget: [], vague: [], familiar: [] }
  let lookup: WordStatusLookup = {
    forget: new Set(),
    vague: new Set(),
    familiar: new Set(),
  }
  const parts: ArticlePart[] = []
  let currentPart: ArticlePart | null = null
  let pendingCalloutForPart = false

  const flushParagraphBuffer = (part: ArticlePart, buf: string[]) => {
    const joined = buf.join(" ").trim()
    if (!joined) return
    const { text, boldWords } = cleanInline(joined)
    if (!text) return
    const sentences = tokenizeParagraph(text, { wordStatus: lookup, boldWords })
    part.paragraphs.push({ text, sentences } as Paragraph)
  }

  const ensurePart = (): ArticlePart => {
    if (!currentPart) {
      currentPart = { title: "Story", titleTokens: [], paragraphs: [], notes: [] }
      parts.push(currentPart)
    }
    return currentPart
  }

  let paraBuf: string[] = []
  const flushPara = () => {
    if (currentPart && paraBuf.length) {
      flushParagraphBuffer(currentPart, paraBuf)
      paraBuf = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    // ## Part header
    const partHeader = /^##\s+(.+)$/.exec(line)
    if (partHeader) {
      flushPara()
      const { title, titleTokens } = makeTitle(partHeader[1]!, lookup)
      currentPart = { title, titleTokens, paragraphs: [], notes: [] }
      parts.push(currentPart)
      pendingCalloutForPart = true
      i++
      continue
    }

    // Callout block (consecutive > lines)
    if (/^>\s?/.test(line)) {
      flushPara()
      const block: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        block.push(lines[i]!)
        i++
      }
      const header = block[0]!.replace(/^>\s?/, "")
      const cm = /^\[!([^\]]+)\]\s*-?\s*(.*)$/.exec(header)
      const ctype = cm ? cm[1]!.toLowerCase() : "other"
      const cbody = cm ? block.slice(1) : block

      if (ctype === "info") {
        const { summary: s, lookup: l } = parseSummaryCallout(cbody)
        summary = s
        lookup = l
      } else if (ctype === "quote") {
        const part = ensurePart()
        part.translation = cbody.map((l) => l.replace(/^>\s?/, "")).join("\n").trim()
      } else if (ctype === "note") {
        const part = ensurePart()
        part.notes.push(...parseNoteCallout(cbody))
      } else {
        // Bare `>` blocks (no [!callout] header) that follow a [!note] callout
        // are continuation word-note blocks — articles separate notes with blank
        // lines, which breaks them into independent `>` runs. Parse any block
        // whose first content line looks like a "**word**" note header.
        const firstContent = (cbody[0] || "").replace(/^>\s?/, "")
        if (/^\*\*[^*]+\*\*/.test(firstContent) && !/^-\s/.test(firstContent)) {
          const part = ensurePart()
          part.notes.push(...parseNoteCallout(cbody))
        }
      }
      pendingCalloutForPart = true
      continue
    }

    // Blank line: paragraph separator
    if (!line.trim()) {
      flushPara()
      i++
      continue
    }

    // # headers (skip deeper headings)
    if (/^#/.test(line)) {
      i++
      continue
    }

    // English paragraph line
    ensurePart()
    paraBuf.push(line)
    i++
  }  flushPara()

  // 4. Build note index
  const noteIndex: Record<string, WordNote> = {}
  for (const part of parts) {
    for (const note of part.notes) noteIndex[note.key] = note
  }

  if (parts.length === 0) {
    parts.push({ title: "Story", titleTokens: [], paragraphs: [], notes: [] })
  }

  // Convert the internal Set-based lookup to serializable arrays for output.
  const wordStatus: WordStatusSets = {
    forget: [...lookup.forget],
    vague: [...lookup.vague],
    familiar: [...lookup.familiar],
  }

  return { meta, summary, parts, noteIndex, wordStatus, source }
}

/** Parse arbitrary pasted English text (no frontmatter/callouts expected). */
export function parseImportedText(text: string, id: string): ParsedArticle {
  const cleaned = text.replace(/\r\n/g, "\n").trim()
  const md = `# Imported Text\n\n${cleaned}`
  return parseArticle(md, { kind: "import", id })
}
