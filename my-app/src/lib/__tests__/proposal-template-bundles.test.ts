import { describe, expect, it } from "vitest";

import { CANONICAL_PROPOSAL_TEMPLATE_ID } from "../../../convex/lib/proposals/renderTemplates";
import { getProposalTwinTemplateId } from "../../features/verbati/style";
import {
  PROPOSAL_LAYOUT_OPTIONS,
  PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS,
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
} from "../proposal-template-bundles";

describe("proposal-template-bundles pairing", () => {
  it("exposes only workshop as the active proposal layout option", () => {
    expect(PROPOSAL_LAYOUT_OPTIONS.map((option) => option.id)).toEqual([
      "workshop",
    ]);
  });

  it("derives every bundle template from the canonical family twin resolver", () => {
    for (const definition of PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS) {
      expect(definition.templateId).toBe(
        getProposalTwinTemplateId(definition.stylePreset),
      );
    }
  });

  it("routes every workshop proposal bundle through the canonical proposal template", () => {
    for (const definition of PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS) {
      expect(definition.stylePreset.layout).toBe("workshop");
      expect(definition.templateId).toBe(CANONICAL_PROPOSAL_TEMPLATE_ID);
    }
  });

  it("finds bundle ids from canonical family-backed style presets", () => {
    const bundle = getProposalTemplateBundleDefinition("magazine_editorial");

    expect(
      findProposalTemplateBundleIdByStylePreset({
        familyId: bundle.stylePreset.familyId,
        layout: "workshop",
        typography: bundle.stylePreset.typography,
        palette: bundle.stylePreset.palette,
      }),
    ).toBe(bundle.id);
  });
});
