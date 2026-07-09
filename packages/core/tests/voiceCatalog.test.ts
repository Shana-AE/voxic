import { describe, expect, it } from "vitest"
import { buildVoiceCatalog, parseVoiceListFile } from "../src/voiceCatalog"

const raw = {
  voices: [
    { name: "Lancet-2_en", gpt: "/g/Lancet-2_en.ckpt", sov: "/s/Lancet-2_en.pth", ref: "/r/Lancet-2_en/ref.wav", ref_ok: true },
    { name: "Lancet-2_ja", gpt: "/g/Lancet-2_ja.ckpt", sov: "/s/Lancet-2_ja.pth", ref: "/r/Lancet-2_ja/ref.wav", ref_ok: true },
    { name: "凯尔希_en", gpt: "/g/凯尔希_en.ckpt", sov: "/s/凯尔希_en.pth", ref: "/r/凯尔希_en/ref.wav", ref_ok: true },
    { name: "Broken_en", gpt: "/g/Broken_en.ckpt", sov: "/s/Broken_en.pth", ref: "/r/Broken_en/ref.wav", ref_ok: false },
  ],
}

const voiceList = parseVoiceListFile("Lancet-2_en\nLancet-2_ja\n# comment\n凯尔希_en\n")

describe("buildVoiceCatalog", () => {
  const catalog = buildVoiceCatalog(raw, voiceList)

  it("puts voice_list voices in the top group", () => {
    expect(catalog.voiceList.map((v) => v.name)).toEqual([
      "Lancet-2_en",
      "凯尔希_en",
      "Lancet-2_ja",
    ])
  })

  it("prioritizes English within the voice_list group", () => {
    const names = catalog.voiceList.map((v) => v.name)
    expect(names.indexOf("Lancet-2_en")).toBeLessThan(names.indexOf("Lancet-2_ja"))
  })

  it("excludes ref_ok=false from usable voices", () => {
    expect(catalog.voiceList.find((v) => v.name === "Broken_en")).toBeUndefined()
  })

  it("splits label and lang from the name", () => {
    const v = catalog.voiceList.find((x) => x.name === "Lancet-2_en")!
    expect(v.label).toBe("Lancet-2")
    expect(v.lang).toBe("en")
  })
})

describe("parseVoiceListFile", () => {
  it("ignores blanks and comments", () => {
    const set = parseVoiceListFile("a\n\n# c\nb\n")
    expect([...set]).toEqual(["a", "b"])
  })
})
