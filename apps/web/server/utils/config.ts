import { readFileSync } from "node:fs"
import { useRuntimeConfig } from "#imports"

/**
 * Read a `NAME=value` line from the configured secrets file (the same
 * ~/.shanaae/configs/.secrets the MaiMemo/Eudic crons use). Returns "" if the
 * file or key is missing. Keeps real keys out of source / .env.
 */
export function readSecret(name: string): string {
  const cfg = useRuntimeConfig()
  const secretsPath = cfg.eudicSecretsPath
  if (!secretsPath) return ""
  try {
    const content = readFileSync(secretsPath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`${name}=`)) {
        return trimmed.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "")
      }
    }
  } catch {
    // file missing
  }
  return ""
}

/**
 * Load the Eudic API token: runtimeConfig.eudicToken (env) first, then fall
 * back to scanning the secrets file for an `EUDIC_TOKEN=...` line.
 */
export function getEudicToken(): string {
  const cfg = useRuntimeConfig()
  if (cfg.eudicToken) return cfg.eudicToken
  return readSecret("EUDIC_TOKEN")
}

/** Load the AI gateway key: runtimeConfig.aiApiKey, else QINIU_AI_API_KEY from secrets. */
export function getAiKey(): string {
  const cfg = useRuntimeConfig()
  if (cfg.aiApiKey) return cfg.aiApiKey
  return readSecret("QINIU_AI_API_KEY")
}
