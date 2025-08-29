#!/usr/bin/env python3
"""
Generate per-chunk LLM prompt files for manual analysis.

For each chunk file in diagnostics/chunks/, this script writes a prompt file
into diagnostics/chunks_prompts/ named <chunk_filename>.prompt.txt that contains:

1) The analysis instructions (handover prompt)
2) A short header identifying the chunk file
3) The chunk contents (the filtered relevant lines)

Usage:
  python3 generate_chunk_prompts.py
"""
import os
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
CHUNK_DIR = ROOT / "chunks"
OUT_DIR = ROOT / "chunks_prompts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HANDOVER = """You are analyzing fresh diagnostic chunk for the pdf-ingest project.
- Ignore all previous memory or analysis.
- Focus only on the logs provided in order (the chunk below).
- Identify:
  - Database errors (missing tables, aborted transactions)
  - Placeholder / UUID issues
  - LLM enqueue and worker failures
- For this chunk, produce structured output with the following fields:
  1. Chunk filename
  2. Errors / Exceptions (exact lines)
  3. Repeated patterns / cascading effects (concise list)
  4. Recommended fixes (concrete file/line refs where possible)
- Confirm whether confirm-save and LLM refine flow appear to work for entries in this chunk.
- Strict: Do NOT summarize unrelated lines.
- Return plain-text structured sections (not JSON) so they are easy to paste into issue trackers.

Begin chunk below this line.
"""

chunk_files = sorted([p for p in CHUNK_DIR.glob("*.log")], key=lambda p: p.name)

if not chunk_files:
    print("No chunk files found in", CHUNK_DIR)
    raise SystemExit(1)

for idx, cf in enumerate(chunk_files, start=1):
    text = cf.read_text(encoding="utf-8")
    prompt_name = OUT_DIR / f"{cf.stem}.prompt.txt"
    with prompt_name.open("w", encoding="utf-8") as out:
        out.write(f"# Generated at: {datetime.utcnow().isoformat()}Z\n")
        out.write(f"# Chunk file: {cf.name}\n\n")
        out.write(HANDOVER)
        out.write("\n\n--- CHUNK START ---\n\n")
        out.write(text)
        out.write("\n\n--- CHUNK END ---\n")
    print(f"Wrote prompt for chunk {idx}: {prompt_name}")

print("All prompts generated in", OUT_DIR)
