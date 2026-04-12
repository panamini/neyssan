/**
 * my-app/src/utils/cv/mapping-utils.ts
 *
 * Pure helpers to build v1-typed CvSection arrays from either:
 * - normalized artifacts produced by the server (preferred), or
 * - reviewer-style mapped sections (fallback).
 *
 * These helpers produce typed sections that are safe to pass into
 * normalizeAndValidateCvDocument(...). Experience and education upload paths
 * synthesize representative blocks immediately so the first render already uses
 * the same preview family as the normalized document.
 */

import { v4 as uuidv4 } from "uuid";
import type { CvSection } from "../../types/cvDocument";
import { ensureRemirrorDoc } from "../../components/remirror-editor/utils/conversion";
import { CvSectionSchema, CvSectionSchemaStrict } from "../../schemas/cvDocument.schema";
import languageNames from "../../../../shared/language_names.json";
import { resolveCanonicalHeadingFamily } from "../../../convex/lib/parsing/headingResolver";

// --- Constants for heuristics and magic numbers ---
const MIN_AGGREGATED_TEXT_LENGTH = 64;
const MAX_AGGREGATED_STRING_LENGTH = 20000;
const MAX_AGGREGATION_DEPTH = 3;
const MAX_SKILL_WORD_COUNT = 6;

const MONTH_TOKENS = [
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "jan", "feb", "mar", "apr",
  "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

const ROLE_PHRASES = [
    "SECURITY GUARD", "SECURITY OFFICER", "PROTECTION OFFICER", "CERTIFIED PROTECTION OFFICER",
    "PROTECTION GUARD", "GUARD", "ENGINEER", "DEVELOPER", "MANAGER", "CONSULTANT",
    "ANALYST", "DIRECTOR", "ARCHITECT", "SPECIALIST", "DESIGNER", "LEAD",
];

const LANGUAGE_HEADING_PREFIX_RE = /^(languages?|langues?|idiomas?|sprachen?)\b/i;

const ACHIEVEMENT_VERBS = [
  "achieved", "accomplished", "delivered", "drove", "grew", "reduced", "improved", "optimized",
  "increased", "decreased", "expanded", "boosted", "launched", "built", "designed", "developed",
  "implemented", "created", "pioneered", "saved", "cut", "enhanced"
];

const DEGREE_TOKEN_RE = /\b(certified\s+\w+\s+program|certificate(?:\s+program)?|course\b|dipl[oô]ma|bachelor|master|msc|bsc|mba|phd|program(?:me)?|universit[ée]|university|college|institute|school|academy)\b/i;
const MONTH_YEAR_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}\b/i;
const DATE_RANGE_RE = /\b(19|20)\d{2}\b\s*(?:[-–—]\s*\b(19|20)\d{2}\b)?/i;
const EDUCATION_KEYWORD_RE = /\b(degree|program|course|certificate|diploma|bachelor|master|msc|bsc|mba|phd|university|college|school|academy|institute)\b/i;

const LANGUAGE_NORMALIZATION_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const source = languageNames as Record<string, string[] | undefined>;
  Object.entries(source).forEach(([canonical, aliases]) => {
    const canonicalTrimmed = canonical.trim();
    if (!canonicalTrimmed) return;
    const canonicalKey = canonicalTrimmed.toLowerCase();
    if (!map[canonicalKey]) {
      map[canonicalKey] = canonicalTrimmed;
    }
    if (Array.isArray(aliases)) {
      aliases.forEach((alias) => {
        const key = String(alias ?? "").trim().toLowerCase();
        if (!key) return;
        if (!map[key]) {
          map[key] = canonicalTrimmed;
        }
      });
    }
  });
  return map;
})();

function looksLikeAchievementBullet(text: string): boolean {
  const lower = text.toLowerCase();
  if (ACHIEVEMENT_VERBS.some((verb) => lower.startsWith(verb))) return true;
  if (/\b(by\s+\d+%|\d+%|\d+\s*(?:million|k|users|customers))\b/.test(lower)) return true;
  if (/\b(revenue|retention|conversion|productivity|costs|savings)\b/.test(lower)) return true;
  return false;
}

// --- Interfaces for better type safety ---
interface PartialNormalizedCv {
  rawText?: string;
  summary?: string;
  skills?: Array<{ name: string } | string>;
  skillsText?: string;
  experience?: any[];
  education?: any[];
  languages?: Array<{ name?: string; level?: string }>;
  languagesText?: string;
  profile?: Record<string, unknown>;
  details?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  links?: Record<string, unknown>;
  achievements?: Array<{ text: string } | string>;
  rawSections?: Array<Record<string, unknown>>;
  [key: string]: any; // Allow other properties
}

/**
 * Parameters passed to an AI dispatcher when requesting section mapping.
 * The dispatcher should return either { sections: CvSection[] } or CvSection[].
 * The async helpers in this module will validate and sanitize these to CvSection[].
 */
export interface AiDispatchSectionsParams {
  rawText?: string;
  normalized?: unknown;
  localeHint?: string;
}

/**
 * AI dispatcher signature. It must resolve to either:
 * - { sections: CvSection[] } or CvSection[]
 * The result will be validated per-section via CvSectionSchemaStrict.
 */
export type AiDispatchSections = (
  params: AiDispatchSectionsParams
) => Promise<{ sections: unknown } | unknown>;

function buildExperienceRepresentativeBlocks(items: any[]) {
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const itemId = typeof item?.id === "string" ? item.id.trim() : "";
      if (!itemId) return null;

      const company = cleanToken(String(item?.company ?? ""));
      const position = cleanToken(String(item?.position ?? ""));
      const location = cleanToken(String(item?.location ?? ""));
      const baseTitle = company && position ? `${position} at ${company}` : position || company || "Experience";
      const title = location ? `${baseTitle} — ${location}` : baseTitle;

      return {
        id: uuidv4(),
        title,
        type: "text" as const,
        content: ensureRemirrorDoc(item?.responsibilities as any),
        attributes: { linkedStructuredId: itemId },
      };
    })
    .filter(Boolean);
}

function buildEducationRepresentativeBlocks(items: any[]) {
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const itemId = typeof item?.id === "string" ? item.id.trim() : "";
      if (!itemId) return null;

      const institution = cleanToken(String(item?.institution ?? ""));
      const degree = cleanToken(String(item?.degree ?? ""));
      const field = cleanToken(String(item?.field ?? ""));
      const baseTitle = institution || degree || field || "Education";

      return {
        id: uuidv4(),
        title: baseTitle,
        type: "text" as const,
        content: ensureRemirrorDoc(item?.description as any),
        attributes: { linkedStructuredId: itemId },
      };
    })
    .filter(Boolean);
}

/**
 * Options for AI-dispatched helpers. If fallbackToHeuristics is not explicitly false,
 * the helpers will fall back to the synchronous heuristics on error or invalid results.
 */
export interface AiDispatchOptions {
  dispatch: AiDispatchSections;
  rawText?: string;
  localeHint?: string;
  fallbackToHeuristics?: boolean;
}

/** Diagnostics shape for OCR engine hints surfaced to the UI */
export interface OcrDiagnostics {
  engine?: string | null;
  fallback_used?: boolean | null;
  fallback_reason?: string | null;
  dpi_used?: number | null;
  paddle_retry_used?: boolean | null;
  ocr_request_path?: string | null;
  ocr_provider?: string | null;
  mistral_model?: string | null;
  mistral_fallback?: boolean | null;
  mistral_runtime?: string | null;
}

export function engineHintFromDiagnostics(
  diag?: {
    engine?: string | null;
    dpi_used?: number | null;
    paddle_retry_used?: boolean | null;
    fallback_reason?: string | null;
    fallback_used?: boolean | null;
    ocr_request_path?: string | null;
    ocr_provider?: string | null;
    mistral_model?: string | null;
    mistral_fallback?: boolean | null;
    mistral_runtime?: string | null;
  } | null
): string | null {
  if (!diag || typeof diag !== "object") return null;
  const engineRaw = typeof diag.engine === "string" ? diag.engine.trim() : "";
  if (!engineRaw) return null;
  const engine = engineRaw.toLowerCase();
  if (engine === "text") {
    return "Text";
  }
  const dpi = typeof diag.dpi_used === "number" && Number.isFinite(diag.dpi_used) && diag.dpi_used > 0
    ? `${Math.round(diag.dpi_used)}dpi`
    : null;
  const reasonRaw = typeof diag.fallback_reason === "string" ? diag.fallback_reason.trim() : "";
  const reason = reasonRaw ? reasonRaw.replace(/_/g, " ") : "";
  const normalizedEngine = engine === "paddleocr" ? "paddle" : engine;
  const isPrimary = normalizedEngine === "paddle" && !reason;
  const prefix = isPrimary ? "OCR" : "OCR fallback";
  const built: string[] = [];
  const descriptor = [normalizedEngine, dpi].filter(Boolean).join(" ");
  built.push(`${prefix}: ${descriptor || normalizedEngine}`.trim());
  if (reason) {
    built.push(`· ${reason}`);
  }
  return built.join(" ");
}


/* Minimal helper to coerce Remirror-friendly content */
function toRemirror(content?: unknown) {
  try {
    // Attempt to process content as a Remirror JSON object first
    return ensureRemirrorDoc(content as any);
  } catch {
    // Fallback to treating content as a plain string
    return ensureRemirrorDoc(String(content ?? "") as any);
  }
}

type NormalizedRawSection = {
  label?: string | null;
  title?: string | null;
  fieldKey?: string | null;
  content?: string | null;
  text?: string | null;
};

function createTextBlock(title: string, content: string, linkedStructuredId?: string) {
  return {
    id: uuidv4(),
    title,
    type: "text" as const,
    content: ensureRemirrorDoc(content),
    attributes: linkedStructuredId ? { linkedStructuredId } : {},
  };
}

function getNormalizedRawSections(normalized: PartialNormalizedCv): NormalizedRawSection[] {
  return Array.isArray(normalized.rawSections)
    ? (normalized.rawSections as NormalizedRawSection[])
    : [];
}

function getRawSectionText(section: NormalizedRawSection): string {
  const raw = typeof section.content === "string"
    ? section.content
    : typeof section.text === "string"
      ? section.text
      : "";
  return raw.trim();
}

function resolveRawSectionFamily(section: NormalizedRawSection) {
  return (
    resolveCanonicalHeadingFamily(section.fieldKey) ??
    resolveCanonicalHeadingFamily(section.label) ??
    resolveCanonicalHeadingFamily(section.title)
  );
}

function collectRawSectionBodies(
  normalized: PartialNormalizedCv,
  family: ReturnType<typeof resolveCanonicalHeadingFamily>,
): string[] {
  if (!family) return [];
  return getNormalizedRawSections(normalized)
    .filter((section) => resolveRawSectionFamily(section) === family)
    .map((section) => getRawSectionText(section))
    .filter(Boolean);
}

function parseCertificationEntries(texts: string[]) {
  const entries: Array<{
    id: string;
    certificationName: string;
    issuingOrganization?: string;
    credentialId?: string;
  }> = [];
  texts.forEach((text) => {
    const chunks = text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    const segments = chunks.length > 0 ? chunks : [text.trim()];
    segments.forEach((segment) => {
      const lines = segment
        .split(/\n+/)
        .map((line) => line.replace(/^[-•*+\d.)\s]+/, "").trim())
        .filter(Boolean);
      if (lines.length === 0) return;
      const certificationName = lines[0] ?? "";
      if (!certificationName) return;
      const issuingOrganization = lines.find((line, index) => index > 0 && !/\b(19|20)\d{2}\b/.test(line));
      const credentialId = segment.match(/(?:credential|license|licence|cert(?:ification)?\s*id)\s*[:#-]?\s*([A-Z0-9-]+)/i)?.[1]?.trim();
      entries.push({
        id: `cert-${uuidv4()}`,
        certificationName,
        issuingOrganization: issuingOrganization || undefined,
        credentialId: credentialId || undefined,
      });
    });
  });
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Heuristics and String Manipulation Helpers                                 */
/* -------------------------------------------------------------------------- */

function splitList(input: string): string[] {
  return String(input)
    // Common separators: comma, newline, semicolon, pipe, middot, bullet (avoid splitting on '/')
    .split(/[,\n;|•·]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stripMarkdown(s: string): string {
  return s.replace(/\*\*|__+/g, "").replace(/`+/g, "").replace(/^\*+|\*+$/g, "").trim();
}

function stripLeadingSymbols(s: string): string {
  // Remove leading spaces (incl. NBSP), then common bullet symbols
  return s.replace(/^[\s\u00A0]+/, "").replace(/^[-–—•*+✔✓◦\s]+/u, "").trim();
}

function stripEmojiFlags(s: string): string {
  try {
    // Modern approach with Unicode property escapes
    return s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").trim();
  } catch {
    // Fallback for older JS environments
    return s.replace(/[\uD83C][\uDDE6-\uDDFF]/g, "").trim();
  }
}

function sanitizeToken(s: string): string {
  return stripLeadingSymbols(stripMarkdown(stripEmojiFlags(s))).replace(/\s{2,}/g, " ").trim();
}

const cleanToken = (input: unknown): string => {
  if (typeof input === "string") return sanitizeToken(input);
  if (input == null) return "";
  return sanitizeToken(String(input));
};

function normalizeLanguageNameFrontend(name: string): string | null {
  const cleaned = cleanToken(name).toLowerCase();
  if (!cleaned) return null;
  return LANGUAGE_NORMALIZATION_MAP[cleaned] ?? null;
}

const looksLikeEducationFragment = (raw: unknown): boolean => {
  const text = cleanToken(raw);
  if (!text) return false;
  if (DEGREE_TOKEN_RE.test(text)) return true;
  const hasDate = MONTH_YEAR_RE.test(text) || DATE_RANGE_RE.test(text);
  if (hasDate && EDUCATION_KEYWORD_RE.test(text)) return true;
  if (hasDate && text.split(/\s+/).length >= 4) return true;
  return false;
};

/* Clean up summary text by removing contact/address/link debris often leaked by parsers */
function cleanSummaryText(text: string): string {
  let s = String(text ?? "");
  // Drop raw URLs and emails
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
  // Drop phone-like long digit runs
  s = s.replace(/(?<!\d)\+?\d[\d\s().-]{6,}\d(?!\d)/g, " ");
  // Drop common noise tokens and social/link brands
  s = s.replace(/\b(Place of birth|Driving license|Links?|Resume Templates|Build this template)\b.*$/gim, " ");
  s = s.replace(/\b(LinkedIn|Pinterest|United States|USA|U\.S\.A\.)\b/gi, " ");
  // Remove stray "Full" (often from "Driving license Full") when isolated
  s = s.replace(/\bFull\b/gi, " ");
  // Remove inline street-address-looking segments anywhere in the string
  s = s.replace(/\b\d{1,6}\s+[A-Za-z0-9 .'-]+\b(?:Ave(?:nue)?|St(?:reet)?|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way)\b[^,\.;]*,?/gi, " ");
  // Remove inline city/state/zip patterns (e.g., Los Angeles, CA 90291)
  s = s.replace(/\b[A-Za-z][A-Za-z\s\.'-]+,\s*[A-Z]{2}\s*\d{4,6}\b/gi, " ");
  // Remove street-address-looking lines entirely
  const lines = s.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !!l && !/^\d{1,6}\s+.+\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way)\b\.?/i.test(l));
  s = lines.join(" ");
  return sanitizeToken(s);
}

function extractSummaryString(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    const candidate = (input as Record<string, unknown>).text ?? (input as Record<string, unknown>).summary;
    if (typeof candidate === "string") return candidate;
  }
  return "";
}

export function splitResponsibilitiesIntoBullets(input: string | null | undefined): string[] {
  const raw = String(input ?? "");
  if (!raw.trim()) return [];
  const normalized = raw
    .replace(/\r/g, "\n")
    .replace(/[•·●◦◆]+/g, "\n")
    .trim();
  const lines = normalized
    .split(/\n+/)
    .map((line) => sanitizeToken(line))
    .filter(Boolean);

  const bullets: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/[.?!]\s+[A-Z]/.test(line) && line.length > 140) {
      const sentences = line
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((sentence) => sanitizeToken(sentence))
        .filter((sentence) => sentence.length > 3);
      if (sentences.length) {
        bullets.push(...sentences);
        continue;
      }
    }
    bullets.push(line);
  }

  if (!bullets.length && lines.length === 1) {
    const lone = lines[0];
    const sentences = lone
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((sentence) => sanitizeToken(sentence))
      .filter((sentence) => sentence.length > 3);
    bullets.push(...sentences);
  }

  return dedupeCaseInsensitive(bullets.map((b) => b.replace(/\s*[.]+$/, "").trim()).filter(Boolean));
}

function isLikelyDateish(s: string): boolean {
  const lower = s.toLowerCase();
  if (MONTH_TOKENS.some((m) => lower.includes(m))) return true;
  if (/[–—-]/.test(s) && /\d{4}/.test(s)) return true;
  // Standalone year or month+year patterns
  if (/^\s*\d{4}\s*$/.test(s)) return true;
  if (/^\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*$/i.test(s)) return true;
  return false;
}

/* Normalize month tokens and convert to ISO date or year-only string; avoid epoch 1970 artifacts */
function normalizeMonthTokensEN(input: string): string {
  let s = input.normalize("NFC");
  const map: Record<string, string> = {
    january: "January", february: "February", march: "March", april: "April", may: "May", june: "June",
    july: "July", august: "August", september: "September", october: "October", november: "November", december: "December",
    jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", sept: "Sep", oct: "Oct", nov: "Nov", dec: "Dec"
  };
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(`\\b${k}\\b`, "gi");
    s = s.replace(re, v);
  }
  s = s.replace(/[\u2012\u2013\u2014\u2015]/g, "-");
  return s;
}
function normalizeDateToken(input: string): string {
  const raw = sanitizeToken(String(input ?? ""));
  if (!raw) return raw;
  const yearOnly = raw.match(/(?:^|\D)((19|20)\d{2})(?:$|\D)/);
  if (yearOnly && !/[A-Za-z]/.test(raw)) return `${yearOnly[1]}-01-01`;
  const s = normalizeMonthTokensEN(raw);
  // Handle explicit Month YYYY to avoid timezone drift
  const m = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
  if (m) {
    const monthMap: Record<string, number> = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Sept:8, Oct:9, Nov:10, Dec:11 };
    const monKey = m[1].slice(0,3).replace(/^[a-z]/, (c) => c.toUpperCase());
    const month = monthMap[monKey] ?? 0;
    const year = Number(m[2]);
    return new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString().slice(0,10);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString().slice(0, 10);
    if (iso === "1970-01-01" && !/1970/.test(raw)) return raw; // avoid epoch if not explicit
    return iso;
  }
  return raw;
}

function isBulletLine(s: string): boolean {
  return /^\s*[\-\–\—•*+]/.test(s);
}

function isLikelySkill(s: string): boolean {
  const words = s.trim().split(/\s+/);
  if (words.length > MAX_SKILL_WORD_COUNT) return false;
  if (isLikelyDateish(s)) return false;
  // Avoid matching long numbers like phone numbers or postal codes
  if (/\d{5,}/.test(s)) return false;
  // Filter out obvious verb-heavy or directive phrases that are not skills
  const lower = s.toLowerCase();
  const verbNoise = [
    "reading", "manufacturer", "instructions", "troubleshooting", "organizing", "repairs",
    "assessing", "equipment", "techniques", "needed", "ensure", "operation", "logging",
    "utilizing", "apprehending", "monitoring", "observations", "occurrences"
  ];
  const stopHits = verbNoise.filter((v) => lower.includes(v)).length;
  if (words.length >= 3 && stopHits >= 1) return false;
  // Avoid fragments starting with conjunctions
  if (/^(and|or)\b/i.test(s.trim())) return false;
  return true;
}

function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

function normalizeProjectBodyForComparison(input: string): string {
  return cleanToken(input)
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function dedupeProjectBodies(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = normalizeProjectBodyForComparison(item);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item.trim());
  }
  return out;
}

function isProjectBodySubsumedByRawBody(projectBody: string, rawBodies: string[]): boolean {
  const normalizedProject = normalizeProjectBodyForComparison(projectBody);
  if (!normalizedProject || normalizedProject.length < 24) return false;
  const normalizedProjectTitle = normalizeProjectBodyForComparison(projectBody.split(/\n/, 1)[0] ?? projectBody);
  const normalizedProjectName = normalizedProjectTitle.split("|", 1)[0]?.trim() ?? "";
  return rawBodies.some((rawBody) => {
    const normalizedRaw = normalizeProjectBodyForComparison(rawBody);
    if (normalizedRaw.length <= normalizedProject.length) return false;
    if (normalizedRaw.includes(normalizedProject)) return true;
    if (normalizedProjectTitle && normalizedRaw.includes(normalizedProjectTitle)) return true;
    if (normalizedProjectName.length >= 6 && normalizedRaw.includes(normalizedProjectName)) return true;
    return false;
  });
}

function looksLikeProjectMeta(text: string): boolean {
  const cleaned = cleanToken(text);
  if (!cleaned) return false;
  if (isLikelyDateish(cleaned)) return true;
  if (/\b(?:github|docker|react|flask|java|python|postgresql|maven|travisci|redis|api)\b/i.test(cleaned)) {
    return true;
  }
  if (cleaned.includes(",") && cleaned.split(/\s+/).length <= 18) return true;
  return false;
}

function splitProjectMetaAndDescription(segment: string): { meta: string; description: string } {
  const cleaned = cleanToken(segment);
  if (!cleaned) return { meta: "", description: "" };

  const dateRangePatterns = [
    /^(.*?\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*[–—-]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4}))\s+(.+)$/i,
    /^(.*?\b\d{4}\s*[–—-]\s*(?:present|current|\d{4}))\s+(.+)$/i,
  ];

  for (const pattern of dateRangePatterns) {
    const match = cleaned.match(pattern);
    if (!match) continue;
    return {
      meta: cleanToken(match[1]),
      description: cleanToken(match[2]),
    };
  }

  if (looksLikeProjectMeta(cleaned)) {
    return { meta: cleaned, description: "" };
  }

  return { meta: "", description: cleaned };
}

function materializeProjectItem(
  body: string,
  index: number,
): { id: string; title: string; meta?: string; description?: string } {
  const fallbackTitle = index === 0 ? "Projects" : `Project ${index + 1}`;
  const normalizedLines = String(body ?? "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => cleanToken(line))
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return { id: `project-${uuidv4()}`, title: fallbackTitle, description: "" };
  }

  const firstLine = normalizedLines[0] ?? "";
  const pipeSegments = firstLine
    .split("|")
    .map((segment) => cleanToken(segment))
    .filter(Boolean);

  if (pipeSegments.length > 3) {
    return {
      id: `project-${uuidv4()}`,
      title: fallbackTitle,
      description: normalizedLines.join("\n"),
    };
  }

  let title = pipeSegments[0] || firstLine || fallbackTitle;
  const metaParts: string[] = [];
  const descriptionParts: string[] = normalizedLines.slice(1);

  if (pipeSegments.length >= 2) {
    const middleSegments = pipeSegments.slice(1, -1);
    for (const segment of middleSegments) {
      if (looksLikeProjectMeta(segment)) metaParts.push(segment);
      else descriptionParts.unshift(segment);
    }

    const tail = pipeSegments[pipeSegments.length - 1] ?? "";
    const { meta, description } = splitProjectMetaAndDescription(tail);
    if (meta) metaParts.push(meta);
    if (description) descriptionParts.unshift(description);
  }

  if (pipeSegments.length === 2 && descriptionParts.length === 0) {
    const secondSegment = pipeSegments[1] ?? "";
    if (looksLikeProjectMeta(secondSegment)) metaParts.push(secondSegment);
    else descriptionParts.push(secondSegment);
  }

  const meta = dedupeCaseInsensitive(metaParts).join(" | ").trim();
  const description = descriptionParts.join("\n").trim();

  if (!title) title = fallbackTitle;

  return {
    id: `project-${uuidv4()}`,
    title,
    meta: meta || undefined,
    description: description || undefined,
  };
}

function mapLevelString(input?: string): "Beginner" | "Elementary" | "Intermediate" | "Advanced" | "Fluent" {
  const s = String(input ?? "").toLowerCase().trim();
  if (!s) return "Intermediate";
  if (/(native|mother)/.test(s)) return "Fluent";
  if (/fluent|c2|proficient/.test(s)) return "Fluent";
  if (/advanced|c1/.test(s)) return "Advanced";
  if (/intermediate|b1|b2/.test(s)) return "Intermediate";
  if (/elementary|a2/.test(s)) return "Elementary";
  if (/beginner|basic|a1/.test(s)) return "Beginner";
  return "Intermediate";
}

function parseLanguageToken(raw: string): { name: string; level: ReturnType<typeof mapLevelString> } | null {
  let s = sanitizeToken(raw);
  if (!s) return null;
  const match = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  let name = s;
  let level: ReturnType<typeof mapLevelString> = "Intermediate";
  if (match) {
    name = sanitizeToken(match[1]);
    level = mapLevelString(match[2]);
  }
  try {
    // Strip leading/trailing punctuation
    name = name.replace(/^\p{P}|\p{P}$/gu, "").trim();
  } catch {
    name = name.replace(/^[\.,;:()\[\]{}]+|[\.,;:()\[\]{}]+$/g, "").trim();
  }
  if (!name) return null;
  return { name, level };
}

function parseLanguagesFromHeadings(rawText: string): Array<{ name: string; level: ReturnType<typeof mapLevelString> }> {
  const out: Array<{ name: string; level: ReturnType<typeof mapLevelString> }> = [];
  const lines = String(rawText || "").split(/\r?\n/);
  const idx = lines.findIndex((l) => /^languages$/i.test(l.trim()));
  if (idx < 0) return out;

  const window: string[] = [];
  for (let i = idx + 1; i < Math.min(lines.length, idx + 12); i++) {
    const ln = lines[i]!.trim();
    if (!ln) break;
    // stop at next ALL-CAPS header
    if (/^[A-Z0-9 .,'-]{3,}$/.test(ln) && ln === ln.toUpperCase()) break;
    window.push(ln);
  }

  const tokens = splitList(window.join(", "));
  const seen = new Set<string>();
  for (const t of tokens) {
    const parsed = parseLanguageToken(t);
    if (parsed && parsed.name) {
      const key = parsed.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ name: parsed.name, level: parsed.level });
      }
    }
  }
  return out;
}

function sanitizeSkillName(s: string): string {
  let out = sanitizeToken(s).replace(/^✔\s*/u, "");
  out = out.replace(/[.,;:]+$/u, "");
  out = out.replace(/\([^)]*\)/g, " ");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

function textHasLetters(s?: string): boolean {
  if (!s) return false;
  return /[A-Za-z]/.test(s);
}

/** Heuristic: TitleCase tokens or "City, Country" are likely locations */
function isTitleCaseToken(s: string): boolean {
    const parts = s.trim().split(/\s+/);
    if (parts.length === 0 || parts.length > 4) return false;
    // Check if all parts start with a capital letter
    return parts.every(p => /^[A-Z][a-z]+(?:['-][A-Za-z]+)*$/.test(p));
}

function isLikelyLocation(s: string): boolean {
  const t = sanitizeToken(s);
  if (!t || /\d/.test(t)) return false; // Avoid addresses or codes
  if (/,/.test(t)) {
    const parts = t.split(",").map((x) => x.trim());
    if (parts.length >= 2 && parts.every(isTitleCaseToken)) return true;
    const lastPart = parts[parts.length - 1]!;
    if (/^[A-Z]{2,3}$/.test(lastPart)) return true; // e.g., NY, USA
  }
  if (/\b(city|town|village|province|county|state)\b/i.test(t)) return true;
  return isTitleCaseToken(t);
}

function isJobHeader(company: string, position: string): boolean {
  const hasCompanyLetters = textHasLetters(company);
  const hasPositionLetters = textHasLetters(position);
  const isCompanyDateish = isLikelyDateish(company) || isBulletLine(company);
  const isPositionDateish = isLikelyDateish(position) || isBulletLine(position);
  // Prevent treating obvious location-only tokens as headers
  if (!position && isLikelyLocation(company)) return false;
  if (!company && isLikelyLocation(position)) return false;
  return (hasCompanyLetters && !isCompanyDateish) || (hasPositionLetters && !isPositionDateish);
}


/* ------------------------------ Profile Helpers ------------------------------ */

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

const PROFILE_NAME_PREFIXES = [
  "curriculum vitae",
  "personal details",
  "contact details",
  "coordonnées personnelles",
  "coordonnees personnelles",
  "coordonnées",
  "coordonnees",
  "contacts",
  "contact",
  "profile",
  "summary",
  "objective",
  "name",
  "nom",
  "resume",
  "cv",
];

const PROFILE_NAME_PHRASE_BLOCKLIST = new Set([
  "curriculum vitae",
  "resume",
  "cv",
  "profile",
  "summary",
  "objective",
  "contact",
  "contacts",
  "contact details",
  "personal details",
  "coordonnees",
  "coordonnees personnelles",
  "certifications",
  "skills",
  "skill",
  "experience",
  "education",
  "formation",
  "languages",
  "langues",
  "sourcing",
  "subcontractor management",
  "excel with linkedin recruiter",
  "gestion de projet",
  "project management",
]);

const PROFILE_NAME_TOKEN_BLOCKLIST = new Set([
  "contact",
  "contacts",
  "coordonnees",
  "curriculum",
  "vitae",
  "resume",
  "profile",
  "summary",
  "objective",
  "certifications",
  "certification",
  "skills",
  "skill",
  "experience",
  "education",
  "formation",
  "languages",
  "langues",
  "linkedin",
  "excel",
  "recruiter",
  "recruitment",
  "talent",
  "acquisition",
  "lead",
  "manager",
  "director",
  "consultant",
  "coordinator",
  "specialist",
  "designer",
  "engineer",
  "guard",
  "security",
  "sourcing",
  "subcontractor",
  "management",
]);

const PROFILE_NAME_GEO_PHRASE_BLOCKLIST = new Set([
  "united arab emirates",
  "ile de france",
  "washington dc metro",
]);

const PROFILE_NAME_GEO_TOKEN_BLOCKLIST = new Set([
  "united",
  "arab",
  "emirates",
  "france",
  "paris",
  "dubai",
  "india",
  "luxembourg",
  "region",
  "metro",
  "state",
  "county",
  "province",
  "city",
  "country",
]);

const PROFILE_NAME_LINE_SCAN_LIMIT = 12;
const ALLOWED_SINGLE_WORD_ROLE_TOKENS = new Set(
  ROLE_PHRASES
    .map((phrase) => normalizeFallbackNameValue(phrase))
    .filter((phrase) => phrase && !phrase.includes(" "))
);

const UPSTREAM_DESIRED_POSITION_BLOCKLIST = new Set([
  "sourcing",
  "subcontractor management",
  "excel with linkedin recruiter",
  "gestion de projet",
  "project management",
  "recrutement international",
  "international recruitment",
]);

const UPSTREAM_LOCATION_BLOCKLIST = new Set([
  "united arab emirates",
  "france fr",
  "name of city reason for",
]);

const ROLEISH_PROFILE_TOKENS = new Set([
  "analyst",
  "consultant",
  "data",
  "design",
  "designer",
  "developer",
  "engineer",
  "excel",
  "guard",
  "lead",
  "linkedin",
  "management",
  "manager",
  "project",
  "projet",
  "recruiter",
  "recruitment",
  "recrutement",
  "science",
  "scientist",
  "security",
  "sourcing",
  "specialist",
  "subcontractor",
  "talent",
]);

function normalizeFallbackNameValue(value: string): string {
  const cleaned = sanitizeToken(value)
    .replace(/^[,.;:()\[\]{}]+|[,.;:()\[\]{}]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  try {
    return cleaned.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  } catch {
    return cleaned.toLowerCase();
  }
}

function stripFallbackNamePrefix(line: string): string {
  let candidate = sanitizeToken(line).replace(/^\s*#+\s*/, "").trim();
  for (const prefix of PROFILE_NAME_PREFIXES) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}(?:\\s*[:\\-–—|]\\s*|\\s+)`, "i");
    if (re.test(candidate)) {
      candidate = candidate.replace(re, "").trim();
      break;
    }
  }
  return candidate.replace(/^[,;:()\[\]{}]+|[,;:()\[\]{}]+$/g, "").trim();
}

function isLikelyFallbackNameLocation(value: string): boolean {
  const cleaned = sanitizeToken(value).replace(/[.,;:]+$/g, "").trim();
  if (!cleaned) return false;
  if (/,/.test(cleaned)) return true;
  const normalized = normalizeFallbackNameValue(cleaned);
  if (!normalized) return false;
  if (PROFILE_NAME_GEO_PHRASE_BLOCKLIST.has(normalized)) return true;
  if (/\b(city|town|village|province|county|state|region|metro|country)\b/i.test(cleaned)) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length >= 2 && tokens.every((token) => PROFILE_NAME_GEO_TOKEN_BLOCKLIST.has(token));
}

function formatFallbackNameTokens(tokens: string[]): string[] {
  return tokens.map((token) => {
    if (/^[A-ZÀ-ÖØ-Þ]{2,3}$/.test(token)) return token;
    if (/^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.-]+$/.test(token)) {
      return token.charAt(0) + token.slice(1).toLowerCase();
    }
    if (/^[a-zà-öø-ÿ]/.test(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
    return token;
  });
}

function deriveFallbackPersonName(line: string): string | undefined {
  const raw = stripFallbackNamePrefix(line);
  if (!raw) return undefined;
  if (raw.length < 4 || raw.length > 60) return undefined;
  if (/[@\d]/.test(raw) || /https?:\/\/|www\./i.test(line)) return undefined;
  if (/^[#>*`|]/.test(line.trim())) return undefined;
  if (/[\/\\]/.test(raw) || /[(){}\[\]]/.test(raw)) return undefined;

  const locationCandidate = raw.replace(/[.,;:]+$/g, "").trim();
  if (isLikelyFallbackNameLocation(locationCandidate)) return undefined;

  const normalizedWhole = normalizeFallbackNameValue(raw);
  if (!normalizedWhole) return undefined;
  if (PROFILE_NAME_PHRASE_BLOCKLIST.has(normalizedWhole)) return undefined;

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return undefined;
  if (tokens.some((token) => !/^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(token))) return undefined;

  const formattedTokens = formatFallbackNameTokens(tokens);
  const normalizedTokens = formattedTokens
    .map((token) => normalizeFallbackNameValue(token))
    .filter(Boolean);

  if (!normalizedTokens.length) return undefined;
  if (normalizedTokens.some((token) => PROFILE_NAME_TOKEN_BLOCKLIST.has(token))) return undefined;
  if (normalizedTokens.every((token) => PROFILE_NAME_TOKEN_BLOCKLIST.has(token))) return undefined;

  const titleishCount = formattedTokens.filter((token) =>
    /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’.-]*$/.test(token) || /^[A-ZÀ-ÖØ-Þ]{2,3}$/.test(token)
  ).length;
  if (titleishCount < Math.max(1, Math.floor(formattedTokens.length * 0.75))) return undefined;

  return formattedTokens.join(" ").replace(/\s{2,}/g, " ").trim();
}

function sanitizeUpstreamProfileName(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return deriveFallbackPersonName(value);
}

function sanitizeUpstreamDesiredPosition(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = String(value);
  const cleaned = sanitizeToken(raw).replace(/^[,;:()\[\]{}]+|[,;:()\[\]{}]+$/g, "").trim();
  if (!cleaned) return undefined;
  if (cleaned.length < 2 || cleaned.length > 80) return undefined;
  if (/^\s*[#>*`|]/.test(raw)) return undefined;
  if (/@|https?:\/\/|www\./i.test(raw)) return undefined;

  const normalized = normalizeFallbackNameValue(cleaned);
  if (!normalized) return undefined;
  if (PROFILE_NAME_PHRASE_BLOCKLIST.has(normalized)) return undefined;
  if (UPSTREAM_DESIRED_POSITION_BLOCKLIST.has(normalized)) return undefined;
  if (isLikelyFallbackNameLocation(cleaned)) return undefined;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && !ALLOWED_SINGLE_WORD_ROLE_TOKENS.has(normalized)) return undefined;
  if (tokens.length > 8) return undefined;
  if (tokens.some((token) => /[@\d]/.test(token))) return undefined;

  return cleaned;
}

function sanitizeUpstreamProfileLocation(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = String(value);
  const cleaned = cleanLocationOverlay(raw).replace(/^[,;:()\[\]{}]+|[,;:()\[\]{}]+$/g, "").trim();
  if (!cleaned) return undefined;
  if (cleaned.length < 3 || cleaned.length > 120) return undefined;
  if (/^\s*[#>*`|]/.test(raw)) return undefined;
  if (/@|https?:\/\/|www\./i.test(raw)) return undefined;

  const normalized = normalizeFallbackNameValue(cleaned);
  if (!normalized) return undefined;
  if (PROFILE_NAME_PHRASE_BLOCKLIST.has(normalized)) return undefined;
  if (UPSTREAM_DESIRED_POSITION_BLOCKLIST.has(normalized)) return undefined;
  if (UPSTREAM_LOCATION_BLOCKLIST.has(normalized)) return undefined;
  if (/^[A-Za-zÀ-ÖØ-öø-ÿ]+,\s*[A-Za-zÀ-ÖØ-öø-ÿ]{2}$/u.test(cleaned)) return undefined;
  if (/\b(name of city|reason for|designation from to duration|organization country leaving)\b/i.test(cleaned)) return undefined;
  if (/\b(floor|suite|unit|room|building|tower|block|accommodation)\b/i.test(cleaned) && /,\s*[A-Za-z]{1,3}\.?$/u.test(cleaned)) {
    return undefined;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return undefined;
  if (tokens.every((token) => PROFILE_NAME_TOKEN_BLOCKLIST.has(token))) return undefined;
  const parts = cleaned.split(",").map((part) => sanitizeToken(part).trim()).filter(Boolean);
  if (parts.length >= 2) {
    const trailing = normalizeFallbackNameValue(parts[parts.length - 1] ?? "");
    const leadingTokens = normalizeFallbackNameValue(parts.slice(0, -1).join(" "))
      .split(/\s+/)
      .filter(Boolean);
    const roleishLeadingCount = leadingTokens.filter((token) => ROLEISH_PROFILE_TOKENS.has(token)).length;
    if (trailing.length > 0 && trailing.length <= 3 && roleishLeadingCount >= Math.max(1, Math.floor(leadingTokens.length / 2))) {
      return undefined;
    }
  }

  return cleaned;
}

function sanitizeNormalizedProfileLocationValue(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = String(value);
  const cleaned = cleanLocationOverlay(raw).replace(/^[,;:()\[\]{}]+|[,;:()\[\]{}]+$/g, "").trim();
  if (!cleaned) return undefined;
  if (cleaned.length < 3 || cleaned.length > 120) return undefined;
  if (/^\s*[#>*`|]/.test(raw)) return undefined;
  if (/@|https?:\/\/|www\./i.test(raw)) return undefined;

  const normalized = normalizeFallbackNameValue(cleaned);
  if (!normalized) return undefined;
  if (PROFILE_NAME_PHRASE_BLOCKLIST.has(normalized)) return undefined;
  if (UPSTREAM_DESIRED_POSITION_BLOCKLIST.has(normalized)) return undefined;
  if (UPSTREAM_LOCATION_BLOCKLIST.has(normalized)) return undefined;
  if (/\b(name of city|reason for|designation from to duration|organization country leaving)\b/i.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function resolveMaterializedProfileLocation(normalized: PartialNormalizedCv): string | undefined {
  const orderedCandidates = [
    (normalized.profile as Record<string, unknown> | undefined)?.location,
    (normalized.details as Record<string, unknown> | undefined)?.location,
    (normalized as Record<string, unknown> | undefined)?.location,
    (normalized.contact as Record<string, unknown> | undefined)?.location,
    (normalized.contact as Record<string, unknown> | undefined)?.addressNormalized,
    (normalized.contact as Record<string, unknown> | undefined)?.address,
    (normalized as Record<string, unknown> | undefined)?.identitySchema &&
      typeof (normalized as Record<string, unknown>).identitySchema === "object"
      ? ((normalized as Record<string, unknown>).identitySchema as Record<string, unknown>).location
      : undefined,
  ];

  for (const candidate of orderedCandidates) {
    const sanitized = sanitizeNormalizedProfileLocationValue(candidate);
    if (sanitized) return sanitized;
  }

  return undefined;
}

/** Recursively aggregate short text fragments from a nested object. */
function aggregateStringsFromObject(input: unknown): string {
  const out: string[] = [];
  const seen = new Set<unknown>();

  function walk(node: unknown, depth: number) {
    if (out.join("\n").length >= MAX_AGGREGATED_STRING_LENGTH || depth <= 0 || node == null) return;
    if (typeof node === "string") {
      const s = node.trim();
      if (s.length >= 2) out.push(s);
      return;
    }
    if (typeof node !== "object" || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const v of node) walk(v, depth - 1);
    } else {
      const obj = node as Record<string, unknown>;
      const priorityKeys = ["header", "details", "profile", "contact", "links", "summary", "text", "rawText", "title"];
      const keys = [...Object.keys(obj).sort((a, b) => (priorityKeys.includes(a) ? -1 : 1))];
      for (const k of keys) walk(obj[k], depth - 1);
    }
  }

  walk(input, MAX_AGGREGATION_DEPTH);
  return out.join("\n").slice(0, MAX_AGGREGATED_STRING_LENGTH);
}

function getRawTextFromNormalized(norm: PartialNormalizedCv): string {
  try {
    const parts = [norm.rawText, norm.header, norm.text, norm.details].filter(s => typeof s === 'string');
    const base = parts.join("\n");
    // If base is too sparse, aggregate from the whole object as a fallback
    if (base.trim().length < MIN_AGGREGATED_TEXT_LENGTH) {
      return aggregateStringsFromObject(norm) || base;
    }
    return base;
  } catch {
    return aggregateStringsFromObject(norm);
  }
}

function pickBestPhoneFromText(text: string): string | undefined {
  const candidates: Array<{ raw: string; digits: number }> = [];
  const re = /(\+?\d[\d\s\-().]{8,}\d)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1]!;
    const digits = (raw.match(/\d/g) || []).length;
    if (digits >= 10 && digits <= 16) {
      candidates.push({ raw: raw.trim(), digits });
    }
  }
  if (candidates.length === 0) return undefined;
  // Prefer the candidate with the most digits
  candidates.sort((a, b) => b.digits - a.digits);
  return candidates[0]!.raw;
}

/* Email/phone guards for Profile merging */
function isValidEmail(s?: string): boolean {
  if (!s) return false;
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(s.trim());
}
function countDigits(s?: string): number {
  if (!s) return 0;
  const m = s.match(/\d/g);
  return m ? m.length : 0;
}
function chooseBetterPhone(existing?: string, candidate?: string): string | undefined {
  const d1 = countDigits(existing);
  const d2 = countDigits(candidate);
  const eValid = d1 >= 10 && d1 <= 16;
  const cValid = d2 >= 10 && d2 <= 16;
  if (cValid && (!eValid || d2 > d1)) return candidate;
  return eValid ? existing : candidate;
}

/* Pretty-print US phones for display: "+1 415 555 1212"
   - Sanitizes stray punctuation like unmatched parentheses
   - If 10 digits => assume +1; if 11 and starts with 1 => +1
*/
function prettyPrintUSPhone(value?: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    const a = digitsOnly.slice(1, 4);
    const b = digitsOnly.slice(4, 7);
    const c = digitsOnly.slice(7);
    return `+1 ${a} ${b} ${c}`;
  }
  if (digitsOnly.length === 10) {
    const a = digitsOnly.slice(0, 3);
    const b = digitsOnly.slice(3, 6);
    const c = digitsOnly.slice(6);
    return `+1 ${a} ${b} ${c}`;
  }
  // Fall back to returning the cleaned digits if plausible, otherwise the original
  if (digitsOnly.length >= 7 && digitsOnly.length <= 16) return digitsOnly;
  return value.trim();
}

/* Strip markdown links/emoji/link tokens and tidy text for location overlay */
function cleanLocationOverlay(input: string): string {
  let s = String(input ?? "");
  // Remove markdown links [text](url) entirely and raw urls
  s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "").replace(/https?:\/\/\S+/g, "");
  // Remove common link icons, bullets and pipes
  s = s
    .replace(/🔗|🔹|•|▪|◦/g, " ")
    .replace(/\|/g, " ");
  // Remove common link words that occasionally leak into location fields
  s = s.replace(/\b(LinkedIn|Portfolio|Certifications?|Resume Templates|Build this template)\b/gi, " ");
  s = sanitizeToken(s);
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}
function extractProfileFromText(text: string) {
  const out: Partial<Record<"name" | "email" | "phone" | "linkedin" | "website" | "desiredPosition" | "location", string>> = {};
  if (!text.trim()) return out;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isSectionBoundaryLine = (line: string): boolean => {
    const cleaned = line.replace(/^#+\s*/, "").trim();
    const family = resolveCanonicalHeadingFamily(cleaned);
    return Boolean(family && family !== "profile");
  };
  const topHeaderLines: string[] = [];
  for (const line of lines.slice(0, 12)) {
    if (topHeaderLines.length > 0 && isSectionBoundaryLine(line)) break;
    topHeaderLines.push(line);
  }
  const topHeaderText = topHeaderLines.join("\n");

  // Name: conservative top-of-document fallback only. Prefer missing name over noisy headings/roles/locations.
  const nameSearchLines = lines.slice(0, PROFILE_NAME_LINE_SCAN_LIMIT);
  const fallbackName = nameSearchLines
    .map((line) => deriveFallbackPersonName(line))
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (fallbackName) {
    out.name = fallbackName;
  }

  // Email
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) out.email = emailMatch[0];

  // Phone
  out.phone = pickBestPhoneFromText(text);

  // LinkedIn / Website
  const liMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  if (liMatch) out.linkedin = liMatch[0];
  const webMatch = text.match(/https?:\/\/(?!.*linkedin\.com)[^\s)]+/i);
  if (webMatch) out.website = webMatch[0];

  // Desired Position
  const extractRole = (s: string): string | undefined => {
    const hits = ROLE_PHRASES
      .map((p) => s.match(new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`, "i")))
      .filter(Boolean)
      .map((m) => m![0]!)
      .sort((a, b) => b.length - a.length);
    return hits[0];
  };
  const posLine = lines.find((l) => l === l.toUpperCase() && l.length <= 120 && textHasLetters(l));
  if (posLine) {
    const head = posLine.split(/[,\-–—]/)[0]!.trim();
    const role = extractRole(head) ?? extractRole(posLine);
    if (role) out.desiredPosition = toTitleCase(role);
  }
  if (!out.desiredPosition) {
    const anyRole = extractRole(text);
    if (anyRole) out.desiredPosition = toTitleCase(anyRole);
  }

  // Location: Enhanced — DETAILS window, broader header regex, "based in" patterns, footer scan
  // Prefer combining lines under DETAILS (street + city/state/zip + country) when present.
  const detailsIdx = lines.findIndex((l) => /^details$/i.test(l));
  if (detailsIdx !== -1) {
    const winLines = lines.slice(detailsIdx + 1, detailsIdx + 6).filter(Boolean);
    // Try to find a "City, ST ZIP" and optional country and use that full expression
    const joined = winLines.join(" ");
    const m = /([A-Za-z][A-Za-z\s\.'-]+?),\s*([A-Z]{2})\s*(\d{4,6})(?:,\s*([A-Za-z\s]+))?/i.exec(joined);
    if (m) {
      const city = sanitizeToken(m[1] ?? "");
      const st = m[2];
      const zip = m[3];
      const country = sanitizeToken(m[4] ?? "");
      // Try to pick a preceding street line
      const streetLine = winLines.find((l) => /^\d{1,6}\s+.+\b(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|way)\b\.?/i.test(l));
      const street = streetLine ? sanitizeToken(streetLine) : "";
      const cityPart = country ? `${city}, ${st} ${zip}, ${country}` : `${city}, ${st} ${zip}`;
      const composed = street ? `${street}, ${cityPart}` : cityPart;
      if (composed.trim()) out.location = composed;
    } else {
      // Fallback: first plausible title-case token line
      const firstLoc = winLines.find(isLikelyLocation);
      if (firstLoc) out.location = sanitizeToken(firstLoc);
    }
  }
  if (!out.location) {
    // Broader city/state/country header-style matches, but only within the top contact/header block.
    const headerMatch = topHeaderText.match(
      /([A-Z][A-Za-z]+|[A-Z]{2,})(?: [A-Z][A-Za-z]+| [A-Z]{2,})*,\s*[A-Z]{2}(?:\s+\d{4,6})?(?:,\s*(United States|USA|U\.S\.A\.|United Kingdom|UK|Canada|France|Germany|Italy|Spain|Portugal|Netherlands|Belgium|Switzerland|India))?/i
    );
    if (headerMatch) out.location = sanitizeToken((headerMatch[0] ?? "").trim());
  }
  if (!out.location) {
    // "Based in X" / "Location: X" / "Address: X" within the top contact/header block only.
    const basedMatch = topHeaderText.match(/\b(?:based in|location:|address:)\s*([A-Z][A-Za-z\s,]+(?:\d{5})?)/i);
    if (basedMatch) out.location = sanitizeToken((basedMatch[1] ?? "").trim());
  }

  return out;
}


/* -------------------------------------------------------------------------- */
/* Main Mapping and Consolidation Logic                                       */
/* -------------------------------------------------------------------------- */

interface ConsolidateDiag {
  jobs: number;
  bulletsMerged: number;
  dateMarkersApplied: number;
  locationsDetected: number;
}

/** Consolidates a raw experience array into structured job items. */
function consolidateExperience(expArr: any[]): { items: any[]; diag: ConsolidateDiag } {
  const items: any[] = [];
  const diag: ConsolidateDiag = { jobs: 0, bulletsMerged: 0, dateMarkersApplied: 0, locationsDetected: 0 };
  let currentJob: any | null = null;

  for (const entry of Array.isArray(expArr) ? expArr : []) {
    const rawCompany = String(entry?.company ?? "");
    const rawPosition = String(entry?.position ?? "");
    const company = sanitizeToken(rawCompany);
    const position = sanitizeToken(rawPosition);
    const rawResponsibilities =
      typeof entry?.responsibilities === "string"
        ? entry.responsibilities
        : typeof entry?.summary === "string"
          ? entry.summary
          : typeof entry?.description === "string"
            ? entry.description
            : "";
    const initialResponsibilities = sanitizeToken(rawResponsibilities);
    const explicitBullets = Array.isArray(entry?.responsibilityBullets)
      ? dedupeCaseInsensitive(
          (entry.responsibilityBullets as unknown[])
            .map((val) => sanitizeToken(String(val ?? "")))
            .filter(Boolean),
        )
      : [];
    const seededBullets = explicitBullets.length ? explicitBullets : splitResponsibilitiesIntoBullets(initialResponsibilities);

    const isLocFromCompany = !!company && isLikelyLocation(company) && !textHasLetters(position) && !isLikelyDateish(company);
    const isLocFromPosition = !!position && isLikelyLocation(position) && !textHasLetters(company) && !isLikelyDateish(position);
    
    // Case 1: Row is likely a location for the current job
    if (currentJob && (isLocFromCompany || isLocFromPosition)) {
      currentJob.location = sanitizeToken(isLocFromCompany ? company : position);
      diag.locationsDetected++;
      continue;
    }

    // Case 2: Row is a new job header
    if (isJobHeader(company, position)) {
      currentJob = {
        id: entry?.id ?? `exp-${uuidv4()}`,
        company: company || (textHasLetters(position) ? "" : " "), // Use space to prevent hiding field
        position: position || " ",
        startDate: entry?.startDate ?? entry?.from,
        endDate: entry?.isCurrent ? null : (entry?.endDate ?? entry?.to),
        isCurrent: !!entry?.isCurrent,
        achievements: Array.isArray(entry?.achievements) ? entry.achievements.map(String) : [],
        location: entry?.location ?? "",
        responsibilities: initialResponsibilities || null,
        responsibilityBullets: [...seededBullets],
      };
      items.push(currentJob);
      diag.jobs++;
      continue;
    }

    // Case 3: Row is a bullet point
    const bulletText = [rawPosition, rawCompany].find(isBulletLine);
    if (bulletText) {
      const cleanText = sanitizeToken(bulletText).replace(/^[\-\–\—•*+]\s*/, "").trim();
      if (currentJob) {
          if (cleanText) {
            if (looksLikeAchievementBullet(cleanText)) {
              currentJob.achievements = currentJob.achievements ?? [];
              currentJob.achievements.push(cleanText);
            } else {
            const existingArray = Array.isArray(currentJob.responsibilityBullets)
              ? currentJob.responsibilityBullets
              : [];
            currentJob.responsibilityBullets = dedupeCaseInsensitive([...existingArray, cleanText]);
            const existing = typeof currentJob.responsibilities === "string" ? currentJob.responsibilities : "";
            currentJob.responsibilities = existing ? `${existing} ${cleanText}` : cleanText;
          }
          diag.bulletsMerged++;
        }
      } else if (cleanText) {
        // Create a miscellaneous job to hold orphan bullets
        currentJob = {
          id: `exp-misc-${uuidv4()}`,
          company: "Miscellaneous",
          position: "Various Roles",
          startDate: undefined,
          endDate: undefined,
          isCurrent: false,
          achievements: [cleanText],
          location: "",
          responsibilities: null,
          responsibilityBullets: [],
        };
        items.push(currentJob);
        diag.jobs++;
        diag.bulletsMerged++;
      }
      continue;
    }

    // Case 4: Row is a date marker for the current job
    const dateToken = [rawCompany, rawPosition].map(s => sanitizeToken(s).replace(/\*/g, "")).find(isLikelyDateish);
    if (currentJob && dateToken) {
      const norm = normalizeDateToken(dateToken);
      if (/present|current/i.test(dateToken)) {
        currentJob.isCurrent = true;
        currentJob.endDate = null;
        if (!currentJob.startDate) currentJob.startDate = norm;
      } else if (!currentJob.startDate) {
        currentJob.startDate = norm;
      } else {
        currentJob.endDate = norm;
      }
      diag.dateMarkersApplied++;
      continue;
    }
    
    // Otherwise, ignore as noise.
  }

  items.forEach((job) => {
    if (!job) return;
    if (typeof job.responsibilities === "string") {
      const trimmed = sanitizeToken(job.responsibilities);
      job.responsibilities = trimmed || null;
    } else if (job.responsibilities == null) {
      job.responsibilities = null;
    }
    if (Array.isArray(job.responsibilityBullets)) {
      job.responsibilityBullets = dedupeCaseInsensitive(job.responsibilityBullets.map((b) => sanitizeToken(String(b))).filter(Boolean));
      if (job.responsibilityBullets.length === 0) {
        delete job.responsibilityBullets;
      } else if (!job.responsibilities) {
        job.responsibilities = job.responsibilityBullets.join("\n");
      }
    }
    if (Array.isArray(job.achievements)) {
      job.achievements = dedupeCaseInsensitive(job.achievements.map((a) => sanitizeToken(String(a))).filter(Boolean));
    }
  });

  return { items, diag };
}

/* Fallback parser for Experience when server normalization is empty */
function parseExperienceFromEmploymentHistory(rawText: string): Array<{
  id: string;
  company: string;
  position: string;
  location: string;
  achievements: string[];
  responsibilities: string | null;
  responsibilityBullets: string[];
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
}> {
  const items: Array<{
    id: string;
    company: string;
    position: string;
    location: string;
    achievements: string[];
    responsibilities: string | null;
    responsibilityBullets: string[];
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean;
  }> = [];

  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.trim());
  const findHeaderIdx = (label: RegExp) =>
    lines.findIndex((l) => label.test(l));
  let idx = findHeaderIdx(/^employment history$/i);
  if (idx < 0) idx = findHeaderIdx(/^experience$/i);
  if (idx < 0) return items;

  const window = lines.slice(idx + 1, Math.min(lines.length, idx + 120));
  let current: (typeof items)[number] | null = null;
  let looseBullets: string[] = [];

  const isAllCapsHeader = (ln: string) =>
    /^[A-Z0-9 .,'-]{3,}$/.test(ln) && ln === ln.toUpperCase();

  // Capture start and end of a date range like "Jan 2021 — Apr 2022" or "Jan 2021 - Present"
  const dateRangeRe =
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b\s*[\u2012\u2013\u2014\u2015\-]\s*\b((?:present|current|\d{4}(?:-\d{2})?))\b/i;
  // Also accept single month-year token lines
  const singleDateRe =
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/i;
  const dateRe = /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|(19|20)\d{2})\b/i;

  for (const lnRaw of window) {
    const ln = lnRaw.trim();
    if (!ln) continue;
    if (isAllCapsHeader(ln)) break;

    // Header formats: "Role at Company, Location" or "Company, Location"
    const atIdx = ln.toLowerCase().indexOf(" at ");
    const hasComma = ln.includes(",");
    // Avoid misclassifying descriptive sentences (e.g., "Responsible for ...") as headers
    const startsWithVerb = /^(Responsible|Introduced|Improved|Enhancing|Ensuring|Decreased|Increased|Monitoring|Inspecting|Maintaining)\b/i.test(ln);
    const looksHeader = !startsWithVerb && ((atIdx > 0 && hasComma) || (hasComma && /^[A-Z][A-Za-z]/.test(ln)));

    if (looksHeader) {
      let role = "";
      let rest = ln;
      if (atIdx > 0) {
        role = sanitizeToken(ln.slice(0, atIdx));
        rest = ln.slice(atIdx + 4);
      }
      const parts = rest.split(",").map((s) => sanitizeToken(s));
      const companyPart = parts[0] ?? "";
      const locPart = parts.slice(1).join(", ").trim();

      // Flush loose bullets into previous current if any
      if (current && looseBullets.length > 0) {
        current.achievements.push(...looseBullets);
        looseBullets = [];
      }

      current = {
        id: `exp-${uuidv4()}`,
        company: sanitizeToken(companyPart),
        position: sanitizeToken(role),
        location: sanitizeToken(locPart),
        achievements: [],
        responsibilities: null,
        responsibilityBullets: [],
      };
      items.push(current);
      continue;
    }

    if (current && (dateRangeRe.test(ln) || singleDateRe.test(ln))) {
      const mRange = ln.match(dateRangeRe);
      if (mRange) {
        const startTok = mRange[1];
        const endTok = mRange[2];
        const startNorm = normalizeDateToken(startTok);
        if (/present|current/i.test(endTok)) {
          current.isCurrent = true;
          current.endDate = null;
        } else {
          const endNorm = normalizeDateToken(endTok);
          current.endDate = endNorm;
        }
        if (!current.startDate) current.startDate = startNorm;
        continue;
      }
      const mSingle = ln.match(singleDateRe);
      if (mSingle) {
        const startTok = mSingle[1];
        const startNorm = normalizeDateToken(startTok);
        if (!current.startDate) current.startDate = startNorm;
        else current.endDate = startNorm;
        continue;
      }
    }

    // Capture a one-line role description immediately after header before bullets
    if (isBulletLine(ln)) {
      const t = sanitizeToken(ln).replace(/^[\-\–\—•*+]\s*/, "").trim();
      if (t) {
        if (current) {
          if (looksLikeAchievementBullet(t)) {
            current.achievements.push(t);
          } else {
            current.responsibilities = current.responsibilities
              ? `${current.responsibilities} ${t}`
              : t;
            current.responsibilityBullets.push(t);
          }
        } else {
          looseBullets.push(t);
        }
      }
      continue;
    }

    // Loose mode: infer a job from a date line with surrounding bullets
    if (!current && dateRe.test(ln)) {
      current = {
        id: `exp-${uuidv4()}`,
        company: "Inferred",
        position: "Professional Experience",
        location: "",
        achievements: looseBullets.slice(),
        startDate: ln,
        responsibilities: null,
        responsibilityBullets: [],
      };
      looseBullets = [];
      items.push(current);
      continue;
    }
  }

  // If we still have loose bullets and no current, create a misc entry
  if (looseBullets.length > 0 && !current) {
    items.push({
      id: `exp-misc-${uuidv4()}`,
      company: "Miscellaneous",
      position: "Various Roles",
      location: "",
      achievements: looseBullets,
      startDate: undefined,
      endDate: undefined,
      isCurrent: false,
      responsibilities: null,
      responsibilityBullets: [],
    });
  }

  items.forEach((job) => {
    if (!job) return;
    if (typeof job.responsibilities === "string") {
      const trimmed = sanitizeToken(job.responsibilities);
      job.responsibilities = trimmed || null;
    } else if (job.responsibilities == null) {
      job.responsibilities = null;
    }
    if (Array.isArray(job.responsibilityBullets)) {
      job.responsibilityBullets = dedupeCaseInsensitive(job.responsibilityBullets.map((b) => sanitizeToken(b))).filter(Boolean);
      if (!job.responsibilities && job.responsibilityBullets.length) {
        job.responsibilities = job.responsibilityBullets.join("\n");
      }
    }
  });

  return items;
}

function parseAchievementsFromText(rawText: string): Array<{ id: string; text: string }> {
  const items: Array<{ id: string; text: string }> = [];
  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.trim());
  const idx = lines.findIndex((l) => /^(achievements?|awards?|accomplishments?)$/i.test(l));
  if (idx < 0) return items;
  const isAllCapsHeader = (ln: string) =>
    /^[A-Z0-9 .,'-]{3,}$/.test(ln) && ln === ln.toUpperCase();
  const window = lines.slice(idx + 1, Math.min(lines.length, idx + 20));
  for (const ln of window) {
    if (!ln || isAllCapsHeader(ln)) break;
    if (isBulletLine(ln)) {
      const t = sanitizeToken(ln).replace(/^[\-\–\—•*+]\s*/, "").trim();
      if (t) items.push({ id: `ach-${uuidv4()}`, text: t });
    }
  }
  return items;
}

/** Helper to find the first valid string value for a set of keys across multiple objects. */
function findFirstValue(keyAliases: string[], sources: object[]): string | undefined {
    for (const source of sources) {
        for (const key of keyAliases) {
            const value = (source as Record<string, unknown>)[key];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }
    }
    return undefined;
}


/**
 * Builds typed CvSection arrays from a normalized server object.
 * This function creates structured content and eagerly creates representative
 * blocks for experience/education to avoid upload-time renderer handoffs.
 */
export function buildTypedSectionsFromNormalized(normalized: PartialNormalizedCv): CvSection[] {
  if (!normalized || typeof normalized !== "object") return [];

  const providedSections = Array.isArray((normalized as any).sections)
    ? ((normalized as any).sections as unknown[])
    : [];
  const directSections = validateSectionsLenient(providedSections);
  if (providedSections.length > 0 && directSections.length === providedSections.length) {
    return directSections;
  }

  const educationSpillover: string[] = [];
  const educationSpillSet = new Set<string>();

  const siphonEducationToken = (raw: unknown): boolean => {
    if (raw == null) return false;
    const candidate = cleanToken(typeof raw === "string" ? raw : String(raw));
    if (!candidate) return false;
    if (educationSpillSet.has(candidate.toLowerCase())) {
      return true;
    }
    if (
      looksLikeEducationFragment(candidate) ||
      MONTH_YEAR_RE.test(candidate) ||
      DATE_RANGE_RE.test(candidate)
    ) {
      educationSpillSet.add(candidate.toLowerCase());
      educationSpillover.push(candidate);
      return true;
    }
    return false;
  };

  let profileSection: CvSection | null = null;
  let summarySection: CvSection | null = null;
  let experienceSection: CvSection | null = null;
  let achievementsSection: CvSection | null = null;
  let educationSection: CvSection | null = null;
  let skillsSection: CvSection | null = null;
  let languagesSection: CvSection | null = null;
  let projectsSection: CvSection | null = null;
  let certificationsSection: CvSection | null = null;
  let hobbiesSection: CvSection | null = null;
  let affiliationsSection: CvSection | null = null;
  let additionalInformationSection: CvSection | null = null;

  // --- Summary ---
  // Avoid falling back to full rawText (too noisy). Only add Summary when provided.
  const summaryFirst = cleanSummaryText(
    typeof (normalized as any)?.summaryFirstSentence === "string"
      ? (normalized as any).summaryFirstSentence
      : ""
  );
  let summaryVal = cleanSummaryText(extractSummaryString(normalized.summary)) || summaryFirst;
  summaryVal = summaryVal.replace(/^[,;:|\u2013\u2014\-\s]+/, "").trim();
  if (summaryVal && summaryVal.length > 0) {
    summarySection = {
      id: `sec-summary-${uuidv4()}`,
      title: "Summary",
      type: "summary",
      blocks: [],
      collapsed: false,
      structuredContent: [{ id: `sum-${uuidv4()}`, summary: toRemirror(summaryVal) }],
    };
  }

  // --- Skills ---
  const rawSkills = Array.isArray(normalized.skills) ? normalized.skills : (typeof normalized.skillsText === 'string' ? splitList(normalized.skillsText) : []);
  const skillNames = rawSkills.map((s: any) => sanitizeSkillName(String(s?.name ?? s)));
  const skillItems = dedupeCaseInsensitive(skillNames.filter(isLikelySkill)).map(name => ({
    id: `sk-${uuidv4()}`, name, level: "Intermediate" as const, bucket: "secondary" as const,
  }));
  if (skillItems.length > 0) {
    skillsSection = {
      id: `sec-skills-${uuidv4()}`,
      title: "Skills",
      type: "skills",
      blocks: [],
      collapsed: false,
      structuredContent: skillItems,
    };
  }

  // --- Experience ---
  const expArr = Array.isArray(normalized.experience) ? normalized.experience : [];
  let expItems: any[] = [];
  if (expArr.length > 0) {
    const consolidated = consolidateExperience(expArr);
    expItems = consolidated.items;
  } else {
    const rawTextAll = getRawTextFromNormalized(normalized);
    const fallback = parseExperienceFromEmploymentHistory(rawTextAll);
    expItems = consolidateExperience(fallback).items;
  }
  if (expItems.length === 0) {
    const rawTextAll = getRawTextFromNormalized(normalized);
    const fallback = parseExperienceFromEmploymentHistory(rawTextAll);
    expItems = consolidateExperience(fallback).items;
  }
  if (expItems.length > 0) {
    experienceSection = {
      id: `sec-experience-${uuidv4()}`,
      title: "Experience",
      type: "experience",
      blocks: buildExperienceRepresentativeBlocks(expItems),
      collapsed: false,
      structuredContent: expItems,
    };
  }

  // --- Languages (pre-process to siphon education-like tokens) ---
  const languagesRawSource = Array.isArray(normalized.languagesRaw)
    ? (normalized.languagesRaw as unknown[]).slice()
    : [];
  const filteredLanguagesRaw = languagesRawSource
    .map((token) => (token == null ? "" : String(token)))
    .filter((token) => {
      if (!token) return false;
      if (siphonEducationToken(token)) return false;
      const cleaned = cleanToken(token);
      return Boolean(cleaned);
    })
    .map((token) => cleanToken(token));

  const canonicalNormalizedLanguages = Array.isArray(normalized.languages) ? (normalized.languages as any[]) : [];

  const canonicalLangItems: Array<{ id: string; name: string; level: string }> = [];
  const canonicalSeen = new Set<string>();
  const pushCanonicalLanguage = (rawName: unknown, level?: unknown) => {
    const cleaned = cleanToken(rawName);
    if (!cleaned) return;
    if (siphonEducationToken(cleaned)) return;
    const markEducationSpill = (candidate: string) => {
      const key = candidate.toLowerCase();
      if (!educationSpillSet.has(key)) {
        educationSpillSet.add(key);
        educationSpillover.push(candidate);
      }
    };
    if (
      DEGREE_TOKEN_RE.test(cleaned) ||
      MONTH_YEAR_RE.test(cleaned) ||
      DATE_RANGE_RE.test(cleaned) ||
      looksLikeEducationFragment(cleaned)
    ) {
      markEducationSpill(cleaned);
      return;
    }
    const canonicalName = normalizeLanguageNameFrontend(cleaned);
    if (!canonicalName) return;
    if (
      DEGREE_TOKEN_RE.test(canonicalName) ||
      MONTH_YEAR_RE.test(canonicalName) ||
      DATE_RANGE_RE.test(canonicalName)
    ) {
      markEducationSpill(canonicalName);
      return;
    }
    const key = canonicalName.toLowerCase();
    if (canonicalSeen.has(key)) return;
    canonicalSeen.add(key);
    const normalizedLevel = mapLevelString(typeof level === "string" ? level : String(level ?? ""));
    canonicalLangItems.push({ id: `lang-${uuidv4()}`, name: canonicalName, level: normalizedLevel });
  };

  for (const entry of canonicalNormalizedLanguages) {
    if (entry == null) continue;
    if (typeof entry === "object") {
      pushCanonicalLanguage((entry as any)?.name ?? "", (entry as any)?.level ?? "");
    } else {
      pushCanonicalLanguage(entry, "");
    }
  }

  if (canonicalLangItems.length === 0) {
    const initialRawLanguages = canonicalNormalizedLanguages.length > 0
      ? canonicalNormalizedLanguages
      : typeof normalized.languagesText === "string"
      ? splitList(normalized.languagesText)
      : [];

    const filteredRawLangs: any[] = [];
    for (const entry of initialRawLanguages) {
      if (entry == null) continue;
      if (typeof entry === "object") {
        const label = cleanToken(String((entry as any)?.name ?? ""));
        if (!label) continue;
        if (siphonEducationToken(label)) continue;
        filteredRawLangs.push({ ...entry, name: label });
      } else {
        const label = cleanToken(String(entry));
        if (!label) continue;
        if (siphonEducationToken(label)) continue;
        filteredRawLangs.push(label);
      }
    }

    let parsedLangs = filteredRawLangs
      .map((lang: any) =>
        parseLanguageToken(typeof lang === "object" ? `${lang.name ?? ""} (${lang.level ?? ""})` : String(lang))
      )
      .filter((v): v is NonNullable<typeof v> => !!v);
    if (parsedLangs.length === 0 && filteredLanguagesRaw.length > 0) {
      parsedLangs = filteredLanguagesRaw
        .map((token) => parseLanguageToken(token))
        .filter((v): v is NonNullable<typeof v> => !!v);
    }

    if (parsedLangs.length > 0) {
      for (const parsed of parsedLangs) {
        pushCanonicalLanguage(parsed.name, parsed.level);
      }
    } else {
      const rawTextAll = getRawTextFromNormalized(normalized);
      const fallbackLangs = parseLanguagesFromHeadings(rawTextAll);
      for (const lang of fallbackLangs) {
        pushCanonicalLanguage(lang.name, lang.level);
      }
    }
  }

  const langItems = canonicalLangItems.slice();

  if (langItems.length > 0) {
    languagesSection = {
      id: `sec-languages-${uuidv4()}`,
      title: "Languages",
      type: "languages",
      blocks: [],
      collapsed: false,
      structuredContent: langItems as any,
    };
  }

  // --- Education ---
  const eduArr = Array.isArray(normalized.education) ? normalized.education : [];

  function parseEducationFromText(rawText: string) {
    const items: Array<any> = [];
    const lines = String(rawText || "").split(/\r?\n/).map((l) => l.trim());
    const findHeaderIdx = (label: RegExp) => lines.findIndex((l) => label.test(l));
    let idx = findHeaderIdx(/^education$/i);
    if (idx < 0) idx = findHeaderIdx(/^formation$/i);
    if (idx < 0) return items;

    const window = lines.slice(idx + 1, Math.min(lines.length, idx + 50));
    const dateRe = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b\s*[–—-]\s*(?:present|current|\d{4})\b/i;
    const monthRangeRe = /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b\s*[–—-]\s*((?:present|current)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|(?:19|20)\d{2})\b/i;
    const yearRangeRe = /\b(?:19|20)\d{2}\b\s*[–—-]\s*(?:present|current|(?:19|20)\d{2})\b/i;
    const yearRangeCaptureRe = /\b((?:19|20)\d{2})\b\s*[–—-]\s*((?:present|current)|(?:19|20)\d{2})\b/i;
    const singleYearRe = /\b((?:19|20)\d{2})\b/;
    const isEducationBoundary = (value: string) => {
      if (!value) return true;
      if (/^languages?$/i.test(value)) return true;
      if (LANGUAGE_HEADING_PREFIX_RE.test(value)) return true;
      if (/^[A-Z0-9 .,'-]{3,}$/.test(value) && value === value.toUpperCase()) return true;
      return false;
    };
    const isInstitutionLine = (value: string) =>
      /(university|college|institute|school|academy|lyc[ée]e|faculty|facult[ée]|campus)/i.test(value);
    const isDegreeLine = (value: string) =>
      DEGREE_TOKEN_RE.test(value) ||
      /\b(major|minor|field of study|speciali[sz]ation|licence|bts|dut|classe préparatoire)\b/i.test(value);
    const isDateLine = (value: string) => dateRe.test(value) || yearRangeRe.test(value) || MONTH_YEAR_RE.test(value);
    const extractEducationDates = (value: string) => {
      const raw = value.trim();
      if (!raw) return { startDate: undefined, endDate: undefined, isCurrent: false };

      const monthRange = raw.match(monthRangeRe);
      if (monthRange) {
        const startDate = normalizeDateToken(monthRange[1]);
        const endToken = monthRange[2];
        const isCurrent = /present|current/i.test(endToken);
        return {
          startDate,
          endDate: isCurrent ? null : normalizeDateToken(endToken),
          isCurrent,
        };
      }

      const yearRange = raw.match(yearRangeCaptureRe);
      if (yearRange) {
        const startDate = normalizeDateToken(yearRange[1]);
        const endToken = yearRange[2];
        const isCurrent = /present|current/i.test(endToken);
        return {
          startDate,
          endDate: isCurrent ? null : normalizeDateToken(endToken),
          isCurrent,
        };
      }

      const monthYear = raw.match(MONTH_YEAR_RE);
      if (monthYear) {
        return {
          startDate: normalizeDateToken(monthYear[0]),
          endDate: undefined,
          isCurrent: false,
        };
      }

      const yearOnly = raw.match(singleYearRe);
      if (yearOnly) {
        return {
          startDate: normalizeDateToken(yearOnly[1]),
          endDate: undefined,
          isCurrent: false,
        };
      }

      return { startDate: undefined, endDate: undefined, isCurrent: false };
    };

    for (let i = 0; i < window.length; i++) {
      const ln = window[i]!.trim();
      if (!ln) continue;
      if (isEducationBoundary(ln)) break;

      // Pattern: "Program, Institution" or "Institution, Program"
      if (ln.includes(",")) {
        const [p1, ...tail] = ln.split(",");
        const rest = tail.join(",").trim();
        const first = sanitizeToken(p1);
        const second = sanitizeToken(rest);
        let degree = "";
        let institution = "";
        // Heuristic: if "University"/"College"/"Institute" appears, that's institution
        if (/(university|college|institute|school|academy)/i.test(second)) {
          degree = first;
          institution = second;
        } else if (/(university|college|institute|school|academy)/i.test(first)) {
          institution = first;
          degree = second;
        } else {
          // default split
          degree = first;
          institution = second;
        }

        const nextLine = window[i + 1]?.trim() ?? "";
        const dateInfo = isDateLine(nextLine) ? extractEducationDates(nextLine) : { startDate: undefined, endDate: undefined, isCurrent: false };

        items.push({
          id: `edu-${uuidv4()}`,
          institution,
          degree,
          fieldOfStudy: "",
          startDate: dateInfo.startDate,
          endDate: dateInfo.endDate,
          isCurrent: dateInfo.isCurrent,
          description: undefined,
          grade: "",
        });
        if (dateInfo.startDate || dateInfo.endDate !== undefined || dateInfo.isCurrent) i += 1;
        continue;
      }

      const nextLine = window[i + 1]?.trim() ?? "";
      const thirdLine = window[i + 2]?.trim() ?? "";

      if (isInstitutionLine(ln) && nextLine && !isEducationBoundary(nextLine)) {
        const institution = sanitizeToken(ln);
        const degree = isDegreeLine(nextLine) ? sanitizeToken(nextLine) : "";
        const fieldOfStudy =
          degree && thirdLine && !isEducationBoundary(thirdLine) && !isDateLine(thirdLine)
            ? sanitizeToken(thirdLine)
            : "";
        const dateCandidate =
          degree && fieldOfStudy
            ? window[i + 3]?.trim() ?? ""
            : degree
            ? thirdLine
            : nextLine;
        const dateInfo = isDateLine(dateCandidate)
          ? extractEducationDates(dateCandidate)
          : { startDate: undefined, endDate: undefined, isCurrent: false };

        items.push({
          id: `edu-${uuidv4()}`,
          institution,
          degree,
          fieldOfStudy,
          startDate: dateInfo.startDate,
          endDate: dateInfo.endDate,
          isCurrent: dateInfo.isCurrent,
          description: undefined,
          grade: "",
        });

        if ((dateInfo.startDate || dateInfo.endDate !== undefined || dateInfo.isCurrent) && degree && fieldOfStudy) i += 3;
        else if ((dateInfo.startDate || dateInfo.endDate !== undefined || dateInfo.isCurrent) && degree) i += 2;
        else if (degree && fieldOfStudy) i += 2;
        else if (degree) i += 1;
        continue;
      }

      if (isDegreeLine(ln) && nextLine && isInstitutionLine(nextLine)) {
        const degree = sanitizeToken(ln);
        const institution = sanitizeToken(nextLine);
        const fieldOfStudy =
          thirdLine && !isEducationBoundary(thirdLine) && !isDateLine(thirdLine)
            ? sanitizeToken(thirdLine)
            : "";
        const dateCandidate = fieldOfStudy ? window[i + 3]?.trim() ?? "" : thirdLine;
        const dateInfo = isDateLine(dateCandidate)
          ? extractEducationDates(dateCandidate)
          : { startDate: undefined, endDate: undefined, isCurrent: false };

        items.push({
          id: `edu-${uuidv4()}`,
          institution,
          degree,
          fieldOfStudy,
          startDate: dateInfo.startDate,
          endDate: dateInfo.endDate,
          isCurrent: dateInfo.isCurrent,
          description: undefined,
          grade: "",
        });

        if ((dateInfo.startDate || dateInfo.endDate !== undefined || dateInfo.isCurrent) && fieldOfStudy) i += 3;
        else if (dateInfo.startDate || dateInfo.endDate !== undefined || dateInfo.isCurrent) i += 2;
        else if (fieldOfStudy) i += 2;
        else i += 1;
        continue;
      }
    }
    return items.filter((e) => e.institution || e.degree);
  }

  let eduItems = eduArr
    .map((e: any) => ({
      id: e?.id ?? `edu-${uuidv4()}`,
      institution: sanitizeToken(String(e?.institution ?? e?.school ?? "")),
      degree: sanitizeToken(String(e?.degree ?? "")),
      fieldOfStudy: sanitizeToken(String(e?.fieldOfStudy ?? e?.major ?? "")),
      startDate: e?.startDate,
      endDate: e?.isCurrent ? null : e?.endDate,
      isCurrent: !!e?.isCurrent,
      description: e?.description ? toRemirror(e.description) : undefined,
      grade: typeof e?.grade === "string" ? e.grade : "",
    }))
    .filter((e) => e.institution || e.degree || e.fieldOfStudy);

  if (eduItems.length === 0) {
    const rawAll = getRawTextFromNormalized(normalized);
    eduItems = parseEducationFromText(rawAll);
  }

  if (educationSpillover.length > 0 && eduItems.length === 0) {
    const seenMigrated = new Set<string>();
    for (const text of educationSpillover) {
      const key = text.toLowerCase();
      if (seenMigrated.has(key)) continue;
      seenMigrated.add(key);
      eduItems.push({
        id: `edu-migrated-${uuidv4()}`,
        institution: "",
        degree: text,
        fieldOfStudy: "",
        startDate: undefined,
        endDate: undefined,
        isCurrent: undefined,
        description: toRemirror(text),
        grade: "",
      });
    }
  }

  // Consolidate curriculum-like orphan lines into previous education entry description
  try {
    const kw = /(University|College|Institute|International|Foundation|School|Academy)/i;
    const consolidated: any[] = [];
    for (const it of eduItems) {
      const institutionToken = typeof it.institution === "string" ? it.institution.trim() : "";
      const looksCurriculum =
        !!institutionToken &&
        !kw.test(institutionToken) &&
        !it.startDate &&
        !it.endDate &&
        institutionToken.split(/\s+/).length <= 12;
      if (looksCurriculum && consolidated.length > 0) {
        const prev = consolidated[consolidated.length - 1];
        const prevText = typeof prev.description === 'string' ? prev.description : '';
        const appended = [prevText, institutionToken, it.degree].filter(Boolean).join(' — ');
        prev.description = toRemirror(appended);
      } else {
        consolidated.push(it);
      }
    }
    eduItems = consolidated;
  } catch { /* noop */ }

  if (eduItems.length > 0) {
    educationSection = {
      id: `sec-education-${uuidv4()}`,
      title: "Education",
      type: "education",
      blocks: buildEducationRepresentativeBlocks(eduItems),
      collapsed: false,
      structuredContent: eduItems,
    };
  }

  // --- Profile ---
  const profileSources = [normalized, normalized.profile, normalized.details, normalized.contact, normalized.links].filter(s => typeof s === 'object' && s !== null);
  const profileItem = {
      id: `profile-${uuidv4()}`,
      name: sanitizeUpstreamProfileName(findFirstValue(["name"], profileSources)),
      email: findFirstValue(["email"], profileSources),
      phone: findFirstValue(["phone", "phoneNumber"], profileSources),
      linkedin: findFirstValue(["linkedin", "linkedIn"], profileSources.filter(s => String((s as any).linkedin ?? (s as any).linkedIn).includes('linkedin.com'))),
      website: findFirstValue(["website", "url", "site"], profileSources.filter(s => !String((s as any).website ?? (s as any).url).includes('linkedin.com'))),
      desiredPosition: sanitizeUpstreamDesiredPosition(findFirstValue(["desiredPosition", "title"], profileSources)),
      location: resolveMaterializedProfileLocation(normalized),
  };
  
  // Fallback profile extraction from raw text with guards
  const rawText = getRawTextFromNormalized(normalized);
  if (rawText) {
    const extracted = extractProfileFromText(rawText);
    if (!profileItem.name && extracted.name) {
      profileItem.name = sanitizeUpstreamProfileName(extracted.name) ?? profileItem.name;
    }
    // email: set when missing or invalid, but only if extracted is valid
    if ((!profileItem.email || !isValidEmail(profileItem.email)) && isValidEmail(extracted.email)) {
      profileItem.email = extracted.email;
    }
    // phone: prefer better candidate by digit length (10–16)
    profileItem.phone = chooseBetterPhone(profileItem.phone, extracted.phone) ?? profileItem.phone;
    // linkedin/website: only accept real URLs
    if (!profileItem.linkedin && extracted.linkedin && /^https?:\/\//i.test(extracted.linkedin)) {
      profileItem.linkedin = extracted.linkedin;
    }
    if (!profileItem.website && extracted.website && /^https?:\/\//i.test(extracted.website)) {
      profileItem.website = extracted.website;
    }
    if (!profileItem.desiredPosition && extracted.desiredPosition) {
      profileItem.desiredPosition = sanitizeUpstreamDesiredPosition(extracted.desiredPosition) ?? profileItem.desiredPosition;
    }
    if (!profileItem.location && extracted.location) {
      profileItem.location = sanitizeUpstreamProfileLocation(extracted.location) ?? profileItem.location;
    }
  }
  
  const profileFieldCount = Object.values(profileItem).filter(v => typeof v === 'string' && v.trim()).length;
  if (profileFieldCount >= 2) {
      profileSection = {
        id: `sec-profile-${uuidv4()}`,
        title: "Profile",
        type: "profile",
        blocks: [],
        collapsed: false,
        structuredContent: [profileItem] as any,
      };
  }
  
  // --- Achievements ---
  const achArr = Array.isArray(normalized.achievements) ? normalized.achievements : [];
  let achItems = achArr
    .map((a: any) => String(a?.text ?? a))
    .filter(Boolean)
    .map((text) => ({ id: `ach-${uuidv4()}`, text }));
  if (achItems.length === 0) {
    const rawAll = getRawTextFromNormalized(normalized);
    achItems = parseAchievementsFromText(rawAll);
  }
  if (achItems.length > 0) {
    achievementsSection = {
      id: `sec-achievements-${uuidv4()}`,
      title: "Achievements",
      type: "achievements",
      blocks: [],
      collapsed: false,
      structuredContent: achItems,
    };
  }

  const rawProjectBodies = dedupeProjectBodies(collectRawSectionBodies(normalized, "projects"));
  const structuredProjectBodies = dedupeProjectBodies(
    ((Array.isArray((normalized as any).projects)
      ? (normalized as any).projects.map((entry: any) => {
          const title = cleanToken(String(entry?.title ?? entry?.name ?? ""));
          const summary = cleanToken(String(entry?.summary ?? entry?.description ?? ""));
          return [title, summary].filter(Boolean).join("\n").trim();
        })
      : []) as string[]),
  ).filter((body) => !isProjectBodySubsumedByRawBody(body, rawProjectBodies));
  const projectBodies = dedupeCaseInsensitive([...rawProjectBodies, ...structuredProjectBodies]);
  if (projectBodies.length > 0) {
    const projectItems = projectBodies.map((body, index) => {
      const item = materializeProjectItem(body, index);
      const fallbackBody = cleanToken(body);
      return {
        ...item,
        description: item.description ?? fallbackBody,
      };
    });

    projectsSection = {
      id: `sec-projects-${uuidv4()}`,
      title: "Projects",
      type: "projects",
      blocks: projectItems.map((item, index) =>
        createTextBlock(
          item.title || (index === 0 ? "Projects" : `Project ${index + 1}`),
          [item.meta, item.description].filter(Boolean).join("\n").trim() || projectBodies[index] || "",
          item.id,
        ),
      ),
      collapsed: false,
      structuredContent: projectItems as any,
    };
  }

  const certificationEntries = parseCertificationEntries([
    ...collectRawSectionBodies(normalized, "certifications"),
    ...((Array.isArray((normalized as any).certifications)
      ? (normalized as any).certifications.map((entry: any) => [
          cleanToken(String(entry?.certificationName ?? entry?.name ?? entry?.title ?? "")),
          cleanToken(String(entry?.issuingOrganization ?? entry?.issuer ?? "")),
        ].filter(Boolean).join("\n"))
      : []) as string[]),
  ]);
  if (certificationEntries.length > 0) {
    certificationsSection = {
      id: `sec-certifications-${uuidv4()}`,
      title: "Certifications",
      type: "certifications",
      blocks: certificationEntries.map((entry) =>
        createTextBlock(
          entry.certificationName || "Certification",
          [entry.certificationName, entry.issuingOrganization].filter(Boolean).join("\n"),
          entry.id,
        ),
      ),
      collapsed: false,
      structuredContent: certificationEntries as any,
    };
  }

  const hobbyBodies = collectRawSectionBodies(normalized, "hobbies");
  if (hobbyBodies.length > 0) {
    hobbiesSection = {
      id: `sec-hobbies-${uuidv4()}`,
      title: "Hobbies",
      type: "text",
      blocks: hobbyBodies.map((body, index) => createTextBlock(index === 0 ? "Hobbies" : `Hobby ${index + 1}`, body)),
      collapsed: false,
      structuredContent: null,
    };
  }

  const affiliationBodies = collectRawSectionBodies(normalized, "affiliations");
  if (affiliationBodies.length > 0) {
    affiliationsSection = {
      id: `sec-affiliations-${uuidv4()}`,
      title: "Affiliations",
      type: "text",
      blocks: affiliationBodies.map((body, index) => createTextBlock(index === 0 ? "Affiliations" : `Affiliation ${index + 1}`, body)),
      collapsed: false,
      structuredContent: null,
    };
  }

  const additionalInformationBodies = collectRawSectionBodies(normalized, "additional_information");
  if (additionalInformationBodies.length > 0) {
    additionalInformationSection = {
      id: `sec-additional-information-${uuidv4()}`,
      title: "Additional Information",
      type: "text",
      blocks: additionalInformationBodies.map((body, index) =>
        createTextBlock(index === 0 ? "Additional Information" : `Additional Information ${index + 1}`, body),
      ),
      collapsed: false,
      structuredContent: null,
    };
  }

  // Canonical section order: profile → summary → experience → projects → achievements → education → certifications → skills → languages → affiliations → hobbies → additional information
  const ordered: CvSection[] = [];
  if (profileSection) ordered.push(profileSection);
  if (summarySection) ordered.push(summarySection);
  if (experienceSection) ordered.push(experienceSection);
  if (projectsSection) ordered.push(projectsSection);
  if (achievementsSection) ordered.push(achievementsSection);
  if (educationSection) ordered.push(educationSection);
  if (certificationsSection) ordered.push(certificationsSection);
  if (skillsSection) ordered.push(skillsSection);
  if (languagesSection) ordered.push(languagesSection);
  if (affiliationsSection) ordered.push(affiliationsSection);
  if (hobbiesSection) ordered.push(hobbiesSection);
  if (additionalInformationSection) ordered.push(additionalInformationSection);

  return ordered;
}

/**
 * Apply strict profile contact values into a typed sections array (Profile section),
 * ensuring validator-backed email/phone override weak or invalid values.
 *
 * This is a pure front-end helper to fuse server strict outputs into the UI CV document
 * so that contact fields (email/phone/location/desiredPosition/name) are consistent with
 * the robust backend extraction.
 */
export interface StrictContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  desiredPosition?: string | null;
}

export function applyStrictContactToSections(sections: CvSection[], strict?: StrictContact | null): CvSection[] {
  if (!Array.isArray(sections) || !strict || typeof strict !== "object") return sections;
  const out = sections.map((s) => ({ ...s }));

  const i = out.findIndex((s) => String(s?.type).toLowerCase() === "profile");
  if (i < 0) return out; // nothing to update
  const sec = out[i]!;

  if (!Array.isArray((sec as any).structuredContent) || (sec as any).structuredContent.length === 0) {
    // Keep non-invasive: if profile structuredContent missing, do not synthesize it here.
    return out;
  }

  const item = { ...(sec as any).structuredContent[0] } as any;

  // Name: accept non-empty text (do not overrule user-entered with null)
  if (typeof strict.name === "string" && strict.name.trim().length >= 2) {
    item.name = strict.name.trim();
  }

  // Email: prefer strict valid email when present
  if (typeof strict.email === "string" && isValidEmail(strict.email)) {
    item.email = strict.email.trim();
  } else if (!isValidEmail(item.email)) {
    // If existing is invalid but strict is not provided, leave as-is (caller can still use UI).
  }

  // Phone: prefer better candidate by digit length (10..16), reject short-digit noise (< 7)
  if (typeof strict.phone === "string" && strict.phone.trim()) {
    const digitsStrict = countDigits(strict.phone);
    if (digitsStrict >= 7) {
      const merged = chooseBetterPhone(item.phone, strict.phone);
      if (merged) item.phone = merged;
    }
  }
  // Pretty-print US numbers for display when 10/11 digits (assume +1 if missing)
  if (typeof item.phone === "string" && item.phone.trim()) {
    const pretty = prettyPrintUSPhone(item.phone);
    if (pretty) item.phone = pretty;
  }

  // Desired Position: prefer longer, more specific title from strict
  if (typeof strict.desiredPosition === "string" && strict.desiredPosition.trim()) {
    const current = String(item.desiredPosition ?? "").trim();
    const incoming = strict.desiredPosition.trim();
    if (!current || incoming.length > current.length) {
      item.desiredPosition = incoming;
    }
  }

  // Location: prefer longer normalized location string from strict; strip links/noise
  if (typeof strict.location === "string" && strict.location.trim()) {
    const currentRaw = String(item.location ?? "").trim();
    const incomingRaw = strict.location.trim();
    const currentClean = currentRaw ? cleanLocationOverlay(currentRaw) : "";
    const incomingClean = cleanLocationOverlay(incomingRaw);
    if (incomingClean) {
      if (!currentClean || incomingClean.length > currentClean.length) {
        item.location = incomingClean;
      } else if (!currentRaw && currentClean) {
        // ensure we still set a cleaned value if current existed only as noise
        item.location = currentClean;
      }
    }
  }

  // Persist updated profile item back into sections
  const structured = (sec as any).structuredContent.slice();
  structured[0] = item;
  (out[i] as any).structuredContent = structured;

  return out;
}

/**
 * Fallback converter from a lightweight reviewer format into typed CvSection objects.
 *
 * Normalizes fieldKey aliases (e.g., "introduction" -> "summary", "employment" -> "experience")
 * so downstream mapping gets the right buckets. Also aggregates a coarse rawText to power
 * heuristics for Experience/Achievements/Languages when structured fields are missing.
 */
export function buildTypedSectionsFromReviewerSections(
  reviewerSections: Array<{ id: string; title: string; content: string; fieldKey: string }>
): CvSection[] {
  if (!Array.isArray(reviewerSections)) return [];
  const normalized: PartialNormalizedCv = {};

  // Normalize fieldKey aliases
  const normalizeKey = (key: string, title?: string): string => {
    const k = String(key ?? "").toLowerCase().trim();
    const t = String(title ?? "").toLowerCase().trim();

    // Summary-like
    if (k === "introduction" || k === "profile" || k === "about" || k === "objective") return "summary";
    if (t.includes("summary") || t.includes("profile") || t.includes("objective")) return "summary";

    // Explicit direct sections
    if (k.includes("project")) return "projects";
    if (t.includes("project")) return "projects";
    if (k.includes("certif") || k.includes("license") || k.includes("licence")) return "certifications";
    if (t.includes("certif") || t.includes("license") || t.includes("licence")) return "certifications";
    if (k.includes("hobb") || k.includes("interest")) return "hobbies";
    if (t.includes("hobb") || t.includes("interest")) return "hobbies";
    if (k.includes("affiliation") || k.includes("membership") || k.includes("association")) return "affiliations";
    if (t.includes("affiliation") || t.includes("membership") || t.includes("association")) return "affiliations";
    if (k.includes("additional") || k.includes("supplementary") || k.includes("other information")) return "additional_information";
    if (t.includes("additional") || t.includes("supplementary") || t.includes("other information")) return "additional_information";

    // Experience-like
    if (k.includes("experience") || k.includes("employment") || k.includes("work")) return "experience";
    if (t.includes("experience") || t.includes("employment") || t.includes("work")) return "experience";

    // Skills-like (including languages buckets that some parsers map to skills)
    if (k.includes("skill") || k.includes("competence") || k.includes("technical")) return "skills";
    if (t.includes("skill") || t.includes("competence") || t.includes("technical")) return "skills";

    // Education-like
    if (k.includes("education") || k.includes("formation") || k.includes("studies") || k.includes("academic")) return "education";
    if (t.includes("education") || t.includes("formation") || t.includes("studies") || t.includes("academic")) return "education";

    // Achievements-like
    if (k.includes("achievement") || k.includes("award") || k.includes("publication")) return "achievements";
    if (t.includes("achievement") || t.includes("award") || t.includes("publication")) return "achievements";

    // Languages — keep separate
    if (k.includes("language") || t.includes("language")) return "languages";

    // Identity/contact/link sections are ignored here; profile fusion handles them via raw text.
    return k || "summary";
  };

  const mapByKey = reviewerSections.reduce((acc, sec) => {
    const keyNorm = normalizeKey(sec.fieldKey, sec.title);
    acc[keyNorm] = (acc[keyNorm] || []).concat(sec.content ?? "");
    return acc;
  }, {} as Record<string, string[]>);

  if (mapByKey.summary) normalized.summary = cleanSummaryText(mapByKey.summary.join("\n\n"));
  if (mapByKey.skills) normalized.skillsText = mapByKey.skills.join("\n");
  if (mapByKey.projects) {
    normalized.rawSections = [
      ...(Array.isArray(normalized.rawSections) ? normalized.rawSections : []),
      ...mapByKey.projects.map((content) => ({ label: "Projects", content })),
    ];
  }
  if (mapByKey.certifications) {
    normalized.rawSections = [
      ...(Array.isArray(normalized.rawSections) ? normalized.rawSections : []),
      ...mapByKey.certifications.map((content) => ({ label: "Certifications", content })),
    ];
  }
  if (mapByKey.hobbies) {
    normalized.rawSections = [
      ...(Array.isArray(normalized.rawSections) ? normalized.rawSections : []),
      ...mapByKey.hobbies.map((content) => ({ label: "Hobbies", content })),
    ];
  }
  if (mapByKey.affiliations) {
    normalized.rawSections = [
      ...(Array.isArray(normalized.rawSections) ? normalized.rawSections : []),
      ...mapByKey.affiliations.map((content) => ({ label: "Affiliations", content })),
    ];
  }
  if (mapByKey.additional_information) {
    normalized.rawSections = [
      ...(Array.isArray(normalized.rawSections) ? normalized.rawSections : []),
      ...mapByKey.additional_information.map((content) => ({ label: "Additional Information", content })),
    ];
  }

  const parseJsonField = (key: "experience" | "education") => {
    if (mapByKey[key]) {
      try {
        const parsed = JSON.parse(mapByKey[key][0] as string);
        normalized[key] = Array.isArray(parsed) ? parsed : [];
      } catch {
        normalized[key] = [];
      }
    }
  };

  parseJsonField("experience");
  parseJsonField("education");

  // Aggregate a coarse rawText from reviewer sections to power fallback heuristics (experience/achievements/languages)
  try {
    normalized.rawText = reviewerSections
      .map((s) => [s.title, s.content].filter(Boolean).join("\n"))
      .join("\n\n")
      .slice(0, MAX_AGGREGATED_STRING_LENGTH);
  } catch {
    /* noop */
  }

  return buildTypedSectionsFromNormalized(normalized);
}

/* -------------------------------------------------------------------------- */
/* AI-dispatched async variants                                               */
/* -------------------------------------------------------------------------- */

/** Normalize a dispatcher result into a raw array of unknown section-shaped values. */
function normalizeAiSectionsResult(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray((input as Record<string, unknown>).sections)) {
    return (input as Record<string, unknown>).sections as unknown[];
  }
  return [];
}

/** Validate and sanitize sections with CvSectionSchemaStrict, discarding invalid entries. */
function validateSectionsStrict(input: unknown[]): CvSection[] {
  const out: CvSection[] = [];
  for (const candidate of input) {
    const res = CvSectionSchemaStrict.safeParse(candidate);
    if (res.success) {
      // The strict schema strips unknown keys and ensures shape; cast to the TS interface for app use.
      out.push(res.data as unknown as CvSection);
    }
  }
  return out;
}

function validateSectionsLenient(input: unknown[]): CvSection[] {
  const out: CvSection[] = [];
  for (const candidate of input) {
    const res = CvSectionSchema.safeParse(candidate);
    if (res.success) {
      out.push(res.data as unknown as CvSection);
    }
  }
  return out;
}

/**
 * Async variant that builds typed sections from a normalized object using an AI dispatcher.
 *
 * The dispatcher should resolve to either { sections: CvSection[] } or CvSection[].
 * Each section is validated using CvSectionSchemaStrict; invalid sections are discarded.
 * If no valid sections are returned and fallbackToHeuristics !== false, this falls back
 * to buildTypedSectionsFromNormalized(normalized); otherwise returns [].
 *
 * Example usage with a Convex action (pseudocode; do not import Convex here):
 *
 *   const sections = await buildTypedSectionsFromNormalizedAsync(normalized, {
 *     dispatch: async ({ rawText, normalized, localeHint }) => {
 *       // const result = await convex.action("ai:dispatchSections", { rawText, normalized, localeHint });
 *       // return result; // either { sections } or sections[]
 *       return [];
 *     },
 *     rawText: serverExtractedText,       // optional override
 *     localeHint: "en-US",                // optional
 *     fallbackToHeuristics: true,         // default behavior
 *   });
 */
export async function buildTypedSectionsFromNormalizedAsync(
  normalized: PartialNormalizedCv,
  options: AiDispatchOptions
): Promise<CvSection[]> {
  const fallbackEnabled = options?.fallbackToHeuristics !== false;

  try {
    const aiResult = await options.dispatch({
      rawText: options?.rawText ?? getRawTextFromNormalized(normalized),
      normalized,
      localeHint: options?.localeHint,
    });

    const normalizedArr = normalizeAiSectionsResult(aiResult);
    const validated = validateSectionsStrict(normalizedArr);
    if (validated.length > 0) return validated;

    return fallbackEnabled ? buildTypedSectionsFromNormalized(normalized) : [];
  } catch (_err) {
    return fallbackEnabled ? buildTypedSectionsFromNormalized(normalized) : [];
  }
}

/**
 * Async variant that builds typed sections from lightweight reviewer sections using an AI dispatcher.
 *
 * Aggregates a minimal rawText from reviewer sections (titles + content) and constructs a coarse
 * normalized object (same transformation as the sync function) to provide context to the dispatcher.
 * Uses the same validation and fallback behavior as the normalized async variant.
 */
export async function buildTypedSectionsFromReviewerSectionsAsync(
  reviewerSections: Array<{ id: string; title: string; content: string; fieldKey: string }>,
  options: AiDispatchOptions
): Promise<CvSection[]> {
  const fallbackEnabled = options?.fallbackToHeuristics !== false;

  // Coarse normalization mirroring the sync implementation
  const normalized: PartialNormalizedCv = {};
  if (!Array.isArray(reviewerSections)) {
    return fallbackEnabled ? buildTypedSectionsFromReviewerSections(reviewerSections as any) : [];
  }

  const mapByKey = reviewerSections.reduce((acc, sec) => {
    const key = sec.fieldKey ?? "summary";
    acc[key] = (acc[key] || []).concat(sec.content ?? "");
    return acc;
  }, {} as Record<string, string[]>);

  if (mapByKey.summary) normalized.summary = cleanSummaryText(mapByKey.summary.join("\n\n"));
  if (mapByKey.skills) normalized.skillsText = mapByKey.skills.join("\n");

  const parseJsonField = (key: "experience" | "education") => {
    if (mapByKey[key]) {
      try {
        const parsed = JSON.parse(mapByKey[key][0] as string);
        normalized[key] = Array.isArray(parsed) ? parsed : [];
      } catch {
        normalized[key] = [];
      }
    }
  };

  parseJsonField("experience");
  parseJsonField("education");

  // Aggregate a minimal rawText signal similar to the sync approach
  const aggregatedRawText =
    options?.rawText ??
    reviewerSections
      .map((s) => [s.title, s.content].filter(Boolean).join("\n"))
      .join("\n\n")
      .slice(0, MAX_AGGREGATED_STRING_LENGTH);

  try {
    const aiResult = await options.dispatch({
      rawText: aggregatedRawText,
      normalized,
      localeHint: options?.localeHint,
    });

    const normalizedArr = normalizeAiSectionsResult(aiResult);
    const validated = validateSectionsStrict(normalizedArr);
    if (validated.length > 0) return validated;

    return fallbackEnabled ? buildTypedSectionsFromReviewerSections(reviewerSections) : [];
  } catch (_err) {
    return fallbackEnabled ? buildTypedSectionsFromReviewerSections(reviewerSections) : [];
  }
}
