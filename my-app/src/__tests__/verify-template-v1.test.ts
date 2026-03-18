import { describe, it, expect } from "vitest";
import { generateCvTemplateV1 } from "../lib/cv-template";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

describe("generateCvTemplateV1", () => {
  it("produces a schema-valid document with the canonical v1 sections set", () => {
    const cv = generateCvTemplateV1("Test V1 CV");
    // Validate against strict schema (throws on error)
    const parsed = parseCvDocumentStrict(cv);
    expect(parsed).toBeTruthy();

    const types = parsed.sections.map((s) => String((s as any).type));
    // Exact canonical set (order not asserted here)
    const expectedSet = ["profile", "summary", "experience", "education", "skills"];
    // Same length
    expect(types.length).toBe(expectedSet.length);
    // All expected present, and no extras
    expectedSet.forEach((t) => expect(types.includes(t)).toBe(true));
  });

  it("uses canonical v1 section order: profile, summary, experience, education, skills", () => {
    const cv = generateCvTemplateV1("Ordered V1 CV");
    const types = cv.sections.map((s) => String((s as any).type));
    expect(types).toEqual(["profile", "summary", "experience", "education", "skills"]);
  });

  it("links structured items to representative blocks for summary/experience/education", () => {
    const cv = generateCvTemplateV1("Linked V1 CV");

    const findSection = (t: string) => cv.sections.find((s) => String((s as any).type) === t);
    const summary = findSection("summary");
    const experience = findSection("experience");
    const education = findSection("education");

    // Summary: one structured item and one block with attributes.linkedStructuredId matching item.id
    expect(Array.isArray((summary as any)?.structuredContent)).toBe(true);
    const sumItems = (summary as any).structuredContent as Array<{ id: string; summary: unknown }>;
    expect(sumItems.length).toBe(1);
    const sumItemId = String(sumItems[0].id);
    const sumBlocks = (summary as any).blocks as Array<{ attributes?: Record<string, unknown> }>;
    expect(Array.isArray(sumBlocks)).toBe(true);
    expect(sumBlocks.length).toBe(1);
    expect(String((sumBlocks[0].attributes as any)?.linkedStructuredId)).toBe(sumItemId);

    // Experience: one structured item with one representative block linked
    expect(Array.isArray((experience as any)?.structuredContent)).toBe(true);
    const expItems = (experience as any).structuredContent as Array<{ id: string }>;
    expect(expItems.length).toBe(1);
    const expItemId = String(expItems[0].id);
    const expBlocks = (experience as any).blocks as Array<{ attributes?: Record<string, unknown> }>;
    expect(Array.isArray(expBlocks)).toBe(true);
    expect(expBlocks.length).toBe(1);
    expect(String((expBlocks[0].attributes as any)?.linkedStructuredId)).toBe(expItemId);

    // Education: one structured item with one representative block linked
    expect(Array.isArray((education as any)?.structuredContent)).toBe(true);
    const eduItems = (education as any).structuredContent as Array<{ id: string }>;
    expect(eduItems.length).toBe(1);
    const eduItemId = String(eduItems[0].id);
    const eduBlocks = (education as any).blocks as Array<{ attributes?: Record<string, unknown> }>;
    expect(Array.isArray(eduBlocks)).toBe(true);
    expect(eduBlocks.length).toBe(1);
    expect(String((eduBlocks[0].attributes as any)?.linkedStructuredId)).toBe(eduItemId);
  });
});
