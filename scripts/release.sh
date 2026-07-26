#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-cv-parser:test-local}"
PORT="${PORT:-8000}"
CONTAINER_NAME="${CONTAINER_NAME:-cv-parser-release-smoke-$$}"
RELEASE_OWNER_LABEL="com.twoweeks.release-smoke.owner"
RELEASE_OWNER_ID="release-smoke-$$"

docker build -f cv_parser_service/Dockerfile -t "${IMAGE}" .

docker run -d --rm \
  --name "${CONTAINER_NAME}" \
  --label "${RELEASE_OWNER_LABEL}=${RELEASE_OWNER_ID}" \
  -p "${PORT}:${PORT}" \
  --shm-size=1g \
  -e "PORT=${PORT}" \
  -e CV_OCR_ENGINE=doctr \
  "${IMAGE}"

cleanup() {
  local owner=""
  owner="$(docker inspect --format "{{ index .Config.Labels \"${RELEASE_OWNER_LABEL}\" }}" "${CONTAINER_NAME}" 2>/dev/null || true)"
  if [[ "${owner}" == "${RELEASE_OWNER_ID}" ]]; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:${PORT}/ready" && break
  sleep 1
done

curl -fsS "http://127.0.0.1:${PORT}/ready"
curl -sf "http://127.0.0.1:${PORT}/metrics" | egrep 'cv_parser_ocr_engine_total|cv_parser_route_total' || true

BASE_URL="http://127.0.0.1:${PORT}" ./scripts/bench_fixtures.sh
python scripts/review_bench.py

echo "[ok] local release smoke passed"
