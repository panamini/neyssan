Detective report: Why Summary / Education not showing the "small-card + popup inspector" UX and how to fix it

Summary (TL;DR)

Root cause: SectionEditor short-circuits rendering for summary and skills sections (returns an alternate UI) and therefore does not render the block-based UI (the compact small-card + Edit details popup driven by BlockRenderer + SelectedBlockInspector). Education should be in the block-based path, but can still appear different if blocks are missing or not linked to structuredContent. Concrete fix: render the section.blocks via BlockRenderer inside the summary and skills UI (or move responsibility to SummaryBlock/SkillsBlock to render BlockRenderer). Also add/ensure conversion/normalization produces linked blocks for typed sections when structuredContent exists but blocks are absent.
I provide exact file/line references and minimal code patches to make summary/education behave like experience.
Key evidence (exact code anchors)
SectionEditor short-circuits for summary and skills:

Summary branch early return: my-app/src/components/SectionEditor.tsx — the file returns the summary-only UI and does not fall through to the block-based rendering used for experience/education. See excerpt:

if (sectionType === "summary") {
  return (
    <div className="...">
      ...
      {!collapsed && (
        <div className="p-4">
          <SummaryBlock
            section={section}
            onChange={(updatedSection) => {
              onChange(index, updatedSection as any);
            }}
            onContentChange={onContentChange}
          />
        </div>
      )}
    </div>
  );
}

tsx


(See: my-app/src/components/SectionEditor.tsx)

Skills branch same pattern (no BlockRenderer rendering): my-app/src/components/SectionEditor.tsx. Excerpt:

if (sectionType === "skills") {
  return (
    <div className="...">
      ...
      {!collapsed && (
        <div className="p-4">
          <SkillsBlock
            section={section}
            onChange={(updatedSection) => {
              onChange(index, updatedSection as any);
            }}
          />
        </div>
      )}
    </div>
  );
}

tsx


(See: my-app/src/components/SectionEditor.tsx)

Experience/education branch uses block-based rendering (compact cards + inspector):

SectionEditor has block-based path for experience/education and renders BlockRenderer for each block: [my-app/src/components/SectionEditor.tsx](my-app/src/components/SectionEditor.tsx:450 and 544-548). Excerpt:

if (Array.isArray(structured) && (sectionType === "experience" || sectionType === "education")) {
  ...
  return (
    ...
      {!collapsed && (
        <div className="p-4 space-y-4">
          {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
            section.blocks.map((block) => (
              <div key={String(block.id)} className="p-0">
                <BlockRenderer sectionId={String(section.id)} block={block as any} />
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-neutral-500">No entries</div>
          )}
          ...
        </div>
      )}
    ...
  );
}

tsx



(See: my-app/src/components/SectionEditor.tsx)

BlockRenderer shows compact card + "Edit details" when the CvBlock has attributes.linkedStructuredId and the section contains the matching structured item:

BlockRenderer finds linkedStructuredId and looks up the linked item in the section structuredContent; then renders the compact card and opens SelectedBlockInspector on Edit:

const linkedStructuredId =
  (block as any)?.attributes?.linkedStructuredId ??
  (block as any)?.attributes?.linkedstructuredid;

const section = currentCv?.sections?.find((s) => String(s.id) === String(sectionId));

const linkedItem = section && Array.isArray(section.structuredContent)
  ? section.structuredContent.find((it) => String(it.id) === String(linkedStructuredId))
  : null;
...
{linkedItem ? (
  <div className="p-3 ...">
    /* compact card UI (Company/Institution/Name etc) */
    <button onClick={() => setInspectorOpen(true)}>Edit details</button>
  </div>
) : null}
...
{inspectorOpen && linkedItem ? (
  <SelectedBlockInspector sectionId={sectionId} block={block} linkedStructured={linkedItem} onClose={() => setInspectorOpen(false)} />
) : null}

tsx



(See: [my-app/src/components/cv-editor/BlockRenderer.tsx](my-app/src/components/cv-editor/BlockRenderer.tsx:89-103, 106-138, 264-271))

remirrorJSONToSections creates per-field blocks for summary, education and experience, and sets attributes.linkedStructuredId for those blocks:

Summary conversion creating blocks (fields + summary block): my-app/src/components/remirror-editor/utils/conversion.ts. Excerpt:

// Summary -> structured.flatMap -> for each item:
const fields = ['name','email','linkedin','address'] as const;
const fieldBlocks = fields.map((field) => ({ id: `blk-${id}-${idx}-${field}`, title: ..., type: 'text', content: ensureRemirrorDoc(fieldValue), attributes: { linkedStructuredId: itemLinkedId } }));
const summaryBlk = { id: `blk-${id}-${idx}-summary`, title: 'Summary', ..., attributes: { linkedStructuredId: itemLinkedId } };
return [...fieldBlocks, summaryBlk];

ts


(See: my-app/src/components/remirror-editor/utils/conversion.ts)

CvLibraryContext exposes the necessary operations used by BlockRenderer / SelectedBlockInspector:

updateBlockContent / updateBlockTitle / updateStructuredItem / addBlock / registerFlushCallback are implemented and exported by the context: see declarations and implementations in [my-app/src/contexts/CvLibraryContext.tsx](my-app/src/contexts/CvLibraryContext.tsx:41-55 and implementations at 576-591, 594-609, 617-631, 633-681, 161-166). Example exports and functions:

export interface ICvLibraryContext {
  updateBlockContent: (sectionId: string, blockId: string, newContent: RemirrorJSON) => void;
  updateBlockTitle: (sectionId: string, blockId: string, newTitle: string) => void;
  addBlock: (sectionId: string, block: CvBlock, index?: number) => void;
  updateStructuredItem: (sectionId: string, itemId: string, patch: Partial<Record<string, any>>) => void;
  registerFlushCallback: (cb: () => void) => () => void;
  ...
}

ts


and implementations: [my-app/src/contexts/CvLibraryContext.tsx](my-app/src/contexts/CvLibraryContext.tsx:576, 594, 617, 633, 161).
(See: my-app/src/contexts/CvLibraryContext.tsx, my-app/src/contexts/CvLibraryContext.tsx)

File-by-file concise behavior summary (exports, usage, guards)
my-app/src/components/SectionEditor.tsx

Exports: default export function SectionEditor(props).
Props: full controlled SectionEditorProps including onChange(index, updatedSection), onContentChange, collapsed, onCollapseChange, etc. (lines 16-27).
Behavior:
Renders three distinct flows:
summary -> returns a dedicated SummaryBlock editing UI (early return) (lines 368-406).
skills -> returns a dedicated SkillsBlock editing UI (early return) (lines 410-447).
experience/education -> renders block-based UI using BlockRenderer for each block, and a small list view for structuredContent (lines 450-582, 544-549, 555-577).
For general text sections (fallback), it renders the full Remirror editor (lines 585-747).
Guards/early returns: returns early for summary and skills (does not render BlockRenderer there).
Cross-check: imports SummaryBlock and SkillsBlock as named imports (lines 9-11): my-app/src/components/SectionEditor.tsx. These match the exported named functions in the structured-blocks files.
my-app/src/components/structured-blocks/SummaryBlock.tsx

Exports: named export export function SummaryBlock(...) (line 23).
Props: SummaryBlockProps { section: CvSection; onChange: (updatedSection: CvSection) => void; onContentChange?: ... } (lines 17-21).
Behavior:
Presents inputs for name, email, linkedin, address, a textarea for summary (plain text), and a Save button.
On Save:
Converts summaryPlain -> Remirror JSON (buildRemirrorDocFromText).
Builds or reuses per-field blocks for name/email/linkedin/address and a summary block, each with attributes.linkedStructuredId (createOrUpdateFieldBlock and summaryBlock) (lines 80-95 and 131-138).
Builds updated structuredContent with the first structured item replaced/created (lines 142-146).
Calls onContentChange(sectionId, summaryDoc) first (line 115-121), then calls onChange(updatedSection) (line 153-155).
Renders BlockRenderer/Inspector? No — SummaryBlock does not render BlockRenderer or SelectedBlockInspector internally; it only manipulates the section object and emits it via onChange.
Guard: sets firstStructured to first structuredContent item if present (lines 25-28) and uses that as the item to edit.
my-app/src/components/structured-blocks/SkillsBlock.tsx

Exports: named export export function SkillsBlock(...) (line 16).
Props: { section: CvSection; onChange: (updatedSection: CvSection) => void }.
Behavior: Inline editable chips, persists structuredContent as a string[] via onChange(updatedSection) (lines 45-48, 50-56). Does not render BlockRenderer.
Guard: if section.blocks present and contains content, tries to coerce initial skills from first block (lines 19-31).
my-app/src/components/cv-editor/BlockRenderer.tsx

Exports: named export export function BlockRenderer(...) and default export export default BlockRenderer; (line 21 and 276).
Props: { sectionId: string; block: CvBlock } (lines 16-19).
Behavior:
Uses useCvLibrary hooks updateBlockContent/updateBlockTitle/currentCv (line 22).
Looks up linkedStructuredId in block.attributes and finds linked item in currentCv.sections.structuredContent (lines 89-102).
If linkedItem exists, displays compact card information specific to section.type (experience/institution/summary etc) and shows an "Edit details" button that opens SelectedBlockInspector (lines 108-191).
Renders nested RemirrorEditor for the block content (line 228).
Opens SelectedBlockInspector (modal) when inspectorOpen, passing block and linkedStructured (line 265).
Guards: if linkedItem is not found, the compact card portion is omitted (the RemirrorEditor still shows under it). BlockRenderer expects block.attributes.linkedStructuredId and corresponding structuredContent item to get compact card + inspector.
my-app/src/components/SelectedBlockInspector.tsx

Exports: named export function SelectedBlockInspector and default export (line 22 and 248).
Props: { sectionId, block, linkedStructured, onClose } (lines 8-12).
Behavior:
Keeps a staged formState and pendingBlockContent, registers a flush callback using registerFlushCallback from useCvLibrary (lines 28-36, 61-79, 81-94).
doFlush patches the structured item via updateStructuredItem and persists block content via updateBlockContent (lines 61-79).
Renders a dialog (modal) with inputs for experience/education fields and a RemirrorEditor for block content; Save triggers doFlush + close (lines 118-241).
Guards: if registerFlushCallback present, registers flush and returns the unregister function.
my-app/src/components/remirror-editor/utils/conversion.ts

Exports: multiple conversion functions including remirrorJSONToSections and ensureRemirrorDoc (lines 225-559 and 573-650).
Behavior:
remirrorJSONToSections turns a document containing cvSection nodes into Section objects; for typed sections (experience, education, summary, skills, achievements) it creates structuredContent entries and per-item blocks with attributes.linkedStructuredId (experience: lines 249-323 & blocks created 283-313; education: lines 326-395 & blocks 355-385; summary: lines 397-458 & blocks 420-447; skills: 460-496 & blocks 474-486).
ensureRemirrorDoc returns an editor-ready Remirror doc from string or doc shapes (lines 573-650).
Evidence: conversion creates blocks that BlockRenderer depends on (see summary/education blocks created with attributes.linkedStructuredId).
my-app/src/lib/normalize-cv.ts

Exports: normalizeAndValidateCvDocument which:
Starts from a canonical template (generateCvTemplate) (line 55).
Ensures typed sections (experience/education) get structuredContent skeletons when missing (lines 121-185).
If blocks are missing, it clones template scaffold blocks for that section type (lines 106-118).
Effect: normalize should ensure that created CVs have blocks for typed sections if the template had them.
my-app/src/lib/cv-template.ts

Exports generateCvTemplate which:
For Summary: creates a single block for summary blocks (lines 120-126) but sets structuredContent: null (line 123-125).
For Experience/Education: creates representative blocks and structuredContent with initial item(s) (experienceBlocks & educationBlocks have attributes.linkedStructuredId set) (lines 95-115).
Important: The summary section in the template uses blocks but structuredContent is null by default; SummaryBlock is the UI that creates structuredContent/field blocks on Save.
my-app/src/contexts/CvLibraryContext.tsx

Exports: CvLibraryProvider and useCvLibrary hook. Provides the operations BlockRenderer/Inspector use (updateBlockContent, updateStructuredItem, addBlock, registerFlushCallback, flushPendingEdits, etc.) (lines 41-55, implementations throughout lines 576, 617, 633).
Behavior: On addSection it will auto-generate blocks for structuredContent if present and blocks missing (lines 721-778). On createNewCv it uses generateCvTemplate (line 476).
Cross-check SectionEditor imports and prop shapes
Imports in SectionEditor:
SummaryBlock and SkillsBlock are imported as named exports:

import { SummaryBlock } from "./structured-blocks/SummaryBlock";
import { SkillsBlock } from "./structured-blocks/SkillsBlock";

ts


(See my-app/src/components/SectionEditor.tsx)

These match the exported signatures in their files:

SummaryBlock => export function SummaryBlock({ section, onChange, onContentChange }: SummaryBlockProps) (See my-app/src/components/structured-blocks/SummaryBlock.tsx)
SkillsBlock => export function SkillsBlock({ section, onChange }: { section: CvSection; onChange: (updatedSection: CvSection) => void }) (See my-app/src/components/structured-blocks/SkillsBlock.tsx)
SectionEditor passes matching props:

SummaryBlock receives section, onChange(updatedSection) -> onChange(index, updatedSection), and onContentChange (lines 392-402).
SkillsBlock receives section, onChange(updatedSection) -> onChange(index, updatedSection) (lines 434-443).
Conclusion: No import/export name mismatch or prop shape mismatch is present — the invocation shapes match the component signatures.

Diagnosis: likely runtime causes (ordered by probability)
Primary cause (highest probability): SectionEditor deliberately renders a separate UI for summary & skills and returns early (lines 368-406 and 410-446). That UI does not render the BlockRenderer list, so even when SummaryBlock builds blocks and structuredContent on Save, the "small card + popup" block rendering (BlockRenderer) is not part of the summary UI path and will not appear in SectionEditor for summary. Evidence: my-app/src/components/SectionEditor.tsx and my-app/src/components/SectionEditor.tsx.

Secondary cause (education-specific): The block-based UI for experience/education in SectionEditor expects section.blocks to exist and to include blocks with attributes.linkedStructuredId (BlockRenderer checks block.attributes.linkedStructuredId and uses section.structuredContent to find linkedItem). If a CV's education section lacks blocks or has blocks without attributes.linkedStructuredId, BlockRenderer will not show the compact card/inspector UI. Evidence:

BlockRenderer reads attributes.linkedStructuredId (lines 89-101) and only renders compact card if linkedItem is found (lines 108-191).
SectionEditor renders "No entries" when section.blocks is missing/empty (lines 544-552).
remirrorJSONToSections generates such blocks when conversion is used (lines 355-385 for education), but if the current CV state lacks these blocks (imported shape, or normalization didn't create them for some reason), the BlockRenderer won't show the small-card style for education.
Tertiary causes (lower probability but worth checking):

CSS / display confusion: The small-card UI markup is present but hidden by CSS. Less likely because experience shows correctly; same CSS applies.
Dev server cache / stale build: If you updated SectionEditor but the dev server didn't rebuild, you could see old behavior. Check by restarting dev server and clearing browser cache (see QA below).
A race/flush issue: the SummaryBlock calls onContentChange then onChange(updatedSection) — if parent updates did not trigger SectionEditor re-render quickly enough, the blocks may be present in state but SectionEditor remains the summary UI; still the early return prevents BlockRenderer rendering anyway.
Concrete remediation steps and exact code-level fixes (minimal edits) Goal: Make summary (and optionally skills) show the same small-card + popup UX as experience/education by rendering BlockRenderer for summary blocks (and skills blocks) the same way experience does. Also ensure education always gets representative blocks if structuredContent exists.
A. Minimal fix (recommended): Render section.blocks via BlockRenderer inside the Summary and Skills UI branches in SectionEditor.

File to edit: my-app/src/components/SectionEditor.tsx
Change: inside the summary branch (after SummaryBlock) and inside the skills branch (after SkillsBlock) render the same block list as the experience branch uses.
Patch suggestion (conceptual; apply this into SectionEditor near the Summary and Skills JSX):

For summary branch, replace the inner JSX or augment it. Example snippet to add under the existing <SummaryBlock ... />:
{/* Render regular blocks for summary so each field/summary block shows as small card + inspector */}
<div className="space-y-2 mt-4">
  {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
    section.blocks.map((b: any) => (
      <div key={String(b.id)}>
        <BlockRenderer sectionId={String(section.id)} block={b as any} />
      </div>
    ))
  ) : (
    <div className="p-3 text-sm text-neutral-500">No entries</div>
  )}
</div>

tsx


Insert location: inside the summary branch where SummaryBlock is currently rendered; specifically after line ~392 in my-app/src/components/SectionEditor.tsx.
Rationale: This reuses BlockRenderer which already shows compact cards when the block has linkedStructuredId and shows the SelectedBlockInspector.
For skills branch do the same (insert below the SkillsBlock render block). Example insertion after line ~434 in my-app/src/components/SectionEditor.tsx:
{/* Render blocks for skills (some skill lists may be stored as blocks) */}
<div className="space-y-2 mt-4">
  {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
    section.blocks.map((b: any) => (
      <div key={String(b.id)}>
        <BlockRenderer sectionId={String(section.id)} block={b as any} />
      </div>
    ))
  ) : null}
</div>

tsx


Optional tweak for SummaryBlock behavior: Ensure SummaryBlock's Save results in blocks with attributes.linkedStructuredId (it already does — see [my-app/src/components/structured-blocks/SummaryBlock.tsx](my-app/src/components/structured-blocks/SummaryBlock.tsx:131-138, 140-151)). No change needed in SummaryBlock.
B. Secondary fix (if education still fails because block generation was missing): ensure normalization generates blocks for typed sections when structuredContent exists but blocks missing. There are two places to consider:

The conversion path already generates blocks for structured items (remirrorJSONToSections creates per-item blocks with attributes; see [my-app/src/components/remirror-editor/utils/conversion.ts](my-app/src/components/remirror-editor/utils/conversion.ts:283-313 & 373-383 & 420-446)). So if education imported from Remirror doc should have blocks.

But for other imports / runtime patching, ensure normalizeAndValidateCvDocument clones template blocks into sections when blocks are empty. That logic exists (lines 106-118), but you might want to also populate blocks when structuredContent present but blocks empty. In normalizeAndValidateCvDocument, after it builds structuredContent for experience/education, add code to create blocks mapping to structuredContent (same approach as remirrorJSONToSections). Minimal change:

In my-app/src/lib/normalize-cv.ts after structuredContent is prepared, if blocks.length === 0 and structuredContent exists, produce blocks per structured item similar to addSection() logic in CvLibraryContext (lines 739-777) or the cv-template approach. Example snippet (conceptual):
// after structuredContent ready and blocks array === 0
if (blocks.length === 0 && Array.isArray(structuredContent) && structuredContent.length > 0) {
  const generatedBlocks = (structuredContent as any[]).map((item, idx) => {
    const blockId = `blk-${secId}-${idx}-0`;
    let content = ensureRemirrorDoc(undefined as any);
    if (secType === "experience" && item.responsibilities) content = typeof item.responsibilities === "string" ? ensureRemirrorDoc(item.responsibilities) : item.responsibilities;
    if (secType === "education" && item.description) content = typeof item.description === "string" ? ensureRemirrorDoc(item.description) : item.description;
    const title = secType === "experience" ? (item.company || `Experience ${idx+1}`) : secType === "education" ? (item.institution || `Education ${idx+1}`) : (title || `Block ${idx+1}`);
    return { id: blockId, title, type: "text", content, attributes: { linkedStructuredId: item.id } };
  });
  blocks.push(...generatedBlocks);
}

ts



Insert location: near where sections are constructed in normalizeAndValidateCvDocument (after blocks creation / template clone block handling around lines 106-118 and before returning the section object around lines 187-196).
C. Minimal alternative: Make SummaryBlock itself render the BlockRenderer list (less preferred)

Edit SummaryBlock.tsx to, after saving and/or on mount, render any summary-equivalent blocks via BlockRenderer (import BlockRenderer and map section.blocks). But I recommend changing SectionEditor (single place) rather than each structured block component.
QA checklist and reproduction steps
Manual QA checklist

 Start dev server and clear caches.
 Load a CV with a Summary section (use template or imported CV).
 Edit summary fields (name/email/summary) and Save in SummaryBlock.
 Verify that after Save the summary fields appear as small cards (BlockRenderer compact cards) and have an "Edit details" / "Edit" button.
 Click Edit details on a summary block — confirm SelectedBlockInspector modal opens and changes persist.
 Verify Education/Experience sections still show small-card + inspector behavior as before.
 Verify Skills section shows block-based entries (if blocks present) or still shows SkillsBlock UI plus blocks if generated.
Commands to reproduce & dev server instructions

From repo root:
Install / start dev server (project root uses my-app directory):
cd my-app
npm install # if dependencies changed
npm run dev # or yarn dev / pnpm dev depending on local setup
Browser:
Open the app URL (default Vite dev server, e.g. http://localhost:5173) and go to the CV editor (e.g., CvForge page).
Clear local storage keys if you want a fresh template:
Open DevTools > Application > Local Storage > remove keys:
cvDocuments
cv:<id> entries (prefix cv:). Alternatively run in console:
localStorage.removeItem('cvDocuments'); // remove index
Object.keys(localStorage).filter(k => k.startsWith('cv:')).forEach(k => localStorage.removeItem(k));
Hard reload the page (Ctrl+Shift+R / Cmd+Shift+R).
If old build is suspected, stop and restart dev server, and clear browser cache.
Summary of recommended immediate changes (one-line)
Edit my-app/src/components/SectionEditor.tsx to render the section.blocks via BlockRenderer inside the summary and skills branches (insert the BlockRenderer mapping shown above). This is the minimal change to make SummaryBlock-created blocks appear with the same small-card + popup UX as experience/education.
Appendix — Direct references to code lines (quick map)

Summary early-return / rendering: my-app/src/components/SectionEditor.tsx
Skills early-return / rendering: my-app/src/components/SectionEditor.tsx
Experience/education -> block-based rendering & BlockRenderer use: [my-app/src/components/SectionEditor.tsx](my-app/src/components/SectionEditor.tsx:450, 544-548, 555-577)
BlockRenderer: compact card + inspector control + RemirrorEditor: [my-app/src/components/cv-editor/BlockRenderer.tsx](my-app/src/components/cv-editor/BlockRenderer.tsx:89-103, 106-138, 228-262, 264-271)
SummaryBlock creates blocks (+ attributes.linkedStructuredId) and calls onContentChange then onChange(updatedSection): my-app/src/components/structured-blocks/SummaryBlock.tsx and block creation lines 80-95, 131-138
remirrorJSONToSections: summary/education block generation with attributes.linkedStructuredId: [my-app/src/components/remirror-editor/utils/conversion.ts](my-app/src/components/remirror-editor/utils/conversion.ts:398-447, 355-385)
CvLibraryContext functions used by BlockRenderer/Inspector: updateBlockContent, updateStructuredItem, addBlock, registerFlushCallback: [my-app/src/contexts/CvLibraryContext.tsx](my-app/src/contexts/CvLibraryContext.tsx:41-55, 576-591, 617-631, 633-681, 161-166)
If you want, I can now produce the exact patch (apply_diff) for SectionEditor to insert the BlockRenderer mappings into summary and skills branches (single surgical edit) or produce the normalize change in normalize-cv.ts. Provide confirmation to apply the patch and which of the two fixes you'd like applied first (SectionEditor render change is fastest and recommende