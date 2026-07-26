# Developer Quickstart

The canonical first-time path is the root
[README](README.md#first-time-collaborator-setup). In short:

```bash
cp .env.example .env.local
# Fill only the shared non-secret CONVEX_TEAM and CONVEX_PROJECT slugs.
npm ci --prefix my-app
# Start Docker Desktop (macOS/WSL2) or the local Docker daemon (Linux).
./run.sh doctor local-fast
./run.sh local-fast
./run.sh status
./run.sh down
```

`run.sh` is development-only. Root `.env.local` is the canonical operator
configuration; `my-app/.env.local` remains app/Vite-only. `doctor` never
installs dependencies or starts Docker.

After changing root or app environment configuration, use
`./run.sh reload-env`. Use `./run.sh rebuild-docker` only after Dockerfile or
runtime dependency changes.
