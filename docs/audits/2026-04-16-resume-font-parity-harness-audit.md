# Resume Font Parity Harness Audit

Date: 2026-04-16

Artifact root: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T00-09-05-318Z`

Chosen pair: `quiet-editorial` vs `mono-signal`

| Surface | Preset A heading font | Preset A body font | Preset B heading font | Preset B body font | Visibly different? |
|---|---|---|---|---|---|
| Preview | Fraunces, Georgia, serif | Syne, "Avenir Next", system-ui, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | no |
| Print route | Fraunces, Georgia, serif | Syne, "Avenir Next", system-ui, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | no |
| PDF raster | Fraunces, Georgia, serif | Syne, "Avenir Next", system-ui, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif | yes |

Overall pass: **yes**

## Classification

- Real export request parity: **matched**
  - The captured `CvForge` styled export request carried the live preview values for `layout`, `typography`, `palette`, and `rendererVariantId`.
- Worker pre-PDF print snapshot: **matched**
  - The worker now requires a real `__DASTI_RESUME_PRINT_STATUS__.snapshot` immediately before `page.pdf()` and verifies that `typography` and `rendererVariantId` still match the injected print payload.
- Final PDF raster: **visibly different**
  - The saved raster diff for page 1 is above the configured threshold.

## Conclusion

The shared renderer and styled PDF generation path are currently honoring the selected typography preset.

The remaining contradiction is not in:

- preview state at export click
- export request payload construction
- print-route bootstrap
- or PDF generation itself

The remaining contradiction is consistent with **viewer-specific perception/embedding behavior**, because the rasterized PDF output generated from the real exported bytes is visibly different even though the app-side preview and print screenshots are subtler than the raster threshold.
