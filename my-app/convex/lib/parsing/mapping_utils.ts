/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
// Shared regex helpers for CV mapping heuristics.

export const DEGREE_TOKEN_RE = /\b(certified(?:\s+\w+){1,3}\s+program|certificate(?:\s+program)?|course|curriculum|dipl[oô]me?|diplôme|bachelor|master|msc|bsc|mba|phd|programm?e|training|universit[ée]|university|college|institute|academy|foundation)\b/i;

export const MONTH_YEAR_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}\b/i;

export const DATE_RANGE_RE = /\b(19|20)\d{2}\b\s*(?:[-–—]\s*\b(19|20)\d{2}\b)?/i;

const EDUCATION_KEYWORD_RE = /\b(degree|program|course|certificate|diploma|bachelor|master|msc|bsc|mba|phd|university|college|school|academy|institute|curriculum|training|foundation)\b/i;

export function cleanToken(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.replace(/[\u2022•·◦]+/g, " ").replace(/\s+/g, " ").trim();
  // Strip unmatched leading/trailing brackets or pipes
  s = s.replace(/^[\)\]]+/, "").replace(/[\(\[]+$/, "");
  s = s.replace(/\s*\|\s*/g, " ").trim();
  // Remove dangling punctuation fragments at the edges
  s = s.replace(/[\s,;:\/]+$/g, "").replace(/^[,;:\/]+/g, "").trim();
  while (/[([{]$/.test(s)) {
    s = s.slice(0, -1).trim();
  }
  while (/^[)\]}]/.test(s)) {
    s = s.slice(1).trim();
  }
  return s;
}

export function looksLikeEducationFragment(raw: unknown): boolean {
  const text = cleanToken(raw);
  if (!text) return false;
  if (DEGREE_TOKEN_RE.test(text)) return true;
  const hasDate = MONTH_YEAR_RE.test(text) || DATE_RANGE_RE.test(text);
  if (hasDate && EDUCATION_KEYWORD_RE.test(text)) return true;
  // Standalone year ranges without explicit keywords are often degree summaries when length is long enough.
  if (hasDate && text.split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

export type RangeConfidence = "low" | "medium" | "high";

const TEMPLATE_NOISE = new Set([
  "resume templates",
  "build this template",
  "linkedin",
  "pinterest",
]);
const TEMPLATE_EMBLEM_RE = /^o\s+(skills|hobbies|interests)\s+o$/i;

export function isTemplateNoiseLine(raw: unknown): boolean {
  const text = cleanToken(raw);
  if (!text) return false;
  if (TEMPLATE_NOISE.has(text.toLowerCase())) return true;
  if (TEMPLATE_EMBLEM_RE.test(text)) return true;
  return false;
}

const CITY_STATE_RE = /^[A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s*\d{4,5}(?:-\d{4})?)?(?:,\s*[A-Za-z .'-]+)?$/;
const CITY_COUNTRY_RE = /^[A-Za-z][A-Za-z .'-]+,\s*[A-Za-z .'-]{3,}$/;

export function isValidLocationCandidate(raw: unknown): boolean {
  const text = cleanToken(raw);
  if (!text) return false;
  if (CITY_STATE_RE.test(text)) return true;
  if (CITY_COUNTRY_RE.test(text)) return true;
  return false;
}

const OPS_VERB_RE = /^(monitor|patrol|guard|secure|observe|log|report|ensure|conduct|maintain|scan|respond|coordinate|investigate|provide)\b/i;

export function lineStartsWithOpsVerb(line: string): boolean {
  const text = cleanToken(line).toLowerCase();
  if (!text) return false;
  return OPS_VERB_RE.test(text);
}

const ACHIEVEMENT_VERB_RE = /(improved|increased|reduced|decreased|cut|boosted|grew|expanded|implemented|installed|launched|deployed|introduced|automated)/i;
const ACHIEVEMENT_QUANTITY_RE = /(\b\d+%\b|\b\d{2,}\b)/;

export function classifyExperienceBullet(line: string): "achievement" | "responsibility" {
  const text = cleanToken(line);
  if (!text) return "responsibility";
  if (ACHIEVEMENT_VERB_RE.test(text) && ACHIEVEMENT_QUANTITY_RE.test(text)) return "achievement";
  if (ACHIEVEMENT_VERB_RE.test(text) && /\bby\b/.test(text.toLowerCase())) return "achievement";
  if (lineStartsWithOpsVerb(text)) return "responsibility";
  return ACHIEVEMENT_VERB_RE.test(text) ? "achievement" : "responsibility";
}

export const SECTION_TOKEN_RE = /\b(skills?|hobbies?|interests?|links?|languages?|details?|contact)\b/i;

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_TOKEN_RE = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i;
const YEAR_TOKEN_RE = /(19|20)\d{3}/;
const RANGE_CONNECTOR_RE = /\s*(?:[-–—]|to|until)\s*/i;

function parseDateToken(token: string): { iso: string; confidence: RangeConfidence } | null {
  const lower = token.trim().toLowerCase();
  const monthMatch = lower.match(MONTH_TOKEN_RE);
  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[1] as keyof typeof MONTH_MAP] ?? 1;
    const year = Number(monthMatch[2]);
    const date = new Date(Date.UTC(year, month - 1, 1));
    return { iso: date.toISOString().slice(0, 10), confidence: "high" };
  }
  const yearMatch = lower.match(YEAR_TOKEN_RE);
  if (yearMatch) {
    return { iso: `${yearMatch[0]}-01-01`, confidence: "low" };
  }
  return null;
}

export function extractDateRange(text: string): { matchedText: string; start?: string; end?: string | null; confidence: RangeConfidence } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[\u2013\u2014]/g, "-");
  const parts = normalized.split(RANGE_CONNECTOR_RE).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const start = parseDateToken(parts[0]);
  const endRaw = parts[1];
  const endIsPresent = /present|current|now|today/i.test(endRaw);
  const end = endIsPresent ? null : parseDateToken(endRaw);
  if (!start && !end && !endIsPresent) return null;
  const confidences: RangeConfidence[] = [];
  if (start) confidences.push(start.confidence);
  if (end) confidences.push(end.confidence);
  const confidence = confidences.includes("high") ? "high" : confidences.includes("medium") ? "medium" : "low";
  return {
    matchedText: trimmed,
    start: start?.iso,
    end: endIsPresent ? null : end?.iso,
    confidence,
  };
}

const COMPANY_HINT_RE = /(inc\.?|corp\.?|ltd\.?|llc|gmbh|company|group|partners|holdings|technologies|solutions|services|security|enterprise|enterprises)/i;
const ROLE_HINT_RE = /(manager|engineer|officer|specialist|guard|developer|consultant|analyst|lead|director|architect|technician|security)/i;

export function parseExperienceHeader(line: string): {
  match: "title_at_org" | "org_only" | "none";
  title?: string;
  organization?: string;
  location?: string;
} {
  const text = cleanToken(line);
  if (!text) return { match: "none" };

  const atMatch = text.match(/^(?<title>.+?)\s+(?:at|@)\s+(?<org>[^,]+?)(?:,\s*(?<loc>.+))?$/i);
  if (atMatch?.groups) {
    return {
      match: "title_at_org",
      title: cleanToken(atMatch.groups.title),
      organization: cleanToken(atMatch.groups.org),
      location: cleanToken(atMatch.groups.loc ?? "") || undefined,
    };
  }

  const dashMatch = text.match(/^(?<left>.+?)\s*[\-–—]\s*(?<right>.+)$/);
  if (dashMatch?.groups) {
    const left = cleanToken(dashMatch.groups.left);
    const right = cleanToken(dashMatch.groups.right);
    const leftOrg = COMPANY_HINT_RE.test(left);
    const rightOrg = COMPANY_HINT_RE.test(right);
    let organization: string | undefined;
    let title: string | undefined;
    if (leftOrg && !rightOrg) {
      organization = left;
      title = right;
    } else if (!leftOrg && rightOrg) {
      organization = right;
      title = left;
    } else if (!leftOrg && !rightOrg && ROLE_HINT_RE.test(left)) {
      organization = right;
      title = left;
    } else {
      organization = left;
      title = right;
    }
    return { match: "title_at_org", organization, title };
  }

  if (COMPANY_HINT_RE.test(text)) {
    const parts = text.split(/,\s*/);
    if (parts.length > 1) {
      return {
        match: "org_only",
        organization: cleanToken(parts[0]),
        location: cleanToken(parts.slice(1).join(", ")) || undefined,
      };
    }
    return { match: "org_only", organization: text };
  }

  return { match: "none" };
}
