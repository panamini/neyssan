import { describe, expect, it } from "vitest";

import { evaluateCvAtsAudit } from "../evaluateCvAtsAudit";
import type { CvDocument, CvSection } from "../../../types/cvDocument";

function section(
  type: CvSection["type"],
  title: string,
  structuredContent: NonNullable<CvSection["structuredContent"]>,
): CvSection {
  return {
    id: `${type}-section`,
    type,
    title,
    blocks: [],
    structuredContent,
  };
}

function authoritativeResume(overrides: Record<string, unknown> = {}) {
  return {
    source: "mistral_v3",
    trusted: true,
    fallbackToLegacy: false,
    normalized: {
      profile: {
        name: "Jessica Claire",
        desiredPosition: "Middle School Teacher",
        email: "jessica@example.com",
        phone: "(555) 432-1000",
        location: "San Francisco, CA",
      },
      summary: {
        text: "Competent educator with classroom leadership, curriculum planning, and measurable student progress across language arts programs.",
      },
      experience: [
        {
          company: "Spring Education Group",
          position: "Middle School Language Arts Teacher",
          location: "Issaquah, WA",
          startDate: "2020",
          endDate: "2025",
          responsibilityBullets: [
            "Taught inclusive language arts classes for seventh and eighth grade students.",
            "Analyzed student data to drive instruction and improve assessment outcomes.",
          ],
          achievements: ["Led grade-level planning for three years."],
        },
      ],
      education: [
        {
          institution: "Cedarville University",
          degree: "Bachelor of Arts",
          fieldOfStudy: "Education",
          startDate: "2014",
          endDate: "2018",
        },
      ],
      skills: [
        { name: "Curriculum planning" },
        { name: "Student assessment" },
        { name: "Classroom management" },
        { name: "IEP collaboration" },
        { name: "Instructional design" },
      ],
      certifications: [
        {
          certificationName: "State Teaching Credential",
          issuingOrganization: "Washington State",
          issueDate: "2020",
          credentialId: "WA-123",
        },
      ],
      ...overrides,
    },
  };
}

function excellentCv(
  authoritativeOverrides: Record<string, unknown> = {},
): CvDocument {
  return {
    id: "cv_1",
    title: "Jessica Claire",
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
      authoritativeResume: authoritativeResume(authoritativeOverrides),
    },
    sections: [
      section("profile", "Profile", [
        {
          name: "Jessica Claire",
          email: "jessica@example.com",
          phone: "(555) 432-1000",
          location: "San Francisco, CA",
          desiredPosition: "Middle School Teacher",
        },
      ]),
      section("summary", "Summary", [
        {
          summary:
            "Competent educator with classroom leadership, curriculum planning, and measurable student progress across language arts programs.",
        },
      ]),
      section("experience", "Experience", [
        {
          company: "Spring Education Group",
          position: "Middle School Language Arts Teacher",
          startDate: "2020",
          endDate: "2025",
          responsibilityBullets: [
            "Taught inclusive language arts classes for seventh and eighth grade students.",
            "Analyzed student data to drive instruction and improve assessment outcomes.",
          ],
          achievements: ["Led grade-level planning for three years."],
        },
      ]),
      section("education", "Education", [
        {
          institution: "Cedarville University",
          degree: "Bachelor of Arts",
          fieldOfStudy: "Education",
          startDate: "2014",
          endDate: "2018",
        },
      ]),
      section("skills", "Skills", [
        { name: "Curriculum planning", level: "Advanced" },
        { name: "Student assessment", level: "Advanced" },
        { name: "Classroom management", level: "Advanced" },
        { name: "IEP collaboration", level: "Intermediate" },
        { name: "Instructional design", level: "Advanced" },
      ]),
      section("certifications", "Certifications", [
        {
          certificationName: "State Teaching Credential",
          issuingOrganization: "Washington State",
          issueDate: "2020",
          credentialId: "WA-123",
        },
      ]),
    ],
  };
}

describe("evaluateCvAtsAudit", () => {
  it("returns a high score and no blockers for an excellent CV", () => {
    const result = evaluateCvAtsAudit({
      cv: excellentCv(),
      pageCount: 1,
      importIssueCount: 0,
    });

    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.verdict).toBe("excellent");
    expect(result.blockers).toEqual([]);
    expect(result.priorityFixes).toEqual([]);
  });

  it("uses editable sections as content evidence when the trusted export model is missing", () => {
    const cv = excellentCv();
    cv.metadata.authoritativeResume = {
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: false,
      normalized: null,
    };

    const result = evaluateCvAtsAudit({ cv, pageCount: 1, importIssueCount: 0 });

    expect(result.categoryScores.parsing).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.verdict).toBe("good");
    expect(result.blockers).toEqual([]);
    expect(result.issues.parsing).toEqual([
      expect.objectContaining({
        id: "missing-trusted-export-model",
        priority: "high",
      }),
    ]);
    const contentIssueIds = result.issues.content.map((issue) => issue.id);
    expect(contentIssueIds).not.toContain("missing-profile-name");
    expect(contentIssueIds).not.toContain("missing-contact-method");
    expect(contentIssueIds).not.toContain("missing-experience-data");
    expect(contentIssueIds).not.toContain("missing-education-data");
    expect(result.issues.sections.map((issue) => issue.id)).not.toContain(
      "missing-skills",
    );
  });

  it("creates an issue when contact methods are missing", () => {
    const cv = excellentCv({
      profile: {
        name: "Jessica Claire",
        desiredPosition: "Middle School Teacher",
        location: "San Francisco, CA",
      },
    });

    const result = evaluateCvAtsAudit({ cv, pageCount: 1, importIssueCount: 0 });

    expect(result.issues.content.map((issue) => issue.id)).toContain(
      "missing-contact-method",
    );
  });

  it("creates an issue when experience dates are incomplete", () => {
    const cv = excellentCv({
      experience: [
        {
          company: "Spring Education Group",
          position: "Middle School Language Arts Teacher",
          responsibilityBullets: ["Taught inclusive language arts classes."],
        },
      ],
    });

    const result = evaluateCvAtsAudit({ cv, pageCount: 1, importIssueCount: 0 });

    expect(result.issues.content.map((issue) => issue.id)).toContain(
      "experience-dates-0",
    );
  });

  it("creates an issue when skills are missing", () => {
    const cv = excellentCv({ skills: [] });
    cv.sections = cv.sections.filter((section) => section.type !== "skills");

    const result = evaluateCvAtsAudit({ cv, pageCount: 1, importIssueCount: 0 });

    expect(result.issues.sections.map((issue) => issue.id)).toContain(
      "missing-section-skills",
    );
    expect(result.issues.sections.map((issue) => issue.id)).toContain(
      "missing-skills",
    );
  });

  it("recognizes certifications as structured content when present", () => {
    const result = evaluateCvAtsAudit({
      cv: excellentCv(),
      pageCount: 1,
      importIssueCount: 0,
    });

    expect(result.issues.content.map((issue) => issue.id)).not.toContain(
      "certification-detail-0",
    );
    expect(result.categoryScores.content).toBe(100);
  });

  it("creates a layout issue when page count is greater than one", () => {
    const result = evaluateCvAtsAudit({
      cv: excellentCv(),
      pageCount: 2,
      importIssueCount: 0,
    });

    expect(result.issues.layout.map((issue) => issue.id)).toContain(
      "layout-page-count",
    );
    expect(result.categoryScores.layout).toBeLessThan(100);
  });

  it("creates a blocker for unresolved import issues", () => {
    const result = evaluateCvAtsAudit({
      cv: excellentCv(),
      pageCount: 1,
      importIssueCount: 2,
    });

    expect(result.verdict).toBe("blocked");
    expect(result.blockers.map((issue) => issue.id)).toContain(
      "unresolved-import-review",
    );
    expect(result.priorityFixes.map((issue) => issue.id)).toContain(
      "unresolved-import-review",
    );
  });

  it("keeps keywords neutral when no job text is provided", () => {
    const result = evaluateCvAtsAudit({
      cv: excellentCv(),
      pageCount: 1,
      importIssueCount: 0,
    });

    expect(result.categoryScores.keywords).toBe(100);
    expect(result.issues.keywords).toEqual([]);
  });
});
