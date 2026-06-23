# PR87.7 Production Lint Gate

## Scope

- Base branch: `application-os-foundation`
- Branch: `codex/pr87-7-production-lint-gate`
- Verified PR87.6 merge commit: `142dbe39d641f4bd437a4f8f541b10818886379a`
- Starting base SHA: `142dbe39d641f4bd437a4f8f541b10818886379a`
- Objective: make `npm run lint` pass, or reduce and isolate remaining lint blockers with exact evidence.

## Starting Evidence

Commands from `my-app`:

- `npm run build`: passed.
- `npx tsc -b --force --pretty false`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: failed with 1505 errors / 381 warnings.

The lint command used by the project is:

```bash
tsc && eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

## Starting Lint Clusters

Top files by starting error count:

| File | Errors |
| --- | ---: |
| `src/components/SectionEditor.tsx` | 145 |
| `convex/lib/parsing/canonicalize.ts` | 100 |
| `src/contexts/CvLibraryContext.tsx` | 90 |
| `src/pages/CvForge.tsx` | 66 |
| `src/utils/cv/mapping-utils.ts` | 62 |
| `src/components/cv/SectionEditorSheet.tsx` | 48 |
| `convex/lib/parsing_shared/engine.ts` | 45 |
| `src/hooks/useCvParser.ts` | 40 |
| `convex/lib/parsing/hybridParser.ts` | 36 |
| `config/llmAdapters.ts` | 35 |

Top starting rule IDs:

| Rule | Errors |
| --- | ---: |
| `@typescript-eslint/no-unnecessary-type-assertion` | 565 |
| `no-useless-escape` | 210 |
| `@typescript-eslint/no-base-to-string` | 176 |
| `no-empty` | 138 |
| unused-disable / formatter-owned `<none>` | 125 |
| `no-inner-declarations` | 56 |
| `@typescript-eslint/no-redundant-type-constituents` | 55 |
| `@typescript-eslint/no-misused-promises` | 51 |
| `@typescript-eslint/no-floating-promises` | 27 |
| `react-hooks/rules-of-hooks` | 20 |

Area concentration at baseline:

- Pages/components: 597 errors.
- Convex: 515 errors.
- Other `src`: 355 errors.
- Config: 35 errors.
- Scripts: 3 errors.
- Generated files: 0 errors.
- Tests: 0 errors.
- Local-MCP: 0 errors.

First 30 actionable lint errors were all in `config/llmAdapters.ts`: `no-empty` at lines 32, 41, 44, 48, 54, 86, 111, 150, 157, 189, 199, 217, 218, 230, 232, 233, 247, 313, 321, 324, 328, 332, 370, 397, 434, 440, 445, 446, 473, plus `no-constant-condition` at line 459.

No evidence showed a repo lint-config failure after PR87.6. The command runs and reports source diagnostics.

## Fixes Made

1. Ran ESLint's autofixable lint cleanup:
   - removed unnecessary type assertions where ESLint could prove them unnecessary
   - removed unused eslint-disable directives
   - applied safe local autofixes such as redundant assertion cleanup and related mechanical edits
2. Repaired build-mode type errors introduced by assertion removal:
   - added `getProposalPresetFieldKey` in `convex/proposalSettings.ts` for typed preset key access
   - added `closestHTMLElement` in `src/features/verbati/VerbatiResumePreview.tsx` for DOM `dataset` access after `closest()`

No package files, lockfiles, schema files, tsconfig files, lint config files, or broad eslint-disable comments were changed.

## Files Changed

The code changes are all files named by current lint failures. Most changes are ESLint autofix output.

```txt
my-app/convex/actions/_probeMistral.ts
my-app/convex/actions/extractProfileStrict.ts
my-app/convex/actions/extractProfileStrictWithSpans.ts
my-app/convex/actions/formatCompleteCV.ts
my-app/convex/actions/structuredUpload.ts
my-app/convex/createProposalPublic.ts
my-app/convex/generateProposalMutation.ts
my-app/convex/jobsPublic.ts
my-app/convex/lib/applicationPackages.ts
my-app/convex/lib/embeddings/embedClient.ts
my-app/convex/lib/parsing/adapters/CanonicalMapper.ts
my-app/convex/lib/parsing/canonical.ts
my-app/convex/lib/parsing/canonicalize.ts
my-app/convex/lib/parsing/hybridParser.ts
my-app/convex/lib/parsing/llmPostProcessor.ts
my-app/convex/lib/parsing/mapping_utils.ts
my-app/convex/lib/parsing/normalize_cv.ts
my-app/convex/lib/parsing/prev_canonicalize.XXXXXX.ts
my-app/convex/lib/parsing/strictProfileAdapter.ts
my-app/convex/lib/parsing_shared/engine.ts
my-app/convex/lib/parsing_shared/nerClient.ts
my-app/convex/lib/parsing_shared/utils.ts
my-app/convex/lib/proposals/premiumCoverLetter.ts
my-app/convex/lib/proposals/proposalCriteriaAudit.ts
my-app/convex/lib/proposals/proposalEnforcement.ts
my-app/convex/lib/proposals/proposalPlanner.ts
my-app/convex/mcpResumeVariantPlanSummary.ts
my-app/convex/profiles.ts
my-app/convex/proposalSettings.ts
my-app/convex/utils/cv_parser.ts
my-app/src/adapters/profile-mapper.ts
my-app/src/components/FloatingAiToolbar.tsx
my-app/src/components/LocalBackupsPanel.tsx
my-app/src/components/ProfileReviewCard.tsx
my-app/src/components/ProfileReviewModal.tsx
my-app/src/components/ProposalsList.tsx
my-app/src/components/SectionEditor.tsx
my-app/src/components/SelectedBlockInspector.tsx
my-app/src/components/StrictExtractButton.tsx
my-app/src/components/StrictUploadButton.tsx
my-app/src/components/StructuredUploadButton.tsx
my-app/src/components/cv-display/AchievementsDisplay.tsx
my-app/src/components/cv-display/ReadOnlyRichDoc.tsx
my-app/src/components/cv-display/RichSummary.tsx
my-app/src/components/cv-display/SectionDisplay.tsx
my-app/src/components/cv-editor/BlockRenderer.tsx
my-app/src/components/cv-editor/OrganizeSectionsList.tsx
my-app/src/components/cv-editor/SectionPanel.tsx
my-app/src/components/cv/SectionEditorSheet.tsx
my-app/src/components/dev/debug-panel.tsx
my-app/src/components/jobs/FirstRunPanel.tsx
my-app/src/components/jobs/JobsWorkspace.tsx
my-app/src/components/profile-review-modal/hooks/useLlmRefinement.ts
my-app/src/components/profile-review-modal/hooks/useProfilePersistence.ts
my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx
my-app/src/components/remirror-editor/RemirrorEditor.tsx
my-app/src/components/remirror-editor/utils/conversion.ts
my-app/src/components/remirror-editor/utils/text.ts
my-app/src/components/structured-blocks/ExperienceEducationModal.tsx
my-app/src/components/structured-blocks/SkillsDrawer.tsx
my-app/src/components/structured-blocks/SummaryBlock.tsx
my-app/src/components/useStructuredMistralImport.ts
my-app/src/contexts/CvLibraryContext.tsx
my-app/src/features/verbati/VerbatiResumePreview.tsx
my-app/src/features/verbati/cvDocumentToResumeData.ts
my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx
my-app/src/features/verbati/resume/ResumeSanatAsymmetricPage.tsx
my-app/src/hooks/useCvParser.ts
my-app/src/hooks/useCvState.ts
my-app/src/hooks/useJobsQuery.ts
my-app/src/lib/authoritative-resume.ts
my-app/src/lib/cv-debug.ts
my-app/src/lib/cv-template.ts
my-app/src/lib/document-command-layer-layout.ts
my-app/src/lib/flags.ts
my-app/src/lib/import-recovery.ts
my-app/src/lib/normalize-cv.ts
my-app/src/lib/proposal-document.ts
my-app/src/lib/proposal-font-debug.ts
my-app/src/lib/resume-font-debug.ts
my-app/src/lib/resume/resumePagination.ts
my-app/src/pages/CvForge.tsx
my-app/src/pages/ProposalForge.tsx
my-app/src/pages/SettingsPage.tsx
my-app/src/services/pdf/browser-cv-parser.ts
my-app/src/setupTests.ts
my-app/src/utils/cv/mapping-utils.ts
my-app/src/utils/stableStringify.ts
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
docs/plans/2026-06-22-pr87-7-production-lint-gate.md
```

## Final Lint State

`npm run lint` still fails:

```txt
1175 problems (793 errors, 382 warnings)
```

Top remaining files by error count:

| File | Errors |
| --- | ---: |
| `src/components/SectionEditor.tsx` | 71 |
| `convex/lib/parsing/canonicalize.ts` | 45 |
| `src/components/cv/SectionEditorSheet.tsx` | 44 |
| `src/utils/cv/mapping-utils.ts` | 40 |
| `config/llmAdapters.ts` | 35 |
| `convex/lib/parsing_shared/engine.ts` | 35 |
| `src/pages/CvForge.tsx` | 35 |
| `convex/lib/parsing/hybridParser.ts` | 34 |
| `convex/actions/formatCompleteCV.ts` | 26 |
| `convex/lib/parsing/prev_canonicalize.XXXXXX.ts` | 21 |

Top remaining rule IDs:

| Rule | Errors |
| --- | ---: |
| `no-useless-escape` | 210 |
| `@typescript-eslint/no-base-to-string` | 176 |
| `no-empty` | 138 |
| `no-inner-declarations` | 56 |
| `@typescript-eslint/no-redundant-type-constituents` | 55 |
| `@typescript-eslint/no-misused-promises` | 51 |
| `@typescript-eslint/no-floating-promises` | 27 |
| `react-hooks/rules-of-hooks` | 20 |
| `@typescript-eslint/only-throw-error` | 13 |
| `no-mixed-spaces-and-tabs` | 12 |

Remaining area concentration:

- Convex: 332 errors.
- Pages/components: 269 errors.
- Other `src`: 154 errors.
- Config: 35 errors.
- Scripts: 3 errors.
- Generated files: 0 errors.
- Tests: 0 errors.
- Local-MCP: 0 errors.

No ESLint-reported fixable errors remain in the current JSON diagnostic output.

## Remaining Blockers

Remaining lint failures are too broad and behavior-sensitive for a safe single lint-gate sweep:

- Parser regex and canonicalization code has many `no-useless-escape` findings that should be reviewed with parser fixtures.
- Unknown/object stringification findings need local coercion policy, not blind `String(...)` insertion.
- Empty blocks in adapters/parsers likely need intentional error handling decisions or narrow explanatory comments.
- Hook and promise errors in large UI files require behavior-aware event-handler and render-flow review.
- `react-hooks/rules-of-hooks` findings are high risk because hook ordering can change runtime behavior.

## Validation

Commands run from `my-app` unless noted:

- `npm run build`: passed after lint fixes.
- `npx tsc -b --force --pretty false`: passed after lint fixes.
- `npx tsc --noEmit --pretty false`: passed after lint fixes.
- `npm run lint`: failed with 793 errors / 382 warnings.
- `git diff --check` from repo root: passed.
- `FALLOW_AGENT_SOURCE=codex npx fallow audit --format json --quiet --base origin/application-os-foundation --explain`: advisory `warn`; 0 introduced dead-code issues, 0 introduced complexity findings, and 9 introduced duplication clone groups from the mechanical repeated cleanup. No Fallow fixes were applied.
- Focused tests: not run; the implemented changes were mechanical lint autofixes plus two type-narrowing helpers, with no intended behavior change.

`npm audit --omit=dev` was not run in PR87.7 because lint did not become green. Audit remediation was not attempted and no package or lockfile files were changed.

## Review Revalidation 2026-06-23

Production-gate review for draft PR #238 rechecked the branch at heads
`23d12f979089187c4166af45cc55cc0da5da2e57` and
`3f5289e615837b3d718a27b34e19a1c358be8a93`.

Repo and PR state:

- Current branch: `codex/pr87-7-production-lint-gate`.
- PR #238: open, draft, mergeable during review.
- Changed files against `origin/application-os-foundation`: 90.
- Protected local file `docs/plans/2026-06-22-cover-letter-quality-production-roadmap.md`: untracked and not staged.
- `rtk` was unavailable in this shell, so review commands were run directly.

Diff review:

- The 88 source-file changes remain mechanical ESLint cleanup except for the two documented type-narrowing repairs.
- `convex/proposalSettings.ts`: `getProposalPresetFieldKey` maps slot `1 | 2 | 3` to the same preset field names previously built by template literal. This is active code and is the intended type repair.
- `src/features/verbati/VerbatiResumePreview.tsx`: `closestHTMLElement` narrows `closest()` results before `dataset` access. This is active code and is the intended DOM type repair.
- No intentional user-facing copy/UI text changes were found in the source diff.
- No generated-code churn was found. The touched `convex/lib/parsing/prev_canonicalize.XXXXXX.ts` file appears legacy but informative; the PR only removed lint-reported stale disable/typing noise there.

Fallow read-only audit:

- Command: `FALLOW_AGENT_SOURCE=codex npx fallow audit --format json --quiet --base origin/application-os-foundation --explain`.
- Verdict: `warn`.
- Attribution: 0 introduced dead-code issues, 0 introduced complexity findings, 9 introduced duplication clone groups.
- The 9 introduced duplication groups were inspected and classified as advisory/mechanical-touch false positives for this PR. They occur in pre-existing repeated parser name-token guards, Remirror extension setup blocks, `normalize-cv` structured-content normalization helpers, and `CvForge` structured-item helper patterns. The PR only touched those repeated regions through lint autofix edits such as removing `!`/redundant assertions; it did not add new duplicated logic.
- No Fallow fixes were applied because consolidating those clones would be broad refactoring outside PR87.7.

Revalidation commands:

- `npm run build`: passed.
- `npx tsc -b --force --pretty false`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: failed with 1175 problems, 793 errors, 382 warnings.

Focused and safety tests:

- `npx vitest run convex/__tests__/proposalSettings.voice.test.ts --reporter=dot`: passed, 4 tests.
- `npx vitest run src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`: PR failed 2/27 and base failed 2/27 with the same viewport height assertion: expected `1123px`, received `1122.5196850393702px`. This failure is inherited from `origin/application-os-foundation`, not PR87.7-caused.
- `npx vitest run convex/actions/__tests__/structuredUpload.buildCanonicalizeInput.test.ts convex/actions/__tests__/formatCompleteCV.test.ts convex/lib/parsing/__tests__/canonicalize.test.ts convex/lib/parsing/__tests__/canonicalMapper.test.ts convex/lib/parsing/__tests__/hybridParser.adapter.test.ts convex/lib/proposals/__tests__/proposalPlanner.test.ts convex/lib/proposals/__tests__/proposalEnforcement.test.ts convex/lib/proposals/__tests__/proposalCriteriaAudit.test.ts convex/lib/proposals/__tests__/premiumCoverLetter.test.ts --reporter=dot`: passed, 9 files / 241 tests.
- `npx vitest run src/pages/__tests__/SettingsPage.preview.test.tsx --reporter=dot`: passed, 32 tests.
- `npx vitest run src/components/cv/__tests__/SectionEditorSheet.test.tsx --reporter=dot`: passed, 23 tests.
- `npx vitest run src/components/__tests__/FloatingAiToolbar.test.tsx --reporter=dot`: passed, 32 tests.
- `DEBUG_PRINT_LIMIT=1200 npx vitest run src/pages/__tests__/CvForge.workspace-preview.integration.test.tsx`: PR failed 13/14 and base failed 13/14 with the same `TypeError: Cannot read properties of undefined (reading 'status')` at `src/pages/CvForge.tsx:3599`. The base worktree required an ignored `convex/_generated` symlink because generated files are not checked in. This failure is inherited from `origin/application-os-foundation`, not PR87.7-caused.
- `NODE_OPTIONS=--max-old-space-size=8192 DEBUG_PRINT_LIMIT=1200 npx vitest run src/pages/__tests__/ProposalForge.preview-header.test.tsx`: base did not reach a Vitest summary and ended with JavaScript heap out of memory. PR did not reach a Vitest summary either, but stalled until manually interrupted after outlasting the base OOM window. A single-worker PR attempt also stalled until manually interrupted. The `ProposalForge.tsx` PR diff was inspected and contains only mechanical type/assertion cleanup, with no render loop, timer, promise, or state-flow change. This remains inconclusive enough to keep the PR draft.
- Combined UI safety bundles also hit JavaScript heap out of memory before producing a useful summary.
- Local-MCP tests were not run because no local-MCP files changed.

Review decision:

- No PR87.7-introduced unsafe behavior change was confirmed from the diff review.
- `VerbatiResumePreview.test.tsx` and `CvForge.workspace-preview.integration.test.tsx` are proven inherited failures.
- `ProposalForge.preview-header.test.tsx` is not proven safe enough to mark ready because the requested increased-heap command still did not produce a clean PR result and behaved differently from the base worktree.
- No behavior or test fixes were applied during this review to avoid adding non-lint product/test churn to the mechanical PR.
- Current review verdict: `BLOCKED_PR87_7_REVIEW_FIX_REQUIRED`.

## Source Guards

- No package or lockfile changes.
- No `my-app/convex/schema.ts` changes.
- No tsconfig changes or strictness weakening.
- No global lint-rule disabling.
- No large file-level eslint-disable comments.
- No added `ts-ignore`.
- No added `ts-expect-error`.
- No broad `as any` expansion. Total `as any` occurrences decreased from 1893 on `origin/application-os-foundation` to 1637 on the PR head.
- No value-shaped Stripe secrets.
- `docs/plans/2026-06-22-cover-letter-quality-production-roadmap.md` remains untracked and uncommitted.

## Rollback Plan

Revert the PR87.7 commit. This restores the pre-PR87.7 lint state and removes only the mechanical ESLint cleanup, the two narrow type helpers, and the PR87.7/ledger documentation updates. No package, lockfile, schema, tsconfig, billing, OAuth/provider/token, deployment, or app launch surface needs rollback.

## Final Verdict

`BLOCKED_PR87_7_REVIEW_FIX_REQUIRED`

Original lint-gate state remains `BLOCKED_PRODUCTION_LINT_REMAINING`.
