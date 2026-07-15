import { exec } from "node:child_process"
import { useRuntimeConfig } from "#imports"

/**
 * POST /api/tts/sync-dict — check all MaiMemo words against the GPT-SoVITS
 * phoneme dictionaries and add missing ones to engdict-hot.rep (via the Python
 * sync script + g2p_en). Returns a summary. Requires a GPT-SoVITS restart to
 * take effect (noted in the response).
 */
export default defineEventHandler((event) => {
  const cfg = useRuntimeConfig()
  const script = cfg.syncScriptPath || "scripts/sync_missing_phonemes.py"
  const python = cfg.gptsovitsPython || "python3"

  return new Promise((resolve) => {
    exec(
      `${python} ${script}`,
      { timeout: 120_000, cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (err) {
          setResponseStatus(event, 500)
          resolve({
            ok: false,
            error: err.message,
            stdout: stdout.trim(),
            stderr: stderr.trim().slice(0, 300),
          })
        } else {
          resolve({ ok: true, output: stdout.trim() })
        }
      },
    )
  })
})
