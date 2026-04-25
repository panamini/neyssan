# Premium No Cv Output Quality Audit

Date: 2026-03-17

## Scope

- premium `cover_letter` only
- `gpt-5.4` only
- no-CV quality review
- narrow prompt/body-contract refinement only if reviewed outputs showed a recurring issue

## Reviewed output set

Real premium no-CV outputs were reviewed across:

- operational/service: `Operations Coordinator`
- creative/admin: `Content and Administrative Coordinator`
- modest-skill: `Front Desk Coordinator`
- checklist-heavy: `Office Support Coordinator`

Primary preset comparison:

- `signature`
- `engaging`

`expert` was also spot-reviewed for diagnosis.

## Findings

- Active code: premium no-CV already had the right structural inputs.
  - `buildPremiumCoverLetterBrief(...)` passes `topEvidence`, `topResponsibilities`, `lowValueChecklist`, and `workContext`.
  - So the main weakness was not brief structure.
- Real reviewed outputs showed a recurring no-CV quality gap before the patch:
  - too detached
  - too role-summary-like
  - not candidate-like enough even when honest

Representative pre-patch examples:

- `ops-service engaging`
  - opening: `Careful scheduling, accurate documentation, and steady day-to-day coordination appear to be the core ...`
- `creative-admin engaging`
  - opening: `The highest-value work in this Content and Administrative Coordinator role is ...`
- `ops-service expert`
  - opening: `This Operations Coordinator role centers on ...`

Those lines were operationally grounded, but they read more like role-understanding notes than premium candidate letters.

## Classification

- Primary issue: `prompt/body-contract issue`
- Secondary issue: `detached candidate stance`
- Not primarily a no-CV brief/composition issue
- Not a parser/output-shape issue
- Not a routing/fallback issue

## Change

- Tightened only the premium no-CV contract in `convex/lib/proposals/premiumCoverLetter.ts`
- Added compact no-CV guidance that now requires:
  - first-person candidate stance
  - avoidance of detached memo-style openings such as `This role centers on...` and `The highest-value work...`
  - employer-value framing around operational consequence
  - a modest first-person ownership close line
- The change stayed inside the premium prompt/body-contract layer.

## Validation

- `npm test -- premiumCoverLetter.test.ts`
  - result: `24/24` tests passed
- Post-change live no-CV review across `signature` and `engaging`:
  - `Operations Coordinator`
  - `Content and Administrative Coordinator`
  - `Front Desk Coordinator`
  - `Office Support Coordinator`
  all succeeded on the premium structured path

Representative post-change signal:

- `ops-service signature`
  - opening: `I am drawn to work that depends on careful scheduling...`
  - close: `I would bring a careful, accountable approach to that daily coordination.`
- `creative-admin engaging`
  - opening: `I am drawn to work where content publishing schedules, calendar coordination, and current internal documentation keep the day moving cleanly.`
- `checklist-eligible engaging`
  - close: `I would bring careful first-person ownership to keeping that day-to-day coordination moving.`

## Residual note

- One earlier checklist-heavy draft (`Facilities Support Coordinator`) still failed premium no-CV eligibility with `no_allowed_facts`.
- That looks like a separate eligibility/input-shaping issue, not the output-quality issue addressed here.

## Recommendation

- Keep this change.
- The main no-CV weakness was real and recurring, but the narrow fix was enough: make the no-CV prompt sound like a candidate letter instead of a detached job-summary memo.
- Do not broaden beyond the premium no-CV prompt/body-contract layer unless a fresh audit shows another repeated issue.
