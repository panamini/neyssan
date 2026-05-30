import { describe, expect, it } from "vitest";

import {
  PROPOSAL_ACTIVE_TEMPLATE_IDS,
  getProposalTemplateDefinition,
  isProposalLetterheadTemplateId,
  isProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import { RESUME_TEMPLATE_IDS } from "../layout/resumeTemplates";

describe("proposal render templates", () => {
  it("registers the MoMA Bauhaus template as proposal cover-letter only", () => {
    expect(PROPOSAL_ACTIVE_TEMPLATE_IDS).toContain("moma-bauhaus-letterhead");
    expect(isProposalTemplateId("moma-bauhaus-letterhead")).toBe(true);
    expect(isProposalLetterheadTemplateId("moma-bauhaus-letterhead")).toBe(true);
    expect(RESUME_TEMPLATE_IDS as readonly string[]).not.toContain(
      "moma-bauhaus-letterhead",
    );
  });

  it("exposes MoMA Bauhaus preview and export metadata through the live registry", () => {
    expect(getProposalTemplateDefinition("moma-bauhaus-letterhead")).toEqual(
      expect.objectContaining({
        id: "moma-bauhaus-letterhead",
        name: "MoMA Bauhaus Letterhead",
        shortLabel: "5 mm blue frame",
        twinLabel: "Cover letter",
        exportShell: "onecol",
        leftMarginMm: 32,
        bodyStartMm: 116,
        readingMeasureCh: 62,
      }),
    );
  });
});
