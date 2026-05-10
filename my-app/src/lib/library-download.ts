import JSZip from "jszip";

import { resolveVerbatiStyle } from "../features/verbati/style";
import type { LibraryItem } from "./application-library";
import type { CvDocument } from "../types/cvDocument";
import {
  buildProposalPreviewPrintSource,
  buildStyledResumePrintSource,
} from "./document-export-models";
import {
  buildExportDocumentFileBlob,
  downloadBlob,
} from "./exportDocumentFile";

const LIBRARY_PROPOSAL_DOWNLOAD_STYLE = resolveVerbatiStyle({
  familyId: "workshop",
  typography: "geist-baskervville",
  palette: "sauge",
});

export type LibraryDownloadResult = {
  downloaded: number;
  skipped: number;
};

export type LibraryDownloadOptions = {
  hydrateCvDocument?: (id: string) => Promise<CvDocument | null>;
};

export function sanitizeDownloadFilename(
  title: string | null | undefined,
  fallback: string,
): string {
  const cleaned = String(title ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function pdfFilename(item: LibraryItem): string {
  const fallback = item.type === "cv" ? "cv" : "proposal";
  return `${sanitizeDownloadFilename(item.title, fallback)}.pdf`;
}

function contextLabel(item: LibraryItem): string {
  if (item.type === "cv") return "CV profile";
  const jobPart = item.jobId || item.jobTitle ? "Job linked" : "No job";
  const cvPart = item.linkedCvTitle
    ? `CV: ${item.linkedCvTitle}`
    : item.linkedCvId
      ? "CV linked"
      : "No CV linked";
  return `${jobPart} · ${cvPart}`;
}

export function isLibraryItemDownloadable(item: LibraryItem): boolean {
  if (item.type === "cv") return Boolean(item.cvDocument);
  if (item.type === "proposal") return Boolean(item.content?.trim());
  return false;
}

function isLibrarySummaryOnlyCv(cv: CvDocument | null | undefined): boolean {
  return Boolean(
    (cv?.metadata as { librarySummaryOnly?: boolean } | undefined)
      ?.librarySummaryOnly,
  );
}

function itemSourceId(item: LibraryItem): string {
  return item.id.slice(item.id.indexOf(":") + 1);
}

export async function buildLibraryItemPdfBlob(
  item: LibraryItem,
  options: LibraryDownloadOptions = {},
): Promise<{ filename: string; blob: Blob }> {
  if (item.type === "cv") {
    const cvDocument =
      item.cvDocument && !isLibrarySummaryOnlyCv(item.cvDocument)
        ? item.cvDocument
        : options.hydrateCvDocument
          ? await options.hydrateCvDocument(itemSourceId(item))
          : null;
    if (!cvDocument || isLibrarySummaryOnlyCv(cvDocument)) {
      throw new Error("CV export source is unavailable.");
    }
    const source = buildStyledResumePrintSource({
      currentCv: cvDocument,
    });
    if (!source) {
      throw new Error("CV export source is unavailable.");
    }
    const exported = await buildExportDocumentFileBlob({
      kind: "resume",
      format: "pdf",
      mode: "styled",
      data: source,
      stylePreset: source.stylePreset,
      fileNameBase: sanitizeDownloadFilename(item.title, "cv"),
    });
    return { filename: pdfFilename(item), blob: exported.blob };
  }

  if (item.type === "proposal" && item.content?.trim()) {
    const context = contextLabel(item);
    const source = buildProposalPreviewPrintSource({
      content: item.content,
      proposalType: "cover_letter",
      voicePreset: "direct",
      railTitle: item.title,
      railMeta: context,
      contactLine: "",
      letterDate: "",
      recipientDetails: "",
      documentTitle: item.title,
      documentMeta: context,
      applicantHeader: null,
      headerVisibility: null,
      templateId: "workshop_proposal_margin",
      stylePreset: LIBRARY_PROPOSAL_DOWNLOAD_STYLE,
    });
    const exported = await buildExportDocumentFileBlob({
      kind: "proposal",
      format: "pdf",
      mode: "styled",
      data: source,
      stylePreset: source.stylePreset,
      fileNameBase: sanitizeDownloadFilename(item.title, "proposal"),
    });
    return { filename: pdfFilename(item), blob: exported.blob };
  }

  throw new Error("Selected item cannot be downloaded.");
}

function uniqueFilename(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }

  const extensionIndex = filename.toLowerCase().endsWith(".pdf")
    ? filename.length - 4
    : filename.length;
  const stem = filename.slice(0, extensionIndex);
  const extension = filename.slice(extensionIndex);
  let index = 2;
  while (used.has(`${stem}-${index}${extension}`)) {
    index += 1;
  }
  const unique = `${stem}-${index}${extension}`;
  used.add(unique);
  return unique;
}

export async function buildLibraryItemsZipBlob(
  items: LibraryItem[],
  options: LibraryDownloadOptions = {},
): Promise<{ filename: string; blob: Blob; downloaded: number; skipped: number }> {
  const zip = new JSZip();
  const usedFilenames = new Set<string>();
  let downloaded = 0;
  let skipped = 0;

  for (const item of items) {
    if (!isLibraryItemDownloadable(item) && item.type !== "cv") {
      skipped += 1;
      continue;
    }
    try {
      const pdf = await buildLibraryItemPdfBlob(item, options);
      zip.file(uniqueFilename(pdf.filename, usedFilenames), pdf.blob);
      downloaded += 1;
    } catch {
      skipped += 1;
    }
  }

  if (downloaded === 0) {
    throw new Error("No selected items can be downloaded.");
  }

  const date = new Date().toISOString().slice(0, 10);
  const blob = await zip.generateAsync({ type: "blob" });
  return {
    filename: `twoweeks-documents-${date}.zip`,
    blob,
    downloaded,
    skipped,
  };
}

export async function downloadLibraryItems(
  items: LibraryItem[],
  options: LibraryDownloadOptions = {},
): Promise<LibraryDownloadResult> {
  const exportableItems = items.filter(
    (item) => isLibraryItemDownloadable(item) || item.type === "cv",
  );
  const skipped = items.length - exportableItems.length;

  if (exportableItems.length === 0) {
    throw new Error("No selected items can be downloaded.");
  }

  if (exportableItems.length === 1) {
    const pdf = await buildLibraryItemPdfBlob(exportableItems[0], options);
    await downloadBlob(pdf.blob, pdf.filename);
    return { downloaded: 1, skipped };
  }

  const zip = await buildLibraryItemsZipBlob(items, options);
  await downloadBlob(zip.blob, zip.filename);
  return { downloaded: zip.downloaded, skipped: zip.skipped };
}
