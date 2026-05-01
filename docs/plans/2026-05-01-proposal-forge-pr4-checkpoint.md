# Proposal Forge PR4 checkpoint

Date: 2026-05-01

Scope: `/proposal` only. Do not touch Jobs, CV, Dashboard, `proposal-next`, backend send/export pipelines, or inactive legacy flows from this checkpoint.

## Completed commits

- `0e7345e90` `feat(proposal): suppress duplicate ProposalDisplay header controls in forge`
- `81a45b8b1` `feat(proposal): wire share safe-send risk checks`
- `b566810b5` `feat(proposal): align forge rail surfaces`
- `752854787` `feat(proposal): wire safe-send active signals`

## Current `/proposal` status

- P0 visible-surface cleanup is complete.
- P1 share/safe-send consolidation is complete.
- P1 rail/stage layout consistency is complete.
- P1 Safe-send active signal wiring is complete.

## Safe-send active-signal state

Rows now backed by active `/proposal` signals:

- Source job linked.
- CV variant selected.
- Proposal linked.
- Match review not accepted: backed by canonical job `reviewState` when a canonical job is active.
- Unresolved import issues: backed by attached CV `metadata.importRecoverySession` when a local attached CV is available.
- No placeholder text.
- Recipient or export target.
- Final export reviewed.

Rows intentionally still pending:

- Unresolved AI suggestion signal remains pending because no active `/proposal` signal exists.
- Unsupported claim signal remains pending because no active `/proposal` signal exists.

## Deferred `/proposal` items

- Public preview/copy link/send email implementation is deferred.
- Safe-send Continue final send behavior is deferred.
- Paper editing parity is deferred to P2.
- Mobile polish is deferred to P2.

## Next recommended work

If continuing `/proposal`, the next safest slice is P2 paper editing parity or mobile polish. Keep public preview/copy link/send email and final send behavior separate because they cross into send/share/export pipeline semantics.
