import type { CvDocument } from "../../../types/cvDocument";
import type { ResumePreviewPrintSource } from "../../../lib/document-export-models";
import { buildStyledResumePrintSource } from "../../../lib/document-export-models";
import { DEFAULT_VERBATI_STYLE, resolveVerbatiStyle, serializeVerbatiStyle } from "../style";
import type { VerbatiStylePreset } from "../types";

export const RESUME_FONT_PARITY_FIXTURE_ID = "cv_font_parity_fixture";

export function buildResumeFontParityFixtureDocument(
  stylePreset?: Partial<VerbatiStylePreset> | null,
): CvDocument {
  const resolvedStyle = resolveVerbatiStyle(stylePreset ?? DEFAULT_VERBATI_STYLE);

  return {
    id: RESUME_FONT_PARITY_FIXTURE_ID,
    title: "Elena Marlowe",
    metadata: {
      createdAt: "2026-04-16T09:00:00.000Z",
      updatedAt: "2026-04-16T09:00:00.000Z",
      version: 1,
      locale: "en",
      verbatiStyle: serializeVerbatiStyle(resolvedStyle),
    },
    sections: [
      {
        id: "profile",
        type: "profile",
        title: "Profile",
        blocks: [],
        structuredContent: [
          {
            id: "profile_1",
            name: "Elena Marlowe",
            desiredPosition: "Senior Product Designer",
            email: "elena@sample.design",
            phone: "+31 6 5555 2381",
            website: "elenamarlowe.design",
            linkedin: "linkedin.com/in/elenamarlowe",
            location: "Amsterdam, NL",
          },
        ],
      },
      {
        id: "summary",
        type: "summary",
        title: "Summary",
        blocks: [],
        structuredContent: [
          {
            id: "summary_1",
            summary:
              "Editorially minded product designer with 9+ years shaping product systems, design language, and content-rich experiences across SaaS, commerce, and media. Known for translating ambiguity into calm, precise interfaces with strong narrative structure.",
          },
        ],
      },
      {
        id: "experience",
        type: "experience",
        title: "Experience",
        blocks: [],
        structuredContent: [
          {
            id: "exp_1",
            company: "Northline Studio",
            position: "Lead Product Designer",
            startDate: "2021-01-01",
            endDate: null,
            isCurrent: true,
            location: "Amsterdam",
            responsibilityBullets: [
              "Led the redesign of a multi-market B2B platform, reducing workflow time by 28% through clearer information architecture and faster editorial navigation.",
              "Defined a visual system with content-first page patterns, typography scales, and reusable layout primitives adopted by three product squads.",
              "Partnered with product and engineering leadership to establish design review rituals, content QA, and rollout guidance for major releases.",
            ],
          },
          {
            id: "exp_2",
            company: "Signal House",
            position: "Senior Product Designer",
            startDate: "2018-01-01",
            endDate: "2021-01-01",
            location: "Berlin",
            responsibilityBullets: [
              "Designed publishing and analytics tools for editors and growth teams, balancing speed, legibility, and complex data workflows.",
              "Introduced component-level documentation and motion standards that improved implementation consistency across web and mobile.",
            ],
          },
        ],
      },
      {
        id: "education",
        type: "education",
        title: "Education",
        blocks: [],
        structuredContent: [
          {
            id: "edu_1",
            institution: "University of the Arts London",
            degree: "MA, Information Design",
            startDate: "2013-01-01",
            endDate: "2015-01-01",
          },
          {
            id: "edu_2",
            institution: "Kingston University",
            degree: "BA, Visual Communication",
            startDate: "2009-01-01",
            endDate: "2013-01-01",
          },
        ],
      },
      {
        id: "skills",
        type: "skills",
        title: "Skills",
        blocks: [],
        structuredContent: [
          { id: "skill_1", name: "Design direction", level: "Advanced" },
          { id: "skill_2", name: "Product strategy", level: "Advanced" },
          { id: "skill_3", name: "Interaction design", level: "Advanced" },
          { id: "skill_4", name: "Visual systems", level: "Advanced" },
          { id: "skill_5", name: "Editorial UI", level: "Advanced" },
          { id: "skill_6", name: "Research synthesis", level: "Advanced" },
        ],
      },
      {
        id: "languages",
        type: "languages",
        title: "Languages",
        blocks: [],
        structuredContent: [
          { id: "lang_1", name: "English", level: "Fluent" },
          { id: "lang_2", name: "Dutch", level: "Advanced" },
          { id: "lang_3", name: "French", level: "Intermediate" },
        ],
      },
      {
        id: "projects",
        type: "projects",
        title: "Projects",
        blocks: [],
        structuredContent: [
          {
            id: "proj_1",
            name: "Atlas Design Language",
            meta: "System strategy · 2024",
            description:
              "Created a modular design language for dense product surfaces with article-like reading flow, semantic tokens, and print-aware documentation.",
          },
          {
            id: "proj_2",
            name: "Editorial Commerce Toolkit",
            meta: "Experimentation platform · 2023",
            description:
              "Designed a toolkit for merchandisers to compose narrative product features, improving campaign velocity without sacrificing brand consistency.",
          },
        ],
      },
      {
        id: "achievements",
        type: "achievements",
        title: "Achievements",
        blocks: [],
        structuredContent: [
          { id: "ach_1", text: "Reduced production time for new screens through a reusable design system." },
          { id: "ach_2", text: "Improved clarity across dense workflows and editorially structured pages." },
        ],
      },
      {
        id: "hobbies",
        type: "text",
        title: "Hobbies",
        blocks: [],
        structuredContent: [
          { name: "Running" },
          { name: "Film photography" },
        ],
      },
    ],
  };
}

export function buildResumeFontParityPreviewSource(
  stylePreset?: Partial<VerbatiStylePreset> | null,
): ResumePreviewPrintSource {
  const currentCv = buildResumeFontParityFixtureDocument(stylePreset);
  const source = buildStyledResumePrintSource({
    currentCv,
    stylePreset: resolveVerbatiStyle(stylePreset ?? DEFAULT_VERBATI_STYLE),
  });

  if (!source) {
    throw new Error("Resume font parity preview source is unavailable.");
  }

  return source;
}
