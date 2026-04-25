# PDF Export Architecture Audit

Date: 2026-04-13

## Scope
- Resume PDF export
- Proposal PDF export
- Proposal DOCX export
- Preview-to-export coupling
- Robial 17/18 export geometry enforcement

## Findings

### Active Code
- [`my-app/src/pages/CvForge.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx) contained the active resume export controls.
- [`my-app/src/lib/cv-export.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/cv-export.ts) already provided schema-driven direct-download resume export builders for PDF, DOCX, Markdown, and JSON.
- [`my-app/src/lib/authoritative-resume.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts) already enforced a trusted authoritative resume export model when Mistral v3 output was available.
- [`my-app/src/pages/ProposalForge.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx) was the active proposal export entrypoint.
- [`my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx) contained reusable semantic proposal block parsing and document composition logic.
- [`my-app/src/features/verbati/style.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/style.ts) remained the active source for style preset resolution, palette handling, and typography selection.

### Legacy But Informative Code
- [`my-app/src/features/verbati/resume/resume-layout.spec.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-layout.spec.ts) contained the closest existing Robial-compatible geometry, especially `swissminima` and `signalgrid`.
- `ProposalDocumentRenderer` template IDs such as `volk_register` and `two_column_rail` were useful for style/template identity, but not safe as export geometry authority.

### Obsolete Or Non-Authoritative For Final Export
- [`my-app/src/lib/document-export.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/document-export.ts) used `html2canvas` and `jsPDF.addImage`, making it raster-based and non-compliant for final text PDF architecture.
- Proposal export logic that depended on mounted preview DOM selectors, preview-settle retries, or preview mode switching was non-authoritative for final export.
- Preview shells such as [`my-app/src/features/verbati/VerbatiResumePreview.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx) and [`my-app/src/features/verbati/resume/ResumePage.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx) were not suitable as final export renderers.

## Confirmed Problems
- `document-export.ts` was an active raster screenshot export helper and could not remain the final PDF path.
- Proposal export was tied to mounted preview DOM and needed replacement.
- Resume already had a valid schema-driven ATS path and should be preserved behind a unified export API.
- Existing preview geometry and export geometry were mixed in ways that risked keeping old layout assumptions alive.

## Final Audit Decision
- Final export code must consume normalized source-of-truth payloads only.
- Final export geometry must be Robial 17/18 only.
- `stylePreset` may affect typography, palette, emphasis, and ornament only.
- Preview components may remain legacy during migration, but export code must not inherit preview-stage geometry.
