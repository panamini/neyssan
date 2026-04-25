## Proposal Model Comparison Benchmark Plan

Date: 2026-03-12

Scope:
- implementation plan only
- isolated benchmark harness only
- no production generation changes

## Goal

Create the smallest safe evaluation harness for proposal generation quality across:

- baseline: `mistral-small-latest`
- stronger candidate: `mistral-large-latest`
- cheaper candidate: `gpt-5-nano`

## Design principles

- benchmark must stay outside production generation paths
- prompt text must be shared across models
- provider differences should be transport-only
- outputs must be reviewable by humans
- cost and latency must be captured automatically

## Proposed file layout

- `scripts/evals/run-proposal-model-benchmark.ts`
- `benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json`
- `benchmarks/proposal-generation/core/buildPrompt.ts`
- `benchmarks/proposal-generation/core/types.ts`
- `benchmarks/proposal-generation/core/scoringTemplate.ts`
- `benchmarks/proposal-generation/adapters/mistral.ts`
- `benchmarks/proposal-generation/adapters/openai.ts`
- `benchmarks/proposal-generation/results/<run-id>/results.json`
- `benchmarks/proposal-generation/results/<run-id>/results.csv`
- `benchmarks/proposal-generation/results/<run-id>/review.md`

## Dataset v1

Use 12 examples.

Each example should include:

- `id`
- `label`
- `jobTitle`
- `jobDescription`
- `proposalType`
- `formalityLevel`
- `creativity`
- `personalizationMode`
- `personalizationRichness`
- `candidateContext`
- `expectedGrounding`
- `forbiddenClaims`
- `notes`

Category mix:

- 4 strong-match
- 4 adjacent-match
- 2 weak-match
- 2 no-context/minimal-context

## Prompt contract

The benchmark prompt should be derived from one benchmark-only prompt builder.

It should reuse the current production prompt intent:

- requested output format
- anti-hallucination rules
- candidate context block
- no-context caution block
- tone guidance

It should not reuse the production branching itself.

Implementation rule:

- copy the relevant prompt-building logic into benchmark-only files
- do not import production proposal generation code if doing so would pull in saving, Convex auth, LangChain chains, or model routing

## Model adapter plan

### Mistral adapter

Use direct HTTP or a minimal SDK call.

Requirements:

- model name passed explicitly
- shared temperature and token settings
- usage extraction when available
- elapsed time capture

### OpenAI adapter

Use OpenAI directly, not production `chatgpt`.

Requirements:

- model name passed explicitly as `gpt-5-nano`
- same prompt text as Mistral
- same effective temperature / token budget
- usage extraction when available
- elapsed time capture

## Scoring plan

### Automatic metrics

- latency_ms
- input_tokens
- output_tokens
- estimated_cost_usd
- output_length_chars

### Human review fields

- writing_quality_1_to_5
- relevance_1_to_5
- grounding_1_to_5
- honesty_1_to_5
- format_adherence_1_to_5
- reviewer_preference
- review_notes

## Output format

### `results.json`

Store full run details:

- run metadata
- model metadata
- per-example prompt config
- raw model output
- normalized usage and latency
- estimated cost

### `results.csv`

Store a flat table:

- run_id
- example_id
- model
- provider
- latency_ms
- input_tokens
- output_tokens
- estimated_cost_usd
- output_path

### `review.md`

Store human-review content:

- one section per example
- side-by-side outputs
- compact scoring table
- winner notes

## Cost estimation plan

Use provider price constants stored in the benchmark harness, with a comment that prices must be refreshed before future reruns.

Current planning assumptions from official pricing pages on 2026-03-12:

- Mistral Small 3.2:
  - input: $0.10 / 1M tokens
  - output: $0.30 / 1M tokens
- Mistral Large:
  - input: $0.50 / 1M tokens
  - output: $1.50 / 1M tokens
- GPT-5 nano:
  - input: $0.05 / 1M tokens
  - output: $0.40 / 1M tokens

Because `mistral-small-latest` and `mistral-large-latest` are rolling aliases, the harness should label these costs as estimates mapped to the current Small and Large family pricing.

## Execution order

1. Create the benchmark folder structure.
2. Add dataset v1 with 12 examples.
3. Add a benchmark-only prompt builder.
4. Add thin Mistral and OpenAI adapters.
5. Add the run script that:
   - loads dataset
   - runs each model
   - captures latency/usage/cost
   - writes `results.json`, `results.csv`, and `review.md`
6. Run a smoke test on 1 example and 2 models.
7. Run the full 12-example benchmark.
8. Review outputs manually before any production model decision.

## Explicit non-goals

- changing `convex/generateProposalMutation.ts`
- changing model defaults in app or extension
- reworking LangChain production code
- adding benchmark UI
- wiring benchmark to Convex actions
- changing auth or scraping flows

## Exit criteria

The benchmark v1 is complete when:

- it runs from one command
- it compares 3 concrete models with the same prompt text
- it writes JSON, CSV, and Markdown outputs
- it captures latency and estimated cost
- it supports manual side-by-side review for grounding and hallucination checks
