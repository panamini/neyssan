# PR87.15D Local Runtime Wiring Brief

Title: PR87.15D - wire composed Stytch auth into the local/dev MCP runtime.

Slice: install the merged PR87.15C auth composition dependencies into the Vite local/dev MCP middleware only.

Actual base SHA: `f161ae9302269e5944101dd65ec4e375c112c070`.

PR261 final head: `ccc4fe7469d17e62e8ec400288e45c4243679d94`.

PR261 merge SHA: `f161ae9302269e5944101dd65ec4e375c112c070`.

Wiki checkpoint status: absent at preflight, then recorded and pushed to `twoweeks-wiki` `main` at `f2e9891678bf24151f59f31d89f48b8337cb4c81` before implementation. Wiki is read-only after this brief.

Branch: `codex/pr87-15d-mcp-auth-local-runtime-wiring`.

Worktree: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan-pr87-15d-mcp-auth-local-runtime-wiring`.

PR261 composition-builder export: `buildMcpAuthCompositionDependencies(input: unknown): McpAuthCompositionDependenciesResultV1`.

Config input type: `McpAuthCompositionBoundaryConfigV1`, requiring exact local/dev auth config, Stytch verifier config, canonical resource/audience, issuer, provider environment, approved client IDs, canonical scope, account-link lookup adapter config, `localDevOnly: true`, `nonProductionOnly: true`, and `version: 1`.

Success/failure result shape: `configured: true` returns `tokenVerifier`, `accountLinkLookup`, and metadata; `configured: false` returns safe metadata and a bounded failure reason without JWKS/key material.

Endpoint dependency type: `LocalMcpDevEndpointDependenciesV1`, with optional `tokenVerifier`, `accountLinkLookup`, `nowEpochSeconds`, and `onFixtureHandlerInvoke`.

Current Vite plugin factory and middleware flow: `localMcpDevEndpointPlugin()` reads strict local flags, builds `LocalMcpDevEndpointConfigV1`, registers dev middleware, converts Node requests into `handleLocalMcpDevEndpointRequestAsync`, and currently passes no auth dependencies.

Current runtime verifier default: `localMcpDevEndpoint.ts` uses `denyAllMcpBearerTokenVerifier` when auth policy mode is enabled and no verifier dependency is injected.

Current runtime lookup default: `localMcpDevEndpoint.ts` uses `emptyMcpAccountLinkLookup`, returning no candidates.

Proposed explicit flags:
- `LOCAL_MCP_DEV_STYTCH_COMPOSITION=1`
- `LOCAL_MCP_DEV_STYTCH_JWKS_JSON=<public JWKS JSON>`

Parent flags required:
- `LOCAL_MCP_DEV_ENDPOINT=1`
- `LOCAL_MCP_DEV_FIXTURE_DEMO=1`
- `LOCAL_MCP_DEV_AUTH_POLICY=1`

Public-JWKS parsing design: parse only when all parent flags and composition flag are exactly `1`; require a nonblank string below a conservative byte limit; require a plain object with only `keys`; require bounded nonempty keys; reject private JWK members, duplicate or missing `kid`, non-RSA keys, wrong `alg`/`use`, and raw/private material; deep-copy accepted public fields; do not log or return the source JSON.

One-time construction lifecycle: Vite plugin initialization reads env, parses JWKS, builds local auth config, builds a fail-closed runtime lookup adapter, calls `buildMcpAuthCompositionDependencies` once, and passes the resulting dependencies to the endpoint middleware. Disabled modes parse/build nothing.

Runtime no-link policy: no safe existing Vite server-only Convex internal-query bridge is present. Runtime composed mode uses a narrow fail-closed query delegate that accepts only the exact PR259 query-ref sentinel and returns no candidates, so valid tokens reach `account_link_required` and fixture handlers do not run.

Direct test-injection path: expose a local Vite plugin factory option for tests to provide already-built endpoint dependencies from the real PR261 composition builder, PR257 verifier, PR259 lookup adapter, and synthetic canonical account-link rows. This is not environment-selected.

Exact files proposed to touch:
- `docs/plans/2026-06-25-pr87-15d-mcp-auth-local-runtime-wiring-brief.md`
- `my-app/src/modules/local-mcp/localMcpDevAuthRuntimeComposition.ts`
- `my-app/src/modules/local-mcp/__tests__/localMcpDevAuthRuntimeComposition.test.ts`
- `my-app/src/modules/local-mcp/__tests__/localMcpDevEndpoint.vite-auth-composition.test.ts`
- `my-app/vite.config.ts`
- `my-app/tsconfig.node.json` only if the new server-only module must enter the node project reference.

Forbidden files:
- package manifests and lockfiles
- Convex schema and generated files
- production/deploy config
- cover-letter files
- PR88/PR89/account-link lifecycle/consent/real-data surfaces

Tests:
- focused runtime composition config and lifecycle tests
- Vite middleware HTTP tests with generated RS256 tokens
- PR261, PR259, PR258, PR257, PR256, PR255, and PR254 regression suites
- full `src/modules/local-mcp/__tests__`
- relevant Convex and Vite/config tests
- TypeScript, targeted ESLint, build, Fallow, diff checks, and forbidden-surface grep

Build gate: use compatible existing `node_modules` and generated Convex symlinks only if manifests match; remove symlinks and generated validation artifacts before final status.

Rollback: revert this PR. PR261 composition, PR259 lookup adapter, PR258 storage, PR257 verifier, and PR256 endpoint auth mode remain; no data/provider/production rollback is required.

READY_TO_IMPLEMENT
