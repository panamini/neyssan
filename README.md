# Neyssan CV Parser

FastAPI service that parses CVs and returns a normalized JSON payload aligned with our Convex canonical shape.

## First-time collaborator setup

`run.sh` is the development entry point; it is not a production launcher.
From a fresh clone:

```bash
cp .env.example .env.local
# Fill CONVEX_TEAM and CONVEX_PROJECT with the shared non-secret project slugs.
npm ci --prefix my-app
# Start Docker Desktop (macOS/WSL2) or the Docker daemon (Linux).
./run.sh bootstrap
```

`bootstrap` is idempotent. It reuses a valid local override or an existing
Infisical session. If neither exists, it opens the one-time Infisical browser
login, retries the same scoped read, and then runs `doctor local-fast`. It does
not start or stop the stack, source local shell configuration, install packages,
or create runtime state. Browser login requires an interactive terminal. A local
non-TTY wrapper may explicitly use `./run.sh bootstrap --allow-browser-login`,
but CI always fails closed unless it provides `INFISICAL_TOKEN`.

Repository access and Infisical access are separate. A collaborator must be
granted read access to the Twoweeks Infisical project even if their code was
delivered before their GitHub invitation was ready.

The Clerk publishable key is browser-visible rather than a server secret, but
it is environment-specific. When no usable local value is configured,
`./run.sh doctor local-fast` and `./run.sh local-fast` retrieve only
`VITE_CLERK_PUBLISHABLE_KEY` from the Infisical `dev` root and export it to the
child process in memory. The value is not written to an environment file or
printed.

To override the shared value locally, create the ignored app environment file:

```bash
cp my-app/.env.local.example my-app/.env.local
# Set VITE_CLERK_PUBLISHABLE_KEY to the intended Clerk instance.
```

An exported value or supported local environment value takes precedence, so
Infisical is not contacted when an override is already usable. Never paste a
real value into a tracked file, issue, test, or PR.

`local-fast` never opens an authentication window. If access has not been
prepared, it fails with separate guidance for collaborators (`./run.sh
bootstrap`) and headless environments (`INFISICAL_TOKEN`).

Start the local Docker engine before continuing:

- macOS: start Docker Desktop.
- Linux: start the local Docker daemon (for example,
  `sudo systemctl start docker`).
- WSL2: start Docker Desktop and enable integration for the WSL2 distribution.

Then use the one canonical lifecycle:

```bash
./run.sh doctor local-fast
./run.sh local-fast
./run.sh status
./run.sh down
```

`doctor` is read-only. If dependencies or Docker are unavailable, it names the
failed prerequisite and prints the exact remediation without installing or
starting anything.

`CONVEX_TEAM` and `CONVEX_PROJECT` are project identifiers, not secrets. Keep
real API keys and personal tokens out of git.

The tracked `.env.example` and `my-app/.env.local.example` files are committed
because they contain only configuration names, safe defaults, and blank
placeholders. Real `.env.local` files remain Git-ignored because they hold
machine-specific values and may also contain secrets.

The root `.env.local` is the canonical operator configuration. Keep
`my-app/.env.local` limited to app/Vite values as documented in
`my-app/.env.local.example`.

The existing `./run.sh mcp-secret-sync` command is scoped to the private-beta
OAuth client-secret digest. The Clerk bootstrap is separate and does not change
that command's precedence or derivation behavior.

## Headless servers, CI, and Docker

Machine authentication stays outside the application image. Do not put an
Infisical token, Universal Auth client secret, or environment file in a
Dockerfile, build argument, image layer, or repository.

For a generic headless development host:

1. Create a read-only Infisical Machine Identity scoped to the required
   project, environment, path, and secret.
2. Let the host secret store, an Infisical Agent, or an init process exchange
   that workload identity for a short-lived access token.
3. Provide the token only to the `run.sh` process:

```bash
INFISICAL_TOKEN="<short-lived machine token>" ./run.sh bootstrap
INFISICAL_TOKEN="<short-lived machine token>" ./run.sh local-fast
```

These commands are examples of the environment contract, not a recommendation
to paste a real token into shell history. Configure the variable through the
hosting platform's secret injection mechanism.

For GitHub Actions, prefer an Infisical Machine Identity with GitHub OIDC. The
workflow receives a short-lived token without storing a permanent Infisical
client secret in GitHub.

The parser Docker container does not need the Clerk publishable key. Vite does:
for a production frontend build, inject `VITE_CLERK_PUBLISHABLE_KEY` into the
build job before `vite build`. The publishable value becomes part of the browser
bundle by design, while the Infisical authentication credential remains outside
the image and build output.

`run.sh` is development-only. Production servers must receive the same
Infisical variable through a machine identity and their deployment
environment/configuration. They must not run the local development stack to
obtain production configuration.

## Daily local commands

```bash
./run.sh doctor local-fast   # explain missing prerequisites without starting services
./run.sh local-fast          # fast full-app parser development
./run.sh status              # inspect parser, local Convex, Vite, and tracked mode
./run.sh down                # stop only resources owned by this worktree
./run.sh tunnel              # stable end-to-end validation via parser.dasti.ai
./run.sh parser-dev          # parser-only / advanced Python hacking
./run.sh reload-env          # refresh parser/Vite/Convex/tunnel after env changes
./run.sh rebuild-docker      # explicit Docker/runtime rebuild + stable image validation
./run.sh reset               # stronger cleanup for stale owned local dev state
```

`local-fast` is the daily parser-development mode:

- parser runs from the workspace with autoreload
- Vite points at the local parser
- local Convex actions also resolve the local parser
- export worker dependencies stay on the image-installed Linux runtime
- normal Python parser edits do not require Docker rebuild

Use `tunnel` when you want stable image-runtime validation against the edge path.

Compatibility and advanced commands:

- `./run.sh local` remains available for image-runtime local parser work
- `./run.sh local-convex` remains as a legacy alias to `./run.sh local-fast`
- `./run.sh reload-env` restarts the tracked stack to pick up `.env.local` changes without rebuilding the Docker image
- `./run.sh rebuild-docker` is still required after Dockerfile or runtime dependency changes

## Endpoints

- `GET /health` → `{"status":"ok"}`
- `POST /parse-cv` → normalized payload (stable shape)

## Autonomous parser image

`run.sh` is for local development only. The parser server has its own
platform-neutral image contract:

```bash
docker build -f cv_parser_service/Dockerfile -t twoweeks-cv-parser .
docker run --rm -e PORT=8000 -p 8000:8000 twoweeks-cv-parser
curl -fsS http://127.0.0.1:8000/healthz
```

The image defaults to port `8000`, accepts an operator-provided `PORT`, starts
Uvicorn directly, and exposes `/healthz` through its Docker healthcheck. Hosting
credentials and application secrets remain runtime configuration; the image
does not depend on a Railway- or Hetzner-specific entrypoint.

## Dev Scripts

- `scripts/parser.sh` — start/stop/restart/status/logs/smoke
- `scripts/run_abc.py` — ABC acceptance smoke
- `scripts/parse.py` — parse a file or folder; output → `artifacts/samples/`
- `./run.sh` — orchestration entry point (see `./run.sh --help`)
- `scripts/start-dev.sh` — container lifecycle helper used by `run.sh`

## CI

`.github/workflows/parser-smoke.yml` boots the parser, waits for `/health`, runs the smoke, parses fixtures, and uploads artifacts (samples + logs) for every PR and pushes to main/master.

## Layout

```
cv_parser/
  canonicalize.py
cv_parser_service/
  main.py
scripts/
  parser.sh
  start-dev.sh
  run_abc.py
  parse.py
artifacts/
  samples/
fixtures/
  fixturetest/
```

## Troubleshooting

- Parser won’t start?  
  `scripts/parser.sh logs`

- Port busy?  
  `PORT=8010 scripts/parser.sh start`  
  `PARSER_URL=http://127.0.0.1:8010/parse-cv python scripts/parse.py fixtures/fixturetest`


parser.dasti.ai — Zero Trust + Tunnel + Convex runbook
0) What “good” looks like

Edge checks (from your laptop/CI):

# public health
curl --http1.1 -s -o /dev/null -w 'ready=%{http_code}\n' https://parser.dasti.ai/ready
# → 200

# protected GET (no token)
curl --http1.1 -s -o /dev/null -w 'get=%{http_code}\n' https://parser.dasti.ai/mistral-ocr/parse
# → 403 (or 405 if origin answers GET with 405; either is fine)

# protected POST (with service token)
curl --http1.1 -s -o /dev/null -w 'post=%{http_code}\n' \
  -H 'Accept: application/json' -H 'Expect:' \
  -H 'CF-Access-Client-Id: <SERVICE_TOKEN_CLIENT_ID>.access' \
  -H 'CF-Access-Client-Secret: <SERVICE_TOKEN_CLIENT_SECRET>' \
  -F "file=@./fixtures/cv_png.pdf;type=application/pdf" \
  https://parser.dasti.ai/mistral-ocr/parse
# → 200


Connector log should show the POST:

docker logs --since 120s cloudflared 2>&1 | grep -Ei ' /mistral-ocr/parse' || echo 'NO parse seen'

1) Cloudflare Zero Trust — Access apps (exactly two)

Access → Applications
Create/keep only these two for parser.dasti.ai. Delete/disable any other app that mentions this hostname/wildcards.

A. Protected app (Service Auth)

Public hostnames (rows):

parser.dasti.ai /mistral-ocr/*

parser.dasti.ai /parse-cv

Policies (order matters):

Service Auth → Include → Service Token = <your service token>

No Bypass/Allow above it. No extra policies.

Save.

B. Health app (Bypass)

Public hostnames (row):

parser.dasti.ai /ready

Policies:

Bypass → Include → Everyone

Save.

Tip: paths must have a leading slash.

2) Cloudflare Tunnel — Published routes (single “good” tunnel)

Zero Trust → Networks → Tunnels → <your good tunnel> → Published application routes

Keep only these two rows (in this order):

parser.dasti.ai /ready → http_status:200

parser.dasti.ai / → http://cv-parser-service-dev:8001*

Delete any other parser.dasti.ai routes in other tunnels so all traffic goes to this one.

You should see the connector log pull this config line after start:

Updated to new configuration … "path":"/ready","service":"http_status:200"}, {"path":"/*","service":"http://cv-parser-service-dev:8001"}

3) DNS for parser.dasti.ai

Two valid patterns — use one:

Managed by Tunnel: when you created the route in the tunnel UI with “Manage DNS” enabled, CF auto-manages DNS (you’ll usually see A/AAAA on the hostname, proxied).

Manual CNAME (if needed):
Add proxied CNAME parser.dasti.ai → <TUNNEL_ID>.cfargotunnel.com

Do not keep duplicates (no second CNAME/A/AAAA with the same name from another tunnel/app).

4) Service Token (Access)

Create one service token (name it parser).

You’ll get:

Client ID: looks like xxxxxxxxxxxxxxx.access

Client Secret: long hex

These power the protected POSTs. Rotate if you ever get 403s and you’re sure policies are correct.

5) Optional WAF tweak (only if multipart POST ever gets blocked)

If you see POST 502 at the edge without hitting the connector, add one narrow Skip rule:

Security → WAF → Custom Rules → “parserskip”
Expression (choose one):

By path (recommended):

http.host eq "parser.dasti.ai" and starts_with(http.request.uri.path, "/mistral-ocr/")


Or by content-type:

http.host eq "parser.dasti.ai" and
starts_with(lower(http.request.headers["content-type"][0]), "multipart/form-data")


Action: Skip → check Managed rules, Rate limiting, Super Bot Fight Mode, remaining custom rules.
Place near the top. Keep it narrow to our host/path only.

If your current setup works without this, you can skip adding it. It’s a guardrail for Cloudflare products that sometimes block large multipart uploads.

6) Connector (cloudflared) — run exactly one

We run one Docker connector on the parsernet network.

# kill any old ones (docker + host)
docker ps --filter ancestor=cloudflare/cloudflared:latest -q | xargs -r docker rm -f
sudo pkill -f 'cloudflared.*tunnel.*run' || true
pgrep -fal 'cloudflared.*tunnel.*run' || true   # should print nothing

# start one connector (use the token from the “good” tunnel above)
docker run -d --name cloudflared --restart=unless-stopped \
  --network parsernet cloudflare/cloudflared:latest \
  --loglevel debug tunnel --no-autoupdate run --protocol auto \
  --token "$TUNNEL_TOKEN"

# verify it registered & pulled ingress
sleep 2
docker logs --since 5s cloudflared 2>&1 | awk '/Updated to new configuration|Registered tunnel connection|Starting tunnel/{print}'

7) Convex / Frontend env

Ensure the Convex action points to the edge origin and carries the service token headers.

# set Convex env (project dir)
npx convex env set CONVEX_PARSER_URL https://parser.dasti.ai
npx convex env set CF_ACCESS_CLIENT_ID  <SERVICE_TOKEN_CLIENT_ID>.access
npx convex env set CF_ACCESS_CLIENT_SECRET <SERVICE_TOKEN_CLIENT_SECRET>

# verify
npx convex env get CONVEX_PARSER_URL
npx convex env get CF_ACCESS_CLIENT_ID
npx convex env get CF_ACCESS_CLIENT_SECRET


Restart your dev stack so the action picks these up:

./run.sh down || true
OPEN_BROWSER=0 ./run.sh up --ui
# or
cd my-app
pkill -f 'convex.*dev' || true
npx convex dev

8) Smoke test matrix (copy/paste)
# health
curl --http1.1 -s -o /dev/null -w 'ready=%{http_code}\n' https://parser.dasti.ai/ready

# protected GET (no token): expect 403/405
curl --http1.1 -s -o /dev/null -w 'get=%{http_code}\n' https://parser.dasti.ai/mistral-ocr/parse

# protected POST with token: expect 200
curl --http1.1 -s -o /dev/null -w 'post=%{http_code}\n' \
  -H 'Accept: application/json' -H 'Expect:' \
  -H 'CF-Access-Client-Id: <SERVICE_TOKEN_CLIENT_ID>.access' \
  -H 'CF-Access-Client-Secret: <SERVICE_TOKEN_CLIENT_SECRET>' \
  -F "file=@./fixtures/cv_png.pdf;type=application/pdf" \
  https://parser.dasti.ai/mistral-ocr/parse

# prove the POST hit your connector
docker logs --since 120s cloudflared 2>&1 | grep -Ei ' /mistral-ocr/parse' || echo 'NO parse seen'

9) Troubleshooting quick map

ready=502 and no /ready in connector log → wrong tunnel/DNS; fix the tunnel routes or token.

get=403/405 is OK (protected path / method not allowed).

post=403 → the service token is wrong or Access policy order is wrong.
Fix: ensure Protected app has only “Service Auth → Include → <token>” on top; rotate token if needed.

post=502 and no /mistral-ocr/parse in connector log → edge blocked/redirected; add the narrow WAF Skip rule or remove conflicting Workers/Routes in other tunnels.

POST succeeds via CLI but UI fails (502) and connector sees nothing → the UI didn’t send CF headers or used a different origin; fix Convex env (Section 7).
