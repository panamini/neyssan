import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resumeMock } from "../../features/verbati/resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import type { ResumePrintRoutePayload } from "../../lib/document-export-models";
import { ResumePrintPage } from "../ResumePrintPage";

function buildPayload(): ResumePrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: "en",
    resumeData: resumeMock,
    stylePreset: {
      ...DEFAULT_VERBATI_STYLE,
      layout: "two-column",
    },
    rendererVariantId: "robial",
  };
}

describe("ResumePrintPage", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
      },
    });
    HTMLCanvasElement.prototype.getContext = (() => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 10 }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    delete window.__DASTI_RESUME_PRINT_PAYLOAD__;
    delete window.__DASTI_RESUME_PRINT_BOOTSTRAP__;
    delete window.__DASTI_RESUME_PRINT_STATUS__;
  });

  it("renders the real ResumePage tree for the injected payload and marks the route ready", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildPayload();

    render(<ResumePrintPage />);

    expect(screen.getByLabelText("Grid 17/18")).toBeInTheDocument();
    expect(document.querySelector(".resume-page--robial")).toBeTruthy();
    expect(
      document
        .querySelector(".dasti-resume-print-route")
        ?.getAttribute("data-style-layout"),
    ).toBe("two-column");
    expect(
      document
        .querySelector(".dasti-resume-print-route")
        ?.getAttribute("data-style-typography"),
    ).toBe("quiet-editorial");

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_BOOTSTRAP__).toEqual(buildPayload());
    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "two-column",
        typography: "quiet-editorial",
        rendererVariantId: "robial",
        headingFontFamily: expect.stringContaining("Fraunces"),
        bodyFontFamily: expect.stringContaining("Syne"),
        inheritedBodyFontFamilyComputed: expect.any(String),
        surfaceFontFamilyComputed: expect.any(String),
        fontHeadingCssVar: expect.stringContaining("Fraunces"),
        fontBodyCssVar: expect.stringContaining("Syne"),
      }),
    );
  });

  it("renders Swiss Minima with a distinct heading/body font split on the print route", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "swiss",
        typography: "quiet-editorial",
      },
      rendererVariantId: "swissminima",
    };

    render(<ResumePrintPage />);

    expect(screen.getByLabelText("Swiss Minima")).toBeInTheDocument();
    expect(document.querySelector(".resume-page--swissminima")).toBeTruthy();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    expect(window.__DASTI_RESUME_PRINT_STATUS__?.snapshot).toEqual(
      expect.objectContaining({
        layout: "swiss",
        typography: "quiet-editorial",
        rendererVariantId: "swissminima",
        headingFontFamily: expect.stringContaining("Fraunces"),
        bodyFontFamily: expect.stringContaining("Syne"),
        fontHeadingCssVar: expect.stringContaining("Fraunces"),
        fontBodyCssVar: expect.stringContaining("Syne"),
        headingFontFamilyComputed: "var(--font-heading-family)",
        bodyFontFamilyComputed: "var(--font-body-family)",
        inheritedBodyFontFamilyComputed: "var(--font-body-family)",
      }),
    );
  });

  it("keeps Robial print-route vars aligned when typography changes", async () => {
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = buildPayload();

    const quietView = render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const quietSnapshot = window.__DASTI_RESUME_PRINT_STATUS__?.snapshot;

    quietView.unmount();
    delete window.__DASTI_RESUME_PRINT_STATUS__;
    window.__DASTI_RESUME_PRINT_PAYLOAD__ = {
      ...buildPayload(),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
        typography: "mono-signal",
      },
      rendererVariantId: "robial",
    };

    render(<ResumePrintPage />);

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("ready");
    });

    const monoSnapshot = window.__DASTI_RESUME_PRINT_STATUS__?.snapshot;

    expect(quietSnapshot?.fontHeadingCssVar).toContain("Fraunces");
    expect(quietSnapshot?.fontBodyCssVar).toContain("Syne");
    expect(monoSnapshot?.fontHeadingCssVar).toContain("Archivo");
    expect(monoSnapshot?.fontBodyCssVar).toContain("Archivo");
    expect(quietSnapshot?.fontHeadingCssVar).not.toBe(
      monoSnapshot?.fontHeadingCssVar,
    );
    expect(quietSnapshot?.fontBodyCssVar).not.toBe(
      monoSnapshot?.fontBodyCssVar,
    );
  });

  it("reports an explicit error when the print payload is missing", async () => {
    render(<ResumePrintPage />);

    expect(
      screen.getByText("Resume print payload is missing."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.__DASTI_RESUME_PRINT_STATUS__?.status).toBe("error");
    });
  });
});
