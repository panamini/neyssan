import { v4 as uuidv4 } from "uuid";
import type {
  CvDocument,
  IExperienceItem,
  IEducationItem,
  IProfileItem,
  ISummaryItem,
  ISkillItem,
  ILanguageItem,
} from "../types/cvDocument";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

/**
 * Exported factories to create structured items bound to a CV id.
 * These helpers guarantee schema-compatible ids and provide a fresh
 * instance suitable for insertion into structuredContent.
 */

export function makeExperienceItem(): IExperienceItem {
  return {
    id: uuidv4(),
    company: "",
    position: "",
    // Use an epoch placeholder to satisfy strict schema, but UI renders it as blank.
    startDate: "1970-01-01T00:00:00.000Z",
    // endDate nullable
    endDate: null,
    // Explicit canonical toggle default (not current)
    isCurrent: false,
    // Back-compat legacy flag mirrors canonical
    currentlyWorking: false,
    location: "",
    // responsibilities: Remirror JSON or string — keep undefined to let UI add blocks for responsibilities
    responsibilities: undefined,
    // achievements: explicit empty array so UI renders an achievements sub-list
    achievements: [],
  };
}

export function makeEducationItem(): IEducationItem {
  return {
    id: uuidv4(),
    institution: "",
    degree: "",
    fieldOfStudy: "",
    // Optional dates left undefined for user to fill
    startDate: undefined,
    endDate: undefined,
    // Allow ongoing education toggle default (off)
    isCurrent: false,
    grade: "",
    description: undefined,
  };
}

/* New skeleton factories for v1 sections */

export function makeProfileItem(): IProfileItem {
  return {
    id: uuidv4(),
    name: "",
    photoUrl: undefined,
    email: "",
    phone: "",
    linkedin: "",
    website: "",
    desiredPosition: "",
    location: "",
  };
}

export function makeSummaryItem(): ISummaryItem {
  return {
    id: uuidv4(),
    // Initialize summary with an empty Remirror document so the v1 Summary editor
    // sees a structured value (prevents falling back to legacy block-only rendering).
    summary: ensureRemirrorDoc(undefined as any),
  };
}

export function makeSkillItem(): ISkillItem {
  return {
    id: uuidv4(),
    name: "",
    level: "Intermediate",
  };
}

export function makeLanguageItem(): ILanguageItem {
  return {
    id: uuidv4(),
    name: "",
    level: "Intermediate",
  };
}

/**
 * Achievement item factory
 * Keeps a minimal shape: { id, achievement }
 * Used by the achievements section.
 */
export function makeAchievementItem() {
  return {
    id: uuidv4(),
    text: "",
  };
}


/**
 * generateCvTemplate
 *
 * Produce a UI-friendly, strict CvDocument skeleton that conforms to CvDocumentSchemaStrict.
 *
 * Goals:
 * - Stay strictly within the existing Zod schema (do not add new fields).
 * - Make structured sections (experience, education) UI-ready by creating
 *   explicit, editable fields inside structuredContent entries (company, position, dates, achievements).
 * - Expose contact pieces as separate editable Remirror blocks (name, email, phone, linkedin, website, address)
 *   so the editor can render them as distinct inputs without inventing new structured schema fields.
 * - Keep dates as ISO strings (the schema requires ISODateString), UI layer should render pickers from those.
 *
 * The implementation uses small helper factories so callers always receive a fresh,
 * non-shared instance suitable for editing.
 */
export function generateCvTemplate(title?: string): CvDocument {
  const now = new Date().toISOString();
  const id = uuidv4();

  // Helper to create a minimal Remirror-backed text block.
  function makeTextBlock(initialContent?: string | object) {
    return {
      id: uuidv4(),
      type: "text" as const,
      // Use ensureRemirrorDoc to produce a minimal Remirror JSON document.
      content: ensureRemirrorDoc(initialContent as any),
      // plainText is optional; leave undefined to be computed later when needed.
    };
  }


  // Create initial structured items bound to this CV id so ids are stable and unique.
  const initialExperienceItem = makeExperienceItem();
  const initialEducationItem = makeEducationItem();

  // For typed sections, create representative blocks for each structured entry so the
  // block-based UI can immediately edit responsibilities/descriptions (or show placeholders).
  const expBlock = {
    ...makeTextBlock(
      // If the structured item contains responsibilities, use it as initial content.
      initialExperienceItem.responsibilities ?? undefined
    ),
    attributes: { linkedStructuredId: initialExperienceItem.id },
  };
  const experienceBlocks = [expBlock];

  const eduBlock = {
    ...makeTextBlock(
      // If the structured item contains description, use it as initial content.
      initialEducationItem.description ?? undefined
    ),
    attributes: { linkedStructuredId: initialEducationItem.id },
  };
  const educationBlocks = [eduBlock];

  // Build sections — prefer structuredContent for typed sections and blocks for free-text.
  const profileItem = makeProfileItem();
  const summaryItem = makeSummaryItem();
  const initialSkillItem = makeSkillItem();
  const initialLanguageItem = makeLanguageItem();

  const sections = [
    {
      id: uuidv4(),
      title: "Profile",
      type: "profile" as const,
      blocks: [],
      structuredContent: [profileItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Summary",
      type: "summary" as const,
      // Create a single editable block linked to the summary structured item
      blocks: [
        {
          id: uuidv4(),
          title: "Summary",
          type: "text" as const,
          content: ensureRemirrorDoc((summaryItem as any).summary),
          attributes: { linkedStructuredId: summaryItem.id },
        },
      ],
      structuredContent: [summaryItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Experience",
      type: "experience" as const,
      // Create representative blocks mapping to structuredContent entries so the editor has an editable block.
      blocks: experienceBlocks,
      structuredContent: [initialExperienceItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Education",
      type: "education" as const,
      blocks: educationBlocks,
      structuredContent: [initialEducationItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Skills",
      type: "skills" as const,
      blocks: [],
      structuredContent: [initialSkillItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Languages",
      type: "languages" as const,
      blocks: [],
      structuredContent: [initialLanguageItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Achievements",
      type: "achievements" as const,
      blocks: [makeTextBlock()],
      structuredContent: [],
      collapsed: true,
    },
    {
      id: uuidv4(),
      title: "Projects",
      type: "projects" as const,
      blocks: [makeTextBlock()],
      structuredContent: null,
      collapsed: true,
    },
    {
      id: uuidv4(),
      title: "Certifications",
      type: "certifications" as const,
      blocks: [makeTextBlock()],
      structuredContent: null,
      collapsed: true,
    },
  ];

  const candidate = {
    id,
    title: title ?? "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    sections,
    tags: [],
    // Document-level summary left undefined to avoid duplication with summary section.
    summary: undefined,
  };

  // Validate strictly to ensure consumers always receive a schema-compliant document.
  return parseCvDocumentStrict(candidate);
}

/**
 * generateCvTemplateV1
 *
 * Minimal v1 template exposing the MVP typed core sections:
 * - Profile (structured)
 * - Summary (structured + linked text block)
 * - Experience (structured + linked text block)
 * - Education (structured + linked text block)
 * - Skills (structured)
 *
 * Optional sections like Languages and Achievements are intentionally omitted from
 * the default skeleton so the mounted /cv workflow can add them explicitly later.
 */
export function generateCvTemplateV1(title?: string): CvDocument {
  const now = new Date().toISOString();
  const id = uuidv4();

  // Create initial structured items bound to this CV id
  const initialExperienceItem = makeExperienceItem();
  const initialEducationItem = makeEducationItem();

  function makeTextBlock(initialContent?: string | object) {
    return {
      id: uuidv4(),
      type: "text" as const,
      content: ensureRemirrorDoc(initialContent as any),
    };
  }

  const expBlock = {
    ...makeTextBlock(initialExperienceItem.responsibilities ?? undefined),
    attributes: { linkedStructuredId: initialExperienceItem.id },
  };

  const eduBlock = {
    ...makeTextBlock(initialEducationItem.description ?? undefined),
    attributes: { linkedStructuredId: initialEducationItem.id },
  };

  // Include only the MVP v1 core sections by default.
  const profileItem = makeProfileItem();
  const summaryItem = makeSummaryItem();
  const initialSkillItem = makeSkillItem();

  const sections = [
    {
      id: uuidv4(),
      title: "Profile",
      type: "profile" as const,
      blocks: [],
      structuredContent: [profileItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Summary",
      type: "summary" as const,
      blocks: [
        {
          id: uuidv4(),
          title: "Summary",
          type: "text" as const,
          content: ensureRemirrorDoc((summaryItem as any).summary),
          attributes: { linkedStructuredId: summaryItem.id },
        },
      ],
      structuredContent: [summaryItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Experience",
      type: "experience" as const,
      blocks: [expBlock],
      structuredContent: [initialExperienceItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Education",
      type: "education" as const,
      blocks: [eduBlock],
      structuredContent: [initialEducationItem],
      collapsed: false,
    },
    {
      id: uuidv4(),
      title: "Skills",
      type: "skills" as const,
      blocks: [],
      structuredContent: [initialSkillItem],
      collapsed: false,
    },
  ];

  const candidate = {
    id,
    title: title ?? "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    sections,
    tags: [],
    summary: undefined,
  };

  // Development-only diagnostic: expose the v1 template section types in dev mode.
  if (process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line no-console
      console.debug("[cv-template] generateCvTemplateV1 sections", { sectionTypes: sections.map((s) => s.type) });
    } catch {
      /* non-fatal diagnostics */
    }
  }

  return parseCvDocumentStrict(candidate);
}
