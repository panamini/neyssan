// my-app/convex/lib/parsing/cvMapper.ts
import { z } from "zod";
import { extractContactFromText } from "./contactExtractor";
import { normalizeLanguagesFromText, normalizeLanguagesFromTextDetailed, joinNormalizedLanguages } from "./languageNormalizer";

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
  raw?: string | null;
}

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

export interface ICVObject {
  name?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    raw?: string | null;
  };
  summary?: ICVTextField | null;
  experience: ICVArrayItem[];
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
export function mapSectionsToCV(
  sections: IParsedSection[],
  metadata?: IParsedMetadata,
  options?: { stripLinkOnly?: boolean }
): ICVObject {
  const parsed = mapSectionsToCVSchema.parse({ sections, metadata });

  const stripLinkOnly = options?.stripLinkOnly ?? RUNTIME_STRIP_LINK_ONLY;

  const cv: ICVObject = {
    name: metadata?.name ?? null,
    contact: {
      email: metadata?.email ?? null,
      phone: metadata?.phone ?? null,
      linkedinUrl: metadata?.linkedinUrl ?? null,
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

  // Helper: detect sections that are effectively "link-only" (e.g., contain only one or more URLs and no other text)
  function isLinkOnly(sec: IParsedSection): boolean {
    if (!sec || !sec.content) return false;
    const content = String(sec.content).trim();
    if (content.length === 0) return false;
    // Find URLs (basic but robust enough for our use-case)
    // Accept: full URLs, www-prefixed, and bare linkedin.com/... tokens (no scheme)
    const urlRegex = /(?:https?:\/\/[^\s)]+|www\.[^\s)]+|linkedin\.com\/[^\s)]+)/ig;
    const urls = content.match(urlRegex) || [];
    // Remove URLs and common surrounding punctuation to see what's left
    const remaining = content.replace(urlRegex, "").replace(/^[\s\-\•\u2022]+|[\s\.\,\;\:\)\(]+$/g, "").trim();
    return urls.length > 0 && remaining.length === 0;
  }

  // Decide which sections to use for bucketing (either filtered or unfiltered)
  const cleanSections = stripLinkOnly ? parsed.sections.filter((s) => !isLinkOnly(s)) : parsed.sections.slice();

  for (const s of cleanSections) {
    const key = s.fieldKey?.toLowerCase?.() ?? "other";
    const bucketKey = FIELD_TO_BUCKET[key] ?? "other";
    buckets[bucketKey] = buckets[bucketKey] ?? [];
    buckets[bucketKey].push(s);
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

  pushArrayItems("experience", buckets["experience"] ?? []);
  pushArrayItems("education", buckets["education"] ?? []);
  pushArrayItems("projects", buckets["projects"] ?? []);
  pushArrayItems("research", buckets["research"] ?? []);
  pushArrayItems("volunteer", buckets["volunteer"] ?? []);
  pushArrayItems("references", buckets["references"] ?? []);
  pushArrayItems("other", buckets["other"] ?? []);

  // Singular / merged text fields
  if (buckets["summary"] && buckets["summary"].length > 0) {
    const texts = buckets["summary"].map((s) => s.content.trim());
    const conf = averageConfidence(buckets["summary"].map((s) => s.confidence));
    cv.summary = { text: concatTexts(texts), confidence: conf };
  }

 // If contact metadata missing, try to extract from contact sections (use contactExtractor)
 if (buckets["contact"] && buckets["contact"].length > 0) {
   // Helper: normalize and canonicalize LinkedIn candidate strings
   function normalizeLinkedInUrl(u: string | undefined | null): string | null {
     if (!u) return null;
     let s = String(u).trim();
     // Remove surrounding punctuation
     s = s.replace(/^[<"'\s]+|[>"'\s.,;:]+$/g, "");
     // If it's missing scheme but contains linkedin domain, add https
     if (/^linkedin\.com/i.test(s)) s = "https://" + s;
     // If it contains linkedin in any form, extract the path starting with /in/ or /pub/
     const m = /(?:https?:\/\/)?(?:www\.)?linkedin\.com(\/[^\s)]+)/i.exec(s);
     if (m && m[1]) {
       // Normalize to https://linkedin.com + path (no trailing slash)
       const path = m[1].replace(/\/+$/g, "");
       return `https://linkedin.com${path}`;
     }
     // As a fallback, if it already looks like a URL, return it as-is (trimmed)
     if (/^https?:\/\//i.test(s)) return s;
     return null;
   }

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

     // LinkedIn: collect candidates from metadata, extractor, and inline links; normalize and dedupe.
     const linkedinCandidates: string[] = [];
     if (metadata?.linkedinUrl) linkedinCandidates.push(String(metadata.linkedinUrl));
     if (extracted.linkedinUrls && extracted.linkedinUrls.length) linkedinCandidates.push(...extracted.linkedinUrls.map(String));
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
    const detailed = normalizeLanguagesFromTextDetailed(combined);
    const conf = averageConfidence(buckets["languages"].map((s) => s.confidence));
    cv.languages = { text: joinNormalizedLanguages(detailed.normalized), confidence: conf };
    cv.languagesRaw = detailed.raw;
  }

 if (buckets["achievements"] && buckets["achievements"].length > 0) {
   const texts = buckets["achievements"].map((s) => s.content.trim());
   const combined = concatTexts(texts, "\n");
   const conf = averageConfidence(buckets["achievements"].map((s) => s.confidence));
   cv.achievements = { text: combined, confidence: conf };
 }

 // Ensure name from metadata if missing
 if (!cv.name && metadata?.name) cv.name = metadata.name;

 return cv;
}

// Small safe entrypoint that accepts unknown input and validates using Zod
export function mapSectionsToCVSafe(input: unknown, options?: { stripLinkOnly?: boolean }) {
  const parsed = mapSectionsToCVSchema.parse(input);
  return mapSectionsToCV(parsed.sections, parsed.metadata, options);
}