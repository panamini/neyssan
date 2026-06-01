import { describe, expect, it } from "vitest";

import {
  applyDocumentDecorationSizePreset,
  clampDocumentDecorationPlacement,
  clampDocumentDecorationSizeMm,
  DEFAULT_DOCUMENT_DECORATION_PLACEMENT,
  EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT,
  EDITORIAL_TEMPLATE_FLOWER_FILE_NAME,
  getDocumentDecorationRenderedSizeMm,
  isSupportedDocumentDecorationMimeType,
  normalizeDocumentDecoration,
  readDocumentDecorationUpload,
  resolveTemplateDocumentDecoration,
  resizeDocumentDecorationByDeltaMm,
  sanitizeSvgDecorationMarkup,
  type DocumentDecoration,
} from "../document-decoration";

const uploadedDecoration: DocumentDecoration = {
  visible: true,
  source: "upload",
  dataUrl: "data:image/png;base64,AAAA",
  fileName: "mark.png",
  mimeType: "image/png",
  alt: "Company mark",
  sizePreset: 35,
  fit: "contain",
  placementMode: "custom",
  xMm: 17,
  yMm: 35,
};

describe("document-decoration", () => {
  it("normalizes optional decoration settings onto the default placement and fixed preset", () => {
    const normalized = normalizeDocumentDecoration({
      visible: true,
      source: "upload",
      dataUrl: "data:image/jpeg;base64,AAAA",
      mimeType: "image/jpeg",
      fit: "cover",
    });

    expect(normalized).toMatchObject({
      visible: true,
      source: "upload",
      dataUrl: "data:image/jpeg;base64,AAAA",
      mimeType: "image/jpeg",
      fit: "cover",
      sizePreset: 35,
      placementMode: "default",
    });
    expect(normalized.xMm).toBe(DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm);
    expect(normalized.yMm).toBe(DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm);
    expect(getDocumentDecorationRenderedSizeMm(normalized)).toBe(35);
  });

  it("rounds and clamps custom sizes in millimeters", () => {
    expect(clampDocumentDecorationSizeMm(11.5)).toBe(12);
    expect(clampDocumentDecorationSizeMm(52.49)).toBe(52);
    expect(clampDocumentDecorationSizeMm(52.5)).toBe(53);
    expect(clampDocumentDecorationSizeMm(120)).toBe(105);

    const normalized = normalizeDocumentDecoration({
      ...uploadedDecoration,
      sizePreset: "custom",
      customSizeMm: 17.6,
    });

    expect(normalized.sizePreset).toBe("custom");
    expect(normalized.customSizeMm).toBe(18);
    expect(getDocumentDecorationRenderedSizeMm(normalized)).toBe(18);
  });

  it("switches presets back to fixed integer sizes and clears custom size", () => {
    const next = applyDocumentDecorationSizePreset(
      {
        ...uploadedDecoration,
        sizePreset: "custom",
        customSizeMm: 42,
      },
      18,
    );

    expect(next.sizePreset).toBe(18);
    expect(next.customSizeMm).toBeUndefined();
    expect(getDocumentDecorationRenderedSizeMm(next)).toBe(18);
  });

  it("drops the legacy Editorial template logo decoration from stored state", () => {
    const normalized = normalizeDocumentDecoration({
      visible: true,
      source: "upload",
      dataUrl: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
      fileName: "Editorial template logo.svg",
      mimeType: "image/svg+xml",
      alt: "Template logo",
      sizePreset: 18,
      fit: "contain",
      placementMode: "custom",
      xMm: 157,
      yMm: 18,
    });

    expect(normalized).toMatchObject({
      visible: false,
      sizePreset: 35,
      fit: "contain",
      placementMode: "default",
      xMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
      yMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
    });
    expect(normalized.dataUrl).toBeUndefined();
    expect(normalized.fileName).toBeUndefined();
  });

  it("resolves the Editorial flower mark only for the Editorial template", () => {
    const editorialDecoration = resolveTemplateDocumentDecoration(
      null,
      "editorial_wide",
    );

    expect(editorialDecoration).toMatchObject({
      visible: true,
      fileName: EDITORIAL_TEMPLATE_FLOWER_FILE_NAME,
      mimeType: "image/svg+xml",
      alt: "Template flower mark",
      sizePreset: 18,
      fit: "contain",
      placementMode: "default",
      xMm: EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT.xMm,
      yMm: EDITORIAL_TEMPLATE_FLOWER_DECORATION_PLACEMENT.yMm,
    });
    expect(editorialDecoration.dataUrl).toContain("data:image/svg+xml,");
    expect(decodeURIComponent(editorialDecoration.dataUrl ?? "")).toContain(
      'viewBox="0 0 256 256"',
    );
    expect(decodeURIComponent(editorialDecoration.dataUrl ?? "")).toContain(
      "M208.35,132.82",
    );

    const nonEditorialDecoration = resolveTemplateDocumentDecoration(
      editorialDecoration,
      "swiss_margin",
    );

    expect(nonEditorialDecoration).toMatchObject({
      visible: false,
      sizePreset: 35,
      fit: "contain",
      placementMode: "default",
      xMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.xMm,
      yMm: DEFAULT_DOCUMENT_DECORATION_PLACEMENT.yMm,
    });
    expect(nonEditorialDecoration.dataUrl).toBeUndefined();
    expect(nonEditorialDecoration.fileName).toBeUndefined();
  });

  it("moves and resizes within the page using rounded integer millimeters", () => {
    const moved = clampDocumentDecorationPlacement(
      {
        ...uploadedDecoration,
        xMm: 202.4,
        yMm: 294.6,
      },
      { pageWidthMm: 210, pageHeightMm: 297 },
    );

    expect(moved.placementMode).toBe("custom");
    expect(moved.xMm).toBe(175);
    expect(moved.yMm).toBe(262);

    const resized = resizeDocumentDecorationByDeltaMm(uploadedDecoration, {
      deltaXMm: 13.8,
      deltaYMm: 3,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });

    expect(resized.sizePreset).toBe("custom");
    expect(resized.customSizeMm).toBe(49);
    expect(getDocumentDecorationRenderedSizeMm(resized)).toBe(49);

    const oversized = resizeDocumentDecorationByDeltaMm(
      {
        ...uploadedDecoration,
        xMm: 160,
        yMm: 220,
      },
      {
        deltaXMm: 90,
        deltaYMm: 90,
        pageWidthMm: 210,
        pageHeightMm: 297,
      },
    );

    expect(oversized.customSizeMm).toBe(50);
    expect(oversized.xMm).toBe(160);
    expect(oversized.yMm).toBe(220);
  });

  it("accepts only supported image mime types and fails closed on unsafe SVG", () => {
    expect(isSupportedDocumentDecorationMimeType("image/png")).toBe(true);
    expect(isSupportedDocumentDecorationMimeType("image/jpeg")).toBe(true);
    expect(isSupportedDocumentDecorationMimeType("image/svg+xml")).toBe(true);
    expect(isSupportedDocumentDecorationMimeType("image/gif")).toBe(false);

    expect(sanitizeSvgDecorationMarkup("<svg viewBox=\"0 0 10 10\"><path d=\"M0 0h10v10\" /></svg>")).toContain(
      "<svg",
    );
    expect(sanitizeSvgDecorationMarkup("<svg><script>alert(1)</script></svg>")).toBeNull();
    expect(sanitizeSvgDecorationMarkup("<svg><foreignObject /></svg>")).toBeNull();
    expect(sanitizeSvgDecorationMarkup("<svg><image href=\"https://example.com/a.png\" /></svg>")).toBeNull();
    expect(sanitizeSvgDecorationMarkup("<svg onclick=\"alert(1)\"></svg>")).toBeNull();
  });

  it("reads PNG and SVG uploads into self-contained data URLs", async () => {
    const pngDecoration = await readDocumentDecorationUpload(
      new File(["png-bytes"], "mark.png", { type: "image/png" }),
    );

    expect(pngDecoration).toMatchObject({
      visible: true,
      fileName: "mark.png",
      mimeType: "image/png",
      alt: "mark",
      sizePreset: 35,
      fit: "contain",
      placementMode: "default",
      xMm: 17,
      yMm: 35,
    });
    expect(pngDecoration.dataUrl).toMatch(/^data:image\/png;base64,/);

    const jpegDecoration = await readDocumentDecorationUpload(
      new File(["jpg-bytes"], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(jpegDecoration.mimeType).toBe("image/jpeg");
    expect(jpegDecoration.dataUrl).toMatch(/^data:image\/jpeg;base64,/);

    const svgDecoration = await readDocumentDecorationUpload(
      new File(["<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>"], "seal.svg", {
        type: "image/svg+xml",
      }),
    );

    expect(svgDecoration.mimeType).toBe("image/svg+xml");
    expect(svgDecoration.dataUrl).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(svgDecoration.dataUrl ?? "")).toContain("<svg");
    await expect(
      readDocumentDecorationUpload(new File(["gif"], "mark.gif", { type: "image/gif" })),
    ).rejects.toThrow("Use a PNG, JPG, or SVG image.");
  });
});
