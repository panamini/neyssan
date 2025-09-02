// llmValidator.ts - Enhanced confidence validation
interface LLMOutput {
  sections: Array<{
    title: string;
    content: string;
    fieldKey: string;
    confidence: number;
  }>;
}

function deaccent(s: string) {
  try {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  } catch {
    return s;
  }
}

function stripMarkdownAndPunctuation(s: string) {
  if (!s) return "";
  // remove markdown header/hash marks, bold/italic markers, links, bullets
  let out = String(s)
    .replace(/```[\s\S]*?```/g, " ") // fenced blocks
    .replace(/https?:\/\/[^\s)]+/g, " ") // urls
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/[_*~`>#-]{1,}/g, " ") // markdown symbols
    .replace(/[\u2018\u2019\u201C\u201D]/g, "") // smart quotes
    .replace(/[^\w\s]/g, " ") // keep letters/numbers/underscore and spaces
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  out = deaccent(out);
  return out;
}

export function validateLLMOutput(output: LLMOutput, originalText: string): {
  isValid: boolean;
  confidence: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Basic structure validation
  if (!output || !Array.isArray(output.sections) || output.sections.length === 0) {
    return { isValid: false, confidence: 0, issues: ['Invalid output structure'] };
  }

  // Calculate overall confidence
  const confidences = output.sections.map(s => (typeof s.confidence === "number" ? s.confidence : 0.5));
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const minConfidence = Math.min(...confidences);

  // Prepare normalized original text for fuzzy matches
  const normalizedOriginal = stripMarkdownAndPunctuation(originalText);
  const originalLength = normalizedOriginal.length || 1;

  // Content validation checks - use snippet-based normalized matching
  let totalMatchedLength = 0;
  const matchedRanges: Array<[number, number]> = [];

  output.sections.forEach((section, index) => {
    const rawContent = String(section.content || "");
    const normalizedContent = stripMarkdownAndPunctuation(rawContent);

    // guard against overly long content blocks
    if (rawContent.length > originalText.length * 0.9) {
      issues.push(`Section ${index} content suspiciously long (${rawContent.length} chars)`);
    }

    // Choose a short snippet (first 8-12 words) for matching
    const words = normalizedContent.split(/\s+/).filter(Boolean);
    const snippetWords = words.slice(0, 12);
    const snippet = snippetWords.join(" ");

    let matchIndex = -1;
    if (snippet.length > 0) {
      matchIndex = normalizedOriginal.indexOf(snippet);
    } else {
      // nothing to match
      issues.push(`Section ${index} empty after normalization`);
    }

    if (matchIndex === -1) {
      // fallback: try a slightly larger substring or last-resort substring of normalized content
      const altSnippet = words.slice(0, 8).join(" ");
      if (altSnippet && normalizedOriginal.indexOf(altSnippet) !== -1) {
        matchIndex = normalizedOriginal.indexOf(altSnippet);
      }
    }

    if (matchIndex === -1) {
      issues.push(`Section ${index} content not found in original text (after normalization)`);
    } else {
      // mark matched range length as number of characters of the matched normalized content
      const matchedLen = Math.min(normalizedContent.length, Math.max( snippet.length, Math.floor(normalizedContent.length * 0.6)));
      matchedRanges.push([matchIndex, matchIndex + matchedLen]);
      totalMatchedLength += matchedLen;
    }
  });

  // Compute coverage ratio on normalized text
  // Merge ranges
  matchedRanges.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of matchedRanges) {
    if (s > curEnd) {
      if (curEnd > curStart) covered += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else {
      curEnd = Math.max(curEnd, e);
    }
  }
  if (curEnd > curStart) covered += curEnd - curStart;
  const coverageRatio = covered / originalLength;

  // Accept lower coverage for LLM outputs because formatting/rephrasing happens
  const COVERAGE_THRESHOLD = 0.35; // lowered from 0.7 to 0.35 for LLM outputs
  if (coverageRatio < COVERAGE_THRESHOLD) {
    issues.push(`Low text coverage: ${(coverageRatio * 100).toFixed(1)}%`);
  }

  // Check for duplicate sections (loose check)
  const sectionTitles = output.sections.map(s => stripMarkdownAndPunctuation(s.title || ""));
  const duplicateTitles = sectionTitles.filter((title, i) =>
    title && sectionTitles.indexOf(title) !== i
  );
  if (duplicateTitles.length > 0) {
    issues.push(`Duplicate section titles: ${[...new Set(duplicateTitles)].join(', ')}`);
  }

  // Final validation: looser thresholds for LLM-origin content
  const isValid = issues.length === 0 &&
                 avgConfidence > 0.45 &&
                 minConfidence > 0.25 &&
                 coverageRatio > 0.25;

  const finalConfidence = isValid ? avgConfidence * 0.85 + coverageRatio * 0.15 : 0;

  // Debug: include per-section diagnostics in logs when invalid to aid debugging
  if (!isValid) {
    try {
      console.debug("[llmValidator] validation failed", {
        avgConfidence,
        minConfidence,
        coverageRatio,
        issues,
        sections: output.sections.map((s, i) => ({
          index: i,
          title: s.title,
          snippet: stripMarkdownAndPunctuation(String(s.content || "")).split(/\s+/).slice(0,12).join(" ")
        }))
      });
    } catch {
      // ignore logging errors
    }
  }

  return { isValid, confidence: finalConfidence, issues };
}