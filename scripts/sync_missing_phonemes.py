#!/usr/bin/env python3
"""
sync_missing_phonemes.py — check all MaiMemo words (from Postgres) against the
GPT-SoVITS phoneme dictionaries. Words missing from ALL dicts get ARPABET
phonemes generated via g2p_en and appended to engdict-hot.rep. Clears the
engdict cache so GPT-SoVITS rebuilds on next restart.

Designed to run as a cron job (after the 03:30 word fetch) or on-demand via the
Voxic endpoint POST /api/tts/sync-dict.

Usage:
  python3 sync_missing_phonemes.py [--dry-run]
"""
from __future__ import annotations

import os
import re
import sys

import psycopg2

GPT_TEXT_DIR = os.path.expanduser(os.environ.get("GPTSOVITS_TEXT_DIR", "~/GPT-SoVITS/GPT_SoVITS/text"))
DICT_FILES = ["cmudict.rep", "cmudict-fast.rep", "engdict-hot.rep"]
PG = {
    "host": os.environ.get("MAIMEMO_PG_HOST", ""),
    "port": int(os.environ.get("MAIMEMO_PG_PORT", "5432")),
    "dbname": os.environ.get("MAIMEMO_PG_DBNAME", ""),
    "user": os.environ.get("MAIMEMO_PG_USER", ""),
    "connect_timeout": 10,
}


def load_dict_words() -> set[str]:
    words: set[str] = set()
    for fname in DICT_FILES:
        path = os.path.join(GPT_TEXT_DIR, fname)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if parts:
                    words.add(parts[0])
    return words


def get_pg_words() -> set[str]:
    conn = psycopg2.connect(**PG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT UPPER(TRIM(spelling)) FROM maimemo.daily_items "
                "WHERE spelling IS NOT NULL AND spelling <> ''"
            )
            return {r[0] for r in cur.fetchall()}
    finally:
        conn.close()


def generate_arpa(word: str, g2p) -> str:
    phonemes = g2p(word)
    arpa = [p for p in phonemes if re.match(r"^[A-Z]+\d?$", p)]
    return " ".join(arpa)


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    pg_words = get_pg_words()
    dict_words = load_dict_words()
    missing = sorted(pg_words - dict_words)

    if not missing:
        print(f"sync: all {len(pg_words)} words present in dicts; nothing to add.")
        return

    print(f"sync: {len(missing)} words missing from dicts.")

    if dry_run:
        for w in missing:
            print(f"  (dry-run) {w}")
        return

    # Generate ARPABET via g2p_en.
    try:
        from g2p_en import G2p
        g2p = G2p()
    except ImportError:
        print("ERROR: g2p_en not installed; cannot generate phonemes.", file=sys.stderr)
        sys.exit(1)

    hot_path = os.path.join(GPT_TEXT_DIR, "engdict-hot.rep")
    added = []
    with open(hot_path, "a", encoding="utf-8") as f:
        for word in missing:
            arpa = generate_arpa(word, g2p)
            if arpa:
                f.write(f"{word} {arpa}\n")
                added.append(word)

    # Clear the cache so GPT-SoVITS rebuilds on next restart.
    cache_path = os.path.join(GPT_TEXT_DIR, "engdict_cache.pickle")
    if os.path.exists(cache_path):
        os.remove(cache_path)

    print(f"sync: added {len(added)}/{len(missing)} → engdict-hot.rep; cache cleared.")
    if added:
        preview = ", ".join(added[:20])
        print(f"  added: {preview}{'...' if len(added) > 20 else ''}")
    print("  ⚠ Restart GPT-SoVITS (launchctl unload/load com.gpt-sovits.api.plist) to apply.")


if __name__ == "__main__":
    main()
