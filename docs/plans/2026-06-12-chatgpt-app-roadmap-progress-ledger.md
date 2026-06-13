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
PR58 — Semantic Privacy Test Harness
GitHub PR: https://github.com/panamini/neyssan/pull/172
Merge commit: 31faf4abc9cda0a33ed45925d67f856af01aa7fb
Merged at: 2026-06-13T00:07:40Z
```

Current open PR:

```txt
PR59-prep — OAuth/account-linking unlock decision for read-only MCP data
Head branch: codex/pr59-oauth-account-linking-decision
Docs-only decision PR before PR59. PR59 implementation remains blocked.
```

Next PR:

```txt
PR59-prep decision PR, then PR59 — Read-Only Twoweeks Data Adapter only after OAuth/account-linking is unblocked
```

Next PR gate:

```txt
BLOCKED_PENDING_OAUTH_ACCOUNT_LINKING_DECISION — maintainer rejected boundary-only PR59. Real read-only data requires OAuth/account-linking before any PR59 code.
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
| 59-prep | OAuth/account-linking unlock decision for read-only MCP data | in progress | pending | codex/pr59-oauth-account-linking-decision | Docs-only decision PR. Records whether OAuth/account-linking is READY_TO_IMPLEMENT or BLOCKED before PR59 real data |
| 59 | Read-Only Twoweeks Data Adapter | blocked | none | preflight pending | Must start with preflight because real read-only data may require OAuth or explicit boundary-only narrowing |

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

Before PR59, create a docs-only OAuth/account-linking unlock decision PR. The decision must choose or block the IdP, OAuth flow, token transport, server verification, account mapping, registration mode, redirect URI, scopes, token storage, and next implementation path.

PR59 is blocked pending OAuth/account-linking: real read-only data requires OAuth/account-linking first. Boundary-only PR59 must not be implemented.
OAuth/real-data/write-action constraints remain active: no OAuth runtime, callback, token storage, account linking, real user data, Convex real-data reads/writes, handlers, production connector, tool execution, outbound HTTP, LLM calls, export/download/send/submit/apply, or package/lockfile changes without an explicit unlocking PR.

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
