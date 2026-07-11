#!/usr/bin/env bash
# Voxic production launcher (called by the launchd LaunchAgent, or manually).
# Production Nuxt does not auto-load .env, so source it here, then run the
# Nitro server. Override the port/host via the environment if needed.
set -euo pipefail
cd "$(dirname "$0")"

# Load NUXT_* vars from .env (single source of truth).
if [ -f ./.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export PORT="${PORT:-4321}"
export NITRO_PORT="${PORT}"
export HOST="${NUXT_HOST:-0.0.0.0}"
export NITRO_HOST="${HOST}"
export NUXT_HOST="${HOST}"
export NODE_ENV=production

# launchd runs with a minimal PATH — resolve the same Node used at build time
# (better-sqlite3 is a native addon and must match the runtime Node ABI).
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
[ -z "$NODE_BIN" ] && NODE_BIN="/opt/homebrew/bin/node"
exec "$NODE_BIN" .output/server/index.mjs
