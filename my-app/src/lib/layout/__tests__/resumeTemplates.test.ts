import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESUME_TEMPLATE_ID,
  getResumeTemplateDefinition,
  RESUME_TEMPLATE_DEFINITIONS,
} from "../resumeTemplates";

describe("resumeTemplates", () => {
  it("defines workshop as a typed resume template on the legacy preview shell", () => {
    expect(getResumeTemplateDefinition("workshop_resume_onecol_ats")).toEqual(
      expect.objectContaining({
        id: "workshop_resume_onecol_ats",
        familyId: "workshop",
        shell: "legacy-preview",
      }),
    );
  });

  it("includes the default legacy swiss template definition", () => {
    expect(getResumeTemplateDefinition(DEFAULT_RESUME_TEMPLATE_ID)).toEqual(
      expect.objectContaining({
        id: "swiss_resume_legacy",
        familyId: "swiss",
        shell: "legacy-preview",
      }),
    );
  });

  it("exposes exact template definitions for the shipped family ids", () => {
    expect(RESUME_TEMPLATE_DEFINITIONS.map((definition) => definition.id)).toEqual(
      expect.arrayContaining([
        "swiss_resume_legacy",
        "volk_register_resume_legacy",
        "two_column_resume_legacy",
        "editorial_resume_legacy",
        "modernist_resume_legacy",
        "quire_resume_legacy",
        "workshop_resume_onecol_ats",
      ]),
    );
  });
});
