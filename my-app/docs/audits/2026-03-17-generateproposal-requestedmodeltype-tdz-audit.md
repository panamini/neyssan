# GenerateProposal RequestedModelType TDZ Audit

Date: 2026-03-17

## Scope

- runtime crash audit only
- `functions:generateProposal`
- no patch in this report

## Symptom

Convex logs repeatedly show:

```text
Uncaught ReferenceError: Cannot access 'x' before initialization
    at handleGenerateProposal (../../convex/generateProposalMutation.ts:7031:4)
```

## Active code finding

The crash is caused by a temporal dead zone in active code, not by Mistral probing and not by provider transport.

In `convex/generateProposalMutation.ts`:

- line `7022` starts computing `resolvedVoicePreset`
- line `7028` passes `requestedModelType` into `normalizeProposalVoicePresetForMode(...)`
- line `7103` declares `const requestedModelType: ProposalModelType = args.modelType || "mistral-small-latest";`

That means `requestedModelType` is being read before its `const` declaration has initialized.

Relevant lines:

- `7022-7030`: `resolvedVoicePreset = normalizeProposalVoicePresetForMode({ ..., modelType: requestedModelType }) ?? DEFAULT_PROPOSAL_VOICE_PRESET`
- `7103-7104`: `const requestedModelType: ProposalModelType = args.modelType || "mistral-small-latest";`

## Why the log says `x`

The runtime `Cannot access 'x' before initialization` message is consistent with bundled/transformed output. The local source still points to the `resolvedVoicePreset` block around line `7031`, but the actual uninitialized value is `requestedModelType`.

## Why this started

The new preset normalization block was inserted above the `requestedModelType` declaration. Before that change, `requestedModelType` was first used only after its declaration.

## Fix

Smallest safe fix:

1. move `const requestedModelType = args.modelType || "mistral-small-latest";` above the `resolvedVoicePreset` block

Alternative but less clean:

1. stop passing `requestedModelType` there and use `args.modelType` directly

The first option is better because the mutation already treats `requestedModelType` as the normalized source of truth for later routing and telemetry.

## Validation gap

I did not find an existing mutation-level regression test that would catch reading `requestedModelType` before initialization inside `handleGenerateProposal`.

## Classification

- active code
- local initialization-order bug
- not a provider outage
- not a parser/output-shape issue
- not a routing redesign issue
