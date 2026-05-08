import { describe, expect, it } from "vitest";

import {
  CANONICAL_PROPOSAL_TEMPLATE_ID,
  resolveProposalTemplateId,
} from "../../../../convex/lib/proposals/renderTemplates";
import {
  DEFAULT_VERBATI_STYLE,
  getProposalTwinTemplateId,
  getResumeTemplateId,
  getStyleFamilyId,
  getVerbatiStyleFromCv,
  resolveLegacyResumeRendererVariantId,
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
  VERBATI_LAYOUT_OPTIONS,
} from "../style";

describe("verbati style normalization", () => {
  it("uses workshop as the default active layout", () => {
    expect(DEFAULT_VERBATI_STYLE).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
    });
  });

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
    expect(resolveProposalTemplateId(null)).toBe(CANONICAL_PROPOSAL_TEMPLATE_ID);
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
    expect(resolveLegacyResumeRendererVariantId(legacyResolved)).toBe(
      "robial",
    );
    expect(resolveLegacyResumeRendererVariantId(familyResolved)).toBe(
      "robial",
    );
  });

  it("recovers CV visual style from base snapshot metadata when verbatiStyle is absent", () => {
    expect(
      getVerbatiStyleFromCv({
        id: "cv-slot-base",
        title: "Slot base CV",
        metadata: {
          verbatiStyleSlotId: 2,
          verbatiStyleBaseSnapshot: {
            familyId: "workshop",
            layout: "workshop",
            typography: "civic-correspondence",
            palette: "cobalt",
          },
        },
        sections: [],
      }),
    ).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
      typography: "civic-correspondence",
      palette: "cobalt",
    });
  });

  it("recovers CV visual style from factory slot metadata when snapshots are absent", () => {
    expect(
      getVerbatiStyleFromCv({
        id: "cv-slot-only",
        title: "Slot only CV",
        metadata: {
          verbatiStyleSlotId: 3,
        },
        sections: [],
      }),
    ).toMatchObject({
      familyId: "workshop",
      layout: "workshop",
      typography: "ledger-sans",
      palette: "ink",
    });
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
    expect(resolveLegacyResumeRendererVariantId(workshopStyle)).toBe(
      "swissminima",
    );
  });

  it("treats Workshop template identity as part of style equality", () => {
    expect(
      stylesEqual(
        {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_onecol_ats",
        },
        {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      ),
    ).toBe(false);
  });

  it("exposes workshop one-column and two-column as active layout options", () => {
    expect(VERBATI_LAYOUT_OPTIONS.map((option) => option.id)).toEqual([
      "workshop",
      "workshop",
    ]);
    expect(VERBATI_LAYOUT_OPTIONS.map((option) => option.resumeTemplateId)).toEqual([
      "workshop_resume_onecol_ats",
      "workshop_resume_twocol_ats",
    ]);
  });
});
