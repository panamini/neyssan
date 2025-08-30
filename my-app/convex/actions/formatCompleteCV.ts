"use node";
import { z } from "zod";
import { generateReviewerId, normalizeSkills, parseExperienceFallback, parseEducationFallback, computeParseConfidence } from "../lib/utils";

/**
 * Convex action: formatCompleteCV
 *
 * Purpose:
 * - Accepts a raw CV text and returns a structured, reviewer-friendly object that
 *   contains both structured JSON fields (arrays/objects) and reviewer-ready
 *   human-readable strings (for immediate UI rendering).
 *
 * Notes:
 * - This implementation uses a deterministic fallback parser and small heuristics.
 * - Replace the fallback with an LLM/chain when wiring production parsing.
 */

/* -----------------------
   Zod schemas for output
   ----------------------- */
const SourceSpanSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
}).optional();

const ReviewerSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  fieldKey: z.string(),
  dismissed: z.boolean().optional(),
  sourceSpan: SourceSpanSchema,
  confidence: z.number().min(0).max(1).optional(),
});

const SkillMetaSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  sourceSpan: SourceSpanSchema,
});

const RefinedContentSchema = z.object({
  summary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  skillsMeta: z.array(SkillMetaSchema).optional(),
  skillsText: z.string().optional(),
  experience: z.array(z.any()).optional(),
  experienceText: z.string().optional(),
  education: z.array(z.any()).optional(),
  educationText: z.string().optional(),
  achievements: z.string().optional(),
  identity: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
  }).optional(),
  rawParsedSections: z.array(ReviewerSectionSchema),
  diagnostics: z.object({
    parseConfidence: z.number().min(0).max(1).optional(),
    warnings: z.array(z.string()).optional(),
  }).optional(),
});

export type RefinedContent = z.infer<typeof RefinedContentSchema>;
export type ReviewerSection = z.infer<typeof ReviewerSectionSchema>;

/* -----------------------
   Helper heuristics
   ----------------------- */

function extractEmail(text: string): string | undefined {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : undefined;
}

function extractPhone(text: string): string | undefined {
  const m = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\-.\s]{5,16}/);
  if (!m) return undefined;
  const candidate = m[0].replace(/\s{2,}/g, " ").trim();
  // crude filter to avoid picking years as phones
  if (candidate.match(/\b(19|20)\d{2}\b/)) return undefined;
  return candidate;
}

function extractNameFromTop(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return undefined;
  // skip lines that look like emails or phones
  for (const line of lines.slice(0, 6)) {
    if (line.includes("@")) continue;
    if (line.match(/\+?\d/)) continue;
    if (line.length > 2 && line.length <= 80 && /[A-Za-z]/.test(line)) return line;
  }
  return undefined;
}

function extractLocation(text: string): string | undefined {
  // look for lines with city, country heuristics (comma separated)
  const m = text.match(/([A-Za-z\s]+,\s*[A-Za-z\s]{2,})/);
  return m ? m[0].trim() : undefined;
}

/* -----------------------
   Section extraction
   ----------------------- */

function extractSectionsByHeaders(text: string): { title: string; content: string; fieldKey: string }[] {
  const lines = text.split(/\r?\n/);
  const sections: { title: string; content: string[]; fieldKey: string }[] = [];
  const headerRegex = /^\s*(Summary|Professional Summary|Skills|Experience|Work Experience|Education|Achievements|Projects|Identity|Contact|Profile)\s*:?\s*$/i;
  let current: { title: string; content: string[]; fieldKey: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(headerRegex);
    if (h) {
      if (current) {
        sections.push(current);
      }
      const header = h[1];
      const key = header.toLowerCase();
      const fieldKey = key.includes("experience") ? "experience" : key.includes("project") ? "experience" : key.includes("skill") ? "skills" : key.includes("education") ? "education" : key.includes("identity") || key.includes("contact") ? "identity" : "summary";
      current = { title: header, content: [], fieldKey };
    } else {
      if (!current) {
        current = { title: "Intro", content: [l], fieldKey: "summary" };
      } else {
        current.content.push(l);
      }
    }
  }
  if (current) sections.push(current);
  return sections.map(s => ({ title: s.title, content: s.content.join("\n").trim(), fieldKey: s.fieldKey }));
}

/* -----------------------
   Fallback parse
   ----------------------- */

function simpleParse(rawText: string): RefinedContent {
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const name = extractNameFromTop(rawText);
  const location = extractLocation(rawText);

  const sections = extractSectionsByHeaders(rawText);

  const findSection = (fieldKey: string) => sections.find(s => s.fieldKey === fieldKey)?.content;

  const summary = findSection("summary") ?? rawText.split(/\r?\n/).slice(0, 6).join(" ").trim();

  const skillsRaw = findSection("skills");
  const { skills, skillsText } = normalizeSkills(skillsRaw ?? []);
  // create skill meta with approximate spans & conservative confidence
  const skillsMeta = skills.map(s => {
    const idx = rawText.toLowerCase().indexOf(s.toLowerCase());
    const start = idx >= 0 ? idx : undefined;
    const end = start !== undefined ? start + s.length : undefined;
    return {
      name: s,
      confidence: 0.6,
      sourceSpan: start !== undefined && end !== undefined ? { start, end } : undefined,
    };
  });

  const experienceRaw = findSection("experience");
  const experience = experienceRaw ? (experienceRaw.trim().startsWith("[") ? tryParseJsonArray(experienceRaw) : parseExperienceFallback(experienceRaw)) : [];
  const experienceText = experience.length ? JSON.stringify(experience, null, 2) : undefined;

  const educationRaw = findSection("education");
  const education = educationRaw ? (educationRaw.trim().startsWith("[") ? tryParseJsonArray(educationRaw) : parseEducationFallback(educationRaw)) : [];
  const educationText = education.length ? JSON.stringify(education, null, 2) : undefined;

  const achievements = findSection("achievements") ?? undefined;

  // Build rawParsedSections with stable ids and source spans
  const rawParsedSections = sections.map((s, idx) => {
    const id = generateReviewerId(s.fieldKey, idx);
    const start = rawText.indexOf(s.content);
    const end = start >= 0 ? start + s.content.length : -1;
    return {
      id,
      title: s.title,
      content: s.content,
      fieldKey: s.fieldKey,
      sourceSpan: start >= 0 && end >= 0 ? { start, end } : undefined,
      confidence: 0.5,
    };
  });

  const diagnostics = {
    parseConfidence: computeParseConfidence({ summary, skills, experience, education }),
    warnings: [] as string[],
  };

  return {
    summary,
    skills,
    skillsMeta,
    skillsText: skillsText || undefined,
    experience,
    experienceText,
    education,
    educationText,
    achievements,
    identity: {
      name,
      email,
      phone,
      // Defensive: ensure location is a single, trimmed line (strip trailing headers or blank lines)
      location: location ? String(location).split(/\r?\n/)[0].trim() : undefined,
    },
    rawParsedSections,
    diagnostics,
  };
}

function tryParseJsonArray(input: string) {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

/* -----------------------
   Exported action
   ----------------------- */

/**
 * formatCompleteCV action
 *
 * Note: Replace the inner LLM/fallback logic with your production LLM chain.
 */
export default async function formatCompleteCV(args: { rawText: string; profileId?: string; source?: string; meta?: Record<string, any> }) {
  const { rawText } = args || { rawText: "" };

  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error("formatCompleteCV: empty_raw_text - No CV text provided");
  }

  // TODO: Replace with LLM chain call
  const parsed = simpleParse(rawText);

  // Validate output
  const safe = RefinedContentSchema.safeParse(parsed);
  if (!safe.success) {
    // Throw to allow Convex to capture as an error; include formatted zod errors for debugging
    throw new Error("formatCompleteCV: parse_validation_failed - " + JSON.stringify(safe.error.format()));
  }

  return {
    status: "ok",
    result: safe.data,
  };
}