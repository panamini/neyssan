import taxonomyJson from "../taxonomy/skills.json" assert { type: "json" };
import stoplistJson from "../taxonomy/stoplist.json" assert { type: "json" };

interface SkillsTaxonomy {
  canonical: string[];
  aliases: Record<string, string>;
  version: string;
}

interface Stoplist {
  terms: string[];
}

const taxonomy = taxonomyJson as SkillsTaxonomy;
const stoplist = stoplistJson as Stoplist & { categories?: Record<string, string[]> };

// pipeline-note: all skill aliasing, stoplists, and canonical vocab live here.
// canonicalize.ts, cvMapper.ts, and any LLM adapters should call helpers from
// this module instead of duplicating token normalization.

export const canonicalSkills: Set<string> = new Set(
  taxonomy.canonical.map((skill: string) => skill.trim().toLowerCase())
);

export const skillAliases: Record<string, string> = Object.fromEntries(
  Object.entries(taxonomy.aliases).map(([alias, target]: [string, string]) => [
    alias.trim().toLowerCase(),
    target.trim().toLowerCase(),
  ])
);

const stoplistTerms: string[] = Array.isArray(stoplist.terms)
  ? stoplist.terms
  : [];
const stoplistFromCategories: string[] = stoplist.categories
  ? Object.values(stoplist.categories).flat()
  : [];

export const skillStoplist: Set<string> = new Set(
  [...stoplistTerms, ...stoplistFromCategories].map((term) => term.trim().toLowerCase())
);

export const skillsTaxonomyVersion: string = taxonomy.version;

const canonicalDisplayMap: Map<string, string> = new Map(
  taxonomy.canonical.map((skill: string) => [skill.trim().toLowerCase(), skill.trim()])
);

const SKILL_HEADING_PATTERNS = [
  /\bskills?\b/i,
  /\btechnical skills?\b/i,
  /\bcomp[eé]tences?\b/i,
  /\bcompetencias?\b/i,
  /\bkompetenzen?\b/i,
  /\bhard skills?\b/i,
  /\bsoft skills?\b/i,
  /\bprincipales competences?\b/i,
];

const SKILL_TOKEN_STOPWORDS = new Set([
  "experience",
  "experiences",
  "objective",
  "profil",
  "profile",
  "summary",
  "resume",
  "curriculum",
  "interests",
  "hobbies",
  "responsible",
  "manager",
  "assistant",
  "director",
  "supervisor",
  "lead",
  "guard",
  "security",
]);

const SKILL_FALLBACK_PATTERN = /[•*\-\u2022]/;

function toTitleCaseToken(token: string): string {
  return token
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      if (part.toUpperCase() === part && part.length <= 4) return part.toUpperCase();
      if (part.length <= 3) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function sanitizeSkillToken(raw: string): string | null {
  const cleaned = raw.replace(/^[•*\-\u2022\s]+/, "").replace(/[\s,;:]+$/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length > 80) return null;
  if (/https?:/.test(cleaned)) return null;
  if (/\d{4}/.test(cleaned)) return null;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 5) return null;
  const normalized = cleaned.toLowerCase();
  if (SKILL_TOKEN_STOPWORDS.has(normalized)) return null;
  if (/\b(experience|summary|profile|objective|career)\b/i.test(cleaned)) return null;
  return toTitleCaseToken(cleaned);
}

function tokenizeSkillBlock(text: string): string[] {
  return text
    .split(/[,;\n\u2022\u2023\u25E6\u2043\u2219]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isSkillHeading(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return SKILL_HEADING_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function extractSkillTokensFromText(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const headingMatch = /^(.*?)([:\-\u2013\u2014])\s*(.+)$/.exec(line);
    if (headingMatch) {
      const [, heading, , remainder] = headingMatch;
      if (isSkillHeading(heading)) {
        tokens.push(...tokenizeSkillBlock(remainder));
        continue;
      }
    }
    if (!isSkillHeading(line)) continue;
    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (!next) break;
      if (isSkillHeading(next)) break;
      if (/^(experience|education|achievements|projects|languages)/i.test(next)) break;
      collected.push(next);
    }
    if (collected.length) {
      tokens.push(...tokenizeSkillBlock(collected.join("\n")));
    }
  }
  if (tokens.length === 0 && SKILL_FALLBACK_PATTERN.test(text)) {
    tokens.push(...tokenizeSkillBlock(text));
  }
  return tokens;
}

export function canonicalizeSkillTokens(tokens: string[]): string[] {
  const deduped = new Map<string, string>();
  for (const rawToken of tokens) {
    const sanitized = sanitizeSkillToken(rawToken);
    if (!sanitized) continue;
    const lower = sanitized.toLowerCase();
    if (skillStoplist.has(lower)) continue;
    const alias = skillAliases[lower] ?? lower;
    if (skillStoplist.has(alias)) continue;
    const canonicalKey = canonicalDisplayMap.has(alias) ? alias : alias;
    const display = canonicalDisplayMap.get(alias) ?? canonicalDisplayMap.get(lower) ?? sanitized;
    if (!deduped.has(canonicalKey)) {
      deduped.set(canonicalKey, display);
    }
  }
  return Array.from(deduped.values());
}

export function collectSkillsFromSources(sources: {
  structured?: Array<string | null | undefined>;
  blocks?: string[];
  fallbackTexts?: string[];
}): string[] {
  const tokens: string[] = [];
  (sources.structured ?? []).forEach((value) => {
    if (!value) return;
    tokens.push(value);
  });
  (sources.blocks ?? []).forEach((block) => {
    tokens.push(...extractSkillTokensFromText(block));
  });
  if (tokens.length === 0) {
    (sources.fallbackTexts ?? []).forEach((text) => {
      if (!text) return;
      tokens.push(...extractSkillTokensFromText(text));
    });
  }
  return canonicalizeSkillTokens(tokens);
}
