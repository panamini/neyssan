# syntax=docker/dockerfile:1.7
ARG PYTHON_VERSION=3.11

###############################################
# Base (multi-arch) — minimal OS + venv
###############################################
FROM python:${PYTHON_VERSION}-slim-bookworm AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}" \
    PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

# Faster Debian mirror + apt cache + retries
RUN if [ -f /etc/apt/sources.list ]; then sed -i 's|http://deb.debian.org/debian|http://cdn-aws.deb.debian.org/debian|g' /etc/apt/sources.list; fi
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update -o Acquire::Retries=5 --fix-missing && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-fra \
      libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 \
      libgomp1 \
      libgfortran5 \
      libopenblas0-serial \
      liblapack3 \
      python3-numpy \
      curl && \
    rm -rf /var/lib/apt/lists/*

# Isolated virtualenv for main service (kept in base so deps stage can reuse)
RUN python -m venv "${VIRTUAL_ENV}" && \
    pip install --upgrade pip setuptools wheel

WORKDIR /app

###############################################
# Deps — install Python deps into /opt/venv
# and an isolated /opt/doctr-venv for docTR backends.
###############################################
FROM base AS deps

# Ensure doctr venv path exists on all architectures (keeps runtime probes deterministic)
RUN mkdir -p /opt/doctr
RUN mkdir -p /opt/doctr-venv

# Minimal build tooling (rarely needed; safe to keep)
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update -o Acquire::Retries=5 --fix-missing && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      build-essential git && \
    rm -rf /var/lib/apt/lists/*

# 1) Pre-install Paddle core (kept minimal here)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir "paddlepaddle==3.2.0"

# 2) App deps — prefer service-scoped requirements for determinism
COPY cv_parser_service/requirements.txt /tmp/service-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --no-cache-dir -r /tmp/service-requirements.txt && \
    python -m pip check && \
    python -c "import fastapi, uvicorn"

# 3) Create isolated docTR venv and install backend per-architecture.
#    On arm64/aarch64 install TF+docTR into /opt/doctr-venv.
ARG TARGETARCH
RUN set -eux; \
    python -m venv /opt/doctr-venv; \
    /opt/doctr-venv/bin/pip install --upgrade pip setuptools wheel; \
    arch="${TARGETARCH:-$(uname -m)}"; \
    if [ "$arch" = "arm64" ] || [ "$arch" = "aarch64" ]; then \
      /opt/doctr-venv/bin/pip install --no-cache-dir \
        "tensorflow==2.15.*" \
        "keras==2.15.*" \
        "python-doctr[tf]==0.10.*"; \
      echo "Installed TensorFlow/docTR for ARM64 architecture"; \
    else \
      # Keep a minimal docTR install for non-TF (PyTorch) flows; this is optional but keeps import surface stable.
      /opt/doctr-venv/bin/pip install --no-cache-dir "python-doctr[torch]==0.10.*" || true; \
      echo "Created doctr venv without TensorFlow for TARGETARCH=$arch"; \
    fi; \
    test -f /opt/doctr-venv/bin/python && echo "docTR venv created successfully" || echo "WARNING: docTR venv creation failed"

# Optional: prewarm Paddle models during build when requested (no-op if offline)
RUN <<'SHELL'
if [ "${PREWARM:-0}" = "1" ]; then
  python - <<'PY' || true
from paddleocr import PaddleOCR
PaddleOCR(use_textline_orientation=True, lang='en', ocr_version='PP-OCRv5', use_gpu=False)
print("PaddleOCR models cached.")
PY
fi
SHELL

###############################################
# Runtime — thin image; reuse the frozen venvs
###############################################
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ARG RUNTIME_CACHE_BUST=0

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}" \
    PADDLEOCR_HOME=/home/app/.paddlex \
    PADDLE_MODEL_PATH=/home/app/.paddlex \
    HF_HOME=/home/app/.cache/huggingface \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    PADDLE_CPU_MATH_LIBRARY_NUM_THREADS=1 \
    OPENBLAS_CORETYPE=ARMV8 \
    PADDLE_WORKER_PYTHON=/opt/paddle-venv/bin/python \
    FLAGS_allocator_strategy=naive_best_fit \
    FLAGS_use_mkldnn=false \
    FLAGS_use_cuda=false \
    CUDA_VISIBLE_DEVICES=""

# OS libs
RUN if [ -f /etc/apt/sources.list ]; then sed -i 's|http://deb.debian.org/debian|http://cdn-aws.deb.debian.org/debian|g' /etc/apt/sources.list; fi && \
    apt-get update -o Acquire::Retries=5 --fix-missing && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      poppler-utils \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra \
      libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 \
      libgomp1 libgfortran5 libopenblas0-serial liblapack3 \
      python3-numpy curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ✅ Bring the entire prebuilt venvs from deps (no dynamic COPY tricks)
COPY --from=deps /opt/venv /opt/venv
COPY --from=deps /opt/doctr-venv /opt/doctr-venv

# App code last for faster rebuilds
COPY . /app
# Ensure debug scripts are present explicitly as well
COPY scripts /app/scripts

# Dedicated Paddle venv (system BLAS serial build only)
RUN PYTHON_FOR_PADDLE="$(command -v python3.11 || command -v python3)" && \
    "${PYTHON_FOR_PADDLE}" -m venv /opt/paddle-venv --system-site-packages && \
    /opt/paddle-venv/bin/pip install --upgrade pip setuptools wheel && \
    /opt/paddle-venv/bin/pip install --no-cache-dir --no-deps paddlepaddle==3.2.0 && \
    /opt/paddle-venv/bin/pip install --no-cache-dir --prefer-binary "paddleocr[doc-parser]==3.2.0" && \
    /opt/paddle-venv/bin/pip install --no-cache-dir --prefer-binary "paddlex==3.2.0" && \
    /opt/paddle-venv/bin/pip install --no-cache-dir \
        Pillow \
        pypdfium2 \
        protobuf \
        threadpoolctl \
        typing-extensions==4.12.2 \
        httpx \
        networkx \
        'opt-einsum==3.3.0' \
        'safetensors>=0.6.0' \
        'PyYAML==6.0.2' \
        requests \
        chardet \
        colorlog \
        filelock \
        'ruamel.yaml>=0.18.0' \
        'ruamel.yaml.clib>=0.2.7' \
        ujson \
        'pydantic>=2,<3' \
        prettytable \
        py-cpuinfo \
        'pandas>=1.3' \
        huggingface_hub \
        'modelscope>=1.28.0' \
        'aistudio_sdk>=0.3.5'

# Non-root user & writable caches
RUN useradd -m -u 10001 -s /usr/sbin/nologin app && \
    chown -R app:app /app /opt/venv
USER app

RUN mkdir -p "${PADDLEOCR_HOME}" "${HF_HOME}"

# Pre-cache docTR weights so runtime docTR OCR does not hit download timeouts.
RUN /opt/doctr-venv/bin/python - <<'PY' >/tmp/doctr_prewarm.log 2>&1 || { echo "WARNING: docTR cache preload failed; see /tmp/doctr_prewarm.log"; cat /tmp/doctr_prewarm.log || true; }
import os
from pathlib import Path
import tempfile
from PIL import Image
import shutil
from doctr.io import DocumentFile
from doctr.models import ocr_predictor

hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
hf_home.mkdir(parents=True, exist_ok=True)

tmp_dir = Path(tempfile.mkdtemp(prefix="doctr_cache_"))
try:
    img = Image.new("RGB", (32, 32), "white")
    img_path = tmp_dir / "warmup.png"
    img.save(img_path, format="PNG")
    doc = DocumentFile.from_images([str(img_path)])
    predictor = ocr_predictor(
        det_arch=os.environ.get("CV_DOCTR_DET_ARCH", "db_mobilenet_v3_large"),
        reco_arch=os.environ.get("CV_DOCTR_REC_ARCH", "crnn_mobilenet_v3_small"),
        pretrained=True,
        assume_straight_pages=True,
    )
    predictor(doc)
    print("docTR weights cached to", hf_home)
finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)
PY

EXPOSE 8000
CMD ["python", "-c", "import platform, paddle; print('Ready on', platform.machine(), 'Paddle', paddle.__version__)"]
