/**
 * Heuristic helpers used by Convex PDF/LMM parsing to extract
 * - languages (Langues / Languages)
 * - contact block (phone/address)
 *
 * These functions are intentionally conservative and defensive: they prefer
 * simple, testable regexes and avoid heavy NLP. They preserve original text
 * fidelity and return minimally-processed strings/arrays suitable for storing
 * in the canonical profile fields.
 *
 * Exported functions:
 * - extractLanguages(text: string): string[]
 * - extractContactBlock(text: string): { phone?: string; address?: string } | undefined
 *
 * Keep small and pure to make unit testing straightforward.
 */

export interface IContactBlock {
  phone?: string;
  address?: string;
}

/**
 * Extract a list of languages from free text.
 * Strategy:
 * 1. Look for explicit headings (FR/EN): "Langues", "Languages", "Langue", "Language"
 *    and capture the following paragraph / bullet list (up to next blank line or next heading).
 * 2. Fallback: look for inline "Languages: English, French" or "Langues : Français, Anglais".
 * 3. Normalize by trimming and deduping, return array of language labels (original casing).
 */
export function extractLanguages(text: string): string[] {
  if (!text) return [];

  const normalized = String(text);

  // 1) Heading-based extraction: find heading then capture following block
  const headingRe = /^(?:#{1,4}\s*)?(langues|languages|langue|language)\b[:\s\-—]*$/gim;
  let match;
  const lines = normalized.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/(^|\W)(langues|languages|langue|language)(\W|$)/i.test(line)) {
      // capture subsequent lines until blank or new heading-like line
      const captured: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (!l || /^\s*$/.test(l)) break;
        // stop if we hit another header that looks like SECTION TITLE (all caps or ends with ':')
        if (/^[A-Z \-]{2,}$/.test(l.trim()) || /^[\s#]*[A-Za-zÀ-ÖØ-öø-ÿ0-9 \-]+:/.test(l.trim())) break;
        captured.push(l.trim());
      }
      const textBlock = captured.join("\n").trim();
      const parsed = parseLanguageListFromBlock(textBlock);
      if (parsed.length) return parsed;
    }
  }

  // 2) Inline label fallback
  const inlineRe = /(?:Langues|Languages|Langue|Language)\s*[:\-—]\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9,\s\/\-\(\)·•]+)/i;
  const inlineMatch = normalized.match(inlineRe);
  if (inlineMatch && inlineMatch[1]) {
    const parsed = splitAndNormalizeLanguageList(inlineMatch[1]);
    if (parsed.length) return parsed;
  }

  // 3) Bullet list heuristic: find short list-like lines that appear near the top
  const top = lines.slice(0, 60).join("\n");
  const bullets = top.match(/(?:\n|^)[\-\*\•]\s*([A-Za-zÀ-ÖØ-öø-ÿ][\w\s,\-\/()]*)/g);
  if (bullets && bullets.length >= 2) {
    const items = bullets.map(b => b.replace(/^[\-\*\•]\s*/, "").trim());
    const filtered = items.filter(i => i.length <= 40 && i.split(" ").length <= 4);
    if (filtered.length >= 2) return Array.from(new Set(filtered));
  }

  return [];
}

function parseLanguageListFromBlock(block: string): string[] {
  if (!block) return [];
  // Split on commas, slashes, bullets, semicolons, or newlines
  const candidates = block.split(/[,\/;\n•\-\*]+/).map(s => s.trim()).filter(Boolean);
  return splitAndNormalizeLanguageList(candidates.join(", "));
}

function splitAndNormalizeLanguageList(s: string): string[] {
  const parts = s.split(/[,\/;]+/).map(p => p.trim()).filter(Boolean);
  // Remove very short tokens (1 char) and dedupe maintaining order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    // Strip parenthetical proficiency markers like "(native)" or "(bilingual)"
    const cleaned = p.replace(/\s*\((?:native|natif|fluent|courant|bilingue|intermédiaire|basic|débutant|A\d|B\d|C\d)\)/i, "").trim();
    if (!cleaned || cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Extract a contact block (phone/address) from free text.
 * Strategy:
 * - Phone detection via permissive phone regex (allows international formats).
 * - Address detection: look for "Address:" / "Adresse:" headers or lines containing street markers,
 *   postal code patterns, or common address keywords.
 * Returns the first sensible phone and an address string assembled from nearby lines.
 */
export function extractContactBlock(text: string): IContactBlock | undefined {
  if (!text) return undefined;
  const normalized = String(text);

  // 1) Phone extraction (first match)
  // Permissive phone regex: +33 6 12 34 56 78, (123) 456-7890, 01234 56789, etc.
  const phoneRe = /(\+?\d{1,3}[\s\-.\(]*\d{1,4}[\s\-.\)]*\d{1,4}[\s\-.\)]*\d{2,4}[\d\s\-().]*)/g;
  let phone: string | undefined = undefined;
  let m;
  while ((m = phoneRe.exec(normalized)) !== null) {
    const cand = m[1].trim();
    // filter out false positives (dates, long numeric sequences)
    const digits = cand.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      phone = cand;
      break;
    }
  }

  // 2) Address extraction heuristics
  // Try explicit header first
  const addressHeaderRe = /(?:Adresse|Address|Contact address|Street|Adresse\s*:)\s*([^\n]{5,200})/i;
  const addrMatch = normalized.match(addressHeaderRe);
  if (addrMatch && addrMatch[1]) {
    const addr = addrMatch[1].trim();
    return { phone, address: addr };
  }

  // Otherwise, scan lines for lines that look like addresses: contain street keywords or postal codes
  const addrLines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const addressCandidates: string[] = [];
  for (let i = 0; i < addrLines.length; i++) {
    const line = addrLines[i];
    // postal code patterns: FR: 5 digits, US: 5 digits or 5-4, etc.
    if (/\b\d{5}(?:-\d{4})?\b/.test(line) || /\b(?:street|st\.|avenue|ave|boulevard|blvd|road|rd|rue|place|pl|allee|allee)\b/i.test(line)) {
      // include this line and the next one (to capture city/state)
      const chunk = [line];
      if (i + 1 < addrLines.length) chunk.push(addrLines[i + 1]);
      addressCandidates.push(chunk.join(", "));
    }
    // also consider lines starting with "Adresse" or "Address" handled above
  }

  const address = addressCandidates.length ? addressCandidates[0] : undefined;
  if (!phone && !address) return undefined;
  return { phone, address };
}