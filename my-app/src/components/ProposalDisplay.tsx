import React from "react";
import { Check, Copy, Eye, Minus, Pencil, Plus } from "@/lib/icons";
import type { FormValues } from "./ProposalInputForm.schemas";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";
import { useDocumentPan } from "../hooks/use-document-pan";
import { useDocumentStageLayout } from "../hooks/use-document-stage-layout";
import { useDocumentViewportCentering } from "../hooks/use-document-viewport-centering";
import { ProposalDocumentRenderer } from "./proposal-render/ProposalDocumentRenderer";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  buildVerbatiProposalDocumentVars,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { resolveProposalRenderState } from "../lib/proposal-render-state";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DOCUMENT_ZOOM_STEPS,
} from "../lib/document-stage";

interface ProposalDisplayProps {
  proposalContent: string | null;
  loading: boolean;
  error: string | null;
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
  mode?: "preview" | "edit";
  onModeChange?: (mode: "preview" | "edit") => void;
  onPreviewInteract?: () => void;
  onContentChange?: (value: string) => void;
  onContentCommit?: () => void;
  actions?: React.ReactNode;
  showModeToggle?: boolean;
  size?: "default" | "focused";
  previewAnchor?: "top" | "body";
  hideDocumentHeader?: boolean;
  documentHeaderMode?: "full" | "actions-only" | "hidden";
  showZoomControls?: boolean;
  zoomStorageKey?: string | null;
  documentTitleEditable?: boolean;
  onDocumentTitleChange?: (value: string) => void;
  onDocumentTitleCommit?: () => void;
  documentTitlePlaceholder?: string;
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
const PROPOSAL_PREVIEW_ZOOM_STORAGE_KEY = "dasti:proposal-preview-zoom-index:v1";

function readProposalZoomIndex(storageKey: string | null | undefined) {
  if (typeof window === "undefined" || !storageKey) {
    return 1;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  const parsedValue = Number.parseInt(rawValue ?? "", 10);

  if (
    Number.isInteger(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue < DOCUMENT_ZOOM_STEPS.length
  ) {
    return parsedValue;
  }

  return 1;
}

const ProposalDisplay: React.FC<ProposalDisplayProps> = ({
  proposalContent,
  loading,
  error,
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
  mode = "preview",
  onModeChange,
  onPreviewInteract,
  onContentChange,
  onContentCommit,
  actions,
  showModeToggle: allowModeToggle = true,
  size = "default",
  previewAnchor = "top",
  hideDocumentHeader = false,
  documentHeaderMode = "full",
  showZoomControls = false,
  zoomStorageKey = PROPOSAL_PREVIEW_ZOOM_STORAGE_KEY,
  documentTitleEditable = false,
  onDocumentTitleChange,
  onDocumentTitleCommit,
  documentTitlePlaceholder = "Proposal title",
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
  const proposalDocumentThemeVars = React.useMemo(
    () => buildVerbatiProposalDocumentVars(resolvedStylePreset),
    [resolvedStylePreset],
  );

  const [zoomIndex, setZoomIndex] = React.useState(() =>
    readProposalZoomIndex(zoomStorageKey),
  );
  const [fitRequestCount, setFitRequestCount] = React.useState(0);
  const zoomLevel = DOCUMENT_ZOOM_STEPS[zoomIndex];

  const {
    attach: attachEditableScrollEdges,
    showTop: showEditableScrollTop,
    showBottom: showEditableScrollBottom,
    update: updateEditableScrollEdges,
  } = useScrollEdgeFades<HTMLTextAreaElement>();
  const {
    attach: attachPreviewScrollEdges,
    showTop: showPreviewScrollTop,
    showBottom: showPreviewScrollBottom,
    update: updatePreviewScrollEdges,
  } = useScrollEdgeFades<HTMLDivElement>();
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const showModeToggle = Boolean(
    allowModeToggle && onModeChange && proposalContent && !loading && !error,
  );
  const resolvedDocumentHeaderMode = hideDocumentHeader
    ? "hidden"
    : documentHeaderMode;
  const hasDocumentCaption =
    resolvedDocumentHeaderMode === "full" &&
    Boolean(
      (documentTitle && documentTitle.trim().length > 0) ||
      (documentMeta && documentMeta.trim().length > 0),
    );
  const usesDocumentRenderer =
    proposalType === "cover_letter" ||
    proposalType === "application_message" ||
    proposalType === "freelance_proposal";
  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";
  const isEditable = mode === "edit" && Boolean(onContentChange);
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
  const stageLayout = useDocumentStageLayout({
    enabled: usesDocumentRenderer && Boolean(proposalContent),
    measurementRef: stageMeasureRef,
    zoomLevel: effectiveZoomLevel,
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
  const resolveBodyClassName = React.useCallback(
    ({
      isReadonly = false,
      letterLike = false,
    }: {
      isReadonly?: boolean;
      letterLike?: boolean;
    } = {}) => {
      const classNames = ["dasti-proposal-sheet__body"];

      if (isReadonly) {
        classNames.push("dasti-proposal-sheet__body--readonly");
      }
      if (usesDocumentRenderer) {
        classNames.push("dasti-proposal-sheet__body--document-viewer");
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
    if (typeof window === "undefined" || !showZoomControls || !zoomStorageKey) {
      return;
    }

    window.localStorage.setItem(
      zoomStorageKey,
      String(zoomIndex),
    );
  }, [showZoomControls, zoomIndex, zoomStorageKey]);

  React.useEffect(() => {
    setZoomIndex(readProposalZoomIndex(zoomStorageKey));
    setFitRequestCount((count) => count + 1);
  }, [zoomStorageKey]);

  const attachPreviewScrollContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      attachPreviewScrollEdges(node);
    },
    [attachPreviewScrollEdges],
  );
  const { attachViewport: attachPanViewport, viewportPanProps } = useDocumentPan({
    enabled: enablesDocumentZoom && effectiveZoomLevel > 1,
    onPan: updatePreviewScrollEdges,
  });
  const { attachViewport: attachAnchorViewport } = useDocumentViewportCentering({
    enabled: enablesDocumentZoom,
    layoutKey: `${effectiveZoomLevel}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${resolvedTemplateId}:${proposalContent?.length ?? 0}:${mode}:${previewAnchor}`,
    recenterKey: fitRequestCount,
    defaultCenterX: 0.5,
    defaultCenterY: previewAnchor === "body" ? 0.46 : 0.5,
    onSync: updatePreviewScrollEdges,
  });
  const attachPreviewViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      attachPreviewScrollContainer(node);
      attachPanViewport(node);
      attachAnchorViewport(node);
    },
    [attachAnchorViewport, attachPanViewport, attachPreviewScrollContainer],
  );

  const modeToggleControl = showModeToggle ? (
    <div
      className="dasti-proposal-view-toggle"
      role="group"
      aria-label="Proposal output mode"
      data-no-pan="true"
    >
      <button
        type="button"
        className={
          mode === "preview"
            ? "dasti-proposal-view-toggle__button dasti-proposal-view-toggle__button--active"
            : "dasti-proposal-view-toggle__button"
        }
        onClick={() => onModeChange?.("preview")}
        aria-pressed={mode === "preview"}
        aria-label="Rendered"
        title="Rendered"
      >
        <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={
          mode === "edit"
            ? "dasti-proposal-view-toggle__button dasti-proposal-view-toggle__button--active"
            : "dasti-proposal-view-toggle__button"
        }
        onClick={() => onModeChange?.("edit")}
        aria-pressed={mode === "edit"}
        aria-label="Editable"
        title="Editable"
      >
        <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  ) : null;

  const actionControls = actions || onCopy ? (
    <div className="dasti-proposal-sheet__controls" data-no-pan="true">
      {actions}
      <span className="dasti-proposal-sheet__action-slot">
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            title={copyFeedback === "copied" ? "Copied" : "Copy"}
            aria-label={copyFeedback === "copied" ? "Copied" : "Copy"}
            className="dasti-icon-button"
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
    showZoomControls && Boolean(proposalContent) && !loading && !error && usesDocumentRenderer ? (
      <div
        className={className}
        data-no-pan="true"
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
          title="Fit page"
          disabled={isEditable}
        >
          Fit
        </button>
        <button
          type="button"
          className="dasti-icon-button"
          onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          disabled={isEditable || zoomIndex === 0}
          aria-label="Zoom out"
          title="Zoom out"
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
          title="Zoom in"
        >
          <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    ) : null;

  const zoomControls = renderZoomControls("dasti-doc-zoom-bar");
  const floatingRail =
    modeToggleControl || zoomControls || actionControls ? (
      <div className="dasti-document-rail" data-no-pan="true">
        <div className="dasti-document-rail__section dasti-document-rail__section--start">
          {modeToggleControl}
        </div>
        <div className="dasti-document-rail__section dasti-document-rail__section--center">
          {zoomControls}
        </div>
        <div className="dasti-document-rail__section dasti-document-rail__section--end">
          {actionControls}
        </div>
      </div>
    ) : null;

  const documentCaption = hasDocumentCaption ? (
    <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--external">
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
  ) : null;

  const renderDocumentStage = () => (
    <div className="dasti-document-stage-chassis" ref={stageMeasureRef}>
      <div
        className="dasti-proposal-sheet__preview-stage"
        ref={attachPreviewViewport}
        data-stage-mode={stageMode}
        data-document-stage="true"
        style={{
          width: `${stageLayout.stageWidth}px`,
          height: `${stageLayout.stageHeight}px`,
        }}
        {...(!isEditable ? viewportPanProps : {})}
      >
        <div
          className="dasti-proposal-sheet__preview-page-positioner"
          style={{
            width: `${stageLayout.pageWidth}px`,
            height: `${stageLayout.pageHeight}px`,
          }}
        >
          <div
            className={
              isEditable
                ? "dasti-proposal-sheet__preview-page dasti-proposal-sheet__preview-page--editable"
                : "dasti-proposal-sheet__preview-page"
            }
            data-document-page="true"
            style={{
              width: `${stageLayout.pageWidth}px`,
              height: `${stageLayout.pageHeight}px`,
            }}
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
                    ref={attachEditableScrollEdges}
                    value={proposalContent ?? ""}
                    onChange={(event) => onContentChange?.(event.target.value)}
                    onBlur={onContentCommit}
                    placeholder="Content will appear here…"
                    className="dasti-proposal-sheet__body--editable"
                    style={{
                      fontFamily: documentTypography.fontFamily,
                      fontSize: "var(--tb)",
                      lineHeight: "var(--lb)",
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
                documentTypography={documentTypography}
                pageWidth={stageLayout.pageWidth}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  let sheetBody: React.ReactNode;

  if (loading) {
    sheetBody = (
      <div
        className={resolveBodyClassName({ letterLike: isLetterLike })}
      >
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
        className={resolveBodyClassName({ letterLike: isLetterLike })}
        data-scroll-top={activeScrollTop ? "true" : "false"}
        data-scroll-bottom={activeScrollBottom ? "true" : "false"}
      >
        {renderDocumentStage()}
      </div>
    ) : (
      <div
        className={resolveBodyClassName({ letterLike: isLetterLike })}
        data-scroll-top={activeScrollTop ? "true" : "false"}
        data-scroll-bottom={activeScrollBottom ? "true" : "false"}
      >
        <textarea
          ref={attachEditableScrollEdges}
          value={proposalContent}
          onChange={(event) => onContentChange?.(event.target.value)}
          onBlur={onContentCommit}
          placeholder="Content will appear here…"
          className="dasti-proposal-sheet__body--editable"
          style={{
            fontFamily: documentTypography.fontFamily,
            fontSize: "var(--tb)",
            lineHeight: "var(--lb)",
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
          lineHeight: "var(--lb)",
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
              style={zoomLevel !== 1 ? { width: `${zoomLevel * 100}%` } : undefined}
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
      {documentCaption}
      <div className="dasti-doc-viewer-shell">
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
            {floatingRail}
            {sheetBody}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDisplay;
