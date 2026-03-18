import nameBlacklistConfig from "../../../../shared/name_blacklist.json";

/**
 * Node-safe contact and identity heuristics.
 * Pure string processing (no DOM). All confidences clamped to [0, 1].
 */

type PenaltyTerm = {
  normalized: string;
  tokens: string[];
};

function stripDiacritics(value: string): string {
  try {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return value;
  }
}

function toPenaltyTerms(raw: unknown): PenaltyTerm[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Map<string, PenaltyTerm>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const normalized = stripDiacritics(trimmed.toLowerCase());
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const key = tokens.join("\u0001");
    if (!unique.has(key)) {
      unique.set(key, { normalized, tokens });
    }
  }
  return Array.from(unique.values());
}

const NAME_PENALTY_TERMS: PenaltyTerm[] = toPenaltyTerms(nameBlacklistConfig);

export interface ExtractResult {
  value: string | null;
  confidence: number | null;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function isTitleCaseWord(word: string): boolean {
  if (!word) return false;
  // Allow hyphenated last names: "Smith-Jones"
  const parts = word.split("-");
  return parts.every((p) => /^[A-Z][a-z]+$/.test(p));
}

function isPlausibleTitleCasePhrase(s: string, minWords = 2, maxWords = 6): boolean {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length < minWords || words.length > maxWords) return false;
  // Allow small connector words occasionally (e.g., "de", "van") but require most to be TitleCase
  let titleCount = 0;
  for (const w of words) {
    if (isTitleCaseWord(w)) titleCount += 1;
    else if (!/^(de|van|von|da|di|la|le|du)$/i.test(w)) return false;
  }
  return titleCount / words.length >= 0.6;
}

function isLikelyHeading(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (/^(profile|profil|summary|résumé|resume|objective|curriculum vitae|contact|coordonn)/i.test(normalized)) return true;
  if (/:\s*$/.test(text) && text.split(/\s+/).length <= 4) return true;
  return false;
}

function normalizeForEmailComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function adjustNameConfidence(params: {
  value: string;
  baseConfidence: number;
  lineIndex?: number;
  isNearEmail?: boolean;
  isHeading?: boolean;
  emailLocalPart?: string | null;
}): number {
  const { value, baseConfidence } = params;
  let conf = baseConfidence;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (params.lineIndex != null) {
    conf -= Math.min(params.lineIndex, 5) * 0.03;
  }

  if (params.isNearEmail) conf += 0.05;

  if (/\d/.test(trimmed)) conf -= 0.35;
  if (params.isHeading) conf -= 0.3;
  if (/\b(profile|summary|objective|resume|curriculum|cv)\b/i.test(trimmed)) conf -= 0.3;

  const normalizedCandidate = stripDiacritics(trimmed.toLowerCase());
  const candidateTokens = new Set<string>(normalizedCandidate.split(/[^a-z0-9]+/).filter(Boolean));
  const penaltyHit = NAME_PENALTY_TERMS.some((term) => {
    if (term.tokens.length === 1) {
      return candidateTokens.has(term.tokens[0]);
    }
    return term.tokens.every((token) => candidateTokens.has(token));
  });
  if (penaltyHit) conf -= 0.25;

  if (/page\s+\d+/i.test(trimmed)) conf -= 0.2;
  if (/[&@\/]/.test(trimmed)) conf -= 0.15;
  if (trimmed.length > 60) conf -= 0.2;

  if (params.emailLocalPart) {
    const local = normalizeForEmailComparison(params.emailLocalPart);
    const normalizedCandidate = normalizeForEmailComparison(trimmed);
    if (local && normalizedCandidate) {
      const localTokens = new Set(local.split(" "));
      const nameTokens = normalizedCandidate.split(" ");
      const overlap = nameTokens.filter((token) => localTokens.has(token)).length;
      if (overlap === nameTokens.length && nameTokens.length > 0) conf += 0.1;
      else if (overlap > 0) conf += 0.05;
    }
  }

  return clamp01(conf);
}

/**
 * Extract an email using a robust RFC-ish regex.
 * - Base score 0.9
 * - +0.05 if TLD has 2+ chars (common case)
 * - 0.85 if suspicious (double dots, trailing punctuation, etc.)
 */
export function extractEmail(text: string): ExtractResult {
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const matches = String(text || "").match(emailRegex) || [];
  if (!matches.length) return { value: null, confidence: null };

  // Choose the first match; future improvement: prefer ones near top.
  const first = matches[0]; 
  if (typeof first !== "string") return { value: null, confidence: null };
  const raw = first;

  const tldMatch = /\.([A-Za-z]{2,})$/.exec(raw.toLowerCase());
  const tldLen = tldMatch ? tldMatch[1].length : 0;

  // Suspicion signals
  const suspicious =
    /\.\./.test(raw) || // double dot
    /[.,;:!?]$/.test(raw) || // trailing punctuation
    /@[.-]|[.-]@/.test(raw); // odd separators near @

  let conf = 0.9;
  if (suspicious) conf = 0.85;
  else if (tldLen >= 2) conf = 0.95;

  return { value: raw, confidence: clamp01(conf) };
}

/**
 * Extract a phone number:
 * - Accept 10..16 digits overall (after stripping separators)
 * - Prefer the candidate with the most digits
 * - Base 0.9, +0.05 if starts with '+', -0.05 if too many separators
 */
export function extractPhone(text: string): ExtractResult {
  const s = String(text || "");
  const candidateRegex = /(?:\+?\d[\d\s().-]{8,}\d)/g;
  const rawCandidates = s.match(candidateRegex) || [];

  type Cand = { raw: string; digits: string; idx: number };
  const candidates: Cand[] = rawCandidates
    .map((c) => ({ raw: c.trim(), digits: c.replace(/\D/g, ""), idx: s.indexOf(c) }))
    .filter((c) => c.digits.length >= 10 && c.digits.length <= 16);

  if (candidates.length === 0) return { value: null, confidence: null };

  // Prefer longest digit sequence; tie-breaker: earliest occurrence in document
  candidates.sort((a, b) => {
    if (b.digits.length !== a.digits.length) return b.digits.length - a.digits.length;
    return a.idx - b.idx;
  });

  const best = candidates[0];
  const startsPlus = /^\s*\+/.test(best.raw);
  const sepCount = best.raw.replace(/[0-9+]/g, "").length; // non-digit separators
  const sepRatio = sepCount / Math.max(1, best.raw.length);

  let conf = 0.9;
  if (startsPlus) conf += 0.05;
  if (sepRatio > 0.3) conf -= 0.05;

  return { value: best.raw, confidence: clamp01(conf) };
}

/**
 * Extract a location:
 * - 0.8 for "City, Country" with both parts TitleCase
 * - 0.7 for "based in X"/"located in X" with TitleCase X
 * - 0.6 for first plausible TitleCase phrase
 */
const LOCATION_VERBY_RE = /\b(with|experience|attentive|guarding|presently|qualified|maintaining|responsible)\b/i;

function looksLikeLocationCandidate(value: string): boolean {
  const t = String(value || "").trim();
  if (!t) return false;
  const placeShape = /,|(\b[A-Z]{2}\b\s*\d{4,5})|\b(United\s*States|USA|UK|United\s*Kingdom|CA|Canada)\b/i.test(t);
  return placeShape && !LOCATION_VERBY_RE.test(t);
}

export function extractLocation(text: string): ExtractResult {
  const s = String(text || "");

  // 1) Look for multi-line address blocks (e.g., street + "City, ST ZIP" + Country)
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const combined = [lines[i], lines[i + 1] || "", lines[i + 2] || ""].join(" ").trim();
    // Match patterns like "Los Angeles, CA 90291" optionally followed by ", United States"
    const cityStateZip = /([A-Za-z][A-Za-z\s\.'-]+?),\s*([A-Z]{2})\s*(\d{5})(?:,\s*([A-Za-z\s]+))?/i.exec(combined);
    if (cityStateZip) {
      const city = cityStateZip[1].trim();
      const state = cityStateZip[2].trim();
      const zip = cityStateZip[3].trim();
      const country = cityStateZip[4] ? cityStateZip[4].trim() : undefined;
      const value = country ? `${city}, ${state} ${zip}, ${country}` : `${city}, ${state} ${zip}`;
      if (looksLikeLocationCandidate(value)) {
        return { value, confidence: 0.85 };
      }
    }
  }

  // 2) Inline "City, Country" with TitleCase
  const cityCountry = /([A-Z][a-zA-Z]+(?:[ -][A-Za-z]+)*)\s*,\s*([A-Z][a-zA-Z]+(?:[ -][A-Za-z]+)*)/;
  const m = cityCountry.exec(s);
  if (m) {
    const city = m[1].trim();
    const country = m[2].trim();
    if (isPlausibleTitleCasePhrase(city, 1, 5) && isPlausibleTitleCasePhrase(country, 1, 5)) {
      const value = `${city}, ${country}`;
      if (looksLikeLocationCandidate(value)) {
        return { value, confidence: 0.8 };
      }
    }
  }

  // 3) "based in X" or "located in X"
  const basedIn = /(based in|located in)\s+([A-Z][a-zA-Z]+(?:[ -][A-Za-z]+)*)/i.exec(s);
  if (basedIn) {
    const loc = basedIn[2].trim();
    if (isPlausibleTitleCasePhrase(loc, 1, 5) && looksLikeLocationCandidate(loc)) {
      return { value: loc, confidence: 0.7 };
    }
  }

  // 4) Fallback: first plausible TitleCase phrase line near the top
  for (const line of lines.slice(0, 15)) {
    const match = /^([A-Z][A-Za-z]+(?:[ -][A-Za-z]+){0,3})$/.exec(line);
    if (match) {
      const loc = match[1].trim();
      if (isPlausibleTitleCasePhrase(loc, 1, 4) && looksLikeLocationCandidate(loc)) {
        return { value: loc, confidence: 0.6 };
      }
    }
  }

  return { value: null, confidence: null };
}

/**
 * Extract a name:
 * - Prefer the line above the email (2..6 TitleCase words) at 0.85
 * - Else first short TitleCase line (2..6 words) at 0.75
 */
export function extractName(text: string, emailHint?: string | null): ExtractResult {
  const s = String(text || "");
  const lines = s.split(/\r?\n/).map((l) => l.trim());
  const email =
    emailHint && typeof emailHint === "string" && emailHint.trim().length > 3
      ? emailHint
      : (() => {
          const { value } = extractEmail(s);
          return value || null;
        })();

  const emailLocalPart = email ? email.split("@")[0] : null;
  let best: ExtractResult = { value: null, confidence: null };

  const considerCandidate = (candidate: string | null | undefined, baseConfidence: number, ctx: { lineIndex?: number; isNearEmail?: boolean }) => {
    const value = candidate?.trim();
    if (!value) return;
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    if (!(wordCount >= 2 && wordCount <= 6) && !/^[A-Z\s'-]+$/.test(value)) return;
    const confidence = adjustNameConfidence({
      value,
      baseConfidence,
      lineIndex: ctx.lineIndex,
      isNearEmail: ctx.isNearEmail,
      isHeading: isLikelyHeading(value),
      emailLocalPart,
    });
    if (confidence < 0.4) return;
    if (!best.value || (best.confidence ?? 0) < confidence) {
      best = { value, confidence };
    }
  };

  // 1) Topmost ALL-CAPS or TitleCase short line is often the person name in CVs.
  lines.slice(0, 6).forEach((line, idx) => {
    if (!line) return;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5) {
      const base = /^[A-Z\s'-]+$/.test(line) && /[A-Z]/.test(line) ? 0.92 : 0.8;
      considerCandidate(line, base, { lineIndex: idx });
    }
  });

  // 2) Prefer the line above the email if present (common layout)
  if (email) {
    const lineIdx = lines.findIndex((ln) => ln.includes(email));
    if (lineIdx > 0) {
      for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 3); i--) {
        const cand = (lines[i] || "").trim();
        if (!cand) continue;
        considerCandidate(cand, 0.85, { lineIndex: i, isNearEmail: true });
      }
    }
  }

  // 3) Fallback: first short TitleCase line in the top area
  lines.slice(0, 10).forEach((cand, idx) => {
    if (!cand) return;
    if (isPlausibleTitleCasePhrase(cand, 2, 6) || /^[A-Z\s'-]+$/.test(cand)) {
      considerCandidate(cand, 0.75, { lineIndex: idx });
    }
  });

  return best.value ? best : { value: null, confidence: null };
}
