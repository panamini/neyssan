# run.sh collaborator portability

Change Contract: `CC-20260710-runsh-collaborator-portability-v1`

## Outcome

`./run.sh doctor [local-fast|mcp-private-beta]` performs read-only startup diagnostics before a collaborator launches the stack. It checks the operating environment, required commands, Node 20+ script execution, repository dependencies, writable runtime locations, Docker readiness, the parser image, the Convex binding, relevant ports, local Convex availability, and the selected target configuration. It prints status and key names only, never configured values.

The command does not source or execute dotenv files, create runtime directories, start or stop services, retrieve Infisical secrets, read `~/.mistral_key`, or modify environment files. Configuration checks parse assignments as data and never evaluate their contents as shell code.

The startup allowlist applies dotenv precedence for configured ports, parser image, Convex temporary storage, Convex team/project/deployment bindings, and `LOCAL_CONVEX_URL`. It accepts bare and `export` assignments. Dynamic shell expressions in these values are rejected with the key name only; collaborators must use literal values so preflight and startup cannot diverge.

The diagnostic resolves named local Convex state before checking ports, including state-configured cloud/site ports and an explicit loopback `LOCAL_CONVEX_URL`. It also fails when the user's Convex configuration disables local deployments. These checks use the same resolver and opt-out boundary as startup.

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
