import { describe, expect, it } from "vitest";
import { getProposalTwinTemplateId } from "../../features/verbati/style";
import { resolveProposalRenderState } from "../proposal-render-state";

describe("resolveProposalRenderState", () => {
  it("uses stored proposal style metadata ahead of the active cv fallback while normalizing removed resume layouts", () => {
    const result = resolveProposalRenderState({
      storedStylePreset: {
        layout: "modernist",
        typography: "expert",
        palette: "encre",
      },
      storedTemplateId: "modernist_signal",
      activeCvStylePreset: {
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
    });

    expect(result.stylePreset.layout).toBe("two-column");
    expect(result.stylePreset.typography).toBe("mono-signal");
    expect(result.templateId).toBe("modernist_signal");
  });

  it("falls back to the active cv style and its proposal twin for legacy proposals", () => {
    const activeCvStylePreset = {
      layout: "quire",
      typography: "soft-serif",
      palette: "bordeaux",
    } as const;

    const result = resolveProposalRenderState({
      activeCvStylePreset,
    });

    expect(result.stylePreset).toMatchObject({
      ...activeCvStylePreset,
      layout: "two-column",
    });
    expect(result.templateId).toBe(
      getProposalTwinTemplateId(result.stylePreset),
    );
  });

  it("allows an explicit proposal template to override the twin while keeping the chosen style", () => {
    const result = resolveProposalRenderState({
      preferredStylePreset: {
        layout: "two-column",
        typography: "expert",
        palette: "encre",
      },
      preferredTemplateId: "editorial_wide",
      storedStylePreset: {
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
      storedTemplateId: "swiss_margin",
    });

    expect(result.stylePreset.layout).toBe("two-column");
    expect(result.stylePreset.typography).toBe("mono-signal");
    expect(result.templateId).toBe("editorial_wide");
  });

  it("maps the Volk manual style family onto the surviving Swiss proposal twin", () => {
    const result = resolveProposalRenderState({
      activeCvStylePreset: {
        layout: "volk-register",
        typography: "civic-correspondence",
        palette: "ocre",
      },
    });

    expect(result.stylePreset.layout).toBe("swiss");
    expect(result.stylePreset.typography).toBe("civic-correspondence");
    expect(result.templateId).toBe("swiss_margin");
  });
});
