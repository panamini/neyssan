import headingsConfig from "../../../../shared/headings.json";

export type CanonicalHeadingFamily =
  | "summary"
  | "profile"
  | "contact"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "projects"
  | "certifications"
  | "achievements"
  | "hobbies"
  | "affiliations"
  | "additional_information";

type HeadingsConfig = Record<string, Record<string, string[]>>;

const SHARED_HEADINGS = headingsConfig as HeadingsConfig;

const INLINE_ALIASES: Record<CanonicalHeadingFamily, string[]> = {
  summary: [
    "summary",
    "professional summary",
    "career summary",
    "executive summary",
    "profile summary",
    "objective",
    "career objective",
    "about",
    "about me",
  ],
  profile: [
    "profile",
    "professional profile",
    "personal profile",
    "header",
    "identity",
    "personal details",
    "personal information",
  ],
  contact: [
    "contact",
    "contact information",
    "contact info",
    "contact details",
    "details",
    "coordonnees",
    "coordonnees personnelles",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "career history",
    "employment",
  ],
  education: [
    "education",
    "education training",
    "education and training",
    "academic background",
    "training",
    "qualifications",
  ],
  skills: [
    "skills",
    "key skills",
    "technical skills",
    "core competencies",
    "competencies",
    "strengths",
    "skill set",
  ],
  languages: [
    "languages",
    "language skills",
    "language proficiency",
    "languages and proficiency",
  ],
  projects: [
    "projects",
    "selected projects",
    "project experience",
    "project highlights",
    "projects activities",
    "projects and activities",
  ],
  certifications: [
    "certifications",
    "certification",
    "certificates",
    "certificate",
    "licenses",
    "license",
    "licences",
    "licence",
  ],
  achievements: [
    "achievements",
    "accomplishments",
    "awards",
    "career highlights",
    "honors",
  ],
  hobbies: [
    "hobbies",
    "hobby",
    "interests",
    "interest",
    "personal interests",
  ],
  affiliations: [
    "affiliations",
    "affiliation",
    "memberships",
    "membership",
    "associations",
    "association",
    "professional affiliations",
  ],
  additional_information: [
    "additional information",
    "additional info",
    "other information",
    "extra information",
    "miscellaneous",
    "misc",
    "supplementary information",
    "personal dossier",
  ],
};

function stripDiacritics(value: string): string {
  try {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return value;
  }
}

export function normalizeHeadingText(value: unknown): string {
  return stripDiacritics(String(value ?? ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactHeadingText(value: unknown): string {
  return normalizeHeadingText(value).replace(/\s+/g, "");
}

function getSharedAliases(family: CanonicalHeadingFamily): string[] {
  const locales = SHARED_HEADINGS[family];
  if (!locales) return [];
  const out: string[] = [];
  Object.values(locales).forEach((terms) => {
    terms.forEach((term) => {
      if (typeof term === "string" && term.trim()) {
        out.push(term.trim());
      }
    });
  });
  return out;
}

export function getCanonicalHeadingAliases(family: CanonicalHeadingFamily): string[] {
  const merged = new Map<string, string>();
  [...INLINE_ALIASES[family], ...getSharedAliases(family)].forEach((term) => {
    const normalized = normalizeHeadingText(term);
    if (!normalized || merged.has(normalized)) return;
    merged.set(normalized, term);
  });
  return Array.from(merged.values());
}

const CANONICAL_FAMILIES: CanonicalHeadingFamily[] = [
  "summary",
  "profile",
  "contact",
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
];

const CANONICAL_HEADING_INDEX = CANONICAL_FAMILIES.flatMap((family) =>
  getCanonicalHeadingAliases(family).map((alias) => ({
    family,
    normalized: normalizeHeadingText(alias),
    compact: compactHeadingText(alias),
  })),
);

export function resolveCanonicalHeadingFamily(value: unknown): CanonicalHeadingFamily | null {
  const normalized = normalizeHeadingText(value);
  if (!normalized) return null;
  const compact = normalized.replace(/\s+/g, "");
  for (const entry of CANONICAL_HEADING_INDEX) {
    if (!entry.normalized) continue;
    if (normalized === entry.normalized || compact === entry.compact) {
      return entry.family;
    }
  }
  return null;
}

export function mapCanonicalFamilyToParserFieldKey(
  family: CanonicalHeadingFamily,
): string {
  switch (family) {
    case "profile":
    case "contact":
      return "contact";
    default:
      return family;
  }
}
