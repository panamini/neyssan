'use node';

import { action } from "../_generated/server";
import { FormData } from "undici";
import { v, ConvexError } from "convex/values";
import { recordTelemetry } from "../../config/llmTelemetry";
import { canonicalizeParserResult, firstSentence } from "../lib/parsing/canonicalize";
import { buildImportRecoveryPayload } from "../lib/parsing/importRecovery";
import { filterRecoverySourceSectionsForRedundantHeader } from "../lib/parsing/recoverySourceFilter";

type UResponse = import("undici").Response;

type ParserRunnerMeta = {
  returncode?: number;
  stdout?: string;
  stderr?: string;
  fallback_triggered?: boolean;
};

type CanonicalPayload = {
  rawText?: string;
  raw?: string;
  normalized?: Record<string, any>;
  summary?: any;
  summaryFirstSentence?: string;
  diagnostics?: Record<string, any>;
  rawSections?: Array<Record<string, any>>;
  sections?: Array<Record<string, any>>;
};

type ParserResponse = {
  result?: CanonicalPayload;
  runner?: ParserRunnerMeta;
  source_kind?: string;
} & CanonicalPayload;

export function buildCanonicalizeInput(payload: ParserResponse): CanonicalPayload {
  const resultPayload =
    payload?.result && typeof payload.result === "object" ? payload.result : {};
  const topNormalized =
    payload?.normalized && typeof payload.normalized === "object" ? payload.normalized : {};
  const resultNormalized =
    (resultPayload as any)?.normalized && typeof (resultPayload as any).normalized === "object"
      ? (resultPayload as any).normalized
      : {};

  const mergedRawText =
    typeof (topNormalized as any)?.rawText === "string" && (topNormalized as any).rawText.trim()
      ? (topNormalized as any).rawText
      : typeof payload?.rawText === "string" && payload.rawText.trim()
        ? payload.rawText
        : typeof resultNormalized?.rawText === "string" && resultNormalized.rawText.trim()
          ? resultNormalized.rawText
          : typeof (resultPayload as any)?.rawText === "string" && (resultPayload as any).rawText.trim()
            ? (resultPayload as any).rawText
            : "";

  const mergedRaw =
    typeof (topNormalized as any)?.raw === "string" && (topNormalized as any).raw.trim()
      ? (topNormalized as any).raw
      : typeof payload?.raw === "string" && payload.raw.trim()
        ? payload.raw
        : typeof resultNormalized?.raw === "string" && resultNormalized.raw.trim()
          ? resultNormalized.raw
          : typeof (resultPayload as any)?.raw === "string" && (resultPayload as any).raw.trim()
            ? (resultPayload as any).raw
            : "";

  const mergedRawSections =
    Array.isArray((topNormalized as any)?.rawSections) && (topNormalized as any).rawSections.length > 0
      ? (topNormalized as any).rawSections
      : Array.isArray((payload as any)?.rawSections) && (payload as any).rawSections.length > 0
        ? (payload as any).rawSections
        : Array.isArray((payload as any)?.sections) && (payload as any).sections.length > 0
          ? (payload as any).sections
          : Array.isArray(resultNormalized?.rawSections) && resultNormalized.rawSections.length > 0
            ? resultNormalized.rawSections
            : Array.isArray((resultPayload as any)?.rawSections) && (resultPayload as any).rawSections.length > 0
            ? (resultPayload as any).rawSections
            : [];

  const mergedSections =
    Array.isArray((topNormalized as any)?.sections) && (topNormalized as any).sections.length > 0
      ? (topNormalized as any).sections
      : Array.isArray((payload as any)?.sections) && (payload as any).sections.length > 0
        ? (payload as any).sections
        : Array.isArray(resultNormalized?.sections) && resultNormalized.sections.length > 0
          ? resultNormalized.sections
          : Array.isArray((resultPayload as any)?.sections) && (resultPayload as any).sections.length > 0
            ? (resultPayload as any).sections
            : [];

  return {
    ...resultPayload,
    rawText: mergedRawText || (resultPayload as any).rawText,
    raw: mergedRaw || (resultPayload as any).raw,
    rawSections: mergedRawSections,
    sections: mergedSections,
    normalized: {
      ...resultNormalized,
      ...topNormalized,
      rawText: mergedRawText || resultNormalized?.rawText || (topNormalized as any)?.rawText,
      raw: mergedRaw || resultNormalized?.raw || (topNormalized as any)?.raw,
      rawSections: mergedRawSections,
      sections: mergedSections,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientParserStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

type ParserAttempt = {
  endpoint: URL;
  label: string;
};

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    const normalized = trimmed.replace(/\/+$/, "");
    return normalized || null;
  }
}

function isQuickTunnel(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return /\.trycloudflare\.com$/i.test(hostname);
  } catch {
    return /trycloudflare\.com/i.test(url);
  }
}

function isLoopbackUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

function resolveParserEndpoints(targetPath = "/parse-cv"): ParserAttempt[] {
  const attempts: ParserAttempt[] = [];
  const seen = new Set<string>();

  const pushCandidate = (raw: string | undefined | null, label: string) => {
    const value = raw?.trim();
    if (!value) {
      return;
    }
    if (isQuickTunnel(value)) {
      console.warn(
        "[structuredUpload] Ignoring quick tunnel candidate (%s) label=%s",
        value,
        label,
      );
      return;
    }
    let endpoint: URL;
    try {
      endpoint = new URL(value);
    } catch (err) {
      console.error(
        "[structuredUpload] Ignoring invalid parser URL candidate (%s) label=%s error=%s",
        value,
        label,
        err,
      );
      return;
    }
    const normalizedTarget = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
    const resolved = new URL(normalizedTarget, endpoint);
    resolved.search = "";
    resolved.hash = "";
    const key = resolved.toString();
    if (seen.has(key)) {
      return;
    }
    attempts.push({ endpoint: resolved, label });
    seen.add(key);
    console.debug(
      "[structuredUpload] registered parser candidate label=%s raw=%s normalizedPath=%s url=%s",
      label,
      value,
      resolved.pathname,
      resolved.toString(),
    );
  };

  const envCandidatesRaw: Array<[string | null, string]> = [
    [normalizeOrigin(process.env.CONVEX_PARSER_URL), "env:CONVEX_PARSER_URL"],
    [normalizeOrigin(process.env.PARSER_ORIGIN), "env:PARSER_ORIGIN"],
    [normalizeOrigin(process.env.VITE_CONVEX_PARSER_URL), "env:VITE_CONVEX_PARSER_URL"],
    [normalizeOrigin(process.env.VITE_PARSER_URL), "env:VITE_PARSER_URL"],
  ];
  const envCandidates = envCandidatesRaw
    .map(([origin, label]) => ({ origin, label }))
    .filter((entry): entry is { origin: string; label: string } => Boolean(entry.origin) && !isQuickTunnel(entry.origin!));

  console.debug(
    "[structuredUpload] ENV CONVEX_PARSER_URL=%s candidates=%j",
    process.env.CONVEX_PARSER_URL ?? "<unset>",
    envCandidates.map((entry) => entry.label),
  );

  if (envCandidates.length === 0) {
    throw new Error(
      "structuredUpload requires CONVEX_PARSER_URL (or PARSER_ORIGIN) configured with a non-trycloudflare origin. Set it via `npx convex env set CONVEX_PARSER_URL https://parser.dasti.ai`.",
    );
  }

  const primaryOrigin = envCandidates[0].origin;
  pushCandidate(primaryOrigin, envCandidates[0].label);

  const allowLocalFallback = process.env.STRUCTURED_UPLOAD_ALLOW_LOOPBACK_FALLBACK === "1";
  if (isLoopbackUrl(primaryOrigin)) {
    console.warn(
      "[structuredUpload] CONVEX_PARSER_URL points to loopback (%s); local fallbacks will be used.",
      primaryOrigin,
    );
    pushCandidate(`http://127.0.0.1:8000${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`, "fallback:loopback");
    pushCandidate(`http://localhost:8000${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`, "fallback:localhost");
  } else if (allowLocalFallback) {
    console.info(
      "[structuredUpload] STRUCTURED_UPLOAD_ALLOW_LOOPBACK_FALLBACK enabled; adding local fallbacks as a last resort.",
    );
    pushCandidate(`http://127.0.0.1:8000${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`, "fallback:loopback");
    pushCandidate(`http://localhost:8000${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`, "fallback:localhost");
  }

  if (attempts.length === 0) {
    throw new Error(
      "structuredUpload misconfigured: provide CONVEX_PARSER_URL or ensure local parser is running on http://127.0.0.1:8000",
    );
  }

  return attempts;
}

async function ensureParserReachable(
  endpoint: URL,
  accessHeaders?: Record<string, string> | null,
): Promise<void> {
  const healthUrl = new URL(endpoint.toString());
  healthUrl.pathname = "/ready";
  healthUrl.search = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (accessHeaders) {
      Object.assign(headers, accessHeaders);
    }
    const res = await fetch(healthUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`health check returned ${res.status}`);
    }
  } catch (err: any) {
    console.error(
      "[structuredUpload] health check failed url=%s error=%s",
      healthUrl.toString(),
      err?.stack ?? err,
    );
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForParserRecovery(
  endpoint: URL,
  accessHeaders?: Record<string, string> | null,
  maxWaitMs = 15_000,
): Promise<boolean> {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    attempt += 1;
    try {
      await ensureParserReachable(endpoint, accessHeaders);
      console.info(
        "[structuredUpload] parser recovery check succeeded url=%s attempt=%d waitedMs=%d",
        endpoint.toString(),
        attempt,
        Date.now() - startedAt,
      );
      return true;
    } catch (err: any) {
      const waitedMs = Date.now() - startedAt;
      console.warn(
        "[structuredUpload] parser recovery check pending url=%s attempt=%d waitedMs=%d error=%s",
        endpoint.toString(),
        attempt,
        waitedMs,
        err?.message ?? err,
      );
      if (waitedMs >= maxWaitMs) {
        break;
      }
      await sleep(Math.min(1_500 * attempt, 3_000));
    }
  }

  return false;
}

export const structuredUpload = action({
  args: {
    rawText: v.optional(v.string()),
    file: v.optional(v.bytes()),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("auto"), v.literal("text"), v.literal("ocr"))),
    storageId: v.optional(v.id("_storage")),
    fileUrl: v.optional(v.string()),
    useMistral: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, { rawText, file, fileName, mimeType, mode, storageId, fileUrl, useMistral }) => {
    const STRICT_EMPTY_CHECK = process.env.STRUCTURED_UPLOAD_STRICT_EMPTY_CHECK === "1";
    const hasRawText = typeof rawText === "string" && rawText.trim().length > 0;
    const hasDirectFile = file instanceof ArrayBuffer && file.byteLength > 0;
    const storageIdValue = storageId ?? null;
    const hasStorageId = typeof storageIdValue === "string" && storageIdValue.length > 0;
    const fileUrlTrimmed = typeof fileUrl === "string" ? fileUrl.trim() : "";
    const hasFileUrl = fileUrlTrimmed.length > 0;
    const hasFileSource = hasDirectFile || hasStorageId || hasFileUrl;

    if (!hasRawText && !hasFileSource) {
      throw new ConvexError({ code: "invalid_input_missing_source" });
    }
    if (hasRawText && hasFileSource) {
      throw new ConvexError({ code: "invalid_input_both_text_and_file" });
    }

    const resolvedMode = mode ?? (hasFileSource ? "auto" : "text");
    const activeUseMistral = !!useMistral;
    if (activeUseMistral && (resolvedMode === "text" || !hasFileSource)) {
      throw new ConvexError({ code: "mistral_requires_file" });
    }
    if (resolvedMode === "text" && !hasRawText) {
      throw new ConvexError({ code: "invalid_input_text_missing" });
    }
    if (resolvedMode !== "text" && !hasFileSource) {
      throw new ConvexError({ code: "invalid_input_file_missing" });
    }

    const trimmed = hasRawText ? rawText!.trim() : "";
    let fileNameForUpload = (fileName && fileName.trim()) || null;
    let mimeTypeForUpload = mimeType?.trim() || null;
    let fileBytes: Uint8Array | null = null;

    if (hasDirectFile) {
      fileBytes = new Uint8Array(file as ArrayBuffer);
    } else if (hasStorageId) {
      const stored = await ctx.storage.get(storageIdValue!);
      if (!stored) {
        throw new Error(`storageId not found: ${storageIdValue}`);
      }
      const buffer = await stored.arrayBuffer();
      fileBytes = new Uint8Array(buffer);
      if (!mimeTypeForUpload) {
        mimeTypeForUpload = stored.type || null;
      }
      if (!fileNameForUpload) {
        fileNameForUpload = "storage-upload.bin";
      }
    } else if (hasFileUrl) {
      let response: Response;
      try {
        response = await fetch(fileUrlTrimmed);
      } catch (err: any) {
        throw new Error(`Failed to fetch fileUrl (${fileUrlTrimmed}): ${err?.message ?? err}`);
      }
      if (!response.ok) {
        throw new Error(
          `Failed to fetch fileUrl (${fileUrlTrimmed}): ${response.status} ${response.statusText}`,
        );
      }
      const buffer = await response.arrayBuffer();
      fileBytes = new Uint8Array(buffer);
      if (!mimeTypeForUpload) {
        const headerMime = response.headers.get("content-type");
        if (headerMime) {
          mimeTypeForUpload = headerMime;
        }
      }
      if (!fileNameForUpload) {
        try {
          const parsed = new URL(fileUrlTrimmed);
          const candidate = parsed.pathname.split("/").filter(Boolean).pop();
          if (candidate) {
            fileNameForUpload = candidate;
          }
        } catch {
          // ignore URL parse issues
        }
        if (!fileNameForUpload) {
          fileNameForUpload = "remote-upload.bin";
        }
      }
    }

    if (resolvedMode !== "text" && !fileBytes) {
      if (activeUseMistral) {
        throw new ConvexError({ code: "mistral_requires_file" });
      }
      throw new Error("Auto/OCR mode requires accessible file bytes");
    }

    if (!mimeTypeForUpload) {
      const lower = (fileNameForUpload || "").toLowerCase();
      if (lower.endsWith(".png")) mimeTypeForUpload = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeTypeForUpload = "image/jpeg";
      else if (lower.endsWith(".pdf")) mimeTypeForUpload = "application/pdf";
      else if (lower.endsWith(".txt")) mimeTypeForUpload = "text/plain";
      else if (resolvedMode !== "text") mimeTypeForUpload = "application/octet-stream";
    }

    if (!fileNameForUpload && fileBytes) {
      fileNameForUpload = "upload.bin";
    }

    const parserPath = activeUseMistral ? "/mistral-ocr/parse" : "/parse-cv";
    // Read origin from Convex server env
    const envGet = (ctx as any)?.env?.get?.bind((ctx as any).env) ?? null;
    const envRaw = envGet ? (envGet("CONVEX_PARSER_URL") as string | undefined) : (process.env.CONVEX_PARSER_URL as string | undefined);
    const cfAccessClientId = envGet
      ? (envGet("CF_ACCESS_CLIENT_ID") as string | undefined)
      : (process.env.CF_ACCESS_CLIENT_ID as string | undefined);
    const cfAccessClientSecret = envGet
      ? (envGet("CF_ACCESS_CLIENT_SECRET") as string | undefined)
      : (process.env.CF_ACCESS_CLIENT_SECRET as string | undefined);
    const useAccessHeaders = Boolean(cfAccessClientId && cfAccessClientSecret);
    if (!useAccessHeaders) {
      console.info("[structuredUpload] CF Access headers: disabled (missing env)");
    }
    const parserAccessHeaders = useAccessHeaders
      ? {
          "CF-Access-Client-Id": cfAccessClientId as string,
          "CF-Access-Client-Secret": cfAccessClientSecret as string,
        }
      : null;
    const baseParserUrl = (envRaw ?? "").trim();
    const baseOriginRaw = (() => {
      try {
        if (baseParserUrl) {
          return new URL(baseParserUrl).origin;
        }
      } catch {
        /* ignore */
      }
      return baseParserUrl.replace(/\/+$/, "");
    })();
    const baseOrigin = baseOriginRaw && !isQuickTunnel(baseOriginRaw) ? baseOriginRaw : "";
    // Ensure resolveParserEndpoints sees the normalized origin only
    if (baseOrigin) {
      try { (process as any).env.CONVEX_PARSER_URL = baseOrigin; } catch { /* noop */ }
    }
    const parserAttempts = resolveParserEndpoints(parserPath);
    const primaryUrl = (() => {
      try {
        const origin = parserAttempts[0]?.endpoint?.origin || baseOrigin || "http://127.0.0.1:8000";
        return new URL(parserPath, origin).toString();
      } catch {
        return parserAttempts[0]?.endpoint?.toString?.() ?? "";
      }
    })();
    const chosenOrigin = parserAttempts[0]?.endpoint?.origin || baseOrigin || "";
    console.info("[structuredUpload] route", {
      origin: chosenOrigin,
      path: parserPath,
      url: primaryUrl,
      useMistral: activeUseMistral,
      useAccessHeaders,
    });
    const skipHealth = process.env.STRUCTURED_UPLOAD_SKIP_HEALTHCHECK === "1" || activeUseMistral;

    console.info(
      "[structuredUpload] prepared submission mode=%s raw=%s file=%s bytes=%s mime=%s attempts=%d useMistral=%s",
      resolvedMode,
      hasRawText,
      hasFileSource,
      fileBytes ? fileBytes.byteLength : trimmed.length,
      mimeTypeForUpload,
      parserAttempts.length,
      activeUseMistral,
    );
    const aggregatedErrors: string[] = [];
    let lastResponse: UResponse | null = null;
    let lastPayload: ParserResponse | null = null;
    let selectedEndpoint: ParserAttempt | null = null;
    let selectedMode: ParserMode | null = null;
    let lastHttpStatus: number | null = null;
    let lastBodySnippet: string | null = null;
    let lastCfRay: string | null = null;

    type ParserMode = "auto" | "ocr" | "text";

    const extractParserResult = (payload: ParserResponse | null | undefined): CanonicalPayload | null => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      if (payload.result && typeof payload.result === "object") {
        return payload.result as CanonicalPayload;
      }
      return payload as CanonicalPayload;
    };

    const normalizedHasMeaningfulContent = (resultObj: any): boolean => {
      if (!resultObj || typeof resultObj !== "object") {
        return false;
      }

      const normalized =
        resultObj.normalized && typeof resultObj.normalized === "object"
          ? resultObj.normalized
          : {};
      const diagnostics =
        resultObj.diagnostics && typeof resultObj.diagnostics === "object"
          ? resultObj.diagnostics
          : {};

      const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      const collectRawSectionText = (): string[] => {
        const sectionsSource = Array.isArray(normalized.rawSections)
          ? normalized.rawSections
          : Array.isArray((resultObj as any)?.rawSections)
            ? (resultObj as any).rawSections
            : [];
        return sectionsSource
          .map((section: any) => trim(section?.content ?? section?.text ?? section))
          .filter(Boolean);
      };

      const rawCandidates = [
        trim(resultObj.text),
        trim(resultObj.rawText),
        trim(resultObj.raw),
        trim((resultObj as any)?.raw_text),
        trim(normalized.rawText),
        trim(normalized.raw),
        trim(normalized.contact?.raw),
        trim(normalized.summary?.text),
        ...collectRawSectionText(),
      ];

      const hasSections = ["experience", "education", "skills", "languages", "achievements"].some(
        (key) => Array.isArray(normalized[key]) && normalized[key].length > 0,
      );

      const parseNumeric = (value: unknown): number => {
        const num = typeof value === "number" ? value : Number(value);
        return Number.isFinite(num) ? Number(num) : 0;
      };

      const diagEngine = trim((diagnostics as any)?.engine);
      const diagChars = parseNumeric(
        (diagnostics as any)?.ocr_chars ?? (diagnostics as any)?.total_chars ?? (diagnostics as any)?.chars,
      );
      const diagBlocks = parseNumeric(
        (diagnostics as any)?.ocr_blocks ?? (diagnostics as any)?.ocr_line_count ?? (diagnostics as any)?.blocks,
      );

      const computePagesCount = (): number => {
        const diagPages = (diagnostics as any)?.pages;
        const diagPagesSampled = (diagnostics as any)?.pages_sampled ?? (diagnostics as any)?.pages_scanned;
        const diagTextLike = (diagnostics as any)?.text_like_pages;
        let pagesCount = 0;
        if (typeof diagPagesSampled === "number" && Number.isFinite(diagPagesSampled)) {
          pagesCount = Math.max(pagesCount, diagPagesSampled);
        }
        if (typeof diagTextLike === "number" && Number.isFinite(diagTextLike)) {
          pagesCount = Math.max(pagesCount, diagTextLike);
        }
        if (Array.isArray(diagPages)) {
          pagesCount = Math.max(pagesCount, diagPages.length);
        } else if (typeof diagPages === "number" && Number.isFinite(diagPages)) {
          pagesCount = Math.max(pagesCount, diagPages);
        } else if (diagPages && typeof diagPages === "object") {
          try {
            const count = Object.keys(diagPages).length;
            if (count > 0) pagesCount = Math.max(pagesCount, count);
          } catch {
            // ignore
          }
        }
        return pagesCount;
      };

      const pagesCount = computePagesCount();

      const hasRawContent = rawCandidates.some((candidate) => candidate && candidate.length > 0);

      if (STRICT_EMPTY_CHECK) {
        if (pagesCount > 0) {
          console.warn("[structuredUpload] Accepting empty text but valid pages=%d", pagesCount);
          return true;
        }
        return Boolean(hasRawContent || hasSections);
      }

      if (hasRawContent || hasSections) {
        return true;
      }

      if (diagEngine || diagChars > 0 || diagBlocks > 0) {
        return true;
      }

      if (pagesCount > 0) {
        return true;
      }

      const sectionsFoundTotal = (() => {
        const sectionsFound = diagnostics?.sections_found;
        if (!sectionsFound || typeof sectionsFound !== "object") {
          return 0;
        }
        return Object.values(sectionsFound).reduce((sum, value) => {
          if (typeof value === "number" && Number.isFinite(value)) {
            return sum + value;
          }
          return sum;
        }, 0);
      })();
      if (sectionsFoundTotal > 0) {
        console.debug(
          "[structuredUpload] accepting payload via diagnostics sectionsFound=%d",
          sectionsFoundTotal,
        );
        return true;
      }

      const diagMessage = trim((diagnostics as any)?.empty_reason) || trim((diagnostics as any)?.error);
      if (diagMessage) {
        return true;
      }

      const rawText = trim(normalized.rawText);
      const rawFallback = trim(normalized.raw);
      const contactRaw = trim(normalized.contact?.raw);
      const summaryText = trim(normalized.summary?.text);
      const rawSectionsLength = Array.isArray(normalized.rawSections)
        ? normalized.rawSections.length
        : 0;

      try {
        console.debug(
          "[structuredUpload] normalized empty candidate rawTextLen=%d rawFallbackLen=%d contactRawLen=%d summaryLen=%d rawSections=%d",
          rawText.length,
          rawFallback.length,
          contactRaw.length,
          summaryText.length,
          rawSectionsLength,
        );
      } catch {
        // ignore
      }

      return false;
    };

    const payloadHasMeaningfulContent = (payload: ParserResponse | null | undefined): boolean =>
      normalizedHasMeaningfulContent(extractParserResult(payload));

    const computeModeSequence = (): ParserMode[] => {
      const order: ParserMode[] = [];
      const append = (mode: ParserMode) => {
        if (!order.includes(mode)) {
          order.push(mode);
        }
      };
      const candidateModes: ParserMode[] = ["auto", "ocr", "text"];
      if (candidateModes.includes(resolvedMode as ParserMode)) {
        append(resolvedMode as ParserMode);
      }
      candidateModes.forEach((mode) => append(mode));
      return order;
    };

    const modeSequence = activeUseMistral ? ["auto"] : computeModeSequence();

    for (const attempt of parserAttempts) {
      const parserEndpoint = attempt.endpoint;
      let endpointForLog = parserEndpoint.toString();
      console.info(
        "[structuredUpload] attempting parser label=%s url=%s",
        attempt.label,
        endpointForLog,
      );

      if (!skipHealth) {
        try {
          await ensureParserReachable(parserEndpoint, parserAccessHeaders);
        } catch (err: any) {
          const errorMsg = err?.message ?? String(err);
          aggregatedErrors.push(
            `${attempt.label} health check failed (${parserEndpoint.origin}): ${errorMsg}`,
          );
          console.error(
            "[structuredUpload] health check failed label=%s url=%s error=%s",
            attempt.label,
            endpointForLog,
            err?.stack ?? err,
          );
          continue;
        }
      } else {
        console.info(
          "[structuredUpload] Health check skipped via STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1 (label=%s)",
          attempt.label,
        );
      }

      const buildFormData = (modeOverride: ParserMode) => {
        const next = new FormData();
        next.set("mode", modeOverride);
        if (fileBytes && fileBytes.length > 0) {
          const blob = new Blob([fileBytes], { type: mimeTypeForUpload ?? "application/octet-stream" });
          next.set("file", blob, fileNameForUpload ?? "upload.bin");
        } else {
          next.set("raw_text", trimmed);
        }
        return next;
      };

      const performFetch = async (formData: FormData, retryIndex: number, modeUsed: ParserMode) => {
        const controller = new AbortController();
        const parserFetchTimeoutMs = activeUseMistral ? 240_000 : 90_000;
        const timer = setTimeout(() => controller.abort(), parserFetchTimeoutMs);
        try {
          const targetOrigin = (() => {
            try {
              return new URL(parserEndpoint.toString()).origin;
            } catch {
              return parserEndpoint.origin || baseOrigin || "http://127.0.0.1:8000";
            }
          })();
          let endpointToCall: string;
          try {
            endpointToCall = new URL(parserPath, targetOrigin).toString();
          } catch {
            endpointToCall = `${targetOrigin.replace(/\/+$/, "")}${parserPath}`;
          }
          endpointForLog = endpointToCall;
          console.info(
            "[structuredUpload] POST label=%s mode=%s retry=%d url=%s",
            attempt.label,
            modeUsed,
            retryIndex + 1,
            endpointToCall,
          );
          const headers: Record<string, string> = { Accept: "application/json" };
          if (parserAccessHeaders) {
            Object.assign(headers, parserAccessHeaders);
          }
          return await fetch(endpointToCall, {
            method: "POST",
            headers,
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      };

      let endpointSucceeded = false;
      for (const modeVariant of modeSequence) {
        let response: UResponse | null = null;
        let payload: ParserResponse | null = null;

        const maxRetries = activeUseMistral ? 3 : 2;
        for (let retryIndex = 0; retryIndex < maxRetries; retryIndex++) {
          const form = buildFormData(modeVariant);
          try {
            response = await performFetch(form, retryIndex, modeVariant);
          } catch (err: any) {
            const isAbort = err?.name === "AbortError";
            const message = err?.message ?? String(err);
            const errorNote = isAbort
              ? `timeout after ${Math.round(parserFetchTimeoutMs / 1000)}s (${message})`
              : message;
            const willRetry = retryIndex + 1 < maxRetries;
            aggregatedErrors.push(
              `${attempt.label}:${modeVariant} network error (retry ${retryIndex + 1}) (${endpointForLog}): ${errorNote}`,
            );
            if (willRetry) {
              console.warn(
                "[structuredUpload] transient network error label=%s mode=%s retry=%d url=%s error=%s",
                attempt.label,
                modeVariant,
                retryIndex + 1,
                endpointForLog,
                err?.stack ?? err,
              );
              const recovered = await waitForParserRecovery(
                parserEndpoint,
                parserAccessHeaders,
                activeUseMistral ? 20_000 : 8_000,
              );
              console.info(
                "[structuredUpload] retrying after network error label=%s mode=%s retry=%d recovered=%s",
                attempt.label,
                modeVariant,
                retryIndex + 2,
                recovered,
              );
            } else {
              console.error(
                "[structuredUpload] network error label=%s mode=%s retry=%d url=%s error=%s",
                attempt.label,
                modeVariant,
                retryIndex + 1,
                endpointForLog,
                err?.stack ?? err,
              );
            }
            response = null;
            continue;
          }

          if (!response.ok) {
            let errorDetail: any = null;
            let bodyText = "";
            const cfRay = response.headers.get("cf-ray") || null;
            if (cfRay) {
              lastCfRay = cfRay;
            }
            try {
              const ctype = response.headers.get("content-type") || "";
              if (ctype.includes("application/json")) {
                errorDetail = await response.json();
              } else {
                bodyText = await response.text();
                errorDetail = bodyText;
              }
            } catch {
              try {
                bodyText = await response.text();
                errorDetail = bodyText;
              } catch {
                errorDetail = null;
              }
            }
            lastHttpStatus = response.status;
            lastBodySnippet = (typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail ?? {})).slice(0, 400);
            const errorMessage = typeof errorDetail === "string"
              ? errorDetail
              : errorDetail?.detail ?? errorDetail?.message ?? JSON.stringify(errorDetail ?? {});
            aggregatedErrors.push(
              `${attempt.label}:${modeVariant} responded ${response.status} ${response.statusText} (retry ${retryIndex + 1}) (${endpointForLog}): ${errorMessage}`,
            );
            const isTransient = isTransientParserStatus(response.status);
            const willRetry = isTransient && retryIndex + 1 < maxRetries;
            if (willRetry) {
              console.warn(
                "[structuredUpload] transient parser error status=%d label=%s mode=%s retry=%d url=%s cfRay=%s detail=%s",
                response.status,
                attempt.label,
                modeVariant,
                retryIndex + 1,
                endpointForLog,
                cfRay,
                errorMessage,
              );
              const recovered = await waitForParserRecovery(
                parserEndpoint,
                parserAccessHeaders,
                activeUseMistral ? 20_000 : 8_000,
              );
              console.info(
                "[structuredUpload] retrying after transient parser error status=%d label=%s mode=%s retry=%d recovered=%s",
                response.status,
                attempt.label,
                modeVariant,
                retryIndex + 2,
                recovered,
              );
            } else {
              console.error(
                "[structuredUpload] parser responded error status=%d label=%s mode=%s retry=%d url=%s cfRay=%s detail=%s",
                response.status,
                attempt.label,
                modeVariant,
                retryIndex + 1,
                endpointForLog,
                cfRay,
                errorMessage,
              );
            }
            response = null;
            continue;
          }

          console.info(
            "[structuredUpload] parser responded ok status=%d label=%s mode=%s retry=%d url=%s",
            response.status,
            attempt.label,
            modeVariant,
            retryIndex + 1,
            endpointForLog,
          );

          try {
            payload = (await response.json()) as ParserResponse;
            if (activeUseMistral) {
              const parserResultForDebug = payload as Record<string, any> | null;
              console.info("[structuredUpload][mistral] raw parser JSON parserResult.diagnostics=%j parserResult.result?.diagnostics=%j",
                parserResultForDebug?.diagnostics ?? null,
                parserResultForDebug?.result && typeof parserResultForDebug.result === "object"
                ? (parserResultForDebug.result as Record<string, any>)?.diagnostics ?? null
                : null);
            }
            if (payload && typeof payload === "object" && !("result" in payload)) {
              const canonical = payload as CanonicalPayload;
              payload = {
                result: canonical,
                diagnostics: canonical.diagnostics,
                normalized: canonical.normalized,
                rawText: canonical.rawText,
                summary: canonical.summary,
                summaryFirstSentence: canonical.summaryFirstSentence,
              } as ParserResponse;
              if (payload.result && typeof payload.result === "object") {
                const result = payload.result;
                if (!result.normalized || typeof result.normalized !== "object") {
                  result.normalized = {} as any;
                }
                if (typeof result.rawText === "string") {
                  if (typeof result.normalized.rawText !== "string" || !result.normalized.rawText.trim()) {
                    result.normalized.rawText = result.rawText;
                  }
                }
                if (!Array.isArray(result.normalized.rawSections)) {
                  if (Array.isArray((result as any).rawSections)) {
                    result.normalized.rawSections = (result as any).rawSections;
                  } else if (typeof result.rawText === "string" && result.rawText.trim()) {
                    result.normalized.rawSections = [{ label: "BODY", content: result.rawText }];
                  }
                }
              }
            }
          } catch (err: any) {
            const message = err?.message ?? String(err);
            aggregatedErrors.push(
              `${attempt.label}:${modeVariant} invalid JSON response (retry ${retryIndex + 1}) (${endpointForLog}): ${message}`,
            );
            console.error(
              "[structuredUpload] failed to parse JSON label=%s mode=%s retry=%d url=%s error=%s",
              attempt.label,
              modeVariant,
              retryIndex + 1,
              endpointForLog,
              err?.stack ?? err,
            );
            response = null;
            payload = null;
            continue;
          }

          const payloadKeys = payload ? Object.keys(payload) : [];
          const parserResult = extractParserResult(payload) ?? {};
          const normalized = parserResult?.normalized ?? {};
          const diagnostics = parserResult?.diagnostics ?? {};
          try {
            console.info("[structuredUpload] parser JSON keys", payloadKeys);
            console.info("[structuredUpload] diagnostics keys", Object.keys(diagnostics || {}));
          } catch { /* noop */ }
          console.debug(
            "[structuredUpload] parser JSON parsed label=%s mode=%s status=%d url=%s payloadKeys=%j",
            attempt.label,
            modeVariant,
            response.status,
            endpointForLog,
            payloadKeys,
          );

          const payloadRawText =
            typeof normalized?.rawText === "string"
              ? normalized.rawText
              : typeof parserResult?.rawText === "string"
                ? parserResult.rawText
                : "";
          const payloadRawFallback =
            typeof normalized?.raw === "string"
              ? normalized.raw
              : typeof parserResult?.raw === "string"
                ? parserResult.raw
                : "";
          const rawTextLenCandidates = [payloadRawText, parserResult?.rawText, parserResult?.raw].map((value) =>
            typeof value === "string" ? value.trim().length : 0,
          );
          const rawTextLen = Math.max(...rawTextLenCandidates, 0);
          const rawFallbackLen = payloadRawFallback.trim().length;
          const rawSectionsArray = Array.isArray(normalized?.rawSections)
            ? normalized.rawSections
            : Array.isArray((parserResult as any)?.rawSections)
              ? (parserResult as any).rawSections
              : [];
          const rawSectionsLen = rawSectionsArray.length;
          console.debug(
            "[structuredUpload] payload normalized lengths label=%s mode=%s status=%d rawTextLen=%d rawFallbackLen=%d rawSections=%d diagnostics=%j",
            attempt.label,
            modeVariant,
            response.status,
            rawTextLen,
            rawFallbackLen,
            rawSectionsLen,
            diagnostics ?? {},
          );

          // Extra logging for OCR mode to aid future debugging (no raw text)
          if (modeVariant === "ocr") {
            try {
              const diag = diagnostics ?? {};
              const diagFocus = {
                engine: diag?.engine ?? null,
                dpi_used: diag?.dpi_used ?? diag?.dpi ?? null,
                paddle_retry_used: diag?.paddle_retry_used ?? null,
                fallback_reason: diag?.fallback_reason ?? diag?.error ?? null,
                ocr_blocks: diag?.ocr_blocks ?? diag?.ocr_line_count ?? null,
                ocr_chars: diag?.ocr_chars ?? diag?.total_chars ?? diag?.chars ?? null,
              };
              console.debug("[structuredUpload][ocr] diag=%j", diagFocus);
            } catch {
              // ignore
            }
          }

          const meaningfulBaseline = payloadHasMeaningfulContent(payload);
          const diagEngineValue =
            typeof (diagnostics as any)?.engine === "string"
              ? (diagnostics as any).engine.trim()
              : typeof (parserResult as any)?.diagnostics?.engine === "string"
                ? (parserResult as any).diagnostics.engine.trim()
                : "";
          const canonicalPass = rawTextLen >= 8 && rawSectionsLen > 0 && diagEngineValue.length > 0;
          // For Mistral path, require sections OR sufficient OCR chars (>=200)
          const ocrChars = (() => {
            try {
              const d: any = diagnostics ?? {};
              const val = d?.ocr_chars ?? d?.total_chars ?? d?.chars;
              const num = typeof val === "number" ? val : Number(val);
              return Number.isFinite(num) ? num : 0;
            } catch { return 0; }
          })();
          const sectionsOk = rawSectionsLen > 0;
          const meaningful = activeUseMistral ? (sectionsOk || ocrChars >= 200) : (meaningfulBaseline || canonicalPass);
          console.debug(
            "[structuredUpload] payload content check label=%s mode=%s meaningful=%s diagnostics=%j",
            attempt.label,
            modeVariant,
            meaningful,
            diagnostics ?? {},
          );

          if (meaningful) {
            lastResponse = response;
            lastPayload = payload;
            selectedEndpoint = attempt;
            selectedMode = modeVariant;
            endpointSucceeded = true;
          } else {
            if (activeUseMistral) {
              const e: any = new Error("mistral_unusable_content: Insufficient OCR text (<200 chars) and no sections");
              e.code = "mistral_unusable_content";
              throw e;
            }
            const sectionsFound = diagnostics?.sections_found ?? {};
            const sectionsFoundSummary = Object.entries(sectionsFound)
              .map(([key, value]) => `${key}:${value}`)
              .join(",");
            try {
              console.debug(
                "[structuredUpload] empty normalized preview label=%s mode=%s rawTextLen=%d rawFallbackLen=%d contactRawLen=%d summaryLen=%d rawSections=%d sectionsFound=%s",
                attempt.label,
                modeVariant,
                rawTextLen,
                rawFallbackLen,
                typeof normalized?.contact?.raw === "string" ? normalized.contact.raw.trim().length : 0,
                typeof normalized?.summary?.text === "string" ? normalized.summary.text.trim().length : 0,
                rawSectionsLen,
                sectionsFoundSummary,
              );
            } catch (previewErr: any) {
              console.debug(
                "[structuredUpload] empty normalized preview label=%s mode=%s rawTextLen=%d rawFallbackLen=%d rawSections=%d stringifyError=%s",
                attempt.label,
                modeVariant,
                rawTextLen,
                rawFallbackLen,
                rawSectionsLen,
                previewErr?.message ?? previewErr,
              );
            }
            aggregatedErrors.push(
              `${attempt.label}:${modeVariant} returned empty normalized payload (rawTextLen=${rawTextLen} rawFallbackLen=${rawFallbackLen} rawSections=${rawSectionsLen} sectionsFound=${sectionsFoundSummary || "<none>"} diagnostics=${JSON.stringify(
                diagnostics,
              )})`,
            );
          }

          break;
        }

        if (endpointSucceeded) {
          break;
        }
      }

      if (endpointSucceeded) {
        break;
      }

      aggregatedErrors.push(
        `${attempt.label}: exhausted modes ${modeSequence.join(", ")} without usable content`,
      );
    }

    if (!lastPayload || !selectedEndpoint) {
      const joined = aggregatedErrors.length ? aggregatedErrors.join("; ") : "no parser attempts succeeded";
      const lastSnippet = aggregatedErrors[aggregatedErrors.length - 1] ?? joined;
      const code = (() => {
        if (lastHttpStatus === 404) return "mistral_route_missing";
        if (lastHttpStatus === 503) return "mistral_ocr_disabled_or_missing_key";
        if (lastHttpStatus === 408 || lastHttpStatus === 504) return "parser_timeout";
        if (typeof lastHttpStatus === "number") return `parser_http_${lastHttpStatus}`;
        return "parser_fetch_failed";
      })();
      throw new ConvexError({
        code,
        status: lastHttpStatus ?? null,
        detail: lastBodySnippet ?? null,
        message: `structuredUpload failed: ${code}`,
        aggregatedErrors,
        lastError: lastSnippet,
        cfRay: lastCfRay ?? undefined,
      });
    }

    const parserUrl = selectedEndpoint.endpoint.toString();
    const lastPayloadKeys = lastPayload ? Object.keys(lastPayload) : [];
    console.debug(
      "[structuredUpload] selected parser label=%s mode=%s url=%s status=%d payloadKeys=%j",
      selectedEndpoint.label,
      selectedMode ?? "auto",
      parserUrl,
      lastResponse?.status ?? -1,
      lastPayloadKeys,
    );

    if (!lastPayload?.result) {
      let preview: string | null = null;
      try {
        preview = JSON.stringify(lastPayload).slice(0, 400);
        console.error(
          "[structuredUpload] parser payload missing result label=%s preview=%s",
          selectedEndpoint.label,
          preview,
        );
      } catch {
        // ignore preview logging errors
      }
      const missingMessage = "parser payload missing result object";
      aggregatedErrors.push(`${selectedEndpoint.label}: ${missingMessage}`);
      throw new ConvexError({
        code: "parser_missing_payload",
        message: "structuredUpload failed: parser_missing_payload",
        detail: preview,
        aggregatedErrors,
        lastError: missingMessage,
      });
    }

    const canonicalizeInput = buildCanonicalizeInput(lastPayload);
    const normalizedResult = canonicalizeParserResult(canonicalizeInput, {
      rawText:
        hasRawText
          ? trimmed
          : typeof canonicalizeInput?.normalized?.rawText === "string" && canonicalizeInput.normalized.rawText.trim()
            ? canonicalizeInput.normalized.rawText
            : typeof canonicalizeInput?.normalized?.raw === "string"
              ? canonicalizeInput.normalized.raw
              : "",
      mode: resolvedMode,
      parserUrl,
    });
    const pickRecoverySourceSections = (...candidates: unknown[]): unknown[] => {
      let best: unknown[] = [];
      let bestScore = -1;

      const scoreCandidate = (candidate: unknown[]): number =>
        candidate.reduce<number>((sum, entry) => {
          if (!entry || typeof entry !== "object") return sum;
          const record = entry as Record<string, unknown>;
          return (
            sum +
            (typeof record.fieldKey === "string" ? 4 : 0) +
            (typeof record.confidence === "number" ? 4 : 0) +
            (typeof record.title === "string" ? 2 : 0) +
            (typeof record.label === "string" ? 2 : 0) +
            (typeof record.content === "string" || typeof record.text === "string"
              ? 1
              : 0)
          );
        }, 0);

      candidates.forEach((candidate) => {
        if (!Array.isArray(candidate) || candidate.length === 0) return;
        const score = scoreCandidate(candidate);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      });

      return best;
    };

    const recoverySourceSections = pickRecoverySourceSections(
      (lastPayload as any)?.result?.sections,
      (lastPayload as any)?.sections,
      (lastPayload as any)?.result?.cv?.rawSections,
      (lastPayload as any)?.cv?.rawSections,
      (lastPayload as any)?.result?.rawSections,
      (lastPayload as any)?.result?.normalized?.rawSections,
      (normalizedResult as any)?.rawSections,
      (normalizedResult as any)?.normalized?.rawSections,
    );
    const normalized = (normalizedResult?.normalized ?? {}) as Record<string, any>;
    const filteredRecoverySource = filterRecoverySourceSectionsForRedundantHeader(
      recoverySourceSections,
      normalized,
    );
    if (filteredRecoverySource.suppressed) {
      console.info(
        "[structuredUpload] suppressed redundant top BODY header before recovery label=%s mode=%s",
        selectedEndpoint.label,
        resolvedMode,
      );
    }
    const recovery = buildImportRecoveryPayload({
      sourceSections: filteredRecoverySource.sections,
      fullResult: normalizedResult as Record<string, any>,
      context: {
        rawText:
          typeof (normalizedResult as any)?.normalized?.rawText === "string"
            ? (normalizedResult as any).normalized.rawText
            : trimmed,
        mode: resolvedMode,
        parserUrl,
      },
    });

    const normalizedRawText =
      typeof normalized.rawText === "string" ? normalized.rawText.trim() : "";
    const normalizedSummaryText =
      typeof normalized.summary?.text === "string" ? normalized.summary.text.trim() : "";
    const normalizedRawFallback =
      typeof normalized.raw === "string" ? normalized.raw.trim() : "";
    const contactRawFallback =
      typeof normalized.contact?.raw === "string" ? normalized.contact.raw.trim() : "";
    const normalizedSectionsPresent = [
      "experience",
      "education",
      "skills",
      "languages",
      "achievements",
    ].filter((key) => Array.isArray(normalized[key]) && normalized[key].length > 0);

    if (!normalizedHasMeaningfulContent(normalizedResult)) {
      // Final salvage: synthesize a minimal summary from raw fields so we keep usable content
      try {
        const normalizedRef: any = normalizedResult?.normalized ?? {};
        const candidates: string[] = [];
        const rawSectionsArray: any[] = Array.isArray(normalizedRef.rawSections)
          ? normalizedRef.rawSections
          : [];
        if (typeof normalizedRef.rawText === "string") candidates.push(normalizedRef.rawText);
        if (typeof normalizedRef.raw === "string") candidates.push(normalizedRef.raw);
        rawSectionsArray.forEach((s) => {
          const txt = (s && (s.text || s.content)) as unknown;
          if (typeof txt === "string" && txt.trim()) candidates.push(txt);
        });
        const fallbackText = candidates.find((t) => t && t.trim().length > 0);
        if (fallbackText) {
          const synthesized = firstSentence(String(fallbackText)) || String(fallbackText).trim();
          if (synthesized) {
            if (!normalizedRef.summary || typeof normalizedRef.summary !== "object") {
              normalizedRef.summary = { text: synthesized, confidence: 0.25 };
            } else if (!normalizedRef.summary.text) {
              normalizedRef.summary.text = synthesized;
              normalizedRef.summary.confidence = normalizedRef.summary.confidence ?? 0.25;
            }
            normalizedRef.summaryFirstSentence = firstSentence(normalizedRef.summary.text);
          }
        }

        if (!normalizedHasMeaningfulContent(normalizedResult)) {
          const diagnostics = (normalizedResult?.diagnostics ?? {}) as Record<string, any>;
          const diagMessage =
            (typeof diagnostics.empty_reason === "string" && diagnostics.empty_reason.trim()) ||
            (typeof diagnostics.error === "string" && diagnostics.error.trim()) ||
            null;
          if (diagMessage) {
            const humanMessage = diagMessage.replace(/_/g, " ");
            if (!normalizedRef.summary || typeof normalizedRef.summary !== "object") {
              normalizedRef.summary = { text: humanMessage, confidence: 0 };
            } else if (!normalizedRef.summary.text) {
              normalizedRef.summary.text = humanMessage;
              normalizedRef.summary.confidence = normalizedRef.summary.confidence ?? 0;
            }
            normalizedRef.summaryFirstSentence = firstSentence(normalizedRef.summary?.text ?? humanMessage);
            if (typeof normalizedRef.rawText !== "string" || !normalizedRef.rawText.trim()) {
              normalizedRef.rawText = humanMessage;
            }
          }
        }
      } catch {
        // best-effort salvage only
      }
    }

    if (!normalizedHasMeaningfulContent(normalizedResult)) {
      const rawSectionsLength = Array.isArray(normalized.rawSections)
        ? normalized.rawSections.length
        : Array.isArray((normalizedResult as any)?.rawSections)
          ? (normalizedResult as any).rawSections.length
          : 0;
      console.error(
        "[structuredUpload] parser returned empty normalized payload label=%s url=%s rawSections=%d diagnostics=%j runner=%j",
        selectedEndpoint.label,
        parserUrl,
        rawSectionsLength,
        normalizedResult?.diagnostics ?? {},
        lastPayload.runner ?? {},
      );
      const emptyMessage = "parser returned empty normalized payload";
      aggregatedErrors.push(`${selectedEndpoint.label}: ${emptyMessage}`);
      throw new ConvexError({
        code: "parser_empty_normalized_payload",
        message: "structuredUpload failed: parser_empty_normalized_payload",
        detail: JSON.stringify({
          rawSectionsLength,
          diagnostics: normalizedResult?.diagnostics ?? {},
        }).slice(0, 400),
        aggregatedErrors,
        lastError: emptyMessage,
      });
    }

    console.debug(
      "[structuredUpload] normalized result label=%s mode=%s url=%s rawTextLen=%d rawFallbackLen=%d contactRawLen=%d sections=%j summaryLen=%d",
      selectedEndpoint.label,
      selectedMode ?? "auto",
      parserUrl,
      normalizedRawText.length,
      normalizedRawFallback.length,
      contactRawFallback.length,
      normalizedSectionsPresent,
      normalizedSummaryText.length,
    );

    const diagnostics = normalizedResult?.diagnostics ?? {};
    const runner = lastPayload.runner ?? {};
    const fallbackTriggered = Boolean(runner.fallback_triggered);

    const experienceDiagnostics = (normalizedResult?.normalized as any)?.experienceDiagnostics || null;

    try {
      recordTelemetry("structured_upload.diagnostics", {
        mode: resolvedMode,
        hybridUsed: diagnostics?.hybrid_used ?? null,
        fallbackUsed: diagnostics?.fallback_used ?? null,
        fallbackTriggered,
        sectionsFound: diagnostics?.sections_found ?? null,
        detectorMode: diagnostics?.detector_mode ?? null,
        detectorConfidence: diagnostics?.detector_confidence ?? null,
        experienceSource: diagnostics?.experience_source ?? experienceDiagnostics?.source ?? null,
        experienceDroppedEmpty: diagnostics?.experience_dropped_empty ?? experienceDiagnostics?.droppedEmpty ?? null,
        experienceFallbackCount: diagnostics?.experience_fallback_count ?? experienceDiagnostics?.fallbackCount ?? null,
        parserUrl,
      });
      recordTelemetry("structured_upload.sections_canonical", {
        experience: normalizedResult?.normalized?.experience?.length ?? 0,
        education: normalizedResult?.normalized?.education?.length ?? 0,
        skills: normalizedResult?.normalized?.skills?.length ?? 0,
        languages: normalizedResult?.normalized?.languages?.length ?? 0,
        achievements: normalizedResult?.normalized?.achievements?.length ?? 0,
        fallbackUsed: diagnostics?.fallback_used ?? null,
        hybridUsed: diagnostics?.hybrid_used ?? null,
      });
      if (experienceDiagnostics) {
        recordTelemetry("structured_upload.experience_quality", {
          source: experienceDiagnostics.source,
          droppedEmpty: experienceDiagnostics.droppedEmpty,
          fallbackCount: experienceDiagnostics.fallbackCount,
        });
      }
      if (diagnostics?.hybrid_used) {
        recordTelemetry("structured_upload.hybrid", {
          mode: mode ?? "text",
          sectionsFound: diagnostics.sections_found ?? null,
        });
      }
      if (diagnostics?.fallback_used || fallbackTriggered) {
        recordTelemetry("structured_upload.fallback", {
          mode: mode ?? "text",
          sectionsFound: diagnostics.sections_found ?? null,
          fallbackTriggered,
        });
      }
      if (diagnostics?.ocr_failed) {
        recordTelemetry("structured_upload.ocr_failed", {
          mode: mode ?? "text",
          detectorMode: diagnostics?.detector_mode ?? null,
        });
      }
      if ((recovery?.items.length ?? 0) > 0) {
        recordTelemetry("structured_upload.import_recovery", {
          mode: resolvedMode,
          reviewRequired: recovery?.reviewRequired ?? false,
          lowConfidenceCount: recovery?.totalItems ?? 0,
          totalRecoveryItems: recovery?.items.length ?? 0,
        });
      }
    } catch {
      // telemetry is best-effort
    }

    try {
      const normalizedKeys = normalizedResult && typeof normalizedResult === "object"
        ? Object.keys(normalizedResult as object)
        : [];
      const normalizedSections = normalizedResult?.normalized && typeof normalizedResult.normalized === "object"
        ? Object.keys(normalizedResult.normalized as object)
        : [];
      console.info(
        "[structuredUpload] returning payload keys=%j normalizedSections=%j runnerReturn=%s endpointLabel=%s",
        normalizedKeys,
        normalizedSections,
        runner?.returncode,
        selectedEndpoint.label,
      );
    } catch {
      // logging of metadata only
    }

    const diagSource = (normalizedResult as any)?.diagnostics;
    const payloadDiagSource = lastPayload?.diagnostics;
    const diag = {
      ...(payloadDiagSource && typeof payloadDiagSource === "object" ? payloadDiagSource : {}),
      ...(diagSource && typeof diagSource === "object" ? diagSource : {}),
    } as Record<string, any>;
    const rawEngine = (diag.engine || "").toString().trim().toLowerCase();
    const ocrEngine = (diag.ocr_engine || "").toString().trim().toLowerCase();
    if (rawEngine === "ocr" && ocrEngine) {
      diag.engine = ocrEngine.includes("paddle")
        ? "paddle"
        : ocrEngine.includes("tesseract")
        ? "tesseract"
        : ocrEngine;
    }
    const strategy = (diag.strategy || "").toString().trim().toLowerCase();
    if (!diag.engine && (strategy === "text" || strategy === "text_pdf")) {
      diag.engine = "text";
    }
    if (diag.engine === "text") {
      if ("dpi_used" in diag) {
        delete diag.dpi_used;
      }
    } else if (diag.engine) {
      if (diag.dpi_used == null && diag.dpi != null) {
        diag.dpi_used = diag.dpi;
      }
      if (diag.dpi_used == null) {
        diag.dpi_used = 320;
      }
    }
    if (activeUseMistral) {
      console.info("[structuredUpload][mistral] evidence=%j", {
        parserPath,
        route: diag.route ?? null,
        ocr_request_path: diag.ocr_request_path ?? null,
        ocr_engine: diag.ocr_engine ?? null,
        mistral_model: diag.mistral_model ?? null,
        mistral_fallback: diag.mistral_fallback ?? null,
        mistral_runtime: diag.mistral_runtime ?? null,
      });
    }
    (normalizedResult as any).diagnostics = diag;
    if (lastPayload && typeof lastPayload === "object") {
      lastPayload.diagnostics = diag;
      lastPayload.result = normalizedResult;
    }

    return {
      ...normalizedResult,
      diagnostics: diag,
      recovery,
    };
  },
});
