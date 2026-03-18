# Migration to Multi-Arch (linux/amd64 + linux/arm64)

This repo currently ships a **CPU-only** image based on `paddlepaddle/paddle:3.2.0` (Python 3.10).
We run **Option B now** (single-arch build for your current host), and we will flip to **Option A** later (publish a multi-arch manifest so Intel and Apple Silicon pull native images automatically).

## Why multi-arch later?
- Native performance on Apple M-series (arm64) and x86 servers (amd64)
- No QEMU/Rosetta emulation, fewer SIGILL/AVX issues
- One tag that "just works" everywhere

## Current state (Option B now)
- Base image: `paddlepaddle/paddle:3.2.0` (CPU)
- Python: 3.10 (from base image)
- Torch: `2.4.*` CPU wheel
- PP-Structure & PaddleOCR run on CPU
- Built as a **single-arch** image for the current host (typically `linux/amd64`)

### Build (single-arch)
```bash
docker build -t yourorg/cv-parser-service:cpu-3.2.0 .
```

### Smoke tests

```bash
docker run --rm yourorg/cv-parser-service:cpu-3.2.0 \
  python -c "import paddle, paddleocr, platform; print(platform.machine(), paddle.__version__, paddleocr.__version__)"

docker run --rm yourorg/cv-parser-service:cpu-3.2.0 \
  python -c "from paddleocr import PaddleOCR; PaddleOCR(use_gpu=False); print('OCR OK')"
```

## Future state (Option A: multi-arch manifest)

We will re-publish **the SAME Dockerfile** as a multi-arch tag providing **both** `linux/amd64` and `linux/arm64`.

### One-time setup for cross builds

```bash
docker run --privileged --rm tonistiigi/binfmt --install all
docker buildx create --name multi --driver docker-container --use
docker buildx inspect --bootstrap
```

### Publish a multi-arch tag (later)

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t yourorg/cv-parser-service:latest \
  --push .
```

### Verify manifest platforms

```bash
docker buildx imagetools inspect yourorg/cv-parser-service:latest
```

### Sanity checks on each arch

```bash
# On x86_64 host
docker run --rm yourorg/cv-parser-service:latest python -c "import platform; print(platform.machine())"
# Expect: x86_64

# On Apple Silicon host
docker run --rm yourorg/cv-parser-service:latest python -c "import platform; print(platform.machine())"
# Expect: arm64 (or aarch64)
```

## Tagging strategy

* `:cpu-3.2.0` — pinned base for reproducibility (today)
* `:latest` — rolling tag, will become **multi-arch** later
* Optionally add date/semver tags for releases

## Apple Silicon notes

* Do **not** export `DOCKER_DEFAULT_PLATFORM=linux/amd64` on M-series unless you intend to emulate x86_64 (slow and fragile).
* Multi-arch images remove the need for emulation altogether.

## GPU note (for Linux servers)

Use a **separate** GPU image (e.g., `paddlepaddle/paddle:3.2.0-gpu-...`) for `linux/amd64` only. Do not try to make a single image that covers both Mac laptops and CUDA servers.

## Troubleshooting

* Illegal instruction / returncode -4: likely AVX/x86 binary on ARM. Use the multi-arch build (Option A).
* Missing wheels: ensure Torch CPU and other heavy deps have `py310` wheels for both `amd64` and `arm64`.
* Verify container arch: `docker exec <container> uname -m`

## Cheat sheet

```bash
# Build single-arch now (Option B)
docker build -t yourorg/cv-parser-service:cpu-3.2.0 .

# Later: publish multi-arch (Option A)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourorg/cv-parser-service:latest --push .
docker buildx imagetools inspect yourorg/cv-parser-service:latest