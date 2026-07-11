import { spawn } from "node:child_process"
import { useRuntimeConfig } from "#imports"

// A stale SMB mount (common after a reboot/network blip) makes synchronous
// fs calls (readdirSync/readFileSync) block forever, which freezes the whole
// Node event loop. To keep the server responsive, probe the NAS in a child
// process with a hard timeout; routes guard on this and return 503 instead of
// hanging when the mount is stale. The mount recovering is the real fix (remount).

let _healthy: boolean | null = null
let _checkedAt = 0
const TTL_MS = 10_000

/**
 * Probe whether the NAS root is responsive. Runs `ls` in a child process with a
 * hard timeout so a stale mount can't block the caller. Cached for TTL_MS.
 */
export function probeNas(force = false): Promise<boolean> {
  const now = Date.now()
  if (!force && _healthy !== null && now - _checkedAt < TTL_MS) {
    return Promise.resolve(_healthy)
  }
  const cfg = useRuntimeConfig()
  const root = cfg.maimemoNasRoot
  if (!root) return Promise.resolve(false)
  return new Promise((resolve) => {
    const timeoutMs = 4000
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      _healthy = ok
      _checkedAt = Date.now()
      resolve(ok)
    }
    const proc = spawn("ls", ["-A", root], { stdio: ["ignore", "ignore", "ignore"] })
    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL") } catch {}
      finish(false)
    }, timeoutMs)
    proc.on("error", () => { clearTimeout(timer); finish(false) })
    proc.on("exit", (code) => { clearTimeout(timer); finish(code === 0) })
  })
}

/** True if the last probe considered the NAS healthy (non-blocking, cached). */
export function nasLastKnownHealthy(): boolean {
  return _healthy === true
}
