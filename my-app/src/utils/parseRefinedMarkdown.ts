/**
 * Lightweight parser for LLM markdown outputs (produced by the refine flow).
 * - Exported as a named function: parseRefinedMarkdown
 * - Returns a simple structured object with string content for editable UI blocks.
 *
 * Notes:
 * - This intentionally produces plain text for each section (no HTML).
 * - The parser is forgiving: it extracts sections headed by "###" (or "##") and
 *   falls back to scanning for common French/English section titles.
 * - Keep the output shape simple so the frontend can present editable textareas.
 */

export interface RefinedContent {
  identity?: string;
  summary?: string;
  experience?: string;
  education?: string;
  skills?: string;
  points?: string;
  achievements?: string;
  contact?: string;
  raw?: string; // unparsed full markdown fallback
}

/**
 * Parse a markdown string produced by the LLM into structured sections.
 * Use straightforward regex extraction — deterministic and easy to unit test.
 */
export function parseRefinedMarkdown(markdown: string | null | undefined): RefinedContent {
  if (!markdown) return { raw: "" };

  // Normalize line endings
  const md = String(markdown).replace(/\r\n/g, "\n");

  // Helper to trim and collapse whitespace while preserving newlines for paragraphs
  function clean(text: string) {
    return text
      .replace(/^\s+|\s+$/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+\n/g, "\n")
      .trim();
  }

  // Primary extractor: find sections headed by ##/###/#### and capture content until next heading
  const genericSectionRe = /^#{2,4}\s*\**([^\n*]+)\**\s*\n([\s\S]*?)(?=^#{2,4}\s*\**[^\n*]+\**\s*$|$)/gim;
  const sections: Record<string, string> = {};
  let m: RegExpExecArray | null;

  while ((m = genericSectionRe.exec(md)) !== null) {
    const rawTitle = String(m[1]).replace(/[*_]+/g, "").trim();
    const title = rawTitle.toLowerCase();
    const content = clean(m[2] ?? "");
    if (title) sections[title] = content;
  }

  // Secondary fallback: if no headings were captured, split on '---' and try to find headings inside parts
  if (Object.keys(sections).length === 0) {
    const parts = md.split(/^---\s*$/m).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      // Try to find a heading anywhere in the part (e.g., "#### PROFESSIONAL SUMMARY")
      const headingMatch = part.match(/^(?:#{2,4}\s*\**([^\n*]+)\**)/m);
      if (headingMatch && headingMatch[1]) {
        const title = headingMatch[1].replace(/[*_]+/g, "").trim().toLowerCase();
        const rest = clean(part.replace(/^[^\n]*\n?/, ""));
        if (title) sections[title] = rest;
        continue;
      }
      // Otherwise, fallback to using the first non-empty line as a key
      const firstLine = part.split("\n").find(l => l.trim().length > 0) ?? "";
      const key = firstLine.replace(/[*_#]+/g, "").trim().toLowerCase();
      const rest = clean(part.replace(/^[^\n]*\n?/, ""));
      if (key) sections[key] = rest;
    }
  }

  // Map common titles (French and English) to canonical fields
  function lookup(keys: string[]) {
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (sections[lower]) return sections[lower];
      // Best-effort fuzzy match
      const foundKey = Object.keys(sections).find(sk => sk.includes(lower) || lower.includes(sk) || sk.includes(lower.split(" ")[0]));
      if (foundKey) return sections[foundKey];
    }
    return undefined;
  }

  const result: RefinedContent = {
    raw: md,
    identity: lookup(["identité & coordonnées", "identite", "identity", "identité", "contact", "coordonnées", "contact details"]),
    summary: lookup(["résumé professionnel", "résumé", "professional summary", "summary", "résumé professionnel", "professional summary", "professional summary"]),
    experience: lookup(["parcours professionnel", "parcours", "experience", "professional experience", "work experience", "professional experience"]),
    education: lookup(["formation", "education", "studies", "formation"]),
    skills: lookup(["compétences", "skills", "competences", "core competencies", "core competencies"]),
    points: lookup(["points forts", "points forts & différenciation", "strengths", "points forts", "core competencies"]),
    achievements: lookup(["réalisations", "achievements", "accomplishments", "opportunités", "opportunities"]),
  };

  return result;
}