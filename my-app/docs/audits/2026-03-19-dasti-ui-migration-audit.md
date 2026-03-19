# Dasti UI Migration Audit
Date: 2026-03-19

## Scope
- Goal: compare the current React UI against `dasti-v16.html` as the visual source of truth and `dasti-spec-v1.md` as the design-system / behavior source of truth.
- In scope: page shell, sidebar, topbar, compose/open behavior, spacing, hierarchy, typography, colors, borders, shadows, radii, buttons, scroll containers, duplicate UI trees, and UI-only migration regressions.
- Out of scope: proposal-generation backend logic, Convex/server logic except when it changes visible UI behavior.

## Method
- Read the two reference files:
  - `UI/UI-SPEC/dasti-v16.html`
  - `UI/UI-SPEC/dasti-spec-v1.md`
- Inspected the active React route tree and UI components under `my-app/src/`.
- Ran the frontend locally and captured light-mode screenshots for:
  - current `/cv`
  - current `/cv` after creating a new CV
  - current `/proposal` compose view
  - current `/proposal` open view
  - Dasti resume view
  - Dasti write compose view
  - Dasti write open view
- Screenshot artifacts are in `my-app/tmp-audit/`.

## Classification Summary
- Active code:
  - `src/App.tsx`
  - `src/pages/CvForge.tsx`
  - `src/pages/ProposalForge.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/ProposalInputForm.tsx`
  - `src/components/ProposalDisplay.tsx`
  - `src/components/ProposalsList.tsx`
  - `src/components/ProfileReviewCard.tsx`
  - `src/components/SectionEditor.tsx`
  - `src/components/cv-editor/BlockRenderer.tsx`
  - `src/lib/cv-template.ts`
  - `src/components/ui/levelLabels.ts`
  - `src/contexts/CvLibraryContext.tsx`
- Legacy but informative:
  - `src/components/header/Header.tsx`
  - `src/components/ProfileEditor.tsx`
  - `src/components/ProfileForm.tsx`
  - `src/components/profile-review-modal/CVReviewerOverlay.tsx`
- Obsolete/dead:
  - `src/components.bak.1756564393/`
  - `*.bak`
  - `src/components/ProposalsList.tsx.bak`
  - `src/components/ProfileReviewModal.tsx.bak`
  - `src/components/ProfileForm.tsx.bak`
  - `src/components/SuggestionBlock.tsx.bak`

## Confirmed Mismatches

### C01. The Dasti Style page is missing entirely
- Classification: active code
- Severity: critical
- Confidence: high
- Dasti expects: Sidebar `Settings > Style` opens the dedicated style page with template cards, typography style cards, palette picker, live CV preview, and live letter preview. This is part of the primary skeleton and spec (`§12`, `§13`).
- Current app: the sidebar links to `/style`, but the router does not define a `/style` route. Unknown routes redirect to `/cv`, so the Style page cannot render at all.
- Likely source file(s):
  - `src/App.tsx:133-137`
  - `src/components/Sidebar.tsx:33-34`
  - `src/components/Sidebar.tsx:375-407`

### C02. Sidebar proposal items do not actually open the Open tab or a specific saved document
- Classification: active code
- Severity: critical
- Confidence: high
- Dasti expects: clicking a proposal in the sidebar selects that saved document and opens the write library view (`Open`) with that document loaded.
- Current app: sidebar proposal items only navigate to `/proposal?view=saved`, but `ProposalForge` ignores the `view` query parameter and always initializes `activeView` to `"compose"`. The click path also does not pass a proposal id, so it cannot select a specific saved proposal.
- Likely source file(s):
  - `src/components/Sidebar.tsx:320-330`
  - `src/pages/ProposalForge.tsx:30-42`
  - `src/pages/ProposalForge.tsx:96-97`

### C03. The sidebar top row is structurally different from the Dasti skeleton
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: a brand row with the Fraunces wordmark `dasti` on the left and the collapse toggle on the right.
- Current app: the sidebar top row contains an empty spacer and only the toggle button. The `dasti` wordmark has been moved into the topbar instead of living in the sidebar header.
- Likely source file(s):
  - `src/components/Sidebar.tsx:97-105`
  - `src/components/Sidebar.tsx:124-170`
  - reference expectation: `dasti-v16.html` sidebar brand row, spec `§12`

### C04. Sidebar active-state rules are wrong
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: top-level active nav items use `.sb-item.on` styling; inactive top-level items stay neutral; sub-doc items alone get the left accent border.
- Current app: the Resume nav item is hardcoded as active on every route, and the Compose top-level nav item uses sub-document styling when active, including a left accent border and inset padding. In the current write screenshot both Resume and Compose read as active at once.
- Likely source file(s):
  - `src/components/Sidebar.tsx:188-217`
  - `src/components/Sidebar.tsx:279-310`

### C05. Sidebar proposal document rows cannot show the expected selected state and hide the delete affordance
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: proposal `sb-doc` rows can become active, show the date before the type label, and expose the delete affordance on hover.
- Current app: proposal rows are rendered with `isActive={false}` permanently, `hideActions` removes hover actions entirely, and the metadata order is `type · date` instead of `date · type`.
- Likely source file(s):
  - `src/components/Sidebar.tsx:320-330`
  - `src/components/Sidebar.tsx:518-620`

### C06. The sidebar footer is missing the active-document hint
- Classification: active code
- Severity: minor
- Confidence: high
- Dasti expects: footer shows avatar, user name, and a secondary hint line with the active document / profile context.
- Current app: the footer only shows `Profile` plus the theme toggle. The second hint line is missing.
- Likely source file(s):
  - `src/components/Sidebar.tsx:417-462`

### C07. The topbar right rail is missing the persistent `Export PDF` action
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: the topbar right side contains the small secondary `Export PDF` button.
- Current app: the right rail only renders an auth-only `Sign in` button when unauthenticated; otherwise the slot is empty. The export action is absent from both Resume and Write.
- Likely source file(s):
  - `src/App.tsx:65-91`

### C08. The page shell still diverges from the Dasti `page-area > top + pscroll` structure
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: a shared page shell with a topbar sibling to a single scroll container (`.pscroll`), enabling the React frosted-glass implementation described in spec `§17[A]`.
- Current app: `AppShell` stops at a plain flex column and then each page owns its own `overflowY: auto` container. This fragments scroll behavior across pages and blocks the intended topbar blur behavior.
- Likely source file(s):
  - `src/App.tsx:96-139`
  - `src/pages/CvForge.tsx:13-21`
  - `src/pages/ProposalForge.tsx:165-166`

### C09. The Write page intro panel is missing
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: a top intro card on Write matching the Resume page pattern: eyebrow, Fraunces H2, and description.
- Current app: Write starts directly with the tab strip. The intro panel never renders.
- Likely source file(s):
  - `src/pages/ProposalForge.tsx:164-188`
  - reference expectation: spec `§13`, Dasti write screenshots

### C10. The compose/output panel anatomy does not match Dasti
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: `.cpn` and `.opn` are single raised panels with `radius: rl`, internal padding, no tinted header sub-bar, and large 32px Fraunces card titles.
- Current app: both panels use `radius: rm`, inject a full-width `sf2` header band, and render the card titles at `var(--tm)` (20px). This materially compresses the hierarchy.
- Likely source file(s):
  - `src/pages/ProposalForge.tsx:136-154`
  - `src/pages/ProposalForge.tsx:195-239`

### C11. The compose form hierarchy is still too generic
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: the left compose panel shows `New letter`, then a compact inline `CV: … · Change` metadata line, then explicit `Job Title` and `Job Description` labels, then the compose well.
- Current app: it starts with a separate `Using CV: none / Change CV` toolbar above the form, omits visible form labels, and relies on placeholders instead. The compose well container also lacks the spec’s `focus-within` accent/ring treatment.
- Likely source file(s):
  - `src/components/ProposalInputForm.tsx:553-582`
  - `src/components/ProposalInputForm.tsx:719-761`
  - `src/components/ProposalInputForm.tsx:733-741`

### C12. The generated output surface is not rendered as a Dasti document surface
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: the output area behaves like a document surface, with the Copy control in the panel header and document typography using `Source Serif 4` / paper-style treatment.
- Current app: `ProposalDisplay` renders a nested generic card inside the output panel, places the Copy button inside that inner card, and renders letter content in the inherited app font rather than a dedicated document font or paper surface.
- Likely source file(s):
  - `src/pages/ProposalForge.tsx:220-239`
  - `src/components/ProposalDisplay.tsx:76-99`
  - `src/components/ProposalDisplay.tsx:240-279`

### C13. The Open view duplicates sidebar navigation inside the document panel
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: the sidebar owns saved-document navigation; the left `Document` panel only shows metadata for the selected document.
- Current app: the left `Document` panel renders a second proposal list below the selected document metadata when there is more than one proposal, creating duplicate navigation trees and a structural mismatch.
- Likely source file(s):
  - `src/components/ProposalsList.tsx:365-402`

### C14. Empty / signed-out Open states collapse the Dasti layout instead of preserving it
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: Open view keeps the two-panel library structure even when there is nothing selected yet.
- Current app: unsigned users only get the line `Sign in to view saved proposals.` and otherwise see a mostly empty page. `ProposalsList` also returns plain loading / empty messages outside the grid shell.
- Likely source file(s):
  - `src/pages/ProposalForge.tsx:245-247`
  - `src/components/ProposalsList.tsx:164-177`

### C15. A newly created CV uses the wrong default hierarchy for the Dasti Resume page
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: Resume emphasizes `Profile`, `Experience`, and `Skills` above the fold, with optional sections like Achievements and Languages added later from the add-section strip.
- Current app: the default v1 template creates `Profile`, `Summary`, `Experience`, `Education`, and `Skills`, so Summary and Education push the page hierarchy away from the Dasti skeleton before the user adds anything.
- Likely source file(s):
  - `src/lib/cv-template.ts:280-369`
  - `src/components/ProfileReviewCard.tsx:479-549`

### C16. The CV title and section-card typography do not match Dasti
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: the CV title is a Fraunces display-style heading, and section cards use the Dasti section-card pattern with `sf2` headers, Fraunces 26px titles, `scb` body padding, and visible shadow.
- Current app: the CV title is a plain `text-lg font-semibold` button; section cards use generic `text-lg` / `h3` headings, `sf1` headers, editable title inputs, and much tighter padding. The visual hierarchy is flatter and more form-like than editorial.
- Likely source file(s):
  - `src/components/ProfileReviewCard.tsx:481-498`
  - `src/components/SectionEditor.tsx:596-660`
  - `src/components/SectionEditor.tsx:1547-1606`
  - `src/components/SectionEditor.tsx:2004-2137`

### C17. The skills editor is a different component model than the Dasti three-dot control
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: each skill row uses a simple three-dot scale with only `Beginner`, `Intermediate`, and `Expert`.
- Current app: the main skills editor uses a five-option segmented control driven by `Beginner`, `Elementary`, `Intermediate`, `Advanced`, `Fluent`, remapped to `Beginner / Intermediate / Advanced / Expert / Master`, plus extra pin/remove controls and per-row save ticks.
- Likely source file(s):
  - `src/components/ui/levelLabels.ts:10-25`
  - `src/components/SectionEditor.tsx:1010-1099`

### C18. Experience / Education cards surface migration artifacts that should not be visible
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: compact editorial preview rows, with destructive actions hidden until appropriate hover states and no placeholder epoch dates leaking into the UI.
- Current app: a new CV shows the placeholder date `Jan 1, 1970`, and `Delete Block` buttons are visible at rest inside the card body. Both read as implementation leakage rather than intentional Dasti UI.
- Likely source file(s):
  - `src/lib/cv-template.ts:20-38`
  - `src/components/cv-editor/BlockRenderer.tsx:499-513`

### C19. Profile chips use non-Dasti saturated colors
- Classification: active code
- Severity: minor
- Confidence: high
- Dasti expects: chip semantics stay within the desaturated Dasti palette family and avoid generic bright UI accent colors.
- Current app: the profile preview uses `bg-emerald-500`, `bg-indigo-500`, and `bg-amber-500`, which breaks the muted editorial palette.
- Likely source file(s):
  - `src/components/SectionEditor.tsx:1624-1629`

### C20. The dev-only debug toggle leaks into the live shell
- Classification: active code
- Severity: major
- Confidence: high
- Dasti expects: no floating debug control in the bottom-right corner of the shell.
- Current app: `CvLibraryContext` always mounts `DebugToggle`, which renders a fixed bottom-right control. It is visible in current Resume and Write screenshots and materially changes the live shell.
- Likely source file(s):
  - `src/contexts/CvLibraryContext.tsx:2368-2375`
  - `src/components/dev/debug-toggle.tsx:45-63`

## Likely Mismatches Needing Verification

### L01. Dark-mode fidelity likely diverges from Dasti, but this pass only verified light mode
- Classification: active code
- Severity: major
- Confidence: medium
- Dasti expects: the warm/kaki dark theme across shell, cards, document frames, and semantic colors.
- Current app: dark mode infrastructure exists, but this audit did not capture a full visual dark-mode pass, and the missing Style page prevents checking dark-mode document previews against the reference.
- Likely source file(s):
  - `src/styles/globals.css`
  - `src/components/dark-mode-toggle/DarkModeToggle.tsx`

### L02. Sidebar collapse visuals likely need adjustment even though width tokens match
- Classification: active code
- Severity: minor
- Confidence: medium
- Dasti expects: collapse keeps icons visually centered, hides labels/doc rows cleanly, and preserves the brand/toggle relationship.
- Current app: width tokens match, but this pass did not successfully capture a visual collapsed-state screenshot. Given the missing sidebar brand row and active-state drift in the expanded shell, collapse polish should be rechecked after those fixes.
- Likely source file(s):
  - `src/components/Sidebar.tsx:22-23`
  - `src/components/Sidebar.tsx:83-119`
  - `src/components/Sidebar.tsx:129-170`

### L03. Authenticated Open view likely has additional spacing and state issues beyond the unsigned placeholder
- Classification: active code
- Severity: major
- Confidence: medium
- Dasti expects: consistent selected-document state between sidebar and library panels.
- Current app: code inspection already confirms broken sidebar-to-open syncing and duplicated panel lists. A live signed-in render would likely reveal more spacing and active-state issues that were masked by the unsigned placeholder.
- Likely source file(s):
  - `src/components/Sidebar.tsx:313-330`
  - `src/components/ProposalsList.tsx:278-520`

## Things That Already Match Correctly
- Classification: active code
- Sidebar width tokens are aligned with Dasti at `248px` expanded and `52px` collapsed.
  - Source: `src/components/Sidebar.tsx:22-23`
- Resume uses the correct intro-panel pattern: eyebrow, Fraunces H2, supportive description, large page padding, and `maxWidth: 960`.
  - Source: `src/pages/CvForge.tsx:13-63`
- Compose/Open uses the correct underline-tab pattern instead of filled pills.
  - Source: `src/pages/ProposalForge.tsx:102-124`
  - Source: `src/pages/ProposalForge.tsx:168-188`
- Proposal compose still uses Dasti-style fixed-position type/tone dropdown portals and a circular generate/stop control.
  - Source: `src/components/ProposalInputForm.tsx:763-905`
- The saved-proposal editor already uses the correct `260px / 1fr` split and `Source Serif 4` content textarea for the right-hand content panel.
  - Source: `src/components/ProposalsList.tsx:278-287`
  - Source: `src/components/ProposalsList.tsx:495-515`
- Core Dasti tokens are present in `globals.css`, including spacing, typography scale, radii, heights, colors, and shadows.
  - Source: `src/styles/globals.css`

## Legacy But Informative

### LG01. `src/components/header/Header.tsx` is not part of the active shell
- Classification: legacy but informative
- Severity: minor
- Confidence: high
- Dasti expects: the Dasti shell, not the old Neyssan header.
- Current app: this file still contains the old `Neyssan` wordmark and a legacy top header pattern, but it is not imported into the active app.
- Likely source file(s):
  - `src/components/header/Header.tsx:22-54`
  - active import absence confirmed by route-tree search

### LG02. `src/components/ProfileEditor.tsx` and `src/components/ProfileForm.tsx` are old pre-Dasti editing surfaces
- Classification: legacy but informative
- Severity: minor
- Confidence: high
- Dasti expects: the Dasti Resume page shell and current CV editor flow.
- Current app: both files still implement older ingest/profile editing UIs and import `ProfileView`, but they are not in the current route tree.
- Likely source file(s):
  - `src/components/ProfileEditor.tsx:11-20`
  - `src/components/ProfileForm.tsx:35-41`

### LG03. `src/components/profile-review-modal/CVReviewerOverlay.tsx` represents an older review overlay path
- Classification: legacy but informative
- Severity: minor
- Confidence: medium
- Dasti expects: the current v1 Resume shell, not the old reviewer overlay.
- Current app: this overlay still exists and renders the old `CVDocumentReviewer`, but it bails out when `isV1Active` is on and is not part of the main `/cv` route surface.
- Likely source file(s):
  - `src/components/profile-review-modal/CVReviewerOverlay.tsx:36-43`
  - `src/components/profile-review-modal/CVReviewerOverlay.tsx:75-87`

## Obsolete / Dead
- Classification: obsolete/dead
- Severity: minor
- Confidence: high
- Dasti expects: non-authoritative backup trees to stay out of migration decisions.
- Current app: `components.bak.1756564393/`, `*.bak`, and backup component files remain on disk. They are not part of the live app and should not guide migration decisions.
- Likely source file(s):
  - `src/components.bak.1756564393/`
  - `src/components/ProposalsList.tsx.bak`
  - `src/components/ProfileReviewModal.tsx.bak`
  - `src/components/ProfileForm.tsx.bak`
  - `src/components/SuggestionBlock.tsx.bak`

## Top 10 Highest-Value UI Fixes
1. Add the missing `/style` route and build the Dasti Style page shell before refining smaller details.
2. Fix sidebar-to-library navigation so clicking a saved proposal opens the `Open` view and selects the clicked document.
3. Restore the Dasti sidebar structure: add the brand row, correct top-level active states, and stop styling Compose like a sub-document.
4. Restore the topbar action slot with the persistent `Export PDF` button and move auth UI out of the Dasti shell slot.
5. Rebuild the Write page wrapper to include the intro panel and Dasti card anatomy (`rl` radius, 32px titles, no tinted header bars).
6. Refactor `ProposalInputForm` to match the Dasti compose hierarchy: inline CV metadata, explicit field labels, and proper compose-well focus treatment.
7. Refactor `ProposalDisplay` into a real Dasti document surface with header-level Copy and document typography.
8. Remove the duplicate proposal list from `ProposalsList` and let the sidebar be the only document navigator.
9. Align the Resume default hierarchy with Dasti by revising the v1 template and the section stack shown after `New resume`.
10. Replace the current skills / block-editor CV card UI with Dasti section cards, including the 3-dot skills control and removal of visible placeholder artifacts like `Jan 1, 1970` and `Delete Block`.

## Addendum — Second-Pass Delta Against User Observations
This addendum preserves the first-pass audit. It classifies the later user observations against the current codebase and the Dasti references without rewriting the original findings.

### D01. Step 1 — Button flash / Tailwind ring defaults
- Status: partially confirmed
- Why: active code already contains a global Tailwind ring reset in `src/styles/globals.css`, including `--tw-ring-offset-color`, `--tw-ring-color`, `--tw-ring-offset-shadow`, and `--tw-ring-shadow`. A repo search also found no active `ring-2`, `ring-4`, `ring-offset-2`, `ring-white`, `ring-blue`, `focus:ring`, or `focus-visible:ring` utilities in the live `src/` tree; the remaining matches are in obsolete backup files only. Active shared inputs and buttons already use the Dasti-style `box-shadow` focus treatment. This supports the general concern about Tailwind ring leakage, but not the specific claim that the reset is missing from active code.
- Relevant files:
  - active code: `src/styles/globals.css:178-188`
  - active code: `src/components/ui/button.tsx:34`
  - active code: `src/components/ui/input.tsx:44`
  - obsolete/dead: `src/components.bak.1756564393/ui/input.tsx:38`
- Priority impact: no change. Keep this below the routing, shell, and hierarchy mismatches unless a reproducible click-flash remains after the larger UI fixes.

### D02. Step 3 — Sidebar inside the proposal library card
- Status: not confirmed
- Why: `Sidebar` is mounted once in `AppShell` and is not rendered inside `ProposalForge` or inside `ProposalsList`. The visual duplication in Open is real, but it comes from a second proposal-navigation list rendered inside the left `Document` panel, not from a nested `Sidebar`.
- Relevant files:
  - active code: `src/App.tsx:107-139`
  - active code: `src/pages/ProposalForge.tsx:164-248`
  - active code: `src/components/ProposalsList.tsx:365-402`
- Priority impact: no change to the nested-sidebar theory. It does reinforce first-pass mismatch `C13`, which is already a high-value fix.

### D03. Step 4 — Sidebar navigation / Compose item broken
- Status: partially confirmed
- Why: the specific `Compose` nav item is wired correctly in active code. `Sidebar` renders inside `BrowserRouter`, `useNavigate()` is available, `/proposal` is a valid route, and the Compose row calls `navigate('/proposal')`. The actually broken sidebar path is different: saved proposal rows navigate to `/proposal?view=saved`, but `ProposalForge` ignores that query and cannot select a proposal by id, so sidebar proposal clicks do not reproduce the Dasti Open behavior.
- Relevant files:
  - active code: `src/App.tsx:133-150`
  - active code: `src/components/Sidebar.tsx:279-330`
  - active code: `src/pages/ProposalForge.tsx:30-42`
  - Dasti source of truth: `UI/UI-SPEC/dasti-v16.html:645-652`
- Priority impact: no change. The implementation priority remains the first-pass routing fix: make sidebar proposal rows open the Open view and select the clicked document.

### D04. Step 5 — Compose/Open toggle both active simultaneously
- Status: not confirmed
- Why: `ProposalForge` uses a single `activeView` state with the union `"compose" | "saved"`. `tabStyle()` applies active styling only when `activeView === view`, so the top `Compose/Open` tabs are mutually exclusive in code. The real double-active bug confirmed in the first pass lives in the sidebar, where `Resume` reads as active even when `Compose` is also active.
- Relevant files:
  - active code: `src/pages/ProposalForge.tsx:19-24`
  - active code: `src/pages/ProposalForge.tsx:42`
  - active code: `src/pages/ProposalForge.tsx:96-124`
  - related confirmed mismatch elsewhere: `src/components/Sidebar.tsx:188-217`
  - related confirmed mismatch elsewhere: `src/components/Sidebar.tsx:279-310`
  - Dasti source of truth: `UI/UI-SPEC/dasti-v16.html:727-735`
- Priority impact: no change. Do not prioritize a ProposalForge tab-state rewrite; prioritize the confirmed sidebar active-state fix instead.

### D05. Step 6 — Cleanup topbar
- Status: partially confirmed
- Why: two parts already match the requested direction. The current topbar shows only a `Sign in` button when logged out, and it does not render a Clerk avatar / `UserButton`. The proposed removal of `Export PDF`, however, conflicts with the Dasti skeleton, which explicitly keeps that button in the topbar right rail. The Dasti spec also keeps the theme toggle in the sidebar footer, not in the topbar. So the live mismatch is missing `Export PDF`, not needing to remove it.
- Relevant files:
  - active code: `src/App.tsx:28-92`
  - Dasti source of truth: `UI/UI-SPEC/dasti-v16.html:687-689`
  - Dasti source of truth: `UI/UI-SPEC/dasti-spec-v1.md:435-458`
  - Dasti source of truth: `UI/UI-SPEC/dasti-spec-v1.md:471-482`
- Priority impact: slight refinement only. Keep the first-pass topbar priority, but interpret it as preserving breadcrumb + logged-out sign-in behavior while restoring `Export PDF`.

### D06. Step 7 — Sidebar toggle button position
- Status: not confirmed
- Why: the current sidebar header already uses `position: relative`, and the toggle button is already absolutely positioned with `right`, `top: 50%`, and `transform: translateY(-50%)`. The proposed X-position fix is already present in active code. The remaining sidebar issue is the missing brand wordmark / header structure, not toggle drift.
- Relevant files:
  - active code: `src/components/Sidebar.tsx:97-105`
  - active code: `src/components/Sidebar.tsx:129-170`
  - Dasti source of truth: `UI/UI-SPEC/dasti-v16.html:620-627`
- Priority impact: no change.

### D07. Step 8 — Remove `dasti` wordmark from sidebar
- Status: not confirmed
- Why: this conflicts directly with the Dasti HTML and spec. The sidebar header is supposed to contain the `dasti` wordmark beside the collapse toggle. The current app already removed that wordmark and replaced it with an empty spacer, which is one of the confirmed first-pass mismatches. Keeping the space empty would move farther away from the reference.
- Relevant files:
  - active code: `src/components/Sidebar.tsx:125-127`
  - Dasti source of truth: `UI/UI-SPEC/dasti-v16.html:620-624`
  - Dasti source of truth: `UI/UI-SPEC/dasti-spec-v1.md:435-452`
- Priority impact: no change. This remains a restore-the-wordmark fix, not a remove-it fix.
