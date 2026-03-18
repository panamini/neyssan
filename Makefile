.PHONY: docker-build docker-run docker-logs

IMAGE_NAME ?= cv-parser-service
DOCKERFILE ?= cv_parser_service/Dockerfile
SERVICE_PORT ?= 8000

# Build the cv parser service image (fresh)
docker-build:
	@echo "[build] Building $(IMAGE_NAME) from $(DOCKERFILE)..."
	docker build --no-cache -t $(IMAGE_NAME) -f $(DOCKERFILE) .
	@echo "[build] Done. Run 'make docker-run' to start the service."

# Run the service locally and stream logs to confirm readiness
docker-run:
	@echo "[run] Starting $(IMAGE_NAME) on http://localhost:$(SERVICE_PORT)..."
	docker run --rm -p $(SERVICE_PORT):8000 $(IMAGE_NAME)

# Tail logs from a running container (if started separately)
docker-logs:
	@docker logs -f $(shell docker ps --filter "ancestor=$(IMAGE_NAME)" --format "{{.ID}}")

# Developer shortcuts
.PHONY: parser dev dev-backend dev-ui verify-docTR
parser:
	@./scripts/start-dev.sh --service-only

dev:
	@./scripts/start-dev.sh

dev-backend:
	@SKIP_CACHE_EXPORT=1 FORCE_REBUILD=false ./run.sh up --doctr

dev-ui:
	@SKIP_CACHE_EXPORT=1 FORCE_REBUILD=false ./run.sh up --doctr --ui

verify-docTR:
	@bash scripts/verify_docTR.sh fixtures/sample_scanned_resume.pdf
