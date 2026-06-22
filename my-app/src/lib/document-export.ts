/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export type DocumentExportCloneContext = {
  sourceNode: HTMLElement;
  clonedNode: HTMLElement;
  clonedDocument: Document;
};

type PrepareDocumentExportClone =
  | ((args: DocumentExportCloneContext) => void)
  | undefined;

function sanitizePdfTitle(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "document";
}

function buildPdfFilename(title: string): string {
  return `${sanitizePdfTitle(title)}.pdf`;
}

function findFirstMatchingNode(args: {
  container: HTMLElement | null;
  selectors: string[];
}): HTMLElement | null {
  if (!args.container) {
    return null;
  }

  for (const selector of args.selectors) {
    const node = args.container.querySelector<HTMLElement>(selector);
    if (node) {
      return node;
    }
  }

  return null;
}

async function waitForRenderableNode(node: HTMLElement): Promise<void> {
  await waitForExportDocumentAssets(node.ownerDocument);

  if (node.ownerDocument.fonts?.ready) {
    try {
      await node.ownerDocument.fonts.ready;
    } catch {
      // ignore font readiness failures and continue with raster export
    }
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function sliceCanvasForPdf(args: {
  canvas: HTMLCanvasElement;
  sourceY: number;
  sliceHeight: number;
}): HTMLCanvasElement {
  const sliceCanvas = document.createElement("canvas");
  sliceCanvas.width = args.canvas.width;
  sliceCanvas.height = args.sliceHeight;

  const context = sliceCanvas.getContext("2d");
  if (!context) {
    return sliceCanvas;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
  context.drawImage(
    args.canvas,
    0,
    args.sourceY,
    args.canvas.width,
    args.sliceHeight,
    0,
    0,
    sliceCanvas.width,
    sliceCanvas.height,
  );

  return sliceCanvas;
}

async function rasterizeNodeForPdf(
  node: HTMLElement,
  prepareClone?: PrepareDocumentExportClone,
): Promise<HTMLCanvasElement> {
  await waitForRenderableNode(node);

  const exportRootId = `document-export-${Math.random().toString(36).slice(2, 10)}`;
  node.setAttribute("data-document-export-root", exportRootId);

  try {
    return await html2canvas(node, {
      backgroundColor: "#ffffff",
      logging: false,
      scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
      useCORS: true,
      onclone: (clonedDocument) => {
        const clonedNode = clonedDocument.querySelector<HTMLElement>(
          `[data-document-export-root="${exportRootId}"]`,
        );
        if (!clonedNode) {
          return;
        }

        prepareClone?.({
          sourceNode: node,
          clonedNode,
          clonedDocument,
        });
        clonedNode.removeAttribute("data-document-export-root");
      },
    });
  } finally {
    node.removeAttribute("data-document-export-root");
  }
}

function canvasToPdf(canvas: HTMLCanvasElement, title: string): void {
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(
    1,
    Math.floor((printableHeight / printableWidth) * canvas.width),
  );

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const remainingHeight = canvas.height - sourceY;
    const sliceHeight = Math.min(sourcePageHeight, remainingHeight);
    const sliceCanvas = sliceCanvasForPdf({
      canvas,
      sourceY,
      sliceHeight,
    });
    const renderedHeight = (sliceHeight / canvas.width) * printableWidth;

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      sliceCanvas.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      printableWidth,
      renderedHeight,
      undefined,
      "FAST",
    );

    sourceY += sliceHeight;
    pageIndex += 1;
  }

  pdf.save(buildPdfFilename(title));
}

function waitForLoadableNode(
  node: HTMLImageElement | HTMLLinkElement,
): Promise<void> {
  const alreadyReady =
    node instanceof HTMLImageElement ? node.complete : Boolean(node.sheet);
  if (alreadyReady) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      node.removeEventListener("load", cleanup);
      node.removeEventListener("error", cleanup);
      resolve();
    };

    const timeoutId = window.setTimeout(cleanup, 1500);
    node.addEventListener("load", cleanup, { once: true });
    node.addEventListener("error", cleanup, { once: true });
  });
}

async function waitForExportDocumentAssets(doc: Document): Promise<void> {
  const pendingImages = Array.from(doc.images);
  const pendingStylesheets = Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  );

  await Promise.all([
    ...pendingImages.map((image) => waitForLoadableNode(image)),
    ...pendingStylesheets.map((stylesheet) => waitForLoadableNode(stylesheet)),
  ]);
}

export async function downloadElementAsPdf(args: {
  node: HTMLElement;
  title: string;
  prepareClone?: PrepareDocumentExportClone;
}): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = await rasterizeNodeForPdf(args.node, args.prepareClone);
    canvasToPdf(canvas, args.title);
    return true;
  } catch (error) {
    console.warn("Failed to export PDF", error);
    return false;
  }
}

export async function downloadFirstMatchingNodeAsPdf(args: {
  container: HTMLElement | null;
  selectors: string[];
  title: string;
  prepareClone?: PrepareDocumentExportClone;
}): Promise<boolean> {
  const node = findFirstMatchingNode(args);
  if (!node) {
    return false;
  }

  return downloadElementAsPdf({
    node,
    title: args.title,
    prepareClone: args.prepareClone,
  });
}

// Backward-compatible wrappers for callers still using the old print API names.
export function printElementAsPdf(args: {
  node: HTMLElement;
  title: string;
  prepareClone?: PrepareDocumentExportClone;
}): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  void downloadElementAsPdf(args);
  return true;
}

export function printFirstMatchingNodeAsPdf(args: {
  container: HTMLElement | null;
  selectors: string[];
  title: string;
  prepareClone?: PrepareDocumentExportClone;
}): boolean {
  const node = findFirstMatchingNode(args);
  if (!node) {
    return false;
  }

  void downloadElementAsPdf({
    node,
    title: args.title,
    prepareClone: args.prepareClone,
  });
  return true;
}
