import { v4 as uuidv4 } from "uuid";
import { isHeaderStopword, isGeoStopword, normalizeCandidateForStoplist } from "./constants/nameStopwords";
import { skillAliases, skillStoplist, canonicalSkills } from "./skillsCanonical";
import { normalizeLanguagesFromTextSync, normalizeLanguageTokenSync, CANONICAL_LANGUAGES } from "./languageNormalizer";
import { looksLikeEducationFragment } from "./mapping_utils";

export interface CanonicalizeContext {
  rawText: string;
  mode: string;
  parserUrl: string;
}

type RawSection = {
  label?: string | null;
  content?: string | null;
};

const SECTION_MAP = {
  EXPERIENCE: "experience",
  "EMPLOYMENT HISTORY": "experience",
  EDUCATION: "education",
  SKILLS: "skills",
  LANGUAGES: "languages",
  PROJECTS: "projects",
  ACTIVITIES: "projects",
  "PROJECTS & ACTIVITIES": "projects",
  "PROJECTS AND ACTIVITIES": "projects",
  ACHIEVEMENTS: "achievements",
  PROFILE: "profile",
  SUMMARY: "summary",
} as const;

const SECTION_LABEL_TO_KEY: Record<string, SectionKey> = Object.entries(SECTION_MAP).reduce(
  (acc, [label, key]) => {
    acc[label.toUpperCase()] = key;
    return acc;
  },
  {} as Record<string, SectionKey>,
);

type SectionKey = (typeof SECTION_MAP)[keyof typeof SECTION_MAP];

const SECTION_LABELS = Object.keys(SECTION_MAP);

function coerceString(value: unknown): string {
  if (value == null) return "";
  const str = String(value).replace(/\s+/g, " ").trim();
  return str;
}

function coerceId(value: unknown, prefix: string, index: number): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  try {
    return `${prefix}-${uuidv4()}`;
  } catch {
    return `${prefix}-fallback-${index}`;
  }
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null) as T[];
  }
  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLevelAnnotation(value: string): { text: string; level?: string } {
  let working = value.trim();
  let level: string | undefined;

  const parenMatch = working.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch.index !== undefined) {
    level = parenMatch[1].trim();
    working = working.slice(0, parenMatch.index).trim();
  }

  const suffixMatch = working.match(/(?:[\u2012\u2013\u2014\u2015\-]|[:])\s*(beginner|intermediate|advanced|expert|native|fluent|elementary|professional|bilingual|conversational|basic)$/i);
  if (suffixMatch && suffixMatch.index !== undefined) {
    level = level ?? suffixMatch[1].trim();
    working = working.slice(0, suffixMatch.index).trim();
  }

  return { text: working.trim(), level };
}

function dedupeStringsCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = coerceString(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeDedupeString(value: unknown): string {
  return coerceString(value)
    .replace(/[*_`#]+/g, " ")
    .replace(/[•·●▪◦◆■□▶➤▸◉►]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;,.]+/, "")
    .replace(/[\s\-–—:;,.]+$/, "")
    .trim()
    .toLowerCase();
}

function normalizeExperienceKeyPart(value: unknown): string {
  return normalizeDedupeString(value).replace(/[|]+/g, " ");
}

function hasExperienceDateSignal(entry: any): boolean {
  return Boolean(
    coerceString(entry?.startDate ?? "") ||
      coerceString(entry?.endDate ?? "") ||
      entry?.isCurrent === true,
  );
}

function getExperienceIdentityKey(entry: any): string | null {
  const company = normalizeExperienceKeyPart(entry?.company ?? "");
  const position = normalizeExperienceKeyPart(entry?.position ?? "");
  if (!company || !position) return null;
  if (!hasExperienceDateSignal(entry)) return null;
  const startDate = normalizeExperienceKeyPart(entry?.startDate ?? "");
  const endDate = entry?.isCurrent ? "__current__" : normalizeExperienceKeyPart(entry?.endDate ?? "");
  return [company, position, startDate, endDate].join("|");
}

function countExperienceContent(entry: any): number {
  const bulletCount = Array.isArray(entry?.responsibilityBullets) ? entry.responsibilityBullets.length : 0;
  const achievementCount = Array.isArray(entry?.achievements) ? entry.achievements.length : 0;
  const summaryScore = coerceString(entry?.summary ?? "").length > 0 ? 1 : 0;
  const responsibilitiesScore = coerceString(entry?.responsibilities ?? "").length > 0 ? 1 : 0;
  const locationScore = coerceString(entry?.location ?? "").length > 0 ? 1 : 0;
  return bulletCount * 3 + achievementCount * 2 + summaryScore + responsibilitiesScore + locationScore;
}

function mergeExperienceEntriesStrict(primary: any, duplicate: any): any {
  const base = { ...primary };
  const other = duplicate ?? {};

  const mergedBullets = dedupeStringsCaseInsensitive(
    [
      ...(Array.isArray(base?.responsibilityBullets) ? base.responsibilityBullets : []),
      ...(Array.isArray(other?.responsibilityBullets) ? other.responsibilityBullets : []),
    ]
      .map((value: unknown) => coerceString(value))
      .filter(Boolean),
  );
  if (mergedBullets.length) {
    base.responsibilityBullets = mergedBullets;
    if (!coerceString(base.responsibilities ?? "")) {
      base.responsibilities = mergedBullets.join("\n");
    }
  }

  const mergedAchievements = dedupeStringsCaseInsensitive(
    [
      ...(Array.isArray(base?.achievements) ? base.achievements : []),
      ...(Array.isArray(other?.achievements) ? other.achievements : []),
    ]
      .map((value: unknown) => coerceString(value))
      .filter(Boolean),
  );
  if (mergedAchievements.length) {
    base.achievements = mergedAchievements;
  }

  if (!coerceString(base.summary ?? "") && coerceString(other.summary ?? "")) {
    base.summary = other.summary;
  }
  if (!coerceString(base.location ?? "") && coerceString(other.location ?? "")) {
    base.location = other.location;
  }
  if (!coerceString(base.responsibilities ?? "") && coerceString(other.responsibilities ?? "")) {
    base.responsibilities = other.responsibilities;
  }
  if (!base.startDate && other.startDate) {
    base.startDate = other.startDate;
  }
  if ((base.endDate === undefined || base.endDate === null) && other.endDate !== undefined) {
    base.endDate = other.endDate;
  }
  if (!base.isCurrent && other.isCurrent) {
    base.isCurrent = other.isCurrent;
  }

  const provenance = new Set<string>(
    [
      ...(Array.isArray(base?.provenanceTags) ? base.provenanceTags : []),
      ...(Array.isArray(other?.provenanceTags) ? other.provenanceTags : []),
      "heuristic:strict_duplicate_merge",
    ]
      .map((value: unknown) => coerceString(value))
      .filter(Boolean),
  );
  if (provenance.size) {
    base.provenanceTags = Array.from(provenance);
  }

  return base;
}

function dedupeExperienceEntriesStrict(entries: any[]): any[] {
  const deduped: any[] = [];
  const seen = new Map<string, number>();

  for (const entry of entries) {
    if (!entry) continue;
    const identity = getExperienceIdentityKey(entry);
    if (!identity) {
      deduped.push(entry);
      continue;
    }

    const existingIndex = seen.get(identity);
    if (existingIndex === undefined) {
      seen.set(identity, deduped.length);
      deduped.push(entry);
      continue;
    }

    const existing = deduped[existingIndex];
    const existingScore = countExperienceContent(existing);
    const nextScore = countExperienceContent(entry);
    const richer = nextScore > existingScore ? entry : existing;
    const weaker = nextScore > existingScore ? existing : entry;
    deduped[existingIndex] = mergeExperienceEntriesStrict(richer, weaker);
  }

  return deduped;
}

function normalizeAchievementForComparison(value: unknown): string {
  return normalizeDedupeString(value)
    .replace(/\s+/g, " ")
    .replace(/[.]+$/g, "")
    .trim();
}

function extractAchievementNumbers(value: string): string[] {
  return Array.from(value.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)).map((match) => match[0]);
}

function hasConflictingAchievementNumbers(a: string, b: string): boolean {
  const aNumbers = extractAchievementNumbers(a);
  const bNumbers = extractAchievementNumbers(b);
  if (!aNumbers.length || !bNumbers.length) return false;
  const sameLength = aNumbers.length === bNumbers.length;
  if (!sameLength) return true;
  return aNumbers.some((value, index) => value !== bNumbers[index]);
}

function isLikelyClippedAchievementVariant(shorter: string, longer: string): boolean {
  if (shorter.length < 24) return false;
  if (shorter.length >= longer.length) return false;
  if (!longer.startsWith(shorter)) return false;
  if (shorter.split(/\s+/).filter(Boolean).length < 3) return false;
  const ratio = shorter.length / longer.length;
  return ratio >= 0.4;
}

function dedupeAchievementTextsConservative(values: string[]): string[] {
  const resolved: Array<{ raw: string; normalized: string }> = [];

  const upsert = (value: string) => {
    const raw = coerceString(value);
    if (!raw) return;
    const normalized = normalizeAchievementForComparison(raw);
    if (!normalized) return;

    for (let index = 0; index < resolved.length; index += 1) {
      const existing = resolved[index]!;
      if (existing.normalized === normalized) {
        if (raw.length > existing.raw.length) {
          resolved[index] = { raw, normalized };
        }
        return;
      }

      if (hasConflictingAchievementNumbers(existing.normalized, normalized)) {
        continue;
      }

      if (isLikelyClippedAchievementVariant(existing.normalized, normalized)) {
        resolved[index] = { raw, normalized };
        return;
      }
      if (isLikelyClippedAchievementVariant(normalized, existing.normalized)) {
        return;
      }
    }

    resolved.push({ raw, normalized });
  };

  values.forEach(upsert);
  return resolved.map((entry) => entry.raw);
}

function splitResponsibilitiesText(input: unknown): string[] {
  const text = coerceString(input);
  if (!text) return [];

  const normalized = text
    .replace(/[•·●◦◆]+/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2022/g, "\n")
    .trim();
  if (!normalized) return [];

  const rawLines = normalized
    .split(/\n+/)
    .map((line) => line.replace(/^[\-\u2012\u2013\u2014\u2015*\u2022\s]+/, "").trim())
    .filter((line) => line.length > 0);
  if (!rawLines.length) return [];

  const candidateLines: string[] = [];
  for (const line of rawLines) {
    if (!candidateLines.length) {
      candidateLines.push(line);
      continue;
    }
    if (/^[a-z]/.test(line) || /^(and|or|including|utilizing|leveraging|ensuring|monitoring|logging|maintaining|apprehending|providing|coordinating|managing|supporting)\b/i.test(line)) {
      const lastIdx = candidateLines.length - 1;
      candidateLines[lastIdx] = `${candidateLines[lastIdx]} ${line}`.replace(/\s{2,}/g, " ").trim();
    } else {
      candidateLines.push(line);
    }
  }

  const items: string[] = [];
  for (const line of candidateLines) {
    if (!line) continue;
    if (/[.?!]\s+[A-Z]/.test(line) && line.length > 140) {
      // Sentence-heavy paragraph: split on sentence boundaries when clearly delimited.
      const sentences = line
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 3);
      if (sentences.length) {
        items.push(...sentences);
        continue;
      }
    }
    const trimmed = line.replace(/\s*[;:,]+$/, "").trim();
    if (!trimmed) continue;
    const withoutDate = stripLeadingDatePrefix(trimmed).replace(/^\b(?:to\s+)?(?:present|current|till\s+date|till\s+now|till\s+present|till\s+today)\b[\s,.-]*/i, "").trim();
    if (withoutDate.length > 2) {
      items.push(withoutDate);
    }
  }

  if (!items.length && candidateLines.length === 1) {
    const lone = candidateLines[0];
    const sentences = lone
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 3);
    if (sentences.length) {
      items.push(...sentences);
    }
  }

  const normalizedSingleLine = normalized.replace(/\s+/g, " ");
  const responsibleMatch = normalizedSingleLine.match(/\bResponsible for\b[^.?!]*[.?!]?/i);
  if (responsibleMatch) {
    const candidate = stripLeadingDatePrefix(responsibleMatch[0])
      .replace(/\s*[.?!]+$/, "")
      .trim();
    if (candidate && !items.some((entry) => entry.toLowerCase() === candidate.toLowerCase())) {
      items.unshift(candidate);
    }
  }

  return dedupeStringsCaseInsensitive(items.map((item) => item.replace(/\s*[.]+$/, "").trim()).filter(Boolean));
}

function mergeNarrativeIntoExperience(target: any, source: any): boolean {
  if (!target || !source) return false;

  const ensureProvenanceTag = (entry: any, tag: string) => {
    if (!entry) return;
    const existing: string[] = Array.isArray(entry.provenanceTags) ? entry.provenanceTags : [];
    if (existing.includes(tag)) return;
    entry.provenanceTags = [...existing, tag];
  };

  const collectBullets = (entry: any): string[] => {
    if (Array.isArray(entry?.responsibilityBullets) && entry.responsibilityBullets.length > 0) {
      return entry.responsibilityBullets.map((val: unknown) => coerceString(val)).filter(Boolean);
    }
    const extraSegments =
      Array.isArray((entry as any)?.__extraNarrative) && (entry as any).__extraNarrative.length > 0
        ? ((entry as any).__extraNarrative as string[])
        : [];
    const text = coerceString(entry?.responsibilities ?? entry?.summary ?? "");
    const segments = [...extraSegments];
    if (text) segments.push(text);
    if (!segments.length) return [];
    return segments.flatMap((segment) => splitResponsibilitiesText(segment));
  };

  const sourceBullets = collectBullets(source);
  const targetBullets = collectBullets(target);
  let changed = false;

  if (sourceBullets.length) {
    const mergedBullets = dedupeStringsCaseInsensitive([...targetBullets, ...sourceBullets]);
    if (mergedBullets.length) {
      target.responsibilityBullets = mergedBullets;
      target.responsibilities = mergedBullets.join("\n");
      changed = true;
    }
  }

  const sourceSummary = coerceString(source?.summary ?? "");
  if (sourceSummary && !coerceString(target?.summary ?? "")) {
    target.summary = sourceSummary;
    changed = true;
  }

  const sourceAchievements = Array.isArray(source?.achievements) ? source.achievements.map((val: unknown) => coerceString(val)).filter(Boolean) : [];
  if (sourceAchievements.length) {
    const existing = Array.isArray(target?.achievements) ? target.achievements.map((val: unknown) => coerceString(val)).filter(Boolean) : [];
    const merged = dedupeStringsCaseInsensitive([...existing, ...sourceAchievements]);
    if (merged.length) {
      target.achievements = merged;
      changed = true;
    }
  }

  if (!coerceString(target?.location ?? "") && coerceString(source?.location ?? "")) {
    target.location = source.location;
    changed = true;
  }

  if (!target.startDate && source.startDate) {
    target.startDate = source.startDate;
    changed = true;
  }

  if ((target.endDate === undefined || target.endDate === null) && source.endDate !== undefined) {
    target.endDate = source.endDate;
    changed = true;
  }

  if (source.isCurrent && !target.isCurrent) {
    target.isCurrent = source.isCurrent;
    changed = true;
  }

  if (changed) {
    ensureProvenanceTag(target, "heuristic:narrative_merge");
  }
  return changed;
}

function sanitizeExperienceEntries(entries: any[]): any[] {
  const merged: any[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    const clone = { ...entry };
    let company = coerceString(clone?.company ?? "");
    if (company && NARRATIVE_VERB_RE.test(company)) {
      clone.company = "";
    }
    if (company) {
      const head = company.trim().split(/\s+/).slice(0, 3).join(" ");
      if (NARRATIVE_VERB_RE.test(head)) {
        clone.company = "";
      }
    }
    company = coerceString(clone?.company ?? "");
    const position = coerceString(clone?.position ?? "");
    const bullets = Array.isArray(clone?.responsibilityBullets)
      ? clone.responsibilityBullets.map((val: unknown) => coerceString(val)).filter(Boolean)
      : [];
    const textResponsibilities = coerceString(clone?.responsibilities ?? "");
    const locationText = coerceString(clone?.location ?? "");
    let locationNarrative: string[] = [];
    if (locationText) {
      const words = locationText.split(/\s+/).filter(Boolean).length;
      if (/\n/.test(locationText) || words >= 12 || NARRATIVE_VERB_RE.test(locationText)) {
        locationNarrative = splitResponsibilitiesText(locationText);
        clone.location = "";
      }
    }
    if (locationNarrative.length) {
      (clone as any).__extraNarrative = locationNarrative;
    }
    const extraNarrative = Array.isArray((clone as any).__extraNarrative) ? (clone as any).__extraNarrative : [];
    const hasNarrativePayload = bullets.length > 0 || Boolean(textResponsibilities) || extraNarrative.length > 0;
    const hasCompany = Boolean(company);

    const hasAnyContent =
      hasCompany ||
      coerceString(clone?.position ?? "") ||
      hasNarrativePayload ||
      coerceString(clone?.summary ?? "") ||
      (Array.isArray(clone?.achievements) && clone.achievements.length > 0);
    if (!hasAnyContent) {
      continue;
    }

    if (!hasCompany) {
      if (hasNarrativePayload && merged.length > 0) {
        const previous = [...merged].reverse().find((candidate) =>
          Boolean(coerceString(candidate?.company ?? "") || coerceString(candidate?.position ?? "")),
        );
        if (previous && mergeNarrativeIntoExperience(previous, clone)) {
          continue;
        }
      }
      continue;
    }

    merged.push(clone);
  }
  return dedupeExperienceEntriesStrict(merged);
}

function cleanSummaryValue(input: unknown): string {
  const text = coerceString(input);
  if (!text) return "";
  const cleaned = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return cleaned
    .replace(/\s+([,;.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSummaryForComparison(input: unknown): string {
  return cleanSummaryValue(input)
    .replace(/[,:;|\u2013\u2014-]+/g, " ")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanRawSummaryCandidate(input: unknown): string {
  const raw = coerceString(input);
  if (!raw) return "";
  let candidate = extractPlaceOfBirth(raw).cleaned;
  candidate = stripBiographyNoise(candidate);
  candidate = stripLeadingSummaryHeading(candidate);
  candidate = collapseSpacedCaps(candidate);
  candidate = candidate.replace(/^[,;:\u2013\u2014\s]+/, "").trim();
  return cleanSummaryValue(candidate);
}

function shouldPromoteFullerRawSummary(existingSummary: string, rawCandidate: string): boolean {
  const current = cleanSummaryValue(existingSummary);
  const fuller = cleanSummaryValue(rawCandidate);
  if (!current || !fuller) return false;
  if (fuller.length <= current.length + 24) return false;

  const currentNormalized = normalizeSummaryForComparison(current);
  const fullerNormalized = normalizeSummaryForComparison(fuller);
  if (!currentNormalized || !fullerNormalized || currentNormalized === fullerNormalized) {
    return false;
  }

  const rawFirstSentence = normalizeSummaryForComparison(firstSentence(fuller));
  if (!rawFirstSentence || rawFirstSentence !== currentNormalized) {
    return false;
  }

  return true;
}

const CONTACT_SLUDGE_RE = /@|https?:\/\/|www\.|linkedin|github|portfolio|curriculum|@[A-Z0-9._%+-]+|\+?\d[\d\s().-]{6,}/i;
const MONTH_NAME_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

function looksLikeContactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (CONTACT_SLUDGE_RE.test(trimmed)) {
    return true;
  }
  if (trimmed.includes("|")) {
    return true;
  }
  if (trimmed.split("|").length > 2) {
    return true;
  }
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length >= 6) {
    return true;
  }
  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  if (!hasLower && hasUpper) {
    // Uppercase headings, names, or address fragments tend to be contact sludge
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 6 || trimmed.length <= 48) {
      return true;
    }
  }
  if (/[•\u2022\u2023]/.test(trimmed)) {
    return true;
  }
  return false;
}

function stripLeadingLanguagesPrefix(value: string): string {
  return coerceString(value).replace(/^languages?\s*[:\-\u2013\u2014]?\s*/i, "").trim();
}

function stripContactSludge(text: string): string {
  const lines = String(text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const kept: string[] = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const original = lines[idx];
    if (!original) continue;
    const trailingConjunction = /\b(?:and|&)\s*$/i.test(original);
    if (looksLikeContactLine(original) && !trailingConjunction) {
      continue;
    }
    let working = original.replace(/\b\d{1,6}\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g, " ");
    working = working.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{4,5}\b/g, " ");
    working = working.replace(/\b(?:United States|USA|US)\b/gi, " ");
    working = working.replace(/\s{2,}/g, " ").trim();
    const hasLower = /[a-z]/.test(working);
    if (!working) continue;
    if (hasLower || trailingConjunction) {
      kept.push(working);
      continue;
    }
    if (idx < 3) {
      const hasUpper = /[A-Z]/.test(working);
      if (!hasLower && hasUpper) {
        continue;
      }
    }
    kept.push(working);
  }
  return (kept.length ? kept : lines).join(" ");
}

function stripLeadingSummaryHeading(value: string): string {
  const raw = coerceString(value);
  if (!raw) return "";
  const segments = raw.replace(/\r/g, "\n").split(/\n+/);
  const cleaned: string[] = [];
  let headingConsumed = false;

  for (const segment of segments) {
    const trimmed = collapseSpacedCaps(segment.trim());
    if (!trimmed) continue;
    if (!headingConsumed) {
      const headingMatch = trimmed.match(/^(about|profile|professional profile|objective|summary)\b[:\-\s]*/i);
      if (headingMatch) {
        const remainder = trimmed.slice(headingMatch[0].length).trim();
        headingConsumed = true;
        if (remainder) cleaned.push(remainder);
        continue;
      }
      if (/^(about|profile|professional profile|objective|summary)$/i.test(trimmed)) {
        headingConsumed = true;
        continue;
      }
      headingConsumed = true;
    }
    cleaned.push(trimmed);
  }

  if (!cleaned.length) return "";
  return cleaned.join("\n").replace(/\s{2,}/g, " ").trim();
}

function extractFirstSentence(text: string): string {
  const cleaned = stripContactSludge(String(text ?? "")).replace(/\s*\n+\s*/g, " ").trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return cleaned.replace(/^[,;:\|\u2013\u2014\-\s]+/, "").trim();

  const findCandidateStart = (): number => {
    for (let i = 0; i < words.length; i += 1) {
      const current = words[i]?.replace(/^[^A-Za-z]+/, "") ?? "";
      if (!current) continue;
      const next = words[i + 1]?.replace(/^[^A-Za-z]+/, "") ?? "";
      const third = words[i + 2]?.replace(/^[^A-Za-z]+/, "") ?? "";
      if (/^\d+$/.test(current)) continue;
      const hasLower = /[a-z]/.test(current);
      if (!hasLower) continue;
      const startsUpper = /^[A-Z]/.test(current);
      const nextStartsLower = next ? /^[a-z]/.test(next) : false;
      const nextStartsTitle = next ? (/^[A-Z]/.test(next) && /[a-z]/.test(next)) : false;
      const thirdStartsLower = third ? /^[a-z]/.test(third) : false;
      if (startsUpper && (nextStartsLower || (nextStartsTitle && thirdStartsLower))) {
        return i;
      }
    }
    for (let i = 0; i < words.length; i += 1) {
      const current = words[i]?.replace(/^[^A-Za-z]+/, "") ?? "";
      if (!current) continue;
      if (/^\d+$/.test(current)) continue;
      if (/[a-z]/.test(current)) {
        return i;
      }
    }
    return 0;
  };

  const startIdx = findCandidateStart();
  const trimmed = words.slice(startIdx).join(" ").trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  const first = (match ? match[0] : trimmed).trim();
  return first.replace(/^[,;:\|\u2013\u2014\-\s]+/, "").trim();
}

function stripDrivingLicense(value: string): string {
  if (!value) return value;
  return value
    .replace(/\bdriving\s+licen[cs]e\b/gi, "")
    .replace(/\bdriving\s+permit\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPlaceOfBirth(text: string): { cleaned: string; place?: string } {
  if (!text) {
    return { cleaned: "" };
  }
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let birth: string | undefined;
  for (const line of lines) {
    const match = line.match(/place of birth\s*[:\-]\s*(.+)/i);
    if (match) {
      birth = coerceString(match[1])
        .replace(/\bdriving\s+licen[cs]e.*$/i, "")
        .replace(/\bdriving\s+permit.*$/i, "")
        .trim();
      const prefix = line.slice(0, match.index ?? 0).trim();
      const suffix = line.slice((match.index ?? 0) + match[0].length).trim();
      const combined = [prefix, suffix.replace(/^[,;.-]+/, "").trim()]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (combined) {
        kept.push(combined);
      }
      continue;
    }
    if (/driving\s+licen[cs]e/i.test(line) || /driving\s+permit/i.test(line)) {
      const cleanedLine = line
        .replace(/driving\s+licen[cs]e\s*[:\-]?\s*[^,;]+/gi, "")
        .replace(/driving\s+permit\s*[:\-]?\s*[^,;]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (cleanedLine) {
        kept.push(cleanedLine);
      }
      continue;
    }
    kept.push(line);
  }
  return { cleaned: kept.join("\n"), place: birth };
}

const LANGUAGE_INLINE_RE = /(languages?|langues?|idiomas?|sprachen?)\s*[:\-\u2013\u2014]\s*([^\n]+)/gi;
const LANGUAGE_HEADING_RE = /^(languages?|langues?|idiomas?|sprachen?)$/i;
const LANGUAGE_HEADING_PREFIX_RE = /^(languages?|langues?|idiomas?|sprachen?)\b/i;
const SECTION_BOUNDARY_RE = /^(experience|work|employment|employment history|education|summary|profile|professional profile|skills|achievements|projects|certifications|professional)\b/i;
function normalizeHeadingKey(value: string): string {
  const normalized = normalizeCandidateForStoplist(coerceString(value));
  return normalized.replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

function isSectionBoundary(line: string): boolean {
  const key = normalizeHeadingKey(line);
  if (!key) return false;
  return SECTION_BOUNDARY_RE.test(key);
}

const SKILL_INLINE_RE = /\b(skills?|skill\s*&\s*tools|technical skills?|core competenc(?:es|y)|competenc(?:es|ias)|comp[eé]tenc(?:e|es)|principales competenc(?:e|es)|habilidades(?: técnicas)?|competenze(?: tecniche)?|kompetenzen?)\b\s*[:\-\u2013\u2014]\s*([^\n]+)/gi;

const SKILL_HEADING_KEYWORDS = new Set([
  "skills",
  "skill",
  "skills & tools",
  "skills and tools",
  "technical skills",
  "technical skill",
  "core competencies",
  "core competency",
  "competencies",
  "competence",
  "competences",
  "competencia",
  "competencias",
  "competence cle",
  "competences cles",
  "competences clés",
  "competences",
  "competences techniques",
  "competencias tecnicas",
  "competencias técnicas",
  "habilidades",
  "habilidades tecnicas",
  "habilidades técnicas",
  "competenze",
  "competenze tecniche",
  "principales competences",
  "principales compétences",
  "hard skills",
  "soft skills",
]);

function isSkillHeadingLine(line: string): boolean {
  const key = normalizeHeadingKey(line);
  if (!key) return false;
  if (SKILL_HEADING_KEYWORDS.has(key)) return true;
  if (key.startsWith("skills ") || key.startsWith("skill ")) return true;
  if (key.includes("technical skills")) return true;
  if (key.includes("competenc")) return true;
  if (key.includes("habilidades")) return true;
  if (key.includes("competenze")) return true;
  if (key.includes("kompetenz")) return true;
  return false;
}

function extractSkillsFromTextBlock(text: string): string[] {
  if (!text) return [];
  const segments: string[] = [];
  const seen = new Set<string>();

  text.replace(SKILL_INLINE_RE, (_match, _heading: string, values: string) => {
    const normalized = values.trim();
    if (normalized && !seen.has(normalized)) {
      segments.push(normalized);
      seen.add(normalized);
    }
    return _match;
  });

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (!isSkillHeadingLine(line)) continue;
    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (!next) break;
      if (isSkillHeadingLine(next)) break;
      if (isSectionBoundary(next)) {
        if (!collected.length) {
          continue;
        }
        break;
      }
      collected.push(next);
    }
    if (collected.length) {
      const segment = collected.join(" \n").trim();
      if (segment && !seen.has(segment)) {
        segments.push(segment);
        seen.add(segment);
      }
    }
  }

  return segments.flatMap(tokenizeList);
}

function sanitizePhoneValue(value: unknown): string | undefined {
  const phone = coerceString(value);
  if (!phone) return undefined;
  const trimmed = phone.trim();
  const digits = (trimmed.match(/\d/g) || []).length;
  if (digits < 7) return undefined;
  if (/^\d{4}$/.test(trimmed)) return undefined;
  if (/\b(19|20)\d{2}\s*[\u2012\u2013\u2014\u2015\-]\s*(19|20)\d{2}\b/i.test(trimmed)) return undefined;
  return trimmed;
}

function splitLanguageSegment(segment: string): Array<{ name: string; level?: string }> {
  return tokenizeList(segment)
    .map((token) => {
      const clean = token.replace(/^[•*\-\u2022]+/, "").trim();
      if (!clean) return null;
      const stripped = clean
        .replace(/\b(19|20)\d{2}\b/g, "")
        .replace(/[-–—]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!stripped) return null;
      if (/\d/.test(stripped) || stripped.length > 60) return null;
      if (MONTH_NAME_RE.test(stripped) && !/(program|degree|training|course|university|college|academy|school)/i.test(stripped)) {
        return null;
      }
      const levelMatch = stripped.match(/\(([^)]+)\)\s*$/);
      let level: string | undefined;
      let name = stripped;
      if (levelMatch && levelMatch.index !== undefined) {
        level = levelMatch[1].trim();
        name = stripped.slice(0, levelMatch.index).trim();
      }
      const normalized = normalizeLanguageTokenSync(name);
      if (!normalized) return null;
      const canonicalKey = normalized.toLowerCase();
      if (LANGUAGE_TOKEN_BLOCKLIST.has(canonicalKey)) return null;
      const tokenWords = normalized.split(/\s+/);
      if (tokenWords.length > 3) return null;
      if (!CANONICAL_LANGUAGES.has(normalized)) {
        if (tokenWords.length > 2) return null;
        const lastWord = tokenWords[tokenWords.length - 1];
        if (!/(ian|ic|ish|ese|ese|an|ar|ch|i|se)$/i.test(lastWord)) return null;
        if (/\b(program|course|guard|security|foundation|college|university|training|certification|certificate|international|report|writing)\b/i.test(normalized)) return null;
      }
      return { name: normalized, level };
    })
    .filter(Boolean) as Array<{ name: string; level?: string }>;
}

function extractLanguagesFromTextBlock(text: string): Array<{ name: string; level?: string }> {
  if (!text) return [];
  const segments: string[] = [];
  const seen = new Set<string>();

  text.replace(LANGUAGE_INLINE_RE, (match, _heading, values: string, offset: number) => {
    const prefix = text.slice(Math.max(0, offset - 30), offset);
    if (/technical|programming|frameworks?/i.test(prefix)) {
      return match;
    }
    const normalized = values.trim();
    if (normalized && !seen.has(normalized)) {
      segments.push(normalized);
      seen.add(normalized);
    }
    return match;
  });

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (LANGUAGE_HEADING_RE.test(line) || LANGUAGE_HEADING_PREFIX_RE.test(line)) {
      const afterHeading = line.replace(LANGUAGE_HEADING_PREFIX_RE, "").replace(/^[:\-\u2013\u2014\s]+/, "");
      const prefix = lines[Math.max(0, i - 1)] ?? "";
      if (/technical|programming|frameworks?/i.test(prefix)) {
        continue;
      }
      const collected: string[] = [];
      if (afterHeading && afterHeading.length <= 80 && !/\d/.test(afterHeading)) {
        collected.push(afterHeading);
      }
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (!next) break;
        if (LANGUAGE_HEADING_PREFIX_RE.test(next)) break;
        if (isSectionBoundary(next)) break;
        collected.push(next);
      }
      const segment = collected.join(" \n").trim();
      if (segment && !seen.has(segment)) {
        segments.push(segment);
        seen.add(segment);
      }
    }
  }

  return segments.flatMap(splitLanguageSegment);
}

const ACHIEVEMENTS_HEADING_RE = /^(achievements?|awards?|accomplishments?)$/i;
const PROJECTS_HEADING_RE = /^(projects?|activities)$/i;
const SPACED_CAPS_SEGMENT_RE = /^(?:[A-Z]\s+){2,}[A-Z]$/;
const SPACED_CAPS_GLOBAL_RE = /^(?:[A-Z]\s+){2,}[A-Z](?:\s{2,}(?:[A-Z]\s+){2,}[A-Z])*$/;
const DATE_RANGE_PREFIX_RE =
  /^(?:\(?\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?(?:\s+\d{2,4})?\)?(?:\s*(?:[-–—]|to)\s*\(?\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?(?:\s+\d{2,4})?\)?|\s*(?:[-–—]|to)\s*(?:\d{4}|present|current|till\s+date|till\s+now|till\s+present|till\s+today))?|(?:\d{4})(?:\s*(?:[-–—]|to)\s*(?:\d{4}|present|current|till\s+date|till\s+now|till\s+present|till\s+today)))(?:\)?\s*[,.;:\-–—]*)?/i;
const ROLE_STOPWORDS = new Set([
  "profile",
  "summary",
  "objective",
  "skills",
  "skill",
  "language",
  "languages",
  "education",
  "experience",
  "contact",
  "details",
  "curriculum",
  "vitae",
]);
const ROLE_KEYWORD_HINTS = new Set([
  "engineer",
  "scientist",
  "manager",
  "analyst",
  "consultant",
  "specialist",
  "designer",
  "developer",
  "architect",
  "technician",
  "coordinator",
  "officer",
  "administrator",
  "executive",
  "assistant",
  "director",
  "lead",
  "leader",
  "strategist",
  "researcher",
  "supervisor",
  "trainer",
  "coach",
  "planner",
  "advisor",
  "auditor",
  "consultor",
  "teacher",
  "nurse",
  "guard",
  "agent",
  "owner",
  "operator",
  "associate",
  "programmer",
  "product",
  "tester",
  "qa",
  "intern",
]);
const DEGREE_SPLIT_TOKENS = /\b((?:b\.?\s?tech|b\.?\s?e|bachelor(?:'s)?|m\.?\s?tech|m\.?\s?e|master(?:'s)?|mba|pg(?:\s|\.|-)diploma|ph\.?\s?d))\b/gi;
const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
  "PR",
  "GU",
  "VI",
  "AS",
  "MP",
]);

function toTitleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function collapseSpacedCaps(value: string): string {
  const working = coerceString(value);
  if (!working) return working;
  const trimmed = working.trim();
  if (!SPACED_CAPS_GLOBAL_RE.test(trimmed) && !SPACED_CAPS_SEGMENT_RE.test(trimmed)) {
    return working;
  }
  const segments = trimmed.split(/\s{2,}/);
  if (segments.length > 1) {
    const words = segments.map((segment) => {
      const inner = segment.trim();
      if (!SPACED_CAPS_SEGMENT_RE.test(inner)) return inner;
      const collapsed = inner.replace(/\s+/g, "");
      return toTitleCaseWord(collapsed);
    });
    return words.filter(Boolean).join(" ");
  }
  if (SPACED_CAPS_SEGMENT_RE.test(trimmed)) {
    const collapsed = trimmed.replace(/\s+/g, "");
    return toTitleCaseWord(collapsed);
  }
  return working;
}

function splitSegmentByDegreeTokens(segment: string): string[] {
  const working = coerceString(segment);
  if (!working) return [];
  const trimmed = working.trim();
  if (!trimmed) return [];
  const matches = Array.from(trimmed.matchAll(DEGREE_SPLIT_TOKENS));
  if (matches.length <= 1) {
    return [trimmed];
  }
  const pieces: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? trimmed.length : trimmed.length;
    let slice = trimmed.slice(start, end).trim();
    if (i === 0 && start > 0) {
      const prefix = trimmed.slice(0, start).trim();
      if (prefix) {
        slice = `${prefix} ${slice}`.replace(/\s{2,}/g, " ").trim();
      }
    }
    if (slice) {
      pieces.push(slice);
    }
  }
  return pieces.length ? pieces : [trimmed];
}

function stripLeadingDatePrefix(value: string): string {
  const working = coerceString(value);
  if (!working) return working;
  const match = working.match(DATE_RANGE_PREFIX_RE);
  if (match && match[0] && match[0].length >= 4) {
    return working.slice(match[0].length).trim();
  }
  return working;
}

function normalizeRoleCandidate(raw: unknown): string | null {
  const rawValue = raw == null ? "" : String(raw);
  const collapsed = collapseSpacedCaps(rawValue).replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  const cleaned = collapsed
    .replace(/[^\p{L}\p{N}/&+.\- ]+/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (ROLE_STOPWORDS.has(lower)) return null;
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 0 || tokens.length > 6) return null;
  const formatted = tokens
    .map((token) => {
      if (token.length <= 2) return token.toUpperCase();
      return token[0].toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
  return formatted;
}

function extractAchievementsFromText(text: string): string[] {
  if (!text) return [];
  const normalized = String(text ?? "").replace(/\r/g, "\n");
  const lines = normalized.split(/\n/);
  const results: string[] = [];
  const seen = new Set<string>();
  let capturing = false;
  let buffer = "";

  const flush = () => {
    const candidate = buffer.replace(/\s{2,}/g, " ").trim();
    buffer = "";
    if (!candidate || candidate.length < 8) return;
    const key = candidate.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(candidate);
  };

  const acceptToken = (rawToken: string) => {
    const cleaned = collapseSpacedCaps(rawToken.replace(/^[•*\-–—\u2022]+/, "").trim());
    if (!cleaned) {
      flush();
      return;
    }
    if (!buffer) {
      buffer = cleaned;
      return;
    }
    if (/^[,;:)\]]/.test(cleaned) || /^[a-z]/.test(cleaned)) {
      buffer = `${buffer} ${cleaned}`.replace(/\s{2,}/g, " ").trim();
      return;
    }
    flush();
    buffer = cleaned;
  };

  for (const rawLine of lines) {
    const baseLine = collapseSpacedCaps(rawLine.trim());
    if (!baseLine) {
      flush();
      continue;
    }
    if (ACHIEVEMENTS_HEADING_RE.test(baseLine)) {
      capturing = true;
      flush();
      continue;
    }
    if (!capturing) continue;
    if (isSectionBoundary(baseLine)) {
      flush();
      break;
    }
    if (/^[A-Z0-9 .,'-]{3,}$/.test(baseLine) && baseLine === baseLine.toUpperCase()) {
      flush();
      continue;
    }

    const bulletNormalized = baseLine.replace(/[•·●▪◦◆■□▶➤▸◉►]/g, "•");
    const tokens = bulletNormalized
      .split(/(?:^|\s)•\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (tokens.length > 1) {
      tokens.forEach((token) => acceptToken(token));
      continue;
    }
    const hyphenSplit = baseLine.split(/\s(?:[-–—])\s+/);
    if (hyphenSplit.length > 1 && hyphenSplit[0].length <= 80) {
      hyphenSplit.forEach((token) => acceptToken(token));
      continue;
    }
    acceptToken(baseLine);
  }

  flush();
  return results;
}

function parseProjectLines(lines: string[]): Array<{ title: string; summary?: string }> {
  const results: Array<{ title: string; summary?: string }> = [];
  let currentTitle = "";
  let summaryParts: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    const title = collapseSpacedCaps(currentTitle).replace(/\s{2,}/g, " ").trim();
    if (!title || title.length < 3) {
      currentTitle = "";
      summaryParts = [];
      return;
    }
    let summary = summaryParts.join(" ").replace(/\s{2,}/g, " ").trim();
    if (summary && summary.toLowerCase() === title.toLowerCase()) {
      summary = "";
    }
    results.push({ title, summary: summary || undefined });
    currentTitle = "";
    summaryParts = [];
  };

  for (const rawLine of lines) {
    const baseLine = collapseSpacedCaps(rawLine.trim());
    if (!baseLine) {
      flush();
      continue;
    }
    if (isSectionBoundary(baseLine)) {
      flush();
      break;
    }
    if (/^[A-Z0-9 .,'-]{3,}$/.test(baseLine) && baseLine === baseLine.toUpperCase()) {
      flush();
      continue;
    }
    const cleaned = baseLine.replace(/^[•*\-–—\u2022]+\s*/, "").trim();
    if (!cleaned) {
      flush();
      continue;
    }
    const split = cleaned.split(/\s[-–—:]\s+/, 2);
    if (!currentTitle) {
      if (split.length === 2 && split[0].split(/\s+/).length <= 12) {
        currentTitle = split[0];
        if (split[1]) summaryParts.push(split[1]);
        continue;
      }
      currentTitle = cleaned;
      continue;
    }
    if (/^[a-z(]/.test(cleaned) || cleaned.length > 120) {
      summaryParts.push(cleaned);
      continue;
    }
    flush();
    currentTitle = cleaned;
  }
  flush();
  return results;
}

function extractProjectsFromTextBlock(text: string): Array<{ title: string; summary?: string }> {
  if (!text) return [];
  const lines = String(text ?? "")
    .replace(/\r/g, "\n")
    .split(/\n/)
    .map((line) => cleanLine(line));
  const collected: string[] = [];
  let capturing = false;
  for (const rawLine of lines) {
    const line = collapseSpacedCaps(rawLine.trim());
    if (!line) {
      if (capturing && collected.length) {
        collected.push("");
      }
      continue;
    }
    if (PROJECTS_HEADING_RE.test(line)) {
      capturing = true;
      continue;
    }
    if (!capturing) continue;
    if (isSectionBoundary(line)) break;
    collected.push(line);
  }
  return parseProjectLines(collected);
}

const NAME_MAX_LENGTH = 80;

function isTitleCaseToken(token: string): boolean {
  return /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’.-]*$/.test(token);
}

function sanitizeNameValue(value: string): string {
  const raw = value == null ? "" : String(value);
  return collapseSpacedCaps(raw).replace(/\s+/g, " ").trim();
}

function tokenizeNameCandidate(line: string): string[] {
  return sanitizeNameValue(line)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeAndValidateNameTokens(tokens: string[], rawValue: string): string[] | null {
  if (tokens.length < 2 || tokens.length > 4) return null;
  const joinedLength = tokens.join(" ").length;
  if (joinedLength > NAME_MAX_LENGTH || joinedLength < 4) return null;
  const normalizedWhole = normalizeCandidateForStoplist(rawValue);
  if (!normalizedWhole || isHeaderStopword(normalizedWhole) || isGeoStopword(normalizedWhole)) return null;

  const normalizedTokens: string[] = [];
  let titleCaseCount = 0;

  for (const token of tokens) {
    if (/[@\d]/.test(token)) return null;
    const normalizedToken = normalizeCandidateForStoplist(token);
    if (isHeaderStopword(normalizedToken) || isGeoStopword(normalizedToken)) return null;
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(token)) return null;

    let formatted = token;
    if (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(token) && token.length > 1) {
      formatted = token[0] + token.slice(1).toLowerCase();
    } else if (/^[a-zà-öø-ÿ]/.test(token)) {
      formatted = token[0].toUpperCase() + token.slice(1);
    }

    if (isTitleCaseToken(formatted)) {
      titleCaseCount += 1;
    }

    normalizedTokens.push(formatted);
  }

  if (titleCaseCount < Math.max(1, Math.floor(tokens.length * 0.75))) return null;

  return normalizedTokens;
}

function formatNameFromTokens(tokens: string[]): string {
  return tokens
    .map((token, idx) => {
      if (idx === tokens.length - 1 && token.length <= 3) {
        return token.toUpperCase();
      }
      if (token.length <= 3 && token === token.toUpperCase()) {
        return token;
      }
      return token.replace(/^(\p{L})(.*)$/u, (_match, p1: string, rest: string) => p1.toUpperCase() + rest.toLowerCase());
    })
    .join(" ")
    .replace(/\s+Jr$/i, " Jr");
}

function deriveNameFromEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const cleaned = sanitizeNameValue(local);
  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .slice(0, 3)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1));
  if (tokens.length >= 2) {
    const candidate = formatNameFromTokens(tokens);
    if (!isHeaderStopword(candidate) && !isGeoStopword(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

const GENERIC_NAME_TOKENS = new Set([
  'international',
  'recrutement',
  'recruitment',
  'manager',
  'lead',
  'director',
  'responsable',
  'talent',
  'project',
]);

const INVALID_NAME_PREFIXES = new Set([
  "curriculum",
  "curriculum vitae",
  "resume",
  "cv",
  "profile",
  "summary",
  "objective",
  "details",
  "personal details",
  "contact",
  "contacts",
  "contact details",
  "coordonnees",
  "coordonnees personnelles",
  "name",
  "nom",
]);

const ROLEISH_NAME_TOKENS = new Set([
  ...GENERIC_NAME_TOKENS,
  "guard",
  "engineer",
  "developer",
  "manager",
  "analyst",
  "scientist",
  "consultant",
  "assistant",
  "officer",
  "supervisor",
  "technician",
  "architect",
  "designer",
  "specialist",
  "director",
  "administrator",
  "coordinator",
  "security",
  "pro",
]);

function hasInvalidNamePrefix(value: string): boolean {
  const cleaned = sanitizeNameValue(value);
  if (!cleaned) return false;
  const normalized = normalizeCandidateForStoplist(cleaned);
  if (!normalized) return true;
  if (INVALID_NAME_PREFIXES.has(normalized)) return true;
  for (const prefix of INVALID_NAME_PREFIXES) {
    if (normalized.startsWith(`${prefix} `)) {
      return true;
    }
  }
  const beforeColon = normalizeCandidateForStoplist(cleaned.split(":", 1)[0] ?? "");
  if (beforeColon && INVALID_NAME_PREFIXES.has(beforeColon)) {
    return true;
  }
  return false;
}

function formatLooseNameTokens(tokens: string[]): string[] {
  return tokens.map((token) => {
    if (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(token) && token.length > 1) {
      return token[0] + token.slice(1).toLowerCase();
    }
    if (/^[a-zà-öø-ÿ]/.test(token)) {
      return token[0].toUpperCase() + token.slice(1);
    }
    return token;
  });
}

function isUsablePersonName(value: string | null | undefined, rawCandidate?: string): boolean {
  const cleaned = sanitizeNameValue(value ?? "");
  if (!cleaned) return false;
  if (cleaned.length > NAME_MAX_LENGTH || cleaned.length < 4) return false;

  const raw = sanitizeNameValue(rawCandidate ?? cleaned);
  if (/^\s*[#>*`|]/.test(rawCandidate ?? cleaned)) return false;
  if (/@|https?:\/\/|www\./i.test(rawCandidate ?? cleaned)) return false;
  if (hasInvalidNamePrefix(cleaned) || hasInvalidNamePrefix(raw)) return false;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return false;
  if (tokens.some((token) => /[@\d]/.test(token))) return false;
  if (tokens.some((token) => !/^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(token))) return false;

  const formattedTokens = formatLooseNameTokens(tokens);
  const normalizedWhole = normalizeCandidateForStoplist(formattedTokens.join(" "));
  if (!normalizedWhole || isHeaderStopword(normalizedWhole) || isGeoStopword(normalizedWhole)) return false;

  const normalizedTokens = formattedTokens
    .map((token) => normalizeCandidateForStoplist(token))
    .filter(Boolean) as string[];
  if (!normalizedTokens.length) return false;
  if (normalizedTokens.some((token) => isHeaderStopword(token) || isGeoStopword(token))) return false;
  if (normalizedTokens.every((token) => ROLEISH_NAME_TOKENS.has(token))) return false;

  const titleCaseCount = formattedTokens.filter((token) => isTitleCaseToken(token) || (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(token) && token.length <= 3)).length;
  if (titleCaseCount < Math.max(1, Math.floor(formattedTokens.length * 0.75))) return false;

  return true;
}

function computeNameScore(
  candidate: string,
  tokens: string[],
  index: number,
  sourceWeight: number,
  contactIndices: number[],
): number {
  let score = 0;
  if (index === 0) score += 5;
  else if (index === 1) score += 4;
  else if (index <= 4) score += 3;
  else if (index <= 8) score += 2;
  score += sourceWeight;
  if (tokens.length === 2) score += 2;
  if (tokens.length === 3) score += 1;
  if (tokens.some((token) => /[-–—]/.test(token))) score -= 0.5;
  for (const token of tokens) {
    const normalized = normalizeCandidateForStoplist(token);
    if (normalized && GENERIC_NAME_TOKENS.has(normalized)) {
      score -= 1.5;
    }
  }
  if (contactIndices.length) {
    const minDistance = Math.min(...contactIndices.map((idx) => Math.abs(idx - index)));
    score += Math.max(0, 6 - minDistance);
  }
  return score;
}

function collectContactLines(lines: string[], email?: string, phone?: string, linkedin?: string): number[] {
  const contactIndices: number[] = [];
  const normalizedPhone = coerceString(phone).replace(/[^\d+]/g, "");
  const normalizedPhoneDigits = normalizedPhone.replace(/[^\d]/g, "");
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (email && line.includes(email)) contactIndices.push(idx);
    else if (linkedin && lower.includes("linkedin")) contactIndices.push(idx);
    else if (normalizedPhoneDigits.length >= 6) {
      const digits = line.replace(/[^\d]/g, "");
      if (digits.length >= 6) {
        if (normalizedPhoneDigits.endsWith(digits) || digits.endsWith(normalizedPhoneDigits)) {
          contactIndices.push(idx);
        }
      }
    }
  });
  return contactIndices;
}

function deriveNameFromContext(normalized: any, context: CanonicalizeContext): string | undefined {
  const existing = coerceString(normalized?.name ?? normalized?.contact?.name ?? "");
  if (existing && isUsablePersonName(existing, existing)) return existing;
  const skillTokens = collectSkillTokens(normalized);

  const email = coerceString(normalized?.contact?.email ?? "") || undefined;
  const phone = coerceString(normalized?.contact?.phone ?? normalized?.contact?.phoneRaw ?? "") || undefined;
  const linkedin = coerceString(normalized?.contact?.linkedinUrl ?? "") || undefined;

  const sources: Array<{ text: string; weight: number }> = [];
  const contactRaw = coerceString(normalized?.contact?.raw ?? normalized?.contact?.addressBlock ?? "");
  if (contactRaw) sources.push({ text: contactRaw, weight: 4 });
  const normalizedRaw = coerceString(normalized?.rawText ?? "");
  if (normalizedRaw) sources.push({ text: normalizedRaw, weight: 2 });
  if (typeof context.rawText === "string" && context.rawText.trim()) {
    sources.push({ text: context.rawText, weight: 1 });
  }

  const seen = new Map<string, number>();
  type NameCandidate = { value: string; score: number };
  let bestCandidate: NameCandidate | null = null;

  for (const { text, weight } of sources) {
    if (!text) continue;
    const lines = text.split(/\r?\n/).map((line) => sanitizeNameValue(line)).filter(Boolean);
    if (!lines.length) continue;
    const contactLines = collectContactLines(lines, email, phone, linkedin);
    lines.forEach((line, idx) => {
      if (!line || line.length > NAME_MAX_LENGTH) return;
      if (line.includes("@") || line.includes("http")) return;
      const tokens = tokenizeNameCandidate(line);
      const normalizedTokens = normalizeAndValidateNameTokens(tokens, line);
      if (!normalizedTokens) return;
      const formatted = formatNameFromTokens(normalizedTokens);
      if (!isUsablePersonName(formatted, line)) return;
      const normalizedKey = normalizeCandidateForStoplist(formatted);
      if (!normalizedKey || isHeaderStopword(normalizedKey) || isGeoStopword(normalizedKey)) return;
      if (skillTokens.has(normalizedKey)) return;
      const score = computeNameScore(formatted, normalizedTokens, idx, weight, contactLines);
      const previous = seen.get(normalizedKey) ?? -Infinity;
      if (score <= previous) return;
      seen.set(normalizedKey, score);
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { value: formatted, score };
      }
    });
  }

  if (bestCandidate) return (bestCandidate as NameCandidate).value;
  const contactRawFallback = typeof normalized?.contact?.raw === "string" ? normalized.contact.raw : "";
  if (contactRawFallback) {
    const rawLines = contactRawFallback.split(/\r?\n/);
    for (const rawLine of rawLines) {
      if (!rawLine) continue;
      if (rawLine.includes("@") || rawLine.includes("http")) continue;
      const segments = rawLine
        .trim()
        .split(/\s{2,}/)
        .map((segment) => segment.replace(/\s+/g, ""))
        .filter(Boolean);
      if (segments.length < 2 || segments.length > 4) continue;
      if (segments.some((segment) => /[^A-Za-z]/.test(segment))) continue;
      const formatted = segments
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(" ");
      if (!formatted) continue;
      if (!isUsablePersonName(formatted, rawLine)) continue;
      const tokens = tokenizeNameCandidate(formatted);
      const normalizedTokens = normalizeAndValidateNameTokens(tokens, formatted);
      if (normalizedTokens) {
        return formatNameFromTokens(normalizedTokens);
      }
    }
  }
  return deriveNameFromEmail(email) ?? undefined;
}

function collectSkillTokens(normalized: any): Set<string> {
  const tokens = new Set<string>();
  const push = (value: string) => {
    const cleaned = coerceString(value).toLowerCase().trim();
    if (!cleaned) return;
    if (cleaned.length >= 3) tokens.add(cleaned);
  };
  ensureArray<any>(normalized?.skills).forEach((entry) => {
    const name = coerceString(entry?.name ?? entry);
    if (!name) return;
    push(name);
    name.split(/[\/,+]/).forEach((piece) => {
      piece
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3)
        .forEach(push);
    });
  });
  const skillsText = coerceString(normalized?.skillsText ?? "");
  if (skillsText) {
    skillsText
      .split(/[,;\n]/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .forEach(push);
  }
  return tokens;
}

function deriveDesiredPosition(normalized: any, context: CanonicalizeContext): string | undefined {
  const skillTokens = collectSkillTokens(normalized);
  const candidateScores = new Map<string, { value: string; score: number }>();
  const considerCandidate = (rawValue: unknown, baseScore: number) => {
    const normalizedRole = normalizeRoleCandidate(rawValue);
    if (!normalizedRole) return;
    const lower = normalizedRole.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean);
    const hasRoleKeyword = tokens.some((token) => ROLE_KEYWORD_HINTS.has(token));
    let score = baseScore;
    if (skillTokens.has(lower)) {
      score -= 3;
    }
    if (!hasRoleKeyword) {
      score -= 5;
    }
    if (tokens.length < 2) {
      score -= 4;
    }
    if (score <= 0) return;
    const existing = candidateScores.get(lower);
    if (!existing || score > existing.score) {
      candidateScores.set(lower, { value: normalizedRole, score });
    }
  };

  const sources: Array<{ text: string; weight: number }> = [];
  const contactRawSource = typeof normalized?.contact?.raw === "string" ? normalized.contact.raw : normalized?.contact?.addressBlock;
  if (typeof contactRawSource === "string" && contactRawSource.trim()) {
    sources.push({ text: contactRawSource, weight: 8 });
  }
  const normalizedRawSource = typeof normalized?.rawText === "string" ? normalized.rawText : "";
  if (normalizedRawSource.trim()) {
    sources.push({ text: normalizedRawSource, weight: 4 });
  }
  if (typeof context.rawText === "string" && context.rawText.trim()) {
    sources.push({ text: context.rawText, weight: 3 });
  }

  const existingDesired = coerceString(normalized?.desiredPosition ?? normalized?.contact?.desiredPosition ?? "");
  if (existingDesired) {
    considerCandidate(existingDesired, 2);
  }

  for (const { text, weight } of sources) {
    if (!text) continue;
    const lines = text
      .split(/\r?\n/)
      .map((line) => collapseSpacedCaps(line))
      .map((line) => cleanLine(line))
      .filter(Boolean)
      .slice(0, 16);
    lines.forEach((line, idx) => {
      if (!line) return;
      if (/@|http/.test(line)) return;
      if (isSectionBoundary(line)) return;
      const segments = line.split(/[|•·•]/).map((segment) => segment.trim()).filter(Boolean);
      const carriers = segments.length ? segments : [line.trim()];
      carriers.forEach((segment, segIdx) => {
        if (!segment) return;
        if (/,/.test(segment) && segment.split(",").length > 1) return;
        const bonus = segIdx === 0 ? 0 : segIdx * 0.3;
        const score = weight - idx * 0.7 - bonus;
        if (process.env.DEBUG_ROLE === "1") {
          // eslint-disable-next-line no-console
          console.log("[role candidate]", segment, score);
        }
        considerCandidate(segment, score);
      });
    });
  }

  const firstExperience = ensureArray<any>(normalized?.experience)[0];
  if (firstExperience?.position) {
    considerCandidate(firstExperience.position, 2.5);
  }

  const contactRawFallback = typeof normalized?.contact?.raw === "string" ? normalized.contact.raw : "";
  let fallbackRole: string | undefined;
  if (contactRawFallback) {
    const rawLines = contactRawFallback.split(/\r?\n/);
    rawLines.forEach((rawLine) => {
      if (!rawLine) return;
      const segments = rawLine
        .trim()
        .split(/\s{2,}/)
        .map((segment) => segment.replace(/\s+/g, ""))
        .filter(Boolean);
      if (segments.length >= 2 && segments.length <= 6) {
        const candidate = segments
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
          .join(" ");
        const candidateTokens = candidate.toLowerCase().split(/\s+/);
        if (process.env.DEBUG_ROLE === "1") {
          // eslint-disable-next-line no-console
          console.log("[role fallback candidate]", candidate, candidateTokens);
        }
        if (candidateTokens.some((token) => ROLE_KEYWORD_HINTS.has(token))) {
          if (!fallbackRole) fallbackRole = candidate;
        }
        considerCandidate(candidate, 3);
      }
    });
    if (!fallbackRole) {
      const originalLines = rawLines.map((line) => line.trim()).filter(Boolean);
      if (originalLines.length >= 2) {
        const inferredRole = normalizeRoleCandidate(originalLines[1]);
        if (inferredRole) {
          const tokens = inferredRole.toLowerCase().split(/\s+/);
          if (tokens.some((token) => ROLE_KEYWORD_HINTS.has(token))) {
            fallbackRole = inferredRole;
          }
        }
      }
    }
    if (process.env.DEBUG_ROLE === "1") {
      // eslint-disable-next-line no-console
      console.log("[role fallback]", fallbackRole);
    }
  }

  const ranked = Array.from(candidateScores.values()).sort((a, b) => b.score - a.score);
  if (ranked.length) {
    const top = ranked[0].value;
    const topTokens = top.toLowerCase().split(/\s+/);
    const hasRoleKeyword = topTokens.some((token) => ROLE_KEYWORD_HINTS.has(token));
    if (!hasRoleKeyword && fallbackRole) {
      return fallbackRole;
    }
    return top;
  }
  if (fallbackRole) return fallbackRole;
  return undefined;
}

function sanitizeContactLocation(normalized: any): void {
  if (!normalized?.contact || typeof normalized.contact !== "object") return;
  const contact = normalized.contact as Record<string, any>;
  const rawLocation = coerceString(contact.location ?? contact.addressNormalized ?? "");
  if (!rawLocation) return;
  const sanitized = collapseSpacedCaps(rawLocation).replace(/\s{2,}/g, " ").trim();
  if (!sanitized) {
    delete contact.location;
    return;
  }
  if (/\b(skills?|technologies|toolkit|stack)\b/i.test(sanitized)) {
    delete contact.location;
    return;
  }
  const skillTokens = collectSkillTokens(normalized);
  const lower = sanitized.toLowerCase();
  const containsDelimiter = /[,|/]/.test(sanitized);
  for (const skill of skillTokens) {
    if (skill.length >= 3 && new RegExp(`\\b${escapeRegExp(skill)}\\b`).test(lower)) {
      if (containsDelimiter) {
        delete contact.location;
        return;
      }
    }
  }
  const tokens = sanitized.split(/[,\s]+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length === 2 && /^[A-Za-z]{2}$/.test(token)) {
      const upper = token.toUpperCase();
      if (US_STATE_CODES.has(upper) && token !== upper) {
        delete contact.location;
        return;
      }
    }
  }
  contact.location = sanitized;
}

function extractRawSections(result: any): RawSection[] {
  const candidates: unknown[] = [];
  if (Array.isArray(result?.normalized?.rawSections)) {
    candidates.push(...result.normalized.rawSections);
  }
  if (Array.isArray(result?.rawSections)) {
    candidates.push(...result.rawSections);
  }
  if (Array.isArray(result?.raw_sections)) {
    candidates.push(...result.raw_sections);
  }
  if (!Array.isArray(result?.rawSections) && Array.isArray(result?.result?.rawSections)) {
    candidates.push(...result.result.rawSections);
  }
  const casted: RawSection[] = [];
  for (const entry of candidates) {
    if (!entry) continue;
    const label = coerceString((entry as any).label ?? "");
    let content = "";
    if (typeof (entry as any).content === "string") {
      content = ((entry as any).content as string).trim();
    } else {
      content = coerceString((entry as any).content ?? "");
    }
    if (label && content) {
      casted.push({ label, content });
    }
  }
  return casted;
}

function filterRawSection(rawSections: RawSection[], key: SectionKey, options?: { preserveWhitespace?: boolean }): string[] {
  return rawSections
    .filter((section) => {
      const label = coerceString(section.label).toUpperCase();
      if (!label) return false;
      const mapped = SECTION_LABEL_TO_KEY[label];
      if (mapped) return mapped === key;
      const normalizedHeading = normalizeHeadingKey(label);
      if (!normalizedHeading) return false;
      if (normalizedHeading === key) return true;
      if (key === "experience" && normalizedHeading.includes("employment")) return true;
      if (key === "skills" && normalizedHeading.includes("skill")) return true;
      if (key === "languages" && normalizedHeading.startsWith("language")) return true;
      return false;
    })
    .map((section) => {
      const content = typeof section.content === "string" ? section.content : String(section.content ?? "");
      return options?.preserveWhitespace ? content.trim() : coerceString(content);
    })
    .filter((text) => text.length > 0);
}

const DATE_RANGE_RE =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4})\b\s*(?:[\u2012\u2013\u2014\u2015\-]|to)\s*\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|present|current|till\s+date|till\s+now|till\s+present|till\s+today)\b/gi;
const SINGLE_DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/i;
const BULLET_PREFIX_RE = /^[\-•*]/;
const NARRATIVE_VERB_RE = /\b(responsible|maintaining|logging|utilizing|apprehending|monitoring|ensur(?:e|ing)|develop(?:ed|ing)|manage(?:d|ment)|coordinating|attending|providing)\b/i;

function cleanLine(value: unknown): string {
  return coerceString(value).replace(/\s+/g, " ").trim();
}

function parseMonthYear(token: string): string | undefined {
  const normalized = cleanLine(token).toLowerCase();
  const match = normalized.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i);
  if (!match) {
    const yearMatch = normalized.match(/(19|20)\d{2}/);
    if (yearMatch) {
      return `${yearMatch[0]}-01-01`;
    }
    return undefined;
  }
  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    sept: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const monthKey = match[1].slice(0, 4).replace(/\./g, "").toLowerCase();
  const monthIndex = months[monthKey] ?? 0;
  const year = Number(match[2]);
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return date.toISOString().slice(0, 10);
}

function parseDateRange(rangeText: string | undefined): {
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
} {
  if (!rangeText) return {};
  const range = cleanLine(rangeText);
  if (!range) return {};
  const parts = range.split(/[\u2012\u2013\u2014\u2015\-]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  const startToken = parts[0];
  const endToken = parts.length > 1 ? parts[1] : undefined;
  const startDate = parseMonthYear(startToken);
  let endDate: string | null | undefined = undefined;
  let isCurrent: boolean | undefined;
  if (!endToken) {
    endDate = undefined;
  } else if (/present|current/i.test(endToken) || /till\s+(date|now|present|today)/i.test(endToken)) {
    endDate = null;
    isCurrent = true;
  } else {
    endDate = parseMonthYear(endToken);
  }
  return { startDate, endDate, isCurrent };
}

function splitCompanyLocation(line: string): { company: string; location?: string } {
  const raw = collapseSpacedCaps(cleanLine(line));
  if (!raw) return { company: "" };
  const pieces = raw.split(",");
  if (pieces.length <= 1) {
    return { company: raw };
  }
  const first = pieces.shift()?.trim() ?? raw;
  const location = pieces.join(",").trim() || undefined;
  return { company: first, location };
}

function splitCompanyPositionFromHeader(headerRaw: string): {
  position: string;
  company: string;
  location?: string;
} {
  const header = collapseSpacedCaps(cleanLine(headerRaw));
  if (!header) return { position: "", company: "" };

  if (NARRATIVE_VERB_RE.test(header)) {
    return { position: header, company: "" };
  }

  // A. “<position> at <company>[, <location>]”
  const atMatch = header.match(/^\s*(.+?)\s+at\s+(.+?)\s*$/i);
  if (atMatch) {
    let position = cleanLine(atMatch[1] || "");
    let companyPart = cleanLine(atMatch[2] || "");
    let company = companyPart;
    let location = "";

    // Split trailing location on comma: “Foo Corp, Paris”
    const commaIdx = companyPart.lastIndexOf(",");
    if (commaIdx > 1) {
      company = cleanLine(companyPart.slice(0, commaIdx));
      location = cleanLine(companyPart.slice(commaIdx + 1));
    }
    return { position, company, location };
  }

  // B. handle separators like “Foo Corp – Software Engineer” or “Software Engineer — Foo Corp”
  const SEP = /[\u2010-\u2015\-–—|•·]+/; // dash/emdash/en-dash/pipe/bullets
  const rawParts = header.split(SEP).map(cleanLine).filter(Boolean);
  const parts = rawParts.filter((part) => !NARRATIVE_VERB_RE.test(part));
  const effectiveParts = parts.length >= 2 ? parts : rawParts;

  if (effectiveParts.length === 2) {
    const [a, b] = effectiveParts;
    const POSITION_KEYWORD_RE = /\b(software|systems?|data|full[ -]?stack|front[ -]?end|back[ -]?end|senior|junior|principal|staff|lead|manager|engineer|developer|analyst|designer|consultant|administrator|officer|specialist|architect|intern|director|scientist|qa|support)\b/i;
    const COMPANY_KEYWORD_RE = /\b(inc\.?|corp\.?|ltd\.?|llc|gmbh|s\.?a\.?|sarl|sas|plc|co\.?|company|group|partners|holdings|technologies|solutions|associates|enterprises?)\b/i;
    const looksPosition = (s: string) => POSITION_KEYWORD_RE.test(s);
    const looksCompany = (s: string) => {
      if (COMPANY_KEYWORD_RE.test(s)) return true;
      if (looksPosition(s)) return false; // role-like phrases are not company names
      if (/[&@]/.test(s)) return true; // “Foo & Bar”, “AT&T”
      // All-caps tokens or majority capitalized words can indicate orgs, but be conservative
      const tokens = s.split(/\s+/).filter(Boolean);
      const caps = tokens.filter((t) => /^[A-Z0-9&.'-]{2,}$/.test(t));
      if (tokens.length >= 2 && caps.length >= Math.max(1, Math.floor(tokens.length / 2))) return true;
      return false;
    };

    if (looksCompany(a) && !looksCompany(b)) return { company: a, position: b };
    if (looksCompany(b) && !looksCompany(a)) return { company: b, position: a };
    if (looksPosition(a) && !looksPosition(b)) return { company: b, position: a };
    if (looksPosition(b) && !looksPosition(a)) return { company: a, position: b };

    // fallback: prefer first as company (e.g., “Foo Corp – Software Engineer”)
    return { company: a, position: b };
  }

  // C. One token: keep as position; company empty (don’t mirror it!)
  return { position: header, company: "" };
}

function parseExperienceBlock(content: string, idx: number) {
  let normalizedContent = String(content ?? "");
  if (!/\n/.test(normalizedContent)) {
    normalizedContent = normalizedContent.replace(/\s+([\-•*])\s+/g, "\n$1 ");
    normalizedContent = normalizedContent.replace(/(\d{4})(\s+[A-Z])/g, "$1\n$2");
  }
  const lines = normalizedContent
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  let header = lines.shift() ?? "";
  header = header.replace(/^LANGUAGES\s*/i, "").trim();
  let dateText = (header.match(DATE_RANGE_RE) || [])[0];
  if (dateText) {
    header = cleanLine(header.replace(dateText, ""));
  } else if (lines.length) {
    const nextLine = lines[0];
    const nextDate = (nextLine.match(DATE_RANGE_RE) || [])[0] || (nextLine.match(SINGLE_DATE_RE) || [])[0];
    if (nextDate) {
      dateText = nextDate;
      lines[0] = cleanLine(nextLine.replace(nextDate, ""));
    }
  }

  let inlineCompany: string | undefined;
  let inlinePosition: string | undefined;
  let startDate: string | undefined;
  let endDate: string | null | undefined;
  let isCurrent: boolean | undefined;
  if (!lines.length) {
    // Single-line header like "Foo Corp — Software Engineer" or "Software Engineer — Foo Corp".
    // Prefer robust split using splitCompanyPositionFromHeader rather than positional tokens.
    const inferred = splitCompanyPositionFromHeader(header);
    inlinePosition = cleanLine(inferred.position || "");
    inlineCompany = cleanLine(inferred.company || "");
  }

  let companyLine = lines.shift() ?? "";
  if (DATE_RANGE_RE.test(companyLine) || SINGLE_DATE_RE.test(companyLine)) {
    const parsedCompanyRange = parseDateRange(companyLine);
    if (parsedCompanyRange.startDate && !startDate) {
      startDate = parsedCompanyRange.startDate;
    }
    if (parsedCompanyRange.endDate !== undefined) {
      endDate = parsedCompanyRange.endDate;
    }
    if (parsedCompanyRange.isCurrent) {
      isCurrent = true;
    }
    companyLine = "";
  }
  if ((!companyLine || BULLET_PREFIX_RE.test(companyLine)) && header.split(" ").length > 1) {
    const tokens = header.split(/\s+/);
    inlinePosition = inlinePosition ?? tokens.shift() ?? header;
    inlineCompany = inlineCompany ?? tokens.join(" ").trim();
    if (!companyLine || BULLET_PREFIX_RE.test(companyLine)) {
      companyLine = inlineCompany ?? "";
    }
  }


  const { position: headerPosition, company: headerCompany, location: headerLocation } = splitCompanyPositionFromHeader(header);

  const split = splitCompanyLocation(companyLine);
  // Prefer header-derived company (from robust heuristic) over inline token guess
  let company = headerCompany || inlineCompany || split.company;
  const location = stripDrivingLicense(headerLocation ?? split.location ?? "");
  const narrative: string[] = [];
  const responsibilityBullets: string[] = [];
  const achievementBullets: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) {
      const parsed = parseDateRange(line);
      if (parsed.startDate && !startDate) {
        startDate = parsed.startDate;
      }
      if (parsed.endDate !== undefined) {
        endDate = parsed.endDate;
      }
      if (parsed.isCurrent) {
        isCurrent = true;
      }
      continue;
    }
    if (BULLET_PREFIX_RE.test(line)) {
      const cleaned = line.replace(/^[\-•*\s]+/, "").trim();
      if (!cleaned) continue;
      responsibilityBullets.push(cleaned);
      if (looksLikeAchievementBullet(cleaned)) {
        achievementBullets.push(cleaned);
      }
    } else {
      narrative.push(line);
    }
  }

  let responsibilitiesText = narrative.join(" ");

  const parsedRange = parseDateRange(dateText);
  startDate = startDate ?? parsedRange.startDate;
  endDate = endDate ?? parsedRange.endDate;
  if (parsedRange.isCurrent) {
    isCurrent = true;
  }

  // Prefer header-derived position first
  const positionRaw = headerPosition || inlinePosition || "Experience";
  const position = stripDrivingLicense(positionRaw);
  let normalizedCompany = stripDrivingLicense(company);
  if (normalizedCompany && NARRATIVE_VERB_RE.test(normalizedCompany)) {
    normalizedCompany = "";
  }
  const normalizedLocation = stripDrivingLicense(location ?? "");

  let narrativeBullets = responsibilitiesText ? splitResponsibilitiesText(responsibilitiesText) : [];
  if (!narrativeBullets.length && /responsible for/i.test(String(content ?? ""))) {
    narrativeBullets = splitResponsibilitiesText(content);
  }
  const combinedResponsibilities = [...narrativeBullets, ...responsibilityBullets];
  const dedupedResponsibilities = dedupeStringsCaseInsensitive(combinedResponsibilities);
  const achievements = dedupeStringsCaseInsensitive(
    dedupedResponsibilities.filter(looksLikeAchievementBullet)
  );

  return {
    id: coerceId(null, "exp", idx),
    company: normalizedCompany,
    position,
    startDate,
    endDate,
    isCurrent,
    location: normalizedLocation,
    responsibilities: dedupedResponsibilities.length ? dedupedResponsibilities.join("\n") : undefined,
    responsibilityBullets: dedupedResponsibilities.length ? dedupedResponsibilities : undefined,
    achievements,
  };
}

function looksLikeAchievementBullet(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower) return false;
  if (/\b(automated|achieved|delivered|grew|reduced|improved|optimized|decreased|increased|boosted|launched|built|designed|developed|implemented|created|pioneered|saved|cut|enhanced|secured|coordinated|investigated|led)\b/.test(lower)) {
    return true;
  }
  if (/\b\d+%|\b\d{4,}\b/.test(lower)) return true; // "+30%", "reduced by 1200"
  if (/\b(revenue|retention|conversion|productivity|cost|incident|safety|latency|availability)\b/.test(lower)) return true;
  return false;
}

function stripBiographyNoise(t: string): string {
  return t
    .replace(/\bPlace of birth\b.*$/i, "")     // remove "Place of birth …"
    .replace(/\bDriving license\b.*$/i, "")    // remove "Driving license …"
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function firstSentence(t: string): string {
  const candidate = extractFirstSentence(t);
  if (candidate) {
    return candidate.slice(0, 600).trim();
  }
  const fallback = cleanSummaryValue(t);
  return fallback.slice(0, 600).trim();
}

function coerceSummaryObject(textMaybe: string | undefined, fallbackConf = 0.5) {
  const txt = cleanSummaryValue(textMaybe || "");
  if (!txt) return undefined;
  return { text: txt, confidence: fallbackConf };
}


function parseExperienceSegment(content: string, idx: number) {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .filter(Boolean);
  if (!lines.length) return null;

  const headerRaw = lines.shift() ?? "";
  const header = headerRaw.replace(/^LANGUAGES\s*/i, "").trim();

  const headerTrimmed = header.trim();
  if (!headerTrimmed || NARRATIVE_VERB_RE.test(headerTrimmed)) {
    const snippets = [headerTrimmed, ...lines]
      .map((line) => line.replace(/^[\-•*\s]+/, "").trim())
      .filter(Boolean);
    if (snippets.length === 0) return null;
    return { __narrative: snippets } as any;
  }

  const { position: headerPosition, company: headerCompany, location: headerLocation } = splitCompanyPositionFromHeader(header);

  let dateLine: string | undefined;
  if (lines.length && (DATE_RANGE_RE.test(lines[0]) || SINGLE_DATE_RE.test(lines[0]))) {
    dateLine = lines.shift();
  }
  const range = parseDateRange(dateLine);

  const bulletLines: string[] = [];
  const achievementLines: string[] = [];
  const normalizedLines: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    const cleaned = line.replace(/^[\-•*\s]+/, "").trim();
    if (!cleaned) continue;
    if (!normalizedLines.length) {
      normalizedLines.push(cleaned);
      continue;
    }
    if (/^[a-z]/.test(cleaned) || /^(and|or|including|utilizing|leveraging|ensuring|monitoring|logging|maintaining|apprehending|providing|coordinating|managing|supporting)\b/i.test(cleaned)) {
      const lastIdx = normalizedLines.length - 1;
      normalizedLines[lastIdx] = `${normalizedLines[lastIdx]} ${cleaned}`.replace(/\s{2,}/g, " ").trim();
    } else {
      normalizedLines.push(cleaned);
    }
  }
  for (const line of normalizedLines) {
    const cleaned = line.trim();
    if (!cleaned) continue;
    bulletLines.push(cleaned);
    if (looksLikeAchievementBullet(cleaned)) {
      achievementLines.push(cleaned);
    }
  }

  const dedupedResponsibilitiesSegment = dedupeStringsCaseInsensitive(bulletLines);
  const achievements = dedupeStringsCaseInsensitive(
    dedupedResponsibilitiesSegment.filter(looksLikeAchievementBullet)
  );

  return {
    id: coerceId(null, "exp", idx),
    company: stripDrivingLicense(headerCompany),
    position: stripDrivingLicense(headerPosition),
    startDate: range.startDate,
    endDate: range.endDate,
    isCurrent: range.isCurrent,
    location: stripDrivingLicense(headerLocation ?? ""),
    responsibilities: dedupedResponsibilitiesSegment.length ? dedupedResponsibilitiesSegment.join("\n") : undefined,
    responsibilityBullets: dedupedResponsibilitiesSegment.length ? dedupedResponsibilitiesSegment : undefined,
    achievements,
  };
}

function parseEducationBlock(content: string, idx: number) {
  let normalizedContent = String(content ?? "");
  if (!/\n/.test(normalizedContent)) {
    normalizedContent = normalizedContent.replace(/\s+([\-•*])\s+/g, "\n$1 ");
    normalizedContent = normalizedContent.replace(/(\d{4})(\s+[A-Z])/g, "$1\n$2");
  }
  const lines = normalizedContent
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
  if (!lines.length) {
    return null;
  }

  let header = collapseSpacedCaps(stripLeadingLanguagesPrefix(lines.shift() ?? ""));
  const degreeLineRaw = stripLeadingLanguagesPrefix(lines.shift() ?? "");
  const degreeLine = degreeLineRaw.trim();

  const { company: institution, location } = splitCompanyLocation(header);
  let degree = degreeLine;
  let dateText = (degreeLine.match(DATE_RANGE_RE) || [])[0] || (degreeLine.match(SINGLE_DATE_RE) || [])[0];
  if (dateText) {
    degree = cleanLine(degreeLine.replace(dateText, ""));
  }

  const { startDate, endDate, isCurrent } = parseDateRange(dateText);
  const description = lines.join(" ") || undefined;

  return {
    id: coerceId(null, "edu", idx),
    institution,
    degree,
    fieldOfStudy: undefined,
    startDate,
    endDate,
    isCurrent,
    location,
    summary: description,
  };
}

function splitEducationEntries(content: string): string[] {
  const normalizedContent = String(content ?? "")
    .replace(/(\d{4}\s*[—-]\s*(?:\d{4}|present|current))\s+(?=[A-Z])/gi, "$1\n");
  const filteredLines = normalizedContent
    .split(/\r?\n/)
    .map((line) => stripLeadingLanguagesPrefix(cleanLine(line)))
    .filter((line) => {
      if (!line) return false;
      if (MONTH_NAME_RE.test(line) && !/(program|degree|training|course|university|college|academy|school)/i.test(line)) {
        return false;
      }
      const canonicalLang = normalizeLanguageTokenSync(line);
      if (canonicalLang && CANONICAL_LANGUAGES.has(canonicalLang) && line.split(/\s+/).length <= 3) {
        return false;
      }
      return true;
    });
  if (!filteredLines.length) return [];

  const segments: string[][] = [];
  let current: string[] = [];

  const looksLikeHeader = (line: string): boolean => {
    if (!line) return false;
    if (/^(course|curriculum|responsibilities?)\b/i.test(line)) return false;
    if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) return false;
    const keyword = /(degree|diploma|program|course|training|university|college|academy|school|certificate|certification|education)/i;
    if (keyword.test(line)) return true;
    if (/[,;]/.test(line) && line.split(/\s+/).length <= 14) return true;
    return false;
  };

  for (const line of filteredLines) {
    if (looksLikeHeader(line) && current.length) {
      segments.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) {
    segments.push(current);
  }

  return segments
    .map((segment) => segment.join("\n").trim())
    .flatMap((segment) => splitSegmentByDegreeTokens(segment))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function buildEducationEntry(segment: string, idx: number) {
  const lines = String(segment ?? "")
    .split(/\r?\n/)
    .map((line) => stripLeadingLanguagesPrefix(cleanLine(line)))
    .filter((line) => line.length > 0);
  if (!lines.length) return null;

  let header = stripLeadingLanguagesPrefix(lines.shift() ?? "");
  let dateLineIndex = lines.findIndex((line) => DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line));
  let dateLine: string | undefined;
  if (dateLineIndex >= 0) {
    dateLine = lines.splice(dateLineIndex, 1)[0];
  } else {
    const inlineDate = header.match(DATE_RANGE_RE) || header.match(SINGLE_DATE_RE);
    if (inlineDate && inlineDate[0]) {
      const idxDate = header.indexOf(inlineDate[0]);
      const endIdx = idxDate + inlineDate[0].length;
      const trailing = header.slice(endIdx).trim();
      if (trailing) lines.unshift(trailing);
      header = (header.slice(0, idxDate).trim());
      dateLine = inlineDate[0];
    }
  }

  const { startDate, endDate, isCurrent } = parseDateRange(dateLine);
  let extraLocation: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[i];
    if (/,/.test(candidate) && !/\d/.test(candidate) && candidate.split(/\s+/).length <= 4) {
      extraLocation = candidate;
      lines.splice(i, 1);
      break;
    }
  }
  const filteredLines = lines.filter((line) => {
    const lang = normalizeLanguageTokenSync(line);
    if (lang && CANONICAL_LANGUAGES.has(lang)) {
      return false;
    }
    if (/^[A-Za-z]+$/.test(line)) {
      return false;
    }
    if (/,/.test(line) && !/:/.test(line) && !/\d/.test(line) && line.split(/\s+/).length <= 4) {
      return false;
    }
    return true;
  });
  const description = filteredLines.join(" ") || undefined;

  const headerParts = header.split(/\s*,\s*/).filter(Boolean);
  let degree = headerParts.shift() ?? "";
  let institution = headerParts.join(", ").trim();
  if (!degree && institution) {
    degree = institution;
    institution = "";
  }
  if (!institution && degree) {
    institution = degree;
    degree = "";
  }
  if (extraLocation) {
    institution = institution ? `${institution}, ${extraLocation}` : extraLocation;
  }

  return {
    id: coerceId(null, "edu", idx),
    institution: institution || undefined,
    degree: degree || undefined,
    startDate,
    endDate,
    isCurrent,
    location: undefined,
    summary: description,
  };
}

function extractEducationSegmentsFromText(text: string): string[] {
  if (!text) return [];
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => cleanLine(line));

  const collectedSegments: string[] = [];
  let collecting = false;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      collectedSegments.push(buffer.join("\n").trim());
      buffer = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      if (collecting && buffer.length) {
        flush();
      }
      continue;
    }
    if (/^education$/i.test(line)) {
      collecting = true;
      flush();
      continue;
    }
    if (collecting) {
      if (/^languages?\b/i.test(line)) {
        continue;
      }
      const sanitized = stripLeadingLanguagesPrefix(line);
      if (!sanitized) {
        continue;
      }
      if (/^(languages?|skills?|projects?|achievements?|experience|work|employment|profile|summary|details)$/i.test(sanitized)) {
        flush();
        collecting = false;
        continue;
      }
      buffer.push(sanitized);
    }
  }
  flush();

  if (!collectedSegments.length) return [];
  return collectedSegments.flatMap((segment) => splitEducationEntries(segment));
}

function explodeCompoundEducationSegment(segment: string): string[] {
  const working = coerceString(segment);
  if (!working) return [];
  const trimmed = working.trim();
  if (!trimmed) return [];
  const degreePieces = splitSegmentByDegreeTokens(trimmed);
  if (degreePieces.length > 1) {
    return degreePieces;
  }
  if (trimmed.includes("\n")) return [trimmed];
  const headerRegex = /[A-Z][A-Za-z ]{0,60}(?:Program|Training|Certificate|Diploma|Degree)/g;
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(trimmed))) {
    indices.push(match.index);
  }
  if (indices.length <= 1) return [segment];
  const pieces: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i] ?? 0;
    const end = i + 1 < indices.length ? indices[i + 1] ?? trimmed.length : trimmed.length;
    const slice = trimmed.slice(start, end).trim();
    if (slice) pieces.push(slice);
  }
  return pieces.length ? pieces : [trimmed];
}

function recoverEducationFromLooseText(text: string): string[] {
  if (!text) return [];
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => cleanLine(line));
  const startIdx = lines.findIndex((line) => /^education$/i.test(line));
  const scanLines = startIdx >= 0 ? lines.slice(startIdx + 1) : lines;
  const segments: string[] = [];
  let buffer: string[] = [];
  const keyword = /(program|training|certificate|diploma|degree)/i;
  const heading = /^(experience|work|employment|education|languages|skills|projects|achievements|profile|summary|details)$/i;

  for (const line of scanLines) {
    if (!line) {
      if (buffer.length) {
        segments.push(buffer.join("\n"));
        buffer = [];
      }
      continue;
    }
    if (keyword.test(line)) {
      if (buffer.length) {
        segments.push(buffer.join("\n"));
        buffer = [];
      }
      buffer.push(line);
      continue;
    }
    if (buffer.length) {
      if (heading.test(line)) {
        segments.push(buffer.join("\n"));
        buffer = [];
        continue;
      }
      buffer.push(line);
    }
  }
  if (buffer.length) {
    segments.push(buffer.join("\n"));
  }
  return segments;
}

type ExperienceDiagnostics = {
  droppedEmpty: number;
  fallbackCount: number;
  source: "normalized" | "raw_sections" | "text_fallback" | "none";
};

type ExperienceCanonical = {
  items: any[];
  diagnostics: ExperienceDiagnostics;
};

function recoverExperienceFromLooseText(normalized: any, context: CanonicalizeContext): any[] {
  const sourceTextRaw = typeof normalized?.rawText === "string" && normalized.rawText.trim()
    ? normalized.rawText
    : typeof context.rawText === "string"
    ? context.rawText
    : "";
  const sourceText = sourceTextRaw;
  if (!sourceText) return [];

  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .map((line) => line.replace(/^[•*\-–—\u2022]+\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const experienceHeading = /^(professional\s+)?experience|work experience|employment history|career history|experience$/i;
  const boundaryHeading = /^(education|skills|projects|achievements|languages|certifications|references|objective|summary|profile)\b/i;
  const headingIdx = lines.findIndex((line) => experienceHeading.test(line));
  const scanLines = headingIdx >= 0 ? lines.slice(headingIdx + 1) : lines;
  const results: any[] = [];


  const isHardStop = (line: string): boolean => {
    if (!line) return true;
    if (boundaryHeading.test(line)) return true;
    if (isSectionBoundary(line)) return true;
    if (/^[A-Z0-9 .,'-]{3,}$/.test(line) && line === line.toUpperCase()) return true;
    return false;
  };

  for (let i = 0; i < scanLines.length - 2; i += 1) {
    const companyLine = scanLines[i];
    if (!companyLine) continue;
    if (isHardStop(companyLine)) {
      if (boundaryHeading.test(companyLine)) break;
      continue;
    }
    if (DATE_RANGE_RE.test(companyLine) || SINGLE_DATE_RE.test(companyLine)) continue;
    const maybeRole = normalizeRoleCandidate(companyLine);
    if (maybeRole) {
      const roleTokens = maybeRole.toLowerCase().split(/\s+/);
      if (roleTokens.some((token) => ROLE_KEYWORD_HINTS.has(token))) {
        continue;
      }
    }
    if (companyLine.length > 120) continue;

    const titleLine = scanLines[i + 1];
    const role = normalizeRoleCandidate(titleLine);
    if (!role) continue;

    const dateLine = scanLines[i + 2];
    if (!dateLine) continue;
    const rangeMatch = dateLine.match(DATE_RANGE_RE) || dateLine.match(SINGLE_DATE_RE);
    if (!rangeMatch || !rangeMatch[0]) continue;
    const { startDate, endDate, isCurrent } = parseDateRange(rangeMatch[0]);
    if (!startDate && !endDate && !isCurrent) continue;

    const { company, location } = splitCompanyLocation(companyLine);
    const companyName = stripDrivingLicense(company || companyLine);
    if (!companyName || companyName.length < 2) continue;
    if (/^(professional experience|experience)$/i.test(companyName)) continue;

    const entry: any = {
      id: coerceId(null, "exp", results.length),
      company: companyName,
      position: role,
      startDate,
      endDate,
      isCurrent,
      location: stripDrivingLicense(location ?? ""),
    };

    const narrativeSeed: string[] = [];
    let cursor = i + 3;
    while (cursor < scanLines.length) {
      const line = scanLines[cursor];
      if (!line) break;
      if (isHardStop(line)) break;
      if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) break;
      const potentialRole = normalizeRoleCandidate(line);
      if (potentialRole && narrativeSeed.length === 0) {
        const roleTokens = potentialRole.toLowerCase().split(/\s+/);
        if (roleTokens.some((token) => ROLE_KEYWORD_HINTS.has(token))) {
          break;
        }
      }
      const cleaned = line.replace(/^[•*\-–—\u2022]+\s*/, "").trim();
      if (!cleaned) {
        cursor += 1;
        continue;
      }
      narrativeSeed.push(cleaned);
      cursor += 1;
    }

    let dedupedBullets = dedupeStringsCaseInsensitive(splitResponsibilitiesText(narrativeSeed.join("\n")));
    if (!dedupedBullets.length && narrativeSeed.length) {
      dedupedBullets = dedupeStringsCaseInsensitive(narrativeSeed.map((line) => line.trim()).filter(Boolean));
    }
    if (dedupedBullets.length) {
      entry.responsibilityBullets = dedupedBullets;
      entry.responsibilities = dedupedBullets.slice();
      entry.summary = dedupedBullets.join("\n");
      const achievements = dedupeStringsCaseInsensitive(
        dedupedBullets.filter((bullet) => looksLikeAchievementBullet(bullet)),
      );
      if (achievements.length) {
        entry.achievements = achievements;
      }
    }

    entry.provenanceTags = Array.isArray(entry.provenanceTags)
      ? Array.from(new Set([...(entry.provenanceTags as string[]), "heuristic:trio_fallback"]))
      : ["heuristic:trio_fallback"];

    results.push(entry);
    i = cursor - 1;
  }

  return results;
}

function canonicalizeExperience(
  rawValue: unknown,
  rawSections: RawSection[],
  normalized: any,
  context: CanonicalizeContext,
): ExperienceCanonical {
  let droppedEmpty = 0;

  let normalizedEntries = ensureArray<any>(rawValue)
    .map((entry, idx) => {
      const company = stripDrivingLicense(coerceString(entry?.company ?? entry?.employer ?? entry?.organization ?? ""));
      const position = stripDrivingLicense(coerceString(entry?.position ?? entry?.title ?? entry?.role ?? ""));
      const summary = coerceString(entry?.summary ?? entry?.description ?? "");
      const rawResponsibilities = entry?.responsibilities;
      const seededBullets = Array.isArray(entry?.responsibilityBullets)
        ? dedupeStringsCaseInsensitive((entry.responsibilityBullets as unknown[]).map((val) => coerceString(val)).filter(Boolean))
        : [];
      const responsibilityBullets = dedupeStringsCaseInsensitive([
        ...seededBullets,
        ...(Array.isArray(rawResponsibilities)
          ? (rawResponsibilities as unknown[]).map((val) => coerceString(val)).filter(Boolean)
          : splitResponsibilitiesText(rawResponsibilities ?? summary ?? entry?.content ?? "")),
      ]);
      const normalizedResponsibilities = responsibilityBullets.length
        ? responsibilityBullets.join("\n")
        : coerceString(rawResponsibilities ?? summary ?? entry?.content ?? "") || undefined;
      const achievements = Array.isArray(entry?.achievements)
        ? dedupeStringsCaseInsensitive(entry.achievements.map((ach: unknown) => coerceString(ach)).filter(Boolean))
        : [];
      const item = {
        id: coerceId(entry?.id, "exp", idx),
        company,
        position,
        startDate: entry?.startDate ?? entry?.from ?? undefined,
        endDate: entry?.isCurrent ? null : entry?.endDate ?? entry?.to ?? undefined,
        isCurrent: entry?.isCurrent ?? entry?.current ?? undefined,
        location: stripDrivingLicense(coerceString(entry?.location ?? "")),
        summary: summary || undefined,
        responsibilities: normalizedResponsibilities,
        responsibilityBullets: responsibilityBullets.length ? responsibilityBullets : undefined,
        achievements,
      };
      if (!item.company && !item.position && !item.responsibilities && !item.summary) {
        droppedEmpty += 1;
        return null;
      }
      return item;
    })
    .filter(Boolean);

  normalizedEntries = sanitizeExperienceEntries(normalizedEntries);

  const fromRaw = filterRawSection(rawSections, "experience", { preserveWhitespace: true });

  const shouldFallback =
    normalizedEntries.length === 0 ||
    (fromRaw.length > normalizedEntries.length && fromRaw.length > 0) ||
    normalizedEntries.every((entry) => {
      const company = coerceString(entry?.company ?? "");
      const position = coerceString(entry?.position ?? "");
      const hasContent = Boolean(entry?.responsibilities || entry?.achievements?.length);
      const poorCompany = !company || /^inferred$/i.test(company);
      const poorPosition = /^professional experience$/i.test(position);
      return (poorCompany || poorPosition) && !hasContent;
    });

  if (!shouldFallback && normalizedEntries.length > 0) {
    return {
      items: normalizedEntries,
      diagnostics: {
        droppedEmpty,
        fallbackCount: 0,
        source: "normalized",
      },
    };
  }

  const fallbackItems: any[] = [];

  const appendNarrativeToLast = (snippets: string[]) => {
    if (!snippets.length) return;
    const last = fallbackItems[fallbackItems.length - 1];
    if (!last) return;
    const bullets = Array.isArray(last.responsibilityBullets) ? [...last.responsibilityBullets] : [];
    const achievements = Array.isArray(last.achievements) ? [...last.achievements] : [];
    let changed = false;
    for (const snippet of snippets) {
      const cleaned = snippet.replace(/^[\-•*\s]+/, "").trim();
      if (!cleaned) continue;
      const exists = bullets.some((b) => b.toLowerCase() === cleaned.toLowerCase());
      if (!exists) {
        bullets.push(cleaned);
        changed = true;
      }
      if (looksLikeAchievementBullet(cleaned)) {
        const achExists = achievements.some((a) => a.toLowerCase() === cleaned.toLowerCase());
        if (!achExists) achievements.push(cleaned);
      }
    }
    if (changed) {
      last.responsibilityBullets = bullets;
      last.responsibilities = bullets.join("\n");
    }
    if (achievements.length) {
      last.achievements = achievements;
    }
    if (changed || achievements.length) {
      const existing: string[] = Array.isArray((last as any).provenanceTags) ? (last as any).provenanceTags : [];
      if (!existing.includes("heuristic:narrative_merge")) {
        (last as any).provenanceTags = [...existing, "heuristic:narrative_merge"];
      }
    }
  };

  const handleSegment = (segment: string, key: number) => {
    const parsedBlock = parseExperienceBlock(segment, key);
    if (parsedBlock) {
      fallbackItems.push(parsedBlock);
      return;
    }
    const parsedSegment = parseExperienceSegment(segment, key);
    if (!parsedSegment) return;
    if ((parsedSegment as any).__narrative) {
      appendNarrativeToLast((parsedSegment as any).__narrative as string[]);
      return;
    }
    fallbackItems.push(parsedSegment);
  };

  fromRaw.forEach((content, idx) => {
    const segments = content
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length <= 1) {
      handleSegment(content, idx);
      return;
    }
    segments.forEach((segment, innerIdx) => handleSegment(segment, idx * 10 + innerIdx));
  });

  let sanitizedFallback = sanitizeExperienceEntries(fallbackItems);
  let fallbackSource: ExperienceDiagnostics["source"] = sanitizedFallback.length > 0 ? "raw_sections" : "none";

  if (!sanitizedFallback.length) {
    const recovered = recoverExperienceFromLooseText(normalized, context);
    if (recovered.length) {
      sanitizedFallback = sanitizeExperienceEntries(recovered);
      if (sanitizedFallback.length) {
        fallbackSource = "text_fallback";
      }
    }
  }

  sanitizedFallback = sanitizedFallback.map((item) => {
    if (!item) return item;
    if (!Array.isArray((item as any).responsibilityBullets)) {
      if (Array.isArray((item as any).responsibilities)) {
        (item as any).responsibilityBullets = ((item as any).responsibilities as string[]).slice();
      } else {
        const derived = splitResponsibilitiesText((item as any).responsibilities ?? "");
        if (derived.length) {
          (item as any).responsibilityBullets = derived;
        }
      }
    }
    return item;
  });

  return {
    items: sanitizedFallback,
    diagnostics: {
      droppedEmpty,
      fallbackCount: sanitizedFallback.length,
      source: fallbackSource,
    },
  };
}

function canonicalizeProjects(
  rawValue: unknown,
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): any[] {
  type ProjectData = { title: string; summary?: string; sourceId?: string };
  const collected: ProjectData[] = [];
  const seen = new Set<string>();

  const push = (title: string, summary?: string, sourceId?: string) => {
    const normalizedTitle = collapseSpacedCaps(coerceString(title)).replace(/\s{2,}/g, " ").trim();
    if (!normalizedTitle || normalizedTitle.length < 3) return;
    const normalizedSummary = summary ? collapseSpacedCaps(summary).replace(/\s{2,}/g, " ").trim() : undefined;
    const key = `${normalizedTitle.toLowerCase()}|${(normalizedSummary ?? "").toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    collected.push({ title: normalizedTitle, summary: normalizedSummary, sourceId });
  };

  ensureArray<any>(rawValue).forEach((entry) => {
    const title = coerceString(entry?.title ?? entry?.name ?? entry?.project ?? "");
    const summary = coerceString(entry?.summary ?? entry?.description ?? "");
    if (!title) return;
    push(title, summary || undefined, entry?.id);
  });

  filterRawSection(rawSections, "projects").forEach((content) => {
    const lines = String(content ?? "").split(/\r?\n/);
    parseProjectLines(lines).forEach((project) => {
      push(project.title, project.summary);
    });
  });

  if (!collected.length) {
    const fallbackText = coerceString(normalized?.rawText ?? context.rawText ?? "");
    if (fallbackText) {
      extractProjectsFromTextBlock(fallbackText).forEach((project) => {
        push(project.title, project.summary);
      });
    }
  }

  return collected.map((item, idx) => ({
    id: coerceId(item.sourceId, "proj", idx),
    title: item.title,
    summary: item.summary,
  }));
}

function canonicalizeEducation(
  rawValue: unknown,
  rawSections: RawSection[],
  normalized: any,
  context: CanonicalizeContext,
): any[] {
  const dedupeKey = (entry: any) => {
    const strip = (value: unknown) => stripLeadingLanguagesPrefix(coerceString(value)).toLowerCase();
    const institution = strip(entry?.institution ?? "");
    const degree = strip(entry?.degree ?? "");
    const start = coerceString(entry?.startDate ?? "");
    const end = coerceString(entry?.endDate ?? "");
    return [institution, degree, start, end].join("|").trim();
  };

  const educationLanguageHints = new Set<string>();
  const addLanguageHint = (value: string | undefined | null) => {
    const candidate = normalizeLanguageTokenSync(coerceString(value));
    if (candidate && CANONICAL_LANGUAGES.has(candidate)) {
      educationLanguageHints.add(candidate);
    }
  };
  const stripLeadingLanguageTokens = (input: string): string => {
    let working = coerceString(input);
    while (working) {
      const firstToken = working.split(/[\s,;:\-/]+/, 1)[0] || "";
      if (!firstToken) break;
      const canonical = normalizeLanguageTokenSync(firstToken);
      if (!canonical || !CANONICAL_LANGUAGES.has(canonical)) break;
      educationLanguageHints.add(canonical);
      working = working.slice(firstToken.length).replace(/^[\s,;:\-/]+/, "").trim();
    }
    return working.trim();
  };
  const stripTrailingLanguageTokens = (input: string): string => {
    let working = coerceString(input);
    while (working) {
      const match = working.match(/^(.*?)(?:[\s,;:\-/]+)([A-Za-z]{2,})$/);
      if (!match) break;
      const candidateRaw = match[2].trim();
      const canonical = normalizeLanguageTokenSync(candidateRaw);
      if (!canonical || !CANONICAL_LANGUAGES.has(canonical)) break;
      educationLanguageHints.add(canonical);
      working = match[1].trim();
    }
    return working.trim();
  };
  const cleanseEducationField = (input: string): string => {
    const trimmed = stripTrailingLanguageTokens(stripLeadingLanguageTokens(input));
    return trimmed.replace(/\s{2,}/g, " ").trim();
  };

  const rawTextForHints = coerceString(normalized?.rawText ?? context.rawText ?? "");
  if (rawTextForHints) {
    extractLanguagesFromTextBlock(rawTextForHints).forEach(({ name }) => addLanguageHint(name));
  }

  const fromNormalized = ensureArray<any>(rawValue).map((entry, idx) => {
    const institution = stripLeadingLanguagesPrefix(coerceString(entry?.institution ?? entry?.school ?? entry?.university ?? ""));
    const degree = stripLeadingLanguagesPrefix(coerceString(entry?.degree ?? entry?.studyType ?? entry?.program ?? ""));
    const fieldOfStudy = stripLeadingLanguagesPrefix(coerceString(entry?.fieldOfStudy ?? entry?.major ?? entry?.area ?? ""));
    const summary = coerceString(entry?.summary ?? entry?.description ?? "");
    const item = {
      id: coerceId(entry?.id, "edu", idx),
      institution,
      degree,
      fieldOfStudy: fieldOfStudy || undefined,
      startDate: entry?.startDate ?? entry?.from ?? undefined,
      endDate: entry?.endDate ?? entry?.to ?? undefined,
      isCurrent: entry?.isCurrent ?? undefined,
      location: stripLeadingLanguagesPrefix(coerceString(entry?.location ?? "")),
      summary: summary || undefined,
    };
    item.institution = cleanseEducationField(item.institution ?? "");
    item.degree = cleanseEducationField(item.degree ?? "");
    if (item.fieldOfStudy) {
      item.fieldOfStudy = cleanseEducationField(item.fieldOfStudy);
    }
    if (!item.institution && !item.degree && !item.fieldOfStudy && !item.summary) {
      return null;
    }
    return item;
  }).filter(Boolean);

  const rawSectionsForEducation = filterRawSection(rawSections, "education", { preserveWhitespace: true });
  const rawSegments = rawSectionsForEducation.flatMap(splitEducationEntries);

  if (!rawSegments.length) {
    const fallbackSegments = extractEducationSegmentsFromText(
      coerceString(normalized?.rawText ?? context.rawText ?? ""),
    );
    rawSegments.push(...fallbackSegments);
  }

  let expandedRawSegments = rawSegments.flatMap((segment) => explodeCompoundEducationSegment(segment));
  if (!expandedRawSegments.length) {
    const rawTextSource = typeof normalized?.raw === "string" && normalized.raw.trim().length > 0
      ? normalized.raw
      : typeof context.rawText === "string"
      ? context.rawText
      : "";
    expandedRawSegments = recoverEducationFromLooseText(rawTextSource);
  }

  const parsedRaw = expandedRawSegments
    .map((content, idx) => buildEducationEntry(content, idx) ?? parseEducationBlock(content, idx))
    .filter(Boolean);

  parsedRaw.forEach((entry: any) => {
    if (!entry) return;
    entry.institution = cleanseEducationField(entry.institution ?? "");
    entry.degree = cleanseEducationField(entry.degree ?? "");
    if (entry.fieldOfStudy) {
      entry.fieldOfStudy = cleanseEducationField(entry.fieldOfStudy);
    }
  });

  const dedupedRaw: any[] = [];
  const seenRaw = new Set<string>();
  parsedRaw.forEach((entry) => {
    const key = dedupeKey(entry);
    if (!key || seenRaw.has(key)) return;
    dedupedRaw.push(entry);
    seenRaw.add(key);
  });

  const dedupedNormalized: any[] = [];
  const seenNormalized = new Set<string>();
  fromNormalized.forEach((entry) => {
    const key = dedupeKey(entry);
    if (!key || seenNormalized.has(key)) return;
    dedupedNormalized.push(entry);
    seenNormalized.add(key);
  });

  if (educationLanguageHints.size) {
    const existing = Array.isArray(normalized?.languagesRaw)
      ? (normalized.languagesRaw as unknown[])
      : [];
    const seenLang = new Set(existing.map((token) => coerceString(token).toLowerCase()).filter(Boolean));
    const merged = [...existing];
    educationLanguageHints.forEach((lang) => {
      const key = lang.toLowerCase();
      if (!seenLang.has(key)) {
        merged.push(lang);
        seenLang.add(key);
      }
    });
    normalized.languagesRaw = merged;
  }

  if (dedupedRaw.length > 0) {
    return dedupedRaw;
  }

  return dedupedNormalized;
}

function tokenizeList(input: string): string[] {
  const rawSegments = input.split(/[,;\n\u2022]+/);
  const tokens: string[] = [];

  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const fallbackSplits = trimmed
      .split(/(?<=\))\s+(?=[A-Z])|(?<=\b(?:Native|Intermediate|Basic|Fluent|Advanced|Professional|Elementary|Conversational))\s+(?=[A-Z])/i)
      .map((piece) => piece.trim())
      .filter(Boolean);
    if (fallbackSplits.length > 1) {
      tokens.push(...fallbackSplits);
    } else {
      tokens.push(trimmed);
    }
  }

  return tokens.filter((token) => token.length > 0);
}

function isNoiseSkill(name: string): boolean {
  if (!name) return true;
  const cleaned = name.replace(/[•·\-]+/g, "").trim();
  if (!cleaned) return true;
  if (cleaned.length === 1) {
    const keepSingles = new Set(["c", "r"]);
    return !keepSingles.has(cleaned.toLowerCase());
  }
  if (/^[0-9#+\-.,]+$/.test(cleaned)) return true;
  if (DATE_RANGE_RE.test(cleaned) || SINGLE_DATE_RE.test(cleaned)) return true;
  if (/\b(present|current)\b/i.test(cleaned) && /\d{4}/.test(cleaned)) return true;
  if (/\d{4}/.test(cleaned) && cleaned.split(/\d{4}/).length > 1) return true;
  if (cleaned.includes("//")) return true;
  if (cleaned.length > 120) return true;
  if (cleaned.split(/\s+/).length > 8) return true;
  if (/\b(responsible|developed|maintain|improved|decreased|enhanced|collaborated)\b/i.test(cleaned)) return true;
  if (/\bat\s+[A-Za-z]/i.test(cleaned)) return true;
  if (/\b(guard|manager|lead|assistant|officer|specialist|analyst|engineer|experience)\b/i.test(cleaned)) return true;
  return false;
}

function canonicalizeSkills(
  rawValue: unknown,
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): any[] {
  const deduped = new Map<string, string>();

  const pushToken = (token: unknown) => {
    const name = coerceString(token);
    if (!name || isNoiseSkill(name)) return;
    const cleaned = name.replace(/^(languages?|skills?|skill set|frameworks?|developer tools?|libraries|competences?|competencias?)[:\s\-]+/i, "").trim();
    const baseSurface = cleaned || name;
    const annotation = stripLevelAnnotation(baseSurface);
    const surface = (annotation.text || baseSurface).replace(/\([^)]*\)/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!surface) return;
    const normalizedKey = normalizeCandidateForStoplist(surface);
    if (!normalizedKey) return;
    const words = surface.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 6) return;
    if (/\b(guard|manager|lead|assistant|officer|supervisor|experience|certificate|program|course)\b/i.test(surface)) return;
    const lowerKey = normalizedKey.replace(/\s+/g, " ");
    const alias = skillAliases[lowerKey] ?? lowerKey;
    if (skillStoplist.has(lowerKey) || skillStoplist.has(alias)) return;

    const candidateKeys = new Set<string>();
    candidateKeys.add(alias);
    const baseNoParens = alias.replace(/\(.*?\)/g, "").trim();
    if (baseNoParens) candidateKeys.add(baseNoParens);
    if (surface.includes("/")) {
      surface.split(/[\/,+]/).map((part) => part.trim().toLowerCase()).filter(Boolean).forEach((part) => candidateKeys.add(part));
    }

    const canonicalKey = Array.from(candidateKeys).find((key) => canonicalSkills.has(key));
    let storeKey: string | undefined;
    if (canonicalKey) {
      storeKey = canonicalKey;
    } else {
      if (!SKILL_FALLBACK_KEYWORD_RE.test(surface)) return;
      storeKey = normalizedKey;
    }

    const displayName = surface.replace(/\s{2,}/g, " ");

    if (!deduped.has(storeKey) || displayName.length > (deduped.get(storeKey)?.length ?? 0)) {
      deduped.set(storeKey, displayName);
    }
  };

  ensureArray<any>(rawValue).forEach((entry) => pushToken(entry?.name ?? entry));

  if (!deduped.size && normalized?.skills && typeof normalized.skills === "object") {
    const text = coerceString(normalized.skills?.text ?? normalized.skills?.raw ?? "");
    tokenizeList(text).forEach(pushToken);
  }

  if (!deduped.size && typeof normalized?.skillsText === "string") {
    tokenizeList(normalized.skillsText).forEach(pushToken);
  }

  if (deduped.size < 3) {
    filterRawSection(rawSections, "skills", { preserveWhitespace: true }).forEach((content) => {
      tokenizeList(content).forEach(pushToken);
    });
  }

  if (deduped.size < 3) {
    const fallbackTexts = new Set<string>();
    const normalizedRaw = coerceString(normalized?.rawText ?? "");
    if (normalizedRaw) fallbackTexts.add(normalizedRaw);
    if (typeof context.rawText === "string" && context.rawText.trim()) {
      fallbackTexts.add(context.rawText);
    }
    fallbackTexts.forEach((text) => {
      extractSkillsFromTextBlock(text).forEach((skill) => pushToken(skill));
    });
  }

  return Array.from(deduped.values()).map((name, idx) => ({
    id: coerceId(null, "skill", idx),
    name,
  }));
}

function canonicalizeLanguages(
  rawValue: unknown,
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): any[] {
  const deduped = new Map<string, { name: string; level?: string }>();
  const sourceTokenSet = new Set<string>();
  const corpusPieces: string[] = [];

  if (Array.isArray(normalized?.languagesRaw)) {
    for (const token of normalized.languagesRaw) {
      const cleaned = coerceString(token).toLowerCase();
      if (cleaned) {
        sourceTokenSet.add(cleaned);
      }
    }
  }

  if (typeof normalized?.languagesText === "string") {
    tokenizeList(normalized.languagesText).forEach((token) => {
      const cleaned = coerceString(token).toLowerCase();
      if (cleaned) {
        sourceTokenSet.add(cleaned);
      }
    });
    corpusPieces.push(normalized.languagesText.toLowerCase());
  }

  if (typeof normalized?.rawText === "string") {
    corpusPieces.push(normalized.rawText.toLowerCase());
  }
  if (typeof context.rawText === "string") {
    corpusPieces.push(context.rawText.toLowerCase());
  }

  const textCorpus = corpusPieces.join(" ");

  const push = (name: unknown, level?: unknown) => {
    const rawName = coerceString(name);
    if (!rawName) return;
    const normalizedSurface = rawName.replace(/\s+/g, " ").trim();
    if (!normalizedSurface) return;
    const annotation = stripLevelAnnotation(normalizedSurface);
    const surfaceNoDates = annotation.text
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/[-–—]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!surfaceNoDates) return;
    if (looksLikeEducationFragment(surfaceNoDates)) return;
    if (/(program|certificate|curriculum|college|training|foundation|course|academy|school|approach|level|guard)/i.test(surfaceNoDates)) return;
    const cleanedName = surfaceNoDates
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!cleanedName) return;
    const canonicalCandidate = normalizeLanguageTokenSync(cleanedName);
    if (!canonicalCandidate) return;
    const canonical = canonicalCandidate;
    const key = canonical.toLowerCase();
    const lowerCleaned = cleanedName.toLowerCase();
    const occursInSources =
      sourceTokenSet.has(lowerCleaned) ||
      (key && sourceTokenSet.has(key));
    const occursInCorpus = lowerCleaned ? textCorpus.includes(lowerCleaned) : false;
    const matchesCanonical = lowerCleaned === key;
    const occursCanonical = key ? textCorpus.includes(key) : false;
    if (!CANONICAL_LANGUAGES.has(canonical) || (!occursInSources && !occursInCorpus && !matchesCanonical && !occursCanonical)) {
      return;
    }
    const normalizedLevel = coerceString(level ?? annotation.level ?? "") || undefined;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { name: canonical, level: normalizedLevel });
    } else if (!existing.level && normalizedLevel) {
      existing.level = normalizedLevel;
    }
  };

  ensureArray<any>(rawValue).forEach((entry) => {
    push(entry?.name ?? entry?.language ?? entry, entry?.level ?? entry?.fluency);
  });

  if (deduped.size < 3) {
    const tokensSource =
      Array.isArray(normalized?.languagesRaw) && normalized.languagesRaw.length > 0
        ? normalized.languagesRaw.map((lang: unknown) => coerceString(lang))
        : [];
    tokensSource.push(coerceString(normalized?.languages?.text ?? normalized?.languagesText ?? ""));
    tokensSource
      .filter(Boolean)
      .flatMap(tokenizeList)
      .forEach((token: string) => push(token));
  }

  if (deduped.size < 3) {
    filterRawSection(rawSections, "languages", { preserveWhitespace: true }).forEach((content) => {
      tokenizeList(content).forEach((token) => push(token));
    });
  }

  if (!deduped.size) {
    const fallbackTexts = new Set<string>();
    const normalizedRaw = coerceString(normalized?.rawText ?? "");
    if (normalizedRaw) fallbackTexts.add(normalizedRaw);
    if (typeof context.rawText === "string" && context.rawText.trim()) {
      fallbackTexts.add(context.rawText);
    }
    fallbackTexts.forEach((text) => {
      extractLanguagesFromTextBlock(text).forEach(({ name, level }) => push(name, level));
    });
  }

  return Array.from(deduped.values()).map((entry, idx) => ({
    id: coerceId(null, "lang", idx),
    name: entry.name,
    level: entry.level,
  }));
}

function canonicalizeAchievements(rawValue: unknown, normalized: any, rawSections: RawSection[], context: CanonicalizeContext): any[] {
  const arr = ensureArray<any>(rawValue)
    .map((entry, idx) => {
      const text = coerceString(entry?.text ?? entry?.content ?? entry);
      if (!text) return null;
      return {
        id: coerceId(entry?.id, "ach", idx),
        text,
      };
    })
    .filter(Boolean);

  const items: Array<{ id: string; text: string }> = [];
  const seen = new Set<string>();

  if (arr.length > 0) {
    const dedupedArrTexts = dedupeAchievementTextsConservative(arr.map((entry) => entry.text));
    for (const text of dedupedArrTexts) {
      const key = normalizeAchievementForComparison(text);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ id: coerceId(null, "ach", items.length), text });
    }
  }

  const directSegments: string[] = [];
  const normalizedText = coerceString((normalized as any)?.achievements?.text ?? "");
  if (normalizedText) directSegments.push(normalizedText);
  const normalizedAsString = typeof rawValue === "string" ? rawValue : "";
  if (normalizedAsString) directSegments.push(normalizedAsString);
  const fromRaw = filterRawSection(rawSections, "achievements", { preserveWhitespace: true });
  if (fromRaw.length) directSegments.push(...fromRaw);

  const pushAchievement = (text: string) => {
    const clean = text.replace(/^[•*\-\u2022]+/, "").trim();
    if (!clean) return;
    const clipped = clipAchievementText(clean);
    if (!clipped) return;
    const dedupedTexts = dedupeAchievementTextsConservative([
      ...items.map((entry) => entry.text),
      clipped,
    ]);
    items.length = 0;
    seen.clear();
    dedupedTexts.forEach((candidate) => {
      const key = normalizeAchievementForComparison(candidate);
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ id: coerceId(null, "ach", items.length), text: candidate });
    });
  };

  directSegments.forEach((segment) => {
    segment
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach(pushAchievement);
  });

  const contextText = typeof context.rawText === "string" ? context.rawText : "";
  if (contextText) {
    extractAchievementsFromText(contextText).forEach(pushAchievement);
  }

  return items;
}

function clipAchievementText(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= 320) return trimmed;
  const sentenceMatches = trimmed.match(/[^.!?]+[.!?]?/g) || [];
  if (!sentenceMatches.length) return trimmed.slice(0, 320).trim();
  const selected: string[] = [];
  for (const fragment of sentenceMatches) {
    const sentence = fragment.trim();
    if (!sentence) continue;
    selected.push(sentence);
    if (selected.join(" ").length >= 280 || selected.length >= 2) {
      break;
    }
  }
  const clipped = selected.join(" ") || trimmed.slice(0, 320);
  const limited = clipped.length > 320 ? clipped.slice(0, 320) : clipped;
  return limited.trim();
}

function canonicalizeRawSections(normalized: any, rawSections: RawSection[]): RawSection[] {
  if (Array.isArray(normalized?.rawSections) && normalized.rawSections.length > 0) {
    return normalized.rawSections;
  }
  return rawSections;
}

export function canonicalizeParserResult(result: any, context: CanonicalizeContext) {
  const normalizedInput = result?.normalized;
  const normalized = normalizedInput && typeof normalizedInput === "object" ? { ...normalizedInput } : {};
  const rawSections = extractRawSections({ ...result, normalized });

  const experienceResult = canonicalizeExperience(normalized.experience, rawSections, normalized, context);
  normalized.experience = experienceResult.items;
  normalized.education = canonicalizeEducation(normalized.education, rawSections, normalized, context);
  normalized.skills = canonicalizeSkills(normalized.skills, normalized, rawSections, context);
  if (!normalized.skillsText && Array.isArray(normalized.skills) && normalized.skills.length > 0) {
    normalized.skillsText = normalized.skills.map((item: any) => item?.name ?? "").filter(Boolean).join(", ");
  }
  const languages = canonicalizeLanguages(normalized.languages, normalized, rawSections, context);
  normalized.languages = languages;
  if (!normalized.languagesText && languages.length > 0) {
    normalized.languagesText = languages.map((entry: any) => entry.name).filter(Boolean).join(", ");
  }
  if (!Array.isArray(normalized.languagesRaw) || normalized.languagesRaw.length === 0) {
    normalized.languagesRaw = languages.map((entry: any) => entry.name).filter(Boolean);
  }
  normalized.projects = canonicalizeProjects(normalized.projects, normalized, rawSections, context);
  normalized.achievements = canonicalizeAchievements(normalized.achievements, normalized, rawSections, context);
  normalized.rawSections = canonicalizeRawSections(normalized, rawSections);
  if (!normalized.rawText && typeof context.rawText === "string") {
    normalized.rawText = context.rawText;
  }

  const rawSummarySection = filterRawSection(rawSections, "summary")[0];
  const profileSection = filterRawSection(rawSections, "profile")[0];
  let summaryText =
    coerceString((normalized.summary as any)?.text) ||
    (rawSummarySection ?? "");
  let locationBirth: string | undefined;
  const birthFromSummary = extractPlaceOfBirth(summaryText);
  summaryText = birthFromSummary.cleaned;
  if (birthFromSummary.place) {
    locationBirth = birthFromSummary.place;
  }
  if (profileSection) {
    const profileBirth = extractPlaceOfBirth(profileSection);
    if (profileBirth.place) {
      locationBirth = profileBirth.place;
    }
    if (!summaryText) {
      summaryText = profileBirth.cleaned;
    }
  }

  summaryText = stripBiographyNoise(summaryText);
  summaryText = stripLeadingSummaryHeading(summaryText);
  summaryText = collapseSpacedCaps(summaryText);
  summaryText = (summaryText || "").replace(/^[,;:\u2013\u2014\s]+/, "").trim();

  if (summaryText) {
    const promotedSummary = [rawSummarySection, profileSection]
      .map((candidate) => cleanRawSummaryCandidate(candidate))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find((candidate) => shouldPromoteFullerRawSummary(summaryText, candidate));
    if (promotedSummary) {
      summaryText = promotedSummary;
    }
  }

  if (!summaryText) {
    // Try synthesizing from profile/contact
    const candidates: string[] = [];
    if (coerceString(normalized?.rawText)) candidates.push(coerceString(normalized.rawText));
    if (coerceString(normalized?.raw)) candidates.push(normalized.raw);
    if (Array.isArray(normalized?.rawSections)) {
      candidates.push(...normalized.rawSections.map((s: any) => coerceString(s?.text || s?.content)).filter(Boolean));
    }
    const candidate = candidates.find(Boolean);
    if (candidate) {
      summaryText = firstSentence(candidate.replace(/\s+/g, " ").trim());
    }
  } else {
    summaryText = cleanSummaryValue(summaryText);
  }

  // Guarantee object shape
  const uniformSummary = coerceSummaryObject(summaryText, 0.5);
  if (uniformSummary) {
    (normalized as any).summary = uniformSummary;
    (normalized as any).summaryFirstSentence = firstSentence(uniformSummary.text);
  }

  if (!normalized.contact || typeof normalized.contact !== "object") {
    normalized.contact = {};
  }

  const sanitizedPhone = sanitizePhoneValue((normalized.contact as any).phone ?? (normalized.contact as any).phoneRaw);
  if (sanitizedPhone) {
    (normalized.contact as any).phone = sanitizedPhone;
    (normalized.contact as any).phoneRaw = sanitizedPhone;
  } else {
    delete (normalized.contact as any).phone;
    delete (normalized.contact as any).phoneRaw;
  }

  const desiredPosition = deriveDesiredPosition(normalized, context);
  if (desiredPosition) {
    normalized.desiredPosition = desiredPosition;
    (normalized.contact as any).desiredPosition = desiredPosition;
  } else {
    delete (normalized as any).desiredPosition;
    delete (normalized.contact as any).desiredPosition;
  }

  sanitizeContactLocation(normalized);

  if (locationBirth && !(normalized.contact as any).locationBirth) {
    (normalized.contact as any).locationBirth = locationBirth;
  }

  const derivedName = deriveNameFromContext(normalized, context);
  if (derivedName) {
    normalized.name = derivedName;
    if (normalized.contact) {
      (normalized.contact as any).name = derivedName;
    }
  }

  const baseDiagnostics = (
    result?.diagnostics && typeof result.diagnostics === "object"
      ? { ...result.diagnostics }
      : {}
  ) as Record<string, any>;

  const experienceDiagnostics = experienceResult.diagnostics;
  if (experienceDiagnostics.droppedEmpty || experienceDiagnostics.fallbackCount) {
    (normalized as any).experienceDiagnostics = experienceDiagnostics;
    baseDiagnostics.experience_dropped_empty = experienceDiagnostics.droppedEmpty;
    baseDiagnostics.experience_fallback_count = experienceDiagnostics.fallbackCount;
    baseDiagnostics.experience_source = experienceDiagnostics.source;
  }

  return {
    ...result,
    diagnostics: baseDiagnostics,
    normalized,
  };
}
const LANGUAGE_TOKEN_BLOCKLIST = new Set([
  "program",
  "programs",
  "course",
  "courses",
  "guard",
  "guards",
  "security",
  "foundation",
  "college",
  "international",
  "report",
  "writing",
  "intervention",
  "techniques",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "curriculum",
  "level",
  "assessment",
  "north",
  "naples",
  "international",
  "college",
  "academy",
]);
const SKILL_FALLBACK_KEYWORD_RE = /(analysis|analytics|architecture|automation|compliance|combat|communication|controls|design|development|diagnostics|devices|engineering|gestion|knowledge|maintenance|monitoring|operations|optimization|programming|project|projet|recruit|recrutement|research|security|sourcing|support|testing|troubleshooting|visualization|investigation|service)/i;
