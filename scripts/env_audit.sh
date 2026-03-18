#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "=== LOCAL PYTHON ==="
(command -v python >/dev/null 2>&1 && python -V) || echo "python: not found"
(command -v python3 >/dev/null 2>&1 && python3 -V) || echo "python3: not found"
if [[ -x ".venv/bin/python" ]]; then
  echo ".venv python: $(.venv/bin/python -V)"
else
  echo ".venv: not present"
fi

echo
echo "=== LOCAL PIP/PACKAGES (venv if present) ==="
if [[ -x ".venv/bin/python" ]]; then PYBIN=".venv/bin/python"; else PYBIN="$(command -v python3 || command -v python || echo /usr/bin/python)"; fi
"$PYBIN" -m pip --version || true
"$PYBIN" -m pip list | grep -E 'Pillow|uvicorn|fastapi' || true

echo
echo "=== REQUIREMENTS SNIPPET (cv_parser_service/requirements.txt) ==="
if [[ -f "cv_parser_service/requirements.txt" ]]; then
  grep -nE '^Pillow' cv_parser_service/requirements.txt || echo "No Pillow line found"
else
  echo "No cv_parser_service/requirements.txt present"
fi

echo
echo "=== LOCAL PYTHON AUDIT ==="
"$PYBIN" scripts/python_audit.py || true

echo
echo "=== DOCKER RUNTIME AUDIT ==="
IMG="cv-parser-service"
if ! docker image inspect "$IMG" >/dev/null 2>&1; then
  echo "WARN: image $IMG not found locally (build via scripts/start-dev.sh or your CI)."
fi
docker run --rm -v "$ROOT:/app" -w /app "$IMG" sh -lc '
set -e
python -V || true
pip list | grep -E "Pillow|uvicorn|fastapi" || true
python - <<PY
import sys
print("sys.path:", sys.path)
def check(mod):
    try:
        __import__(mod); print(f"[OK] import {mod}")
    except Exception as e:
        print(f"[FAIL] import {mod} -> {type(e).__name__}: {e}")
for m in ("cv_parser_service.main","cv_parser.canonicalize"):
    check(m)
PY
echo "--- /app listing (top-level) ---"
ls -la /app | sed -n '1,120p'
echo "--- __init__.py presence (depth<=2) ---"
find /app -maxdepth 2 -type f -name "__init__.py" -print | sed "s|^|INIT: |"
' || true

echo
echo "=== SUMMARY / RED FLAGS ==="
echo "- If Python >= 3.13 and Pillow==10.x is pinned → add markers (10.x for <3.13, 11.x for >=3.13)."
echo "- If Docker fails importing cv_parser.canonicalize → ensure PYTHONPATH includes /app or add a small import shim."
echo "- Run scripts/dev.sh for local flow (uses .venv) or scripts/dev.sh --docker for container flow."

exit 0

