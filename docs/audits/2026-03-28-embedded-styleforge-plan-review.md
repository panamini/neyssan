# Embedded StyleForge Plan Review

Date: 2026-03-28

Reviewed source:
- `/Users/pana/.claude/plans/validated-seeking-ocean.md`

Repo state checked against:
- `src/pages/ProposalForge.tsx`
- `src/pages/CvForge.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `src/components/EmbeddedStyleInspector.tsx`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalDisplay.tsx`
- `src/components/SectionEditor.tsx`
- `src/components/FloatingAiToolbar.tsx`
- `src/components/structured-blocks/SummaryModal.tsx`
- `src/components/structured-blocks/SkillsModal.tsx`
- `src/components/structured-blocks/ExperienceEducationModal.tsx`
- `convex/functions.ts`
- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/generationControls.ts`

## Verdict

Claude's plan has the right product direction, but it was not implementation-tight enough on first read. The strongest improvement is to convert the loose UX intent into explicit state models and shared surfaces:

- shared embedded style inspector, not one-off toolbars
- explicit proposal style link state, not implicit inheritance
- additive tone tuning layered on the existing preset system
- platform-aware character limits with advisory vs confirmed treatment
- shared inline AI transform surface for proposal and CV editors

That stronger direction is visible in the current repo. The crash did not erase the work conceptually or structurally; the tree already contains partial implementation of the upgraded approach.

## Active Code

- `src/pages/CvForge.tsx`
  Active CV workspace shell. It now mounts the preview rail beside the editor.
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  Active CV-side embedded style rail. This is the real implementation surface for StyleForge embedding.
- `src/components/EmbeddedStyleInspector.tsx`
  Active shared style inspector primitive. This is the main architectural upgrade over the standalone-plan framing.
- `src/pages/ProposalForge.tsx`
  Active proposal workspace shell. It now carries proposal style link state, tone tuning state, output view state, and the embedded proposal-side style inspector.
- `src/components/ProposalInputForm.tsx`
  Active compose controls and generation request source.
- `src/components/ProposalDisplay.tsx`
  Active proposal output surface, including document/plain-text view handling and inline selection AI actions.
- `src/components/SectionEditor.tsx`
  Active CV editor integration surface for floating inline AI and section-level CV AI actions.
- `convex/functions.ts`
  Active server entrypoint for style routing, inline text transforms, and section AI actions.
- `convex/generateProposalMutation.ts`
  Active generation entrypoint. It now validates tone tuning and character-limit fields.
- `convex/lib/proposals/generationControls.ts`
  Active authority for tuning definitions and limit presets.

## Legacy But Informative

- standalone `/style` workspace concepts are informative, but the new embedded inspector path is the more relevant authority
- older modal-heavy CV editing remains informative for transition constraints, but `SectionEditor.tsx` is the more important active integration point

## What Claude's Plan Gets Right

- Embedding style controls near the live preview is the correct interaction model.
- Linking proposal style to CV style by default is the right default.
- Tone tuning should be additive on top of presets.
- Character limits are a real product constraint and should be visible before generation.
- Inline AI transforms are a strong fit for proposal and CV editing.

## Where Claude's Plan Needed a Stronger Audit

### 1. The layout model needed to be explicit

The plan was directionally right, but not specific enough about where embedded style controls live.

The stronger implementation answer is:
- `CvForge`: split layout with a dedicated preview rail on wide screens
- `VerbatiCvPreviewPanel`: inspector above preview in rail mode, `Preview | Style` tabs in stacked mode
- `ProposalForge`: style inspector as its own section adjacent to output, not hidden behind a vague future toolbar

This is now reflected in code.

### 2. Style inheritance needed a real state machine

The original idea of "proposal inherits from CV until it does not" is not enough by itself. It needs explicit user-visible state.

The stronger model is:
- `inherit_cv`
- `proposal_local`

`ProposalForge.tsx` now carries that state explicitly, shows a link pill, and makes the proposal inspector read-only while linked. That is a much stronger design than a silent default.

### 3. NL style routing needed constrained output plus visible feedback

The plan's natural-language style override was good product thinking but too vague operationally. Free-form style generation would drift.

The stronger implementation is:
- route NL requests into canonical style bundles plus narrow overrides
- snap the UI to the resolved bundle
- confirm what was applied

That is now embodied in:
- `EmbeddedStyleInspector.tsx` confirmation messaging
- `convex/functions.ts` style-routing actions
- shared bundle definitions in the style system

### 4. Character limits needed platform semantics, not generic numbers

The earlier proposal-block version used `1500` and `3000` as mostly generic limits. That is weaker than platform-aware presets.

The stronger design is now in `generationControls.ts`:
- `LinkedIn note - 200`
- `LinkedIn InMail - 2000`
- `Indeed cover letter - 4000`
- `Upwork proposal - ~3000` as advisory
- `Custom`

This is better product design because it matches actual user jobs-to-be-done rather than arbitrary sizes.

### 5. Advisory vs confirmed limits needed an explicit visual contract

This was one of the most important missing details in the Claude plan.

The stronger rule is:
- confirmed limits behave as hard caps in prompt wording and warning/error states
- advisory limits are rendered as soft targets

That distinction now exists in the shared limit-selection model and is passed into `ProposalDisplay.tsx` as `characterLimitAdvisory`.

### 6. The proposal style toolbar should not be a separate one-off system

A weaker implementation would have built a proposal-only preset row while the CV kept a different style surface.

The stronger architecture is to reuse one embedded style inspector across CV and proposal. The repo now moves in that direction with `EmbeddedStyleInspector.tsx` instead of inventing a disconnected proposal-only component system.

### 7. Inline AI should be a shared editing capability, not a single feature block

Claude's plan framed inline AI mostly as one proposal/CV feature. The better framing is that selection transforms are a shared editing primitive.

The repo now reflects that stronger model:
- `FloatingAiToolbar.tsx` is shared
- `ProposalDisplay.tsx` uses it
- `SectionEditor.tsx` uses it
- `SummaryModal.tsx` and `ExperienceEducationModal.tsx` also wire it in

That reuse is the right architectural move.

### 8. CV AI actions needed confirm-before-apply and section awareness

The plan was right to ask for summary, skills, and experience AI actions, but it needed a clearer application model.

The stronger model is:
- action menu per section
- scoped server action
- minimal diff view
- accept or discard

The current repo already has this pattern in flight:
- `runCvSectionAiAction` in `convex/functions.ts`
- `CvAiDiffCard` plus section-specific handlers in `SectionEditor.tsx`
- suggested-skill acceptance flow in `SkillsModal.tsx`

## What The Current Repo Confirms Survived The Crash

- Shared embedded style inspector exists.
- CV preview rail embedding exists.
- Proposal style link mode exists.
- Proposal tone tuning exists in shared generation controls.
- Proposal character-limit presets and advisory handling exist in shared generation controls.
- Proposal document/plain-text output mode exists in `ProposalDisplay.tsx`.
- Inline AI toolbar exists and is wired into active editors.
- Server actions exist for style routing, inline transforms, and CV section AI actions.

This means the work was not reset to zero. The repo is already on the stronger plan, not the earlier looser one.

## Remaining Risk Areas

- The tree is mid-implementation and not yet verified end to end.
- There are many modified files, so the immediate priority is stabilization, not more scope.
- The highest-value check is whether the current branch compiles cleanly and whether the embedded style + proposal controls path behaves correctly in the dev server.

## Recommended Resume Point

Resume from verification and completion of the upgraded plan already in the repo:

1. Stabilize `ProposalForge`, `ProposalInputForm`, and `ProposalDisplay` together.
2. Verify the CV preview rail plus embedded style inspector flow.
3. Verify inline AI selection behavior in proposal and CV editors.
4. Verify section-level CV AI actions and diff acceptance.
5. Run targeted tests, then Playwright verification.

## Bottom Line

Claude's plan was good at the product level, but it needed sharper UX state definitions and more architectural discipline.

The stronger review is:
- embed style editing through one reusable inspector
- make link state explicit
- constrain NL style routing to canonical bundles
- treat length constraints as platform-aware controls
- treat inline AI as a shared editing primitive
- keep CV AI actions confirm-before-apply

That stronger version is already visible in the codebase, so the correct move now is to continue from the current implementation state rather than re-planning from scratch.
