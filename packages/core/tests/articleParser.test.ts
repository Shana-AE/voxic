import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { parseArticle, parseImportedText } from "../src/articleParser"

const __dirname = dirname(fileURLToPath(import.meta.url))
const sample = readFileSync(resolve(__dirname, "fixtures/sample-article.md"), "utf8")

describe("parseArticle", () => {
  const parsed = parseArticle(sample, { kind: "maimemo", date: "2026-07-05" })

  it("parses frontmatter metadata", () => {
    expect(parsed.meta.date).toBe("2026-07-05")
    expect(parsed.meta.forgetCount).toBe(2)
    expect(parsed.meta.vagueCount).toBe(3)
    expect(parsed.meta.tags).toContain("maimemo")
  })

  it("extracts the title", () => {
    expect(parsed.meta.title).toContain("MaiMemo Daily Story")
  })

  it("parses the summary callout into word-status sets", () => {
    expect(parsed.summary.forget).toEqual(["pomposity", "vicious"])
    expect(parsed.summary.vague).toEqual(["blatant", "defiance", "connoisseur"])
    expect(parsed.wordStatus.forget.includes("pomposity")).toBe(true)
    expect(parsed.wordStatus.vague.includes("connoisseur")).toBe(true)
  })

  it("splits the body into parts by ## headers", () => {
    expect(parsed.parts.length).toBeGreaterThanOrEqual(1)
    expect(parsed.parts[0]!.title).toContain("Pomposity")
  })

  it("attaches Chinese translation callout to the part", () => {
    expect(parsed.parts[0]!.translation).toContain("自负")
  })

  it("parses word-note blocks with fields", () => {
    const note = parsed.noteIndex["pomposity"]
    expect(note).toBeDefined()
    expect(note!.isForgotten).toBe(true)
    expect(note!.phonetic).toBe("pɒmˈpɒsəti")
    expect(note!.meaning).toContain("自负")
    expect(note!.example).toContain("professor")
    expect(note!.memoryTip).toContain("pomp")
  })

  it("marks non-forgotten notes correctly", () => {
    expect(parsed.noteIndex["grandiloquence"]!.isForgotten).toBe(false)
  })

  it("strips bold markers and emoji from paragraph text", () => {
    const p = parsed.parts[0]!.paragraphs[0]!
    expect(p.text).not.toContain("**")
    expect(p.text).toContain("orgy of pomposity")
  })

  it("tokenizes paragraphs into sentences with word tokens", () => {
    const p = parsed.parts[0]!.paragraphs[0]!
    expect(p.sentences.length).toBeGreaterThan(0)
    const words = p.sentences[0]!.tokens.filter((t) => t.type === "word")
    expect(words.length).toBeGreaterThan(0)
  })

  it("flags target words from bold + status sets", () => {
    const allTokens = parsed.parts[0]!.paragraphs.flatMap((p) =>
      p.sentences.flatMap((s) => s.tokens),
    )
    const pomposity = allTokens.find((t) => t.key === "pomposity")
    expect(pomposity?.target).toBeDefined()
  })
})

describe("parseImportedText", () => {
  it("wraps arbitrary text in a single part", () => {
    const parsed = parseImportedText(
      "The quick brown fox jumps over the lazy dog. It was a good day.",
      "abc123",
    )
    expect(parsed.source.kind).toBe("import")
    expect(parsed.parts.length).toBe(1)
    expect(parsed.parts[0]!.paragraphs[0]!.sentences.length).toBe(2)
  })
})
