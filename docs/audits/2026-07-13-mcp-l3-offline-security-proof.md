# MCP L3 offline security proof

Change Program: `CP-20260713-mcp-private-beta-readiness-v1 / MCP-L3`

## Outcome

This checkpoint maps the private-beta MCP authorization boundary to deterministic offline tests. It adds no runtime behavior, credentials, deployment, provider call, application write, or public-launch claim.

`OFFLINE_SECURITY_PROOF_COMPLETE` means the listed source and tests pass on this commit. It does not mean the endpoint was deployed, the live connector was re-tested, or public launch was approved.

## Evidence matrix

| Property | Fail-closed behavior | Direct evidence |
| --- | --- | --- |
| Cross-subject isolation | A verified subject whose digest is absent from the private-beta allowlist is rejected before tool argument validation or execution; neither subject identifier is echoed. | `mcpOAuthProductionRouteAdapter.test.ts`: `denies non-allowlisted private beta identities before tools/call validation`; `mcpProductionPrivateBetaGate.test.ts`: non-matching digest case |
| Wrong client binding | Access-token verification rejects a token stored for another client and does not dispatch MCP policy or tools. | Route adapter table case `wrong client binding`; Convex verifier table test `fails access-token verification for wrong client`, which returns `wrong_client`, performs no storage patch, and does not echo the raw token or digest |
| Wrong resource binding | Access-token verification rejects a token stored for another resource and does not dispatch tools. | Route adapter table case `wrong resource binding`; Convex active-token verification cases |
| Expired token | Expired bearer state is rejected with the bounded Bearer challenge; tool execution is not reached. | Route adapter table case `expired token`; Convex storage-time expiry tests |
| Revoked token | Revoked bearer state is rejected before MCP policy and tool execution. | Route adapter table case `revoked token`; Convex active-token verification cases |
| Authorization-code replay | A pending authorization-code digest can be consumed only once; replay is rejected without issuing another token. | Route test `consumes a valid authorization code once and rejects token replay`; Convex test `consumes a pending code digest once and rejects replay` |
| Concurrent redemption route contract | Two simultaneous route calls against the in-memory test dependency yield exactly one successful token issue. This is not a concurrent Convex transaction proof. | Route test `allows exactly one concurrent token redemption success for the same authorization code`; the separate Convex test proves atomic issue-and-consume behavior in isolation |
| No sensitive response leakage | Blocked responses exclude raw codes, redirect secrets, OAuth material, provider configuration, and owner identifiers. Selected bearer and tool cases also assert that the fixture access-token digest is absent. | Route test `keeps blocked responses free of secrets, provider config values, owner identifiers, codes, and redirect secrets`; shared `expectNoRouteLeakage` assertions; explicit `ACCESS_TOKEN_DIGEST` non-echo assertions in MCP route cases |
| No external side effects | The production route and read-only summary executor have no provider exchange, refresh-token, account-link, direct write, or UI import path. | Route source guards `has no provider call, token exchange, account-link, refresh-token, or direct storage path` and `keeps the production read-only summary executor free of provider, write, OAuth issuance, and UI imports` |

## Replay boundary

In this checkpoint, “replay protection” means one-time authorization-code redemption at the token endpoint. An in-memory route-contract test additionally models two simultaneous calls, but it does not prove concurrent storage transactions. This checkpoint does **not** claim sender-constrained bearer tokens or rejection of every repeated use of an already-issued active bearer token. Adding DPoP, mTLS, token rotation, refresh tokens, or another sender-constrained-token design would be a separate high-risk contract.

## Data and effect boundary

- Authorization codes and access tokens are persisted only by digest-backed server-side records.
- The private-beta subject allowlist contains only lowercase SHA-256 digests; the verified raw subject is hashed at the route boundary.
- Tests assert that raw OAuth material, subject identifiers, provider configuration, and private application content do not enter safe responses. Selected bearer and tool cases separately assert that their fixture access-token digest is not echoed; no broader all-digest claim is made.
- The MCP surface remains read-only. Provider/model calls, application writes, billing, account-link expansion, refresh tokens, DCR, CIMD, deployment, and public launch remain outside this proof.

## Verification

Fresh checks on the exact L1 base used by this documentation leaf:

- focused private-beta gate and production route tests: `219/219` passed
- Convex authorization-code tests: `28/28` passed
- `run.sh` doctor tests: `184/184` passed
- production build: passed
- changed-file Fallow audit: exit `0`, with inherited complexity, duplication, and unused-dependency advisories excluded from the changed-file gate
- independent exact-artifact review: `LOCAL_REVIEW_CLEAR`

Reproduce the credential-free route suites; these do not require generated Convex bindings:

```bash
rtk npm --prefix my-app run test -- \
  src/modules/local-mcp/__tests__/mcpProductionPrivateBetaGate.test.ts \
  src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts --run
```

The Convex suite is also offline and needs no credentials when the ignored generated bindings already exist at `my-app/convex/_generated`. This checkout had those bindings pre-generated. A fresh checkout does not track them, and `convex/mcpOAuthAuthorizationCodes.ts` imports `./_generated/server`; if they are absent, stop rather than running credentialed or network-dependent codegen as part of this proof.

```bash
rtk npm --prefix my-app run test -- \
  convex/__tests__/mcpOAuthAuthorizationCodes.test.ts --run
```

Before committing, validate the local patch; after committing, validate the committed leaf range:

```bash
rtk git diff --check
rtk git diff --check HEAD^ HEAD
```

## Remaining limits

- No live deployed endpoint or ChatGPT connector was invoked by this documentation-only leaf. Offline route tests did exercise `tools/list` and `tools/call`; they do not constitute a live deployed ChatGPT endpoint invocation.
- Concurrent storage transactions were not exercised; the concurrent-redemption evidence is limited to the route contract described above.
- No production/shared database was read or mutated.
- No provider/model call or application write occurred.
- Deployment, operator migration, public submission, OpenAI review, and public launch require separate explicit authorization and evidence.
