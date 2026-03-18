#!/usr/bin/env bash
set -euo pipefail

CID="${1:-cv-parser-service-dev}"

docker exec -i "${CID}" /bin/sh <<'SH'
set -eu
printf '[probe] CWD: %s\n' "$(pwd)"
printf '[probe] PYTHONPATH: %s\n' "${PYTHONPATH:-}"
python - <<'PY'
import importlib
import os
import pkgutil
import sys
import traceback

print("[probe] sys.path head:", sys.path[:10])
print("[probe] has /app:", os.path.isdir("/app"))
print("[probe] has /app/cv_parser:", os.path.isdir("/app/cv_parser"))

def inspect_module(name: str) -> None:
    found = pkgutil.find_loader(name) is not None
    version = None
    err = None
    try:
        module = importlib.import_module(name)
    except Exception as exc:  # pragma: no cover - diagnostics only
        err = repr(exc)
    else:
        version = getattr(module, "__version__", None)
    print(f"[probe] import {name}: found={found} version={version} err={err}")

for mod_name in ("pdfminer", "pdfplumber"):
    inspect_module(mod_name)

sample_path = "/app/fixtures/fixturetest/cv (14).pdf"
if os.path.exists(sample_path):
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(sample_path) as pdf:  # type: ignore[attr-defined]
            sample_text = "".join((page.extract_text() or "") for page in pdf.pages[:2])
        print(f"[probe] sample_text_len: {len(sample_text)} path={sample_path}")
    except Exception as exc:  # pragma: no cover - diagnostics only
        print("[probe] sample_text_fail:", repr(exc))
        print(traceback.format_exc())
else:
    print(f"[probe] sample_text_missing: {sample_path}")

try:
    import cv_parser.canonicalize as module
except Exception as exc:  # pragma: no cover - diagnostics only
    print("[probe] IMPORT_FAIL:", repr(exc))
else:
    path = getattr(module, "__file__", None)
    print("[probe] IMPORT_OK:", path)
print("[probe] done")
PY
echo "[probe] listing /app:"
ls -la /app || true
echo "[probe] listing /app/cv_parser:"
ls -la /app/cv_parser || true
SH
