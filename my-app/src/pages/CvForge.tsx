import React from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { PenLine, Upload, X } from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import type { ResumeExportRequest } from "../components/ResumeExportControl";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { VerbatiResumePreview } from "../features/verbati/VerbatiResumePreview";
import { hasRenderableResumeData } from "../features/verbati/cvDocumentToResumeData";
import type {
  ResumeActiveTarget,
  ResumeLinkIntent,
} from "../features/verbati/resumeLinking";
import { getCanonicalSectionType } from "../features/verbati/resumeLinking";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import { resolveVerbatiStyle } from "../features/verbati/style";
import type { VerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { ensureRemirrorDoc } from "../components/remirror-editor/utils/conversion";
import { useToast } from "../components/ui/toast";
import {
  buildAuthoritativeResumeDebugSnapshot,
  buildAuthoritativeResumeExportModel,
  readAuthoritativeResumeFromCv,
} from "../lib/authoritative-resume";
import {
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT,
  useStructuredMistralImport,
} from "../components/useStructuredMistralImport";
import {
  downloadAuthoritativeResumeExport,
  downloadStandardResumeExport,
} from "../lib/cv-export";
import dbg from "../lib/cv-debug";
import {
  buildResumePrintDebugSnapshot,
  buildResumeExportSource,
  buildStyledResumePrintSource,
  type ExportDocumentFormat,
} from "../lib/document-export-models";
import {
  applyHiddenSectionsToCvDocument,
  readStoredHiddenSectionIds,
  sanitizeHiddenSectionIds,
  writeStoredHiddenSectionIds,
} from "../lib/cv-section-organization";
import {
  buildResumeTypographyAuditMetadata,
  readResumePreviewDebugCapture,
  setStyledResumeExportContext,
} from "../lib/document-export-debug";
import { exportDocumentFile } from "../lib/exportDocumentFile";
import type { CvDocument } from "../types/cvDocument";
import { buildCanonicalResumeRenderModelFromCv } from "../lib/buildCanonicalResumeRenderModel";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";
import CvStageBar from "../components/cv/CvStageBar";
import CvReviewBanner from "../components/cv/CvReviewBanner";
import CvRail, {
  type CvAccentChoice,
  type CvAddSectionKind,
  type CvRailAppliedAiEdit,
  type CvRailAiSuggestion,
  type CvRailTab,
  type CvToneChoice,
} from "../components/cv/CvRail";
import ImportReviewSheet, {
  type CvImportReviewBlock,
} from "../components/cv/ImportReviewSheet";
import SectionEditorSheet from "../components/cv/SectionEditorSheet";
import type { CvSection } from "../types/cvDocument";
import type { ImportRecoverySession } from "../types/importRecovery";
import {
  createAiInteractionId,
  recordAiInteractionEvent,
} from "../lib/ai/aiInteractionTelemetry";

type CvForgeWorkspaceMode = "edit" | "preview";
type CvForgeCanonicalJob = {
  id: string;
  title: string;
  company: string;
} | null;

const CV_FORGE_WORKSPACE_MODE_STORAGE_KEY = "dasti:cv-forge-workspace-mode:v1";
const ENTRY_PICKER_PENDING_ROUTE_ID = "__entry-picker-pending-route__";

function mapDefaultVoicePresetToCvTone(value: unknown): CvToneChoice {
  if (value === "engaging") return "warm";
  if (value === "expert") return "formal";
  return "natural";
}

function cleanCvMetadataForImport(metadata: CvDocument["metadata"]): CvDocument["metadata"] {
  const nextMetadata = { ...metadata } as Record<string, unknown>;
  delete nextMetadata.cvTone;
  return nextMetadata as CvDocument["metadata"];
}

function buildUpdatedCvMetadata(cv: CvDocument, updatedAt: string): CvDocument["metadata"] {
  return {
    ...cleanCvMetadataForImport(cv.metadata),
    updatedAt,
  };
}

function collectPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(collectPlainText).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.plainText === "string") return record.plainText;
  if (Array.isArray(record.content)) {
    return record.content.map(collectPlainText).filter(Boolean).join("\n");
  }
  return Object.entries(record)
    .filter(([key]) => !["type", "attrs", "id", "order"].includes(key))
    .map(([, entry]) => collectPlainText(entry))
    .filter(Boolean)
    .join("\n");
}

function getStructuredItems(section: CvSection): Array<Record<string, unknown>> {
  return Array.isArray(section.structuredContent)
    ? (section.structuredContent as Array<Record<string, unknown>>)
    : [];
}

function normalizeListName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function dedupeTextList(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    const clean = item.trim();
    if (!clean) continue;
    const key = normalizeListName(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }

  return next;
}

function getListSectionItems(section: CvSection): string[] {
  return getStructuredItems(section)
    .map((item) =>
      typeof item.name === "string"
        ? item.name
        : typeof item.text === "string"
          ? item.text
          : typeof item.certificationName === "string"
            ? item.certificationName
            : "",
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function filterNewListSuggestions(suggestions: string[], existingItems: string[]): string[] {
  const existing = new Set(existingItems.map(normalizeListName));
  return dedupeTextList(suggestions).filter(
    (suggestion) => !existing.has(normalizeListName(suggestion)),
  );
}

function getCurrentCvSummaryText(cv: CvDocument | null | undefined): string {
  const summarySection = cv?.sections?.find(
    (section) => String(section.type) === "summary",
  ) as CvSection | undefined;
  const item = summarySection ? getStructuredItems(summarySection)[0] : null;
  return collectPlainText(item?.summary ?? summarySection?.blocks?.[0]?.content);
}

function getCurrentCvSkills(cv: CvDocument | null | undefined): string[] {
  return dedupeTextList(
    (cv?.sections ?? [])
      .filter((section) => String(section.type) === "skills")
      .flatMap((section) => getListSectionItems(section as CvSection)),
  );
}

function getCurrentCvLanguages(
  cv: CvDocument | null | undefined,
): Array<{ name?: string; level?: string }> {
  return (cv?.sections ?? [])
    .filter((section) => String(section.type) === "languages")
    .flatMap((section) =>
      getStructuredItems(section as CvSection).map((item) => ({
        name: typeof item.name === "string" ? item.name.trim() : undefined,
        level: typeof item.level === "string" ? item.level.trim() : undefined,
      })),
    )
    .filter((item) => item.name || item.level);
}

function getCurrentCvExperiences(
  cv: CvDocument | null | undefined,
): Array<{
  company?: string;
  position?: string;
  description?: string;
  bullets?: string[];
}> {
  return (cv?.sections ?? [])
    .filter((section) => String(section.type) === "experience")
    .flatMap((section) =>
      getStructuredItems(section as CvSection).map((item) => ({
        company: typeof item.company === "string" ? item.company.trim() : undefined,
        position:
          typeof item.position === "string" ? item.position.trim() : undefined,
        description: collectPlainText(item.responsibilities ?? item.description),
        bullets: splitAiListText(collectPlainText(item.responsibilities)),
      })),
    );
}

function getCurrentCvEducations(
  cv: CvDocument | null | undefined,
): Array<{
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  description?: string;
}> {
  return (cv?.sections ?? [])
    .filter((section) => String(section.type) === "education")
    .flatMap((section) =>
      getStructuredItems(section as CvSection).map((item) => ({
        institution:
          typeof item.institution === "string" ? item.institution.trim() : undefined,
        degree: typeof item.degree === "string" ? item.degree.trim() : undefined,
        fieldOfStudy:
          typeof item.fieldOfStudy === "string" ? item.fieldOfStudy.trim() : undefined,
        description: collectPlainText(item.description),
      })),
    );
}

function buildCvContextForSummaryAskAi(
  cv: CvDocument | null | undefined,
): string {
  const skills = getCurrentCvSkills(cv);
  const languages = getCurrentCvLanguages(cv);
  const experiences = getCurrentCvExperiences(cv);
  const educations = getCurrentCvEducations(cv);
  return [
    skills.length ? `Skills: ${skills.join(", ")}` : "",
    languages.length
      ? `Languages: ${languages
          .map((item) => [item.name, item.level].filter(Boolean).join(" - "))
          .join(", ")}`
      : "",
    experiences.length
      ? `Experience:\n${experiences
          .map((item, index) =>
            [
              `${index + 1}. ${[item.position, item.company]
                .filter(Boolean)
                .join(" at ")}`,
              item.description,
              item.bullets?.length ? item.bullets.join(" | ") : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")}`
      : "",
    educations.length
      ? `Education:\n${educations
          .map((item, index) =>
            [
              `${index + 1}. ${[item.degree, item.fieldOfStudy, item.institution]
                .filter(Boolean)
                .join(", ")}`,
              item.description,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readCvSectionAiText(section: CvSection): string {
  const items = getStructuredItems(section);
  if (items.length > 0) {
    return items
      .map((item) => {
        switch (section.type) {
          case "profile":
          case "contact":
            return [
              item.name,
              item.desiredPosition,
              item.email,
              item.phone,
              item.location,
              item.linkedin,
              item.website,
            ]
              .map(collectPlainText)
              .filter(Boolean)
              .join("\n");
          case "summary":
            return collectPlainText(item.summary);
          case "experience":
            return [
              item.position,
              item.company,
              item.startDate || item.endDate
                ? [item.startDate, item.endDate].filter(Boolean).join(" - ")
                : null,
              item.responsibilities,
              item.description,
              item.achievements,
            ]
              .map(collectPlainText)
              .filter(Boolean)
              .join("\n");
          case "education":
            return [
              item.degree,
              item.fieldOfStudy,
              item.institution,
              item.description,
            ]
              .map(collectPlainText)
              .filter(Boolean)
              .join("\n");
          case "skills":
          case "languages":
            return collectPlainText(item.name);
          case "achievements":
            return collectPlainText(item.text);
          case "certifications":
            return collectPlainText(item.certificationName);
          default:
            return collectPlainText(item);
        }
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return (section.blocks ?? [])
    .map((block) => collectPlainText(block.plainText ?? block.content))
    .filter(Boolean)
    .join("\n\n");
}

function splitAiListText(text: string): string[] {
  return text
    .split(/\r?\n|[•·]/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function readAiResultText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  const record =
    result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  if (!record) return "";
  if (typeof record.text === "string") return record.text.trim();
  return "";
}

function updateFirstTextBlock(section: CvSection, text: string): CvSection {
  const firstBlock = section.blocks[0];
  return {
    ...section,
    blocks: [
      {
        ...(firstBlock ?? {
          id: `block-${section.id ?? section.type}`,
          type: "text" as const,
          title: section.title,
          attributes: {},
        }),
        content: ensureRemirrorDoc(text),
        plainText: text,
      },
      ...section.blocks.slice(1),
    ],
  };
}

function applyAiTextToSection(section: CvSection, text: string): CvSection {
  const cleanText = text.trim();
  if (!cleanText) return section;
  const items = getStructuredItems(section);

  switch (section.type) {
    case "summary": {
      const item = items[0] ?? { id: `summary-${section.id ?? "section"}-0` };
      return updateFirstTextBlock(
        {
          ...section,
          structuredContent: [
            { ...item, summary: ensureRemirrorDoc(cleanText) },
          ] as CvSection["structuredContent"],
        },
        cleanText,
      );
    }
    case "experience":
      if (items.length === 1) {
        return {
          ...section,
          structuredContent: [
            {
              ...items[0],
              responsibilities: ensureRemirrorDoc(cleanText),
            },
          ] as CvSection["structuredContent"],
        };
      }
      return updateFirstTextBlock(section, cleanText);
    case "education":
      if (items.length === 1) {
        return {
          ...section,
          structuredContent: [
            {
              ...items[0],
              description: ensureRemirrorDoc(cleanText),
            },
          ] as CvSection["structuredContent"],
        };
      }
      return updateFirstTextBlock(section, cleanText);
    case "skills":
    case "languages": {
      const nextItems = splitAiListText(cleanText).map((name, index) => ({
        ...(items[index] ?? {}),
        id: String(items[index]?.id ?? `${section.type}-${uuidv4()}`),
        name,
        level: String(items[index]?.level ?? "Intermediate"),
      }));
      return {
        ...section,
        structuredContent: nextItems as CvSection["structuredContent"],
      };
    }
    case "achievements": {
      const nextItems = splitAiListText(cleanText).map((line, index) => ({
        ...(items[index] ?? {}),
        id: String(items[index]?.id ?? `achievement-${uuidv4()}`),
        text: line,
      }));
      return {
        ...section,
        structuredContent: nextItems as CvSection["structuredContent"],
      };
    }
    case "certifications": {
      const nextItems = splitAiListText(cleanText).map((line, index) => ({
        ...(items[index] ?? {}),
        id: String(items[index]?.id ?? `certification-${uuidv4()}`),
        certificationName: line,
      }));
      return {
        ...section,
        structuredContent: nextItems as CvSection["structuredContent"],
      };
    }
    default:
      return updateFirstTextBlock(section, cleanText);
  }
}

function appendListSuggestionToSection(section: CvSection, value: string): CvSection {
  const clean = value.trim();
  if (!clean) return section;
  const items = getStructuredItems(section).filter((item) =>
    Boolean(String(item.name ?? item.text ?? "").trim()),
  );
  const existing = new Set(
    items
      .map((item) => String(item.name ?? item.text ?? "").trim())
      .filter(Boolean)
      .map((item) => normalizeListName(item)),
  );
  if (existing.has(normalizeListName(clean))) return section;

  if (section.type === "languages") {
    return {
      ...section,
      structuredContent: [
        ...items,
        {
          id: `language-${uuidv4()}`,
          name: clean,
          level: "Intermediate",
        },
      ] as CvSection["structuredContent"],
    };
  }

  if (section.type === "skills") {
    return {
      ...section,
      structuredContent: [
        ...items,
        {
          id: `skill-${uuidv4()}`,
          name: clean,
          level: "Intermediate",
        },
      ] as CvSection["structuredContent"],
    };
  }

  if (String(section.type) === "hobbies" || section.title.trim().toLowerCase() === "hobbies") {
    return {
      ...section,
      structuredContent: [
        ...items,
        {
          id: `hobby-${uuidv4()}`,
          name: clean,
        },
      ] as CvSection["structuredContent"],
    };
  }

  return section;
}

function readStoredCvForgeWorkspaceMode(): CvForgeWorkspaceMode {
  if (typeof window === "undefined") {
    return "edit";
  }

  return window.localStorage.getItem(CV_FORGE_WORKSPACE_MODE_STORAGE_KEY) ===
    "preview"
    ? "preview"
    : "edit";
}

function readImportRecoverySession(
  currentCv: CvDocument | null | undefined,
): ImportRecoverySession | null {
  const candidate = currentCv?.metadata?.importRecoverySession;
  if (!candidate || typeof candidate !== "object") return null;
  const session = candidate as ImportRecoverySession;
  if (!Array.isArray(session.items) || session.items.length === 0) return null;
  return session;
}

function buildImportReviewBlocks(
  currentCv: CvDocument | null | undefined,
): CvImportReviewBlock[] {
  const session = readImportRecoverySession(currentCv);
  if (!session) return [];

  return session.items
    .filter((item) => item.reviewStatus === "pending")
    .map((item) => ({
      id: item.blockId,
      title:
        item.sourceSectionTitle ||
        item.selectedSectionTitle ||
        item.predictedSection,
      original: item.rawText || item.cleanedText,
      parsed: item.cleanedText || item.rawText,
      status: "uncertain" as const,
    }));
}

function getCvSectionId(section: CvSection, index: number): string {
  return String(section.id ?? `${section.type}-${index}`);
}

function findSectionById(sections: CvSection[], sectionId: string): CvSection | null {
  return (
    sections.find((section, index) => getCvSectionId(section, index) === sectionId) ??
    null
  );
}

function getSectionTarget(
  section: CvSection | null | undefined,
): ResumeActiveTarget | null {
  if (!section) return null;
  const sectionType = getCanonicalSectionType(section);
  if (!sectionType) return null;
  return {
    sectionType,
    previewSectionType: sectionType,
    sectionId: section.id ? String(section.id) : undefined,
    source: "editor-focus",
  };
}

function focusPreviewSection(sectionId: string): void {
  if (typeof document === "undefined") return;

  window.requestAnimationFrame(() => {
    const escapedSectionId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(sectionId)
        : sectionId.replace(/"/g, '\\"');
    const target = document.querySelector<HTMLElement>(
      `[data-preview-section-id="${escapedSectionId}"]`,
    );
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    const viewport = target.closest<HTMLElement>(".dasti-doc-viewport--resume");
    if (!viewport) return;
    const targetRect = target.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const nextTop =
      viewport.scrollTop +
      targetRect.top -
      viewportRect.top -
      Math.max(0, (viewport.clientHeight - targetRect.height) / 2);
    viewport.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "auto",
    });
  });
}

function makeTextBlock(title: string, text = "") {
  return {
    id: uuidv4(),
    title,
    type: "text" as const,
    content: ensureRemirrorDoc(text),
    plainText: text,
    attributes: {},
  };
}

function makeDraftSection(sectionKind: CvAddSectionKind): CvSection {
  if (sectionKind === "projects") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Projects",
      type: "projects",
      blocks: [
        {
          ...makeTextBlock("Project"),
          attributes: { linkedStructuredId: itemId },
        },
      ],
      structuredContent: [
        {
          id: itemId,
          title: "",
          meta: "",
          description: "",
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "certifications") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Certifications",
      type: "certifications",
      blocks: [
        {
          ...makeTextBlock("Certification"),
          attributes: { linkedStructuredId: itemId },
        },
      ],
      structuredContent: [
        {
          id: itemId,
          certificationName: "",
          issuingOrganization: "",
          issueDate: undefined,
          expirationDate: null,
          credentialId: "",
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "achievements") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Achievements",
      type: "achievements",
      blocks: [],
      structuredContent: [
        {
          id: itemId,
          text: "",
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "languages") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Languages",
      type: "languages",
      blocks: [],
      structuredContent: [
        {
          id: itemId,
          name: "",
          level: "Intermediate",
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "hobbies") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Hobbies",
      type: "text",
      blocks: [],
      structuredContent: [
        {
          id: itemId,
          name: "",
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "additional_information") {
    return {
      id: uuidv4(),
      title: "Additional information",
      type: "text",
      blocks: [makeTextBlock("Additional information")],
      structuredContent: null,
      collapsed: false,
    };
  }

  const titles: Record<
    Exclude<
      CvAddSectionKind,
      | "projects"
      | "certifications"
      | "achievements"
      | "languages"
      | "hobbies"
      | "additional_information"
    >,
    string
  > = {
    publications: "Publications",
    awards: "Awards",
    volunteer: "Volunteer",
    references: "References",
    custom: "Custom section",
  };
  const title = titles[sectionKind];
  return {
    id: uuidv4(),
    title,
    type: "text",
    blocks: [makeTextBlock(title)],
    structuredContent: null,
    collapsed: false,
  };
}

function resolveAccentStyle(accent: CvAccentChoice): Partial<VerbatiStylePreset> {
  switch (accent) {
    case "terre":
      return { palette: "custom", accentHex: "#A84E2E" };
    case "ink":
      return { palette: "custom", accentHex: "#0F0C08" };
    case "cobalt":
      return { palette: "custom", accentHex: "#2A78D6" };
    case "sauge":
      return { palette: "sauge", accentHex: undefined };
    case "plum":
      return { palette: "custom", accentHex: "#7A4FA0" };
    case "ochre":
      return { palette: "ocre", accentHex: undefined };
  }
}

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Baskervville + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const setJobResume = useMutation(
    ((api as any).jobsPublic?.setResumeForJob ??
      "jobsPublic.setResumeForJob") as any,
  );
  const {
    currentCv,
    currentCvId,
    createNewCv,
    importCv,
    loadCv,
  } = useCvLibrary();
  const { importFile: importStructuredCvFile } = useStructuredMistralImport({
    probeOnMount: false,
  });
  const runCvSectionAiAction = useAction(
    ((api.functions as any)?.runCvSectionAiAction ??
      "functions.runCvSectionAiAction") as any,
  );
  const defaultProposalSettings = useQuery(
    ((api.proposalSettings as any)?.getCurrent ??
      "proposalSettings.getCurrent") as any,
    isConvexAuthenticated ? {} : "skip",
  ) as { voicePreset?: unknown; savedVoicePreset?: unknown } | undefined;
  const cvImportInputRef = React.useRef<HTMLInputElement | null>(null);
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() =>
      readStoredCvForgeWorkspaceMode(),
    );
  const [resumeLinkIntent, setResumeLinkIntent] =
    React.useState<ResumeLinkIntent | null>(null);
  const [resumeActiveTarget, setResumeActiveTarget] =
    React.useState<ResumeActiveTarget | null>(null);
  const [hiddenSectionIds, setHiddenSectionIds] = React.useState<string[]>([]);
  const [cvRailTab, setCvRailTab] = React.useState<CvRailTab>("sections");
  const cvTone = mapDefaultVoicePresetToCvTone(
    defaultProposalSettings?.savedVoicePreset ?? defaultProposalSettings?.voicePreset,
  );
  const [cvRailAiSuggestion, setCvRailAiSuggestion] =
    React.useState<CvRailAiSuggestion | null>(null);
  const [cvRailAppliedAiEdit, setCvRailAppliedAiEdit] =
    React.useState<CvRailAppliedAiEdit | null>(null);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(
    null,
  );
  const [pendingActiveSection, setPendingActiveSection] =
    React.useState<CvSection | null>(null);
  const [sectionEditorOpen, setSectionEditorOpen] = React.useState(false);
  const [importReviewOpen, setImportReviewOpen] = React.useState(false);
  const [dismissedImportReviewCvIds, setDismissedImportReviewCvIds] =
    React.useState<string[]>([]);
  const currentSections = React.useMemo<CvSection[]>(
    () => ((currentCv?.sections ?? []) as CvSection[]),
    [currentCv?.sections],
  );

  const handleResumeLinkIntent = React.useCallback(
    (intent: ResumeLinkIntent) => {
      const matchedSection =
        (intent.sectionId ? findSectionById(currentSections, intent.sectionId) : null) ??
        currentSections.find(
          (section) => getCanonicalSectionType(section) === intent.sectionType,
        ) ??
        null;
      const matchedSectionId = matchedSection?.id ? String(matchedSection.id) : null;
      if (matchedSectionId) {
        setActiveSectionId(matchedSectionId);
        setSectionEditorOpen(true);
        focusPreviewSection(matchedSectionId);
      }
      setResumeLinkIntent(intent);
      setResumeActiveTarget({
        sectionType: intent.sectionType,
        previewSectionType: intent.previewSectionType,
        itemId: intent.itemId,
        sectionId: matchedSectionId ?? intent.sectionId,
        source: intent.source,
      });
      if (workspaceMode === "preview" && !intent.shouldOpenModal) {
        setWorkspaceMode("edit");
      }
    },
    [currentSections, workspaceMode],
  );

  const handleResumeLinkIntentHandled = React.useCallback(
    (requestId: string) => {
      setResumeLinkIntent((currentIntent) =>
        currentIntent?.requestId === requestId ? null : currentIntent,
      );
    },
    [],
  );
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    importCv,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const filteredPreviewCv = React.useMemo(
    () => applyHiddenSectionsToCvDocument(currentCv, hiddenSectionIds),
    [currentCv, hiddenSectionIds],
  );
  const resumePreviewData = React.useMemo(
    () =>
      filteredPreviewCv
        ? buildCanonicalResumeRenderModelFromCv(filteredPreviewCv)
        : null,
    [filteredPreviewCv],
  );
  const hasResumePaper = hasRenderableResumeData(resumePreviewData);
  const sanitizedHiddenSectionIds = React.useMemo(
    () => sanitizeHiddenSectionIds(currentCv?.sections ?? [], hiddenSectionIds),
    [currentCv?.sections, hiddenSectionIds],
  );
  const activeSection = React.useMemo(
    () => {
      if (
        pendingActiveSection?.id &&
        String(pendingActiveSection.id) === activeSectionId
      ) {
        return pendingActiveSection;
      }
      return (
        currentSections.find(
          (section, index) => getCvSectionId(section, index) === activeSectionId,
        ) ??
        pendingActiveSection ??
        currentSections[0] ??
        null
      );
    },
    [activeSectionId, currentSections, pendingActiveSection],
  );
  const importReviewBlocks = React.useMemo(
    () => buildImportReviewBlocks(currentCv),
    [currentCv],
  );
  const importReviewSummary = React.useMemo(() => {
    if (importReviewBlocks.length === 0) return "";
    return importReviewBlocks
      .slice(0, 2)
      .map((block) => block.title)
      .join(", ");
  }, [importReviewBlocks]);
  const isImportReviewBannerDismissed = currentCv?.id
    ? dismissedImportReviewCvIds.includes(String(currentCv.id))
    : false;
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(
    null,
  );
  const { showToast } = useToast();
  const [isCreatingEntryCv, setIsCreatingEntryCv] = React.useState(false);
  const [isImportingEntryCv, setIsImportingEntryCv] = React.useState(false);
  const [entryPickerTransitionCvId, setEntryPickerTransitionCvId] =
    React.useState<string | null>(null);
  const [pendingFreshEntryBaseCvId, setPendingFreshEntryBaseCvId] =
    React.useState<string | null>(null);
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );
  const requestedJobId = React.useMemo(
    () => new URLSearchParams(search).get("jobId") || undefined,
    [search],
  );
  const jobDetailRoute = requestedJobId
    ? `/jobs/${encodeURIComponent(requestedJobId)}`
    : null;
  React.useEffect(() => {
    if (
      !entryPickerTransitionCvId ||
      entryPickerTransitionCvId === ENTRY_PICKER_PENDING_ROUTE_ID
    ) {
      return;
    }

    if (requestedCvId === entryPickerTransitionCvId) {
      setEntryPickerTransitionCvId(null);
    }
  }, [entryPickerTransitionCvId, requestedCvId]);

  React.useEffect(() => {
    setCvRailAiSuggestion(null);
    setCvRailAppliedAiEdit(null);
  }, [currentCv?.id]);

  React.useEffect(() => {
    setCvRailAiSuggestion((current) => {
      if (!current || !activeSectionId) return current;
      return current.sectionId === activeSectionId ? current : null;
    });
  }, [activeSectionId]);

  const navigateToSelectedCv = React.useCallback(
    (cvId: string) => {
      const nextParams = new URLSearchParams(search);
      nextParams.set("id", cvId);
      const nextSearch = nextParams.toString();
      void navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        {
          replace: true,
          state: location.state,
        },
      );
    },
    [location.pathname, location.state, navigate, search],
  );

  React.useEffect(() => {
    if (!pendingFreshEntryBaseCvId || !currentCvId) {
      return;
    }
    if (currentCvId === pendingFreshEntryBaseCvId) {
      return;
    }

    const nextResumeName =
      typeof currentCv?.title === "string" && currentCv.title.trim().length > 0
        ? currentCv.title.trim()
        : "Untitled CV";

    setPendingFreshEntryBaseCvId(null);

    void (async () => {
      try {
        if (requestedJobId) {
          await setJobResume({
            jobId: requestedJobId,
            resumeId: currentCvId,
            resumeName: nextResumeName,
          });
          loadCv(currentCvId);
          if (jobDetailRoute) {
            void navigate(jobDetailRoute);
          }
          return;
        }

        setEntryPickerTransitionCvId(currentCvId);
        loadCv(currentCvId);
        navigateToSelectedCv(currentCvId);
      } catch (error) {
        setEntryPickerTransitionCvId(null);
        showToast("Attach failed.", { variant: "error" });
      }
    })();
  }, [
    currentCv?.title,
    currentCvId,
    jobDetailRoute,
    loadCv,
    navigate,
    navigateToSelectedCv,
    pendingFreshEntryBaseCvId,
    requestedJobId,
    setJobResume,
    showToast,
  ]);

  React.useEffect(() => {
    const nextCvId = currentCv?.id ? String(currentCv.id) : null;
    if (!nextCvId) {
      setHiddenSectionIds([]);
      return;
    }

    setHiddenSectionIds(
      sanitizeHiddenSectionIds(
        currentCv?.sections ?? [],
        readStoredHiddenSectionIds(nextCvId),
      ),
    );
  }, [currentCv?.id]);

  React.useEffect(() => {
    if (sanitizedHiddenSectionIds.join("|") === hiddenSectionIds.join("|")) {
      return;
    }

    setHiddenSectionIds(sanitizedHiddenSectionIds);
  }, [hiddenSectionIds, sanitizedHiddenSectionIds]);

  React.useEffect(() => {
    writeStoredHiddenSectionIds(
      currentCv?.id ? String(currentCv.id) : null,
      hiddenSectionIds,
    );
  }, [currentCv?.id, hiddenSectionIds]);
  React.useEffect(() => {
    if (currentSections.length === 0) {
      setActiveSectionId(null);
      setSectionEditorOpen(false);
      return;
    }

    const currentActiveSection =
      activeSectionId !== null ? findSectionById(currentSections, activeSectionId) : null;
    const hasActiveSection =
      activeSectionId !== null && currentActiveSection !== null;
    if (!hasActiveSection) {
      if (
        pendingActiveSection?.id &&
        String(pendingActiveSection.id) === activeSectionId
      ) {
        return;
      }
      const nextSection = currentSections[0];
      setActiveSectionId(getCvSectionId(nextSection, 0));
      setResumeActiveTarget(getSectionTarget(nextSection));
    } else if (
      pendingActiveSection &&
      String(pendingActiveSection.id ?? "") !== activeSectionId
    ) {
      setPendingActiveSection(null);
    } else if (
      pendingActiveSection &&
      currentActiveSection &&
      JSON.stringify(currentActiveSection) === JSON.stringify(pendingActiveSection)
    ) {
      setPendingActiveSection(null);
    }
  }, [activeSectionId, currentSections, pendingActiveSection]);
  const requestedJobRecord = useQuery(
    ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    requestedJobId && isConvexAuthenticated
      ? { jobId: requestedJobId }
      : "skip",
  ) as CvForgeCanonicalJob | undefined;
  const selectedJobRecord = requestedJobRecord ?? null;

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      CV_FORGE_WORKSPACE_MODE_STORAGE_KEY,
      workspaceMode,
    );
  }, [workspaceMode]);

  const authoritativeResume = React.useMemo(
    () => readAuthoritativeResumeFromCv(currentCv),
    [currentCv],
  );
  const authoritativeExportModel = React.useMemo(
    () => buildAuthoritativeResumeExportModel(authoritativeResume),
    [authoritativeResume],
  );
  const hasTrustedExport = authoritativeExportModel !== null;

  const handleResumeExport = React.useCallback(
    async (request: ResumeExportRequest) => {
      dbg(
        "[CvForge] export authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            currentCv?.metadata?.authoritativeResume,
          ),
        }),
      );

      if (!currentCv) {
        showToast("Open a resume first.", {
          variant: "warning",
        });
        return;
      }

      const exportCurrentCv = filteredPreviewCv ?? currentCv;

      const exportKey =
        request.format === "pdf" ? `pdf:${request.mode}` : request.format;
      setExportingFormat(exportKey);
      try {
        await (request.format === "pdf" || request.format === "docx"
          ? (async () => {
              const exportFormat: ExportDocumentFormat =
                request.format === "pdf" ? "pdf" : "docx";
              const pdfMode =
                request.format === "pdf" ? request.mode : undefined;
              const isStyledPdf = pdfMode === "styled";
              const source =
                isStyledPdf
                  ? buildStyledResumePrintSource({
                      currentCv: exportCurrentCv,
                      stylePreset,
                    })
                  : buildResumeExportSource({
                      currentCv: exportCurrentCv,
                      authoritativeResume,
                      stylePreset,
                    });

              if (!source) {
                throw new Error("Resume export source is unavailable.");
              }

              const styledMetadata =
                isStyledPdf && "renderSource" in source
                  ? {
                      resumeTypographyAudit:
                        buildResumeTypographyAuditMetadata({
                          cvId: String(currentCv.id),
                          cvUrl:
                            typeof window !== "undefined"
                              ? window.location.href
                              : null,
                          rendererVariantId: source.rendererVariantId,
                          stylePreset: source.stylePreset,
                          previewCapture: readResumePreviewDebugCapture(),
                          timestamp: Date.now(),
                        }),
                    }
                  : undefined;

              if (isStyledPdf && "renderSource" in source) {
                const previewCapture = readResumePreviewDebugCapture();
                const exportContext = {
                  cvId: currentCv?.id ? String(currentCv.id) : null,
                  cvUrl:
                    typeof window !== "undefined" ? window.location.href : null,
                  rendererVariantId: source.rendererVariantId,
                  stylePreset: source.stylePreset,
                  previewCapture,
                  timestamp: Date.now(),
                } as const;
                setStyledResumeExportContext(exportContext);

                dbg(
                  "[CvForge] styled resume export snapshot",
                  buildResumePrintDebugSnapshot({
                    stylePreset: source.stylePreset,
                    rendererVariantId: source.rendererVariantId,
                  }),
                );
              }

              return exportDocumentFile({
                kind: "resume",
                format: exportFormat,
                mode: pdfMode,
                data: source,
                stylePreset: stylePreset,
                fileNameBase:
                  exportFormat === "docx"
                    ? "Resume - Editable"
                    : pdfMode === "ats"
                      ? "Resume - ATS"
                      : "Resume - Styled",
                metadata: styledMetadata,
              });
            })()
          : hasTrustedExport && authoritativeResume
            ? downloadAuthoritativeResumeExport({
                authoritativeResume,
                format: request.format,
              })
            : downloadStandardResumeExport({
                document: exportCurrentCv,
                format: request.format,
              }));
        showToast("Exported.", { variant: "success" });
      } catch (error) {
        console.error("[CvForge] export failed", error);
        showToast("Export failed.", { variant: "error" });
      } finally {
        setExportingFormat(null);
      }
    },
    [
      authoritativeResume,
      currentCv,
      filteredPreviewCv,
      hasTrustedExport,
      showToast,
      stylePreset,
    ],
  );

  const cvWorkbenchShellStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    marginInline: "auto",
  };
  const showJobBriefContext = Boolean(requestedJobId);
  const isEntryPickerBusy = isCreatingEntryCv || isImportingEntryCv;

  const handleClearJobContext = React.useCallback(() => {
    const nextParams = new URLSearchParams(search);
    nextParams.delete("jobId");
    const nextSearch = nextParams.toString();
    void navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : "",
    });
  }, [location.pathname, navigate, search]);

  const handleSelectSection = React.useCallback(
    (sectionId: string, options?: { openEditor?: boolean }) => {
      const section = findSectionById(currentSections, sectionId);
      setActiveSectionId(sectionId);
      setResumeActiveTarget(getSectionTarget(section));
      focusPreviewSection(sectionId);
      if (options?.openEditor) {
        setSectionEditorOpen(true);
      }
    },
    [currentSections],
  );

  const handleAskAiForSection = React.useCallback((sectionId: string) => {
    const section = findSectionById(currentSections, sectionId);
    setCvRailAiSuggestion(null);
    setActiveSectionId(sectionId);
    setResumeActiveTarget(getSectionTarget(section));
    focusPreviewSection(sectionId);
    setCvRailTab("ai");
  }, [currentSections]);

  const handleSectionChange = React.useCallback(
    (nextSection: CvSection) => {
      if (!currentCv || !activeSectionId) return;
      const now = new Date().toISOString();
      const nextSections = currentSections.map((section, index) =>
        getCvSectionId(section, index) === activeSectionId ? nextSection : section,
      );
      setPendingActiveSection(nextSection);
      setActiveSectionId(activeSectionId);
      setResumeActiveTarget(getSectionTarget(nextSection));
      void importCv({
        ...currentCv,
        metadata: buildUpdatedCvMetadata(currentCv, now),
        sections: nextSections,
      });
    },
    [activeSectionId, currentCv, currentSections, importCv],
  );

  const handleSectionEditorSave = React.useCallback(
    (section: CvSection | null) => {
      if (!currentCv || !activeSectionId) return;
      if (section) {
        const now = new Date().toISOString();
        const nextSections = currentSections.map((currentSection, index) =>
          getCvSectionId(currentSection, index) === activeSectionId
            ? section
            : currentSection,
        );
        void importCv({
          ...currentCv,
          metadata: buildUpdatedCvMetadata(currentCv, now),
          sections: nextSections,
        });
        setPendingActiveSection(section);
        setResumeActiveTarget(getSectionTarget(section));
      }
      setActiveSectionId(activeSectionId);
      focusPreviewSection(activeSectionId);
    },
    [activeSectionId, currentCv, currentSections, importCv],
  );

  const persistSections = React.useCallback(
    (nextSections: CvSection[]) => {
      if (!currentCv) return;
      const now = new Date().toISOString();
      void importCv({
        ...currentCv,
        metadata: buildUpdatedCvMetadata(currentCv, now),
        sections: nextSections,
      });
    },
    [currentCv, importCv],
  );

  const handleAddSection = React.useCallback(
    (sectionKind: CvAddSectionKind) => {
      if (!currentCv) {
        showToast("Open or create a CV first.", { variant: "warning" });
        return;
      }
      const nextSection = makeDraftSection(sectionKind);
      const now = new Date().toISOString();
      void importCv({
        ...currentCv,
        metadata: buildUpdatedCvMetadata(currentCv, now),
        sections: [...currentSections, nextSection],
      });
      const nextSectionId = String(nextSection.id);
      setPendingActiveSection(nextSection);
      setActiveSectionId(nextSectionId);
      setResumeActiveTarget(getSectionTarget(nextSection));
      setSectionEditorOpen(true);
      window.requestAnimationFrame(() => focusPreviewSection(nextSectionId));
    },
    [currentCv, currentSections, importCv, showToast],
  );

  const handleToggleHiddenSection = React.useCallback((sectionId: string) => {
    const isCurrentlyHidden = hiddenSectionIds.includes(sectionId);
    const nextHiddenSectionIds = isCurrentlyHidden
      ? hiddenSectionIds.filter((id) => id !== sectionId)
      : [...hiddenSectionIds, sectionId];

    setHiddenSectionIds(nextHiddenSectionIds);

    if (isCurrentlyHidden) {
      setActiveSectionId(sectionId);
      focusPreviewSection(sectionId);
      return;
    }

    if (activeSectionId !== sectionId) return;

    const nextVisibleSection = currentSections.find((section, index) => {
      const candidateId = getCvSectionId(section, index);
      return candidateId !== sectionId && !nextHiddenSectionIds.includes(candidateId);
    });
    const nextVisibleSectionId = nextVisibleSection?.id
      ? String(nextVisibleSection.id)
      : null;

    setActiveSectionId(nextVisibleSectionId);
    setResumeActiveTarget(getSectionTarget(nextVisibleSection));
    if (nextVisibleSectionId) {
      focusPreviewSection(nextVisibleSectionId);
    }
  }, [activeSectionId, currentSections, hiddenSectionIds]);

  const handleDeleteSection = React.useCallback(
    (sectionId: string) => {
      if (!currentCv) return;
      const sectionIndex = currentSections.findIndex(
        (section, index) => getCvSectionId(section, index) === sectionId,
      );
      if (sectionIndex < 0) return;

      const removedSection = currentSections[sectionIndex];
      const nextSections = currentSections.filter((_, index) => index !== sectionIndex);
      persistSections(nextSections);
      setHiddenSectionIds((current) => current.filter((id) => id !== sectionId));

      const nextActiveSection = nextSections[Math.min(sectionIndex, nextSections.length - 1)] ?? null;
      const nextActiveSectionId = nextActiveSection?.id
        ? String(nextActiveSection.id)
        : null;
      setActiveSectionId(nextActiveSectionId);
      setResumeActiveTarget(getSectionTarget(nextActiveSection));
      if (nextActiveSectionId) {
        focusPreviewSection(nextActiveSectionId);
      }

      showToast("Section deleted.", {
        variant: "success",
        action: {
          label: "Undo",
          onClick: () => {
            const restoredSections = [
              ...nextSections.slice(0, sectionIndex),
              removedSection,
              ...nextSections.slice(sectionIndex),
            ];
            persistSections(restoredSections);
            const restoredSectionId = getCvSectionId(removedSection, sectionIndex);
            setActiveSectionId(restoredSectionId);
            setResumeActiveTarget(getSectionTarget(removedSection));
            focusPreviewSection(restoredSectionId);
          },
        },
      });
    },
    [currentCv, currentSections, persistSections, showToast],
  );

  const handleReorderSections = React.useCallback(
    (activeId: string, overId: string) => {
      const fromIndex = currentSections.findIndex(
        (section, index) => getCvSectionId(section, index) === activeId,
      );
      const toIndex = currentSections.findIndex(
        (section, index) => getCvSectionId(section, index) === overId,
      );
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

      const nextSections = [...currentSections];
      const [movedSection] = nextSections.splice(fromIndex, 1);
      nextSections.splice(toIndex, 0, movedSection);
      persistSections(
        nextSections.map((section, order) => ({
          ...section,
          order,
        })),
      );
      setActiveSectionId(activeId);
      focusPreviewSection(activeId);
    },
    [currentSections, persistSections],
  );

  const handleMoveSection = React.useCallback(
    (sectionId: string, direction: -1 | 1) => {
      const currentIndex = currentSections.findIndex(
        (section, index) => getCvSectionId(section, index) === sectionId,
      );
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentSections.length) {
        return;
      }
      handleReorderSections(
        sectionId,
        getCvSectionId(currentSections[nextIndex], nextIndex),
      );
    },
    [currentSections, handleReorderSections],
  );

  const handleDismissImportReviewBanner = React.useCallback(() => {
    if (!currentCv?.id) return;
    setDismissedImportReviewCvIds((current) =>
      current.includes(String(currentCv.id))
        ? current
        : [...current, String(currentCv.id)],
    );
  }, [currentCv?.id]);

  const handleSelectTemplate = React.useCallback(
    (template: "editorial" | "minimal" | "classic") => {
      const layout = template === "editorial" ? "workshop" : "swiss";
      setStylePreset((current) =>
        resolveVerbatiStyle({
          ...current,
          familyId: layout,
          layout,
        }),
      );
    },
    [setStylePreset],
  );

  const handleSelectFontPair = React.useCallback(
    (fontPairId: VerbatiFontPairId) => {
      setStylePreset((current) =>
        resolveVerbatiStyle({
          ...current,
          typography: fontPairId,
        }),
      );
    },
    [setStylePreset],
  );

  const handleSelectAccent = React.useCallback(
    (accent: CvAccentChoice) => {
      setStylePreset((current) =>
        resolveVerbatiStyle({
          ...current,
          ...resolveAccentStyle(accent),
        }),
      );
    },
    [setStylePreset],
  );

  const handleRunAskAiForSection = React.useCallback(
    async ({
      sectionId,
      prompt,
      tone,
    }: {
      sectionId: string;
      prompt: string;
      tone: CvToneChoice;
    }) => {
      const section = findSectionById(currentSections, sectionId);
      if (!section) return;
      setCvRailAppliedAiEdit((current) =>
        current?.sectionId === sectionId ? null : current,
      );

      const sectionLabel = section.title || "Section";
      const isHobbiesSection =
        String(section.type) === "hobbies" ||
        section.title.trim().toLowerCase() === "hobbies";
      if (section.type === "skills" || section.type === "languages" || isHobbiesSection) {
        const existingItems = getListSectionItems(section);
        const excludedItems =
          isHobbiesSection ? getCurrentCvSkills(currentCv) : [];
        const beforeText = existingItems.join("\n");
        const interactionId = createAiInteractionId();
        recordAiInteractionEvent({
          name: "ai_started",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
        });
        setCvRailAiSuggestion({
          kind: "list",
          sectionId,
          sectionLabel,
          beforeText,
          items: [],
          state: "loading",
          interactionId,
        });

        try {
          let suggestions: string[] = [];

          if (section.type === "skills") {
            if (typeof runCvSectionAiAction !== "function") {
              throw new Error("CV AI action is unavailable.");
            }
            const result = await runCvSectionAiAction({
              action: "generate_skills_suggestions",
              summary: getCurrentCvSummaryText(currentCv),
              experiences: getCurrentCvExperiences(currentCv),
              educations: getCurrentCvEducations(currentCv),
              existingItems,
              excludeItems: [],
              maxItems: 6,
            });
            suggestions =
              result?.kind === "list" && Array.isArray(result.items)
                ? result.items.map((item: unknown) => String(item ?? ""))
                : [];
          } else if (section.type === "languages") {
            if (typeof runCvSectionAiAction !== "function") {
              throw new Error("CV AI action is unavailable.");
            }
            const result = await runCvSectionAiAction({
              action: "generate_language_suggestions",
              summary: getCurrentCvSummaryText(currentCv),
              experiences: getCurrentCvExperiences(currentCv),
              educations: getCurrentCvEducations(currentCv),
              existingItems,
              excludeItems: [],
              maxItems: 5,
            });
            suggestions =
              result?.kind === "list" && Array.isArray(result.items)
                ? result.items.map((item: unknown) => String(item ?? ""))
                : [];
          } else {
            if (typeof runCvSectionAiAction !== "function") {
              throw new Error("CV AI action is unavailable.");
            }
            const result = await runCvSectionAiAction({
              action: "generate_hobby_suggestions",
              summary: getCurrentCvSummaryText(currentCv),
              skills: getCurrentCvSkills(currentCv),
              experiences: getCurrentCvExperiences(currentCv),
              educations: getCurrentCvEducations(currentCv),
              existingItems,
              excludeItems: excludedItems,
              maxItems: 6,
            });
            suggestions =
              result?.kind === "list" && Array.isArray(result.items)
                ? result.items.map((item: unknown) => String(item ?? ""))
                : [];
          }

          const nextItems = filterNewListSuggestions(suggestions, [
            ...existingItems,
            ...excludedItems,
          ]);
          recordAiInteractionEvent({
            name: "ai_completed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            applyMode: "preview_required",
          });
          setCvRailAiSuggestion({
            kind: "list",
            sectionId,
            sectionLabel,
            beforeText,
            items: nextItems,
            state: "ready",
            interactionId,
          });
        } catch (error) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            errorKind: "request_failed",
          });
          setCvRailAiSuggestion({
            kind: "list",
            sectionId,
            sectionLabel,
            beforeText,
            items: [],
            state: "error",
            errorMessage:
              error instanceof Error && error.message
                ? error.message
                : "AI suggestions are unavailable for this section.",
            interactionId,
          });
          showToast("AI unavailable.", { variant: "error" });
        }
        return;
      }

      if (section.type !== "summary" && section.type !== "text") {
        setSectionEditorOpen(true);
        showToast("Use the item editor for this section.", { variant: "info" });
        return;
      }

      const beforeText = readCvSectionAiText(section);
      const selectedText = beforeText.trim();
      if (!selectedText && section.type !== "summary") {
        showToast("Section has no text for AI to rewrite.", {
          variant: "warning",
        });
        return;
      }

      const interactionId = createAiInteractionId();
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "section_editor",
        actionId: "custom",
      });

      setCvRailAiSuggestion({
        sectionId,
        sectionLabel,
        beforeText: selectedText || "No summary yet.",
        afterText: "",
        state: "loading",
        interactionId,
      });

      try {
        if (section.type === "summary") {
          if (typeof runCvSectionAiAction !== "function") {
            throw new Error("CV AI action is unavailable.");
          }
          const cvContext = buildCvContextForSummaryAskAi(currentCv);
          const result = await runCvSectionAiAction({
            action: selectedText
              ? "improve_summary_text"
              : "rewrite_summary_from_profile",
            existingText: selectedText,
            summary: selectedText || getCurrentCvSummaryText(currentCv),
            skills: getCurrentCvSkills(currentCv),
            experiences: getCurrentCvExperiences(currentCv),
            educations: getCurrentCvEducations(currentCv),
            languages: getCurrentCvLanguages(currentCv),
            instruction: [
              `User request: ${prompt}`,
              `Tone preference: ${tone}.`,
              cvContext
                ? `CV context, use only when relevant:\n${cvContext}`
                : "CV context: none.",
              "Follow the user request first. Return only the replacement text.",
            ].join("\n\n"),
          });
          const summaryText = readAiResultText(result);
          if (!summaryText) {
            recordAiInteractionEvent({
              name: "ai_failed",
              interactionId,
              surface: "section_editor",
              actionId: "custom",
              errorKind: "empty_result",
            });
            setCvRailAiSuggestion({
              sectionId,
              sectionLabel,
              beforeText: selectedText || "No summary yet.",
              afterText: "",
              state: "error",
              errorMessage: "AI returned no usable section text.",
              interactionId,
            });
            return;
          }
          recordAiInteractionEvent({
            name: "ai_completed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            applyMode: "preview_required",
            outputMode: "replace_selection",
          });
          setCvRailAiSuggestion({
            sectionId,
            sectionLabel,
            beforeText: selectedText || "No summary yet.",
            afterText: summaryText,
            state: "ready",
            interactionId,
          });
          return;
        }

        if (typeof runCvSectionAiAction !== "function") {
          throw new Error("CV AI action is unavailable.");
        }
        const result = await runCvSectionAiAction({
          action: "improve_custom_text",
          instruction: prompt,
          existingText: selectedText,
        });
        const normalizedText = readAiResultText(result);
        if (!normalizedText) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            errorKind: "empty_result",
          });
          setCvRailAiSuggestion({
            sectionId,
            sectionLabel,
            beforeText: selectedText,
            afterText: "",
            state: "error",
            errorMessage: "AI returned no usable section text.",
            interactionId,
          });
          return;
        }

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
          applyMode: "preview_required",
          outputMode: "replace_selection",
        });
        setCvRailAiSuggestion({
          sectionId,
          sectionLabel,
          beforeText: selectedText,
          afterText: normalizedText,
          state: "ready",
          interactionId,
        });
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
          errorKind: "request_failed",
        });
        setCvRailAiSuggestion({
          sectionId,
          sectionLabel,
          beforeText: selectedText,
          afterText: "",
          state: "error",
          errorMessage:
            error instanceof Error && error.message
              ? error.message
              : "AI is unavailable for this section.",
          interactionId,
        });
        showToast("AI unavailable.", { variant: "error" });
      }
    },
    [currentCv, currentSections, runCvSectionAiAction, showToast],
  );

  const handleAcceptAiSuggestion = React.useCallback(() => {
    if (
      !cvRailAiSuggestion ||
      cvRailAiSuggestion.kind === "list" ||
      cvRailAiSuggestion.state !== "ready"
    ) return;
    let appliedEdit: CvRailAppliedAiEdit | null = null;
    const nextSections = currentSections.map((section, index) =>
      getCvSectionId(section, index) === cvRailAiSuggestion.sectionId
        ? (() => {
            appliedEdit = {
              sectionId: cvRailAiSuggestion.sectionId,
              sectionLabel: cvRailAiSuggestion.sectionLabel,
              previousText: readCvSectionAiText(section),
            };
            return applyAiTextToSection(section, cvRailAiSuggestion.afterText);
          })()
        : section,
    );
    persistSections(nextSections);
    recordAiInteractionEvent({
      name: "ai_accepted",
      interactionId: cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
      surface: "section_editor",
      actionId: "custom",
    });
    setCvRailAiSuggestion(null);
    setCvRailAppliedAiEdit(appliedEdit);
    focusPreviewSection(cvRailAiSuggestion.sectionId);
  }, [currentSections, cvRailAiSuggestion, persistSections]);

  const handleUndoAiSuggestion = React.useCallback(() => {
    if (!cvRailAppliedAiEdit || !currentCv) return;
    const section = findSectionById(currentSections, cvRailAppliedAiEdit.sectionId);
    if (!section) return;

    const nextSections = currentSections.map((currentSection, index) =>
      getCvSectionId(currentSection, index) === cvRailAppliedAiEdit.sectionId
        ? applyAiTextToSection(currentSection, cvRailAppliedAiEdit.previousText)
        : currentSection,
    );
    persistSections(nextSections);
    setCvRailAppliedAiEdit(null);
    setActiveSectionId(cvRailAppliedAiEdit.sectionId);
    setResumeActiveTarget(getSectionTarget(section));
    focusPreviewSection(cvRailAppliedAiEdit.sectionId);
  }, [currentCv, currentSections, cvRailAppliedAiEdit, persistSections]);

  const handleDiscardAiSuggestion = React.useCallback(() => {
    if (cvRailAiSuggestion) {
      recordAiInteractionEvent({
        name: "ai_discarded",
        interactionId: cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
        surface: "section_editor",
        actionId: "custom",
      });
    }
    setCvRailAiSuggestion(null);
  }, [cvRailAiSuggestion]);

  const handleAcceptListAiSuggestion = React.useCallback(
    (value: string) => {
      if (!cvRailAiSuggestion || cvRailAiSuggestion.kind !== "list") return;
      let acceptedSection: CvSection | null = null;
      const nextSections = currentSections.map((section, index) =>
        getCvSectionId(section, index) === cvRailAiSuggestion.sectionId
          ? (acceptedSection = appendListSuggestionToSection(section, value))
          : section,
      );
      if (acceptedSection) {
        setPendingActiveSection(acceptedSection);
        setActiveSectionId(cvRailAiSuggestion.sectionId);
        setResumeActiveTarget(getSectionTarget(acceptedSection));
      }
      persistSections(nextSections);
      setCvRailAiSuggestion((current) => {
        if (!current || current.kind !== "list") return current;
        const remainingItems = current.items.filter(
          (item) => normalizeListName(item) !== normalizeListName(value),
        );
        return {
          ...current,
          items: remainingItems,
        };
      });
      recordAiInteractionEvent({
        name: "ai_accepted",
        interactionId: cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
        surface: "section_editor",
        actionId: "custom",
      });
    },
    [currentSections, cvRailAiSuggestion, persistSections],
  );

  const handleDismissListAiSuggestion = React.useCallback((value: string) => {
    setCvRailAiSuggestion((current) => {
      if (!current || current.kind !== "list") return current;
      return {
        ...current,
        items: current.items.filter(
          (item) => normalizeListName(item) !== normalizeListName(value),
        ),
      };
    });
  }, []);

  const handleRunListAiSuggestion = React.useCallback(
    (sectionId: string) => {
      void handleRunAskAiForSection({ sectionId, prompt: "", tone: cvTone });
    },
    [cvTone, handleRunAskAiForSection],
  );

  const handleImportEntryCv = React.useCallback(() => {
    if (isEntryPickerBusy) {
      return;
    }

    cvImportInputRef.current?.click();
  }, [isEntryPickerBusy]);

  const handleEntryImportFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || isEntryPickerBusy) {
        return;
      }

      setIsImportingEntryCv(true);

      try {
        const outcome = await importStructuredCvFile(file);

        if (outcome.status === "rejected") {
          showToast(outcome.message, { variant: "error" });
          return;
        }

        if (!Array.isArray(outcome.sections) || outcome.sections.length === 0) {
          showToast(
            outcome.emptyReason
              ? `Import failed. ${outcome.emptyReason}`
              : "Nothing to import.",
            { variant: "error" },
          );
          return;
        }

        const nextCvId = uuidv4();
        const now = new Date().toISOString();
        const nextCvTitle = deriveCvTitleFromSections(
          outcome.sections as any,
          "Imported CV",
        );
        setIsImportingEntryCv(false);
        await importCv({
          id: nextCvId,
          title: nextCvTitle,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1,
            ...(outcome.authoritativeResume
              ? { authoritativeResume: outcome.authoritativeResume }
              : {}),
          },
          sections: outcome.sections as any,
        });
        if (jobDetailRoute) {
          await setJobResume({
            jobId: requestedJobId ?? "",
            resumeId: nextCvId,
            resumeName: nextCvTitle,
          });
          loadCv(nextCvId);
          void navigate(jobDetailRoute);
          return;
        }

        setEntryPickerTransitionCvId(nextCvId);
        loadCv(nextCvId);
        navigateToSelectedCv(nextCvId);
      } catch (error) {
        setEntryPickerTransitionCvId(null);
        showToast("Import failed.", { variant: "error" });
      } finally {
        if (cvImportInputRef.current) {
          cvImportInputRef.current.value = "";
        }
        setIsImportingEntryCv(false);
      }
    },
    [
      importCv,
      importStructuredCvFile,
      isEntryPickerBusy,
      jobDetailRoute,
      loadCv,
      navigate,
      navigateToSelectedCv,
      requestedJobId,
      setJobResume,
      showToast,
    ],
  );

  const handleStartFreshEntryCv = React.useCallback(async () => {
    if (isEntryPickerBusy) {
      return;
    }

    setIsCreatingEntryCv(true);
    setEntryPickerTransitionCvId(ENTRY_PICKER_PENDING_ROUTE_ID);
    setPendingFreshEntryBaseCvId(currentCvId ?? "__none__");
    try {
      await createNewCv(undefined, { forceV1: true });
    } catch (error) {
      setEntryPickerTransitionCvId(null);
      setPendingFreshEntryBaseCvId(null);
      showToast("Create failed.", { variant: "error" });
    } finally {
      setIsCreatingEntryCv(false);
    }
  }, [createNewCv, currentCvId, isEntryPickerBusy, showToast]);

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className="dasti-page-shell dasti-page-shell--cv-forge"
        style={
          {
            "--page-shell-max-width": "100%",
            "--page-shell-gap": "var(--space-2)",
            "--page-shell-pad-top":
              workspaceMode === "preview" ? "var(--space-2)" : "var(--space-2)",
            "--page-shell-pad-inline": "var(--space-4)",
            "--page-shell-pad-bottom": "var(--space-1)",
            "--cv-preview-toolbar-inset":
              workspaceMode === "preview" ? "0px" : undefined,
            "--page-shell-pad-top-mobile":
              workspaceMode === "preview" ? "var(--space-2)" : "var(--space-2)",
            "--page-shell-pad-inline-mobile": "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "var(--space-1)",
          } as React.CSSProperties
        }
      >
        {showJobBriefContext ? (
          <div className="dasti-cv-job-context">
            {requestedJobRecord === undefined ? (
              <p className="dasti-hint">Loading job context…</p>
            ) : selectedJobRecord ? (
              <div className="dasti-proposal-context-row dasti-proposal-context-row--below">
                <div className="dasti-proposal-context-chip">
                  <span className="dasti-proposal-context-row__text">
                    {`For: ${selectedJobRecord.title} @ ${selectedJobRecord.company || "Unknown company"}`}
                  </span>
                  <button
                    type="button"
                    className="dasti-proposal-context-chip__lead dasti-icon-button"
                    aria-label="Clear job context"
                    onClick={handleClearJobContext}
                  >
                    <span className="dasti-proposal-context-chip__glyph dasti-proposal-context-chip__glyph--base">
                      <X size={12} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="dasti-proposal-context-chip__glyph dasti-proposal-context-chip__glyph--hover">
                      <X size={12} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="dasti-hint">
                Saved job context is unavailable for this resume session.
              </p>
            )}
          </div>
        ) : null}
        <>
            <div className="dasti-cv-skeleton-forge" style={cvWorkbenchShellStyle}>
              <div className="dasti-cv-skeleton-forge__stage">
                <CvStageBar
                  mode={workspaceMode}
                  hasCurrentCv={Boolean(currentCv)}
                  hasTrustedExport={hasTrustedExport}
                  importIssueCount={importReviewBlocks.length}
                  exporting={exportingFormat !== null}
                  tone={cvTone}
                  onModeChange={setWorkspaceMode}
                  onOpenImportReview={() => setImportReviewOpen(true)}
                  onImportCv={handleImportEntryCv}
                  onNewCv={() => {
                    void handleStartFreshEntryCv();
                  }}
                  onExportPdf={() =>
                    void handleResumeExport({ format: "pdf", mode: "styled" })
                  }
                  onExportDocx={() => void handleResumeExport({ format: "docx" })}
                />
                {!isImportReviewBannerDismissed ? (
                  <CvReviewBanner
                    issueCount={importReviewBlocks.length}
                    summary={importReviewSummary}
                    onOpenReview={() => setImportReviewOpen(true)}
                    onDismiss={handleDismissImportReviewBanner}
                  />
                ) : null}
                {isImportingEntryCv ? (
                  <div
                    className="dasti-cv-import-progress"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="dasti-cv-import-progress__dot" />
                    <div>
                      <strong>
                        Importing PDF<span className="ds-btn__period">.</span>
                      </strong>
                      <span>
                        Parsing is still pending. Parser errors will stay visible
                        here and will not be treated as a successful import.
                      </span>
                    </div>
                  </div>
                ) : null}
                {!resumePreviewData || !hasResumePaper ? (
                  <div className="dasti-cv-import-card">
                    <button
                      type="button"
                      className="dasti-cv-import-choice"
                      onClick={handleImportEntryCv}
                      disabled={isEntryPickerBusy}
                    >
                      <Upload size={18} strokeWidth={1.8} aria-hidden="true" />
                      <span className="dasti-cv-import-choice__title">
                        Upload PDF
                      </span>
                      <span className="dasti-cv-import-choice__desc">
                        Mistral parses it. Sections appear in seconds.
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dasti-cv-import-choice"
                      onClick={() => {
                        void handleStartFreshEntryCv();
                      }}
                      disabled={isEntryPickerBusy}
                    >
                      <PenLine size={18} strokeWidth={1.8} aria-hidden="true" />
                      <span className="dasti-cv-import-choice__title">
                        Start blank
                      </span>
                      <span className="dasti-cv-import-choice__desc">
                        Build it section by section.
                      </span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={
                      workspaceMode === "preview"
                        ? "dasti-cv-paper-stage dasti-cv-page-preview-stage"
                        : "dasti-cv-paper-stage"
                    }
                  >
                    <VerbatiResumePreview
                      data={resumePreviewData}
                      stylePreset={stylePreset}
                      hostMode="panel"
                      scrollMode="natural"
                      activeTarget={resumeActiveTarget}
                      onLinkIntent={handleResumeLinkIntent}
                    />
                  </div>
                )}
              </div>
              <CvRail
                sections={currentSections}
                hiddenSectionIds={hiddenSectionIds}
                activeSectionId={activeSectionId}
                activeTab={cvRailTab}
                stylePreset={stylePreset}
                selectedTone={cvTone}
                aiSuggestion={cvRailAiSuggestion}
                appliedAiEdit={cvRailAppliedAiEdit}
                isImporting={isImportingEntryCv}
                onActiveTabChange={setCvRailTab}
                onSelectSection={handleSelectSection}
                onToggleHiddenSection={handleToggleHiddenSection}
                onDeleteSection={handleDeleteSection}
                onReorderSections={handleReorderSections}
                onMoveSection={handleMoveSection}
                onAskAiForSection={handleAskAiForSection}
                onRunAskAiForSection={handleRunAskAiForSection}
                onAcceptAiSuggestion={handleAcceptAiSuggestion}
                onDiscardAiSuggestion={handleDiscardAiSuggestion}
                onUndoAiSuggestion={handleUndoAiSuggestion}
                onAcceptListAiSuggestion={handleAcceptListAiSuggestion}
                onDismissListAiSuggestion={handleDismissListAiSuggestion}
                onAddSection={handleAddSection}
                onSelectTemplate={handleSelectTemplate}
                onSelectFontPair={handleSelectFontPair}
                onSelectAccent={handleSelectAccent}
                onImportPdf={handleImportEntryCv}
              />
            </div>
            <SectionEditorSheet
              open={sectionEditorOpen}
              section={activeSection}
              aiSuggestion={cvRailAiSuggestion}
              isAiRunning={cvRailAiSuggestion?.state === "loading"}
              onOpenChange={setSectionEditorOpen}
              onSave={handleSectionEditorSave}
              summaryAiEvidence={{
                summary: getCurrentCvSummaryText(currentCv),
                skills: getCurrentCvSkills(currentCv),
                experiences: getCurrentCvExperiences(currentCv),
                educations: getCurrentCvEducations(currentCv),
                languages: getCurrentCvLanguages(currentCv),
              }}
              onRunListAiSuggestion={handleRunListAiSuggestion}
              onAcceptListAiSuggestion={handleAcceptListAiSuggestion}
              onDismissListAiSuggestion={handleDismissListAiSuggestion}
            />
            <ImportReviewSheet
              open={importReviewOpen}
              blocks={importReviewBlocks}
              onOpenChange={setImportReviewOpen}
            />
        </>
        <input
          ref={cvImportInputRef}
          type="file"
          accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
          style={{ display: "none" }}
          onChange={handleEntryImportFileChange}
        />
      </div>
    </div>
  );
}
