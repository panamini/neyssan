# Final No-Context And Preset Hardening Audit

Date: 2026-03-13

Scope:

- Active backend proposal prompt path only
- No auth, scraping, CV-flow, Proposal Forge, or model-selection redesign

Classification:

- Active code:
  - `convex/generateProposalMutation.ts`
  - `convex/lib/proposals/voicePresets.ts`
- Legacy but informative code:
  - none needed for this audit
- Obsolete/dead code:
  - `*.bak`
  - backup component trees

## Findings

1. The stale-profile identity leak is mostly fixed.
2. The true no-context branch is still too weak.
3. In no-context cases, the model still rewrites job-description duties into candidate history.
4. The remaining preset gap is still behavioral, not architectural.
5. `engaging` and `storyteller` still converge too often through generic opening language.

## Root cause

The active prompt already contains anti-hallucination and specificity rules, but the no-context branch does not yet say the most important thing explicitly enough:

- no candidate context means no prior-role claims
- no prior-systems-used claims
- no prior-incidents-handled claims
- no prior-quantified-results claims
- no prior management / training / coordination claims
- no invented negative-history disclaimers
- no implicit tool familiarity unless framed only as role understanding or willingness to learn

The prompt also needs:

- one explicit boundary rule that job-description requirements may frame fit, but may not be rewritten as candidate history unless source-backed
- one explicit hard-stop set for identity, status, credential, and direct-domain claims such as veteran status, military service, public-service background, accreditation/licensing, completed degree status, and direct domain-practice background

## Smallest safe implementation

1. Harden the no-context block with explicit non-claiming rules, including both invented positive history and invented negative history.
2. Add one compact JD-to-candidate boundary rule in the active prompt.
3. Add one compact identity/background hard-stop rule set in the active prompt.
4. Add two tiny contrastive examples: JD-only rewriting and adjacent identity/domain inference.
5. Do one final tiny overlay lift for `engaging` and `storyteller` openings.
