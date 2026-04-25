# Premium No-CV Opening Variety Audit

Date: 2026-03-17

## Scope

- premium `cover_letter` only
- `gpt-5.4` only
- no-CV opening quality only
- narrow prompt/body-contract refinement only if reviewed outputs showed a recurring issue

## Reviewed output set

Real premium no-CV outputs were reviewed across:

- operational/service: `Operations Coordinator`
- creative/admin: `Content and Administrative Coordinator`
- modest-skill: `Front Desk Coordinator`
- checklist-heavy eligible: `Office Support Coordinator`

Primary preset comparison:

- `signature`
- `engaging`

`expert` was spot-reviewed for diagnosis only.

## Findings

- Active code: the prior no-CV stance fix was still holding.
  - Openings were candidate-like and first-person.
  - Honesty and compactness remained intact.
- Real reviewed outputs showed a narrower remaining issue:
  - openings were becoming too formulaic across different no-CV roles
  - the repeated stems were product-visible even when the letters were otherwise acceptable

Representative repeated patterns before the patch:

- `ops-service signature`
  - `I am drawn to work that depends on careful scheduling...`
- `ops-service engaging`
  - `I am drawn to work built on careful scheduling...`
- `creative-admin signature`
  - `I am applying for the Content and Administrative Coordinator role with a clear focus on...`
- `modest-skill engaging`
  - `I am applying for the Front Desk Coordinator role with a clear focus on...`

The stance was improved compared with the earlier detached memo problem, but the opening stems were too obviously recycled across roles and presets.

## Classification

- Primary issue: `prompt/body-contract issue`
- Secondary issue: `preset-expression issue`
- Visible problem: repeated opening stems / too little syntactic variety
- Not a composition-brief issue
- Not a parser/output-shape issue
- Not a routing/fallback issue

## Change

- Tightened only the premium no-CV prompt/body contract in `convex/lib/proposals/premiumCoverLetter.ts`
- Added one compact instruction requiring opening variety and explicitly discouraging repeated stems such as:
  - `I am drawn to work...`
  - `I am applying... with a clear focus on...`
  - `This role centers on...`
  - `The highest-value work...`
- Kept the existing first-person candidate stance and honesty constraints unchanged.

## Validation

- `npm test -- premiumCoverLetter.test.ts`
  - result: `24/24` tests passed
- Post-change live no-CV recheck across `signature` and `engaging`:
  - `Operations Coordinator`
  - `Content and Administrative Coordinator`
  - `Front Desk Coordinator`
  - `Office Support Coordinator`
  all succeeded on the premium structured path

Representative post-change signal:

- `ops-service signature`
  - `I am pursuing this Operations Coordinator role with a clear focus on the work it depends on most...`
- `creative-admin signature`
  - `I would contribute by helping keep content publishing schedules on track...`
- `checklist-eligible engaging`
  - `The work that stands out here is keeping internal follow-up moving across daily operations...`

## Residual note

- No-CV outputs are still naturally thinner than CV-backed letters.
- Some checklist-heavy no-CV inputs can still run into a separate eligibility issue (`no_allowed_facts`), which was not addressed here.

## Recommendation

- Keep this change.
- The remaining no-CV issue was real but narrow: opening variety, not stance or honesty.
- Do not broaden beyond the premium no-CV prompt/body-contract layer unless a fresh audit shows another repeated quality issue.
