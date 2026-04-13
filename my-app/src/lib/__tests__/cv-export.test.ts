import { describe, expect, it } from "vitest";

import {
  buildAuthoritativeResumeFilename,
  buildAuthoritativeResumePdf,
  serializeAuthoritativeResumeMarkdown,
} from "../cv-export";
import type { AuthoritativeResumeExportModel } from "../authoritative-resume";

const baseModel: AuthoritativeResumeExportModel = {
  schemaVersion: 1,
  profile: {
    name: "Jane Doe",
    desiredPosition: "Staff Product Manager",
    email: "jane@example.com",
  },
  summary: "Operator focused product leader.",
  experience: [
    {
      company: "Northline",
      position: "Staff PM",
      responsibilityBullets: [
        "Launched a multi-market platform",
        "Scaled the roadmap process",
      ],
      achievements: ["Hit annual growth targets"],
      summary: "This summary should not render when bullets exist.",
    },
  ],
  education: [],
  skills: [{ name: "Product strategy" }],
  languages: [{ name: "English", level: "Fluent" }],
  projects: [],
  certifications: [],
  achievements: [],
};

describe("authoritative resume export serializers", () => {
  it("derives filenames from authoritative profile data only", () => {
    expect(buildAuthoritativeResumeFilename(baseModel, "pdf")).toBe("jane-doe.pdf");
    expect(
      buildAuthoritativeResumeFilename(
        {
          ...baseModel,
          profile: { ...baseModel.profile, name: "" },
        },
        "json",
      ),
    ).toBe("resume.json");
  });

  it("renders markdown from the authoritative model without experience summary duplication", () => {
    const markdown = serializeAuthoritativeResumeMarkdown(baseModel);

    expect(markdown).toContain("# Jane Doe");
    expect(markdown).toContain("## Experience");
    expect(markdown).toContain("- Launched a multi-market platform");
    expect(markdown).not.toContain(
      "This summary should not render when bullets exist.",
    );
  });

  it("builds a PDF blob from the authoritative model", () => {
    const blob = buildAuthoritativeResumePdf(baseModel);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
