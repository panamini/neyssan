import React from "react";
import { Check, Copy, Pencil } from "@/lib/icons";
import type { FormValues } from "./ProposalInputForm.schemas";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";

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
  hideDocumentHeader?: boolean;
  documentHeaderMode?: "full" | "actions-only" | "hidden";
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
  hideDocumentHeader = false,
  documentHeaderMode = "full",
  documentTitleEditable = false,
  onDocumentTitleChange,
  onDocumentTitleCommit,
  documentTitlePlaceholder = "Proposal title",
}) => {
  const fallbackDisclosure = getProposalGenerationFallbackDisclosureMessage(
    fallbackInfo ?? {},
  );
  const documentTypography = getProposalDocumentTypography(voicePreset);
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
  const showModeToggle = Boolean(
    allowModeToggle && onModeChange && proposalContent && !loading && !error,
  );
  const resolvedDocumentHeaderMode = hideDocumentHeader
    ? "hidden"
    : documentHeaderMode;
  const hasHeaderCopyControl = Boolean(onCopy);
  const hasHeaderControls = Boolean(
    actions || hasHeaderCopyControl || showModeToggle,
  );
  const hasHeaderText =
    resolvedDocumentHeaderMode === "full" &&
    Boolean(
      (documentTitle && documentTitle.trim().length > 0) ||
      (documentMeta && documentMeta.trim().length > 0),
    );
  const shouldRenderDocumentHeader =
    resolvedDocumentHeaderMode !== "hidden" &&
    (hasHeaderText || hasHeaderControls);
  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";
  const isEditable = mode === "edit" && Boolean(onContentChange);
  const activeScrollTop = isEditable
    ? showEditableScrollTop
    : showPreviewScrollTop;
  const activeScrollBottom = isEditable
    ? showEditableScrollBottom
    : showPreviewScrollBottom;

  React.useEffect(() => {
    updateEditableScrollEdges();
    updatePreviewScrollEdges();
  }, [
    documentMeta,
    documentTitle,
    shouldRenderDocumentHeader,
    isEditable,
    proposalContent,
    proposalType,
    size,
    updateEditableScrollEdges,
    updatePreviewScrollEdges,
  ]);

  const renderDocumentHeader = () =>
    shouldRenderDocumentHeader ? (
      <div
        className={
          resolvedDocumentHeaderMode === "actions-only"
            ? "dasti-proposal-sheet__header dasti-proposal-sheet__header--actions-only"
            : "dasti-proposal-sheet__header"
        }
      >
        {hasHeaderText ? (
          <div className="dasti-proposal-sheet__heading">
            {documentTitleEditable ? (
              <input
                type="text"
                value={documentTitle ?? ""}
                onChange={(event) =>
                  onDocumentTitleChange?.(event.target.value)
                }
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
        ) : null}
        <div className="dasti-proposal-sheet__controls">
          {showModeToggle ? (
            <button
              type="button"
              className={
                mode === "edit"
                  ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
                  : "dasti-icon-button dasti-proposal-mode-toggle"
              }
              onClick={() =>
                onModeChange?.(mode === "edit" ? "preview" : "edit")
              }
              aria-label={mode === "edit" ? "Preview" : "Edit"}
              title={mode === "edit" ? "Preview" : "Edit"}
              aria-pressed={mode === "edit"}
            >
              <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />
            </button>
          ) : null}
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
      </div>
    ) : null;

  if (loading) {
    return (
      <div
        className="dasti-proposal-sheet"
        aria-busy="true"
        aria-label="Generating proposal"
      >
        {renderDocumentHeader()}
        <div
          className={
            shouldRenderDocumentHeader
              ? "dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header"
              : "dasti-proposal-sheet__body"
          }
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
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!proposalContent) {
    return (
      <div className="dasti-proposal-sheet">
        {renderDocumentHeader()}
        <div
          className={
            shouldRenderDocumentHeader
              ? "dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header"
              : "dasti-proposal-sheet__body"
          }
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
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {fallbackDisclosure ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md border border-[color:var(--color-border)] [background:var(--as)] px-4 py-3 text-sm text-foreground"
        >
          {fallbackDisclosure}
        </div>
      ) : null}
      <div
        className={
          size === "focused"
            ? "dasti-proposal-sheet-frame dasti-proposal-sheet-frame--focused"
            : "dasti-proposal-sheet-frame"
        }
      >
        <div
          className={
            size === "focused"
              ? "dasti-proposal-sheet dasti-proposal-sheet--focused"
              : "dasti-proposal-sheet"
          }
        >
          {renderDocumentHeader()}
          {isEditable ? (
            <div
              className={
                shouldRenderDocumentHeader
                  ? `dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`
                  : `dasti-proposal-sheet__body${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`
              }
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
                  paddingTop: isLetterLike
                    ? "clamp(28px, 6vh, 52px)"
                    : undefined,
                  paddingBottom: "var(--proposal-sheet-content-bottom-inset)",
                }}
              />
            </div>
          ) : (
            <div
              className={
                shouldRenderDocumentHeader
                  ? `dasti-proposal-sheet__body dasti-proposal-sheet__body--readonly dasti-proposal-sheet__body--with-header${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`
                  : `dasti-proposal-sheet__body dasti-proposal-sheet__body--readonly${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`
              }
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
              onClick={() => {
                if (mode === "preview") {
                  onPreviewInteract?.();
                }
              }}
            >
              <div
                className={
                  isLetterLike
                    ? "dasti-proposal-sheet__scroll dasti-proposal-sheet__scroll--letter"
                    : "dasti-proposal-sheet__scroll"
                }
                ref={attachPreviewScrollEdges}
              >
                <div className="dasti-proposal-sheet__scroll-content">
                  {isLetterLike ? (
                    <div className="dasti-proposal-letter-lead" aria-hidden />
                  ) : null}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalDisplay;
