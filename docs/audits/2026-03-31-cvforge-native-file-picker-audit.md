# CVForge Native File Picker Audit

Date: 2026-03-31

## Scope

Active app code only under `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app`.

Focused symptom:

- On `/cv`, clicking `Import`
- Then clicking `Import text PDF or TXT` or `Import scanned PDF or image`
- Expected: native browser file chooser opens

## Classification

- Active code:
  - [src/App.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/App.tsx)
  - [src/pages/CvForge.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx)
  - [src/components/ProfileReviewCard.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx)
  - [src/components/StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx)
- Legacy but informative:
  - `HEAD` version of `src/components/StructuredUploadButton.tsx`
- Obsolete/dead code:
  - none used in the mounted `/cv` path

## Exact Runtime Path

Mounted `/cv` route:

1. [src/App.tsx:110](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/App.tsx#L110) mounts `CvForge` for `/cv`.
2. [src/pages/CvForge.tsx:165](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx#L165) mounts `ProfileReviewCard` in edit mode.
3. [src/components/ProfileReviewCard.tsx:674](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L674) renders `StructuredUploadButton` in the empty-state branch.
4. [src/components/ProfileReviewCard.tsx:825](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L825) renders the same `StructuredUploadButton` in the loaded-CV toolbar branch.
5. [src/components/StructuredUploadButton.tsx:652](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L652) renders the dropdown implementation used by both `/cv` entrypoints.

Conclusion:

- The visible `Import` control on `/cv` is the active `StructuredUploadButton`.
- No competing import component was mounted on the tested `/cv` page.

## Root Cause

There is no remaining file-picker bug in the active working tree. The current runtime code already uses the corrected direct-input dropdown implementation:

- The visible menu rows are `<label>` wrappers with an actual `<input type="file">` stretched across the option hitbox. Evidence: [src/components/StructuredUploadButton.tsx:739](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L739), [src/components/StructuredUploadButton.tsx:743](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L743), [src/components/StructuredUploadButton.tsx:799](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L799), [src/components/StructuredUploadButton.tsx:803](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L803)
- The menu option input is not `display:none`; it is positioned as an invisible full-row hitbox. Evidence: [src/components/StructuredUploadButton.tsx:83](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L83)
- No overlay, disabled state, or outside-click handler blocked the active menu input during the reproduced browser sessions.

What changed relative to `HEAD`:

- `HEAD` used a single hidden input plus programmatic `input.click()` after route selection, via `pickerRef` and `trigger(...)`.
- The active working tree no longer uses that path for normal dropdown selection.
- The active working tree mounts dedicated default and OCR inputs and binds the visible rows directly to those inputs.

Evidence from `git diff -- src/components/StructuredUploadButton.tsx`:

- old path: single `inputRef`, `pendingMode`, `pickerRef`, `input.click()`
- active path: `defaultInputRef`, `mistralInputRef`, `MENU_INPUT_HITBOX_STYLE`, direct menu-row `<label>` inputs

Practical root-cause statement:

- The user-reported symptom matches the older hidden-input/programmatic-click implementation pattern.
- The active runtime code in this workspace already contains the direct-input fix, so the current `/cv` route does open the native file chooser.
- No additional source fix was required in `my-app` after verification because the mounted runtime path is already on the corrected implementation.

## Reproduction And Verification

Dedicated fresh source server:

- Started a fresh Vite instance from the active working tree on `http://127.0.0.1:4217`.

Also checked existing local server:

- Verified the same behavior on `http://127.0.0.1:4173`.

Browser verification method:

- Real browser sessions using Playwright against the actual `/cv` page.
- Waited for browser `filechooser` events after clicking the visible import menu rows.
- Tested both `/cv` states:
  - empty state
  - loaded CV state after `Create new CV`

Observed result on fresh source (`4217`):

- Chromium headless: `filechooser=true`
- Chromium headed: `filechooser=true`
- Firefox headless: `filechooser=true`
- WebKit headless: `filechooser=true`

Observed result on existing local server (`4173`):

- Chromium headless: `filechooser=true`

What was explicitly ruled out in the active runtime:

- wrong component mounted
- stale route path inside `/cv`
- disabled menu inputs
- z-index or pointer-events interference
- menu unmount preventing native picker activation on the tested runtime
- browser-specific failure in Chromium, Firefox, or WebKit on this machine

## Files Changed

- Added this audit note only:
  - [docs/audits/2026-03-31-cvforge-native-file-picker-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/docs/audits/2026-03-31-cvforge-native-file-picker-audit.md)

No application source files required further edits because the active runtime path already opens the native file chooser.

## Remaining Caveats

- I could not reproduce the reported failure in the active working tree on this machine.
- I could not prove a stale browser tab or old bundle was the exact session the symptom came from, only that the active runtime now behaves correctly.
- The `HEAD` version of `StructuredUploadButton` still produced `filechooser` events under Playwright automation here, so I cannot claim an engine-specific browser block without a failing interactive session from the reporter’s exact environment.
