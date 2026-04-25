# Proposal Compose Brief And Toolbar Regression Audit

Date: 2026-03-31

## Scope

- Active code audited: `src/pages/ProposalForge.tsx`
- Active components audited: `src/components/ProposalComposeToolbar.tsx`, `src/components/ProposalBriefCard.tsx`, `src/components/ProposalInputForm.tsx`
- Donor/reference comparison: `src/pages/ProposalForgeNext.tsx`

## Findings

### 1. Brief card was backported without the state that hides or expands the compose shell

Severity: high

`ProposalForge` now renders `ProposalBriefCard` whenever there is generated proposal content and any brief text, but it never carries over the donor `briefExpanded` state or the `showComposePanel` gate. The result is a duplicated left column where the reduced brief card and the full compose shell are visible at the same time.

- Live regression path:
  - `showBriefCard` is always true once content exists at `src/pages/ProposalForge.tsx:2467`
  - the brief card is always rendered before the form at `src/pages/ProposalForge.tsx:2642`
  - the compose shell is still rendered immediately after it at `src/pages/ProposalForge.tsx:2657`
- Donor/reference behavior:
  - `showBriefCard` depends on `!briefExpanded && leftPanelVisible` at `src/pages/ProposalForgeNext.tsx:1871`
  - the compose shell is hidden when the brief card is shown at `src/pages/ProposalForgeNext.tsx:2008`

This is the direct cause of the duplicated "compose reduced in header + compose shell still open" state the user reported.

### 2. The brief CTA is wired as a focus helper, not as the expand/collapse control from the donor flow

Severity: high

The live brief card button labeled as an edit/open action only focuses `jobDescription` or `jobTitle`; it does not change any UI state. The live page also does not pass the compose-shell header chevron action into `ProposalInputForm`, so the donor `Edit brief` / `Collapse brief` toggle never exists in the active runtime.

- Live regression path:
  - `ProposalBriefCard` button just calls `onToggleBrief` at `src/components/ProposalBriefCard.tsx:29`
  - in `ProposalForge`, that handler only focuses fields at `src/pages/ProposalForge.tsx:2479`
  - `ProposalInputForm` receives no `headerAction`, `headerLabel={null}`, or `onSubmitAnimationComplete` wiring in the live runtime at `src/pages/ProposalForge.tsx:2657`
- Donor/reference behavior:
  - card click sets `briefExpanded(true)` at `src/pages/ProposalForgeNext.tsx:2004`
  - compose shell header gets the chevron action at `src/pages/ProposalForgeNext.tsx:2035`
  - submit animation collapses the brief again at `src/pages/ProposalForgeNext.tsx:2025`

This explains why only a transient "Edit brief" affordance is perceived and why the chevron up/down controls are missing or non-functional.

### 3. The live toolbar integration dropped the collapse/restore branch entirely

Severity: medium

`ProposalComposeToolbar` still supports both the expanded collapse button and the collapsed restore shell, but `ProposalForge` never passes `onCollapseCompose`, `onRestoreCompose`, or any equivalent visibility state. Because of that, the live toolbar can never render the collapse button or the divider group that should sit next to the tone icon.

- Live regression path:
  - live toolbar invocation ends at `src/pages/ProposalForge.tsx:2498` without collapse props
  - the toolbar only shows the collapse group when `hasCollapseControl` is true at `src/components/ProposalComposeToolbar.tsx:151` and `src/components/ProposalComposeToolbar.tsx:264`
- Donor/reference behavior:
  - donor expanded toolbar passes `onCollapseCompose` at `src/pages/ProposalForgeNext.tsx:1920`
  - donor collapsed toolbar passes `collapsed` and `onRestoreCompose` at `src/pages/ProposalForgeNext.tsx:1894`

This matches the disappearance of the collapse button and the vertical divider the user called out.

### 4. The tests that were added for the brief card codify the wrong behavior and miss the donor contract

Severity: medium

The new live brief-card test only asserts that clicking the card focuses the textarea. It does not assert donor behavior: hiding the compose shell, showing the brief summary only when collapsed, or restoring the compose header chevron. The existing workspace-toolbar tests also never cover collapse/restore props on the live page.

- `src/pages/__tests__/ProposalForge.brief-card.test.tsx:96` encodes "open brief" as field focus only
- `src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx:102` verifies CV/tone plumbing but not collapse controls

This is why the regression could be committed while still passing.

## Conclusion

The implementation is not just visually rough; it is behaviorally incomplete. The donor presentational pieces were moved over, but the state machine that makes them coherent was left behind. The brief card and toolbar need to be reconnected to explicit live runtime state instead of being mounted as independent widgets.
