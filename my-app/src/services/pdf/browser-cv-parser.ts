/**
 * Local NormalizedProfile type used by browser parser.
 * Keep this independent from the Convex server types to avoid importing server-only files.
 */
export type NormalizedProfile = {
  name?: string;
  email?: string;
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string;
  }>;
  rawText?: string;
  confidence: number;
};

//
// Browser-side CV parser using pdfjs-dist.
// - Extracts text from ArrayBuffer
// - Runs lightweight heuristics to extract email, name, summary, skills, experiences
//
// This mirrors the server heuristics but runs in the browser to avoid server-side PDF parsing.
//

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// Use Vite's asset URL handling to load the worker script at runtime.
// The `?url` suffix tells Vite to return a URL string to the asset.
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";

// Configure pdfjs worker using GlobalWorkerOptions import to avoid readonly getter issues
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
GlobalWorkerOptions.workerSrc = workerUrl;

// OCR fallback
/**
 * Extract text from a PDF ArrayBuffer.
 *
 * Strategy:
 * 1) Try pdfjs text extraction with simple layout preservation (sort by y then x, insert line breaks when y jumps).
 * 2) If the resulting text is below a conservative threshold (TEXT_EXTRACTION_THRESHOLD),
 *    fall back to OCR using Tesseract.js (render pages to canvas at higher scale and run OCR).
 *
 * Returns a single string with reasonable line breaks and normalized whitespace.
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  // Tunables
  const TEXT_EXTRACTION_THRESHOLD = 250; // chars total across document to consider "good" extraction
  const PER_PAGE_Y_BREAK_TOLERANCE = 5; // y change (in PDF user space) to treat as a new line

  // --- 1) Layout-aware text extraction via pdfjs ---
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = ((textContent.items || []) as any[]).slice();

    // Defensive: if no text items, assume image page and continue (we'll decide OCR later)
    if (!items.length) {
      fullText += "\n\n";
      continue;
    }

    // Sort items by vertical then horizontal position:
    // pdfjs text item transform generally has [a, b, c, d, x, y]; x ~ transform[4], y ~ transform[5]
    items.sort((a: any, b: any) => {
      const ay = (a.transform && a.transform[5]) || 0;
      const by = (b.transform && b.transform[5]) || 0;
      // Descending y (top-to-bottom)
      if (Math.abs(by - ay) > 0.0001) return by - ay;
      const ax = (a.transform && a.transform[4]) || 0;
      const bx = (b.transform && b.transform[4]) || 0;
      return ax - bx;
    });

    let lastY: number | null = null;
    const pageParts: string[] = [];
    for (const item of items) {
      try {
        const y = (item.transform && item.transform[5]) || 0;
        const text = (item.str ?? "").replace(/\s+/g, " ").trim();
        if (lastY !== null && Math.abs(y - lastY) > PER_PAGE_Y_BREAK_TOLERANCE) {
          // significant vertical jump -> new line
          pageParts.push("\n");
        } else if (pageParts.length && !pageParts[pageParts.length - 1].endsWith("\n")) {
          // small gap: keep a space separator only where appropriate
          pageParts.push(" ");
        }
        pageParts.push(text);
        lastY = y;
      } catch (e) {
        // Non-fatal: fall back to raw str
        pageParts.push((item && item.str) || "");
      }
    }
    const pageText = pageParts.join("").replace(/\n\s+/g, "\n").trim();
    fullText += pageText + "\n\n";
  }

  fullText = fullText.trim();

  // --- 2) Decide whether to fall back to OCR ---
  // Primary heuristic: too-short extracted text suggests image / scan or failed extraction.
  if (!fullText || fullText.length < TEXT_EXTRACTION_THRESHOLD) {
    // Rely on server-side OCR instead of invoking a browser fallback that may be outdated.
    // eslint-disable-next-line no-console
    console.warn(
      "Browser PDF extraction produced limited text (length=%d); rely on server pipeline for OCR.",
      fullText?.length ?? 0,
    );
  }

  // Final cleanup: normalize newlines/whitespace but preserve paragraph breaks.
  fullText = fullText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return fullText;
}

// Heuristics (ported/adapted from convex/utils/cv_parser)
function extractEmail(text: string): string | null {
  const m = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0] : null;
}

function extractName(text: string, email?: string | null): string | null {
  if (email) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(email)) {
        if (i > 0 && lines[i - 1].length > 1 && lines[i - 1].length < 60) {
          return lines[i - 1];
        }
        break;
      }
    }
  }
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
  const skillSectionRegex = /(skills|technical skills|skills & tools|technical competencies)[:\s]*\n([\s\S]{0,500})/i;
  const m = text.match(skillSectionRegex);
  let skills: string[] = [];
  if (m && m[2]) {
    const raw = m[2].split(/[\n••\-•]/).join(", ");
    skills = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 60);
  } else {
    const possible = ["JavaScript", "TypeScript", "React", "Node", "Python", "Docker", "Kubernetes", "AWS", "GCP", "SQL", "NoSQL", "GraphQL"];
    const found: string[] = [];
    for (const token of possible) {
      const re = new RegExp(`\\b${token}\\b`, "i");
      if (re.test(text)) found.push(token);
    }
    skills = found;
  }
  return Array.from(new Set(skills)).slice(0, 50);
}

function extractSummary(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
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

type Experience = {
  company?: string;
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
};

function extractExperiences(text: string): Experience[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const exp: Experience[] = [];
  const dateRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*[-–—]\s*((Present|\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}))/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (dateRegex.test(line)) {
      const titleLine = lines[i - 1] || "";
      const companyLine = lines[i - 2] || "";
      const descriptionLines: string[] = [];
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

export async function parsePdfArrayBuffer(arrayBuffer: ArrayBuffer): Promise<NormalizedProfile> {
  const text = await extractTextFromPdf(arrayBuffer);

  const email = extractEmail(text);
  const name = extractName(text, email);
  const summary = extractSummary(text);
  const skills = extractSkills(text);
  const experience = extractExperiences(text);

  let confidence = 0;
  if (email) confidence += 0.4;
  if (name) confidence += 0.2;
  if (skills && skills.length > 0) confidence += 0.2;
  if (experience && experience.length > 0) confidence += 0.2;
  if (confidence > 1) confidence = 1;

  return {
    name: name || undefined,
    email: email || undefined,
    summary: summary || undefined,
    skills: skills.length ? skills : undefined,
    experience: experience.length ? experience : undefined,
    rawText: text,
    confidence,
  } as NormalizedProfile;
}
