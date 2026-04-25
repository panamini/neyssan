## Proposal Model Comparison Audit

Date: 2026-03-12

Scope:
- Audit only.
- No production generation changes.
- Focus on the smallest safe benchmark harness for proposal generation quality.

## 1. Root cause

The current codebase does not have one clean, benchmark-ready provider abstraction for proposal generation.

- Active proposal generation is still centered in `convex/generateProposalMutation.ts`.
- That file already supports multiple model labels, but it is not symmetric across providers:
  - Mistral small/large use one inline prompt path.
  - `chatgpt` uses an older LangChain `ProposalService` path with different prompt construction and older model wiring.
- Because of that asymmetry, reusing the production branching as the benchmark harness would produce a contaminated comparison: model quality would be mixed with prompt-path differences.

The smallest safe benchmark therefore needs to be isolated from production and use one shared prompt builder plus thin provider adapters.

## 2. Relevant current code paths

### Active code

- Active proposal generation entrypoint:
  - `convex/functions.ts`
  - `convex/generateProposalMutation.ts`
- Active app caller:
  - `src/components/ProposalInputForm.tsx`
  - `src/components/ProposalInputForm.schemas.ts`
- Active extension caller:
  - `../clerk-chrome-extension-final/src/background/index.ts`
- Active personalization source:
  - `src/lib/proposal-personalization.ts`

### Active but separate provider abstraction

These files are active in parsing/worker flows, not in proposal generation, but they are the cleanest existing lightweight adapter pattern in the repo:

- `config/llmConfig.ts`
- `config/llmAdapters.ts`
- `worker/llmWorker.ts`

This is the best local reference for an isolated benchmark harness because it already supports:

- provider selection
- env-based model selection
- direct HTTP/fetch fallback
- OpenAI and Mistral transport handling without requiring LangChain

### Legacy but informative code

- `convex/langchain/index.ts`
- `convex/langchain/models/gpt4_adapter.ts`
- `convex/langchain/models/mistral_adapter.ts`
- `convex/langchain/chains/*`
- `convex/langchain/prompts/*`

These files are still imported by active proposal generation, so they are not dead code. But for architecture decisions they should be treated as legacy-but-informative, not as the pattern to extend for a new benchmark harness.

Why:

- the OpenAI adapter named `GPT4Adapter` is actually pinned to `gpt-3.5-turbo-1106`
- LangChain adds extra moving parts without giving the benchmark anything essential
- the benchmark requirement is isolation and prompt symmetry, not chain orchestration

### Obsolete or non-authoritative for this task

- `pdf-ingest/`
- parser training / spaCy legacy code
- `*.bak`
- backup component trees
- archive/history markdown used only for prior states

## 3. What provider/model abstraction already exists

### Active proposal path

`convex/generateProposalMutation.ts` is the current production abstraction for proposal generation.

- It accepts:
  - `modelType`
  - `proposalType`
  - `formalityLevel`
  - `creativity`
  - `personalizationContext`
  - `personalizationRichness`
  - `personalizationMode`
- It branches by model:
  - `chatgpt`
  - `mistral-small-latest`
  - `mistral-large-latest`
  - `mistral-agent`

This is active code, but not suitable as the benchmark implementation surface because the provider branches are not comparable.

### Existing lightweight adapter layer

`config/llmAdapters.ts` plus `config/llmConfig.ts` already form a lighter provider abstraction.

- OpenAI:
  - dynamic SDK import when available
  - direct fetch fallback
  - env-driven model selection
- Mistral:
  - dynamic SDK import when available
  - direct fetch fallback
  - env-driven model selection

This is the most reusable basis for a benchmark harness.

## 4. Which candidates can realistically be benchmarked now

### Confirmed accessible from current repo setup

The repo currently has codepaths and env references for:

- Mistral small
- Mistral large
- Mistral agent
- OpenAI

Locally documented env configuration includes both `MISTRAL_API_KEY` and `OPENAI_API_KEY`, and the installed dependency graph includes OpenAI through `@langchain/openai`.

### Realistic benchmark candidates

#### Current Mistral baseline

- `mistral-small-latest`

Reason:
- current default in app and extension
- already active in production flow
- lowest-risk baseline

#### Stronger candidate

- `mistral-large-latest`

Reason:
- already wired in active proposal flow
- same provider, same auth, same transport family
- easiest apples-to-apples stronger comparison

#### Cheaper candidate if relevant

- `gpt-5-nano`

Reason:
- OpenAI key path already exists in repo config
- current shared config already treats `gpt-5-nano` as the OpenAI default in non-proposal LLM utilities
- can be called cleanly from an isolated harness without touching production `chatgpt` behavior
- based on current official pricing, it is cheaper than current Mistral Small on both input and output tokens

### Candidates that should not be the first benchmark targets

#### `chatgpt` label in production

Do not use this production label as the benchmark OpenAI candidate.

Reason:
- it routes through the old LangChain proposal service
- it is not prompt-symmetric with the Mistral branch
- the adapter is pinned to `gpt-3.5-turbo-1106`, not a modern stronger OpenAI model

#### `mistral-agent`

Do not include this in the first benchmark set.

Reason:
- requires `MISTRAL_AGENT_ID`
- introduces hidden agent instructions not visible in the benchmark prompt
- makes side-by-side prompt equality weaker

## 5. How hard one OpenAI candidate would be to add cleanly

Effort: low to moderate.

Expected work:

- add a benchmark-only OpenAI adapter
- call OpenAI directly with the same benchmark prompt string used for Mistral
- record response text, usage, latency, and estimated cost

Why this is clean:

- no production routing changes are required
- env support already exists
- the adapter pattern already exists in `config/llmAdapters.ts`
- `openai` is already present in `node_modules` through the existing dependency tree

Main caveat:

- do not reuse the production `chatgpt` branch in `convex/generateProposalMutation.ts`
- benchmark OpenAI through a new isolated adapter so prompt semantics stay aligned

## 6. Whether LangChain is needed

LangChain should be avoided for this benchmark.

Reason:

- The benchmark requirement is simple:
  - fixed prompt
  - fixed generation settings
  - multiple providers
  - side-by-side storage
  - latency/cost capture
- LangChain would add:
  - chain templates
  - provider-specific adapter behavior
  - more non-obvious prompt indirection
- That increases comparison noise instead of reducing it.

The existing lightweight adapter pattern is enough.

## 7. Smallest safe benchmark design

### Build shape

Build a standalone script first, not backend-integrated utilities.

Suggested location:

- `scripts/evals/run-proposal-model-benchmark.ts`

Suggested isolated support files:

- `benchmarks/proposal-generation/dataset/*.json`
- `benchmarks/proposal-generation/adapters/*.ts`
- `benchmarks/proposal-generation/core/*.ts`
- `benchmarks/proposal-generation/results/<run-id>/`

This keeps the benchmark separate from production codepaths and UI.

### Dataset shape

Each example should contain:

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

`expectedGrounding` and `forbiddenClaims` are important because they make honesty and grounding review faster and more consistent.

### Suggested dataset size

Start with 12 examples total:

- 4 strong-match cases
- 4 adjacent/partial-match cases
- 2 weak-match but plausible cases
- 2 no-context or minimal-context cases

That produces:

- 36 outputs for 3 models

This is small enough to review manually and large enough to expose hallucination and grounding patterns.

### Dimensions to score

Human-scored:

- writing quality
- relevance to the job
- grounding in CV/context
- honesty / non-hallucination
- format adherence

Automatically captured:

- latency in ms
- token usage when provider returns it
- estimated cost

Optional reviewer field:

- overall winner / tie

### Prompt strategy

Use exactly shared prompt text across benchmarked models whenever possible.

Allowed adaptation:

- transport-level differences only
  - OpenAI `input` vs Mistral `messages`
  - parameter name differences such as `max_output_tokens` vs `max_tokens`

Do not adapt:

- wording
- structure instructions
- anti-hallucination guidance
- personalization block content

### Output format

Per run, store:

- `results.json`
  - raw outputs, timings, usage, normalized metadata
- `results.csv`
  - one row per example/model
- `review.md`
  - side-by-side human review table and summary

This satisfies both machine analysis and human review.

### Where outputs should be stored

Do not store benchmark outputs under production app data.

Use a repo-local isolated folder such as:

- `benchmarks/proposal-generation/results/<YYYY-MM-DDTHH-mm-ss>/`

Keep audit/plan docs in `docs/`, and keep benchmark artifacts outside `docs/`.

## 8. What should be built first

Build the standalone script first.

Reason:

- lowest isolation risk
- no Convex action changes
- no UI changes
- no extension changes
- easiest to iterate on dataset and scoring

Backend-only eval utilities would only make sense after the standalone harness proves useful and stable.

## 9. What should explicitly not be changed yet

- production `generateProposal` routing
- active production model defaults
- extension flow
- app UI
- auth/session plumbing
- scraping
- tone system behavior
- CV ingestion flow
- LangChain production code unless a later separate cleanup is requested

## 10. Recommendation

Compare first.

Do not switch production models yet.

Reason:

- the current production abstraction is not benchmark-fair across providers
- there is enough existing infrastructure to run a clean isolated comparison quickly
- `mistral-small-latest` should remain the current production baseline until the isolated benchmark shows a clear winner on grounded output quality and acceptable latency/cost
