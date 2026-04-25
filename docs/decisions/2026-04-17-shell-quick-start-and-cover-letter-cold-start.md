# Decision: Shell-Level Quick Start + Blank Cover-Letter Cold Start

Date: 2026-04-17
Status: Accepted

## Decision
- Quick Start lives at shell level as a standalone top action.
- Quick Start is a minimal chooser, not a dense launcher or wizard.
- Blank cover-letter entry gets a lightweight in-shell start surface inside `/proposal`.
- Quick Start no longer exposes text parsing; resume import is file-only through the canonical Mistral path.

## Rationale
- Quick Start is cross-workspace, so nesting it under Resume misstates the product model.
- A blank cover-letter editor is efficient for experts but too raw for first-time entry.
- The trusted parser contract is file-based, so `Paste text` on Quick Start is product debt and should not remain.
- The current shell and workspace structure can support this improvement without introducing a new route architecture.

## Consequences
- Resume and cover-letter entry are clearer without redesigning the full app.
- The proposal route remains stable internally while user-facing terminology shifts to `Cover letter`.
- Existing first-session triggers and `start=quick` links continue to work.
- The new cover-letter start surface stays intentionally small and does not introduce new persistence models.
