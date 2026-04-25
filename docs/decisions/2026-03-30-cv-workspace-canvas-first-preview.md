# CV Workspace Canvas-First Preview

Date: 2026-03-30

## Status

Accepted

## Scope

- active `/cv` workbench preview in `my-app`
- desktop and narrow-width workspace preview behavior

## Decision

The CV workbench preview uses one canvas interaction model in workspace mode:

- framed document viewport
- pan when zoomed
- fit and zoom controls in the floating workbench chrome

The older responsive `page-scroll` workspace branch is retired from the active CV workspace path.

## Rationale

The responsive hybrid viewer was mixing two different interaction models inside one workspace:

- a bounded canvas viewer
- a document-flow reading surface

That split caused repeated regressions when the browser width changed:

- the resume page could appear to drop inside its own shell
- pan was disabled in the narrow workspace state
- the viewport-centering rules had to special-case shell transitions

A canvas-first workspace is the cleaner model for a design/editor workbench. It matches the proposal preview chrome more closely and preserves the expected "Photoshop-style" preview behavior across widths.

## Consequences

- `/cv` preview mode keeps the same canvas shell on narrow widths instead of switching to a page-flow workspace surface
- workspace-specific `page-scroll` CSS modifiers are removed from the active CV preview path
- mobile-friendly document reading remains a separate concern from the workbench preview
