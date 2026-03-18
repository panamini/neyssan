#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

START_DEV_SCRIPT="${ROOT_DIR}/scripts/start-dev.sh"

if [[ ! -x "${START_DEV_SCRIPT}" ]]; then
  echo "[dev] Missing ${START_DEV_SCRIPT}. Cannot start parser service."
  exit 1
fi

TAIL_LOGS=0 "${START_DEV_SCRIPT}" --service-only "$@"
