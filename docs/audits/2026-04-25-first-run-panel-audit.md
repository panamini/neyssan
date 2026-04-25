# FirstRunPanel audit — `my-app/src/components/jobs/FirstRunPanel.tsx`

76 lines. The biggest first-impression surface in the app — empty jobs page for every new user.

### Audit table

| file:line | current | surface | proposed | note |
|---|---|---|---|---|
| :39 | `Start with one job decision` | empty-state title | `Start with one job.` | 4 words with terminal period. Keeps the "one" anti-overwhelm frame. Drops "decision" — engineer framing; brand voice is leisure-forward, not decision-science |
| :41–42 | `Import a real role or open a hand-crafted sample so the full jobs flow is usable in under ten seconds.` | empty-state subtitle | `Import a role. Or try a sample.` | 7 words, 2 sentences, period rhythm. Drops: "real" (hedge), "hand-crafted" (marketing corporate filler — banned), "so the full jobs flow is usable in under ten seconds" (coach-voice promise, banned construction). Matches voice-card empty-state rule: 2 lines max, fact then action |
| :54 | `Import your first job` | primary button | `Import job` | 2 words, verb-first. `your first` is onboarding padding — the empty state already implies firstness |
| :65 | `Loading sample…` | button pending state | `Loading sample` | ellipsis banned per voice card |
| :65 | `Try a sample job` | secondary button | `Try a sample` | 3 words, drops `job` (redundant with context — the page title is `Jobs`, the primary button is `Import job`) |
| :70 | `{errorMessage}` | error line (role=alert) | audit-at-source | dynamic string — audit the error producers separately |

### Theme moves

1. **Kill `hand-crafted`** — banned marketing filler per voice card.
2. **Kill `under ten seconds` / `real role` / `full jobs flow`** — coach-voice promises, marketing padding. Brand declares, doesn't sell.
3. **Kill `your first`** — onboarding condescension; the empty state already signals firstness.
4. **Period rhythm on 2-line subtitles** — `Import a role. Or try a sample.` reads as a declarative pair, not a run-on.
5. **Ellipsis removal** on the loading state — per voice card.

### Flagged-ambiguous

1. **Title: `Start with one job.` vs keeping `Start with one job decision`** — "decision" is a brand-distinctive word that ties into the cohort/decision-tracking mechanic (`recordJobDecision`, `job_decision_made` telemetry). If "decision" is part of the app's conceptual vocabulary shown elsewhere (e.g. `Common next steps` → `Decide next`), keep it. If it's purely internal, drop it as I proposed. My default: drop. Anti-corporate coach voice doesn't say "decision" — that's PM-speak.
2. **Secondary button: `Try a sample` vs `Try sample`** — the article `a` is technically trim-able. Voice card allows the article when dropping it makes the button read like an acronym or telegraph. `Try sample` is on the edge. My call: keep `a`.
3. **Error display as `dasti-empty-state__subtitle`** — the error renders with the same class as the subtitle above it, which is visually consistent but semantically mismatched. Not a copy issue, but flag to design: errors in a first-run panel are high-impact and might warrant their own slot.
4. **Title period** — the voice-card doesn't require periods on 1-clause titles (`Saved jobs.` yes; `Jobs` no). I proposed `Start with one job.` with a period because it reads as a closed declaration — but `Start with one job` (no period) matches the sidebar-title rhythm better. Flip-a-coin call. Default: period, because the surface is empty-state body-adjacent, not nav-label.

### Stats

- User-facing strings audited: **~5** (+ 1 dynamic)
- Proposed changes: **~5**
- Kept as-is: **0**
- Audit-at-source: **1** (errorMessage producers)

### Suggested commit

```text
chore(jobs): apply Twoweeks voice to FirstRunPanel

- Title: 5 words → 4 words, drops "decision"
- Subtitle: 20 words → 7 words, drops "hand-crafted" + coach-voice promise
- Primary button: "Import your first job" → "Import job"
- Secondary button: drop redundant "job" noun; remove ellipsis from loading state
```

### Open follow-up

**`errorMessage` audit-at-source** — find all producers passing into `FirstRunPanel`. Expected producers: sample-seeding failures, import-first-job route failures. Apply voice-card error rule (state fact, no apology, 2–3 words + period).

### Progress

| Cluster | Files | Status |
|---|---|---|
| Sidebar | `Sidebar.tsx` | ✓ audited |
| Jobs page | `JobsPage.tsx` | ✓ audited |
| Jobs detail | `MatchReadBlock.tsx`, `NextStepBlock.tsx` | ✓ audited |
| Jobs empty | `FirstRunPanel.tsx` | ✓ audited |
| CV | `CvForge.tsx`, `ProfileReviewCard.tsx`, `VerbatiCvPreviewPanel.tsx` | ✓ audited |
| Cover letter / proposal | `CoverLetterStartSurface.tsx`, `ProposalInputForm.tsx` | pending |

### Next audit targets

1. **`CoverLetterStartSurface.tsx`** — 10.9K, cover-letter entry point. Proposal-vestige checkpoint.
2. **`ProposalInputForm.tsx`** — 36K+. The biggest form in the app, heaviest proposal→cover-letter IA cleanup.
3. **Toast-and-error global sweep** — a pass across all `pushToast` / `showToast` / `role="alert"` producers for one-word success / 2–3-word failure rule.
4. **`ImportWarningBanner.tsx`** — small, frequently seen on first resume import.

Ready for CoverLetterStartSurface.
