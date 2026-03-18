export function detectLanguageIsFrench(text: string): boolean {
  if (!text) return false;

  // 1) Fast-path: diacritics and ligatures common in French
  const frenchDiacritics = /[éèêëàâäôöûüçœæÿ]/i;
  if (frenchDiacritics.test(text)) return true;

  // 2) Strong markers
  const lower = text.toLowerCase();
  const strongMarkers = ["français", "francais", "monsieur", "madame", "m.", "mme", "né le", "né(e) le"];
  for (const m of strongMarkers) if (lower.includes(m)) return true;

  // 3) Weak markers: require at least two hits
  const weakMarkers = [
    "langues",
    "langue",
    "profil",
    "coordonnées",
    "expérience",
    "expériences",
    "formation",
    "compétences",
    "certificat",
    "présent",
    "adresse",
    "paris",
    "lyon",
    "marseille",
    "téléphone",
    "portable",
    "courriel",
    "cv"
  ];
  let weakHits = 0;
  for (const marker of weakMarkers) {
    if (lower.includes(marker)) weakHits++;
    if (weakHits >= 2) return true;
  }

  return false;
}

export function sanitizeProviderResponse(raw: string): string {
  if (!raw) return raw;

  // 1) If raw is valid JSON, try to extract typical nested payloads
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.response && typeof parsed.response === "object") return JSON.stringify(parsed.response);

      if (typeof parsed.output_text === "string" && parsed.output_text.trim()) {
        const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(parsed.output_text);
        if (fence && fence[1]) return fence[1].trim();
        return String(parsed.output_text);
      }

      if (typeof parsed.text === "string" && parsed.text.trim()) {
        const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(parsed.text);
        if (fence && fence[1]) return fence[1].trim();
        return String(parsed.text);
      }

      if (parsed.metadata && typeof parsed.metadata === "object") {
        const metaOut = (parsed.metadata as any).output_text;
        if (typeof metaOut === "string" && metaOut.trim()) {
          const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(metaOut);
          if (fence && fence[1]) return fence[1].trim();
          return String(metaOut);
        }
      }

      if (parsed.output && Array.isArray(parsed.output)) {
        for (const item of parsed.output) {
          if (!item || typeof item !== "object") continue;
          if ((item as any).json) return JSON.stringify((item as any).json);
          if (typeof (item as any).output_text === "string" && (item as any).output_text.trim()) {
            const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec((item as any).output_text);
            if (fence && fence[1]) return fence[1].trim();
            return String((item as any).output_text);
          }
          if (typeof (item as any).text === "string" && (item as any).text.trim()) {
            const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec((item as any).text);
            if (fence && fence[1]) return fence[1].trim();
            return String((item as any).text);
          }
        }
      }

      if ((parsed as any).full_response && Array.isArray((parsed as any).full_response.choices)) {
        const c = (parsed as any).full_response.choices[0];
        if (c?.message?.content) {
          const content = String(c.message.content);
          const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
          if (fence && fence[1]) return fence[1].trim();
          return content;
        }
      }

      if (Array.isArray((parsed as any).sections) || (parsed as any).profile || (parsed as any).experience || (parsed as any).skills) {
        return JSON.stringify(parsed);
      }
    }
  } catch {
    // not parseable as JSON -> fall through to text heuristics
  }

  // 2) Fenced JSON extraction
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();

  // 3) Unescape common escape sequences and retry fenced extraction / quick JSON parse
  try {
    const unescaped = String(raw)
      .replace(/\\r\\n/g, "\r\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

    const fenceUnesc = /```(?:json)?\s*([\s\S]*?)```/i.exec(unescaped);
    if (fenceUnesc && fenceUnesc[1]) return fenceUnesc[1].trim();

    const trimmed = unescaped.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      try {
        const inner = JSON.parse(trimmed);
        if (typeof inner === "string") {
          const innerFence = /```(?:json)?\s*([\s\S]*?)```/i.exec(inner);
          if (innerFence && innerFence[1]) return innerFence[1].trim();
          return inner;
        }
        if (typeof inner === "object") return JSON.stringify(inner);
      } catch {}
    }
  } catch {}

  // 4) Keyword-anchored brace scan
  const kwRegex = /"sections"|"profile"|"experience"|"skills"|"contact"/i;
  const keywordIdx = raw.search(kwRegex);
  if (keywordIdx !== -1) {
    const searchStart = Math.max(0, keywordIdx - 1024);
    const braceIdx = raw.indexOf("{", searchStart);
    if (braceIdx >= 0) {
      let depth = 0;
      for (let i = braceIdx; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = raw.slice(braceIdx, i + 1);
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              break;
            }
          }
        }
      }
    }
  }

  // 5) Last-resort: return substring from first '{' if any
  const firstBrace = raw.indexOf("{");
  if (firstBrace > 0) return raw.slice(firstBrace);

  // Nothing matched: return original raw so repairJSON/caller can attempt further work
  return raw;
}