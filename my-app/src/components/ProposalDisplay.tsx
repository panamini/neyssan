import React from "react";
import { Check, Copy } from "lucide-react";
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
        <p key={i} className="mb-4 text-base leading-relaxed">
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
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((part) => stripInlineMarkdown(part))
    .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return (
      <p style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", fontWeight: "inherit", letterSpacing: "inherit", color: "inherit" }}>
        {stripInlineMarkdown(content)}
      </p>
    );
  }

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="mb-4 whitespace-pre-line last:mb-0"
          style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", fontWeight: "inherit", letterSpacing: "inherit", color: "inherit" }}
        >
          {paragraph}
        </p>
      ))}
    </>
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
}) => {
  const fallbackDisclosure = getProposalGenerationFallbackDisclosureMessage(
    fallbackInfo ?? {},
  );
  const documentTypography = getProposalDocumentTypography(voicePreset);

  if (loading) {
    return (
      <div className="rounded-[var(--rm)] border border-[color:var(--bo)] [background:var(--sf1)] p-6" aria-busy="true" aria-label="Generating proposal">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
          {[0.85, 1, 0.72, 0.95, 0.6].map((w, i) => (
            <div
              key={i}
              style={{
                height: 13,
                borderRadius: 4,
                width: `${w * 100}%`,
                background: "linear-gradient(90deg, var(--sf2) 25%, var(--sfr) 50%, var(--sf2) 75%)",
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
                background: "linear-gradient(90deg, var(--sf2) 25%, var(--sfr) 50%, var(--sf2) 75%)",
                backgroundSize: "200% 100%",
                animation: `dasti-shimmer 1.4s ease-in-out ${(i + 5) * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
        <p style={{ marginTop: "var(--s4)", fontSize: "var(--tx)", color: "var(--tg2)" }}>
          Generating…
        </p>
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
      <div className="rounded-[var(--rm)] border border-[color:var(--bo)] [background:var(--sf1)] p-6 text-center text-muted">
        Generate a proposal to see the results here.
      </div>
    );
  }

  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";

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
      <div
        style={{
          borderRadius: "var(--rm)",
          border: "1px solid var(--bo)",
          background: "var(--bg)",
          padding: "var(--s6)",
          minHeight: 360,
        }}
      >
        {onCopy ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--s3)" }}>
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
          </div>
        ) : null}
        <div
          style={{
            fontFamily: documentTypography.fontFamily,
            fontSize: documentTypography.fontSize,
            lineHeight: documentTypography.lineHeight,
            fontWeight: documentTypography.fontWeight,
            letterSpacing: documentTypography.letterSpacing,
            color: "var(--ti)",
            maxWidth: "none",
          }}
        >
          {isLetterLike ? (
            <div className="max-w-none">
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
  );
};

export default ProposalDisplay;
