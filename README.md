# Voxic — Interactive English Reading & Vocabulary Studio

Read MaiMemo daily-story articles (or any pasted English text) with **clickable words** that show definitions, and a **bottom TTS player** powered by your local GPT-SoVITS voices. Built to run on the Mac, accessible from your phone / Huawei Pura X over LAN.

## Why

MaiMemo already does spaced repetition + generates daily bilingual stories, but reviewing is slow when FORGET/VAGUE words recycle. Voxic turns those stories into an **interactive reading surface** — click any word for its definition (embedded notes → Eudic → Free Dictionary), and listen along with sentence-level TTS in your trained character voices. A phase-2 review module will drill problem words deeper.

## Stack

- **Nuxt 4** + TypeScript (Nitro server proxies all backends → phone needs only LAN URL)
- **UnoCSS** + **Reka UI** + **Pinia** + **VueUse**
- **Drizzle ORM** + **better-sqlite3** (article cache + TTS audio cache + phase-2 review state)
- **`@voxic/core`** — pure, fully unit-tested TS package: article parser, tokenizer, dict client, voice catalog, TTS request builder
- pnpm workspace monorepo

## Architecture

```
~/projects/voxic/
├─ apps/web/                 Nuxt 4 app
│  ├─ app/                   client: pages, components, stores
│  ├─ server/api/            proxy routes (NAS, GPT-SoVITS, Eudic)
│  ├─ server/db/             Drizzle schema + SQLite
│  └─ data/                  app.db + tts/ audio cache (gitignored)
└─ packages/core/            pure TS, vitest-tested
```

### Server routes (all backends proxied so the phone works over LAN)

| Route                       | Purpose                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| `GET  /api/articles`          | List MaiMemo daily stories (NAS) + cached imports                     |
| `GET  /api/articles/:id`      | Parsed article + word-status buckets (cached in SQLite)               |
| `POST /api/import`            | Parse + cache arbitrary English text                                  |
| `GET  /api/dict/:word`        | Tiered lookup: embedded note → Eudic → Free Dictionary API            |
| `POST /api/eudic/word`        | Save a word to your Eudic wordbook                                    |
| `GET  /api/voices`            | Voice catalog (voice_list character voices pinned to top)             |
| `POST /api/tts/synthesize`    | Sentence-level TTS manifest (cached MP3s) via GPT-SoVITS              |
| `GET  /api/tts/audio/:file`   | Stream a cached TTS MP3                                               |

## Setup

### Prerequisites

- Node ≥ 20, pnpm, ffmpeg
- GPT-SoVITS API running at `http://127.0.0.1:9880` (with `/register_speaker` + root `/` TTS)
- A directory of MaiMemo daily articles + word JSON (set `MAIMEMO_NAS_ROOT`)
- An Eudic API token — either `EUDIC_TOKEN` or a secrets file with an `EUDIC_TOKEN=...` line (set `EUDIC_SECRETS_PATH`)

### Install & run

```bash
cd ~/projects/voxic
pnpm install
pnpm dev          # http://localhost:3000  (also http://<mac-lan-ip>:3000 from phone)
```

For LAN access from your phone/Pura X, run `pnpm dev --host` (or set `NUXT_HOST=0.0.0.0`) and open `http://<your-mac-ip>:3000` on the device — the Nuxt server proxies GPT-SoVITS, NAS, and Eudic so the phone needs nothing special.

### Configuration

Copy `apps/web/.env.example` to `apps/web/.env` and fill in your paths (all required; Nuxt maps them via the `NUXT_` prefix):

```
NUXT_MAIMEMO_NAS_ROOT=/path/to/maimemo/data
NUXT_GPTSOVITS_BASE=http://127.0.0.1:9880
NUXT_VOICE_ROTATION_PATH=/path/to/voice_rotation.json
NUXT_VOICE_LIST_PATH=/path/to/voice_list_local.txt
NUXT_EUDIC_TOKEN=              # or set NUXT_EUDIC_SECRETS_PATH to a file with an EUDIC_TOKEN= line
```

## Usage

1. **Home** lists your MaiMemo daily stories (newest first) with forget/vague counts.
2. **Read any text**: paste an article/lyrics/notes → every word becomes clickable with TTS.
3. In the **reader**: click a word → floating panel shows its definition (embedded note first, then Eudic, then Free Dictionary), phonetic, example, memory tip, and a **Save to Eudic** button. Forgotten words are red-wavy-underlined, vague words amber-dashed.
4. **▶ Play article** synthesizes the whole text (sentence-by-sentence) with the selected voice; the **bottom player bar** lets you prev/next/repeat-sentence, change speed, and switch voices (character voices pinned to top).
5. Show/hide the Chinese translation per section.

## Scripts

```bash
pnpm dev          # dev server (apps/web)
pnpm build        # production build
pnpm test         # vitest (core)
pnpm typecheck    # tsc/vue-tsc across the workspace
```

## Dictionary note

Eudic's open API only resolves words **already saved** in your wordbook (returns "单词不存在" otherwise) — so it can't be the sole dictionary source. The tiered lookup handles this: daily stories use the rich embedded word notes (zero API, always works); arbitrary text falls back to Free Dictionary API for common words. "Save to Eudic" adds words to your wordbook for future lookup + study.

## Phase 2 (not yet built)

SM-2 spaced-repetition drills targeting your FORGET/VAGUE words with multi-modal recall (cloze, typing, audio-recall) — complements MaiMemo rather than duplicating its basic flashcards. The SQLite `review_state` table + `packages/core/src/sr/` stub are laid in for a clean add-on.
