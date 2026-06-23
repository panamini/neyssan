/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access, no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import type { ICVArrayItem, ICVObject } from "./cvMapper";
import { cleanToken, looksLikeEducationFragment } from "./mapping_utils";

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = cleanToken(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function ensureEducationArray(cv: ICVObject): ICVArrayItem[] {
  if (!Array.isArray(cv.education)) {
    cv.education = [];
  }
  return cv.education as ICVArrayItem[];
}

export function migrateLanguagesToEducation(cv: ICVObject): void {
  const languageTokensRaw = Array.isArray(cv.languagesRaw) ? cv.languagesRaw.slice() : [];
  const languageConfidence = cv.languages?.confidence ?? 0.55;
  const aggregatedTokens: string[] = [];

  for (const token of languageTokensRaw) {
    const cleaned = cleanToken(token);
    if (!cleaned) continue;
    aggregatedTokens.push(cleaned);
  }

  if (typeof cv.languages?.text === "string") {
    const exploded = cv.languages.text
      .split(/[,;\n•·\u2022\u2023\-]+/)
      .map((part) => cleanToken(part));
    for (const token of exploded) {
      if (!token) continue;
      aggregatedTokens.push(token);
    }
  }

  const structuredLanguages = Array.isArray((cv as any).languagesStructured)
    ? ((cv as any).languagesStructured as Array<{ content?: string }>)
    : null;
  if (structuredLanguages) {
    for (const entry of structuredLanguages) {
      const cleaned = cleanToken(entry?.content ?? "");
      if (!cleaned) continue;
      aggregatedTokens.push(cleaned);
    }
  }

  if (aggregatedTokens.length === 0) {
    return;
  }

  const tokens = dedupeCaseInsensitive(aggregatedTokens);
  const educationCandidates: string[] = [];
  const remainingLanguages: string[] = [];

  for (const token of tokens) {
    if (looksLikeEducationFragment(token)) {
      educationCandidates.push(token);
    } else {
      remainingLanguages.push(token);
    }
  }

  if (educationCandidates.length > 0) {
    const education = ensureEducationArray(cv);
    const existingKeys = new Set<string>(
      education
        .map((item) => (typeof item?.content === "string" ? cleanToken(item.content).toLowerCase() : ""))
        .filter(Boolean)
    );

    for (const candidate of educationCandidates) {
      const key = candidate.toLowerCase();
      if (existingKeys.has(key)) {
        continue;
      }
      education.push({
        content: candidate,
        confidence: languageConfidence,
      });
      existingKeys.add(key);
    }
  }

  const dedupedRemaining = dedupeCaseInsensitive(remainingLanguages);

  if (dedupedRemaining.length > 0) {
    cv.languagesRaw = dedupedRemaining;
    if (cv.languages) {
      cv.languages.text = dedupedRemaining.join(", ");
      cv.languages.confidence = cv.languages.confidence ?? languageConfidence;
    } else {
      cv.languages = { text: dedupedRemaining.join(", "), confidence: languageConfidence };
    }
    if (structuredLanguages) {
      (cv as any).languagesStructured = dedupedRemaining.map((token) => ({ content: token, confidence: languageConfidence }));
    }
  } else {
    cv.languagesRaw = null;
    cv.languages = null;
    if (structuredLanguages) {
      (cv as any).languagesStructured = [];
    }
  }

  if (!educationCandidates.length && structuredLanguages) {
    // Ensure structuredLanguages stays in sync if nothing moved
    (cv as any).languagesStructured = dedupedRemaining.map((token) => ({ content: token, confidence: languageConfidence }));
  }
}
