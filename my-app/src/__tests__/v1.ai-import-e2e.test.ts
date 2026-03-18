import { describe, it, expect } from "vitest";
import { mapAiExperience, mapAiEducation } from "../lib/ai-mapping";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";

describe("v1 E2E: Import from AI → normalizeAndValidateCvDocument → representative blocks", () => {
  it("Experience: mapped items normalize with precision and produce exactly one representative block per item", () => {
    // Simulated AI output (like pasted into Import from AI)
    const aiExp = [
      { company: "Acme", role: "Developer", start: "Jan 2020", end: "Present", responsibilities: "Built things" },
      { company: "Globex", position: "Lead", startDate: "2021-05", endDate: "2022-06", responsibilities: "Led team" },
    ];
    const mapped = mapAiExperience(aiExp);

    // Compose a minimal document with typed experience structuredContent and no blocks
    const candidate = {
      id: "cv-ai-1",
      title: "AI Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-exp",
          title: "Experience",
          type: "experience" as const,
          blocks: [], // representative blocks should be synthesized
          structuredContent: mapped,
        },
      ],
      tags: [],
    };

    const res = normalizeAndValidateCvDocument(candidate);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const cv: any = res.document;
    const exp = cv.sections.find((s: any) => s.type === "experience");
    expect(exp).toBeDefined();

    // Precision and Present assertions reflect ai-mapping + normalizer behavior
    const items: any[] = exp.structuredContent;
    expect(items).toHaveLength(2);

    const a = items[0];
    expect(a.company).toBe("Acme");
    expect(a.position).toBe("Developer");
    expect(a.startDatePrecision).toBe("month");
    expect(a.isCurrent === true || a.currentlyWorking === true).toBe(true);
    expect(a.endDate).toBeNull();
    expect(a.endDatePrecision).toBeUndefined();

    const b = items[1];
    expect(b.company).toBe("Globex");
    expect(b.position).toBe("Lead");
    expect(b.startDatePrecision).toBe("month");
    expect(b.endDatePrecision).toBe("month");

    // Representative blocks: one per structured item, linked via attributes.linkedStructuredId
    const blocks: any[] = exp.blocks;
    expect(blocks.length).toBe(items.length);

    const linkedIds = blocks
      .map((blk) => blk?.attributes?.linkedStructuredId)
      .filter((v: any) => typeof v === "string" && v.trim().length > 0);

    expect(new Set(linkedIds).size).toBe(items.length);
    // Ensure all linked ids exist in structured items
    const itemIds = new Set(items.map((it) => it.id));
    linkedIds.forEach((id) => expect(itemIds.has(id)).toBe(true));
  });

  it("Education: mapped items normalize with precision and produce exactly one representative block per item", () => {
    const aiEdu = [
      { institution: "Uni A", degree: "BSc", fieldOfStudy: "CS", start: "2018", end: "2021", description: "CS bachelor" },
      { institution: "Uni B", degree: "MSc", fieldOfStudy: "AI", startDate: "2022-09", end: "Present", description: "Research" },
    ];
    const mapped = mapAiEducation(aiEdu);

    const candidate = {
      id: "cv-ai-2",
      title: "AI Imported CV (Edu)",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-edu",
          title: "Education",
          type: "education" as const,
          blocks: [], // representative blocks will be synthesized
          structuredContent: mapped,
        },
      ],
      tags: [],
    };

    const res = normalizeAndValidateCvDocument(candidate);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const cv: any = res.document;
    const edu = cv.sections.find((s: any) => s.type === "education");
    expect(edu).toBeDefined();

    const items: any[] = edu.structuredContent;
    expect(items).toHaveLength(2);

    const a = items[0];
    expect(a.institution).toBe("Uni A");
    expect(a.startDatePrecision).toBe("year");
    expect(a.endDatePrecision).toBe("year");

    const b = items[1];
    expect(b.institution).toBe("Uni B");
    expect(b.startDatePrecision).toBe("month");
    expect(b.isCurrent).toBe(true);
    expect(b.endDate).toBeNull();
    expect(b.endDatePrecision).toBeUndefined();

    // Representative blocks
    const blocks: any[] = edu.blocks;
    expect(blocks.length).toBe(items.length);

    const linkedIds = blocks
      .map((blk) => blk?.attributes?.linkedStructuredId)
      .filter((v: any) => typeof v === "string" && v.trim().length > 0);

    expect(new Set(linkedIds).size).toBe(items.length);
    const itemIds = new Set(items.map((it) => it.id));
    linkedIds.forEach((id) => expect(itemIds.has(id)).toBe(true));
  });
});