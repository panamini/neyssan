import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureLocalFontFacesLoaded,
  getVerbatiFontPairOption,
  resolveVerbatiFontPairId,
  VERBATI_FONT_PAIR_OPTIONS,
} from "../fontCatalog";

describe("verbati font catalog", () => {
  beforeEach(() => {
    document.head
      .querySelectorAll("#dasti-local-font-faces")
      .forEach((node) => node.remove());
  });

  it("exposes curated font-pair options for the local typography catalog", () => {
    expect(VERBATI_FONT_PAIR_OPTIONS.map((option) => option.id)).toEqual(
      expect.arrayContaining([
        "quiet-editorial",
        "civic-correspondence",
        "ledger-sans",
        "mono-signal",
        "studio-grotesk",
        "bricolage-hepta",
        "nunito-ortica",
        "nunito-code",
        "doto-code",
      ]),
    );
  });

  it("maps legacy typography presets to the new font-pair ids", () => {
    expect(resolveVerbatiFontPairId("signature")).toBe("quiet-editorial");
    expect(resolveVerbatiFontPairId("engaging")).toBe("soft-serif");
    expect(resolveVerbatiFontPairId("expert")).toBe("mono-signal");
  });

  it("falls back safely when a requested font pair is missing", () => {
    expect(getVerbatiFontPairOption("does-not-exist")).toMatchObject({
      id: "quiet-editorial",
    });
  });

  it("resolves the civic pair with the intended local-font labels", () => {
    expect(getVerbatiFontPairOption("civic-correspondence")).toMatchObject({
      id: "civic-correspondence",
      headingLabel: "Thestral Neue",
      bodyLabel: "BioRhyme Light",
    });
  });

  it("injects local font-face rules when bundled font assets are present", () => {
    ensureLocalFontFacesLoaded();
    const styleTag = document.head.querySelector("#dasti-local-font-faces");
    expect(styleTag).not.toBeNull();
    expect(styleTag?.textContent).toContain("@font-face");
    expect(styleTag?.textContent).toContain("font-family:Archivo");
    expect(styleTag?.textContent).toContain('font-family:"Source Code Pro"');
    expect(styleTag?.textContent).toContain("font-style:italic");
  });
});
