import React from "react";
import { useAction } from "convex/react";
import {
  Check,
  Copy,
  CornersIn,
  Eye,
  MagnifyingGlass,
  Minus,
  Pencil,
  Plus,
} from "@/lib/icons";
import type { FormValues } from "./ProposalInputForm.schemas";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import { api } from "../../convex/_generated/api";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import FloatingAiToolbar, { type InlineAiActionId } from "./FloatingAiToolbar";
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
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DOCUMENT_ZOOM_STEPS,
} from "../lib/document-stage";
import {
  getTextareaSelectionState,
  isInlineAiToolbarActiveElement,
  isPrimaryPointerPressed,
} from "../lib/editor-ai-selection";
import { resolveProposalCharacterLimitSelection } from "../../convex/lib/proposals/generationControls";
import type { ProposalApplicantHeaderData } from "../lib/proposal-personalization";

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
  railTitle?: string | null;
  railMeta?: string | null;
  documentTitle?: string | null;
  documentMeta?: string | null;
  applicantHeader?: ProposalApplicantHeaderData | null;
  mode?: "preview" | "edit";
  onModeChange?: (mode: "preview" | "edit") => void;
  onPreviewInteract?: () => void;
  onContentChange?: (value: string) => void;
  onContentCommit?: () => void;
  actions?: React.ReactNode;
  railStartAddon?: React.ReactNode;
  showModeToggle?: boolean;
  size?: "default" | "focused";
  previewAnchor?: "top" | "body";
  hideDocumentHeader?: boolean;
  documentHeaderMode?: "full" | "actions-only" | "hidden";
  showZoomControls?: boolean;
  zoomStorageKey?: string | null;
  detachedActionHeader?: boolean;
  detachedActionHeaderSupplement?: React.ReactNode;
  documentTitleEditable?: boolean;
  onDocumentTitleChange?: (value: string) => void;
  onDocumentTitleCommit?: () => void;
  documentTitlePlaceholder?: string;
  showDocumentCaption?: boolean;
  characterLimit?: number | null;
  characterLimitAdvisory?: boolean;
}

const PREVIEW_PARAGRAPH_ACTIONS: Array<{
  id: InlineAiActionId;
  label: string;
  helperLabel: string;
}> = [
  {
    id: "make_human",
    label: "Rewrite",
    helperLabel: "Rewrite",
  },
  {
    id: "shorten",
    label: "Shorten",
    helperLabel: "Shorten",
  },
  {
    id: "fix_grammar",
    label: "Polish",
    helperLabel: "Polish",
  },
  {
    id: "ask",
    label: "Ask AI",
    helperLabel: "Ask AI",
  },
];

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

function getCharacterCountTone(args: {
  count: number;
  limit: number | null;
  advisory?: boolean;
}): "default" | "warning" | "danger" {
  if (args.advisory) {
    return "default";
  }

  if (args.limit === null) {
    return "default";
  }

  if (args.count > args.limit) {
    return "danger";
  }

  if (args.count >= Math.floor(args.limit * 0.9)) {
    return "warning";
  }

  return "default";
}

function formatCharacterCountLabel(args: {
  count: number;
  limit: number | null;
  advisory?: boolean;
}): string {
  if (args.limit === null) {
    return `${args.count.toLocaleString()} chars`;
  }

  return `${args.count.toLocaleString()} / ${args.advisory ? "~" : ""}${args.limit.toLocaleString()}`;
}

const SEMANTIC_IDEAL_MIN = 800;
const SEMANTIC_IDEAL_MAX = 1200;
const SEMANTIC_SCALE_MAX = 2000;

function getSemanticLengthZone(count: number): "brief" | "ideal" | "long" {
  if (count < SEMANTIC_IDEAL_MIN) return "brief";
  if (count <= SEMANTIC_IDEAL_MAX) return "ideal";
  return "long";
}

function SemanticLengthBadge({ count }: { count: number }): JSX.Element {
  const zone = getSemanticLengthZone(count);
  const label =
    zone === "brief" ? "Brief" : zone === "ideal" ? "Ideal" : "Long";
  const markerPct = Math.min((count / SEMANTIC_SCALE_MAX) * 100, 100);
  return (
    <span
      className={`dasti-pill dasti-proposal-character-badge dasti-length-signal dasti-length-signal--${zone}`}
      title={`${count.toLocaleString()} characters — ${label} length`}
    >
      <span className="dasti-length-signal__bar" aria-hidden="true">
        <span
          className="dasti-length-signal__marker"
          style={{ left: `${markerPct}%` }}
        />
      </span>
      <span className="dasti-length-signal__label">{label}</span>
    </span>
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

function readProposalZoomIndex(_storageKey: string | null | undefined) {
  return 1;
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
  railTitle = null,
  railMeta = null,
  documentTitle = null,
  documentMeta = null,
  applicantHeader = null,
  mode = "preview",
  onModeChange,
  onPreviewInteract,
  onContentChange,
  onContentCommit,
  actions,
  railStartAddon,
  showModeToggle: allowModeToggle = true,
  size = "default",
  previewAnchor = "top",
  hideDocumentHeader = false,
  documentHeaderMode = "full",
  showZoomControls = false,
  zoomStorageKey = PROPOSAL_PREVIEW_ZOOM_STORAGE_KEY,
  detachedActionHeader = false,
  detachedActionHeaderSupplement,
  documentTitleEditable = false,
  onDocumentTitleChange,
  onDocumentTitleCommit,
  documentTitlePlaceholder = "Proposal title",
  showDocumentCaption = true,
  characterLimit,
  characterLimitAdvisory = false,
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
  const resolvedCharacterLimitSelection = React.useMemo(() => {
    if (characterLimit !== undefined || characterLimitAdvisory) {
      return {
        value: characterLimit ?? null,
        advisory: characterLimitAdvisory,
      };
    }

    return resolveProposalCharacterLimitSelection({});
  }, [characterLimit, characterLimitAdvisory]);
  const proposalCharacterCount = displayedProposalText.length;
  const characterCountTone = getCharacterCountTone({
    count: proposalCharacterCount,
    limit: resolvedCharacterLimitSelection.value,
    advisory: resolvedCharacterLimitSelection.advisory,
  });
  const proposalDocumentThemeVars = React.useMemo(
    () => buildVerbatiProposalDocumentVars(resolvedStylePreset),
    [resolvedStylePreset],
  );

  const [zoomIndex, setZoomIndex] = React.useState(() =>
    readProposalZoomIndex(zoomStorageKey),
  );
  const [isZoomMenuOpen, setIsZoomMenuOpen] = React.useState(false);
  const [documentPageCount, setDocumentPageCount] = React.useState(1);
  const [fitRequestCount, setFitRequestCount] = React.useState(0);
  const [isApplyingInlineAi, setIsApplyingInlineAi] = React.useState(false);
  const [pendingInlineAiActionId, setPendingInlineAiActionId] =
    React.useState<InlineAiActionId | null>(null);
  const [queuedPreviewActionLabel, setQueuedPreviewActionLabel] =
    React.useState<string | null>(null);
  const [textareaSelectionState, setTextareaSelectionState] = React.useState<{
    text: string;
    anchor: { left: number; top: number; bottom: number };
    start: number;
    end: number;
  } | null>(null);
  const zoomLevel = DOCUMENT_ZOOM_STEPS[zoomIndex];
  const editableTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const editablePageRef = React.useRef<HTMLDivElement | null>(null);
  const viewerSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const characterBadgeWrapRef = React.useRef<HTMLDivElement | null>(null);
  const selectionDebounceRef = React.useRef<number | null>(null);
  const zoomMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [isCharacterBadgeOverlappingPage, setIsCharacterBadgeOverlappingPage] =
    React.useState(false);

  const {
    attach: attachEditableScrollEdges,
    showTop: showEditableScrollTop,
    showBottom: showEditableScrollBottom,
    topStrength: editableScrollTopStrength,
    bottomStrength: editableScrollBottomStrength,
    update: updateEditableScrollEdges,
  } = useScrollEdgeFades<HTMLTextAreaElement>();
  const {
    attach: attachPreviewScrollEdges,
    showTop: showPreviewScrollTop,
    showBottom: showPreviewScrollBottom,
    topStrength: previewScrollTopStrength,
    bottomStrength: previewScrollBottomStrength,
    update: updatePreviewScrollEdges,
  } = useScrollEdgeFades<HTMLDivElement>();
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
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
    Boolean(
      (documentTitle && documentTitle.trim().length > 0) ||
        (documentMeta && documentMeta.trim().length > 0),
    );
  const usesDocumentRenderer =
    proposalType === "cover_letter" ||
    proposalType === "application_message" ||
    proposalType === "freelance_proposal";
  const isEditable = mode === "edit" && Boolean(onContentChange);
  const usesFixedA4ScalePreview =
    usesDocumentRenderer &&
    resolvedTemplateId === "volk_register" &&
    !isEditable;
  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";
  const isDocumentEditor = isEditable && usesDocumentRenderer;
  const effectiveZoomLevel = isEditable ? 1 : zoomLevel;
  const enablesDocumentZoom =
    showZoomControls &&
    !loading &&
    !error &&
    Boolean(proposalContent) &&
    usesDocumentRenderer &&
    !isEditable;
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
  const stageLayout = useDocumentStageLayout({
    enabled: usesDocumentRenderer && Boolean(proposalContent),
    measurementRef: stageMeasureRef,
    zoomLevel: effectiveZoomLevel,
    fitMode: usesDocumentRenderer ? "contain" : "width",
    pageWidthPx: A4_PAGE_WIDTH_PX,
    pageHeightPx: A4_PAGE_HEIGHT_PX,
  });
  const stageMode = stageLayout.isFit ? "fit" : "overflow";
  const stageLayoutVars =
    usesDocumentRenderer && proposalContent
      ? ({
          "--document-stage-width": `${stageLayout.stageWidth}px`,
          "--document-stage-height": `${stageLayout.stageHeight}px`,
          "--document-page-width": `${stageLayout.pageWidth}px`,
          "--document-page-height": `${stageLayout.pageHeight}px`,
        } as React.CSSProperties)
      : undefined;
  const documentPageGapPx =
    usesDocumentRenderer && !isEditable
      ? Math.max(
          12,
          Math.round(24 * (stageLayout.pageWidth / A4_PAGE_WIDTH_PX)),
        )
      : 0;
  const previewDocumentScale =
    usesFixedA4ScalePreview && stageLayout.pageWidth > 0
      ? stageLayout.pageWidth / A4_PAGE_WIDTH_PX
      : 1;
  const unscaledDocumentPageGapPx =
    usesFixedA4ScalePreview && previewDocumentScale > 0
      ? documentPageGapPx / previewDocumentScale
      : documentPageGapPx;
  const renderedDocumentHeight =
    usesDocumentRenderer && !isEditable
      ? stageLayout.pageHeight * Math.max(1, documentPageCount) +
        documentPageGapPx * Math.max(0, documentPageCount - 1)
      : stageLayout.pageHeight;
  const renderedUnscaledDocumentHeight =
    usesFixedA4ScalePreview
      ? A4_PAGE_HEIGHT_PX * Math.max(1, documentPageCount) +
        unscaledDocumentPageGapPx * Math.max(0, documentPageCount - 1)
      : renderedDocumentHeight;
  const isMultiPagePreview =
    usesDocumentRenderer && !isEditable && documentPageCount > 1;
  const previewStageMode =
    usesDocumentRenderer &&
    !isEditable &&
    renderedDocumentHeight > stageLayout.stageHeight + 1
      ? "overflow"
      : stageMode;
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

  const shouldShowCharacterCountBadge = Boolean(
    proposalContent && !loading && !error && isEditable,
  );

  React.useEffect(() => {
    updateEditableScrollEdges();
    updatePreviewScrollEdges();
  }, [
    documentMeta,
    documentTitle,
    isEditable,
    proposalContent,
    proposalType,
    size,
    updateEditableScrollEdges,
    updatePreviewScrollEdges,
  ]);

  React.useEffect(() => {
    if (!shouldShowCharacterCountBadge || !usesDocumentRenderer) {
      setIsCharacterBadgeOverlappingPage(false);
      return undefined;
    }

    const measureOverlap = () => {
      const badgeNode = characterBadgeWrapRef.current;
      const pageNode = editablePageRef.current;
      if (!badgeNode || !pageNode) {
        setIsCharacterBadgeOverlappingPage(false);
        return;
      }

      const badgeRect = badgeNode.getBoundingClientRect();
      const pageRect = pageNode.getBoundingClientRect();
      const overlaps =
        badgeRect.left < pageRect.right - 1 &&
        badgeRect.right > pageRect.left + 1 &&
        badgeRect.top < pageRect.bottom - 1 &&
        badgeRect.bottom > pageRect.top + 1;

      setIsCharacterBadgeOverlappingPage((current) =>
        current === overlaps ? current : overlaps,
      );
    };

    let frameId: number | null = null;
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      frameId = window.requestAnimationFrame(measureOverlap);
    } else {
      measureOverlap();
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measureOverlap)
        : null;

    if (viewerSurfaceRef.current) {
      resizeObserver?.observe(viewerSurfaceRef.current);
    }
    if (editablePageRef.current) {
      resizeObserver?.observe(editablePageRef.current);
    }
    if (characterBadgeWrapRef.current) {
      resizeObserver?.observe(characterBadgeWrapRef.current);
    }

    window.addEventListener("resize", measureOverlap);

    return () => {
      if (frameId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureOverlap);
    };
  }, [shouldShowCharacterCountBadge, usesDocumentRenderer]);

  React.useEffect(() => {
    setZoomIndex(readProposalZoomIndex(zoomStorageKey));
    setFitRequestCount((count) => count + 1);
  }, [zoomStorageKey]);

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
    };
  }, []);

  React.useEffect(() => {
    if (!isEditable) {
      setTextareaSelectionState(null);
    }
  }, [isEditable]);

  React.useEffect(() => {
    if (!isEditable) {
      setQueuedPreviewActionLabel(null);
      return;
    }

    if (queuedPreviewActionLabel) {
      window.setTimeout(() => {
        editableTextareaRef.current?.focus();
      }, 0);
    }
  }, [isEditable, queuedPreviewActionLabel]);

  React.useEffect(() => {
    if (textareaSelectionState) {
      setQueuedPreviewActionLabel(null);
    }
  }, [textareaSelectionState]);

  React.useEffect(() => {
    if (isEditable) {
      setIsZoomMenuOpen(false);
    }
  }, [isEditable]);

  React.useEffect(() => {
    if (!proposalContent || isEditable || !usesDocumentRenderer) {
      setDocumentPageCount(1);
    }
  }, [isEditable, proposalContent, usesDocumentRenderer]);

  const scheduleTextareaSelectionCheck = React.useCallback(() => {
    if (selectionDebounceRef.current !== null) {
      window.clearTimeout(selectionDebounceRef.current);
    }

    selectionDebounceRef.current = window.setTimeout(() => {
      selectionDebounceRef.current = null;
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
    }, 90);
  }, []);

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

  const handleRunInlineAiAction = React.useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!textareaSelectionState || !proposalContent) return;

      try {
        setPendingInlineAiActionId(actionId);
        setIsApplyingInlineAi(true);
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: textareaSelectionState.text,
        });
        const replacementText =
          typeof result?.text === "string" ? result.text : "";
        if (!replacementText.trim()) {
          return;
        }

        const nextContent =
          proposalContent.slice(0, textareaSelectionState.start) +
          replacementText +
          proposalContent.slice(textareaSelectionState.end);
        onContentChange?.(nextContent);
        setTextareaSelectionState(null);

        window.setTimeout(() => {
          const textarea = editableTextareaRef.current;
          if (!textarea) return;
          const selectionEnd =
            textareaSelectionState.start + replacementText.length;
          textarea.focus();
          textarea.setSelectionRange(selectionEnd, selectionEnd);
        }, 0);
      } finally {
        setIsApplyingInlineAi(false);
        setPendingInlineAiActionId(null);
      }
    },
    [
      onContentChange,
      proposalContent,
      textareaSelectionState,
      transformEditorSelectionAction,
    ],
  );

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
  const { attachViewport: attachPanViewport, viewportPanProps } =
    useDocumentPan({
      enabled: enablesDocumentZoom && effectiveZoomLevel > 1,
      onPan: updatePreviewScrollEdges,
    });
  const { attachViewport: attachAnchorViewport } = useDocumentViewportCentering(
    {
      enabled: enablesDocumentZoom,
      layoutKey: `${effectiveZoomLevel}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${resolvedTemplateId}:${proposalContent?.length ?? 0}:${mode}:${previewAnchor}`,
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
      data-toolbar-tooltip={
        mode === "preview" ? "Switch to edit" : "Switch to preview"
      }
      data-no-pan="true"
    >
      {mode === "preview" ? (
        <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  ) : null;

  const characterCountBadge = shouldShowCharacterCountBadge ? (
    resolvedCharacterLimitSelection.value === null &&
    !resolvedCharacterLimitSelection.advisory ? (
      <SemanticLengthBadge count={proposalCharacterCount} />
    ) : (
      <span
        className={(() => {
          if (resolvedCharacterLimitSelection.advisory) {
            return "dasti-pill dasti-proposal-character-badge dasti-proposal-character-badge--advisory";
          }
          if (characterCountTone === "danger")
            return "dasti-pill dasti-pill--danger";
          if (characterCountTone === "warning")
            return "dasti-pill dasti-pill--warning";
          return "dasti-pill dasti-proposal-character-badge";
        })()}
        title={
          resolvedCharacterLimitSelection.advisory
            ? "Approximate platform target. Treat this as a friendly guide, not a confirmed hard cap."
            : "Current draft length versus the selected limit."
        }
      >
        {formatCharacterCountLabel({
          count: proposalCharacterCount,
          limit: resolvedCharacterLimitSelection.value,
          advisory: resolvedCharacterLimitSelection.advisory,
        })}
      </span>
    )
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
            zoomIndex === 1
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
              isEditable || zoomIndex === 1
                ? "dasti-doc-zoom-fit dasti-doc-zoom-fit--active"
                : "dasti-doc-zoom-fit"
            }
            onClick={() => {
              if (isEditable) {
                return;
              }
              setZoomIndex(1);
              setFitRequestCount((count) => count + 1);
            }}
            aria-label="Fit page"
            data-toolbar-tooltip="Fit page"
            disabled={isEditable}
          >
            <CornersIn size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dasti-icon-button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={isEditable || zoomIndex === 0}
            aria-label="Zoom out"
            data-toolbar-tooltip="Zoom out"
          >
            <Minus size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dasti-icon-button"
            onClick={() =>
              setZoomIndex((i) =>
                Math.min(DOCUMENT_ZOOM_STEPS.length - 1, i + 1),
              )
            }
            disabled={
              isEditable || zoomIndex === DOCUMENT_ZOOM_STEPS.length - 1
            }
            aria-label="Zoom in"
            data-toolbar-tooltip="Zoom in"
          >
            <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </div>
    ) : null;

  const zoomControls = renderZoomControls(
    isZoomMenuOpen
      ? "dasti-doc-zoom-menu dasti-doc-zoom-menu--open"
      : "dasti-doc-zoom-menu",
  );
  const railStartControls =
    modeToggleControl || zoomControls || railStartAddon ? (
      <div
        className="dasti-proposal-rail-cluster dasti-toolbar--surface-tooltips"
        data-no-pan="true"
      >
        {modeToggleControl}
        {modeToggleControl && zoomControls ? (
          <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
        ) : null}
        {zoomControls}
        {railStartAddon ? (
          <>
            {modeToggleControl || zoomControls ? (
              <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            ) : null}
            {railStartAddon}
          </>
        ) : null}
      </div>
    ) : null;
  const floatingRail =
    railStartControls || actionControls ? (
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
      {documentMeta ? (
        <p className="dasti-proposal-sheet__meta">{documentMeta}</p>
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
          <div className="dasti-proposal-sheet__header-rail">{floatingRail}</div>
        ) : null}
        {detachedActionHeaderSupplement ? (
          <div className="dasti-proposal-sheet__header-rail">
            {detachedActionHeaderSupplement}
          </div>
        ) : null}
      </div>
    ) : null;

  const renderDocumentStage = () => (
    <div className="dasti-document-stage-chassis" ref={stageMeasureRef}>
      <div
        className="dasti-proposal-sheet__preview-stage"
        ref={attachPreviewViewport}
        data-stage-mode={previewStageMode}
        data-document-stage="true"
        style={{
          width: `${stageLayout.stageWidth}px`,
          height: `${stageLayout.stageHeight}px`,
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
            width: `${stageLayout.pageWidth}px`,
            height: `${renderedDocumentHeight}px`,
          }}
        >
          {usesFixedA4ScalePreview ? (
            <div
              className="dasti-proposal-sheet__preview-scale-shell"
              style={{
                width: `${A4_PAGE_WIDTH_PX}px`,
                height: `${renderedUnscaledDocumentHeight}px`,
                transform: `scale(${previewDocumentScale})`,
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
                  railTitle={railTitle}
                  railMeta={railMeta}
                  documentTitle={documentTitle}
                  documentMeta={documentMeta}
                  applicantHeader={applicantHeader}
                  documentTypography={documentTypography}
                  pageWidth={A4_PAGE_WIDTH_PX}
                  pageGapPx={unscaledDocumentPageGapPx}
                  onPageCountChange={setDocumentPageCount}
                />
              </div>
            </div>
          ) : (
            <div
              className={
                isEditable
                  ? "dasti-proposal-sheet__preview-page dasti-proposal-sheet__preview-page--editable"
                  : [
                      "dasti-proposal-sheet__preview-page",
                      isMultiPagePreview
                        ? "dasti-proposal-sheet__preview-page--stacked"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
              }
              data-document-page="true"
              style={{
                width: `${stageLayout.pageWidth}px`,
                height: `${isEditable ? stageLayout.pageHeight : renderedDocumentHeight}px`,
                aspectRatio: isMultiPagePreview ? "auto" : undefined,
              }}
              ref={editablePageRef}
              onClick={() => {
                if (!isEditable && mode === "preview") {
                  onPreviewInteract?.();
                }
              }}
            >
              {isEditable ? (
                <div className="dasti-proposal-editor-page">
                  <div className="dasti-proposal-editor-page__inner">
                    <textarea
                      ref={(node) => {
                        editableTextareaRef.current = node;
                        attachEditableScrollEdges(node);
                      }}
                      value={proposalContent ?? ""}
                      onChange={(event) => onContentChange?.(event.target.value)}
                      onBlur={() => {
                        setTextareaSelectionState(null);
                        onContentCommit?.();
                      }}
                      onSelect={scheduleTextareaSelectionCheck}
                      onMouseUp={scheduleTextareaSelectionCheck}
                      onKeyUp={scheduleTextareaSelectionCheck}
                      onScroll={() => {
                        updateEditableScrollEdges();
                        scheduleTextareaSelectionCheck();
                      }}
                      placeholder="Content will appear here…"
                      className="dasti-proposal-sheet__body--editable dasti-proposal-editor-page__textarea"
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
                        height: "100%",
                        resize: "none",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <ProposalDocumentRenderer
                  content={proposalContent ?? ""}
                  proposalType={proposalType}
                  templateId={resolvedTemplateId}
                  railTitle={railTitle}
                  railMeta={railMeta}
                  documentTitle={documentTitle}
                  documentMeta={documentMeta}
                  applicantHeader={applicantHeader}
                  documentTypography={documentTypography}
                  pageWidth={stageLayout.pageWidth}
                  pageGapPx={documentPageGapPx}
                  onPageCountChange={setDocumentPageCount}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  let sheetBody: React.ReactNode;

  if (loading) {
    sheetBody = (
      <div className={resolveBodyClassName({ letterLike: isLetterLike })}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s3)",
            width: "100%",
          }}
        >
          {[0.85, 1, 0.72, 0.95, 0.6].map((w, i) => (
            <div
              key={i}
              style={{
                height: 13,
                borderRadius: 4,
                width: `${w * 100}%`,
                background:
                  "linear-gradient(90deg, var(--sf2) 20%, var(--sfr) 50%, var(--sf2) 80%)",
                backgroundSize: "200% 100%",
                animation: `dasti-shimmer 1.4s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
          <div style={{ height: "var(--s3)" }} />
          {[0.9, 0.78, 1, 0.55].map((w, i) => (
            <div
              key={`b${i}`}
              style={{
                height: 13,
                borderRadius: 4,
                width: `${w * 100}%`,
                background:
                  "linear-gradient(90deg, var(--sf2) 20%, var(--sfr) 50%, var(--sf2) 80%)",
                backgroundSize: "200% 100%",
                animation: `dasti-shimmer 1.4s ease-in-out ${(i + 5) * 0.1}s infinite`,
              }}
            />
          ))}
          <p
            style={{
              marginTop: "var(--s4)",
              fontSize: "var(--tx)",
              color: "var(--tm2)",
            }}
          >
            Generating…
          </p>
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
            Proposal generation failed
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
  } else if (!proposalContent) {
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
          Generate a proposal to see the results here.
        </p>
      </div>
    );
  } else if (isEditable) {
    sheetBody = usesDocumentRenderer ? (
      <div
        className={resolveBodyClassName({
          letterLike: isLetterLike,
          documentEditor: isDocumentEditor,
        })}
        data-scroll-top={activeScrollTop ? "true" : "false"}
        data-scroll-bottom={activeScrollBottom ? "true" : "false"}
        style={activeScrollFadeStyle}
      >
        {queuedPreviewActionLabel ? (
          <div className="dasti-proposal-editor-hint" role="status" aria-live="polite">
            Select a paragraph, then use {queuedPreviewActionLabel.toLowerCase()} in
            the inline toolbar.
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
        <textarea
          ref={(node) => {
            editableTextareaRef.current = node;
            attachEditableScrollEdges(node);
          }}
          value={proposalContent}
          onChange={(event) => onContentChange?.(event.target.value)}
          onBlur={() => {
            setTextareaSelectionState(null);
            onContentCommit?.();
          }}
          onSelect={scheduleTextareaSelectionCheck}
          onMouseUp={scheduleTextareaSelectionCheck}
          onKeyUp={scheduleTextareaSelectionCheck}
          placeholder="Content will appear here…"
          className="dasti-proposal-sheet__body--editable"
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
                  {renderPlainLetterBody(proposalContent)}
                </div>
              ) : (
                <div className="max-w-none">
                  {renderPlainPreviewBody(proposalContent)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const viewerShell = (
    <div className="dasti-doc-viewer-shell">
      {isEditable && textareaSelectionState ? (
        <FloatingAiToolbar
          open
          anchor={textareaSelectionState.anchor}
          isLoading={isApplyingInlineAi}
          pendingActionId={pendingInlineAiActionId}
          onClose={() => setTextareaSelectionState(null)}
          onRunAction={handleRunInlineAiAction}
        />
      ) : null}
      <div ref={viewerSurfaceRef} className="dasti-doc-viewer-shell__surface">
        <div
          className={
            size === "focused"
              ? "dasti-proposal-sheet-frame dasti-proposal-sheet-frame--focused"
              : "dasti-proposal-sheet-frame"
          }
          style={proposalDocumentThemeVars}
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
        {!isEditable && proposalContent ? (
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
        ) : null}
        {characterCountBadge ? (
          <div
            ref={characterBadgeWrapRef}
            className="dasti-proposal-character-badge-wrap"
            data-overlap-hidden={
              isCharacterBadgeOverlappingPage ? "true" : "false"
            }
          >
            {characterCountBadge}
          </div>
        ) : null}
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
        </>
      )}
    </div>
  );
};

export default ProposalDisplay;
