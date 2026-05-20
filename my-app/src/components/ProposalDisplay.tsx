import React from "react";
import { useAction } from "convex/react";
import {
  Check,
  Copy,
  CornersIn,
  Eye,
  FileUser,
  MagnifyingGlass,
  Minus,
  Pencil,
  Plus,
  X,
} from "@/lib/icons";
import type { FormValues } from "./ProposalInputForm.schemas";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import { api } from "../../convex/_generated/api";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import FloatingAiToolbar, { type InlineAiActionId } from "./FloatingAiToolbar";
import FloatingSuggestionToolbar from "./FloatingSuggestionToolbar";
import { Menu } from "./ui/menu";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";
import { useDocumentPan } from "../hooks/use-document-pan";
import { useDocumentStageLayout } from "../hooks/use-document-stage-layout";
import { useDocumentViewportCentering } from "../hooks/use-document-viewport-centering";
import { ProposalDocumentRenderer } from "./proposal-render/ProposalDocumentRenderer";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { buildVerbatiProposalDocumentVars } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { resolveProposalRenderState } from "../lib/proposal-render-state";
import {
  readDocumentExportDebugConfig,
  setProposalPreviewDebugCapture,
} from "../lib/document-export-debug";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";
import {
  getTextareaSelectionState,
  isInlineAiToolbarActiveElement,
  isPrimaryPointerPressed,
  type EditorSelectionAnchor,
} from "../lib/editor-ai-selection";
import { resolveProposalCharacterLimitSelection } from "../../convex/lib/proposals/generationControls";
import type { ProposalApplicantHeaderData } from "../lib/proposal-personalization";
import {
  buildProposalRecipientDetails,
  parseProposalRecipientDetails,
  resolveProposalHeaderVisibility,
  type ProposalHeaderVisibility,
} from "../lib/proposal-header";
import { collectProposalFontDebugSnapshot } from "../lib/proposal-font-debug";
import type { ProposalSignatureSettings } from "../lib/proposal-signature-settings";
import type { ProposalClosingRef } from "../lib/proposal-closing";
import {
  createAiUndoSnapshot,
  normalizeEditorAiTextResult,
  replaceSelectedText,
  restoreAiUndoSnapshot,
  type AiUndoSnapshot,
} from "../lib/ai/applyAiSuggestion";
import {
  createAiInteractionId,
  recordAiInteractionEvent,
} from "../lib/ai/aiInteractionTelemetry";
import type { AiApplyMode, AiOutputMode } from "../lib/ai/interactionRulebook";
import {
  isEditorAiJobContextReady,
  normalizeEditorAiJobContext,
  type EditorAiJobContext,
} from "../lib/ai/editorAiJobContext";

interface ProposalDisplayProps {
  proposalContent: string | null;
  loading: boolean;
  error: string | null;
  statusMessage?: string | null;
  /** Raw backend error message — shown as dev-only diagnostic block */
  errorDetail?: string | null;
  proposalType?: FormValues["proposalType"] | null;
  fallbackInfo?: ProposalGenerationFallbackInfo | null;
  onCopy?: () => void;
  copyFeedback?: "idle" | "copied";
  voicePreset?: ProposalVoicePreset | null;
  templateId?: ProposalTemplateId | null;
  stylePreset?: Partial<VerbatiStylePreset> | VerbatiStylePreset | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  railTitle?: string | null;
  railMeta?: string | null;
  contactLine?: string | null;
  letterDate?: string | null;
  recipientDetails?: string | null;
  salutationValue?: string | null;
  documentTitle?: string | null;
  documentMeta?: string | null;
  applicantHeader?: ProposalApplicantHeaderData | null;
  headerVisibility?: ProposalHeaderVisibility | null;
  mode?: "preview" | "edit";
  onModeChange?: (mode: "preview" | "edit") => void;
  onPreviewInteract?: () => void;
  onContentChange?: (value: string) => void;
  onContentCommit?: () => void;
  editorAiJobContext?: EditorAiJobContext | null;
  actions?: React.ReactNode;
  railStartAddon?: React.ReactNode;
  railEndAddon?: React.ReactNode;
  showModeToggle?: boolean;
  size?: "default" | "focused";
  previewAnchor?: "top" | "body";
  previewFitMode?: "contain" | "width";
  previewScrollMode?: "contained" | "natural";
  hideDocumentHeader?: boolean;
  documentHeaderMode?: "full" | "actions-only" | "hidden";
  showZoomControls?: boolean;
  zoomStorageKey?: string | null;
  zoomIndex?: number | null;
  onZoomIndexChange?: (index: number) => void;
  detachedActionHeader?: boolean;
  detachedActionHeaderSupplement?: React.ReactNode;
  documentTitleEditable?: boolean;
  onDocumentTitleChange?: (value: string) => void;
  onDocumentTitleCommit?: () => void;
  documentTitlePlaceholder?: string;
  onRailTitleChange?: (value: string) => void;
  onRailMetaChange?: (value: string) => void;
  contactLineEditable?: boolean;
  onContactLineChange?: (value: string) => void;
  onContactLineCommit?: () => void;
  letterDateEditable?: boolean;
  onLetterDateChange?: (value: string) => void;
  recipientDetailsEditable?: boolean;
  onRecipientDetailsChange?: (value: string) => void;
  salutationEditable?: boolean;
  salutationPlaceholder?: string;
  onSalutationChange?: (value: string) => void;
  onHeaderVisibilityChange?: (
    value:
      | Partial<ProposalHeaderVisibility>
      | ((
          current: ProposalHeaderVisibility,
        ) => Partial<ProposalHeaderVisibility>),
  ) => void;
  showDocumentCaption?: boolean;
  characterLimit?: number | null;
  characterLimitAdvisory?: boolean;
  showPreviewParagraphActions?: boolean;
  showPageCountBadge?: boolean;
}

const PREVIEW_PARAGRAPH_ACTIONS: Array<{
  id: InlineAiActionId;
  label: string;
  helperLabel: string;
}> = [
  {
    id: "rewrite",
    label: "Rewrite",
    helperLabel: "Rewrite",
  },
  {
    id: "shorten",
    label: "Shorten",
    helperLabel: "Shorten",
  },
  {
    id: "custom",
    label: "Ask",
    helperLabel: "Ask",
  },
];

type ProposalAiSuggestion = {
  actionId: InlineAiActionId;
  actionLabel: string;
  interactionId: string;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  beforeText: string;
  afterText: string;
  selection: { start: number; end: number };
  anchor: EditorSelectionAnchor;
  status: "preview" | "accepted";
  undoSnapshot?: AiUndoSnapshot<string>;
};

function isInlineAiToolbarTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    ? Boolean(target.closest("[data-inline-ai-toolbar='true']"))
    : false;
}

function getInlineProofingTextParts(
  content: string,
  suggestion: ProposalAiSuggestion,
): {
  before: string;
  selected: string;
  replacement: string;
  after: string;
} {
  const start = Math.max(
    0,
    Math.min(suggestion.selection.start, content.length),
  );
  const end = Math.max(
    start,
    Math.min(suggestion.selection.end, content.length),
  );

  if (suggestion.status === "accepted") {
    const replacementEnd = Math.max(
      start,
      Math.min(start + suggestion.afterText.length, content.length),
    );

    return {
      before: content.slice(0, start),
      selected: content.slice(start, replacementEnd),
      replacement: "",
      after: content.slice(replacementEnd),
    };
  }

  return {
    before: content.slice(0, start),
    selected: content.slice(start, end),
    replacement: suggestion.afterText,
    after: content.slice(end),
  };
}

function getInlineSelectionTextParts(
  content: string,
  selection: { start: number; end: number },
): {
  before: string;
  selected: string;
  after: string;
} {
  const start = Math.max(0, Math.min(selection.start, content.length));
  const end = Math.max(start, Math.min(selection.end, content.length));

  return {
    before: content.slice(0, start),
    selected: content.slice(start, end),
    after: content.slice(end),
  };
}

function ProposalInlineProofingOverlay({
  content,
  documentTypography,
  suggestion,
  scrollTop,
}: {
  content: string;
  documentTypography: ReturnType<typeof getProposalDocumentTypography>;
  suggestion: ProposalAiSuggestion;
  scrollTop: number;
}) {
  const parts = getInlineProofingTextParts(content, suggestion);
  const isAccepted = suggestion.status === "accepted";
  const textRunStyle: React.CSSProperties = {
    fontFamily: documentTypography.fontFamily,
    fontSize: "var(--tb)",
    lineHeight: documentTypography.lineHeight,
    fontWeight: documentTypography.fontWeight,
    letterSpacing: documentTypography.letterSpacing,
    color: "var(--proposal-document-ink)",
  };
  return (
    <div
      className="dasti-proposal-inline-proofing"
      data-state={suggestion.status}
      role="group"
      aria-label={`${suggestion.actionLabel} inline suggestion`}
      style={{
        transform: `translateY(-${scrollTop}px)`,
      }}
    >
      <span
        className="dasti-proposal-inline-proofing__text-run"
        style={textRunStyle}
      >
        {parts.before}
      </span>
      {isAccepted ? (
        <span
          className="dasti-proposal-inline-proofing__text-run dasti-proposal-inline-proofing__accepted"
          style={textRunStyle}
        >
          {parts.selected}
        </span>
      ) : (
        <>
          <span
            className="ds-diff-block__old dasti-proposal-inline-proofing__text-run dasti-proposal-inline-proofing__old"
            style={textRunStyle}
          >
            {parts.selected}
          </span>{" "}
          <span
            className="ds-diff-block__new dasti-proposal-inline-proofing__text-run dasti-proposal-inline-proofing__new"
            style={textRunStyle}
          >
            {parts.replacement}
          </span>
        </>
      )}
      <span
        className="dasti-proposal-inline-proofing__text-run"
        style={textRunStyle}
      >
        {parts.after}
      </span>
    </div>
  );
}

function ProposalInlineSelectionOverlay({
  content,
  documentTypography,
  selection,
  scrollTop,
}: {
  content: string;
  documentTypography: ReturnType<typeof getProposalDocumentTypography>;
  selection: { start: number; end: number };
  scrollTop: number;
}) {
  const parts = getInlineSelectionTextParts(content, selection);
  const textRunStyle: React.CSSProperties = {
    fontFamily: documentTypography.fontFamily,
    fontSize: "var(--tb)",
    lineHeight: documentTypography.lineHeight,
    fontWeight: documentTypography.fontWeight,
    letterSpacing: documentTypography.letterSpacing,
    color: "var(--proposal-document-ink)",
  };

  return (
    <div
      className="dasti-proposal-inline-proofing dasti-proposal-inline-proofing--selection"
      data-inline-ai-selection-overlay="true"
      aria-hidden="true"
      style={{
        transform: `translateY(-${scrollTop}px)`,
      }}
    >
      <span
        className="dasti-proposal-inline-proofing__text-run"
        style={textRunStyle}
      >
        {parts.before}
      </span>
      <span
        className="dasti-proposal-inline-proofing__text-run dasti-proposal-inline-proofing__selection"
        style={textRunStyle}
      >
        {parts.selected}
      </span>
      <span
        className="dasti-proposal-inline-proofing__text-run"
        style={textRunStyle}
      >
        {parts.after}
      </span>
    </div>
  );
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderPlainLetterBody(content: string) {
  const normalized = content
    .split("\n")
    .map((line) => stripInlineMarkdown(line))
    .join("\n");

  if (!normalized) {
    return (
      <div
        style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          fontWeight: "inherit",
          letterSpacing: "inherit",
          color: "inherit",
          whiteSpace: "pre-wrap",
        }}
      >
        {stripInlineMarkdown(content)}
      </div>
    );
  }

  return (
    <div
      style={{
        margin: 0,
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontWeight: "inherit",
        letterSpacing: "inherit",
        color: "inherit",
        whiteSpace: "pre-wrap",
      }}
    >
      {normalized}
    </div>
  );
}

function renderPlainPreviewBody(content: string) {
  return (
    <div
      style={{
        margin: 0,
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontWeight: "inherit",
        letterSpacing: "inherit",
        color: "inherit",
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </div>
  );
}

export function getDisplayedProposalText(
  content: string,
  proposalType?: FormValues["proposalType"] | null,
): string {
  if (
    proposalType === "cover_letter" ||
    proposalType === "application_message"
  ) {
    return content
      .split(/\n\s*\n/)
      .map((part) => stripInlineMarkdown(part))
      .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  return content
    .split("\n")
    .map((line) => stripInlineMarkdown(line))
    .join("\n")
    .trim();
}

export function fallbackCopyText(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied =
      typeof document.execCommand === "function"
        ? document.execCommand("copy")
        : false;
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

const isDev = import.meta.env.DEV;
const PROPOSAL_PREVIEW_ZOOM_STORAGE_KEY =
  "dasti:proposal-preview-zoom-index:v1";
const PROPOSAL_PREVIEW_ZOOM_STEPS: readonly number[] = [
  0.3, 0.5, 0.8, 1, 1.25, 1.5, 2,
];
const PROPOSAL_PREVIEW_ZOOM_DEFAULT_INDEX = 3;
const PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL =
  PROPOSAL_PREVIEW_ZOOM_STEPS[PROPOSAL_PREVIEW_ZOOM_DEFAULT_INDEX];
const PROPOSAL_PREVIEW_ZOOM_MIN = PROPOSAL_PREVIEW_ZOOM_STEPS[0];
const PROPOSAL_PREVIEW_ZOOM_MAX =
  PROPOSAL_PREVIEW_ZOOM_STEPS[PROPOSAL_PREVIEW_ZOOM_STEPS.length - 1];
const PROPOSAL_PREVIEW_ZOOM_SLIDER_STEP = 0.01;
const PROPOSAL_PREVIEW_ZOOM_BUTTON_STEP = 0.1;

function formatProposalZoomOptionLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function readProposalZoomLevel(_storageKey: string | null | undefined): number {
  return PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL;
}

function clampProposalZoomIndex(value: number): number {
  return Math.min(
    PROPOSAL_PREVIEW_ZOOM_STEPS.length - 1,
    Math.max(0, Math.round(value)),
  );
}

function clampProposalZoomLevel(value: number): number {
  if (!Number.isFinite(value)) return PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL;
  return Math.min(
    PROPOSAL_PREVIEW_ZOOM_MAX,
    Math.max(PROPOSAL_PREVIEW_ZOOM_MIN, value),
  );
}

function getNearestProposalZoomIndex(value: number): number {
  let nearestIndex = PROPOSAL_PREVIEW_ZOOM_DEFAULT_INDEX;
  let nearestDistance = Number.POSITIVE_INFINITY;
  PROPOSAL_PREVIEW_ZOOM_STEPS.forEach((step, index) => {
    const distance = Math.abs(step - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function proposalZoomLevelsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

const ProposalDisplay: React.FC<ProposalDisplayProps> = ({
  proposalContent,
  loading,
  error,
  statusMessage = null,
  errorDetail = null,
  proposalType,
  fallbackInfo = null,
  onCopy,
  copyFeedback = "idle",
  voicePreset = null,
  templateId = null,
  stylePreset = null,
  signatureSettings = null,
  closing = null,
  railTitle = null,
  railMeta = null,
  contactLine = null,
  letterDate = null,
  recipientDetails = null,
  salutationValue = null,
  documentTitle = null,
  documentMeta = null,
  applicantHeader = null,
  headerVisibility = null,
  mode = "preview",
  onModeChange,
  onPreviewInteract,
  onContentChange,
  onContentCommit,
  editorAiJobContext = null,
  actions,
  railStartAddon,
  railEndAddon,
  showModeToggle: allowModeToggle = true,
  size = "default",
  previewAnchor = "top",
  previewFitMode = "contain",
  previewScrollMode = "contained",
  hideDocumentHeader = false,
  documentHeaderMode = "full",
  showZoomControls = false,
  zoomStorageKey = PROPOSAL_PREVIEW_ZOOM_STORAGE_KEY,
  zoomIndex: controlledZoomIndex = null,
  onZoomIndexChange,
  detachedActionHeader = false,
  detachedActionHeaderSupplement,
  documentTitleEditable = false,
  onDocumentTitleChange,
  onDocumentTitleCommit,
  documentTitlePlaceholder = "Proposal title",
  onRailTitleChange,
  onRailMetaChange,
  contactLineEditable = false,
  onContactLineChange,
  onContactLineCommit,
  letterDateEditable = false,
  onLetterDateChange,
  recipientDetailsEditable = false,
  onRecipientDetailsChange,
  salutationEditable = false,
  salutationPlaceholder = "Dear Hiring Manager,",
  onSalutationChange,
  onHeaderVisibilityChange,
  showDocumentCaption = true,
  showPreviewParagraphActions = true,
}) => {
  const resolvedRenderState = React.useMemo(
    () =>
      resolveProposalRenderState({
        preferredStylePreset: stylePreset,
        preferredTemplateId: templateId,
      }),
    [stylePreset, templateId],
  );
  const resolvedStylePreset = resolvedRenderState.stylePreset;
  const resolvedTemplateId = resolvedRenderState.templateId;
  const fallbackDisclosure = getProposalGenerationFallbackDisclosureMessage(
    fallbackInfo ?? {},
  );
  const documentTypography = getProposalDocumentTypography(
    voicePreset,
    resolvedStylePreset,
  );
  const transformEditorSelectionAction = useAction(
    (api.functions as any).transformEditorSelection,
  );
  const displayedProposalText = React.useMemo(
    () =>
      proposalContent
        ? getDisplayedProposalText(proposalContent, proposalType)
        : "",
    [proposalContent, proposalType],
  );
  const proposalDocumentThemeVars = React.useMemo(
    () => buildVerbatiProposalDocumentVars(resolvedStylePreset),
    [resolvedStylePreset],
  );
  const isEditable = mode === "edit" && Boolean(onContentChange);
  const normalizedEditorAiJobContext = React.useMemo(
    () => normalizeEditorAiJobContext(editorAiJobContext),
    [editorAiJobContext],
  );
  const hasEditorAiJobContext = isEditorAiJobContextReady(
    normalizedEditorAiJobContext,
  );

  const [internalZoomLevel, setInternalZoomLevel] = React.useState(() =>
    readProposalZoomLevel(zoomStorageKey),
  );
  const [isZoomMenuOpen, setIsZoomMenuOpen] = React.useState(false);
  const [documentPageCount, setDocumentPageCount] = React.useState(1);
  const [fitRequestCount, setFitRequestCount] = React.useState(0);
  const [isApplyingInlineAi, setIsApplyingInlineAi] = React.useState(false);
  const [pendingInlineAiActionId, setPendingInlineAiActionId] =
    React.useState<InlineAiActionId | null>(null);
  const [aiSuggestion, setAiSuggestion] =
    React.useState<ProposalAiSuggestion | null>(null);
  const [queuedPreviewActionLabel, setQueuedPreviewActionLabel] =
    React.useState<string | null>(null);
  const [isApplicantDrawerOpen, setIsApplicantDrawerOpen] =
    React.useState(false);
  const [textareaSelectionState, setTextareaSelectionState] = React.useState<{
    text: string;
    anchor: EditorSelectionAnchor;
    start: number;
    end: number;
  } | null>(null);
  const [editableTextareaScrollTop, setEditableTextareaScrollTop] =
    React.useState(0);
  const [editableTextareaBlockSize, setEditableTextareaBlockSize] =
    React.useState(0);
  const isZoomControlled = typeof controlledZoomIndex === "number";
  const controlledZoomLevel = isZoomControlled
    ? PROPOSAL_PREVIEW_ZOOM_STEPS[clampProposalZoomIndex(controlledZoomIndex)]
    : null;
  const zoomLevel = isZoomControlled
    ? (controlledZoomLevel ?? PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL)
    : internalZoomLevel;
  const nearestZoomIndex = getNearestProposalZoomIndex(zoomLevel);
  const isDefaultZoom = proposalZoomLevelsEqual(
    zoomLevel,
    PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL,
  );
  const setZoomLevel = React.useCallback(
    (nextValue: number | ((currentLevel: number) => number)) => {
      const resolvedLevel = clampProposalZoomLevel(
        typeof nextValue === "function" ? nextValue(zoomLevel) : nextValue,
      );

      if (!isZoomControlled) {
        setInternalZoomLevel(resolvedLevel);
      }

      onZoomIndexChange?.(getNearestProposalZoomIndex(resolvedLevel));
    },
    [isZoomControlled, onZoomIndexChange, zoomLevel],
  );
  const editableTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const editablePageRef = React.useRef<HTMLDivElement | null>(null);
  const viewerSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const selectionDebounceRef = React.useRef<number | null>(null);
  const queuedPreviewActionTimeoutRef = React.useRef<number | null>(null);
  const zoomMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (
      !proposalContent ||
      loading ||
      error ||
      typeof window === "undefined" ||
      !readDocumentExportDebugConfig()
    ) {
      return undefined;
    }

    let cancelled = false;

    const capturePreviewState = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue even if the browser cannot expose font readiness.
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      if (cancelled || !viewerSurfaceRef.current) {
        return;
      }

      setProposalPreviewDebugCapture({
        source: "live-preview",
        templateId: resolvedTemplateId,
        stylePreset: resolvedStylePreset,
        serializedThemeVars: Object.fromEntries(
          Object.entries(proposalDocumentThemeVars).map(([key, value]) => [
            key,
            String(value ?? ""),
          ]),
        ),
        snapshot: collectProposalFontDebugSnapshot({
          root: viewerSurfaceRef.current,
          stylePreset: resolvedStylePreset,
          templateId: resolvedTemplateId,
          voicePreset: voicePreset ?? null,
        }),
        timestamp: Date.now(),
      });
    };

    void capturePreviewState();

    return () => {
      cancelled = true;
    };
  }, [
    error,
    loading,
    proposalContent,
    proposalDocumentThemeVars,
    resolvedStylePreset,
    resolvedTemplateId,
    voicePreset,
  ]);

  const {
    attach: attachEditableScrollEdges,
    showTop: showEditableScrollTop,
    showBottom: showEditableScrollBottom,
    topStrength: editableScrollTopStrength,
    bottomStrength: editableScrollBottomStrength,
    update: updateEditableScrollEdges,
  } = useScrollEdgeFades<HTMLDivElement>();
  const {
    attach: attachPreviewScrollEdges,
    showTop: showPreviewScrollTop,
    showBottom: showPreviewScrollBottom,
    topStrength: previewScrollTopStrength,
    bottomStrength: previewScrollBottomStrength,
    update: updatePreviewScrollEdges,
  } = useScrollEdgeFades<HTMLDivElement>();
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const editableScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const showModeToggle = Boolean(
    allowModeToggle && onModeChange && proposalContent && !loading && !error,
  );
  const resolvedDocumentHeaderMode = hideDocumentHeader
    ? "hidden"
    : documentHeaderMode;
  const shouldDetachActionHeader =
    detachedActionHeader && resolvedDocumentHeaderMode === "actions-only";
  const hasDocumentCaption =
    showDocumentCaption &&
    resolvedDocumentHeaderMode !== "hidden" &&
    Boolean(documentTitle && documentTitle.trim().length > 0);
  const usesDocumentRenderer =
    proposalType === "cover_letter" ||
    proposalType === "application_message" ||
    proposalType === "freelance_proposal";
  const canEditApplicantHeader = Boolean(
    documentTitleEditable ||
      contactLineEditable ||
      letterDateEditable ||
      recipientDetailsEditable ||
      salutationEditable ||
      onRailTitleChange ||
      onRailMetaChange,
  );
  const hasDocumentShell =
    usesDocumentRenderer &&
    (Boolean(proposalContent) || isEditable || canEditApplicantHeader);
  const applicantDisplayName =
    typeof railTitle === "string"
      ? railTitle.trim()
      : applicantHeader?.name?.trim() || "Applicant name";
  const applicantDisplayRole =
    typeof railMeta === "string"
      ? railMeta.trim()
      : applicantHeader?.role?.trim() || "Applicant role";
  const resolvedHeaderVisibility = React.useMemo(
    () => resolveProposalHeaderVisibility(headerVisibility),
    [headerVisibility],
  );
  const recipientFields = React.useMemo(
    () => parseProposalRecipientDetails(recipientDetails),
    [recipientDetails],
  );
  const handleHeaderVisibilityChange = React.useCallback(
    (nextValue: Partial<ProposalHeaderVisibility>) => {
      onHeaderVisibilityChange?.((current) => {
        const resolvedCurrent = resolveProposalHeaderVisibility(current);
        const nextVisibility = {
          ...resolvedCurrent,
          ...nextValue,
        };

        if (!nextVisibility.showRecipient) {
          nextVisibility.showRecipientDetails = false;
        }

        return nextVisibility;
      });
    },
    [onHeaderVisibilityChange],
  );
  const handleRecipientFieldChange = React.useCallback(
    (
      field: "name" | "role" | "company" | "address" | "email" | "city",
      value: string,
    ) => {
      onRecipientDetailsChange?.(
        buildProposalRecipientDetails({
          ...recipientFields,
          [field]: value,
        }),
      );
    },
    [onRecipientDetailsChange, recipientFields],
  );
  const applicantDrawerId = React.useId();
  const headerVisibilityTitleId = React.useId();
  const applicantCardTitleId = React.useId();
  const recipientCardTitleId = React.useId();
  const letterDetailsCardTitleId = React.useId();
  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";
  const isDocumentEditor = isEditable && usesDocumentRenderer;
  const effectiveZoomLevel = isEditable ? 1 : zoomLevel;
  const enablesDocumentZoom =
    showZoomControls &&
    !loading &&
    !error &&
    hasDocumentShell &&
    usesDocumentRenderer &&
    !isEditable;
  const shouldRenderZoomFooter =
    enablesDocumentZoom && resolvedDocumentHeaderMode === "hidden";
  const shouldUseParentPreviewMeasurement =
    shouldRenderZoomFooter && previewScrollMode === "natural";
  const activeScrollTop = isEditable
    ? showEditableScrollTop
    : showPreviewScrollTop;
  const activeScrollBottom = isEditable
    ? showEditableScrollBottom
    : showPreviewScrollBottom;
  const activeScrollTopStrength = isEditable
    ? editableScrollTopStrength
    : previewScrollTopStrength;
  const activeScrollBottomStrength = isEditable
    ? editableScrollBottomStrength
    : previewScrollBottomStrength;
  const activeScrollFadeStyle = {
    "--proposal-scroll-top-strength": activeScrollTopStrength.toFixed(3),
    "--proposal-scroll-bottom-strength": activeScrollBottomStrength.toFixed(3),
  } as React.CSSProperties;
  const visibleZoomPercent = `${Math.round(zoomLevel * 100)}%`;
  const stageLayout = useDocumentStageLayout({
    enabled: hasDocumentShell,
    measurementRef: stageMeasureRef,
    zoomLevel: effectiveZoomLevel,
    fitMode: usesDocumentRenderer && !isEditable ? previewFitMode : "width",
    fillAvailableOnZoom:
      usesDocumentRenderer && !isEditable && previewFitMode === "contain",
    includeParentMeasurement: shouldUseParentPreviewMeasurement,
    pageWidthPx: A4_PAGE_WIDTH_PX,
    pageHeightPx: A4_PAGE_HEIGHT_PX,
    initialAvailableWidthPx: A4_PAGE_WIDTH_PX,
    initialAvailableHeightPx: A4_PAGE_HEIGHT_PX,
  });
  const stageLayoutVars =
    hasDocumentShell
      ? ({
          "--document-stage-width": `${stageLayout.stageWidth}px`,
          "--document-stage-height": `${stageLayout.stageHeight}px`,
          "--document-page-width": `${stageLayout.pageWidth}px`,
          "--document-page-height": `${stageLayout.pageHeight}px`,
        } as React.CSSProperties)
      : undefined;
  React.useEffect(() => {
    if (!isEditable) {
      setIsApplicantDrawerOpen(false);
    }
  }, [isEditable]);
  const documentPageGapPx =
    usesDocumentRenderer && !isEditable
      ? Math.max(
          12,
          Math.round(24 * (stageLayout.pageWidth / A4_PAGE_WIDTH_PX)),
        )
      : 0;
  const previewDocumentScale =
    usesDocumentRenderer && !isEditable && stageLayout.pageWidth > 0
      ? stageLayout.pageWidth / A4_PAGE_WIDTH_PX
      : 1;
  const unscaledDocumentPageGapPx =
    usesDocumentRenderer && !isEditable && previewDocumentScale > 0
      ? documentPageGapPx / previewDocumentScale
      : documentPageGapPx;
  const renderedDocumentHeight =
    usesDocumentRenderer && !isEditable
      ? stageLayout.pageHeight * Math.max(1, documentPageCount) +
        documentPageGapPx * Math.max(0, documentPageCount - 1)
      : usesDocumentRenderer && isEditable
        ? Math.max(stageLayout.pageHeight, editableTextareaBlockSize)
        : stageLayout.pageHeight;
  const renderedUnscaledDocumentHeight =
    usesDocumentRenderer && !isEditable
      ? A4_PAGE_HEIGHT_PX * Math.max(1, documentPageCount) +
        unscaledDocumentPageGapPx * Math.max(0, documentPageCount - 1)
      : renderedDocumentHeight;
  const isMultiPagePreview =
    usesDocumentRenderer && !isEditable && documentPageCount > 1;
  const previewStageMode =
    usesDocumentRenderer && !isEditable
      ? previewScrollMode === "natural"
        ? "overflow"
        : renderedDocumentHeight > stageLayout.stageHeight + 1 ||
            stageLayout.overflowX ||
            stageLayout.overflowY
          ? "overflow"
          : "fit"
      : "fit";
  const shouldFitPreviewStageToPage =
    shouldRenderZoomFooter && previewScrollMode === "natural";
  const previewStageWidthPx = shouldFitPreviewStageToPage
    ? stageLayout.pageWidth
    : stageLayout.stageWidth;
  const previewStageHeightPx = shouldFitPreviewStageToPage
    ? renderedDocumentHeight
    : stageLayout.stageHeight;
  const resolveBodyClassName = React.useCallback(
    ({
      isReadonly = false,
      letterLike = false,
      documentEditor = false,
    }: {
      isReadonly?: boolean;
      letterLike?: boolean;
      documentEditor?: boolean;
    } = {}) => {
      const classNames = ["dasti-proposal-sheet__body"];

      if (isReadonly) {
        classNames.push("dasti-proposal-sheet__body--readonly");
      }
      if (usesDocumentRenderer) {
        classNames.push("dasti-proposal-sheet__body--document-viewer");
      }
      if (documentEditor) {
        classNames.push("dasti-proposal-sheet__body--document-editor");
      }
      if (letterLike) {
        classNames.push("dasti-proposal-sheet__body--letter");
      }

      return classNames.join(" ");
    },
    [usesDocumentRenderer],
  );

  React.useEffect(() => {
    updateEditableScrollEdges();
    updatePreviewScrollEdges();
  }, [
    contactLine,
    documentMeta,
    documentTitle,
    isEditable,
    proposalContent,
    proposalType,
    railMeta,
    railTitle,
    size,
    updateEditableScrollEdges,
    updatePreviewScrollEdges,
  ]);

  React.useEffect(() => {
    if (isZoomControlled) {
      return;
    }

    setInternalZoomLevel(readProposalZoomLevel(zoomStorageKey));
    setFitRequestCount((count) => count + 1);
  }, [isZoomControlled, zoomStorageKey]);

  React.useEffect(() => {
    if (!isZoomMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !zoomMenuRef.current?.contains(target)) {
        setIsZoomMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsZoomMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isZoomMenuOpen]);

  React.useEffect(() => {
    return () => {
      if (selectionDebounceRef.current !== null) {
        window.clearTimeout(selectionDebounceRef.current);
      }
      if (queuedPreviewActionTimeoutRef.current !== null) {
        window.clearTimeout(queuedPreviewActionTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isEditable) {
      setTextareaSelectionState(null);
      setAiSuggestion(null);
    }
  }, [isEditable]);

  React.useEffect(() => {
    if (queuedPreviewActionTimeoutRef.current !== null) {
      window.clearTimeout(queuedPreviewActionTimeoutRef.current);
      queuedPreviewActionTimeoutRef.current = null;
    }

    if (!isEditable) {
      setQueuedPreviewActionLabel(null);
      return;
    }

    if (queuedPreviewActionLabel) {
      window.setTimeout(() => {
        editableTextareaRef.current?.focus();
      }, 0);
      queuedPreviewActionTimeoutRef.current = window.setTimeout(() => {
        setQueuedPreviewActionLabel(null);
        queuedPreviewActionTimeoutRef.current = null;
      }, 4000);
    }

    return () => {
      if (queuedPreviewActionTimeoutRef.current !== null) {
        window.clearTimeout(queuedPreviewActionTimeoutRef.current);
        queuedPreviewActionTimeoutRef.current = null;
      }
    };
  }, [isEditable, queuedPreviewActionLabel]);

  React.useEffect(() => {
    if (textareaSelectionState) {
      setQueuedPreviewActionLabel(null);
    }
  }, [textareaSelectionState]);

  const syncEditableTextareaBlockSize = React.useCallback(() => {
    const textarea = editableTextareaRef.current;
    if (!textarea || !isEditable || !usesDocumentRenderer) {
      setEditableTextareaBlockSize(0);
      return;
    }

    const nextBlockSize = Math.ceil(textarea.scrollHeight);
    setEditableTextareaBlockSize((current) =>
      Math.abs(current - nextBlockSize) > 0.5 ? nextBlockSize : current,
    );
  }, [isEditable, usesDocumentRenderer]);

  React.useEffect(() => {
    if (isEditable) {
      setIsZoomMenuOpen(false);
    }
  }, [isEditable]);

  React.useLayoutEffect(() => {
    if (!isEditable || !usesDocumentRenderer || typeof window === "undefined") {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      syncEditableTextareaBlockSize();
      updateEditableScrollEdges();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    isEditable,
    syncEditableTextareaBlockSize,
    updateEditableScrollEdges,
    usesDocumentRenderer,
  ]);

  React.useEffect(() => {
    if (!proposalContent || isEditable || !usesDocumentRenderer) {
      setDocumentPageCount(1);
    }
  }, [isEditable, proposalContent, usesDocumentRenderer]);

  React.useLayoutEffect(() => {
    if (!isEditable || !usesDocumentRenderer) {
      setEditableTextareaBlockSize(0);
      return undefined;
    }

    const frame = window.requestAnimationFrame(syncEditableTextareaBlockSize);
    const textarea = editableTextareaRef.current;
    const resizeObserver =
      textarea && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncEditableTextareaBlockSize)
        : null;

    if (textarea) {
      resizeObserver?.observe(textarea);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [
    isEditable,
    proposalContent,
    syncEditableTextareaBlockSize,
    usesDocumentRenderer,
  ]);

  const runTextareaSelectionCheck = React.useCallback(() => {
    if (isPrimaryPointerPressed()) {
      return;
    }
    const nextSelection = getTextareaSelectionState(
      editableTextareaRef.current,
    );
    if (!nextSelection && isInlineAiToolbarActiveElement()) {
      return;
    }
    setTextareaSelectionState(nextSelection);
  }, []);

  const scheduleTextareaSelectionCheck = React.useCallback(
    (immediate = false) => {
      if (selectionDebounceRef.current !== null) {
        window.clearTimeout(selectionDebounceRef.current);
      }

      if (immediate) {
        runTextareaSelectionCheck();
        return;
      }

      selectionDebounceRef.current = window.setTimeout(() => {
        selectionDebounceRef.current = null;
        runTextareaSelectionCheck();
      }, 90);
    },
    [runTextareaSelectionCheck],
  );

  React.useEffect(() => {
    if (!isEditable) {
      return undefined;
    }

    const handleSelectionChange = () => {
      scheduleTextareaSelectionCheck();
    };
    const handlePointerUp = () => {
      scheduleTextareaSelectionCheck();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isEditable, scheduleTextareaSelectionCheck]);

  React.useEffect(() => {
    if (!isEditable || !textareaSelectionState) {
      return undefined;
    }

    const textarea = editableTextareaRef.current;
    const handleReposition = () => {
      scheduleTextareaSelectionCheck(true);
    };
    const resizeObserver =
      textarea && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleReposition)
        : null;

    if (textarea) {
      resizeObserver?.observe(textarea);
    }

    window.addEventListener("resize", handleReposition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleReposition);
    };
  }, [isEditable, scheduleTextareaSelectionCheck, textareaSelectionState]);

  const handleRunInlineAiAction = React.useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!textareaSelectionState || !proposalContent) return;

      const interactionId = createAiInteractionId();
      const startedAt = window.performance.now();
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "proposal_editor",
        actionId,
      });

      try {
        setPendingInlineAiActionId(actionId);
        setIsApplyingInlineAi(true);
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: textareaSelectionState.text,
          ...(actionId === "tailor_to_job" && normalizedEditorAiJobContext
            ? { jobContext: normalizedEditorAiJobContext }
            : {}),
        });
        const normalizedResult = normalizeEditorAiTextResult(result, actionId);
        if (!normalizedResult) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "proposal_editor",
            actionId,
            errorKind: "empty_result",
          });
          return;
        }

        console.info("[ProposalDisplay] editor AI model used", {
          requestedActionId: actionId,
          actionId: normalizedResult.actionId,
          actualModelProvider: normalizedResult.actualModelProvider,
          actualModelName: normalizedResult.actualModelName,
          fallbackUsed: normalizedResult.fallbackUsed,
          durationMs: Math.round(window.performance.now() - startedAt),
        });

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "proposal_editor",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });

        const suggestionBase = {
          actionId: normalizedResult.actionId,
          actionLabel: normalizedResult.actionLabel,
          interactionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
          beforeText: textareaSelectionState.text,
          afterText: normalizedResult.text,
          selection: {
            start: textareaSelectionState.start,
            end: textareaSelectionState.end,
          },
          anchor: textareaSelectionState.anchor,
        };

        const shouldPreviewBeforeApply =
          normalizedResult.applyMode === "preview_required" ||
          normalizedResult.actionId === "shorten";

        if (shouldPreviewBeforeApply) {
          setAiSuggestion({
            ...suggestionBase,
            status: "preview",
          });
          return;
        }

        const nextContent = replaceSelectedText({
          text: proposalContent,
          selection: textareaSelectionState,
          replacementText: normalizedResult.text,
        });
        onContentChange?.(nextContent);
        setAiSuggestion({
          ...suggestionBase,
          status: "accepted",
          undoSnapshot: createAiUndoSnapshot(proposalContent, nextContent),
        });
        recordAiInteractionEvent({
          name: "ai_accepted",
          interactionId,
          surface: "proposal_editor",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });

        window.setTimeout(() => {
          const textarea = editableTextareaRef.current;
          if (!textarea) return;
          const selectionEnd =
            textareaSelectionState.start + normalizedResult.text.length;
          textarea.focus();
          textarea.setSelectionRange(selectionEnd, selectionEnd);
        }, 0);
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "proposal_editor",
          actionId,
          errorKind: "request_failed",
        });
        throw error;
      } finally {
        setIsApplyingInlineAi(false);
        setPendingInlineAiActionId(null);
      }
    },
    [
      onContentChange,
      proposalContent,
      normalizedEditorAiJobContext,
      textareaSelectionState,
      transformEditorSelectionAction,
    ],
  );

  const handleAcceptAiSuggestion = React.useCallback(() => {
    if (!aiSuggestion || !proposalContent) return;

    const nextContent = replaceSelectedText({
      text: proposalContent,
      selection: aiSuggestion.selection,
      replacementText: aiSuggestion.afterText,
    });
    onContentChange?.(nextContent);
    setAiSuggestion({
      ...aiSuggestion,
      status: "accepted",
      undoSnapshot: createAiUndoSnapshot(proposalContent, nextContent),
    });
    recordAiInteractionEvent({
      name: "ai_accepted",
      interactionId: aiSuggestion.interactionId,
      surface: "proposal_editor",
      actionId: aiSuggestion.actionId,
      applyMode: aiSuggestion.applyMode,
      outputMode: aiSuggestion.outputMode,
    });
    window.setTimeout(() => {
      const textarea = editableTextareaRef.current;
      if (!textarea) return;
      const selectionEnd =
        aiSuggestion.selection.start + aiSuggestion.afterText.length;
      textarea.focus();
      textarea.setSelectionRange(selectionEnd, selectionEnd);
    }, 0);
  }, [aiSuggestion, onContentChange, proposalContent]);

  const handleUndoAiSuggestion = React.useCallback(() => {
    if (!aiSuggestion?.undoSnapshot) return;
    onContentChange?.(restoreAiUndoSnapshot(aiSuggestion.undoSnapshot));
    recordAiInteractionEvent({
      name: "ai_undone",
      interactionId: aiSuggestion.interactionId,
      surface: "proposal_editor",
      actionId: aiSuggestion.actionId,
      applyMode: aiSuggestion.applyMode,
      outputMode: aiSuggestion.outputMode,
    });
    setAiSuggestion(null);
  }, [aiSuggestion, onContentChange]);

  const handleDiscardAiSuggestion = React.useCallback(() => {
    if (!aiSuggestion) return;
    recordAiInteractionEvent({
      name: "ai_discarded",
      interactionId: aiSuggestion.interactionId,
      surface: "proposal_editor",
      actionId: aiSuggestion.actionId,
      applyMode: aiSuggestion.applyMode,
      outputMode: aiSuggestion.outputMode,
    });
    setAiSuggestion(null);
  }, [aiSuggestion]);

  const handleDismissAiSuggestion = React.useCallback(() => {
    setAiSuggestion(null);
  }, []);

  const inlineProofingOverlay =
    isEditable && aiSuggestion && proposalContent ? (
      <ProposalInlineProofingOverlay
        content={proposalContent}
        documentTypography={documentTypography}
        suggestion={aiSuggestion}
        scrollTop={editableTextareaScrollTop}
      />
    ) : null;
  const inlineSelectionOverlay = null;
  const shouldMirrorTextareaSelection = Boolean(aiSuggestion);

  const handlePreviewParagraphAction = React.useCallback(
    (label: string) => {
      setQueuedPreviewActionLabel(label);
      onModeChange?.("edit");
    },
    [onModeChange],
  );

  const attachPreviewScrollContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      attachPreviewScrollEdges(node);
    },
    [attachPreviewScrollEdges],
  );
  const attachEditableScrollContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      editableScrollContainerRef.current = node;
      attachEditableScrollEdges(node);
    },
    [attachEditableScrollEdges],
  );
  const attachEditableTextarea = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      editableTextareaRef.current = node;
      if (node) {
        window.requestAnimationFrame(syncEditableTextareaBlockSize);
      }
    },
    [syncEditableTextareaBlockSize],
  );
  const { attachViewport: attachPanViewport, viewportPanProps } =
    useDocumentPan({
      enabled: enablesDocumentZoom && effectiveZoomLevel > 1,
      onPan: updatePreviewScrollEdges,
    });
  const { attachViewport: attachAnchorViewport } = useDocumentViewportCentering(
    {
      enabled: enablesDocumentZoom,
      layoutKey: `${effectiveZoomLevel}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${resolvedTemplateId}:${proposalContent?.length ?? 0}:${mode}:${previewAnchor}:${previewFitMode}:${previewScrollMode}`,
      recenterKey: fitRequestCount,
      defaultCenterX: previewAnchor === "body" ? 0.5 : 0,
      defaultCenterY: previewAnchor === "body" ? 0.46 : 0,
      onSync: updatePreviewScrollEdges,
    },
  );
  const attachPreviewViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      attachPreviewScrollContainer(node);
      attachPanViewport(node);
      attachAnchorViewport(node);
    },
    [attachAnchorViewport, attachPanViewport, attachPreviewScrollContainer],
  );

  const modeToggleControl = showModeToggle ? (
    <button
      type="button"
      className={
        mode === "edit"
          ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
          : "dasti-icon-button dasti-proposal-mode-toggle"
      }
      onClick={() => onModeChange?.(mode === "preview" ? "edit" : "preview")}
      aria-pressed={mode === "edit"}
      aria-label={
        mode === "preview" ? "Switch to edit mode" : "Switch to preview mode"
      }
      data-toolbar-tooltip={mode === "preview" ? "Edit" : "Preview"}
      data-no-pan="true"
    >
      {mode === "preview" ? (
        <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  ) : null;

  const shouldShowCopyButton = Boolean(
    onCopy && proposalContent && !loading && !error,
  );

  const actionControls =
    actions || shouldShowCopyButton ? (
      <div
        className="dasti-proposal-sheet__controls dasti-toolbar--surface-tooltips"
        data-no-pan="true"
      >
        {actions}
        <span className="dasti-proposal-sheet__action-slot">
          {shouldShowCopyButton ? (
            <button
              type="button"
              onClick={onCopy}
              aria-label={copyFeedback === "copied" ? "Copied" : "Copy"}
              className="dasti-icon-button"
              data-toolbar-tooltip={
                copyFeedback === "copied" ? "Copied" : "Copy"
              }
              style={{
                color: copyFeedback === "copied" ? "var(--ok)" : undefined,
              }}
            >
              {copyFeedback === "copied" ? (
                <Check size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          ) : null}
        </span>
      </div>
    ) : null;

  const renderZoomControls = (className: string) =>
    showZoomControls &&
    Boolean(proposalContent) &&
    !loading &&
    !error &&
    usesDocumentRenderer &&
    !isEditable ? (
      <div ref={zoomMenuRef} className={className} data-no-pan="true">
        <button
          type="button"
          className={
              isDefaultZoom
                ? "dasti-doc-zoom-fit dasti-doc-zoom-trigger"
                : "dasti-doc-zoom-fit dasti-doc-zoom-trigger dasti-doc-zoom-trigger--active"
          }
          onClick={() => {
            setIsZoomMenuOpen((current) => !current);
          }}
          aria-label="Open zoom controls"
          data-toolbar-tooltip="Zoom"
          aria-expanded={isZoomMenuOpen}
          aria-haspopup="dialog"
        >
          <MagnifyingGlass size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <div
          className="dasti-doc-zoom-bar dasti-doc-zoom-bar--popover"
          data-no-pan="true"
          role="dialog"
          aria-label="Zoom controls"
        >
          <button
            type="button"
            className={
              isDefaultZoom
                ? "dasti-doc-zoom-fit dasti-doc-zoom-fit--active"
                : "dasti-doc-zoom-fit"
            }
            onClick={() => {
              setZoomLevel(PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL);
              setFitRequestCount((count) => count + 1);
            }}
            aria-label="Fit page"
            data-toolbar-tooltip="Fit page"
          >
            <CornersIn size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dasti-icon-button"
            onClick={() =>
              setZoomLevel((level) => level - PROPOSAL_PREVIEW_ZOOM_BUTTON_STEP)
            }
            disabled={zoomLevel <= PROPOSAL_PREVIEW_ZOOM_MIN}
            aria-label="Zoom out"
            data-toolbar-tooltip="Zoom out"
          >
            <Minus size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dasti-icon-button"
            onClick={() =>
              setZoomLevel((level) => level + PROPOSAL_PREVIEW_ZOOM_BUTTON_STEP)
            }
            disabled={zoomLevel >= PROPOSAL_PREVIEW_ZOOM_MAX}
            aria-label="Zoom in"
            data-toolbar-tooltip="Zoom in"
          >
            <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </div>
    ) : null;

  const zoomControls = shouldRenderZoomFooter
    ? null
    : renderZoomControls(
        isZoomMenuOpen
          ? "dasti-doc-zoom-menu dasti-doc-zoom-menu--open"
          : "dasti-doc-zoom-menu",
      );
  const renderHeaderVisibilityToggle = (
    label: string,
    pressed: boolean,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      className={[
        "dasti-proposal-editor-page__toggle",
        pressed ? "dasti-proposal-editor-page__toggle--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
    >
      {pressed ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  );
  const applicantDrawerToggleControl =
    isEditable && canEditApplicantHeader ? (
      <button
        type="button"
        className={
          isApplicantDrawerOpen
            ? "dasti-icon-button dasti-icon-button--active"
            : "dasti-icon-button"
        }
        aria-label={
          isApplicantDrawerOpen
            ? "Hide applicant details"
            : "Show applicant details"
        }
        aria-expanded={isApplicantDrawerOpen}
        aria-controls={applicantDrawerId}
        data-toolbar-tooltip={
          isApplicantDrawerOpen ? "Hide details" : "Header details"
        }
        onClick={() => setIsApplicantDrawerOpen((current) => !current)}
      >
        <FileUser size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
    ) : null;
  const railStartControls =
    modeToggleControl ||
    zoomControls ||
    applicantDrawerToggleControl ||
    railStartAddon ? (
      <div
        className="dasti-proposal-rail-cluster dasti-toolbar--surface-tooltips"
        data-no-pan="true"
      >
        {modeToggleControl}
        {modeToggleControl && zoomControls ? (
          <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
        ) : null}
        {zoomControls}
        {applicantDrawerToggleControl ? (
          <>
            {modeToggleControl || zoomControls ? (
              <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            ) : null}
            {applicantDrawerToggleControl}
          </>
        ) : null}
        {railStartAddon ? (
          <>
            {modeToggleControl ||
            zoomControls ||
            applicantDrawerToggleControl ? (
              <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            ) : null}
            {railStartAddon}
          </>
        ) : null}
      </div>
    ) : null;
  const floatingRail =
    resolvedDocumentHeaderMode !== "hidden" &&
    (railStartControls || railEndAddon || actionControls) ? (
      <div
        className={
          shouldDetachActionHeader
            ? "dasti-document-rail dasti-document-rail--detached dasti-proposal-saved-view-toolbar dasti-toolbar--surface-tooltips"
            : "dasti-document-rail dasti-toolbar--surface-tooltips"
        }
        data-no-pan="true"
      >
        <div className="dasti-document-rail__section dasti-document-rail__section--start">
          {railStartControls}
        </div>
        <div className="dasti-document-rail__section dasti-document-rail__section--center"></div>
        <div className="dasti-document-rail__section dasti-document-rail__section--end">
          {actionControls}
          {railEndAddon}
        </div>
      </div>
    ) : null;

  const renderDocumentCaption = (variantClassName: string) => (
    <div className={`dasti-proposal-sheet__heading ${variantClassName}`}>
      {documentTitleEditable ? (
        <input
          type="text"
          value={documentTitle ?? ""}
          onChange={(event) => onDocumentTitleChange?.(event.target.value)}
          onBlur={() => onDocumentTitleCommit?.()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder={documentTitlePlaceholder}
          className="dasti-proposal-sheet__title-input"
          aria-label="Proposal title"
        />
      ) : documentTitle ? (
        <h3 className="dasti-proposal-sheet__title">{documentTitle}</h3>
      ) : null}
    </div>
  );
  const documentCaption = hasDocumentCaption
    ? renderDocumentCaption("dasti-proposal-sheet__heading--external")
    : null;
  const inlineDocumentCaption =
    hasDocumentCaption &&
    documentHeaderMode === "actions-only" &&
    !shouldDetachActionHeader
      ? renderDocumentCaption("dasti-proposal-sheet__heading--inline")
      : null;
  const detachedDocumentCaption =
    shouldDetachActionHeader && hasDocumentCaption
      ? renderDocumentCaption("dasti-proposal-sheet__heading--sidecar")
      : null;
  const detachedActionHeaderContent =
    shouldDetachActionHeader &&
    (floatingRail || detachedActionHeaderSupplement) ? (
      <div className="dasti-proposal-sheet__header dasti-proposal-sheet__header--actions-only dasti-proposal-sheet__header--detached">
        {floatingRail ? (
          <div className="dasti-proposal-sheet__header-rail">
            {floatingRail}
          </div>
        ) : null}
        {detachedActionHeaderSupplement ? (
          <div className="dasti-proposal-sheet__header-rail">
            {detachedActionHeaderSupplement}
          </div>
        ) : null}
      </div>
    ) : null;

  const renderDocumentStage = () => (
    <div
      className="dasti-document-stage-chassis"
      ref={stageMeasureRef}
      style={
        !isEditable && previewAnchor === "top"
          ? {
              justifyContent: "center",
              alignItems: "flex-start",
            }
          : undefined
      }
    >
      <div
        className="dasti-proposal-sheet__preview-stage"
        ref={attachPreviewViewport}
        data-stage-mode={previewStageMode}
        data-document-stage="true"
        data-zoom-footer={shouldRenderZoomFooter ? "true" : undefined}
        style={{
          width: isEditable
            ? `min(100%, ${stageLayout.stageWidth}px)`
            : "100%",
          height: `${isEditable ? renderedDocumentHeight : previewStageHeightPx}px`,
        }}
        {...(!isEditable ? viewportPanProps : {})}
      >
        <div
          className={[
            "dasti-proposal-sheet__preview-page-positioner",
            isMultiPagePreview
              ? "dasti-proposal-sheet__preview-page-positioner--stacked"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            width: "100%",
            maxWidth: isEditable ? `${stageLayout.pageWidth}px` : undefined,
            minWidth: 0,
            height: `${renderedDocumentHeight}px`,
          }}
        >
          {isEditable ? (
            <div
              className="dasti-proposal-sheet__preview-page dasti-proposal-sheet__preview-page--editable"
              data-document-page="true"
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                height: `${renderedDocumentHeight}px`,
              }}
              ref={editablePageRef}
            >
              <div
                className="dasti-proposal-editor-page"
                data-drawer-open={
                  canEditApplicantHeader && isApplicantDrawerOpen
                    ? "true"
                    : undefined
                }
              >
                {canEditApplicantHeader && isApplicantDrawerOpen ? (
                  <div className="dasti-proposal-editor-page__drawer-shell">
                    <section
                      id={applicantDrawerId}
                      className="dasti-proposal-editor-page__drawer"
                      role="dialog"
                      aria-label="Proposal header details"
                    >
                      <button
                        type="button"
                        className="dasti-icon-button dasti-proposal-editor-page__drawer-close"
                        aria-label="Close header details"
                        onClick={() => setIsApplicantDrawerOpen(false)}
                      >
                        <X size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                      <div className="dasti-proposal-editor-page__drawer-body">
                        <div className="dasti-proposal-editor-page__drawer-header">
                          <div className="dasti-proposal-editor-page__drawer-header-copy">
                            <p className="dasti-proposal-editor-page__drawer-kicker">
                              Applicant details
                            </p>
                            <h4 className="dasti-proposal-editor-page__drawer-title">
                              Header lines
                            </h4>
                          </div>
                        </div>
                        <div className="dasti-proposal-editor-page__drawer-profile">
                          <div
                            className="dasti-proposal-editor-page__drawer-avatar"
                            aria-hidden="true"
                          >
                            <FileUser size={20} strokeWidth={1.8} />
                          </div>
                          <div className="dasti-proposal-editor-page__drawer-profile-copy">
                            <p className="dasti-proposal-editor-page__drawer-profile-name">
                              {applicantDisplayName}
                            </p>
                            <p className="dasti-proposal-editor-page__drawer-profile-role">
                              {applicantDisplayRole}
                            </p>
                          </div>
                        </div>
                        {onHeaderVisibilityChange ? (
                          <section
                            className="ds-card ds-card--muted dasti-proposal-editor-page__drawer-card dasti-proposal-editor-page__drawer-card--visibility"
                            aria-labelledby={headerVisibilityTitleId}
                          >
                            <div className="dasti-proposal-editor-page__drawer-card-header">
                              <div>
                                <p className="ds-card__eyebrow dasti-proposal-editor-page__drawer-card-kicker">
                                  Shown in header
                                </p>
                                <h5
                                  id={headerVisibilityTitleId}
                                  className="ds-card__title dasti-proposal-editor-page__drawer-card-title"
                                >
                                  Pick what appears on the letter.
                                </h5>
                              </div>
                            </div>
                            <div
                              className="dasti-proposal-editor-page__header-toggles"
                              role="group"
                              aria-label="Header visibility"
                            >
                              {renderHeaderVisibilityToggle(
                                "Applicant",
                                resolvedHeaderVisibility.showSender,
                                () =>
                                  handleHeaderVisibilityChange({
                                    showSender:
                                      !resolvedHeaderVisibility.showSender,
                                  }),
                              )}
                              {renderHeaderVisibilityToggle(
                                "Recipient",
                                resolvedHeaderVisibility.showRecipient,
                                () =>
                                  handleHeaderVisibilityChange({
                                    showRecipient:
                                      !resolvedHeaderVisibility.showRecipient,
                                  }),
                              )}
                              {renderHeaderVisibilityToggle(
                                "Recipient details",
                                resolvedHeaderVisibility.showRecipient &&
                                  resolvedHeaderVisibility.showRecipientDetails,
                                () =>
                                  handleHeaderVisibilityChange({
                                    showRecipient: true,
                                    showRecipientDetails:
                                      !resolvedHeaderVisibility.showRecipient ||
                                      !resolvedHeaderVisibility.showRecipientDetails,
                                  }),
                              )}
                              {renderHeaderVisibilityToggle(
                                "Subject",
                                resolvedHeaderVisibility.showSubject,
                                () =>
                                  handleHeaderVisibilityChange({
                                    showSubject:
                                      !resolvedHeaderVisibility.showSubject,
                                  }),
                              )}
                              {renderHeaderVisibilityToggle(
                                "Date / location",
                                resolvedHeaderVisibility.showDate,
                                () =>
                                  handleHeaderVisibilityChange({
                                    showDate:
                                      !resolvedHeaderVisibility.showDate,
                                  }),
                              )}
                            </div>
                          </section>
                        ) : null}
                        <section
                          className="ds-card ds-card--muted dasti-proposal-editor-page__drawer-card"
                          aria-labelledby={applicantCardTitleId}
                        >
                          <div className="dasti-proposal-editor-page__drawer-card-header">
                            <div>
                              <p className="ds-card__eyebrow dasti-proposal-editor-page__drawer-card-kicker">
                                Applicant
                              </p>
                              <h5
                                id={applicantCardTitleId}
                                className="ds-card__title dasti-proposal-editor-page__drawer-card-title"
                              >
                                Your sender line.
                              </h5>
                            </div>
                            <span className="dasti-proposal-editor-page__drawer-card-note">
                              From
                            </span>
                          </div>
                          <div className="dasti-proposal-editor-page__header-fields">
                            {onRailTitleChange ? (
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Name
                                </span>
                                <input
                                  type="text"
                                  value={railTitle ?? ""}
                                  onChange={(event) =>
                                    onRailTitleChange(event.target.value)
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Applicant name"
                                />
                              </label>
                            ) : null}
                            {onRailMetaChange ? (
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Role
                                </span>
                                <input
                                  type="text"
                                  value={railMeta ?? ""}
                                  onChange={(event) =>
                                    onRailMetaChange(event.target.value)
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Applicant role"
                                />
                              </label>
                            ) : null}
                            {contactLineEditable ? (
                              <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Contact
                                </span>
                                <input
                                  type="text"
                                  value={contactLine ?? ""}
                                  onChange={(event) =>
                                    onContactLineChange?.(event.target.value)
                                  }
                                  onBlur={() => onContactLineCommit?.()}
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Phone, email, website"
                                />
                              </label>
                            ) : null}
                          </div>
                        </section>
                        {recipientDetailsEditable ? (
                          <section
                            className="ds-card ds-card--muted dasti-proposal-editor-page__drawer-card"
                            aria-labelledby={recipientCardTitleId}
                          >
                            <div className="dasti-proposal-editor-page__drawer-card-header">
                              <div>
                                <p className="ds-card__eyebrow dasti-proposal-editor-page__drawer-card-kicker">
                                  Recipient
                                </p>
                                <h5
                                  id={recipientCardTitleId}
                                  className="ds-card__title dasti-proposal-editor-page__drawer-card-title"
                                >
                                  Who the letter is addressed to.
                                </h5>
                              </div>
                              <span className="dasti-proposal-editor-page__drawer-card-note">
                                To
                              </span>
                            </div>
                            <div className="dasti-proposal-editor-page__header-fields">
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Recipient
                                </span>
                                <input
                                  type="text"
                                  value={recipientFields.name}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "name",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Hiring Manager"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Hiring role
                                </span>
                                <input
                                  type="text"
                                  value={recipientFields.role}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "role",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Head of Talent"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Company
                                </span>
                                <input
                                  type="text"
                                  value={recipientFields.company}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "company",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Northwind"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field">
                                <span className="dasti-proposal-editor-page__field-label">
                                  City
                                </span>
                                <input
                                  type="text"
                                  value={recipientFields.city}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "city",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="Paris"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Address
                                </span>
                                <input
                                  type="text"
                                  value={recipientFields.address}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "address",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="12 Rue de la Paix"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Employer email
                                </span>
                                <input
                                  type="email"
                                  value={recipientFields.email}
                                  onChange={(event) =>
                                    handleRecipientFieldChange(
                                      "email",
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input"
                                  placeholder="hiring@northwind.com"
                                />
                              </label>
                              <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                <span className="dasti-proposal-editor-page__field-label">
                                  Recipient block
                                </span>
                                <textarea
                                  value={recipientDetails ?? ""}
                                  onChange={(event) =>
                                    onRecipientDetailsChange?.(
                                      event.target.value,
                                    )
                                  }
                                  className="dasti-proposal-editor-page__field-input dasti-proposal-editor-page__field-textarea"
                                  placeholder={
                                    "Hiring Manager\nHead of Talent\nNorthwind\n12 Rue de la Paix\nhiring@northwind.com\nParis"
                                  }
                                  rows={6}
                                />
                              </label>
                            </div>
                          </section>
                        ) : null}
                        {letterDateEditable ||
                        salutationEditable ||
                        documentTitleEditable ? (
                          <section
                            className="ds-card ds-card--muted dasti-proposal-editor-page__drawer-card"
                            aria-labelledby={letterDetailsCardTitleId}
                          >
                            <div className="dasti-proposal-editor-page__drawer-card-header">
                              <div>
                                <p className="ds-card__eyebrow dasti-proposal-editor-page__drawer-card-kicker">
                                  Header details
                                </p>
                                <h5
                                  id={letterDetailsCardTitleId}
                                  className="ds-card__title dasti-proposal-editor-page__drawer-card-title"
                                >
                                  Date, subject, and opening line.
                                </h5>
                              </div>
                            </div>
                            <div className="dasti-proposal-editor-page__header-fields">
                              {letterDateEditable ? (
                                <label className="dasti-proposal-editor-page__field">
                                  <span className="dasti-proposal-editor-page__field-label">
                                    Date / location
                                  </span>
                                  <input
                                    type="text"
                                    value={letterDate ?? ""}
                                    onChange={(event) =>
                                      onLetterDateChange?.(event.target.value)
                                    }
                                    className="dasti-proposal-editor-page__field-input"
                                    placeholder="Paris, April 6, 2026"
                                  />
                                </label>
                              ) : null}
                              {salutationEditable ? (
                                <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                  <span className="dasti-proposal-editor-page__field-label">
                                    Salutation
                                  </span>
                                  <input
                                    type="text"
                                    value={salutationValue ?? ""}
                                    onChange={(event) =>
                                      onSalutationChange?.(event.target.value)
                                    }
                                    className="dasti-proposal-editor-page__field-input"
                                    placeholder={salutationPlaceholder}
                                  />
                                </label>
                              ) : null}
                              {documentTitleEditable ? (
                                <label className="dasti-proposal-editor-page__field dasti-proposal-editor-page__field--wide">
                                  <span className="dasti-proposal-editor-page__field-label">
                                    Subject
                                  </span>
                                  <input
                                    type="text"
                                    value={documentTitle ?? ""}
                                    onChange={(event) =>
                                      onDocumentTitleChange?.(
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => onDocumentTitleCommit?.()}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        (
                                          event.currentTarget as HTMLInputElement
                                        ).blur();
                                      }
                                    }}
                                    className="dasti-proposal-editor-page__field-input"
                                    placeholder={documentTitlePlaceholder}
                                  />
                                </label>
                              ) : null}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    </section>
                  </div>
                ) : null}
                <div className="dasti-proposal-editor-page__inner">
                  {inlineSelectionOverlay}
                  {inlineProofingOverlay}
                  <textarea
                    ref={attachEditableTextarea}
                    value={proposalContent ?? ""}
                    onChange={(event) => {
                      setAiSuggestion(null);
                      onContentChange?.(event.target.value);
                      window.requestAnimationFrame(syncEditableTextareaBlockSize);
                    }}
                    onBlur={(event) => {
                      if (isInlineAiToolbarTarget(event.relatedTarget)) return;
                      setTextareaSelectionState(null);
                      onContentCommit?.();
                    }}
                    onSelect={() => scheduleTextareaSelectionCheck(true)}
                    onMouseUp={() => scheduleTextareaSelectionCheck(true)}
                    onKeyUp={() => scheduleTextareaSelectionCheck(true)}
                    onScroll={() => {
                      if (editableTextareaRef.current?.scrollTop) {
                        editableTextareaRef.current.scrollTop = 0;
                      }
                      scheduleTextareaSelectionCheck();
                    }}
                    placeholder="Content appears here"
                    className={[
                      "dasti-proposal-sheet__body--editable",
                      "dasti-proposal-editor-page__textarea",
                      shouldMirrorTextareaSelection
                        ? "dasti-proposal-inline-proofing__textarea--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      fontFamily: documentTypography.fontFamily,
                      fontSize: "var(--tb)",
                      lineHeight: documentTypography.lineHeight,
                      fontWeight: documentTypography.fontWeight,
                      letterSpacing: documentTypography.letterSpacing,
                      color: "var(--proposal-document-ink)",
                      caretColor: "var(--proposal-document-ink)",
                      background: "transparent",
                      whiteSpace: "pre-wrap",
                      cursor: "text",
                      width: "100%",
                      outline: "none",
                      minHeight: "100%",
                      height:
                        editableTextareaBlockSize > 0
                          ? `${editableTextareaBlockSize}px`
                          : "100%",
                      resize: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="dasti-proposal-sheet__preview-scale-shell"
              style={{
                width: `${A4_PAGE_WIDTH_PX}px`,
                height: `${renderedUnscaledDocumentHeight}px`,
                transform: `translateX(-50%) scale(${previewDocumentScale})`,
              }}
            >
              <div
                className={[
                  "dasti-proposal-sheet__preview-page",
                  isMultiPagePreview
                    ? "dasti-proposal-sheet__preview-page--stacked"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-document-page="true"
                style={{
                  width: `${A4_PAGE_WIDTH_PX}px`,
                  height: `${renderedUnscaledDocumentHeight}px`,
                  aspectRatio: isMultiPagePreview ? "auto" : undefined,
                }}
                ref={editablePageRef}
                onClick={() => {
                  if (mode === "preview") {
                    onPreviewInteract?.();
                  }
                }}
              >
                <ProposalDocumentRenderer
                  content={proposalContent ?? ""}
                  proposalType={proposalType}
                  templateId={resolvedTemplateId}
                  stylePreset={resolvedStylePreset}
                  railTitle={railTitle}
                  railMeta={railMeta}
                  contactLine={contactLine}
                  letterDate={letterDate}
                  recipientDetails={recipientDetails}
                  documentTitle={documentTitle}
                  documentMeta={documentMeta}
                  applicantHeader={applicantHeader}
                  headerVisibility={resolvedHeaderVisibility}
                  documentTypography={documentTypography}
                  signatureSettings={signatureSettings}
                  closing={closing}
                  emptyBodyPlaceholder={
                    !proposalContent && !isEditable
                      ? "No draft yet. Add a job offer to generate, or start blank."
                      : null
                  }
                  pageWidth={A4_PAGE_WIDTH_PX}
                  pageGapPx={unscaledDocumentPageGapPx}
                  onPageCountChange={setDocumentPageCount}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  let sheetBody: React.ReactNode;

  if (loading) {
    sheetBody = (
      <div
        className={resolveBodyClassName({ letterLike: isLetterLike })}
        data-state="loading"
        aria-busy="true"
      >
        <div className="dasti-proposal-loading-skeleton" aria-hidden="true">
          <div className="dasti-proposal-loading-skeleton__status">
            <span>Generating proposal</span>
            <span className="dasti-loader-caret" />
          </div>
          <div className="dasti-proposal-loading-skeleton__masthead">
            <span className="dasti-proposal-loading-skeleton__eyebrow" />
            <span className="dasti-proposal-loading-skeleton__title" />
          </div>
          <div className="dasti-proposal-loading-skeleton__meta-grid">
            <span className="dasti-proposal-loading-skeleton__eyebrow" />
            <span className="dasti-proposal-loading-skeleton__eyebrow" />
            <span className="dasti-proposal-loading-skeleton__meta" />
            <span className="dasti-proposal-loading-skeleton__meta" />
          </div>
          <div className="dasti-proposal-loading-skeleton__subject">
            <span className="dasti-proposal-loading-skeleton__eyebrow" />
            <span className="dasti-proposal-loading-skeleton__subject-line" />
          </div>
          <div className="dasti-proposal-loading-skeleton__body">
            <span className="dasti-proposal-loading-skeleton__salutation" />
            <div className="dasti-proposal-loading-skeleton__paragraph">
              <span />
              <span />
              <span />
            </div>
            <div className="dasti-proposal-loading-skeleton__paragraph">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="dasti-proposal-loading-skeleton__paragraph">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  } else if (statusMessage) {
    sheetBody = (
      <div
        className={resolveBodyClassName()}
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <p
          aria-live="polite"
          style={{
            margin: 0,
            maxWidth: "26ch",
            fontSize: "var(--ts)",
            lineHeight: "var(--ls)",
            color: "var(--tm2)",
            textAlign: "center",
          }}
        >
          {statusMessage}
        </p>
      </div>
    );
  } else if (error) {
    sheetBody = (
      <div
        className={resolveBodyClassName()}
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-card)] border border-[color:var(--er)] [background:var(--erb)] p-6"
        >
          <div className="text-sm font-medium [color:var(--ert)]">
            Generation failed.
          </div>
          <p className="mt-2 text-sm leading-6 [color:var(--ti)]">{error}</p>
          {isDev && errorDetail && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs [color:var(--tg2)] select-none">
                Dev — raw backend reason
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all rounded [background:var(--sf2)] p-3 text-xs [color:var(--tg2)] leading-5">
                {errorDetail}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  } else if (!proposalContent && !isEditable && !hasDocumentShell) {
    sheetBody = (
      <div
        className={resolveBodyClassName()}
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: "26ch",
            fontSize: "var(--ts)",
            lineHeight: "var(--ls)",
            color: "var(--tm2)",
            textAlign: "center",
          }}
        >
          No draft yet.
          <br />
          <strong>Add a job offer</strong> to generate.
          <br />
          Or start blank.
        </p>
      </div>
    );
  } else if (isEditable) {
    sheetBody = usesDocumentRenderer ? (
      <div
        ref={attachEditableScrollContainer}
        className={resolveBodyClassName({
          letterLike: isLetterLike,
          documentEditor: isDocumentEditor,
        })}
        data-scroll-top={activeScrollTop ? "true" : "false"}
        data-scroll-bottom={activeScrollBottom ? "true" : "false"}
        style={activeScrollFadeStyle}
        onScroll={(event) => {
          setEditableTextareaScrollTop(event.currentTarget.scrollTop);
          updateEditableScrollEdges();
          scheduleTextareaSelectionCheck();
        }}
      >
        {queuedPreviewActionLabel ? (
          <div
            className="dasti-proposal-editor-hint"
            role="status"
            aria-live="polite"
          >
            Pick a paragraph, then tap {queuedPreviewActionLabel.toLowerCase()}.
          </div>
        ) : null}
        {renderDocumentStage()}
      </div>
    ) : (
      <div
        className={resolveBodyClassName({ letterLike: isLetterLike })}
        data-scroll-top={activeScrollTop ? "true" : "false"}
        data-scroll-bottom={activeScrollBottom ? "true" : "false"}
        style={activeScrollFadeStyle}
      >
        <div className="dasti-proposal-inline-proofing-field">
          {inlineSelectionOverlay}
          {inlineProofingOverlay}
          <textarea
            ref={attachEditableTextarea}
            value={proposalContent ?? ""}
            onChange={(event) => {
              setAiSuggestion(null);
              onContentChange?.(event.target.value);
            }}
            onBlur={(event) => {
              if (isInlineAiToolbarTarget(event.relatedTarget)) return;
              setTextareaSelectionState(null);
              onContentCommit?.();
            }}
            onSelect={() => scheduleTextareaSelectionCheck(true)}
            onMouseUp={() => scheduleTextareaSelectionCheck(true)}
            onKeyUp={() => scheduleTextareaSelectionCheck(true)}
            onScroll={() => {
              setEditableTextareaScrollTop(
                editableTextareaRef.current?.scrollTop ?? 0,
              );
            }}
            placeholder="Content appears here"
            className={[
              "dasti-proposal-sheet__body--editable",
              shouldMirrorTextareaSelection
                ? "dasti-proposal-inline-proofing__textarea--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              fontFamily: documentTypography.fontFamily,
              fontSize: "var(--tb)",
              lineHeight: documentTypography.lineHeight,
              fontWeight: documentTypography.fontWeight,
              letterSpacing: documentTypography.letterSpacing,
              color: "var(--ti)",
              caretColor: "var(--ti)",
              background: "transparent",
              width: "100%",
              outline: "none",
              height: "100%",
              resize: "none",
              paddingTop: isLetterLike ? "clamp(28px, 6vh, 52px)" : undefined,
              paddingBottom: "var(--proposal-sheet-content-bottom-inset)",
            }}
          />
        </div>
      </div>
    );
  } else {
    sheetBody = (
      <div
        className={resolveBodyClassName({
          isReadonly: true,
          letterLike: isLetterLike,
        })}
        style={{
          fontFamily: documentTypography.fontFamily,
          fontSize: "var(--tb)",
          lineHeight: documentTypography.lineHeight,
          fontWeight: documentTypography.fontWeight,
          letterSpacing: documentTypography.letterSpacing,
          color: "var(--ti)",
          maxWidth: "none",
          height: "100%",
        }}
      >
        {usesDocumentRenderer ? (
          renderDocumentStage()
        ) : (
          <div
            className={
              isLetterLike
                ? "dasti-proposal-sheet__scroll dasti-proposal-sheet__scroll--letter"
                : "dasti-proposal-sheet__scroll"
            }
            ref={attachPreviewViewport}
            {...viewportPanProps}
          >
            <div
              className="dasti-proposal-sheet__scroll-content"
              style={
                zoomLevel !== 1 ? { width: `${zoomLevel * 100}%` } : undefined
              }
            >
              {isLetterLike ? (
                <div className="max-w-none">
                  {renderPlainLetterBody(proposalContent ?? "")}
                </div>
              ) : (
                <div className="max-w-none">
                  {renderPlainPreviewBody(proposalContent ?? "")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const previewParagraphActionsFooter =
    showPreviewParagraphActions && !isEditable && proposalContent ? (
      <div className="dasti-proposal-sheet__footer">
        <div className="dasti-proposal-paragraph-affordances">
          <span className="dasti-proposal-paragraph-affordances__label">
            Paragraph actions
          </span>
          {PREVIEW_PARAGRAPH_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className="dasti-proposal-paragraph-affordances__action"
              onClick={() => handlePreviewParagraphAction(action.helperLabel)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    ) : null;
  const previewZoomFooter = shouldRenderZoomFooter ? (
    <div className="dasti-proposal-preview-zoom-footer" data-no-pan="true">
      <div
        className="dasti-proposal-preview-zoom-footer__zoom"
        aria-label="Proposal zoom controls"
      >
        <input
          className="dasti-proposal-preview-zoom-footer__slider"
          type="range"
          min={PROPOSAL_PREVIEW_ZOOM_MIN}
          max={PROPOSAL_PREVIEW_ZOOM_MAX}
          step={PROPOSAL_PREVIEW_ZOOM_SLIDER_STEP}
          value={zoomLevel}
          aria-label="Proposal zoom"
          aria-valuetext={visibleZoomPercent}
          onChange={(event) => setZoomLevel(Number(event.currentTarget.value))}
        />
        <Menu
          ariaLabel="Proposal zoom menu"
          align="end"
          side="top"
          menuClassName="dasti-proposal-preview-zoom-footer__menu"
          sections={[
            {
              items: [
                ...PROPOSAL_PREVIEW_ZOOM_STEPS.map((step, index) => ({
                  id: `zoom-${index}`,
                  label: formatProposalZoomOptionLabel(step),
                  role: "menuitemradio" as const,
                  selected: nearestZoomIndex === index,
                  onSelect: () => setZoomLevel(step),
                })),
                {
                  id: "fit-page",
                  label: "Fit page",
                  role: "menuitemradio" as const,
                  selected: isDefaultZoom,
                  onSelect: () => {
                    setZoomLevel(PROPOSAL_PREVIEW_ZOOM_DEFAULT_LEVEL);
                    setFitRequestCount((count) => count + 1);
                  },
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="dasti-doc-zoom-status dasti-proposal-preview-zoom-footer__status"
              aria-label={`Zoom level ${visibleZoomPercent}`}
              data-toolbar-tooltip="Zoom presets"
            >
              {visibleZoomPercent}
            </button>
          }
        />
      </div>
    </div>
  ) : null;

  const viewerShell = (
    <div className="dasti-doc-viewer-shell">
      {isEditable && aiSuggestion ? (
        <FloatingSuggestionToolbar
          open
          anchor={aiSuggestion.anchor}
          state={aiSuggestion.status}
          onAccept={handleAcceptAiSuggestion}
          onDiscard={handleDiscardAiSuggestion}
          onUndo={handleUndoAiSuggestion}
          onClose={handleDismissAiSuggestion}
        />
      ) : null}
      {isEditable && textareaSelectionState && !aiSuggestion ? (
        <FloatingAiToolbar
          open
          anchor={textareaSelectionState.anchor}
          isLoading={isApplyingInlineAi}
          pendingActionId={pendingInlineAiActionId}
          includeJobContextActions={Boolean(normalizedEditorAiJobContext)}
          onClose={() => setTextareaSelectionState(null)}
          onRunAction={handleRunInlineAiAction}
        />
      ) : null}
      <div
        ref={viewerSurfaceRef}
        className="dasti-doc-viewer-shell__surface"
        data-preview-zoom-footer={shouldRenderZoomFooter ? "true" : undefined}
        style={stageLayoutVars}
      >
        <div
          className={
            size === "focused"
              ? "dasti-proposal-sheet-frame dasti-proposal-sheet-frame--focused"
              : "dasti-proposal-sheet-frame"
          }
          style={{
            ...proposalDocumentThemeVars,
            ...stageLayoutVars,
          }}
        >
          <div
            className={
              size === "focused"
                ? "dasti-proposal-sheet dasti-proposal-sheet--focused dasti-document-shell"
                : "dasti-proposal-sheet dasti-document-shell"
            }
            style={stageLayoutVars}
            aria-busy={loading || undefined}
            aria-label={loading ? "Generating proposal" : undefined}
          >
            {shouldDetachActionHeader ? null : floatingRail}
            {inlineDocumentCaption}
            {sheetBody}
          </div>
        </div>
        {previewParagraphActionsFooter}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {fallbackDisclosure ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md border border-[color:var(--color-border)] [background:var(--as)] px-4 py-3 text-sm text-foreground"
        >
          {fallbackDisclosure}
        </div>
      ) : null}
      {shouldDetachActionHeader && detachedDocumentCaption ? (
        <div className="dasti-proposal-display__detached-layout">
          <div className="dasti-proposal-display__detached-aside">
            {detachedDocumentCaption}
          </div>
          <div className="dasti-proposal-display__detached-main">
            {detachedActionHeaderContent}
            {viewerShell}
          </div>
        </div>
      ) : (
        <>
          {shouldDetachActionHeader
            ? detachedActionHeaderContent
            : documentHeaderMode === "actions-only"
              ? null
              : documentCaption}
          {viewerShell}
          {previewZoomFooter}
        </>
      )}
    </div>
  );
};

export default ProposalDisplay;
