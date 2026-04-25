# Proposal compose style and sidebar hierarchy — 2026-03-28

## Problem

The proposal workspace had three coherence problems at once:

- Compose and output surfaces were drifting apart in proportion and chrome.
- Proposal style controls still reflected an older typography/layout inspector, which was too technical for the current product.
- The sidebar treated resume and proposal drafts as equally active editing documents, which flattened hierarchy and made the current working document ambiguous.

## Decisions

### 1. Compose shell reuses the existing document ratio

`ProposalForge` compose mode now reuses the shared document shell sizing tokens:

- `--document-sheet-ratio`
- `--document-viewer-shell-inline-size`
- `--document-viewer-shell-min-block`
- `--document-viewer-shell-max-block`

**Why:** The output view already defines the paper shell users are calibrating against. Reusing the same ratio keeps compose and output visually related and avoids inventing a second arbitrary sheet proportion.

### 2. Proposal style controls are now a simple choice model

The old style inspector UI was removed from the compose surface. In its place, local proposal styling is expressed as five clear choices:

- Auto
- Formal
- Warm
- Technical
- Balanced

Each choice maps to a current render bundle only as an implementation bridge. The user-facing model is the style choice itself, not the underlying typography/layout/palette system.

**Why:** Users should choose intent, not design-system internals. The old inspector exposed too much mechanism for a proposal-generation workflow.

### 3. Linked mode hides local style choices

When proposal style is linked to the current CV, the local style-choice grid is hidden. When proposal style is local, the chooser sits at the top of the compose panel.

**Why:** Linked mode means the CV is the style source. Showing local proposal style options at the same time creates conflicting authority.

### 4. Auto style uses broad job-family heuristics

`Auto` infers a style from the brief using broad role signals:

- Formal for accounting, finance, legal, compliance, and similar structured roles
- Warm for creative, education, care, and community-facing roles
- Technical for engineering, data, platform, and IT-heavy roles
- Balanced as the default fallback for broader professional work

**Why:** Users should not have to micromanage every proposal when the brief strongly implies an appropriate tone and presentation direction.

### 5. Sidebar workspace hierarchy distinguishes primary vs secondary work

The sidebar now presents one primary in-progress workspace item and, when relevant, a secondary in-progress item beneath it. The secondary item remains accessible but is visually dimmer and subordinate.

**Why:** There is only one true foreground document at a time. Showing both resume and proposal drafts as equally active reduced scanability and made the browser hierarchy feel noisy.
