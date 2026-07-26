import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.js?url", () => ({
  default: "/mock-pdf-worker.js",
}));

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 420 * scale,
          height: 594 * scale,
        }),
        render: () => ({
          promise: Promise.resolve(),
        }),
      })),
    }),
  })),
}));

vi.mock("pdfjs-dist/legacy/build/pdf", () => {
  const GlobalWorkerOptions = { workerSrc: "" };
  return {
    GlobalWorkerOptions,
    getDocument: getDocumentMock,
  };
});

import { PdfRasterHarnessPage } from "../PdfRasterHarnessPage";

describe("PdfRasterHarnessPage", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          clearRect: vi.fn(),
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__DASTI_PDF_RASTER_PAYLOAD__;
    delete window.__DASTI_PDF_RASTER_STATUS__;
  });

  it("renders the first PDF page into the canvas and exposes a ready snapshot", async () => {
    window.__DASTI_PDF_RASTER_PAYLOAD__ = {
      pdfBase64: btoa("fake-pdf"),
      label: "quiet-editorial",
      expectedTypography: "quiet-editorial",
    };

    render(
      <React.StrictMode>
        <PdfRasterHarnessPage />
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(window.__DASTI_PDF_RASTER_STATUS__?.status).toBe("ready");
    });

    expect(getDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isEvalSupported: false,
      }),
    );
    expect(window.__DASTI_PDF_RASTER_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        pageCount: 1,
        label: "quiet-editorial",
        expectedTypography: "quiet-editorial",
      }),
    );
  });
});
