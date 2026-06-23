"use node";

/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, prefer-const -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* my-app/convex/actions/extractProfileStrict.ts */
import { action } from "../_generated/server";
import { v } from "convex/values";
import { parseCV } from "../lib/parsing/hybridParser";
import { mapParsedToStrict } from "../lib/parsing/strictProfileAdapter";
import { splitSections, type SectionBlock, type SectionType } from "../lib/parsing_shared/sectionSplitter";
import * as ProfileSchemaMod from "../lib/schemas/profileStrict.schema";
const StrictSchema = (ProfileSchemaMod as unknown as { StrictProfileSchema: import("zod").ZodTypeAny }).StrictProfileSchema;

interface ParsedSection {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
  sectionType?: SectionType;
  headingStart?: number;
  headingEnd?: number;
}

interface ParsedMetadata {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

interface ParsedCV {
  sections: ParsedSection[];
  metadata: ParsedMetadata | null;
  cv: unknown | null;
  method: "llm" | "heuristic" | string | null;
  warnings: string[];
}

function coerceParsedCV(input: unknown): ParsedCV {
  if (!input || typeof input !== "object") {
    return { sections: [], metadata: null, cv: null, method: null, warnings: [] };
  }
  const obj = input as Record<string, unknown>;

  const sectionsRaw = Array.isArray(obj.sections) ? (obj.sections as unknown[]) : [];
  const sections: ParsedSection[] = sectionsRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const x = s as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title : "";
      const content = typeof x.content === "string" ? x.content : "";
      const fieldKey = typeof x.fieldKey === "string" ? x.fieldKey : "";
      const confidence = Number.isFinite(x.confidence) ? Number(x.confidence) : 0;
      if (!title && !content && !fieldKey) return null;
      return { title, content, fieldKey, confidence };
    })
    .filter((x): x is ParsedSection => !!x);

  let metadata: ParsedMetadata | null = null;
  if (obj.metadata && typeof obj.metadata === "object") {
    const m = obj.metadata as Record<string, unknown>;
    metadata = {
      name: m.name == null ? null : String(m.name),
      email: m.email == null ? null : String(m.email),
      phone: m.phone == null ? null : String(m.phone),
      linkedinUrl: m.linkedinUrl == null ? null : String(m.linkedinUrl),
    };
  }

  const method = typeof obj.method === "string" ? obj.method : null;
  const cv = Object.prototype.hasOwnProperty.call(obj, "cv") ? (obj.cv as unknown) : null;
  const warnings =
    Array.isArray(obj.warnings) && (obj.warnings as unknown[]).every((w) => typeof w === "string")
      ? (obj.warnings as string[])
      : [];

  return { sections, metadata, cv, method, warnings };
}

/**
 * Convex public action to produce a strict profile from rawText.
 * Returns exactly the StrictProfile shape validated by Zod.
 *
 * Steps:
 * 1) parseCV with returnMappedCV + strip to preserve section fidelity.
 * 2) mapParsedToStrict to fuse LLM metadata and heuristics into strict profile.
 * 3) Validate via StrictProfileSchema.parse and return.
 */
type StrictOut = ReturnType<typeof mapParsedToStrict>;
type ExpItem = StrictOut["experience"][number];
export const extractProfileStrict = action({
  args: { rawText: v.string() },
  returns: v.any(),
  handler: async (_ctx, { rawText }) => {
    const sectionBlocks: SectionBlock[] = splitSections(rawText);
    const parsed0 = await parseCV(rawText, { returnMappedCV: true, mapperStrip: true });
    const parsed = coerceParsedCV(parsed0);

    const deterministicSections: ParsedSection[] = sectionBlocks.map((block) => ({
      title: block.heading,
      content: block.text,
      fieldKey: block.normalizedHeading,
      confidence: 0.6,
      sectionType: block.normalizedHeading,
      headingStart: block.start,
      headingEnd: block.end,
    }));

    const matchBlock = (section: ParsedSection): SectionBlock | undefined => {
      const titleKey = section.title?.trim().toUpperCase();
      if (titleKey) {
        const byTitle = sectionBlocks.find((b) => b.heading.trim().toUpperCase() === titleKey);
        if (byTitle) return byTitle;
      }
      const fieldKey = section.fieldKey?.trim().toLowerCase();
      if (fieldKey) {
        const byField = sectionBlocks.find((b) => b.normalizedHeading === fieldKey);
        if (byField) return byField;
      }
      return undefined;
    };

    const enrichedSections: ParsedSection[] = parsed.sections.map((section) => {
      const block = matchBlock(section);
      const normalized =
        block?.normalizedHeading ??
        HEADING_MAP_LOOKUP(section.title) ??
        NORMALIZE_FIELD_KEY(section.fieldKey) ??
        "unknown";
      return {
        ...section,
        sectionType: normalized,
        headingStart: block?.start,
        headingEnd: block?.end,
      };
    });

    const coveredBlocks = new Set<string>(enrichedSections.map((s) => s.sectionType ?? "unknown"));
    deterministicSections.forEach((section) => {
      const sectionKey = section.sectionType ?? "unknown";
      if (!coveredBlocks.has(sectionKey)) {
        coveredBlocks.add(sectionKey);
        enrichedSections.push({ ...section, sectionType: sectionKey });
      }
    });

    const finalSections = enrichedSections.length > 0 ? enrichedSections : deterministicSections;

    // NER enrichment (layout + skills + metadata) now happens inside parseCV().
    // We consume the result directly and pass through to strictProfileAdapter.
    const mappedCvCombined: unknown | null = parsed.cv;

    let strict = mapParsedToStrict({
      rawText,
      parsedSections: finalSections,
      metadata: parsed.metadata,
      mappedCv: mappedCvCombined,
    });

    // If LLM parsing failed (heuristic path), cap confidences to <= 0.6 as per acceptance.
    const cap = (n: number | null | undefined): number | null => {
      if (n == null) return null;
      const v = typeof n === "number" ? n : 0;
      return Math.min(0.6, Math.max(0, v));
    };

    const isHeuristic = parsed.method === "heuristic";
    if (isHeuristic) {
      const capped = {
        ...strict,
        confidences: {
          name: cap(strict.confidences?.name),
          email: cap(strict.confidences?.email),
          phone: cap(strict.confidences?.phone),
          location: cap(strict.confidences?.location),
        },
        experience: Array.isArray(strict.experience)
          ? strict.experience.map((it: ExpItem) => ({
              ...it,
              confidences: it.confidences
                ? {
                    company: cap(it.confidences.company),
                    position: cap(it.confidences.position),
                    startDate: cap(it.confidences.startDate),
                    endDate: cap(it.confidences.endDate),
                    isCurrent: cap(it.confidences.isCurrent),
                    achievements: cap(it.confidences.achievements),
                  }
                : it.confidences,
            }))
          : [],
      };
      return StrictSchema.parse(capped);
    }

    // Validate and return strict shape.
    return StrictSchema.parse(strict);
  },
});

function HEADING_MAP_LOOKUP(title: string): SectionType {
  const upper = title.trim().toUpperCase();
  switch (upper) {
    case "EXPERIENCE":
    case "WORK HISTORY":
      return "experience";
    case "EDUCATION":
      return "education";
    case "SKILLS":
      return "skills";
    case "PROJECTS":
      return "projects";
    case "CERTIFICATIONS":
      return "certifications";
    default:
      return "unknown";
  }
}

function NORMALIZE_FIELD_KEY(fieldKey: string | undefined): SectionType | undefined {
  if (!fieldKey) return undefined;
  const key = fieldKey.trim().toLowerCase();
  switch (key) {
    case "experience":
    case "work_experience":
    case "work":
      return "experience";
    case "education":
      return "education";
    case "skills":
      return "skills";
    case "projects":
      return "projects";
    case "certifications":
    case "certification":
      return "certifications";
    default:
      return undefined;
  }
}
