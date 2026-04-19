import { describe, expect, it } from "vitest";

import { getProposalTwinTemplateId } from "../../features/verbati/style";
import {
  getProposalStyleDefinition,
  resolveProposalStyleChoiceFromRenderState,
} from "../proposal-style-choice";

describe("proposal-style-choice pairing", () => {
  it("derives every canned proposal style template from the canonical family twin resolver", () => {
    expect(getProposalStyleDefinition("formal")).toMatchObject({
      templateId: getProposalTwinTemplateId(
        getProposalStyleDefinition("formal").stylePreset,
      ),
    });
    expect(getProposalStyleDefinition("warm")).toMatchObject({
      templateId: getProposalTwinTemplateId(
        getProposalStyleDefinition("warm").stylePreset,
      ),
    });
    expect(getProposalStyleDefinition("technical")).toMatchObject({
      templateId: getProposalTwinTemplateId(
        getProposalStyleDefinition("technical").stylePreset,
      ),
    });
    expect(getProposalStyleDefinition("balanced")).toMatchObject({
      templateId: getProposalTwinTemplateId(
        getProposalStyleDefinition("balanced").stylePreset,
      ),
    });
  });

  it("matches render-state choices from canonical family-backed styles", () => {
    const technical = getProposalStyleDefinition("technical");

    expect(
      resolveProposalStyleChoiceFromRenderState({
        stylePreset: {
          familyId: technical.stylePreset.familyId,
          layout: "swiss",
          typography: technical.stylePreset.typography,
          palette: technical.stylePreset.palette,
        },
        templateId: technical.templateId,
      }),
    ).toBe("technical");
  });
});
