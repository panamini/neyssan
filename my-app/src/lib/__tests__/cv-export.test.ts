import { describe, expect, it } from "vitest";

import {
  buildAuthoritativeResumeFilename,
  buildAuthoritativeResumePdf,
  buildStandardResumeFilename,
  buildStandardResumePdf,
  serializeAuthoritativeResumeMarkdown,
  serializeStandardResumeMarkdown,
} from "../cv-export";
import type { AuthoritativeResumeExportModel } from "../authoritative-resume";
import type { ResumeData } from "../../features/verbati/resume/resume.types";

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

const standardResume: ResumeData = {
  name: "Editor Name",
  title: "Editor Title",
  summary: "Editable summary",
  metadata: [{ label: "Location", value: "Paris" }],
  contact: [{ label: "Email", value: "editor@example.com" }],
  skills: ["Research"],
  languages: [{ name: "French", level: "Native" }],
  experience: [
    {
      role: "Designer",
      company: "Studio",
      period: "Apr 2022 - Jun 2024",
      location: "Paris",
      bullets: ["Owned the design system"],
    },
  ],
  projects: [],
  education: [],
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

  it("uses stable generic filenames for standard exports", () => {
    expect(buildStandardResumeFilename("pdf")).toBe("resume.pdf");
    expect(buildStandardResumeFilename("docx")).toBe("resume.docx");
  });

  it("renders markdown and PDF for standard exports without using UI titles", () => {
    const markdown = serializeStandardResumeMarkdown(standardResume);
    expect(markdown).toContain("# Editor Name");
    expect(markdown).toContain("## Experience");
    expect(markdown).toContain("- Owned the design system");

    const blob = buildStandardResumePdf(standardResume);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
