#!/usr/bin/env python3
import os
import subprocess
import time
from datetime import datetime, timezone

# ---------- CONFIG ----------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIAGNOSTIC_DIR = os.path.join(SCRIPT_DIR, "diagnostics")
DIAGNOSTIC_SCRIPT = os.path.join(SCRIPT_DIR, "run_diagnostic.sh")
DEBUG_LOG = os.path.join(DIAGNOSTIC_DIR, "pdf_ingest_debug.log")
CHUNK_DIR = os.path.join(DIAGNOSTIC_DIR, "chunks")
KEYWORDS = ["CONFIRM SAVE", "LLM", "PROFILE", "ERROR", "Exception"]
CHUNK_SIZE = 500  # lines per chunk

os.makedirs(CHUNK_DIR, exist_ok=True)

# ---------- RUN DIAGNOSTIC ----------
print("=== Running diagnostic script ===")
if not os.path.exists(DIAGNOSTIC_SCRIPT):
    raise FileNotFoundError(f"Diagnostic script not found: {DIAGNOSTIC_SCRIPT}")

result = subprocess.run(
    [DIAGNOSTIC_SCRIPT],
    env={**os.environ, "PDF_INGEST_DEBUG_LOG": "/tmp/pdf_ingest_debug.log", "LLM_MOCK": "true"},
    cwd=os.path.join(SCRIPT_DIR, "pdf-ingest"),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Print stdout for feedback
print(result.stdout)

# Print stderr for info only (do not treat as failure)
if result.stderr.strip():
    print("Diagnostic script stderr (info/debug only):")
    print(result.stderr)

# ---------- WAIT UNTIL LOG EXISTS ----------
timeout = 120  # seconds
start = time.time()
while not os.path.exists(DEBUG_LOG):
    if time.time() - start > timeout:
        raise FileNotFoundError(f"Debug log not found after {timeout}s: {DEBUG_LOG}")
    time.sleep(1)

print(f"Debug log found: {DEBUG_LOG}")

# ---------- FILTER AND CHUNK ----------
print("=== Filtering and chunking log ===")
filtered_lines = []
with open(DEBUG_LOG, "r") as f:
    for line in f:
        if any(k.lower() in line.lower() for k in KEYWORDS):
            filtered_lines.append(line.rstrip())

chunk_files = []
for i in range(0, len(filtered_lines), CHUNK_SIZE):
    chunk_lines = filtered_lines[i:i+CHUNK_SIZE]
    chunk_file = os.path.join(
        CHUNK_DIR,
        f"pdf_ingest_chunk_{i//CHUNK_SIZE + 1}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.log"
    )
    with open(chunk_file, "w") as f_out:
        f_out.write("\n".join(chunk_lines))
    chunk_files.append(chunk_file)
    print(f"Saved chunk {i//CHUNK_SIZE + 1} ({len(chunk_lines)} lines) -> {chunk_file}")

print("All chunks saved!")

# ---------- PREPARE CHUNKS FOR LLM ----------
LLM_PROMPT = f"""
You are going to analyze pdf-ingest debug logs.
- Only read the provided chunk files in order.
- Focus on lines containing: {', '.join(KEYWORDS)}
- Skip unrelated lines to avoid overloading memory.
- Extract errors, exceptions, LLM enqueue events, confirm-save profiles and their IDs.
- Stop reading each chunk after you found all relevant info for that chunk.
"""

print("\n=== Preparing chunks for LLM ===")
for idx, chunk_path in enumerate(sorted(chunk_files)):
    with open(chunk_path, "r") as f:
        chunk_text = f.read()
    # Replace this with your LLM API call
    print(f"Prepared chunk {idx+1} for LLM: {chunk_path}")

# ---------- EXAMPLE LLM PROMPT ----------
LLM_PROMPT_EXAMPLE = f"""
You are analyzing diagnostic logs for the confirm-save endpoint.
- Logs are divided into chunks; each chunk contains only relevant lines.
- Focus on:
  - Database errors (table missing, transaction aborted)
  - UUID / placeholder issues
  - LLM enqueue and worker errors
- For each chunk, note patterns, repeated failures, and cascading effects.
- Do NOT summarize unrelated lines.
- Return structured output: Chunk number, Errors, Patterns, Recommended Fixes.
"""
print("\nExample prompt for LLM:\n", LLM_PROMPT_EXAMPLE)
