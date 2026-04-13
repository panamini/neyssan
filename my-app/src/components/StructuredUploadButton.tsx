"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import {
  Loader2,
  ScanLine,
  Paperclip,
} from "@/lib/icons";
import { useToast } from "./ui/toast";
import type { CvSection } from "../types/cvDocument";
import {
  buildTypedSectionsFromNormalized,
  applyStrictContactToSections,
} from "../utils/cv/mapping-utils";
import {
  coerceAuthoritativeResume,
  hasTrustedAuthoritativeMistralImport,
  type AuthoritativeResume,
} from "../lib/authoritative-resume";

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

type StructuredPayload = {
  normalized?: unknown;
  authoritativeResume?: AuthoritativeResume | null;
  strict?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    desiredPosition?: string | null | undefined;
  } | null;
  layout?: unknown;
  diagnostics?: unknown;
  debug?: {
    rawParser?: unknown;
  } | null;
};

export type { StructuredPayload };

function buildSectionsFromNormalized(
  normalized: unknown,
  strict?: StructuredPayload["strict"],
): CvSection[] {
  if (!normalized || typeof normalized !== "object") {
    return [];
  }
  const typed = buildTypedSectionsFromNormalized(normalized as any);
  if (!strict || typed.length === 0) {
    return typed;
  }
  return applyStrictContactToSections(typed, {
    name: strict.name ?? null,
    email: strict.email ?? null,
    phone: strict.phone ?? null,
    location: strict.location ?? null,
    desiredPosition: strict.desiredPosition ?? null,
  });
}

function readStructuredDiagnostics(
  payload: StructuredPayload | null | undefined,
): Record<string, unknown> | null {
  return payload?.diagnostics && typeof payload.diagnostics === "object"
    ? (payload.diagnostics as Record<string, unknown>)
    : null;
}

function readStructuredAuthoritativeResume(
  payload: StructuredPayload | null | undefined,
): AuthoritativeResume | null {
  return coerceAuthoritativeResume(payload?.authoritativeResume ?? null);
}

function buildRejectedOcrStatusMessage(
  payload: StructuredPayload | null | undefined,
): string {
  const diagnostics = readStructuredDiagnostics(payload);
  const mistralRuntime =
    typeof diagnostics?.mistral_runtime === "string"
      ? diagnostics.mistral_runtime
      : null;
  const mistralFallback = diagnostics?.mistral_fallback === true;
  if (mistralRuntime === "local_fallback") {
    return "OCR import rejected (fallback/untrusted). Local fallback output is debug-only.";
  }
  if (mistralFallback) {
    return "OCR import rejected (fallback/untrusted). Fallback OCR output is debug-only.";
  }
  return "OCR import rejected (fallback/untrusted). Trusted authoritative Mistral result required.";
}

function readEmptyReasonFromDiagnostics(diagnostics: unknown): string | null {
  if (!diagnostics || typeof diagnostics !== "object") return null;
  const record = diagnostics as Record<string, unknown>;
  const candidate =
    typeof record.empty_reason === "string"
      ? record.empty_reason
      : typeof record.error === "string"
        ? record.error
        : null;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : null;
}

function coerceCopyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const MAX_BYTES = 5 * 1024 * 1024;
const OCR_ACCEPT = ".pdf,.png,.jpg,.jpeg";
const MISTRAL_PROBE_TTL_MS = 10_000;

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

  const structuredActionRef =
    (api as any).actions?.structuredUpload?.structuredUpload ??
    (api as any)["actions/structuredUpload"]?.structuredUpload ??
    null;
  const structuredAction =
    (convexReact as any).useAction && structuredActionRef
      ? (convexReact as any).useAction(structuredActionRef)
      : undefined;

  const probeMistralRef =
    (api as any).actions?._probeMistral?.probe ??
    (api as any)["actions/_probeMistral"]?.probe ??
    null;
  const probeMistral =
    (convexReact as any).useAction && probeMistralRef
      ? (convexReact as any).useAction(probeMistralRef)
      : undefined;

  const enableMistral = (() => {
    if (
      typeof import.meta === "undefined" ||
      typeof import.meta.env === "undefined"
    ) {
      return false;
    }
    const env = import.meta.env;
    const devDefault = Boolean(env.DEV);
    const parseFlag = (value: unknown): boolean | null => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      if (normalized === "1" || normalized === "true" || normalized === "on")
        return true;
      if (normalized === "0" || normalized === "false" || normalized === "off")
        return false;
      return null;
    };
    const primary = parseFlag((env as any).VITE_ENABLE_MISTRAL);
    if (primary !== null) return primary;
    const legacy = parseFlag((env as any).VITE_UI_ENABLE_MISTRAL_OCR);
    if (legacy !== null) return legacy;
    return devDefault;
  })();
  const [mistralOk, setMistralOk] = useState<boolean | null>(null);
  const [isDropTargeted, setIsDropTargeted] = useState(false);
  const mistralProbePromiseRef = useRef<Promise<boolean> | null>(null);
  const mistralProbeCheckedAtRef = useRef(0);

  const resolveMistralProbeOk = useCallback((result: any): boolean => {
    const readyStatus = result?.ready?.status;
    const parseStatus = result?.parse?.status;
    return readyStatus === 200 && parseStatus === 200;
  }, []);

  const ensureMistralReady = useCallback(async (options?: { force?: boolean }): Promise<boolean> => {
    const force = options?.force === true;
    if (typeof probeMistral !== "function") {
      setMistralOk(true);
      return true;
    }
    const probeAgeMs = Date.now() - mistralProbeCheckedAtRef.current;
    if (!force && mistralOk === true && probeAgeMs < MISTRAL_PROBE_TTL_MS) {
      return true;
    }
    if (!force && mistralOk === false) {
      return false;
    }
    if (!mistralProbePromiseRef.current) {
      mistralProbePromiseRef.current = probeMistral({})
        .then((result: any) => {
          const ok = resolveMistralProbeOk(result);
          mistralProbeCheckedAtRef.current = Date.now();
          if (mountedRef.current) {
            setMistralOk(ok);
          }
          return ok;
        })
        .catch(() => {
          mistralProbeCheckedAtRef.current = Date.now();
          if (mountedRef.current) {
            setMistralOk(false);
          }
          return false;
        })
        .finally(() => {
          mistralProbePromiseRef.current = null;
        });
    }
    return await mistralProbePromiseRef.current;
  }, [mistralOk, probeMistral, resolveMistralProbeOk]);

  useEffect(() => {
    void ensureMistralReady();
    return () => {
      mistralProbePromiseRef.current = null;
    };
  }, [ensureMistralReady]);

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

  async function buildSubmission(file: File): Promise<{
    buffer: ArrayBuffer;
    fileName: string;
    mimeType: string;
  }> {
    if (file.size > MAX_BYTES) {
      throw new Error("File too large. Please upload a file under 5MB.");
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf" || file.type === "application/pdf") {
      return {
        buffer: await file.arrayBuffer(),
        fileName: file.name,
        mimeType: file.type || "application/pdf",
      };
    }
    if (ext === "png" || file.type === "image/png") {
      return {
        buffer: await file.arrayBuffer(),
        fileName: file.name,
        mimeType: "image/png",
      };
    }
    if (ext === "jpg" || ext === "jpeg" || file.type === "image/jpeg") {
      return {
        buffer: await file.arrayBuffer(),
        fileName: file.name,
        mimeType: "image/jpeg",
      };
    }
    throw new Error(
      "Unsupported file type. Please upload a scanned PDF or image.",
    );
  }

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
        if (typeof structuredAction !== "function") {
          throw new Error("Structured pipeline action unavailable.");
        }

        const submission = await buildSubmission(file);
        if (!isCurrentRequest()) return;

        const probeOk = await ensureMistralReady({ force: true });
        if (!isCurrentRequest()) return;
        if (!probeOk) {
          console.warn(
            "[StructuredUploadButton][mistral] live probe failed; continuing with upload and relying on server-side retries",
          );
        }

        setStatus("calling");
        console.info(
          "[StructuredUploadButton] invoking structured pipeline bytes=%d mistral=%s",
          submission.buffer.byteLength,
          true,
        );

        const actionArgs = {
          file: submission.buffer,
          fileName: submission.fileName,
          mimeType: submission.mimeType,
          mode: "auto" as const,
          useMistral: true,
        };

        const invokeWithRetry = async (): Promise<StructuredPayload> => {
          if (typeof structuredAction !== "function") {
            throw new Error("Structured pipeline action unavailable.");
          }
          try {
            return await structuredAction(actionArgs);
          } catch (err: any) {
            const message = String(err?.message ?? err ?? "");
            const code = String((err as any)?.code ?? "");
            const shouldRetry =
              message.includes("Connection lost while action was in flight") ||
              code === "NetworkingError" ||
              code === "ClientDisconnected";
            if (!shouldRetry) {
              throw err;
            }
            console.info("Connection lost, retrying upload…");
            try {
              showToast("Connection lost, retrying upload…", {
                variant: "neutral",
              });
            } catch {
              /* noop */
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            const result = await structuredAction(actionArgs);
            console.info("[StructuredUploadButton] retry succeeded");
            try {
              showToast("Upload retry succeeded", { variant: "success" });
            } catch {
              /* noop */
            }
            return result;
          }
        };

        const payload: StructuredPayload = await invokeWithRetry();
        if (!isCurrentRequest()) return;
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

        const isTrustedOcrImport =
          hasTrustedAuthoritativeMistralImport({
            authoritativeResume,
            mistralFallback: diagnostics?.mistral_fallback,
            mistralRuntime: diagnostics?.mistral_runtime,
          });
        const fullSections = isTrustedOcrImport
          ? buildSectionsFromNormalized(
              authoritativeResume?.normalized ?? null,
              payload?.strict,
            )
          : [];
        if (!isTrustedOcrImport) {
          const rejectionMessage = buildRejectedOcrStatusMessage(payload);
          setEmptyReason(rejectionMessage);
          try {
            showToast(rejectionMessage, { variant: "warning" });
          } catch {
            /* noop */
          }
          return;
        }
        if (typeof onApplyToSections === "function" && fullSections.length > 0) {
          try {
            onApplyToSections(fullSections, payload);
          } catch {
            /* noop */
          }
        }
        if (!isCurrentRequest()) return;
        if (diagnosticsEmptyReason) {
          setEmptyReason(
            `Parser returned empty result: ${diagnosticsEmptyReason}`,
          );
          try {
            showToast(
              `Parser returned empty result: ${diagnosticsEmptyReason}`,
              { variant: "warning" },
            );
          } catch {
            /* noop */
          }
        } else {
          setEmptyReason(null);
          try {
            showToast(
              "Structured extraction completed",
              { variant: "success" },
            );
          } catch {
            /* noop */
          }
        }
      } catch (err: any) {
        if (!isCurrentRequest()) return;
        let toastMessage = "Upload failed";
        const errorData =
          err && typeof err === "object" ? (err as any).data : null;
        if (errorData && typeof errorData === "object" && errorData.code) {
          toastMessage = `Upload failed — code: ${errorData.code}`;
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
          toastMessage = `Upload failed — ${err.message}`;
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
      structuredAction,
      mistralAvailable,
      ensureMistralReady,
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
        showToast("Nothing to copy", { variant: "warning" });
        return;
      }
      const text = kind === "rawText" ? String(value) : JSON.stringify(value, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(kind);
        showToast(
          kind === "normalized"
            ? "Copied normalized JSON"
            : kind === "parser"
              ? "Copied raw parser JSON"
              : "Copied raw text",
          { variant: "success" },
        );
      } catch (err) {
        console.error("[StructuredUploadButton] copy failed", err);
        showToast("Copy failed", { variant: "destructive" });
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
