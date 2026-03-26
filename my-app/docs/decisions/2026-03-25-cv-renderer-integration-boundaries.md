# Decision: CV Renderer Integration Boundaries
Date: 2026-03-25

## Status
- Recommended

## Context
- `my-app` is the active host application and already owns the active CV editor, persistence, and document contract through `CvDocument`.
- The standalone mini-app contains a stronger CV renderer and theme exploration surface, but it uses a different render contract, a broader standalone shell, and a different theming runtime model.

## Decision
- Integrate the mini-app renderer into `my-app` as an isolated feature module.
- Keep `CvDocument` as the only source of truth for authored CV data.
- Introduce a renderer-only adapter contract inside `my-app`.
- Scope renderer token aliases locally to the renderer surface.
- Do not extract a shared package now.
- Do not move to a workspace/monorepo now.
- Do not mount the mini-app `ThemeProvider` at host-app root.
- Do not share the mini-app UI kit globally in phase 1.

## Rationale
- The real integration problem is contract drift, not missing file reuse.
- `CvDocument` and `ResumeData` do not describe the same object model.
- `StyleForge` and the mini-app theme system do not describe the same style contract.
- Package extraction today would force premature dependency and contract stabilization across React 18 and React 19 stacks.
- A scoped renderer integration minimizes regressions and keeps the migration reversible.

## What is shared
- Renderer-facing adapter contract.
- Render-safe formatters and fallback rules.
- Renderer-scoped token bridge.
- Renderer layout spec and CSS.

## What is not shared
- Builder state and persistence.
- Remirror editor logic.
- Upload/import and normalization flows.
- Showcase shell and generic UI kit from the mini-app.
- Root-level theme runtime from the mini-app.

## Consequences
- Phase 1 stays additive and low risk.
- The renderer can be tested against live `CvDocument` data without replacing the existing editor.
- Style control harmonization becomes an explicit later task instead of an implicit hidden coupling.
