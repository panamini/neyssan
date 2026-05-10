import React from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import type { RemirrorJSON } from "remirror";
import { PenLine, Upload, X } from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import FloatingAiToolbar, {
  type InlineAiActionId,
} from "../components/FloatingAiToolbar";
import type { ResumeExportRequest } from "../components/ResumeExportControl";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { useRegisterForgeTemplates } from "../contexts/ForgeTemplatePanelContext";
import { VerbatiResumePreview } from "../features/verbati/VerbatiResumePreview";
import type {
  ActivePaperEditTarget,
  ResumeInlineEditing,
} from "../features/verbati/resume/InlineEditableText";
import type { ResumePaperAiState } from "../features/verbati/resume/ResumeOneColAtsPage";
import { hasRenderableResumeData } from "../features/verbati/cvDocumentToResumeData";
import type {
  ResumeActiveTarget,
  ResumeLinkIntent,
} from "../features/verbati/resumeLinking";
import { getCanonicalSectionType } from "../features/verbati/resumeLinking";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import { resolveVerbatiStyle, stylesEqual } from "../features/verbati/style";
import type { VerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  type ResumeTemplateId,
} from "../lib/layout/resumeTemplates";
import {
  DOCUMENT_STYLE_VERSION,
  buildDocumentAppearanceSnapshot,
  getFactoryDocumentStyleSlot,
  resolveDocumentStyleSlotId,
} from "../lib/document-style-slots";
import {
  ensurePlainTextRemirrorDoc,
  ensureRemirrorDoc,
} from "../components/remirror-editor/utils/conversion";
import { normalizeResponsibilityAiResultForSource } from "../components/structured-blocks/ExperienceEducationModal";
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
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
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
import { normalizeEditorAiTextResult } from "../lib/ai/applyAiSuggestion";
import {
  getDomSelectionState,
  isInlineAiToolbarActiveElement,
  isPrimaryPointerPressed,
  type EditorSelectionAnchor,
} from "../lib/editor-ai-selection";
import {
  deriveResponsibilityBullets,
  projectResponsibilitiesForWorkshop,
  responsibilityValueToDisplayLines,
} from "../lib/resumeResponsibilityAuthority";

const CV_PAPER_VISUAL_INLINE_SIZE = `${Math.round(A4_PAGE_WIDTH_PX * 100) / 100}px`;

type CvForgeWorkspaceMode = "edit" | "preview";
type CvForgeCanonicalJob = {
  id: string;
  title: string;
  company: string;
} | null;
type InlinePaperSelectionState = {
  text: string;
  anchor: EditorSelectionAnchor;
  editTarget: ActivePaperEditTarget;
  range: Range | null;
};
type PaperTextAiSuggestion = NonNullable<
  ResumePaperAiState["textSuggestion"]
> & {
  afterDoc?: unknown;
  responsibilityBullets?: string[];
  previousSection?: CvSection;
  interactionId?: string;
};

const CV_FORGE_WORKSPACE_MODE_STORAGE_KEY = "dasti:cv-forge-workspace-mode:v1";
const ENTRY_PICKER_PENDING_ROUTE_ID = "__entry-picker-pending-route__";
const DRAFT_EMPTY_RESPONSIBILITY_BULLET =
  "__draft_empty_responsibility_bullet__";

function resolveCvTemplateIntent(
  value: string | null | undefined,
): ResumeTemplateId | null {
  if (value === "minimal") return WORKSHOP_RESUME_ONECOL_TEMPLATE_ID;
  if (value === "french") return WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID;
  return null;
}

function mapDefaultVoicePresetToCvTone(value: unknown): CvToneChoice {
  if (value === "engaging") return "warm";
  if (value === "expert") return "formal";
  return "natural";
}

function cleanCvMetadataForImport(
  metadata: CvDocument["metadata"],
): CvDocument["metadata"] {
  const nextMetadata = { ...metadata } as Record<string, unknown>;
  delete nextMetadata.cvTone;
  return nextMetadata as CvDocument["metadata"];
}

function buildUpdatedCvMetadata(
  cv: CvDocument,
  updatedAt: string,
): CvDocument["metadata"] {
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

function getStructuredItems(
  section: CvSection,
): Array<Record<string, unknown>> {
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

function filterNewListSuggestions(
  suggestions: string[],
  existingItems: string[],
): string[] {
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
  return collectPlainText(
    item?.summary ?? summarySection?.blocks?.[0]?.content,
  );
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

function getCurrentCvExperiences(cv: CvDocument | null | undefined): Array<{
  company?: string;
  position?: string;
  description?: string;
  bullets?: string[];
}> {
  return (cv?.sections ?? [])
    .filter((section) => String(section.type) === "experience")
    .flatMap((section) =>
      getStructuredItems(section as CvSection).map((item) => ({
        company:
          typeof item.company === "string" ? item.company.trim() : undefined,
        position:
          typeof item.position === "string" ? item.position.trim() : undefined,
        description: collectPlainText(
          item.responsibilities ?? item.description,
        ),
        bullets: splitAiListText(collectPlainText(item.responsibilities)),
      })),
    );
}

function getCurrentCvEducations(cv: CvDocument | null | undefined): Array<{
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
          typeof item.institution === "string"
            ? item.institution.trim()
            : undefined,
        degree:
          typeof item.degree === "string" ? item.degree.trim() : undefined,
        fieldOfStudy:
          typeof item.fieldOfStudy === "string"
            ? item.fieldOfStudy.trim()
            : undefined,
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
              `${index + 1}. ${[
                item.degree,
                item.fieldOfStudy,
                item.institution,
              ]
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
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
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
        content: ensurePlainTextRemirrorDoc(text),
        plainText: text,
      },
      ...section.blocks.slice(1),
    ],
  };
}

function normalizeInlinePlainText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function replaceSelectedInlineText(
  currentText: string,
  selectedText: string,
  replacementText: string,
): string {
  const normalizedCurrentText = normalizeInlinePlainText(currentText);
  const normalizedSelectedText = normalizeInlinePlainText(selectedText).trim();
  const normalizedReplacementText =
    normalizeInlinePlainText(replacementText).trim();
  if (!normalizedSelectedText) return normalizedReplacementText;
  const index = normalizedCurrentText.indexOf(normalizedSelectedText);
  if (index < 0) return normalizedReplacementText;
  return `${normalizedCurrentText.slice(0, index)}${normalizedReplacementText}${normalizedCurrentText.slice(
    index + normalizedSelectedText.length,
  )}`;
}

function readInlineFieldCanonicalText(
  section: CvSection,
  target: ActivePaperEditTarget,
): string {
  if (target.fieldPath === "structuredContent.0.summary") {
    return collectPlainText(getStructuredItems(section)[0]?.summary);
  }
  if (target.fieldPath === "blocks.0.plainText") {
    return collectPlainText(
      section.blocks[0]?.plainText ?? section.blocks[0]?.content,
    );
  }
  if (target.fieldPath.startsWith("structuredContent.0.")) {
    const field = target.fieldPath.slice("structuredContent.0.".length);
    return collectPlainText(getStructuredItems(section)[0]?.[field]);
  }

  const itemMatch = target.fieldPath.match(
    /^structuredContent\.item:([^.]*)\.(.+)$/,
  );
  if (!itemMatch) return "";
  const [, itemId, itemFieldPath] = itemMatch;
  const item = getStructuredItemById(section, itemId);
  if (!item) return "";
  const bulletMatch = itemFieldPath.match(/^responsibilityBullets\.(\d+)$/);
  if (bulletMatch) {
    const bullets = Array.isArray(item.responsibilityBullets)
      ? item.responsibilityBullets
      : [];
    return collectPlainText(bullets[Number(bulletMatch[1])]);
  }
  return collectPlainText(item[itemFieldPath]);
}

function applyInlineAiTextToSectionField(args: {
  section: CvSection;
  target: ActivePaperEditTarget;
  selectedText: string;
  replacementText: string;
}): CvSection | null {
  const nextText = replaceSelectedInlineText(
    readInlineFieldCanonicalText(args.section, args.target),
    args.selectedText,
    args.replacementText,
  );

  if (args.target.fieldPath === "structuredContent.0.summary") {
    return updateSummaryStructuredText(args.section, nextText);
  }
  if (args.target.fieldPath === "blocks.0.plainText") {
    return updateFirstTextBlock(args.section, nextText);
  }
  if (args.target.fieldPath.startsWith("structuredContent.0.")) {
    const field = args.target.fieldPath.slice("structuredContent.0.".length);
    return updateProfileStructuredField(args.section, field, nextText);
  }

  const itemMatch = args.target.fieldPath.match(
    /^structuredContent\.item:([^.]*)\.(.+)$/,
  );
  if (!itemMatch) return null;
  const [, itemId, itemFieldPath] = itemMatch;
  const bulletMatch = itemFieldPath.match(/^responsibilityBullets\.(\d+)$/);
  if (bulletMatch) {
    return updateStructuredItemBullet(
      args.section,
      itemId,
      Number(bulletMatch[1]),
      nextText,
    );
  }
  return updateStructuredItemField(
    args.section,
    itemId,
    itemFieldPath,
    nextText,
  );
}

function readInlinePaperEditTarget(
  element: Element | null | undefined,
): ActivePaperEditTarget | null {
  if (!(element instanceof HTMLElement)) return null;
  if (element.dataset.inlinePaperEditable !== "true") return null;
  const sectionId = element.dataset.paperSectionId;
  const sectionType = element.dataset.paperSectionType;
  const fieldPath = element.dataset.paperFieldPath;
  const fieldKind = element.dataset.paperFieldKind;
  if (!sectionId || !sectionType || !fieldPath || !fieldKind) return null;

  const readNumber = (value: string | undefined) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    sectionId,
    sectionType,
    fieldPath,
    fieldKind: fieldKind as ActivePaperEditTarget["fieldKind"],
    itemIndex: readNumber(element.dataset.paperItemIndex),
    bulletIndex: readNumber(element.dataset.paperBulletIndex),
    chipIndex: readNumber(element.dataset.paperChipIndex),
  };
}

function updateSummaryStructuredDoc(
  section: CvSection,
  doc: RemirrorJSON,
): CvSection {
  const items = getStructuredItems(section);
  const item = items[0] ?? { id: `summary-${section.id ?? "section"}-0` };

  return {
    ...section,
    structuredContent: [
      { ...item, summary: doc },
      ...items.slice(1),
    ] as CvSection["structuredContent"],
  };
}

function updateSummaryStructuredText(
  section: CvSection,
  text: string,
): CvSection {
  return updateSummaryStructuredDoc(section, ensurePlainTextRemirrorDoc(text));
}

function updateStructuredItemField(
  section: CvSection,
  itemId: string,
  field: string,
  text: string,
): CvSection {
  const items = getStructuredItems(section);
  const itemIndex = items.findIndex((item) => String(item.id ?? "") === itemId);
  if (itemIndex < 0) return section;
  const item = items[itemIndex]!;
  const richTextFields = new Set([
    "summary",
    "description",
    "responsibilities",
    "notes",
  ]);
  const nextItem: Record<string, unknown> = {
    ...item,
    [field]: richTextFields.has(field)
      ? ensurePlainTextRemirrorDoc(text)
      : text,
  };

  if (field === "responsibilities") {
    const nextDoc = updateResponsibilityParagraphDoc(
      item.responsibilities,
      text,
    );
    const bullets = responsibilityBulletCacheFromDoc(nextDoc);
    nextItem.responsibilities = nextDoc;
    nextItem.__draftResponsibilityBulletCount = bullets.length;
    if (bullets.length > 0) {
      nextItem.responsibilityBullets = bullets;
    } else {
      delete nextItem.responsibilityBullets;
    }
  }

  return {
    ...section,
    structuredContent: [
      ...items.slice(0, itemIndex),
      nextItem,
      ...items.slice(itemIndex + 1),
    ] as CvSection["structuredContent"],
  };
}

function addStructuredItemDraftDescription(
  section: CvSection,
  itemId: string,
): CvSection {
  const items = getStructuredItems(section);
  const itemIndex = items.findIndex((item) => String(item.id ?? "") === itemId);
  if (itemIndex < 0) return section;
  const item = items[itemIndex]!;

  return {
    ...section,
    structuredContent: [
      ...items.slice(0, itemIndex),
      {
        ...item,
        responsibilities: ensureRemirrorDoc(""),
        __draftDescription: true,
      },
      ...items.slice(itemIndex + 1),
    ] as CvSection["structuredContent"],
  };
}

type MutableRemirrorNode = RemirrorJSON & {
  content?: MutableRemirrorNode[];
  marks?: Array<{ type: string }>;
};

function isRemirrorNode(value: unknown): value is MutableRemirrorNode {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { type?: unknown }).type === "string",
  );
}

function isResponsibilityListNode(node: MutableRemirrorNode): boolean {
  return (
    node.type === "bulletList" ||
    node.type === "orderedList" ||
    node.type === "bullet_list" ||
    node.type === "ordered_list"
  );
}

function isResponsibilityListItemNode(node: MutableRemirrorNode): boolean {
  return node.type === "listItem" || node.type === "list_item";
}

function remirrorTextNodesFromPlainText(text: string): MutableRemirrorNode[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const nodes: MutableRemirrorNode[] = [];
  normalized.split("\n").forEach((line, index) => {
    if (index > 0) {
      nodes.push({ type: "hardBreak" } as MutableRemirrorNode);
    }
    if (line) {
      nodes.push({ type: "text", text: line } as MutableRemirrorNode);
    }
  });
  return nodes;
}

function remirrorInlinePlainText(node: MutableRemirrorNode): string {
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(remirrorInlinePlainText).join("");
}

function remirrorParagraphFromPlainText(text: string): MutableRemirrorNode {
  return {
    type: "paragraph",
    content: remirrorTextNodesFromPlainText(text),
  } as MutableRemirrorNode;
}

function remirrorListItemFromPlainText(text: string): MutableRemirrorNode {
  return {
    type: "listItem",
    content: [remirrorParagraphFromPlainText(text)],
  } as MutableRemirrorNode;
}

function cloneRemirrorNode(node: MutableRemirrorNode): MutableRemirrorNode {
  return {
    ...node,
    ...(node.marks ? { marks: node.marks.map((mark) => ({ ...mark })) } : {}),
    ...(node.content ? { content: node.content.map(cloneRemirrorNode) } : {}),
  };
}

function remirrorMarksFromRun(run: {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}): MutableRemirrorNode["marks"] | undefined {
  const marks = [
    run.bold ? { type: "bold" } : null,
    run.italic ? { type: "italic" } : null,
    run.underline ? { type: "underline" } : null,
  ].filter((mark): mark is { type: string } => mark !== null);
  return marks.length > 0 ? marks : undefined;
}

function remirrorInlineNodesFromRuns(
  runs: Array<{
    text?: unknown;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }>,
): MutableRemirrorNode[] {
  const nodes: MutableRemirrorNode[] = [];
  runs.forEach((run) => {
    const text = typeof run.text === "string" ? run.text : "";
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .forEach((line, index) => {
        if (index > 0) {
          nodes.push({ type: "hardBreak" } as MutableRemirrorNode);
        }
        if (!line) return;
        nodes.push({
          type: "text",
          text: line,
          ...(remirrorMarksFromRun(run)
            ? { marks: remirrorMarksFromRun(run) }
            : {}),
        } as MutableRemirrorNode);
      });
  });
  return nodes;
}

function responsibilitiesSourceToRemirrorDoc(source: unknown): RemirrorJSON {
  if (isRemirrorNode(source)) {
    return cloneRemirrorNode(source);
  }

  const projection = projectResponsibilitiesForWorkshop(source);
  const content = projection.rich.blocks.map((block) => {
    if (block.kind === "paragraph") {
      return {
        type: "paragraph",
        content: remirrorInlineNodesFromRuns(block.runs),
      } as MutableRemirrorNode;
    }

    return {
      type: "bulletList",
      content: block.items.map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: remirrorInlineNodesFromRuns(item.runs),
          } as MutableRemirrorNode,
        ],
      })) as MutableRemirrorNode[],
    } as MutableRemirrorNode;
  });

  return {
    type: "doc",
    content:
      content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  } as RemirrorJSON;
}

function updateResponsibilityParagraphDoc(
  source: unknown,
  text: string,
): RemirrorJSON {
  const doc = responsibilitiesSourceToRemirrorDoc(
    source,
  ) as MutableRemirrorNode;
  const nextDoc = cloneRemirrorNode(doc);
  const paragraph = remirrorParagraphFromPlainText(text);
  const content = nextDoc.content ?? [];
  const firstParagraphIndex = content.findIndex(
    (node) => node.type === "paragraph",
  );
  const withoutParagraphs = content.filter((node) => node.type !== "paragraph");

  if (text.trim()) {
    const insertAt = firstParagraphIndex >= 0 ? firstParagraphIndex : 0;
    nextDoc.content = [
      ...withoutParagraphs.slice(0, insertAt),
      paragraph,
      ...withoutParagraphs.slice(insertAt),
    ];
  } else {
    nextDoc.content =
      withoutParagraphs.length > 0
        ? withoutParagraphs
        : [{ type: "paragraph", content: [] } as MutableRemirrorNode];
  }

  return nextDoc as RemirrorJSON;
}

function updateResponsibilityBulletDoc(
  source: unknown,
  bulletIndex: number,
  text: string,
): RemirrorJSON {
  const doc = responsibilitiesSourceToRemirrorDoc(
    source,
  ) as MutableRemirrorNode;
  const nextDoc = cloneRemirrorNode(doc);
  let cursor = 0;
  let updated = false;
  let lastListNode: MutableRemirrorNode | null = null;

  const visit = (node: MutableRemirrorNode) => {
    if (isResponsibilityListNode(node)) {
      lastListNode = node;
      node.content = (node.content ?? []).map((child) => {
        if (!isResponsibilityListItemNode(child)) {
          visit(child);
          return child;
        }
        if (cursor === bulletIndex) {
          updated = true;
          cursor += 1;
          return remirrorListItemFromPlainText(text);
        }
        cursor += 1;
        return child;
      });
      return;
    }

    (node.content ?? []).forEach(visit);
  };

  visit(nextDoc);

  if (!updated) {
    const nextItem = remirrorListItemFromPlainText(text);
    if (lastListNode) {
      lastListNode.content = [...(lastListNode.content ?? []), nextItem];
    } else {
      nextDoc.content = [
        ...(nextDoc.content ?? []),
        { type: "bulletList", content: [nextItem] } as MutableRemirrorNode,
      ];
    }
  }

  return nextDoc as RemirrorJSON;
}

function removeResponsibilityBulletDoc(
  source: unknown,
  bulletIndex: number,
): RemirrorJSON {
  const doc = responsibilitiesSourceToRemirrorDoc(
    source,
  ) as MutableRemirrorNode;
  const nextDoc = cloneRemirrorNode(doc);
  let cursor = 0;

  const prune = (node: MutableRemirrorNode): MutableRemirrorNode | null => {
    if (isResponsibilityListNode(node)) {
      const nextContent = (node.content ?? []).flatMap((child) => {
        if (!isResponsibilityListItemNode(child)) {
          const prunedChild = prune(child);
          return prunedChild ? [prunedChild] : [];
        }

        const currentIndex = cursor;
        cursor += 1;
        const isTarget = currentIndex === bulletIndex;
        const isEmpty = !remirrorInlinePlainText(child).trim();
        if (isTarget && isEmpty) {
          return [];
        }
        return [child];
      });

      return nextContent.length > 0
        ? ({ ...node, content: nextContent } as MutableRemirrorNode)
        : null;
    }

    if (!node.content) {
      return node;
    }

    const nextContent = node.content.flatMap((child) => {
      const prunedChild = prune(child);
      return prunedChild ? [prunedChild] : [];
    });

    return { ...node, content: nextContent } as MutableRemirrorNode;
  };

  const prunedDoc =
    prune(nextDoc) ?? ({ type: "doc", content: [] } as MutableRemirrorNode);
  if (
    prunedDoc.type === "doc" &&
    (!prunedDoc.content || prunedDoc.content.length === 0)
  ) {
    prunedDoc.content = [
      { type: "paragraph", content: [] } as MutableRemirrorNode,
    ];
  }
  return prunedDoc as RemirrorJSON;
}

function responsibilityBulletCacheFromDoc(doc: unknown): string[] {
  if (!isRemirrorNode(doc)) return [];
  const bullets: string[] = [];

  const visit = (node: MutableRemirrorNode) => {
    if (isResponsibilityListNode(node)) {
      (node.content ?? []).forEach((child) => {
        if (!isResponsibilityListItemNode(child)) {
          visit(child);
          return;
        }
        const text = remirrorInlinePlainText(child).trim();
        bullets.push(text || DRAFT_EMPTY_RESPONSIBILITY_BULLET);
      });
      return;
    }

    (node.content ?? []).forEach(visit);
  };

  visit(doc);
  return bullets;
}

function countCanonicalResponsibilityBullets(
  item: Record<string, unknown>,
): number {
  if (typeof item.responsibilities !== "undefined") {
    if (isRemirrorNode(item.responsibilities)) {
      return responsibilityBulletCacheFromDoc(item.responsibilities).length;
    }
    return projectResponsibilitiesForWorkshop(item.responsibilities).bullets
      .length;
  }

  return Array.isArray(item.responsibilityBullets)
    ? item.responsibilityBullets.length
    : 0;
}

function updateStructuredItemBullet(
  section: CvSection,
  itemId: string,
  bulletIndex: number,
  text: string,
): CvSection {
  const items = getStructuredItems(section);
  const itemIndex = items.findIndex((item) => String(item.id ?? "") === itemId);
  if (itemIndex < 0) return section;
  const item = items[itemIndex]!;
  const storedText = text.trim() ? text : DRAFT_EMPTY_RESPONSIBILITY_BULLET;

  if (typeof item.responsibilities !== "undefined") {
    const nextDoc = updateResponsibilityBulletDoc(
      item.responsibilities,
      bulletIndex,
      text.trim() ? text : "",
    );
    const bullets = responsibilityBulletCacheFromDoc(nextDoc);
    const draftBulletCount = bullets.length;
    return {
      ...section,
      structuredContent: [
        ...items.slice(0, itemIndex),
        {
          ...item,
          responsibilities: nextDoc,
          responsibilityBullets: bullets.length > 0 ? bullets : undefined,
          __draftResponsibilityBulletCount: draftBulletCount,
        },
        ...items.slice(itemIndex + 1),
      ] as CvSection["structuredContent"],
    };
  }

  if (Array.isArray(item.responsibilityBullets)) {
    const bullets = [...item.responsibilityBullets].map((entry) =>
      collectPlainText(entry),
    );
    bullets[bulletIndex] = storedText;
    const draftBulletCount = Math.max(
      Number(
        (item as Record<string, unknown>).__draftResponsibilityBulletCount ?? 0,
      ),
      bulletIndex + 1,
    );
    return {
      ...section,
      structuredContent: [
        ...items.slice(0, itemIndex),
        {
          ...item,
          responsibilityBullets: bullets,
          __draftResponsibilityBulletCount: draftBulletCount,
        },
        ...items.slice(itemIndex + 1),
      ] as CvSection["structuredContent"],
    };
  }

  const bullets = splitAiListText(
    collectPlainText(item.responsibilityBullets ?? item.responsibilities),
  );
  bullets[bulletIndex] = storedText;
  const draftBulletCount = Math.max(
    Number(
      (item as Record<string, unknown>).__draftResponsibilityBulletCount ?? 0,
    ),
    bulletIndex + 1,
  );

  return {
    ...section,
    structuredContent: [
      ...items.slice(0, itemIndex),
      {
        ...item,
        responsibilityBullets: bullets,
        __draftResponsibilityBulletCount: draftBulletCount,
      },
      ...items.slice(itemIndex + 1),
    ] as CvSection["structuredContent"],
  };
}

function getStructuredItemById(section: CvSection, itemId: string) {
  return getStructuredItems(section).find(
    (item) => String(item.id ?? "") === itemId,
  );
}

function getResponsibilitySource(item: Record<string, unknown>) {
  if (typeof item.responsibilities !== "undefined")
    return item.responsibilities;
  if (typeof item.responsibilityBullets !== "undefined") {
    return item.responsibilityBullets;
  }
  return item.description;
}

function plainResponsibilityRunsText(runs: Array<{ text?: unknown }>): string {
  return runs
    .map((run) => (typeof run.text === "string" ? run.text : ""))
    .join("")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function getResponsibilityReplacementItems(result: {
  doc: unknown;
  responsibilityBullets?: string[];
}): string[] {
  if (Array.isArray(result.responsibilityBullets)) {
    return result.responsibilityBullets
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }
  return responsibilityValueToDisplayLines(result.doc);
}

function getResponsibilitySourceShape(
  source: unknown,
): "empty" | "paragraph" | "list" | "mixed" {
  const blocks = projectResponsibilitiesForWorkshop(source).rich.blocks;
  const hasParagraph = blocks.some((block) => block.kind === "paragraph");
  const hasList = blocks.some((block) => block.kind === "bullet_list");
  if (hasParagraph && hasList) return "mixed";
  if (hasList) return "list";
  if (hasParagraph) return "paragraph";
  return "empty";
}

function readResponsibilityAiSourceText(source: unknown): string {
  const projection = projectResponsibilitiesForWorkshop(source);
  const blocks = projection.rich.blocks
    .map((block) => {
      if (block.kind === "paragraph") {
        return plainResponsibilityRunsText(block.runs);
      }
      const items = block.items
        .map((item) => plainResponsibilityRunsText(item.runs))
        .filter(Boolean);
      return items.length > 0
        ? items.map((item) => `• ${item}`).join("\n")
        : "";
    })
    .filter(Boolean);

  if (blocks.length > 0) {
    return blocks.join("\n\n");
  }

  return responsibilityValueToDisplayLines(source).join("\n").trim();
}

function buildResponsibilityTextWithBulletReplacement(args: {
  item: Record<string, unknown>;
  bulletIndex: number;
  replacementItems: string[];
}): string {
  const source = getResponsibilitySource(args.item);
  const projection = projectResponsibilitiesForWorkshop(source);
  const lines: string[] = [];
  let cursor = 0;

  projection.rich.blocks.forEach((block) => {
    if (block.kind === "paragraph") {
      const text = plainResponsibilityRunsText(block.runs);
      if (text) lines.push(text);
      return;
    }

    block.items.forEach((item) => {
      if (cursor === args.bulletIndex) {
        args.replacementItems.forEach((replacement) => {
          if (replacement.trim()) lines.push(`• ${replacement.trim()}`);
        });
      } else {
        const text = plainResponsibilityRunsText(item.runs);
        if (text) lines.push(`• ${text}`);
      }
      cursor += 1;
    });
  });

  if (lines.length > 0) {
    return lines.join("\n");
  }

  const fallbackBullets = deriveResponsibilityBullets({
    responsibilities: args.item.responsibilities,
    hasResponsibilitiesField: typeof args.item.responsibilities !== "undefined",
    responsibilityBullets: args.item.responsibilityBullets,
  });
  const nextBullets = [...fallbackBullets];
  nextBullets.splice(args.bulletIndex, 1, ...args.replacementItems);
  return nextBullets.map((item) => `• ${item}`).join("\n");
}

function updateStructuredItemResponsibilities(
  section: CvSection,
  itemId: string,
  responsibilities: unknown,
  responsibilityBullets?: string[],
): CvSection {
  const items = getStructuredItems(section);
  const itemIndex = items.findIndex((item) => String(item.id ?? "") === itemId);
  if (itemIndex < 0) return section;
  const item = items[itemIndex]!;
  const nextItem: Record<string, unknown> = {
    ...item,
    responsibilities,
    __draftResponsibilityBulletCount: responsibilityBullets?.length ?? 0,
  };
  if (responsibilityBullets && responsibilityBullets.length > 0) {
    nextItem.responsibilityBullets = responsibilityBullets;
  } else {
    delete nextItem.responsibilityBullets;
  }

  return {
    ...section,
    structuredContent: [
      ...items.slice(0, itemIndex),
      nextItem,
      ...items.slice(itemIndex + 1),
    ] as CvSection["structuredContent"],
  };
}

function removeStructuredItemBullet(
  section: CvSection,
  itemId: string,
  bulletIndex: number,
): CvSection {
  const items = getStructuredItems(section);
  const itemIndex = items.findIndex((item) => String(item.id ?? "") === itemId);
  if (itemIndex < 0) return section;
  const item = items[itemIndex]!;
  if (typeof item.responsibilities !== "undefined") {
    const nextDoc = removeResponsibilityBulletDoc(
      item.responsibilities,
      bulletIndex,
    );
    const nextBullets = responsibilityBulletCacheFromDoc(nextDoc);
    const nextItem: Record<string, unknown> = {
      ...item,
      responsibilities: nextDoc,
      __draftResponsibilityBulletCount: nextBullets.length,
    };
    if (nextBullets.length > 0) {
      nextItem.responsibilityBullets = nextBullets;
    } else {
      delete nextItem.responsibilityBullets;
    }

    return {
      ...section,
      structuredContent: [
        ...items.slice(0, itemIndex),
        nextItem,
        ...items.slice(itemIndex + 1),
      ] as CvSection["structuredContent"],
    };
  }

  const removeAt = (entries: unknown[]) =>
    entries
      .map((entry) => collectPlainText(entry))
      .filter((_, index) => index !== bulletIndex)
      .filter(
        (entry) => entry.trim() && entry !== DRAFT_EMPTY_RESPONSIBILITY_BULLET,
      );
  const currentBullets = Array.isArray(item.responsibilityBullets)
    ? item.responsibilityBullets
    : splitAiListText(collectPlainText(item.responsibilityBullets));
  const nextBullets = removeAt(currentBullets);
  const nextItem = {
    ...item,
    responsibilityBullets: nextBullets,
    __draftResponsibilityBulletCount: nextBullets.length,
  };
  return {
    ...section,
    structuredContent: [
      ...items.slice(0, itemIndex),
      nextItem,
      ...items.slice(itemIndex + 1),
    ] as CvSection["structuredContent"],
  };
}

function removeStructuredItem(section: CvSection, itemId: string): CvSection {
  const items = getStructuredItems(section);
  return {
    ...section,
    structuredContent: items.filter(
      (item) => String(item.id ?? "") !== itemId,
    ) as CvSection["structuredContent"],
  };
}

function isStructuredItemEmptyAfterFieldChange(
  section: CvSection,
  itemId: string,
  field: string,
  text: string,
): boolean {
  const item = getStructuredItems(section).find(
    (entry) => String(entry.id ?? "") === itemId,
  );
  if (!item) return false;

  const nextItem = { ...item, [field]: text };
  const fieldsBySectionType: Record<string, string[]> = {
    skills: ["name"],
    languages: ["name", "level"],
    hobbies: ["name", "text"],
    achievements: ["text"],
    certifications: [
      "certificationName",
      "issuingOrganization",
      "issueDate",
      "expirationDate",
      "credentialId",
      "licenseNumber",
    ],
    projects: ["name", "title", "meta", "subtitle", "description", "summary"],
    affiliations: [
      "organizationName",
      "roleOrMembershipType",
      "dateRange",
      "notes",
    ],
  };
  const canonicalType = getCanonicalSectionType(section) ?? section.type;
  const fields = fieldsBySectionType[canonicalType] ?? [];
  if (fields.length === 0) return false;

  return fields.every(
    (candidate) => !collectPlainText(nextItem[candidate]).trim(),
  );
}

function updateProfileStructuredField(
  section: CvSection,
  field: string,
  text: string,
): CvSection {
  const items = getStructuredItems(section);
  const item = items[0] ?? { id: `profile-${section.id ?? "section"}-0` };
  return {
    ...section,
    structuredContent: [
      { ...item, [field]: text },
      ...items.slice(1),
    ] as CvSection["structuredContent"],
  };
}

function addProfileDraftContactField(
  section: CvSection,
  field: string,
): CvSection {
  const items = getStructuredItems(section);
  const item = items[0] ?? { id: `profile-${section.id ?? "section"}-0` };
  const existing = Array.isArray(item.__draftContactFields)
    ? item.__draftContactFields.map((value) => String(value))
    : [];
  return {
    ...section,
    structuredContent: [
      {
        ...item,
        [field]: String(item[field] ?? ""),
        __draftContactFields: Array.from(new Set([...existing, field])),
      },
      ...items.slice(1),
    ] as CvSection["structuredContent"],
  };
}

const OPTIONAL_PROFILE_CONTACT_FIELDS = new Set([
  "email",
  "phone",
  "location",
  "linkedin",
  "website",
]);

function readOptionalProfileContactField(
  target: ActivePaperEditTarget | null | undefined,
): string | null {
  if (target?.sectionType !== "profile") return null;
  const match = target.fieldPath.match(/^structuredContent\.0\.([^.]*)$/);
  const field = match?.[1];
  return field && OPTIONAL_PROFILE_CONTACT_FIELDS.has(field) ? field : null;
}

function removeProfileDraftContactField(
  section: CvSection,
  field: string,
): CvSection {
  const items = getStructuredItems(section);
  const item = items[0];
  if (!item) return section;
  const nextItem = { ...item } as Record<string, unknown>;
  const nextDraftFields = Array.isArray(item.__draftContactFields)
    ? item.__draftContactFields
        .map((value) => String(value))
        .filter((value) => value && value !== field)
    : [];
  nextItem[field] = "";
  if (nextDraftFields.length > 0) {
    nextItem.__draftContactFields = Array.from(new Set(nextDraftFields));
  } else {
    delete nextItem.__draftContactFields;
  }
  return {
    ...section,
    structuredContent: [
      nextItem,
      ...items.slice(1),
    ] as CvSection["structuredContent"],
  };
}

const INLINE_PAPER_AI_HIGHLIGHT_NAME = "cv-inline-ai-selection";

type InlinePaperHighlightRegistry = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
};

function getCssHighlights(): InlinePaperHighlightRegistry | null {
  if (typeof CSS === "undefined") return null;
  const highlights = (
    CSS as typeof CSS & { highlights?: InlinePaperHighlightRegistry }
  ).highlights;
  return highlights ?? null;
}

function clearInlinePaperAiSelectionHighlight(): void {
  getCssHighlights()?.delete(INLINE_PAPER_AI_HIGHLIGHT_NAME);
  if (typeof document === "undefined") return;
  document
    .querySelectorAll<HTMLElement>("[data-inline-ai-selection-active='true']")
    .forEach((element) => {
      element.removeAttribute("data-inline-ai-selection-active");
    });
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

function appendListSuggestionToSection(
  section: CvSection,
  value: string,
): CvSection {
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

  if (
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies"
  ) {
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

  try {
    return window.localStorage.getItem(CV_FORGE_WORKSPACE_MODE_STORAGE_KEY) ===
      "preview"
      ? "preview"
      : "edit";
  } catch {
    return "edit";
  }
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

function findSectionById(
  sections: CvSection[],
  sectionId: string,
): CvSection | null {
  return (
    sections.find(
      (section, index) => getCvSectionId(section, index) === sectionId,
    ) ?? null
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
    if (isSectionEditorSheetFocusOwner()) return;
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

function focusInlinePaperEditTarget(target: ActivePaperEditTarget): void {
  if (typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    if (isSectionEditorSheetFocusOwner()) return;
    const escape = (value: string) =>
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(value)
        : value.replace(/"/g, '\\"');
    const fieldPath = target.fieldPath.replace(
      /\.responsibilityBullets\.\d+$/,
      ".responsibilities",
    );
    const editable = document.querySelector<HTMLElement>(
      `[data-inline-paper-editable="true"][data-paper-section-id="${escape(
        target.sectionId,
      )}"][data-paper-field-path="${escape(fieldPath)}"]`,
    );
    if (!editable) {
      focusPreviewSection(target.sectionId);
      return;
    }
    const focusTarget =
      editable.querySelector<HTMLElement>(".ProseMirror") ?? editable;
    focusTarget.focus({ preventScroll: false });
    if (focusTarget instanceof HTMLTextAreaElement) {
      const caretPosition = focusTarget.value.length;
      focusTarget.setSelectionRange(caretPosition, caretPosition);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(focusTarget);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

function isSectionEditorSheetFocusOwner(): boolean {
  if (typeof document === "undefined") return false;
  const activeElement = document.activeElement;
  return activeElement instanceof Element
    ? Boolean(activeElement.closest(".dasti-cv-section-sheet-panel"))
    : false;
}

function getSectionRailAiMode(section: CvSection): "none" | "rail" | "editor" {
  if (section.type === "profile" || section.type === "contact") return "none";
  if (
    section.type === "summary" ||
    section.type === "skills" ||
    section.type === "languages" ||
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies" ||
    section.type === "text"
  ) {
    return "rail";
  }
  return "editor";
}

function sectionUsesStructuredSuggestions(section: CvSection): boolean {
  return (
    section.type === "skills" ||
    section.type === "languages" ||
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies"
  );
}

function getInitialEditTargetForSection(
  section: CvSection,
): ActivePaperEditTarget | null {
  const sectionId = String(section.id ?? "");
  const firstItem = Array.isArray(section.structuredContent)
    ? (section.structuredContent[0] as Record<string, unknown> | undefined)
    : undefined;
  const itemId = String(firstItem?.id ?? "");

  switch (section.type) {
    case "profile":
      return {
        sectionId,
        sectionType: "profile",
        fieldPath: "structuredContent.0.name",
        fieldKind: "heading",
      };
    case "summary":
      return {
        sectionId,
        sectionType: "summary",
        fieldPath: "structuredContent.0.summary",
        fieldKind: "paragraph",
      };
    case "experience":
      return {
        sectionId,
        sectionType: "experience",
        fieldPath: `structuredContent.item:${itemId}.position`,
        fieldKind: "heading",
      };
    case "education":
      return {
        sectionId,
        sectionType: "education",
        fieldPath: `structuredContent.item:${itemId}.degree`,
        fieldKind: "heading",
      };
    case "skills":
      return {
        sectionId,
        sectionType: "skills",
        fieldPath: `structuredContent.item:${itemId}.name`,
        fieldKind: "chip",
        chipIndex: 0,
      };
    case "languages":
      return {
        sectionId,
        sectionType: "languages",
        fieldPath: `structuredContent.item:${itemId}.name`,
        fieldKind: "chip",
        chipIndex: 0,
      };
    case "projects":
      return {
        sectionId,
        sectionType: "projects",
        fieldPath: `structuredContent.item:${itemId}.name`,
        fieldKind: "heading",
      };
    case "certifications":
      return {
        sectionId,
        sectionType: "certifications",
        fieldPath: `structuredContent.item:${itemId}.certificationName`,
        fieldKind: "paragraph",
      };
    case "achievements":
      return {
        sectionId,
        sectionType: "achievements",
        fieldPath: `structuredContent.item:${itemId}.text`,
        fieldKind: "paragraph",
      };
    case "text":
      return {
        sectionId,
        sectionType:
          section.title.trim().toLowerCase() === "hobbies"
            ? "hobbies"
            : "custom",
        fieldPath:
          section.title.trim().toLowerCase() === "hobbies"
            ? `structuredContent.item:${itemId}.name`
            : "blocks.0.plainText",
        fieldKind:
          section.title.trim().toLowerCase() === "hobbies"
            ? "chip"
            : "paragraph",
      };
    default:
      return null;
  }
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
  if (sectionKind === "summary") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Summary",
      type: "summary",
      blocks: [
        {
          ...makeTextBlock("Summary"),
          content: ensureRemirrorDoc(""),
          plainText: "",
          attributes: { linkedStructuredId: itemId },
        },
      ],
      structuredContent: [{ id: itemId, summary: ensureRemirrorDoc("") }],
      collapsed: false,
    };
  }

  if (sectionKind === "experience") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Experience",
      type: "experience",
      blocks: [
        {
          ...makeTextBlock("Experience"),
          plainText: "",
          attributes: { linkedStructuredId: itemId },
        },
      ],
      structuredContent: [
        {
          id: itemId,
          position: "",
          company: "",
          location: "",
          startDate: "1970-01-01T00:00:00.000Z",
          endDate: null,
          isCurrent: false,
          currentlyWorking: false,
          responsibilityBullets: [""],
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "education") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Education",
      type: "education",
      blocks: [
        {
          ...makeTextBlock("Education"),
          plainText: "",
          attributes: { linkedStructuredId: itemId },
        },
      ],
      structuredContent: [
        {
          id: itemId,
          degree: "",
          institution: "",
          fieldOfStudy: "",
          startDate: undefined,
          endDate: undefined,
          isCurrent: false,
        },
      ] as CvSection["structuredContent"],
      collapsed: false,
    };
  }

  if (sectionKind === "skills") {
    const itemId = uuidv4();
    return {
      id: uuidv4(),
      title: "Skills",
      type: "skills",
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
      | "summary"
      | "experience"
      | "education"
      | "skills"
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

function resolveAccentStyle(
  accent: CvAccentChoice,
): Partial<VerbatiStylePreset> {
  switch (accent) {
    case "terre":
      return { palette: "terre", accentHex: undefined };
    case "ink":
      return { palette: "ink", accentHex: undefined };
    case "cobalt":
      return { palette: "cobalt", accentHex: undefined };
    case "sauge":
      return { palette: "sauge", accentHex: undefined };
    case "plum":
      return { palette: "plum", accentHex: undefined };
    case "ochre":
      return { palette: "ochre", accentHex: undefined };
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
    cvs,
    createNewCv,
    importCv,
    saveCurrentCvStyleOnly,
    isLoading: isCvLibraryLoading,
    isLibraryHydrated,
    lastLibraryFetchFailed,
    loadCv,
  } = useCvLibrary();
  const { importFile: importStructuredCvFile } = useStructuredMistralImport({
    probeOnMount: false,
  });
  const runCvSectionAiAction = useAction(
    ((api.functions as any)?.runCvSectionAiAction ??
      "functions.runCvSectionAiAction") as any,
  );
  const transformEditorSelectionAction = useAction(
    ((api.functions as any)?.transformEditorSelection ??
      "functions.transformEditorSelection") as any,
  );
  const defaultProposalSettings = useQuery(
    ((api.proposalSettings as any)?.getCurrent ??
      "proposalSettings.getCurrent") as any,
    isConvexAuthenticated ? {} : "skip",
  ) as
    | {
        voicePreset?: unknown;
        savedVoicePreset?: unknown;
        verbatiStyle?: VerbatiStylePreset | null;
      }
    | undefined;
  const documentStylePresets = useQuery(
    ((api.proposalSettings as any)?.getPresets ??
      "proposalSettings.getPresets") as any,
    isConvexAuthenticated ? {} : "skip",
  ) as
    | {
        preset1?: {
          fontPairId?: unknown;
          paletteOverride?: unknown;
          accentHex?: unknown;
          verbatiStyle?: unknown;
          name?: unknown;
        } | null;
        preset2?: {
          fontPairId?: unknown;
          paletteOverride?: unknown;
          accentHex?: unknown;
          verbatiStyle?: unknown;
          name?: unknown;
        } | null;
        preset3?: {
          fontPairId?: unknown;
          paletteOverride?: unknown;
          accentHex?: unknown;
          verbatiStyle?: unknown;
          name?: unknown;
        } | null;
        activeSlot?: 1 | 2 | 3 | null;
      }
    | undefined;
  const cvImportInputRef = React.useRef<HTMLInputElement | null>(null);
  const consumedCvForgeActionRef = React.useRef<string | null>(null);
  const paperStageRef = React.useRef<HTMLDivElement | null>(null);
  const inlinePaperSelectionDebounceRef = React.useRef<number | null>(null);
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
    defaultProposalSettings?.savedVoicePreset ??
      defaultProposalSettings?.voicePreset,
  );
  const [cvRailAiSuggestion, setCvRailAiSuggestion] =
    React.useState<CvRailAiSuggestion | null>(null);
  const [cvRailAppliedAiEdit, setCvRailAppliedAiEdit] =
    React.useState<CvRailAppliedAiEdit | null>(null);
  const [paperTextAiSuggestion, setPaperTextAiSuggestion] =
    React.useState<PaperTextAiSuggestion | null>(null);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(
    null,
  );
  const [inlineEditTarget, setInlineEditTarget] =
    React.useState<ActivePaperEditTarget | null>(null);
  const [pendingFocusEditTarget, setPendingFocusEditTarget] =
    React.useState<ActivePaperEditTarget | null>(null);
  const pendingInlineFieldChangeRef = React.useRef<{
    target: ActivePaperEditTarget;
    text: string;
  } | null>(null);
  const inlineFieldChangeTimerRef = React.useRef<number | null>(null);
  const latestInlineSectionsRef = React.useRef<CvSection[]>([]);
  const [inlinePaperSelectionState, setInlinePaperSelectionState] =
    React.useState<InlinePaperSelectionState | null>(null);
  const activeInlinePaperAiRequestIdRef = React.useRef<string | null>(null);
  const [isApplyingInlinePaperAi, setIsApplyingInlinePaperAi] =
    React.useState(false);
  const [pendingInlinePaperAiActionId, setPendingInlinePaperAiActionId] =
    React.useState<InlineAiActionId | null>(null);
  const [pendingActiveSection, setPendingActiveSection] =
    React.useState<CvSection | null>(null);
  const sectionActionHandlersRef = React.useRef<{
    ask?: (sectionId: string) => void;
    toggleHidden?: (sectionId: string) => void;
    delete?: (sectionId: string) => void;
  }>({});
  const [sectionEditorOpen, setSectionEditorOpen] = React.useState(false);
  const [importReviewOpen, setImportReviewOpen] = React.useState(false);
  const [dismissedImportReviewCvIds, setDismissedImportReviewCvIds] =
    React.useState<string[]>([]);
  const currentSections = React.useMemo<CvSection[]>(
    () => (currentCv?.sections ?? []) as CvSection[],
    [currentCv?.sections],
  );
  const optimisticSections = React.useMemo<CvSection[]>(() => {
    const pendingSectionId = pendingActiveSection?.id
      ? String(pendingActiveSection.id)
      : null;
    if (!pendingActiveSection || !pendingSectionId) {
      return currentSections;
    }
    const found = currentSections.some(
      (section, index) => getCvSectionId(section, index) === pendingSectionId,
    );
    if (!found) {
      return currentSections;
    }
    return currentSections.map((section, index) =>
      getCvSectionId(section, index) === pendingSectionId
        ? pendingActiveSection
        : section,
    );
  }, [currentSections, pendingActiveSection]);
  React.useEffect(() => {
    latestInlineSectionsRef.current = optimisticSections;
  }, [optimisticSections]);
  const optimisticCv = React.useMemo<CvDocument | null>(() => {
    if (!currentCv || optimisticSections === currentSections) {
      return currentCv ?? null;
    }
    return {
      ...currentCv,
      sections: optimisticSections,
    } as CvDocument;
  }, [currentCv, currentSections, optimisticSections]);

  const handleResumeLinkIntent = React.useCallback(
    (intent: ResumeLinkIntent) => {
      setInlineEditTarget(null);
      const matchedSection =
        (intent.sectionId
          ? findSectionById(currentSections, intent.sectionId)
          : null) ??
        currentSections.find(
          (section) => getCanonicalSectionType(section) === intent.sectionType,
        ) ??
        null;
      const matchedSectionId = matchedSection?.id
        ? String(matchedSection.id)
        : null;
      if (
        workspaceMode === "edit" &&
        (intent.source === "preview-panel" ||
          intent.source === "preview-workspace")
      ) {
        if (matchedSectionId) {
          setActiveSectionId(matchedSectionId);
          focusPreviewSection(matchedSectionId);
        }
        setResumeActiveTarget({
          sectionType: intent.sectionType,
          previewSectionType: intent.previewSectionType,
          itemId: intent.itemId,
          sectionId: matchedSectionId ?? intent.sectionId,
          source: intent.source,
        });
        return;
      }
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
  const activeSettingsCvStylePreset = React.useMemo(() => {
    const activeSlot = resolveDocumentStyleSlotId(documentStylePresets?.activeSlot);
    const source = activeSlot
      ? documentStylePresets?.[`preset${activeSlot}`]
      : null;
    if (!activeSlot || !source) return null;

    const factorySlot = getFactoryDocumentStyleSlot(activeSlot);
    const sourceStyle =
      (source.verbatiStyle as Partial<VerbatiStylePreset> | null | undefined) ??
      null;
    const typography =
      (source.fontPairId as VerbatiFontPairId | undefined) ??
      (sourceStyle?.typography as VerbatiFontPairId | undefined) ??
      factorySlot.appearance.typography;
    const palette =
      (source.paletteOverride as VerbatiStylePreset["palette"] | undefined) ??
      (sourceStyle?.palette as VerbatiStylePreset["palette"] | undefined) ??
      factorySlot.appearance.palette;
    const accentHex =
      (typeof source.accentHex === "string" ? source.accentHex : undefined) ??
      (sourceStyle?.accentHex as string | undefined);

    return resolveVerbatiStyle({
      ...factorySlot.appearance,
      ...sourceStyle,
      typography,
      palette,
      resumeTemplateId:
        sourceStyle?.resumeTemplateId ?? factorySlot.defaultCvTemplateId,
      ...(accentHex ? { accentHex } : {}),
    });
  }, [
    documentStylePresets?.activeSlot,
    documentStylePresets?.preset1,
    documentStylePresets?.preset2,
    documentStylePresets?.preset3,
  ]);
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    persistStyle: saveCurrentCvStyleOnly,
    fallbackStylePreset:
      activeSettingsCvStylePreset ?? defaultProposalSettings?.verbatiStyle ?? null,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const filteredPreviewCv = React.useMemo(
    () => applyHiddenSectionsToCvDocument(optimisticCv, hiddenSectionIds),
    [hiddenSectionIds, optimisticCv],
  );
  const resumePreviewData = React.useMemo(
    () =>
      filteredPreviewCv
        ? buildCanonicalResumeRenderModelFromCv(filteredPreviewCv, {
            includeDrafts: workspaceMode === "edit",
          })
        : null,
    [filteredPreviewCv, workspaceMode],
  );
  const hasResumePaper =
    workspaceMode === "edit" && currentCv
      ? true
      : hasRenderableResumeData(resumePreviewData);
  const shouldShowEmptyCvChoice =
    !currentCv &&
    !hasResumePaper &&
    isLibraryHydrated &&
    !isCvLibraryLoading &&
    !lastLibraryFetchFailed;
  const shouldShowCvRestorePending =
    !currentCv &&
    !hasResumePaper &&
    (isCvLibraryLoading || !isLibraryHydrated || lastLibraryFetchFailed);
  const sanitizedHiddenSectionIds = React.useMemo(
    () => sanitizeHiddenSectionIds(currentCv?.sections ?? [], hiddenSectionIds),
    [currentCv?.sections, hiddenSectionIds],
  );
  const activeSection = React.useMemo(() => {
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
  }, [activeSectionId, currentSections, pendingActiveSection]);
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
    setPaperTextAiSuggestion(null);
    activeInlinePaperAiRequestIdRef.current = null;
    setIsApplyingInlinePaperAi(false);
    setPendingInlinePaperAiActionId(null);
    setInlinePaperSelectionState(null);
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

  const resumeOptions = React.useMemo(
    () =>
      cvs.map((cv) => {
        const cvId = String(cv.id);
        const sectionCount = Array.isArray(cv.sections)
          ? cv.sections.length
          : 0;
        return {
          id: cvId,
          title:
            typeof cv.title === "string" && cv.title.trim()
              ? cv.title.trim()
              : deriveCvTitleFromSections(cv.sections),
          description:
            sectionCount > 0
              ? `${sectionCount} ${sectionCount === 1 ? "section" : "sections"}`
              : "Saved resume.",
          selected: cvId === String(currentCvId ?? ""),
        };
      }),
    [currentCvId, cvs],
  );

  const handlePickResume = React.useCallback(
    (cvId: string) => {
      loadCv(cvId);
      navigateToSelectedCv(cvId);
    },
    [loadCv, navigateToSelectedCv],
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
    if (!pendingFocusEditTarget || workspaceMode !== "edit") {
      return;
    }
    if (sectionEditorOpen && isSectionEditorSheetFocusOwner()) {
      return;
    }
    focusInlinePaperEditTarget(pendingFocusEditTarget);
    const timeoutId = window.setTimeout(() => {
      if (sectionEditorOpen && isSectionEditorSheetFocusOwner()) {
        return;
      }
      focusInlinePaperEditTarget(pendingFocusEditTarget);
      setPendingFocusEditTarget(null);
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [
    pendingFocusEditTarget,
    resumePreviewData,
    sectionEditorOpen,
    workspaceMode,
  ]);

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
      activeSectionId !== null
        ? findSectionById(currentSections, activeSectionId)
        : null;
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
      JSON.stringify(currentActiveSection) ===
        JSON.stringify(pendingActiveSection)
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

    try {
      window.localStorage.setItem(
        CV_FORGE_WORKSPACE_MODE_STORAGE_KEY,
        workspaceMode === "preview" ? "preview" : "edit",
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[CvForge] workspace mode storage unavailable", error);
      }
    }
  }, [workspaceMode]);

  React.useEffect(() => {
    if (workspaceMode === "preview") {
      setInlineEditTarget(null);
    }
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
              const source = isStyledPdf
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
                      resumeTypographyAudit: buildResumeTypographyAuditMetadata(
                        {
                          cvId: String(currentCv.id),
                          cvUrl:
                            typeof window !== "undefined"
                              ? window.location.href
                              : null,
                          rendererVariantId: source.rendererVariantId,
                          stylePreset: source.stylePreset,
                          previewCapture: readResumePreviewDebugCapture(),
                          timestamp: Date.now(),
                        },
                      ),
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

  const cvWorkbenchShellStyle = {
    width: "100%",
    maxWidth: "100%",
    marginInline: "auto",
    "--cv-paper-visual-inline-size": `min(100%, ${CV_PAPER_VISUAL_INLINE_SIZE})`,
    "--cv-workspace-stage-inline-size": "var(--cv-paper-visual-inline-size)",
  } as React.CSSProperties;
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
      setInlineEditTarget(null);
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

  const handleAskAiForSection = React.useCallback(
    (sectionId: string) => {
      setInlineEditTarget(null);
      const section = findSectionById(currentSections, sectionId);
      setCvRailAiSuggestion(null);
      setActiveSectionId(sectionId);
      setResumeActiveTarget(getSectionTarget(section));
      focusPreviewSection(sectionId);
      setCvRailTab("ai");
    },
    [currentSections],
  );

  const handleSectionChange = React.useCallback(
    (nextSection: CvSection) => {
      if (!currentCv || !activeSectionId) return;
      const now = new Date().toISOString();
      const nextSections = currentSections.map((section, index) =>
        getCvSectionId(section, index) === activeSectionId
          ? nextSection
          : section,
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

  const handleInlineSummaryChange = React.useCallback(
    (text: string) => {
      const nextText = normalizeInlinePlainText(text);
      const summarySection = currentSections.find(
        (section) => getCanonicalSectionType(section) === "summary",
      );
      if (!summarySection) return;

      const currentText = collectPlainText(
        getStructuredItems(summarySection)[0]?.summary,
      );
      if (currentText === nextText) return;

      const nextSection = updateSummaryStructuredText(summarySection, nextText);
      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      persistSections(
        currentSections.map((section) =>
          section === summarySection ? nextSection : section,
        ),
      );
    },
    [currentSections, persistSections],
  );

  const handleInlineTextSectionChange = React.useCallback(
    (sectionId: string, text: string) => {
      const nextText = normalizeInlinePlainText(text);
      const textSection = findSectionById(currentSections, sectionId);
      if (!textSection || getCanonicalSectionType(textSection) === "hobbies") {
        return;
      }

      const canonicalType = getCanonicalSectionType(textSection);
      if (
        canonicalType !== "additional_information" &&
        canonicalType !== "custom"
      ) {
        return;
      }

      const currentText = collectPlainText(
        textSection.blocks[0]?.plainText ?? textSection.blocks[0]?.content,
      );
      if (currentText === nextText) return;

      const nextSection = updateFirstTextBlock(textSection, nextText);
      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      persistSections(
        currentSections.map((section, index) =>
          getCvSectionId(section, index) === sectionId ? nextSection : section,
        ),
      );
    },
    [currentSections, persistSections],
  );

  const applyInlineFieldChange = React.useCallback(
    (target: ActivePaperEditTarget, text: string) => {
      const nextText = normalizeInlinePlainText(text);
      const focusedEditable =
        typeof document !== "undefined" &&
        document.activeElement instanceof Element
          ? document.activeElement.closest(
              '[data-inline-paper-editable="true"]',
            )
          : null;
      const focusedTarget = readInlinePaperEditTarget(focusedEditable);
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, target.sectionId);
      if (!section) return;

      let nextSection: CvSection | null = null;
      if (target.fieldPath === "structuredContent.0.summary") {
        nextSection = updateSummaryStructuredText(section, nextText);
      } else if (target.fieldPath === "blocks.0.plainText") {
        nextSection = updateFirstTextBlock(section, nextText);
      } else if (target.fieldPath.startsWith("structuredContent.0.")) {
        const field = target.fieldPath.slice("structuredContent.0.".length);
        nextSection = updateProfileStructuredField(section, field, nextText);
      } else {
        const itemMatch = target.fieldPath.match(
          /^structuredContent\.item:([^.]*)\.(.+)$/,
        );
        if (itemMatch) {
          const [, itemId, itemFieldPath] = itemMatch;
          const bulletMatch = itemFieldPath.match(
            /^responsibilityBullets\.(\d+)$/,
          );
          if (bulletMatch) {
            nextSection = updateStructuredItemBullet(
              section,
              itemId,
              Number(bulletMatch[1]),
              nextText,
            );
          } else {
            nextSection = updateStructuredItemField(
              section,
              itemId,
              itemFieldPath,
              nextText,
            );
          }
        }
      }

      if (
        !nextSection ||
        JSON.stringify(nextSection) === JSON.stringify(section)
      ) {
        return;
      }

      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === target.sectionId
          ? nextSection
          : currentSection,
      );
      latestInlineSectionsRef.current = nextSections;
      persistSections(nextSections);
      if (focusedTarget && focusedTarget.fieldPath !== target.fieldPath) {
        window.requestAnimationFrame(() => {
          focusInlinePaperEditTarget(focusedTarget);
        });
      }
    },
    [currentSections, persistSections],
  );

  const flushPendingInlineFieldChange = React.useCallback(() => {
    if (inlineFieldChangeTimerRef.current !== null) {
      window.clearTimeout(inlineFieldChangeTimerRef.current);
      inlineFieldChangeTimerRef.current = null;
    }

    const pending = pendingInlineFieldChangeRef.current;
    pendingInlineFieldChangeRef.current = null;
    if (!pending) return;

    applyInlineFieldChange(pending.target, pending.text);
  }, [applyInlineFieldChange]);

  const handleInlineFieldChange = React.useCallback(
    (target: ActivePaperEditTarget, text: string) => {
      if (inlineFieldChangeTimerRef.current !== null) {
        window.clearTimeout(inlineFieldChangeTimerRef.current);
        inlineFieldChangeTimerRef.current = null;
      }
      if (target.fieldKind === "paragraph") {
        pendingInlineFieldChangeRef.current = { target, text };
        return;
      }
      pendingInlineFieldChangeRef.current = null;
      applyInlineFieldChange(target, text);
    },
    [applyInlineFieldChange],
  );

  const handleInlineFieldDocChange = React.useCallback(
    (target: ActivePaperEditTarget, doc: RemirrorJSON) => {
      pendingInlineFieldChangeRef.current = null;
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, target.sectionId);
      if (!section) {
        return;
      }
      let nextSection: CvSection | null = null;
      if (target.fieldPath === "structuredContent.0.summary") {
        nextSection = updateSummaryStructuredDoc(section, doc);
      } else {
        const responsibilityMatch = target.fieldPath.match(
          /^structuredContent\.item:([^.]*)\.responsibilities$/,
        );
        if (responsibilityMatch && target.sectionType === "experience") {
          const itemId = responsibilityMatch[1] ?? "";
          nextSection = updateStructuredItemResponsibilities(
            section,
            itemId,
            doc,
            responsibilityBulletCacheFromDoc(doc),
          );
        }

        const itemMatch = target.fieldPath.match(
          /^structuredContent\.item:([^.]*)\.description$/,
        );
        if (!nextSection && itemMatch && target.sectionType === "projects") {
          const itemId = itemMatch[1] ?? "";
          const items = getStructuredItems(section);
          const itemIndex = items.findIndex(
            (item) => String(item.id ?? "") === itemId,
          );
          if (itemIndex >= 0) {
            nextSection = {
              ...section,
              structuredContent: items.map((item, index) =>
                index === itemIndex ? { ...item, description: doc } : item,
              ) as CvSection["structuredContent"],
            };
          }
        }
      }
      if (!nextSection) {
        return;
      }
      if (JSON.stringify(nextSection) === JSON.stringify(section)) {
        return;
      }
      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === target.sectionId
          ? nextSection
          : currentSection,
      );
      latestInlineSectionsRef.current = nextSections;
      persistSections(nextSections);
    },
    [currentSections, persistSections],
  );

  React.useEffect(
    () => () => {
      if (inlineFieldChangeTimerRef.current !== null) {
        window.clearTimeout(inlineFieldChangeTimerRef.current);
      }
    },
    [],
  );

  const handleInlineAddItem = React.useCallback(
    (request: Parameters<NonNullable<ResumeInlineEditing["onAddItem"]>>[0]) => {
      flushPendingInlineFieldChange();
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, request.sectionId);
      if (!section) return;

      const items = getStructuredItems(section);
      const itemId = uuidv4();
      let nextSection: CvSection | null = null;
      let nextTarget: ActivePaperEditTarget | null = null;

      const appendItem = (
        item: Record<string, unknown>,
        target: ActivePaperEditTarget,
      ) => {
        nextSection = {
          ...section,
          structuredContent: [...items, item] as CvSection["structuredContent"],
        };
        nextTarget = target;
      };

      switch (request.itemKind) {
        case "profile-contact": {
          const field = request.parentItemId ?? "email";
          nextSection = addProfileDraftContactField(section, field);
          nextTarget = {
            sectionId: request.sectionId,
            sectionType: "profile",
            fieldPath: `structuredContent.0.${field}`,
            fieldKind: "meta",
          };
          break;
        }
        case "skill":
          appendItem(
            { id: itemId, name: "", level: "Intermediate" },
            {
              sectionId: request.sectionId,
              sectionType: "skills",
              fieldPath: `structuredContent.item:${itemId}.name`,
              fieldKind: "chip",
              chipIndex: items.length,
            },
          );
          break;
        case "language":
          appendItem(
            { id: itemId, name: "", level: "" },
            {
              sectionId: request.sectionId,
              sectionType: "languages",
              fieldPath: `structuredContent.item:${itemId}.name`,
              fieldKind: "chip",
              chipIndex: items.length,
            },
          );
          break;
        case "hobby":
          appendItem(
            { id: itemId, name: "" },
            {
              sectionId: request.sectionId,
              sectionType: "hobbies",
              fieldPath: `structuredContent.item:${itemId}.name`,
              fieldKind: "chip",
              chipIndex: items.length,
            },
          );
          break;
        case "achievement":
          appendItem(
            { id: itemId, text: "" },
            {
              sectionId: request.sectionId,
              sectionType: "achievements",
              fieldPath: `structuredContent.item:${itemId}.text`,
              fieldKind: "paragraph",
            },
          );
          break;
        case "certification":
          appendItem(
            {
              id: itemId,
              certificationName: "",
              issuingOrganization: "",
              issueDate: undefined,
              expirationDate: null,
              credentialId: "",
            },
            {
              sectionId: request.sectionId,
              sectionType: "certifications",
              fieldPath: `structuredContent.item:${itemId}.certificationName`,
              fieldKind: "paragraph",
            },
          );
          break;
        case "project":
          appendItem(
            { id: itemId, name: "", meta: "", description: "" },
            {
              sectionId: request.sectionId,
              sectionType: "projects",
              fieldPath: `structuredContent.item:${itemId}.name`,
              fieldKind: "heading",
            },
          );
          break;
        case "affiliation":
          appendItem(
            {
              id: itemId,
              organizationName: "",
              roleOrMembershipType: "",
              notes: "",
            },
            {
              sectionId: request.sectionId,
              sectionType: "affiliations",
              fieldPath: `structuredContent.item:${itemId}.organizationName`,
              fieldKind: "paragraph",
            },
          );
          break;
        case "experience":
          appendItem(
            {
              id: itemId,
              position: "",
              company: "",
              location: "",
              startDate: "1970-01-01T00:00:00.000Z",
              endDate: null,
              isCurrent: false,
              currentlyWorking: false,
              responsibilityBullets: [""],
            },
            {
              sectionId: request.sectionId,
              sectionType: "experience",
              fieldPath: `structuredContent.item:${itemId}.position`,
              fieldKind: "heading",
            },
          );
          break;
        case "education":
          appendItem(
            {
              id: itemId,
              degree: "",
              institution: "",
              fieldOfStudy: "",
              startDate: undefined,
              endDate: undefined,
              isCurrent: false,
            },
            {
              sectionId: request.sectionId,
              sectionType: "education",
              fieldPath: `structuredContent.item:${itemId}.degree`,
              fieldKind: "heading",
            },
          );
          break;
        case "bullet": {
          let parentItemId = request.parentItemId;
          let parent = parentItemId
            ? items.find(
                (item) =>
                  String((item as Record<string, unknown>).id ?? "") ===
                  parentItemId,
              )
            : undefined;
          if (!parent && items.length > 0) {
            parent = items[0];
            parentItemId = String((parent as Record<string, unknown>).id ?? "");
          }
          if (!parentItemId) return;
          const bulletIndex = parent
            ? countCanonicalResponsibilityBullets(parent)
            : 0;
          nextSection = updateStructuredItemBullet(
            section,
            parentItemId,
            bulletIndex,
            "",
          );
          nextTarget = {
            sectionId: request.sectionId,
            sectionType: "experience",
            fieldPath: `structuredContent.item:${parentItemId}.responsibilityBullets.${bulletIndex}`,
            fieldKind: "bullet",
            bulletIndex,
          };
          break;
        }
        case "paragraph": {
          let parentItemId = request.parentItemId;
          let parent = parentItemId
            ? items.find(
                (item) =>
                  String((item as Record<string, unknown>).id ?? "") ===
                  parentItemId,
              )
            : undefined;
          if (!parent && items.length > 0) {
            parent = items[0];
            parentItemId = String((parent as Record<string, unknown>).id ?? "");
          }
          if (!parentItemId) return;
          nextSection = addStructuredItemDraftDescription(
            section,
            parentItemId,
          );
          nextTarget = {
            sectionId: request.sectionId,
            sectionType: "experience",
            fieldPath: `structuredContent.item:${parentItemId}.responsibilities`,
            fieldKind: "paragraph",
          };
          break;
        }
      }

      const savedSection = nextSection;
      if (!savedSection || !nextTarget) return;
      setPendingActiveSection(savedSection);
      setActiveSectionId(request.sectionId);
      setResumeActiveTarget(getSectionTarget(savedSection));
      setSectionEditorOpen(false);
      setInlineEditTarget(nextTarget);
      setPendingFocusEditTarget(nextTarget);
      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === request.sectionId
          ? savedSection
          : currentSection,
      );
      latestInlineSectionsRef.current = nextSections;
      persistSections(nextSections);
    },
    [currentSections, flushPendingInlineFieldChange, persistSections],
  );

  const resumeInlineEditing = React.useMemo<ResumeInlineEditing>(
    () => ({
      enabled: workspaceMode === "edit",
      activeTarget: inlineEditTarget,
      onActivate: (target) => {
        setInlineEditTarget(target);
        setActiveSectionId(target.sectionId);
      },
      onDeactivate: (target) => {
        const pending = pendingInlineFieldChangeRef.current;
        const pendingMatches =
          Boolean(target && pending) &&
          pending?.target.sectionId === target?.sectionId &&
          pending?.target.fieldPath === target?.fieldPath;
        const escape = (value: string) =>
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(value)
            : value.replace(/"/g, '\\"');
        const currentNode =
          target && typeof document !== "undefined"
            ? document.querySelector<HTMLElement>(
                `[data-inline-paper-editable="true"][data-paper-section-id="${escape(
                  target.sectionId,
                )}"][data-paper-field-path="${escape(target.fieldPath)}"]`,
              )
            : null;
        const currentText = pendingMatches
          ? pending?.text ?? ""
          : currentNode instanceof HTMLTextAreaElement
            ? currentNode.value
            : (currentNode?.textContent ?? "").trim()
              ? currentNode?.textContent ?? ""
              : "";
        const optionalProfileContactField =
          readOptionalProfileContactField(target);

        if (target && optionalProfileContactField && !currentText.trim()) {
          pendingInlineFieldChangeRef.current = null;
          if (inlineFieldChangeTimerRef.current !== null) {
            window.clearTimeout(inlineFieldChangeTimerRef.current);
            inlineFieldChangeTimerRef.current = null;
          }

          const baseSections =
            latestInlineSectionsRef.current.length > 0
              ? latestInlineSectionsRef.current
              : currentSections;
          const section = findSectionById(baseSections, target.sectionId);
          if (section) {
            const nextSection = removeProfileDraftContactField(
              section,
              optionalProfileContactField,
            );
            const nextSections = baseSections.map((currentSection, index) =>
              getCvSectionId(currentSection, index) === target.sectionId
                ? nextSection
                : currentSection,
            );
            latestInlineSectionsRef.current = nextSections;
            setPendingActiveSection(nextSection);
            setResumeActiveTarget(getSectionTarget(nextSection));
            persistSections(nextSections);
          }
          setInlineEditTarget(null);
          return;
        }

        if (target?.fieldKind === "bullet") {
          if (!currentText.trim()) {
            pendingInlineFieldChangeRef.current = null;
            if (inlineFieldChangeTimerRef.current !== null) {
              window.clearTimeout(inlineFieldChangeTimerRef.current);
              inlineFieldChangeTimerRef.current = null;
            }

            const itemMatch = target.fieldPath.match(
              /^structuredContent\.item:([^.]*)\.responsibilityBullets\.(\d+)$/,
            );
            if (itemMatch) {
              const [, itemId, bulletIndex] = itemMatch;
              const baseSections =
                latestInlineSectionsRef.current.length > 0
                  ? latestInlineSectionsRef.current
                  : currentSections;
              const section = findSectionById(baseSections, target.sectionId);
              if (section) {
                const nextSection = removeStructuredItemBullet(
                  section,
                  itemId,
                  Number(bulletIndex),
                );
                const nextSections = baseSections.map(
                  (currentSection, index) =>
                    getCvSectionId(currentSection, index) === target.sectionId
                      ? nextSection
                      : currentSection,
                );
                latestInlineSectionsRef.current = nextSections;
                setPendingActiveSection(nextSection);
                setResumeActiveTarget(getSectionTarget(nextSection));
                persistSections(nextSections);
              }
            }
          } else {
            flushPendingInlineFieldChange();
          }
        } else if (!currentText.trim()) {
          const itemMatch = target?.fieldPath.match(
            /^structuredContent\.item:([^.]*)\.([^.]+)$/,
          );
          const baseSections =
            latestInlineSectionsRef.current.length > 0
              ? latestInlineSectionsRef.current
              : currentSections;
          const section = target
            ? findSectionById(baseSections, target.sectionId)
            : null;
          if (
            target &&
            section &&
            itemMatch &&
            getStructuredItems(section).length > 1 &&
            isStructuredItemEmptyAfterFieldChange(
              section,
              itemMatch[1],
              itemMatch[2],
              "",
            )
          ) {
            pendingInlineFieldChangeRef.current = null;
            if (inlineFieldChangeTimerRef.current !== null) {
              window.clearTimeout(inlineFieldChangeTimerRef.current);
              inlineFieldChangeTimerRef.current = null;
            }

            const nextSection = removeStructuredItem(section, itemMatch[1]);
            const nextSections = baseSections.map((currentSection, index) =>
              getCvSectionId(currentSection, index) === target.sectionId
                ? nextSection
                : currentSection,
            );
            latestInlineSectionsRef.current = nextSections;
            setPendingActiveSection(nextSection);
            setResumeActiveTarget(getSectionTarget(nextSection));
            persistSections(nextSections);
          } else {
            flushPendingInlineFieldChange();
          }
        } else {
          flushPendingInlineFieldChange();
        }
        setInlineEditTarget(null);
      },
      onSummaryChange: handleInlineSummaryChange,
      onTextSectionChange: handleInlineTextSectionChange,
      onFieldChange: handleInlineFieldChange,
      onFieldDocChange: handleInlineFieldDocChange,
      onAddItem: handleInlineAddItem,
    }),
    [
      currentSections,
      flushPendingInlineFieldChange,
      handleInlineAddItem,
      handleInlineFieldChange,
      handleInlineFieldDocChange,
      handleInlineSummaryChange,
      handleInlineTextSectionChange,
      inlineEditTarget,
      persistSections,
      workspaceMode,
    ],
  );

  React.useEffect(() => {
    return () => {
      if (inlinePaperSelectionDebounceRef.current !== null) {
        window.clearTimeout(inlinePaperSelectionDebounceRef.current);
      }
    };
  }, []);

  const runInlinePaperSelectionCheck = React.useCallback(() => {
    if (workspaceMode !== "edit" || isPrimaryPointerPressed()) {
      return;
    }

    const root = paperStageRef.current;
    const selectionState = getDomSelectionState(root);
    const selection =
      typeof window !== "undefined" ? window.getSelection() : null;
    const focusElement =
      selection?.focusNode instanceof Element
        ? selection.focusNode
        : selection?.focusNode?.parentElement;
    const editableElement = focusElement?.closest(
      '[data-inline-paper-editable="true"]',
    );
    const editTarget = readInlinePaperEditTarget(editableElement);

    if (!selectionState || !editTarget) {
      if (isInlineAiToolbarActiveElement()) {
        return;
      }
      setInlinePaperSelectionState(null);
      return;
    }

    setInlinePaperSelectionState({
      ...selectionState,
      editTarget,
      range:
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null,
    });
  }, [workspaceMode]);

  const scheduleInlinePaperSelectionCheck = React.useCallback(
    (immediate = false) => {
      if (inlinePaperSelectionDebounceRef.current !== null) {
        window.clearTimeout(inlinePaperSelectionDebounceRef.current);
      }

      if (immediate) {
        runInlinePaperSelectionCheck();
        return;
      }

      inlinePaperSelectionDebounceRef.current = window.setTimeout(() => {
        inlinePaperSelectionDebounceRef.current = null;
        runInlinePaperSelectionCheck();
      }, 90);
    },
    [runInlinePaperSelectionCheck],
  );

  React.useEffect(() => {
    if (workspaceMode !== "edit") {
      setInlinePaperSelectionState(null);
      return undefined;
    }

    const handleSelectionChange = () => scheduleInlinePaperSelectionCheck();
    const handlePointerUp = () => scheduleInlinePaperSelectionCheck();

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [scheduleInlinePaperSelectionCheck, workspaceMode]);

  React.useEffect(() => {
    if (workspaceMode !== "edit" || !inlinePaperSelectionState) {
      clearInlinePaperAiSelectionHighlight();
      return undefined;
    }

    clearInlinePaperAiSelectionHighlight();
    const escape = (value: string) =>
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(value)
        : value.replace(/"/g, '\\"');
    const editableElement =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(
            `[data-inline-paper-editable="true"][data-paper-section-id="${escape(
              inlinePaperSelectionState.editTarget.sectionId,
            )}"][data-paper-field-path="${escape(
              inlinePaperSelectionState.editTarget.fieldPath,
            )}"]`,
          )
        : null;

    editableElement?.setAttribute("data-inline-ai-selection-active", "true");
    const HighlightCtor =
      typeof window !== "undefined"
        ? (
            window as typeof window & {
              Highlight?: new (...ranges: Range[]) => unknown;
            }
          ).Highlight
        : undefined;
    const highlights = getCssHighlights();
    if (highlights && HighlightCtor && inlinePaperSelectionState.range) {
      highlights.set(
        INLINE_PAPER_AI_HIGHLIGHT_NAME,
        new HighlightCtor(inlinePaperSelectionState.range),
      );
    }

    return clearInlinePaperAiSelectionHighlight;
  }, [inlinePaperSelectionState, workspaceMode]);

  const applyInlineExperienceResponsibilityAiResult = React.useCallback(
    (args: {
      target: ActivePaperEditTarget;
      selectedText: string;
      resultText: string;
      actionId: string;
    }): boolean => {
      if (args.target.sectionType !== "experience") return false;

      const itemMatch = args.target.fieldPath.match(
        /^structuredContent\.item:([^.]*)\.(.+)$/,
      );
      if (!itemMatch) return false;

      const [, itemId, itemFieldPath] = itemMatch;
      const bulletMatch = itemFieldPath.match(/^responsibilityBullets\.(\d+)$/);
      if (!bulletMatch && itemFieldPath !== "responsibilities") return false;

      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, args.target.sectionId);
      const item = section ? getStructuredItemById(section, itemId) : undefined;
      if (!section || !item) return false;

      const source = bulletMatch
        ? [args.selectedText]
        : getResponsibilitySource(item);
      const normalized = normalizeResponsibilityAiResultForSource({
        source,
        rawText: args.resultText,
        requestedActionId: args.actionId,
      });
      if (!normalized.ok) {
        showToast(
          normalized.reason === "incomplete_output"
            ? "AI returned incomplete responsibilities."
            : "AI returned unusable responsibilities.",
          { variant: "warning" },
        );
        return true;
      }

      let nextSection: CvSection;
      if (bulletMatch) {
        const replacementItems = getResponsibilityReplacementItems(normalized);
        const mergedText = buildResponsibilityTextWithBulletReplacement({
          item,
          bulletIndex: Number(bulletMatch[1]),
          replacementItems,
        });
        const merged = normalizeResponsibilityAiResultForSource({
          source: getResponsibilitySource(item),
          rawText: mergedText,
          requestedActionId: args.actionId,
        });
        if (!merged.ok) {
          showToast("AI returned unusable responsibilities.", {
            variant: "warning",
          });
          return true;
        }
        nextSection = updateStructuredItemResponsibilities(
          section,
          itemId,
          merged.doc,
          merged.responsibilityBullets,
        );
      } else {
        nextSection = updateStructuredItemResponsibilities(
          section,
          itemId,
          normalized.doc,
          normalized.responsibilityBullets,
        );
      }

      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === args.target.sectionId
          ? nextSection
          : currentSection,
      );
      latestInlineSectionsRef.current = nextSections;
      persistSections(nextSections);
      focusInlinePaperEditTarget(args.target);
      return true;
    },
    [currentSections, persistSections, showToast],
  );

  const handleRunInlinePaperAiAction = React.useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!inlinePaperSelectionState) return;
      const escape = (value: string) =>
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(value)
          : value.replace(/"/g, '\\"');
      const editableElement = document.querySelector<HTMLElement>(
        `[data-inline-paper-editable="true"][data-paper-section-id="${escape(
          inlinePaperSelectionState.editTarget.sectionId,
        )}"][data-paper-field-path="${escape(
          inlinePaperSelectionState.editTarget.fieldPath,
        )}"]`,
      );
      if (!editableElement) return;

      const interactionId = createAiInteractionId();
      const requestId = interactionId;
      const target = inlinePaperSelectionState.editTarget;
      const section = findSectionById(currentSections, target.sectionId);
      const sectionLabel = section?.title || "Section";
      activeInlinePaperAiRequestIdRef.current = requestId;
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "section_editor",
        actionId,
      });

      try {
        setPendingInlinePaperAiActionId(actionId);
        setIsApplyingInlinePaperAi(true);
        setCvRailAppliedAiEdit(null);
        setActiveSectionId(target.sectionId);
        setResumeActiveTarget(getSectionTarget(section));
        setCvRailTab("ai");
        setCvRailAiSuggestion({
          sectionId: target.sectionId,
          sectionLabel,
          beforeText: inlinePaperSelectionState.text,
          afterText: "",
          state: "loading",
          interactionId,
          inlineTarget: {
            editTarget: target,
            selectedText: inlinePaperSelectionState.text,
            actionId,
          },
        });
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: inlinePaperSelectionState.text,
        });
        const normalizedResult = normalizeEditorAiTextResult(result, actionId);
        if (!normalizedResult) {
          if (activeInlinePaperAiRequestIdRef.current !== requestId) {
            return;
          }
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId,
            errorKind: "empty_result",
          });
          setCvRailAiSuggestion((current) =>
            current?.interactionId === interactionId
              ? {
                  ...current,
                  afterText: "",
                  state: "error",
                  errorMessage: "AI returned no usable section text.",
                }
              : current,
          );
          return;
        }
        if (activeInlinePaperAiRequestIdRef.current !== requestId) {
          return;
        }

        if (
          pendingInlineFieldChangeRef.current?.target.sectionId ===
            target.sectionId &&
          pendingInlineFieldChangeRef.current?.target.fieldPath ===
            target.fieldPath
        ) {
          pendingInlineFieldChangeRef.current = null;
        }
        setCvRailAiSuggestion({
          sectionId: target.sectionId,
          sectionLabel,
          beforeText: inlinePaperSelectionState.text,
          afterText: normalizedResult.text,
          state: "ready",
          interactionId,
          inlineTarget: {
            editTarget: target,
            selectedText: inlinePaperSelectionState.text,
            actionId: normalizedResult.actionId,
          },
        });
        focusPreviewSection(target.sectionId);
        setInlinePaperSelectionState(null);
        activeInlinePaperAiRequestIdRef.current = null;
        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "section_editor",
          actionId: normalizedResult.actionId,
          applyMode: "preview_required",
          outputMode: "single_text",
        });
      } catch (error) {
        if (activeInlinePaperAiRequestIdRef.current !== requestId) {
          return;
        }
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "section_editor",
          actionId,
          errorKind: "request_failed",
        });
        setCvRailAiSuggestion((current) =>
          current?.interactionId === interactionId
            ? {
                ...current,
                afterText: "",
                state: "error",
                errorMessage:
                  error instanceof Error && error.message
                    ? error.message
                    : "AI is unavailable for this selection.",
              }
            : current,
        );
        throw error;
      } finally {
        if (activeInlinePaperAiRequestIdRef.current === requestId) {
          activeInlinePaperAiRequestIdRef.current = null;
          setIsApplyingInlinePaperAi(false);
          setPendingInlinePaperAiActionId(null);
        } else if (activeInlinePaperAiRequestIdRef.current === null) {
          setIsApplyingInlinePaperAi(false);
          setPendingInlinePaperAiActionId(null);
        }
      }
    },
    [
      currentSections,
      inlinePaperSelectionState,
      transformEditorSelectionAction,
    ],
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
      const nextEditTarget = getInitialEditTargetForSection(nextSection);
      setPendingActiveSection(nextSection);
      setActiveSectionId(nextSectionId);
      setResumeActiveTarget(getSectionTarget(nextSection));
      setSectionEditorOpen(false);
      if (nextEditTarget) {
        setInlineEditTarget(nextEditTarget);
        setPendingFocusEditTarget(nextEditTarget);
      }
      window.requestAnimationFrame(() => focusPreviewSection(nextSectionId));
    },
    [currentCv, currentSections, importCv, showToast],
  );

  const handleToggleHiddenSection = React.useCallback(
    (sectionId: string) => {
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
        return (
          candidateId !== sectionId &&
          !nextHiddenSectionIds.includes(candidateId)
        );
      });
      const nextVisibleSectionId = nextVisibleSection?.id
        ? String(nextVisibleSection.id)
        : null;

      setActiveSectionId(nextVisibleSectionId);
      setResumeActiveTarget(getSectionTarget(nextVisibleSection));
      if (nextVisibleSectionId) {
        focusPreviewSection(nextVisibleSectionId);
      }
    },
    [activeSectionId, currentSections, hiddenSectionIds],
  );

  const handleDeleteSection = React.useCallback(
    (sectionId: string) => {
      if (!currentCv) return;
      const sectionIndex = currentSections.findIndex(
        (section, index) => getCvSectionId(section, index) === sectionId,
      );
      if (sectionIndex < 0) return;

      const removedSection = currentSections[sectionIndex];
      const nextSections = currentSections.filter(
        (_, index) => index !== sectionIndex,
      );
      persistSections(nextSections);
      setHiddenSectionIds((current) =>
        current.filter((id) => id !== sectionId),
      );

      const nextActiveSection =
        nextSections[Math.min(sectionIndex, nextSections.length - 1)] ?? null;
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
            const restoredSectionId = getCvSectionId(
              removedSection,
              sectionIndex,
            );
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
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= currentSections.length
      ) {
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

  const cvStyleSlotPresets = React.useMemo(() => {
    type StyleSlotSource =
      | {
          fontPairId?: unknown;
          paletteOverride?: unknown;
          accentHex?: unknown;
          verbatiStyle?: unknown;
          name?: unknown;
        }
      | null
      | undefined;

    const buildSlotPreset = (
      slot: 1 | 2 | 3,
      source: StyleSlotSource,
    ): VerbatiStylePreset => {
      const factorySlot = getFactoryDocumentStyleSlot(slot);
      const sourceStyle =
        (source?.verbatiStyle as
          | Partial<VerbatiStylePreset>
          | null
          | undefined) ?? null;
      const typography =
        (source?.fontPairId as VerbatiFontPairId | undefined) ??
        (sourceStyle?.typography as VerbatiFontPairId | undefined) ??
        factorySlot.appearance.typography;
      const palette =
        (source?.paletteOverride as
          | VerbatiStylePreset["palette"]
          | undefined) ??
        (sourceStyle?.palette as VerbatiStylePreset["palette"] | undefined) ??
        factorySlot.appearance.palette;
      const accentHex =
        (typeof source?.accentHex === "string" ? source.accentHex : undefined) ??
        (sourceStyle?.accentHex as string | undefined);
      const resumeTemplateId =
        sourceStyle?.resumeTemplateId ?? factorySlot.defaultCvTemplateId;

      return resolveVerbatiStyle({
        ...factorySlot.appearance,
        ...sourceStyle,
        typography,
        palette,
        resumeTemplateId,
        ...(accentHex ? { accentHex } : {}),
      });
    };

    return {
      1: buildSlotPreset(1, documentStylePresets?.preset1),
      2: buildSlotPreset(2, documentStylePresets?.preset2),
      3: buildSlotPreset(3, documentStylePresets?.preset3),
    };
  }, [
    documentStylePresets?.preset1,
    documentStylePresets?.preset2,
    documentStylePresets?.preset3,
    stylePreset,
  ]);

  const selectedStyleSlot = React.useMemo<1 | 2 | 3 | null>(() => {
    const persistedSlotId = resolveDocumentStyleSlotId(
      currentCv?.metadata?.verbatiStyleSlotId,
    );
    if (persistedSlotId) return persistedSlotId;

    if (stylesEqual(stylePreset, cvStyleSlotPresets[1])) return 1;
    if (stylesEqual(stylePreset, cvStyleSlotPresets[2])) return 2;
    if (stylesEqual(stylePreset, cvStyleSlotPresets[3])) return 3;
    return documentStylePresets?.activeSlot ?? null;
  }, [
    currentCv?.metadata?.verbatiStyleSlotId,
    cvStyleSlotPresets,
    documentStylePresets?.activeSlot,
    stylePreset,
  ]);

  const selectedStyleSlotIsCustom = React.useMemo(() => {
    if (!selectedStyleSlot) {
      return false;
    }

    return !stylesEqual(stylePreset, cvStyleSlotPresets[selectedStyleSlot]);
  }, [
    cvStyleSlotPresets,
    selectedStyleSlot,
    stylePreset,
  ]);

  const getCvStyleSlotName = React.useCallback(
    (slot: 1 | 2 | 3, source: "factory" | "settings") => {
      if (source === "settings") {
        const settingsName = documentStylePresets?.[`preset${slot}`]?.name;
        if (typeof settingsName === "string" && settingsName.trim()) {
          return settingsName;
        }
      }
      return getFactoryDocumentStyleSlot(slot).label;
    },
    [documentStylePresets],
  );

  const buildFactoryCvStylePreset = React.useCallback(
    (slot: 1 | 2 | 3) => {
      const factorySlot = getFactoryDocumentStyleSlot(slot);
      return resolveVerbatiStyle({
        ...stylePreset,
        ...factorySlot.appearance,
        resumeTemplateId: factorySlot.defaultCvTemplateId,
      });
    },
    [stylePreset],
  );

  const handleSelectStyleSlot = React.useCallback(
    (slot: 1 | 2 | 3) => {
      const nextStylePreset = cvStyleSlotPresets[slot];
      const slotSource = documentStylePresets?.[`preset${slot}`]
        ? "settings"
        : "factory";
      const slotName = getCvStyleSlotName(slot, slotSource);

      setStylePreset(nextStylePreset);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(nextStylePreset, {
          verbatiStyleSlotId: slot,
          verbatiStyleSlotSource: slotSource,
          verbatiStyleSlotNameSnapshot: slotName,
          verbatiStyleBaseSnapshot:
            buildDocumentAppearanceSnapshot(nextStylePreset),
          documentStyleVersion: DOCUMENT_STYLE_VERSION,
        });
      }
    },
    [
      cvStyleSlotPresets,
      documentStylePresets,
      getCvStyleSlotName,
      saveCurrentCvStyleOnly,
      setStylePreset,
    ],
  );

  const handleResetStyleSlot = React.useCallback(() => {
    if (!selectedStyleSlot) return;

    const settingsSlot = documentStylePresets?.[`preset${selectedStyleSlot}`];
    const resetSource = settingsSlot ? "settings" : "factory";
    const nextStylePreset =
      resetSource === "settings"
        ? cvStyleSlotPresets[selectedStyleSlot]
        : buildFactoryCvStylePreset(selectedStyleSlot);
    const slotName = getCvStyleSlotName(selectedStyleSlot, resetSource);

    setStylePreset(nextStylePreset);
    if (typeof saveCurrentCvStyleOnly === "function") {
      void saveCurrentCvStyleOnly(nextStylePreset, {
        verbatiStyleSlotId: selectedStyleSlot,
        verbatiStyleSlotSource: resetSource,
        verbatiStyleSlotNameSnapshot: slotName,
        verbatiStyleBaseSnapshot:
          buildDocumentAppearanceSnapshot(nextStylePreset),
        documentStyleVersion: DOCUMENT_STYLE_VERSION,
      });
    }
  }, [
    buildFactoryCvStylePreset,
    cvStyleSlotPresets,
    documentStylePresets,
    getCvStyleSlotName,
    saveCurrentCvStyleOnly,
    selectedStyleSlot,
    setStylePreset,
  ]);

  const handleSelectTemplate = React.useCallback(
    (
      template:
        | "workshop-onecol"
        | "workshop-twocol"
        | "editorial"
        | "minimal"
        | "classic",
    ) => {
      const layout =
        template === "minimal" || template === "classic" ? "swiss" : "workshop";
      const resumeTemplateId =
        template === "workshop-twocol"
          ? WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
          : layout === "workshop"
            ? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
            : undefined;
      setStylePreset((current) =>
        resolveVerbatiStyle({
          ...current,
          familyId: layout,
          layout,
          resumeTemplateId,
        }),
      );
    },
    [setStylePreset],
  );
  const cvTemplatePanelItems = React.useMemo(
    () => [
      {
        id: "workshop-onecol",
        label: "Minimal",
        preview: { kind: "Resume" as const, family: "workshop-onecol" as const },
      },
      {
        id: "workshop-twocol",
        label: "French",
        preview: { kind: "Resume" as const, family: "workshop-twocol" as const },
      },
    ],
    [],
  );
  const activeCvTemplatePanelItemId =
    stylePreset.layout === "workshop" &&
    stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
      ? "workshop-twocol"
      : "workshop-onecol";
  const cvTemplatePanelRegistration = React.useMemo(
    () => ({
      surface: "cv" as const,
      title: "CV templates",
      subtitle: "A4 · 21 × 29.7 cm",
      activeItemId: activeCvTemplatePanelItemId,
      items: cvTemplatePanelItems,
      onSelect: (itemId: string) => {
        if (itemId === "workshop-onecol" || itemId === "workshop-twocol") {
          handleSelectTemplate(itemId);
        }
      },
    }),
    [
      activeCvTemplatePanelItemId,
      cvTemplatePanelItems,
      handleSelectTemplate,
    ],
  );
  useRegisterForgeTemplates(cvTemplatePanelRegistration);

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

  const handleSelectCustomAccent = React.useCallback(
    (hex: string) => {
      setStylePreset((current) =>
        resolveVerbatiStyle({
          ...current,
          palette: "custom",
          accentHex: hex,
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
      if (
        section.type === "skills" ||
        section.type === "languages" ||
        isHobbiesSection
      ) {
        const existingItems = getListSectionItems(section);
        const excludedItems = isHobbiesSection
          ? getCurrentCvSkills(currentCv)
          : [];
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
            outputMode: "single_text",
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
          outputMode: "single_text",
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

  const handleRunPageWandForSection = React.useCallback(
    (sectionId: string) => {
      const section = findSectionById(currentSections, sectionId);
      if (!section) return;
      const railAiMode = getSectionRailAiMode(section);
      if (railAiMode === "none") return;

      if (sectionUsesStructuredSuggestions(section)) {
        handleAskAiForSection(sectionId);
        void handleRunAskAiForSection({ sectionId, prompt: "", tone: cvTone });
        return;
      }

      if (railAiMode === "rail") {
        handleAskAiForSection(sectionId);
        void handleRunAskAiForSection({ sectionId, prompt: "", tone: cvTone });
        return;
      }

      handleSelectSection(sectionId, { openEditor: true });
    },
    [
      currentSections,
      cvTone,
      handleAskAiForSection,
      handleRunAskAiForSection,
      handleSelectSection,
    ],
  );

  const handleRunPageWandForItem = React.useCallback(
    async (request: {
      sectionId: string;
      sectionType: string;
      itemId: string;
      itemIndex?: number;
      field: "responsibilities" | "achievement" | "education";
    }) => {
      if (
        request.sectionType !== "experience" ||
        request.field !== "responsibilities"
      ) {
        return;
      }
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, request.sectionId);
      const item = section
        ? getStructuredItemById(section, request.itemId)
        : undefined;
      if (!section || !item) return;

      const source = getResponsibilitySource(item);
      const beforeText = readResponsibilityAiSourceText(source);
      if (!beforeText.trim()) {
        showToast(
          "This experience has no responsibilities for AI to improve.",
          {
            variant: "warning",
          },
        );
        return;
      }

      const interactionId = createAiInteractionId();
      const key = `${interactionId}:${request.sectionId}:${request.itemId}:responsibilities`;
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "section_editor",
        actionId: "improve_experience_responsibilities",
      });
      setCvRailAiSuggestion(null);
      setCvRailAppliedAiEdit(null);
      setPaperTextAiSuggestion({
        key,
        sectionId: request.sectionId,
        sectionType: "experience",
        itemId: request.itemId,
        beforeText,
        afterText: "",
        state: "loading",
        previousSection: section,
        interactionId,
      });

      try {
        if (typeof runCvSectionAiAction !== "function") {
          throw new Error("CV AI action is unavailable.");
        }
        const result = await runCvSectionAiAction({
          action: "improve_experience_responsibilities",
          existingText: beforeText,
          outputShape: getResponsibilitySourceShape(source),
        });
        const normalized = normalizeResponsibilityAiResultForSource({
          source,
          rawItems:
            result?.kind === "list" && Array.isArray(result.items)
              ? result.items
              : undefined,
          rawText:
            result?.kind === "text" ? result.text : readAiResultText(result),
          requestedActionId: "improve_experience_responsibilities",
        });

        if (!normalized.ok) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "improve_experience_responsibilities",
            errorKind: normalized.reason,
          });
          setPaperTextAiSuggestion((current) =>
            current?.key === key
              ? {
                  ...current,
                  state: "error",
                  errorMessage:
                    normalized.reason === "incomplete_output"
                      ? "AI returned incomplete responsibilities."
                      : "AI returned unusable responsibilities.",
                }
              : current,
          );
          return;
        }

        const afterText = readResponsibilityAiSourceText(normalized.doc);
        if (!afterText.trim()) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "improve_experience_responsibilities",
            errorKind: "empty_result",
          });
          setPaperTextAiSuggestion((current) =>
            current?.key === key
              ? {
                  ...current,
                  state: "error",
                  errorMessage: "AI returned no usable responsibility text.",
                }
              : current,
          );
          return;
        }

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "section_editor",
          actionId: "improve_experience_responsibilities",
          applyMode: "preview_required",
        });
        setPaperTextAiSuggestion((current) =>
          current?.key === key
            ? {
                ...current,
                afterText,
                state: "ready",
                afterDoc: normalized.doc,
                responsibilityBullets: normalized.responsibilityBullets,
              }
            : current,
        );
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "section_editor",
          actionId: "improve_experience_responsibilities",
          errorKind: "request_failed",
        });
        setPaperTextAiSuggestion((current) =>
          current?.key === key
            ? {
                ...current,
                state: "error",
                errorMessage:
                  error instanceof Error && error.message
                    ? error.message
                    : "AI is unavailable for this item.",
              }
            : current,
        );
        showToast("AI unavailable.", { variant: "error" });
      }
    },
    [currentSections, runCvSectionAiAction, showToast],
  );

  const handleAcceptPaperTextAiSuggestion = React.useCallback(
    (key: string) => {
      const suggestion = paperTextAiSuggestion;
      if (
        !suggestion ||
        suggestion.key !== key ||
        suggestion.state !== "ready" ||
        suggestion.sectionType !== "experience" ||
        !suggestion.afterDoc
      ) {
        return;
      }

      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, suggestion.sectionId);
      if (!section) return;
      const nextSection = updateStructuredItemResponsibilities(
        section,
        suggestion.itemId,
        suggestion.afterDoc,
        suggestion.responsibilityBullets,
      );
      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === suggestion.sectionId
          ? nextSection
          : currentSection,
      );
      latestInlineSectionsRef.current = nextSections;
      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      persistSections(nextSections);
      recordAiInteractionEvent({
        name: "ai_accepted",
        interactionId: suggestion.interactionId ?? createAiInteractionId(),
        surface: "section_editor",
        actionId: "improve_experience_responsibilities",
      });
      setPaperTextAiSuggestion({
        ...suggestion,
        state: "accepted",
        previousSection: section,
      });
      focusPreviewSection(suggestion.sectionId);
    },
    [currentSections, paperTextAiSuggestion, persistSections],
  );

  const handleDiscardPaperTextAiSuggestion = React.useCallback(
    (key: string) => {
      setPaperTextAiSuggestion((current) => {
        if (!current || current.key !== key) return current;
        recordAiInteractionEvent({
          name: "ai_discarded",
          interactionId: current.interactionId ?? createAiInteractionId(),
          surface: "section_editor",
          actionId: "improve_experience_responsibilities",
        });
        return null;
      });
    },
    [],
  );

  const handleUndoPaperTextAiSuggestion = React.useCallback(
    (key: string) => {
      const suggestion = paperTextAiSuggestion;
      if (
        !suggestion ||
        suggestion.key !== key ||
        !suggestion.previousSection
      ) {
        return;
      }
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const nextSections = baseSections.map((section, index) =>
        getCvSectionId(section, index) === suggestion.sectionId
          ? suggestion.previousSection!
          : section,
      );
      latestInlineSectionsRef.current = nextSections;
      setPendingActiveSection(suggestion.previousSection);
      setResumeActiveTarget(getSectionTarget(suggestion.previousSection));
      persistSections(nextSections);
      setPaperTextAiSuggestion(null);
      focusPreviewSection(suggestion.sectionId);
    },
    [currentSections, paperTextAiSuggestion, persistSections],
  );

  sectionActionHandlersRef.current = {
    ask: handleRunPageWandForSection,
    toggleHidden: handleToggleHiddenSection,
    delete: handleDeleteSection,
  };

  const resumeSectionActions = React.useMemo(
    () =>
      workspaceMode === "edit"
        ? {
            hiddenSectionIds,
            onAsk: handleRunPageWandForSection,
            onAskItem: handleRunPageWandForItem,
            onToggleHidden: handleToggleHiddenSection,
            onDelete: handleDeleteSection,
          }
        : null,
    [
      handleDeleteSection,
      handleRunPageWandForItem,
      handleRunPageWandForSection,
      handleToggleHiddenSection,
      hiddenSectionIds,
      workspaceMode,
    ],
  );

  const handleAcceptAiSuggestion = React.useCallback(() => {
    if (
      !cvRailAiSuggestion ||
      cvRailAiSuggestion.kind === "list" ||
      cvRailAiSuggestion.state !== "ready"
    )
      return;

    const inlineTarget = cvRailAiSuggestion.inlineTarget;
    if (inlineTarget) {
      const target = inlineTarget.editTarget;
      if (
        pendingInlineFieldChangeRef.current?.target.sectionId ===
          target.sectionId &&
        pendingInlineFieldChangeRef.current?.target.fieldPath ===
          target.fieldPath
      ) {
        pendingInlineFieldChangeRef.current = null;
      }

      if (
        applyInlineExperienceResponsibilityAiResult({
          target,
          selectedText: inlineTarget.selectedText,
          resultText: cvRailAiSuggestion.afterText,
          actionId: inlineTarget.actionId,
        })
      ) {
        recordAiInteractionEvent({
          name: "ai_accepted",
          interactionId:
            cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
          surface: "section_editor",
          actionId: inlineTarget.actionId,
        });
        setCvRailAiSuggestion(null);
        setCvRailAppliedAiEdit(null);
        return;
      }

      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      let nextSection: CvSection | null = null;
      const nextSections = baseSections.map((section, index) => {
        if (getCvSectionId(section, index) !== target.sectionId) return section;
        nextSection = applyInlineAiTextToSectionField({
          section,
          target,
          selectedText: inlineTarget.selectedText,
          replacementText: cvRailAiSuggestion.afterText,
        });
        return nextSection ?? section;
      });

      if (!nextSection) return;
      latestInlineSectionsRef.current = nextSections;
      setPendingActiveSection(nextSection);
      setResumeActiveTarget(getSectionTarget(nextSection));
      persistSections(nextSections);
      recordAiInteractionEvent({
        name: "ai_accepted",
        interactionId:
          cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
        surface: "section_editor",
        actionId: inlineTarget.actionId,
      });
      setCvRailAiSuggestion(null);
      setCvRailAppliedAiEdit(null);
      focusPreviewSection(cvRailAiSuggestion.sectionId);
      return;
    }

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
      interactionId:
        cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
      surface: "section_editor",
      actionId: "custom",
    });
    setCvRailAiSuggestion(null);
    setCvRailAppliedAiEdit(appliedEdit);
    focusPreviewSection(cvRailAiSuggestion.sectionId);
  }, [
    applyInlineExperienceResponsibilityAiResult,
    currentSections,
    cvRailAiSuggestion,
    persistSections,
  ]);

  const handleUndoAiSuggestion = React.useCallback(() => {
    if (!cvRailAppliedAiEdit || !currentCv) return;
    const section = findSectionById(
      currentSections,
      cvRailAppliedAiEdit.sectionId,
    );
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
      const interactionId =
        cvRailAiSuggestion.interactionId ?? createAiInteractionId();
      if (
        cvRailAiSuggestion.inlineTarget &&
        activeInlinePaperAiRequestIdRef.current === interactionId
      ) {
        activeInlinePaperAiRequestIdRef.current = null;
      }
      recordAiInteractionEvent({
        name: "ai_discarded",
        interactionId,
        surface: "section_editor",
        actionId: cvRailAiSuggestion.inlineTarget?.actionId ?? "custom",
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
        interactionId:
          cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
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

  const resumePaperAiState = React.useMemo<ResumePaperAiState | null>(() => {
    if (workspaceMode !== "edit") return null;
    const listSuggestion =
      cvRailAiSuggestion?.kind === "list"
        ? {
            sectionId: cvRailAiSuggestion.sectionId,
            sectionType:
              findSectionById(currentSections, cvRailAiSuggestion.sectionId)
                ?.type ?? "skills",
            items: cvRailAiSuggestion.items,
            state: cvRailAiSuggestion.state,
            errorMessage: cvRailAiSuggestion.errorMessage,
          }
        : null;

    return {
      textSuggestion: paperTextAiSuggestion,
      listSuggestion:
        listSuggestion && listSuggestion.sectionType === "skills"
          ? listSuggestion
          : null,
      onAcceptTextSuggestion: handleAcceptPaperTextAiSuggestion,
      onDiscardTextSuggestion: handleDiscardPaperTextAiSuggestion,
      onUndoTextSuggestion: handleUndoPaperTextAiSuggestion,
      onAcceptListSuggestion: handleAcceptListAiSuggestion,
      onDismissListSuggestion: handleDismissListAiSuggestion,
    };
  }, [
    currentSections,
    cvRailAiSuggestion,
    handleAcceptListAiSuggestion,
    handleAcceptPaperTextAiSuggestion,
    handleDiscardPaperTextAiSuggestion,
    handleDismissListAiSuggestion,
    handleUndoPaperTextAiSuggestion,
    paperTextAiSuggestion,
    workspaceMode,
  ]);

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

  const handleStartFreshEntryCv = React.useCallback(async (
    resumeTemplateId?: ResumeTemplateId | null,
  ) => {
    if (isEntryPickerBusy) {
      return;
    }

    setIsCreatingEntryCv(true);
    setEntryPickerTransitionCvId(ENTRY_PICKER_PENDING_ROUTE_ID);
    setPendingFreshEntryBaseCvId(currentCvId ?? "__none__");
    try {
      await createNewCv(undefined, {
        forceV1: true,
        resumeTemplateId: resumeTemplateId ?? undefined,
      });
    } catch (error) {
      setEntryPickerTransitionCvId(null);
      setPendingFreshEntryBaseCvId(null);
      showToast("Create failed.", { variant: "error" });
    } finally {
      setIsCreatingEntryCv(false);
    }
  }, [createNewCv, currentCvId, isEntryPickerBusy, showToast]);

  React.useEffect(() => {
    const state =
      typeof location.state === "object" && location.state !== null
        ? (location.state as Record<string, unknown>)
        : null;
    const params = new URLSearchParams(location.search);
    const queryCvForgeAction = params.get("cvForgeAction");
    const cvForgeAction =
      state?.cvForgeAction === "createBlank" || state?.cvForgeAction === "importCv"
        ? state.cvForgeAction
        : queryCvForgeAction;
    const resumeTemplateId = resolveCvTemplateIntent(params.get("templateId"));
    if (cvForgeAction !== "createBlank" && cvForgeAction !== "importCv") {
      return;
    }

    const actionKey = `${location.key}:${cvForgeAction}:${resumeTemplateId ?? "default"}`;
    if (consumedCvForgeActionRef.current === actionKey) {
      return;
    }
    consumedCvForgeActionRef.current = actionKey;

    const nextState = { ...(state ?? {}) };
    delete nextState.cvForgeAction;
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("cvForgeAction");
    nextParams.delete("templateId");
    const nextSearch = nextParams.toString();
    void navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true, state: nextState },
    );

    if (cvForgeAction === "createBlank") {
      void handleStartFreshEntryCv(resumeTemplateId);
      return;
    }

    handleImportEntryCv();
  }, [
    handleImportEntryCv,
    handleStartFreshEntryCv,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

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
            "--page-shell-gap": "0px",
            "--page-shell-pad-top": "var(--space-2)",
            "--page-shell-pad-inline": "var(--space-4)",
            "--page-shell-pad-bottom": "0px",
            "--cv-preview-toolbar-inset": "0px",
            "--page-shell-pad-top-mobile": "var(--space-2)",
            "--page-shell-pad-inline-mobile": "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "0px",
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
          <div
            className="dasti-cv-skeleton-forge"
            style={cvWorkbenchShellStyle}
          >
            <div className="dasti-cv-skeleton-forge__stage">
              <CvStageBar
                mode={workspaceMode}
                hasCurrentCv={Boolean(currentCv)}
                hasTrustedExport={hasTrustedExport}
                importIssueCount={importReviewBlocks.length}
                exporting={exportingFormat !== null}
                tone={cvTone}
                resumeOptions={resumeOptions}
                onModeChange={setWorkspaceMode}
                onOpenImportReview={() => setImportReviewOpen(true)}
                onPickResume={handlePickResume}
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
                      Importing PDF
                      <span className="dasti-loader-caret" aria-hidden="true" />
                    </strong>
                    <span>
                      Parsing is still pending. Parser errors will stay visible
                      here and will not be treated as a successful import.
                    </span>
                  </div>
                </div>
              ) : null}
              {shouldShowCvRestorePending ? (
                <div
                  className="dasti-cv-import-card"
                  role="status"
                  aria-live="polite"
                >
                  <p className="dasti-hint">
                    {lastLibraryFetchFailed
                      ? "CV library unavailable. Retrying restore."
                      : "Loading CV."}
                  </p>
                </div>
              ) : shouldShowEmptyCvChoice ? (
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
                  ref={paperStageRef}
                  className={
                    workspaceMode === "preview"
                      ? "dasti-cv-paper-stage dasti-cv-page-preview-stage"
                      : "dasti-cv-paper-stage"
                  }
                  data-cv-workspace-mode={workspaceMode}
                  data-active-paper-edit-section-id={
                    inlineEditTarget?.sectionId
                  }
                  data-active-paper-edit-section-type={
                    inlineEditTarget?.sectionType
                  }
                  data-active-paper-edit-field-path={
                    inlineEditTarget?.fieldPath
                  }
                  data-active-paper-edit-field-kind={
                    inlineEditTarget?.fieldKind
                  }
                >
                  <VerbatiResumePreview
                    data={resumePreviewData}
                    stylePreset={stylePreset}
                    hostMode="panel"
                    scrollMode="natural"
                    activeTarget={resumeActiveTarget}
                    onLinkIntent={handleResumeLinkIntent}
                    inlineEditing={resumeInlineEditing}
                    sectionActions={resumeSectionActions}
                    paperAi={resumePaperAiState}
                    showPageCount={
                      workspaceMode === "preview" && Boolean(currentCv)
                    }
                  />
                  {inlinePaperSelectionState ? (
                    <FloatingAiToolbar
                      open
                      anchor={inlinePaperSelectionState.anchor}
                      isLoading={isApplyingInlinePaperAi}
                      pendingActionId={pendingInlinePaperAiActionId}
                      onClose={() => setInlinePaperSelectionState(null)}
                      onRunAction={handleRunInlinePaperAiAction}
                    />
                  ) : null}
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
              selectedStyleSlot={selectedStyleSlot}
              selectedStyleSlotIsCustom={selectedStyleSlotIsCustom}
              onSelectStyleSlot={handleSelectStyleSlot}
              onResetStyleSlot={handleResetStyleSlot}
              onSelectTemplate={handleSelectTemplate}
              onSelectFontPair={handleSelectFontPair}
              onSelectAccent={handleSelectAccent}
              onSelectCustomAccent={handleSelectCustomAccent}
              onNewCv={() => {
                void handleStartFreshEntryCv();
              }}
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
