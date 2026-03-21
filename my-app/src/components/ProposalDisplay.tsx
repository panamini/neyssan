import React from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { FormValues } from "./ProposalInputForm.schemas";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";

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
}

const parseMarkdown = (content: string) => {
  const lines = content.split("\n");
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="mb-6 text-4xl font-bold">
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.substring(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mb-4 text-2xl font-semibold">
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.substring(3).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </h2>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-4" />);
    } else {
      elements.push(
        <p
          key={i}
          className="mb-4"
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            fontWeight: "inherit",
            letterSpacing: "inherit",
            color: "inherit",
          }}
        >
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </p>
      );
    }
  }

  return <>{elements}</>;
};

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
  const plainText = content
    .split(/\n\s*\n/)
    .map((part) => stripInlineMarkdown(part))
    .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);

  const normalized = plainText.join("\n\n");

  if (!normalized) {
    return (
      <div style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", fontWeight: "inherit", letterSpacing: "inherit", color: "inherit", whiteSpace: "pre-wrap" }}>
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

export function getDisplayedProposalText(
  content: string,
  proposalType?: FormValues["proposalType"] | null,
): string {
  if (proposalType === "cover_letter" || proposalType === "application_message") {
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
}) => {
  const fallbackDisclosure = getProposalGenerationFallbackDisclosureMessage(
    fallbackInfo ?? {},
  );
  const documentTypography = getProposalDocumentTypography(voicePreset);
  const showModeToggle = Boolean(onModeChange && proposalContent && !loading && !error);
  const hasDocumentHeader = Boolean(
    (documentTitle && documentTitle.trim().length > 0) ||
      (documentMeta && documentMeta.trim().length > 0) ||
      onCopy ||
      showModeToggle,
  );

  const renderDocumentHeader = () =>
    hasDocumentHeader ? (
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-proposal-sheet__heading">
          {documentTitle ? (
            <h3 className="dasti-proposal-sheet__title">{documentTitle}</h3>
          ) : null}
          {documentMeta ? (
            <p className="dasti-proposal-sheet__meta">{documentMeta}</p>
          ) : null}
        </div>
        <div className="dasti-proposal-sheet__controls">
          {showModeToggle ? (
            <button
              type="button"
              className={
                mode === "edit"
                  ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
                  : "dasti-icon-button dasti-proposal-mode-toggle"
              }
              onClick={() => onModeChange?.(mode === "edit" ? "preview" : "edit")}
              aria-label={mode === "edit" ? "Preview" : "Edit"}
              title={mode === "edit" ? "Preview" : "Edit"}
              aria-pressed={mode === "edit"}
            >
              <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />
            </button>
          ) : null}
          <span className="dasti-proposal-sheet__action-slot">
            {onCopy ? (
              <button
                type="button"
                onClick={onCopy}
                title={copyFeedback === "copied" ? "Copied" : "Copy"}
                aria-label={copyFeedback === "copied" ? "Copied" : "Copy"}
                className="dasti-icon-button"
                style={{ color: copyFeedback === "copied" ? "var(--ok)" : undefined }}
              >
                {copyFeedback === "copied" ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.5} aria-hidden="true" />}
              </button>
            ) : null}
          </span>
        </div>
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="dasti-proposal-sheet" aria-busy="true" aria-label="Generating proposal">
        {renderDocumentHeader()}
        <div className={hasDocumentHeader ? "dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header" : "dasti-proposal-sheet__body"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)", width: "100%" }}>
            {[0.85, 1, 0.72, 0.95, 0.6].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 13,
                  borderRadius: 4,
                  width: `${w * 100}%`,
                  background: "linear-gradient(90deg, var(--sf2) 20%, var(--sfr) 50%, var(--sf2) 80%)",
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
                  background: "linear-gradient(90deg, var(--sf2) 20%, var(--sfr) 50%, var(--sf2) 80%)",
                  backgroundSize: "200% 100%",
                  animation: `dasti-shimmer 1.4s ease-in-out ${(i + 5) * 0.1}s infinite`,
                }}
              />
            ))}
            <p style={{ marginTop: "var(--s4)", fontSize: "var(--tx)", color: "var(--tm2)" }}>
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
        className="rounded-[var(--rm)] border border-[color:var(--er)] [background:var(--erb)] p-6"
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
          className={hasDocumentHeader ? "dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header" : "dasti-proposal-sheet__body"}
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

  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";

  const isEditable = mode === "edit" && Boolean(onContentChange);

  return (
    <div className="grid gap-4">
      {fallbackDisclosure ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md border border-[color:var(--bo)] [background:var(--as)] px-4 py-3 text-sm text-foreground"
        >
          {fallbackDisclosure}
        </div>
      ) : null}
      <div className="dasti-proposal-sheet-frame">
        <div className="dasti-proposal-sheet">
          {renderDocumentHeader()}
          {isEditable ? (
            <div
              className={hasDocumentHeader ? `dasti-proposal-sheet__body dasti-proposal-sheet__body--with-header${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}` : `dasti-proposal-sheet__body${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`}
            >
              <textarea
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
                  paddingBottom: isLetterLike ? "var(--s5)" : undefined,
                }}
              />
            </div>
          ) : (
            <div
              className={hasDocumentHeader ? `dasti-proposal-sheet__body dasti-proposal-sheet__body--readonly dasti-proposal-sheet__body--with-header${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}` : `dasti-proposal-sheet__body dasti-proposal-sheet__body--readonly${isLetterLike ? " dasti-proposal-sheet__body--letter" : ""}`}
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
              >
                <div className="dasti-proposal-sheet__scroll-content">
                  {isLetterLike ? <div className="dasti-proposal-letter-lead" aria-hidden /> : null}
                  {isLetterLike ? (
                    <div className="max-w-none" style={{ paddingBottom: "var(--s5)" }}>
                      {renderPlainLetterBody(proposalContent)}
                    </div>
                  ) : (
                    <div className="prose prose-lg max-w-none dark:prose-invert prose-neutral">
                      {parseMarkdown(proposalContent)}
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
