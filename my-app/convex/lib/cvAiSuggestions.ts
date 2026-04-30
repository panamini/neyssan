import sharedLanguageNames from "../../../shared/language_names.json" assert { type: "json" };
import languagesTaxonomyJson from "./taxonomy/languages.json" assert { type: "json" };
import {
  canonicalSkills,
  collectSkillsFromSources,
  canonicalizeSkillTokens,
  skillAliases,
} from "./parsing/skillsCanonical";

export type CvAiExperienceEvidence = {
  company?: string;
  position?: string;
  description?: string;
  bullets?: string[];
};

export type CvAiEducationEvidence = {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  description?: string;
};

export type CvAiLanguageEvidence = {
  name?: string;
  level?: string;
};

type LanguagesTaxonomy = {
  source?: string;
  canonical: string[];
};

const languagesTaxonomy = languagesTaxonomyJson as LanguagesTaxonomy;
const sharedLanguageMap = sharedLanguageNames as Record<string, string[]>;

function normalizeMatchingText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function tokenizeForMatching(value: string): string[] {
  return normalizeMatchingText(value)
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    const clean = item.trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }

  return next;
}

function clampSuggestionLimit(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value as number);
  return Math.min(max, Math.max(min, rounded));
}

function buildExperienceEvidenceText(item: CvAiExperienceEvidence): string {
  return [
    item.position ? `Role: ${item.position}` : null,
    item.company ? `Company: ${item.company}` : null,
    item.description ? `Description: ${item.description}` : null,
    Array.isArray(item.bullets) && item.bullets.length > 0
      ? `Bullets: ${item.bullets.join(" | ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEducationEvidenceText(item: CvAiEducationEvidence): string {
  return [
    item.degree ? `Degree: ${item.degree}` : null,
    item.fieldOfStudy ? `Field: ${item.fieldOfStudy}` : null,
    item.institution ? `Institution: ${item.institution}` : null,
    item.description ? `Description: ${item.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function collectSkillMatchesFromTexts(texts: string[]): string[] {
  const rawMatches: string[] = [];
  const seenMatches = new Set<string>();

  for (const text of texts) {
    const tokens = tokenizeForMatching(text);

    for (let index = 0; index < tokens.length; index += 1) {
      let matchedPhrase: string | null = null;

      for (
        let size = Math.min(5, tokens.length - index);
        size >= 1;
        size -= 1
      ) {
        const candidate = tokens.slice(index, index + size).join(" ");
        const canonical =
          skillAliases[candidate] ??
          (canonicalSkills.has(candidate) ? candidate : null);

        if (!canonical) continue;
        matchedPhrase = canonical;
        if (!seenMatches.has(canonical)) {
          seenMatches.add(canonical);
          rawMatches.push(canonical);
        }
        index += size - 1;
        break;
      }

      if (matchedPhrase) continue;
    }
  }

  return canonicalizeSkillTokens(rawMatches);
}

const languageAliasMap = (() => {
  const map = new Map<string, string>();

  for (const canonical of languagesTaxonomy.canonical) {
    const cleanCanonical = String(canonical ?? "").trim();
    if (!cleanCanonical) continue;
    map.set(normalizeMatchingText(cleanCanonical), cleanCanonical);
  }

  for (const [canonical, aliases] of Object.entries(sharedLanguageMap)) {
    const cleanCanonical = String(canonical ?? "").trim();
    if (!cleanCanonical) continue;
    map.set(normalizeMatchingText(cleanCanonical), cleanCanonical);
    for (const alias of Array.isArray(aliases) ? aliases : []) {
      const cleanAlias = String(alias ?? "").trim();
      if (!cleanAlias) continue;
      map.set(normalizeMatchingText(cleanAlias), cleanCanonical);
    }
  }

  return map;
})();

const languageAliasEntries = Array.from(languageAliasMap.entries()).sort(
  (left, right) => right[0].split(/\s+/).length - left[0].split(/\s+/).length,
);

const programmingLanguageFalsePositives = new Set([
  "c",
  "c++",
  "c#",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "python",
  "r",
  "ruby",
  "rust",
  "scala",
  "sql",
  "typescript",
]);

const knownHobbyLabels = new Set([
  "chess",
  "creative writing",
  "cycling",
  "drawing",
  "hiking",
  "music",
  "painting",
  "photography",
  "reading",
  "running",
  "travel",
  "volunteering",
]);

function collectLanguageMatchesFromTexts(texts: string[]): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    const tokens = tokenizeForMatching(text);
    if (tokens.length === 0) continue;

    for (let index = 0; index < tokens.length; index += 1) {
      let matched = false;

      for (const [alias, canonical] of languageAliasEntries) {
        const aliasTokens = alias.split(/\s+/).filter(Boolean);
        if (aliasTokens.length === 0) continue;
        if (alias.length < 3 && aliasTokens.length === 1) continue;
        if (index + aliasTokens.length > tokens.length) continue;
        const candidate = tokens
          .slice(index, index + aliasTokens.length)
          .join(" ");

        if (candidate !== alias) continue;
        if (!seen.has(canonical.toLocaleLowerCase())) {
          seen.add(canonical.toLocaleLowerCase());
          matches.push(canonical);
        }
        index += aliasTokens.length - 1;
        matched = true;
        break;
      }

      if (matched) continue;
    }
  }

  return matches;
}

export function filterLanguageSuggestionItems(items: string[]): string[] {
  return dedupeCaseInsensitive(
    items
      .map((item) => {
        const normalized = normalizeMatchingText(item);
        if (programmingLanguageFalsePositives.has(normalized)) return "";
        return languageAliasMap.get(normalized) ?? "";
      })
      .filter(Boolean),
  );
}

export function filterHobbySuggestionItems(args: {
  items: string[];
  blockedItems?: string[];
}): string[] {
  const blocked = new Set(
    dedupeCaseInsensitive(args.blockedItems ?? []).map((item) =>
      item.toLocaleLowerCase(),
    ),
  );

  return dedupeCaseInsensitive(args.items)
    .filter((item) => !blocked.has(item.toLocaleLowerCase()))
    .filter((item) => {
      const normalized = item.trim().toLocaleLowerCase();
      return (
        knownHobbyLabels.has(normalized) ||
        collectSkillMatchesFromTexts([item]).length === 0
      );
    })
    .filter((item) => filterLanguageSuggestionItems([item]).length === 0);
}

export function buildSkillSuggestionShortlist(args: {
  summary?: string;
  experiences?: CvAiExperienceEvidence[];
  educations?: CvAiEducationEvidence[];
  existingItems?: string[];
  excludeItems?: string[];
  maxItems?: number;
}): string[] {
  const limit = clampSuggestionLimit(args.maxItems, 4, 20, 12);
  const experienceTexts = (args.experiences ?? [])
    .map(buildExperienceEvidenceText)
    .filter(Boolean);
  const educationTexts = (args.educations ?? [])
    .map(buildEducationEvidenceText)
    .filter(Boolean);
  const evidenceTexts = [
    args.summary ?? "",
    ...experienceTexts,
    ...educationTexts,
  ].filter(Boolean);

  const extractedSkills = collectSkillsFromSources({
    fallbackTexts: evidenceTexts,
  });
  const matchedSkills = collectSkillMatchesFromTexts(evidenceTexts);
  const blacklist = new Set(
    dedupeCaseInsensitive([
      ...(args.existingItems ?? []),
      ...(args.excludeItems ?? []),
    ]).map((item) => item.toLocaleLowerCase()),
  );

  return dedupeCaseInsensitive([...extractedSkills, ...matchedSkills])
    .filter((item) => !blacklist.has(item.toLocaleLowerCase()))
    .slice(0, limit);
}

export function buildLanguageSuggestionShortlist(args: {
  summary?: string;
  experiences?: CvAiExperienceEvidence[];
  educations?: CvAiEducationEvidence[];
  existingItems?: string[];
  excludeItems?: string[];
  maxItems?: number;
}): string[] {
  const limit = clampSuggestionLimit(args.maxItems, 3, 10, 6);
  const evidenceTexts = [
    args.summary ?? "",
    ...(args.experiences ?? []).map(buildExperienceEvidenceText),
    ...(args.educations ?? []).map(buildEducationEvidenceText),
  ].filter(Boolean);
  const blacklist = new Set(
    dedupeCaseInsensitive([
      ...(args.existingItems ?? []),
      ...(args.excludeItems ?? []),
    ]).map((item) => item.toLocaleLowerCase()),
  );

  return dedupeCaseInsensitive(collectLanguageMatchesFromTexts(evidenceTexts))
    .filter((item) => !blacklist.has(item.toLocaleLowerCase()))
    .slice(0, limit);
}
