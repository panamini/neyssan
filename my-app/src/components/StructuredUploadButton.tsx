"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as convexReact from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "./ui/toast";
import type { CvSection } from "../types/cvDocument";
import { buildTypedSectionsFromNormalized, applyStrictContactToSections } from "../utils/cv/mapping-utils";

export interface StructuredUploadButtonProps {
  sections?: CvSection[];
  onApplyToSections?: (updated: CvSection[]) => void;
  onResult?: (payload: unknown) => void;
  className?: string;
  label?: string;
  ocrLabel?: string;
  helperText?: string;
  ocrHelperText?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  contextKey?: string;
}

type StructuredPayload = {
  normalized?: unknown;
  strict?: { name?: string | null; email?: string | null; phone?: string | null; location?: string | null; desiredPosition?: string | null | undefined } | null;
  layout?: unknown;
  diagnostics?: unknown;
};

const MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_ACCEPT = ".pdf,.txt";
const OCR_ACCEPT = ".pdf,.png,.jpg,.jpeg";

export function StructuredUploadButton({
  sections,
  onApplyToSections,
  onResult,
  className,
  label,
  ocrLabel,
  helperText,
  ocrHelperText,
  size = "sm",
  disabled,
  contextKey,
}: StructuredUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "calling">("idle");
  const [activeMode, setActiveMode] = useState<"default" | "mistral" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { showToast } = useToast();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const scopeKeyRef = useRef<string>(contextKey ?? "");
  const pickerRef = useRef<{ mode: "default" | "mistral"; scopeKey: string } | null>(null);

  const structuredActionRef =
    (api as any).actions?.structuredUpload?.structuredUpload ??
    (api as any)["actions/structuredUpload"]?.structuredUpload ??
    null;
  const structuredAction = (convexReact as any).useAction && structuredActionRef
    ? (convexReact as any).useAction(structuredActionRef)
    : undefined;

  const probeMistralRef =
    (api as any).actions?._probeMistral?.probe ??
    (api as any)["actions/_probeMistral"]?.probe ??
    null;
  const probeMistral = (convexReact as any).useAction && probeMistralRef
    ? (convexReact as any).useAction(probeMistralRef)
    : undefined;

  const enableMistral = (() => {
    if (typeof import.meta === "undefined" || typeof import.meta.env === "undefined") {
      return false;
    }
    const env = import.meta.env;
    const devDefault = Boolean(env.DEV);
    const parseFlag = (value: unknown): boolean | null => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      if (normalized === "1" || normalized === "true" || normalized === "on") return true;
      if (normalized === "0" || normalized === "false" || normalized === "off") return false;
      return null;
    };
    const primary = parseFlag((env as any).VITE_ENABLE_MISTRAL);
    if (primary !== null) return primary;
    const legacy = parseFlag((env as any).VITE_UI_ENABLE_MISTRAL_OCR);
    if (legacy !== null) return legacy;
    return devDefault;
  })();
  const [pendingMode, setPendingMode] = useState<"default" | "mistral">("default");
  const [mistralOk, setMistralOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof probeMistral !== "function") {
      setMistralOk(true);
      return;
    }
    let mounted = true;
    probeMistral({})
      .then((result: any) => {
        if (!mounted) return;
        setMistralOk(result?.ready?.status === 200);
      })
      .catch(() => {
        if (!mounted) return;
        setMistralOk(true);
      });
    return () => {
      mounted = false;
    };
  }, [probeMistral]);

  const mistralAvailable = enableMistral && mistralOk !== false;
  const isBusy = status === "reading" || status === "calling";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      pickerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextScopeKey = contextKey ?? "";
    if (scopeKeyRef.current === nextScopeKey) return;
    scopeKeyRef.current = nextScopeKey;
    requestIdRef.current += 1;
    pickerRef.current = null;
    setStatus("idle");
    setActiveMode(null);
    setErrorMsg(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [contextKey]);

  const trigger = useCallback((mode: "default" | "mistral") => {
    if (disabled || isBusy) return;
    setErrorMsg(null);
    setPendingMode(mode);
    pickerRef.current = { mode, scopeKey: scopeKeyRef.current };
    if (inputRef.current) {
      inputRef.current.accept = mode === "mistral" ? OCR_ACCEPT : DEFAULT_ACCEPT;
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, [disabled, isBusy]);

  async function buildSubmission(file: File): Promise<
    | { kind: "text"; rawText: string }
    | { kind: "file"; buffer: ArrayBuffer; fileName: string; mimeType: string }
  > {
    if (file.size > MAX_BYTES) {
      throw new Error("File too large. Please upload a file under 5MB.");
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf" || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      return { kind: "file", buffer: arrayBuffer, fileName: file.name, mimeType: file.type || "application/pdf" };
    }
    if (ext === "png" || file.type === "image/png") {
      const arrayBuffer = await file.arrayBuffer();
      return { kind: "file", buffer: arrayBuffer, fileName: file.name, mimeType: "image/png" };
    }
    if ((ext === "jpg" || ext === "jpeg") || file.type === "image/jpeg") {
      const arrayBuffer = await file.arrayBuffer();
      return { kind: "file", buffer: arrayBuffer, fileName: file.name, mimeType: "image/jpeg" };
    }
    if (ext === "txt" || file.type.startsWith("text/")) {
      const text = await file.text();
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error("Could not extract text from file.");
      }
      return { kind: "text", rawText: trimmed };
    }
    throw new Error("Unsupported file type. Please upload a PDF or TXT.");
  }

  const handleChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const pendingPicker = pickerRef.current;
    pickerRef.current = null;
    if (!file || !pendingPicker) {
      if (inputRef.current) inputRef.current.value = "";
      setPendingMode("default");
      return;
    }
    if (pendingPicker.scopeKey !== scopeKeyRef.current) {
      if (inputRef.current) inputRef.current.value = "";
      setPendingMode("default");
      return;
    }
    const requestId = ++requestIdRef.current;
    const startedScopeKey = scopeKeyRef.current;
    const startedMode = pendingPicker.mode;
    const isCurrentRequest = () =>
      mountedRef.current &&
      requestIdRef.current === requestId &&
      scopeKeyRef.current === startedScopeKey;

    setStatus("reading");
    setActiveMode(startedMode);
    setErrorMsg(null);

    try {
      if (typeof structuredAction !== "function") {
        throw new Error("Structured pipeline action unavailable.");
      }

      const submission = await buildSubmission(file);
      if (!isCurrentRequest()) return;

      setStatus("calling");
      const useMistralFlow = startedMode === "mistral";
      if (submission.kind === "file") {
        console.info(
          "[StructuredUploadButton] invoking structured pipeline (mode=auto) bytes=%d mistral=%s",
          submission.buffer.byteLength,
          useMistralFlow,
        );
      } else {
        console.info(
          "[StructuredUploadButton] invoking structured pipeline (mode=%s) rawLength=%d mistral=%s",
          "text",
          submission.rawText.length,
          useMistralFlow,
        );
      }

      const actionArgs =
        submission.kind === "file"
          ? { file: submission.buffer, fileName: submission.fileName, mimeType: submission.mimeType, mode: "auto" as const, useMistral: useMistralFlow }
          : { rawText: submission.rawText, mode: "text" as const, useMistral: useMistralFlow };

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
          try { showToast("Connection lost, retrying upload…", { variant: "neutral" }); } catch { /* noop */ }
          await new Promise((resolve) => setTimeout(resolve, 500));
          const result = await structuredAction(actionArgs);
          console.info("[StructuredUploadButton] retry succeeded");
          try { showToast("Upload retry succeeded", { variant: "success" }); } catch { /* noop */ }
          return result;
        }
      };

      const payload: StructuredPayload = await invokeWithRetry();
      if (!isCurrentRequest()) return;

      if (typeof onResult === "function") {
        try { onResult(payload); } catch { /* noop */ }
      }

      const normalized = payload?.normalized as unknown;
      if (normalized && typeof normalized === "object") {
        const typed = buildTypedSectionsFromNormalized(normalized as any);

        let merged = typed;
        const strict = payload?.strict;
        if (strict && Array.isArray(typed) && typed.length > 0) {
          merged = applyStrictContactToSections(typed, {
            name: strict.name ?? null,
            email: strict.email ?? null,
            phone: strict.phone ?? null,
            location: strict.location ?? null,
            desiredPosition: strict.desiredPosition ?? null,
          });
        }

        if (typeof onApplyToSections === "function" && merged.length > 0) {
          try { onApplyToSections(merged); } catch { /* noop */ }
        }
      }
      if (!isCurrentRequest()) return;
      try { showToast("Structured extraction completed", { variant: "success" }); } catch { /* noop */ }
    } catch (err: any) {
      if (!isCurrentRequest()) return;
      let toastMessage = "Upload failed";
      const errorData = err && typeof err === "object" ? (err as any).data : null;
      if (errorData && typeof errorData === "object" && errorData.code) {
        toastMessage = `Upload failed — code: ${errorData.code}`;
        if (errorData.detail) {
          console.error("[StructuredUploadButton] parser detail", errorData.detail);
        }
      } else if (err && typeof err === "object" && "message" in err && err.message) {
        toastMessage = `Upload failed — ${err.message}`;
      }
      setErrorMsg(toastMessage);
      const requestId = err?.requestId ?? errorData?.requestId ?? err?.context?.requestId;
      if (requestId) {
        console.error("[StructuredUploadButton] request id:", requestId);
      }
      console.error("[StructuredUploadButton] action failed", err);
      try { showToast(toastMessage, { variant: "destructive" }); } catch { /* noop */ }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setPendingMode("default");
      pickerRef.current = null;
      if (isCurrentRequest()) {
        setStatus("idle");
        setActiveMode(null);
      }
    }
  }, [structuredAction, onApplyToSections, onResult, showToast]);

  const primaryLabel = label ?? "Upload CV";
  const secondaryLabel = ocrLabel ?? "Scanned PDF / Image (OCR)";
  const primaryHelperText = helperText ?? "Best for normal PDFs and TXT resumes.";
  const secondaryHelperText = ocrHelperText ?? "Use for scanned PDFs, photos, or image files. OCR results may need review.";
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.info("[UI_FLAG] mistral=", enableMistral);
    }
  }, [enableMistral]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={pendingMode === "mistral" ? OCR_ACCEPT : DEFAULT_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />
      <div className={className ?? ""}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            aria-label={primaryLabel}
            title={primaryHelperText}
            onClick={() => trigger("default")}
            disabled={disabled || isBusy}
            className="inline-flex items-center"
            variant="secondary"
            size={size}
          >
            {isBusy && activeMode === "default" ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            <span className="ml-2 text-xs sm:text-sm">{primaryLabel}</span>
          </Button>
          <Button
            type="button"
            aria-label={secondaryLabel}
            title={mistralAvailable ? secondaryHelperText : "Scanned/image OCR upload is unavailable in this environment."}
            onClick={() => trigger("mistral")}
            disabled={disabled || isBusy || !mistralAvailable}
            className="inline-flex items-center"
            variant="secondary"
            size={size}
          >
            {isBusy && activeMode === "mistral" ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            <span className="ml-2 text-xs sm:text-sm">{secondaryLabel}</span>
          </Button>
        </div>
        {errorMsg ? (
          <span role="status" aria-live="polite" className="sr-only">
            {errorMsg}
          </span>
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
