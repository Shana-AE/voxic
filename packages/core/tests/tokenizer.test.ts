import { describe, expect, it } from "vitest"
import { splitSentences, tokenizeSentence, wordKey } from "../src/tokenizer"

describe("wordKey", () => {
  it("lower-cases and normalizes apostrophes", () => {
    expect(wordKey("Don't")).toBe("don't")
    expect(wordKey("Well-Known")).toBe("well-known")
  })
})

describe("tokenizeSentence", () => {
  it("separates words, spaces, and punctuation", () => {
    const tokens = tokenizeSentence("Hello, world!")
    const kinds = tokens.map((t) => t.type)
    expect(kinds).toEqual(["word", "punct", "space", "word", "punct"])
    expect(tokens[0]!.value).toBe("Hello")
    expect(tokens[0]!.key).toBe("hello")
  })

  it("flags target words via word-status sets", () => {
    const tokens = tokenizeSentence("The pomposity was unbearable.", {
      wordStatus: {
        forget: new Set(["pomposity"]),
        vague: new Set(),
        familiar: new Set(),
      },
    })
    const target = tokens.find((t) => t.key === "pomposity")
    expect(target?.target).toBe("forget")
  })

  it("flags bold words when provided", () => {
    const tokens = tokenizeSentence("A connoisseur of fine events.", {
      boldWords: new Set(["connoisseur"]),
    })
    const target = tokens.find((t) => t.key === "connoisseur")
    expect(target?.target).toBe("bold")
  })

  it("preserves character offsets", () => {
    const tokens = tokenizeSentence("Hi there.")
    const word = tokens.find((t) => t.value === "Hi")
    expect(word?.start).toBe(0)
    expect(word?.end).toBe(2)
  })
})

describe("splitSentences", () => {
  it("splits at sentence-ending punctuation", () => {
    const s = splitSentences("Hello world. How are you? I am fine!")
    expect(s).toEqual(["Hello world.", "How are you?", "I am fine!"])
  })

  it("handles trailing text without a terminator", () => {
    const s = splitSentences("One sentence. And a tail")
    expect(s).toEqual(["One sentence.", "And a tail"])
  })

  it("returns empty for blank input", () => {
    expect(splitSentences("   ")).toEqual([])
  })
})
