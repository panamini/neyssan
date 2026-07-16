# EVAL3D offline diagnosis

Status: `LOCAL_PASS`

## Confirmed cause

The active French finalizer emits the canonical closing:

`Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.`

The final-sendability evaluator recognized `Cordialement` but did not recognize
that production closing. It therefore counted the closing as a fifth body
paragraph. A regression reproduced the mismatch (`5` instead of `4`) before
the evaluator boundary patterns were corrected.

This is a shared evaluation-pipeline defect that is sufficient to make the
historical French editorial-veto classifications unreliable as quality
evidence, independently of model reasoning. It does not prove that this defect
was the only trigger in each of the four CV-backed French cells.

## Diagnostic contract

Each evaluated cell now records independent reviewer-safe axes:

- candidate evidence present or absent;
- pipeline outcome: reviewable, safety veto, or editorial veto;
- allowlisted finalization diagnostics for safety vetoes;
- final-visible sendability diagnostics for editorial vetoes.

Unknown failure text is replaced with `redacted`; raw letter content and raw
provider output are not copied into the diagnostic projection.

## Offline replay

The two committed recorded writer fixtures replay without network access.
Their final-visible outcomes are now included in the replay report. One is
editorially blocked for unsupported specificity and the other remains
reviewable. Neither fixture is French, so this replay cannot determine whether
the French prompt or the EVAL3D French fixtures have additional defects.

The EVAL3D private rail contains six French cells, not six retained French
outputs. The two no-CV cells are safety vetoes with no artifact. The four
CV-backed editorial-veto cells retain artifact and provenance hashes, but no
final text, body parts, or record. The hashes resolve only to the ledger and
reveal map across the local implementation worktrees. Consequently, the old
French cells cannot be replayed through the corrected evaluator.

## Remaining boundary

The diagnostic correction is mergeable independently. The historical fact
that the rail classified four French CV-backed cells as `editorial_veto`
remains true; using those classifications as evidence of French writing
quality or model inferiority is invalid. This does not block unrelated product,
English-quality, or editorial-refactor work.

Because the French final text was not retained, the next empirical French
comparison cannot be an offline replay. A four-cell French development run is
optional, not the automatic next step. Prepare it only when a concrete decision
depends on comparing Luna low with the stable control after correction, or on
measuring a later French quality change. Scope it to CV-backed direct and
adjacent cases. Do not rerun the two no-CV cells merely to reconfirm their
structural evidence limitation, and do not launch any run automatically.

Existing English final-visible tests remain the non-regression control; there
is no reason to rerun the English provider matrix for this correction.

## Canonical status

```text
Diagnostic fix: LOCAL_PASS
Historical French CV-backed verdicts: INVALID_FOR_QUALITY_INFERENCE
Historical no-CV context: STRUCTURAL_EVIDENCE_LIMIT_CONFIRMED
Historical no-CV veto cause: NOT_FULLY_ATTRIBUTED
Provider rerun required now: NO
Product-quality refactor blocked: NO
Future French four-cell run: OPTIONAL_AND_SEPARATELY_APPROVED
```

## Follow-up debt

The evaluator currently duplicates salutation and signoff knowledge with regex
patterns. A later bounded changeset should expose a shared canonical document
boundary contract from the production renderer/finalizer and make sendability
consume it. This prevents every new locale or closing formula from silently
changing paragraph classification. That refactor is intentionally outside this
diagnostic fix.
