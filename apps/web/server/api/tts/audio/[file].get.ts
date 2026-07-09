import { existsSync, createReadStream } from "node:fs"
import { join, resolve } from "node:path"
import { useRuntimeConfig } from "#imports"

/** GET /api/tts/audio/:file — stream a cached TTS MP3. */
export default defineEventHandler((event) => {
  const file = getRouterParam(event, "file")!
  // Guard against path traversal.
  if (!/^[\w.-]+\.mp3$/.test(file)) {
    throw createError({ statusCode: 400, statusMessage: "invalid filename" })
  }
  const cfg = useRuntimeConfig()
  const dir = cfg.ttsCacheDir.startsWith("/") ? cfg.ttsCacheDir : resolve(process.cwd(), cfg.ttsCacheDir)
  const path = join(dir, file)
  if (!existsSync(path)) {
    throw createError({ statusCode: 404, statusMessage: "audio not found (may have been evicted)" })
  }
  setResponseHeader(event, "Content-Type", "audio/mpeg")
  setResponseHeader(event, "Cache-Control", "public, max-age=86400, immutable")
  return sendStream(event, createReadStream(path))
})
