import { FIELD_KEY_MAP } from "./enhancedParser";
import {
  mapCanonicalFamilyToParserFieldKey,
  resolveCanonicalHeadingFamily,
} from "./headingResolver";

/**
 * llmPostProcessor.ts
 *
 * Convert human-readable LLM responses (markdown, mixed prose, or pretty-printed text)
 * into the strict JSON shapes expected by the validator and downstream code.
 *
 * Strategy:
 * 1. Try to JSON.parse the whole response.
 * 2. If that fails, try to extract a ```json ... ``` or fenced block containing JSON.
 * 3. If still failing, run a robust markdown-to-sections heuristic:
 *    - Split by markdown headers (hashes)
 *    - Fall back to bold-only headings (lines like "**PROFILE**")
 *    - Fall back to all-caps short lines
 *    - Map header text to canonical fieldKey values
 * 4. Return a normalized object:
 *    { sections: [{ title, content, fieldKey, confidence }] }
 *
 * Also provide a lightweight metadata parser that extracts name/email/phone/linkedinUrl
 * from human-readable LLM outputs (or from the same markdown).
 */
// pipeline-note: This is the sole place where raw LLM prose is normalized into
// {sections, metadata}. cvMapper.ts and canonicalize.ts assume outputs here are
// already bucketed; keep header-mapping tweaks inside this layer.

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function extractJsonFence(text: string): string | null {
  // Primary: look for ```json ... ``` or ``` ... ``` blocks anywhere in the text
  const jsonFenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (jsonFenceMatch && jsonFenceMatch[1]) return jsonFenceMatch[1].trim();

  // Secondary: try to find a top-level {...} object across the text (best-effort)
  const braceIndex = text.indexOf("{");
  if (braceIndex >= 0) {
    // attempt to find a matching closing brace by scanning
    let depth = 0;
    for (let i = braceIndex; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return text.slice(braceIndex, i + 1);
        }
      }
    }
  }

  // Tertiary: some providers return escaped JSON blocks (e.g. as a string with \\n and escaped quotes).
  // Try a lightweight unescape and re-run the fenced-json detection and top-level object scan.
  try {
    const unescaped = String(text)
      .replace(/\\r\\n/g, "\r\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    const jsonFenceUnesc = /```(?:json)?\s*([\s\S]*?)```/i.exec(unescaped);
    if (jsonFenceUnesc && jsonFenceUnesc[1]) return jsonFenceUnesc[1].trim();

    const braceIndexUnesc = unescaped.indexOf("{");
    if (braceIndexUnesc >= 0) {
      let depth = 0;
      for (let i = braceIndexUnesc; i < unescaped.length; i++) {
        const ch = unescaped[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            return unescaped.slice(braceIndexUnesc, i + 1);
          }
        }
      }
    }

    // If response is a quoted JSON string (e.g. "\"{...}\""), try to JSON.parse it and recurse.
    const trimmed = String(text).trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      try {
        const parsedInner = JSON.parse(trimmed);
        if (typeof parsedInner === "string") {
          const recursive = extractJsonFence(parsedInner);
          if (recursive) return recursive;
        }
      } catch {
        // ignore parse errors
      }
    }
  } catch {
    // ignore any unexpected errors during unescape attempts
  }

  return null;
}

function deaccent(s: string) {
  try {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  } catch {
    return s;
  }
}

/**
 * Escape a string for use in a regex
 */
function escapeForRegex(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NORMALIZED_FIELD_MAP: Record<string, Set<string>> = Object.entries(FIELD_KEY_MAP).reduce(
  (acc, [fieldKey, terms]) => {
    const set = new Set<string>();
    for (const term of terms) {
      const normalized = deaccent(term.toLowerCase())
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (normalized) set.add(normalized);
    }
    acc[fieldKey] = set;
    return acc;
  },
  {} as Record<string, Set<string>>
);

function matchKnownHeading(cleaned: string): string | null {
  for (const [fieldKey, terms] of Object.entries(NORMALIZED_FIELD_MAP)) {
    for (const term of terms) {
      if (!term) continue;
      if (cleaned === term) return fieldKey;
      if (cleaned.startsWith(`${term} `)) return fieldKey;
      if (cleaned.endsWith(` ${term}`)) return fieldKey;
      if (cleaned.includes(` ${term} `)) return fieldKey;
      if (term.length >= 4 && cleaned.includes(term)) return fieldKey;
    }
  }
  return null;
}

function mapHeaderToField(headerRaw: string): string {
  const cleaned = deaccent(String(headerRaw || ""))
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "introduction";
  const canonicalFamily = resolveCanonicalHeadingFamily(cleaned);
  if (canonicalFamily) {
    return mapCanonicalFamilyToParserFieldKey(canonicalFamily);
  }
  const matched = matchKnownHeading(cleaned);
  if (matched) return matched;

  const contactTokens = [
    "contact",
    "coordonne",
    "coordonnees",
    "adresse",
    "address",
    "email",
    "mail",
    "phone",
    "telephone",
    "téléphone",
    "linkedin",
    "links",
    "link",
  ];
  if (contactTokens.some((token) => cleaned.includes(token))) return "contact";

  if (/\b(project|projet|projets)\b/.test(cleaned)) return "projects";
  if (/\b(certification|certifications|certificate|certificates|license|licenses|licence|licences)\b/.test(cleaned)) {
    return "certifications";
  }
  if (/\b(hobbies|hobby|interests|interest)\b/.test(cleaned)) return "hobbies";
  if (/\b(affiliation|affiliations|membership|memberships|association|associations)\b/.test(cleaned)) {
    return "affiliations";
  }
  if (/\b(additional information|additional info|other information|supplementary information)\b/.test(cleaned)) {
    return "additional_information";
  }
  if (/\b(research|recherche)\b/.test(cleaned)) return "research";
  if (/\b(volunteer|benevolat|bénévolat|volontariat|voluntariado)\b/.test(cleaned)) return "volunteer";
  if (/\b(reference|référence|références|referencia|referencias|referenzen)\b/.test(cleaned)) return "references";
  if (/\b(other|divers|otros|weitere)\b/.test(cleaned)) return "other";

  // Fallback conservative default
  return "introduction";
}

/**
 * Infer a likely fieldKey from section title + content.
 * Extracted to top-level so multiple splitting strategies can share the same heuristics.
 */
function inferFieldFromContent(title: string, content: string, initial: string) {
  const lc = String(content || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  // Contact detection: emails, phone numbers, "coordonn"
  if (/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(content)
    || /\+?\d{2,3}[\s.\-]?\d{1,4}/.test(content)
    || t.includes("coordonn")) return "contact";
  // Experience detection: year ranges, "présent"/"present", role keywords
  if (/\b(19|20)\d{2}\b/.test(content)
    || /\bprésent\b/i.test(lc)
    || /\bpresent\b/i.test(lc)
    || /\b(ans|année|years)\b/i.test(lc)
    || /\b(agent|directeur|ingénieur|responsable|manager|chef|lead|consultant)\b/i.test(lc)) return "experience";
  // Education detection: university/school tokens, "licence", "master", "diplôm"
  if (/\b(universit|école|school|licence|master|mba|diplôm|bachelor)\b/i.test(content) || t.includes("formation")) return "education";
  // Skills detection: short comma-separated lists, bullet lists with short tokens, or "compétences" token
  if (t.includes("compét") || t.includes("skill") || (content.split(/\r?\n/).length <= 8 && content.split(/[,;\n•·\u2022-]+/).length >= 2 && content.length < 500)) return "skills";
  // Languages detection
  if (t.includes("lang") || /\b(francais|français|anglais|english|espagnol|italien|german|allemand)\b/i.test(lc)) return "languages";
  // Projects / research / volunteer heuristics
  if (t.includes("projet") || t.includes("project")) return "projects";
  if (t.includes("recherche") || t.includes("research")) return "research";
  return initial;
}

function splitByMarkdownHeaders(text: string) {
  // Find lines that start with 1-4 hashes
  const regex = /^\s*(#{1,4})\s*(.+?)\s*$/gm;
  const matches: { index: number; header: string }[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ index: m.index, header: m[2].trim() });
  }
  if (matches.length) {
    const sections: { title: string; content: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const headerLine = text.slice(start, end).split(/\r?\n/)[0] || matches[i].header;
      const headerText = headerLine.replace(/^\s*#{1,4}\s*/g, "").trim() || matches[i].header;
      const body = text.slice(start, end).split(/\r?\n/).slice(1).join("\n").trim();
      sections.push({ title: headerText, content: body });
    }
    return sections;
  }
  return null;
}

function splitByBoldHeadings(text: string) {
  // Lines that are just bold or italic headings like "**PROFILE**", "__SKILLS__"
  const lines = text.split(/\r?\n/);
  const candidates: { index: number; header: string }[] = [];
  const headerKeywordHints = [
    "experience","expérience","expériences","profil","profile","résumé","resume","compét","competence",
    "formation","education","compétences","skills","langues","languages","coordonn","contact","projet","projects"
  ];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] || "";
    const line = rawLine.trim();
    const boldMatch = line.match(/^([*_]{1,3})([^*_][\s\S]*?[^*_])\1$/);
    if (boldMatch) {
      const header = boldMatch[2].trim();
      candidates.push({ index: i, header });
      continue;
    }

    // Detect lines that are likely headings even when they contain accents (e.g., "COORDONNÉES", "PROFIL")
    // We de-accent the line first so accented uppercase characters are matched.
    const deLine = deaccent(line);
    if (!deLine) continue;
    const wordCount = deLine.split(/\s+/).filter(Boolean).length;
    const isAllCapsLike = /^[A-ZÀ-ÖØ-Þ\s.,'-_&()0-9]{3,80}$/.test(deLine);

    // Also detect Title Case headings like "Principales compétences" (start with upper-case letter and contain letters/spaces).
    const isTitleCase = /^\p{Lu}[\p{L}'’\s-]+$/u.test(line) && !line.includes('www');

    // Accept all-caps-like or Title Case lines as headers when they are reasonably short (<=5 words)
    // or contain a strong hint. This is more lenient and catches common CV heading styles.
    const lower = deLine.toLowerCase();
    const containsHint = headerKeywordHints.some(h => lower.includes(h));
    const acceptAsHeader = (isAllCapsLike || isTitleCase) && (wordCount <= 5 || containsHint);

    if (line && acceptAsHeader) {
      // Preserve the original rawLine (with accents) as the header title
      candidates.push({ index: i, header: rawLine.trim() });
    }
  }

  if (candidates.length) {
    const sections: { title: string; content: string }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const startLine = candidates[i].index;
      const endLine = i + 1 < candidates.length ? candidates[i + 1].index : lines.length;
      const bodyLines = lines.slice(startLine + 1, endLine);
      sections.push({ title: candidates[i].header, content: bodyLines.join("\n").trim() });
    }
    return sections;
  }
  return null;
}

export function parseLLMSections(text: string): { sections: { title: string; content: string; fieldKey: string; confidence: number }[] } {
  // Defensive sanitizer: handle provider wrapper objects that contain the real payload nested inside.
  function extractFromProviderWrapper(raw: string): string {
    if (!raw) return raw;
    try {
      const parsed = safeJsonParse<any>(raw);
      if (parsed && typeof parsed === "object") {
        // Prefer explicit nested 'response' object
        if (parsed.response && typeof parsed.response === "object") return JSON.stringify(parsed.response);
        // Common scalar fields that may contain the useful payload
        if (typeof parsed.output_text === "string" && parsed.output_text.trim()) return parsed.output_text;
        if (typeof parsed.text === "string" && parsed.text.trim()) return parsed.text;
        // Chat-like shape: choices[0].message.content
        if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices[0]?.message?.content) return String(parsed.choices[0].message.content);
        if (parsed.full_response && Array.isArray(parsed.full_response.choices) && parsed.full_response.choices[0]?.message?.content) return String(parsed.full_response.choices[0].message.content);
        // 'output' array shapes
        if (parsed.output && Array.isArray(parsed.output)) {
          for (const item of parsed.output) {
            if (!item || typeof item !== "object") continue;
            if (item.json) return JSON.stringify(item.json);
            if (typeof item.output_text === "string" && item.output_text.trim()) return item.output_text;
            if (typeof item.text === "string" && item.text.trim()) return item.text;
            if (Array.isArray(item.content) && item.content.length) {
              for (const c of item.content) {
                if (typeof c === "string") return c;
                if (c && typeof c === "object" && typeof (c).text === "string") return (c).text;
              }
            }
          }
        }
        // If parsed already resembles the canonical shape, return it stringified
        if (Array.isArray((parsed).sections) || parsed.profile || parsed.experience || parsed.skills || parsed.contact) return JSON.stringify(parsed);
      }
    } catch {
      // Not a JSON wrapper - ignore
    }
    return raw;
  }

  // Try one round of defensive extraction (handles full provider response string input)
  const sanitizedOnce = extractFromProviderWrapper(text);
  if (sanitizedOnce && sanitizedOnce !== text) text = sanitizedOnce;

  // 1) Try direct JSON parse (allow sections nested under common wrapper keys)
  const direct = safeJsonParse<any>(text);
  let directSections: any[] | null = null;
  if (direct && typeof direct === "object") {
    if (Array.isArray(direct.sections)) directSections = direct.sections;
    // common provider wrapper: { response: { sections: [...] } }
    else if (direct.response && Array.isArray(direct.response.sections)) directSections = direct.response.sections;
    // other common wrapper shapes
    else if (direct.data && Array.isArray(direct.data.sections)) directSections = direct.data.sections;
    else if (direct.result && Array.isArray(direct.result.sections)) directSections = direct.result.sections;
  }
  if (directSections && Array.isArray(directSections)) {
    // ensure normalized shape
    const secs = directSections.map((s: any) => ({
      title: String(s.title || "Section"),
      content: String(s.content || ""),
      fieldKey: String(s.fieldKey || mapHeaderToField(s.title || "")),
      confidence: typeof s.confidence === "number" ? Math.max(0, Math.min(1, s.confidence)) : 0.85,
    }));
    return { sections: secs };
  }

  // 2) Try fenced JSON extraction
  const jsonFence = extractJsonFence(text);
  if (jsonFence) {
    const parsedFence = safeJsonParse<any>(jsonFence);
    // If vendor/LLM returned the canonical "sections" array anywhere inside the parsed fence, use it.
    const fenceSectionsCandidate =
      parsedFence && Array.isArray(parsedFence.sections) ? parsedFence.sections
      : parsedFence && parsedFence.response && Array.isArray(parsedFence.response.sections) ? parsedFence.response.sections
      : parsedFence && parsedFence.data && Array.isArray(parsedFence.data.sections) ? parsedFence.data.sections
      : null;
    if (fenceSectionsCandidate && Array.isArray(fenceSectionsCandidate)) {
      const secs = fenceSectionsCandidate.map((s: any) => ({
        title: String(s.title || "Section"),
        content: String(s.content || ""),
        fieldKey: String(s.fieldKey || mapHeaderToField(s.title || "")),
        confidence: typeof s.confidence === "number" ? Math.max(0, Math.min(1, s.confidence)) : 0.85,
      }));
      return { sections: secs };
    }
    // Some LLMs return alternate JSON shapes (e.g., { profile, experience, skills, contact }).
    // Accept those and convert them into our canonical sections shape.
    if (parsedFence && typeof parsedFence === "object") {
      const altSections: { title: string; content: string }[] = [];
      // profile / summary
      if (parsedFence.profile || parsedFence.summary || parsedFence.introduction) {
        const p = String(parsedFence.profile ?? parsedFence.summary ?? parsedFence.introduction ?? "");
        if (p.trim()) altSections.push({ title: "Introduction", content: p.trim() });
      }
      // experience array -> stringify entries
      if (Array.isArray(parsedFence.experience) && parsedFence.experience.length) {
        const body = parsedFence.experience
          .map((e: any) => {
            const lines: string[] = [];
            if (e.position || e.title) lines.push(String(e.position ?? e.title));
            if (e.company) lines.push(String(e.company));
            if (e.duration || e.start || e.end) lines.push(String(e.duration ?? `${e.start ?? ""} - ${e.end ?? ""}`).trim());
            if (e.responsibilities && Array.isArray(e.responsibilities)) lines.push((e.responsibilities as string[]).join("\n"));
            return lines.filter(Boolean).join("\n");
          })
          .join("\n\n");
        if (body.trim()) altSections.push({ title: "Experience", content: body.trim() });
      }
      // skills array
      if (Array.isArray(parsedFence.skills) && parsedFence.skills.length) {
        const skills = (parsedFence.skills as any[]).map(String).join(", ");
        altSections.push({ title: "Skills", content: skills });
      } else if (typeof parsedFence.skills === "string" && parsedFence.skills.trim()) {
        altSections.push({ title: "Skills", content: String(parsedFence.skills).trim() });
      }
      // education
      if (Array.isArray(parsedFence.education) && parsedFence.education.length) {
        const eduBody = (parsedFence.education as any[])
          .map((e: any) => {
            const school = e.school ?? e.institution ?? "";
            const degree = e.degree ?? e.program ?? "";
            return [school, degree].filter(Boolean).join(" - ");
          })
          .join("\n");
        if (eduBody.trim()) altSections.push({ title: "Education", content: eduBody.trim() });
      }
      // contact / contact object
      if (parsedFence.contact || parsedFence.contact_info || parsedFence.contactInfo) {
        const c = parsedFence.contact ?? parsedFence.contact_info ?? parsedFence.contactInfo;
        let contactText = "";
        if (typeof c === "string") contactText = c;
        else if (typeof c === "object") {
          const parts: string[] = [];
          if (c.email) parts.push(String(c.email));
          if (c.phone) parts.push(String(c.phone));
          if (c.linkedin) parts.push(String(c.linkedin));
          contactText = parts.join("\n");
        }
        if (contactText.trim()) altSections.push({ title: "Contact", content: contactText.trim() });
      }
      // fallback: if parsedFence contains arbitrary keys that look like short headings, convert them
      if (altSections.length === 0) {
        const candidateKeys = ["profile", "summary", "experience", "skills", "education", "contact"];
        for (const k of Object.keys(parsedFence)) {
          if (candidateKeys.includes(k)) continue;
          const val = parsedFence[k];
          if (typeof val === "string" && val.trim().length > 0 && val.trim().length < 2000) {
            altSections.push({ title: String(k), content: String(val).trim() });
          }
        }
      }
      if (altSections.length) {
        return {
          sections: altSections.map(s => ({
            title: s.title,
            content: s.content || "",
            fieldKey: mapHeaderToField(s.title),
            confidence: 0.85
          }))
        };
      }
    }
  }

  // 3) Markdown header splitting
  const md = splitByMarkdownHeaders(text);
  if (md) {
    return {
      sections: md.map(s => ({
        title: s.title,
        content: s.content || "",
        fieldKey: mapHeaderToField(s.title),
        confidence: 0.85
      }))
    };
  }

  // 4) Bold headings / all-caps lines
  const bold = splitByBoldHeadings(text);
  if (bold) {
    // Post-process bold/all-caps splits with the same content-based inference used by simpleHeaderScan.
    const post = bold.map(s => {
      const initial = mapHeaderToField(s.title);
      const inferred = inferFieldFromContent(s.title, s.content || "", initial);
      return {
        title: s.title,
        content: s.content || "",
        fieldKey: inferred,
        confidence: 0.8
      };
    });
    return { sections: post };
  }

  // 5) Heuristic header scan: detect common short header lines and split text accordingly.
  function simpleHeaderScan(fullText: string) {
    const lines = fullText.split(/\r?\n/).map(l => l.replace(/\t/g, " ").trim());
    const headerCandidates = [
      "summary", "profile", "profil", "résumé", "a propos", "about", "objective",
      "experience", "expérience", "expériences", "employment", "work", "parcours", "parcours professionnel",
      "projects", "projets", "education", "formation", "études", "studies",
      "skills", "compétences", "competence", "principales competences",
      "achievements", "réalisations", "publications", "awards", "certifications",
      "languages", "langues", "langue",
      "coordonnées", "coordonnees", "coordonne", "contact", "links", "linkedin", "phone", "email"
    ];
    const sections: { title: string; content: string[] }[] = [];
    let current: { title: string; content: string[] } | null = null;

    const isProbablyHeader = (line: string) => {
      if (!line) return false;
      const normalized = deaccent(line).toLowerCase();
      if (normalized.length > 140) return false;
      // explicit colon often indicates header "Experience:" / "Expérience :"
      if (line.trim().endsWith(":")) return true;
      for (const cand of headerCandidates) {
        // De-accent candidate keywords to match the de-accented input line (fixes accent mismatch)
        const normalizedCand = deaccent(cand).toLowerCase();
        if (normalized === normalizedCand || normalized.includes(normalizedCand)) return true;
      }
      // short all-caps or title-case lines (<=3 words) are likely headers.
      // Reduce false positives (e.g., organization names) by tightening the word limit.
      if (/^[\p{Lu}\s0-9_-]{2,80}$/u.test(deaccent(line)) && line.split(/\s+/).length <= 3) return true;
      return false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isProbablyHeader(line)) {
        if (current) sections.push(current);
        current = { title: line.trim(), content: [] };
      } else {
        if (!current) current = { title: "Introduction", content: [line] };
        else current.content.push(line);
      }
    }
    if (current) sections.push(current);

    // normalize sections
    return sections.map(s => ({ title: s.title || "Section", content: s.content.join("\n").trim() })).filter(s => s.title || s.content);
  }

  const heur = simpleHeaderScan(text);
  if (heur && heur.length > 0) {
    // Post-process inferred field keys from content to catch cases where the LLM/plain text
    // produced organization names as headers. We attempt to detect experience/education/skills/contact
    // by inspecting the section body (dates, role titles, school names, emails, phone numbers).
    // Use the top-level inferFieldFromContent helper to avoid duplicated heuristics.

    const post = heur.map(s => {
      const initial = mapHeaderToField(s.title);
      const inferred = inferFieldFromContent(s.title, s.content, initial);
      return {
        title: s.title,
        content: s.content || "",
        fieldKey: inferred,
        confidence: 0.75
      };
    });

    return { sections: post };
  }

  // 6) As a last resort, return the whole document as an "introduction" section
  return {
    sections: [
      {
        title: "Introduction",
        content: text.trim(),
        fieldKey: "introduction",
        confidence: 0.5
      }
    ]
  };
}

/* ---------------------------
   Fuzzy span recovery
   --------------------------- */

/**
 * Normalize a string for matching: strip markdown, punctuation, de-accent, collapse whitespace, lowercase.
 */
function normalizeForMatch(s: string) {
  return deaccent(
    String(s || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/https?:\/\/[^\s)]+/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[_*~`>#-]{1,}/g, " ")
      .replace(/[\u2018\u2019\u201C\u201D]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

/**
 * Try to find a short snippet (first N words) from sectionNormalized inside originalNormalized.
 * Returns the character index in originalNormalized or -1 if not found.
 */
function findSnippetIndexInNormalized(snippet: string, originalNormalized: string): number {
  if (!snippet) return -1;
  return originalNormalized.indexOf(snippet);
}

/**
 * Given the normalized match index, convert it back to a best-effort span in the raw original text.
 * We attempt to find the same substring (loose) in the raw original text by matching words.
 */
function mapNormalizedIndexToRawSpan(originalRaw: string, originalNormalized: string, matchIndex: number, normalizedMatchLen: number) {
  if (matchIndex < 0) return null;
  // Find the normalized matched substring
  const matchedNorm = originalNormalized.slice(matchIndex, matchIndex + normalizedMatchLen).trim();
  if (!matchedNorm) return null;
  // Create a word-based loose regex from matchedNorm (allowing small separators)
  const words = matchedNorm.split(/\s+/).filter(Boolean).slice(0, 20);
  if (!words.length) return null;
  const regex = new RegExp(escapeForRegex(words.join('\\s+')), "i");
  const m = regex.exec(originalRaw);
  if (m && m.index !== undefined) {
    return { start: m.index, end: m.index + m[0].length };
  }
  // Fallback: try to search for first word then expand
  const firstWord = words[0];
  const idx = originalRaw.toLowerCase().indexOf(firstWord.toLowerCase());
  if (idx >= 0) {
    // expand to next 200 chars
    const end = Math.min(originalRaw.length, idx + 200);
    return { start: idx, end };
  }
  return null;
}

/**
 * recoverSpans(sections, originalText)
 * For each parsed LLM section, attempt to locate a best-matching span inside originalText.
 * If found, replace section.content with the originalText substring and attach sourceSpan.
 * Otherwise leave the section content as-is and sourceSpan undefined.
 */
export function recoverSpans(
  parsed: { title: string; content: string; fieldKey: string; confidence: number }[],
  originalText: string
): { title: string; content: string; fieldKey: string; confidence: number; sourceSpan?: { start: number; end: number } }[] {
  const originalNormalized = normalizeForMatch(originalText);
  return parsed.map(section => {
    const normalizedContent = normalizeForMatch(section.content);
    const words = normalizedContent.split(/\s+/).filter(Boolean);
    const maxSnippetWords = Math.min(12, Math.max(4, words.length));
    let foundSpan = null;
    // Try decreasing snippet sizes to find a match
    for (let n = maxSnippetWords; n >= 4 && !foundSpan; n--) {
      const snippet = words.slice(0, n).join(" ");
      const matchIdx = findSnippetIndexInNormalized(snippet, originalNormalized);
      if (matchIdx !== -1) {
        const span = mapNormalizedIndexToRawSpan(originalText, originalNormalized, matchIdx, snippet.length);
        if (span) foundSpan = span;
      }
    }
    // If still not found, try searching for any 4-word sliding window
    if (!foundSpan && words.length >= 4) {
      for (let i = 0; i <= words.length - 4 && !foundSpan; i++) {
        const snippet = words.slice(i, i + 4).join(" ");
        const matchIdx = findSnippetIndexInNormalized(snippet, originalNormalized);
        if (matchIdx !== -1) {
          const span = mapNormalizedIndexToRawSpan(originalText, originalNormalized, matchIdx, snippet.length);
          if (span) foundSpan = span;
        }
      }
    }
    if (foundSpan) {
      const rawSnippet = originalText.slice(foundSpan.start, foundSpan.end).trim();
      return {
        ...section,
        content: rawSnippet,
        sourceSpan: { start: foundSpan.start, end: foundSpan.end },
      };
    } else {
      return {
        ...section,
      };
    }
  });
}

/* ---------------------------
   Metadata post-processor
   --------------------------- */

function findEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : null;
}

function findPhone(text: string): string | null {
  const m = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\-\s]{5,16}/);
  if (!m) return null;
  const candidate = m[0].replace(/\s{2,}/g, " ").trim();
  if (candidate.match(/\b(19|20)\d{2}\b/)) return null;
  return candidate;
}

function findLinkedin(text: string): string | null {
  const m = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s)]+/i);
  return m ? m[0] : null;
}

function findNameFromTop(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  for (const line of lines.slice(0, 6)) {
    if (line.includes("@")) continue;
    if (line.match(/\+?\d/)) continue;
    if (line.length > 2 && line.length <= 80 && /[A-Za-z]/.test(line)) {
      // prefer lines with two words (first + last)
      if (line.split(/\s+/).length >= 2) return line;
      // otherwise keep as fallback
      return line;
    }
  }
  return null;
}

export function parseLLMMetadata(text: string): { name: string | null; email: string | null; phone: string | null; linkedinUrl: string | null } {
  // Try JSON first
  const direct = safeJsonParse<any>(text);
  if (direct && (direct.name !== undefined || direct.email !== undefined || direct.phone !== undefined)) {
    return {
      name: direct.name ?? null,
      email: direct.email ?? null,
      phone: direct.phone ?? null,
      linkedinUrl: direct.linkedinUrl ?? null
    };
  }

  // Try to extract fenced JSON
  const jsonFence = extractJsonFence(text);
  if (jsonFence) {
    const parsedFence = safeJsonParse<any>(jsonFence);
    if (parsedFence) {
      // Support both top-level metadata and a nested "metadata" object returned by some prompts/providers
      const metaSource = parsedFence.metadata ?? parsedFence;
      return {
        name: metaSource.name ?? null,
        email: metaSource.email ?? null,
        phone: metaSource.phone ?? null,
        linkedinUrl: metaSource.linkedinUrl ?? null
      };
    }
  }

  // Otherwise run heuristics across the full text and common header lines
  const email = findEmail(text);
  const phone = findPhone(text);
  const linkedin = findLinkedin(text);
  const name = findNameFromTop(text);

  return { name: name ?? null, email: email ?? null, phone: phone ?? null, linkedinUrl: linkedin ?? null };
}
// Attach helpers to global for backward compatibility with worker runtime.
// The worker attempted to call global.parseLLMSections; ensure it's available.
declare global {
  // allow adding these to global in Node environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var parseLLMSections: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var parseLLMMetadata: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var recoverSpans: any;
}

try {
  if (typeof global !== "undefined") {
    (global as any).parseLLMSections = parseLLMSections;
    (global as any).parseLLMMetadata = parseLLMMetadata;
    (global as any).recoverSpans = recoverSpans;
  }
} catch {
  // ignore - in some runtimes global may be readonly
}
