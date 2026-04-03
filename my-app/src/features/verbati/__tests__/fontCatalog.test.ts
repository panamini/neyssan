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
        "ledger-sans",
        "mono-signal",
        "studio-grotesk",
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

  it("does not crash when local font assets are absent", () => {
    ensureLocalFontFacesLoaded();
    expect(document.head.querySelector("#dasti-local-font-faces")).toBeNull();
  });
});
