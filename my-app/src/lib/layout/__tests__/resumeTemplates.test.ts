import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESUME_TEMPLATE_ID,
  MAGGIE_LETTER_RESUME_TEMPLATE_ID,
  SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
  getResumeTemplateDefinition,
  isMaggieResumeTemplateId,
  isSanatResumeTemplateId,
  isWorkshopResumeTemplateId,
  isWorkshopTwoColumnResumeTemplateId,
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
        "editorial-sidebar",
        "modernist_resume_legacy",
        "quire_resume_legacy",
        "workshop_resume_onecol_ats",
        "workshop_resume_twocol_ats",
        "sanat_asymmetric_resume",
        MAGGIE_LETTER_RESUME_TEMPLATE_ID,
      ]),
    );
  });

  it("defines the editorial sidebar resume template with asymmetric A4 geometry", () => {
    const template = getResumeTemplateDefinition("editorial-sidebar");

    expect(template).toEqual(
      expect.objectContaining({
        id: "editorial-sidebar",
        familyId: "workshop",
        supportsPlanner: false,
        exportShell: "split",
      }),
    );
    expect(template.preview).toEqual(
      expect.objectContaining({
        topMm: 20,
        rightMm: 15,
        bottomMm: 18,
        leftMm: 14,
        sidebarMm: 38,
        gutterMm: 13,
        mainMm: 130,
      }),
    );
  });

  it("defines the two-column workshop template with canonical Workshop geometry", () => {
    const template = getResumeTemplateDefinition("workshop_resume_twocol_ats");

    expect(template).toEqual(
      expect.objectContaining({
        id: "workshop_resume_twocol_ats",
        familyId: "workshop",
        supportsPlanner: true,
      }),
    );
    expect(template.preview).toEqual(
      expect.objectContaining({
        topMm: 17,
        leftMm: 18,
        rightMm: 35,
        bottomMm: 18,
        gutterMm: 12,
        sidebarMm: 45,
        mainMm: 100,
      }),
    );
    expect(isWorkshopResumeTemplateId(template.id)).toBe(true);
    expect(isWorkshopTwoColumnResumeTemplateId(template.id)).toBe(true);
  });

  it("defines the Sanat asymmetric resume template as a planner-backed workshop template", () => {
    const template = getResumeTemplateDefinition(SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID);

    expect(template).toEqual(
      expect.objectContaining({
        id: SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
        familyId: "workshop",
        label: "Sanat asymmetric",
        supportsPlanner: true,
      }),
    );
    expect(template.preview).toEqual(
      expect.objectContaining({
        topMm: 18,
        leftMm: 17,
        rightMm: 20,
        bottomMm: 18,
        gutterMm: 13,
        sidebarMm: 63,
        mainMm: 97,
      }),
    );
    expect(isWorkshopResumeTemplateId(template.id)).toBe(true);
    expect(isSanatResumeTemplateId(template.id)).toBe(true);
    expect(isWorkshopTwoColumnResumeTemplateId(template.id)).toBe(false);
  });

  it("defines Maggie Letter as a planner-backed native Letter-ratio workshop template", () => {
    const template = getResumeTemplateDefinition(MAGGIE_LETTER_RESUME_TEMPLATE_ID);

    expect(template).toEqual(
      expect.objectContaining({
        id: MAGGIE_LETTER_RESUME_TEMPLATE_ID,
        familyId: "workshop",
        label: "Maggie Letter",
        supportsPlanner: true,
        supportsLegacyComparison: false,
        exportShell: "onecol",
      }),
    );
    expect(template.preview).toEqual(
      expect.objectContaining({
        topMm: 25.5,
        leftMm: 24.5,
        rightMm: 23.5,
        bottomMm: 18,
        gutterMm: 15.5,
        sidebarMm: 73,
        mainMm: 79.5,
      }),
    );
    expect(template.export).toEqual(
      expect.objectContaining({
        topMm: 25.5,
        leftMm: 24.5,
        rightMm: 23.5,
        gutterMm: 15.5,
        sidebarMm: 73,
        mainMm: 79.5,
      }),
    );
    expect(isWorkshopResumeTemplateId(template.id)).toBe(true);
    expect(isMaggieResumeTemplateId(template.id)).toBe(true);
  });
});
