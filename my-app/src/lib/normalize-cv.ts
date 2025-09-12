import { z } from "zod";
import {
  safeParseCvDocument,
  parseCvDocumentStrict,
  CvBlockSchemaStrict,
  IExperienceItemSchema as ExperienceItemSchema,
  IEducationItemSchema as EducationItemSchema,
  SummaryItemSchema,
  CvSectionSchemaStrict,
} from "../schemas/cvDocument.schema";
import type { CvDocument, CvSection, CvBlock, IExperienceItem, IEducationItem } from "../types/cvDocument";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import { v4 as uuidv4 } from "uuid";
import { generateCvTemplate } from "./cv-template";

/* -------------------------------------------------------------------------- */
/* Result Types                                                               */
/* -------------------------------------------------------------------------- */
export interface INormalizeResultSuccess {
  success: true;
  document: CvDocument;
}
export interface INormalizeResultFailure {
  success: false;
  errors: string[];
}
export type INormalizeResult = INormalizeResultSuccess | INormalizeResultFailure;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Parse flexible date inputs and preserve precision.
 * Accepts: YYYY, YYYY-MM, YYYY-MM-DD (or any Date.parse-able string as day precision).
 * Returns an ISO string normalized to UTC midnight and a precision tag.
 */
function parseFlexibleDate(
  raw: unknown
): { iso?: string; precision?: "year" | "month" | "day" } {
  if (typeof raw !== "string") return { iso: undefined, precision: undefined };
  const s = raw.trim();
  if (!s) return { iso: undefined, precision: undefined };

  // Year-only
  const y = s.match(/^(\d{4})$/);
  if (y) {
    const year = Number(y[1]);
    const iso = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
    return { iso, precision: "year" };
  }

  // Month-year
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]); // 01..12
    const iso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    return { iso, precision: "month" };
  }

  // Full date (or other parsable variants) -> treat as day precision
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    // Normalize to UTC midnight, preserving calendar day as entered (best effort)
    const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
    return { iso, precision: "day" };
  }
  return { iso: undefined, precision: undefined };
}

/** Backwards-compatible helper kept for callers expecting a simple ISO string. */
function sanitizeDate(raw: unknown): string | undefined {
  const { iso } = parseFlexibleDate(raw);
  return iso;
}

/** Generate a unique ID with fallback prefix */
function generateId(prefix: string, idx?: number) {
  return idx !== undefined ? `${prefix}-${uuidv4()}-${idx}` : `${prefix}-${uuidv4()}`;
}

/** Normalize a single block into schema-compliant CvBlock */
function normalizeBlock(b: any, bi: number): CvBlock {
  const blkId = typeof b?.id === "string" && b.id.trim() ? String(b.id) : generateId("blk", bi);
  const blkType = typeof b?.type === "string" ? b.type : "text";
  const rawContent = b?.content;
  const content =
    typeof rawContent === "string"
      ? ensureRemirrorDoc(rawContent)
      : rawContent
      ? rawContent
      : ensureRemirrorDoc(undefined);

  const plainText = typeof b?.plainText === "string" ? b.plainText : undefined;
  const titleFromPlain =
    typeof plainText === "string" && plainText.trim().length > 0
      ? plainText.trim().slice(0, 64)
      : undefined;
  const blkTitle =
    typeof b?.title === "string" && b.title.trim().length > 0
      ? b.title.trim()
      : titleFromPlain ?? `Block ${bi + 1}`;

  const rawBlock = {
    id: blkId,
    type: blkType,
    content,
    plainText,
    order: typeof b?.order === "number" ? b.order : bi,
    attributes: b?.attributes ?? undefined,
    title: blkTitle,
  };

  return CvBlockSchemaStrict.parse(rawBlock);
}

/** Normalize structured content for experience section */
function normalizeExperienceItem(entry: any, idx: number): IExperienceItem {
  // Use epoch sentinel to satisfy strict schema while rendering blank in UI.
  const EPOCH = "1970-01-01T00:00:00.000Z";

  // Prefer already-provided precision fields (from AI mapping) and only parse when missing.
  const providedStartPrecision = (entry?.startDatePrecision ?? undefined) as
    | "year"
    | "month"
    | "day"
    | undefined;
  const providedEndPrecision = (entry?.endDatePrecision ?? undefined) as
    | "year"
    | "month"
    | "day"
    | undefined;

  const startParsed = providedStartPrecision
    ? // Compose ISO from parts if a raw startDate string is provided; otherwise reuse as-is.
      parseFlexibleDate(entry?.startDate)
    : parseFlexibleDate(entry?.startDate);

  // Handle explicit empty-string endDate as "unknown end with same precision as start" (no Present inference)
  const rawEnd: unknown = entry?.endDate;
  const endIsEmptyString = typeof rawEnd === "string" && rawEnd.trim() === "";
  const endParsed = endIsEmptyString ? { iso: undefined, precision: undefined } : parseFlexibleDate(rawEnd);

  // Do not infer "current" from empty endDate. Only respect explicit flags.
  const isCurrent = Boolean(entry?.isCurrent) || Boolean(entry?.currentlyWorking) ? true : false;

  // Compute final precision values with precedence: provided -> parsed -> fallback for explicit empty end
  const startDatePrecision = providedStartPrecision ?? startParsed.precision;
  const endDatePrecision = isCurrent
    ? undefined
    : providedEndPrecision ?? (endIsEmptyString ? startDatePrecision : endParsed.precision);

  const base = {
    id: typeof entry?.id === "string" ? entry.id : generateId("exp", idx),
    company: typeof entry?.company === "string" ? entry.company : "",
    position: typeof entry?.position === "string" ? entry.position : "",
    startDate: startParsed.iso ?? EPOCH,
    startDatePrecision,
    endDate: isCurrent ? null : (endParsed.iso ?? null),
    endDatePrecision,
    isCurrent: isCurrent ? true : undefined,
    // Keep back-compat flag if present
    currentlyWorking: entry?.currentlyWorking ? true : undefined,
    location: typeof entry?.location === "string" ? entry.location : "",
    responsibilities: entry?.responsibilities ?? undefined,
    achievements: Array.isArray(entry?.achievements) ? entry.achievements.map(String) : [],
  };
  return ExperienceItemSchema.parse(base);
}

/** Normalize structured content for education section */
function normalizeEducationItem(entry: any, idx: number): IEducationItem {
  const providedStartPrecision = (entry?.startDatePrecision ?? undefined) as
    | "year"
    | "month"
    | "day"
    | undefined;
  const providedEndPrecision = (entry?.endDatePrecision ?? undefined) as
    | "year"
    | "month"
    | "day"
    | undefined;

  const startParsed = parseFlexibleDate(entry?.startDate);
  const rawEnd: unknown = entry?.endDate;
  const endIsEmptyString = typeof rawEnd === "string" && rawEnd.trim() === "";
  const endParsed = endIsEmptyString ? { iso: undefined, precision: undefined } : parseFlexibleDate(rawEnd);

  const isCurrent = Boolean(entry?.isCurrent) || Boolean(entry?.currentlyWorking) ? true : false;

  const startDatePrecision = providedStartPrecision ?? startParsed.precision;
  const endDatePrecision = isCurrent
    ? undefined
    : providedEndPrecision ?? (endIsEmptyString ? startDatePrecision : endParsed.precision);

  const base = {
    id: typeof entry?.id === "string" ? entry.id : generateId("edu", idx),
    institution: typeof entry?.institution === "string" ? entry.institution : "",
    degree: typeof entry?.degree === "string" ? entry.degree : "",
    fieldOfStudy: typeof entry?.fieldOfStudy === "string" ? entry.fieldOfStudy : "",
    startDate: startParsed.iso,
    startDatePrecision,
    endDate: isCurrent ? null : endParsed.iso,
    endDatePrecision,
    isCurrent: isCurrent ? true : undefined,
    grade: typeof entry?.grade === "string" ? entry.grade : "",
    description: entry?.description ?? undefined,
  };
  return EducationItemSchema.parse(base);
}

/** Normalize summary structured content; ensure stable id */
function normalizeSummaryItem(entry: any, idx = 0): z.infer<typeof SummaryItemSchema> {
  const base = SummaryItemSchema.parse(entry ?? {});
  const id =
    typeof (base as any)?.id === "string" && String((base as any).id).trim()
      ? String((base as any).id)
      : generateId("sum", idx);
  return { ...(base as any), id } as unknown as z.infer<typeof SummaryItemSchema>;
}

/* -------------------------------------------------------------------------- */
/* Model-layer helper: ensure representative blocks                           */
/* -------------------------------------------------------------------------- */

/**
 * Ensure representative blocks exist for typed sections (experience/education),
 * and convert legacy section.content into a single text block when a section has
 * no blocks and no structuredContent.
 *
 * Rules:
 * - Preserve all existing blocks and their order.
 * - For each structured item in experience/education:
 *   - If a block already exists with attributes.linkedStructuredId == item.id, do not duplicate.
 *   - Otherwise append a new "text" block at the end with:
 *       id: uuidv4()
 *       title: experience -> company || position || "Experience N"
 *              education  -> institution || degree || "Education N"
 *       content: responsibilities/description -> ensureRemirrorDoc(value)
 *                else empty paragraph ensureRemirrorDoc(undefined)
 *       attributes.linkedStructuredId = item.id (only if item.id is present)
 * - If section has legacy `content` but no `blocks` and no `structuredContent`,
 *   convert that `content` to a single "text" block titled section.title || "Block 1".
 *
 * The function is pure; it does not mutate the input document/sections/blocks.
 */
export function ensureRepresentativeBlocks(cv: CvDocument): CvDocument {
  try {
    if (!cv || !Array.isArray(cv.sections)) return cv;

    const nextSections: CvSection[] = cv.sections.map((s) => {
      const secType = String((s as any)?.type ?? "text").toLowerCase().trim();
      const hasStructured = Array.isArray((s as any)?.structuredContent);

      const originalBlocks: CvBlock[] = Array.isArray(s.blocks) ? s.blocks : [];
      let blocks: CvBlock[] = originalBlocks; // preserve reference unless we actually change
      let blocksChanged = false;

      // Legacy: convert section.content -> single block when no blocks and no structured
      const hasLegacyContent = (s as any).content !== undefined && (s as any).content !== null;
      if ((originalBlocks.length === 0) && !hasStructured && hasLegacyContent) {
        blocks = [
          CvBlockSchemaStrict.parse({
            id: uuidv4(),
            type: "text",
            title: (s as any).title ?? "Block 1",
            content: ensureRemirrorDoc((s as any).content),
          }),
        ];
        blocksChanged = true;
      }

      // Experience/Education: ensure a representative block per structured item
      if (hasStructured && (secType === "experience" || secType === "education")) {
        // Collect existing linked ids from blocks to avoid duplication
        const existingLinked = new Set<string>();
        for (const b of originalBlocks) {
          const linked =
            (b as any)?.attributes?.linkedStructuredId ??
            (b as any)?.attributes?.linkedstructuredid;
          if (typeof linked === "string" && linked.trim().length > 0) existingLinked.add(String(linked));
        }

        // Helper to detect an "empty" Remirror doc (single empty paragraph or no content)
        const isEmptyDoc = (doc: any): boolean => {
          try {
            if (!doc || typeof doc !== "object") return true;
            const c = (doc as any).content;
            if (!Array.isArray(c) || c.length === 0) return true;
            if (c.length === 1 && c[0]?.type === "paragraph") {
              const p = c[0];
              const t = p?.content;
              if (!Array.isArray(t) || t.length === 0) return true;
              if (t.length === 1 && t[0]?.type === "text" && String(t[0]?.text ?? "").trim() === "") return true;
            }
            return false;
          } catch {
            return false;
          }
        };

        const items: Array<Record<string, any>> = Array.isArray((s as any).structuredContent)
          ? ((s as any).structuredContent as Array<Record<string, any>>)
          : [];

        // Track indices of candidate unlinked blocks we can repurpose to avoid duplication
        const unlinkedIdxs: number[] = [];
        originalBlocks.forEach((b, i) => {
          const linked =
            (b as any)?.attributes?.linkedStructuredId ??
            (b as any)?.attributes?.linkedstructuredid;
          if (!(typeof linked === "string" && linked.trim().length > 0)) {
            unlinkedIdxs.push(i);
          }
        });

        // Prepare a working copy only when we mutate
        const ensureBlocksCopy = () => {
          if (blocks === originalBlocks) {
            blocks = [...originalBlocks];
          }
        };

        items.forEach((item, idx) => {
          const itemId = typeof item?.id === "string" && item.id.trim().length > 0 ? String(item.id) : undefined;
          if (itemId && existingLinked.has(itemId)) return; // already represented

          // Derive preferred title and content from structured item
          const derivedTitle =
            secType === "experience"
              ? String(item?.company ?? item?.position ?? `Experience ${idx + 1}`)
              : String(item?.institution ?? item?.degree ?? `Education ${idx + 1}`);

          let derivedContent = ensureRemirrorDoc(undefined);
          if (secType === "experience") {
            const resp = item?.responsibilities;
            if (typeof resp !== "undefined") derivedContent = ensureRemirrorDoc(resp as any);
          } else if (secType === "education") {
            const desc = item?.description;
            if (typeof desc !== "undefined") derivedContent = ensureRemirrorDoc(desc as any);
          }

          // Try to repurpose an existing unlinked block for this item
          let repurposed = false;
          if (unlinkedIdxs.length > 0) {
            // Only repurpose when there is a clear title match to avoid hijacking user free-form blocks.
            let matchIdx = -1;
            for (const i of unlinkedIdxs) {
              const b = originalBlocks[i] as any;
              const bt = String(b?.title ?? "");
              if (bt && bt === derivedTitle) {
                matchIdx = i;
                break;
              }
            }

            if (matchIdx >= 0) {
              const candidate = originalBlocks[matchIdx] as any;
              const nextAttributes = { ...(candidate?.attributes ?? {}), ...(itemId ? { linkedStructuredId: itemId } : {}) };
              const nextTitle =
                typeof candidate?.title === "string" && candidate.title.trim().length > 0
                  ? candidate.title
                  : derivedTitle;
              const nextContent = isEmptyDoc(candidate?.content) ? derivedContent : candidate.content;

              const titleChanged = nextTitle !== candidate?.title;
              const contentChanged = JSON.stringify(nextContent) !== JSON.stringify(candidate?.content);
              const attrsChanged = JSON.stringify(nextAttributes) !== JSON.stringify(candidate?.attributes ?? undefined);

              if (titleChanged || contentChanged || attrsChanged) {
                ensureBlocksCopy();
                blocks[matchIdx] = CvBlockSchemaStrict.parse({
                  ...(candidate as any),
                  attributes: nextAttributes,
                  title: nextTitle,
                  content: nextContent,
                  type: "text",
                });
                blocksChanged = true;
              }

              // remove from unlinked pool and mark as linked
              const poolIdx = unlinkedIdxs.indexOf(matchIdx);
              if (poolIdx >= 0) unlinkedIdxs.splice(poolIdx, 1);
              if (itemId) existingLinked.add(itemId);
              repurposed = true;
            }
          }

          if (!repurposed) {
            // Append a new representative block
            const newBlock: CvBlock = CvBlockSchemaStrict.parse({
              id: uuidv4(),
              title: derivedTitle,
              type: "text",
              content: derivedContent,
              attributes: itemId ? { linkedStructuredId: itemId } : undefined,
            });
            ensureBlocksCopy();
            blocks.push(newBlock);
            blocksChanged = true;
            if (itemId) existingLinked.add(itemId);
          }
        });

        // After creating/repurposing representative blocks, prune any extraneous linked blocks:
        // - Keep unlinked blocks as-is
        // - For linked blocks, keep only the first block per valid structured id
        // - Drop blocks linked to unknown/removed structured ids
        try {
          const validIds = new Set<string>(
            items
              .map((it) => (typeof it?.id === "string" ? it.id : undefined))
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          );
          const seen = new Set<string>();
          const pruned: CvBlock[] = [];
          for (const b of blocks) {
            const linked =
              (b as any)?.attributes?.linkedStructuredId ??
              (b as any)?.attributes?.linkedstructuredid;
            if (typeof linked === "string" && linked.trim().length > 0) {
              if (!validIds.has(linked)) {
                // linked to a non-existent structured id -> drop
                blocksChanged = true;
                continue;
              }
              if (seen.has(linked)) {
                // duplicate representative block for same structured id -> drop
                blocksChanged = true;
                continue;
              }
              seen.add(linked);
              pruned.push(b);
            } else {
              pruned.push(b);
            }
          }
          if (pruned.length !== blocks.length) {
            blocks = pruned;
            blocksChanged = true;
          }
        } catch {
          // ignore pruning errors; keep current blocks
        }
      }

      // If nothing changed, reuse the original section reference (structural sharing)
      if (!blocksChanged) {
        return s;
      }

      return CvSectionSchemaStrict.parse({
        ...(s as any),
        blocks,
      });
    });

    // If none of the sections changed by reference, return the original document reference
    const anyChanged = nextSections.some((ns, i) => ns !== cv.sections[i]);
    if (!anyChanged) return cv;

    return { ...(cv as any), sections: nextSections } as CvDocument;
  } catch {
    return cv;
  }
}

/* -------------------------------------------------------------------------- */
/* Main normalization function                                                 */
/* -------------------------------------------------------------------------- */
export function normalizeAndValidateCvDocument(
  input: unknown,
  titleFallback?: string
): INormalizeResult {
  const safe = safeParseCvDocument(input);
  // safeParseCvDocument returns { ok: true; value } | { ok: false; error }
  const loose = safe.ok ? (safe.value as any) : (typeof input === "object" && input ? (input as any) : {});

  try {
    const now = new Date().toISOString();
    const docId =
      typeof (loose as any).id === "string" && (loose as any).id.trim() ? (loose as any).id : generateId("cv");

    // Metadata
    const meta = (loose as any).metadata ?? {};
    const metadata = {
      createdAt: String(meta.createdAt ?? now),
      updatedAt: String(meta.updatedAt ?? now),
      version: typeof meta.version === "number" ? meta.version : 1,
      locale: typeof meta.locale === "string" ? meta.locale : undefined,
      authorId: typeof meta.authorId === "string" ? meta.authorId : undefined,
      lastEditedBy: typeof meta.lastEditedBy === "string" ? meta.lastEditedBy : undefined,
    };

    // Canonical template
    const template = generateCvTemplate(titleFallback ?? (loose as any).title ?? undefined);
    const incomingSections = Array.isArray((loose as any).sections) ? (loose as any).sections : [];

    const templateByType = new Map<string, CvSection>();
    for (const s of template.sections) templateByType.set(String(s.type), s);

    function coerceSectionType(raw: unknown) {
      const t = typeof raw === "string" ? raw : "";
      return templateByType.has(t) ? t : "text";
    }

    const sections: CvSection[] = incomingSections.map((s: any, si: number) => {
      const secId = typeof s?.id === "string" && s.id.trim() ? String(s.id) : generateId("sec", si);
      const secTitle =
        typeof s?.title === "string" && s.title.trim() ? s.title.trim() : template.sections[si]?.title ?? `Section ${si + 1}`;
      const secType = coerceSectionType(s?.type);

      // Normalize blocks
      const blocksInput = Array.isArray(s?.blocks) ? s.blocks : [];
      let blocks: CvBlock[] = blocksInput.map(normalizeBlock);

      // Fill missing blocks from template except for "summary" (summary uses a structured UI, not blocks)
      // IMPORTANT: If the incoming section already provides structuredContent, do NOT seed template blocks.
      // Representative blocks for typed sections will be synthesized later by ensureRepresentativeBlocks.
      const hasStructuredOnInput =
        Array.isArray(s?.structuredContent)
          ? (s.structuredContent as any[]).length > 0
          : Boolean(s?.structuredContent);
      if (blocks.length === 0 && templateByType.has(secType) && secType !== "summary" && !hasStructuredOnInput) {
        const tmpl = templateByType.get(secType);
        if (tmpl?.blocks) {
          blocks.push(
            ...tmpl.blocks.map((tb, idx) =>
              CvBlockSchemaStrict.parse({
                ...tb,
                id: generateId("blk", idx),
                content: tb.content ?? ensureRemirrorDoc(undefined),
              })
            )
          );
        }
      }

      // Normalize structuredContent
      let structuredContent = s?.structuredContent ?? undefined;

      // Always normalize Experience/Education items to preserve date precision and Present semantics
      if (secType === "experience" || secType === "education") {
        const raw = s?.structuredContent as unknown;
        if (Array.isArray(raw)) {
          structuredContent =
            secType === "experience"
              ? raw.map((it, idx) => normalizeExperienceItem(it, idx))
              : raw.map((it, idx) => normalizeEducationItem(it, idx));
        } else if (raw && typeof raw === "object") {
          structuredContent =
            secType === "experience"
              ? [normalizeExperienceItem(raw, 0)]
              : [normalizeEducationItem(raw, 0)];
        } else {
          const tmpl = templateByType.get(secType);
          if (tmpl?.structuredContent) {
            structuredContent =
              secType === "experience"
                ? (tmpl.structuredContent as any[]).map(normalizeExperienceItem)
                : (tmpl.structuredContent as any[]).map(normalizeEducationItem);
          } else {
            // Provide skeleton if none
            structuredContent =
              secType === "experience"
                ? [normalizeExperienceItem({}, 0)]
                : [normalizeEducationItem({}, 0)];
          }
        }
      } else if (secType === "summary") {
        // Coerce summary structured content into an array and ensure ids
        const raw = s?.structuredContent as unknown;
        if (Array.isArray(raw)) {
          structuredContent = raw.map((it, idx) => normalizeSummaryItem(it, idx));
        } else if (raw && typeof raw === "object") {
          structuredContent = [normalizeSummaryItem(raw, 0)];
        } else {
          const tmpl = templateByType.get(secType);
          if (Array.isArray(tmpl?.structuredContent)) {
            structuredContent = (tmpl!.structuredContent as any[]).map((it, idx) => normalizeSummaryItem(it, idx));
          } else {
            structuredContent = [normalizeSummaryItem({}, 0)];
          }
        }
      }

      // Summary section: synthesize a representative block when structuredContent is present but blocks are missing.
      if (secType === "summary" && blocks.length === 0) {
        const arr = Array.isArray(structuredContent) ? (structuredContent as any[]) : [];
        if (arr.length > 0) {
          const first = arr[0] ?? {};
          const linkedId = String((first as any)?.id ?? (first as any)?._id ?? "");
          const content = ensureRemirrorDoc((first as any)?.summary ?? undefined);
          blocks.push(
            CvBlockSchemaStrict.parse({
              id: generateId("blk", 0),
              title: "Summary",
              type: "text",
              content,
              attributes: linkedId ? { linkedStructuredId: linkedId } : undefined,
            })
          );
        }
      }

      return CvSectionSchemaStrict.parse({
        id: secId,
        title: secTitle,
        type: secType,
        blocks,
        structuredContent,
        collapsed: typeof s?.collapsed === "boolean" ? s.collapsed : false,
        order: typeof s?.order === "number" ? s.order : si,
      });
    });

    // Ensure template sections exist
    const finalTypes = new Set(sections.map((s) => s.type));
    for (const tmpl of template.sections) {
      if (!finalTypes.has(tmpl.type)) sections.push(CvSectionSchemaStrict.parse(tmpl));
    }

    // Build candidate CV document
    const candidate = {
      id: docId,
      title: typeof (loose as any).title === "string" && (loose as any).title.trim() ? (loose as any).title.trim() : titleFallback ?? "Imported CV",
      metadata,
      sections,
      tags: Array.isArray((loose as any).tags) ? (loose as any).tags.map(String) : undefined,
      summary: (loose as any).summary ?? undefined,
    };

    const strict = parseCvDocumentStrict(candidate);
    const withReps = ensureRepresentativeBlocks(strict as unknown as CvDocument);
    return { success: true, document: withReps };
  } catch (err) {
    const out: string[] = [];
    if (err instanceof z.ZodError) {
      out.push(...err.errors.map((e) => `${e.path.join(".") || "<root>"}: ${e.message}`));
    } else if (err instanceof Error) {
      out.push(err.message);
    } else {
      out.push("Unknown error validating CV document");
    }
    return { success: false, errors: out };
  }
}
