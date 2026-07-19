import React from "react";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfRasterHarnessStatus =
  | "booting"
  | "payload-ready"
  | "rendering"
  | "ready"
  | "error";

type PdfRasterHarnessPayload = {
  pdfBase64: string;
  label?: string;
  expectedTypography?: string;
};

type PdfRasterHarnessSnapshot = {
  pageCount: number;
  width: number;
  height: number;
  label?: string;
  expectedTypography?: string;
};

declare global {
  interface Window {
    __DASTI_PDF_RASTER_PAYLOAD__?: PdfRasterHarnessPayload;
    __DASTI_PDF_RASTER_STATUS__?: {
      status: PdfRasterHarnessStatus;
      payloadReadable: boolean;
      error?: string;
      snapshot?: PdfRasterHarnessSnapshot;
      timestamp: number;
    };
  }
}

function setPdfRasterStatus(
  status: PdfRasterHarnessStatus,
  payloadReadable: boolean,
  error?: string,
  snapshot?: PdfRasterHarnessSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.__DASTI_PDF_RASTER_STATUS__ = {
    status,
    payloadReadable,
    ...(error ? { error } : {}),
    ...(snapshot ? { snapshot } : {}),
    timestamp: Date.now(),
  };
}

function readPdfRasterPayload(): PdfRasterHarnessPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = window.__DASTI_PDF_RASTER_PAYLOAD__;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.pdfBase64 !== "string" ||
    !payload.pdfBase64.trim()
  ) {
    return null;
  }

  return payload;
}

function decodeBase64Pdf(pdfBase64: string): Uint8Array {
  const binary = window.atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function PdfRasterHarnessPage(): JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const payload = React.useMemo(() => readPdfRasterPayload(), []);

  React.useEffect(() => {
    if (!payload) {
      setPdfRasterStatus("error", false, "PDF raster payload is missing.");
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setPdfRasterStatus("error", true, "PDF raster canvas is unavailable.");
      return undefined;
    }

    let cancelled = false;
    setPdfRasterStatus("payload-ready", true);

    const renderPdf = async () => {
      setPdfRasterStatus("rendering", true);
      const loadingTask = pdfjsLib.getDocument({
        data: decodeBase64Pdf(payload.pdfBase64),
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const renderCanvas = document.createElement("canvas");
      const renderContext = renderCanvas.getContext("2d");
      const context = canvas.getContext("2d");

      if (!renderContext || !context) {
        throw new Error("2D canvas context is unavailable.");
      }

      renderCanvas.width = Math.ceil(viewport.width);
      renderCanvas.height = Math.ceil(viewport.height);

      await page.render({
        canvasContext: renderContext,
        viewport,
      }).promise;

      if (cancelled) {
        return;
      }

      canvas.width = renderCanvas.width;
      canvas.height = renderCanvas.height;
      canvas.style.width = `${Math.ceil(viewport.width / 2)}px`;
      canvas.style.height = `${Math.ceil(viewport.height / 2)}px`;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(renderCanvas, 0, 0);

      setPdfRasterStatus("ready", true, undefined, {
        pageCount: pdf.numPages,
        width: canvas.width,
        height: canvas.height,
        label: payload.label,
        expectedTypography: payload.expectedTypography,
      });
    };

    void renderPdf().catch((error) => {
      if (cancelled) {
        return;
      }

      setPdfRasterStatus(
        "error",
        true,
        error instanceof Error ? error.message : String(error),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!payload) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f7f4ec",
          color: "#1f1d1a",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Helvetica, sans-serif',
        }}
      >
        PDF raster payload is missing.
      </main>
    );
  }

  return (
    <main
      className="dasti-pdf-raster-route"
      data-expected-typography={payload.expectedTypography ?? ""}
      style={{
        minHeight: "100vh",
        padding: "24px",
        display: "grid",
        placeItems: "start center",
        background: "#f3efe7",
      }}
    >
      <canvas
        ref={canvasRef}
        data-pdf-raster-canvas="page-1"
        style={{
          display: "block",
        }}
      />
    </main>
  );
}

export default PdfRasterHarnessPage;
