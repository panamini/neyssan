import type { VerbatiStylePreset } from "../features/verbati/types";
import type {
  ExportDocumentFormat,
  ExportDocumentKind,
  ExportDocumentPdfMode,
  ExportDocumentSource,
} from "./document-export-models";

export type ExportDocumentFileArgs = {
  kind: ExportDocumentKind;
  format: ExportDocumentFormat;
  mode?: ExportDocumentPdfMode;
  data: ExportDocumentSource;
  stylePreset?: VerbatiStylePreset | null;
  fileNameBase: string;
  metadata?: Record<string, unknown>;
};

function getParserBaseUrl(): string {
  return (
    import.meta.env.VITE_PDF_INGEST_URL ||
    import.meta.env.VITE_PARSER_URL ||
    import.meta.env.VITE_CONVEX_PARSER_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "");
}

function resolveEndpoint(args: {
  kind: ExportDocumentKind;
  format: ExportDocumentFormat;
}): string {
  if (args.kind === "resume" && args.format === "pdf") {
    return "/api/v1/document-export/resume/pdf";
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDocumentFile(
  args: ExportDocumentFileArgs,
): Promise<{ filename: string }> {
  const response = await fetch(
    `${getParserBaseUrl()}${resolveEndpoint(args)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: args.kind,
        format: args.format,
        mode: args.mode,
        data: args.data,
        stylePreset: args.stylePreset ?? null,
        fileNameBase: args.fileNameBase,
        metadata: args.metadata ?? null,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Document export failed with status ${response.status}`,
    );
  }

  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ||
    resolveFallbackFilename(args);

  triggerDownload(blob, filename);
  return { filename };
}

export default exportDocumentFile;
