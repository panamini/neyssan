import React from "react";
import type { GeneratedProposalState } from "./types";

function normalizeGeneratedText(value: string) {
  return value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

interface GeneratedTextProps {
  generatedProposal: GeneratedProposalState;
  onCopy: () => void;
  onExportPdf: () => void;
  onShare: () => void;
}

export function GeneratedText({
  generatedProposal,
  onCopy,
  onExportPdf,
  onShare,
}: GeneratedTextProps) {
  const normalizedText = normalizeGeneratedText(generatedProposal.text);
  const savedLabel = generatedProposal.proposalId ? "saved" : "draft";
  const modelLabel = generatedProposal.actualModelName || generatedProposal.actualModelType || "model pending";

  return (
    <div className="tw-result-wrapper">
      <div className="tw-generated-meta" aria-label="Generated proposal save and model status">
        <span>{savedLabel}</span>
        <span>{modelLabel}</span>
      </div>
      <div className="tw-result-stream">{normalizedText}</div>
      <div className="tw-export-bar" aria-label="Generated cover letter actions">
        <button className="tw-export-btn" type="button" onClick={onCopy} title="Copy letter" aria-label="Copy letter">
          <span className="tw-export-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M8 8.5A2.5 2.5 0 0 1 10.5 6H18a2 2 0 0 1 2 2v7.5a2.5 2.5 0 0 1-2.5 2.5H10a2 2 0 0 1-2-2V8.5Z" />
              <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
            </svg>
          </span>
          Copy
        </button>
        <button className="tw-export-btn" type="button" onClick={onShare} title="Share letter" aria-label="Share letter">
          <span className="tw-export-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M8.5 12.5 15.5 16" />
              <path d="M15.5 8 8.5 11.5" />
              <path d="M7 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path d="M17 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path d="M17 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            </svg>
          </span>
          Share
        </button>
        <button className="tw-export-btn" type="button" onClick={onExportPdf} title="Export PDF" aria-label="Export PDF">
          <span className="tw-export-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 3v10" />
              <path d="m8 9 4 4 4-4" />
              <path d="M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
          </span>
          PDF
        </button>
      </div>
    </div>
  );
}
