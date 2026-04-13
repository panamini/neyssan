import { describe, expect, it } from "vitest";

import {
  buildAuthoritativeResumeExportModel,
  hasTrustedAuthoritativeResume,
} from "../authoritative-resume";

describe("authoritative resume projection", () => {
  it("projects only the trusted allowlist and ignores compatibility fields", () => {
    const model = buildAuthoritativeResumeExportModel({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        name: "Jane Doe",
        profile: {
          name: "Jane Doe",
          desiredPosition: "Staff Product Manager",
          email: "jane@example.com",
          location: "Paris, FR",
        },
        contact: {
          phone: "+33 6 00 00 00 00",
          linkedin: "linkedin.com/in/jane",
          website: "janedoe.dev",
          github: "github.com/jane",
          portfolio: "portfolio.jane.dev",
        },
        summary: { text: "Operator focused product leader." },
        summaryFirstSentence: "Ignore me",
        experience: [
          {
            company: "Northline",
            position: "Staff PM",
            summary: "Owned product strategy.",
            responsibilities: "Should never be exported",
            responsibilityBullets: [
              "Launched a multi-market platform",
              "Scaled the roadmap process",
            ],
            achievements: ["Hit annual growth targets"],
          },
        ],
        education: [
          {
            institution: "Sorbonne",
            degree: "MBA",
            description: "Product strategy concentration",
          },
        ],
        skills: [{ name: "Product strategy" }],
        skillsText: "Should be ignored",
        languages: [{ name: "English", level: "Fluent" }],
        languagesRaw: ["Should be ignored"],
        projects: [
          {
            title: "Atlas",
            meta: "Internal platform",
            summary: "Built the operating model.",
            description: "Fallback body should stay unused when summary exists",
          },
        ],
        certifications: [
          {
            certificationName: "PMP",
            issuingOrganization: "PMI",
            issueDate: "2024-04",
          },
        ],
        achievements: [{ text: "Promoted twice in three years" }],
        hobbies: [{ text: "Chess" }],
        raw: "ignore",
        rawText: "ignore",
        rawSections: [{ label: "BODY", content: "ignore" }],
        sections: [{ type: "summary" }],
        appDocument: { sections: [] },
      },
    });

    expect(model).not.toBeNull();
    expect(model).toMatchObject({
      profile: {
        name: "Jane Doe",
        desiredPosition: "Staff Product Manager",
        email: "jane@example.com",
        phone: "+33 6 00 00 00 00",
        location: "Paris, FR",
        linkedin: "linkedin.com/in/jane",
        website: "janedoe.dev",
        github: "github.com/jane",
        portfolio: "portfolio.jane.dev",
      },
      summary: "Operator focused product leader.",
      skills: [{ name: "Product strategy" }],
      languages: [{ name: "English", level: "Fluent" }],
      achievements: ["Promoted twice in three years"],
      hobbies: ["Chess"],
    });
    expect(model?.experience[0]).toEqual({
      company: "Northline",
      position: "Staff PM",
      description: "Owned product strategy.",
      responsibilityBullets: [
        "Launched a multi-market platform",
        "Scaled the roadmap process",
      ],
      achievements: ["Hit annual growth targets"],
      location: undefined,
      startDate: undefined,
      endDate: null,
      isCurrent: false,
    });
    expect(model?.projects[0]).toEqual({
      title: "Atlas",
      meta: "Internal platform",
      summary: "Built the operating model.",
    });
    expect(model).not.toHaveProperty("summaryFirstSentence");
    expect(model).not.toHaveProperty("rawText");
    expect(model).not.toHaveProperty("rawSections");
    expect(model).not.toHaveProperty("sections");
  });

  it("does not recover hobbies from compatibility or raw fields when trusted normalized hobbies are absent", () => {
    const model = buildAuthoritativeResumeExportModel({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
        rawText: "HOBBIES\nChess",
        rawSections: [{ label: "HOBBIES", content: "Chess" }],
        sections: [{ title: "Hobbies", type: "text", blocks: [] }],
      },
    });

    expect(model?.hobbies).toEqual([]);
  });

  it("accepts canonical trusted hobbies as plain strings and experience description explicitly", () => {
    const model = buildAuthoritativeResumeExportModel({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
        experience: [
          {
            company: "Northline",
            position: "Staff PM",
            description: "Opened the role with narrative prose.",
            responsibilityBullets: ["Scaled the roadmap process"],
          },
        ],
        hobbies: ["Chess", "Running"],
      },
    });

    expect(model?.experience[0]?.description).toBe("Opened the role with narrative prose.");
    expect(model?.experience[0]?.responsibilityBullets).toEqual(["Scaled the roadmap process"]);
    expect(model?.hobbies).toEqual(["Chess", "Running"]);
  });

  it("rejects untrusted or fallback payloads", () => {
    expect(
      hasTrustedAuthoritativeResume({
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: false,
        normalized: null,
      }),
    ).toBe(false);

    expect(
      buildAuthoritativeResumeExportModel({
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: true,
        normalized: { profile: { name: "Jane Doe" } },
      }),
    ).toBeNull();
  });
});
