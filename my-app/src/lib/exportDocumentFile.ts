import type { VerbatiStylePreset } from "../features/verbati/types";
import type {
  ExportDocumentFormat,
  ExportDocumentKind,
  ExportDocumentPdfMode,
  ExportDocumentSource,
} from "./document-export-models";
import {
  encodeArrayBufferToBase64,
  readStyledProposalExportContext,
  readStyledResumeExportContext,
  setLastCapturedDocumentExport,
} from "./document-export-debug";

export type ExportDocumentFileArgs = {
  kind: ExportDocumentKind;
  format: ExportDocumentFormat;
  mode?: ExportDocumentPdfMode;
  data: ExportDocumentSource;
  stylePreset?: VerbatiStylePreset | null;
  fileNameBase: string;
  metadata?: Record<string, unknown>;
};

const DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS = 1_500;

function getParserBaseUrl(): string {
  return (
    import.meta.env.VITE_PARSER_URL ||
    import.meta.env.VITE_CONVEX_PARSER_URL ||
    import.meta.env.VITE_PDF_INGEST_URL ||
    "http://127.0.0.1:8001"
  ).replace(/\/+$/, "");
}

function resolveEndpoint(args: {
  kind: ExportDocumentKind;
  format: ExportDocumentFormat;
}): string {
  if (args.kind === "resume" && args.format === "pdf") {
    return "/api/v1/document-export/resume/pdf";
  }

  if (args.kind === "resume" && args.format === "docx") {
    return "/api/v1/document-export/resume/docx";
  }

  if (args.kind === "proposal" && args.format === "pdf") {
    return "/api/v1/document-export/proposal/pdf";
  }

  if (args.kind === "proposal" && args.format === "docx") {
    return "/api/v1/document-export/proposal/docx";
  }

  throw new Error(`Unsupported export target: ${args.kind}/${args.format}`);
}

function resolveFallbackFilename(args: ExportDocumentFileArgs): string {
  const extension = args.format === "pdf" ? "pdf" : "docx";
  return `${args.fileNameBase}.${extension}`;
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]).trim();
  }

  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1]?.trim() || null;
}

function scheduleObjectUrlCleanup(url: string): void {
  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS);
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
    await Promise.resolve();
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    scheduleObjectUrlCleanup(url);
  }
}

export async function buildExportDocumentFileBlob(
  args: ExportDocumentFileArgs,
): Promise<{
  filename: string;
  blob: Blob;
  byteLength: number;
  responseStatus: number;
  responseOk: boolean;
  contentType: string | null;
  contentDisposition: string | null;
  bytesBase64: string | null;
}> {
  const requestBody = {
    kind: args.kind,
    format: args.format,
    mode: args.mode,
    data: args.data,
    stylePreset: args.stylePreset ?? null,
    fileNameBase: args.fileNameBase,
    metadata: args.metadata ?? null,
  };
  const response = await fetch(
    `${getParserBaseUrl()}${resolveEndpoint(args)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Document export failed with status ${response.status}`,
    );
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ||
    resolveFallbackFilename(args);
  const outputBlob = new Blob([buffer], { type: blob.type });

  return {
    filename,
    blob: outputBlob,
    byteLength: buffer.byteLength,
    responseStatus: response.status,
    responseOk: response.ok,
    contentType: response.headers.get("Content-Type"),
    contentDisposition: response.headers.get("Content-Disposition"),
    bytesBase64:
      args.format === "pdf" ? encodeArrayBufferToBase64(buffer) : null,
  };
}

export async function exportDocumentFile(
  args: ExportDocumentFileArgs,
): Promise<{ filename: string }> {
  const requestBody = {
    kind: args.kind,
    format: args.format,
    mode: args.mode,
    data: args.data,
    stylePreset: args.stylePreset ?? null,
    fileNameBase: args.fileNameBase,
    metadata: args.metadata ?? null,
  };
  const exported = await buildExportDocumentFileBlob(args);

  await downloadBlob(exported.blob, exported.filename);

  setLastCapturedDocumentExport({
    requestBody,
    response: {
      responseStatus: exported.responseStatus,
      responseOk: exported.responseOk,
      contentType: exported.contentType,
      contentDisposition: exported.contentDisposition,
      filename: exported.filename,
      byteLength: exported.byteLength,
      bytesBase64: exported.bytesBase64,
    },
    clickContext:
      args.kind === "resume" && args.format === "pdf" && args.mode === "styled"
        ? readStyledResumeExportContext()
        : args.kind === "proposal" &&
            args.format === "pdf" &&
            args.mode === "styled"
          ? readStyledProposalExportContext()
        : null,
    timestamp: Date.now(),
  });
  return { filename: exported.filename };
}

export default exportDocumentFile;
