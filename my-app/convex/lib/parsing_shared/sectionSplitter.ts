const SECTION_HEADING_REGEX = /^(?:\s*)(EXPERIENCE|WORK\s+HISTORY|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)(?:\s*)$/i;

export type SectionType =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "preface"
  | "unknown";

export interface SectionBlock {
  heading: string;
  normalizedHeading: SectionType;
  text: string;
  /** Index of the first character belonging to the heading line. */
  start: number;
  /** Index right after the final character of the section body. */
  end: number;
}

interface HeadingMatch {
  raw: string;
  normalized: SectionType;
}

const HEADING_MAP: Record<string, SectionType> = {
  EXPERIENCE: "experience",
  "WORK HISTORY": "experience",
  EDUCATION: "education",
  SKILLS: "skills",
  PROJECTS: "projects",
  CERTIFICATIONS: "certifications",
};

export const KNOWN_SECTION_ALIASES = Object.keys(HEADING_MAP);

const LINE_WITH_ENDING_REGEX = /.*?(?:\r?\n|$)/g;

function detectHeading(line: string): HeadingMatch | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(SECTION_HEADING_REGEX);
  if (!match) return null;
  const canonical = match[1].toUpperCase();
  const normalized = HEADING_MAP[canonical] ?? "unknown";
  return { raw: trimmed, normalized };
}

function pushSection(
  sections: SectionBlock[],
  rawText: string,
  heading: HeadingMatch,
  headingStart: number,
  bodyStart: number,
  bodyEnd: number
) {
  if (bodyEnd < bodyStart) {
    bodyEnd = bodyStart;
  }
  const text = rawText.slice(bodyStart, bodyEnd).trim();
  sections.push({
    heading: heading.raw,
    normalizedHeading: heading.normalized,
    text,
    start: headingStart,
    end: bodyEnd,
  });
}

export function splitSections(rawText: string): SectionBlock[] {
  if (!rawText) return [];

  const sections: SectionBlock[] = [];
  let currentHeading: HeadingMatch | null = null;
  let currentHeadingStart = 0;
  let currentBodyStart = 0;
  let firstHeadingStart: number | null = null;

  for (const match of rawText.matchAll(LINE_WITH_ENDING_REGEX)) {
    const lineWithEnding = match[0];
    const lineStart = match.index ?? 0;
    const lineEnd = lineStart + lineWithEnding.length;
    const lineContent = lineWithEnding.replace(/\r?\n$/, "");

    const heading = detectHeading(lineContent);
    if (heading) {
      if (currentHeading) {
        pushSection(sections, rawText, currentHeading, currentHeadingStart, currentBodyStart, lineStart);
      }
      currentHeading = heading;
      currentHeadingStart = lineStart;
      currentBodyStart = lineEnd;
      if (firstHeadingStart === null) {
        firstHeadingStart = lineStart;
        const prefaceText = rawText.slice(0, lineStart).trim();
        if (prefaceText) {
          sections.push({
            heading: "PREFACE",
            normalizedHeading: "preface",
            text: prefaceText,
            start: 0,
            end: lineStart,
          });
        }
      }
    }
  }

  if (currentHeading) {
    pushSection(sections, rawText, currentHeading, currentHeadingStart, currentBodyStart, rawText.length);
  } else if (rawText.trim()) {
    sections.push({
      heading: "PREFACE",
      normalizedHeading: "preface",
      text: rawText.trim(),
      start: 0,
      end: rawText.length,
    });
  }

  return sections;
}

