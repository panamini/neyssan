# CV Forge Preview Jump Audit

Date: 2026-03-30

Scope:
- `/cv` preview workspace in CV Forge
- responsive transition from framed preview to narrow page-scroll preview
- symptom from provided screenshots: the resume preview appears to jump down inside its container when the browser collapses

## Active Code

- `src/pages/CvForge.tsx`
  Active route that switches the workspace preview behavior at `760px` from `framed` to `page-scroll`.
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  Active workspace preview wrapper that forwards the viewport behavior into the shared resume surface.
- `src/features/verbati/VerbatiResumePreview.tsx`
  Active shared resume preview surface. It owns the document viewport, zoom state, and viewport-centering hook.
- `src/hooks/use-document-viewport-centering.ts`
  Active shared logic that preserves scroll position across document layout changes.
- `src/styles/product.css`
  Active document-shell and workspace layout rules for the framed and page-scroll preview shells.
- `src/features/verbati/resume/resume-preview.css`
  Active resume preview layout rules layered on top of the shared shell.

## Legacy But Informative

- prior resume preview alignment audits under `docs/audits/`
  Informative for the document-shell evolution, but not the direct cause of this resize bug

## Obsolete Or Non-Authoritative

- `pdf-ingest/`
- legacy parser and training code
- backups, archives, and `*.bak`

These were not used for this diagnosis.

## Finding

The jump is not caused by the resume page renderer itself. The root cause is the viewport-centering policy during the responsive shell change.

When `/cv` crosses below `760px`, `CvForge` switches the preview from `framed` to `page-scroll`. `VerbatiResumePreview` already changes CSS classes for that new shell, but the shared `useDocumentViewportCentering` hook still preserves the previous viewport snapshot unless a deliberate recenter is requested.

That preservation is useful for normal resize and zoom continuity inside the same shell, but it is wrong across this mode boundary. The narrow shell is effectively a different browsing model:

- framed mode behaves like a bounded document viewport
- page-scroll mode behaves like a page-flow surface where the top of the document should be re-anchored

Because no explicit recenter was requested on that shell transition, the previous scroll snapshot could survive into the new layout and present the page offset from the top-left. In the screenshots, that stale offset reads visually as the resume jumping downward inside an oversized blank surface.

## Fix

Apply an explicit viewport recenter when the workspace preview behavior changes.

Implemented in:
- `src/features/verbati/VerbatiResumePreview.tsx`

Behavior after the fix:
- entering or leaving the narrow page-scroll shell resets the preview viewport to the workspace anchor
- the page starts from the expected top-left position instead of inheriting a stale scroll snapshot from the previous shell

## Risk

Low.

The change does not alter resume rendering, scale calculation, or stylesheet tokens. It only changes viewport state sync when the workspace shell behavior changes.
