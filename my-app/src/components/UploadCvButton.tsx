"use client";

import React, { useRef, useEffect } from "react";
import { useCvParser, RefinedContent, IReviewerSection } from "../hooks/useCvParser";
import { Button } from "./ui/button";

interface UploadCvButtonProps {
  // Optional: interim suggestions + sections (legacy UI can still consume it if desired)
  onFileParsed?: (suggestions: RefinedContent, mappedSections: IReviewerSection[]) => void;
  // New optional callback to receive the raw normalized payload (with source)
  onNormalizedParsed?: (normalized: unknown, source?: "client" | "server" | null) => void;
  className?: string;
  // Optional: allow callers to provide an external parser instance (parseFile) and state.
  // When provided, the component becomes a thin file input that delegates parsing to the caller.
  parseFile?: (file: File) => Promise<void>;
  isParsing?: boolean;
  isRefining?: boolean;
  suggestions?: RefinedContent | null;
  mappedSections?: IReviewerSection[] | null;
  error?: string | null;
  // Optional job tracking to surface jobId/spinner inline
  jobId?: string | null;
  isPolling?: boolean;
}

/**
 * UploadCvButton
 *
 * Lightweight button + hidden file input that delegates parsing to useCvParser.
 * Calls `onFileParsed` when the hook produces suggestions + mappedSections.
 *
 * Accepts optional external parser props. If `parseFile` is provided the component will
 * delegate parsing to the provided function and rely on the caller to surface suggestions
 * via the `suggestions` / `mappedSections` props.
 */
export function UploadCvButton({
  onFileParsed,
  onNormalizedParsed,
  className,
  parseFile: externalParseFile,
  isParsing: externalIsParsing,
  isRefining: externalIsRefining,
  suggestions: externalSuggestions,
  mappedSections: externalMappedSections,
  error: externalError,
  jobId: externalJobId,
  isPolling: externalIsPolling,
}: UploadCvButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If the parent didn't provide an external parser, fall back to internal hook.
  const internal = externalParseFile ? null : useCvParser();
  const parseFile = externalParseFile ?? internal?.parseFile;
  const isParsing = externalIsParsing ?? internal?.isParsing ?? false;
  const isRefining = externalIsRefining ?? internal?.isRefining ?? false;
  const suggestions = externalSuggestions ?? internal?.suggestions ?? null;
  const mappedSections = externalMappedSections ?? internal?.mappedSections ?? [];
  const error = externalError ?? internal?.error ?? null;
  const jobId = externalJobId ?? internal?.jobId ?? null;
  const isPolling = externalIsPolling ?? internal?.isPolling ?? false;
  const lastNormalized = internal?.lastNormalized ?? null;
  const lastNormalizedSource = internal?.lastNormalizedSource ?? null;

  function handleButtonClick() {
    if (!inputRef.current) return;
    inputRef.current.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0] ?? null;
    if (!file || !parseFile) return;
    try {
      await parseFile(file);
    } catch {
      // parseFile surfaces errors via hook.error; swallow here to avoid uncaught rejections
    } finally {
      // allow re-uploading the same file by clearing the input
      try { e.currentTarget.value = ""; } catch {}
    }
  }

  // When using internal parser, optionally forward interim parsed suggestions (legacy)
  // and forward server-normalized payload once available.
  useEffect(() => {
    if (externalParseFile) return;

    // Optional legacy callback for interim parsed results
    if (typeof onFileParsed === "function") {
      if (suggestions && mappedSections && mappedSections.length > 0) {
        onFileParsed(suggestions, mappedSections);
      }
    }

    // Forward server-normalized payload only (block preview until server normalized)
    try {
      if (typeof onNormalizedParsed === "function" && lastNormalized && lastNormalizedSource === "server") {
        onNormalizedParsed(lastNormalized, lastNormalizedSource);
      }
    } catch {
      // swallow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, mappedSections, lastNormalized, lastNormalizedSource]);

  const label = error ? "Error" : isRefining ? "Refining..." : isParsing ? "Parsing..." : "Upload CV";

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={handleButtonClick}
        disabled={isParsing || isRefining}
        aria-disabled={isParsing || isRefining}
        aria-live="polite"
        variant="secondary"
      >
        {label}
        {(isRefining || isPolling) && (
          <svg className="w-4 h-4 ml-2 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        )}
      </Button>

      {/* Show compact job id/status when present */}
      {jobId && (isRefining || isPolling) && (
        <div className="mt-1 text-xs text-muted-foreground">
          Refining — {jobId}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden
      />
    </div>
  );
}