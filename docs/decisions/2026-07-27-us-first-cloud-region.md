# US-First Cloud Region Decision

## Status

**Decided — 2026-07-27.** Twoweeks is natively English-speaking and US-first. This fixes the default cloud-region direction; it does not select a parser provider or authorize a cloud deployment.

## Context

Language, founder location, frontend hosting, Convex region, parser hosting, and company domicile are separate decisions. Europe must not be inferred as the first market from the product language or the founder's location.

## Decision

- The frontend may remain globally served on Cloudflare Pages.
- The first future Convex Cloud deployment defaults to **US East (N. Virginia)**.
- The first production parser must run in US East, but its provider remains open until a benchmark.
- Clerk is already US-hosted and remains unchanged for now.
- `run.sh` remains a local/development entrypoint only; it is never the production entrypoint.
- Europe is phase 2. A separate EU parser and separate EU Convex deployment/project are considered only if contractual data-residency requirements justify them.
- Company hosting and the company's legal/tax domicile remain separate decisions.

## Current local truth

- Verified at `main`'s current local reference: `HEAD` and `origin/main` are both `aae9dcacc92af9db7fc512e371c3caea10dd1b9f`; the worktree was clean and HEAD was detached on `origin/main`.
- `./run.sh local-fast` is the repo's documented full-stack parser-development mode: local parser, local Convex, and local Vite.
- `run.sh` defaults the local Convex cloud port to `3210` and resolves the local URL to `http://127.0.0.1:3210` when no override is set. This is local configuration, not a cloud-region choice.
- The repository README reserves `tunnel` for stable edge-path validation and describes `local-fast` as daily development.
- No Convex Cloud, hosting provider, deployment, or provider benchmark was called or changed for this decision.

## Phased architecture

1. **Local development:** `./run.sh local-fast` with local Convex and the local parser; no cloud region is required.
2. **US production:** globally served frontend as appropriate, Convex Cloud in US East, and the production parser in US East. Provider selection remains gated below.
3. **Europe, if justified:** add EU parser and EU Convex deployment/project only for a demonstrated contractual or residency requirement; do not create a Europe-first default from localization alone.

## Provider decision gate

Do not present a provider as selected before a benchmark. The current candidate roles are:

- **Hetzner Ashburn:** cost-first candidate.
- **Railway US-East:** operations-first candidate.
- **Cloud Run:** growth/scaling candidate.

The gate is a measured comparison of parser latency, throughput, cold start, operational burden, observability, data handling, cost, and exit path. Avoid pseudo-precise scores; record the raw measurements and the decision rationale.

## Data-region implications

Convex states that all infrastructure powering a deployment is hosted in its selected region. An existing deployment's region cannot be changed in place; migration requires a new deployment or project and export/import of the data. Therefore, US East is the default at first provisioning, and any later EU requirement is an explicit migration or parallel-region decision.

The production data map must separately cover Convex data, parser processing, logs, backups, and any attached storage before launch. Clerk remains US-hosted under the current decision. Frontend distribution and company legal/tax domicile do not determine the Convex region.

## Non-goals

- No Convex Cloud project or deployment creation.
- No region provisioning, migration, export/import, or deployment test.
- No parser provider selection or pseudo-scoring.
- No `run.sh`, code, environment, workflow, Dockerfile, secret, branch, remote, or wiki change.
- No Europe-first localization or legal/tax conclusion.

## Evidence and source links

- Official Convex [Regions](https://docs.convex.dev/production/regions): available regions currently include US East (N. Virginia) and EU West (Ireland); the selected region hosts the deployment infrastructure; region changes require a new deployment/project and export/import.
- Official Convex [Local Deployments for Development](https://docs.convex.dev/cli/local-deployments): local deployments are for development, can run without an account, and are not a production-region decision.
- Repo [run.sh](../../run.sh) and [README.md](../../README.md): current local-fast defaults and local/edge mode boundary.
- Existing repo decision [Local-Fast Dev Mode](2026-04-14-local-fast-dev-mode.md) and the durable wiki pages `TWOWEEKS_WIKI_PATH/wiki/tech/local-vs-remote-parser-architecture.md` and `TWOWEEKS_WIKI_PATH/wiki/howto/local-parser-operations.md` record the local/cloud separation. The wiki references are contextual; the current repo and official Convex pages are the authority for this decision.

## Reversibility and exit criteria

This is reversible before production provisioning because no cloud region or parser provider has been created or selected by this task. After provisioning, a region change is not an in-place toggle: use Convex's documented new-deployment/project plus export/import path, with a cutover and rollback plan.

Before production approval, require: a frozen US data map, benchmark evidence and provider choice, measured parser SLOs, confirmed Convex region at provisioning, backup/export validation, migration/rollback rehearsal, and an operations runbook. Revisit the EU branch only when a contractual residency requirement or equivalent evidence exists.

## Unresolved runtime measurements

- `local-fast` health, startup time, effective local ports, parser call path, and export behavior were not run in this documentation-only task.
- No Convex Cloud provisioning or region-selection flow was exercised; the exact operational creation path must be rechecked at provisioning time.
- No parser benchmark exists yet for Hetzner Ashburn, Railway US-East, or Cloud Run.
- No production data-flow, backup, observability, egress, or export/import rehearsal has been measured.
