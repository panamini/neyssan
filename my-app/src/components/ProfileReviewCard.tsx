import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Check,
  ChevronDown,
  FileText,
  GripHorizontal,
  SealWarning,
  X,
} from "@/lib/icons";
import { useNavigate } from "react-router-dom";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import SectionComponent from "./cv-editor/Section";
import SelectedBlockInspector from "./SelectedBlockInspector";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { generateCvTemplate, generateCvTemplateV1 } from "../lib/cv-template";
import { isCvEditorDebugUiEnabled, isV1SectionsEnabled } from "../lib/flags";
import StructuredUploadButton, {
  type StructuredPayload,
} from "./StructuredUploadButton";
import ImportWarningBanner from "./ImportWarningBanner";
import CvRenameDialog from "./CvRenameDialog";
import ImportRecoveryPanel from "./ImportRecoveryPanel";
import ResumeExportControl from "./ResumeExportControl";
import type { ResumeExportFormat } from "../lib/cv-export";
import type {
  CvDocument,
  CvSection,
  IAffiliationItem,
  ICertificationItem,
  ISkillItem,
} from "../types/cvDocument";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";
import {
  applyImportRecoveryItems,
  buildRecoveryCommitState,
  collectRecoveryDestinationSectionIds,
  formatRecoveryCommitToast,
  normalizeRecoverySectionTarget,
  summarizeRecoveryCommitState,
  type RecoveryCommitSummary,
} from "../lib/import-recovery";
import {
  inspectCvImportSignals,
  type CvImportSignal,
} from "../lib/cv-import-signals";
import {
  buildAuthoritativeResumeDebugSnapshot,
  coerceAuthoritativeResume,
  hasTrustedAuthoritativeMistralImport,
  type AuthoritativeResume,
} from "../lib/authoritative-resume";
import dbg from "../lib/cv-debug";
import type {
  ImportRecoveryItem,
  ImportRecoverySession,
  ImportRecoverySectionType,
} from "../types/importRecovery";
import { makeTextSection } from "../lib/cv-template";

/**
 * Props for ProfileReviewCard
 */
interface Props {
  cvId?: string;
  profile?: unknown;
  onRequestExport?: (format: ResumeExportFormat) => void;
  exportStatusDescription?: string;
  exportStatusLabel?: string;
  exportStatusTone?: "standard" | "trusted";
  toolbarLeadControl?: React.ReactNode;
  toolbarPrimaryControl?: React.ReactNode;
}

type ManualSectionOption = {
  value: string;
  label: string;
  description?: string;
  sectionType: string;
  sectionTitle?: string;
  isCustom?: boolean;
};

type ImportRuntimeDebugSnapshot = {
  ocrEngine: string | null;
  mistralRuntime: string | null;
  mistralFallback: boolean | null;
  ocrRequestPath: string | null;
  authoritativeTrusted: boolean | null;
  normalizedPresent: boolean;
  importModeLabel: string;
  importModeTone: "trusted" | "warning";
};

const IMPORT_WARNING_SESSION_KEY_PREFIX = "dasti:cv-import-warning-banner:";
const IMPORT_REVIEW_SESSION_KEY_PREFIX = "dasti:cv-import-review:";
const IMPORT_RENAME_PROMPT_SESSION_KEY_PREFIX = "dasti:cv-import-rename:";
const IMPORT_RECOVERY_DRAFT_SESSION_KEY_PREFIX = "dasti:cv-import-recovery-draft:";
const IMPORT_WARNING_AUTO_HIDE_DELAY_MS = 5000;
const IMPORT_WARNING_EXIT_DURATION_MS = 180;
const RECOVERY_RESUME_BANNER_AUTO_HIDE_DELAY_MS = 5000;

function shouldPromptForImportedTitleRename(
  cv: CvDocument | null | undefined,
  signals: CvImportSignal[],
): boolean {
  if (!cv) {
    return false;
  }

  return signals.some((signal) => signal.id === "document-title-generic");
}

function getFlaggedSectionTypes(signals: CvImportSignal[]): Set<string> {
  const sectionTypes = new Set<string>();

  signals.forEach((signal) => {
    if (
      signal.id === "profile-name-noise" ||
      signal.id === "document-template-skeleton"
    ) {
      sectionTypes.add("profile");
    }

    if (
      signal.id === "summary-repeated" ||
      signal.id === "summary-noisy" ||
      signal.id === "content-placeholder-copy" ||
      signal.id === "content-all-caps" ||
      signal.id === "document-template-skeleton"
    ) {
      sectionTypes.add("summary");
    }

    if (
      signal.id.startsWith("experience-") ||
      signal.id === "document-title-role-duplicate" ||
      signal.id === "document-template-skeleton"
    ) {
      sectionTypes.add("experience");
    }
  });

  return sectionTypes;
}

type RecoveryImportTarget = "fresh" | "existing";

type PendingRecoveryImport = {
  cycleId: string;
  target: RecoveryImportTarget;
  baseSections: CvSection[];
  fullSections: CvSection[];
  authoritativeResume?: AuthoritativeResume | null;
  items: ImportRecoveryItem[];
  overflowCount: number;
  reviewLimit: number;
};

function getRecoveryDecisionStatus(
  item: ImportRecoveryItem,
  targetSection: ImportRecoverySectionType,
  targetSectionTitle?: string | null,
): ImportRecoveryItem["reviewStatus"] {
  const normalizedPredicted = normalizeRecoverySectionTarget(item.predictedSection);
  const normalizedSelected = normalizeRecoverySectionTarget(targetSection);
  const normalizedTitle =
    normalizedSelected === "custom" ? targetSectionTitle?.trim() ?? "" : "";

  return normalizedSelected === normalizedPredicted && normalizedTitle.length === 0
    ? "accepted"
    : "reassigned";
}

function buildPendingRecoverySessionItem(item: ImportRecoveryItem): ImportRecoveryItem {
  const sessionText =
    item.displayTextSource === "raw" && item.rawText.trim()
      ? item.rawText
      : item.cleanedText || item.rawText;

  return {
    blockId: item.blockId,
    rawText: item.displayTextSource === "raw" ? sessionText : "",
    cleanedText: item.displayTextSource === "cleaned" ? sessionText : "",
    displayTextSource: item.displayTextSource,
    predictedSection: item.predictedSection,
    confidenceScore: item.confidenceScore,
    confidenceValue: item.confidenceValue,
    issueFlags: item.issueFlags,
    reviewStatus: "pending",
    ...(item.sourceSectionTitle?.trim()
      ? { sourceSectionTitle: item.sourceSectionTitle.trim() }
      : {}),
    ...(item.sourceFieldKey?.trim()
      ? { sourceFieldKey: item.sourceFieldKey.trim() }
      : {}),
    ...(item.sourceLabel?.trim() ? { sourceLabel: item.sourceLabel.trim() } : {}),
    fragmentAssignments: [],
  };
}

function createImportRecoverySession(items: ImportRecoveryItem[], reviewLimit: number): ImportRecoverySession {
  return {
    status: items.length > 0 ? "pending" : "completed",
    updatedAt: new Date().toISOString(),
    items: items.map(buildPendingRecoverySessionItem),
    overflowCount: Math.max(items.length - reviewLimit, 0),
    reviewLimit,
  };
}

function createCompletedImportRecoverySession(
  items: ImportRecoveryItem[],
  reviewLimit: number,
  baseSectionsSnapshot?: CvSection[],
): ImportRecoverySession {
  return {
    status: "completed",
    updatedAt: new Date().toISOString(),
    items: items.map((item) => normalizeRecoveryItemTargets(item)),
    overflowCount: Math.max(items.length - reviewLimit, 0),
    reviewLimit,
    ...(Array.isArray(baseSectionsSnapshot)
      ? { baseSectionsSnapshot }
      : {}),
  };
}

function normalizeRecoveryItemTargets(item: ImportRecoveryItem): ImportRecoveryItem {
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

function buildTouchedSectionRevealState(sections: CvSection[], touchedSectionIds: string[]) {
  const revealedIds = new Set(touchedSectionIds.map(String));
  return sections.map((section) =>
    revealedIds.has(String(section.id ?? ""))
      ? { ...section, collapsed: false }
      : section,
  );
}

function coerceDebugPayloadText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readStructuredAuthoritativeResume(
  payload: StructuredPayload | null | undefined,
): AuthoritativeResume | null {
  return coerceAuthoritativeResume(payload?.authoritativeResume ?? null);
}

function mergeImportedAuthoritativeResume(
  metadata: CvDocument["metadata"],
  payload: StructuredPayload | null | undefined,
): CvDocument["metadata"] {
  const nextMetadata = { ...(metadata ?? {}) } as CvDocument["metadata"];
  if (payload === undefined) {
    return nextMetadata;
  }
  const authoritativeResume = readStructuredAuthoritativeResume(payload);
  if (authoritativeResume) {
    nextMetadata.authoritativeResume = authoritativeResume;
  } else {
    delete (nextMetadata as { authoritativeResume?: unknown }).authoritativeResume;
  }
  return nextMetadata;
}

function mergeExplicitAuthoritativeResume(
  metadata: CvDocument["metadata"],
  authoritativeResume: AuthoritativeResume | null | undefined,
): CvDocument["metadata"] {
  const nextMetadata = { ...(metadata ?? {}) } as CvDocument["metadata"];
  if (authoritativeResume === undefined) {
    return nextMetadata;
  }
  if (authoritativeResume) {
    nextMetadata.authoritativeResume = authoritativeResume;
  } else {
    delete (nextMetadata as { authoritativeResume?: unknown }).authoritativeResume;
  }
  return nextMetadata;
}

function buildImportRuntimeDebugSnapshot(
  payload: StructuredPayload | null | undefined,
): ImportRuntimeDebugSnapshot | null {
  if (!payload) {
    return null;
  }

  const diagnostics =
    payload.diagnostics && typeof payload.diagnostics === "object"
      ? (payload.diagnostics as Record<string, unknown>)
      : null;
  const authoritativeResume = readStructuredAuthoritativeResume(payload);
  const ocrEngine =
    typeof diagnostics?.ocr_engine === "string"
      ? diagnostics.ocr_engine
      : null;
  const mistralRuntime =
    typeof diagnostics?.mistral_runtime === "string"
      ? diagnostics.mistral_runtime
      : null;
  const mistralFallback =
    typeof diagnostics?.mistral_fallback === "boolean"
      ? diagnostics.mistral_fallback
      : null;
  const ocrRequestPath =
    typeof diagnostics?.ocr_request_path === "string"
      ? diagnostics.ocr_request_path
      : null;
  const normalizedPresent = Boolean(
    payload.normalized && typeof payload.normalized === "object",
  );
  const hasOcrRuntimeEvidence = Boolean(
    ocrEngine ||
      mistralRuntime ||
      mistralFallback !== null ||
      ocrRequestPath ||
      authoritativeResume,
  );
  const isTrustedAuthoritativeImport = hasTrustedAuthoritativeMistralImport({
    authoritativeResume,
    mistralFallback,
    mistralRuntime,
  });

  const importModeLabel = hasOcrRuntimeEvidence
    ? isTrustedAuthoritativeImport
      ? "Trusted Mistral import"
      : "OCR import rejected (fallback/untrusted)"
    : normalizedPresent
      ? "Structured import"
      : "No normalized import payload";

  return {
    ocrEngine,
    mistralRuntime,
    mistralFallback,
    ocrRequestPath,
    authoritativeTrusted: authoritativeResume?.trusted ?? null,
    normalizedPresent,
    importModeLabel,
    importModeTone: isTrustedAuthoritativeImport ? "trusted" : "warning",
  };
}

function ImportRuntimeDebugControls(props: {
  copyFeedback: null | "normalized" | "parser" | "rawText";
  onCopyPayload: (kind: "normalized" | "parser" | "rawText") => void;
  payload: StructuredPayload;
  rawTextForCopy: string | null;
  runtimeDebug: ImportRuntimeDebugSnapshot | null;
}): JSX.Element {
  const {
    copyFeedback,
    onCopyPayload,
    payload,
    rawTextForCopy,
    runtimeDebug,
  } = props;

  return (
    <>
      {runtimeDebug ? (
        <div
          role="status"
          aria-label="Import runtime debug"
          style={{
            display: "grid",
            gap: "0.35rem",
            padding: "0.65rem 0.85rem",
            borderRadius: "14px",
            border: "1px solid var(--color-border)",
            background: "var(--sfr)",
            minWidth: "min(100%, 24rem)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span
              className={
                runtimeDebug.importModeTone === "trusted"
                  ? "dasti-pill dasti-pill--success"
                  : "dasti-pill"
              }
            >
              {runtimeDebug.importModeLabel}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--tm)",
              }}
            >
              Latest parse runtime
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.2rem",
              fontSize: "0.8rem",
              color: "var(--ti)",
            }}
          >
            <div>
              <strong>ocr_engine:</strong>{" "}
              <code>{runtimeDebug.ocrEngine ?? "null"}</code>
            </div>
            <div>
              <strong>mistral_runtime:</strong>{" "}
              <code>{runtimeDebug.mistralRuntime ?? "null"}</code>
            </div>
            <div>
              <strong>mistral_fallback:</strong>{" "}
              <code>
                {runtimeDebug.mistralFallback == null
                  ? "null"
                  : String(runtimeDebug.mistralFallback)}
              </code>
            </div>
            <div>
              <strong>ocr_request_path:</strong>{" "}
              <code>{runtimeDebug.ocrRequestPath ?? "null"}</code>
            </div>
            <div>
              <strong>authoritativeResume.trusted:</strong>{" "}
              <code>
                {runtimeDebug.authoritativeTrusted == null
                  ? "null"
                  : String(runtimeDebug.authoritativeTrusted)}
              </code>
            </div>
            <div>
              <strong>import payload:</strong>{" "}
              <code>{runtimeDebug.importModeLabel}</code>
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void onCopyPayload("normalized")}
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Copy normalized JSON"
      >
        <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
        {copyFeedback === "normalized"
          ? "Copied normalized JSON"
          : "Copy normalized JSON"}
      </button>
      <button
        type="button"
        onClick={() => void onCopyPayload("parser")}
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Copy raw parser JSON"
        disabled={!payload?.debug?.rawParser}
      >
        <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
        {copyFeedback === "parser"
          ? "Copied raw parser JSON"
          : "Copy raw parser JSON"}
      </button>
      <button
        type="button"
        onClick={() => void onCopyPayload("rawText")}
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Copy raw text"
        disabled={!rawTextForCopy}
      >
        <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
        {copyFeedback === "rawText" ? "Copied raw text" : "Copy raw text"}
      </button>
    </>
  );
}

/**
 * ProfileReviewCard
 *
 * - Uses the modern CvLibraryContext (currentCv, loadCv, isLoading, isDirty)
 * - Calls loadCv(cvId) on mount / when cvId changes
 * - Renders the mounted typed-editor section workflow for each section
 * - Exposes typed section creation controls for the mounted /cv user workflow
 */
export function ProfileReviewCard({
  cvId,
  profile,
  onRequestExport,
  exportStatusDescription = "Not ATS-verified",
  exportStatusLabel = "Standard Export",
  exportStatusTone = "standard",
  toolbarLeadControl,
  toolbarPrimaryControl,
}: Props) {
  const navigate = useNavigate();
  const {
    currentCv,
    currentCvId,
    loadCv,
    isLoading,
    reorderSections,
    addSection,
    createNewCv,
    importCv,
    renameCv,
    closeInspector,
    isV1Active,
  } = useCvLibrary();

  // Use document-driven runtime detector primarily; fall back to env flag
  const v1Enabled = isV1Active || isV1SectionsEnabled();
  const requestedCvIdRef = useRef<string | null>(null);
  const addSectionMenuRef = useRef<HTMLDivElement | null>(null);
  const manageSectionsMenuRef = useRef<HTMLDivElement | null>(null);
  const inlineReviewRef = useRef<HTMLElement | null>(null);
  const recoveryPanelRef = useRef<HTMLDivElement | null>(null);
  const previousRecoveryOpenRef = useRef<boolean | null>(null);
  const previousCvIdRef = useRef<string | null>(null);
  const sectionRevealRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!cvId) {
      requestedCvIdRef.current = null;
      return;
    }

    const targetId = String(cvId);
    if (currentCvId === targetId) {
      requestedCvIdRef.current = targetId;
      return;
    }
    if (requestedCvIdRef.current === targetId) return;

    requestedCvIdRef.current = targetId;
    try {
      const immediate = loadCv(targetId);
      if (!immediate) {
        // Background refresh will update state when ready
      }
    } catch (err) {
      requestedCvIdRef.current = null;
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] loadCv failed for id", cvId, err);
    }
  }, [currentCvId, cvId, loadCv]);

  const sections: CvSection[] = (currentCv?.sections ?? []) as CvSection[];
  const hasMeaningfulAchievementsSection = useMemo(() => {
    function extractLooseText(value: unknown): string {
      const parts: string[] = [];
      const seen = new Set<unknown>();
      function walk(node: unknown) {
        if (node == null || seen.has(node)) return;
        if (typeof node === "object") seen.add(node);
        if (typeof node === "string") {
          const trimmed = node.trim();
          if (trimmed) parts.push(trimmed);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (typeof node === "object") {
          const record = node as Record<string, unknown>;
          if (typeof record.text === "string") walk(record.text);
          if (typeof record.achievement === "string") walk(record.achievement);
          if (typeof record.plainText === "string") walk(record.plainText);
          if ("content" in record) walk(record.content);
          if ("items" in record) walk(record.items);
        }
      }
      walk(value);
      return parts.join(" ").trim();
    }

    return sections.some((section) => {
      if (String(section.type ?? "") !== "achievements") return false;
      const structuredText = extractLooseText(
        (section as any).structuredContent,
      );
      if (structuredText) return true;
      const blockText = extractLooseText((section as any).blocks);
      return Boolean(blockText);
    });
  }, [sections]);
  const sectionCatalog = useMemo<ManualSectionOption[]>(() => {
    const typedOptions: ManualSectionOption[] = v1Enabled
      ? [
          { value: "achievements", label: "Achievements", sectionType: "achievements" },
          { value: "languages", label: "Languages", sectionType: "languages" },
          { value: "projects", label: "Projects", sectionType: "projects" },
          { value: "certifications", label: "Certifications", sectionType: "certifications" },
        ]
      : [
          { value: "summary", label: "Summary", sectionType: "summary" },
          { value: "experience", label: "Experience", sectionType: "experience" },
          { value: "achievements", label: "Achievements", sectionType: "achievements" },
          { value: "education", label: "Education", sectionType: "education" },
          { value: "skills", label: "Skills", sectionType: "skills" },
          { value: "languages", label: "Languages", sectionType: "languages" },
          { value: "projects", label: "Projects", sectionType: "projects" },
          { value: "certifications", label: "Certifications", sectionType: "certifications" },
        ];

    return [
      ...typedOptions,
      {
        value: "additional_information",
        label: "Additional Information",
        description: "Extra details and references",
        sectionType: "text",
        sectionTitle: "Additional Information",
      },
      {
        value: "affiliations",
        label: "Affiliations",
        description: "Memberships and associations",
        sectionType: "text",
        sectionTitle: "Affiliations",
      },
      {
        value: "hobbies",
        label: "Hobbies",
        description: "Interests and personal activities",
        sectionType: "text",
        sectionTitle: "Hobbies",
      },
      {
        value: "custom",
        label: "Add your own",
        description: "Create a custom titled section",
        sectionType: "text",
        isCustom: true,
      },
    ];
  }, [v1Enabled]);
  const addableSectionOptions = useMemo(() => {
    const existingTypes = new Set(sections.map((section) => String(section.type ?? "")));
    const existingTextTitles = new Set(
      sections
        .filter((section) => String(section.type ?? "") === "text")
        .map((section) => String(section.title ?? "").trim().toLowerCase()),
    );
    return sectionCatalog.filter((option) => {
      if (option.value === "achievements") {
        return !hasMeaningfulAchievementsSection;
      }
      if (option.isCustom) {
        return true;
      }
      if (option.sectionType === "text") {
        return !existingTextTitles.has(String(option.sectionTitle ?? "").trim().toLowerCase());
      }
      return !existingTypes.has(option.sectionType);
    });
  }, [sectionCatalog, sections]);
  const removableAddedSections = useMemo(() => {
    return sections.flatMap((section) => {
      const sectionType = String(section.type ?? "");
      if (sectionType === "text") {
        const title = String(section.title ?? "").trim();
        const matchingOption = sectionCatalog.find(
          (option) => option.sectionType === "text" && option.sectionTitle === title,
        );
        if (matchingOption) {
          return [{ id: String(section.id), label: matchingOption.label, sectionId: String(section.id) }];
        }
        return [
          {
            id: String(section.id),
            label: title || "Custom section",
            sectionId: String(section.id),
          },
        ];
      }

      const matchingOption = sectionCatalog.find(
        (option) => option.sectionType === sectionType,
      );
      if (!matchingOption) return [];
      return [{ id: String(section.id), label: matchingOption.label, sectionId: String(section.id) }];
    });
  }, [sectionCatalog, sections]);
  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true
    ) {
      try {
        // eslint-disable-next-line no-console
        console.debug(
          "[ProfileReviewCard] sections snapshot",
          sections.map((section) => ({
            type: section.type,
            blocks: section.blocks?.length ?? 0,
            items: Array.isArray((section as any)?.structuredContent)
              ? (section as any).structuredContent.length
              : null,
          })),
        );
      } catch {
        /* noop */
      }
    }
  }, [sections]);
  const sensors = useSensors(useSensor(PointerSensor));
  const DEBUG_CV_EDITOR =
    isCvEditorDebugUiEnabled() ||
    (typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true);
  // TEMPORARILY DISABLE DnD GLOBALLY to stabilize inspector flow. Re-enable after DnD refactor.
  const DISABLE_DND_FOR_DEBUG = true;

  const [recentlyAddedSectionType, setRecentlyAddedSectionType] =
    useState<string>("");
  const [isAddSectionMenuOpen, setIsAddSectionMenuOpen] =
    useState<boolean>(false);
  const [isManageSectionsMenuOpen, setIsManageSectionsMenuOpen] =
    useState<boolean>(false);
  const [isImportWarningDismissed, setIsImportWarningDismissed] =
    useState<boolean>(false);
  const [isImportWarningAutoHidden, setIsImportWarningAutoHidden] =
    useState<boolean>(false);
  const [latestStructuredPayload, setLatestStructuredPayload] =
    useState<StructuredPayload | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<
    null | "normalized" | "parser" | "rawText"
  >(null);
  const [isImportWarningExiting, setIsImportWarningExiting] =
    useState<boolean>(false);
  const [isRecoveryResumeBannerHidden, setIsRecoveryResumeBannerHidden] =
    useState<boolean>(false);
  const [isImportReviewAcknowledged, setIsImportReviewAcknowledged] =
    useState<boolean>(false);
  const [isImportReviewCollapsed, setIsImportReviewCollapsed] =
    useState<boolean>(true);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState<boolean>(false);
  const [renameDraftTitle, setRenameDraftTitle] = useState<string>("");
  const [renameTargetCvId, setRenameTargetCvId] = useState<string | null>(null);
  const [reviewFlashToken, setReviewFlashToken] = useState(0);
  const [pendingRecoveryImport, setPendingRecoveryImport] =
    useState<PendingRecoveryImport | null>(null);
  const [savedRecoveryDraft, setSavedRecoveryDraft] =
    useState<PendingRecoveryImport | null>(null);
  const [pendingTouchedRecoverySectionIds, setPendingTouchedRecoverySectionIds] =
    useState<string[]>([]);
  const [revealedRecoverySectionIds, setRevealedRecoverySectionIds] =
    useState<string[]>([]);
  const recoveryItemsToReview = useMemo(
    () => pendingRecoveryImport?.items ?? [],
    [pendingRecoveryImport],
  );
  const remainingRecoveryItemCount = Math.max(
    pendingRecoveryImport?.overflowCount ?? 0,
    0,
  );
  const importSignals = useMemo(
    () => inspectCvImportSignals(currentCv),
    [currentCv],
  );
  const importSignalSignature = useMemo(
    () => importSignals.map((signal) => signal.id).sort().join("|"),
    [importSignals],
  );
  const importWarningSessionKey = currentCv?.id
    ? `${IMPORT_WARNING_SESSION_KEY_PREFIX}${currentCv.id}`
    : null;
  const importRecoveryDraftSessionKey = currentCv?.id
    ? `${IMPORT_RECOVERY_DRAFT_SESSION_KEY_PREFIX}${currentCv.id}`
    : `${IMPORT_RECOVERY_DRAFT_SESSION_KEY_PREFIX}fresh`;
  const importReviewSessionKey = currentCv?.id
    ? `${IMPORT_REVIEW_SESSION_KEY_PREFIX}${currentCv.id}`
    : null;
  const importRenamePromptSessionKey = currentCv?.id
    ? `${IMPORT_RENAME_PROMPT_SESSION_KEY_PREFIX}${currentCv.id}`
    : null;
  const flaggedSectionTypes = useMemo(
    () => getFlaggedSectionTypes(importSignals),
    [importSignals],
  );
  const persistedMetadataRecoverySession = useMemo(() => {
    const candidate = (currentCv?.metadata as { importRecoverySession?: unknown } | undefined)
      ?.importRecoverySession;
    if (!candidate || typeof candidate !== "object") return null;
    const session = candidate as ImportRecoverySession;
    if (!Array.isArray(session.items) || session.items.length === 0) return null;
    return session;
  }, [currentCv]);
  const resumableRecoveryItemCount =
    persistedMetadataRecoverySession?.items.length ?? savedRecoveryDraft?.items.length ?? 0;
  const recoveryResumeBannerSignature = !pendingRecoveryImport && resumableRecoveryItemCount > 0
    ? [
        currentCv?.id ?? "fresh",
        savedRecoveryDraft?.cycleId ?? "",
        savedRecoveryDraft?.items.length ?? 0,
        persistedMetadataRecoverySession?.updatedAt ?? "",
        persistedMetadataRecoverySession?.status ?? "",
        resumableRecoveryItemCount,
      ].join("|")
    : "";
  const hasCompletedRecoverySession =
    persistedMetadataRecoverySession?.status === "completed" && !pendingRecoveryImport;
  const hasPendingRecoveryEntryPoint =
    Boolean(pendingRecoveryImport) ||
    Boolean(savedRecoveryDraft) ||
    Boolean(persistedMetadataRecoverySession);
  const hasImportReviewEntryPoint =
    importSignals.length > 0 ||
    hasPendingRecoveryEntryPoint;
  const reviewChecksLabel = isImportReviewAcknowledged
    ? "Review flagged fields again"
    : "Review flagged fields";
  const recoveryEntryLabel = pendingRecoveryImport
    ? "Close recovery workspace"
    : hasCompletedRecoverySession
      ? "Reopen recovery workspace"
      : "Resume recovery review";
  const toolbarImportEntryLabel = hasPendingRecoveryEntryPoint
    ? recoveryEntryLabel
    : "Review import changes";
  const rawTextForCopy =
    coerceDebugPayloadText((latestStructuredPayload as any)?.rawText) ??
    coerceDebugPayloadText((latestStructuredPayload?.normalized as any)?.rawText) ??
    coerceDebugPayloadText((latestStructuredPayload?.debug as any)?.rawParser?.rawText) ??
    coerceDebugPayloadText((latestStructuredPayload?.debug as any)?.rawParser?.normalized?.rawText);
  const latestImportRuntimeDebug = useMemo(
    () => buildImportRuntimeDebugSnapshot(latestStructuredPayload),
    [latestStructuredPayload],
  );
  const recoveryOutcomeSummary = useMemo<RecoveryCommitSummary | null>(() => {
    if (!pendingRecoveryImport) return null;
    return summarizeRecoveryCommitState(
      pendingRecoveryImport.items.map(normalizeRecoveryItemTargets),
    );
  }, [pendingRecoveryImport]);

  const copyStructuredPayload = React.useCallback(
    async (kind: "normalized" | "parser" | "rawText") => {
      const value =
        kind === "normalized"
          ? latestStructuredPayload?.normalized
          : kind === "parser"
            ? latestStructuredPayload?.debug?.rawParser
            : rawTextForCopy;
      if (value == null) {
        return;
      }
      const text =
        kind === "rawText" ? String(value) : JSON.stringify(value, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(kind);
      } catch (err) {
        console.error("[ProfileReviewCard] copy failed", err);
      }
    },
    [latestStructuredPayload, rawTextForCopy],
  );

  useEffect(() => {
    if (!importWarningSessionKey || typeof window === "undefined") {
      setIsImportWarningDismissed(false);
      return;
    }

    setIsImportWarningDismissed(
      window.sessionStorage.getItem(importWarningSessionKey) ===
        importSignalSignature,
    );
  }, [importSignalSignature, importWarningSessionKey]);

  useEffect(() => {
    setIsImportWarningAutoHidden(false);
    setIsImportWarningExiting(false);
  }, [currentCv?.id, importSignalSignature]);

  useEffect(() => {
    const nextCvId = currentCv?.id ? String(currentCv.id) : null;
    const previousCvId = previousCvIdRef.current;
    if (previousCvId !== null && previousCvId !== nextCvId) {
      resetRecoveryUiState({
        storageKey: `${IMPORT_RECOVERY_DRAFT_SESSION_KEY_PREFIX}${previousCvId}`,
      });
    }
    previousCvIdRef.current = nextCvId;
    setCopyFeedback(null);
  }, [currentCv?.id]);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setCopyFeedback(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyFeedback]);

  useEffect(() => {
    if (!recoveryResumeBannerSignature) {
      setIsRecoveryResumeBannerHidden(false);
      return;
    }

    setIsRecoveryResumeBannerHidden(false);
    const timeoutId = window.setTimeout(() => {
      try {
        console.info("[importRecovery] resume_banner_hidden", {
          signature: recoveryResumeBannerSignature,
        });
      } catch {
        /* noop */
      }
      setIsRecoveryResumeBannerHidden(true);
    }, RECOVERY_RESUME_BANNER_AUTO_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recoveryResumeBannerSignature]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      importSignals.length === 0 ||
      isImportWarningDismissed ||
      isImportWarningAutoHidden ||
      isImportWarningExiting
    ) {
      return;
    }

    let hasStartedExit = false;
    const beginExit = () => {
      if (hasStartedExit) {
        return;
      }
      hasStartedExit = true;
      setIsImportWarningExiting(true);
    };

    const autoHideTimer = window.setTimeout(
      beginExit,
      IMPORT_WARNING_AUTO_HIDE_DELAY_MS,
    );

    window.addEventListener("scroll", beginExit, { passive: true });

    return () => {
      hasStartedExit = true;
      window.clearTimeout(autoHideTimer);
      window.removeEventListener("scroll", beginExit);
    };
  }, [
    importSignals.length,
    isImportWarningAutoHidden,
    isImportWarningDismissed,
    isImportWarningExiting,
  ]);

  useEffect(() => {
    if (!isImportWarningExiting) {
      return;
    }

    const exitTimer = window.setTimeout(() => {
      setIsImportWarningExiting(false);
      setIsImportWarningAutoHidden(true);
    }, IMPORT_WARNING_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [isImportWarningExiting]);

  useEffect(() => {
    if (!importReviewSessionKey || typeof window === "undefined") {
      setIsImportReviewAcknowledged(false);
      return;
    }

    setIsImportReviewAcknowledged(
      window.sessionStorage.getItem(importReviewSessionKey) ===
        importSignalSignature,
    );
  }, [importReviewSessionKey, importSignalSignature]);

  useEffect(() => {
    setIsImportReviewCollapsed(true);
  }, [currentCv?.id, importSignalSignature]);

  useEffect(() => {
    if (
      !currentCv ||
      !importRenamePromptSessionKey ||
      typeof window === "undefined" ||
      !shouldPromptForImportedTitleRename(currentCv, importSignals)
    ) {
      return;
    }

    const storedPromptSignature = window.sessionStorage.getItem(
      importRenamePromptSessionKey,
    );
    if (storedPromptSignature === importSignalSignature) {
      return;
    }

    setRenameDraftTitle(currentCv.title ?? "");
    setRenameTargetCvId(String(currentCv.id));
    setIsRenameDialogOpen(true);
    window.sessionStorage.setItem(
      importRenamePromptSessionKey,
      importSignalSignature,
    );
  }, [
    currentCv,
    importRenamePromptSessionKey,
    importSignalSignature,
    importSignals,
  ]);

  // Simple in-component toast notifications for debugging (no external deps)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  function pushToast(message: string) {
    const id = uuidv4();
    setToasts((s) => [...s, { id, message }]);
    // auto-dismiss
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
  }

  function clearRecoveryDraftStorage(storageKey?: string | null) {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  }

  function resetRecoveryUiState(options?: { storageKey?: string | null }) {
    setPendingRecoveryImport(null);
    setSavedRecoveryDraft(null);
    setPendingTouchedRecoverySectionIds([]);
    previousRecoveryOpenRef.current = false;
    clearRecoveryDraftStorage(options?.storageKey ?? importRecoveryDraftSessionKey);
  }

  async function clearPersistedRecoverySession(options?: {
    toastMessage?: string;
    preserveBannerState?: boolean;
  }) {
    resetRecoveryUiState();
    if (!currentCv?.metadata?.importRecoverySession) {
      if (options?.toastMessage) {
        pushToast(options.toastMessage);
      }
      return true;
    }

    const nextMetadata = { ...(currentCv.metadata ?? {}) } as CvDocument["metadata"];
    delete (nextMetadata as { importRecoverySession?: unknown }).importRecoverySession;

    try {
      await importCv({
        ...currentCv,
        metadata: nextMetadata,
      });
      if (!options?.preserveBannerState) {
        setIsRecoveryResumeBannerHidden(false);
      }
      if (options?.toastMessage) {
        pushToast(options.toastMessage);
      }
      return true;
    } catch {
      pushToast("Failed to clear recovery");
      return false;
    }
  }

  function dismissImportWarning() {
    if (importWarningSessionKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        importWarningSessionKey,
        importSignalSignature,
      );
    }
    setIsImportWarningExiting(false);
    setIsImportWarningAutoHidden(false);
    setIsImportWarningDismissed(true);
  }

  function acknowledgeImportReview() {
    if (importReviewSessionKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(importReviewSessionKey, importSignalSignature);
    }
    setIsImportReviewAcknowledged(true);
  }

  function handleReviewFlaggedFields() {
    acknowledgeImportReview();
    setIsImportWarningDismissed(false);
    setIsImportReviewCollapsed(false);
    setReviewFlashToken((current) => current + 1);
    if (typeof inlineReviewRef.current?.scrollIntoView === "function") {
      inlineReviewRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function toggleInlineImportReview() {
    setIsImportReviewCollapsed((current) => !current);
  }

  function scrollToRecoveryPanel() {
    if (typeof recoveryPanelRef.current?.scrollIntoView === "function") {
      recoveryPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  useEffect(() => {
    if (!pendingRecoveryImport || recoveryPanelRef.current == null) return;

    const wasClosed =
      previousRecoveryOpenRef.current === false ||
      previousRecoveryOpenRef.current === null;
    previousRecoveryOpenRef.current = true;

    if (!wasClosed) {
      return;
    }

    const usesAnimationFrame = typeof window.requestAnimationFrame === "function";
    const frameId = usesAnimationFrame
      ? window.requestAnimationFrame(() => {
          scrollToRecoveryPanel();
        })
      : window.setTimeout(scrollToRecoveryPanel, 0);

    return () => {
      if (usesAnimationFrame && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      } else {
        window.clearTimeout(frameId);
      }
    };
  }, [pendingRecoveryImport]);

  useEffect(() => {
    if (pendingRecoveryImport) return;
    previousRecoveryOpenRef.current = false;
  }, [pendingRecoveryImport]);

  function handleImportReviewEntryPoint() {
    if (pendingRecoveryImport) {
      setSavedRecoveryDraft(pendingRecoveryImport);
      setPendingRecoveryImport(null);
      return;
    }
    if (savedRecoveryDraft) {
      resumeRecoverySessionFromDraft(savedRecoveryDraft);
      return;
    }
    if (persistedMetadataRecoverySession) {
      resumeRecoverySessionFromMetadata(persistedMetadataRecoverySession);
      return;
    }
    if (importSignals.length > 0) {
      if (isImportReviewCollapsed) {
        handleReviewFlaggedFields();
      } else if (typeof inlineReviewRef.current?.scrollIntoView === "function") {
        inlineReviewRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }

  function closeRenameDialog() {
    setIsRenameDialogOpen(false);
  }

  function handleExportClick(format: ResumeExportFormat) {
    if (importSignals.length > 0 && !isImportReviewAcknowledged) {
      handleImportReviewEntryPoint();
      pushToast("Review the flagged fields before exporting this CV.");
      return;
    }

    onRequestExport?.(format);
  }

  function handleRenameSave(nextTitle: string) {
    if (!renameTargetCvId) {
      setIsRenameDialogOpen(false);
      return;
    }

    renameCv(renameTargetCvId, nextTitle);
    setRenameDraftTitle(nextTitle);
    setIsRenameDialogOpen(false);
    pushToast("CV title updated");
  }

  async function importSectionsIntoFreshCv(
    updated: CvSection[],
    structured?: StructuredPayload | null,
  ) {
    if (!Array.isArray(updated) || updated.length === 0) {
      pushToast("No importable sections were found");
      return;
    }

    const now = new Date().toISOString();
    const importedDoc: CvDocument = {
      id: uuidv4(),
      title: deriveCvTitleFromSections(updated as any, "Imported CV"),
      metadata: mergeImportedAuthoritativeResume(
        {
          createdAt: now,
          updatedAt: now,
          version: 1,
        },
        structured,
      ),
      sections: updated as any,
    };

    try {
      dbg(
        "[ProfileReviewCard] importSectionsIntoFreshCv authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume: importedDoc.metadata?.authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            importedDoc.metadata?.authoritativeResume,
          ),
        }),
      );
      await importCv(importedDoc);
      const importedSignals = inspectCvImportSignals(importedDoc);
      if (shouldPromptForImportedTitleRename(importedDoc, importedSignals)) {
        setRenameDraftTitle(importedDoc.title);
        setRenameTargetCvId(importedDoc.id);
        setIsRenameDialogOpen(true);
      }
    } catch {
      pushToast("Failed to import CV");
    }
  }

  function buildRecoveryTargetDocument(args: {
    updatedSections: CvSection[];
    target: RecoveryImportTarget;
    pendingSession?: ImportRecoverySession | null;
    structured?: StructuredPayload | null;
    authoritativeResume?: AuthoritativeResume | null;
  }): CvDocument {
    const now = new Date().toISOString();
    const pendingSession = args.pendingSession?.items.length
      ? args.pendingSession
      : undefined;

    if (args.target === "fresh" || !currentCv) {
      return {
        id: uuidv4(),
        title: deriveCvTitleFromSections(args.updatedSections as any, "Imported CV"),
        metadata: mergeExplicitAuthoritativeResume(
          mergeImportedAuthoritativeResume(
            {
              createdAt: now,
              updatedAt: now,
              version: 1,
              ...(pendingSession ? { importRecoverySession: pendingSession } : {}),
            } as CvDocument["metadata"],
            args.structured,
          ),
          args.authoritativeResume,
        ),
        sections: args.updatedSections as any,
      };
    }

    const nextMetadata = mergeExplicitAuthoritativeResume(
      mergeImportedAuthoritativeResume(
        {
          ...(currentCv.metadata ?? {}),
          updatedAt: now,
          ...(pendingSession
            ? { importRecoverySession: pendingSession }
            : { importRecoverySession: undefined }),
        } as CvDocument["metadata"],
        args.structured,
      ),
      args.authoritativeResume,
    );
    if (!pendingSession) {
      delete (nextMetadata as { importRecoverySession?: unknown }).importRecoverySession;
    }

    return {
      ...currentCv,
      metadata: nextMetadata,
      sections: args.updatedSections as any,
    };
  }

  async function applyImportedSections(
    updated: CvSection[],
    target: RecoveryImportTarget,
    pendingSession?: ImportRecoverySession | null,
    structured?: StructuredPayload | null,
    authoritativeResume?: AuthoritativeResume | null,
  ): Promise<boolean> {
    const nextDoc = buildRecoveryTargetDocument({
      updatedSections: updated,
      target,
      pendingSession,
      structured,
      authoritativeResume,
    });
    try {
      dbg(
        "[ProfileReviewCard] applyImportedSections authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume: nextDoc.metadata?.authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            nextDoc.metadata?.authoritativeResume,
          ),
        }),
      );
      await importCv(nextDoc);
      try {
        window.sessionStorage.removeItem(importRecoveryDraftSessionKey);
      } catch {
        /* noop */
      }
      if (target === "fresh") {
        const importedSignals = inspectCvImportSignals(nextDoc);
        if (shouldPromptForImportedTitleRename(nextDoc, importedSignals)) {
          setRenameDraftTitle(nextDoc.title);
          setRenameTargetCvId(nextDoc.id);
          setIsRenameDialogOpen(true);
        }
      }
      return true;
    } catch {
      pushToast("Failed to apply reviewed import");
      return false;
    }
  }

  function resumeRecoverySessionFromDraft(draft: PendingRecoveryImport) {
    setPendingRecoveryImport({
      ...draft,
      cycleId: uuidv4(),
      items: draft.items.map(normalizeRecoveryItemTargets),
    });
    setSavedRecoveryDraft(null);
  }

  function resumeRecoverySessionFromMetadata(session: ImportRecoverySession) {
    const baseSections = Array.isArray(session.baseSectionsSnapshot)
      ? session.baseSectionsSnapshot
      : currentCv?.sections ?? [];
    setPendingRecoveryImport({
      cycleId: uuidv4(),
      target: "existing",
      baseSections,
      fullSections: currentCv?.sections ?? [],
      items: session.items.map(normalizeRecoveryItemTargets),
      overflowCount: session.overflowCount,
      reviewLimit: session.reviewLimit,
    });
  }

  async function beginRecoveryImport(
    request: {
      baseSections: CvSection[];
      fullSections: CvSection[];
      structured: StructuredPayload;
    },
    target: RecoveryImportTarget,
  ) {
    const recovery = request.structured.recovery;
    const previousPersistedRecoverySession = currentCv?.metadata?.importRecoverySession;

    if (!recovery || !recovery.reviewRequired || recovery.items.length === 0) {
      resetRecoveryUiState();
      void applyImportedSections(request.fullSections, target, undefined, request.structured);
      return;
    }

    try {
      console.info("[importRecovery] review_required", {
        target,
        itemCount: recovery.items.length,
      });
    } catch {
      /* noop */
    }

    const nextPendingRecoveryImport: PendingRecoveryImport = {
      cycleId: uuidv4(),
      target,
      baseSections: request.baseSections,
      fullSections: request.fullSections,
      authoritativeResume: readStructuredAuthoritativeResume(request.structured),
      items: recovery.items.map((item) =>
        normalizeRecoveryItemTargets({
          ...item,
          displayTextSource: item.displayTextSource ?? "cleaned",
          reviewStatus: item.reviewStatus ?? "pending",
          selectedSection: item.selectedSection ?? item.predictedSection,
          selectedSectionTitle: item.selectedSectionTitle ?? null,
          fragmentAssignments: item.fragmentAssignments ?? [],
        }),
      ),
      overflowCount: recovery.overflowCount,
      reviewLimit: recovery.reviewLimit,
    };

    setPendingTouchedRecoverySectionIds([]);
    previousRecoveryOpenRef.current = false;
    setSavedRecoveryDraft(null);
    clearRecoveryDraftStorage();
    setPendingRecoveryImport(nextPendingRecoveryImport);

    if (previousPersistedRecoverySession && currentCv) {
      const nextMetadata = { ...(currentCv.metadata ?? {}) } as CvDocument["metadata"];
      delete (nextMetadata as { importRecoverySession?: unknown }).importRecoverySession;
      try {
        console.info("[importRecovery] replacing_open_cycle", {
          nextCycleId: nextPendingRecoveryImport.cycleId,
        });
      } catch {
        /* noop */
      }
      void importCv({
        ...currentCv,
        metadata: nextMetadata,
      }).catch(() => {
        pushToast("Failed to reset previous recovery state");
      });
    }
  }

  function updateRecoveryItem(
    blockId: string,
    updates: Partial<ImportRecoveryItem>,
  ) {
    setPendingRecoveryImport((current) => {
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
  }

  function acceptRecoveryItem(blockId: string) {
    setPendingRecoveryImport((current) => {
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
                reviewStatus: getRecoveryDecisionStatus(
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
  }

  function updateRecoveryRemainingTarget(payload: {
    blockId: string;
    targetSection: ImportRecoverySectionType;
    targetSectionTitle?: string | null;
  }) {
    setPendingRecoveryImport((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.blockId !== payload.blockId) return item;

          const nextSection = normalizeRecoverySectionTarget(payload.targetSection);
          const nextTitle =
            nextSection === "custom"
              ? payload.targetSectionTitle?.trim() ?? null
              : null;
          const nextStatus =
            item.reviewStatus === "accepted" || item.reviewStatus === "reassigned"
              ? getRecoveryDecisionStatus(item, nextSection, nextTitle)
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
  }

  function ignoreRecoveryItem(blockId: string) {
    updateRecoveryItem(blockId, { reviewStatus: "ignored" });
  }

  function assignRecoveryFragment(payload: {
    blockId: string;
    range: { start: number; end: number };
    text: string;
    selectionSource: "cleaned" | "raw";
    targetSection: ImportRecoverySectionType;
    targetSectionTitle?: string | null;
  }) {
    setPendingRecoveryImport((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.blockId !== payload.blockId) return item;
          return {
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
          };
        }),
      };
    });
  }

  function removeRecoveryFragment(blockId: string, fragmentId: string) {
    setPendingRecoveryImport((current) => {
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
  }

  function cancelRecoveryImport() {
    try {
      console.info("[importRecovery] abandoned", {
        itemCount: pendingRecoveryImport?.items.length ?? 0,
      });
    } catch {
      /* noop */
    }
    setPendingRecoveryImport(null);
    setSavedRecoveryDraft(null);
    try {
      window.sessionStorage.removeItem(importRecoveryDraftSessionKey);
    } catch {
      /* noop */
    }
    pushToast("Import cancelled");
  }

  async function discardRecoveryImport() {
    const didClear = await clearPersistedRecoverySession({
      toastMessage: "Recovery cleared",
    });
    if (!didClear) return;
  }

  async function importRecoveryAsIs() {
    if (!pendingRecoveryImport) return;
    const sectionsToApply = pendingRecoveryImport.fullSections;
    const persistedSession = createCompletedImportRecoverySession(
      pendingRecoveryImport.items.map(normalizeRecoveryItemTargets),
      pendingRecoveryImport.reviewLimit,
      pendingRecoveryImport.baseSections,
    );
    setPendingRecoveryImport(null);
    try {
      console.info("[importRecovery] imported_as_is", {
        itemCount: pendingRecoveryImport.items.length,
      });
    } catch {
      /* noop */
    }
    try {
      console.info("[importRecovery] session_snapshot", {
        status: persistedSession.status,
        itemCount: persistedSession.items.length,
      });
    } catch {
      /* noop */
    }
    await applyImportedSections(
      sectionsToApply,
      pendingRecoveryImport.target,
      persistedSession,
      undefined,
      pendingRecoveryImport.authoritativeResume ?? null,
    );
  }

  async function applyReviewedRecoveryImport() {
    if (!pendingRecoveryImport) return;
    const normalizedItems = pendingRecoveryImport.items.map(normalizeRecoveryItemTargets);
    const { itemsToApply, pendingItems, summary } = buildRecoveryCommitState(normalizedItems);
    const reviewedSections = applyImportRecoveryItems(
      pendingRecoveryImport.baseSections,
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
      ? createImportRecoverySession(pendingItems, pendingRecoveryImport.reviewLimit)
      : createCompletedImportRecoverySession(
          normalizedItems,
          pendingRecoveryImport.reviewLimit,
          pendingRecoveryImport.baseSections,
        );
    setPendingRecoveryImport(null);
    setSavedRecoveryDraft(null);
    try {
      console.info("[importRecovery] reviewed_import_applied", {
        decisions: itemsToApply.reduce(
          (acc, item) => {
            acc[item.reviewStatus] = (acc[item.reviewStatus] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        pendingCount: pendingItems.length,
      });
    } catch {
      /* noop */
    }
    try {
      console.info("[importRecovery] session_snapshot", {
        status: persistedSession.status,
        itemCount: persistedSession.items.length,
      });
    } catch {
      /* noop */
    }
    const didApply = await applyImportedSections(
      revealedSections,
      pendingRecoveryImport.target,
      persistedSession,
      undefined,
      pendingRecoveryImport.authoritativeResume ?? null,
    );
    if (didApply) {
      setPendingTouchedRecoverySectionIds(touchedSectionIds);
      pushToast(formatRecoveryCommitToast(summary));
    }
  }

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const recoveryDraftToPersist = pendingRecoveryImport ?? savedRecoveryDraft;
    if (!recoveryDraftToPersist) {
      try {
        window.sessionStorage.removeItem(importRecoveryDraftSessionKey);
      } catch {
        /* noop */
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(
          importRecoveryDraftSessionKey,
          JSON.stringify(recoveryDraftToPersist),
        );
      } catch {
        /* noop */
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [importRecoveryDraftSessionKey, pendingRecoveryImport, savedRecoveryDraft]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(importRecoveryDraftSessionKey);
      if (!raw) {
        setSavedRecoveryDraft(null);
        return;
      }
      const parsed = JSON.parse(raw) as PendingRecoveryImport;
      if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        setSavedRecoveryDraft(null);
        return;
      }
      setSavedRecoveryDraft(parsed);
    } catch {
      setSavedRecoveryDraft(null);
    }
  }, [importRecoveryDraftSessionKey, pendingRecoveryImport]);

  React.useEffect(() => {
    if (!recentlyAddedSectionType) return;
    const timeoutId = window.setTimeout(() => {
      setRecentlyAddedSectionType("");
    }, 1100);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyAddedSectionType]);

  React.useEffect(() => {
    if (pendingTouchedRecoverySectionIds.length === 0) return undefined;

    const availableIds = pendingTouchedRecoverySectionIds.filter(
      (sectionId) => sectionRevealRefs.current[sectionId],
    );
    if (availableIds.length === 0) {
      return undefined;
    }

    setRevealedRecoverySectionIds(availableIds);
    setPendingTouchedRecoverySectionIds([]);

    const firstSection = sectionRevealRefs.current[availableIds[0]];
    if (firstSection) {
      firstSection.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        try {
          firstSection.focus({ preventScroll: true });
        } catch {
          /* noop */
        }
      }, 80);
    }

    const timeoutId = window.setTimeout(() => {
      setRevealedRecoverySectionIds([]);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingTouchedRecoverySectionIds, sections]);

  React.useEffect(() => {
    if (!isAddSectionMenuOpen && !isManageSectionsMenuOpen) return undefined;

    const handleDocumentClick = (event: MouseEvent) => {
      if (addSectionMenuRef.current?.contains(event.target as Node)) return;
      if (manageSectionsMenuRef.current?.contains(event.target as Node)) return;
      setIsAddSectionMenuOpen(false);
      setIsManageSectionsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isAddSectionMenuOpen, isManageSectionsMenuOpen]);

  /**
   * Replace an updated section into the current document via context.
   * Uses reorderSections to persist changes.
   */
  function updateSectionInDoc(updated: CvSection) {
    try {
      const updatedList = sections.map((s) =>
        String(s.id) === String(updated.id) ? (updated as CvSection) : s,
      );
      reorderSections(updatedList as any);
    } catch {
      /* noop */
    }
  }

  /**
   * Sortable wrapper for individual sections.
   * Uses useSortable to provide drag handle props and style transforms.
   */
  function SortableSection({
    section,
    index,
  }: {
    section: CvSection;
    index: number;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: section.id,
      } as any);
    const style: React.CSSProperties = {
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
      transition,
    };
    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          sectionRevealRefs.current[String(section.id ?? "")] = node;
        }}
        style={style}
        className={[
          "mb-6",
          revealedRecoverySectionIds.includes(String(section.id ?? ""))
            ? "dasti-import-reveal-shell"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-import-revealed={
          revealedRecoverySectionIds.includes(String(section.id ?? ""))
            ? "true"
            : "false"
        }
        tabIndex={-1}
      >
        <div className="flex items-center mb-2">
          <button
            type="button"
            aria-label={`Drag ${section.title}`}
            className="p-1 rounded hover:[background:var(--sf2)]"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <SectionComponent
          section={section}
          index={index}
          onChange={(_i, updated) => {
            try {
              updateSectionInDoc(updated as any);
            } catch {
              /* noop */
            }
          }}
        />
      </div>
    );
  }

  /**
   * Handle drag end for sections — compute new order and delegate to context.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!active || !over) return;
    if (active.id === over.id) return;

    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newIds = arrayMove(ids, oldIndex, newIndex);
    const newOrderSections = newIds
      .map((id) => sections.find((s) => s.id === id))
      .filter(Boolean) as CvSection[];

    reorderSections(newOrderSections);
  }

  function buildTextSection(title: string): CvSection {
    return makeTextSection(title, { includeSeedBlock: true });
  }

  function handleAddSection(optionValue?: string) {
    try {
      const option = sectionCatalog.find(
        (entry) => entry.value === String(optionValue ?? "").trim(),
      );
      if (!option) {
        pushToast("Choose a section type to add");
        return;
      }
      const type = option.sectionType;

      // Prevent duplicates for typed singleton sections
      const typedSingletons = new Set([
        "profile",
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
        "achievements",
        "projects",
        "certifications",
      ]);
      const existingTypes = new Set(
        (currentCv?.sections ?? sections).map((s) => String((s as any).type)),
      );
      if (typedSingletons.has(type) && existingTypes.has(type)) {
        pushToast(`Section "${type}" already exists`);
        return;
      }

      let newSection: CvSection;
      if (option.sectionType === "text") {
        const requestedTitle = option.isCustom
          ? window.prompt("Name the new section", "Additional Information")?.trim() ?? ""
          : String(option.sectionTitle ?? "").trim();
        if (!requestedTitle) {
          pushToast("Section name is required");
          return;
        }
        const existingTextTitles = new Set(
          (currentCv?.sections ?? sections)
            .filter((section) => String(section.type ?? "") === "text")
            .map((section) => String(section.title ?? "").trim().toLowerCase()),
        );
        if (existingTextTitles.has(requestedTitle.toLowerCase())) {
          pushToast(`Section "${requestedTitle}" already exists`);
          return;
        }
        newSection = buildTextSection(requestedTitle);
      } else {
        // Generate a full template and pick the matching section to ensure schema-compliance.
        try {
        // If the user explicitly requested a typed v1 section, force the v1 template
        // regardless of env flag. This ensures Add Section always creates a v1-shaped
        // section when the user picks a v1 type from the UI.
        const typedV1Set = new Set([
          "profile",
          "summary",
          "experience",
          "achievements",
          "education",
          "skills",
          "languages",
        ]);
        const optionalV1SectionSet = new Set(["achievements", "languages"]);
        const forceV1ForType = typedV1Set.has(String(type));
        const tmpl = forceV1ForType
          ? generateCvTemplateV1()
          : v1Enabled
            ? generateCvTemplateV1()
            : generateCvTemplate();

        // Dev log to aid QA: which template we picked and why
        if (process.env.NODE_ENV !== "production") {
          try {
            // eslint-disable-next-line no-console
            console.debug(
              "[ProfileReviewCard] handleAddSection templateChoice",
              {
                requestedType: type,
                forceV1ForType,
                v1Enabled,
                chosenTemplate: forceV1ForType
                  ? "generateCvTemplateV1"
                  : v1Enabled
                    ? "generateCvTemplateV1"
                    : "generateCvTemplate",
              },
            );
          } catch {}
        }

          let matched = tmpl.sections.find((s) => s.type === (type as any));
        if (
          !matched &&
          forceV1ForType &&
          optionalV1SectionSet.has(String(type))
        ) {
          const optionalTemplate = generateCvTemplate();
          matched = optionalTemplate.sections.find(
            (s) => s.type === (type as any),
          );
        }
        if (!matched) {
          pushToast(`Section type "${type}" is not available`);
          return;
        }

        // Clone and give it a unique id for this document.
        newSection = { ...matched, id: uuidv4() } as CvSection;
        } catch (err) {
        // If template generation fails, fail safely instead of creating a legacy text section.
        // eslint-disable-next-line no-console
        console.error("[ProfileReviewCard] generateCvTemplate failed", err);
        pushToast("Failed to create section");
        return;
        }
      }

      const preferredSectionOrder = [
        "profile",
        "summary",
        "experience",
        "achievements",
        "education",
        "skills",
        "languages",
        "projects",
        "certifications",
        "text",
      ] as const;
      const preferredOrderIndex = new Map<string, number>(
        preferredSectionOrder.map((sectionType, index): [string, number] => [
          sectionType,
          index,
        ]),
      );

      const existingSections = (currentCv?.sections ?? sections) as CvSection[];
      if (existingSections.length > 0) {
        const nextSections = [...existingSections, newSection];
        const orderedSections = nextSections
          .map((section, index) => ({ section, index }))
          .sort((a, b) => {
            const aType = String(a.section.type ?? "");
            const bType = String(b.section.type ?? "");
            const aRank =
              preferredOrderIndex.get(aType) ?? Number.MAX_SAFE_INTEGER;
            const bRank =
              preferredOrderIndex.get(bType) ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.index - b.index;
          })
          .map(({ section }) => section);

        reorderSections(orderedSections as any);
      } else {
        addSection(newSection);
      }
      pushToast(`${newSection.title || option.label} added`);
      setRecentlyAddedSectionType(option.value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] addSection failed", err);
      pushToast("Failed to add section");
    }
  }

  function handleClearAddedSections() {
    const removableSectionIds = new Set(
      removableAddedSections.map((section) => section.sectionId),
    );
    if (removableSectionIds.size === 0) {
      pushToast("No added sections to remove");
      return;
    }

    const nextSections = sections.filter(
      (section) => !removableSectionIds.has(String(section.id ?? "")),
    );

    if (nextSections.length === sections.length) {
      pushToast("No added sections to remove");
      return;
    }

    if (nextSections.length === 0) {
      pushToast("Core sections must remain in the CV");
      return;
    }

    reorderSections(nextSections as any);
    setIsManageSectionsMenuOpen(false);
    pushToast("Added sections removed");
  }

  function handleRemoveAddedSection(sectionId: string) {
    const normalizedSectionId = String(sectionId ?? "").trim();
    if (!normalizedSectionId) {
      pushToast("Choose a section to remove");
      return;
    }

    const nextSections = sections.filter(
      (section) => String(section.id ?? "") !== normalizedSectionId,
    );

    if (nextSections.length === sections.length) {
      pushToast("Section not found");
      return;
    }

    reorderSections(nextSections as any);
    setIsManageSectionsMenuOpen(false);
    const removedLabel =
      removableAddedSections.find((section) => section.sectionId === normalizedSectionId)
        ?.label ?? "Section";
    pushToast(`${removedLabel} removed`);
  }

  return (
    <div>
      <CvRenameDialog
        open={isRenameDialogOpen}
        currentTitle={renameDraftTitle}
        onClose={closeRenameDialog}
        onSave={handleRenameSave}
        title="Name this imported CV"
        placeholder="e.g. Jane Doe — Product Manager"
        saveLabel="Save title"
      />

      {/* Always mount the inspector; it renders null when no selection to avoid mount/unmount churn */}
      <SelectedBlockInspector onClose={closeInspector} />

      {/* Toast container (debug) */}
      <div
        aria-live="polite"
        className="fixed z-50 flex flex-col gap-2 top-4 right-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="px-3 py-2 text-ts [background:var(--sfr)] border [border-radius:var(--radius-control)] [box-shadow:var(--sha)] [border-color:var(--color-border)]"
          >
            {t.message}
          </div>
        ))}
      </div>

      {importSignals.length > 0 &&
      !isImportWarningDismissed &&
      !isImportWarningAutoHidden ? (
        <ImportWarningBanner
          signalCount={importSignals.length}
          onReview={handleReviewFlaggedFields}
          onDismiss={dismissImportWarning}
          isExiting={isImportWarningExiting}
          reviewLabel={reviewChecksLabel}
          recoveryAction={
            hasPendingRecoveryEntryPoint
              ? {
                  label: recoveryEntryLabel,
                  onClick: handleImportReviewEntryPoint,
                }
              : null
          }
        />
      ) : null}

      {importSignals.length > 0 ? (
        <section
          ref={inlineReviewRef}
          className="dasti-inline-review"
          aria-label="Import review checks"
          data-review-flash={reviewFlashToken > 0 ? "true" : "false"}
          data-collapsed={isImportReviewCollapsed ? "true" : "false"}
        >
          <div className="dasti-inline-review__panel">
            <div className="dasti-inline-review__header">
              <div className="dasti-inline-review__header-copy">
                <div className="dasti-inline-review__eyebrow">Import review</div>
                <p className="dasti-inline-review__summary">
                  Clean flagged parser noise here before generating proposals.
                </p>
              </div>
              <div className="dasti-inline-review__header-actions">
                <div
                  className="dasti-inline-review__status"
                  data-review-state={
                    isImportReviewAcknowledged ? "acknowledged" : "required"
                  }
                >
                  {isImportReviewAcknowledged
                    ? "Review acknowledged"
                    : "Review required before export"}
                </div>
                <button
                  type="button"
                  className="dasti-inline-review__close"
                  aria-label={
                    isImportReviewCollapsed ? "Open import review" : "Close import review"
                  }
                  onClick={toggleInlineImportReview}
                >
                  {isImportReviewCollapsed ? (
                    <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div className="dasti-inline-review__list" role="list">
              {importSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="dasti-inline-review__item"
                  role="listitem"
                >
                  <div className="dasti-inline-review__title">{signal.title}</div>
                  <p className="dasti-inline-review__description">
                    {signal.description}
                  </p>
                </div>
              ))}
            </div>
            {pendingRecoveryImport || savedRecoveryDraft || persistedMetadataRecoverySession ? (
              <div className="dasti-inline-review__actions">
                <button
                  type="button"
                  className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
                  onClick={handleImportReviewEntryPoint}
                >
                  {recoveryEntryLabel}
                </button>
                <button
                  type="button"
                  className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
                  onClick={() => {
                    void discardRecoveryImport();
                  }}
                >
                  Discard recovery
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {pendingRecoveryImport ? (
        <div ref={recoveryPanelRef}>
          <ImportRecoveryPanel
            recoveryCycleKey={pendingRecoveryImport.cycleId}
            items={recoveryItemsToReview}
            overflowCount={remainingRecoveryItemCount}
            reviewLimit={pendingRecoveryImport.reviewLimit}
            onAccept={acceptRecoveryItem}
            onIgnore={ignoreRecoveryItem}
            onUpdateRemainingTarget={updateRecoveryRemainingTarget}
            onAssignFragment={assignRecoveryFragment}
            onRemoveFragment={removeRecoveryFragment}
            onImportAsIs={() => {
              void importRecoveryAsIs();
            }}
            onCancel={cancelRecoveryImport}
            onDiscardRecovery={() => {
              void discardRecoveryImport();
            }}
            onApply={() => {
              void applyReviewedRecoveryImport();
            }}
            outcomeSummary={recoveryOutcomeSummary}
          />
        </div>
      ) : null}

      {!pendingRecoveryImport &&
      resumableRecoveryItemCount > 0 &&
      !isRecoveryResumeBannerHidden ? (
        <section className="dasti-import-recovery__resume-banner" aria-label="Pending import recovery review">
          <div>
            <div className="dasti-inline-review__eyebrow">Import recovery</div>
            <div className="dasti-import-recovery__resume-title">
              {hasCompletedRecoverySession
                ? `Recovery review saved — reopen ${resumableRecoveryItemCount} reviewed item${resumableRecoveryItemCount === 1 ? "" : "s"}`
                : `Import review incomplete — ${resumableRecoveryItemCount} item${resumableRecoveryItemCount === 1 ? "" : "s"} pending`}
            </div>
          </div>
          <div className="dasti-import-recovery__resume-actions">
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--pill"
              onClick={() => {
                if (savedRecoveryDraft) {
                  resumeRecoverySessionFromDraft(savedRecoveryDraft);
                  return;
                }
                if (persistedMetadataRecoverySession) {
                  resumeRecoverySessionFromMetadata(persistedMetadataRecoverySession);
                }
              }}
            >
              {recoveryEntryLabel}
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--pill"
              onClick={() => {
                void discardRecoveryImport();
              }}
            >
              Discard recovery
            </button>
            <button
              type="button"
              className="dasti-import-recovery__resume-close"
              aria-label="Dismiss recovery banner"
              onClick={() => setIsRecoveryResumeBannerHidden(true)}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* Toolbar is rendered below the title only when a CV is loaded — see the !isLoading && currentCv block */}

      {isLoading && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}
        >
          {/* Title row shimmer */}
          <div
            className="shimmer-line"
            style={{
              height: 24,
              width: "55%",
              borderRadius: "var(--radius-inline)",
            }}
          />
          {/* Toolbar shimmer */}
          <div
            className="shimmer-line"
            style={{
              height: 36,
              width: "100%",
              borderRadius: "var(--radius-inline)",
            }}
          />
          {/* Section cards shimmer */}
          {[0.9, 0.75, 0.85].map((w, i) => (
            <div
              key={i}
              style={{
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                overflow: "hidden",
              }}
            >
              <div
                className="shimmer-line"
                style={{ height: 48, width: "100%", borderRadius: 0 }}
              />
              <div
                style={{
                  padding: "var(--s4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s3)",
                }}
              >
                <div
                  className="shimmer-line"
                  style={{ height: 12, width: `${Math.round(w * 100)}%` }}
                />
                <div
                  className="shimmer-line"
                  style={{
                    height: 12,
                    width: `${Math.round((w - 0.2) * 100)}%`,
                  }}
                />
                <div
                  className="shimmer-line"
                  style={{
                    height: 12,
                    width: `${Math.round((w - 0.1) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !currentCv && (
        <div className="dasti-empty-state dasti-empty-state--panel">
          <div className="dasti-empty-state__icon-shell">
            <FileText size={22} strokeWidth={1.4} />
          </div>
          <div>
            <h2 className="dasti-empty-state__title">
              Import your existing CV or start from scratch.
            </h2>
            <p className="dasti-empty-state__subtitle">
              Bring in an existing resume, begin a clean draft, or open one from
              the library before generating proposals.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--s2)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <StructuredUploadButton
              contextKey="cvforge-empty-state"
              label="Import CV"
              onApplyToSections={(updated, structured) => {
                void importSectionsIntoFreshCv(updated, structured as StructuredPayload | undefined);
              }}
              onResult={(payload) => {
                setLatestStructuredPayload(payload as StructuredPayload);
                setCopyFeedback(null);
              }}
              onRecoveryRequired={(request) => {
                void beginRecoveryImport(request, "fresh");
              }}
              renderAs="dropdown"
            />
            <button
              type="button"
              onClick={() => {
                void createNewCv(undefined, { forceV1: true });
              }}
              className="dasti-button dasti-button--primary dasti-button--pill"
            >
              Start from scratch
            </button>
            <button
              type="button"
              onClick={() => void navigate("/cvs")}
              className="dasti-button dasti-button--secondary dasti-button--pill"
            >
              Open library
            </button>
          </div>
          {DEBUG_CV_EDITOR && latestStructuredPayload ? (
            <div
              style={{
                display: "flex",
                gap: "var(--s2)",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: "var(--s3)",
              }}
            >
              <ImportRuntimeDebugControls
                copyFeedback={copyFeedback}
                onCopyPayload={(kind) => {
                  void copyStructuredPayload(kind);
                }}
                payload={latestStructuredPayload}
                rawTextForCopy={rawTextForCopy}
                runtimeDebug={latestImportRuntimeDebug}
              />
            </div>
          ) : null}
        </div>
      )}

      {!isLoading && currentCv && (
        <div>
          <div className="mb-4 dasti-cv-edit-toolbar dasti-proposal-rail-cluster dasti-toolbar--surface-tooltips">
            <div className="dasti-cv-edit-toolbar__group dasti-cv-edit-toolbar__group--lead">
              {toolbarLeadControl}
            </div>
            {toolbarLeadControl ? (
              <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            ) : null}
            <div className="dasti-cv-edit-toolbar__group dasti-cv-edit-toolbar__group--primary">
              {toolbarPrimaryControl}
              {addableSectionOptions.length > 0 ? (
                <div
                  ref={addSectionMenuRef}
                  className="dasti-import-dropdown"
                  data-open={isAddSectionMenuOpen ? "true" : "false"}
                  style={{ flex: "0 0 auto" }}
                >
                  <button
                    type="button"
                    aria-label="Manage sections"
                    className="dasti-select dasti-select--sm dasti-add-section-trigger"
                    onClick={() => setIsAddSectionMenuOpen((current) => !current)}
                  >
                    <span
                      className="dasti-add-section-trigger__spacer"
                      aria-hidden
                    />
                    <span className="dasti-add-section-trigger__label">
                      Manage sections
                    </span>
                    <span className="dasti-add-section-trigger__icon">
                      {isAddSectionMenuOpen ? (
                        <X className="h-4 w-4 [color:var(--ti)]" aria-hidden />
                      ) : recentlyAddedSectionType ? (
                        <Check
                          className="h-4 w-4 [color:var(--color-accent)]"
                          aria-hidden
                        />
                      ) : (
                        <ChevronDown
                          className="h-4 w-4 [color:var(--tg2)]"
                          aria-hidden
                        />
                      )}
                    </span>
                  </button>
                  {isAddSectionMenuOpen ? (
                    <div className="dasti-import-dropdown__menu dasti-add-section-menu dasti-toolbar-drawer-surface">
                      {addableSectionOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="dasti-menu-option dasti-menu-option--section"
                          onClick={() => {
                            handleAddSection(option.value);
                            setIsAddSectionMenuOpen(false);
                          }}
                        >
                          <div className="dasti-menu-option__row">
                            <div className="dasti-menu-option__copy">
                               <div className="dasti-menu-option__title">
                                 {option.label}
                               </div>
                               {option.description ? (
                                 <div className="dasti-menu-option__description">
                                   {option.description}
                                 </div>
                               ) : null}
                             </div>
                           </div>
                         </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : removableAddedSections.length > 0 ? (
                <div
                  ref={manageSectionsMenuRef}
                  className="dasti-import-dropdown"
                  data-open={isManageSectionsMenuOpen ? "true" : "false"}
                  style={{ flex: "0 0 auto" }}
                >
                  <button
                    type="button"
                    aria-label="Manage sections"
                    className="dasti-select dasti-select--sm dasti-add-section-trigger"
                    onClick={() =>
                      setIsManageSectionsMenuOpen((current) => !current)
                    }
                  >
                    <span
                      className="dasti-add-section-trigger__spacer"
                      aria-hidden
                    />
                    <span className="dasti-add-section-trigger__label">
                      Manage sections
                    </span>
                    <span className="dasti-add-section-trigger__icon">
                      {isManageSectionsMenuOpen ? (
                        <X className="h-4 w-4 [color:var(--ti)]" aria-hidden />
                      ) : (
                        <ChevronDown
                          className="h-4 w-4 [color:var(--tg2)]"
                          aria-hidden
                        />
                      )}
                    </span>
                  </button>
                  {isManageSectionsMenuOpen ? (
                    <div className="dasti-import-dropdown__menu dasti-add-section-menu dasti-add-section-menu--manage dasti-toolbar-drawer-surface">
                      {removableAddedSections.map((section) => {
                        const sectionLabel = section.label;
                        return (
                          <button
                            key={section.sectionId}
                            type="button"
                            className="dasti-menu-option dasti-menu-option--section"
                            onClick={() => {
                              handleRemoveAddedSection(section.sectionId);
                            }}
                          >
                            <div className="dasti-menu-option__row">
                              <div className="dasti-menu-option__copy">
                                <div className="dasti-menu-option__title">
                                  Remove {sectionLabel}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {removableAddedSections.length > 1 ? (
                        <button
                          type="button"
                          className="dasti-menu-option dasti-menu-option--section"
                          onClick={handleClearAddedSections}
                        >
                          <div className="dasti-menu-option__row">
                            <div className="dasti-menu-option__copy">
                              <div className="dasti-menu-option__title">
                                Remove all optional sections
                              </div>
                            </div>
                          </div>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="dasti-cv-edit-toolbar__hint">
                  All sections added.
                </span>
              )}

              <StructuredUploadButton
                contextKey={currentCv?.id ?? ""}
                sections={
                  sections as unknown as import("../types/cvDocument").CvSection[]
                }
                onApplyToSections={(updated, structured) => {
                  void applyImportedSections(
                    updated,
                    "existing",
                    undefined,
                    structured as StructuredPayload | undefined,
                  );
                }}
                onResult={(payload) => {
                  setLatestStructuredPayload(payload as StructuredPayload);
                  setCopyFeedback(null);
                  if (
                    typeof window !== "undefined" &&
                    (window as any).__CV_EDITOR_DEBUG__ === true
                  ) {
                    try {
                      console.debug(
                        "[ProfileReviewCard] structured runtime status",
                        buildImportRuntimeDebugSnapshot(
                          payload as StructuredPayload,
                        ),
                      );
                      console.debug(
                        "[ProfileReviewCard] structured payload",
                        payload,
                      );
                    } catch {
                      /* noop */
                    }
                  }
                }}
                onRecoveryRequired={(request) => {
                  void beginRecoveryImport(request, "existing");
                }}
                renderAs="dropdown"
              />
            </div>
            {onRequestExport ||
            hasImportReviewEntryPoint ||
            (DEBUG_CV_EDITOR && latestStructuredPayload) ? (
              <div className="dasti-cv-edit-toolbar__group dasti-cv-edit-toolbar__group--actions">
                {DEBUG_CV_EDITOR && latestStructuredPayload ? (
                  <ImportRuntimeDebugControls
                    copyFeedback={copyFeedback}
                    onCopyPayload={(kind) => {
                      void copyStructuredPayload(kind);
                    }}
                    payload={latestStructuredPayload}
                    rawTextForCopy={rawTextForCopy}
                    runtimeDebug={latestImportRuntimeDebug}
                  />
                ) : null}
                {onRequestExport ? (
                  <ResumeExportControl
                    exportingFormat={null}
                    onExport={handleExportClick}
                    statusDescription={exportStatusDescription}
                    statusLabel={exportStatusLabel}
                    statusTone={exportStatusTone}
                  />
                ) : null}
                {hasImportReviewEntryPoint ? (
                  <button
                    type="button"
                    onClick={handleImportReviewEntryPoint}
                    className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm dasti-import-review-trigger"
                    aria-label={toolbarImportEntryLabel}
                    aria-expanded={pendingRecoveryImport ? true : importSignals.length > 0 ? !isImportReviewCollapsed : false}
                    data-toolbar-tooltip={toolbarImportEntryLabel}
                    data-review-state={
                      pendingRecoveryImport || savedRecoveryDraft || persistedMetadataRecoverySession
                        ? "required"
                        : isImportReviewAcknowledged
                          ? "acknowledged"
                          : "required"
                    }
                  >
                    <SealWarning size={18} strokeWidth={1.7} aria-hidden="true" />
                    {toolbarImportEntryLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            {sections.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--s3)",
                  padding: "var(--s7) var(--s5)",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border)",
                  background: "var(--sfr)",
                  boxShadow: "var(--sha)",
                  textAlign: "center",
                  color: "var(--tg2)",
                }}
              >
                <FileText size={24} strokeWidth={1.3} />
                <span style={{ fontSize: "var(--ts)", fontWeight: 500 }}>
                  No sections yet — add one below
                </span>
              </div>
            ) : DISABLE_DND_FOR_DEBUG ? (
              <>
                {/* Debug: render without DnD to avoid mount/unmount churn and isolate click issues */}
                {DEBUG_CV_EDITOR &&
                  console.debug(
                    "[ProfileReviewCard] DnD disabled in debug mode",
                  )}
                {sections.map((section, idx) => (
                  <div
                    key={String(section.id ?? "")}
                    className={[
                      "mb-6",
                      flaggedSectionTypes.has(String(section.type ?? ""))
                        ? "dasti-import-flagged-shell"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-import-flagged={
                      flaggedSectionTypes.has(String(section.type ?? ""))
                        ? "true"
                        : "false"
                    }
                    data-import-revealed={
                      revealedRecoverySectionIds.includes(String(section.id ?? ""))
                        ? "true"
                        : "false"
                    }
                    ref={(node) => {
                      sectionRevealRefs.current[String(section.id ?? "")] = node;
                    }}
                    tabIndex={-1}
                  >
                    <SectionComponent
                      section={section}
                      index={idx}
                      onChange={(_i, updated) => {
                        try {
                          updateSectionInDoc(updated as any);
                        } catch {
                          /* noop */
                        }
                      }}
                    />
                  </div>
                ))}
              </>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => String(s.id ?? ""))}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section, idx) => (
                    <SortableSection
                      key={String(section.id ?? "")}
                      section={section}
                      index={idx}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileReviewCard;
