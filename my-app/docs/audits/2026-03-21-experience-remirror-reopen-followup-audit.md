# Experience Remirror Reopen Follow-up Audit

Date: 2026-03-21

## Scope

- `Experience` modal reopening with missing formatting
- Proposal input overlap and input sizing
- `Choose resume` card hierarchy
- Sidebar theme toggle interaction

## Findings

### Active code

- The `Experience` reopen bug was caused by structured conversion re-spreading raw item data after normalized fields in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/remirror-editor/utils/conversion.ts`
- In practice, a stale raw `responsibilities` value could overwrite the normalized Remirror doc during section reconstruction.
- The same structural risk also existed for `education` and `summary`, so the spread order was corrected there too.
- The preview path also preferred legacy `achievements[]` over normalized `responsibilities`, which could hide newly applied formatting even when the text itself was already saved.
- The active preview now prefers `responsibilities`, and inline editing clears legacy `achievements[]` once the rich responsibilities doc becomes the source of truth.

- The proposal input surface had two UX issues in active code:
  - its document shell was too tall for an assistant-like compose experience
  - its toolbar could visually crowd the content area on narrower widths
- The active fixes live in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.module.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`

- `Choose resume` previously used a special card with an icon and a different hierarchy from the main resume library.
- It now reuses the same `title-first` card language as the resume library inside the dialog.
- The compose `Resume` selector now uses a paperclip-triggered attach pattern with passive truncated text instead of making the whole label a button.

- The footer theme toggle in the sidebar now toggles on any click, including the already-selected option, to reduce pointer travel.

## Residual note

- The broader system of canonical popup/card aspect families is still undecided.
- The current patch only makes `Choose resume` and proposal compose more coherent without claiming that the format-family problem is solved globally.
