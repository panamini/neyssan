# Proposal Generation Benchmark Harness

This harness is intentionally isolated from production generation logic.

It compares proposal outputs across:

- `mistral-small-latest`
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
npx tsx scripts/evals/run-proposal-model-benchmark.ts
```

Optional flags:

```bash
npx tsx scripts/evals/run-proposal-model-benchmark.ts --limit=2
npx tsx scripts/evals/run-proposal-model-benchmark.ts --models=mistral-small-latest,gpt-4o-mini
npx tsx scripts/evals/run-proposal-model-benchmark.ts --dataset=benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json
```

## Required env

- `MISTRAL_API_KEY` for Mistral runs
- `OPENAI_API_KEY` for OpenAI runs

If one provider key is missing, those models are marked as `skipped` instead of expanding scope or changing production code.
