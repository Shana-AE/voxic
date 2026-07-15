#!/usr/bin/env python3
"""
transcribe_voice_refs.py — one-time: transcribe every GPT-SoVITS reference audio
with whisper so the TTS server can feed GPT-SoVITS a prompt_text that actually
matches each voice's ref.wav (fixes the short-text "no meaning" artifacts caused
by the generic per-language prompt).

Reads voice_rotation.json ({voices:[{name, ref, ...}]}) and writes
voice_prompts.json ({voice_name: transcript}). Resumable (skips voices already
in the output). Batches by language so each `whisper` process loads the model
once per chunk instead of once per file.

Usage:
  python3 scripts/transcribe_voice_refs.py <voice_rotation.json> <voice_prompts.json>
  CHUNK=40 python3 ...   # voices per whisper invocation (default 40)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path


def lang_of(name: str) -> str:
    for suffix, lang in (("_ja", "Japanese"), ("_zh", "Chinese"), ("_ko", "Korean"), ("_en", "English")):
        if name.endswith(suffix):
            return lang
    return "English"


def slug(name: str) -> str:
    return re.sub(r"[^\w.-]", "_", name, flags=re.UNICODE)


def main() -> None:
    rotation_path, out_path = sys.argv[1], sys.argv[2]
    chunk = int(os.environ.get("CHUNK", "40"))
    voices = json.load(open(rotation_path, encoding="utf-8"))["voices"]
    prompts: dict[str, str] = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {}
    todo = [v for v in voices if v["name"] not in prompts and os.path.exists(v.get("ref", ""))]
    print(f"total={len(voices)} already={len(prompts)} todo={len(todo)}", flush=True)
    if not todo:
        return

    work = Path("/tmp/voxic_refs")
    wout = Path("/tmp/voxic_refout")
    shutil.rmtree(work, ignore_errors=True)
    shutil.rmtree(wout, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    wout.mkdir(parents=True, exist_ok=True)

    by_lang: dict[str, list[dict]] = defaultdict(list)
    for v in todo:
        by_lang[lang_of(v["name"])].append(v)

    for lang, vs in by_lang.items():
        for i in range(0, len(vs), chunk):
            batch = vs[i : i + chunk]
            for v in batch:
                sl = work / f"{slug(v['name'])}.wav"
                try:
                    sl.unlink(missing_ok=True)
                    sl.symlink_to(v["ref"])
                except Exception:
                    shutil.copy(v["ref"], sl)
            args = (
                ["whisper", *[str(work / f"{slug(v['name'])}.wav") for v in batch]]
                + ["--model", os.environ.get("WHISPER_MODEL", "base"), "--language", lang, "--output_format", "json", "--output_dir", str(wout)]
            )
            t = time.time()
            subprocess.run(args, capture_output=True, text=True, timeout=180 + 30 * len(batch))
            for v in batch:
                try:
                    prompts[v["name"]] = json.load(open(wout / f"{slug(v['name'])}.json", encoding="utf-8")).get("text", "").strip()
                except Exception as e:
                    print(f"  read fail {v['name']}: {e}", flush=True)
            json.dump(prompts, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            pct = len(prompts) * 100 // len(voices)
            last = batch[-1]
            print(f"[{lang}] {len(prompts)}/{len(voices)} ({pct}%) +{len(batch)} {int(time.time()-t)}s | {last['name']}: {prompts.get(last['name'],'')[:40]}", flush=True)

    print(f"DONE {len(prompts)}/{len(voices)} -> {out_path}", flush=True)


if __name__ == "__main__":
    main()
