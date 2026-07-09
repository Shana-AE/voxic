import { readFileSync } from "node:fs"
import { useRuntimeConfig } from "#imports"

/**
 * Load the Eudic API token: runtimeConfig.eudicToken (env) first, then fall
 * back to scanning the configured secrets file for an `EUDIC_TOKEN=...` line
 * (same convention the MaiMemo cron uses for MAIMEMO_TOKEN).
 */
export function getEudicToken(): string {
  const cfg = useRuntimeConfig()
  if (cfg.eudicToken) return cfg.eudicToken
  const secretsPath = cfg.eudicSecretsPath
  try {
    const content = readFileSync(secretsPath, "utf8")
    for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("EUDIC_TOKEN=")) {
      // Take everything after the FIRST "=" — the token may itself contain "="
      // (JS split("=", n) truncates the array, unlike Python's split("=", 1)).
      return trimmed.slice(trimmed.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")
    }
    }
  } catch {
    // secrets file missing — token stays empty, dict lookup skips Eudic
  }
  return ""
}
