import React from "react";
import type { FormValues } from "./ProposalInputForm.schemas";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import {
  getProposalGenerationFallbackDisclosureMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";

interface ProposalDisplayProps {
  proposalContent: string | null;
  loading: boolean;
  error: string | null;
  /** Raw backend error message — shown as dev-only diagnostic block */
  errorDetail?: string | null;
  proposalType?: FormValues["proposalType"] | null;
  fallbackInfo?: ProposalGenerationFallbackInfo | null;
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
      <p className="text-[15px] leading-7 text-foreground">
        {stripInlineMarkdown(content)}
      </p>
    );
  }

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-4 whitespace-pre-line text-[15px] leading-7 text-foreground last:mb-0">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function getDisplayedProposalText(
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

function fallbackCopyText(text: string): boolean {
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
}) => {
  const { showToast } = useToast();
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const fallbackDisclosure = getProposalGenerationFallbackDisclosureMessage(
    fallbackInfo ?? {},
  );
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    if (!proposalContent) return;

    const displayedProposalText = getDisplayedProposalText(
      proposalContent,
      proposalType,
    );

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayedProposalText);
      } else if (!fallbackCopyText(displayedProposalText)) {
        throw new Error("Clipboard unavailable");
      }

      setCopyFeedback("copied");
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback("idle");
        copyFeedbackTimeoutRef.current = null;
      }, 2000);
      showToast("Proposal copied", { variant: "success" });
    } catch (copyError) {
      console.warn("Failed to copy proposal:", copyError);
      showToast("Copy failed", {
        variant: "error",
        description: "Clipboard access was unavailable.",
      });
    }
  }, [proposalContent, proposalType, showToast]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[color:var(--bo)] bg-background p-6">
        <div className="text-sm font-medium text-foreground">
          Generating proposal
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Preparing the latest draft now.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-lg border border-[color:var(--er)] [background:var(--erb)] p-6"
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
      <div className="rounded-lg border border-[color:var(--bo)] bg-background p-6 text-center text-muted">
        Generate a proposal to see the results here.
      </div>
    );
  }

  const isLetterLike =
    proposalType === "cover_letter" || proposalType === "application_message";

  return (
    <div className="rounded-lg border border-[color:var(--bo)] bg-background p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-foreground">
          Generated proposal
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            void handleCopy();
          }}
        >
          {copyFeedback === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      {/* Model diagnostics strip — shown in dev or when there was a fallback */}
      {(fallbackInfo?.requestedModelType || fallbackInfo?.actualModelType) && (
        <div
          className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs [color:var(--tg2)]"
          aria-label="Generation diagnostics"
        >
          {fallbackInfo.requestedModelType && (
            <span>requested: <span className="[color:var(--tm2)]">{fallbackInfo.requestedModelType}</span></span>
          )}
          {fallbackInfo.actualModelType && fallbackInfo.actualModelType !== fallbackInfo.requestedModelType && (
            <span>actual: <span className="[color:var(--tm2)]">{fallbackInfo.actualModelType}</span></span>
          )}
          {fallbackInfo.fallbackTriggerCode && (
            <span>trigger: <span className="[color:var(--tm2)]">{fallbackInfo.fallbackTriggerCode}</span></span>
          )}
        </div>
      )}
      {fallbackDisclosure ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md border border-[color:var(--bo)] [background:var(--as)] px-4 py-3 text-sm text-foreground"
        >
          {fallbackDisclosure}
        </div>
      ) : null}
      {isLetterLike ? (
        <div className="max-w-none">
          {renderPlainLetterBody(proposalContent)}
        </div>
      ) : (
        <div className="prose prose-lg prose-gray dark:prose-invert max-w-none">
          {parseMarkdown(proposalContent)}
        </div>
      )}
    </div>
  );
};

export default ProposalDisplay;
