/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/**
 * Lightweight client-side fallback parser (ported from convex action simpleParse).
 * This is intentionally simple and defensive: it ensures the frontend can
 * produce reviewerSections and suggestions when backend parsing is unavailable
 * (e.g., CORS during local dev).
 *
 * Exported function: clientFormatCompleteCV(rawText: string) => Refined-like object
 */
export function clientFormatCompleteCV(rawText: string) {
  const text = String(rawText ?? "").trim();

  function extractEmail(t: string) {
    const m = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
    return m ? m[0] : undefined;
  }
  function extractPhone(t: string) {
    const m = t.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\-.\s]{5,16}/);
    if (!m) return undefined;
    const candidate = m[0].replace(/\s{2,}/g, " ").trim();
    if (candidate.match(/\b(19|20)\d{2}\b/)) return undefined;
    return candidate;
  }
  function extractNameFromTop(t: string) {
    const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return undefined;
    for (const line of lines.slice(0, 6)) {
      if (line.includes("@")) continue;
      if (line.match(/\+?\d/)) continue;
      if (line.length > 2 && line.length <= 100 && /[A-Za-z]/.test(line)) return line;
    }
    return undefined;
  }
  function extractLocation(t: string) {
    const m = t.match(/([A-Za-z\s]+,\s*[A-Za-z\s]{2,})/);
    return m ? m[0].trim() : undefined;
  }

  function extractSectionsByHeaders(tt: string) {
    const lines = tt.split(/\r?\n/);
    const sections = [];
    const headerRegex = /^\s*(Summary|Professional Summary|Skills|Experience|Work Experience|Education|Achievements|Projects|Identity|Contact|Profile)\s*:?\s*$/i;
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const h = l.match(headerRegex);
      if (h) {
        if (current) sections.push(current);
        const header = h[1];
        const key = header.toLowerCase();
        const fieldKey = key.includes("experience") ? "experience"
          : key.includes("project") ? "experience"
          : key.includes("skill") ? "skills"
          : key.includes("education") ? "education"
          : key.includes("langue") || key.includes("language") || key.includes("langues") ? "languages"
          : key.includes("contact") || key.includes("coordonn") ? "contact"
          : key.includes("identity") ? "identity"
          : "summary";
        current = { title: header, content: [], fieldKey };
      } else {
        if (!current) {
          current = { title: "Intro", content: [l], fieldKey: "summary" };
        } else {
          current.content.push(l);
        }
      }
    }
    if (current) sections.push(current);
    return sections.map(s => ({ title: s.title, content: s.content.join("\n").trim(), fieldKey: s.fieldKey }));
  }

  function normalizeSkills(skillsRaw: any) {
    let skillsArr: string[] = [];
    if (!skillsRaw) return { skills: [], skillsText: "" };
    if (Array.isArray(skillsRaw)) skillsArr = skillsRaw.map(String);
    else if (typeof skillsRaw === "string") {
      // split on common separators
      skillsArr = skillsRaw.split(/[,\n•·]/).map(s => s.trim()).filter(Boolean);
    } else {
      skillsArr = [String(skillsRaw)];
    }
    return { skills: skillsArr, skillsText: skillsArr.join(", ") };
  }

  // Build sections
  const sections = extractSectionsByHeaders(text);
  const findSection = (fieldKey: string) => sections.find(s => s.fieldKey === fieldKey)?.content;

  const summary = findSection("summary") ?? text.split(/\r?\n/).slice(0, 6).join(" ").trim();

  const skillsRaw = findSection("skills");
  const { skills, skillsText } = normalizeSkills(skillsRaw ?? "");

  const experienceRaw = findSection("experience") ?? "";
  let experience = [];
  try {
    if (experienceRaw.trim().startsWith("[")) {
      const parsed = JSON.parse(experienceRaw);
      if (Array.isArray(parsed)) experience = parsed;
    } else {
      // naive fallback: split into paragraphs
      experience = experienceRaw.split(/\n{2,}/).map(block => ({ description: block.trim() })).filter(Boolean);
    }
  } catch {
    experience = [];
  }
  const experienceText = experience.length ? JSON.stringify(experience, null, 2) : undefined;

  const educationRaw = findSection("education") ?? "";
  let education = [];
  try {
    if (educationRaw.trim().startsWith("[")) {
      const parsed = JSON.parse(educationRaw);
      if (Array.isArray(parsed)) education = parsed;
    } else {
      education = educationRaw.split(/\n{2,}/).map(block => ({ description: block.trim() })).filter(Boolean);
    }
  } catch {
    education = [];
  }
  const educationText = education.length ? JSON.stringify(education, null, 2) : undefined;

  const achievements = findSection("achievements") ?? undefined;

  const email = extractEmail(text);
  const phone = extractPhone(text);
  const name = extractNameFromTop(text);
  const location = extractLocation(text);

  // Build rawParsedSections with stable-ish ids
  const rawParsedSections = sections.map((s, idx) => {
    const id = `client-${s.fieldKey}-${idx}`;
    return {
      id,
      title: s.title,
      content: s.content,
      fieldKey: s.fieldKey,
      dismissed: false,
    };
  });

  return {
    status: "ok",
    result: {
      summary,
      skills,
      skillsText: skillsText || undefined,
      experience,
      experienceText,
      education,
      educationText,
      achievements,
      identity: {
        name,
        email,
        phone,
        location,
      },
      rawParsedSections,
      diagnostics: { parseConfidence: 0.5, warnings: [] },
    },
  };
}