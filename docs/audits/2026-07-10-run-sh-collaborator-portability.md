# run.sh collaborator portability

Change Contract: `CC-20260710-runsh-collaborator-portability-v1`

## Outcome

`./run.sh doctor [local-fast|mcp-private-beta]` performs read-only startup diagnostics before a collaborator launches the stack. It checks the operating environment, required commands, Node 20+ script execution, repository dependencies, writable runtime locations, Docker readiness, the parser image, the Convex binding, relevant ports, local Convex availability, and the selected target configuration. It prints status and key names only, never configured values. On native Linux, the MCP cloudflared container uses Docker host networking so it can reach Vite while Vite remains bound to loopback; Docker Desktop hosts continue to use `host.docker.internal`.

The command does not source or execute dotenv files, create runtime directories, start or stop services, retrieve Infisical secrets, read `~/.mistral_key`, or modify environment files. Configuration checks parse assignments as data and never evaluate their contents as shell code.

The startup allowlist applies dotenv precedence for configured ports, parser image and container names, Convex temporary storage, Convex team/project/deployment bindings, `HOME`, `LOCAL_CONVEX_URL`, and `LOCAL_CONVEX_STARTUP_TIMEOUT`. It accepts bare and `export` assignments. Dynamic shell expressions in these values are rejected with the key name only; collaborators must use literal values so preflight and startup cannot diverge. The Convex startup timeout must be a positive integer, `IMAGE_NAME` must be a valid Docker image reference, and `PARSER_NAME` plus `CLOUDFLARED_NAME` must satisfy Docker's container-name format.

Validation follows winning-assignment semantics for non-executing values: a later valid or empty assignment clears an earlier invalid literal for the same key. Shell syntax errors are blockers in every sourced environment file. Every sourced statement must be an assignment, including keys outside the runtime override allowlist; commands, undefined or complex parameter expansions, command/process substitutions, malformed assignment commands, `PATH`, `NODE_OPTIONS`, `IFS`, `ROOT_DIR`, or Docker CLI control-variable overrides, assignments to variables that are readonly in the active Bash runtime, and other shell evaluation remain blockers even if a later file overrides the key, because startup evaluates the earlier statement first. The Docker control-variable set follows the official CLI environment-variable surface, including daemon/context/TLS/config/platform/build-progress/proxy controls and lowercase Go proxy aliases, so doctor and startup cannot silently target different Docker behavior. Simple `$VAR` and `${VAR}` references are resolved against the sequential dotenv environment like startup, seeded with the pre-source `ROOT_DIR`, including MCP path settings and safe concatenation of quoted and unquoted literal segments. A leading `#` on the assignment right-hand side remains literal data; only an unquoted hash after whitespace starts an inline comment. Inline comments are stripped before classification; CRLF files are rejected because Bash preserves their carriage returns; and quoted multi-line literals remain supported. Runtime values cross the internal Node-to-Bash boundary as encoded records so line breaks cannot be confused with new records or printed. Environment read failures become generic blockers without Node stacks or file paths. Fatal assignments also remain sticky across duplicate keys within one file. Legacy `MCP_PRODUCTION_PRIVATE_BETA_*` aliases are checked only in root `.env.local` and `my-app/.env.local`, matching `mcp-check`.

Port validation is target-specific: `local-fast` validates `VITE_PORT`, while `mcp-private-beta` validates `MCP_PRIVATE_BETA_VITE_PORT`. Both normalize decimal leading zeros, validate resolved Convex cloud/site ports, and reject values outside `1..65535` before any listener probe. UI ports in the startup cleanup range `5173..5215` produce warnings when occupied because startup can release them; occupied custom UI ports outside that range are blockers. An explicit `LOCAL_CONVEX_URL` must use the resolved cloud port. `lsof` is optional; when absent, the doctor warns and skips conflict detection. When available, an unrelated parser listener is a blocker. A tracked parser is reusable only when its runtime matches the request, its image identity matches in image mode, Docker confirms that it publishes host port `8001`, `/ready` succeeds, and a workspace runtime exposes the dependencies startup checks. Direct startup and idempotent tracked-state reuse apply the same runtime, image, ownership, health, and workspace-surface gates. A stale tracked parser bypasses the listener blocker only when Docker confirms that it publishes host port `8001` and startup can free that binding before replacement. Occupied Convex ports are blockers unless the matching tracked backend is reusable.

The diagnostic replays sourced `HOME` before resolving named local Convex state and user configuration, then checks state-configured cloud/site ports and an explicit loopback `LOCAL_CONVEX_URL`. A discovered state configuration must parse as JSON before its ports or tracked backend can be accepted. It also fails when the user's Convex configuration disables local deployments. These checks use the same resolver and opt-out boundary as startup.

Docker image readiness is target-aware. A missing parser image is accepted for `local-fast` only when a healthy tracked workspace parser is reusable without a tracked env change that would restart it; otherwise that target still requires an existing base image. For `mcp-private-beta`, it is a warning when a buildx builder is ready or when the buildx plugin is available to configure one, because that startup path performs those steps automatically. A requested `FORCE_REBUILD` checks buildx even when the image already exists. A missing buildx plugin remains a blocker. The doctor does not create a builder or build an image.

Private-beta validation replays `.env`, `.env.local`, and `my-app/.env` in startup order. For the Vite-owned `VITE_CLERK_PUBLISHABLE_KEY`, only startup-sourced values can conflict with the derived key; when none is exported, `mcp_resolve_clerk_publishable_key` exports the derived value before Vite and therefore overrides `my-app/.env.local`. Empty higher-precedence assignments are preserved, and an empty final credentials path uses the same default as startup, derived from the sourced `HOME` value. A credentials path containing a comma is rejected because the active tunnel launch path passes it through a comma-delimited Docker label. The resolved credentials path must be a regular file with mode `400` or `600`, matching `mcp-check`. Root MCP environment and tunnel credential symlinks are rejected because the startup mode check observes the link metadata rather than the target mode. Values are compared or used for local file checks only and are never printed.

The doctor requires `seq`, which the startup cleanup and wait loops execute, and validates that existing runtime directories and creatable parents are both writable and searchable before startup's initial `mkdir -p` and redirection boundaries.

`npm` is optional after dependencies are installed because selected startup paths execute Node, Vite, and Convex binaries directly. Its absence produces installation guidance as a warning rather than a startup blocker.

## Supported environments

| Host | Supported execution environment |
| --- | --- |
| macOS Intel or Apple Silicon | macOS Bash 3.2 or newer with Docker Desktop |
| Linux x86_64 or arm64 | Bash 3.2 or newer with Docker Engine or Docker Desktop |
| Windows | WSL2 with Docker Desktop WSL integration |

Native PowerShell, Command Prompt, MSYS2, Cygwin, and Git Bash are not supported execution environments for `run.sh`. The stack depends on Bash process semantics, Linux containers, Unix permissions, and Docker bind-mount path behavior. On Windows, clone and run the repository inside the WSL filesystem rather than through a mounted Windows path when possible.

## Configuration ownership

- Root `.env.local` owns server-side configuration and private-beta MCP digests.
- `my-app/.env.local` remains Vite client configuration; it is not sourced globally by `run.sh`.
- Infisical remains the team source for the raw private-beta OAuth client secret. `doctor` does not retrieve it.

## Usage

```bash
./run.sh doctor local-fast
./run.sh doctor mcp-private-beta
```

Exit `0` means no startup blocker was detected. Exit `1` means one or more blockers were reported. An unrelated parser listener is a blocker, while the exact managed parser container may be reused or replaced. Occupied Convex ports are blockers unless the matching tracked backend is reusable; occupied UI ports remain warnings. Exit `2` means the requested doctor target is invalid.

`doctor` is a preflight, not proof that every image pull, external network request, or later service startup will succeed. Run the selected stack command after a passing result and keep its runtime logs as the final evidence.

## Scope boundary

This change does not alter MCP/OAuth behavior, Docker images, Convex data, application runtime behavior, provider calls, or the ChatGPT connector. It replaces the stale proposal to source `my-app/.env.local` globally with a target-specific diagnostic that preserves the current environment ownership contract.
