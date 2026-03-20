# Audit: Red `X` Background in Skills/Languages

Date: 2026-03-20  
Scope: Skills/Languages/Achievements editing UI (`SectionEditor` + structured modals)

## Findings

### 1) Root cause of persistent red `X` (active code)
- The red background was not inherited from browser defaults.
- It came from the shared danger class `dasti-icon-button--danger` in active inline editors:
  - `my-app/src/components/SectionEditor.tsx:1159`
  - `my-app/src/components/SectionEditor.tsx:1518`
- That class maps to red danger tokens in global CSS:
  - `my-app/src/styles/globals.css:432` (`background: var(--erb)`, `color: var(--ert)` on hover)

### 2) Modal-row delete buttons (active code)
- Skills/Languages modal rows now use neutral close buttons (`dasti-modal-close`) with hover/focus reveal.
- No danger token is used by these row delete buttons after the patch.

### 3) `+ Add` inconsistency (active code)
- `Skills` and `Languages` now both use `Button` `variant="ghost"` to keep neutral behavior.

### 4) Achievements add button placement (active code)
- `+ Add achievement` is restored at the top row of the modal content.

### 5) Redundant cancel action (active code)
- `Cancel` buttons were removed from Skills/Languages/Achievements modals.
- `X` close remains the dismissal action, and `Save` remains explicit commit.

## Classification
- Active code: all findings above.
- Legacy but informative: none used for this diagnosis.
- Obsolete/dead code: not required for this diagnosis.

