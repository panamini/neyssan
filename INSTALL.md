# Install & Ops Guide

## Requirements

- Python 3.10+ (3.11 recommended), pip
- macOS or Linux shell (bash/zsh)

## Quickstart

Local-only bench loop:

```bash
scripts/dev-local.sh
BASE_URL=http://127.0.0.1:8000 scripts/bench_fixtures.sh fixtures/fixturetest
```

Full dev (parser + tunnel + frontend):

```bash
./run.sh up --doctr --ui --tail
```

Skip components via either flags or env variables:

```bash
DEV_TUNNEL=0 ./run.sh up --doctr --ui --tail       # disable Cloudflare tunnel
DEV_FRONTEND=0 ./run.sh up --doctr --ui --tail     # keep frontend offline
DEV_FRONTEND=0 DEV_TUNNEL=0 ./run.sh up --doctr    # backend only, no tunnel/frontend
```

Both scripts emit timestamped logs to `artifacts/dev/dev.log`.

## Everyday Commands

Start / Stop / Logs:

```bash
scripts/parser.sh status
scripts/parser.sh start
scripts/parser.sh logs
scripts/parser.sh stop
```

Smoke:

```bash
HOST=127.0.0.1 PORT=8000 scripts/parser.sh smoke
```

Parse a single file:

```bash
PARSER_URL=http://127.0.0.1:8000/parse-cv python scripts/parse.py path/to/resume.pdf
```

Parse fixtures:

```bash
PARSER_URL=http://127.0.0.1:8000/parse-cv python scripts/parse.py fixtures/fixturetest
```

## Dev/CI Environment Toggles

- `DEV_TUNNEL` — defaults to `1`. Set to `0` (or use `--no-tunnel`) to skip the Cloudflare quick tunnel entirely.
- `DEV_FRONTEND` — defaults to `1`. Set to `0` (or `--no-frontend`) to skip launching the Vite frontend.
- `PREWARM` — when `1`, the service preloads OCR models on startup. Default for dev is `0` (fast boot); smoke or `/warmup` can load models on demand.
- `RELOAD` — control Uvicorn's autoreload. Default is `1`, but `./run.sh` sets `RELOAD=0` unless you pass `--reload`.
- `RUN_SMOKE` — set to `1` to execute the in-container ABC smoke after the service is healthy. Combine with `SMOKE_STRICT=1` to fail the run if smoke fails.
- `SMOKE_TIMEOUT` — request timeout (seconds) for smoke HTTP calls. Defaults to 180; bump for slower cold starts.
- `SMOKE_SAVE` — path (inside the container) for the smoke summary. Defaults to `/tmp/abc_smoke_result.txt` when running under Docker.
- `SMOKE_CONCURRENCY` — parallel request count for smoke (default `1`). Increase only after confirming warmup is stable.

While smoke runs, you can tail logs with:

```bash
docker logs -f cv-parser-service-dev
```

`/ready` flips to `true` immediately; `/warmup` triggers an explicit OCR warmup and returns a confirmation payload.

## Server Deployment (systemd example)

```
[Unit]
Description=Neyssan CV Parser
After=network.target

[Service]
WorkingDirectory=/opt/neyssan
Environment=HOST=0.0.0.0 PORT=8000
ExecStart=/bin/bash -lc '/opt/neyssan/scripts/parser.sh start'
ExecStop=/bin/bash -lc '/opt/neyssan/scripts/parser.sh stop'
Restart=on-failure
User=neyssan

[Install]
WantedBy=multi-user.target
```

Open the port (or use a reverse proxy), then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now neyssan-parser.service
```

## CI

GitHub Actions runs `.github/workflows/parser-smoke.yml`:

1. Starts the parser
2. Waits for `/health`
3. Runs ABC smoke and parses fixtures
4. Uploads artifacts (samples + logs)

## Troubleshooting

- Tunnel EOF / context canceled logs  
  Cloudflare can flap if the parser restarts under `--reload`. `./run.sh` now waits for three consecutive local `/ready` checks before starting the tunnel, and validates the tunneled `/ready` twice. If the tunnel cannot stabilize, a warning is printed and the session continues using the local URL. Inspect logs with:

  ```bash
  tail -n +1 artifacts/dev/dev.log | tail -n 120
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  docker logs --tail=200 cv-parser-service-dev 2>/dev/null || true
  ```

- Pillow build failure with Python 3.13
  - Pillow 10.x supports Python up to 3.12. Use Python 3.12 locally, or rely on the markers in `cv_parser_service/requirements.txt`:
    - `Pillow==10.0.0 ; python_version < "3.13"`
    - `Pillow>=11.0.0 ; python_version >= "3.13"`
  - Always run via `./run.sh` which orchestrates the containerized flow and avoids PEP 668 issues.

- Docker import error: `ModuleNotFoundError: cv_parser.canonicalize`
  - Ensure the runtime includes the repo root on `PYTHONPATH`. The Dockerfile sets `PYTHONPATH=/app` to make sibling packages importable.
  - If you bind-mount custom paths, keep `/app` as working directory.

- Full audit
  - Run `scripts/env_audit.sh` to print local Python, pip packages, quick import checks, and a Docker runtime probe.
