# Proposal Quality Harness And Benchmark Audit

Date: 2026-05-25

## Scope

Measurement only. No production generation behavior, prompt, length, model routing,
or UI behavior changed in this pass.

## Existing benchmark assets

### `my-app/benchmarks/proposal-generation`

- Runtime: TypeScript support files plus saved JSON/CSV/Markdown artifacts.
- Inputs: `dataset/proposal-benchmark.dataset.json`.
- Models: `mistral-small-latest`, `mistral-large-latest`, `gpt-5-nano`,
  `gpt-4o-mini` in the primary runner.
- Real APIs: yes when run live through the runner.
- Outputs: `results.json`, `results.csv`, `review.md`, and raw provider payloads.
- Scoring: manual review table for writing quality, honesty, grounding,
  relevance, and format adherence.
- Blind comparison: review output was model-labeled; the new adapter adds blind
  labels and a separate reveal map for harness scoring.
- Metadata: records prompt, model, provider, usage, latency, cost, and raw path.
- Current safety checks before adapter: expected grounding and forbidden claims
  are present for human review, but unsupported-claim counting, paragraph
  grounding, ATS keyword policy, selector readiness, and no-context violations
  were not scored deterministically.

### `my-app/scripts/evals/run-proposal-model-benchmark.ts`

- Runtime: TypeScript via `tsx`.
- Command: `PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts`.
- Dry command: `npx tsx scripts/evals/run-proposal-model-benchmark.ts --dry --score-with-harness`.
- Inputs: benchmark dataset or saved `results.json` in dry mode.
- Real APIs: live mode only, now gated by `PROPOSAL_BENCHMARK_LIVE=1`.
- Outputs: live benchmark artifacts; dry mode writes quality harness artifacts
  under `/private/tmp/neyssan-proposal-quality-benchmark/<run-id>/`.
- Scoring: live generation remains unchanged; `--score-with-harness` runs the
  deterministic evidence-first harness adapter after outputs exist.

### `my-app/scripts/evals/run-one-off-proposal-model-comparison.mjs`

- Runtime: Node ESM JavaScript.
- Command: direct `node`/`tsx` style script with provider keys.
- Inputs: benchmark dataset, defaulting to one case.
- Models: one-off comparison set including OpenAI, Qwen, Mistral, and DeepSeek
  labels used by that script.
- Real APIs: yes.
- Outputs: saved one-off result folders under benchmark results.
- Scoring: comparison output and review artifacts; no deterministic
  evidence-first scoring before this adapter.
- Metadata: records model/provider output and raw payloads.

### `my-app/scripts/evals/evaluate-cover-letter.ts`

- Runtime: TypeScript via `tsx`.
- Command: `npx tsx scripts/evals/evaluate-cover-letter.ts --file=PATH`.
- Inputs: one letter from stdin, text, or file.
- Models: OpenAI evaluator model, default `gpt-5-mini` unless overridden.
- Real APIs: yes.
- Outputs: JSON cover-letter score from the evaluator.
- Scoring: LLM judge rubric for relevance, credibility, persuasion, structure,
  substance, tone, and grounding.
- Blind comparison: no.
- Metadata: evaluator request model only; not a model comparison runner.
- Current safety checks: judge can rate grounding, but it is not deterministic
  and does not count unsupported claims, keyword leakage, or paragraph evidence.

## What static harness proves

- Known good fixture letters satisfy evidence-first safety gates.
- Known bad negative controls fail on unsupported credentials, company praise,
  no-context invented experience, unsupported tool claims, and ungrounded
  paragraphs.
- Criteria shadow is a parity safety check only when it scores the same letter
  text as baseline.

## What static harness does not prove

- It does not prove an LLM will generate better letters.
- It does not compare prompt variants unless saved or live generated outputs are
  passed through the benchmark adapter.
- It does not replace human review or the live LLM judge.

## Reuse path

`scripts/evals/proposal-quality-adapter.ts` maps existing benchmark results into
the proposal quality harness shape:

- generated output -> scored letter body;
- benchmark case -> source-backed fact fixture;
- expected grounding -> job priorities / supported keywords;
- forbidden claims -> blocked claims;
- model outputs -> blind labels;
- actual model/provider -> separate reveal map.

## Commands

Dry, no APIs:

```bash
npm run proposal:benchmark:dry
```

Direct dry equivalent:

```bash
npx tsx scripts/evals/run-proposal-model-benchmark.ts --dry --score-with-harness
```

Live, explicit opt-in:

```bash
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --score-with-harness
```

## Why live modes remain disabled

The harness can now measure saved and live outputs, but it has not yet shown a
criteria-audit or semantic-planner variant outperforming baseline on real
generated letters. `criteria_audit_live`, `semantic_planner_shadow`, and
`semantic_planner_live` therefore remain non-default and untrusted for
production behavior.

## Remaining risks

- The adapter derives fact fixtures from older benchmark metadata, so fact
  matching is conservative and may miss paraphrased evidence.
- Older saved outputs include prompt instructions with length guidance; this
  pass scores those outputs as historical benchmark artifacts and does not
  change production length behavior.
- Blind labels reduce reviewer bias in the quality report, but raw benchmark
  artifacts still contain model names by design.
