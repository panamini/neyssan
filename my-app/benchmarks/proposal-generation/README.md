# Proposal Generation Benchmark Harness

This harness is intentionally isolated from production generation logic.

It compares proposal outputs across:

- `mistral-small-latest`
- `mistral-medium-latest`
- `mistral-large-latest`
- `gpt-5-nano`
- `gpt-4o-mini`

It writes:

- `results.json`
- `results.csv`
- `review.md`
- raw provider payloads under `raw/`

## Run

From `my-app`:

```bash
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts
```

Optional flags:

```bash
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --limit=2
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --score-with-harness --models=mistral-medium-latest,mistral-large-latest --limit=2
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --models=mistral-small-latest,gpt-4o-mini
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --dataset=benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json
```

## Dry quality scoring

Score saved benchmark outputs with the deterministic proposal quality harness
without calling provider APIs:

```bash
npm run proposal:benchmark:dry
```

Equivalent direct command:

```bash
npx tsx scripts/evals/run-proposal-model-benchmark.ts --dry --score-with-harness
```

Use `--results=PATH` to score a different saved `results.json`. The dry scorer
writes a blind review report, JSON metrics, and a separate reveal map under
`/private/tmp/neyssan-proposal-quality-benchmark/<run-id>/`.

To score a new live run in the same pass, opt in explicitly:

```bash
PROPOSAL_BENCHMARK_LIVE=1 npx tsx scripts/evals/run-proposal-model-benchmark.ts --score-with-harness
```

## Required env

- `MISTRAL_API_KEY` for Mistral runs
- `OPENAI_API_KEY` for OpenAI runs

If one provider key is missing, those models are marked as `skipped` instead of expanding scope or changing production code.
