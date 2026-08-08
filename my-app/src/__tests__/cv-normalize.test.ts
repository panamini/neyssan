import { describe, it, expect } from "vitest";
import { generateCvTemplate } from "../lib/cv-template";
import {
  ensureRepresentativeBlocks,
  normalizeAndValidateCvDocument,
} from "../lib/normalize-cv";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

describe("Representative block stability", () => {
  it("reconstructs stripped structured blocks with stable ids and remains idempotent", () => {
    const remoteDocument = {
      id: "cv-remote-round-trip",
      title: "Remote round trip",
      metadata: {
        createdAt: "2026-08-08T00:00:00.000Z",
        updatedAt: "2026-08-08T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience-section",
          title: "Experience",
          type: "experience" as const,
          blocks: [],
          structuredContent: [
            {
              id: "experience-item",
              company: "Acme",
              position: "Lead",
              startDate: "2024-01-01T00:00:00.000Z",
              endDate: null,
            },
          ],
        },
        {
          id: "achievements-section",
          title: "Achievements",
          type: "achievements" as const,
          blocks: [],
          structuredContent: [
            {
              id: "achievement-item",
              text: "Reduced processing time by 40%",
            },
          ],
        },
      ],
    };

    const first = ensureRepresentativeBlocks(remoteDocument);
    const secondFromRemote = ensureRepresentativeBlocks(remoteDocument);
    const secondFromHydrated = ensureRepresentativeBlocks(first);

    expect(secondFromRemote.sections).toEqual(first.sections);
    expect(secondFromHydrated).toBe(first);
  });
});

 // Legacy suite: retained for reference; superseded by v1 precision-aware tests and parser→normalizer flows.
describe.skip("CV template and normalizer (legacy suite — skipped)", () => {
  it("generateCvTemplate produces a strict CvDocument", () => {
    const doc = generateCvTemplate("Test CV");
    expect(() => parseCvDocumentStrict(doc)).not.toThrow();
  });

  it("normalizeAndValidateCvDocument normalizes minimal object into strict CvDocument", () => {
    const res = normalizeAndValidateCvDocument({}, "Imported CV");
    expect(res.success).toBe(true);
    if (res.success) expect(() => parseCvDocumentStrict(res.document)).not.toThrow();
  });

  it("normalizeAndValidateCvDocument treats null as an empty document and returns a template", () => {
    // Current normalizer behavior: treat null/undefined as an empty/placeholder document
    // and produce a valid template (caller may prefer this resilient behavior).
    const res = normalizeAndValidateCvDocument(null);
    expect(res.success).toBe(true);
    if (res.success) expect(() => parseCvDocumentStrict(res.document)).not.toThrow();
  });

  it("synthesizes summary blocks when structuredContent is present and blocks are missing", () => {
    const input = {
      title: "CV with summary",
      sections: [
        {
          type: "summary",
          // structuredContent could be an object of profile fields
          structuredContent: {
            id: "profile-1",
            name: "Alice Example",
            email: "alice@example.com",
            summary: "Experienced engineer",
          },
        },
      ],
    };
    const res = normalizeAndValidateCvDocument(input, "CV with summary");
    expect(res.success).toBe(true);
    if (!res.success) return;
    const doc = res.document;
    const summarySection = doc.sections.find((s) => (s as any).type === "summary");
    expect(summarySection).toBeDefined();
    if (!summarySection) return;
    const blocks = (summarySection as any).blocks ?? [];
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
    // At least one block should carry a linkedStructuredId attribute pointing to a summary id
    const hasLinked = blocks.some((b: any) => Boolean(b?.attributes?.linkedStructuredId));
    expect(hasLinked).toBe(true);
  });

  it("generates one representative block per education structured item when blocks are missing", () => {
    const input = {
      title: "CV with education",
      sections: [
        {
          type: "education",
          structuredContent: [
            { id: "edu-1", institution: "University A", description: "Studied X" },
            { id: "edu-2", institution: "College B", description: "Studied Y" },
          ],
          // intentionally no blocks to trigger synthesis
        },
      ],
    };
    const res = normalizeAndValidateCvDocument(input, "CV with education");
    expect(res.success).toBe(true);
    if (!res.success) return;
    const doc = res.document;
    const eduSection = doc.sections.find((s) => (s as any).type === "education");
    expect(eduSection).toBeDefined();
    if (!eduSection) return;
    const blocks = (eduSection as any).blocks ?? [];
    expect(Array.isArray(blocks)).toBe(true);
    // Expect number of generated blocks to equal number of structured entries
    expect(blocks.length).toBe(2);
    const linkedIds = blocks.map((b: any) => b?.attributes?.linkedStructuredId);
    expect(linkedIds).toEqual(expect.arrayContaining(["edu-1", "edu-2"]));
  });

  it("preserves date precision and Present semantics for experience", () => {
    const input = {
      title: "CV with experience",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-1", company: "Acme", position: "Dev", startDate: "2021", endDate: "2022-05" },
            { id: "exp-2", company: "Beta", position: "Lead", startDate: "2023-01", isCurrent: true },
          ],
        },
      ],
    };
    const res = normalizeAndValidateCvDocument(input, "CV with experience");
    expect(res.success).toBe(true);
    if (!res.success) return;
    const doc = res.document as any;
    const expSection = doc.sections.find((s: any) => s.type === "experience");
    expect(expSection).toBeDefined();
    const items = expSection.structuredContent as any[];
    expect(items).toHaveLength(2);

    const a = items[0];
    expect(typeof a.startDate).toBe("string");
    expect(a.startDatePrecision).toBe("year");
    expect(typeof a.endDate).toBe("string");
    expect(a.endDatePrecision).toBe("month");
    expect(a.isCurrent ?? a.currentlyWorking).not.toBe(true);

    const b = items[1];
    expect(typeof b.startDate).toBe("string");
    expect(b.startDatePrecision).toBe("month");
    expect(b.isCurrent === true || b.currentlyWorking === true).toBe(true);
    expect(b.endDate).toBeNull(); // Present -> null endDate
    expect(b.endDatePrecision).toBeUndefined();
  });

  it("does not infer Present from empty end date when toggle is off", () => {
    const input = {
      title: "CV with unknown end date",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-1", company: "Acme", position: "Dev", startDate: "2020-01", endDate: "" }, // unknown end date
          ],
        },
      ],
    };
    const res = normalizeAndValidateCvDocument(input, "CV unknown end");
    expect(res.success).toBe(true);
    if (!res.success) return;
    const doc = res.document as any;
    const expSection = doc.sections.find((s: any) => s.type === "experience");
    const item = (expSection.structuredContent as any[])[0];
    // Our normalizer drops unparsable endDate -> null if legacy provided falsy? end remains null or undefined
    // But since isCurrent is not set, this is "unknown", not Present (no isCurrent flag)
    expect(item.isCurrent).toBeUndefined();
  });
});

describe("CV auto-title normalization", () => {
  it("derives imported title from profile name and desired position when no explicit title exists", () => {
    const res = normalizeAndValidateCvDocument({
      sections: [
        {
          type: "profile",
          structuredContent: [
            {
              id: "profile-1",
              name: "Jane Doe",
              desiredPosition: "Product Manager",
              email: "jane@example.com",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.document.title).toBe("Jane Doe — Product Manager");
  });

  it("treats placeholder explicit titles as replaceable when profile metadata exists", () => {
    const res = normalizeAndValidateCvDocument({
      title: "Untitled CV",
      sections: [
        {
          type: "profile",
          structuredContent: [
            {
              id: "profile-1",
              name: "Aurelien",
              desiredPosition: "Software Engineer",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.document.title).toBe("Aurelien — Software Engineer");
  });

  it("keeps an explicit incoming title unchanged", () => {
    const res = normalizeAndValidateCvDocument({
      title: "My Custom CV",
      sections: [
        {
          type: "profile",
          structuredContent: [
            {
              id: "profile-1",
              name: "Jane Doe",
              desiredPosition: "Product Manager",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.document.title).toBe("My Custom CV");
  });

  it("falls back to desired position, then email, then generic title", () => {
    const roleOnly = normalizeAndValidateCvDocument({
      sections: [
        {
          type: "profile",
          structuredContent: [{ id: "profile-1", desiredPosition: "Marketing Manager" }],
        },
      ],
    });
    expect(roleOnly.success).toBe(true);
    if (roleOnly.success) {
      expect(roleOnly.document.title).toBe("Marketing Manager");
    }

    const emailOnly = normalizeAndValidateCvDocument({
      sections: [
        {
          type: "profile",
          structuredContent: [{ id: "profile-1", email: "jane@example.com" }],
        },
      ],
    });
    expect(emailOnly.success).toBe(true);
    if (emailOnly.success) {
      expect(emailOnly.document.title).toBe("jane@example.com");
    }

    const empty = normalizeAndValidateCvDocument({});
    expect(empty.success).toBe(true);
    if (empty.success) {
      expect(empty.document.title).toBe("Imported CV");
    }

    const noMetadataWithFilenameFallback = normalizeAndValidateCvDocument({}, "resume.pdf");
    expect(noMetadataWithFilenameFallback.success).toBe(true);
    if (noMetadataWithFilenameFallback.success) {
      expect(noMetadataWithFilenameFallback.document.title).toBe("Imported CV");
    }
  });
});

describe("Structured recovery normalization", () => {
  it("normalizes certification structured items and keeps the section strict-safe", () => {
    const res = normalizeAndValidateCvDocument({
      title: "Credential CV",
      sections: [
        {
          type: "certifications",
          title: "Certifications",
          structuredContent: [
            {
              certificationName: "AWS Certified Developer",
              issuingOrganization: "Amazon Web Services",
              issueDate: "2024-04-01",
              expirationDate: null,
              credentialId: "AWS-123",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    const section = res.document.sections.find((entry) => entry.type === "certifications");
    expect(section?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          certificationName: "AWS Certified Developer",
          issuingOrganization: "Amazon Web Services",
          credentialId: "AWS-123",
        }),
      ]),
    );
    expect(section?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributes: expect.objectContaining({ linkedStructuredId: expect.any(String) }),
        }),
      ]),
    );
  });

  it("normalizes affiliation text sections with structured membership items", () => {
    const res = normalizeAndValidateCvDocument({
      title: "Membership CV",
      sections: [
        {
          type: "text",
          title: "Affiliations",
          structuredContent: [
            {
              organizationName: "IEEE",
              roleOrMembershipType: "Member",
              startDate: "2022-01-01",
              isCurrent: true,
              notes: "Professional chapter member",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    const section = res.document.sections.find(
      (entry) => entry.type === "text" && entry.title === "Affiliations",
    );
    expect(section?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationName: "IEEE",
          roleOrMembershipType: "Member",
          isCurrent: true,
        }),
      ]),
    );
  });

  it("preserves import recovery session metadata for reopened recovery cycles", () => {
    const res = normalizeAndValidateCvDocument({
      title: "Recovered CV",
      metadata: {
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
        version: 1,
        importRecoverySession: {
          status: "completed",
          updatedAt: "2026-04-08T10:00:00.000Z",
          overflowCount: 0,
          reviewLimit: 12,
          items: [
            {
              blockId: "recovery-1",
              rawText: "Recovered text",
              cleanedText: "Recovered text",
              displayTextSource: "cleaned",
              predictedSection: "summary",
              confidenceScore: "low",
              confidenceValue: 0.32,
              issueFlags: ["weakSectionMatch"],
              reviewStatus: "accepted",
              selectedSection: "summary",
              fragmentAssignments: [],
            },
          ],
          baseSectionsSnapshot: [
            {
              id: "summary-1",
              title: "Summary",
              type: "summary",
              blocks: [],
              structuredContent: [
                {
                  id: "summary-item-1",
                  summary: {
                    type: "doc",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Baseline summary" }],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      sections: [
        {
          id: "summary-1",
          title: "Summary",
          type: "summary",
          blocks: [],
          structuredContent: [
            {
              id: "summary-item-1",
              summary: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Recovered summary" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.document.metadata.importRecoverySession).toEqual(
      expect.objectContaining({
        status: "completed",
        items: expect.arrayContaining([
          expect.objectContaining({ blockId: "recovery-1" }),
        ]),
        baseSectionsSnapshot: expect.arrayContaining([
          expect.objectContaining({ title: "Summary" }),
        ]),
      }),
    );
  });

  it("accepts structured project items during strict normalization", () => {
    const res = normalizeAndValidateCvDocument({
      id: "cv-projects",
      title: "Projects CV",
      metadata: {
        createdAt: "2026-04-11T09:00:00.000Z",
        updatedAt: "2026-04-11T09:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "projects-1",
          title: "Projects",
          type: "projects",
          blocks: [
            {
              id: "block-1",
              title: "Gitlytics",
              type: "text",
              content: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Python, Flask, React | June 2020 – Present",
                      },
                    ],
                  },
                ],
              },
              attributes: { linkedStructuredId: "project-1" },
            },
          ],
          structuredContent: [
            {
              id: "project-1",
              title: "Gitlytics",
              meta: "Python, Flask, React | June 2020 – Present",
              description: "Built a full-stack web application.",
            },
          ],
        },
      ],
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    const section = res.document.sections.find((entry) => entry.type === "projects");
    expect(section?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Gitlytics",
          meta: "Python, Flask, React | June 2020 – Present",
          description: "Built a full-stack web application.",
        }),
      ]),
    );
  });
});
