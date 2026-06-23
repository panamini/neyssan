/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/**
 * Shared utilities for Convex actions and functions.
 */

export function generateReviewerId(fieldKey: string, index: number): string {
  return `${fieldKey}-${index}`;
}

// Stopwords for skills filtering
const SKILL_STOPWORDS = new Set([
  "and", "or", "with", "experience", "years", "year", "the", "a", "an", "of", "in", "on", "for", "knowledge"
]);

export function normalizeSkills(input?: string | string[]): { skills: string[]; skillsText: string } {
  if (!input) return { skills: [], skillsText: "" };
  const raw = Array.isArray(input) ? input.join(",") : String(input);
  // Split on common delimiters
  const tokens = raw.split(/[,;\n\|\/]+/).map(t => t.trim()).filter(Boolean);
  const seen = new Map<string, string>();
  for (const t of tokens) {
    const cleaned = t.replace(/[·•\u2022]/g, "").trim();
    const lower = cleaned.toLowerCase();
    if (lower.length < 2) continue;
    if (SKILL_STOPWORDS.has(lower)) continue;
    // remove surrounding parentheses/brackets
    const final = cleaned.replace(/^[\(\[]+|[\)\]]+$/g, "").trim();
    const key = final.toLowerCase();
    if (!seen.has(key)) seen.set(key, final);
  }
  const skills = Array.from(seen.values());
  const skillsText = skills.join(", ");
  return { skills, skillsText };
}

export function parseExperienceFallback(text?: string): any[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: any[] = [];
  for (const line of lines) {
    // split on common separators like ' - ' or ' | '
    const parts = line.split(/\s[-–—]\s|\s\|\s/).map(p => p.trim());
    const raw = line;
    const years = (line.match(/(19|20)\d{2}/g) || []).map(String);
    let company: string | undefined = undefined;
    let title: string | undefined = undefined;
    if (parts.length >= 2) {
      title = parts[0];
      company = parts[1];
    } else {
      // heuristics: look for ' at ' or ' @ '
      const atMatch = line.match(/\bat\s+([^,;@\-\|]+)/i);
      const atSymbol = line.match(/@([A-Za-z0-9_.-]+)/);
      if (atMatch) company = atMatch[1].trim();
      else if (atSymbol) company = atSymbol[1].trim();
      else {
        // attempt to pick company-like token (capitalized word near end)
        const tokens = line.split(/\s+/);
        const last = tokens[tokens.length - 1];
        if (last && last[0] === last[0].toUpperCase()) company = last;
        title = parts[0];
      }
    }
    items.push({ raw, company, title, years: years.length ? years : undefined });
  }
  return items;
}

export function parseEducationFallback(text?: string): any[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: any[] = [];
  for (const line of lines) {
    const raw = line;
    const years = (line.match(/(19|20)\d{2}/g) || []).map(String);
    // heuristics: look for degree keywords
    const degreeMatch = line.match(/(Bachelor|B\.A\.|BSc|Master|M\.Sc|MBA|PhD|Doctor)/i);
    const institutionMatch = line.match(/at\s+([^,;\-]+)/i) || line.match(/,\s*([^,]+)$/);
    const degree = degreeMatch ? degreeMatch[0] : undefined;
    const institution = institutionMatch ? institutionMatch[1].trim() : undefined;
    items.push({ raw, institution, degree, years: years.length ? years : undefined });
  }
  return items;
}

// Small helper to compute a conservative confidence score based on presence of key sections
export function computeParseConfidence(parsed: { summary?: string; skills?: any[]; experience?: any[]; education?: any[] }) {
  let score = 0;
  if (parsed.summary && parsed.summary.trim().length > 20) score += 0.4;
  if (parsed.skills && parsed.skills.length > 0) score += 0.3;
  if (parsed.experience && parsed.experience.length > 0) score += 0.2;
  if (parsed.education && parsed.education.length > 0) score += 0.1;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export default { generateReviewerId, normalizeSkills, parseExperienceFallback, parseEducationFallback, computeParseConfidence };