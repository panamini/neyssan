"use node";
import { z } from "zod";
import { generateReviewerId, normalizeSkills, parseExperienceFallback, parseEducationFallback, computeParseConfidence } from "../lib/utils";
import { action } from "../_generated/server";

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
  // New fields for languages and contact
  languages: z.array(z.string()).optional(),
  contact: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
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
  // Fallback-aware section extraction:
  // 1) Prefer markdown/hash headers.
  // 2) Detect bold/italic-only heading lines (e.g., "**PROFILE**", "__SKILLS__").
  // 3) Otherwise run a line-by-line heuristic scan.
  // Header normalization includes de-accenting to better handle small language variations.

  function deaccent(s: string) {
    try {
      return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    } catch {
      return s;
    }
  }

  function mapHeaderToField(headerRaw: string) {
    const cleaned = deaccent(String(headerRaw))
      .replace(/[\u2018\u2019\u201C\u201D]/g, "") // smart quotes
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "summary";

    // Profile / Summary / About / Objective
    if (
      cleaned.includes("profile") ||
      cleaned.includes("summary") ||
      cleaned.includes("about") ||
      cleaned.includes("about me") ||
      cleaned.includes("objective") ||
      cleaned.includes("résumé") ||
      cleaned.includes("resume") ||
      cleaned.includes("profil")
    ) return "summary";

    // Experience-like headers
    if (
      cleaned.includes("experience") ||
      cleaned.includes("employment") ||
      cleaned.includes("work") ||
      cleaned.includes("work history") ||
      cleaned.includes("employment history") ||
      cleaned.includes("professional experience") ||
      cleaned.includes("career") ||
      cleaned.includes("background") ||
      cleaned.includes("projects") ||
      cleaned.includes("project")
    ) return "experience";

    // Skills / Competences / Technical
    if (
      cleaned.includes("skill") ||
      cleaned.includes("competence") ||
      cleaned.includes("compétence") ||
      cleaned.includes("compétences") ||
      cleaned.includes("technical") ||
      cleaned.includes("tech stack") ||
      cleaned.includes("technical skills") ||
      cleaned.includes("stack") ||
      cleaned.includes("proficien")
    ) return "skills";

    // Education / Formation / Studies
    if (
      cleaned.includes("education") ||
      cleaned.includes("formation") ||
      cleaned.includes("éducation") ||
      cleaned.includes("studies") ||
      cleaned.includes("academic")
    ) return "education";

    // Achievements / Awards / Certifications / Publications / Hobbies
    if (
      cleaned.includes("achievement") ||
      cleaned.includes("award") ||
      cleaned.includes("certif") ||
      cleaned.includes("publication") ||
      cleaned.includes("hobby") ||
      cleaned.includes("réalisation") ||
      cleaned.includes("réalisations") ||
      cleaned.includes("achievements")
    ) return "achievements";

    // Languages -> treat as skills for UI (languages rendered in skills panel)
    if (cleaned.includes("language") || cleaned.includes("langue") || cleaned.includes("languages") || cleaned.includes("langues")) return "skills";

    // Identity / Contact / Links / Coordonnées (French)
    if (
      cleaned.includes("link") ||
      cleaned.includes("website") ||
      cleaned.includes("linkedin") ||
      cleaned.includes("github") ||
      cleaned.includes("portfolio") ||
      cleaned.includes("contact") ||
      cleaned.includes("coordonne") || // covers coordonne, coordonnees, coordonnées after deaccent
      cleaned.includes("adresse") ||
      cleaned.includes("phone") ||
      cleaned.includes("telephone") ||
      cleaned.includes("téléphone") ||
      cleaned.includes("email") ||
      cleaned.includes("identity") ||
      cleaned.includes("url")
    ) return "identity";

    // Fallback to summary
    return "summary";
  }

  function markdownHeaderSplit(textBlock: string) {
    // 1) Hash-style markdown headers
    const hashRegex = /^\s*(#{1,4})\s*(.+?)\s*$/gm;
    const matches: { index: number; header: string }[] = [];
    let m;
    while ((m = hashRegex.exec(textBlock)) !== null) {
      matches.push({ index: m.index, header: m[2].replace(/^[\*\_]+|[\*\_]+$/g, "").trim() });
    }
    if (matches.length) {
      const sections: { title: string; content: string }[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : textBlock.length;
        const headerLine = textBlock.slice(start, end).split(/\r?\n/)[0] || matches[i].header;
        const headerText = headerLine.replace(/^\s*#{1,4}\s*/g, "").replace(/^[\*\_]+|[\*\_]+$/g, "").trim() || matches[i].header;
        const body = textBlock.slice(start, end).split(/\r?\n/).slice(1).join("\n").trim();
        sections.push({ title: headerText || "Section", content: body });
      }
      return sections.map(s => ({ title: s.title, content: s.content }));
    }

    // 2) Bold/italic-only headings (lines that are essentially "**HEADER**" or "__HEADER__" or "*Header*")
    const boldRegex = /^\s*([*_]{1,3})([^*_][\s\S]*?[^*_])\1\s*$/gm;
    const boldMatches: { index: number; header: string }[] = [];
    while ((m = boldRegex.exec(textBlock)) !== null) {
      // only capture lines (no surrounding text on same line)
      const line = m[0];
      const header = m[2].trim();
      const idx = textBlock.indexOf(line, m.index);
      if (idx >= 0) boldMatches.push({ index: idx, header: header.replace(/^[\s\-\–\—]+|[\s\-\–\—]+$/g, "").trim() });
    }
    if (boldMatches.length) {
      const sections: { title: string; content: string }[] = [];
      for (let i = 0; i < boldMatches.length; i++) {
        const start = boldMatches[i].index;
        const end = i + 1 < boldMatches.length ? boldMatches[i + 1].index : textBlock.length;
        // body is everything after the header line up to next matched header (or EOF)
        const afterHeader = textBlock.slice(start, end);
        const body = afterHeader.split(/\r?\n/).slice(1).join("\n").trim();
        sections.push({ title: boldMatches[i].header || "Section", content: body });
      }
      return sections.map(s => ({ title: s.title, content: s.content }));
    }

    return null;
  }

  function simpleHeaderScan(lines: string[]) {
    const headerCandidates = [
      "summary", "professional summary", "profile", "about", "about me", "objective",
      "skills", "experience", "employment history", "work experience", "work history",
      "projects", "education", "achievements", "hobbies",
      "identity", "contact", "links", "website", "linkedin", "github", "portfolio"
    ];
    const sections: { title: string; content: string[]; fieldKey: string }[] = [];
    let current: { title: string; content: string[]; fieldKey: string } | null = null;

    for (const rawLine of lines) {
      const l = String(rawLine);
      // If line looks like a header line because it's short and all-caps / bold-ish, treat it as header
      const isProbablyHeader = (() => {
        const trimmed = l.trim();
        if (!trimmed) return false;
        // all-caps short line (e.g., "PROFILE" or "SKILLS")
        const words = trimmed.split(/\s+/);
        if (trimmed.length <= 60 && words.length <= 6 && /^[A-Z0-9\s\-\_\/]+$/.test(trimmed)) return true;
        return false;
      })();

      const stripped = l
        .replace(/^\s*#{1,4}\s*/g, "")
        .replace(/^\s*[\*\_]{1,3}/g, "")
        .replace(/[\*\_]{1,3}\s*$/g, "")
        .replace(/^[\-\–\—\s]+|[\-\–\—\s]+$/g, "")
        .trim();

      const normalized = deaccent(stripped).replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();

      let matched: string | null = null;
      for (const cand of headerCandidates) {
        if (normalized === cand || normalized.includes(cand)) {
          matched = cand;
          break;
        }
      }

      if (!matched && isProbablyHeader) {
        // use the stripped text as header candidate
        matched = stripped.toLowerCase();
      }

      if (matched) {
        if (current) sections.push(current);
        const header = stripped || matched;
        const fieldKey = mapHeaderToField(header);
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
    return sections;
  }

  // Prefer markdown/hash header splitting when present
  const mdCandidate = markdownHeaderSplit(text);
  if (mdCandidate && mdCandidate.length > 0) {
    const mapped = mdCandidate.map(s => {
      const fk = mapHeaderToField(s.title || "");
      return { title: s.title || "Section", content: (s.content || "").trim(), fieldKey: fk };
    });
    return mapped.map(s => ({ title: s.title, content: s.content, fieldKey: s.fieldKey }));
  }

  // Fallback to simple scan
  const lines = text.split(/\r?\n/);
  const sections = simpleHeaderScan(lines);
  return sections.map(s => ({ title: s.title, content: s.content.join("\n").trim(), fieldKey: s.fieldKey }));
}

/* -----------------------
   Fallback parse
   ----------------------- */

import { parseCVEngine } from "../lib/parsing_shared/engine";

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
export async function runFormatCompleteCV(args: { rawText: string; profileId?: string; source?: string; meta?: Record<string, any> }) {
  const { rawText } = args || { rawText: "" };

  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error("formatCompleteCV: empty_raw_text - No CV text provided");
  }

  // Dev guard: when DEV_NO_LLM=1, avoid calling the LLM-backed parseCV and use
  // local heuristics instead to produce a single deterministic history entry.
  let sections: Array<{ title: string; content: string; fieldKey: string; confidence?: number }>;
  let metadata: { name: string | null; email: string | null; phone: string | null; linkedinUrl: string | null };
  let method: 'llm' | 'heuristic' = 'heuristic';
  let warnings: string[] = [];

  if (process.env.DEV_NO_LLM === "1") {
    console.log("[formatCompleteCV] DEV_NO_LLM active - running heuristics-only parse");
    const extracted = extractSectionsByHeaders(rawText);
    sections = (extracted || []).map(s => ({ title: s.title, content: s.content, fieldKey: s.fieldKey, confidence: 0.6 }));
    metadata = {
      name: extractNameFromTop(rawText) ?? null,
      email: extractEmail(rawText) ?? null,
      phone: extractPhone(rawText) ?? null,
      linkedinUrl: null
    };
    method = 'heuristic';
    warnings = ["DEV_NO_LLM: heuristics-only parse used"];
  } else {
    // First try to use the legacy hybrid parser when available. Tests commonly mock
    // ../../lib/parsing/hybridParser, so requiring it here lets mocks take effect.
    let parsed: any = null;
    let parsedFromLegacy = false;
    // Try ESM dynamic import first (works with vitest ESM mocks), then fall back to require
    try {
      const legacyModule = await import("../lib/parsing/hybridParser").catch(() => null);
      if (legacyModule && typeof (legacyModule as any).parseCV === "function") {
        parsed = await (legacyModule as any).parseCV(rawText);
        parsedFromLegacy = true;
      }
    } catch {
      // ignore
    }
    if (!parsed) {
      try {

        const legacy = (() => { try { return require("../lib/parsing/hybridParser"); } catch { return null; } })();
        if (legacy && typeof legacy.parseCV === "function") {
          parsed = await legacy.parseCV(rawText);
          parsedFromLegacy = true;
        }
      } catch {
        // ignore
      }
    }
    if (!parsed) parsed = await parseCVEngine(rawText);
    try { console.log("[DEBUG][formatCompleteCV] parsedFromLegacy:", parsedFromLegacy, "parsedProvidedSections:", Array.isArray((parsed)?.sections) ? (parsed).sections.length : 0); } catch {}
    sections = parsed.sections;
    metadata = parsed.metadata;
    method = parsed.method;
    warnings = parsed.warnings || [];
  }

  const findSection = (fieldKey: string) => sections.find(s => s.fieldKey === fieldKey)?.content;

  const summary = findSection("introduction") ?? undefined;

  const skillsRaw = findSection("skills");
  const { skills, skillsText } = normalizeSkills(skillsRaw ?? "");
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

  // New: extract languages and contact sections when present
  const languagesRaw = findSection("languages") ?? undefined;
  let languages: string[] | undefined = undefined;
  if (languagesRaw) {
    try {
      const trimmed = languagesRaw.trim();
      if (trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) languages = parsed.map(String);
      } else {
        // Split on common separators (commas, semicolons, newlines, bullets)
        languages = trimmed.split(/[,;\n•·\u2022-]+/).map(s => s.trim()).filter(Boolean);
      }
    } catch {
      languages = languagesRaw.split(/[,;\n•·\u2022-]+/).map(s => s.trim()).filter(Boolean);
    }
  }

  const contactRaw = findSection("contact") ?? undefined;
  let contact: { phone?: string; address?: string } | undefined = undefined;
  if (contactRaw) {
    const phone = extractPhone(contactRaw);
    const emailFromContact = extractEmail(contactRaw); // may be useful elsewhere
    // Heuristic address: lines that are not email/phone and longer than 4 characters
    const lines = contactRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const addrCandidates = lines.filter(l => {
      if (extractEmail(l)) return false;
      if (extractPhone(l)) return false;
      // ignore single-word tokens (likely labels)
      if (l.split(/\s+/).length < 2) return false;
      return true;
    });
    const address = addrCandidates.length ? addrCandidates.join(", ") : undefined;
    contact = {};
    if (phone) contact.phone = phone;
    if (address) contact.address = address;
  }

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
      confidence: s.confidence,
    };
  });

  const diagnostics = {
    parseConfidence: computeParseConfidence({ summary, skills, experience, education }),
    warnings: warnings,
    method,
  };

  // Normalize metadata safely: convert null -> undefined and coerce to string when present
  const safeMetadata = {
    name: metadata && metadata.name != null ? String(metadata.name) : undefined,
    email: metadata && metadata.email != null ? String(metadata.email) : undefined,
    phone: metadata && metadata.phone != null ? String(metadata.phone) : undefined,
  };

  const parsed = {
    summary,
    skills,
    languages,
    contact,
    skillsMeta,
    skillsText: skillsText || undefined,
    experience,
    experienceText,
    education,
    educationText,
    achievements,
    identity: {
      name: safeMetadata.name,
      email: safeMetadata.email,
      phone: safeMetadata.phone,
      location: undefined,
    },
    rawParsedSections,
    diagnostics,
  };

  // Validate output
  const safe = RefinedContentSchema.safeParse(parsed);
  if (!safe.success) {
    // Throw to allow Convex to capture as an error; include formatted zod errors for debugging
    throw new Error("formatCompleteCV: parse_validation_failed - " + JSON.stringify(safe.error.format()));
  }

  // Return the same shape the client expects: { status: 'ok', result }
  return {
    status: "ok",
    result: safe.data,
  };
}

export const formatCompleteCV = action(async (_ctx, args: { rawText: string; profileId?: string; source?: string; meta?: Record<string, any> }) => {
  return await runFormatCompleteCV(args as any);
});

export default runFormatCompleteCV;