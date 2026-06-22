"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  Loader2,
  ScanLine,
  Paperclip,
} from "@/lib/icons";
import { useToast } from "./ui/toast";
import {
  readEmptyReasonFromDiagnostics,
  readStructuredAuthoritativeResume,
  readStructuredDiagnostics,
  type StructuredPayload,
  useStructuredMistralImport,
} from "./useStructuredMistralImport";
import type { CvSection } from "../types/cvDocument";

export interface StructuredUploadButtonProps {
  sections?: CvSection[];
  onApplyToSections?: (updated: CvSection[], payload?: StructuredPayload) => void;
  onResult?: (payload: unknown) => void;
  className?: string;
  label?: string;
  ocrLabel?: string;
  ocrHelperText?: string;
  disabled?: boolean;
  contextKey?: string;
}

export type { StructuredPayload };

function coerceCopyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const MAX_BYTES = 5 * 1024 * 1024;
const OCR_ACCEPT = ".pdf,.png,.jpg,.jpeg";

export function StructuredUploadButton({
  sections: _sections,
  onApplyToSections,
  onResult,
  className,
  label,
  ocrLabel,
  ocrHelperText,
  disabled,
  contextKey,
}: StructuredUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "calling">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [latestPayload, setLatestPayload] = useState<StructuredPayload | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<null | "normalized" | "parser" | "rawText">(null);
  const { showToast } = useToast();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const scopeKeyRef = useRef<string>(contextKey ?? "");
  const pickerScopeKeyRef = useRef<string | null>(null);
  const { enableMistral, importFile } = useStructuredMistralImport({
    probeOnMount: false,
  });
  const [isDropTargeted, setIsDropTargeted] = useState(false);

  const mistralAvailable = enableMistral;
  const isBusy = status === "reading" || status === "calling";
  const debugEnabled =
    (typeof import.meta !== "undefined" &&
      typeof import.meta.env !== "undefined" &&
      Boolean(import.meta.env.DEV)) ||
    (typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true);
  const rawTextForCopy =
    coerceCopyText((latestPayload as any)?.rawText) ??
    coerceCopyText((latestPayload?.normalized as any)?.rawText) ??
    coerceCopyText((latestPayload?.debug as any)?.rawParser?.rawText) ??
    coerceCopyText((latestPayload?.debug as any)?.rawParser?.normalized?.rawText);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      pickerScopeKeyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextScopeKey = contextKey ?? "";
    if (scopeKeyRef.current === nextScopeKey) return;
    scopeKeyRef.current = nextScopeKey;
    requestIdRef.current += 1;
    pickerScopeKeyRef.current = null;
    setStatus("idle");
    setErrorMsg(null);
    setEmptyReason(null);
    setLatestPayload(null);
    setCopyFeedback(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [contextKey]);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setCopyFeedback(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyFeedback]);

  const trigger = useCallback(() => {
    if (disabled || isBusy) return;
    setErrorMsg(null);
    setEmptyReason(null);
    pickerScopeKeyRef.current = scopeKeyRef.current;
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, [disabled, isBusy]);

  const processFile = useCallback(
    async (file: File, sourceScopeKey: string) => {
      if (sourceScopeKey !== scopeKeyRef.current) {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const requestId = ++requestIdRef.current;
      const startedScopeKey = sourceScopeKey;
      const isCurrentRequest = () =>
        mountedRef.current &&
        requestIdRef.current === requestId &&
        scopeKeyRef.current === startedScopeKey;

      setStatus("reading");
      setErrorMsg(null);
      setEmptyReason(null);

      try {
        if (file.size > MAX_BYTES) {
          throw new Error("File too large. Please upload a file under 5MB.");
        }
        if (!isCurrentRequest()) return;

        setStatus("calling");
        const outcome = await importFile(file, {
          onRetrying: () => {
            console.info("Connection lost, retrying upload…");
            try {
              showToast("Retrying upload.", {
                variant: "neutral",
              });
            } catch {
              /* noop */
            }
          },
          onRetrySucceeded: () => {
            try {
              showToast("Uploaded.", { variant: "success" });
            } catch {
              /* noop */
            }
          },
        });
        if (!isCurrentRequest()) return;
        const payload = outcome.payload;
        setLatestPayload(payload);
        setCopyFeedback(null);
        const diagnostics = readStructuredDiagnostics(payload);
        const authoritativeResume = readStructuredAuthoritativeResume(payload);
        const diagnosticsEmptyReason = readEmptyReasonFromDiagnostics(
          payload?.diagnostics,
        );
        if (diagnostics) {
          console.info("[StructuredUploadButton][mistral] evidence", {
            ocr_request_path:
              typeof diagnostics.ocr_request_path === "string" ? diagnostics.ocr_request_path : null,
            ocr_engine: typeof diagnostics.ocr_engine === "string" ? diagnostics.ocr_engine : null,
            mistral_model:
              typeof diagnostics.mistral_model === "string" ? diagnostics.mistral_model : null,
            mistral_fallback:
              typeof diagnostics.mistral_fallback === "boolean" ? diagnostics.mistral_fallback : null,
            mistral_runtime:
              typeof diagnostics.mistral_runtime === "string" ? diagnostics.mistral_runtime : null,
          });
        }

        if (typeof onResult === "function") {
          try {
            onResult(payload);
          } catch {
            /* noop */
          }
        }

        if (outcome.status === "rejected") {
          setEmptyReason(outcome.message);
          try {
            showToast(outcome.message, { variant: "warning" });
          } catch {
            /* noop */
          }
          return;
        }
        const fullSections = outcome.sections;
        if (typeof onApplyToSections === "function" && fullSections.length > 0) {
          try {
            onApplyToSections(fullSections, payload);
          } catch {
            /* noop */
          }
        }
        if (!isCurrentRequest()) return;
        if (outcome.emptyReason ?? diagnosticsEmptyReason) {
          const emptyReason = outcome.emptyReason ?? diagnosticsEmptyReason;
          setEmptyReason(
            `Empty result. ${emptyReason}`,
          );
          try {
            showToast(
              `Empty result. ${emptyReason}`,
              { variant: "warning" },
            );
          } catch {
            /* noop */
          }
        } else {
          setEmptyReason(null);
          try {
            showToast(
              "Extracted.",
              { variant: "success" },
            );
          } catch {
            /* noop */
          }
        }
      } catch (err: any) {
        if (!isCurrentRequest()) return;
        let toastMessage = "Upload failed.";
        const errorData =
          err && typeof err === "object" ? (err).data : null;
        if (errorData && typeof errorData === "object" && errorData.code) {
          toastMessage = "Upload failed.";
          if (errorData.detail) {
            console.error(
              "[StructuredUploadButton] parser detail",
              errorData.detail,
            );
          }
        } else if (
          err &&
          typeof err === "object" &&
          "message" in err &&
          err.message
        ) {
          toastMessage = "Upload failed.";
        }
        setErrorMsg(toastMessage);
        setEmptyReason(null);
        const requestId =
          err?.requestId ?? errorData?.requestId ?? err?.context?.requestId;
        if (requestId) {
          console.error("[StructuredUploadButton] request id:", requestId);
        }
        console.error("[StructuredUploadButton] action failed", err);
        try {
          showToast(toastMessage, { variant: "destructive" });
        } catch {
          /* noop */
        }
      } finally {
        if (inputRef.current) inputRef.current.value = "";
        pickerScopeKeyRef.current = null;
        if (isCurrentRequest()) {
          setStatus("idle");
        }
      }
    },
    [
      onApplyToSections,
      onResult,
      showToast,
      importFile,
    ],
  );

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      const pendingScopeKey = pickerScopeKeyRef.current;
      pickerScopeKeyRef.current = null;
      if (!file || !pendingScopeKey) {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (pendingScopeKey !== scopeKeyRef.current) {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      await processFile(file, pendingScopeKey);
    },
    [processFile],
  );

  const handleDroppedFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file || disabled || isBusy) return;
      pickerScopeKeyRef.current = null;
      setIsDropTargeted(false);
      setEmptyReason(null);
      setErrorMsg(null);
      void processFile(file, scopeKeyRef.current);
    },
    [disabled, isBusy, processFile],
  );

  const importLabel = label ?? ocrLabel ?? "Scanned PDF / Image";
  const importHelperText =
    ocrHelperText ??
    "Use for scanned PDFs, photos, or image files. OCR results may need review.";
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.info("[UI_FLAG] mistral=", enableMistral);
    }
  }, [enableMistral]);

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={OCR_ACCEPT}
      className="hidden"
      onChange={handleChange}
    />
  );

  const copyPayload = useCallback(
    async (kind: "normalized" | "parser" | "rawText") => {
      const value =
        kind === "normalized"
          ? latestPayload?.normalized
          : kind === "parser"
            ? latestPayload?.debug?.rawParser
            : rawTextForCopy;
      if (value == null) {
        showToast("Nothing to copy.", { variant: "warning" });
        return;
      }
      const text = kind === "rawText" ? String(value) : JSON.stringify(value, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(kind);
        showToast("Copied.", { variant: "success" });
      } catch (err) {
        console.error("[StructuredUploadButton] copy failed", err);
        showToast("Copy failed.", { variant: "destructive" });
      }
    },
    [latestPayload, rawTextForCopy, showToast],
  );

  const debugCopyControls =
    debugEnabled && latestPayload ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void copyPayload("normalized")}
        >
          {copyFeedback === "normalized"
            ? "Copied normalized JSON"
            : "Copy normalized JSON"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void copyPayload("parser")}
          disabled={!latestPayload?.debug?.rawParser}
        >
          {copyFeedback === "parser"
            ? "Copied raw parser JSON"
            : "Copy raw parser JSON"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void copyPayload("rawText")}
          disabled={!rawTextForCopy}
        >
          {copyFeedback === "rawText" ? "Copied raw text" : "Copy raw text"}
        </Button>
      </div>
    ) : null;

  const hasActiveDropState = isDropTargeted && !disabled && !isBusy;

  return (
    <>
      {fileInput}
      <div className={className ?? ""}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled || isBusy || !enableMistral}
            className={`dasti-button dasti-button--secondary dasti-button--sm dasti-import-button${
              hasActiveDropState ? " dasti-import-button--drop" : ""
            }`}
            title={
              mistralAvailable
                ? hasActiveDropState
                  ? "Drop a scanned PDF or image here to import with Mistral OCR."
                  : importHelperText
                : "Scanned/image OCR upload is unavailable in this environment."
            }
            onClick={() => trigger()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDropTargeted(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setIsDropTargeted(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDropTargeted(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDroppedFiles(event.dataTransfer.files);
            }}
          >
            {isBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : hasActiveDropState ? (
              <Paperclip size={14} />
            ) : (
              <ScanLine size={14} />
            )}
            <span>{importLabel}</span>
          </button>
          {debugCopyControls}
        </div>
        {errorMsg ? (
          <span role="status" aria-live="polite" className="sr-only">
            {errorMsg}
          </span>
        ) : null}
        {emptyReason ? (
          <div className="dasti-import-empty-reason" role="status" aria-live="polite">
            {emptyReason}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default StructuredUploadButton;

/**
 * TODO: populate experience/education/skills/languages arrays in the pipeline so heuristics become
 * a true fallback rather than the primary source.
 */
