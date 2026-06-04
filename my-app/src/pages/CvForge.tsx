import React from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import type { RemirrorJSON } from "remirror";
import {
  ArrowSquareOut,
  FileUser,
  FolderSimple,
  PenLine,
  Upload,
  X,
} from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import FloatingAiToolbar, {
  type InlineAiActionId,
} from "../components/FloatingAiToolbar";
import type { ResumeExportRequest } from "../components/ResumeExportControl";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  useForgeTemplatePanel,
  useRegisterForgePanel,
  useRegisterForgeTemplates,
} from "../contexts/ForgeTemplatePanelContext";
import { useRegisterCvForgeTopbar } from "../contexts/CvForgeTopbarContext";
import {
  DrawerDocumentTile,
  DrawerUnavailableThumbnail,
} from "../components/library/LibraryDocumentPreview";
import { VerbatiResumePreview } from "../features/verbati/VerbatiResumePreview";
import type {
  ActivePaperEditTarget,
  ResumeInlineEditing,
} from "../features/verbati/resume/InlineEditableText";
import {
  shouldRenderPaperSectionAiControl,
  type ResumePaperAiState,
} from "../features/verbati/resume/ResumeOneColAtsPage";
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
  EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID,
  SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  isResumeTemplateId,
  type ResumeTemplateId,
} from "../lib/layout/resumeTemplates";
import {
  DOCUMENT_STYLE_VERSION,
  buildDocumentAppearanceSnapshot,
  getFactoryDocumentStyleSlot,
  resolveDocumentStyleSlotId,
} from "../lib/document-style-slots";
import {
  normalizeDocumentIconSettings,
  type DocumentIconKey,
  type DocumentIconSettings,
} from "../lib/document-icons";
import {
  buildDocumentListItemIconOverrideKey,
  normalizeDocumentIconOverrides,
  type DocumentIconOverrides,
  type DocumentListItemIconOverrideTarget,
} from "../lib/document-icon-overrides";
import {
  ensurePlainTextRemirrorDoc,
  ensureRemirrorDoc,
} from "../components/remirror-editor/utils/conversion";
import { normalizeResponsibilityAiResultForSource } from "../components/structured-blocks/ExperienceEducationModal";
import { useToast } from "../components/ui/toast";
import { useDocumentCommandLayerPosition } from "../hooks/use-document-command-layer-position";
import {
  getCommandLayerToolbarDensity,
} from "../lib/document-command-layer-layout";
import { translateUi } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";
import type { CvAiSurfacePosition } from "../lib/cv-ai-surface-position";
import {
  buildAuthoritativeResumeDebugSnapshot,
  buildAuthoritativeResumeExportModel,
  readAuthoritativeResumeFromCv,
} from "../lib/authoritative-resume";
import { evaluateCvAtsAudit } from "../lib/ats-audit/evaluateCvAtsAudit";
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
  insertSectionByCanonicalOrder,
  isSectionReorderLocked,
  normalizeCvSectionOrder,
  readStoredHiddenSectionIds,
  sanitizeHiddenSectionIds,
  writeStoredHiddenSectionIds,
} from "../lib/cv-section-organization";
import {
  applyImportRecoveryItems,
  buildRecoveryCommitState,
  collectRecoveryDestinationSectionIds,
  formatRecoveryCommitToast,
  normalizeRecoverySectionTarget,
} from "../lib/import-recovery";
import {
  buildResumeTypographyAuditMetadata,
  readResumePreviewDebugCapture,
  setStyledResumeExportContext,
} from "../lib/document-export-debug";
import {
  resolveDocumentPageSize,
  type DocumentPageSizePreference,
} from "../lib/document-page-size";
import { exportDocumentFile } from "../lib/exportDocumentFile";
import type { CvDocument } from "../types/cvDocument";
import {
  buildWorkLibraryModel,
  type LibraryItem,
  type LibraryProposalRecord,
} from "../lib/application-library";
import { buildCanonicalResumeRenderModelFromCv } from "../lib/buildCanonicalResumeRenderModel";
import {
  deriveCvTitleCandidateFromSections,
  deriveCvTitleFromSections,
} from "../lib/normalize-cv";
import CvStageBar from "../components/cv/CvStageBar";
import CvDesignFields, {
  type CvAccentChoice,
} from "../components/cv/CvDesignFields";
import {
  DOCUMENT_DECORATION_MAX_FILE_BYTES,
  createDefaultDocumentDecoration,
  normalizeDocumentDecoration,
  resolveDocumentDecorationMimeType,
  shouldPersistDocumentDecoration,
  type DocumentDecoration,
} from "../lib/document-decoration";
import CvReviewBanner from "../components/cv/CvReviewBanner";
import ImportRecoveryPanel from "../components/ImportRecoveryPanel";
import ComposerDrawer from "../components/ComposerDrawer";
import CvRail, {
  type CvAddSectionKind,
  type CvRailAppliedAiEdit,
  type CvRailAiSuggestion,
  type CvRailTab,
  type CvToneChoice,
} from "../components/cv/CvRail";
import CvAiReviewOverlay, {
  type CvAiReviewState,
  type CvAiReviewTarget,
} from "../components/cv/CvAiReviewOverlay";
import CvSectionsOrganizer from "../components/cv/CvSectionsOrganizer";
import CvAtsAuditPanel from "../components/cv/CvAtsAuditPanel";
import SectionEditorSheet from "../components/cv/SectionEditorSheet";
import { Sheet } from "../components/ui";
import type { CvSection } from "../types/cvDocument";
import type {
  ImportRecoveryItem,
  ImportRecoverySectionType,
  ImportRecoverySession,
} from "../types/importRecovery";
import {
  createAiInteractionId,
  recordAiInteractionEvent,
} from "../lib/ai/aiInteractionTelemetry";
import { normalizeEditorAiTextResult } from "../lib/ai/applyAiSuggestion";
import {
  findInlinePaperEditableForSelection,
  getDomRangeSelectionState,
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

const CV_COMMAND_LAYER_TOOLBAR_MIN_WIDTH = 300;
const CV_COMMAND_LAYER_TOOLBAR_NATURAL_WIDTH = 520;
const CV_COMMAND_LAYER_TOOLBAR_HEIGHT = 44;
const CV_COMMAND_LAYER_SAFE_MARGIN = 12;
const CV_COMMAND_LAYER_GAP = 12;
const CV_ASK_OFFSET_FROM_PAPER_TOP = 16;
const CV_ASK_HANDLE_ICON_SIZE = 32;
const CV_COMMAND_LAYER_ASK_HANDLE = {
  iconWidth: CV_ASK_HANDLE_ICON_SIZE,
  height: CV_ASK_HANDLE_ICON_SIZE,
};
const CV_PAPER_ANCHOR_SELECTOR = [
  ".dasti-document-stage__canvas[data-document-page='true']",
  ".dasti-doc-viewport--resume-panel[data-document-stage='true']",
].join(",");
const CV_COMMAND_LAYER_CANVAS_SELECTOR = ".dasti-cv-skeleton-forge";
const CV_WORKSPACE_DOCKED_PANEL_MIN_VIEWPORT_WIDTH = 1180;
const CV_INLINE_PAPER_AI_TIMEOUT_MS = 30_000;

async function uploadDocumentDecorationAsset({
  generateUploadUrl,
  file,
  mimeType,
}: {
  generateUploadUrl: () => Promise<string>;
  file: File;
  mimeType?: string;
}): Promise<string> {
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType || file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status})`);
  }

  const payload = (await response.json()) as { storageId?: unknown };
  if (typeof payload.storageId !== "string" || !payload.storageId) {
    throw new Error("Image upload did not return a storage id.");
  }

  return payload.storageId;
}

type CvForgeWorkspaceMode = "edit" | "preview";
type CvWorkspacePanel = "sections" | "design" | "templates";
type CvForgeCanonicalJob = {
  id: string;
  title: string;
  company: string;
} | null;
type CvImportRecoveryDraft = {
  cycleId: string;
  baseSections: CvSection[];
  items: ImportRecoveryItem[];
  overflowCount: number;
  reviewLimit: number;
};

function withCvInlinePaperAiTimeout<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Generation is taking too long. Try again."));
    }, CV_INLINE_PAPER_AI_TIMEOUT_MS);

    request.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

type InlinePaperSelectionState = {
  text: string;
  anchor: EditorSelectionAnchor;
  editTarget: ActivePaperEditTarget;
  range: Range | null;
};
type CvAskSelectionContext = {
  selectedText: string;
  editTarget: ActivePaperEditTarget;
  anchor: EditorSelectionAnchor | null;
};
type CvContextualAiReview = {
  key: string;
  target: CvAiReviewTarget;
  anchor: EditorSelectionAnchor | null;
  beforeText: string;
  afterText: string;
  state: CvAiReviewState;
  errorMessage?: string;
  actionId: string;
  primaryActionLabel: string;
  afterDoc?: unknown;
  responsibilityBullets?: string[];
  previousSection?: CvSection;
  previousSections?: CvSection[];
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
  if (value === "editorial-sidebar") {
    return EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID;
  }
  if (isResumeTemplateId(value as ResumeTemplateId)) {
    return value as ResumeTemplateId;
  }
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

function readLegacyCvProfileImageDecoration(
  metadata: CvDocument["metadata"] | null | undefined,
): DocumentDecoration | null {
  const source =
    metadata && typeof metadata.profileImage === "object" && metadata.profileImage
      ? (metadata.profileImage as Record<string, unknown>)
      : {};
  const dataUrl = typeof source.src === "string" ? source.src.trim() : "";
  if (!dataUrl || dataUrl.startsWith("data:image/")) {
    return null;
  }
  return null;
}

function getCvDocumentDecoration(
  metadata: CvDocument["metadata"] | null | undefined,
): DocumentDecoration {
  const source =
    metadata &&
    typeof metadata.documentDecoration === "object" &&
    metadata.documentDecoration
      ? metadata.documentDecoration
      : readLegacyCvProfileImageDecoration(metadata);
  const durableSource =
    source && typeof source === "object"
      ? {
          ...(source as Record<string, unknown>),
          dataUrl: undefined,
        }
      : source;
  return normalizeDocumentDecoration(
    durableSource ?? createDefaultDocumentDecoration(),
  );
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
    .filter((section) => getCanonicalSectionType(section) === "languages")
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

  const canonicalType = getCanonicalSectionType(section);

  if (canonicalType === "languages") {
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

  if (canonicalType === "skills") {
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

  if (canonicalType === "hobbies") {
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

function getCvWorkspacePanel(
  surface: string | null,
): CvWorkspacePanel | null {
  if (surface === "cv-sections") return "sections";
  if (surface === "cv-design") return "design";
  if (surface === "cv") return "templates";
  return null;
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

function normalizeCvRecoveryItemTargets(
  item: ImportRecoveryItem,
): ImportRecoveryItem {
  return {
    ...item,
    predictedSection: normalizeRecoverySectionTarget(item.predictedSection),
    selectedSection: normalizeRecoverySectionTarget(
      item.selectedSection ?? item.predictedSection,
    ),
    fragmentAssignments: (item.fragmentAssignments ?? []).map((fragment) => ({
      ...fragment,
      targetSection: normalizeRecoverySectionTarget(fragment.targetSection),
    })),
  };
}

function getCvRecoveryDecisionStatus(
  item: ImportRecoveryItem,
  targetSection: ImportRecoverySectionType,
  targetSectionTitle?: string | null,
): ImportRecoveryItem["reviewStatus"] {
  const normalizedPredicted = normalizeRecoverySectionTarget(
    item.predictedSection,
  );
  const normalizedSelected = normalizeRecoverySectionTarget(targetSection);
  const normalizedTitle =
    normalizedSelected === "custom" ? targetSectionTitle?.trim() ?? "" : "";

  return normalizedSelected === normalizedPredicted &&
    normalizedTitle.length === 0
    ? "accepted"
    : "reassigned";
}

function createCvImportRecoverySession(
  items: ImportRecoveryItem[],
  reviewLimit: number,
): ImportRecoverySession {
  return {
    status: items.length > 0 ? "pending" : "completed",
    updatedAt: new Date().toISOString(),
    items: items.map(normalizeCvRecoveryItemTargets),
    overflowCount: Math.max(items.length - reviewLimit, 0),
    reviewLimit,
  };
}

function createCompletedCvImportRecoverySession(
  items: ImportRecoveryItem[],
  reviewLimit: number,
  baseSectionsSnapshot?: CvSection[],
): ImportRecoverySession {
  return {
    status: "completed",
    updatedAt: new Date().toISOString(),
    items: items.map(normalizeCvRecoveryItemTargets),
    overflowCount: Math.max(items.length - reviewLimit, 0),
    reviewLimit,
    ...(Array.isArray(baseSectionsSnapshot) ? { baseSectionsSnapshot } : {}),
  };
}

function buildTouchedSectionRevealState(
  sections: CvSection[],
  touchedSectionIds: string[],
) {
  const revealedIds = new Set(touchedSectionIds.map(String));
  return sections.map((section) =>
    revealedIds.has(String(section.id ?? ""))
      ? { ...section, collapsed: false }
      : section,
  );
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
  return "rail";
}

function sectionUsesStructuredSuggestions(section: CvSection): boolean {
  const canonicalType = getCanonicalSectionType(section);
  return (
    canonicalType === "skills" ||
    canonicalType === "languages" ||
    canonicalType === "hobbies"
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

function isSummaryOnlyCvDocument(cv: CvDocument | null | undefined): boolean {
  return Boolean(
    (cv?.metadata as { librarySummaryOnly?: boolean } | undefined)
      ?.librarySummaryOnly,
  );
}

function cvForgeDrawerSourceId(item: LibraryItem): string {
  return item.id.slice(item.id.indexOf(":") + 1);
}

function readCvForgeDrawerRecentSearches(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function useCvForgeDrawerRecentSearches(storageKey: string) {
  const [recentSearches, setRecentSearches] = React.useState<string[]>(() =>
    readCvForgeDrawerRecentSearches(storageKey),
  );

  const writeRecentSearches = React.useCallback(
    (next: string[]) => {
      setRecentSearches(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* local-only enhancement */
      }
    },
    [storageKey],
  );

  const rememberSearch = React.useCallback(
    (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      writeRecentSearches(
        [
          normalized,
          ...recentSearches.filter(
            (item) => item.toLowerCase() !== normalized.toLowerCase(),
          ),
        ].slice(0, 5),
      );
    },
    [recentSearches, writeRecentSearches],
  );

  const clearRecentSearches = React.useCallback(() => {
    writeRecentSearches([]);
  }, [writeRecentSearches]);

  return { recentSearches, rememberSearch, clearRecentSearches };
}

function CvForgeDrawerSearch({
  value,
  onChange,
  placeholder,
  storageKey = "twoweeks:forge-drawer:recent-cvforge-library-searches",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  storageKey?: string;
}): JSX.Element {
  const [focused, setFocused] = React.useState(false);
  const { resolvedLanguage } = useUiLanguagePreference();
  const resolvedPlaceholder =
    placeholder ?? translateUi(resolvedLanguage, "search.library");
  const { recentSearches, rememberSearch, clearRecentSearches } =
    useCvForgeDrawerRecentSearches(storageKey);
  const showRecentSearches =
    focused && value.trim() === "" && recentSearches.length > 0;
  const commitSearch = React.useCallback(() => {
    rememberSearch(value);
  }, [rememberSearch, value]);

  return (
    <div className="forge-rail-drawer__search-wrap">
      <label className="forge-rail-drawer__search">
        <span className="sr-only">{resolvedPlaceholder}</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            commitSearch();
            window.setTimeout(() => setFocused(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitSearch();
          }}
          placeholder={resolvedPlaceholder}
        />
      </label>
      {showRecentSearches ? (
        <div className="forge-rail-drawer__recent-searches" role="listbox">
          <div className="forge-rail-drawer__recent-searches-head">
            <span>{translateUi(resolvedLanguage, "search.recent")}</span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearRecentSearches}
            >
              {translateUi(resolvedLanguage, "search.clear")}
            </button>
          </div>
          {recentSearches.map((recent) => (
            <button
              key={recent}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(recent)}
            >
              {recent}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CvForgeDrawerSectionTitle({
  title,
  actionLabel,
  onAction,
  sectionRef,
  focusable = false,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  sectionRef?: React.Ref<HTMLDivElement>;
  focusable?: boolean;
}): JSX.Element {
  return (
    <div
      ref={sectionRef}
      className="forge-rail-drawer__section-title"
      tabIndex={focusable ? -1 : undefined}
    >
      <span>{title}</span>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function CvForgeDrawerPreview({
  item,
  hydrateCvDocument,
  badge,
  actionPill,
}: {
  item: LibraryItem;
  hydrateCvDocument: (id: string) => Promise<CvDocument | null>;
  badge?: string | null;
  actionPill?: React.ReactNode;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  if (item.type === "proposal") {
    return (
      <DrawerDocumentTile item={item} badge={badge} actionPill={actionPill} />
    );
  }

  const sourceId = cvForgeDrawerSourceId(item);
  const [hydratedCv, setHydratedCv] = React.useState<CvDocument | null>(
    item.cvDocument && !isSummaryOnlyCvDocument(item.cvDocument)
      ? item.cvDocument
      : null,
  );
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (item.cvDocument && !isSummaryOnlyCvDocument(item.cvDocument)) {
      setHydratedCv(item.cvDocument);
      setFailed(false);
      return () => undefined;
    }
    setHydratedCv(null);
    setFailed(false);
    hydrateCvDocument(sourceId).then((doc) => {
      if (cancelled) return;
      if (doc && !isSummaryOnlyCvDocument(doc)) {
        setHydratedCv(doc);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateCvDocument, item, sourceId]);

  if (!hydratedCv) {
    return (
      <DrawerUnavailableThumbnail
        label={
          failed
            ? translateUi(resolvedLanguage, "errors.previewUnavailable")
            : translateUi(resolvedLanguage, "loading.preview")
        }
      />
    );
  }

  return (
    <DrawerDocumentTile
      item={item}
      cvDocument={hydratedCv}
      badge={badge}
      actionPill={actionPill}
    />
  );
}

export function CvForgeCvDrawer({
  items,
  currentCvId,
  hydrateCvDocument,
  onSelectCv,
  onOpenCv,
}: {
  items: LibraryItem[];
  currentCvId: string | null;
  hydrateCvDocument: (id: string) => Promise<CvDocument | null>;
  onSelectCv: (id: string) => void;
  onOpenCv: (id: string) => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const currentLabel = translateUi(resolvedLanguage, "workspace.current");
  const openCvLabel = translateUi(resolvedLanguage, "workspace.openCv");
  const openFullCvLabel = translateUi(
    resolvedLanguage,
    "workspace.openFullCv",
  );
  const switchCvLabel = translateUi(resolvedLanguage, "workspace.switchCv");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (item.type !== "cv") return false;
    return normalizedQuery
      ? [item.title, item.subtitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      : true;
  });
  const recentItems = React.useMemo(() => {
    const alternatives = filteredItems.filter(
      (item) => currentCvId !== cvForgeDrawerSourceId(item),
    );
    return (alternatives.length >= 2 ? alternatives : filteredItems).slice(
      0,
      2,
    );
  }, [currentCvId, filteredItems]);
  const handleShowAll = () => {
    setQuery("");
    window.setTimeout(() => {
      allResultsRef.current?.scrollIntoView({ block: "start" });
      allResultsRef.current?.focus();
    }, 0);
  };
  const renderItem = (item: LibraryItem, keyPrefix = "") => {
    const sourceId = cvForgeDrawerSourceId(item);
    const selected = currentCvId === sourceId;
    return (
      <article
        key={`${keyPrefix}${item.id}`}
        className="forge-rail-drawer__thumb-item"
        data-state={selected ? "current" : undefined}
        role="listitem"
      >
        <button
          type="button"
          className="forge-template-card forge-rail-drawer__thumb-button"
          aria-label={`${openCvLabel}: ${item.title}`}
          aria-pressed={selected}
          onClick={() => onSelectCv(sourceId)}
        >
          <CvForgeDrawerPreview
            item={item}
            hydrateCvDocument={hydrateCvDocument}
            badge={selected ? currentLabel : null}
            actionPill={switchCvLabel}
          />
        </button>
        <button
          type="button"
          className="forge-rail-drawer__thumb-menu forge-rail-drawer__thumb-menu--direct"
          aria-label={`${openFullCvLabel}: ${item.title}`}
          data-toolbar-tooltip={openFullCvLabel}
          onClick={(event) => {
            event.stopPropagation();
            onOpenCv(sourceId);
          }}
        >
          <ArrowSquareOut size={15} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <div className="forge-rail-drawer">
      <CvForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.cvs")}
        storageKey="twoweeks:forge-drawer:recent-cvforge-cv-searches"
      />
      <div className="forge-rail-drawer__grid" role="list">
        <CvForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredItems.length > recentItems.length
              ? translateUi(resolvedLanguage, "workspace.showAllCvs")
              : undefined
          }
          onAction={handleShowAll}
        />
        {recentItems.map((item) => renderItem(item, "recent-"))}
        <CvForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredItems.map((item) => renderItem(item))}
        {filteredItems.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noCvsFound")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CvForgeLibraryDrawer({
  items,
  currentCvId,
  hydrateCvDocument,
  onSelectCv,
  onOpenItem,
  onOpenLibraryType,
}: {
  items: LibraryItem[];
  currentCvId: string | null;
  hydrateCvDocument: (id: string) => Promise<CvDocument | null>;
  onSelectCv: (id: string) => void;
  onOpenItem: (item: LibraryItem) => void;
  onOpenLibraryType: (type: "cvs" | "proposals") => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "cvs" | "proposals">(
    "cvs",
  );
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const currentLabel = translateUi(resolvedLanguage, "workspace.current");
  const openCvLabel = translateUi(resolvedLanguage, "workspace.openCv");
  const openProposalLabel = translateUi(
    resolvedLanguage,
    "workspace.openProposal",
  );
  const openCvLibraryLabel = translateUi(
    resolvedLanguage,
    "workspace.openCvLibrary",
  );
  const openProposalsLibraryLabel = translateUi(
    resolvedLanguage,
    "workspace.openProposalsLibrary",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (filter === "cvs" && item.type !== "cv") return false;
    if (filter === "proposals" && item.type !== "proposal") return false;
    return normalizedQuery
      ? [item.title, item.subtitle, item.jobTitle, item.linkedCvTitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      : true;
  });
  const recentItems = React.useMemo(() => {
    const alternatives = filteredItems.filter((item) => {
      if (item.type !== "cv") return true;
      const sourceId = item.id.slice(item.id.indexOf(":") + 1);
      return currentCvId !== sourceId;
    });
    return (alternatives.length >= 2 ? alternatives : filteredItems).slice(
      0,
      2,
    );
  }, [currentCvId, filteredItems]);
  const renderItem = (item: LibraryItem, keyPrefix = "") => {
    const sourceId = cvForgeDrawerSourceId(item);
    const selected = item.type === "cv" && currentCvId === sourceId;
    return (
      <article
        key={`${keyPrefix}${item.id}`}
        className="forge-rail-drawer__thumb-item"
        data-state={selected ? "current" : undefined}
        role="listitem"
      >
        <button
          type="button"
          className="forge-template-card forge-rail-drawer__thumb-button"
          aria-label={
            item.type === "cv"
              ? `${openCvLabel}: ${item.title}`
              : `${openProposalLabel}: ${item.title}`
          }
          aria-pressed={item.type === "cv" ? selected : undefined}
          onClick={() => {
            if (item.type === "cv") {
              onSelectCv(sourceId);
              return;
            }
            onOpenItem(item);
          }}
        >
          <CvForgeDrawerPreview
            item={item}
            hydrateCvDocument={hydrateCvDocument}
            badge={selected ? currentLabel : null}
          />
        </button>
        <button
          type="button"
          className="forge-rail-drawer__thumb-menu forge-rail-drawer__thumb-menu--direct"
          aria-label={
            item.type === "cv"
              ? `${openCvLibraryLabel}: ${item.title}`
              : `${openProposalsLibraryLabel}: ${item.title}`
          }
          data-toolbar-tooltip={
            item.type === "cv"
              ? openCvLibraryLabel
              : openProposalsLibraryLabel
          }
          onClick={(event) => {
            event.stopPropagation();
            onOpenLibraryType(item.type === "cv" ? "cvs" : "proposals");
          }}
        >
          <ArrowSquareOut size={15} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <div className="forge-rail-drawer">
      <CvForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.library")}
      />
      <div
        className="forge-rail-drawer__tabs"
        role="tablist"
        aria-label={translateUi(resolvedLanguage, "workspace.libraryFilter")}
      >
        {[
          ["all", translateUi(resolvedLanguage, "projects.all")],
          ["cvs", translateUi(resolvedLanguage, "projects.cvs")],
          ["proposals", translateUi(resolvedLanguage, "projects.proposals")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            data-active={filter === id ? "true" : undefined}
            onClick={() => {
              setFilter(id as "all" | "cvs" | "proposals");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="forge-rail-drawer__grid" role="list">
        <CvForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredItems.length <= recentItems.length
              ? undefined
              : filter === "cvs"
                ? translateUi(resolvedLanguage, "workspace.showAllCvs")
                : filter === "proposals"
                  ? translateUi(resolvedLanguage, "workspace.showAllProposals")
                  : translateUi(resolvedLanguage, "workspace.showAll")
          }
          onAction={() => {
            setQuery("");
            window.setTimeout(() => {
              allResultsRef.current?.scrollIntoView({ block: "start" });
              allResultsRef.current?.focus();
            }, 0);
          }}
        />
        {recentItems.map((item) => renderItem(item, "recent-"))}
        <CvForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredItems.map((item) => renderItem(item))}
        {filteredItems.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noDocumentsFound")}
          </p>
        ) : null}
      </div>
    </div>
  );
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
  const { resolvedLanguage } = useUiLanguagePreference();
  const {
    activeSurface: activeTemplateSurface,
    open: templatePanelOpen,
    openMode: templatePanelOpenMode,
    openSurface: openTemplateSurface,
    closePanel: closeForgePanel,
  } = useForgeTemplatePanel();
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const setJobResume = useMutation(
    ((api as any).jobsPublic?.setResumeForJob ??
      "jobsPublic.setResumeForJob") as any,
  );
  const generateDocumentAssetUploadUrl = useMutation(
    ((api as any).documentAssets?.generateUploadUrl ??
      "documentAssets.generateUploadUrl") as any,
  ) as () => Promise<string>;
  const {
    currentCv,
    currentCvId,
    cvs,
    createNewCv,
    importCv,
    renameCv,
    deleteCv,
    saveCurrentCvStyleOnly,
    isLoading: isCvLibraryLoading,
    isLibraryHydrated,
    lastLibraryFetchFailed,
    remoteSaveStatus,
    loadCv,
    hydrateCvDocument,
  } = useCvLibrary();
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
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
  const cvForgeLibraryProposals = useQuery(
    (api as any).proposalsPublic?.default ?? "proposalsPublic.default",
    isConvexAuthenticated ? {} : "skip",
  ) as LibraryProposalRecord[] | undefined;
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
  const cvDocumentStageRef = React.useRef<HTMLDivElement | null>(null);
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
  const [cvRailTab, setCvRailTab] = React.useState<CvRailTab>("ai");
  const [cvComposerOpen, setCvComposerOpen] = React.useState(false);
  const cvTone = mapDefaultVoicePresetToCvTone(
    defaultProposalSettings?.savedVoicePreset ??
      defaultProposalSettings?.voicePreset,
  );
  const [cvRailAiSuggestion, setCvRailAiSuggestion] =
    React.useState<CvRailAiSuggestion | null>(null);
  const [cvRailAppliedAiEdit, setCvRailAppliedAiEdit] =
    React.useState<CvRailAppliedAiEdit | null>(null);
  const [cvAiReview, setCvAiReview] =
    React.useState<CvContextualAiReview | null>(null);
  const cvAiReviewRef = React.useRef<CvContextualAiReview | null>(null);
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
  const [cvAiSurfacePosition, setCvAiSurfacePosition] =
    React.useState<CvAiSurfacePosition | null>(null);
  const [cvAskSelectionContext, setCvAskSelectionContext] =
    React.useState<CvAskSelectionContext | null>(null);
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

  React.useEffect(() => {
    cvAiReviewRef.current = cvAiReview;
  }, [cvAiReview]);

  React.useEffect(() => {
    if (!inlinePaperSelectionState && !cvAiReview) {
      setCvAiSurfacePosition(null);
    }
  }, [cvAiReview, inlinePaperSelectionState]);

  const [sectionEditorOpen, setSectionEditorOpen] = React.useState(false);
  const [importReviewOpen, setImportReviewOpen] = React.useState(false);
  const [atsAuditOpen, setAtsAuditOpen] = React.useState(false);
  const [cvImportRecoveryDraft, setCvImportRecoveryDraft] =
    React.useState<CvImportRecoveryDraft | null>(null);
  const [dismissedImportReviewCvIds, setDismissedImportReviewCvIds] =
    React.useState<string[]>([]);
  const [acceptedImportReviewCvIds, setAcceptedImportReviewCvIds] =
    React.useState<string[]>([]);
  const [cvPreviewPageCount, setCvPreviewPageCount] = React.useState<
    number | null
  >(null);
  const rawCurrentSections = React.useMemo<CvSection[]>(
    () => (currentCv?.sections ?? []) as CvSection[],
    [currentCv?.sections],
  );
  const currentSections = React.useMemo<CvSection[]>(
    () => normalizeCvSectionOrder(rawCurrentSections),
    [rawCurrentSections],
  );
  React.useEffect(() => {
    if (!currentCv || currentSections === rawCurrentSections) return;
    const now = new Date().toISOString();
    void importCv({
      ...currentCv,
      metadata: buildUpdatedCvMetadata(currentCv, now),
      sections: currentSections,
    });
  }, [currentCv, currentSections, importCv, rawCurrentSections]);
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
        intent.source === "preview-panel" ||
        intent.source === "preview-workspace"
      ) {
        if (matchedSectionId) {
          setActiveSectionId(matchedSectionId);
          setSectionEditorOpen(true);
          setCvComposerOpen(false);
          setCvAskSelectionContext(null);
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
    [currentSections],
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
    const activeSlot = resolveDocumentStyleSlotId(
      documentStylePresets?.activeSlot,
    );
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
      activeSettingsCvStylePreset ??
      defaultProposalSettings?.verbatiStyle ??
      null,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const documentIconSettings = React.useMemo(
    () => normalizeDocumentIconSettings(currentCv?.metadata?.documentIcons),
    [currentCv?.metadata?.documentIcons],
  );
  const documentIconOverrides = React.useMemo(
    () => normalizeDocumentIconOverrides(currentCv?.metadata?.documentIconOverrides),
    [currentCv?.metadata?.documentIconOverrides],
  );
  const documentIconSectionTargets = React.useMemo(
    () =>
      currentSections
        .filter((section) => section.title?.trim())
        .map((section, index) => ({
          id: section.id ?? `${section.type}-${index}`,
          title: section.title,
          type: section.type,
        })),
    [currentSections],
  );
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
  const importRecoverySession = React.useMemo(
    () => readImportRecoverySession(currentCv),
    [currentCv],
  );
  const isImportReviewAccepted = currentCv?.id
    ? acceptedImportReviewCvIds.includes(String(currentCv.id))
    : false;
  const activeImportRecoveryItems = React.useMemo(
    () =>
      isImportReviewAccepted
        ? []
        : (importRecoverySession?.items ?? []).filter(
            (item) => item.reviewStatus === "pending",
          ),
    [importRecoverySession?.items, isImportReviewAccepted],
  );
  const importReviewSummary = React.useMemo(() => {
    if (activeImportRecoveryItems.length === 0) return "";
    return activeImportRecoveryItems
      .slice(0, 2)
      .map(
        (item) =>
          item.sourceSectionTitle ||
          item.selectedSectionTitle ||
          item.predictedSection,
      )
      .join(", ");
  }, [activeImportRecoveryItems]);
  const isImportReviewBannerDismissed = currentCv?.id
    ? dismissedImportReviewCvIds.includes(String(currentCv.id))
    : false;
  const isImportReviewBannerVisible =
    activeImportRecoveryItems.length > 0 && !isImportReviewBannerDismissed;
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(
    null,
  );
  const [documentPageSizePreference, setDocumentPageSizePreference] =
    React.useState<DocumentPageSizePreference>("auto");
  const resolvedDocumentPageSize = React.useMemo(
    () =>
      resolveDocumentPageSize({
        preference: documentPageSizePreference,
        locale: currentCv?.metadata?.locale,
      }),
    [currentCv?.metadata?.locale, documentPageSizePreference],
  );
  const { showToast } = useToast();
  const lastRemoteSaveFailureToastRef = React.useRef<string | null>(null);
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
      remoteSaveStatus.status !== "failed" ||
      !currentCvId ||
      remoteSaveStatus.documentId !== String(currentCvId)
    ) {
      return;
    }
    const toastKey = `${remoteSaveStatus.documentId}:${remoteSaveStatus.reason}:${remoteSaveStatus.error}`;
    if (lastRemoteSaveFailureToastRef.current === toastKey) {
      return;
    }
    lastRemoteSaveFailureToastRef.current = toastKey;
    showToast("Remote save failed. Local changes are still pending.", {
      variant: "error",
    });
  }, [currentCvId, remoteSaveStatus, showToast]);

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
    if (!requestedCvId || requestedCvId === String(currentCvId ?? "")) {
      return;
    }
    loadCv(requestedCvId);
  }, [currentCvId, loadCv, requestedCvId]);

  React.useEffect(() => {
    setCvRailAiSuggestion(null);
    setCvRailAppliedAiEdit(null);
    setCvAiReview(null);
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
      navigateToSelectedCv(cvId);
      loadCv(cvId);
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
      setCvPreviewPageCount(null);
      return;
    }

    setCvPreviewPageCount(null);
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
  const atsAudit = React.useMemo(
    () =>
      currentCv
        ? evaluateCvAtsAudit({
            cv: currentCv,
            pageCount: cvPreviewPageCount,
            importIssueCount: activeImportRecoveryItems.length,
          })
        : null,
    [currentCv, cvPreviewPageCount, activeImportRecoveryItems.length],
  );

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
                    pageSize: resolvedDocumentPageSize,
                    stylePreset,
                  })
                : buildResumeExportSource({
                    currentCv: exportCurrentCv,
                    authoritativeResume,
                    pageSize: resolvedDocumentPageSize,
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
      resolvedDocumentPageSize,
      showToast,
      stylePreset,
    ],
  );
  const handleOpenImportReview = React.useCallback(() => {
    if (importRecoverySession) {
      setCvImportRecoveryDraft({
        cycleId: uuidv4(),
        baseSections: Array.isArray(importRecoverySession.baseSectionsSnapshot)
          ? importRecoverySession.baseSectionsSnapshot
          : currentSections,
        items: importRecoverySession.items.map(normalizeCvRecoveryItemTargets),
        overflowCount: importRecoverySession.overflowCount,
        reviewLimit: importRecoverySession.reviewLimit,
      });
    }
    setImportReviewOpen(true);
  }, [currentSections, importRecoverySession]);
  const handleImportReviewOpenChange = React.useCallback((open: boolean) => {
    setImportReviewOpen(open);
    if (!open) {
      setCvImportRecoveryDraft(null);
    }
  }, []);
  const updateCvRecoveryItem = React.useCallback(
    (blockId: string, updates: Partial<ImportRecoveryItem>) => {
      setCvImportRecoveryDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => {
            if (item.blockId !== blockId) return item;
            const nextSelectedSection =
              updates.selectedSection === undefined
                ? item.selectedSection ?? item.predictedSection
                : updates.selectedSection;
            const nextStatus = updates.reviewStatus ?? item.reviewStatus;
            return {
              ...item,
              ...updates,
              selectedSection: nextSelectedSection,
              reviewStatus:
                nextStatus === "reassigned" &&
                nextSelectedSection === item.predictedSection
                  ? "pending"
                  : nextStatus,
            };
          }),
        };
      });
    },
    [],
  );
  const handleAcceptRecoveryItem = React.useCallback((blockId: string) => {
    setCvImportRecoveryDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.blockId === blockId
            ? {
                ...item,
                selectedSection: normalizeRecoverySectionTarget(
                  item.selectedSection ?? item.predictedSection,
                ),
                selectedSectionTitle:
                  normalizeRecoverySectionTarget(
                    item.selectedSection ?? item.predictedSection,
                  ) === "custom"
                    ? item.selectedSectionTitle ?? null
                    : null,
                reviewStatus: getCvRecoveryDecisionStatus(
                  item,
                  normalizeRecoverySectionTarget(
                    item.selectedSection ?? item.predictedSection,
                  ),
                  item.selectedSectionTitle ?? null,
                ),
              }
            : item,
        ),
      };
    });
  }, []);
  const handleUpdateRecoveryRemainingTarget = React.useCallback(
    (payload: {
      blockId: string;
      targetSection: ImportRecoverySectionType;
      targetSectionTitle?: string | null;
    }) => {
      setCvImportRecoveryDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => {
            if (item.blockId !== payload.blockId) return item;
            const nextSection = normalizeRecoverySectionTarget(
              payload.targetSection,
            );
            const nextTitle =
              nextSection === "custom"
                ? payload.targetSectionTitle?.trim() ?? null
                : null;
            const nextStatus =
              item.reviewStatus === "accepted" ||
              item.reviewStatus === "reassigned"
                ? getCvRecoveryDecisionStatus(item, nextSection, nextTitle)
                : item.reviewStatus;

            return {
              ...item,
              selectedSection: nextSection,
              selectedSectionTitle: nextTitle,
              reviewStatus: nextStatus,
            };
          }),
        };
      });
    },
    [],
  );
  const handleAssignRecoveryFragment = React.useCallback(
    (payload: {
      blockId: string;
      range: { start: number; end: number };
      text: string;
      selectionSource: "cleaned" | "raw";
      targetSection: ImportRecoverySectionType;
      targetSectionTitle?: string | null;
    }) => {
      setCvImportRecoveryDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.blockId === payload.blockId
              ? {
                  ...item,
                  fragmentAssignments: [
                    ...item.fragmentAssignments,
                    {
                      fragmentId: uuidv4(),
                      blockId: item.blockId,
                      startOffset: payload.range.start,
                      endOffset: payload.range.end,
                      selectedText: payload.text,
                      selectionSource: payload.selectionSource,
                      targetSection: payload.targetSection,
                      targetSectionTitle: payload.targetSectionTitle ?? null,
                      status: "assigned",
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : item,
          ),
        };
      });
    },
    [],
  );
  const handleRemoveRecoveryFragment = React.useCallback(
    (blockId: string, fragmentId: string) => {
      setCvImportRecoveryDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.blockId === blockId
              ? {
                  ...item,
                  fragmentAssignments: item.fragmentAssignments.filter(
                    (fragment) => fragment.fragmentId !== fragmentId,
                  ),
                }
              : item,
          ),
        };
      });
    },
    [],
  );
  const handleApplyReviewedRecoveryImport = React.useCallback(() => {
    if (!currentCv || !cvImportRecoveryDraft) return;
    const normalizedItems = cvImportRecoveryDraft.items.map(
      normalizeCvRecoveryItemTargets,
    );
    const { itemsToApply, pendingItems, summary } =
      buildRecoveryCommitState(normalizedItems);
    const reviewedSections = applyImportRecoveryItems(
      cvImportRecoveryDraft.baseSections,
      itemsToApply,
    );
    const touchedSectionIds = collectRecoveryDestinationSectionIds(
      reviewedSections,
      itemsToApply,
    );
    const revealedSections = buildTouchedSectionRevealState(
      reviewedSections,
      touchedSectionIds,
    );
    const persistedSession = pendingItems.length
      ? createCvImportRecoverySession(
          pendingItems,
          cvImportRecoveryDraft.reviewLimit,
        )
      : createCompletedCvImportRecoverySession(
          normalizedItems,
          cvImportRecoveryDraft.reviewLimit,
          cvImportRecoveryDraft.baseSections,
        );
    const now = new Date().toISOString();
    void importCv({
      ...currentCv,
      metadata: {
        ...buildUpdatedCvMetadata(currentCv, now),
        importRecoverySession: persistedSession,
      },
      sections: revealedSections,
    });
    if (!pendingItems.length) {
      const cvId = String(currentCv.id);
      setAcceptedImportReviewCvIds((current) =>
        current.includes(cvId) ? current : [...current, cvId],
      );
      setDismissedImportReviewCvIds((current) =>
        current.includes(cvId) ? current : [...current, cvId],
      );
    }
    showToast(formatRecoveryCommitToast(summary), { variant: "success" });
    setImportReviewOpen(false);
    setCvImportRecoveryDraft(null);
  }, [currentCv, cvImportRecoveryDraft, importCv, showToast]);
  const handleImportRecoveryAsIs = React.useCallback(() => {
    if (!currentCv || !cvImportRecoveryDraft) return;
    const normalizedItems = cvImportRecoveryDraft.items.map(
      normalizeCvRecoveryItemTargets,
    );
    const persistedSession = createCompletedCvImportRecoverySession(
      normalizedItems,
      cvImportRecoveryDraft.reviewLimit,
      cvImportRecoveryDraft.baseSections,
    );
    const now = new Date().toISOString();
    void importCv({
      ...currentCv,
      metadata: {
        ...buildUpdatedCvMetadata(currentCv, now),
        importRecoverySession: persistedSession,
      },
      sections: currentSections,
    });
    const cvId = String(currentCv.id);
    setAcceptedImportReviewCvIds((current) =>
      current.includes(cvId) ? current : [...current, cvId],
    );
    setDismissedImportReviewCvIds((current) =>
      current.includes(cvId) ? current : [...current, cvId],
    );
    setImportReviewOpen(false);
    setCvImportRecoveryDraft(null);
  }, [currentCv, currentSections, cvImportRecoveryDraft, importCv]);
  const handleDiscardImportRecovery = React.useCallback(() => {
    if (!currentCv) return;
    const now = new Date().toISOString();
    const metadata = buildUpdatedCvMetadata(currentCv, now);
    delete (metadata as { importRecoverySession?: unknown })
      .importRecoverySession;
    void importCv({
      ...currentCv,
      metadata,
    });
    const cvId = String(currentCv.id);
    setAcceptedImportReviewCvIds((current) =>
      current.includes(cvId) ? current : [...current, cvId],
    );
    setDismissedImportReviewCvIds((current) =>
      current.includes(cvId) ? current : [...current, cvId],
    );
    setImportReviewOpen(false);
    setCvImportRecoveryDraft(null);
  }, [currentCv, importCv]);
  const handleOpenAtsAudit = React.useCallback(() => {
    setAtsAuditOpen(true);
  }, []);
  const handleExportStyledPdf = React.useCallback(() => {
    void handleResumeExport({ format: "pdf", mode: "styled" });
  }, [handleResumeExport]);
  const handleExportDocx = React.useCallback(() => {
    void handleResumeExport({ format: "docx" });
  }, [handleResumeExport]);
  const handleCvPreviewPageCountChange = React.useCallback(
    (pageCount: number) => {
      setCvPreviewPageCount((current) =>
        current === pageCount ? current : pageCount,
      );
    },
    [],
  );
  const handleCvTitleCommit = React.useCallback(
    (nextTitle: string) => {
      if (!currentCvId || !currentCv) return;
      const resolvedTitle =
        nextTitle.trim() ||
        deriveCvTitleCandidateFromSections(currentCv.sections) ||
        "Untitled CV";
      renameCv(currentCvId, resolvedTitle);
    },
    [currentCv, currentCvId, renameCv],
  );
  const handleDuplicateTopbarCv = React.useCallback(() => {
    if (!currentCv) {
      showToast("Open a CV first.", { variant: "warning" });
      return;
    }

    const now = new Date().toISOString();
    const nextCvId = uuidv4();
    const baseTitle =
      typeof currentCv.title === "string" && currentCv.title.trim()
        ? currentCv.title.trim()
        : deriveCvTitleFromSections(currentCv.sections, "Untitled CV");
    const nextTitle = `Copy of ${baseTitle}`;
    const copiedCv =
      typeof structuredClone === "function"
        ? structuredClone(currentCv)
        : (JSON.parse(JSON.stringify(currentCv)) as CvDocument);

    void importCv({
      ...copiedCv,
      id: nextCvId,
      title: nextTitle,
      metadata: {
        ...cleanCvMetadataForImport(copiedCv.metadata),
        createdAt: now,
        updatedAt: now,
        titleLocked: true,
      },
    })
      .then(() => {
        loadCv(nextCvId);
        navigateToSelectedCv(nextCvId);
        showToast("Duplicated.", { variant: "success" });
      })
      .catch(() => {
        showToast("Duplicate failed.", { variant: "error" });
      });
  }, [currentCv, importCv, loadCv, navigateToSelectedCv, showToast]);
  const handleDeleteTopbarCv = React.useCallback(() => {
    if (!currentCvId) return;
    const confirmed = window.confirm("Delete CV?");
    if (!confirmed) return;

    const nextCv = cvs.find((cv) => String(cv.id) !== String(currentCvId));
    deleteCv(currentCvId);
    if (nextCv?.id) {
      const nextCvId = String(nextCv.id);
      loadCv(nextCvId);
      navigateToSelectedCv(nextCvId);
      return;
    }
    void navigate("/cv", { replace: true });
  }, [currentCvId, cvs, deleteCv, loadCv, navigate, navigateToSelectedCv]);
  const topbarNewCvRef = React.useRef<() => void>(() => {});
  const topbarImportCvRef = React.useRef<() => void>(() => {});
  const handleTopbarNewCv = React.useCallback(() => {
    topbarNewCvRef.current();
  }, []);
  const handleTopbarImportCv = React.useCallback(() => {
    topbarImportCvRef.current();
  }, []);
  const cvTopbarRegistration = React.useMemo(
    () => ({
      mode: workspaceMode,
      hasCurrentCv: Boolean(currentCv),
      documentTitle: currentCv?.title ?? "Untitled CV",
      titlePlaceholder: "Untitled CV",
      onTitleCommit: handleCvTitleCommit,
      resumeOptions,
      onPickResume: handlePickResume,
      onNewCv: handleTopbarNewCv,
      onImportCv: handleTopbarImportCv,
      onDuplicateCv: handleDuplicateTopbarCv,
      onDeleteCv: handleDeleteTopbarCv,
      hasTrustedExport,
      atsAudit,
      importIssueCount: activeImportRecoveryItems.length,
      importReviewBannerVisible: isImportReviewBannerVisible,
      exporting: exportingFormat !== null,
      pageCount: currentCv ? cvPreviewPageCount : null,
      onOpenAtsAudit: handleOpenAtsAudit,
      onOpenImportReview: handleOpenImportReview,
      onExportPdf: handleExportStyledPdf,
      onExportDocx: handleExportDocx,
      onPageSizePreferenceChange: setDocumentPageSizePreference,
      pageSizePreference: documentPageSizePreference,
    }),
    [
      currentCv,
      atsAudit,
      cvPreviewPageCount,
      exportingFormat,
      handleCvTitleCommit,
      handleDeleteTopbarCv,
      handleDuplicateTopbarCv,
      handleExportDocx,
      handleOpenAtsAudit,
      handleExportStyledPdf,
      documentPageSizePreference,
      handlePickResume,
      handleTopbarImportCv,
      handleTopbarNewCv,
      handleOpenImportReview,
      hasTrustedExport,
      activeImportRecoveryItems.length,
      isImportReviewBannerVisible,
      resumeOptions,
      workspaceMode,
    ],
  );
  useRegisterCvForgeTopbar(cvTopbarRegistration);
  const cvRecoveryOutcomeSummary = React.useMemo(() => {
    if (!cvImportRecoveryDraft) return null;
    return buildRecoveryCommitState(
      cvImportRecoveryDraft.items.map(normalizeCvRecoveryItemTargets),
    ).summary;
  }, [cvImportRecoveryDraft]);

  const cvWorkbenchShellStyle = {
    width: "100%",
    maxWidth: "100%",
    marginInline: "auto",
    "--cv-paper-visual-inline-size": `min(100%, ${Math.round(resolvedDocumentPageSize.widthPx * 100) / 100}px)`,
    "--cv-workspace-stage-inline-size": "var(--cv-paper-visual-inline-size)",
  } as React.CSSProperties;
  const activeWorkspacePanel = templatePanelOpen
    ? getCvWorkspacePanel(activeTemplateSurface)
    : null;
  const isWideEnoughForDockedPanel =
    viewportWidth >= CV_WORKSPACE_DOCKED_PANEL_MIN_VIEWPORT_WIDTH;
  const isWorkspacePanelDocked =
    activeWorkspacePanel !== null && isWideEnoughForDockedPanel;
  const isForgeDrawerDockedDesktop =
    templatePanelOpen &&
    templatePanelOpenMode === "docked" &&
    isWorkspacePanelDocked;
  const shouldAutoCollapseCvRailForDockedDrawer =
    isForgeDrawerDockedDesktop && viewportWidth < 1760;
  React.useEffect(() => {
    if (!activeTemplateSurface || activeWorkspacePanel === null) return;
    if (templatePanelOpenMode === "peek") return;
    const nextMode = isWideEnoughForDockedPanel ? "docked" : "overlay";
    if (templatePanelOpenMode === nextMode) return;
    openTemplateSurface(activeTemplateSurface, { mode: nextMode });
  }, [
    activeTemplateSurface,
    activeWorkspacePanel,
    isWideEnoughForDockedPanel,
    openTemplateSurface,
    templatePanelOpenMode,
  ]);
  const showJobBriefContext = Boolean(requestedJobId);
  const isEntryPickerBusy = isCreatingEntryCv || isImportingEntryCv;
  const {
    style: cvCommandLayerStyle,
    toolbarMode: cvCommandToolbarMode,
    modeControlMode: cvCommandModeControlMode,
    askMode: cvCommandAskMode,
    commandLayerSticky: cvCommandLayerSticky,
    commandLayerMeasured: cvCommandLayerMeasured,
  } = useDocumentCommandLayerPosition({
    stageRef: cvDocumentStageRef,
    paperRef: paperStageRef,
    paperAnchorSelector: CV_PAPER_ANCHOR_SELECTOR,
    commandCanvasSelector: CV_COMMAND_LAYER_CANVAS_SELECTOR,
    cssVarPrefix: "proposal",
    toolbarSelector: "[data-testid='cv-toolbar']",
    toolbarNaturalWidth: CV_COMMAND_LAYER_TOOLBAR_NATURAL_WIDTH,
    toolbarMinWidth: CV_COMMAND_LAYER_TOOLBAR_MIN_WIDTH,
    toolbarHeight: CV_COMMAND_LAYER_TOOLBAR_HEIGHT,
    askHandle: CV_COMMAND_LAYER_ASK_HANDLE,
    safeMargin: CV_COMMAND_LAYER_SAFE_MARGIN,
    gap: CV_COMMAND_LAYER_GAP,
    askOffsetFromPaperTop: CV_ASK_OFFSET_FROM_PAPER_TOP,
    refreshKey: `${workspaceMode}:${isForgeDrawerDockedDesktop}:${shouldAutoCollapseCvRailForDockedDrawer}`,
  });

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
        setCvComposerOpen(false);
        setCvAskSelectionContext(null);
      }
    },
    [currentSections],
  );

  const handleAskAiForSection = React.useCallback(
    (sectionId: string) => {
      setInlineEditTarget(null);
      setCvAskSelectionContext(null);
      const section = findSectionById(currentSections, sectionId);
      setCvRailAiSuggestion(null);
      setActiveSectionId(sectionId);
      setResumeActiveTarget(getSectionTarget(section));
      focusPreviewSection(sectionId);
      if (getCanonicalSectionType(section) === "skills") {
        setSectionEditorOpen(true);
        setCvComposerOpen(false);
        setCvRailTab("ai");
        return;
      }
      setCvRailTab("ai");
      setCvComposerOpen(true);
    },
    [currentSections],
  );

  const handleOpenCvAsk = React.useCallback(() => {
    const section =
      (activeSectionId
        ? findSectionById(currentSections, activeSectionId)
        : null) ??
      activeSection;
    if (!section) return;

    const sectionIndex = currentSections.indexOf(section);
    const sectionId =
      activeSectionId && findSectionById(currentSections, activeSectionId)
        ? activeSectionId
        : getCvSectionId(section, sectionIndex >= 0 ? sectionIndex : 0);

    setInlineEditTarget(null);
    setCvAskSelectionContext(null);
    setActiveSectionId(sectionId);
    setResumeActiveTarget(getSectionTarget(section));
    focusPreviewSection(sectionId);
    setSectionEditorOpen(true);
    setCvComposerOpen(false);
  }, [activeSection, activeSectionId, currentSections]);

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
      if (readInlineFieldCanonicalText(section, target) === nextText) {
        return;
      }

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
        applyInlineFieldChange(target, text);
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

  React.useEffect(() => {
    const flushBeforePageExit = () => {
      flushPendingInlineFieldChange();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushBeforePageExit();
      }
    };

    window.addEventListener("beforeunload", flushBeforePageExit);
    window.addEventListener("pagehide", flushBeforePageExit);
    document.addEventListener("visibilitychange", flushWhenHidden);

    return () => {
      window.removeEventListener("beforeunload", flushBeforePageExit);
      window.removeEventListener("pagehide", flushBeforePageExit);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushPendingInlineFieldChange]);

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
    const editableElement = findInlinePaperEditableForSelection(
      root,
      selection,
    );
    const editTarget = readInlinePaperEditTarget(editableElement);

    if (!selectionState || !editTarget) {
      if (isInlineAiToolbarActiveElement()) {
        return;
      }
      if (cvAiReviewRef.current && cvAiReviewRef.current.state !== "accepted") {
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

  const refreshInlinePaperSelectionAnchor = React.useCallback(() => {
    if (workspaceMode !== "edit") return;

    const root = paperStageRef.current;
    setInlinePaperSelectionState((current) => {
      if (!current?.range) return current;

      const refreshedState = getDomRangeSelectionState(
        root,
        current.range,
        current.text,
      );
      if (!refreshedState) return current;

      return {
        ...current,
        anchor: refreshedState.anchor,
      };
    });
  }, [workspaceMode]);

  React.useEffect(() => {
    if (workspaceMode !== "edit") {
      setInlinePaperSelectionState(null);
      return undefined;
    }

    const handleSelectionChange = () => scheduleInlinePaperSelectionCheck();
    const handlePointerUp = () => scheduleInlinePaperSelectionCheck();
    let scrollFrame: number | null = null;
    const handleScroll = () => {
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        refreshInlinePaperSelectionAnchor();
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [
    refreshInlinePaperSelectionAnchor,
    scheduleInlinePaperSelectionCheck,
    workspaceMode,
  ]);

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

  const runInlinePaperAiForSelectionContext = React.useCallback(
    async (
      context: CvAskSelectionContext,
      actionId: InlineAiActionId,
      instruction: string,
    ) => {
      const escape = (value: string) =>
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(value)
          : value.replace(/"/g, '\\"');
      const editableElement = document.querySelector<HTMLElement>(
        `[data-inline-paper-editable="true"][data-paper-section-id="${escape(
          context.editTarget.sectionId,
        )}"][data-paper-field-path="${escape(context.editTarget.fieldPath)}"]`,
      );
      if (!editableElement) return;

      const interactionId = createAiInteractionId();
      const requestId = interactionId;
      const target = context.editTarget;
      flushPendingInlineFieldChange();
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, target.sectionId);
      const sectionLabel = section?.title || "Section";
      const itemId = target.fieldPath.match(/^structuredContent\.item:([^.]*)\./)?.[1];
      const item = section && itemId ? getStructuredItemById(section, itemId) : undefined;
      const itemLabel =
        item && typeof item === "object"
          ? String(
              item.position ??
                item.role ??
                item.title ??
                item.company ??
                "Item",
            )
          : undefined;

      if (!isConvexAuthenticated) {
        const errorMessage = isConvexAuthLoading
          ? "AI is still connecting. Try again."
          : "Sign in to use AI writing.";
        setActiveSectionId(target.sectionId);
        setResumeActiveTarget(getSectionTarget(section));
        setCvRailAiSuggestion(null);
        setCvAiReview({
          key: interactionId,
          target: {
            sectionId: target.sectionId,
            sectionType: target.sectionType,
            sectionLabel,
            itemId,
            itemLabel,
            fieldPath: target.fieldPath,
            fieldKind: target.fieldKind,
            selectedText: context.selectedText,
          },
          anchor: context.anchor,
          beforeText: context.selectedText,
          afterText: "",
          state: "error",
          errorMessage,
          actionId,
          primaryActionLabel:
            target.sectionType === "experience"
              ? "Replace responsibilities"
              : "Replace",
          interactionId,
        });
        showToast(errorMessage, { variant: "warning" });
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "section_editor",
          actionId,
          errorKind: "request_failed",
        });
        return;
      }

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
        setCvRailAiSuggestion(null);
        setCvAiReview({
          key: interactionId,
          target: {
            sectionId: target.sectionId,
            sectionType: target.sectionType,
            sectionLabel,
            itemId,
            itemLabel,
            fieldPath: target.fieldPath,
            fieldKind: target.fieldKind,
            selectedText: context.selectedText,
          },
          anchor: context.anchor,
          beforeText: context.selectedText,
          afterText: "",
          state: "loading",
          actionId,
          primaryActionLabel:
            target.sectionType === "experience"
              ? "Replace responsibilities"
              : "Replace",
          interactionId,
        });
        const result = await withCvInlinePaperAiTimeout(
          transformEditorSelectionAction({
            mode: actionId,
            instruction,
            selectedText: context.selectedText,
          }),
        );
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
          setCvAiReview((current) =>
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
        setCvAiReview({
          key: interactionId,
          target: {
            sectionId: target.sectionId,
            sectionType: target.sectionType,
            sectionLabel,
            itemId,
            itemLabel,
            fieldPath: target.fieldPath,
            fieldKind: target.fieldKind,
            selectedText: context.selectedText,
          },
          anchor: context.anchor,
          beforeText: context.selectedText,
          afterText: normalizedResult.text,
          state: "ready",
          actionId: normalizedResult.actionId,
          primaryActionLabel:
            target.sectionType === "experience"
              ? "Replace responsibilities"
              : "Replace",
          interactionId,
        });
        focusPreviewSection(target.sectionId);
        setCvAskSelectionContext(null);
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
        setCvAiReview((current) =>
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
      flushPendingInlineFieldChange,
      isConvexAuthenticated,
      isConvexAuthLoading,
      showToast,
      transformEditorSelectionAction,
    ],
  );

  const handleRunInlinePaperAiAction = React.useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!inlinePaperSelectionState) return;
      await runInlinePaperAiForSelectionContext(
        {
          selectedText: inlinePaperSelectionState.text,
          editTarget: inlinePaperSelectionState.editTarget,
          anchor: inlinePaperSelectionState.anchor,
        },
        actionId,
        instruction,
      );
    },
    [inlinePaperSelectionState, runInlinePaperAiForSelectionContext],
  );

  const handleRunCvAskForSelection = React.useCallback(
    async (args: { prompt: string; actionId: InlineAiActionId }) => {
      if (!cvAskSelectionContext) return;
      await runInlinePaperAiForSelectionContext(
        cvAskSelectionContext,
        args.actionId,
        args.prompt,
      );
    },
    [cvAskSelectionContext, runInlinePaperAiForSelectionContext],
  );

  const handleAddSection = React.useCallback(
    (sectionKind: CvAddSectionKind) => {
      if (!currentCv) {
        showToast("Open or create a CV first.", { variant: "warning" });
        return;
      }
      const nextSection = makeDraftSection(sectionKind);
      const now = new Date().toISOString();
      const nextSections = insertSectionByCanonicalOrder(
        currentSections,
        nextSection,
      );
      void importCv({
        ...currentCv,
        metadata: buildUpdatedCvMetadata(currentCv, now),
        sections: normalizeCvSectionOrder(nextSections),
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
      if (
        isSectionReorderLocked(currentSections[fromIndex]) ||
        isSectionReorderLocked(currentSections[toIndex])
      ) {
        return;
      }

      const nextSections = [...currentSections];
      const [movedSection] = nextSections.splice(fromIndex, 1);
      nextSections.splice(toIndex, 0, movedSection);
      persistSections(normalizeCvSectionOrder(nextSections));
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
        (typeof source?.accentHex === "string"
          ? source.accentHex
          : undefined) ?? (sourceStyle?.accentHex as string | undefined);
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
  }, [cvStyleSlotPresets, selectedStyleSlot, stylePreset]);

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
        | "sanat-asymmetric"
        | "editorial-sidebar"
        | "editorial"
        | "minimal"
        | "classic",
    ) => {
      const layout =
        template === "minimal" || template === "classic" ? "swiss" : "workshop";
      const resumeTemplateId =
        template === "editorial-sidebar"
          ? EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID
          : template === "sanat-asymmetric"
            ? SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID
          : template === "workshop-twocol"
            ? WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
            : layout === "workshop"
              ? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
              : undefined;
      const nextStylePreset = resolveVerbatiStyle({
        ...stylePreset,
        familyId: layout,
        layout,
        resumeTemplateId,
      });
      setStylePreset(nextStylePreset);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(nextStylePreset, {
          verbatiStyleBaseSnapshot:
            buildDocumentAppearanceSnapshot(nextStylePreset),
          documentStyleVersion: DOCUMENT_STYLE_VERSION,
        });
      }
    },
    [saveCurrentCvStyleOnly, setStylePreset, stylePreset],
  );
  const cvTemplatePanelItems = React.useMemo(
    () => [
      {
        id: "workshop-onecol",
        label: "Minimal",
        preview: {
          kind: "Resume" as const,
          family: "workshop-onecol" as const,
        },
      },
      {
        id: "workshop-twocol",
        label: "French",
        preview: {
          kind: "Resume" as const,
          family: "workshop-twocol" as const,
        },
      },
      {
        id: "sanat-asymmetric",
        label: "Sanat",
        preview: {
          kind: "Resume" as const,
          family: "sanat-asymmetric" as const,
        },
      },
      {
        id: "editorial-sidebar",
        label: "Editorial Sidebar",
        preview: {
          kind: "Resume" as const,
          family: "editorial-sidebar" as const,
        },
      },
    ],
    [],
  );
  const activeCvTemplatePanelItemId =
    stylePreset.resumeTemplateId === EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID
      ? "editorial-sidebar"
      : stylePreset.resumeTemplateId === SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID
        ? "sanat-asymmetric"
      : stylePreset.layout === "workshop" &&
          stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
      ? "workshop-twocol"
      : "workshop-onecol";
  const cvTemplatePanelRegistration = React.useMemo(
    () => ({
      surface: "cv" as const,
      title: translateUi(resolvedLanguage, "workspace.cvTemplatesPanel"),
      subtitle: "A4 · 21 × 29.7 cm",
      activeItemId: activeCvTemplatePanelItemId,
      items: cvTemplatePanelItems,
      onSelect: (itemId: string) => {
        if (
          itemId === "workshop-onecol" ||
          itemId === "workshop-twocol" ||
          itemId === "sanat-asymmetric" ||
          itemId === "editorial-sidebar"
        ) {
          handleSelectTemplate(itemId);
        }
      },
    }),
    [
      activeCvTemplatePanelItemId,
      cvTemplatePanelItems,
      handleSelectTemplate,
      resolvedLanguage,
    ],
  );
  useRegisterForgeTemplates(cvTemplatePanelRegistration);
  const cvLibraryDrawerItems = React.useMemo(
    () =>
      buildWorkLibraryModel({
        cvs,
        currentCvId,
        proposals: cvForgeLibraryProposals,
      }).items,
    [currentCvId, cvForgeLibraryProposals, cvs],
  );
  const handleSelectCvFromLibraryDrawer = React.useCallback(
    (cvId: string) => {
      closeForgePanel();
      void navigate(`/cv?id=${encodeURIComponent(cvId)}`);
      loadCv(cvId);
    },
    [closeForgePanel, loadCv, navigate],
  );
  const handleOpenCvFromLibraryDrawer = React.useCallback(
    (cvId: string) => {
      closeForgePanel();
      void navigate(`/cv?id=${encodeURIComponent(cvId)}`);
    },
    [closeForgePanel, navigate],
  );
  const handleOpenCvLibraryItemFromDrawer = React.useCallback(
    (item: LibraryItem) => {
      closeForgePanel();
      if (item.routeTarget.kind === "route") {
        void navigate(item.routeTarget.to);
      }
    },
    [closeForgePanel, navigate],
  );
  const handleOpenCvLibraryTypeFromDrawer = React.useCallback(
    (type: "cvs" | "proposals") => {
      closeForgePanel();
      void navigate(`/documents?type=${type}`);
    },
    [closeForgePanel, navigate],
  );
  const cvOnlyPanelRegistration = React.useMemo(
    () => ({
      surface: "cvs" as const,
      title: translateUi(resolvedLanguage, "workspace.cvLibrary"),
      icon: <FileUser size={16} aria-hidden="true" />,
      renderContent: () => (
        <CvForgeCvDrawer
          items={cvLibraryDrawerItems}
          currentCvId={currentCvId}
          hydrateCvDocument={hydrateCvDocument}
          onSelectCv={handleSelectCvFromLibraryDrawer}
          onOpenCv={handleOpenCvFromLibraryDrawer}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "workspace.openLibrary"),
        icon: <FolderSimple size={13} aria-hidden="true" />,
        onSelect: () => navigate("/documents?type=cvs"),
      },
    }),
    [
      currentCvId,
      cvLibraryDrawerItems,
      handleOpenCvFromLibraryDrawer,
      handleSelectCvFromLibraryDrawer,
      hydrateCvDocument,
      navigate,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(cvOnlyPanelRegistration);
  const cvLibraryPanelRegistration = React.useMemo(
    () => ({
      surface: "documents" as const,
      title: translateUi(resolvedLanguage, "workspace.library"),
      icon: <FileUser size={16} aria-hidden="true" />,
      renderContent: () => (
        <CvForgeLibraryDrawer
          items={cvLibraryDrawerItems}
          currentCvId={currentCvId}
          hydrateCvDocument={hydrateCvDocument}
          onSelectCv={handleSelectCvFromLibraryDrawer}
          onOpenItem={handleOpenCvLibraryItemFromDrawer}
          onOpenLibraryType={handleOpenCvLibraryTypeFromDrawer}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "workspace.openLibrary"),
        icon: <FolderSimple size={13} aria-hidden="true" />,
        onSelect: () => navigate("/documents?type=cvs"),
      },
    }),
    [
      currentCvId,
      cvLibraryDrawerItems,
      handleOpenCvLibraryTypeFromDrawer,
      handleOpenCvLibraryItemFromDrawer,
      handleSelectCvFromLibraryDrawer,
      hydrateCvDocument,
      navigate,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(cvLibraryPanelRegistration);
  const cvTemplatesOpen = templatePanelOpen && activeTemplateSurface === "cv";
  const cvDesignOpen =
    templatePanelOpen && activeTemplateSurface === "cv-design";
  const sectionsPanelOpen =
    templatePanelOpen && activeTemplateSurface === "cv-sections";
  const openCvWorkspacePanel = React.useCallback(
    (surface: "cv" | "cv-design" | "cv-sections") => {
      openTemplateSurface(surface, {
        mode: isWideEnoughForDockedPanel ? "docked" : "overlay",
      });
    },
    [isWideEnoughForDockedPanel, openTemplateSurface],
  );
  const handleOpenCvTemplates = React.useCallback(() => {
    if (cvTemplatesOpen) {
      closeForgePanel();
      return;
    }
    openCvWorkspacePanel("cv");
  }, [closeForgePanel, cvTemplatesOpen, openCvWorkspacePanel]);

  const handleOpenCvSections = React.useCallback(() => {
    if (sectionsPanelOpen) {
      closeForgePanel();
      return;
    }
    openCvWorkspacePanel("cv-sections");
  }, [closeForgePanel, openCvWorkspacePanel, sectionsPanelOpen]);

  const handleOpenCvDesign = React.useCallback(() => {
    if (cvDesignOpen) {
      closeForgePanel();
      return;
    }
    openCvWorkspacePanel("cv-design");
  }, [closeForgePanel, cvDesignOpen, openCvWorkspacePanel]);

  const handleSelectFontPair = React.useCallback(
    (fontPairId: VerbatiFontPairId) => {
      const nextStylePreset = resolveVerbatiStyle({
        ...stylePreset,
        typography: fontPairId,
      });
      setStylePreset(nextStylePreset);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(nextStylePreset, {
          verbatiStyleBaseSnapshot:
            buildDocumentAppearanceSnapshot(nextStylePreset),
          documentStyleVersion: DOCUMENT_STYLE_VERSION,
        });
      }
    },
    [saveCurrentCvStyleOnly, setStylePreset, stylePreset],
  );

  const handleSelectAccent = React.useCallback(
    (accent: CvAccentChoice) => {
      const nextStylePreset = resolveVerbatiStyle({
        ...stylePreset,
        ...resolveAccentStyle(accent),
      });
      setStylePreset(nextStylePreset);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(nextStylePreset, {
          verbatiStyleBaseSnapshot:
            buildDocumentAppearanceSnapshot(nextStylePreset),
          documentStyleVersion: DOCUMENT_STYLE_VERSION,
        });
      }
    },
    [saveCurrentCvStyleOnly, setStylePreset, stylePreset],
  );

  const handleSelectCustomAccent = React.useCallback(
    (hex: string) => {
      const nextStylePreset = resolveVerbatiStyle({
        ...stylePreset,
        palette: "custom",
        accentHex: hex,
      });
      setStylePreset(nextStylePreset);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(nextStylePreset, {
          verbatiStyleBaseSnapshot:
            buildDocumentAppearanceSnapshot(nextStylePreset),
          documentStyleVersion: DOCUMENT_STYLE_VERSION,
        });
      }
    },
    [saveCurrentCvStyleOnly, setStylePreset, stylePreset],
  );

  const handleDocumentIconSettingsChange = React.useCallback(
    (settings: DocumentIconSettings) => {
      const nextSettings = normalizeDocumentIconSettings(settings);
      if (typeof saveCurrentCvStyleOnly === "function") {
        void saveCurrentCvStyleOnly(stylePreset, {
          documentIcons: nextSettings,
        });
      }
    },
    [saveCurrentCvStyleOnly, stylePreset],
  );
  const handleDocumentListItemIconChange = React.useCallback(
    (
      target: DocumentListItemIconOverrideTarget,
      iconKey: DocumentIconKey | null,
    ) => {
      const key = buildDocumentListItemIconOverrideKey(target);
      if (!key || typeof saveCurrentCvStyleOnly !== "function") {
        return;
      }

      const currentListItems = documentIconOverrides.listItems ?? {};
      const nextListItems = { ...currentListItems };
      if (iconKey) {
        nextListItems[key] = iconKey;
      } else {
        delete nextListItems[key];
      }

      const nextOverrides: DocumentIconOverrides =
        Object.keys(nextListItems).length > 0 ? { listItems: nextListItems } : {};

      void saveCurrentCvStyleOnly(stylePreset, {
        documentIconOverrides: nextOverrides,
      });
    },
    [documentIconOverrides, saveCurrentCvStyleOnly, stylePreset],
  );

  const persistedCvDocumentDecoration = React.useMemo(
    () => getCvDocumentDecoration(currentCv?.metadata),
    [currentCv?.metadata],
  );
  const [draftCvDocumentDecoration, setDraftCvDocumentDecoration] =
    React.useState<DocumentDecoration | null>(null);
  const cvDecorationPreviewUrlRef = React.useRef<string | null>(null);
  const revokeCvDecorationPreviewUrl = React.useCallback(() => {
    const previewUrl = cvDecorationPreviewUrlRef.current;
    if (previewUrl && typeof URL !== "undefined") {
      URL.revokeObjectURL(previewUrl);
    }
    cvDecorationPreviewUrlRef.current = null;
  }, []);
  React.useEffect(() => {
    revokeCvDecorationPreviewUrl();
    setDraftCvDocumentDecoration(null);
  }, [currentCv?.id, revokeCvDecorationPreviewUrl]);
  React.useEffect(() => revokeCvDecorationPreviewUrl, [revokeCvDecorationPreviewUrl]);
  const cvDocumentDecoration =
    draftCvDocumentDecoration ?? persistedCvDocumentDecoration;
  const updateCvDocumentDecoration = React.useCallback(
    async (nextDecoration: DocumentDecoration): Promise<void> => {
      if (!currentCv) {
        showToast("Load a CV before adding an image.", { variant: "error" });
        return;
      }

      const normalizedDecoration = normalizeDocumentDecoration(nextDecoration);
      const persistedDecoration = shouldPersistDocumentDecoration(
        normalizedDecoration,
      )
        ? normalizedDecoration
        : createDefaultDocumentDecoration();

      await saveCurrentCvStyleOnly(stylePreset, {
        documentDecoration: {
          ...persistedDecoration,
          visible: persistedDecoration.visible,
        },
        documentStyleVersion: DOCUMENT_STYLE_VERSION,
      });
    },
    [currentCv, saveCurrentCvStyleOnly, showToast, stylePreset],
  );
  const handleCvDocumentDecorationPreviewChange = React.useCallback(
    (nextDecoration: DocumentDecoration) => {
      setDraftCvDocumentDecoration(normalizeDocumentDecoration(nextDecoration));
    },
    [],
  );
  const handleCvDocumentDecorationPreviewCommit = React.useCallback(
    (nextDecoration: DocumentDecoration) => {
      const normalizedDecoration = normalizeDocumentDecoration(nextDecoration);
      setDraftCvDocumentDecoration(null);
      void updateCvDocumentDecoration(normalizedDecoration);
    },
    [updateCvDocumentDecoration],
  );

  const handleCvDesignImageUpload = React.useCallback(
    (file: File, baseDecoration: DocumentDecoration = cvDocumentDecoration) => {
      if (!currentCv) {
        showToast("Load a CV before adding an image.", { variant: "error" });
        return;
      }

      void (async () => {
        if (file.size > DOCUMENT_DECORATION_MAX_FILE_BYTES) {
          throw new Error("Decoration image must be 10 MB or smaller.");
        }
        const mimeType = resolveDocumentDecorationMimeType(file);
        if (!mimeType) {
          throw new Error("Use a PNG, JPG, or SVG image.");
        }
        const fileName = file.name.slice(0, 160);
        const previewUrl =
          typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(file)
            : "";
        revokeCvDecorationPreviewUrl();
        cvDecorationPreviewUrlRef.current = previewUrl || null;
        const pendingDecoration = normalizeDocumentDecoration({
          ...createDefaultDocumentDecoration(),
          visible: true,
          source: "upload",
          resolvedUrl: previewUrl || undefined,
          fileName,
          mimeType,
          alt: fileName.replace(/\.[^.]+$/, "") || "Document decoration",
          sizePreset: baseDecoration.sizePreset,
          customSizeMm: baseDecoration.customSizeMm,
          fit: baseDecoration.fit,
          placementMode: baseDecoration.placementMode,
          xMm: baseDecoration.xMm,
          yMm: baseDecoration.yMm,
          visible: true,
        });
        setDraftCvDocumentDecoration(pendingDecoration);

        const storageId = await uploadDocumentDecorationAsset({
          generateUploadUrl: generateDocumentAssetUploadUrl,
          file,
          mimeType: pendingDecoration.mimeType,
        });

        const persistedDecoration = normalizeDocumentDecoration({
          ...createDefaultDocumentDecoration(),
          visible: true,
          source: "upload",
          assetId: storageId,
          fileName,
          mimeType: pendingDecoration.mimeType,
          alt: pendingDecoration.alt,
          sizePreset: pendingDecoration.sizePreset,
          customSizeMm: pendingDecoration.customSizeMm,
          fit: pendingDecoration.fit,
          placementMode: pendingDecoration.placementMode,
          xMm: pendingDecoration.xMm,
          yMm: pendingDecoration.yMm,
        });
        await updateCvDocumentDecoration(persistedDecoration);
        setDraftCvDocumentDecoration(null);
        revokeCvDecorationPreviewUrl();
      })().catch((error: unknown) => {
        showToast(
          error instanceof Error ? error.message : "Could not upload this image.",
          { variant: "error" },
        );
      });
    },
    [
      currentCv,
      cvDocumentDecoration,
      generateDocumentAssetUploadUrl,
      revokeCvDecorationPreviewUrl,
      showToast,
      updateCvDocumentDecoration,
    ],
  );

  const cvDesignPanelRegistration = React.useMemo(
    () => ({
      surface: "cv-design" as const,
      title: translateUi(resolvedLanguage, "workspace.design"),
      ariaLabel: translateUi(resolvedLanguage, "workspace.cvDesignPanel"),
      renderContent: () => (
        <CvDesignFields
          stylePreset={stylePreset}
          selectedStyleSlot={selectedStyleSlot}
          selectedStyleSlotIsCustom={selectedStyleSlotIsCustom}
          onSelectStyleSlot={handleSelectStyleSlot}
          onResetStyleSlot={handleResetStyleSlot}
          onSelectTemplate={handleSelectTemplate}
          onSelectFontPair={handleSelectFontPair}
          onSelectAccent={handleSelectAccent}
          onSelectCustomAccent={handleSelectCustomAccent}
          documentIconSettings={documentIconSettings}
          onDocumentIconSettingsChange={handleDocumentIconSettingsChange}
          sectionIconTargets={documentIconSectionTargets}
          image={cvDocumentDecoration}
          onImageUpload={handleCvDesignImageUpload}
          onImageChange={updateCvDocumentDecoration}
        />
      ),
    }),
    [
      cvDocumentDecoration,
      documentIconSettings,
      documentIconOverrides,
      documentIconSectionTargets,
      handleCvDesignImageUpload,
      handleDocumentIconSettingsChange,
      handleDocumentListItemIconChange,
      handleResetStyleSlot,
      handleSelectAccent,
      handleSelectCustomAccent,
      handleSelectFontPair,
      handleSelectStyleSlot,
      handleSelectTemplate,
      resolvedLanguage,
      selectedStyleSlot,
      selectedStyleSlotIsCustom,
      stylePreset,
      updateCvDocumentDecoration,
    ],
  );
  useRegisterForgePanel(cvDesignPanelRegistration);

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
      const canonicalSectionType = getCanonicalSectionType(section);
      const isHobbiesSection = canonicalSectionType === "hobbies";
      if (
        canonicalSectionType === "skills" ||
        canonicalSectionType === "languages" ||
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

          if (canonicalSectionType === "skills") {
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
          } else if (canonicalSectionType === "languages") {
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

      if (section.type === "profile" || section.type === "contact") {
        showToast("Ask is unavailable for this section.", { variant: "info" });
        return;
      }

      if (!shouldRenderPaperSectionAiControl(String(section.type))) {
        showToast("Use an item-level AI action for this section.", {
          variant: "info",
        });
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

  const cvSectionsPanelRegistration = React.useMemo(
    () => ({
      surface: "cv-sections" as const,
      title: translateUi(resolvedLanguage, "workspace.sections"),
      ariaLabel: translateUi(resolvedLanguage, "workspace.cvSectionsPanel"),
      renderContent: () => (
        <div className="dasti-cv-sections-drawer">
          <CvSectionsOrganizer
            sections={currentSections}
            hiddenSectionIds={hiddenSectionIds}
            activeSectionId={activeSectionId}
            selectedTone={cvTone}
            onSelectSection={handleSelectSection}
            onToggleHiddenSection={handleToggleHiddenSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
            onMoveSection={handleMoveSection}
            onAskAiForSection={handleAskAiForSection}
            onRunAskAiForSection={handleRunAskAiForSection}
            onAddSection={handleAddSection}
          />
        </div>
      ),
    }),
    [
      activeSectionId,
      currentSections,
      cvTone,
      handleAddSection,
      handleAskAiForSection,
      handleDeleteSection,
      handleMoveSection,
      handleReorderSections,
      handleRunAskAiForSection,
      handleSelectSection,
      handleToggleHiddenSection,
      hiddenSectionIds,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(cvSectionsPanelRegistration);

  const buildPaperSectionAiAnchor = React.useCallback(
    (sectionId: string): EditorSelectionAnchor | null => {
      if (typeof document === "undefined") return null;
      const escape = (value: string) =>
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(value)
          : value.replace(/"/g, '\\"');
      const targetElement = document.querySelector<HTMLElement>(
        `[data-preview-section-id="${escape(sectionId)}"]`,
      );
      const targetRect = targetElement?.getBoundingClientRect();
      const stageRect = paperStageRef.current?.getBoundingClientRect();
      if (!targetRect) return null;

      return {
        left: targetRect.left + window.scrollX + targetRect.width / 2,
        top: targetRect.top + window.scrollY,
        bottom: targetRect.bottom + window.scrollY,
        leftEdge: targetRect.left + window.scrollX,
        rightEdge: targetRect.right + window.scrollX,
        width: targetRect.width,
        height: targetRect.height,
        containerLeft: stageRect ? stageRect.left + window.scrollX : undefined,
        containerRight: stageRect ? stageRect.right + window.scrollX : undefined,
        containerTop: stageRect ? stageRect.top + window.scrollY : undefined,
        containerBottom: stageRect
          ? stageRect.bottom + window.scrollY
          : undefined,
      };
    },
    [],
  );

  const runPaperTextSectionAiReview = React.useCallback(
    async (section: CvSection, sectionId: string) => {
      const target = getInitialEditTargetForSection(section);
      if (!target || target.fieldKind === "chip") return false;

      flushPendingInlineFieldChange();
      setCvRailAiSuggestion(null);
      setCvRailAppliedAiEdit(null);
      setCvAskSelectionContext(null);
      setCvComposerOpen(false);
      setActiveSectionId(sectionId);
      setResumeActiveTarget(getSectionTarget(section));
      focusPreviewSection(sectionId);

      const beforeText = readCvSectionAiText(section).trim();
      if (!beforeText && section.type !== "summary") {
        showToast("Section has no text for AI to rewrite.", {
          variant: "warning",
        });
        return true;
      }

      const interactionId = createAiInteractionId();
      const sectionLabel = section.title || "Section";
      const anchor = buildPaperSectionAiAnchor(sectionId);
      const primaryActionLabel = "Replace";
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "section_editor",
        actionId: "custom",
      });
      setCvAiReview({
        key: interactionId,
        target: {
          sectionId,
          sectionType: target.sectionType,
          sectionLabel,
          fieldPath: target.fieldPath,
          fieldKind: target.fieldKind,
          selectedText: beforeText,
        },
        anchor,
        beforeText: beforeText || "No summary yet.",
        afterText: "",
        state: "loading",
        actionId: section.type === "summary" ? "rewrite" : "custom",
        primaryActionLabel,
        previousSection: section,
        interactionId,
      });

      try {
        if (typeof runCvSectionAiAction !== "function") {
          throw new Error("CV AI action is unavailable.");
        }
        const result =
          section.type === "summary"
            ? await runCvSectionAiAction({
                action: beforeText
                  ? "improve_summary_text"
                  : "rewrite_summary_from_profile",
                existingText: beforeText,
                summary: beforeText || getCurrentCvSummaryText(currentCv),
                skills: getCurrentCvSkills(currentCv),
                experiences: getCurrentCvExperiences(currentCv),
                educations: getCurrentCvEducations(currentCv),
                languages: getCurrentCvLanguages(currentCv),
                instruction: [
                  "Rewrite the summary for clarity and impact.",
                  "Return only the replacement text.",
                ].join("\n\n"),
              })
            : await runCvSectionAiAction({
                action: "improve_custom_text",
                instruction: "Improve this CV text. Return only the replacement text.",
                existingText: beforeText,
              });
        const afterText = readAiResultText(result);
        if (!afterText) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            errorKind: "empty_result",
          });
          setCvAiReview((current) =>
            current?.interactionId === interactionId
              ? {
                  ...current,
                  state: "error",
                  errorMessage: "AI returned no usable section text.",
                }
              : current,
          );
          return true;
        }

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
          applyMode: "preview_required",
          outputMode: "single_text",
        });
        setCvAiReview((current) =>
          current?.interactionId === interactionId
            ? {
                ...current,
                afterText,
                state: "ready",
              }
            : current,
        );
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
          errorKind: "request_failed",
        });
        setCvAiReview((current) =>
          current?.interactionId === interactionId
            ? {
                ...current,
                state: "error",
                errorMessage:
                  error instanceof Error && error.message
                    ? error.message
                    : "AI is unavailable for this section.",
              }
            : current,
        );
        showToast("AI unavailable.", { variant: "error" });
      }

      return true;
    },
    [
      buildPaperSectionAiAnchor,
      currentCv,
      flushPendingInlineFieldChange,
      runCvSectionAiAction,
      showToast,
    ],
  );

  const handleRunPageWandForSection = React.useCallback(
    (sectionId: string) => {
      const section = findSectionById(currentSections, sectionId);
      if (!section) return;
      if (!shouldRenderPaperSectionAiControl(String(section.type))) return;
      const railAiMode = getSectionRailAiMode(section);
      if (railAiMode === "none") return;

      if (sectionUsesStructuredSuggestions(section)) {
        setInlineEditTarget(null);
        setCvAskSelectionContext(null);
        setActiveSectionId(sectionId);
        setResumeActiveTarget(getSectionTarget(section));
        focusPreviewSection(sectionId);
        if (getCanonicalSectionType(section) === "skills") {
          setSectionEditorOpen(true);
          setCvComposerOpen(false);
        }
        void handleRunAskAiForSection({ sectionId, prompt: "", tone: cvTone });
        return;
      }

      if (railAiMode === "rail") {
        void runPaperTextSectionAiReview(section, sectionId);
        return;
      }

      handleAskAiForSection(sectionId);
    },
    [
      currentSections,
      cvTone,
      handleAskAiForSection,
      handleRunAskAiForSection,
      runPaperTextSectionAiReview,
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
        request.sectionType === "achievements" &&
        request.field === "achievement"
      ) {
        const baseSections =
          latestInlineSectionsRef.current.length > 0
            ? latestInlineSectionsRef.current
            : currentSections;
        const section = findSectionById(baseSections, request.sectionId);
        const item = section
          ? getStructuredItemById(section, request.itemId)
          : undefined;
        if (!section || !item) return;

        const beforeText = String(item.text ?? "").trim();
        if (!beforeText) {
          showToast("This achievement has no text for AI to improve.", {
            variant: "warning",
          });
          return;
        }

        const interactionId = createAiInteractionId();
        const key = `${interactionId}:${request.sectionId}:${request.itemId}:achievement`;
        const fieldPath = `structuredContent.item:${request.itemId}.text`;
        recordAiInteractionEvent({
          name: "ai_started",
          interactionId,
          surface: "section_editor",
          actionId: "custom",
        });
        setCvRailAiSuggestion(null);
        setCvRailAppliedAiEdit(null);
        const rowElement =
          typeof document !== "undefined"
            ? document.querySelector<HTMLElement>(
                `[data-paper-section-id="${request.sectionId.replace(/"/g, '\\"')}"][data-paper-field-path="${fieldPath.replace(/"/g, '\\"')}"]`,
              )
            : null;
        const rowRect = rowElement?.getBoundingClientRect();
        const stageRect = paperStageRef.current?.getBoundingClientRect();
        const anchor = rowRect
          ? {
              left: rowRect.left + window.scrollX + rowRect.width / 2,
              top: rowRect.top + window.scrollY,
              bottom: rowRect.bottom + window.scrollY,
              leftEdge: rowRect.left + window.scrollX,
              rightEdge: rowRect.right + window.scrollX,
              width: rowRect.width,
              height: rowRect.height,
              containerLeft: stageRect
                ? stageRect.left + window.scrollX
                : undefined,
              containerRight: stageRect
                ? stageRect.right + window.scrollX
                : undefined,
              containerTop: stageRect
                ? stageRect.top + window.scrollY
                : undefined,
              containerBottom: stageRect
                ? stageRect.bottom + window.scrollY
                : undefined,
            }
          : null;
        setCvAiReview({
          key,
          target: {
            sectionId: request.sectionId,
            sectionType: "achievements",
            sectionLabel: section.title || "Achievements",
            itemId: request.itemId,
            itemLabel: "Achievement",
            fieldPath,
            fieldKind: "paragraph",
            selectedText: beforeText,
          },
          anchor,
          beforeText,
          afterText: "",
          state: "loading",
          actionId: "improve_achievement_line",
          primaryActionLabel: "Replace achievement",
          previousSection: section,
          interactionId,
        });

        try {
          if (typeof runCvSectionAiAction !== "function") {
            throw new Error("CV AI action is unavailable.");
          }
          const result = await runCvSectionAiAction({
            action: "improve_achievement_line",
            existingText: beforeText,
          });
          const afterText = readAiResultText(result);
          if (!afterText.trim()) {
            recordAiInteractionEvent({
              name: "ai_failed",
              interactionId,
              surface: "section_editor",
              actionId: "custom",
              errorKind: "empty_result",
            });
            setCvAiReview((current) =>
              current?.key === key
                ? {
                    ...current,
                    state: "error",
                    errorMessage: "AI returned no usable achievement text.",
                  }
                : current,
            );
            return;
          }

          recordAiInteractionEvent({
            name: "ai_completed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            applyMode: "preview_required",
          });
          setCvAiReview((current) =>
            current?.key === key
              ? {
                  ...current,
                  afterText,
                  state: "ready",
                }
              : current,
          );
        } catch (error) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "section_editor",
            actionId: "custom",
            errorKind: "request_failed",
          });
          setCvAiReview((current) =>
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
        return;
      }

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
        actionId: "custom",
      });
      setCvRailAiSuggestion(null);
      setCvRailAppliedAiEdit(null);
      const itemLabel = String(
        item.position ?? item.role ?? item.title ?? item.company ?? "Experience entry",
      );
      const rowElement =
        typeof document !== "undefined"
          ? document.querySelector<HTMLElement>(
              `[data-preview-row-id="${request.itemId.replace(/"/g, '\\"')}"]`,
            )
          : null;
      const rowRect = rowElement?.getBoundingClientRect();
      const stageRect = paperStageRef.current?.getBoundingClientRect();
      const anchor = rowRect
        ? {
            left: rowRect.left + window.scrollX + rowRect.width / 2,
            top: rowRect.top + window.scrollY,
            bottom: rowRect.bottom + window.scrollY,
            leftEdge: rowRect.left + window.scrollX,
            rightEdge: rowRect.right + window.scrollX,
            width: rowRect.width,
            height: rowRect.height,
            containerLeft: stageRect
              ? stageRect.left + window.scrollX
              : undefined,
            containerRight: stageRect
              ? stageRect.right + window.scrollX
              : undefined,
            containerTop: stageRect ? stageRect.top + window.scrollY : undefined,
            containerBottom: stageRect
              ? stageRect.bottom + window.scrollY
              : undefined,
          }
        : null;
      setCvAiReview({
        key,
        target: {
          sectionId: request.sectionId,
          sectionType: "experience",
          sectionLabel: section.title || "Experience",
          itemId: request.itemId,
          itemLabel,
          fieldPath: `structuredContent.item:${request.itemId}.responsibilities`,
        },
        anchor,
        beforeText,
        afterText: "",
        state: "loading",
        actionId: "improve_experience_responsibilities",
        primaryActionLabel: "Replace responsibilities",
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
            actionId: "custom",
            errorKind:
              normalized.reason === "incomplete_output"
                ? "request_failed"
                : "empty_result",
          });
          setCvAiReview((current) =>
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
            actionId: "custom",
            errorKind: "empty_result",
          });
          setCvAiReview((current) =>
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
          actionId: "custom",
          applyMode: "preview_required",
        });
        setCvAiReview((current) =>
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
          actionId: "custom",
          errorKind: "request_failed",
        });
        setCvAiReview((current) =>
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

  const handleAcceptCvAiReview = React.useCallback(() => {
      const suggestion = cvAiReview;
      if (!suggestion || suggestion.state !== "ready") return;

      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const section = findSectionById(baseSections, suggestion.target.sectionId);
      if (!section) return;

      let nextSection: CvSection | null = null;
      if (
        suggestion.target.sectionType === "experience" &&
        suggestion.target.itemId &&
        suggestion.afterDoc
      ) {
        nextSection = updateStructuredItemResponsibilities(
          section,
          suggestion.target.itemId,
          suggestion.afterDoc,
          suggestion.responsibilityBullets,
        );
      } else if (
        suggestion.target.fieldPath &&
        typeof suggestion.target.selectedText === "string"
      ) {
        const target: ActivePaperEditTarget = {
          sectionId: suggestion.target.sectionId,
          sectionType: suggestion.target.sectionType,
          fieldPath: suggestion.target.fieldPath,
          fieldKind: suggestion.target.fieldKind ?? "paragraph",
        };
        if (
          !applyInlineExperienceResponsibilityAiResult({
            target,
            selectedText: suggestion.target.selectedText,
            resultText: suggestion.afterText,
            actionId: suggestion.actionId,
          })
        ) {
          nextSection = applyInlineAiTextToSectionField({
            section,
            target,
            selectedText: suggestion.target.selectedText,
            replacementText: suggestion.afterText,
          });
        }
      }

      if (!nextSection && suggestion.target.sectionType === "experience") {
        const latestSection = findSectionById(
          latestInlineSectionsRef.current,
          suggestion.target.sectionId,
        );
        nextSection = latestSection ?? null;
      }
      if (!nextSection) return;

      const nextSections = baseSections.map((currentSection, index) =>
        getCvSectionId(currentSection, index) === suggestion.target.sectionId
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
        actionId: "custom",
      });
      setCvAiReview({
        ...suggestion,
        state: "accepted",
        previousSection: section,
        previousSections: baseSections,
      });
      focusPreviewSection(suggestion.target.sectionId);
    },
    [
      applyInlineExperienceResponsibilityAiResult,
      currentSections,
      cvAiReview,
      persistSections,
    ],
  );

  const handleDiscardCvAiReview = React.useCallback(() => {
      setCvAiReview((current) => {
        if (!current) return current;
        recordAiInteractionEvent({
          name: "ai_discarded",
          interactionId: current.interactionId ?? createAiInteractionId(),
          surface: "section_editor",
          actionId: "custom",
        });
        return null;
      });
      setInlinePaperSelectionState(null);
    },
    [],
  );

  const handleUndoCvAiReview = React.useCallback(() => {
      const suggestion = cvAiReview;
      if (
        !suggestion ||
        (!suggestion.previousSection && !suggestion.previousSections)
      ) {
        return;
      }
      const baseSections =
        latestInlineSectionsRef.current.length > 0
          ? latestInlineSectionsRef.current
          : currentSections;
      const currentSection = findSectionById(
        baseSections,
        suggestion.target.sectionId,
      );
      let restoredSection: CvSection | null = null;

      if (
        currentSection &&
        suggestion.target.fieldPath &&
        suggestion.afterText
      ) {
        restoredSection = applyInlineAiTextToSectionField({
          section: currentSection,
          target: {
            sectionId: suggestion.target.sectionId,
            sectionType: suggestion.target.sectionType,
            fieldPath: suggestion.target.fieldPath,
            fieldKind: suggestion.target.fieldKind ?? "paragraph",
          },
          selectedText: suggestion.afterText,
          replacementText: suggestion.beforeText,
        });
      }

      const nextSections = restoredSection
        ? baseSections.map((section, index) =>
            getCvSectionId(section, index) === suggestion.target.sectionId
              ? restoredSection!
              : section,
          )
        : suggestion.previousSections ??
          baseSections.map((section, index) =>
            getCvSectionId(section, index) === suggestion.target.sectionId
              ? suggestion.previousSection!
              : section,
          );
      const nextActiveSection =
        findSectionById(nextSections, suggestion.target.sectionId) ??
        suggestion.previousSection ??
        null;
      latestInlineSectionsRef.current = nextSections;
      setPendingActiveSection(nextActiveSection);
      setResumeActiveTarget(
        nextActiveSection ? getSectionTarget(nextActiveSection) : null,
      );
      persistSections(nextSections);
      setCvAiReview(null);
      setInlinePaperSelectionState(null);
      focusPreviewSection(suggestion.target.sectionId);
    },
    [currentSections, cvAiReview, persistSections],
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
          actionId: inlineTarget.actionId as InlineAiActionId,
        })
      ) {
        recordAiInteractionEvent({
          name: "ai_accepted",
          interactionId:
            cvRailAiSuggestion.interactionId ?? createAiInteractionId(),
          surface: "section_editor",
          actionId: inlineTarget.actionId as InlineAiActionId,
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
        actionId: inlineTarget.actionId as InlineAiActionId,
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
    if (cvRailAiSuggestion && cvRailAiSuggestion.kind !== "list") {
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
        actionId:
          (cvRailAiSuggestion.inlineTarget?.actionId as InlineAiActionId | undefined) ??
          "custom",
      });
    }
    setCvRailAiSuggestion(null);
  }, [cvRailAiSuggestion]);

  const handleAcceptListAiSuggestion = React.useCallback(
    (value: string, options?: { persist?: boolean }) => {
      if (!cvRailAiSuggestion || cvRailAiSuggestion.kind !== "list") return;
      if (options?.persist !== false) {
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
      }
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

  const handleClearListAiSuggestions = React.useCallback(() => {
    setCvRailAiSuggestion((current) => {
      if (!current || current.kind !== "list") return current;
      return null;
    });
  }, []);

  const resumePaperAiState = React.useMemo<ResumePaperAiState | null>(() => {
    if (workspaceMode !== "edit") return null;
    const listSuggestion =
      cvRailAiSuggestion?.kind === "list"
        ? {
            sectionId: cvRailAiSuggestion.sectionId,
            sectionType:
              getCanonicalSectionType(
                findSectionById(currentSections, cvRailAiSuggestion.sectionId),
              ) ?? "skills",
            items: cvRailAiSuggestion.items,
            state: cvRailAiSuggestion.state,
            errorMessage: cvRailAiSuggestion.errorMessage,
          }
        : null;
    const listSuggestionSection = listSuggestion
      ? findSectionById(currentSections, listSuggestion.sectionId)
      : null;

    return {
      activeTarget: cvAiReview?.target
        ? {
            sectionId: cvAiReview.target.sectionId,
            sectionType: cvAiReview.target.sectionType,
            itemId: cvAiReview.target.itemId,
            fieldPath: cvAiReview.target.fieldPath,
          }
        : null,
      listSuggestion:
        listSuggestionSection &&
        sectionUsesStructuredSuggestions(listSuggestionSection)
          ? listSuggestion
          : null,
      onAcceptListSuggestion: handleAcceptListAiSuggestion,
      onClearListSuggestions: handleClearListAiSuggestions,
    };
  }, [
    currentSections,
    cvAiReview,
    cvRailAiSuggestion,
    handleAcceptListAiSuggestion,
    handleClearListAiSuggestions,
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

  const handleStartFreshEntryCv = React.useCallback(
    async (resumeTemplateId?: ResumeTemplateId | null) => {
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
    },
    [createNewCv, currentCvId, isEntryPickerBusy, showToast],
  );

  React.useEffect(() => {
    topbarImportCvRef.current = handleImportEntryCv;
    topbarNewCvRef.current = () => {
      void handleStartFreshEntryCv();
    };
  }, [handleImportEntryCv, handleStartFreshEntryCv]);

  React.useEffect(() => {
    const state =
      typeof location.state === "object" && location.state !== null
        ? (location.state as Record<string, unknown>)
        : null;
    const params = new URLSearchParams(location.search);
    const queryCvForgeAction = params.get("cvForgeAction");
    const cvForgeAction =
      state?.cvForgeAction === "createBlank" ||
      state?.cvForgeAction === "importCv"
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
            data-forge-drawer-docked={
              isForgeDrawerDockedDesktop ? "true" : undefined
            }
            data-forge-drawer-rail-collapsed={
              shouldAutoCollapseCvRailForDockedDrawer ? "true" : undefined
            }
            style={cvWorkbenchShellStyle}
          >
            <div
              ref={cvDocumentStageRef}
              className="dasti-cv-skeleton-forge__stage dasti-proposal-skeleton-stage"
              data-testid="cv-canvas"
              data-toolbar-mode={cvCommandToolbarMode}
              data-mode-control-mode={cvCommandModeControlMode}
              data-ask-mode={cvCommandAskMode}
              data-command-layer-sticky={
                cvCommandLayerSticky ? "true" : undefined
              }
              data-toolbar-density={getCommandLayerToolbarDensity(
                cvCommandToolbarMode,
              )}
              data-ask-placement={
                cvCommandAskMode === "edgeTab" ? "edge-tab" : "outside"
              }
              data-ask-density="icon"
            >
              <CvStageBar
                mode={workspaceMode}
                toolbarStyle={cvCommandLayerStyle}
                modeControlMode={cvCommandModeControlMode}
                commandLayerSticky={cvCommandLayerSticky}
                commandLayerMeasured={cvCommandLayerMeasured}
                templatesOpen={cvTemplatesOpen}
                sectionsOpen={sectionsPanelOpen}
                designOpen={cvDesignOpen}
                onModeChange={setWorkspaceMode}
                onOpenSections={handleOpenCvSections}
                onOpenDesign={handleOpenCvDesign}
                onOpenTemplates={handleOpenCvTemplates}
                askOpen={workspaceMode === "preview" && cvComposerOpen}
                onOpenAsk={
                  workspaceMode === "preview" ? handleOpenCvAsk : undefined
                }
              />
              {isImportReviewBannerVisible ? (
                <CvReviewBanner
                  issueCount={activeImportRecoveryItems.length}
                  summary={importReviewSummary}
                  onOpenReview={handleOpenImportReview}
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
                    data={resumePreviewData!}
                    stylePreset={stylePreset}
                    hostMode="panel"
                    scrollMode="natural"
                    activeTarget={resumeActiveTarget}
                    onLinkIntent={handleResumeLinkIntent}
                    inlineEditing={resumeInlineEditing}
                    sectionActions={resumeSectionActions}
                    paperAi={resumePaperAiState}
                    documentIconSettings={documentIconSettings}
                    documentIconOverrides={documentIconOverrides}
                    onDocumentListItemIconChange={handleDocumentListItemIconChange}
                    documentDecoration={cvDocumentDecoration}
                    documentDecorationDesignMode={cvDesignOpen}
                    onDocumentDecorationChange={handleCvDocumentDecorationPreviewChange}
                    onDocumentDecorationCommit={handleCvDocumentDecorationPreviewCommit}
                    onDocumentDecorationFileUpload={handleCvDesignImageUpload}
                    showStageZoomFooter={Boolean(currentCv)}
                    showPageCount={
                      workspaceMode === "preview" && Boolean(currentCv)
                    }
                    pageSize={resolvedDocumentPageSize}
                    onPageCountChange={handleCvPreviewPageCountChange}
                  />
                  {inlinePaperSelectionState && !cvAiReview ? (
                    <FloatingAiToolbar
                      open
                      anchor={inlinePaperSelectionState.anchor}
                      isLoading={isApplyingInlinePaperAi}
                      pendingActionId={pendingInlinePaperAiActionId}
                      onClose={() => setInlinePaperSelectionState(null)}
                      onRunAction={handleRunInlinePaperAiAction}
                      onSurfacePlacementChange={setCvAiSurfacePosition}
                    />
                  ) : null}
                  {cvAiReview ? (
                    <CvAiReviewOverlay
                      open
                      target={cvAiReview.target}
                      state={cvAiReview.state}
                      beforeText={cvAiReview.beforeText}
                      afterText={cvAiReview.afterText}
                      errorMessage={cvAiReview.errorMessage}
                      actionId={cvAiReview.actionId}
                      interactionId={cvAiReview.interactionId}
                      anchor={cvAiReview.anchor}
                      preferredPlacement={cvAiSurfacePosition?.placement}
                      preferredSurfacePosition={cvAiSurfacePosition}
                      primaryActionLabel={cvAiReview.primaryActionLabel}
                      onAccept={handleAcceptCvAiReview}
                      onDiscard={handleDiscardCvAiReview}
                      onUndo={
                        cvAiReview.state === "accepted"
                          ? handleUndoCvAiReview
                          : undefined
                      }
                      onCopy={
                        cvAiReview.state === "ready"
                          ? () => {
                              void navigator.clipboard?.writeText(
                                cvAiReview.afterText,
                              );
                            }
                          : undefined
                      }
                    />
                  ) : null}
                </div>
              )}
            </div>
            {cvComposerOpen && !sectionEditorOpen ? (
              <ComposerDrawer
                open
                onOpenChange={setCvComposerOpen}
                title="Ask"
                titleHidden
                description="Improve the selected CV section."
                ariaLabel="Ask"
                className="dasti-composer-drawer--stage dasti-composer-drawer--cv"
              >
                <CvRail
                  sections={currentSections}
                  activeSectionId={activeSectionId}
                  activeTab={cvRailTab}
                  selectedTone={cvTone}
                  aiSuggestion={cvRailAiSuggestion}
                  appliedAiEdit={cvRailAppliedAiEdit}
                  askSelectionContext={cvAskSelectionContext}
                  isImporting={isImportingEntryCv}
                  onActiveTabChange={setCvRailTab}
                  onSelectSection={handleSelectSection}
                  onRunAskAiForSection={handleRunAskAiForSection}
                  onRunAskAiForSelection={handleRunCvAskForSelection}
                  onAcceptAiSuggestion={handleAcceptAiSuggestion}
                  onDiscardAiSuggestion={handleDiscardAiSuggestion}
                  onUndoAiSuggestion={handleUndoAiSuggestion}
                  onAcceptListAiSuggestion={handleAcceptListAiSuggestion}
                  onDismissListAiSuggestion={handleDismissListAiSuggestion}
                  hideTabs
                />
              </ComposerDrawer>
            ) : null}
          </div>
          <SectionEditorSheet
            open={sectionEditorOpen}
            section={activeSection}
            aiSuggestion={cvRailAiSuggestion}
            isAiRunning={cvRailAiSuggestion?.state === "loading"}
            stageAligned={workspaceMode === "preview"}
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
            onClearListAiSuggestions={handleClearListAiSuggestions}
          />
          <Sheet
            open={importReviewOpen}
            onOpenChange={handleImportReviewOpenChange}
            title="CV import review"
            description="Review uncertain imported blocks, route them to sections, or assign fragments before saving."
            className="dasti-cv-import-recovery-sheet"
            bodyClassName="dasti-cv-import-recovery-sheet__body"
          >
            {cvImportRecoveryDraft ? (
              <ImportRecoveryPanel
                recoveryCycleKey={cvImportRecoveryDraft.cycleId}
                items={cvImportRecoveryDraft.items}
                overflowCount={cvImportRecoveryDraft.overflowCount}
                reviewLimit={cvImportRecoveryDraft.reviewLimit}
                onAccept={handleAcceptRecoveryItem}
                onIgnore={(blockId) =>
                  updateCvRecoveryItem(blockId, { reviewStatus: "ignored" })
                }
                onUpdateRemainingTarget={handleUpdateRecoveryRemainingTarget}
                onAssignFragment={handleAssignRecoveryFragment}
                onRemoveFragment={handleRemoveRecoveryFragment}
                onImportAsIs={handleImportRecoveryAsIs}
                onCancel={() => handleImportReviewOpenChange(false)}
                onDiscardRecovery={handleDiscardImportRecovery}
                onApply={handleApplyReviewedRecoveryImport}
                outcomeSummary={cvRecoveryOutcomeSummary}
              />
            ) : (
              <div className="dasti-cv-import-review__empty">
                No import recovery items need review.
              </div>
            )}
          </Sheet>
          <CvAtsAuditPanel
            open={atsAuditOpen}
            audit={atsAudit}
            onOpenChange={setAtsAuditOpen}
            onOpenImportReview={handleOpenImportReview}
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
