# Twoweeks ChatGPT/App SDK Roadmap Progress Ledger

Canonical roadmap:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

Rule:

The roadmap defines intended PR order. This ledger records the actual repo state after each PR.
Later merged decisions may narrow a PR scope, but they must not invent, skip, or reorder PRs unless explicitly documented.

Agents must reload this file and the canonical roadmap before every PR.
Do not rely on chat memory or compressed context.

---

## Current position

Last merged PR:

```txt
PR185 - PR59: Read-Only Twoweeks Data Adapter
GitHub PR: https://github.com/panamini/neyssan/pull/185
Merge commit: a7062ab1ce6005c44c4e80f001e4600db4d76591
Merged at: 2026-06-15T17:19:41Z
```

Current open PR:

```txt
PR60 - Real Application Package Summary
GitHub PR: https://github.com/panamini/neyssan/pull/186
Head branch: codex/pr60-real-application-package-summary
```

Exact next PR:

```txt
PR61 - Real Evidence Graph Summary
```

PR59 status:

```txt
MERGED_NARROW_PR59 - PR185 merged the narrow read-only adapter scope approved by docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight-after-prep-8.md.
```

---

## Progress table

| PR | Title | Status | GitHub PR | Merge commit / head | Notes |
|---:|---|---|---|---|---|
| 41 | Agent roadmap contract | merged | #154 | to verify | Canonical roadmap created |
| 42 | Package-only MCP SDK dependency | merged | #155 | to verify | No runtime |
| 43 | Dependency import boundary | merged | #156 | to verify | No SDK runtime imports |
| 44 | Descriptor adapter contract tests | merged | #157 | to verify | PR38 descriptors |
| 45 | Static descriptor registry | merged | #158 | to verify | Fixture-only |
| 46 | Disabled local MCP server skeleton | merged | #159 | to verify | Disabled, no endpoint |
| 47 | Fixture-only tools/list simulation | merged | #160 | to verify | Internal only |
| 48 | Fixture-only tools/call simulation | merged | #161 | to verify | No-op/refusal |
| 49 | Golden safety tests | merged | #162 | to verify | Locks PR44–PR48 |
| 50 | Disabled local dev transport adapter | merged | #163 | to verify | Rate-limit integer guard fixed |
| 51 | Dev-only /mcp endpoint behind flag | merged | #164 | to verify | Local only, fixture-only |
| 52 | Fake ChatGPT flow demo | merged | #165 | to verify | Fake-data only |
| 53 | Auth/OAuth decision | merged | #166 | to verify | OAuth deferred |
| 54 | Auth/OAuth blocked boundary guards | merged | #167 | deb0031e490422413717a6755f3f319c1f947385 | No OAuth runtime |
| 55 | Consent Gate | merged | #168 | 64063cc75ba939b7b685e9684db32c11804da6fd | Consent boundary only |
| 56 | Redacted Audit Log | merged | #169, #170 follow-up | 457d579dfc25c638b063754c887b027042060500; follow-up f630d15192428efc03012a2da800617e3ed6b82f | Boundary-only redacted audit; CI/typecheck/Fallow passed; stale Greptile `sid` value finding fixed in #169; raw-payload key classifier tightened in #170 before PR57 |
| 57 | Retention and Deletion | merged | #171 | 8b092bc7264f97ff95966d03929c6470e6690117 | Retention/deletion boundary only |
| 58 | Semantic Privacy Test Harness | merged | #172 | 31faf4abc9cda0a33ed45925d67f856af01aa7fb | Deterministic fixture-only privacy harness; Greptile P2 comments addressed |
| 59-prep | OAuth/account-linking unlock decision for read-only MCP data | merged | #174 | 5db280565e07bbe0ecf4156314664761eb8e0900 | Docs-only decision PR. PR59 real data remained blocked pending verifier/account-linking path |
| 59-prep-2 | OAuth account-linking verifier boundary | merged | #175 | df3231d4277fa6fe4c8c0a6e5740a0ab105c1011 | Fail-closed Stytch-shaped verifier boundary only; no production OAuth runtime, callback, token storage, account-linking storage, real data, handlers, or connector behavior |
| 59-prep-3 | Account-linking storage and ledger alignment decision | merged | #176 | 7fe37402c7ad511122dd6ee6cae15e9d87844aa9 | Docs-only decision. Records PR175 merge and decides explicit server-only Stytch subject to Twoweeks/Convex ownership mapping |
| 59-prep-4 | Account-linking storage boundary | merged | #177 | 25481ca92ad5063cbe5a8ed2a4b3e34d81e2c9c8 | Boundary-only code PR. Validates server-only account-link record shape and fail-closed lookup contract. Qodo issues resolved; CI green before merge |
| 59-prep-5 | Safe Convex selector projection decision | merged | #178 | b51a95b39351a7b995ae147229690a5dc71b3212 | Docs-only decision defining safe projection rules before PR59 preflight rerun. CI green; review bots non-blocking/unavailable |
| 59-preflight | PR59 preflight rerun | merged | #179 | 439f01db84f2a5c23834f6ab8c2621e6dd3e6eae | Docs-only preflight after PR178; returned BLOCKED and recommended PR59-prep-6 |
| 59-prep-6 | MCP-safe selector projection boundary | merged | #180 | 038fe02522dd7e81a3a0278c1781317d0ac61459 | Fixture selector-like inputs only; no real data, Convex calls/imports, handlers, OAuth runtime, token storage, production connector behavior, outbound HTTP, model calls, package changes, or write/export/send/apply behavior |
| 59-preflight-after-prep-6 | PR59 preflight rerun after MCP-safe selector projection boundary | merged | #181 | df9afa6b1a13c9d79e17122634c5c79a82c18ac6 | Docs-only preflight returned BLOCKED and recommended PR59-prep-7 |
| 59-prep-7 | Production Stytch OAuth/config and account-link persistence decision | merged | #182 | d4b9d06053bcb6501073e54350953c650300fe87 | Docs-only decision. Approved narrow PR59-prep-8; PR59 remains blocked |
| 59-prep-8 | Production Stytch verifier/config and server-only account-link persistence boundary | merged | #183 | ea4697683a3da92314c12453846a18102b329fba | Boundary-only production-shaped Stytch verifier/config and server-only account-link persistence boundary. No PR59 adapter, real data reads, tools runtime, OAuth callback/token exchange/refresh/revocation/storage, production connector behavior, outbound HTTP, LLM/model calls, package changes, or write/export/send/submit/apply behavior |
| 59-preflight-after-prep-8 | Fresh PR59 preflight rerun after PR59-prep-8 | merged | #184 | f82d81279cf51ea6db78b3eed48f78e70e118767 | Docs-only preflight returned READY_TO_IMPLEMENT_NARROW_PR59 and defined the exact narrow PR59 scope |
| 59 | Read-Only Twoweeks Data Adapter | merged | #185 | a7062ab1ce6005c44c4e80f001e4600db4d76591 | Boundary-backed read-only adapter and Convex data-ref query only; approved opaque refs only; no app-facing selector reuse, no tools runtime, no production connector, no token storage, no outbound HTTP, no LLM/model calls, no writes, no export/download/send/submit/apply; merged_at 2026-06-15T17:19:41Z |
| 60 | Real Application Package Summary | in progress | #186 | codex/pr60-real-application-package-summary | Read-only real application package summary boundary built on PR59 refs only; safe aggregate counts/categories/status only; no runtime wiring, tools runtime, production connector, OAuth/token changes, outbound HTTP, LLM/model calls, package changes, writes, export/download/send/submit/apply, or PR61 evidence graph scope |

---

## Merged decision narrowing

PR53 narrowed auth work:

```txt
OAuth implementation remains blocked.
Fake-data local developer flows may remain no-auth.
Real-data, production connector, or write-capable flows require a future OAuth implementation PR with explicit gates.
```

Therefore PR54 was correctly implemented as Auth/OAuth blocked boundary guards, not real OAuth runtime.

PR55 was consent boundary only.
PR56 was redacted audit boundary only.
PR56 follow-up #170 fixed audit sid key detection before PR57.
PR57 is retention/deletion boundary only unless explicitly narrowed or approved: retention/deletion shape/helpers/tests; no real persistence deletion, Convex writes, real user data, OAuth runtime, handlers, outbound HTTP, LLM calls, export/send/apply, or package/lockfile changes.
PR58 is semantic privacy test harness only: deterministic fixture-only tests, no runtime, no real data, no network, no LLM, no Convex, no UI, no package or lockfile changes.
Maintainer decision after PR59 preflight: do not implement boundary-only PR59. Boundary-only is safe but not useful enough after PR53-PR58. PR59 real-data implementation remains blocked.

PR174 selected the OAuth/account-linking decision path before PR59. It did not implement OAuth runtime, callback, token storage, account-linking code, real data, Convex reads/writes, handlers, production connector, or tool execution.

PR175 implemented only a fail-closed Stytch-shaped OAuth verifier boundary with fixture JWTs and injected JWKS keys. PR175 does not map Stytch `sub` to Twoweeks/Convex ownership and does not unlock PR59 real data.

PR59-prep-3 is now the authoritative account-linking storage decision for the Stytch-selected MCP path. It narrows the earlier blocked provider-selection discussion by making the storage bridge explicit and server-only.

PR59-prep-3 decides that Stytch `sub` must not be treated as Convex `clerkId`. A future server-only account-linking storage boundary must explicitly map verified Stytch subject to existing Twoweeks/Convex `clerkId` before any real Convex/Twoweeks data can be read.

PR59-prep-4 implements the smallest safe server-only storage boundary for that mapping. It still does not expose real data, real handlers, OAuth runtime, token storage, or any write/export/send/apply behavior.

PR177 merged PR59-prep-4. Qodo reported prototype parsing, malformed-link fail-open, missing state type, and loose record type issues; the PR fixed them before merge. CodeRabbit skipped review on the non-default base branch; CI was green; merge state was clean.

Existing Convex selectors are not safe for direct MCP use because they expose raw/sensitive fields such as `raw_text`, `rawDescription`, `sourceText`, full proposal `content`, `sourceJobDescription`, `clerkId`, `userId`, and `email`. PR59 requires safe selector projection before implementation.

PR59-prep-5 is the safe selector projection decision step. It must remain docs-only unless maintainer explicitly approves a code boundary. It defines exactly which projection classes and fields may be considered by PR59 preflight.

PR178 merged PR59-prep-5. Qodo was paused, Greptile was quota-limited, and CodeRabbit skipped review because the base branch was non-default. CI was green and merge state was clean before merge.

PR179 merged the PR59 preflight rerun. It remained docs-only, returned BLOCKED, and recommended a separate PR59-prep-6 for the MCP-safe selector projection boundary.

PR180 merged PR59-prep-6. It added a pure fixture-only MCP-safe selector projection boundary and tests. It does not implement PR59, does not call Convex, does not expose real data, and does not authorize MCP real-data reads.

PR181 merged the fresh PR59 preflight rerun after PR59-prep-6. It returned BLOCKED and recommended PR59-prep-7 for the production Stytch OAuth/config and account-link persistence decision. Boundary-only PR59 must not be implemented.

PR59-prep-7 merged in PR182. It approves exactly PR59-prep-8 for production Stytch verifier/config and server-only account-link persistence boundary implementation. PR59 remains blocked until PR59-prep-8 is merged and a fresh PR59 preflight returns READY_TO_IMPLEMENT_NARROW_PR59.

PR59-prep-8 merged in PR183. It added production-shaped Stytch verifier/config validation, server-only account-link persistence, tests, and ledger alignment only. It did not implement PR59, real data reads, tools runtime, OAuth callback/token exchange/refresh/revocation/storage, production connector behavior, outbound HTTP, LLM/model calls, package changes, or write/export/send/submit/apply behavior.

The fresh PR59 preflight after PR59-prep-8 returns `READY_TO_IMPLEMENT_NARROW_PR59`. PR59 may start only after this preflight merges and only within the exact narrow scope described by `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight-after-prep-8.md`.

PR184 merged the fresh PR59 preflight after PR59-prep-8 into `application-os-foundation`. It was docs-only and explicitly unlocked only the narrow PR59 read-only adapter scope. PR59 is now the active implementation PR on `codex/pr59-read-only-twoweeks-data-adapter`.

PR185 merged PR59 into `application-os-foundation` with merge commit `a7062ab1ce6005c44c4e80f001e4600db4d76591` at `2026-06-15T17:19:41Z`. It added the read-only Twoweeks data adapter, read-only Convex data-ref query, descriptor-safe adapter input parsing, and tests. It did not start PR60 or add runtime wiring beyond the approved PR59 scope.

PR60 is the active implementation PR. It is limited to a read-only real application package summary over PR59's safe application-package ref and server-only Convex aggregate metadata. It must not add runtime wiring, production connector behavior, OAuth/token changes, outbound HTTP, LLM/model calls, write/export/send/submit/apply behavior, package changes, or PR61 evidence graph behavior.

OAuth/real-data/write-action constraints remain active: no OAuth runtime, callback, token storage, real user data, Convex real-data reads/writes, handlers, production connector, tool execution, outbound HTTP, LLM calls, export/download/send/submit/apply, or package/lockfile changes without an explicit unlocking PR.

---

## Agent continuation rule

Before each PR:

1. Reload the canonical roadmap.
2. Reload this progress ledger.
3. Verify local branch is aligned with remote `application-os-foundation`.
4. Verify current GitHub PR state.
5. Continue only the lowest-numbered open/unmerged PR.
6. Stop if roadmap, ledger, local branch, or GitHub disagree.

After each merge, update this ledger with:

```txt
- PR number
- title
- PR URL
- merge commit
- actual scope
- important scope narrowing
- Greptile/Fallow notes
- exact next PR
```
