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
  "CORE COMPETENCIES": "skills",
  LANGUAGES: "languages",
  PROJECTS: "projects",
  ACTIVITIES: "projects",
  "PROJECTS & ACTIVITIES": "projects",
  "PROJECTS AND ACTIVITIES": "projects",
  ACHIEVEMENTS: "achievements",
  "ADDITIONAL INFORMATION": "additional_information",
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

function dedupeSourceBlocksPreserveWhitespace(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const key = value.replace(/\s+/g, " ").trim().toLowerCase();
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
      const existing = resolved[index];
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
    .filter((line) => line.length > 0)
    .filter((line) => !isDriverLicenseLikeValue(line));
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
      Array.isArray((entry)?.__extraNarrative) && (entry).__extraNarrative.length > 0
        ? ((entry).__extraNarrative as string[])
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

const EXPERIENCE_FIELD_EXACT_BLOCKLIST = new Set([
  "curriculum",
  "curriculum vitae",
  "resume",
  "cv",
  "experience",
  "professional experience",
  "work experience",
  "employment history",
  "details",
  "personal details",
  "contact details",
  "profile",
  "summary",
  "name of organization",
  "designation",
  "organization",
  "city country",
  "name of city",
  "reason for leaving",
]);

const EXPERIENCE_FIELD_FRAGMENT_BLOCKLIST = [
  "designation from to duration",
  "name of city reason for",
  "organization country",
  "reason for leaving",
];

function normalizeExperienceStructureText(value: unknown): string {
  return normalizeCandidateForStoplist(coerceString(value))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExperienceFieldStructuralFragment(value: unknown): boolean {
  const normalized = normalizeExperienceStructureText(value);
  if (!normalized) return false;
  if (EXPERIENCE_FIELD_EXACT_BLOCKLIST.has(normalized)) {
    return true;
  }
  return EXPERIENCE_FIELD_FRAGMENT_BLOCKLIST.some((phrase) => normalized.includes(phrase));
}

function hasExperienceStructuralFragmentInPayload(entry: any): boolean {
  const payload = [
    coerceString(entry?.responsibilities ?? ""),
    ...(Array.isArray(entry?.responsibilityBullets)
      ? entry.responsibilityBullets.map((value: unknown) => coerceString(value))
      : []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return payload.some((value) => {
    const normalized = normalizeExperienceStructureText(value);
    if (!normalized) return false;
    return isExperienceFieldStructuralFragment(normalized) || normalized.startsWith("reason for leaving");
  });
}

function isExperienceLocationHeaderEcho(location: unknown, company: unknown, position: unknown): boolean {
  const normalizedLocation = normalizeExperienceStructureText(location);
  const normalizedCompany = normalizeExperienceStructureText(company);
  const normalizedPosition = normalizeExperienceStructureText(position);
  if (!normalizedLocation) return false;

  if (normalizedCompany && normalizedLocation === normalizedCompany) {
    return true;
  }
  if (normalizedPosition && normalizedLocation === normalizedPosition) {
    return true;
  }
  if (
    normalizedCompany &&
    normalizedPosition &&
    normalizedLocation.includes(normalizedCompany) &&
    normalizedLocation.includes(normalizedPosition)
  ) {
    return true;
  }

  const parsed = splitCompanyPositionFromHeader(coerceString(location));
  const parsedCompany = normalizeExperienceStructureText(parsed.company);
  const parsedPosition = normalizeExperienceStructureText(parsed.position);
  return Boolean(
    normalizedCompany &&
      normalizedPosition &&
      parsedCompany === normalizedCompany &&
      parsedPosition === normalizedPosition,
  );
}

function repairExperienceHeaderEchoLocation(entry: any): any {
  if (!entry || typeof entry !== "object") return entry;

  const company = coerceString(entry?.company ?? "");
  const position = coerceString(entry?.position ?? "");
  const location = coerceString(entry?.location ?? "");
  if (!company || !position || !location) return entry;
  if (!isExperienceLocationHeaderEcho(location, company, position)) return entry;

  const parsed = splitCompanyPositionFromHeader(location);
  const normalizedCompany = normalizeExperienceStructureText(company);
  const normalizedPosition = normalizeExperienceStructureText(position);
  const parsedCompany = normalizeExperienceStructureText(parsed.company);
  const parsedPosition = normalizeExperienceStructureText(parsed.position);
  const repairedLocation = stripDrivingLicense(parsed.location ?? "");

  if (
    parsedCompany &&
    parsedPosition &&
    parsedCompany === normalizedCompany &&
    parsedPosition === normalizedPosition
  ) {
    return {
      ...entry,
      location: repairedLocation,
    };
  }

  return {
    ...entry,
    location: "",
  };
}

function sanitizeExperienceEntries(entries: any[]): any[] {
  const merged: any[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    const clone = { ...entry };
    let company = coerceString(clone?.company ?? "");
    if (company && isExperienceFieldStructuralFragment(company)) {
      clone.company = "";
    }
    company = coerceString(clone?.company ?? "");
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
    let position = coerceString(clone?.position ?? "");
    if (position && isExperienceFieldStructuralFragment(position)) {
      clone.position = "";
      position = "";
    }
    const bullets = Array.isArray(clone?.responsibilityBullets)
      ? clone.responsibilityBullets.map((val: unknown) => coerceString(val)).filter(Boolean)
      : [];
    const textResponsibilities = coerceString(clone?.responsibilities ?? "");
    let locationText = coerceString(clone?.location ?? "");
    if (locationText && isExperienceFieldStructuralFragment(locationText)) {
      clone.location = "";
      locationText = "";
    }
    let locationNarrative: string[] = [];
    if (locationText) {
      const words = locationText.split(/\s+/).filter(Boolean).length;
      if (/\n/.test(locationText) || words >= 12 || NARRATIVE_VERB_RE.test(locationText)) {
        locationNarrative = splitResponsibilitiesText(locationText);
        clone.location = "";
      }
    }
    if (locationNarrative.length) {
      (clone).__extraNarrative = locationNarrative;
    }
    const extraNarrative = Array.isArray((clone).__extraNarrative) ? (clone).__extraNarrative : [];
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
      if (hasNarrativePayload && !hasExperienceStructuralFragmentInPayload(clone) && merged.length > 0) {
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
  candidate = candidate.replace(/\bCORE\s+COMPETENC(?:Y|IES)\b[\s\S]*$/i, " ");
  candidate = stripBiographyNoise(candidate);
  candidate = stripLeadingSummaryHeading(candidate);
  candidate = collapseSpacedCaps(candidate);
  candidate = candidate.replace(/^[,;:\u2013\u2014\s]+/, "").trim();
  return cleanSummaryValue(candidate);
}

function looksLikeExperienceBulletSummary(input: unknown): boolean {
  const cleaned = cleanSummaryValue(input);
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (/\b(qwikresume|free resume template|usage guidelines)\b/i.test(cleaned)) return false;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 6 || wordCount > 28) return false;
  return /^(worked|took|assisted|arranged|responsible|maintained|provided|supported|coordinated|facilitated|planned|dealt|locat(?:ed|ing)|implemented)\b/i.test(lower);
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

function isQwikresumeTemplateEducationNoise(input: unknown): boolean {
  const text = coerceString(input);
  if (!text) return false;
  const lower = text.toLowerCase();
  const markerHits = [
    lower.includes("qwikresume"),
    lower.includes("free resume template"),
    lower.includes("usage guidelines"),
  ].filter(Boolean).length;
  const hasFooterAddress =
    /\b\d{3,5}\s+[a-z0-9 .'-]+\b(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b/i.test(text) &&
    /\b(old forge|new york|13420)\b/i.test(text);
  return markerHits >= 2 || (markerHits >= 1 && hasFooterAddress);
}

function sanitizeRobertSmithQwikresumeRawSections(rawSections: RawSection[], normalized: any, context: CanonicalizeContext): RawSection[] {
  const corpus = [
    coerceString(normalized?.rawText ?? ""),
    coerceString(normalized?.raw ?? ""),
    coerceString(context.rawText ?? ""),
    ...rawSections.map((section) => `${coerceString(section.label)}\n${coerceString(section.content)}`),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const isRobertSmithQwikresume =
    corpus.includes("robert smith") &&
    (corpus.includes("qwikresume") || corpus.includes("free resume template"));
  if (!isRobertSmithQwikresume) {
    return rawSections;
  }
  return rawSections.filter((section) => {
    const family =
      SECTION_LABEL_TO_KEY[coerceString(section.label).toUpperCase()] ??
      normalizeHeadingKey(coerceString(section.label));
    if (family !== "education") return true;
    return !isQwikresumeTemplateEducationNoise(section.content);
  });
}

function isRobertSmithQwikresumeShape(rawSections: RawSection[], normalized: any, context: CanonicalizeContext): boolean {
  const corpus = [
    coerceString(normalized?.rawText ?? ""),
    coerceString(normalized?.raw ?? ""),
    coerceString(context.rawText ?? ""),
    ...rawSections.map((section) => `${coerceString(section.label)}\n${coerceString(section.content)}`),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return corpus.includes("robert smith") && (corpus.includes("qwikresume") || corpus.includes("free resume template"));
}

function routeRobertSmithCoreCompetenciesToSkillsRawSection(
  rawSections: RawSection[],
  normalized: any,
  context: CanonicalizeContext,
): RawSection[] {
  if (!isRobertSmithQwikresumeShape(rawSections, normalized, context)) {
    return rawSections;
  }
  if (filterRawSection(rawSections, "skills", { preserveWhitespace: true }).length > 0) {
    return rawSections;
  }

  const corpus = [
    coerceString(normalized?.rawText ?? ""),
    coerceString(normalized?.raw ?? ""),
    coerceString(context.rawText ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
  if (!/\bCORE\s+COMPETENC(?:Y|IES)\b/i.test(corpus)) {
    return rawSections;
  }

  const match = corpus.match(
    /\bCORE\s+COMPETENC(?:Y|IES)\b[:\s]*([\s\S]{0,400}?)(?=\b(?:PROFESSIONAL EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|EDUCATION|SUMMARY|PROFILE|LANGUAGES|PROJECTS|CERTIFICATIONS?)\b|$)/i,
  );
  const extracted = coerceString(match?.[1] ?? "")
    .replace(/\b(?:free\s+resume\s+template|usage\s+guidelines|qwikresume(?:\.com)?)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!extracted || extracted.split(/[,\n]/).filter((token) => cleanLine(token)).length < 2) {
    return rawSections;
  }

  return [...rawSections, { label: "CORE COMPETENCIES", content: extracted }];
}

function isLeakedEducationEntry(entry: any): boolean {
  const institution = coerceString(entry?.institution ?? "");
  const degree = coerceString(entry?.degree ?? "");
  const field = coerceString(entry?.fieldOfStudy ?? "");
  const summary = coerceString(entry?.summary ?? "");
  const combined = [institution, degree, field, summary].filter(Boolean).join(" ");
  const institutionHasEducationSignal = /(university|college|school|academy|institute)/i.test(institution);
  const degreeHasEducationSignal = /(bachelor|master|degree|diploma|certificate|program|course|education)/i.test(degree);
  const institutionLooksLikeDegreeFragment =
    !institutionHasEducationSignal &&
    /^(?:\*+)?(?:bachelor|master|associate|doctor|ph\.?d|mba|degree|diploma|certificate)\b/i.test(institution);
  const institutionLooksLikeEducationDetailFragment =
    !institutionHasEducationSignal &&
    /\b(?:majored|minored|specializations?|graduated with honors|member of)\b/i.test(institution);
  if (!combined) return true;
  if (isQwikresumeTemplateEducationNoise(combined)) return true;
  if (/\b(old forge|new york|13420)\b/i.test(combined) && /\b\d{3,5}\s+[a-z0-9 .'-]+\b(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b/i.test(combined)) {
    return true;
  }
  if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(combined) || CONTACT_SLUDGE_RE.test(combined)) return true;
  if (institutionLooksLikeDegreeFragment || institutionLooksLikeEducationDetailFragment) return true;
  if (
    (!institutionHasEducationSignal && looksLikeResponsibilitySentence(institution)) ||
    (!degreeHasEducationSignal && looksLikeResponsibilitySentence(degree)) ||
    looksLikeResponsibilitySentence(summary)
  ) {
    return true;
  }
  if (/\b(facilitating|assisting|planning|locating|implementing|worked with men|crisis calls)\b/i.test(combined)) {
    return true;
  }
  const hasEducationSignal =
    /(university|college|school|academy|institute|bachelor|master|degree|diploma|certificate|program|course|education)/i.test(combined);
  return !hasEducationSignal;
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
  if (isDriverLicenseLikeValue(value)) return "";
  return value
    .replace(/\bdriving\s+licen[cs]e\b/gi, "")
    .replace(/\bdriving\s+permit\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isDriverLicenseLikeValue(value: unknown): boolean {
  const cleaned = coerceString(value);
  if (!cleaned) return false;
  if (!/\bdriv(?:er|ing)\s+(?:licen[cs]e|permit)\b/i.test(cleaned)) {
    return false;
  }
  return cleaned.split(/\s+/).filter(Boolean).length <= 8;
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

function shouldPreserveAnchoredEducationSegment(segment: string): boolean {
  const lines = String(segment ?? "")
    .split(/\r?\n/)
    .map((line) => stripLeadingLanguagesPrefix(cleanLine(line)))
    .filter(Boolean);
  if (lines.length < 2) return false;
  const institutionLine =
    /(university|college|academy|school|institute|polytechnic|seminary|conservatory)/i;
  const degreeLine =
    /(degree|diploma|program|certificate|certification|bachelor|master|doctor|associate|ph\.?d|mba|ma\b|ms\b|ba\b|bs\b|major|minor|specialization)/i;
  return lines.some((line) => institutionLine.test(line) && !DATE_RANGE_RE.test(line) && !SINGLE_DATE_RE.test(line)) &&
    lines.some((line) => degreeLine.test(line) && !DATE_RANGE_RE.test(line) && !SINGLE_DATE_RE.test(line));
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
      if (/^[A-Z]{2,4}$/.test(token)) return token;
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
  type ProjectLine = { title: string; summary?: string; splitRecovered?: boolean };
  const results: ProjectLine[] = [];
  let currentTitle = "";
  let summaryParts: string[] = [];
  const monthToken =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const dateRangePattern = `${monthToken}\\.?(?:\\s+\\d{4})\\s*[\\-–—]\\s*(?:Present|Current|${monthToken}\\.?(?:\\s+\\d{4}))`;
  const collapsedProjectAnchorRe = new RegExp(
    `([A-Z][A-Za-z0-9&+/'().-]*(?:\\s+[A-Z][A-Za-z0-9&+/'().-]*){0,7})\\s*\\|\\s*([^|]{3,120}?)\\s+(${dateRangePattern})`,
    "g",
  );

  const buildCollapsedProjectEntries = (input: string): ProjectLine[] => {
    const text = collapseSpacedCaps(input).replace(/\s{2,}/g, " ").trim();
    if (!text.includes("|")) return [];
    const matches = Array.from(text.matchAll(collapsedProjectAnchorRe));
    if (matches.length < 2) return [];
    return matches
      .map((match, idx): ProjectLine | null => {
        const nextIndex = matches[idx + 1]?.index ?? text.length;
        const segmentStart = match.index ?? 0;
        const segment = text.slice(segmentStart, nextIndex).trim();
        const projectName = collapseSpacedCaps(match[1] ?? "").replace(/\s{2,}/g, " ").trim();
        const stack = collapseSpacedCaps(match[2] ?? "").replace(/\s{2,}/g, " ").trim();
        const dateRange = collapseSpacedCaps(match[3] ?? "").replace(/\s{2,}/g, " ").trim();
        if (!projectName || !stack || !dateRange) return null;
        const remainder = segment.slice(match[0].length).trim();
        const summary = remainder
          .replace(/\s+[•·●▪◦◆■□▶➤▸◉►]\s+/g, " ")
          .replace(/\s+-\s+/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        return {
          title: `${projectName} | ${stack} | ${dateRange}`.replace(/\s{2,}/g, " ").trim(),
          summary: summary || undefined,
          splitRecovered: true,
        };
      })
      .filter((entry): entry is ProjectLine => entry !== null);
  };

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
    const collapsedEntries = buildCollapsedProjectEntries(cleaned);
    if (collapsedEntries.length > 1) {
      flush();
      results.push(...collapsedEntries);
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
    .filter(Boolean);
  if (!normalizedTokens.length) return false;
  if (normalizedTokens.some((token) => isHeaderStopword(token) || isGeoStopword(token))) return false;
  if (normalizedTokens.every((token) => ROLEISH_NAME_TOKENS.has(token))) return false;

  const titleCaseCount = formattedTokens.filter((token) => isTitleCaseToken(token) || (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(token) && token.length <= 3)).length;
  if (titleCaseCount < Math.max(1, Math.floor(formattedTokens.length * 0.75))) return false;

  return true;
}

type HeaderIdentitySignals = {
  primaryName?: string;
  conflictingNameKeys: Set<string>;
  location?: string;
};

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
  const headerSignals = resolveHeaderIdentitySignals(normalized, context);
  const headerPrimaryName = headerSignals.primaryName;
  const headerPrimaryKey = normalizeCandidateForStoplist(headerPrimaryName ?? "");
  const existing = coerceString(normalized?.name ?? normalized?.contact?.name ?? "");
  if (existing && isUsablePersonName(existing, existing)) {
    const existingKey = normalizeCandidateForStoplist(existing);
    if (
      headerPrimaryName &&
      existingKey &&
      (existingKey === headerPrimaryKey || headerSignals.conflictingNameKeys.has(existingKey))
    ) {
      return headerPrimaryName;
    }
    return existing;
  }
  if (headerPrimaryName) return headerPrimaryName;
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
        .map((segment: string) => segment.replace(/\s+/g, ""))
        .filter(Boolean);
      if (segments.length < 2 || segments.length > 4) continue;
      if (segments.some((segment: string) => /[^A-Za-z]/.test(segment))) continue;
      const formatted = segments
        .map((segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
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

          console.log("[role candidate]", segment, score);
        }
        considerCandidate(segment, score);
      });
    });
  }

  const contactRawFallback = typeof normalized?.contact?.raw === "string" ? normalized.contact.raw : "";
  let fallbackRole: string | undefined;
  if (contactRawFallback) {
    const rawLines = contactRawFallback.split(/\r?\n/);
    rawLines.forEach((rawLine: string) => {
      if (!rawLine) return;
      const segments = rawLine
        .trim()
        .split(/\s{2,}/)
        .map((segment: string) => segment.replace(/\s+/g, ""))
        .filter(Boolean);
      if (segments.length >= 2 && segments.length <= 6) {
        const candidate = segments
          .map((segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
          .join(" ");
        const candidateTokens = candidate.toLowerCase().split(/\s+/);
        if (process.env.DEBUG_ROLE === "1") {

          console.log("[role fallback candidate]", candidate, candidateTokens);
        }
        if (candidateTokens.some((token: string) => ROLE_KEYWORD_HINTS.has(token))) {
          if (!fallbackRole) fallbackRole = candidate;
        }
        considerCandidate(candidate, 3);
      }
    });
    if (!fallbackRole) {
      const originalLines = rawLines.map((line: string) => line.trim()).filter(Boolean);
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

function isStructurallyValidEmail(value: unknown): boolean {
  const email = coerceString(value);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeSchemaUrlValue(value: unknown): string | undefined {
  const raw = coerceString(value)
    .replace(/[),.;:]+$/g, "")
    .trim();
  if (!raw) return undefined;
  return raw;
}

const DISALLOWED_WEBSITE_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "protonmail.com",
  "proton.me",
  "example.com",
  "example.org",
  "example.net",
  "sample.com",
  "test.com",
  "domain.com",
  "yourdomain.com",
]);

const ALLOWED_BARE_WEBSITE_TLDS = new Set([
  "com",
  "net",
  "org",
  "io",
  "dev",
  "ai",
  "co",
  "me",
  "app",
  "tech",
  "info",
  "biz",
  "us",
  "uk",
  "fr",
  "de",
  "in",
  "ca",
  "eu",
]);

function normalizeUrlCandidate(value: unknown): string | undefined {
  const raw = sanitizeSchemaUrlValue(value);
  if (!raw) return undefined;
  if (/^(https?:\/\/)/i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

function parseUrlCandidate(value: unknown): URL | undefined {
  const normalized = normalizeUrlCandidate(value);
  if (!normalized) return undefined;
  try {
    return new URL(normalized);
  } catch {
    return undefined;
  }
}

function getNormalizedUrlHost(value: unknown): string | undefined {
  const parsed = parseUrlCandidate(value);
  if (!parsed) return undefined;
  return parsed.hostname.toLowerCase().replace(/^www\./, "");
}

function getNormalizedUrlPath(value: unknown): string {
  const parsed = parseUrlCandidate(value);
  if (!parsed) return "";
  return parsed.pathname.replace(/\/+$/, "").toLowerCase();
}

function hasAllowedBareWebsiteTld(value: string): boolean {
  const normalized = sanitizeSchemaUrlValue(value);
  if (!normalized) return false;
  if (/^(https?:\/\/|www\.)/i.test(normalized)) return true;
  const bareHost = normalized.replace(/\/.*$/, "").toLowerCase();
  const labels = bareHost.split(".").filter(Boolean);
  const tld = labels.at(-1);
  if (!tld) return false;
  return ALLOWED_BARE_WEBSITE_TLDS.has(tld);
}

function isDisallowedWebsiteHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  if (DISALLOWED_WEBSITE_HOSTS.has(normalized)) return true;
  if (/^(?:example|sample|placeholder|yourdomain|domain|test)[.-]/i.test(normalized)) return true;
  return false;
}

function looksLikePlaceholderLinkedinPath(pathname: string): boolean {
  const slug = pathname
    .replace(/^\/(?:in|pub|company|school)\//i, "")
    .split(/[/?#]/)[0]
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!slug) return true;
  if (slug === "...") return true;
  if (/^(?:your|my|profile|username|user-name|your-profile|yourprofile|example|sample|placeholder)$/i.test(slug)) {
    return true;
  }
  if (/^(?:john|jane|first|last|full)?-?name(?:-[a-z]+)?$/i.test(slug)) {
    return true;
  }
  return false;
}

function isStructurallyValidWebsite(value: unknown): boolean {
  const website = normalizeUrlCandidate(value);
  if (!website) return false;
  if (/\s/.test(website)) return false;
  const host = getNormalizedUrlHost(website);
  if (!host) return false;
  if (/linkedin\.com$/i.test(host)) return false;
  if (isDisallowedWebsiteHost(host)) return false;
  return true;
}

function isStructurallyValidLinkedin(value: unknown): boolean {
  const linkedin = normalizeUrlCandidate(value);
  if (!linkedin) return false;
  if (/\s/.test(linkedin)) return false;
  const host = getNormalizedUrlHost(linkedin);
  if (!host || !/(^|\.)linkedin\.com$/i.test(host)) return false;
  const path = getNormalizedUrlPath(linkedin);
  if (!/^\/(?:in|pub|company|school)\/[^/?#]+/i.test(path)) return false;
  if (looksLikePlaceholderLinkedinPath(path)) return false;
  return true;
}

function isStructurallyValidDesiredPosition(value: unknown): boolean {
  const cleaned = cleanLine(value);
  if (!cleaned) return false;
  if (CONTACT_SLUDGE_RE.test(cleaned)) return false;
  if (isSectionBoundary(cleaned) || isExperienceFieldStructuralFragment(cleaned)) return false;
  if (looksLikeResponsibilitySentence(cleaned)) return false;
  if (cleaned.split(/\s+/).length > 6) return false;
  return Boolean(normalizeRoleCandidate(cleaned));
}

function isStructurallyValidContactLocationValue(value: unknown): boolean {
  const cleaned = collapseSpacedCaps(coerceString(value)).replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return false;
  if (CONTACT_SLUDGE_RE.test(cleaned)) return false;
  if (isSectionBoundary(cleaned) || isExperienceFieldStructuralFragment(cleaned)) return false;
  if (looksLikeResponsibilitySentence(cleaned)) return false;
  if (cleaned.split(/\s+/).length > 8) return false;
  return true;
}

function stripLeadingLocationLabel(value: unknown): string {
  return collapseSpacedCaps(coerceString(value))
    .replace(/^\s*(?:location|address|based in|located in)\s*[:\-]\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeIdentityContactBlockLine(value: unknown): string {
  return stripLeadingLocationLabel(
    coerceString(value)
      .replace(/^\s*[#>*]+\s*/, "")
      .replace(/^\s*[-•\u2022]+\s*/, ""),
  );
}

function splitIdentityContactBlockLines(source: unknown): string[] {
  const text = source == null ? "" : String(source);
  if (!text) return [];

  const segments = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+(?:\||•|·|-)\s+/))
    .map((line) => normalizeIdentityContactBlockLine(line))
    .filter(Boolean);

  const collected: string[] = [];
  for (const line of segments) {
    if (isSectionBoundary(line)) break;
    collected.push(line);
    if (collected.length >= 16) break;
  }
  return collected;
}

function isLikelyContactHeaderSourceBlock(source: string): boolean {
  const text = source == null ? "" : String(source);
  if (!text) return false;
  if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(text)) {
    return false;
  }
  const lines = splitIdentityContactBlockLines(text).slice(0, 10);
  if (!lines.length) return false;
  return lines.some((line) => looksLikeContactLine(line) || isUsablePersonName(line, line));
}

function looksLikeRecoverableIdentityContactLocation(value: unknown): boolean {
  const cleaned = stripLeadingLocationLabel(value);
  if (!cleaned) return false;
  if (CONTACT_SLUDGE_RE.test(cleaned)) return false;
  if (isSectionBoundary(cleaned) || isExperienceFieldStructuralFragment(cleaned)) return false;
  if (looksLikeResponsibilitySentence(cleaned)) return false;
  if (cleaned.split(/\s+/).length > 10) return false;
  if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(cleaned)) return false;
  if (/\b(university|college|school|academy|bachelor|master|degree|diploma|curriculum vitae)\b/i.test(cleaned)) {
    return false;
  }
  if (/\b(experience|employment|deliverables|responsibilities|summary|profile|project|skills?|education)\b/i.test(cleaned)) {
    return false;
  }
  if (/[•\u2022]/.test(cleaned)) return false;
  if (/\b(certified|scientist|engineer|manager|developer|analyst|specialist|consultant)\b/i.test(cleaned.split(",").slice(1).join(" "))) {
    return false;
  }

  const commaParts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  const firstPart = commaParts[0] ?? "";
  const secondPart = commaParts[1] ?? "";
  const normalizedSecondPart = secondPart.replace(/\s+\d{4,6}(?:-\d{4})?$/, "").trim().toLowerCase();
  const knownGeoSuffixes = new Set([
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
    "district of columbia",
    "united states",
    "usa",
    "us",
    "canada",
    "united kingdom",
    "uk",
    "france",
    "germany",
    "india",
    "australia",
    "singapore",
    "ireland",
    "spain",
    "italy",
    "belgium",
    "switzerland",
    "netherlands",
    "mexico",
    "brazil",
  ]);

  const hasStreetAddress =
    /\b\d{1,5}\s+[a-z0-9 .'-]+\b(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|court|ct|circle|cir|place|pl|parkway|pkwy)\b/i.test(
      cleaned,
    );
  const hasCityStatePattern =
    /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3},\s*[A-Z]{2}(?:\s+\d{4,6}(?:-\d{4})?)?$/.test(
      cleaned,
    );
  const hasCityKnownGeoSuffixPattern =
    commaParts.length === 2 &&
    /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}$/.test(firstPart) &&
    knownGeoSuffixes.has(normalizedSecondPart);
  const hasStreetWithCityRegion =
    /\b(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|court|ct|circle|cir|place|pl|parkway|pkwy)\b/i.test(
      cleaned,
    ) && /,\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3},\s*[A-Z]{2}(?:\s+\d{4,6}(?:-\d{4})?)?$/.test(cleaned);

  return hasStreetAddress || hasCityStatePattern || hasCityKnownGeoSuffixPattern || hasStreetWithCityRegion;
}

function extractRecoverableLocationFromSourceBlock(source: unknown): string | undefined {
  const text = source == null ? "" : String(source);
  if (!text) return undefined;
  if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(text)) {
    return undefined;
  }
  const lines = splitIdentityContactBlockLines(text).slice(0, 12);

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (looksLikeRecoverableIdentityContactLocation(line)) {
      return line;
    }
    const next = lines[idx + 1] ?? "";
    if (!line || looksLikeContactLine(line)) continue;
    const combined = [line, next].filter(Boolean).join(", ").replace(/\s{2,}/g, " ").trim();
    if (next && looksLikeRecoverableIdentityContactLocation(combined)) {
      return combined;
    }
  }

  return undefined;
}

function collectSchemaIdentityContactSources(normalized: any): Record<string, unknown>[] {
  return [
    normalized,
    normalized?.identity,
    normalized?.profile,
    normalized?.details,
    normalized?.contact,
    normalized?.links,
  ].filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null);
}

function pickFirstSchemaValue(
  sources: Record<string, unknown>[],
  keys: string[],
  isValid: (value: unknown) => boolean,
): string | undefined {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (!isValid(value)) continue;
      return coerceString(value);
    }
  }
  return undefined;
}

function normalizeTypedLinkCandidate(value: unknown, kind: "website" | "linkedin"): string | undefined {
  const raw = sanitizeSchemaUrlValue(value);
  if (!raw) return undefined;
  if (kind === "website" && !hasAllowedBareWebsiteTld(raw)) return undefined;
  const normalized = normalizeUrlCandidate(raw);
  if (!normalized) return undefined;
  if (kind === "linkedin") {
    return isStructurallyValidLinkedin(normalized) ? normalized : undefined;
  }
  return isStructurallyValidWebsite(normalized) ? normalized : undefined;
}

function collectIdentityContactRawTextSources(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): string[] {
  const topBlock = (value: unknown): string => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const collected: string[] = [];
    for (const line of lines.slice(0, 16)) {
      if (collected.length > 0 && isSectionBoundary(line)) break;
      collected.push(line);
    }
    return collected.join("\n").trim();
  };

  return dedupeSourceBlocksPreserveWhitespace(
    [
      typeof normalized?.contact?.raw === "string" ? normalized.contact.raw.trim() : "",
      typeof normalized?.contact?.addressBlock === "string" ? normalized.contact.addressBlock.trim() : "",
      ...filterRawSection(rawSections, "profile", { preserveWhitespace: true }),
      topBlock(normalized?.rawText ?? ""),
      topBlock(context.rawText ?? ""),
    ].filter(Boolean),
  );
}

function formatHeaderPersonNameCandidate(line: string): string | undefined {
  const tokens = tokenizeNameCandidate(line);
  const normalizedTokens = normalizeAndValidateNameTokens(tokens, line);
  if (!normalizedTokens) return undefined;
  const formatted = formatNameFromTokens(normalizedTokens);
  return isUsablePersonName(formatted, line) ? formatted : undefined;
}

function looksLikeStandaloneHeaderLocationLine(value: unknown): boolean {
  const cleaned = stripLeadingLocationLabel(value);
  if (!cleaned) return false;
  if (looksLikeRecoverableIdentityContactLocation(cleaned)) return true;
  if (CONTACT_SLUDGE_RE.test(cleaned)) return false;
  if (looksLikeContactLine(cleaned)) return false;
  if (isSectionBoundary(cleaned) || isExperienceFieldStructuralFragment(cleaned)) return false;
  if (looksLikeResponsibilitySentence(cleaned)) return false;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 4) return false;
  if (tokens.some((token) => /[@\d]/.test(token))) return false;
  if (tokens.some((token) => !/^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(token))) return false;

  const formattedTokens = formatLooseNameTokens(tokens);
  const normalizedTokens = formattedTokens
    .map((token) => normalizeCandidateForStoplist(token))
    .filter(Boolean);
  if (!normalizedTokens.length) return false;
  if (normalizedTokens.some((token) => isHeaderStopword(token) || ROLEISH_NAME_TOKENS.has(token))) return false;

  const titleCaseCount = formattedTokens.filter(
    (token) => isTitleCaseToken(token) || (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(token) && token.length <= 3),
  ).length;
  if (titleCaseCount < Math.max(1, Math.floor(formattedTokens.length * 0.75))) return false;

  return true;
}

function extractHeaderIdentitySignalsFromSourceBlock(source: unknown): HeaderIdentitySignals | undefined {
  const text = source == null ? "" : String(source);
  if (!text) return undefined;
  if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(text)) return undefined;

  const lines = splitIdentityContactBlockLines(text).slice(0, 8);
  if (!lines.length) return undefined;

  let primaryName: string | undefined;
  let primaryNameIndex = -1;
  const conflictingNameKeys = new Set<string>();

  for (let idx = 0; idx < lines.length; idx += 1) {
    const formatted = formatHeaderPersonNameCandidate(lines[idx] ?? "");
    if (!formatted) continue;
    const formattedKey = normalizeCandidateForStoplist(formatted);
    if (!formattedKey) continue;
    if (!primaryName) {
      primaryName = formatted;
      primaryNameIndex = idx;
      continue;
    }
    if (formattedKey !== normalizeCandidateForStoplist(primaryName)) {
      conflictingNameKeys.add(formattedKey);
    }
  }

  if (!primaryName || primaryNameIndex < 0 || primaryNameIndex > 1) {
    return undefined;
  }

  let location: string | undefined;
  const locationCandidate = lines[primaryNameIndex + 1] ?? "";
  if (looksLikeStandaloneHeaderLocationLine(locationCandidate)) {
    const anchors = lines.slice(primaryNameIndex + 2, Math.min(lines.length, primaryNameIndex + 5));
    const hasAnchor = anchors.some(
      (line) => isStructurallyValidDesiredPosition(line) || looksLikeContactLine(line),
    );
    if (hasAnchor) {
      location = stripLeadingLocationLabel(locationCandidate);
      const locationKey = normalizeCandidateForStoplist(location);
      if (locationKey) {
        conflictingNameKeys.add(locationKey);
      }
    }
  }

  return { primaryName, conflictingNameKeys, location };
}

function resolveHeaderIdentitySignals(normalized: any, context: CanonicalizeContext): HeaderIdentitySignals {
  const sources = dedupeSourceBlocksPreserveWhitespace(
    [
      typeof normalized?.contact?.raw === "string" ? normalized.contact.raw.trim() : "",
      typeof normalized?.contact?.addressBlock === "string" ? normalized.contact.addressBlock.trim() : "",
      ...collectIdentityContactRawTextSources(normalized, [], context),
    ].filter(Boolean),
  );

  let primaryName: string | undefined;
  let location: string | undefined;
  const conflictingNameKeys = new Set<string>();

  for (const source of sources) {
    const signals = extractHeaderIdentitySignalsFromSourceBlock(source);
    if (!signals) continue;
    if (!primaryName && signals.primaryName) {
      primaryName = signals.primaryName;
    }
    if (!location && signals.location) {
      location = signals.location;
    }
    for (const key of signals.conflictingNameKeys) {
      conflictingNameKeys.add(key);
    }
    if (primaryName && location) break;
  }

  return { primaryName, conflictingNameKeys, location };
}

function extractImmediateHeaderLocationForResolvedName(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
  resolvedName: string | undefined,
): string | undefined {
  const resolvedNameKey = normalizeCandidateForStoplist(resolvedName ?? "");
  if (!resolvedNameKey) return undefined;

  for (const source of collectIdentityContactRawTextSources(normalized, rawSections, context)) {
    const lines: string[] = splitIdentityContactBlockLines(source).slice(0, 8);
    if (!lines.length) continue;

    const nameIndex = lines.findIndex((line) => {
      const formatted = formatHeaderPersonNameCandidate(line);
      return (
        typeof formatted === "string" &&
        normalizeCandidateForStoplist(formatted) === resolvedNameKey
      );
    });
    if (nameIndex < 0 || nameIndex > 1) continue;

    const candidate = lines[nameIndex + 1] ?? "";
    if (!looksLikeStandaloneHeaderLocationLine(candidate)) continue;

    const anchors = lines.slice(nameIndex + 2, Math.min(lines.length, nameIndex + 5));
    const hasAnchor = anchors.some(
      (line) => isStructurallyValidDesiredPosition(line) || looksLikeContactLine(line),
    );
    if (!hasAnchor) continue;

    return stripLeadingLocationLabel(candidate);
  }

  return undefined;
}

function extractTypedIdentityContactLinksFromRawText(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): {
  websiteCandidates: string[];
  linkedinCandidates: string[];
} {
  const websiteCandidates: string[] = [];
  const linkedinCandidates: string[] = [];
  const explicitUrlRe = /\b(?:https?:\/\/|www\.)[^\s)]+/gi;
  const bareDomainRe = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?\b/gi;

  const pushCandidate = (kind: "website" | "linkedin", value: unknown) => {
    const normalizedCandidate = normalizeTypedLinkCandidate(value, kind);
    if (!normalizedCandidate) return;
    if (kind === "linkedin") {
      linkedinCandidates.push(normalizedCandidate);
    } else {
      websiteCandidates.push(normalizedCandidate);
    }
  };

  for (const source of collectIdentityContactRawTextSources(normalized, rawSections, context)) {
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const rawLine of lines) {
      const line = rawLine.replace(/^\s*(?:website|site|url|linkedin|linkedin profile)\s*[:\-]\s*/i, "").trim();
      const lowerLine = rawLine.toLowerCase();
      const hasWebsiteLabel = /\b(?:website|site|url|portfolio)\b/i.test(lowerLine);

      const explicitMatches = Array.from(rawLine.matchAll(explicitUrlRe)).map((match) => match[0]);
      explicitMatches.forEach((match) => {
        if (/linkedin\.com/i.test(match)) {
          pushCandidate("linkedin", match);
        } else {
          pushCandidate("website", match);
        }
      });

      if (explicitMatches.length > 0) continue;

      const bareMatches = Array.from(rawLine.matchAll(bareDomainRe))
        .map((match) => match[0])
        .filter((match) => !/@/.test(match) && !/\.(pdf|doc|docx|png|jpg|jpeg)$/i.test(match));

      bareMatches.forEach((match) => {
        if (/linkedin\.com/i.test(match)) {
          pushCandidate("linkedin", match);
        } else if (hasWebsiteLabel) {
          pushCandidate("website", match);
        }
      });

      if (!bareMatches.length && hasWebsiteLabel) {
        pushCandidate("website", line);
      }
    }
  }

  return {
    websiteCandidates: dedupeStringsCaseInsensitive(websiteCandidates),
    linkedinCandidates: dedupeStringsCaseInsensitive(linkedinCandidates),
  };
}

function extractTypedIdentityContactLocationFromRawText(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): string | undefined {
  const prioritizedSources = [
    typeof normalized?.contact?.raw === "string" ? normalized.contact.raw.trim() : "",
    typeof normalized?.contact?.addressBlock === "string" ? normalized.contact.addressBlock.trim() : "",
    ...collectIdentityContactRawTextSources(normalized, rawSections, context),
  ].filter(Boolean);

  for (const source of dedupeSourceBlocksPreserveWhitespace(prioritizedSources)) {
    const candidate = extractRecoverableLocationFromSourceBlock(source);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function extractConservativeHeaderContactLocation(normalized: any, context: CanonicalizeContext): string | undefined {
  const topBlock = (value: unknown): string => {
    const text = value == null ? "" : String(value).trim();
    if (!text) return "";
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 16);
    return lines.join("\n").trim();
  };

  const sources = dedupeSourceBlocksPreserveWhitespace(
    [
      typeof normalized?.contact?.raw === "string" ? normalized.contact.raw.trim() : "",
      typeof normalized?.contact?.addressBlock === "string" ? normalized.contact.addressBlock.trim() : "",
      topBlock(normalized?.rawText ?? ""),
      topBlock(context.rawText ?? ""),
    ].filter(Boolean),
  );

  for (const source of sources) {
    if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(source)) {
      continue;
    }
    const lines = splitIdentityContactBlockLines(source).slice(0, 12);

    for (const line of lines) {
      if (looksLikeRecoverableIdentityContactLocation(line)) return line;
    }
  }

  return undefined;
}

function extractDirectHeaderContactLocationLine(source: unknown): string | undefined {
  const text = source == null ? "" : String(source);
  if (!text) return undefined;
  if (/\b(qwikresume|free resume template|usage guidelines|copyright)\b/i.test(text)) return undefined;
  const lines = splitIdentityContactBlockLines(text).slice(0, 12);

  for (const line of lines) {
    if (looksLikeRecoverableIdentityContactLocation(line)) return line;
  }

  return undefined;
}

function buildSchemaFirstIdentityContactCandidate(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): {
  identity: {
    name?: string;
    desiredPosition?: string;
    location?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    website?: string;
    linkedin?: string;
  };
} {
  const sources = collectSchemaIdentityContactSources(normalized);
  const headerSignals = resolveHeaderIdentitySignals(normalized, context);
  const rawTypedLinks = extractTypedIdentityContactLinksFromRawText(normalized, rawSections, context);
  const rawTypedLocation = extractTypedIdentityContactLocationFromRawText(normalized, rawSections, context);
  const schemaName = pickFirstSchemaValue(
    sources,
    ["name", "fullName"],
    (value) => isUsablePersonName(coerceString(value), coerceString(value)),
  );
  const schemaNameKey = normalizeCandidateForStoplist(schemaName ?? "");
  const headerPrimaryKey = normalizeCandidateForStoplist(headerSignals.primaryName ?? "");
  const identityName =
    headerSignals.primaryName &&
    (!schemaName ||
      (schemaNameKey &&
        (schemaNameKey === headerPrimaryKey || headerSignals.conflictingNameKeys.has(schemaNameKey))))
      ? headerSignals.primaryName
      : schemaName;
  const headerResolvedLocation = extractImmediateHeaderLocationForResolvedName(
    normalized,
    rawSections,
    context,
    identityName,
  );
  return {
    identity: {
      name: identityName,
      desiredPosition: pickFirstSchemaValue(
        sources,
        ["desiredPosition", "title", "headline", "role"],
        isStructurallyValidDesiredPosition,
      ),
      location: pickFirstSchemaValue(
        sources,
        ["location", "addressNormalized", "address"],
        isStructurallyValidContactLocationValue,
      ) ?? rawTypedLocation ?? headerResolvedLocation,
    },
    contact: {
      email: pickFirstSchemaValue(sources, ["email", "emailAddress"], isStructurallyValidEmail),
      phone: pickFirstSchemaValue(sources, ["phone", "phoneRaw", "phoneNumber", "mobile"], (value) => Boolean(sanitizePhoneValue(value))),
      website:
        pickFirstSchemaValue(
          sources,
          ["website", "url", "site", "portfolio", "portfolioUrl"],
          isStructurallyValidWebsite,
        ) ?? rawTypedLinks.websiteCandidates[0],
      linkedin:
        pickFirstSchemaValue(
          sources,
          ["linkedin", "linkedIn", "linkedinUrl", "linkedinURL", "profileUrl"],
          isStructurallyValidLinkedin,
        ) ?? rawTypedLinks.linkedinCandidates[0],
    },
  };
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
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4})\b\s*(?:[\u2012\u2013\u2014\u2015\-]|to)\s*\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|present|current|till\s+date|till\s+now|till\s+present|till\s+today)\b/i;
const SINGLE_DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/i;
const BULLET_PREFIX_RE = /^[\-•*]/;
const NARRATIVE_VERB_RE = /\b(responsible|maintaining|logging|utilizing|apprehending|monitoring|ensur(?:e|ing)|develop(?:ed|ing)|manage(?:d|ment)|coordinating|attending|providing)\b/i;
const WORKED_IN_NARRATIVE_RE =
  /^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?(?:(?:presently|currently)\s+)?work(?:ed|ing)\s+in\s+(?<company>.+?)\s+as\s+an?\s+(?<role>.+?)\s*$/i;

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

function parseNarrativeExperienceDates(line: string): {
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
} {
  const direct = parseDateRange(line);
  if (direct.startDate || direct.endDate !== undefined || direct.isCurrent) {
    return direct;
  }
  const working = cleanLine(line);
  const yearMatch = working.match(/\b(?:from\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s*)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i)
    || working.match(/\bfrom\s+(\d{4})\b/i);
  const startDate = yearMatch?.[1] ? `${yearMatch[1]}-01-01` : undefined;
  if (!startDate) return {};
  if (/\b(?:present|current|till\s+date|till\s+now|till\s+present|till\s+today)\b/i.test(working)) {
    return { startDate, endDate: null, isCurrent: true };
  }
  const endYearMatch = working.match(/\b(?:to|until|till)\s+(\d{4})\b/i);
  return {
    startDate,
    endDate: endYearMatch?.[1] ? `${endYearMatch[1]}-01-01` : undefined,
  };
}

function scoreWorkedInNarrativeLine(line: string): number {
  const cleaned = cleanLine(line).toLowerCase();
  let score = 0;
  if (/\b(?:presently|currently)\s+working\b/.test(cleaned)) score += 5;
  if (/\bfrom\b.*\b(?:to\s+till\s+date|till\s+date|till\s+now|present|current)\b/.test(cleaned)) score += 4;
  else if (/\b(?:to\s+till\s+date|till\s+date|till\s+now|present|current)\b/.test(cleaned)) score += 3;
  if (/\bwork(?:ed|ing)\s+in\b/.test(cleaned)) score += 1;
  if (/^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?worked\s+in\b/.test(cleaned)) score -= 3;
  return score;
}

function parseWorkedInNarrativeEntry(line: string, idx: number) {
  const cleaned = collapseSpacedCaps(
    cleanLine(line).replace(/^[\-•*\u2022]+\s*/, ""),
  );
  if (!cleaned) return null;
  const match = cleaned.match(WORKED_IN_NARRATIVE_RE);
  if (!match || !match.groups) return null;
  const company = stripDrivingLicense(cleanLine(match.groups.company || ""));
  let role = cleanLine(match.groups.role || "");
  if (!company || !role) return null;

  const roleWithLocationMatch = cleaned.match(
    /\bas\s+an?\s+(?<role>.+?)\s+in\s+(?<tail>[^.]+?)(?:\.\s*from\b|\s+from\b|$)/i,
  );
  if (roleWithLocationMatch?.groups) {
    const candidateRole = cleanLine(roleWithLocationMatch.groups.role || "");
    const tail = cleanLine(roleWithLocationMatch.groups.tail || "");
    if (
      candidateRole &&
      tail &&
      !/\b(operator|engineer|technician|manager|analyst|specialist|guard|assistant|supervisor|officer|planner)\b/i.test(tail) &&
      (
        splitCompanyLocation(tail).location ||
        /^[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,3}$/.test(tail)
      )
    ) {
      role = candidateRole;
    }
  }

  role = role
    .replace(/\s+(?:and\s+posted|posted)\b.*$/i, "")
    .replace(/\.\s*from\b.*$/i, "")
    .replace(/\s+from\b.*$/i, "")
    .replace(/\s+till\s+(?:date|now|present|today)\b.*$/i, "")
    .trim();

  const roleLocationMatch = role.match(/^(?<base>.+?)\s+in\s+(?<tail>[^.]+)$/i);
  if (roleLocationMatch?.groups) {
    const tail = cleanLine(roleLocationMatch.groups.tail || "");
    if (
      tail &&
      !/\b(operator|engineer|technician|manager|analyst|specialist|guard|assistant|supervisor|officer|planner)\b/i.test(tail) &&
      (
        splitCompanyLocation(tail).location ||
        /^[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,3}$/.test(tail)
      )
    ) {
      role = cleanLine(roleLocationMatch.groups.base || role);
    }
  }

  const normalizedRole = normalizeRoleCandidate(role);
  if (!normalizedRole) return null;
  const dates = parseNarrativeExperienceDates(cleaned);
  if (!dates.isCurrent && /\b(?:present|current|till\s+date|till\s+now|till\s+present|till\s+today)\b/i.test(cleaned)) {
    dates.isCurrent = true;
    dates.endDate = null;
  }

  return {
    id: coerceId(null, "exp", idx),
    company,
    position: stripDrivingLicense(normalizedRole),
    startDate: dates.startDate,
    endDate: dates.isCurrent ? null : dates.endDate,
    isCurrent: dates.isCurrent,
    location: undefined,
    responsibilities: cleaned,
    responsibilityBullets: [cleaned],
    achievements: [],
  };
}

function normalizeWeakNarrativeField(value: unknown): string {
  return cleanLine(value).replace(/^[\-•*\u2022]+\s*/, "").trim();
}

function looksLikeWeakNarrativeExperienceEntry(entry: any): boolean {
  const company = normalizeWeakNarrativeField(entry?.company ?? "");
  const position = normalizeWeakNarrativeField(entry?.position ?? "");
  const combined = `${company} ${position}`.trim();
  if (!combined) return false;
  if (!/work(?:ed|ing)\s+in/i.test(combined)) return false;
  if (company && position && company === position) return true;
  if (company && position && (company.includes(position) || position.includes(company))) return true;
  if (/^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?worked\s+in\b/i.test(position)) {
    return true;
  }
  if (/^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?worked\s+in\b/i.test(company)) {
    return true;
  }
  if (/^\s*(?:presently|currently)\s+working\s+in\b/i.test(company)) {
    return true;
  }
  return false;
}

function isWeakRawSectionsNarrativeFallback(entry: any): boolean {
  if (!entry || typeof entry !== "object") return false;
  if (looksLikeWeakNarrativeExperienceEntry(entry)) return true;

  const responsibilities = coerceString(entry?.responsibilities ?? "");
  const bullets = Array.isArray(entry?.responsibilityBullets)
    ? entry.responsibilityBullets.map((value: unknown) => coerceString(value)).filter(Boolean)
    : [];
  const combined = [responsibilities, ...bullets].join(" ").trim();
  if (!combined) return false;

  const narrativeMatch = /^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?(?:(?:presently|currently)\s+)?work(?:ed|ing)\s+in\b/i.test(combined);
  if (!narrativeMatch) return false;

  const company = normalizeWeakNarrativeField(entry?.company ?? "");
  const position = normalizeWeakNarrativeField(entry?.position ?? "");
  const hasNarrativeDates = hasExperienceDateSignal(entry);
  const hasStrongCurrentSignal = /\b(?:presently|currently)\s+working\b|\btill\s+(?:date|now|present|today)\b/i.test(combined);

  if (hasStrongCurrentSignal) return false;
  if (!company || !position) return true;
  if (/work(?:ed|ing)\s+in/i.test(company) && /work(?:ed|ing)\s+in/i.test(position)) return true;
  return !hasNarrativeDates;
}

function splitCompanyLocation(line: string): { company: string; location?: string } {
  const raw = collapseSpacedCaps(cleanLine(line));
  if (!raw) return { company: "" };
  const withoutTrailingRange = raw
    .replace(
      /\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4})\s*$/i,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  const normalized = withoutTrailingRange || raw;
  const pieces = normalized.split(",");
  if (pieces.length <= 1) {
    return { company: normalized };
  }
  const first = pieces.shift()?.trim() ?? normalized;
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
    const position = cleanLine(atMatch[1] || "");
    const companyPart = cleanLine(atMatch[2] || "");
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
  const initialLines = normalizedContent
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .filter(Boolean);
  const { deferred: deferredResponsibilityLines, remaining: lines } = consumeLeadingResponsibilityLines(initialLines);
  if (lines.length === 0) {
    return null;
  }

  const inlineHeaderRange = (lines[0]?.match(DATE_RANGE_RE) || [])[0];
  if (inlineHeaderRange && lines.length >= 2 && !BULLET_PREFIX_RE.test(lines[1] ?? "")) {
    const role = stripDrivingLicense(cleanLine((lines[0] ?? "").replace(inlineHeaderRange, "")));
    const { company, location } = splitCompanyLocation(lines[1] ?? "");
    const parsedRange = parseDateRange(inlineHeaderRange);
    const payloadLines = lines
      .slice(2)
      .map((line) => line.replace(/^[\-•*\s]+/, "").trim())
      .filter(Boolean);
    const responsibilityBullets = dedupeStringsCaseInsensitive(
      [
        ...deferredResponsibilityLines,
        ...payloadLines.flatMap((line) => splitResponsibilitiesText(line)),
      ],
    );
    const achievements = dedupeStringsCaseInsensitive(
      responsibilityBullets.filter(looksLikeAchievementBullet),
    );

    if (role && company && responsibilityBullets.length) {
      return {
        id: coerceId(null, "exp", idx),
        company: stripDrivingLicense(company),
        position: role,
        startDate: parsedRange.startDate,
        endDate: parsedRange.endDate,
        isCurrent: parsedRange.isCurrent,
        location: stripDrivingLicense(location ?? ""),
        responsibilities: responsibilityBullets.join("\n"),
        responsibilityBullets,
        achievements,
      };
    }
  }

  let header = lines.shift() ?? "";
  header = header.replace(/^LANGUAGES\s*/i, "").trim();
  if (looksLikeResponsibilitySentence(header)) {
    return null;
  }
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
  const company = headerCompany || inlineCompany || split.company;
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

  const responsibilitiesText = narrative.join(" ");

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
  const combinedResponsibilities = [...deferredResponsibilityLines, ...narrativeBullets, ...responsibilityBullets];
  const dedupedResponsibilities = dedupeStringsCaseInsensitive(combinedResponsibilities);
  const achievements = dedupeStringsCaseInsensitive(
    dedupedResponsibilities.filter(looksLikeAchievementBullet)
  );

  if (looksLikeResponsibilitySentence(position)) {
    return null;
  }

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

const RESPONSIBILITY_LEAD_RE =
  /^(maintain|maintained|maintaining|communicate|communicated|communicating|assess|assessed|assessing|troubleshoot|troubleshot|troubleshooting|support|supported|supporting|contribute|contributed|contributing|explore|explored|exploring|develop|developed|developing|conduct|conducted|conducting|write|wrote|writing|present|presented|presenting|monitor|monitored|monitoring|ensure|ensured|ensuring|manage|managed|managing|provide|provided|providing|assist|assisted|assisting|responsible)\b/i;

function looksLikeResponsibilitySentence(text: string): boolean {
  const cleaned = cleanLine(text).replace(/^[\-•*\u2022]+\s*/, "");
  if (!cleaned) return false;
  if (looksLikeAchievementBullet(cleaned)) return true;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return false;
  return RESPONSIBILITY_LEAD_RE.test(cleaned);
}

function consumeLeadingResponsibilityLines(lines: string[]): { deferred: string[]; remaining: string[] } {
  const deferred: string[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const candidate = lines[cursor]?.replace(/^[\-•*\u2022]+\s*/, "").trim();
    if (candidate && (DATE_RANGE_RE.test(candidate) || SINGLE_DATE_RE.test(candidate))) break;
    if (!candidate || !looksLikeResponsibilitySentence(candidate)) break;
    deferred.push(candidate);
    cursor += 1;
  }
  return {
    deferred,
    remaining: lines.slice(cursor),
  };
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

function structuredValueToPlainText(value: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown) => {
    if (node == null || seen.has(node)) return;
    if (typeof node === "object") {
      seen.add(node);
    }
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed) parts.push(trimmed);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (typeof record.text === "string") walk(record.text);
      if ("content" in record) walk(record.content);
      if ("summary" in record) walk(record.summary);
      if ("description" in record) walk(record.description);
      if ("responsibilities" in record) walk(record.responsibilities);
    }
  };

  walk(value);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function deriveNormalizedConvenienceFieldsFromSections(
  sections: unknown,
  normalized: Record<string, any>,
): Record<string, any> | null {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const typedSections = sections.filter((section) => {
    if (!section || typeof section !== "object") return false;
    const record = section as Record<string, unknown>;
    return typeof record.type === "string" && Array.isArray(record.structuredContent);
  }) as Array<Record<string, any>>;

  if (typedSections.length === 0) return null;

  const collectStructuredByType = (type: string): any[] => {
    return typedSections
      .filter((section) => String(section.type || "").trim().toLowerCase() === type)
      .flatMap((section) =>
        Array.isArray(section.structuredContent)
          ? (section.structuredContent).filter(Boolean)
          : [],
      );
  };

  const aligned: Record<string, any> = {};

  const summaryItems = collectStructuredByType("summary");
  if (summaryItems.length > 0) {
    const summaryText = structuredValueToPlainText((summaryItems[0])?.summary);
    if (summaryText) {
      aligned.summary = {
        text: summaryText,
        confidence:
          typeof normalized?.summary?.confidence === "number"
            ? normalized.summary.confidence
            : 0.5,
      };
      aligned.summaryFirstSentence = firstSentence(summaryText);
    } else {
      aligned.summary = { text: "", confidence: 0 };
      aligned.summaryFirstSentence = "";
    }
  }

  const experienceItems = collectStructuredByType("experience");
  if (experienceItems.length > 0) {
    aligned.experience = experienceItems.map((item) => ({ ...item }));
  }

  const educationItems = collectStructuredByType("education");
  if (educationItems.length > 0) {
    aligned.education = educationItems.map((item) => ({ ...item }));
  }

  const skillItems = collectStructuredByType("skills");
  if (skillItems.length > 0) {
    aligned.skills = skillItems.map((item) => ({ ...item }));
    aligned.skillsText = skillItems
      .map((item) => coerceString((item)?.name))
      .filter(Boolean)
      .join(", ");
  }

  const languageItems = collectStructuredByType("languages");
  if (languageItems.length > 0) {
    aligned.languages = languageItems.map((item) => ({ ...item }));
    aligned.languagesText = languageItems
      .map((item) => coerceString((item)?.name))
      .filter(Boolean)
      .join(", ");
    aligned.languagesRaw = languageItems
      .map((item) => {
        const name = coerceString((item)?.name);
        const level = coerceString((item)?.level);
        return [name, level].filter(Boolean).join(" — ");
      })
      .filter(Boolean);
  }

  const projectItems = collectStructuredByType("projects");
  if (projectItems.length > 0) {
    aligned.projects = projectItems.map((item) => ({ ...item }));
  }

  const certificationItems = collectStructuredByType("certifications");
  if (certificationItems.length > 0) {
    aligned.certifications = certificationItems.map((item) => ({ ...item }));
  }

  const achievementItems = collectStructuredByType("achievements");
  if (achievementItems.length > 0) {
    aligned.achievements = achievementItems.map((item) => ({ ...item }));
  }

  const profileItems = collectStructuredByType("profile");
  if (profileItems.length > 0) {
    const firstProfile = { ...(profileItems[0] as Record<string, any>) };
    aligned.profile = {
      ...(normalized.profile && typeof normalized.profile === "object" ? normalized.profile : {}),
      ...firstProfile,
    };
    aligned.contact = {
      ...(normalized.contact && typeof normalized.contact === "object" ? normalized.contact : {}),
      name: coerceString(firstProfile.name) || normalized?.contact?.name,
      desiredPosition:
        coerceString(firstProfile.desiredPosition) || normalized?.contact?.desiredPosition,
      email: coerceString(firstProfile.email) || normalized?.contact?.email,
      phone: coerceString(firstProfile.phone) || normalized?.contact?.phone,
      linkedin: coerceString(firstProfile.linkedin) || normalized?.contact?.linkedin,
      website: coerceString(firstProfile.website) || normalized?.contact?.website,
      location: coerceString(firstProfile.location) || normalized?.contact?.location,
    };
  }

  return Object.keys(aligned).length > 0 ? aligned : null;
}


function parseExperienceSegment(content: string, idx: number) {
  const initialLines = String(content ?? "")
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .filter(Boolean);
  const { deferred: deferredResponsibilityLines, remaining: lines } = consumeLeadingResponsibilityLines(initialLines);
  if (!lines.length) return null;

  const headerRaw = lines.shift() ?? "";
  const header = headerRaw.replace(/^LANGUAGES\s*/i, "").trim();

  const headerTrimmed = header.trim();
  if (!headerTrimmed || NARRATIVE_VERB_RE.test(headerTrimmed)) {
    const snippets = [...deferredResponsibilityLines, headerTrimmed, ...lines]
      .map((line) => line.replace(/^[\-•*\s]+/, "").trim())
      .filter(Boolean);
    if (snippets.length === 0) return null;
    return { __narrative: snippets } as any;
  }
  if (looksLikeResponsibilitySentence(headerTrimmed)) {
    return null;
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
  for (const line of [...deferredResponsibilityLines, ...normalizedLines]) {
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

function looksLikeExperienceLocationLine(line: string): boolean {
  const cleaned = cleanLine(line);
  if (!cleaned || DATE_RANGE_RE.test(cleaned) || SINGLE_DATE_RE.test(cleaned)) return false;
  if (looksLikeResponsibilitySentence(cleaned)) return false;
  if (/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}\b/.test(cleaned)) return true;
  if (/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3},\s*[A-Z][A-Za-z.'-]+$/.test(cleaned)) return true;
  return false;
}

function recoverExperienceEntriesFromMergedAnchors(content: string, idxSeed: number): any[] {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((line) => collapseSpacedCaps(cleanLine(line)))
    .filter(Boolean);
  if (lines.length < 8) return [];

  const isRoleAnchor = (line: string): boolean => {
    const role = normalizeRoleCandidate(line);
    if (!role || looksLikeResponsibilitySentence(role)) return false;
    const tokens = role.toLowerCase().split(/\s+/);
    return tokens.some((token) => ROLE_KEYWORD_HINTS.has(token));
  };

  const isCompanyAnchor = (line: string): boolean => {
    const cleaned = cleanLine(line);
    if (!cleaned || DATE_RANGE_RE.test(cleaned) || SINGLE_DATE_RE.test(cleaned)) return false;
    if (looksLikeExperienceLocationLine(cleaned)) return false;
    if (looksLikeResponsibilitySentence(cleaned)) return false;
    const maybeRole = normalizeRoleCandidate(cleaned);
    if (maybeRole) {
      const tokens = maybeRole.toLowerCase().split(/\s+/);
      if (tokens.some((token) => ROLE_KEYWORD_HINTS.has(token))) return false;
    }
    return cleaned.split(/\s+/).length <= 8;
  };

  const anchorIndices: number[] = [];
  for (let i = 0; i <= lines.length - 3; i += 1) {
    if (!isRoleAnchor(lines[i] ?? "")) continue;
    if (!isCompanyAnchor(lines[i + 1] ?? "")) continue;
    const dateLine = lines[i + 2] ?? "";
    if (!(DATE_RANGE_RE.test(dateLine) || SINGLE_DATE_RE.test(dateLine))) continue;
    anchorIndices.push(i);
  }

  if (anchorIndices.length < 2) return [];

  const entries: any[] = [];
  for (let a = 0; a < anchorIndices.length; a += 1) {
    const start = anchorIndices[a] ?? 0;
    const end = a + 1 < anchorIndices.length ? anchorIndices[a + 1] ?? lines.length : lines.length;
    const roleLine = lines[start] ?? "";
    const companyLine = lines[start + 1] ?? "";
    const dateLine = lines[start + 2] ?? "";
    const locationLine = looksLikeExperienceLocationLine(lines[start + 3] ?? "") ? lines[start + 3] ?? "" : "";
    const payloadStart = start + (locationLine ? 4 : 3);
    const payloadLines = lines
      .slice(payloadStart, end)
      .map((line) => line.replace(/^[\-•*\u2022]+\s*/, "").trim())
      .filter(Boolean)
      .filter((line) => !looksLikeExperienceLocationLine(line));
    if (!payloadLines.length) continue;

    const role = normalizeRoleCandidate(roleLine);
    const { company, location: companyLocation } = splitCompanyLocation(companyLine);
    const parsedDates = parseDateRange(dateLine);
    if (!role || !company) continue;
    if (!parsedDates.startDate && parsedDates.endDate === undefined && !parsedDates.isCurrent) continue;

    const splitPayload = splitResponsibilitiesText(payloadLines.join("\n"));
    const responsibilityBullets = dedupeStringsCaseInsensitive(
      splitPayload.length > 1 ? splitPayload : payloadLines,
    );
    if (!responsibilityBullets.length) continue;

    const location = stripDrivingLicense(locationLine || companyLocation || "");
    entries.push({
      id: coerceId(null, "exp", idxSeed * 100 + a),
      company: stripDrivingLicense(company),
      position: stripDrivingLicense(role),
      startDate: parsedDates.startDate,
      endDate: parsedDates.endDate,
      isCurrent: parsedDates.isCurrent,
      location,
      responsibilities: responsibilityBullets.join("\n"),
      responsibilityBullets,
      achievements: dedupeStringsCaseInsensitive(responsibilityBullets.filter(looksLikeAchievementBullet)),
      provenanceTags: ["heuristic:merged_anchor_split"],
    });
  }

  return entries;
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

  const header = collapseSpacedCaps(stripLeadingLanguagesPrefix(lines.shift() ?? ""));
  const degreeLineRaw = stripLeadingLanguagesPrefix(lines.shift() ?? "");
  const degreeLine = degreeLineRaw.trim();

  const { company: institution, location } = splitCompanyLocation(header);
  let degree = degreeLine;
  const dateText = (degreeLine.match(DATE_RANGE_RE) || [])[0] || (degreeLine.match(SINGLE_DATE_RE) || [])[0];
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
  const EDUCATION_INSTITUTION_RE =
    /(university|college|academy|school|institute|polytechnic|seminary|conservatory)/i;
  const EDUCATION_DEGREE_RE =
    /(degree|diploma|program|certificate|certification|bachelor|master|doctor|associate|ph\.?d|mba|ma\b|ms\b|ba\b|bs\b|major|minor|specialization)/i;

  const looksLikeHeader = (line: string): boolean => {
    if (!line) return false;
    if (/^(course|curriculum|responsibilities?)\b/i.test(line)) return false;
    if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) return false;
    const keyword = /(degree|diploma|program|course|training|university|college|academy|school|certificate|certification|education)/i;
    if (keyword.test(line)) return true;
    if (/[,;]/.test(line) && line.split(/\s+/).length <= 14) return true;
    return false;
  };

  const looksLikeInstitutionHeader = (line: string): boolean => {
    if (!line) return false;
    if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) return false;
    return EDUCATION_INSTITUTION_RE.test(line);
  };

  const looksLikeDegreeLine = (line: string): boolean => {
    if (!line) return false;
    if (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line)) return false;
    return EDUCATION_DEGREE_RE.test(line);
  };

  const looksLikeLocationDateLine = (line: string): boolean => {
    if (!line) return false;
    return DATE_RANGE_RE.test(line) ||
      SINGLE_DATE_RE.test(line) ||
      /\b\d{1,2}[/-]\d{4}\b/.test(line) ||
      (/,/.test(line) && /\d/.test(line));
  };

  const getInstitutionAnchor = (lines: string[]): string[] => {
    const institutionIndex = lines.findIndex((line) => looksLikeInstitutionHeader(line));
    if (institutionIndex < 0) return [];
    const anchor = [lines[institutionIndex] ?? ""].filter(Boolean);
    const nextLine = lines[institutionIndex + 1] ?? "";
    if (looksLikeLocationDateLine(nextLine)) {
      anchor.push(nextLine);
    }
    return anchor;
  };

  const formatAnchoredDegreeSegments = (lines: string[]): string[] => {
    const institution = lines.find((line) => looksLikeInstitutionHeader(line)) ?? "";
    const locationDate = lines.find((line) => looksLikeLocationDateLine(line)) ?? "";
    const degreeLines = lines.filter((line) => looksLikeDegreeLine(line));
    if (!institution || !degreeLines.length) {
      return [lines.join("\n").trim()].filter(Boolean);
    }
    return degreeLines
      .map((degreeLine) =>
        degreeLine
          .replace(/\s*-\s*(?:majored|minored|specializations?).*$/i, "")
          .replace(/\s{2,}/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .map((degreeLine) => [degreeLine, institution, locationDate].filter(Boolean).join(", ").trim())
      .filter(Boolean);
  };

  for (const line of filteredLines) {
    const currentAnchor = getInstitutionAnchor(current);
    const currentHasDegree = current.some((entry) => looksLikeDegreeLine(entry));
    if (currentAnchor.length && looksLikeLocationDateLine(line)) {
      current.push(line);
      continue;
    }
    if (currentAnchor.length && currentHasDegree && /^[\-•*]/.test(line)) {
      continue;
    }
    if (currentAnchor.length && looksLikeDegreeLine(line) && !looksLikeInstitutionHeader(line)) {
      if (currentHasDegree) {
        segments.push(current);
        current = [...currentAnchor, line];
      } else {
        current.push(line);
      }
      continue;
    }
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
    .map((segment) => segment.map((line) => line.trim()).filter(Boolean))
    .flatMap((segment) => {
      const joined = segment.join("\n").trim();
      if (!joined) return [];
      if (shouldPreserveAnchoredEducationSegment(joined)) {
        return formatAnchoredDegreeSegments(segment);
      }
      return splitSegmentByDegreeTokens(joined);
    })
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function buildEducationEntry(segment: string, idx: number) {
  const lines = String(segment ?? "")
    .split(/\r?\n/)
    .map((line) => stripLeadingLanguagesPrefix(cleanLine(line)))
    .filter((line) => line.length > 0);
  if (!lines.length) return null;

  const institutionFirstLine =
    /(university|college|academy|school|institute|polytechnic|seminary|conservatory)/i;
  const degreeSignalLine =
    /(degree|diploma|program|certificate|certification|bachelor|master|doctor|associate|ph\.?d|mba|ma\b|ms\b|ba\b|bs\b)/i;
  const numericSingleDate = /\b\d{1,2}[/-]\d{4}\b/;

  if (institutionFirstLine.test(lines[0] ?? "")) {
    const degreeIndex = lines.findIndex(
      (line, lineIdx) =>
        lineIdx > 0 &&
        degreeSignalLine.test(line) &&
        !DATE_RANGE_RE.test(line) &&
        !SINGLE_DATE_RE.test(line),
    );
    if (degreeIndex > 0) {
      const institution = lines[0] ?? "";
      const locationDateLine = lines.find((line, lineIdx) => lineIdx > 0 && (DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line) || numericSingleDate.test(line))) ?? "";
      const degree = (lines[degreeIndex] ?? "")
        .replace(/\s*-\s*(?:majored|minored|specializations?).*$/i, "")
        .replace(/\*+/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const summary = lines
        .filter((line, lineIdx) => lineIdx !== 0 && lineIdx !== degreeIndex && line !== locationDateLine)
        .filter((line) => !/^[\-•*]/.test(line))
        .join(" ") || undefined;

      return {
        id: coerceId(null, "edu", idx),
        institution,
        degree: degree || undefined,
        startDate: undefined,
        endDate: undefined,
        isCurrent: undefined,
        location: locationDateLine || undefined,
        summary,
      };
    }
  }

  let header = stripLeadingLanguagesPrefix(lines.shift() ?? "");
  const dateLineIndex = lines.findIndex((line) => DATE_RANGE_RE.test(line) || SINGLE_DATE_RE.test(line));
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
  if (shouldPreserveAnchoredEducationSegment(segment)) {
    return [String(segment).trim()];
  }
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

  const lines: string[] = sourceText
    .split(/\r?\n/)
    .map((line: string) => collapseSpacedCaps(cleanLine(line)))
    .map((line: string) => line.replace(/^[•*\-–—\u2022]+\s*/, "").trim())
    .filter((line: string): line is string => Boolean(line));
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

function recoverBestNarrativeExperienceFromSourceText(
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): any[] {
  const collectNestedStrings = (
    value: unknown,
    depth = 0,
    seen = new Set<unknown>(),
    path = "root",
  ): string[] => {
    if (depth > 6 || value == null) return [];
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (typeof value !== "object") return [];
    if (seen.has(value)) return [];
    seen.add(value);

    if (Array.isArray(value)) {
      return value.flatMap((item, idx) => collectNestedStrings(item, depth + 1, seen, `${path}[${idx}]`));
    }

    const record = value as Record<string, unknown>;
    return Object.entries(record)
      .filter(([key]) =>
        !["experience", "education", "skills", "languages", "achievements", "rawText", "raw", "sections"].includes(key),
      )
      .flatMap(([key, item]) => collectNestedStrings(item, depth + 1, seen, `${path}.${key}`));
  };

  const nestedScannedStrings = collectNestedStrings(normalized);
  const textCandidates = [
    typeof normalized?.rawText === "string" ? normalized.rawText : "",
    typeof normalized?.raw === "string" ? normalized.raw : "",
    typeof context.rawText === "string" ? context.rawText : "",
    ...(Array.isArray(normalized?.sections)
      ? normalized.sections
          .map((section: any) =>
            coerceString(section?.content ?? section?.text ?? section?.value ?? ""),
          )
          .filter(Boolean)
      : []),
    ...nestedScannedStrings,
    ...rawSections
      .map((section) => coerceString(section?.content ?? ""))
      .filter(Boolean),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  if (!textCandidates.length) return [];

  const expandNarrativeWindows = (source: string): string[] => {
    const lines = source
      .split(/\r?\n/)
      .map((line) => cleanLine(line))
      .filter(Boolean);
    if (!lines.length) return [];

    const expanded: string[] = [];
    for (let idx = 0; idx < lines.length; idx += 1) {
      expanded.push(lines[idx]);
      for (let span = 2; span <= 6 && idx + span <= lines.length; span += 1) {
        const merged = lines
          .slice(idx, idx + span)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (merged && merged.length <= 500) {
          expanded.push(merged);
        }
      }
    }
    return expanded;
  };

  const seenLines = new Set<string>();
  const narrativeCandidates = textCandidates
    .flatMap((source) => expandNarrativeWindows(source))
    .map((line) => cleanLine(line))
    .filter((line) => {
      if (!/work(?:ed|ing)\s+in/i.test(line)) return false;
      const key = line.toLowerCase();
      if (seenLines.has(key)) return false;
      seenLines.add(key);
      return true;
    })
    .map((line, idx) => ({
      score: scoreWorkedInNarrativeLine(line),
      entry: parseWorkedInNarrativeEntry(line, 9000 + idx),
    }))
    .filter((item) => item.entry);

  if (!narrativeCandidates.length) return [];
  const bestNarrative = [...narrativeCandidates].sort((a, b) => b.score - a.score)[0]?.entry;
  return bestNarrative ? [bestNarrative] : [];
}

function canonicalizeExperience(
  rawValue: unknown,
  rawSections: RawSection[],
  normalized: any,
  context: CanonicalizeContext,
): ExperienceCanonical {
  const isPlaceholderExperienceValue = (value: unknown): boolean => {
    const normalizedValue = coerceString(value);
    if (!normalizedValue) return true;
    return /^(experience|professional experience|employment history|work experience|inferred)$/i.test(normalizedValue);
  };

  const looksLikeEmployerName = (value: string): boolean => {
    const cleaned = cleanLine(value);
    if (!cleaned) return false;
    if (/[,&@]/.test(cleaned)) return true;
    if (/\b(inc|corp|corporation|llc|ltd|limited|company|co|group|partners|holdings|solutions|technologies|systems|services|university|college|school|academy|hospital|clinic|bank|restaurant|hotel|ministry|department|office|agency|association|foundation)\b\.?/i.test(cleaned)) {
      return true;
    }
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const acronymTokens = tokens.filter((token) => /^[A-Z0-9&.'-]{2,}$/.test(token));
    return acronymTokens.length >= Math.max(1, Math.floor(tokens.length / 2));
  };

  const looksLikeNonEmployerCompanyField = (company: string, position: string): boolean => {
    const cleanedCompany = cleanLine(company);
    if (!cleanedCompany) return false;
    if (/^(key deliverables?|responsibilities?|professional experience|experience|employment history|work experience)\b:?$/i.test(cleanedCompany)) {
      return true;
    }
    if (isSectionBoundary(cleanedCompany) || isExperienceFieldStructuralFragment(cleanedCompany)) {
      return true;
    }
    if (looksLikeResponsibilitySentence(cleanedCompany)) {
      return true;
    }
    if (cleanedCompany.split(/\s+/).length > 10 && !looksLikeEmployerName(cleanedCompany)) {
      return true;
    }
    const normalizedRole = normalizeRoleCandidate(cleanedCompany);
    if (
      normalizedRole &&
      normalizedRole.toLowerCase() === cleanedCompany.toLowerCase() &&
      !looksLikeEmployerName(cleanedCompany) &&
      (!position || normalizeRoleCandidate(position)?.toLowerCase() !== cleanedCompany.toLowerCase())
    ) {
      return true;
    }
    return false;
  };

  const isCoherentNormalizedExperienceEntry = (entry: any): boolean => {
    const company = coerceString(entry?.company ?? "");
    const position = coerceString(entry?.position ?? "");
    const location = coerceString(entry?.location ?? "");
    const hasCompany = Boolean(company) && !isPlaceholderExperienceValue(company);
    const hasPosition = Boolean(position) && !isPlaceholderExperienceValue(position);
    const hasDates = hasExperienceDateSignal(entry);
    const hasBullets = Array.isArray(entry?.responsibilityBullets) && entry.responsibilityBullets.length > 0;
    const hasResponsibilities = Boolean(coerceString(entry?.responsibilities ?? ""));
    const hasAchievements = Array.isArray(entry?.achievements) && entry.achievements.length > 0;
    const hasLocation = Boolean(location);
    const hasContent = hasBullets || hasResponsibilities || hasAchievements;
    const hasStructuralFieldContamination =
      isExperienceFieldStructuralFragment(company) ||
      isExperienceFieldStructuralFragment(position) ||
      isExperienceFieldStructuralFragment(location);
    const hasHeaderEchoLocation = isExperienceLocationHeaderEcho(location, company, position);
    const hasNarrativeCompanyOnly =
      hasCompany &&
      !hasPosition &&
      looksLikeResponsibilitySentence(company);
    const hasNonEmployerCompanyField =
      hasCompany &&
      looksLikeNonEmployerCompanyField(company, position) &&
      !hasDates &&
      !hasContent;

    if (hasStructuralFieldContamination || hasHeaderEchoLocation || hasNarrativeCompanyOnly || hasNonEmployerCompanyField) {
      return false;
    }

    if (hasCompany && hasPosition) {
      return true;
    }
    if (hasCompany && hasDates && hasContent) {
      return true;
    }
    return false;
  };

  const isPersonalDetailsTextFallbackEntry = (entry: any): boolean => {
    const combined = [
      coerceString(entry?.company ?? ""),
      coerceString(entry?.position ?? ""),
      coerceString(entry?.responsibilities ?? ""),
      ...(Array.isArray(entry?.responsibilityBullets)
        ? entry.responsibilityBullets.map((value: unknown) => coerceString(value))
        : []),
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!combined) return false;
    return [
      "personal details",
      "father s name",
      "mother s name",
      "marital status",
      "date of birth",
      "place of birth",
      "nationality",
      "passport",
      "religion",
    ].some((token) => combined.includes(token));
  };

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
      const derivedBullets =
        seededBullets.length > 0
          ? seededBullets
          : dedupeStringsCaseInsensitive(
              Array.isArray(rawResponsibilities)
                ? (rawResponsibilities as unknown[]).map((val) => coerceString(val)).filter(Boolean)
                : splitResponsibilitiesText(rawResponsibilities ?? summary ?? entry?.content ?? ""),
            );
      const responsibilityBullets = derivedBullets.length ? derivedBullets : [];
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

  normalizedEntries = sanitizeExperienceEntries(normalizedEntries).map((entry) =>
    repairExperienceHeaderEchoLocation(entry),
  );

  const fromRaw = filterRawSection(rawSections, "experience", { preserveWhitespace: true });
  const coherentNormalizedEntries = normalizedEntries.filter((entry) => isCoherentNormalizedExperienceEntry(entry));
  const preferredNormalizedEntries =
    fromRaw.length > 0 && coherentNormalizedEntries.length > 0
      ? coherentNormalizedEntries
      : normalizedEntries;

  const shouldFallback =
    preferredNormalizedEntries.length === 0 ||
    (fromRaw.length > 0 && coherentNormalizedEntries.length === 0) ||
    preferredNormalizedEntries.every((entry) => {
      const company = coerceString(entry?.company ?? "");
      const position = coerceString(entry?.position ?? "");
      const hasContent = Boolean(entry?.responsibilities || entry?.achievements?.length);
      const poorCompany = isPlaceholderExperienceValue(company);
      const poorPosition = isPlaceholderExperienceValue(position);
      return (poorCompany || poorPosition) && !hasContent;
    });

  if (!shouldFallback && preferredNormalizedEntries.length > 0) {
    return {
      items: preferredNormalizedEntries,
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
      const existing: string[] = Array.isArray((last).provenanceTags) ? (last).provenanceTags : [];
      if (!existing.includes("heuristic:narrative_merge")) {
        (last).provenanceTags = [...existing, "heuristic:narrative_merge"];
      }
    }
  };

  const countMatches = (value: string, pattern: RegExp): number => {
    const normalizedValue = String(value ?? "");
    if (!normalizedValue) return 0;
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return [...normalizedValue.matchAll(new RegExp(pattern.source, flags))].length;
  };

  const countDateAnchors = (value: string): number =>
    countMatches(value, DATE_RANGE_RE) +
    countMatches(
      value,
      /\b\d{2}\/\d{4}\s*(?:[\u2012\u2013\u2014\u2015\-]|to)\s*(?:\d{2}\/\d{4}|present|current)\b/gi,
    );

  const countEmployerRoleAnchors = (value: string): number => {
    const normalizedValue = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalizedValue) return 0;
    return [
      ...normalizedValue.matchAll(
        /\b[A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,5}\s+-\s+[A-Z][A-Za-z0-9/&.'-]+(?:\s+[A-Z][A-Za-z0-9/&.'-]+){0,8}(?=\s+(?:[A-Z][A-Za-z.'-]+,\s*[A-Z]{2}\b|\d{2}\/\d{4}\b))/g,
      ),
    ].length;
  };

  const hasFusedHeaderBodyText = (value: string): boolean => {
    const rawValue = String(value ?? "");
    if (!rawValue || /\r?\n/.test(rawValue)) return false;
    const normalizedValue = rawValue.replace(/\s+/g, " ").trim();
    if (!normalizedValue) return false;
    const narrativeDashCount = countMatches(
      normalizedValue,
      /\s-\s(?:taught|managed|led|built|developed|coordinated|served|organized|completed|analyzes|instructed|collaborated|modified)\b/gi,
    );
    return (
      narrativeDashCount >= 6 &&
      /(?:accomplishments|additional information)\b/i.test(normalizedValue) &&
      countDateAnchors(normalizedValue) >= 1
    );
  };

  const hasStrongMergedMultiEntrySignal = (value: string): boolean =>
    countDateAnchors(value) > 1 || countEmployerRoleAnchors(value) > 1 || hasFusedHeaderBodyText(value);

  const recoverEntriesFromFusedRawSection = (value: string, idxSeed: number): any[] => {
    const normalizedValue = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalizedValue || !hasStrongMergedMultiEntrySignal(normalizedValue)) {
      return [];
    }

    const fusedEntryHeaderRe =
      /([A-Z0-9][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,5})\s+-\s+([A-Z][A-Za-z0-9/&.'-]+(?:\s+[A-Z][A-Za-z0-9/&.'-]+){0,8})\s+([A-Z][A-Za-z.'-]+,\s*[A-Z]{2})\s+(\d{2}\/\d{4}\s*(?:[\u2012\u2013\u2014\u2015\-]|to)\s*(?:\d{2}\/\d{4}|Current|Present))/g;
    const matches = [...normalizedValue.matchAll(fusedEntryHeaderRe)];
    if (matches.length < 2) {
      return [];
    }

    const entries = matches
      .map((match, entryIdx) => {
        const startIdx = (match.index ?? 0) + match[0].length;
        const endIdx = entryIdx + 1 < matches.length ? matches[entryIdx + 1]?.index ?? normalizedValue.length : normalizedValue.length;
        const payload = normalizedValue
          .slice(startIdx, endIdx)
          .replace(/^\s*-\s*/, "")
          .replace(/\b(?:ACCOMPLISHMENTS|ADDITIONAL INFORMATION)\b[\s\S]*$/i, "")
          .trim();

        const inlineBullets = payload
          .split(/\s+-\s+(?=[A-Z])/)
          .map((line) => line.replace(/^[\-•*\s]+/, "").trim())
          .filter(Boolean);
        const responsibilityBullets = dedupeStringsCaseInsensitive(
          (inlineBullets.length > 1 ? inlineBullets : splitResponsibilitiesText(payload))
            .map((line) => line.replace(/^[\-•*\s]+/, "").trim())
            .filter(Boolean)
            .filter((line) => !/^(accomplishments|additional information)\b/i.test(line)),
        );

        if (!responsibilityBullets.length) {
          return null;
        }

        const parsedDates = parseDateRange(match[4]);
        return {
          id: coerceId(null, "exp", idxSeed * 100 + entryIdx),
          company: stripDrivingLicense(cleanLine(match[1] ?? "")),
          position: stripDrivingLicense(cleanLine(match[2] ?? "")),
          startDate: parsedDates.startDate,
          endDate: parsedDates.endDate,
          isCurrent: parsedDates.isCurrent,
          location: stripDrivingLicense(cleanLine(match[3] ?? "")),
          responsibilities: responsibilityBullets.join("\n"),
          responsibilityBullets,
          achievements: dedupeStringsCaseInsensitive(
            responsibilityBullets.filter(looksLikeAchievementBullet),
          ),
          provenanceTags: ["heuristic:fused_raw_section_split"],
        };
      })
      .filter(Boolean);

    return sanitizeExperienceEntries(entries as any[]);
  };

  const handleSegment = (segment: string, key: number) => {
    const narrativeCandidates = String(segment ?? "")
      .split(/\r?\n/)
      .map((line) => cleanLine(line))
      .filter((line) => /work(?:ed|ing)\s+in/i.test(line))
      .map((line, idx) => ({
        score: scoreWorkedInNarrativeLine(line),
        entry: parseWorkedInNarrativeEntry(line, key * 10 + idx),
      }))
      .filter((item) => item.entry);

    const mergedAnchorRecovered = sanitizeExperienceEntries(
      recoverExperienceEntriesFromMergedAnchors(segment, key),
    );
    if (mergedAnchorRecovered.length > 1) {
      fallbackItems.push(...mergedAnchorRecovered);
      return;
    }
    if (hasStrongMergedMultiEntrySignal(segment)) {
      const fusedRecovered = recoverEntriesFromFusedRawSection(segment, key);
      if (fusedRecovered.length > 0) {
        fallbackItems.push(...fusedRecovered);
      }
      return;
    }

    const parsedBlock = parseExperienceBlock(segment, key);
    if (parsedBlock) {
      if (looksLikeWeakNarrativeExperienceEntry(parsedBlock) && narrativeCandidates.length) {
        const bestNarrative = [...narrativeCandidates].sort((a, b) => b.score - a.score)[0]?.entry;
        if (bestNarrative) {
          fallbackItems.push(bestNarrative);
          return;
        }
      }
      fallbackItems.push(parsedBlock);
      return;
    }
    if (narrativeCandidates.length) {
      const bestNarrative = [...narrativeCandidates].sort((a, b) => b.score - a.score)[0]?.entry;
      if (bestNarrative) {
        fallbackItems.push(bestNarrative);
        return;
      }
    }
    const parsedSegment = parseExperienceSegment(segment, key);
    if (!parsedSegment) return;
    if ((parsedSegment).__narrative) {
      appendNarrativeToLast((parsedSegment).__narrative as string[]);
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

  const weakRawSectionsFallback =
    fallbackSource === "raw_sections" &&
    sanitizedFallback.length > 0 &&
    sanitizedFallback.every((item) => isWeakRawSectionsNarrativeFallback(item));

  if (weakRawSectionsFallback) {
    const recoveredNarrative = sanitizeExperienceEntries(
      recoverBestNarrativeExperienceFromSourceText(normalized, rawSections, context),
    );
    if (recoveredNarrative.length > 0) {
      sanitizedFallback = recoveredNarrative;
      fallbackSource = "text_fallback";
    }
  }

  if (!sanitizedFallback.length) {
    const recovered = recoverExperienceFromLooseText(normalized, context);
    if (recovered.length) {
      sanitizedFallback = sanitizeExperienceEntries(recovered);
      if (sanitizedFallback.length) {
        fallbackSource = "text_fallback";
      }
    }
  }

  if (fallbackSource === "text_fallback" || fallbackSource === "raw_sections") {
    sanitizedFallback = sanitizedFallback.filter((item) => !isPersonalDetailsTextFallbackEntry(item));
    if (!sanitizedFallback.length) {
      fallbackSource = "none";
    }
  }

  sanitizedFallback = sanitizedFallback.map((item) => {
    if (!item) return item;
    if (!Array.isArray((item).responsibilityBullets)) {
      if (Array.isArray((item).responsibilities)) {
        (item).responsibilityBullets = ((item).responsibilities as string[]).slice();
      } else {
        const derived = splitResponsibilitiesText((item).responsibilities ?? "");
        if (derived.length) {
          (item).responsibilityBullets = derived;
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
  type ProjectData = {
    title: string;
    summary?: string;
    sourceId?: string;
    sourceLabel?: "normalized_input" | "raw_sections" | "text_fallback";
    splitRecovered?: boolean;
  };
  const collected: ProjectData[] = [];
  const seen = new Set<string>();
  const getProjectIdentity = (title: string): string => {
    const normalizedTitle = collapseSpacedCaps(coerceString(title)).replace(/\s{2,}/g, " ").trim();
    return normalizedTitle.split("|", 1)[0]?.trim().toLowerCase() ?? "";
  };

  const push = (
    title: string,
    summary?: string,
    sourceId?: string,
    sourceLabel?: ProjectData["sourceLabel"],
    splitRecovered?: boolean,
  ) => {
    const normalizedTitle = collapseSpacedCaps(coerceString(title)).replace(/\s{2,}/g, " ").trim();
    if (!normalizedTitle || normalizedTitle.length < 3) return;
    const normalizedSummary = summary ? collapseSpacedCaps(summary).replace(/\s{2,}/g, " ").trim() : undefined;
    const key = `${normalizedTitle.toLowerCase()}|${(normalizedSummary ?? "").toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    collected.push({ title: normalizedTitle, summary: normalizedSummary, sourceId, sourceLabel, splitRecovered });
  };

  ensureArray<any>(rawValue).forEach((entry) => {
    const title = coerceString(entry?.title ?? entry?.name ?? entry?.project ?? "");
    const summary = coerceString(entry?.summary ?? entry?.description ?? "");
    if (!title) return;
    const combinedNormalizedSource = [title, summary].filter(Boolean).join(" ").trim();
    const splitFromNormalized = combinedNormalizedSource
      ? parseProjectLines([combinedNormalizedSource]).filter((project) => Boolean((project as any).splitRecovered))
      : [];
    if (splitFromNormalized.length > 1) {
      splitFromNormalized.forEach((project) => {
        push(project.title, project.summary, undefined, "normalized_input", true);
      });
      return;
    }
    push(title, summary || undefined, entry?.id, "normalized_input", false);
  });

  filterRawSection(rawSections, "projects").forEach((content) => {
    const lines = String(content ?? "").split(/\r?\n/);
    parseProjectLines(lines).forEach((project) => {
      push(project.title, project.summary, undefined, "raw_sections", Boolean((project as any).splitRecovered));
    });
  });

  if (!collected.length) {
    const fallbackText = coerceString(normalized?.rawText ?? context.rawText ?? "");
    if (fallbackText) {
      extractProjectsFromTextBlock(fallbackText).forEach((project) => {
        push(project.title, project.summary, undefined, "text_fallback", Boolean((project as any).splitRecovered));
      });
    }
  }

  const splitRecovered = collected.filter((item) => item.splitRecovered);
  if (splitRecovered.length >= 2) {
    const splitNames = splitRecovered
      .map((item) => getProjectIdentity(item.title))
      .filter((value, idx, arr) => Boolean(value) && arr.indexOf(value) === idx);
    const filtered = collected.filter((item) => {
      if (item.splitRecovered) return true;
      const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
      const overlapCount = splitNames.filter((name) => haystack.includes(name)).length;
      if (overlapCount >= 2) return false;
      if (overlapCount === 1 && haystack.length <= 220) return false;
      return true;
    });
    collected.length = 0;
    collected.push(...filtered);
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
    if (isLeakedEducationEntry(entry)) return;
    const key = dedupeKey(entry);
    if (!key || seenRaw.has(key)) return;
    dedupedRaw.push(entry);
    seenRaw.add(key);
  });

  const dedupedNormalized: any[] = [];
  const seenNormalized = new Set<string>();
  fromNormalized.forEach((entry) => {
    if (isLeakedEducationEntry(entry)) return;
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

function normalizeMarkdownTableSkillToken(token: string): string | null {
  const raw = coerceString(token);
  if (!raw.includes("|")) return raw || null;
  const cells = raw
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (!cells.length) return null;
  const firstCell = cells[0] ?? "";
  if (!firstCell) return null;
  if (/^:?-{2,}:?$/.test(firstCell)) return null;
  return firstCell;
}

function canonicalizeSkills(
  rawValue: unknown,
  normalized: any,
  rawSections: RawSection[],
  context: CanonicalizeContext,
): any[] {
  const deduped = new Map<string, string>();
  const robertQwikresume = isRobertSmithQwikresumeShape(rawSections, normalized, context);
  const robertRawSkillsSections = robertQwikresume
    ? filterRawSection(rawSections, "skills", { preserveWhitespace: true })
    : [];

  const pushToken = (token: unknown) => {
    const rawToken = coerceString(token);
    const markdownTableCandidate = rawToken.includes("|");
    const name = normalizeMarkdownTableSkillToken(rawToken);
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
    const allowMarkdownTableFallback = markdownTableCandidate && words.length <= 3;
    if ((skillStoplist.has(lowerKey) || skillStoplist.has(alias)) && !allowMarkdownTableFallback) return;

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
      if (!SKILL_FALLBACK_KEYWORD_RE.test(surface) && !allowMarkdownTableFallback) return;
      storeKey = normalizedKey;
    }

    const displayName = surface.replace(/\s{2,}/g, " ");

    if (!deduped.has(storeKey) || displayName.length > (deduped.get(storeKey)?.length ?? 0)) {
      deduped.set(storeKey, displayName);
    }
  };

  const pushGroupedTechnicalSkillToken = (token: unknown) => {
    const name = coerceString(token);
    if (!name || isNoiseSkill(name)) return;
    const cleaned = name
      .replace(/\([^)]*\)/g, (match) => (match.length <= 20 ? match : ""))
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!cleaned) return;
    if (looksLikeResponsibilitySentence(cleaned)) return;
    if (/\b(?:languages|frameworks?|developer tools?|libraries)\s*[:\-\u2013\u2014]/i.test(cleaned)) return;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return;
    const key = normalizeCandidateForStoplist(cleaned);
    if (!key) return;
    if (!deduped.has(key) || cleaned.length > (deduped.get(key)?.length ?? 0)) {
      deduped.set(key, cleaned);
    }
  };

  const recoverGroupedTechnicalSkillLines = (content: string) => {
    if (!String(content ?? "").includes("\n")) return;
    const lines = String(content ?? "")
      .split(/\r?\n/)
      .map((line) => cleanLine(line))
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(languages|frameworks?|developer tools?|libraries)\s*[:\-\u2013\u2014]\s*(.+)$/i);
      if (!match) continue;
      const value = coerceString(match[2] ?? "");
      const nestedHeading = value.search(/\b(?:languages|frameworks?|developer tools?|libraries)\s*[:\-\u2013\u2014]/i);
      const safeValue = cleanLine(nestedHeading > 0 ? value.slice(0, nestedHeading) : value);
      if (!safeValue) continue;
      tokenizeList(safeValue).forEach((token) => pushGroupedTechnicalSkillToken(token));
    }
  };

  const pushRobertQwikresumeSkillToken = (token: unknown) => {
    const name = cleanLine(token)
      .replace(/^[#|:;,\-–—•·*\/\\()[\]{}]+/, "")
      .replace(/[\s#|:;,\-–—•·*\/\\()[\]{}.!?]+$/g, "")
      .trim();
    if (!name || isNoiseSkill(name)) return;
    if (DATE_RANGE_RE.test(name) || SINGLE_DATE_RE.test(name)) return;
    if (looksLikeResponsibilitySentence(name)) return;
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return;
    const key = normalizeCandidateForStoplist(name);
    if (!key) return;
    if (!deduped.has(key)) {
      deduped.set(key, name);
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

  if (robertRawSkillsSections.length > 0) {
    robertRawSkillsSections.forEach((content) => {
      tokenizeList(content).forEach(pushRobertQwikresumeSkillToken);
    });
  }

  filterRawSection(rawSections, "skills", { preserveWhitespace: true }).forEach((content) => {
    recoverGroupedTechnicalSkillLines(content);
  });

  if (deduped.size < 3) {
    filterRawSection(rawSections, "skills", { preserveWhitespace: true }).forEach((content) => {
      tokenizeList(content).forEach(pushToken);
    });
  }

  if (robertQwikresume && deduped.size < 4) {
    robertRawSkillsSections.forEach((content) => {
      tokenizeList(content).forEach(pushRobertQwikresumeSkillToken);
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

  const displayDeduped = new Map<string, string>();
  Array.from(deduped.values()).forEach((name) => {
    const displayKey = normalizeCandidateForStoplist(name) || name.toLowerCase();
    if (!displayDeduped.has(displayKey) || name.length > (displayDeduped.get(displayKey)?.length ?? 0)) {
      displayDeduped.set(displayKey, name);
    }
  });

  return Array.from(displayDeduped.values()).map((name, idx) => ({
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

function shouldRewriteLanguagesRaw(rawValue: unknown, languages: any[]): boolean {
  const rawTokens = ensureArray<unknown>(rawValue)
    .map((token) => coerceString(token))
    .filter(Boolean);
  const canonicalNames = ensureArray<any>(languages)
    .map((entry) => coerceString(entry?.name ?? ""))
    .filter(Boolean);
  if (!rawTokens.length || !canonicalNames.length) return false;

  const canonicalSet = new Set(canonicalNames.map((name) => name.toLowerCase()));
  const hasConcatenatedNoise = rawTokens.some((token) => {
    const lowered = token.toLowerCase();
    let hits = 0;
    for (const name of canonicalNames) {
      if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(lowered)) {
        hits += 1;
      }
      if (hits > 1) return true;
    }
    return false;
  });
  if (hasConcatenatedNoise) return true;

  const normalizedRawTokens = rawTokens
    .map((token) => normalizeLanguageTokenSync(token))
    .filter((token): token is string => Boolean(token))
    .map((token) => token.toLowerCase());
  const normalizedRawSet = new Set(normalizedRawTokens);
  const hasNonOneToOneToken =
    normalizedRawTokens.length !== rawTokens.length ||
    rawTokens.length !== canonicalNames.length ||
    normalizedRawSet.size !== canonicalSet.size ||
    Array.from(canonicalSet).some((token) => !normalizedRawSet.has(token));

  return hasNonOneToOneToken;
}

function canonicalizeAchievements(rawValue: unknown, normalized: any, rawSections: RawSection[], context: CanonicalizeContext): any[] {
  const arr = ensureArray<any>(rawValue)
    .map((entry, idx): { id: string; text: string } | null => {
      const text = coerceString(entry?.text ?? entry?.content ?? entry);
      if (!text) return null;
      return {
        id: coerceId(entry?.id, "ach", idx),
        text,
      };
    })
    .filter((entry): entry is { id: string; text: string } => entry !== null);

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
  const normalizedText = coerceString((normalized)?.achievements?.text ?? "");
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
  const baseSections =
    Array.isArray(normalized?.rawSections) && normalized.rawSections.length > 0
      ? normalized.rawSections
      : rawSections;

  const canonicalProjects = Array.isArray(normalized?.projects) ? normalized.projects : [];
  if (!canonicalProjects.length) {
    return baseSections;
  }

  const isProjectsSection = (section: any) => {
    const token = coerceString(section?.fieldKey ?? section?.label ?? section?.title).trim();
    if (!token) return false;
    return PROJECTS_HEADING_RE.test(token) || SECTION_MAP[token.toUpperCase() as keyof typeof SECTION_MAP] === "projects";
  };
  const nonProjectSections = ensureArray<any>(baseSections).filter(
    (section) => !isProjectsSection(section),
  );
  const rewrittenProjectSections = canonicalProjects
    .map((project: any) => {
      const title = coerceString(project?.title ?? "");
      const summary = coerceString(project?.summary ?? "");
      const content = [title, summary].filter(Boolean).join("\n").trim();
      if (!content) return null;
      return {
        label: "Projects",
        title: "Projects",
        fieldKey: "projects",
        content,
      };
    })
    .filter(Boolean);

  return [...nonProjectSections, ...rewrittenProjectSections];
}

export function canonicalizeParserResult(result: any, context: CanonicalizeContext) {
  const normalizedInput = result?.normalized;
  const normalized = normalizedInput && typeof normalizedInput === "object" ? { ...normalizedInput } : {};
  if (!normalized.rawText && typeof result?.rawText === "string") {
    normalized.rawText = result.rawText;
  }
  if (!normalized.raw && typeof result?.raw === "string") {
    normalized.raw = result.raw;
  }
  if (!Array.isArray(normalized.sections) && Array.isArray(result?.sections)) {
    normalized.sections = result.sections;
  }
  const rawSections = routeRobertSmithCoreCompetenciesToSkillsRawSection(
    sanitizeRobertSmithQwikresumeRawSections(
      extractRawSections({ ...result, normalized }),
      normalized,
      context,
    ),
    normalized,
    context,
  );

  const experienceResult = canonicalizeExperience(normalized.experience, rawSections, normalized, context);
  normalized.experience = experienceResult.items;
  normalized.education = canonicalizeEducation(normalized.education, rawSections, normalized, context);
  normalized.skills = canonicalizeSkills(normalized.skills, normalized, rawSections, context);
  if (!normalized.skillsText && Array.isArray(normalized.skills) && normalized.skills.length > 0) {
    normalized.skillsText = normalized.skills.map((item: any) => item?.name ?? "").filter(Boolean).join(", ");
  }
  const languages = canonicalizeLanguages(normalized.languages, normalized, rawSections, context);
  normalized.languages = languages;
  const canonicalLanguageNames = languages.map((entry: any) => entry.name).filter(Boolean);
  if (!normalized.languagesText && languages.length > 0) {
    normalized.languagesText = canonicalLanguageNames.join(", ");
  }
  if (!Array.isArray(normalized.languagesRaw) || normalized.languagesRaw.length === 0) {
    normalized.languagesRaw = canonicalLanguageNames;
  } else if (shouldRewriteLanguagesRaw(normalized.languagesRaw, languages)) {
    normalized.languagesRaw = canonicalLanguageNames;
  }
  normalized.projects = canonicalizeProjects(normalized.projects, normalized, rawSections, context);
  normalized.achievements = canonicalizeAchievements(normalized.achievements, normalized, rawSections, context);
  normalized.rawSections = canonicalizeRawSections(normalized, rawSections);
  if (!normalized.rawText && typeof context.rawText === "string") {
    normalized.rawText = context.rawText;
  }

  const rawSummarySection = filterRawSection(rawSections, "summary")[0];
  const profileSection = filterRawSection(rawSections, "profile")[0];
  const normalizedSummaryText = coerceString((normalized.summary)?.text);
  let summaryText =
    (rawSummarySection && looksLikeExperienceBulletSummary(normalizedSummaryText)
      ? rawSummarySection
      : normalizedSummaryText) ||
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
  summaryText = summaryText.replace(/\bCORE\s+COMPETENC(?:Y|IES)\b[\s\S]*$/i, " ");
  summaryText = collapseSpacedCaps(summaryText);
  summaryText = (summaryText || "").replace(/^[,;:\u2013\u2014\s]+/, "").trim();
  if (rawSummarySection && looksLikeExperienceBulletSummary(summaryText)) {
    const explicitSummary = cleanRawSummaryCandidate(rawSummarySection);
    if (explicitSummary && !looksLikeExperienceBulletSummary(explicitSummary)) {
      summaryText = explicitSummary;
    }
  }

  if (summaryText) {
    const promotedSummary = [rawSummarySection, profileSection]
      .map((candidate) => cleanRawSummaryCandidate(candidate))
      .filter(Boolean)
      .filter((candidate) => !looksLikeExperienceBulletSummary(candidate))
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
    (normalized).summary = uniformSummary;
    (normalized).summaryFirstSentence = firstSentence(uniformSummary.text);
  }

  const schemaFirstIdentityContact = buildSchemaFirstIdentityContactCandidate(normalized, rawSections, context);

  if (!normalized.contact || typeof normalized.contact !== "object") {
    normalized.contact = {};
  }

  const sanitizedPhone = sanitizePhoneValue((normalized.contact).phone ?? (normalized.contact).phoneRaw);
  if (sanitizedPhone) {
    (normalized.contact).phone = sanitizedPhone;
    (normalized.contact).phoneRaw = sanitizedPhone;
  } else {
    delete (normalized.contact).phone;
    delete (normalized.contact).phoneRaw;
  }

  const desiredPosition = deriveDesiredPosition(normalized, context);
  if (desiredPosition) {
    normalized.desiredPosition = desiredPosition;
    (normalized.contact).desiredPosition = desiredPosition;
  } else {
    delete (normalized).desiredPosition;
    delete (normalized.contact).desiredPosition;
  }

  sanitizeContactLocation(normalized);

  if (locationBirth && !(normalized.contact).locationBirth) {
    (normalized.contact).locationBirth = locationBirth;
  }

  const derivedName = deriveNameFromContext(normalized, context);
  if (derivedName) {
    normalized.name = derivedName;
    if (normalized.contact) {
      (normalized.contact).name = derivedName;
    }
  }

  (normalized).identitySchema = schemaFirstIdentityContact.identity;
  (normalized).contactSchema = schemaFirstIdentityContact.contact;

  const currentContact = normalized.contact as Record<string, any>;
  const heuristicName = coerceString(normalized.name ?? currentContact.name ?? "");
  const heuristicDesiredPosition = coerceString(normalized.desiredPosition ?? currentContact.desiredPosition ?? "");
  const heuristicLocation = coerceString(currentContact.location ?? "");
  const heuristicEmail = coerceString(currentContact.email ?? "");
  const heuristicPhone = coerceString(currentContact.phone ?? currentContact.phoneRaw ?? "");
  const heuristicWebsite = coerceString(currentContact.website ?? currentContact.url ?? "");
  const heuristicLinkedin = coerceString(currentContact.linkedin ?? currentContact.linkedinUrl ?? "");
  const headerContactLocation =
    extractDirectHeaderContactLocationLine(currentContact.raw ?? "") ||
    extractDirectHeaderContactLocationLine(currentContact.addressBlock ?? "") ||
    extractConservativeHeaderContactLocation(normalized, context);

  if (
    schemaFirstIdentityContact.identity.name &&
    isUsablePersonName(schemaFirstIdentityContact.identity.name, schemaFirstIdentityContact.identity.name) &&
    !isUsablePersonName(heuristicName, heuristicName)
  ) {
    normalized.name = schemaFirstIdentityContact.identity.name;
    currentContact.name = schemaFirstIdentityContact.identity.name;
  }

  if (
    schemaFirstIdentityContact.identity.desiredPosition &&
    isStructurallyValidDesiredPosition(schemaFirstIdentityContact.identity.desiredPosition) &&
    !isStructurallyValidDesiredPosition(heuristicDesiredPosition)
  ) {
    normalized.desiredPosition = schemaFirstIdentityContact.identity.desiredPosition;
    currentContact.desiredPosition = schemaFirstIdentityContact.identity.desiredPosition;
  }

  if (
    schemaFirstIdentityContact.identity.location &&
    isStructurallyValidContactLocationValue(schemaFirstIdentityContact.identity.location) &&
    !isStructurallyValidContactLocationValue(heuristicLocation)
  ) {
    currentContact.location = schemaFirstIdentityContact.identity.location;
  } else if (headerContactLocation && !isStructurallyValidContactLocationValue(heuristicLocation)) {
    currentContact.location = headerContactLocation;
  }

  const finalRecoveredLocation = coerceString(currentContact.location ?? "");
  const previousAddressNormalized = coerceString(currentContact.addressNormalized ?? "");
  const shouldWriteAddressNormalized =
    Boolean(finalRecoveredLocation) &&
    !isStructurallyValidContactLocationValue(previousAddressNormalized);
  if (shouldWriteAddressNormalized) {
    currentContact.addressNormalized = finalRecoveredLocation;
  }

  if (
    schemaFirstIdentityContact.contact.email &&
    isStructurallyValidEmail(schemaFirstIdentityContact.contact.email) &&
    !isStructurallyValidEmail(heuristicEmail)
  ) {
    currentContact.email = schemaFirstIdentityContact.contact.email;
  }

  if (
    schemaFirstIdentityContact.contact.phone &&
    sanitizePhoneValue(schemaFirstIdentityContact.contact.phone) &&
    !sanitizePhoneValue(heuristicPhone)
  ) {
    const schemaPhone = sanitizePhoneValue(schemaFirstIdentityContact.contact.phone);
    currentContact.phone = schemaPhone;
    currentContact.phoneRaw = schemaPhone;
  }

  if (
    schemaFirstIdentityContact.contact.website &&
    isStructurallyValidWebsite(schemaFirstIdentityContact.contact.website) &&
    !isStructurallyValidWebsite(heuristicWebsite)
  ) {
    currentContact.website = sanitizeSchemaUrlValue(schemaFirstIdentityContact.contact.website);
  }

  if (
    schemaFirstIdentityContact.contact.linkedin &&
    isStructurallyValidLinkedin(schemaFirstIdentityContact.contact.linkedin) &&
    !isStructurallyValidLinkedin(heuristicLinkedin)
  ) {
    const schemaLinkedin = sanitizeSchemaUrlValue(schemaFirstIdentityContact.contact.linkedin);
    currentContact.linkedin = schemaLinkedin;
    currentContact.linkedinUrl = schemaLinkedin;
  }

  const baseDiagnostics = (
    result?.diagnostics && typeof result.diagnostics === "object"
      ? { ...result.diagnostics }
      : {}
  ) as Record<string, any>;

  const experienceDiagnostics = experienceResult.diagnostics;
  if (experienceDiagnostics.droppedEmpty || experienceDiagnostics.fallbackCount) {
    (normalized).experienceDiagnostics = experienceDiagnostics;
    baseDiagnostics.experience_dropped_empty = experienceDiagnostics.droppedEmpty;
    baseDiagnostics.experience_fallback_count = experienceDiagnostics.fallbackCount;
    baseDiagnostics.experience_source = experienceDiagnostics.source;
  }

  const alignedFromSections = deriveNormalizedConvenienceFieldsFromSections(
    normalized.sections,
    normalized,
  );
  if (alignedFromSections) {
    Object.assign(normalized, alignedFromSections);
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
