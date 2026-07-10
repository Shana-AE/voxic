import { Pool } from "pg"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { useRuntimeConfig } from "#imports"

let _pool: Pool | null = null
let _triedConfig = false

/**
 * Read a password from a libpq-style ~/.pgpass file for the matching
 * host:port:database:user entry (supports `*` wildcards). Mirrors the behavior
 * of psycopg2/libpq used by the MaiMemo cron, so the app works without storing
 * the password in .env.
 */
function readPgpass(
  filePath: string,
  host: string,
  port: number,
  dbname: string,
  user: string,
): string | null {
  const path = filePath.replace(/^~(?=$|\/|\\)/, homedir())
  if (!existsSync(path)) return null
  const content = readFileSync(path, "utf8")
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    // Format: hostname:port:database:username:password
    const parts = line.split(":")
    if (parts.length < 5) continue
    const [h, p, d, u, ...rest] = parts
    const pw = rest.join(":") // password may contain colons
    const match = (val: string, want: string) => val === "*" || val === want
    if (match(h!, host) && match(p!, String(port)) && match(d!, dbname) && match(u!, user)) {
      return pw
    }
  }
  return null
}

/**
 * Get the Postgres connection pool (singleton). Returns null when PG is not
 * configured (pgHost empty) so callers can fall back to the NAS-JSON path.
 */
export function getPgPool(): Pool | null {
  if (_pool) return _pool
  if (_triedConfig) return _pool
  _triedConfig = true

  const cfg = useRuntimeConfig()
  if (!cfg.pgHost) return null

  const password =
    cfg.pgPassword ||
    readPgpass(cfg.pgPassFile, cfg.pgHost, cfg.pgPort, cfg.pgDbname, cfg.pgUser) ||
    ""

  _pool = new Pool({
    host: cfg.pgHost,
    port: cfg.pgPort,
    database: cfg.pgDbname,
    user: cfg.pgUser,
    password,
    connectionTimeoutMillis: 8000,
    max: 4,
  })
  return _pool
}
