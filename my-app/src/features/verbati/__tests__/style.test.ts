import { describe, expect, it } from "vitest";

import { resolveProposalTemplateId } from "../../../../convex/lib/proposals/renderTemplates";
import { resolveVerbatiStyle } from "../style";

describe("verbati style normalization", () => {
  it("normalizes legacy and deferred layouts onto the two-template baseline", () => {
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
    ).toBe("swiss");
    expect(
      resolveVerbatiStyle({
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("two-column");
    expect(
      resolveVerbatiStyle({
        layout: "modernist",
        typography: "quiet-editorial",
        palette: "sauge",
      }).layout,
    ).toBe("two-column");
  });

  it("keeps legacy proposal template aliases resolving to active templates", () => {
    expect(resolveProposalTemplateId("editorial_left_rail")).toBe(
      "editorial_wide",
    );
    expect(resolveProposalTemplateId("quiet_margin")).toBe("quire_margin");
  });
});
