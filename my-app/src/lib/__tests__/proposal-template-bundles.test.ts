import { describe, expect, it } from "vitest";

import { getProposalTwinTemplateId } from "../../features/verbati/style";
import {
  PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS,
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
} from "../proposal-template-bundles";

describe("proposal-template-bundles pairing", () => {
  it("derives every bundle template from the canonical family twin resolver", () => {
    for (const definition of PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS) {
      expect(definition.templateId).toBe(
        getProposalTwinTemplateId(definition.stylePreset),
      );
    }
  });

  it("finds bundle ids from canonical family-backed style presets", () => {
    const bundle = getProposalTemplateBundleDefinition("magazine_editorial");

    expect(
      findProposalTemplateBundleIdByStylePreset({
        familyId: bundle.stylePreset.familyId,
        layout: "swiss",
        typography: bundle.stylePreset.typography,
        palette: bundle.stylePreset.palette,
      }),
    ).toBe(bundle.id);
  });
});
