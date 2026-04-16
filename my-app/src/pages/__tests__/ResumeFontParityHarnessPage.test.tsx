import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { ResumeFontParityHarnessPage } from "../ResumeFontParityHarnessPage";
import { buildResumeFontParityPreviewSource } from "../../features/verbati/resume/resumeFontParity.fixture";

vi.mock("../../features/verbati/VerbatiResumePreview", () => ({
  VerbatiResumePreview: ({
    stylePreset,
  }: {
    stylePreset: { typography: string };
  }) => {
    const headingFont =
      stylePreset.typography === "mono-signal" ? '"Archivo", sans-serif' : '"Fraunces", serif';
    const bodyFont =
      stylePreset.typography === "mono-signal" ? '"Archivo", sans-serif' : '"Syne", sans-serif';

    return (
      <div className="dasti-document-stage__canvas">
        <section
          className="resume-page"
          style={{
            ["--font-heading-family" as "--font-heading-family"]: headingFont,
            ["--font-body-family" as "--font-body-family"]: bodyFont,
          }}
        >
          <h1 data-font-probe="heading" style={{ fontFamily: headingFont }}>
            Elena Marlowe
          </h1>
          <p data-font-probe="body" style={{ fontFamily: bodyFont }}>
            Editorially minded designer.
          </p>
        </section>
      </div>
    );
  },
}));

describe("ResumeFontParityHarnessPage", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        status: "loaded",
        check: vi.fn(() => true),
      },
    });
  });

  afterEach(() => {
    delete window.__DASTI_RESUME_FONT_PARITY_PAYLOAD__;
    delete window.__DASTI_RESUME_FONT_PARITY_STATUS__;
  });

  it("exposes a ready snapshot for the injected preview-aligned payload", async () => {
    window.__DASTI_RESUME_FONT_PARITY_PAYLOAD__ =
      buildResumeFontParityPreviewSource({
        layout: "two-column",
        typography: "quiet-editorial",
      });

    render(
      <MemoryRouter initialEntries={["/debug/resume-font-parity"]}>
        <ResumeFontParityHarnessPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(window.__DASTI_RESUME_FONT_PARITY_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_FONT_PARITY_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "two-column",
        typography: "quiet-editorial",
        rendererVariantId: "robial",
        headingFontFamilyComputed: expect.stringContaining("Fraunces"),
        bodyFontFamilyComputed: expect.stringContaining("Syne"),
        documentFontsStatus: "loaded",
        headingFontCheck: true,
        bodyFontCheck: true,
      }),
    );
  });

  it("falls back to query params when no injected payload is present", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/debug/resume-font-parity?layout=two-column&typography=mono-signal",
        ]}
      >
        <ResumeFontParityHarnessPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(window.__DASTI_RESUME_FONT_PARITY_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_FONT_PARITY_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        typography: "mono-signal",
        rendererVariantId: "robial",
        headingFontFamilyComputed: expect.stringContaining("Archivo"),
        bodyFontFamilyComputed: expect.stringContaining("Archivo"),
      }),
    );
  });
});
