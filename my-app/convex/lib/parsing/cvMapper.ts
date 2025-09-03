// my-app/convex/lib/parsing/cvMapper.ts
import { z } from "zod";
import { extractContactFromText } from "./contactExtractor";
import { normalizeLanguagesFromText, joinNormalizedLanguages } from "./languageNormalizer";

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
  languages?: ICVTextField | null;
  achievements?: ICVTextField | null;
  projects: ICVArrayItem[];
  research: ICVArrayItem[];
  volunteer: ICVArrayItem[];
  references: ICVArrayItem[];
  other: ICVArrayItem[];
  raw?: string | null;
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

/**
 * Transform an array of parsed sections (from parseLLMSections) and optional metadata
 * into a canonical CV-shaped object suitable for downstream rendering/storage.
 *
 * - Keeps repeatable sections (experience/education/projects/etc) as arrays.
 * - Merges singular text fields (summary/skills/languages/achievements) into single text blobs with averaged confidence.
 * - Uses metadata (name/email/phone/linkedinUrl) to populate contact/name fields preferentially.
 */
export function mapSectionsToCV(
  sections: IParsedSection[],
  metadata?: IParsedMetadata
): ICVObject {
  const parsed = mapSectionsToCVSchema.parse({ sections, metadata });

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
  };

  const buckets: Record<string, IParsedSection[]> = {};

  for (const s of parsed.sections) {
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
   try {
     const contactText = concatTexts(buckets["contact"].map((s) => s.content));
     const extracted = extractContactFromText(contactText);
     if (!cv.contact) cv.contact = { email: null, phone: null, linkedinUrl: null, raw: null };
     // Prefer explicit metadata values first, then extracted values (pick first candidate where arrays exist)
     if (!cv.contact.email) {
       if (metadata?.email) cv.contact.email = metadata.email;
       else if (extracted.emails && extracted.emails.length > 0) cv.contact.email = extracted.emails[0];
     }
     if (!cv.contact.phone) {
       if (metadata?.phone) cv.contact.phone = metadata.phone;
       else if (extracted.phones && extracted.phones.length > 0) cv.contact.phone = extracted.phones[0];
     }
     if (!cv.contact.linkedinUrl) {
       if (metadata?.linkedinUrl) cv.contact.linkedinUrl = metadata.linkedinUrl;
       else if (extracted.linkedinUrls && extracted.linkedinUrls.length > 0) cv.contact.linkedinUrl = extracted.linkedinUrls[0];
     }
     if (!cv.contact.raw) cv.contact.raw = extracted.raw ?? contactText;
   } catch (e) {
     // Best-effort: fall back to previous lightweight regex extraction if extractor fails
     const contactText = concatTexts(buckets["contact"].map((s) => s.content));
     const emailMatch = contactText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
     const phoneMatch = contactText.match(/(\+?\d[\d\-\s]{7,}\d)/);
     const linkMatch = contactText.match(/https?:\/\/[^\s)]+/i);
     if (!cv.contact) cv.contact = {};
     if (!cv.contact.email && emailMatch) cv.contact.email = emailMatch[0];
     if (!cv.contact.phone && phoneMatch) cv.contact.phone = phoneMatch[0];
     if (!cv.contact.linkedinUrl && linkMatch) cv.contact.linkedinUrl = linkMatch[0];
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
   // Normalize languages into canonical tokens and dedupe
   const normalized = normalizeLanguagesFromText(combined);
   const conf = averageConfidence(buckets["languages"].map((s) => s.confidence));
   cv.languages = { text: joinNormalizedLanguages(normalized), confidence: conf };
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
export function mapSectionsToCVSafe(input: unknown) {
  const parsed = mapSectionsToCVSchema.parse(input);
  return mapSectionsToCV(parsed.sections, parsed.metadata);
}