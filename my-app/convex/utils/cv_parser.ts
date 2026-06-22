"use node";

/**
 * Very small, pragmatic CV parser for MVP.
 * - Extracts plain text from PDF buffer using pdf-parse.
 * - Runs lightweight heuristics to find name, email, skills, summary, experiences.
 * - Returns normalizedFields and a confidence score (0-1).
 *
 * This is intentionally simple: it avoids LLMs and complex NLP for fast iteration.
 */

export type Experience = {
  company?: string;
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
};

export type NormalizedProfile = {
  name?: string | null;
  email?: string | null;
  summary?: string | null;
  skills?: string[];
  experience?: Experience[];
  rawText?: string;
  confidence: number;
};

function extractEmail(text: string): string | null {
  const m = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0] : null;
}

function extractName(text: string, email?: string | null): string | null {
  // Heuristic: if email found, take the non-empty line above the line containing the email
  if (email) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(email)) {
        // prefer line above, fallback to first line
        if (i > 0 && lines[i - 1].length > 1 && lines[i - 1].length < 60) {
          return lines[i - 1];
        }
        break;
      }
    }
  }
  // fallback: use first non-empty line that's not "resume" or similar
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const low = line.toLowerCase();
    if (!line) continue;
    if (low.includes("resume") || low.includes("curriculum") || low.includes("profile")) continue;
    if (line.split(" ").length <= 6) {
      return line;
    }
  }
  return null;
}

function extractSkills(text: string): string[] {
  // Look for headings like "Skills", "Technical Skills", "Skills & Tools"
  const skillSectionRegex = /(skills|technical skills|skills & tools|technical competencies)[:\s]*\n([\s\S]{0,500})/i;
  const m = text.match(skillSectionRegex);
  let skills: string[] = [];
  if (m && m[2]) {
    // split by commas or bullets or newlines
    const raw = m[2].split(/[\n••\-•]/).join(", ");
    skills = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 60);
  } else {
    // fallback: common skill tokens
    const possible = ["JavaScript", "TypeScript", "React", "Node", "Python", "Docker", "Kubernetes", "AWS", "GCP", "SQL", "NoSQL", "GraphQL"];
    const found: string[] = [];
    for (const token of possible) {
      const re = new RegExp(`\\b${token}\\b`, "i");
      if (re.test(text)) found.push(token);
    }
    skills = found;
  }
  // dedupe
  return Array.from(new Set(skills)).slice(0, 50);
}

function extractSummary(text: string): string | null {
  // Heuristic: take the paragraph near the top (first 2-4 lines grouped)
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  // find first block of 2-6 non-empty lines
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines.slice(0, 40)) {
    if (!line) {
      if (current.length) {
        blocks.push(current.join(" "));
        current = [];
      }
    } else {
      current.push(line);
      if (current.length >= 6) {
        blocks.push(current.join(" "));
        break;
      }
    }
  }
  if (current.length) blocks.push(current.join(" "));
  if (blocks.length) {
    const candidate = blocks[0];
    if (candidate.length >= 40 && candidate.length <= 2000) return candidate;
  }
  return null;
}

function extractExperiences(text: string): Experience[] {
  // Very lightweight: find lines containing date ranges like "Jan 2020 - Dec 2022" or "2020 - Present" and the lines above/below
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const exp: Experience[] = [];
  const dateRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*[-–—]\s*((Present|\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}))/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (dateRegex.test(line)) {
      // take nearby lines as title/company/desc
      const titleLine = lines[i - 1] || "";
      const companyLine = lines[i - 2] || "";
      const descriptionLines = [];
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        if (lines[j]) descriptionLines.push(lines[j]);
      }
      exp.push({
        title: titleLine || undefined,
        company: companyLine || undefined,
        startDate: (line.match(dateRegex) || [])[1] || null,
        endDate: (line.match(dateRegex) || [])[3] || null,
        description: descriptionLines.join(" ") || undefined,
      });
    }
  }
  return exp.slice(0, 20);
}

export async function parsePdfBuffer(buffer: Buffer): Promise<NormalizedProfile> {
  // Lazy-require pdf-parse inside the function to avoid bundler analysis of node_modules at module import time.
  // This prevents the Convex bundler from resolving Node-only deps or test asset paths when analyzing non-node files.
  let pdf: any;
  try {
    // Use require to avoid static ESM imports that some bundlers analyze eagerly.

    pdf = require("pdf-parse");
  } catch (e: any) {
    throw new Error("Failed to load pdf-parse module: " + (e?.message ?? String(e)));
  }

  const data = await pdf(buffer);
  const text = (data && data.text) ? String(data.text) : "";

  const email = extractEmail(text);
  const name = extractName(text, email);
  const summary = extractSummary(text);
  const skills = extractSkills(text);
  const experience = extractExperiences(text);

  // Confidence heuristic: email + (skills or experience) present increases confidence
  let confidence = 0;
  if (email) confidence += 0.4;
  if (name) confidence += 0.2;
  if (skills && skills.length > 0) confidence += 0.2;
  if (experience && experience.length > 0) confidence += 0.2;
  if (confidence > 1) confidence = 1;

  return {
    name: name || null,
    email: email || null,
    summary: summary || null,
    skills: skills,
    experience: experience,
    rawText: text,
    confidence,
  };
}
