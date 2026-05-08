import { describe, expect, it } from "vitest";
import { getProposalTwinTemplateId } from "../../features/verbati/style";
import { resolveProposalRenderState } from "../proposal-render-state";

describe("resolveProposalRenderState", () => {
  it("uses stored proposal style metadata ahead of the active cv fallback without collapsing valid layout identity", () => {
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

    expect(result.stylePreset.layout).toBe("modernist");
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

  it("keeps stored template and stored style as independent artifact fields when both exist", () => {
    const result = resolveProposalRenderState({
      storedStylePreset: {
        layout: "editorial",
        typography: "civic-correspondence",
        palette: "custom",
        accentHex: "#AA7733",
      },
      storedTemplateId: "editorial_wide",
      activeCvStylePreset: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });

    expect(result.stylePreset).toEqual({
      familyId: "editorial",
      layout: "editorial",
      typography: "civic-correspondence",
      palette: "custom",
      accentHex: "#aa7733",
    });
    expect(result.templateId).toBe("editorial_wide");
  });

  it("recovers stored slot-only metadata ahead of the active cv fallback", () => {
    const result = resolveProposalRenderState({
      storedStyleSlotId: 2,
      storedStyleBaseSnapshot: {
        familyId: "workshop",
        layout: "workshop",
        typography: "civic-correspondence",
        palette: "cobalt",
      },
      activeCvStylePreset: {
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
    });

    expect(result.stylePreset).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
      typography: "civic-correspondence",
      palette: "cobalt",
    });
    expect(result.templateId).toBe("workshop_proposal_margin");
  });

  it("falls back from a valid stored slot id to its proposal bundle default", () => {
    const result = resolveProposalRenderState({
      storedStyleSlotId: 3,
      activeCvStylePreset: {
        layout: "swiss",
        typography: "signature",
        palette: "sauge",
      },
    });

    expect(result.stylePreset).toMatchObject({
      layout: "workshop",
      palette: "ink",
    });
    expect(result.templateId).toBe("workshop_proposal_margin");
  });

  it("keeps Volk style identity while resolving its proposal twin independently", () => {
    const result = resolveProposalRenderState({
      activeCvStylePreset: {
        layout: "volk-register",
        typography: "civic-correspondence",
        palette: "ocre",
      },
    });

    expect(result.stylePreset.layout).toBe("volk-register");
    expect(result.stylePreset.typography).toBe("civic-correspondence");
    expect(result.templateId).toBe("volk_register");
  });

  it("falls back to the family twin when a preferred proposal template id is unresolved", () => {
    const result = resolveProposalRenderState({
      preferredStylePreset: {
        familyId: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      },
      preferredTemplateId: "not_a_real_template" as never,
    });

    expect(result.stylePreset.familyId).toBe("workshop");
    expect(result.templateId).toBe(
      getProposalTwinTemplateId(result.stylePreset),
    );
  });

  it("keeps the stored explicit template ahead of the family twin when the preferred template is unresolved", () => {
    const result = resolveProposalRenderState({
      preferredStylePreset: {
        layout: "modernist",
        typography: "expert",
        palette: "encre",
      },
      preferredTemplateId: "not_a_real_template" as never,
      storedTemplateId: "quiet_margin",
    });

    expect(result.templateId).toBe("quire_margin");
  });
});
