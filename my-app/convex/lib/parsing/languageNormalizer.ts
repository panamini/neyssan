// my-app/convex/lib/parsing/languageNormalizer.ts
/**
 * Lightweight language normalizer.
 *
 * Responsibilities:
 * - Split a freeform language string (commas, newlines, slashes, semicolons) into tokens.
 * - Map common variants / localized names to canonical English names.
 * - Deduplicate and return a stable list in order of appearance.
 *
 * This is intentionally small and dependency-free so it can run in Node/Browser
 * without optional packages. It focuses on UX-friendly canonical names rather
 * than strict ISO codes; later we can add ISO mapping if needed.
 */
// pipeline-note: canonicalize.ts and cvMapper.ts rely on this module for every
// language decision (token splitting, canonical mapping, CEFR-level alignment).
// Keep normalization rules here rather than in downstream orchestrators.

import { embedText, cosineSimilarity, type EmbeddingVector } from "../embeddings/embedClient";
import languageNames from "../../../../shared/language_names.json";

const STATIC_NORMALIZATION_MAP: Record<string, string> = {
  // English
  english: "English",
  en: "English",

  // French
  french: "French",
  français: "French",
  francais: "French",
  fr: "French",

  // Spanish
  spanish: "Spanish",
  español: "Spanish",
  espanol: "Spanish",
  es: "Spanish",

  // German
  german: "German",
  deutsch: "German",
  de: "German",

  // Italian
  italian: "Italian",
  italiano: "Italian",
  it: "Italian",

  // Portuguese
  portuguese: "Portuguese",
  português: "Portuguese",
  portugues: "Portuguese",
  pt: "Portuguese",

  // Chinese
  chinese: "Chinese",
  mandarin: "Chinese",
  zh: "Chinese",

  // Japanese
  japanese: "Japanese",
  ja: "Japanese",

  // Korean
  korean: "Korean",
  ko: "Korean",

  // Russian
  russian: "Russian",
  ru: "Russian",

  // Arabic
  arabic: "Arabic",
  ar: "Arabic",

  // Hindi
  hindi: "Hindi",
  hi: "Hindi",
};

// Merge shared JSON synonyms (if present) into the normalization map.
function buildNormalizationMap(): Record<string, string> {
  const map: Record<string, string> = { ...STATIC_NORMALIZATION_MAP };
  try {
    const cfg: Record<string, string[]> = (languageNames as any) || {};
    for (const [canonical, aliases] of Object.entries(cfg)) {
      for (const alias of aliases) {
        const key = String(alias || "").trim().toLowerCase();
        if (!key) continue;
        if (!map[key]) map[key] = canonical;
      }
      const selfKey = String(canonical || "").trim().toLowerCase();
      if (selfKey && !map[selfKey]) map[selfKey] = canonical;
    }
  } catch {
    // Ignore JSON issues
  }
  return map;
}

export const NORMALIZATION_MAP: Record<string, string> = buildNormalizationMap();

export const CANONICAL_LANGUAGES = new Set(Object.values(NORMALIZATION_MAP));

const LANGUAGE_THRESHOLD = 0.75;
const LANGUAGE_ANCHORS = Array.from(new Set(Object.values(NORMALIZATION_MAP)));
let languageAnchorEmbeddingsPromise: Promise<EmbeddingVector[]> | null = null;

async function ensureLanguageAnchorEmbeddings(): Promise<EmbeddingVector[]> {
  if (LANGUAGE_ANCHORS.length === 0) return [];
  if (!languageAnchorEmbeddingsPromise) {
    languageAnchorEmbeddingsPromise = embedText(LANGUAGE_ANCHORS).catch((err) => {
      languageAnchorEmbeddingsPromise = null;
      throw err;
    });
  }
  return languageAnchorEmbeddingsPromise;
}

async function computeLanguageKeepMask(candidates: string[]): Promise<boolean[]> {
  if (!candidates.length) return [];
  if (LANGUAGE_ANCHORS.length === 0) return candidates.map(() => true);
  try {
    const [candidateVectors, anchorVectors] = await Promise.all([
      embedText(candidates),
      ensureLanguageAnchorEmbeddings(),
    ]);
    const anchorCount = Math.min(anchorVectors.length, LANGUAGE_ANCHORS.length);
    if (!anchorCount) return candidates.map(() => true);

    return candidates.map((_candidate, idx) => {
      const candidateVec = candidateVectors[idx];
      if (!candidateVec) return true;
      let best = -1;
      for (let i = 0; i < anchorCount; i++) {
        const anchorVec = anchorVectors[i];
        if (!anchorVec) continue;
        const score = cosineSimilarity(candidateVec, anchorVec);
        if (score > best) {
          best = score;
          if (best >= LANGUAGE_THRESHOLD) break;
        }
      }
      return best >= LANGUAGE_THRESHOLD;
    });
  } catch {
    return candidates.map(() => true);
  }
}

export function normalizeLanguageTokenSync(token: string): string | null {
  if (!token) return null;
  const cleaned = token
    .toLowerCase()
    .replace(/[().\u2019'"]/g, "")
    .trim();
  if (!cleaned) return null;
  if (NORMALIZATION_MAP[cleaned]) return NORMALIZATION_MAP[cleaned];
  // Try to match by prefix (e.g., 'engl' -> English)
  for (const key of Object.keys(NORMALIZATION_MAP)) {
    if (cleaned.startsWith(key)) return NORMALIZATION_MAP[key];
  }
  // Fallback: capitalize first letter (best-effort)
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeToken(token: string): string | null {
  return normalizeLanguageTokenSync(token);
}

/**
 * Parse a freeform languages string into a deduplicated, canonicalized list.
 * Accepts inputs like:
 *  - "English, Français, Español"
 *  - "Deutsch\nItaliano"
 *  - "English / Spanish; French"
 */
export async function normalizeLanguagesFromTextDetailed(text: string | null | undefined): Promise<{ normalized: string[]; raw: string[] }> {
  if (!text) return { normalized: [], raw: [] };
  // Split on commas, slashes, semicolons, newlines, and pipes
  const rawTokens = text.split(/[,\/;|\n]+/g).map((t) => t.trim()).filter(Boolean);
  const normalizedResult: string[] = [];
  const rawResult: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    const parts = tok.split(/\s+or\s+|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const normalized = normalizeToken(part);
      if (!normalized) continue;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        normalizedResult.push(normalized);
        rawResult.push(part);
      }
    }
  }
  if (!normalizedResult.length) return { normalized: [], raw: [] };

  const keepMask = await computeLanguageKeepMask(normalizedResult); // NEW: embedding reranker.
  if (!keepMask.length || keepMask.length !== normalizedResult.length) {
    return { normalized: normalizedResult, raw: rawResult };
  }

  const filteredNormalized: string[] = [];
  const filteredRaw: string[] = [];
  keepMask.forEach((keep, idx) => {
    if (keep) {
      filteredNormalized.push(normalizedResult[idx]);
      filteredRaw.push(rawResult[idx]);
    }
  });

  return { normalized: filteredNormalized, raw: filteredRaw };
}

export async function normalizeLanguagesFromText(text: string | null | undefined): Promise<string[]> {
  const detailed = await normalizeLanguagesFromTextDetailed(text);
  return detailed.normalized;
}

export function normalizeLanguagesFromTextSync(text: string | null | undefined): { normalized: string[]; raw: string[] } {
  if (!text) return { normalized: [], raw: [] };
  const rawTokens = text.split(/[,\/;|\n]+/g).map((t) => t.trim()).filter(Boolean);
  const normalized: string[] = [];
  const raw: string[] = [];
  const seen = new Set<string>();
  for (const token of rawTokens) {
    const parts = token.split(/\s+or\s+|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const mapped = normalizeLanguageTokenSync(part);
      if (!mapped) continue;
      if (!seen.has(mapped)) {
        seen.add(mapped);
        normalized.push(mapped);
        raw.push(part);
      }
    }
  }
  return { normalized, raw };
}

/**
 * Helper: join normalized languages to a readable string for UI consumption.
 */
export function joinNormalizedLanguages(langs: string[]): string {
  return langs.join(", ");
}

export default {
  normalizeLanguagesFromText,
  joinNormalizedLanguages,
  normalizeLanguagesFromTextSync,
};
