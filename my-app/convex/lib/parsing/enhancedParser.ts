// enhancedParser.ts - Improved with real-world header data
import headingsConfig from "../../../../shared/headings.json";
import {
  getCanonicalHeadingAliases,
  resolveCanonicalHeadingFamily,
} from "./headingResolver";

type HeadingsConfig = Record<string, Record<string, string[]>>;

type FieldKey =
  | "introduction"
  | "summary"
  | "contact"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "certifications"
  | "achievements"
  | "projects"
  | "hobbies"
  | "affiliations"
  | "additional_information"
  | "research"
  | "volunteer"
  | "references"
  | "other";

const SHARED_HEADINGS = headingsConfig as HeadingsConfig;

function stripDiacritics(value: string): string {
  try {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return value;
  }
}

function collectSharedTerms(fieldKey: string): string[] {
  const locales = SHARED_HEADINGS[fieldKey];
  if (!locales) return [];
  const unique = new Map<string, string>();
  for (const terms of Object.values(locales)) {
    for (const term of terms) {
      const trimmed = term.trim();
      if (!trimmed) continue;
      const normalized = stripDiacritics(trimmed.toLowerCase());
      if (!unique.has(normalized)) {
        unique.set(normalized, trimmed);
      }
    }
  }
  return Array.from(unique.values());
}

const LEGACY_FALLBACKS: Record<FieldKey, string[]> = {
  introduction: [
    "summary",
    "professional summary",
    "executive summary",
    "profile",
    "professional profile",
    "personal profile",
    "about",
    "about me",
    "profil",
    "profil professionnel",
    "résumé",
    "resume",
    "objective",
    "career objective",
  ],
  summary: [
    "summary",
    "professional summary",
    "executive summary",
    "profile",
    "professional profile",
    "personal profile",
    "about",
    "about me",
    "profil",
    "profil professionnel",
    "résumé",
    "resume",
    "objective",
    "career objective",
  ],
  contact: [
    "contact",
    "contact information",
    "contact info",
    "coordonnées",
    "coordonnees",
    "datos de contacto",
    "kontaktdaten",
    "contact details",
  ],
  experience: [
    "experience",
    "work history",
    "employment",
    "career",
    "professional background",
    "roles",
    "work experience",
    "employment history",
    "career history",
    "professional experience",
    "berufserfahrung",
    "expérience professionnelle",
    "experiencia laboral",
    "工作经历",
  ],
  education: [
    "education",
    "academic",
    "training",
    "courses",
    "qualifications",
    "academic background",
    "degrees",
    "bildung",
    "formation",
    "educación",
    "教育背景",
  ],
  skills: [
    "skills",
    "key skills",
    "technical skills",
    "core competencies",
    "competencies",
    "competences",
    "compétences",
    "habilidades",
    "competencias",
    "fähigkeiten",
    "kompetenzen",
    "技能",
  ],
  languages: [
    "languages",
    "language skills",
    "language proficiency",
    "idiomas",
    "langues",
    "sprachkenntnisse",
    "sprachen",
    "语言",
  ],
  achievements: [
    "achievements",
    "accomplishments",
    "awards",
    "honors",
    "réalisations",
    "récompenses",
    "logros",
    "reconocimientos",
    "erfolge",
    "auszeichnungen",
    "成果",
  ],
  projects: [
    "projects",
    "selected projects",
    "projets",
    "project experience",
    "projekten",
    "projecten",
    "项目",
  ],
  certifications: [
    "certifications",
    "certification",
    "certificates",
    "certificate",
    "license",
    "licenses",
    "licence",
    "licences",
  ],
  hobbies: ["hobbies", "hobby", "interests", "interest"],
  affiliations: ["affiliations", "affiliation", "memberships", "associations"],
  additional_information: [
    "additional information",
    "additional info",
    "other information",
    "supplementary information",
  ],
  research: [
    "research",
    "research experience",
    "research projects",
    "recherche",
    "recherches",
    "forschung",
    "investigación",
  ],
  volunteer: [
    "volunteer",
    "volunteering",
    "community involvement",
    "bénévolat",
    "benevolat",
    "volontariat",
    "voluntariado",
  ],
  references: [
    "references",
    "références",
    "referencias",
    "referenzen",
  ],
  other: [
    "other",
    "miscellaneous",
    "divers",
    "otros",
    "weitere",
  ],
};

function mergeTerms(fieldKey: FieldKey, sharedKey: string | null = fieldKey): string[] {
  const unique = new Map<string, string>();
  const addTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const normalized = stripDiacritics(trimmed.toLowerCase());
    if (!unique.has(normalized)) {
      unique.set(normalized, trimmed);
    }
  };

  const fallbacks = LEGACY_FALLBACKS[fieldKey] ?? [];
  fallbacks.forEach(addTerm);

  if (sharedKey && SHARED_HEADINGS[sharedKey]) {
    collectSharedTerms(sharedKey).forEach(addTerm);
  }

  return Array.from(unique.values());
}

export const FIELD_KEY_MAP: Record<FieldKey, string[]> = {
  introduction: mergeTerms("introduction", null),
  summary: mergeTerms("introduction", "summary"),
  contact: mergeTerms("contact", null),
  experience: mergeTerms("experience"),
  education: mergeTerms("education"),
  skills: mergeTerms("skills"),
  languages: mergeTerms("languages"),
  certifications: mergeTerms("certifications"),
  achievements: mergeTerms("achievements"),
  projects: mergeTerms("projects"),
  hobbies: mergeTerms("hobbies"),
  affiliations: mergeTerms("affiliations"),
  additional_information: mergeTerms("additional_information"),
  research: mergeTerms("research"),
  volunteer: mergeTerms("volunteer"),
  references: mergeTerms("references"),
  other: mergeTerms("other"),
};

const CANONICAL_HEADER_TERMS = [
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
  "achievements",
  "hobbies",
  "affiliations",
  "additional_information",
] as const;

const CANONICAL_HEADER_ALIASES = CANONICAL_HEADER_TERMS.flatMap((key) =>
  getCanonicalHeadingAliases(key).map((alias) => stripDiacritics(alias.toLowerCase())),
);

export function isPotentialHeader(
  line: string,
  context: {
    previousLine: string;
    nextLine: string;
    lineIndex: number;
  }
): boolean {
  // pipeline-note: used by hybridParser and cvMapper to recognise headings
  // across languages/alphabets. Keep cross-locale additions here.
  const trimmed = line.trim();
  const { previousLine, nextLine, lineIndex } = context;

  // Early exit for obvious non-headers
  if (trimmed.length > 80 || trimmed.length < 2) return false;

  // Check against known header patterns (most efficient check first)
  const normalized = stripDiacritics(trimmed.toLowerCase());
  const resolvedCanonical = resolveCanonicalHeadingFamily(trimmed);
  if (resolvedCanonical) return true;
  const isKnownHeader = Object.values(FIELD_KEY_MAP).some((patterns) =>
    patterns.some((pattern) => {
      const normalizedPattern = stripDiacritics(pattern.toLowerCase());
      return (
        normalized === normalizedPattern ||
        normalized.startsWith(`${normalizedPattern}:`) ||
        normalized.startsWith(`${normalizedPattern} -`)
      );
    })
  );

  if (isKnownHeader) return true;

  const canonicalAliasHit = CANONICAL_HEADER_ALIASES.some((normalizedPattern) => {
    return (
      normalized === normalizedPattern ||
      normalized.startsWith(`${normalizedPattern}:`) ||
      normalized.startsWith(`${normalizedPattern} -`)
    );
  });

  if (canonicalAliasHit) return true;

  // Structural cues (ordered by reliability)
  const isAllCaps = trimmed.toUpperCase() === trimmed && /[A-Z]{3,}/.test(trimmed) && trimmed.length < 50;

  const hasHeaderFormatting = /^(#+\s+|={3,}|-{3,}|\*\s+|\d+\.\s+)/.test(trimmed);

  const precededByEmptyLine = previousLine.trim() === "" && lineIndex > 0;

  const followedBySeparator = /^[-=*_]{3,}$/.test(nextLine.trim());

  const hasHighCapitalRatio = (trimmed.match(/[A-Z]/g) || []).length / trimmed.length > 0.6;

  // Weighted scoring system
  const scores = {
    isAllCaps: 3,
    hasHeaderFormatting: 2,
    precededByEmptyLine: 2,
    followedBySeparator: 3,
    hasHighCapitalRatio: 1,
  } as const;

  let totalScore = 0;
  if (isAllCaps) totalScore += scores.isAllCaps;
  if (hasHeaderFormatting) totalScore += scores.hasHeaderFormatting;
  if (precededByEmptyLine) totalScore += scores.precededByEmptyLine;
  if (followedBySeparator) totalScore += scores.followedBySeparator;
  if (hasHighCapitalRatio) totalScore += scores.hasHighCapitalRatio;

  return totalScore >= 5; // Threshold for header detection
}
