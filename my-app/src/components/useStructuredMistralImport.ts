"use client";

import { useAction } from "convex/react";
import { useCallback } from "react";

import { api } from "../../convex/_generated/api";
import { convexClient } from "../lib/convex-client";
import type { AuthoritativeResume } from "../lib/authoritative-resume";
import {
  coerceAuthoritativeResume,
  hasTrustedAuthoritativeMistralImport,
} from "../lib/authoritative-resume";
import type { CvSection } from "../types/cvDocument";
import {
  applyStrictContactToSections,
  buildTypedSectionsFromNormalized,
} from "../utils/cv/mapping-utils";

export type StructuredImportTimingTrace = {
  id: string;
  source: string;
  fileName: string | null;
  startedAt: number;
};

export type StructuredPayload = {
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

type StructuredImportCallbacks = {
  onRetrying?: () => void | Promise<void>;
  onRetrySucceeded?: () => void | Promise<void>;
  trace?: StructuredImportTimingTrace | null;
};

type StructuredImportRunnerArgs = {
  invokeStructuredAction: (args: {
    file: ArrayBuffer;
    fileName: string;
    mimeType: string;
    mode: "auto";
    useMistral: true;
  }) => Promise<StructuredPayload>;
  callbacks?: StructuredImportCallbacks;
};

export type StructuredImportSuccess = {
  status: "success";
  payload: StructuredPayload;
  sections: CvSection[];
  authoritativeResume: AuthoritativeResume | null;
  emptyReason: string | null;
};

export type StructuredImportRejected = {
  status: "rejected";
  payload: StructuredPayload;
  message: string;
};

export type StructuredImportOutcome =
  | StructuredImportSuccess
  | StructuredImportRejected;

const MAX_BYTES = 5 * 1024 * 1024;
const MISTRAL_OCR_UNAVAILABLE_CODE = "mistral_ocr_unavailable";
const MISTRAL_OCR_UNAVAILABLE_MESSAGE =
  "Mistral OCR est momentanément indisponible. Réessayez.";
export const TRUSTED_MISTRAL_FILE_INPUT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

function buildMistralOcrUnavailableOutcome(): StructuredImportRejected {
  return {
    status: "rejected",
    payload: {
      diagnostics: {
        mistral_runtime: "mistral",
        mistral_fallback: false,
        mistral_import_error: MISTRAL_OCR_UNAVAILABLE_CODE,
      },
    },
    message: MISTRAL_OCR_UNAVAILABLE_MESSAGE,
  };
}

function isMistralImportUnavailableError(error: unknown): boolean {
  const candidate =
    error && typeof error === "object"
      ? (error as Record<string, any>)
      : null;
  const codes = [
    candidate?.code,
    candidate?.data?.code,
    candidate?.data?.error?.code,
  ];
  if (codes.some((code) => code === MISTRAL_OCR_UNAVAILABLE_CODE)) {
    return true;
  }

  const message =
    typeof error === "string"
      ? error
      : String(candidate?.message ?? error ?? "");
  return (
    message.includes(MISTRAL_OCR_UNAVAILABLE_CODE) ||
    message.includes("Connection lost while action was in flight") ||
    codes.some(
      (code) => code === "NetworkingError" || code === "ClientDisconnected",
    )
  );
}

function nowMs(): number {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.performance &&
    typeof globalThis.performance.now === "function"
  ) {
    return globalThis.performance.now();
  }
  return Date.now();
}

function shouldLogStructuredImportTiming(): boolean {
  if (
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    Boolean(import.meta.env.DEV)
  ) {
    return true;
  }

  if (typeof window !== "undefined") {
    return (window as any).__QUICK_START_IMPORT_DEBUG__ === true;
  }

  return process.env.NODE_ENV !== "production";
}

export function beginStructuredImportTimingTrace(
  source: string,
  fileName?: string | null,
): StructuredImportTimingTrace {
  return {
    id: `${source}:${Math.round(nowMs())}`,
    source,
    fileName: fileName ?? null,
    startedAt: nowMs(),
  };
}

export function logStructuredImportTiming(
  trace: StructuredImportTimingTrace | null | undefined,
  stage: string,
  details?: Record<string, unknown>,
): void {
  if (!trace || !shouldLogStructuredImportTiming()) {
    return;
  }

  const elapsedMs = Math.round((nowMs() - trace.startedAt) * 10) / 10;
  console.info("[resume-import-timing]", {
    traceId: trace.id,
    source: trace.source,
    fileName: trace.fileName,
    stage,
    elapsedMs,
    ...(details ?? {}),
  });
}

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

export function readStructuredDiagnostics(
  payload: StructuredPayload | null | undefined,
): Record<string, unknown> | null {
  return payload?.diagnostics && typeof payload.diagnostics === "object"
    ? (payload.diagnostics as Record<string, unknown>)
    : null;
}

export function readStructuredAuthoritativeResume(
  payload: StructuredPayload | null | undefined,
): AuthoritativeResume | null {
  return coerceAuthoritativeResume(payload?.authoritativeResume ?? null);
}

export function buildRejectedOcrStatusMessage(
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

export function readEmptyReasonFromDiagnostics(
  diagnostics: unknown,
): string | null {
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

function resolveMimeType(file: File): string {
  const lower = file.name.toLowerCase();
  if (file.type) {
    return file.type;
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "";
}

function buildSubmission(file: File): Promise<{
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}> {
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Please upload a file under 5MB.");
  }
  const mimeType = resolveMimeType(file);
  if (!mimeType) {
    throw new Error(
      "Unsupported file type. Please upload a scanned PDF or image.",
    );
  }
  return file.arrayBuffer().then((buffer) => ({
    buffer,
    fileName: file.name,
    mimeType,
  }));
}

async function runStructuredMistralImport(
  file: File,
  { invokeStructuredAction, callbacks }: StructuredImportRunnerArgs,
): Promise<StructuredImportOutcome> {
  const trace =
    callbacks?.trace ??
    beginStructuredImportTimingTrace("structured_import", file.name);

  logStructuredImportTiming(trace, "run.entered", {
    fileSizeBytes: file.size,
    fileType: file.type || null,
  });
  logStructuredImportTiming(trace, "submission.build.start");
  const submission = await buildSubmission(file);
  logStructuredImportTiming(trace, "submission.build.finish", {
    mimeType: submission.mimeType,
    byteLength: submission.buffer.byteLength,
  });
  // The upload action owns parser readiness, request retries, and the user-visible
  // latency budget. A synthetic OCR probe here is another provider request and
  // makes the user wait twice without improving the actual import result.
  logStructuredImportTiming(trace, "readiness_probe.skipped", {
    reason: "structured_upload_owns_mistral_request",
  });

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
    useMistral: true as const,
  };

  let payload: StructuredPayload;
  try {
    logStructuredImportTiming(trace, "structured_upload.start");
    payload = await invokeStructuredAction(actionArgs);
    logStructuredImportTiming(trace, "structured_upload.finish");
  } catch (err: unknown) {
    // The action owns retries. Known terminal Mistral/transport failures must
    // not be replayed by the browser and must use the same clear fail-closed
    // message as the server's typed Mistral error.
    if (!isMistralImportUnavailableError(err)) {
      throw err;
    }
    return buildMistralOcrUnavailableOutcome();
  }

  logStructuredImportTiming(trace, "trusted_validation.start");
  const authoritativeResume = readStructuredAuthoritativeResume(payload);
  const diagnostics = readStructuredDiagnostics(payload);
  const trustedImport = hasTrustedAuthoritativeMistralImport({
    authoritativeResume,
    mistralFallback: diagnostics?.mistral_fallback,
    mistralRuntime: diagnostics?.mistral_runtime,
  });
  logStructuredImportTiming(trace, "trusted_validation.finish", {
    trustedImport,
    mistralRuntime:
      typeof diagnostics?.mistral_runtime === "string"
        ? diagnostics.mistral_runtime
        : null,
    mistralFallback: diagnostics?.mistral_fallback === true,
  });

  if (!trustedImport) {
    return {
      status: "rejected",
      payload,
      message: buildRejectedOcrStatusMessage(payload),
    };
  }

  return {
    status: "success",
    payload,
    sections: buildSectionsFromNormalized(
      authoritativeResume?.normalized ?? null,
      payload?.strict,
    ),
    authoritativeResume,
    emptyReason: readEmptyReasonFromDiagnostics(payload?.diagnostics),
  };
}

export async function importStructuredMistralFileViaClient(
  file: File,
  callbacks?: StructuredImportCallbacks,
): Promise<StructuredImportOutcome> {
  const structuredActionRef =
    (api as any).actions?.structuredUpload?.structuredUpload ??
    (api as any)["actions/structuredUpload"]?.structuredUpload ??
    null;
  if (!structuredActionRef) {
    throw new Error("Structured pipeline action unavailable.");
  }

  // Quick Start relies on the canonical structuredUpload action only.
  // The action already performs route selection, health checks, retries,
  // and trusted-result gating, so an extra direct probe just adds latency.
  return await runStructuredMistralImport(file, {
    invokeStructuredAction: async (args) =>
      (await convexClient.action(structuredActionRef, args)) as StructuredPayload,
    callbacks,
  });
}

export function useStructuredMistralImport(options?: {
  probeOnMount?: boolean;
}) {
  void options;
  const structuredActionRef =
    (api as any).actions?.structuredUpload?.structuredUpload ??
    (api as any)["actions/structuredUpload"]?.structuredUpload ??
    null;
  const structuredAction = useAction(structuredActionRef);

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

  const importFile = useCallback(
    async (
      file: File,
      callbacks?: StructuredImportCallbacks,
    ): Promise<StructuredImportOutcome> => {
      if (typeof structuredAction !== "function") {
        throw new Error("Structured pipeline action unavailable.");
      }
      return await runStructuredMistralImport(file, {
        invokeStructuredAction: structuredAction,
        callbacks,
      });
    },
    [structuredAction],
  );

  return {
    enableMistral,
    importFile,
  };
}
