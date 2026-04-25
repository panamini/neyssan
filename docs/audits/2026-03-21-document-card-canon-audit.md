# Document Card Canon Audit

Date: 2026-03-21

## Scope
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`

## Finding

### Active code

The app already had a mostly shared document card shell, `dasti-doc-card`, but the visual grammar was still split in practice:

- `Resume Library` and `Proposal Library` were close to a `title-first` pattern
- `Choose resume` still felt closer to a dialog row than a document card
- spacing, vertical rhythm, and action-rail proportions were not fully aligned across these surfaces

That produced the usual “almost unified, but not quite” feel:

- titles did not always own enough space
- chooser actions felt too detached from the document body
- card rhythm varied more than the content actually required

## Direction

Keep a single cross-site canon:

1. title first
2. date as a quiet trailing detail when relevant
3. meta line second
4. snippet or preview third
5. actions in a separate rail only when the card needs explicit controls

## Implemented pass

### Active code

The current pass stays small and only tightens the shared shell:

- `dasti-doc-card` now has a stronger vertical rhythm and stable minimum height
- `dasti-doc-card__stack` and `__meta` use a more deliberate spacing hierarchy
- snippets use a calmer reading line-height
- chooser cards use the same shell grammar, with a tighter dedicated actions rail
- chooser selection now uses a shared selected state instead of ad hoc inline styling

## Classification

- Active code: yes
- Legacy but informative: no
- Obsolete/dead code: none identified in this pass
