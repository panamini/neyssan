import { describe, expect, it } from "vitest";

import { resolveProposalTemplateId } from "../../../../convex/lib/proposals/renderTemplates";
import {
  getProposalTwinTemplateId,
  getResumeTemplateId,
  getStyleFamilyId,
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
  serializeVerbatiStyle,
  VERBATI_LAYOUT_OPTIONS,
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
      familyId: "editorial",
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
      familyId: "two-column",
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

  it("canonicalizes family identity while mirroring layout for persistence", () => {
    expect(
      resolveVerbatiStyle({
        familyId: "workshop",
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    ).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    });

    expect(
      serializeVerbatiStyle({
        familyId: "workshop",
        layout: "workshop",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    ).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
    });
  });

  it("resolves legacy aliases and canonical family ids to the same paired templates", () => {
    const legacyResolved = resolveVerbatiStyle({
      layout: "soft-ribbon" as never,
      typography: "quiet-editorial",
      palette: "sauge",
    });
    const familyResolved = resolveVerbatiStyle({
      familyId: "two-column",
      typography: "quiet-editorial",
      palette: "sauge",
    });

    expect(getStyleFamilyId(legacyResolved)).toBe("two-column");
    expect(getStyleFamilyId(familyResolved)).toBe("two-column");
    expect(getResumeTemplateId(legacyResolved)).toBe(
      getResumeTemplateId(familyResolved),
    );
    expect(getProposalTwinTemplateId(legacyResolved)).toBe(
      getProposalTwinTemplateId(familyResolved),
    );
  });

  it("resolves workshop family identity to the scaffolded paired templates", () => {
    const workshopStyle = resolveVerbatiStyle({
      familyId: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    });

    expect(getStyleFamilyId(workshopStyle)).toBe("workshop");
    expect(getResumeTemplateId(workshopStyle)).toBe(
      "workshop_resume_onecol_ats",
    );
    expect(getProposalTwinTemplateId(workshopStyle)).toBe(
      "workshop_proposal_margin",
    );
  });

  it("keeps workshop hidden from layout options while the feature flag is off", () => {
    expect(
      VERBATI_LAYOUT_OPTIONS.some((option) => option.id === "workshop"),
    ).toBe(false);
  });
});
