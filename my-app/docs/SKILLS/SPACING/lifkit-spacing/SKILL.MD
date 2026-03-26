---
name: liftkit-spacing
description: review, create, and refactor css spacing systems using a liftkit-style proportional spacing model. use when auditing typography rhythm, layout spacing, card padding, button spacing, list rhythm, or design tokens, especially when checking whether a website follows root-based layout spacing, text-relative spacing, and optical corrections.
---

Use this skill when auditing or refactoring a website to match the LiftKit-style spacing system.

Read:
- `references/spacing-rules.md` for the exact spacing model and formulas
- `references/audit-checklist.md` for the audit procedure and reporting structure

Core rules:
- Treat spacing as part of a global scaling system tied to typography.
- Use root-based layout spacing tokens for non-text layout spacing.
- Use text-relative spacing for text relationships.
- Distinguish three text contexts:
  - display1 = tighter
  - body = looser
  - all other text classes = default
- Usually derive spacing from the larger related text element.
- For cards:
  - let X = largest font size in the card
  - let H = line-height of X
  - left/right/bottom = X
  - top = X / H
  - radius = corrected top padding
- For buttons, preserve optical balance, especially with icons.
- For lists, derive rhythm from the larger text element.

Audit workflow:
1. Inspect the app’s spacing tokens, typography utilities, and component spacing rules.
2. Compare them against `references/spacing-rules.md`.
3. Use `references/audit-checklist.md` to classify findings.
4. Report exact file paths, selectors, and mismatches.
5. Suggest the smallest safe refactor first.
6. If asked, apply fixes incrementally while preserving visual intent.

Output requirements:
- Be concrete.
- Reference actual files and selectors.
- Distinguish:
  - matches system
  - partially matches
  - conflicts with system
  - unclear / needs deeper inspection
- Prefer small reversible edits over broad rewrites.