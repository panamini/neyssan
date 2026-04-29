// my-app/convex/lib/parsing/cvMapper.ts
import { z } from "zod";
import headingsConfig from "../../../../shared/headings.json";
import { extractContactFromText } from "./contactExtractor";
import { normalizeLanguagesFromText, normalizeLanguagesFromTextDetailed, joinNormalizedLanguages } from "./languageNormalizer";
import { migrateLanguagesToEducation } from "./normalize_cv";
import {
  isTemplateNoiseLine,
  isValidLocationCandidate,
  extractDateRange,
  parseExperienceHeader,
  classifyExperienceBullet,
  lineStartsWithOpsVerb,
  SECTION_TOKEN_RE,
  RangeConfidence,
  cleanToken,
} from "./mapping_utils";
import type { LayoutBlock } from "../parsing_shared/nerClient";

// pipeline-note: cvMapper owns section bucketing and fallback reconstruction
// for canonicalize.ts, hybridParser.ts, and strictProfileAdapter.ts. Any new
// heuristics for splitting experience/education should land here so they are
// shared across orchestrators.

export interface IParsedSection {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
  sourceSpan?: { start: number; end: number } | null;
}

export interface IParsedMetadata {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  // AI-first extensions (optional)
  desiredPosition?: string | null;
  phoneRaw?: string | null;
  phoneE164?: string | null;
  addressBlock?: string | null;
  addressNormalized?: string | null;
  confidences?: {
    name?: number | null;
    email?: number | null;
    phone?: number | null;
    desiredPosition?: number | null;
    addressNormalized?: number | null;
  } | null;
  spans?: {
    name?: { start: number; end: number } | null;
    email?: { start: number; end: number } | null;
    phone?: { start: number; end: number } | null;
    desiredPosition?: { start: number; end: number } | null;
    addressBlock?: { start: number; end: number } | null;
  } | null;
  raw?: string | null;
}

const sanitizeNameCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (/[=@]/.test(trimmed) || trimmed.includes("http")) return null;
  const tokens = trimmed.split(" ").filter(Boolean);
  if (tokens.length > 5) return null;
  return trimmed;
};

export interface ICVTextField {
  text: string;
  confidence: number;
}

export interface ICVArrayItem {
  content: string;
  confidence: number;
  title?: string;
  sourceSpan?: { start: number; end: number } | null;
}

export interface IExperienceDiagnostics {
  header_signals: {
    match: "date" | "title_at_org" | "org_only" | "none";
    titleFound: boolean;
    orgFound: boolean;
    locFound: boolean;
    dateFound: boolean;
  };
  date_range: {
    start?: string;
    end?: string | null;
    confidence: RangeConfidence | null;
  };
  counts: {
    responsibilities: number;
    achievements: number;
    droppedDuplicates: number;
  };
  summarySource: "original" | "synthesized_from_responsibilities" | null;
}

export interface IExperienceItem extends ICVArrayItem {
  company?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  dateConfidence?: RangeConfidence;
  responsibilities?: string[];
  responsibilityBullets?: string[];
  achievements?: string[];
  summary?: string | null;
  summarySource?: "original" | "synthesized_from_responsibilities" | null;
  diagnostics?: IExperienceDiagnostics;
}

export interface ICVObject {
  name?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    // AI-first extensions
    desiredPosition?: string | null;
    addressBlock?: string | null;
    addressNormalized?: string | null;
    phoneRaw?: string | null;
    phoneE164?: string | null;
    raw?: string | null;
  };
  summary?: ICVTextField | null;
  experience: IExperienceItem[];
  education: ICVArrayItem[];
  skills?: ICVTextField | null;
  // languages contains the canonicalized, display-friendly list
  languages?: ICVTextField | null;
  // languagesRaw preserves original tokens as they appeared in source sections
  languagesRaw?: string[] | null;
  achievements?: ICVTextField | null;
  projects: ICVArrayItem[];
  research: ICVArrayItem[];
  volunteer: ICVArrayItem[];
  references: ICVArrayItem[];
  other: ICVArrayItem[];
  raw?: string | null;
  // Preserve original unfiltered parsed sections for audit/debug
  rawSections?: IParsedSection[] | null;
}

function normalizeLinkedInUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  let s = String(u).trim();
  s = s.replace(/^[<"'\s]+|[>"'\s.,;:]+$/g, "");
  if (/^linkedin\.com/i.test(s)) s = "https://" + s;
  const match = /(?:https?:\/\/)?(?:www\.)?linkedin\.com(\/[^\s)]+)/i.exec(s);
  if (match && match[1]) {
    const path = match[1].replace(/\/+$/g, "");
    return `https://linkedin.com${path}`;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

const SectionArraySchema = z.array(
  z.object({
    title: z.string(),
    content: z.string(),
    fieldKey: z.string(),
    confidence: z.number().min(0).max(1),
    sourceSpan: z.any().optional().nullable(),
  })
);

export const mapSectionsToCVSchema = z.object({
  sections: SectionArraySchema,
  metadata: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      linkedinUrl: z.string().nullable().optional(),
      // AI-first optional extensions
      desiredPosition: z.string().nullable().optional(),
      phoneRaw: z.string().nullable().optional(),
      phoneE164: z.string().nullable().optional(),
      addressBlock: z.string().nullable().optional(),
      addressNormalized: z.string().nullable().optional(),
      confidences: z
        .object({
          name: z.number().min(0).max(1).nullable().optional(),
          email: z.number().min(0).max(1).nullable().optional(),
          phone: z.number().min(0).max(1).nullable().optional(),
          desiredPosition: z.number().min(0).max(1).nullable().optional(),
          addressNormalized: z.number().min(0).max(1).nullable().optional(),
        })
        .optional(),
      spans: z
        .object({
          name: z.object({ start: z.number(), end: z.number() }).optional(),
          email: z.object({ start: z.number(), end: z.number() }).optional(),
          phone: z.object({ start: z.number(), end: z.number() }).optional(),
          desiredPosition: z.object({ start: z.number(), end: z.number() }).optional(),
          addressBlock: z.object({ start: z.number(), end: z.number() }).optional(),
        })
        .optional(),
      raw: z.string().nullable().optional(),
    })
    .optional(),
});

// Map LLM fieldKey -> CV bucket (ICVObject key)
const FIELD_TO_BUCKET: Record<string, keyof ICVObject> = {
  introduction: "summary",
  summary: "summary",
  identity: "name",
  contact: "contact",
  experience: "experience",
  work_experience: "experience",
  education: "education",
  skills: "skills",
  languages: "languages",
  achievements: "achievements",
  awards: "achievements",
  projects: "projects",
  certifications: "other",
  hobbies: "other",
  affiliations: "other",
  additional_information: "other",
  research: "research",
  volunteer: "volunteer",
  references: "references",
  other: "other",
};

function averageConfidence(items: number[]) {
  if (items.length === 0) return 0;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

function concatTexts(items: string[], separator = "\n\n") {
  return items.filter(Boolean).join(separator).trim() || "";
}

function clipAchievementEntry(entry: string, maxChars = 280): string {
  const raw = String(entry ?? "").trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;

  const bulletMatch = /^[•*\-]/.exec(raw);
  const bullet = bulletMatch ? bulletMatch[0] : "";
  const startIndex = bullet ? bullet.length : 0;
  const remainder = raw.slice(startIndex).trimStart();
  const limit = Math.max(40, maxChars - (bullet ? bullet.length + 1 : 0));

  if (remainder.length <= limit) {
    return bullet ? `${bullet} ${remainder}`.trim() : remainder;
  }

  const slice = remainder.slice(0, limit);
  const terminalPunctuation = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf(".\n"),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf(";"),
  );
  const safeIdx = terminalPunctuation > 30 ? terminalPunctuation + 1 : slice.lastIndexOf(" ");
  const clipped = (safeIdx > 20 ? slice.slice(0, safeIdx) : slice).trimEnd();
  const suffix = clipped.endsWith(".") || clipped.endsWith("!") || clipped.endsWith("?") ? "" : "…";
  return bullet ? `${bullet} ${clipped}${suffix}`.trim() : `${clipped}${suffix}`;
}

function formatAchievements(entries: string[]): string[] {
  const normalized: string[] = [];
  for (const entry of entries) {
    const lines = String(entry ?? "")
      .split(/\r?\n+/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    if (!lines.length) continue;
    for (const line of lines) {
      const clipped = clipAchievementEntry(line);
      if (clipped) normalized.push(clipped);
    }
  }
  return normalized;
}

// Default behavior: strip link-only sections at mapping time unless explicitly disabled.
// Allow runtime override via options. Also allow build-time override with VITE_PARSER_STRIP_LINK_ONLY=false
export const DEFAULT_STRIP_LINK_ONLY: boolean =
  typeof process !== "undefined" && typeof (process as any).env !== "undefined"
    ? String((process as any).env.VITE_PARSER_STRIP_LINK_ONLY ?? "true").toLowerCase() !== "false"
    : true;

// Runtime toggle: allows tests and runtime callers (server/app) to change mapper behavior without rebuilding.
// By default, mirror DEFAULT_STRIP_LINK_ONLY. Export setter/getter so environment or admin UI can flip at runtime.
export let RUNTIME_STRIP_LINK_ONLY: boolean = DEFAULT_STRIP_LINK_ONLY;
export function setRuntimeStripLinkOnly(val: boolean) {
  RUNTIME_STRIP_LINK_ONLY = Boolean(val);
}
export function getRuntimeStripLinkOnly() {
  return RUNTIME_STRIP_LINK_ONLY;
}

interface HeadingDefinition {
  fieldKey: "summary" | "experience" | "education" | "skills" | "languages" | "achievements" | "projects" | "other";
  title: string;
  patterns: RegExp[];
}

type HeadingsConfig = Record<string, Record<string, string[]>>;
const MULTILINGUAL_HEADINGS = headingsConfig as HeadingsConfig;

const LEFT_COLUMN_NORM_THRESHOLD = 0.18;
const LEFT_COLUMN_WIDTH_RATIO_THRESHOLD = 0.55;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const headingValuesMap: Record<string, string[]> = Object.entries(MULTILINGUAL_HEADINGS).reduce(
  (acc, [fieldKey, locales]) => {
    const collected = new Map<string, string>();
    Object.values(locales).forEach((terms) => {
      terms.forEach((term) => {
        if (!term) return;
        const trimmed = term.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!collected.has(key)) {
          collected.set(key, trimmed);
        }
      });
    });
    acc[fieldKey] = Array.from(collected.values());
    return acc;
  },
  {} as Record<string, string[]>
);

function buildPatternsForHeadings(values: string[]): RegExp[] {
  const patterns: RegExp[] = [];
  values.forEach((value) => {
    const escaped = escapeRegex(value);
    patterns.push(new RegExp(`^${escaped}$`, "i"));
    patterns.push(new RegExp(`^${escaped}[\s:–—-].*`, "i"));
  });
  return patterns;
}

const HEADING_DEFS: HeadingDefinition[] = [
  {
    fieldKey: "summary",
    title: "Summary",
    patterns: [
      /^(profile|about|about me)$/i,
      /^(summary|professional summary|career summary)$/i,
      /^(objective|career objective)$/i,
      /^(biodata)$/i,
      /^(professional profile)$/i,
      ...buildPatternsForHeadings(headingValuesMap.summary ?? []),
    ],
  },
  ...(["experience", "education", "skills", "languages", "achievements"] as const).map((key) => ({
    fieldKey: key,
    title: key.charAt(0).toUpperCase() + key.slice(1),
    patterns: buildPatternsForHeadings(headingValuesMap[key] ?? []),
  })),
  {
    fieldKey: "projects",
    title: "Projects",
    patterns: [
      /^(projects|selected projects)$/i,
      /^(projects & research)$/i,
      ...buildPatternsForHeadings(headingValuesMap.projects ?? []),
    ],
  },
  {
    fieldKey: "other",
    title: "Certifications",
    patterns: buildPatternsForHeadings(headingValuesMap.certifications ?? []),
  },
  {
    fieldKey: "other",
    title: "Affiliations",
    patterns: buildPatternsForHeadings(headingValuesMap.affiliations ?? []),
  },
  {
    fieldKey: "other",
    title: "Hobbies",
    patterns: buildPatternsForHeadings(headingValuesMap.hobbies ?? []),
  },
  {
    fieldKey: "other",
    title: "Additional Information",
    patterns: buildPatternsForHeadings(headingValuesMap.additional_information ?? []),
  },
];

function matchHeading(raw?: string | null): HeadingDefinition | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  for (const def of HEADING_DEFS) {
    if (def.patterns.some((re) => re.test(text))) return def;
  }
  return null;
}

const DEFAULT_HEADING = HEADING_DEFS[0];

function isUpperHeading(text: string): boolean {
  if (!text) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length >= 0.8;
}

/**
 * Build sections from spaCy layout blocks (when available). This respects headings and page layout to prevent
 * left-column metadata (details/links) from leaking into summary/experience sections.
 */
export function buildSectionsFromLayout(rawText: string, layoutBlocks: LayoutBlock[]): IParsedSection[] {
  if (!Array.isArray(layoutBlocks) || layoutBlocks.length === 0) return [];

  const sorted = [...layoutBlocks].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 0;
    const bo = typeof b.order === "number" ? b.order : 0;
    return ao - bo;
  });

  const nonEmpty = sorted.filter((block) => typeof block?.text === "string" && block.text.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const geomCandidates = nonEmpty
    .map((block, idx) => ({ block, idx }))
    .filter(({ block }) => typeof block.x === "number" && typeof block.width === "number");

  const leftColumnIdx = new Set<number>();
  if (geomCandidates.length >= 2) {
    const xs = geomCandidates.map(({ block }) => block.x as number);
    const widths = geomCandidates.map(({ block }) => block.width as number);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const xSpan = Math.max(1, xMax - xMin);
    const sortedWidths = [...widths].sort((a, b) => a - b);
    const medianWidth = sortedWidths[Math.floor(sortedWidths.length / 2)] ?? 0;
    geomCandidates.forEach(({ block, idx }) => {
      const norm = ((block.x as number) - xMin) / xSpan;
      const narrow = medianWidth > 0 ? ((block.width as number) <= medianWidth * LEFT_COLUMN_WIDTH_RATIO_THRESHOLD) : false;
      if (norm <= LEFT_COLUMN_NORM_THRESHOLD || narrow) leftColumnIdx.add(idx);
    });
  }

  const primaryBlocks = nonEmpty.filter((_, idx) => !leftColumnIdx.has(idx));
  const usableBlocks = primaryBlocks.length > 0 ? primaryBlocks : nonEmpty;

  const sections: IParsedSection[] = [];
  let currentHeading: HeadingDefinition | null = null;
  let buffer: string[] = [];
  let bufferStart: number | null = null;
  let bufferEnd: number | null = null;

  const flush = () => {
    if (!currentHeading || buffer.length === 0) {
      buffer = [];
      bufferStart = null;
      bufferEnd = null;
      return;
    }
    const content = buffer.join("\n\n").trim();
    if (!content) {
      buffer = [];
      bufferStart = null;
      bufferEnd = null;
      return;
    }
    sections.push({
      title: currentHeading.title,
      fieldKey: currentHeading.fieldKey,
      content,
      confidence: currentHeading.fieldKey === "summary" ? 0.92 : 0.88,
      sourceSpan: bufferStart !== null && bufferEnd !== null ? { start: bufferStart, end: bufferEnd } : undefined,
    });
    buffer = [];
    bufferStart = null;
    bufferEnd = null;
  };

  for (const block of usableBlocks) {
    let blockText = String(block.text ?? "").replace(/\u00a0/g, " ").trim();
    if (!blockText) continue;

    const labelHeading = matchHeading(block.heading ?? block.label ?? undefined);
    let lines = blockText.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
    // Noise filtering per Prompt 4
    lines = lines.filter((l) => !isTemplateNoiseLine(l));
    const firstLine = lines[0] ?? "";
    const firstLineHeading = matchHeading(firstLine);
    const uppercaseHeading = isUpperHeading(firstLine) ? matchHeading(firstLine) : null;
    const colonTrimmed = /:\s*$/.test(firstLine) ? firstLine.replace(/:\s*$/, "") : null;
    const colonHeading = colonTrimmed ? matchHeading(colonTrimmed) : null;

    const resolvedHeading = labelHeading ?? firstLineHeading ?? uppercaseHeading ?? colonHeading;

    if (resolvedHeading) {
      flush();
      currentHeading = resolvedHeading;
      // Remove heading line from block body if it was part of the text lines.
      if (lines.length > 1) {
        blockText = lines.slice(1).join("\n");
      } else {
        blockText = "";
      }
    }

    if (!currentHeading) {
      currentHeading = DEFAULT_HEADING ?? HEADING_DEFS[0];
    }

    const trimmed = blockText.trim();
    if (!trimmed) continue;

    buffer.push(trimmed);
    if (bufferStart === null && typeof block.start === "number") bufferStart = block.start;
    if (typeof block.end === "number") bufferEnd = block.end;
  }

  flush();

  // If we produced no sections, fallback to simple summary using trimmed body text (excluding left column)
  if (sections.length === 0) {
    const fallbackText = usableBlocks.map((b) => String(b.text ?? "").trim()).filter(Boolean).join("\n");
    const summary = fallbackText.trim() || rawText.trim();
    if (summary) {
      sections.push({
        title: "Summary",
        fieldKey: "summary",
        content: summary,
        confidence: 0.6,
      });
    }
  }

  return sections;
}

/**
 * Transform an array of parsed sections (from parseLLMSections) and optional metadata
 * into a canonical CV-shaped object suitable for downstream rendering/storage.
 *
 * - Keeps repeatable sections (experience/education/projects/etc) as arrays.
 * - Merges singular text fields (summary/skills/languages/achievements) into single text blobs with averaged confidence.
 * - Uses metadata (name/email/phone/linkedinUrl) to populate contact/name fields preferentially.
 *
 * options:
 *   - stripLinkOnly?: boolean  (default: RUNTIME_STRIP_LINK_ONLY)
 */
export async function mapSectionsToCV(
  sections: IParsedSection[],
  metadata?: IParsedMetadata,
  options?: { stripLinkOnly?: boolean }
): Promise<ICVObject> {
  const parsed = mapSectionsToCVSchema.parse({ sections, metadata });

  const stripLinkOnly = options?.stripLinkOnly ?? RUNTIME_STRIP_LINK_ONLY;
  const metadataName = sanitizeNameCandidate(metadata?.name ?? null);

  const cv: ICVObject = {
    name: metadataName,
    contact: {
      email: metadata?.email ?? null,
      phone: (metadata as any)?.phoneE164 ?? metadata?.phone ?? (metadata as any)?.phoneRaw ?? null,
      phoneRaw: (metadata as any)?.phoneRaw ?? null,
      phoneE164: (metadata as any)?.phoneE164 ?? null,
      linkedinUrl: metadata?.linkedinUrl ?? null,
      desiredPosition: (metadata as any)?.desiredPosition ?? null,
      addressBlock: (metadata as any)?.addressBlock ?? null,
      addressNormalized: (metadata as any)?.addressNormalized ?? null,
      raw: metadata?.raw ?? null,
    },
    summary: null,
    experience: [],
    education: [],
    skills: null,
    languages: null,
    achievements: null,
    projects: [],
    research: [],
    volunteer: [],
    references: [],
    other: [],
    raw: metadata?.raw ?? null,
    rawSections: parsed.sections,
  };

  const buckets: Record<string, IParsedSection[]> = {};

  type LinkOnlyInfo = {
    section: IParsedSection;
    urls: string[];
    linkedin: string | null;
  };

  const linkOnlyHarvest: LinkOnlyInfo[] = [];

  const analyzeLinkOnly = (sec: IParsedSection): LinkOnlyInfo | null => {
    if (!sec || !sec.content) return null;
    const content = String(sec.content).trim();
    if (!content) return null;
    const urlRegex = /(?:https?:\/\/[^\s)]+|www\.[^\s)]+|linkedin\.com\/[^\s)]+)/gi;
    const urls = Array.from(new Set((content.match(urlRegex) || []).map((s) => s.trim()).filter(Boolean)));
    if (!urls.length) return null;
    const remainder = content.replace(urlRegex, "").replace(/^[\s\-\•\u2022]+|[\s\.\,\;\:\)\(]+$/g, "").trim();
    if (remainder.length > 0) return null;
    const normalizedUrls = urls.map((u) => u.replace(/[),.;]+$/g, "").trim()).filter(Boolean);
    const linkedin = normalizedUrls.map((candidate) => normalizeLinkedInUrl(candidate)).find((val) => Boolean(val)) ?? null;
    return {
      section: sec,
      urls: normalizedUrls,
      linkedin,
    };
  };

  const cleanSections = parsed.sections.filter((s) => {
    const info = analyzeLinkOnly(s);
    if (!info) return true;
    linkOnlyHarvest.push(info);
    return !stripLinkOnly;
  });

  for (const s of cleanSections) {
    const key = s.fieldKey?.toLowerCase?.() ?? "other";
    const bucketKey = FIELD_TO_BUCKET[key] ?? "other";
    buckets[bucketKey] = buckets[bucketKey] ?? [];
    buckets[bucketKey].push(s);
  }

  const experienceSections = buckets["experience"] ?? [];
  cv.experience = segmentExperienceSections(experienceSections);
  normalizeExperienceEntries(cv);

  if (stripLinkOnly && linkOnlyHarvest.length) {
    buckets["contact"] = buckets["contact"] ?? [];
    for (const info of linkOnlyHarvest) {
      buckets["contact"].push({
        title: info.section.title,
        content: info.section.content,
        fieldKey: info.section.fieldKey,
        confidence: info.section.confidence,
        sourceSpan: info.section.sourceSpan ?? null,
      });
    }
  }

  // Helper for repeatable buckets (push items into array fields)
  function pushArrayItems(bucketName: keyof ICVObject, sectionsArr: IParsedSection[]) {
    if (!sectionsArr || sectionsArr.length === 0) return;
    const target = (cv[bucketName] as ICVArrayItem[]) ?? [];
    for (const s of sectionsArr) {
      target.push({
        content: s.content.trim(),
        confidence: s.confidence,
        title: s.title || undefined,
        sourceSpan: s.sourceSpan ?? null,
      });
    }
    (cv as any)[bucketName] = target;
  }

  pushArrayItems("education", buckets["education"] ?? []);
  pushArrayItems("projects", buckets["projects"] ?? []);
  pushArrayItems("research", buckets["research"] ?? []);
  pushArrayItems("volunteer", buckets["volunteer"] ?? []);
  pushArrayItems("references", buckets["references"] ?? []);
  pushArrayItems("other", buckets["other"] ?? []);

  // Singular / merged text fields (Prompt 7: summary sourcing)
  const pickLongSummary = () => {
    const secs = buckets["summary"] ?? [];
    for (const s of secs) {
      const para = String(s.content || "").trim();
      if (para.length >= 120) {
        const conf = averageConfidence(secs.map((e) => e.confidence));
        return { text: para, confidence: conf } as ICVTextField;
      }
    }
    return null;
  };
  const synthesizeFromExperience = () => {
    const first = cv.experience?.find((entry) => Array.isArray(entry.responsibilities) && entry.responsibilities.length > 0);
    if (!first) return null;
    const responsibilities = (first.responsibilities ?? []).slice(0, 2);
    if (!responsibilities.length) return null;
    const sentences: string[] = [];
    for (const resp of responsibilities) {
      const trimmed = resp.trim();
      if (!trimmed) continue;
      if (/[.!?]$/.test(trimmed)) {
        sentences.push(trimmed);
      } else {
        sentences.push(`${trimmed}.`);
      }
      if (sentences.join(" ").length >= 240 || sentences.length >= 2) break;
    }
    if (!sentences.length) return null;
    return { text: sentences.join(" "), confidence: 0.45 } as ICVTextField;
  };
  const longSummary = pickLongSummary();
  if (longSummary) {
    cv.summary = longSummary;
  }
  if (!cv.summary && (buckets["summary"] ?? []).length > 0) {
    const summarySections = buckets["summary"] ?? [];
    const combined = concatTexts(summarySections.map((s) => String(s.content || "").trim()), "\n");
    if (combined) {
      const conf = averageConfidence(summarySections.map((s) => s.confidence));
      cv.summary = { text: combined, confidence: conf };
    }
  }
  if (!cv.summary) {
    const synth = synthesizeFromExperience();
    if (synth) cv.summary = synth;
  }

// If contact metadata missing, try to extract from contact sections (use contactExtractor)
if (buckets["contact"] && buckets["contact"].length > 0) {
  try {
     const contactText = concatTexts(buckets["contact"].map((s) => s.content));
     const extracted = extractContactFromText(contactText);
     if (!cv.contact) cv.contact = { email: null, phone: null, linkedinUrl: null, raw: null };

     // Prefer explicit metadata values first, then extracted values.
     if (!cv.contact.email) {
       if (metadata?.email) cv.contact.email = metadata.email;
       else if (extracted.emails && extracted.emails.length > 0) cv.contact.email = extracted.emails[0];
     }
    if (!cv.contact.phone) {
      if (metadata?.phone) cv.contact.phone = metadata.phone;
      else if (extracted.phones && extracted.phones.length > 0) cv.contact.phone = extracted.phones[0];
    }

    if (!cv.name && extracted.names && extracted.names.length > 0) {
      for (const candidate of extracted.names) {
        const sanitizedName = sanitizeNameCandidate(candidate);
        if (sanitizedName) {
          cv.name = sanitizedName;
          break;
        }
      }
    }

     // LinkedIn: collect candidates from metadata, extractor, and inline links; normalize and dedupe.
     const linkedinCandidates: string[] = [];
     if (metadata?.linkedinUrl) linkedinCandidates.push(String(metadata.linkedinUrl));
     if (extracted.linkedinUrls && extracted.linkedinUrls.length) linkedinCandidates.push(...extracted.linkedinUrls.map(String));
     for (const info of linkOnlyHarvest) {
       if (info.linkedin) linkedinCandidates.push(info.linkedin);
       linkedinCandidates.push(...info.urls);
     }
     // Also scan the raw contactText for bare linkedin.com/in/... patterns
     const inlineMatches = Array.from(new Set((contactText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/ig) || [])));
     linkedinCandidates.push(...inlineMatches);

     const normalizedSet = new Set<string>();
     const normalizedList: string[] = [];
     for (const cand of linkedinCandidates) {
       const n = normalizeLinkedInUrl(cand);
       if (n && !normalizedSet.has(n)) {
         normalizedSet.add(n);
         normalizedList.push(n);
       }
     }
     if (!cv.contact.linkedinUrl && normalizedList.length > 0) {
       cv.contact.linkedinUrl = normalizedList[0];
     }

    // Location guard (Prompt 6): only keep valid normalized addresses
    if (cv.contact.addressNormalized && !isValidLocationCandidate(cv.contact.addressNormalized)) {
      cv.contact.addressNormalized = null as any;
    }

    if (!cv.contact.raw) cv.contact.raw = extracted.raw ?? contactText;
  } catch (e) {
     // Best-effort: fall back to previous lightweight regex extraction if extractor fails
     const contactText = concatTexts(buckets["contact"].map((s) => s.content));
     const emailMatch = contactText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
     const phoneMatch = contactText.match(/(\+?\d[\d\-\s]{7,}\d)/);
     const linkMatches = (contactText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/ig) || []).map((s) => s.trim());
     if (!cv.contact) cv.contact = {};
     if (!cv.contact.email && emailMatch) cv.contact.email = emailMatch[0];
     if (!cv.contact.phone && phoneMatch) cv.contact.phone = phoneMatch[0];
    if (!cv.contact.linkedinUrl && linkMatches.length > 0) {
      const first = normalizeLinkedInUrl(linkMatches[0]);
      if (first) cv.contact.linkedinUrl = first;
      else cv.contact.linkedinUrl = linkMatches[0];
    }
    if (!cv.contact.raw) cv.contact.raw = contactText;
    if (cv.contact.addressNormalized && !isValidLocationCandidate(cv.contact.addressNormalized)) {
      cv.contact.addressNormalized = null as any;
    }
   }
 }

 if (buckets["skills"] && buckets["skills"].length > 0) {
   const texts = buckets["skills"].map((s) => s.content.trim());
   const combined = concatTexts(texts, "\n");
   const conf = averageConfidence(buckets["skills"].map((s) => s.confidence));
   cv.skills = { text: combined, confidence: conf };
 }

  if (buckets["languages"] && buckets["languages"].length > 0) {
    const texts = buckets["languages"].map((s) => s.content.trim());
    const combined = concatTexts(texts, ", ");
    // Normalize languages into canonical tokens and dedupe; also preserve raw tokens
    const detailed = await normalizeLanguagesFromTextDetailed(combined); // NEW: embedding reranker.
    const conf = averageConfidence(buckets["languages"].map((s) => s.confidence));
    cv.languages = { text: joinNormalizedLanguages(detailed.normalized), confidence: conf };
    cv.languagesRaw = detailed.raw;
  }

  migrateLanguagesToEducation(cv);

  if (buckets["achievements"] && buckets["achievements"].length > 0) {
    const texts = buckets["achievements"].map((s) => s.content.trim()).filter(Boolean);
    const clipped = formatAchievements(texts);
    const combined = clipped.join("\n");
    const conf = averageConfidence(buckets["achievements"].map((s) => s.confidence));
    cv.achievements = { text: combined, confidence: conf };
  }

  // Ensure name from metadata if missing
  if (!cv.name && metadataName) cv.name = metadataName;

  return cv;
}

// Small safe entrypoint that accepts unknown input and validates using Zod
export async function mapSectionsToCVSafe(input: unknown, options?: { stripLinkOnly?: boolean }) {
  const parsed = mapSectionsToCVSchema.parse(input);
  return mapSectionsToCV(parsed.sections, parsed.metadata, options);
}

type DraftExperience = {
  company?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  dateConfidence: RangeConfidence | null;
  responsibilities: string[];
  achievements: string[];
  seenResp: Set<string>;
  seenAch: Set<string>;
  duplicateCount: number;
  confidence: number;
  sourceSpan?: { start: number; end: number } | null;
  boundaryLine: number;
  headerMatch: "date" | "title_at_org" | "org_only" | "none";
  titleFound: boolean;
  orgFound: boolean;
  locFound: boolean;
  dateFound: boolean;
};

const RESPONSIBILITY_LIMIT = 10;
const ACHIEVEMENT_LIMIT = 8;
const BULLET_LEAD_RE = /^[\-•*\d\.\)\(\s]+/;
const SECTION_LABEL_RE = /^(responsibilities|achievements|accomplishments|duties)[:]?$/i;

const SUMMARY_SYNTH_MAX = 260;

const synthesizeSummaryFromResp = (bullets: string[]): string | null => {
  if (!Array.isArray(bullets) || !bullets.length) return null;
  const sentences: string[] = [];
  for (const raw of bullets) {
    const cleaned = sanitizeBulletLine(raw);
    if (!cleaned) continue;
    const sentence = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    sentences.push(sentence);
    const combined = sentences.join(" ");
    if (combined.length >= 200 || sentences.length >= 2) break;
  }
  if (!sentences.length) return null;
  let summary = sentences.join(" ").trim();
  if (summary.length > SUMMARY_SYNTH_MAX) {
    summary = `${summary.slice(0, SUMMARY_SYNTH_MAX - 1).trim()}…`;
  }
  return summary;
};

function normalizeExperienceEntries(cv: ICVObject): void {
  if (!Array.isArray(cv.experience)) return;
  for (const entry of cv.experience) {
    if (!entry || typeof entry !== "object") continue;
    const rawResp = Array.isArray(entry.responsibilities) ? entry.responsibilities : [];
    const rawAch = Array.isArray(entry.achievements) ? entry.achievements : [];

    const cleanedResp: string[] = [];
    const cleanedAch: string[] = [];
    const seenResp = new Set<string>();
    const seenAch = new Set<string>();
    let duplicateCount = 0;

    for (const resp of rawResp) {
      const normalized = sanitizeBulletLine(resp);
      if (!normalized) continue;
      if (isTemplateNoiseLine(normalized) || SECTION_TOKEN_RE.test(normalized)) continue;
      const key = normalized.toLowerCase();
      if (seenResp.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seenResp.add(key);
      cleanedResp.push(normalized);
    }

    for (const ach of rawAch) {
      const normalized = sanitizeBulletLine(ach);
      if (!normalized) continue;
      if (isTemplateNoiseLine(normalized) || SECTION_TOKEN_RE.test(normalized)) continue;
      const key = normalized.toLowerCase();
      if (seenAch.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seenAch.add(key);
      cleanedAch.push(normalized);
    }

    const limitedResp = cleanedResp.slice(0, RESPONSIBILITY_LIMIT);
    const limitedAch = cleanedAch.slice(0, ACHIEVEMENT_LIMIT);
    const limitDrops = (cleanedResp.length - limitedResp.length) + (cleanedAch.length - limitedAch.length);

    entry.responsibilities = limitedResp;
    entry.responsibilityBullets = limitedResp.slice();
    entry.achievements = limitedAch;

    if (!entry.summary || !entry.summary.trim()) {
      const synthesized = synthesizeSummaryFromResp(limitedResp);
      if (synthesized) {
        entry.summary = synthesized;
        entry.summarySource = "synthesized_from_responsibilities";
      } else {
        entry.summary = entry.summary ?? null;
        entry.summarySource = entry.summary ? "original" : null;
      }
    } else {
      entry.summarySource = entry.summarySource ?? "original";
    }

    const counts = {
      responsibilities: limitedResp.length,
      achievements: limitedAch.length,
      droppedDuplicates: duplicateCount + limitDrops,
    };

    if (!entry.diagnostics) {
      entry.diagnostics = {
        header_signals: {
          match: "none",
          titleFound: Boolean(entry.position),
          orgFound: Boolean(entry.company),
          locFound: Boolean(entry.location),
          dateFound: Boolean(entry.startDate || entry.endDate != null),
        },
        date_range: {
          start: entry.startDate,
          end: entry.endDate ?? null,
          confidence: entry.dateConfidence ?? null,
        },
        counts,
        summarySource: entry.summarySource ?? null,
      };
    } else {
      entry.diagnostics.header_signals = entry.diagnostics.header_signals ?? {
        match: "none",
        titleFound: Boolean(entry.position),
        orgFound: Boolean(entry.company),
        locFound: Boolean(entry.location),
        dateFound: Boolean(entry.startDate || entry.endDate != null),
      };
      entry.diagnostics.date_range = {
        start: entry.startDate,
        end: entry.endDate ?? null,
        confidence: entry.dateConfidence ?? null,
      };
      entry.diagnostics.counts = counts;
      entry.diagnostics.summarySource = entry.summarySource ?? entry.diagnostics.summarySource ?? null;
    }
  }
}

function sanitizeBulletLine(line: string): string {
  let cleaned = String(line || "");
  cleaned = cleaned.replace(BULLET_LEAD_RE, "").trim();
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/[;,]+$/g, "").trim();
  cleaned = cleaned.replace(/\s+(and|y)$/i, "");
  return cleaned.trim();
}

function formatDateRange(start?: string, end?: string | null): string | null {
  if (!start && !end) return null;
  if (start && end !== undefined) {
    const endDisplay = end === null ? "Present" : end;
    return `${start} — ${endDisplay}`;
  }
  if (start) return `${start} — Present`;
  if (end !== undefined) return `Until ${end === null ? "Present" : end}`;
  return null;
}

function createEntryFromRange(range: { start?: string; end?: string | null; confidence: RangeConfidence }, section: IParsedSection, lineIndex: number): DraftExperience {
  return {
    company: undefined,
    position: undefined,
    location: undefined,
    startDate: range.start,
    endDate: range.end ?? null,
    dateConfidence: range.confidence,
    responsibilities: [],
    achievements: [],
    seenResp: new Set(),
    seenAch: new Set(),
    duplicateCount: 0,
    confidence: section.confidence,
    sourceSpan: section.sourceSpan ?? null,
    boundaryLine: lineIndex,
    headerMatch: "date",
    titleFound: false,
    orgFound: false,
    locFound: false,
    dateFound: true,
  };
}

function createEntryFromHeader(header: ReturnType<typeof parseExperienceHeader>, section: IParsedSection, lineIndex: number): DraftExperience {
  const match = header.match;
  return {
    company: header.organization,
    position: header.title,
    location: header.location,
    startDate: undefined,
    endDate: undefined,
    dateConfidence: null,
    responsibilities: [],
    achievements: [],
    seenResp: new Set(),
    seenAch: new Set(),
    duplicateCount: 0,
    confidence: section.confidence,
    sourceSpan: section.sourceSpan ?? null,
    boundaryLine: lineIndex,
    headerMatch: match as DraftExperience["headerMatch"],
    titleFound: Boolean(header.title),
    orgFound: Boolean(header.organization),
    locFound: Boolean(header.location),
    dateFound: false,
  };
}

function createFallbackEntry(section: IParsedSection, lineIndex: number): DraftExperience {
  return {
    company: undefined,
    position: undefined,
    location: undefined,
    startDate: undefined,
    endDate: undefined,
    dateConfidence: null,
    responsibilities: [],
    achievements: [],
    seenResp: new Set(),
    seenAch: new Set(),
    duplicateCount: 0,
    confidence: section.confidence,
    sourceSpan: section.sourceSpan ?? null,
    boundaryLine: lineIndex,
    headerMatch: "none",
    titleFound: false,
    orgFound: false,
    locFound: false,
    dateFound: false,
  };
}

function applyHeaderToEntry(entry: DraftExperience, header: ReturnType<typeof parseExperienceHeader>) {
  if (header.organization) {
    entry.company = cleanToken(header.organization);
    entry.orgFound = true;
  }
  if (header.title) {
    entry.position = cleanToken(header.title);
    entry.titleFound = true;
  }
  if (header.location) {
    entry.location = cleanToken(header.location);
    entry.locFound = true;
  }
  if (header.match === "org_only") {
    entry.headerMatch = "org_only";
  } else {
    entry.headerMatch = "title_at_org";
  }
}

function applyRangeToEntry(entry: DraftExperience, range: { start?: string; end?: string | null; confidence: RangeConfidence }) {
  if (range.start) entry.startDate = range.start;
  if (range.end !== undefined) entry.endDate = range.end ?? null;
  entry.dateConfidence = range.confidence;
  entry.dateFound = Boolean(range.start || range.end !== undefined);
}

function addBulletToEntry(entry: DraftExperience, bullet: string) {
  const normalized = sanitizeBulletLine(bullet);
  if (!normalized) return;
  const lower = normalized.toLowerCase();
  if (entry.seenResp.has(lower) || entry.seenAch.has(lower)) {
    entry.duplicateCount += 1;
    return;
  }
  const cls = classifyExperienceBullet(normalized);
  if (cls === "achievement") {
    entry.seenAch.add(lower);
    entry.achievements.push(normalized);
  } else {
    entry.seenResp.add(lower);
    entry.responsibilities.push(normalized);
  }
}

function finalizeEntry(entry: DraftExperience, items: IExperienceItem[]) {
  if (!entry) return;
  const dedupedResp = entry.responsibilities.slice(0);
  const dedupedAch = entry.achievements.slice(0);
  const limitedResp = dedupedResp.slice(0, RESPONSIBILITY_LIMIT);
  const limitedAch = dedupedAch.slice(0, ACHIEVEMENT_LIMIT);
  const droppedFromLimit = (dedupedResp.length - limitedResp.length) + (dedupedAch.length - limitedAch.length);
  const hasContent = Boolean(entry.company || entry.position || limitedResp.length || limitedAch.length);
  if (!hasContent) {
    return;
  }
  const headerParts: string[] = [];
  if (entry.position) headerParts.push(entry.position);
  if (entry.company) headerParts.push(entry.company);
  const headerLine = headerParts.join(" — ");
  const rangeText = formatDateRange(entry.startDate, entry.endDate ?? undefined);
  const contentParts: string[] = [];
  if (headerLine || rangeText) {
    const composed = [headerLine, rangeText].filter(Boolean).join(" | ");
    if (composed) contentParts.push(composed);
  }
  if (entry.location) contentParts.push(entry.location);
  contentParts.push(...limitedResp);
  contentParts.push(...limitedAch);

  const diagnostics: IExperienceDiagnostics = {
    header_signals: {
      match: entry.headerMatch,
      titleFound: entry.titleFound,
      orgFound: entry.orgFound,
      locFound: entry.locFound,
      dateFound: entry.dateFound,
    },
    date_range: {
      start: entry.startDate,
      end: entry.endDate,
      confidence: entry.dateConfidence ?? null,
    },
    counts: {
      responsibilities: limitedResp.length,
      achievements: limitedAch.length,
      droppedDuplicates: entry.duplicateCount + droppedFromLimit,
    },
    summarySource: null,
  };

  const item: IExperienceItem = {
    content: contentParts.join("\n").trim(),
    confidence: entry.confidence,
    title: entry.position || entry.company || undefined,
    sourceSpan: entry.sourceSpan ?? null,
    company: entry.company,
    position: entry.position,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate ?? null,
    dateConfidence: entry.dateConfidence ?? undefined,
    responsibilities: limitedResp,
    achievements: limitedAch,
    summary: null,
    summarySource: null,
    diagnostics,
  };
  items.push(item);
}

function segmentExperienceSections(sections: IParsedSection[]): IExperienceItem[] {
  const items: IExperienceItem[] = [];
  for (const section of sections) {
    const rawLines = String(section.content || "")
      .replace(/\r/g, "\n")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!rawLines.length) continue;

    let current: DraftExperience | null = null;

    const finalizeCurrent = () => {
      if (current) {
        finalizeEntry(current, items);
        current = null;
      }
    };

    for (let idx = 0; idx < rawLines.length; idx += 1) {
      const rawLine = rawLines[idx];
      if (SECTION_LABEL_RE.test(rawLine)) continue;
      const rawTrimmed = rawLine.trim();
      const cleaned = sanitizeBulletLine(rawLine);
      const lineForProcessing = cleaned || rawTrimmed;
      if (!lineForProcessing) continue;
      if (isTemplateNoiseLine(lineForProcessing) || SECTION_TOKEN_RE.test(lineForProcessing)) continue;

      const rangeSource = extractDateRange(rawTrimmed);
      const rangeCandidate = rangeSource ?? extractDateRange(lineForProcessing);
      let headerCandidate = parseExperienceHeader(lineForProcessing);
      if (rangeCandidate) {
        const baseForHeader = rangeSource ? rawTrimmed : lineForProcessing;
        const withoutRange = baseForHeader.replace(rangeCandidate.matchedText, "").trim();
        if (withoutRange) {
          headerCandidate = parseExperienceHeader(withoutRange);
        } else {
          headerCandidate = { match: "none" } as ReturnType<typeof parseExperienceHeader>;
        }
      }

      if (rangeCandidate) {
        if (current && !current.dateFound) {
          applyRangeToEntry(current, rangeCandidate);
        } else if (current && current.startDate && rangeCandidate.start && current.startDate === rangeCandidate.start) {
          applyRangeToEntry(current, rangeCandidate);
        } else {
          finalizeCurrent();
          current = createEntryFromRange(rangeCandidate, section, idx);
        }
      }

      const nextLine = rawLines[idx + 1] ? sanitizeBulletLine(rawLines[idx + 1]) : "";
      if (headerCandidate.match === "org_only" && !lineStartsWithOpsVerb(nextLine)) {
        headerCandidate = { match: "none" } as ReturnType<typeof parseExperienceHeader>;
      }

      if (headerCandidate.match !== "none") {
        if (current && idx - current.boundaryLine <= 3 && (!current.company || headerCandidate.organization === current.company)) {
          applyHeaderToEntry(current, headerCandidate);
        } else {
          finalizeCurrent();
          current = createEntryFromHeader(headerCandidate, section, idx);
        }
        continue;
      }

      if (rangeCandidate) {
        // Date-only line should not be treated as bullet.
        if (!current) {
          current = createEntryFromRange(rangeCandidate, section, idx);
        }
        continue;
      }

      if (!current) {
        current = createFallbackEntry(section, idx);
      }
      addBulletToEntry(current, cleaned || rawTrimmed);
    }

    finalizeCurrent();
  }
  if (!items.length && sections.length) {
    for (const section of sections) {
      const fallback = createFallbackEntry(section, 0);
      const lines: string[] = String(section.content || "")
        .replace(/\r/g, "\n")
        .split(/\n+/)
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);
      for (const line of lines) {
        const cleaned = sanitizeBulletLine(line);
        if (!cleaned) continue;
        if (isTemplateNoiseLine(cleaned) || SECTION_TOKEN_RE.test(cleaned)) continue;
        addBulletToEntry(fallback, cleaned);
      }
      finalizeEntry(fallback, items);
    }
  }
  return items;
}
