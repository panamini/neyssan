# syntax=docker/dockerfile:1.7

############################################
# deps (cached on lockfiles)
############################################
FROM python:3.12-slim AS deps

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    set -eux; \
    rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      build-essential \
      git \
      pkg-config \
      libglib2.0-0 \
      libgl1 \
      libstdc++6 \
      curl \
      ca-certificates; \
    rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --upgrade pip wheel

WORKDIR /tmp
COPY requirements.lock requirements.lock
COPY requirements.txt requirements.txt
COPY cv_parser_service/requirements.lock cv_parser_service/requirements.lock
COPY cv_parser_service/requirements.txt cv_parser_service/requirements.txt

RUN --mount=type=cache,target=/root/.cache/pip \
    if [ -s requirements.lock ]; then \
      pip install -r requirements.lock; \
    elif [ -s requirements.txt ]; then \
      pip install -r requirements.txt; \
    fi && \
    if [ -s cv_parser_service/requirements.lock ]; then \
      pip install -r cv_parser_service/requirements.lock; \
    elif [ -s cv_parser_service/requirements.txt ]; then \
      pip install -r cv_parser_service/requirements.txt; \
    fi

############################################
# runtime
############################################
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    set -eux; \
    rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      libgl1 \
      libstdc++6 \
      ca-certificates \
      curl; \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app
COPY . /app

ENV CV_OCR_ENGINE=doctr

EXPOSE 8000

CMD ["/opt/venv/bin/python", "-m", "uvicorn", "--app-dir", "/app", "cv_parser_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
