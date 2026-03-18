import { describe, it, expect } from "vitest";
import { generateCvTemplate } from "../lib/cv-template";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

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
