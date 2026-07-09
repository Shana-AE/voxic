# Voxic — Design Spec

**Date:** 2026-07-09  
**Status:** Approved & implemented (MVP: Reader + TTS)

## Goal

An interactive English-reading + TTS app that turns MaiMemo daily-story articles (and arbitrary pasted text) into a clickable, listenable study surface — addressing slow vocabulary review by adding **deeper, multi-modal exposure** to problem words rather than duplicating MaiMemo's flashcards.

## Decisions (from brainstorming)

- **Access:** Nuxt runs on the Mac; phone/Pura X access over LAN. The Nitro server proxies GPT-SoVITS (`localhost:9880`), NAS data, and Eudic — so the phone needs no special access.
- **Structure:** pnpm monorepo — `apps/web` (Nuxt 4) + `packages/core` (pure TS) + SQLite (Drizzle) for caching & review state.
- **UI:** UnoCSS + Reka UI + Pinia + VueUse. Dark-first, responsive (phone / Pura X inner 7.7" 16:10 / desktop).
- **Dictionary:** tiered — embedded article notes → Eudic (saved words only) → Free Dictionary API. (Eudic's open API can't look up arbitrary unsaved words.)
- **TTS:** GPT-SoVITS via `/register_speaker` (idempotent) + root `/` GET with a generic per-language prompt sentence; sentence-level MP3 playlist cached on disk.
- **Voices:** `voice_rotation.json` voices with `voice_list` membership pinned to the top of the selector, English first.
- **MVP scope:** Reader + TTS. Phase 2 = SM-2 drills for FORGET/VAGUE words.

## Data flow

```
hermes cron → NAS .../YYYY/MM/DD.{md,json} (articles + word status)
                 ↓ (read by Nuxt server, cached in SQLite)
Nuxt /api/articles/:id → ParsedArticle (parts→paragraphs→sentences→tokens, noteIndex, wordStatus)
                 ↓
Reader (clickable words) → /api/dict/:word (tiered) → DefinitionPanel
                       → /api/tts/synthesize (voice) → sentence MP3s → PlayerBar
```

## Key technical notes

- `WordStatusSets` is serializable (arrays); the parser uses an internal `WordStatusLookup` (Sets) for O(1) tokenizing and converts to arrays at the boundary — because `Set` does not survive `JSON.stringify`.
- Eudic token is read from a configured secrets file by slicing after the **first** `=` (the token contains `=`; JS `split("=", n)` would truncate it, unlike Python's `split("=", 1)`).
- TTS contract (verified working): `GET /register_speaker?name=&gpt_model_path=&sovits_model_path=` then `GET /?refer_wav_path=&prompt_text=&prompt_language=&text=&text_language=en&spk=<name>` → WAV (16-bit mono 48kHz), converted to MP3 via ffmpeg.
- `packages/core` is consumed as TS source (Nuxt transpiles it) and made strict-clean so it typechecks under the web app's `noUncheckedIndexedAccess`.

## Verification

- `packages/core`: 31 vitest tests (articleParser, tokenizer, dictClient, voiceCatalog, ttsRequest) — pass.
- `apps/web`: `nuxt typecheck` clean.
- End-to-end smoke (dev server): articles list (10 from NAS), article parse (9 parts, 30 notes, word buckets), voices (527, voice_list on top), dict (embedded + Eudic + freedict tiers), TTS synthesize + MP3 streaming — all working.

## Phase 2 outline

`review_state` table (SM-2: ease, interval, reps, lapses, dueAt) + `packages/core/src/sr/` engine. Drills pull FORGET/VAGUE words from MaiMemo data and present cloze/typing/audio-recall, scheduling by SM-2. Complements MaiMemo's recognition flashcards with productive recall.
