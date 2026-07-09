import { describe, expect, it } from "vitest"
import {
  buildRegisterSpeakerUrl,
  buildTtsUrl,
  langFromVoiceName,
  promptTextForLang,
  splitForTts,
  ttsCacheKey,
} from "../src/ttsRequest"
import type { Voice } from "../src/types"

const voice = (name: string): Voice => ({
  name,
  label: name.split("_")[0] ?? name,
  lang: langFromVoiceName(name),
  gpt: `/gpt/${name}.ckpt`,
  sov: `/sov/${name}.pth`,
  ref: `/ref/${name}/ref.wav`,
  refOk: true,
  group: "voice_list",
})

describe("langFromVoiceName", () => {
  it("infers language from suffix", () => {
    expect(langFromVoiceName("Lancet-2_en")).toBe("en")
    expect(langFromVoiceName("凱爾希_ja")).toBe("ja")
    expect(langFromVoiceName("云迹_zh")).toBe("zh")
    expect(langFromVoiceName("克洛丝_ko")).toBe("ko")
    expect(langFromVoiceName("plain")).toBe("en")
  })
})

describe("promptTextForLang", () => {
  it("returns a non-empty sample per language", () => {
    for (const lang of ["en", "ja", "zh", "ko"] as const) {
      expect(promptTextForLang(lang).length).toBeGreaterThan(0)
    }
  })
})

describe("buildRegisterSpeakerUrl", () => {
  it("encodes name + both weight paths", () => {
    const url = buildRegisterSpeakerUrl("http://127.0.0.1:9880", voice("Lancet-2_en"))
    expect(url).toContain("/register_speaker")
    expect(url).toContain("name=Lancet-2_en")
    expect(url).toContain("gpt_model_path=")
    expect(url).toContain("sovits_model_path=")
  })
})

describe("buildTtsUrl", () => {
  it("builds a root GET URL with all required params", () => {
    const url = buildTtsUrl("http://127.0.0.1:9880", "Hello world.", voice("Lancet-2_en"))
    expect(url.startsWith("http://127.0.0.1:9880/?")).toBe(true)
    expect(url).toContain("text=Hello+world")
    expect(url).toContain("text_language=en")
    expect(url).toContain("spk=Lancet-2_en")
    expect(url).toContain("refer_wav_path=")
  })
})

describe("splitForTts", () => {
  it("keeps each chunk under maxLen", () => {
    const text = "Sentence one. Sentence two. Sentence three is a bit longer than usual."
    const chunks = splitForTts(text, 30)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30 + 5)
  })

  it("merges a too-short trailing chunk", () => {
    const chunks = splitForTts("A long enough sentence here. Tiny.", 40)
    expect(chunks.length).toBe(1)
  })
})

describe("ttsCacheKey", () => {
  it("is deterministic and differs by input", () => {
    const a = ttsCacheKey("hello", "Lancet-2_en")
    const b = ttsCacheKey("hello", "Lancet-2_en")
    const c = ttsCacheKey("world", "Lancet-2_en")
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
