"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
};

type StructuredImportRunnerArgs = {
  invokeStructuredAction: (args: {
    file: ArrayBuffer;
    fileName: string;
    mimeType: string;
    mode: "auto";
    useMistral: true;
  }) => Promise<StructuredPayload>;
  invokeProbeMistral?: (() => Promise<any>) | undefined;
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
const MISTRAL_PROBE_TTL_MS = 10_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  { invokeStructuredAction, invokeProbeMistral, callbacks }: StructuredImportRunnerArgs,
): Promise<StructuredImportOutcome> {
  const submission = await buildSubmission(file);
  if (typeof invokeProbeMistral === "function") {
    try {
      const result = await invokeProbeMistral();
      const readyStatus = result?.ready?.status;
      const parseStatus = result?.parse?.status;
      if (!(readyStatus === 200 && parseStatus === 200)) {
        console.warn(
          "[StructuredUploadButton][mistral] live probe failed; continuing with upload and relying on server-side retries",
        );
      }
    } catch {
      console.warn(
        "[StructuredUploadButton][mistral] live probe failed; continuing with upload and relying on server-side retries",
      );
    }
  }

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
    payload = await invokeStructuredAction(actionArgs);
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
    await callbacks?.onRetrying?.();
    await sleep(500);
    payload = await invokeStructuredAction(actionArgs);
    console.info("[StructuredUploadButton] retry succeeded");
    await callbacks?.onRetrySucceeded?.();
  }

  const authoritativeResume = readStructuredAuthoritativeResume(payload);
  const diagnostics = readStructuredDiagnostics(payload);
  const trustedImport = hasTrustedAuthoritativeMistralImport({
    authoritativeResume,
    mistralFallback: diagnostics?.mistral_fallback,
    mistralRuntime: diagnostics?.mistral_runtime,
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
  const probeMistralRef =
    (api as any).actions?._probeMistral?.probe ??
    (api as any)["actions/_probeMistral"]?.probe ??
    null;

  return await runStructuredMistralImport(file, {
    invokeStructuredAction: async (args) =>
      (await convexClient.action(structuredActionRef, args)) as StructuredPayload,
    invokeProbeMistral: probeMistralRef
      ? async () => await convexClient.action(probeMistralRef, {})
      : undefined,
    callbacks,
  });
}

export function useStructuredMistralImport(options?: {
  probeOnMount?: boolean;
}) {
  const probeOnMount = options?.probeOnMount !== false;
  const structuredActionRef =
    (api as any).actions?.structuredUpload?.structuredUpload ??
    (api as any)["actions/structuredUpload"]?.structuredUpload ??
    null;
  const structuredAction =
    structuredActionRef ? useAction(structuredActionRef) : undefined;

  const probeMistralRef =
    (api as any).actions?._probeMistral?.probe ??
    (api as any)["actions/_probeMistral"]?.probe ??
    null;
  const probeMistral = probeMistralRef ? useAction(probeMistralRef) : undefined;

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
  const mountedRef = useRef(true);
  const mistralProbePromiseRef = useRef<Promise<boolean> | null>(null);
  const mistralProbeCheckedAtRef = useRef(0);

  const resolveMistralProbeOk = useCallback((result: any): boolean => {
    const readyStatus = result?.ready?.status;
    const parseStatus = result?.parse?.status;
    return readyStatus === 200 && parseStatus === 200;
  }, []);

  const ensureMistralReady = useCallback(
    async (options?: { force?: boolean }): Promise<boolean> => {
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
    },
    [mistralOk, probeMistral, resolveMistralProbeOk],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (probeOnMount) {
      void ensureMistralReady();
    }
    return () => {
      mountedRef.current = false;
      mistralProbePromiseRef.current = null;
    };
  }, [ensureMistralReady, probeOnMount]);

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
        invokeProbeMistral:
          typeof probeMistral === "function"
            ? async () => {
                const probeOk = await ensureMistralReady({ force: true });
                return probeOk
                  ? { ready: { status: 200 }, parse: { status: 200 } }
                  : { ready: { status: 0 }, parse: { status: 0 } };
              }
            : undefined,
        callbacks,
      });
    },
    [ensureMistralReady, probeMistral, structuredAction],
  );

  return {
    enableMistral,
    mistralOk,
    ensureMistralReady,
    importFile,
  };
}
