# run.sh collaborator portability

Change Contract: `CC-20260710-runsh-collaborator-portability-v1`

## Outcome

`./run.sh doctor [local-fast|mcp-private-beta]` performs read-only startup diagnostics before a collaborator launches the stack. It checks the operating environment, required commands, Node 20+ script execution, repository dependencies, writable runtime locations, Docker readiness, the parser image, the Convex binding, relevant ports, local Convex availability, and the selected target configuration. It prints status and key names only, never configured values.

The command does not source or execute dotenv files, create runtime directories, start or stop services, retrieve Infisical secrets, read `~/.mistral_key`, or modify environment files. Configuration checks parse assignments as data and never evaluate their contents as shell code.

The startup allowlist applies dotenv precedence for configured ports, parser image, Convex temporary storage, Convex team/project/deployment bindings, and `LOCAL_CONVEX_URL`. It accepts bare and `export` assignments. Dynamic shell expressions in these values are rejected with the key name only; collaborators must use literal values so preflight and startup cannot diverge.

Port validation is target-specific: `local-fast` validates `VITE_PORT`, while `mcp-private-beta` validates `MCP_PRIVATE_BETA_VITE_PORT`. Both validate resolved Convex cloud/site ports and reject values outside `1..65535` before any listener probe. `lsof` is optional; when absent, the doctor warns and skips conflict detection just as startup treats those probes as best effort.

The diagnostic resolves named local Convex state before checking ports, including state-configured cloud/site ports and an explicit loopback `LOCAL_CONVEX_URL`. It also fails when the user's Convex configuration disables local deployments. These checks use the same resolver and opt-out boundary as startup.

Docker image readiness is target-aware. A missing parser image remains a blocker for `local-fast`, whose workspace container requires an existing base image. For `mcp-private-beta`, it is a warning when a buildx builder is ready or when the buildx plugin is available to configure one, because that startup path performs those steps automatically. A missing buildx plugin remains a blocker. The doctor does not create a builder or build an image.

Private-beta validation replays `.env`, `.env.local`, and `my-app/.env` in startup order for `VITE_CLERK_PUBLISHABLE_KEY` and `MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE`. Empty higher-precedence assignments are preserved, and an empty final credentials path uses the same default as startup. Values are compared or used for local file checks only and are never printed.

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

Exit `0` means no startup blocker was detected. Exit `1` means one or more blockers were reported. An occupied port is a warning because it may belong to the already tracked stack. Exit `2` means the requested doctor target is invalid.

`doctor` is a preflight, not proof that every image pull, external network request, or later service startup will succeed. Run the selected stack command after a passing result and keep its runtime logs as the final evidence.

## Scope boundary

This change does not alter MCP/OAuth behavior, Docker images, Convex data, application runtime behavior, provider calls, or the ChatGPT connector. It replaces the stale proposal to source `my-app/.env.local` globally with a target-specific diagnostic that preserves the current environment ownership contract.
