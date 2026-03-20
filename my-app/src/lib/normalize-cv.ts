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
import type { CvDocument, CvSection, CvBlock, IExperienceItem, IEducationItem, ISkillItem, ILanguageItem, IAchievementItem } from "../types/cvDocument";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import { docToPlainText } from "../components/remirror-editor/utils/text";
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

function compactCvTitlePart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact : undefined;
}

function isLikelyFileNameTitle(value: string | undefined): boolean {
  if (!value) return false;
  return /\.[A-Za-z0-9]{2,6}$/.test(value);
}

export function isPlaceholderCvTitle(value: unknown): boolean {
  const compact = compactCvTitlePart(value);
  if (!compact) return false;
  return /^untitled cv(?:\b|$)/i.test(compact) || /^imported cv(?:\b|$)/i.test(compact);
}

function readProfileIdentityForTitle(sections: CvSection[]): {
  name?: string;
  desiredPosition?: string;
  email?: string;
} {
  const profileSection = sections.find((section) => String(section?.type) === "profile");
  const profileItem = Array.isArray(profileSection?.structuredContent)
    ? (profileSection!.structuredContent?.[0] as Record<string, unknown> | undefined)
    : undefined;

  return {
    name: compactCvTitlePart(profileItem?.name),
    desiredPosition: compactCvTitlePart(profileItem?.desiredPosition),
    email: compactCvTitlePart(profileItem?.email),
  };
}

export function deriveCvTitleCandidateFromSections(
  sections: CvSection[],
): string | undefined {
  const { name, desiredPosition, email } = readProfileIdentityForTitle(sections);
  return (
    (name && desiredPosition ? `${name} — ${desiredPosition}` : undefined) ??
    name ??
    desiredPosition ??
    email
  );
}

export function deriveCvTitleFromSections(
  sections: CvSection[],
  fallbackTitle?: string
): string {
  const derived = deriveCvTitleCandidateFromSections(sections);
  const meaningfulFallback = compactCvTitlePart(fallbackTitle);
  const fallback =
    meaningfulFallback && !isPlaceholderCvTitle(meaningfulFallback) && !isLikelyFileNameTitle(meaningfulFallback)
      ? meaningfulFallback
      : undefined;

  return derived ?? fallback ?? "Imported CV";
}

export function resolveCvTitle(
  explicitTitle: unknown,
  sections: CvSection[],
  fallbackTitle?: string
): string {
  const compactExplicit = compactCvTitlePart(explicitTitle);
  if (compactExplicit && !isPlaceholderCvTitle(compactExplicit)) {
    return compactExplicit;
  }
  return deriveCvTitleFromSections(sections, fallbackTitle);
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

const normalizeWhitespace = (text: string | null | undefined): string =>
  String(text ?? "").replace(/\s+/g, " " ).trim();

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

  const responsibilitiesRaw = entry?.responsibilities;
  let responsibilities: string | null = null;
  if (Array.isArray(responsibilitiesRaw)) {
    const joined = responsibilitiesRaw
      .map((value: unknown) => (typeof value === "string" ? value : ""))
      .filter((value) => value.trim().length > 0)
      .join(" ");
    const normalized = normalizeWhitespace(joined);
    responsibilities = normalized ? normalized : null;
  } else if (typeof responsibilitiesRaw === "string") {
    const normalized = normalizeWhitespace(responsibilitiesRaw);
    responsibilities = normalized ? normalized : null;
  } else if (responsibilitiesRaw && typeof responsibilitiesRaw === "object") {
    try {
      const docText = docToPlainText(responsibilitiesRaw as any);
      const normalized = normalizeWhitespace(docText);
      responsibilities = normalized ? normalized : null;
    } catch {
      responsibilities = null;
    }
  }

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
    responsibilities: responsibilities ?? undefined,
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
 
/** Normalize skill item; ensure id and default bucket */
function normalizeSkillItem(entry: any, idx: number): ISkillItem {
  const id =
    typeof entry?.id === "string" && entry.id.trim().length > 0
      ? String(entry.id)
      : `sk-${uuidv4()}-${idx}`;
  const name = typeof entry?.name === "string" ? entry.name : String(entry ?? "");
  const allowedLevels = new Set(["Beginner","Elementary","Intermediate","Advanced","Fluent"]);
  const levelRaw = (entry as any)?.level;
  const level: ISkillItem["level"] = allowedLevels.has(String(levelRaw)) ? (levelRaw as ISkillItem["level"]) : "Intermediate";
  const bucketRaw = (entry as any)?.bucket;
  const allowedBuckets = new Set(["core","secondary","familiar"]);
  const bucket = allowedBuckets.has(String(bucketRaw)) ? (bucketRaw as "core" | "secondary" | "familiar") : "secondary";
  return { id, name, level, bucket };
}

/** Normalize language item; ensure id and default level */
function normalizeLanguageItem(entry: any, idx: number): ILanguageItem {
  const id =
    typeof entry?.id === "string" && entry.id.trim().length > 0
      ? String(entry.id)
      : `lang-${uuidv4()}-${idx}`;
  const name = typeof entry?.name === "string" ? entry.name : String(entry ?? "");
  const allowedLevels = new Set(["Beginner","Elementary","Intermediate","Advanced","Fluent"]);
  const levelRaw = (entry as any)?.level;
  const level: ILanguageItem["level"] = allowedLevels.has(String(levelRaw)) ? (levelRaw as ILanguageItem["level"]) : "Intermediate";
  return { id, name, level };
}

/** Normalize achievement item; convert legacy strings/objects to { id, text } */
function normalizeAchievementItem(entry: any, idx: number): IAchievementItem {
  const rawId =
    typeof (entry as any)?.id === "string" && (entry as any).id.trim().length > 0
      ? String((entry as any).id)
      : `ach-${uuidv4()}-${idx}`;
  const text =
    typeof entry === "string"
      ? entry
      : typeof (entry as any)?.text === "string"
      ? (entry as any).text
      : typeof (entry as any)?.achievement === "string"
      ? (entry as any).achievement
      : String(entry ?? "");
  return { id: rawId, text: String(text ?? "").trim() };
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
          let derivedTitle: string;
          if (secType === "experience") {
            const company = String(item?.company ?? "").trim();
            const position = String(item?.position ?? "").trim();
            const location = String(item?.location ?? "").trim();
            // Skip synthesizing a block when both company and position are empty (headerless entry)
            if (!company && !position) {
              return;
            }
            const base = company && position ? `${position} at ${company}` : (position || company);
            derivedTitle = location ? `${base} — ${location}` : base;
          } else {
            derivedTitle = String(item?.institution ?? item?.degree ?? `Education ${idx + 1}`);
          }

          let derivedContent = ensureRemirrorDoc(undefined);
          if (secType === "experience") {
            const resp = item?.responsibilities;
            if (typeof resp !== "undefined") {
              derivedContent = ensureRemirrorDoc(resp as any);
            }
            // Append achievements[] as bullet paragraphs after responsibilities/description
            try {
              const achList: string[] = Array.isArray((item as any)?.achievements)
                ? ((item as any).achievements as unknown[]).map((a) => String(a)).filter((t) => t.trim().length > 0)
                : [];
              if (achList.length > 0) {
                const baseDoc: any = ensureRemirrorDoc(derivedContent as any);
                const existingContent: any[] = Array.isArray((baseDoc as any)?.content)
                  ? ((baseDoc as any).content as any[])
                  : [];
                const spacer: any[] = existingContent.length > 0 ? [{ type: "paragraph" }] : [];
                const achParagraphs: any[] = achList.map((t) => ({
                  type: "paragraph",
                  content: [{ type: "text", text: `• ${t}` }],
                }));
                derivedContent = {
                  ...(baseDoc as any),
                  content: [...existingContent, ...spacer, ...achParagraphs],
                };
              }
            } catch {
              // best-effort only; if merging fails, keep responsibilities-only content
            }
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

      // Achievements: ensure a representative block per structured item (title=text)
      if (hasStructured && secType === "achievements") {
        const items: Array<Record<string, any>> = Array.isArray((s as any).structuredContent)
          ? ((s as any).structuredContent as Array<Record<string, any>>)
          : [];
        const ensureBlocksCopy = () => {
          if (blocks === originalBlocks) {
            blocks = [...originalBlocks];
          }
        };
        items.forEach((item, idx) => {
          const itemId = typeof item?.id === "string" && item.id.trim().length > 0 ? String(item.id) : undefined;
          const text = String(item?.text ?? "").trim();
          const title = text || `Achievement ${idx + 1}`;
          const newBlock: CvBlock = CvBlockSchemaStrict.parse({
            id: uuidv4(),
            title,
            type: "text",
            content: ensureRemirrorDoc(text),
            attributes: itemId ? { linkedStructuredId: itemId } : undefined,
          });
          ensureBlocksCopy();
          blocks.push(newBlock);
          blocksChanged = true;
        });
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
      } else if (secType === "skills") {
        // Normalize skills; support legacy string[] by coercing to { id, name, level, bucket }
        const raw = s?.structuredContent as unknown;
        if (Array.isArray(raw)) {
          structuredContent = raw.map((it, idx) => normalizeSkillItem(it, idx));
        } else if (raw && typeof raw === "object") {
          structuredContent = [normalizeSkillItem(raw, 0)];
        } else {
          const tmpl = templateByType.get(secType);
          if (Array.isArray(tmpl?.structuredContent)) {
            structuredContent = (tmpl!.structuredContent as any[]).map((it, idx) => normalizeSkillItem(it, idx));
          } else {
            structuredContent = [];
          }
        }
      } else if (secType === "languages") {
        // Normalize languages; support legacy string[] by coercing to { id, name, level }
        const raw = s?.structuredContent as unknown;
        if (Array.isArray(raw)) {
          structuredContent = raw.map((it, idx) => normalizeLanguageItem(it, idx));
        } else if (raw && typeof raw === "object") {
          structuredContent = [normalizeLanguageItem(raw, 0)];
        } else {
          const tmpl = templateByType.get(secType);
          if (Array.isArray(tmpl?.structuredContent)) {
            structuredContent = (tmpl!.structuredContent as any[]).map((it, idx) => normalizeLanguageItem(it, idx));
          } else {
            structuredContent = [];
          }
        }
      } else if (secType === "achievements") {
        // Normalize achievements; migrate legacy string[] to structured { id, text }[]
        const raw = s?.structuredContent as unknown;
        if (Array.isArray(raw)) {
          structuredContent = raw.map((it, idx) => normalizeAchievementItem(it, idx));
        } else if (raw && typeof raw === "object") {
          structuredContent = [normalizeAchievementItem(raw, 0)];
        } else {
          const tmpl = templateByType.get(secType);
          if (Array.isArray(tmpl?.structuredContent)) {
            structuredContent = (tmpl!.structuredContent as any[]).map((it, idx) => normalizeAchievementItem(it, idx));
          } else {
            structuredContent = [];
          }
        }
      }

      // Summary section: ensure structured summary exists and is a valid Remirror doc.
      // Do NOT synthesize text blocks here to avoid duplicate render paths; the UI renders from structuredContent.
      if (secType === "summary") {
        // Ensure structured array exists with at least one item
        if (!Array.isArray(structuredContent) || (structuredContent as any[]).length === 0) {
          structuredContent = [normalizeSummaryItem({}, 0)];
        }
        // Ensure the first structured item has a valid Remirror JSON doc for summary
        try {
          const arr = (structuredContent as any[]) as Array<Record<string, unknown>>;
          const first = (arr[0] ?? {}) as Record<string, unknown>;
          const rawSummary = (first as any).summary as import("remirror").RemirrorJSON | string | null | undefined;
          const safeSummary = ensureRemirrorDoc(rawSummary);
          arr[0] = { ...first, summary: safeSummary };
          structuredContent = arr as unknown as typeof structuredContent;
        } catch {
          // best-effort; leave as-is if coercion fails
        }
        // Leave 'blocks' unchanged (no representative blocks synthesized for summary).
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

    // Ensure essential template sections exist (exclude optional extras like projects/certifications/achievements/languages)
    // achievements and languages are opt-in: users add them explicitly; we must NOT auto-inject them
    // into a document that doesn't already contain them (e.g. the V1 minimal 5-section skeleton).
    const finalTypes = new Set(sections.map((s) => s.type));
    const OPTIONAL_EXTRAS = new Set(["projects", "certifications", "achievements", "languages"]);
    for (const tmpl of template.sections) {
      if (OPTIONAL_EXTRAS.has(String(tmpl.type))) continue;
      if (!finalTypes.has(tmpl.type)) sections.push(CvSectionSchemaStrict.parse(tmpl));
    }

    // Build candidate CV document
    const candidate = {
      id: docId,
      title: resolveCvTitle((loose as any).title, sections, titleFallback),
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
