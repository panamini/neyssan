import { describe, expect, it } from "vitest";

import { resolveProposalTemplateId } from "../../../../convex/lib/proposals/renderTemplates";
import {
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
} from "../style";

describe("verbati style normalization", () => {
  it("normalizes only true legacy layout aliases and preserves valid semantic layouts", () => {
    expect(
      resolveVerbatiStyle({
        layout: "playful-photo" as never,
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("two-column");
    expect(
      resolveVerbatiStyle({
        layout: "soft-ribbon" as never,
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("two-column");
    expect(
      resolveVerbatiStyle({
        layout: "slate-column" as never,
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("two-column");
    expect(
      resolveVerbatiStyle({
        layout: "volk-register",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("volk-register");
    expect(
      resolveVerbatiStyle({
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("editorial");
    expect(
      resolveVerbatiStyle({
        layout: "modernist",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("modernist");
    expect(
      resolveVerbatiStyle({
        layout: "quire",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("quire");
  });

  it("preserves persisted style identity while allowing same-identity legacy typography aliases", () => {
    expect(
      sanitizePersistedVerbatiStyle({
        layout: "editorial",
        typography: "civic-correspondence",
        palette: "custom",
        accentHex: "#AA7733",
      }),
    ).toEqual({
      layout: "editorial",
      typography: "civic-correspondence",
      palette: "custom",
      accentHex: "#aa7733",
    });

    expect(
      sanitizePersistedVerbatiStyle({
        layout: "soft-ribbon" as never,
        typography: "engaging",
        palette: "encre",
      }),
    ).toEqual({
      layout: "two-column",
      typography: "soft-serif",
      palette: "encre",
      accentHex: undefined,
    });
  });

  it("keeps legacy proposal template aliases resolving to active templates", () => {
    expect(resolveProposalTemplateId("editorial_left_rail")).toBe(
      "editorial_wide",
    );
    expect(resolveProposalTemplateId("quiet_margin")).toBe("quire_margin");
  });
});
