import { describe, expect, it, vi, beforeEach } from "vitest";

import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import {
  collectResumeFontDebugSnapshot,
  readPrimaryFontFamilyToken,
} from "../resume-font-debug";

describe("resume-font-debug", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loaded",
        check: vi.fn(() => true),
        [Symbol.iterator]: function* iterator() {
          yield { family: "Fraunces" };
          yield { family: "Syne" };
        },
      },
    });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      font: "",
      measureText: (text: string) => ({ width: text.length * 10 }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const styleTag = document.createElement("style");
    styleTag.id = "dasti-local-font-faces";
    styleTag.textContent =
      '@font-face{font-family:Fraunces;src:url("/Fraunces.ttf")}@font-face{font-family:Syne;src:url("/Syne.ttf")}';
    document.head.append(styleTag);
  });

  it("collects computed font families and css vars from the shared renderer surface", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <section
        class="resume-page"
        style="--font-heading-family: 'Fraunces', serif; --font-body-family: 'Syne', sans-serif; font-family: var(--font-body-family);"
      >
        <h1 data-font-probe="heading" style="font-family: 'Fraunces', serif;">Elena Marlowe</h1>
        <p data-font-probe="body" style="font-family: 'Syne', sans-serif;">Editorially minded designer.</p>
        <span data-font-probe="body-inherited">Inherited body probe</span>
      </section>
    `;
    document.body.append(root);

    const snapshot = collectResumeFontDebugSnapshot({
      root,
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
      },
      rendererVariantId: "robial",
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        layout: "two-column",
        typography: "quiet-editorial",
        rendererVariantId: "robial",
        headingFontFamilyComputed: expect.stringContaining("Fraunces"),
        bodyFontFamilyComputed: expect.stringContaining("Syne"),
        inheritedBodyFontFamilyComputed: "var(--font-body-family)",
        surfaceFontFamilyComputed: "var(--font-body-family)",
        fontHeadingCssVar: expect.stringContaining("Fraunces"),
        fontBodyCssVar: expect.stringContaining("Syne"),
        fontEditorialCssVar: expect.stringContaining("Fraunces"),
        documentFontsStatus: "loaded",
        headingFontCheck: true,
        bodyFontCheck: true,
        inheritedBodyFontCheck: true,
        loadedFontFamilies: ["Fraunces", "Syne"],
        headingMeasurementSample: expect.any(String),
        bodyMeasurementSample: expect.any(String),
        headingComputedTextWidth: expect.any(Number),
        headingPrimaryTextWidth: expect.any(Number),
        headingFallbackTextWidth: expect.any(Number),
        bodyComputedTextWidth: expect.any(Number),
        bodyPrimaryTextWidth: expect.any(Number),
        bodyFallbackTextWidth: expect.any(Number),
        localFontFaceStylePresent: true,
        localFontFaceCssLength: expect.any(Number),
        localFontFaceCssIncludesHeadingPrimaryFamily: true,
        localFontFaceCssIncludesBodyPrimaryFamily: true,
      }),
    );
    expect([null, true, false]).toContain(snapshot.headingPrimaryFamilyLikely);
    expect([null, true, false]).toContain(snapshot.bodyPrimaryFamilyLikely);
  });

  it("extracts the primary family token from computed font stacks", () => {
    expect(readPrimaryFontFamilyToken(`"Fraunces", Georgia, serif`)).toBe("Fraunces");
    expect(readPrimaryFontFamilyToken(`'Archivo', sans-serif`)).toBe("Archivo");
    expect(readPrimaryFontFamilyToken("")).toBe("");
  });
});
