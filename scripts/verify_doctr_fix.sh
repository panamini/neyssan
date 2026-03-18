#!/usr/bin/env bash
set -euo pipefail
name="${1:-cv-parser-service-dev}"
echo "[verify] checking /opt/doctr-venv ..."
docker exec "$name" bash -lc 'ls -l /opt/doctr-venv/bin/python'
echo "[verify] importing tensorflow + doctr in isolated venv ..."
docker exec "$name" bash -lc '/opt/doctr-venv/bin/python - <<PY
import tensorflow as tf, doctr
print("OK", tf.__version__, getattr(doctr, "__version__", "unknown"))
PY'
echo "[verify] checking /ready ..."
curl -fsS http://127.0.0.1:8000/ready | jq '{engine:.ocr.engine,selected:.ocr.selected,available:.ocr.available,reason:.ocr.reason}'
echo "[verify] done"