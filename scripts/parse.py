#!/usr/bin/env python3
"""Command-line helper to parse CV files via the local parser service."""

from __future__ import annotations

import json
import os
import pathlib
import sys
from typing import Iterable, List

import requests

PARSER_URL = os.environ.get("PARSER_URL", "http://127.0.0.1:8000/parse-cv")
OUT_DIR = pathlib.Path("artifacts/samples")
ALLOWED_SUFFIXES = {".pdf", ".txt"}


def _gather(paths: Iterable[str]) -> List[pathlib.Path]:
    collected: List[pathlib.Path] = []
    for raw in paths:
        path = pathlib.Path(raw)
        if path.is_file() and path.suffix.lower() in ALLOWED_SUFFIXES:
            collected.append(path)
        elif path.is_dir():
            for suffix in ALLOWED_SUFFIXES:
                collected.extend(sorted(path.rglob(f"*{suffix}")))
    return collected


def _parse_file(path: pathlib.Path) -> bool:
    try:
        if path.suffix.lower() == ".txt":
            text = path.read_text(encoding="utf-8", errors="ignore")
            files = {"raw_text": (None, text, "text/plain; charset=utf-8")}
            response = requests.post(PARSER_URL, files=files, timeout=120)
        else:
            with path.open("rb") as fh:
                files = {"file": (path.name, fh, "application/pdf")}
                response = requests.post(PARSER_URL, files=files, timeout=120)
        response.raise_for_status()
        payload = response.json()
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUT_DIR / f"{path.name}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        summary = payload.get("summaryFirstSentence") or payload.get("summary", {}).get("text")
        snippet = (summary or "")[:180]
        print(f"[OK] {path} → {out_path} :: {snippet!r}")
        return True
    except Exception as exc:  # pragma: no cover - CLI failure surface
        print(f"[ERR] {path} :: {exc}")
        return False


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("Usage: python scripts/parse.py <file-or-folder> [more paths...]")
        return 2
    targets = _gather(argv[1:])
    if not targets:
        print("No .pdf/.txt files found.")
        return 1
    successes = sum(_parse_file(path) for path in targets)
    print(f"\nDone. Parsed {successes}/{len(targets)} successfully. Output → {OUT_DIR}/")
    return 0 if successes == len(targets) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
