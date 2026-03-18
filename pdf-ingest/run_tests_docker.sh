#!/usr/bin/env bash
# Run parser unit tests inside the project's Docker image (Python 3.11)
# Safe, deterministic; does not push to git or modify your host Python environment.
#
# Usage:
#   cd pdf-ingest
#   ./run_tests_docker.sh
#
# The script will:
#  - build the image (if needed) using Dockerfile.python311
#  - run a container (detached)
#  - execute pytest inside the running container for the parser unit tests
#  - stop the container when done
#
set -euo pipefail

IMAGE_NAME="pdf-ingest:py311"
CONTAINER_NAME="pdf_ingest_test_runner"
DOCKERFILE="Dockerfile.python311"

# Build image (cached if already built)
echo "Building Docker image ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}" -f "${DOCKERFILE}" .

# Run container detached
echo "Starting container ${CONTAINER_NAME}..."
docker run -d --name "${CONTAINER_NAME}" -p 8000:8000 --rm "${IMAGE_NAME}"

# Give container a moment to start
sleep 2

# Run tests inside container
# Adjust the test path as needed. By default runs tests under tests/ (inside /app)
PYTEST_TARGET=${1:-"tests/test_parser_unit.py"}
echo "Running pytest ${PYTEST_TARGET} inside ${CONTAINER_NAME}..."
docker exec "${CONTAINER_NAME}" pytest -q "${PYTEST_TARGET}"
RESULT=$?

# Stop container (the --rm flag will remove it)
echo "Stopping container ${CONTAINER_NAME}..."
docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true

exit ${RESULT}
