# CV Builder -> Renderer Integration Audit
Date: 2026-03-25

## Scope
- Source master analyzed: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app`
- Candidate renderer analyzed: `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor`
- Goal: recommend a safe integration path between the active CV builder/editor and the standalone CV renderer/theme lab without breaking current output.

## Method
- Read active route entries, state/context, domain types, schemas, adapters, editor/renderer components, style/token files, Tailwind configs, and package manifests in both repos.
- Classified code as `active code`, `legacy but informative code`, or `obsolete/dead code` per project instructions.
- Treated `pdf-ingest/`, `*.bak`, archived copies, and old parser/training trees as non-authoritative by default.

## 1. Resume executif
- Recommended target architecture: integrate the mini-app renderer directly into `my-app` as an isolated feature module, with `CvDocument` staying the master source and an explicit adapter layer converting builder data into renderer data.
- Do not extract a shared package now. Do not move to a workspace/monorepo now. Do not share the mini-app UI kit globally now.
- The highest-risk gaps are not visual polish issues; they are contract and boundary issues:
- `CvDocument` and `ResumeData` do not describe the same object model.
- `StyleForge` in `my-app` and the mini-app theme system do not expose the same style contract.
- The mini-app UI shell depends on a different Tailwind token vocabulary and a different theming runtime model.
- The safest path is progressive:
- Step 1: preserve `CvDocument` as source of truth.
- Step 2: create a renderer-only view model and adapter.
- Step 3: port the pure CV renderer and its layout CSS into `my-app`.
- Step 4: scope renderer tokens locally instead of replacing app-global theming.
- Step 5: only later wire style controls and fill missing structured sections such as `projects`.

## 2. Architecture actuelle comprise

### 2.1 Builder actif dans `my-app`
- Builder route entry: `my-app/src/App.tsx` mounts `/cv` -> `my-app/src/pages/CvForge.tsx`.
- Builder page entry: `my-app/src/pages/CvForge.tsx` renders `ProfileReviewCard`.
- Builder state boundary: `my-app/src/contexts/CvLibraryContext.tsx` owns `cvs`, `currentCv`, `loadCv`, `saveCurrentCv`, `importCv`, section/block mutations, persistence scheduling, and active CV snapshot sync.
- Builder domain contract: `my-app/src/types/cvDocument.ts`.
- Builder runtime validation: `my-app/src/schemas/cvDocument.schema.ts`.
- Builder normalization/template layer: `my-app/src/lib/cv-template.ts`, `my-app/src/lib/normalize-cv.ts`.
- Builder persistence boundary: `my-app/src/adapters/StorageAdapter.ts`.
- Backend/profile bridge: `my-app/src/adapters/profile-mapper.ts`.
- Builder UI boundary: `my-app/src/components/ProfileReviewCard.tsx`, `my-app/src/components/SectionEditor.tsx`, `my-app/src/components/cv-editor/BlockRenderer.tsx`, `my-app/src/components/structured-blocks/*`, `my-app/src/components/remirror-editor/*`.
- Current builder-internal preview/render boundary: `my-app/src/components/cv-display/*`.

### 2.2 Renderer actif dans the mini-app
- App entry: `dasti-production-hybrid-refactor/src/app/App.tsx`.
- Shell entry: `dasti-production-hybrid-refactor/src/pages/showcase/ShowcasePage.tsx`.
- Real CV renderer entry: `dasti-production-hybrid-refactor/src/pages/resume/ResumePage.tsx`.
- Renderer data contract: `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`.
- Renderer layout contract: `dasti-production-hybrid-refactor/src/pages/resume/resume-layout.spec.ts`.
- Renderer CSS surface: `dasti-production-hybrid-refactor/src/pages/resume/resume-preview.css`.
- Theme/runtime boundary: `dasti-production-hybrid-refactor/src/app/providers/ThemeProvider.tsx`, `theme-engine.ts`, `theme-vars.ts`, `theme-text.ts`, `theme-export.ts`, `theme-runtime.ts`, `theme-catalogs.ts`.
- Theme/token boundary: `dasti-production-hybrid-refactor/src/styles/tokens.css`, `src/styles/base.css`, `src/styles/utilities.css`, `tailwind.config.ts`.
- Showcase-only UI shell: `dasti-production-hybrid-refactor/src/components/layout/*`, `src/components/ui/*`, `src/pages/showcase/*`.

### 2.3 Boundaries actuelles
- `CvDocument` is the active builder-owned document model.
- `ResumeData` is a renderer-owned presentational model.
- `StyleForge` in `my-app` is currently a local visual prototype using hardcoded example content, not the live `currentCv`.
- The mini-app `ThemeProvider` is a root-level theme composition system for a standalone app, not a document-scoped renderer theme bridge.
- `my-app` already has local preview logic inside `SectionEditor`, `BlockRenderer`, and `cv-display`. Integrating a second renderer without explicit boundaries would create duplicated rendering authority.

### 2.4 Classification summary

#### Active code
- `my-app/src/App.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/contexts/CvLibraryContext.tsx`
- `my-app/src/types/cvDocument.ts`
- `my-app/src/schemas/cvDocument.schema.ts`
- `my-app/src/lib/cv-template.ts`
- `my-app/src/lib/normalize-cv.ts`
- `my-app/src/adapters/StorageAdapter.ts`
- `my-app/src/adapters/profile-mapper.ts`
- `my-app/src/components/ProfileReviewCard.tsx`
- `my-app/src/components/SectionEditor.tsx`
- `my-app/src/components/cv-editor/BlockRenderer.tsx`
- `my-app/src/pages/StyleForge.tsx`
- `my-app/src/styles/globals.css`
- `my-app/tailwind.config.js`
- `dasti-production-hybrid-refactor/src/pages/resume/ResumePage.tsx`
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- `dasti-production-hybrid-refactor/src/pages/resume/resume-layout.spec.ts`
- `dasti-production-hybrid-refactor/src/pages/resume/resume-preview.css`
- `dasti-production-hybrid-refactor/src/styles/tokens.css`
- `dasti-production-hybrid-refactor/src/app/providers/*`
- `dasti-production-hybrid-refactor/tailwind.config.ts`

#### Legacy but informative
- `my-app/src/components/cv-display/CvDocumentDisplay.tsx`
- `my-app/src/components/ProfileEditor.tsx`
- `my-app/src/components/ProfileForm.tsx`
- `my-app/src/components/cv-editor/Section.legacy.tsx`
- `dasti-production-hybrid-refactor/src/pages/resume/defaulttheme.css`
- `dasti-production-hybrid-refactor/docs/*`
- `dasti-production-hybrid-refactor/src/pages/resume/resume.mock.ts`

#### Obsolete/dead
- `*.bak`
- backup trees and copied CSS files such as `resume-preview copy.css`
- `pdf-ingest/`
- training-oriented parser/archive code outside the active frontend flow

## 3. Architecture cible recommandee

### Recommendation
- Integrate the renderer directly into `my-app` as a feature module.
- Add one thin internal shared layer for renderer contracts/adapters and document-scoped theme bridging.
- Keep `CvDocument` as the source master.
- Treat the standalone mini-app as source material, not as a package to consume wholesale.

### Why this is the best medium-term option
- There is one real host application today: `my-app`.
- A shared package would force premature stabilization of mismatched contracts.
- A workspace/monorepo would add tooling overhead before there is a second production consumer.
- The mini-app uses React 19.2.4 while `my-app` uses React 18.3.1.
- The mini-app uses Vite 8 and newer React plugin/lint stacks; `my-app` uses Vite 5 and older plugin versions.
- The mini-app shell is broader than the renderer itself: it includes a standalone theme lab, UI kit, and root theme runtime. Porting all of that would widen the integration blast radius for little immediate value.

### Recommended target boundaries
- `builder domain`: `CvDocument` and editor logic remain in `my-app`.
- `renderer contract`: introduce a renderer-only view model inside `my-app`.
- `renderer feature`: port `ResumePage`, layout spec, and renderer CSS into `my-app`.
- `document theme bridge`: define renderer-scoped aliases/tokens without replacing app-global tokens.
- `style control translation`: map current `StyleForge` choices into renderer presets explicitly, later and carefully.

### Explicitly rejected as first move
- Full package extraction of mini-app UI/theme system.
- Immediate workspace/monorepo restructuring.
- Global "common files" bucket mixing domain contracts, UI kit, business logic, and theme runtime.

## 4. Ce qui doit etre mutualise

### Shared contracts
- A renderer-facing adapter contract inside `my-app`, for example `ResumeRenderModel` or `CvRenderDocument`.
- Render preference contract, for example `DocumentRenderPreset` or `CvRenderPreset`, separate from `CvDocument`.
- Shared formatters used by the adapter:
- date range formatting
- responsibility-to-bullet extraction
- section ordering and fallback rules

### Shared theme / tokens
- Only a renderer-scoped token bridge.
- Exact scope to share:
- color aliases the renderer expects, such as `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-accent`
- font aliases needed by the renderer surface
- radius aliases needed by the renderer surface
- layout variables required by `resume-layout.spec.ts`

### Shared business logic
- Mapping from `CvDocument` sections to renderer fields.
- Render-safe fallback rules.
- Optional style preset translation from `StyleForge` state to renderer variant/theme state.

## 5. Ce qui doit rester separe

### Builder-specific logic
- `CvLibraryContext`
- import/upload flows
- normalization and schema validation
- Remirror editing
- DnD/editor interactions
- persistence and Convex sync
- active CV snapshot sync

### Renderer-specific logic
- A4 page layout variants
- autofit / preview scaling
- one-column and Robial-specific typography/layout logic
- comparison mode UI
- project card layout logic

### Shared UI that should NOT be extracted now
- `dasti-production-hybrid-refactor/src/components/ui/*`
- `dasti-production-hybrid-refactor/src/components/layout/*`
- `dasti-production-hybrid-refactor/src/pages/showcase/*`

### Why they should stay separate
- They depend on a different Tailwind vocabulary.
- They assume a different token namespace.
- They are host-shell/showcase concerns, not renderer-core concerns.
- Extracting them now would enlarge the migration while not improving source fidelity.

## 6. Fichiers impliques

### Builder source of truth and data entry
- `my-app/src/App.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/contexts/CvLibraryContext.tsx`
- `my-app/src/adapters/StorageAdapter.ts`
- `my-app/src/adapters/profile-mapper.ts`
- `my-app/src/lib/cv-template.ts`
- `my-app/src/lib/normalize-cv.ts`
- `my-app/src/types/cvDocument.ts`
- `my-app/src/schemas/cvDocument.schema.ts`

### Builder UI and current preview path
- `my-app/src/components/ProfileReviewCard.tsx`
- `my-app/src/components/SectionEditor.tsx`
- `my-app/src/components/cv-editor/Section.tsx`
- `my-app/src/components/cv-editor/BlockRenderer.tsx`
- `my-app/src/components/cv-display/SectionDisplay.tsx`
- `my-app/src/components/cv-display/ReadOnlyRichDoc.tsx`
- `my-app/src/components/cv-display/RichSummary.tsx`
- `my-app/src/components/cv-display/SkillsDisplay.tsx`
- `my-app/src/components/cv-display/LanguagesDisplay.tsx`
- `my-app/src/components/structured-blocks/*`

### Current style prototype in host app
- `my-app/src/pages/StyleForge.tsx`
- `my-app/src/styles/globals.css`
- `my-app/tailwind.config.js`
- `my-app/docs/specs/dasti-spec-v2.md`

### Candidate renderer feature to port
- `dasti-production-hybrid-refactor/src/pages/resume/ResumePage.tsx`
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- `dasti-production-hybrid-refactor/src/pages/resume/resume-layout.spec.ts`
- `dasti-production-hybrid-refactor/src/pages/resume/resume-preview.css`

### Candidate theme/token assets to port selectively
- `dasti-production-hybrid-refactor/src/styles/tokens.css`
- `dasti-production-hybrid-refactor/src/app/providers/theme-vars.ts`
- `dasti-production-hybrid-refactor/src/app/providers/theme-export.ts`
- `dasti-production-hybrid-refactor/src/app/providers/theme-catalogs.ts`

### Files not to port wholesale in phase 1
- `dasti-production-hybrid-refactor/src/app/App.tsx`
- `dasti-production-hybrid-refactor/src/pages/showcase/ShowcasePage.tsx`
- `dasti-production-hybrid-refactor/src/pages/showcase/ThemeLabPanel.tsx`
- `dasti-production-hybrid-refactor/src/components/ui/*`
- `dasti-production-hybrid-refactor/src/components/layout/*`

## 7. Cartographie complete source -> renderer

### 7.1 Data contract mapping

| Source master | Source files | Renderer expectation | Renderer files | Status | Notes |
|---|---|---|---|---|---|
| `CvDocument.id` | `my-app/src/types/cvDocument.ts` | no direct equivalent | `resume.types.ts` | lost | Renderer is document-content oriented, not document-identity oriented. |
| `CvDocument.title` | `my-app/src/types/cvDocument.ts` | `ResumeData.title` | `resume.types.ts` | divergent | In source, `title` is the CV document title. In renderer, `title` is the displayed role/job title. Unsafe 1:1 mapping. |
| `CvMetadata` object | `my-app/src/types/cvDocument.ts` | `metadata: {label,value}[]` | `resume.types.ts`, `ResumePage.tsx` | transformed | Renderer metadata is display metadata, not persistence metadata. Needs explicit field picking and labeling. |
| `profile.name` | `CvDocument` `profile` section | `name` | `ResumeData.name` | transformed cleanly | Straight mapping. |
| `profile.desiredPosition` | `IProfileItem` | `title` | `ResumeData.title` | transformed cleanly | Straight mapping if the field is populated. |
| `profile.email/phone/linkedin/website` | `IProfileItem` | `contact[]` | `ResumeData.contact` | transformed | Renderer requires label/value arrays. |
| `profile.location` | `IProfileItem` | `metadata[]` or `contact[]` | `ResumeData.metadata` or `contact` | ambiguous | No active canonical renderer rule exists yet. Must be decided. |
| `profile.photoUrl` | `IProfileItem` | no slot | `ResumePage.tsx` | absent | Renderer ignores photo today. |
| `summary.summary` | `ISummaryItem` | `summary: string` | `ResumeData.summary` | partially transformed | Source allows Remirror JSON or string. Renderer needs flat text. Rich formatting is lost. |
| `experience.company` | `IExperienceItem` | `company` | `ResumeExperienceItem.company` | transformed cleanly | Straight mapping. |
| `experience.position` | `IExperienceItem` | `role` | `ResumeExperienceItem.role` | transformed cleanly | Straight mapping. |
| `experience.startDate/endDate/isCurrent/*Precision` | `IExperienceItem` | `period: string` | `ResumeExperienceItem.period` | transformed | Requires formatter. Precision is collapsed into a string. |
| `experience.location` | `IExperienceItem` | `location` | `ResumeExperienceItem.location` | transformed cleanly | Straight mapping. |
| `experience.responsibilities` | `IExperienceItem` | `bullets: string[]` | `ResumeExperienceItem.bullets` | partially transformed | Remirror or text must be flattened and split. Formatting fidelity is reduced. |
| `experience.achievements` | `IExperienceItem` | fallback bullets | `ResumeExperienceItem.bullets` | transformed with fallback | Current preview logic already mixes responsibilities and achievements. Must be unified. |
| `education.institution` | `IEducationItem` | `school` | `ResumeEducationItem.school` | transformed cleanly | Straight mapping. |
| `education.degree` | `IEducationItem` | `degree` | `ResumeEducationItem.degree` | transformed cleanly | Straight mapping. |
| `education.startDate/endDate/isCurrent/*Precision` | `IEducationItem` | `period: string` | `ResumeEducationItem.period` | transformed | Precision collapses into a display string. |
| `education.fieldOfStudy` | `IEducationItem` | no dedicated field | `ResumeEducationItem` | partially lost | Must be merged into `degree` or dropped. |
| `education.grade` | `IEducationItem` | no dedicated field | `ResumeEducationItem` | lost | No slot today. |
| `education.description` | `IEducationItem` | no dedicated field | `ResumeEducationItem` | lost | Renderer does not expose it. |
| `skills[].name` | `ISkillItem` | `skills: string[]` | `ResumeData.skills` | transformed cleanly | Straight mapping of names. |
| `skills[].level` | `ISkillItem` | no dedicated skills level slot | `ResumeData.skills` | lost | Builder uses 5-level scale; renderer skills list is label-only. |
| `skills[].bucket` | `ISkillItem` | no dedicated slot | `ResumeData.skills` | lost | No renderer concept today. |
| `languages[].name` | `ILanguageItem` | `languages[].name` | `ResumeLanguage.name` | transformed cleanly | Straight mapping. |
| `languages[].level` | `ILanguageItem` | `languages[].level: string` | `ResumeLanguage.level` | transformed | String-compatible, but renderer semantics are looser than source. |
| `achievements[].text` | `IAchievementItem` | `achievements?: string[]` | `ResumeData.achievements` | transformed | Structured items become strings. |
| `projects` section as generic `CvBlock[]` | `CvSection.type === "projects"` | `projects: {name,meta,description}[]` | `ResumeProjectItem[]` | absent/divergent | This is the biggest content-model mismatch after the root contract mismatch. |
| `certifications`, `contact`, `text` sections | `CvSection.type` | no direct slots | `ResumeData` | absent | Needs either omission rules or renderer extension. |

### 7.2 Style, tokens, and theme mapping

| Domain | Host source | Candidate renderer | Status | Notes |
|---|---|---|---|---|
| Accent tokens | `--ac --am --ap --as --fr --op` in `my-app/src/styles/globals.css` | `--accent --accent-hover --accent-soft --on-accent` plus `--color-*` aliases in `src/styles/tokens.css` | partial overlap | Semantic equivalence exists, names differ. |
| Surface/text/border tokens | `--bg --sf1 --sf2 --sfr --ti --tm2 --tg2 --bo --bm` | `--canvas --surface --surface-muted --surface-raised --text --text-muted --text-subtle --border --border-strong` and `--color-*` aliases | partial overlap | Needs alias bridge. |
| Canonical color aliases | host defines `--canvas`, `--surface-1`, `--surface-2`, `--surface-raised`, but not the full `--color-*` family | renderer Tailwind and CSS expect `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-text`, etc. | missing | Mini-app `theme-vars.ts` generates these aliases; host does not today. |
| Font families | host globally uses `Source Sans 3`, `Fraunces`, `Source Serif 4`, `IBM Plex Mono` | renderer/theme lab also uses `Cormorant`, `Syne`, `Bricolage` in theme presets | partial overlap | Renderer core can work now; theme lab presets need extra font support. |
| Radius vocabulary | host Tailwind exposes `rounded-rx/rs/rm/rl/rp` | renderer components use `rounded-inline/item/card/surface/pill` | missing | Needs scoped aliases or class conversion. |
| Control heights | host uses `h-hs/hm/hb/hdr` and compat heights | renderer UI kit uses `h-control-sm/md/lg` | missing | Another argument against importing UI kit wholesale. |
| Tailwind color classes | host uses `bg-sf1`, `text-ti`, `border-bo`, etc. | mini-app UI kit uses `bg-surfaceRaised`, `text-textMuted`, `border-borderStrong`, `bg-canvas`, etc. | incompatible by default | `ResumePage` itself is mostly CSS-based; UI kit is not safe to drop in. |
| Layout ids | host `StyleForge` uses `swiss`, `two-column`, `editorial` | renderer uses `tschichold`, `golden`, `robial`, `onecol` | divergent | No clean 1:1 mapping today. |
| Typography ids | host `StyleForge` uses `signature`, `engaging`, `expert` | mini-app theme system uses font-pair ids and theme modes | divergent | Needs explicit translation or a new shared render-style contract. |
| Palette ids | host uses `sauge`, `ocre`, `pierre`, `bordeaux`, `encre`, `custom` | mini-app uses `baseColor + paletteType + local adjustments` | divergent | The mini-app theme lab is a generator, not a named palette selector. |
| Theme runtime scope | host theme tokens are app-global and stable | mini-app `ThemeProvider` writes composed vars onto the root app | unsafe to merge directly | Must be document-scoped in `my-app`. |

### 7.3 Module boundary mapping
- Builder-specific modules:
- `CvLibraryContext`
- `StorageAdapter`
- `normalize-cv`
- `cv-template`
- `SectionEditor`
- `BlockRenderer`
- renderer should consume their outputs, not replace them
- Renderer-specific modules:
- `ResumePage`
- `resume-layout.spec.ts`
- `resume-preview.css`
- `ResumeData`
- comparison/autofit/layout logic
- Theme-lab-only modules:
- `ThemeProvider`
- `ThemeLabPanel`
- showcase `Button/Card/Pill/Select/Status`
- should stay outside phase-1 integration

## 8. Ecarts detectes

### E01. No shared canonical contract between builder and renderer
- Source files:
- `my-app/src/types/cvDocument.ts`
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- Problem:
- The builder writes a structured document tree.
- The renderer consumes a flattened presentational object.
- Impact:
- Integrating the renderer without an adapter creates a second source of truth or duplicated mapping logic across screens.

### E02. Semantic collision on `title`
- Source file:
- `my-app/src/types/cvDocument.ts`
- Renderer file:
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- Problem:
- `CvDocument.title` is the document label.
- `ResumeData.title` is the displayed role/headline.
- Impact:
- A naive field copy produces silently wrong output.

### E03. `projects` is not structurally renderable as-is
- Source files:
- `my-app/src/types/cvDocument.ts`
- `my-app/src/lib/cv-template.ts`
- Renderer file:
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- Problem:
- Source `projects` is currently a generic `CvBlock[]`.
- Renderer requires `{ name, meta, description }[]`.
- Impact:
- Current data cannot fill renderer project cards faithfully.

### E04. Rich text is flattened in multiple places
- Source files:
- `my-app/src/types/cvDocument.ts`
- `my-app/src/components/cv-editor/BlockRenderer.tsx`
- Renderer file:
- `dasti-production-hybrid-refactor/src/pages/resume/ResumePage.tsx`
- Problem:
- `summary`, `responsibilities`, and some descriptions are rich text in source.
- Renderer expects plain text or bullet arrays.
- Impact:
- Content fidelity drops unless the adapter is explicit about flattening rules.

### E05. Levels and buckets are partly lost
- Source file:
- `my-app/src/types/cvDocument.ts`
- Renderer file:
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- Problem:
- Skills in source carry `level` and optional `bucket`.
- Renderer skills list keeps only strings.
- Languages keep a string level but not the builder's tighter semantics.
- Impact:
- Subtle information loss and potential UI mismatch.

### E06. Style contract drift between host `StyleForge` and mini-app renderer/theme system
- Host file:
- `my-app/src/pages/StyleForge.tsx`
- Host spec:
- `my-app/docs/specs/dasti-spec-v2.md`
- Renderer/theme files:
- `dasti-production-hybrid-refactor/src/pages/resume/resume.types.ts`
- `dasti-production-hybrid-refactor/src/app/providers/theme-catalogs.ts`
- Problem:
- Host style state is `layoutTemplate + typographyStyle + named palette`.
- Mini-app style state is `layout variant + font pair + palette generator + local adjustment layers`.
- Impact:
- There is no safe direct binding.

### E07. Theme scope mismatch
- Host files:
- `my-app/src/styles/globals.css`
- `my-app/tailwind.config.js`
- Mini-app files:
- `dasti-production-hybrid-refactor/src/app/providers/ThemeProvider.tsx`
- `dasti-production-hybrid-refactor/src/app/providers/theme-vars.ts`
- Problem:
- Host tokens are app-global and stable.
- Mini-app theme system composes and applies root-level runtime vars.
- Impact:
- Direct mounting risks restyling the entire host app instead of only the document surface.

### E08. Tailwind/token vocabulary mismatch blocks direct UI sharing
- Host file:
- `my-app/tailwind.config.js`
- Mini-app files:
- `dasti-production-hybrid-refactor/tailwind.config.ts`
- `dasti-production-hybrid-refactor/src/components/ui/Button/button.variants.ts`
- Problem:
- The mini-app UI kit uses classes like `rounded-inline`, `text-body-sm`, `h-control-md`, `bg-surfaceRaised`, `text-text`, `border-borderStrong`, `bg-canvas`.
- The host Tailwind config does not define those names.
- Impact:
- Copying mini-app UI primitives directly will break or partially render.

### E09. `StyleForge` is not wired to live builder data
- Host file:
- `my-app/src/pages/StyleForge.tsx`
- Problem:
- It renders hardcoded sample sections and hardcoded identity data.
- Impact:
- Even perfect visual integration would still not reflect the actual source document.

### E10. The mini-app shell is broader than the renderer and duplicates host responsibilities
- Mini-app files:
- `src/app/App.tsx`
- `src/pages/showcase/ShowcasePage.tsx`
- `src/pages/showcase/ThemeLabPanel.tsx`
- Problem:
- They provide standalone app chrome and theme lab workflows.
- Impact:
- Porting them wholesale would duplicate host shell, controls, and navigation patterns.

### E11. Dependency and toolchain alignment is not ready for package extraction
- Host package:
- `my-app/package.json`
- Mini-app package:
- `dasti-production-hybrid-refactor/package.json`
- Problem:
- React 18 vs React 19
- Vite 5 vs Vite 8
- older vs newer React plugin/lint stack
- mini-app-only dependency `class-variance-authority`
- Impact:
- A shared package now would either force version harmonization or carry unstable compatibility work.

### E12. Existing host preview logic would conflict with a second renderer if boundaries stay fuzzy
- Host files:
- `my-app/src/components/SectionEditor.tsx`
- `my-app/src/components/cv-editor/BlockRenderer.tsx`
- `my-app/src/components/cv-display/*`
- Problem:
- The host already contains current preview rules, fallback logic, and mixed render responsibilities.
- Impact:
- Without a dedicated renderer boundary, the app will accumulate duplicate render rules and drift.

### E13. Some renderer differences are legitimate and should stay renderer-specific
- Renderer files:
- `dasti-production-hybrid-refactor/src/pages/resume/ResumePage.tsx`
- Problem:
- Robial hides `Availability` from header metadata.
- One-column mode derives header meta from contact/portfolio only.
- Achievements render only in one-column mode.
- Impact:
- These are intentional layout behaviors, not bugs, but they must be documented so they are not "fixed" accidentally.

### E14. Font preset breadth is larger in the mini-app than in the host app
- Host file:
- `my-app/index.html`
- Mini-app files:
- `dasti-production-hybrid-refactor/src/styles/base.css`
- `dasti-production-hybrid-refactor/src/app/providers/theme-catalogs.ts`
- Problem:
- Host loads `Source Sans 3`, `Fraunces`, `Source Serif 4`, `IBM Plex Mono`.
- Mini-app theme presets also reference `Cormorant`, `Syne`, `Bricolage`.
- Impact:
- Renderer core can ship first; theme-lab preset parity comes later.

### E15. Source has extra section types with no renderer slot yet
- Source file:
- `my-app/src/types/cvDocument.ts`
- Problem:
- `text`, `certifications`, and `contact` sections exist in source.
- Renderer model has no equivalent output zones yet.
- Impact:
- The integration plan must define omit/fallback/extension rules explicitly.

## 9. Gravite de chaque ecart

### Critique
- `E01` No shared canonical contract between builder and renderer.
- `E03` `projects` is not structurally renderable as-is.
- `E06` Style contract drift between host `StyleForge` and mini-app renderer/theme system.
- `E07` Theme scope mismatch.

### Moyenne
- `E02` Semantic collision on `title`.
- `E04` Rich text flattening.
- `E05` Levels and buckets partly lost.
- `E08` Tailwind/token vocabulary mismatch.
- `E09` `StyleForge` not wired to live builder data.
- `E10` Mini-app shell duplicates host responsibilities.
- `E11` Dependency and toolchain alignment not ready for package extraction.
- `E12` Existing host preview logic would conflict with a second renderer if boundaries stay fuzzy.
- `E15` Extra source section types have no renderer slot yet.

### Mineure
- `E13` Some renderer differences are legitimate and should remain renderer-specific.
- `E14` Font preset breadth is larger in the mini-app than in the host app.

## 10. Risque de regression
- High risk if the mini-app is copied wholesale and mounted as a package or sub-app.
- High risk if `ThemeProvider` is mounted at host root.
- High risk if current `StyleForge` state is mapped implicitly to renderer variants.
- Medium risk if `ResumePage` is integrated without first defining `projects` and extra-section fallback rules.
- Low-to-medium risk if the renderer is first mounted as a passive read-only preview behind a new adapter and a local CSS scope.
- Lowest risk path:
- keep current builder/editor unchanged
- add renderer as read-only secondary surface
- delay style-lab wiring until after adapter coverage and renderer snapshot tests exist

## 11. Plan de migration par etapes

### Etape 1. Freeze the source master
- Keep `CvDocument` as the only authoring source.
- Do not let `ResumeData` or any renderer model be persisted as canonical data.
- Do now.
- Safe because it changes boundaries, not behavior.

### Etape 2. Introduce a renderer-only contract inside `my-app`
- Add a new internal type such as `ResumeRenderModel`.
- Add `mapCvDocumentToResumeRenderModel(doc, preset)` as the single official adapter.
- Add tests covering:
- empty/missing sections
- date formatting
- responsibilities -> bullets
- projects fallback
- extra section omission rules
- Do now.
- Safe because it is additive.

### Etape 3. Port only the pure renderer feature
- Port `ResumePage.tsx`, `resume-layout.spec.ts`, and `resume-preview.css`.
- Keep them under a feature folder in `my-app`.
- Do not port `ShowcasePage`, `ThemeLabPanel`, or UI kit yet.
- Do now.
- Safe because it keeps the blast radius limited to renderer assets.

### Etape 4. Add a renderer-scoped token bridge
- Create a scoped CSS bridge so renderer tokens such as `--color-*`, `--font-*`, and `--radius-*` resolve inside the renderer container.
- Do not replace the host app token system globally.
- Do now.
- Safe because scoping prevents app-shell regressions.

### Etape 5. Mount the renderer in passive mode
- Add a preview route, panel, or toggle where the renderer consumes the adapter output from `currentCv`.
- Keep the current editor and existing preview behavior unchanged for the first pass.
- Do now.
- Safe because it introduces observability before replacement.

### Etape 6. Replace `StyleForge` sample data with live renderer data
- Remove hardcoded sample identity and sections from `StyleForge`.
- Feed it from `currentCv` through the new adapter.
- Keep current control labels initially, but translate them explicitly.
- Do later, after adapter and renderer stability.
- Safe because the renderer is already integrated by then.

### Etape 7. Normalize missing section contracts
- Decide how `projects`, `certifications`, `contact`, and generic `text` sections should render.
- Prefer localized adapter rules first.
- Only add new canonical structured section models if product value is clear.
- Do later.

### Etape 8. Delete obsolete duplications
- Once the new renderer is stable, reduce overlapping preview logic in `cv-display/*` only where safe.
- Do not perform a broad refactor before the new path is validated.
- Do later.

## 12. Correctifs minimaux recommandes

### Now
- Add a renderer adapter layer.
- Port the pure resume renderer only.
- Add a scoped renderer token bridge.
- Add adapter and render tests.
- Keep current builder/editor output intact.

### Later
- Wire `StyleForge` to live data.
- Translate or redesign style controls to match the renderer contract.
- Decide whether `projects` becomes a structured canonical section.
- Remove duplicate preview logic only after validation.

### Changes explicitly not recommended now
- Global shared UI package.
- Workspace/monorepo restructuring.
- Replacing `CvDocument` with `ResumeData`.
- Mounting the mini-app `ThemeProvider` around the whole host app.
- Creating a catch-all `shared/common` folder without clear boundaries.

## 13. Patchs proposes fichier par fichier

### New files to add in `my-app`
- `src/features/cv-renderer/types/resume-render-model.ts`
- Why: renderer-specific contract separated from canonical `CvDocument`.
- Safe: additive, no runtime replacement.

- `src/features/cv-renderer/adapters/map-cv-document-to-resume-render-model.ts`
- Why: single source for source -> renderer mapping.
- Safe: keeps source master intact.

- `src/features/cv-renderer/adapters/map-styleforge-to-render-preset.ts`
- Why: explicit translation between current style control state and renderer presets.
- Safe: isolates the contract drift instead of hiding it.
- Later, not now.

- `src/features/cv-renderer/components/ResumePage.tsx`
- Why: port pure renderer component from mini-app.
- Safe: isolated feature surface.

- `src/features/cv-renderer/config/resume-layout.spec.ts`
- Why: renderer-specific layout definitions belong with the renderer.
- Safe: pure data.

- `src/features/cv-renderer/styles/resume-preview.css`
- Why: keep renderer CSS local instead of polluting host globals.
- Safe: scoped import.

- `src/features/cv-renderer/styles/document-theme-bridge.css`
- Why: bridge host tokens to renderer token names inside a scoped wrapper.
- Safe: avoids global theme collisions.

- `src/features/cv-renderer/__tests__/map-cv-document-to-resume-render-model.test.ts`
- Why: protects contract mapping and fallback rules.
- Safe: additive.

- `src/features/cv-renderer/__tests__/ResumePage.render.test.tsx`
- Why: catches silent layout/data regressions.
- Safe: additive.

### Existing host files to update later
- `src/pages/StyleForge.tsx`
- Why: replace hardcoded sample data with `currentCv` + adapter.
- Safe only after the new renderer exists.

- `src/pages/CvForge.tsx`
- Why: optional preview integration point for passive renderer mode.
- Safe if added as a separate panel/toggle rather than replacing current editor.

- `src/styles/globals.css`
- Why: ideally no global change; if touched, keep it minimal and only for genuinely reusable aliases.
- Preferred alternative: avoid touching this file and use a renderer-scoped bridge CSS.

- `package.json`
- Why: no change required if only the pure renderer is ported.
- Add mini-app UI-kit dependencies only if you later import that shell deliberately.

## 14. Points de validation apres integration
- The active authoring source is still `CvDocument`.
- No renderer-only object is persisted as canonical state.
- The renderer can render from `currentCv` without sample data.
- The renderer does not change the host shell theme unexpectedly.
- Current `/cv` editing behavior remains unchanged.
- Rich text flattening rules are explicit and test-covered.
- `projects` either renders through an explicit fallback or is intentionally omitted with a documented rule.
- Style controls do not silently mis-map `swiss/two-column/editorial` to incompatible renderer variants.
- Host app still builds with React 18 and existing Vite/Tailwind setup.
- Existing output is not regressed before the new renderer is explicitly enabled.

## Recommended architecture in one sentence
- Integrate the standalone renderer into `my-app` as a feature module with an explicit adapter and a scoped token bridge; do not promote renderer data, theme runtime, or showcase UI into shared global authority.
