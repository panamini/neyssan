# Playwright Check Stabilization Audit

Date: 2026-05-27
Branch: `stabilize-playwright-checks`

## Current Architecture

`.github/workflows/playwright.yml` is the active Playwright workflow for pushes and pull requests against `main` and `master`.

Before this change, the PR check installed all Playwright browsers, started Vite manually, and ran six broad Chromium specs:

- `e2e/cvforge-preview-linking.spec.ts`
- `e2e/ds-v2.spec.ts`
- `e2e/proposal-command-layer.spec.ts`
- `e2e/proposal-mobile-layout.spec.ts`
- `e2e/proposal-workspace-roundtrip.spec.ts`
- `e2e/topbar-document-geometry.spec.ts`

Those specs remain in the repository.

## Findings

The PR check was noisy because it mixed critical route smoke coverage with layout matrix and visual regression coverage. The slowest surfaces are broad geometry assertions, screenshot baselines, repeated viewport/zoom combinations, and CI setup cost from browser installation and dependency installs.

The workflow also depended on remote Convex codegen secrets and used a root `curl --head /` readiness probe for Vite. That proves the dev server socket is open, but not that `/cv` or `/proposal` are hydrated and usable.

Branch protection could not be confirmed from this environment because the GitHub API was unavailable. The workflow and job identity were therefore preserved to avoid breaking an existing required-check name.

## Change

PR and push events now run only `e2e/playwright-pr-smoke.spec.ts`.

The smoke suite covers:

- seeded `/cv` preview load
- seeded CV preview profile panel open
- seeded `/proposal` load
- proposal edit/preview mode toggle

The previous broad suite now runs on:

- `workflow_dispatch` with `suite: full`
- the weekday scheduled workflow

Manual `workflow_dispatch` can also run `suite: smoke`.

## Files Changed

- `.github/workflows/playwright.yml`
- `e2e/playwright-pr-smoke.spec.ts`
- `docs/audits/2026-05-27-playwright-checks.md`

## Risk

The PR check now catches app boot and critical workspace smoke failures, not full layout drift. Full layout coverage is preserved as manual/scheduled coverage instead of being deleted.

Convex codegen remains in the workflow. If CI noise continues from missing or unavailable Convex credentials, the next audit should isolate codegen into a separate readiness check or use a local generated-client strategy.
