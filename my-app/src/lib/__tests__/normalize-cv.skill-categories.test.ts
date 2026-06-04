import { describe, expect, it } from "vitest";

import { normalizeAndValidateCvDocument } from "../normalize-cv";

function baseDocument(section: Record<string, unknown>) {
  return {
    id: "cv-1",
    title: "CV",
    metadata: {
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "skills",
        title: "Skills",
        type: "skills",
        blocks: [],
        ...section,
      },
    ],
  };
}

describe("normalize skill categories", () => {
  it("preserves valid categories, dedupes labels, and clears missing category IDs", () => {
    const result = normalizeAndValidateCvDocument(
      baseDocument({
        skillCategories: [
          { id: "cat-design", label: "  Design  ", source: "user" },
          { id: "cat-duplicate", label: "design", source: "ai" },
          { id: "cat-empty", label: " " },
          { id: "cat-data", label: "Data", source: "import", locked: true },
        ],
        structuredContent: [
          {
            id: "skill-1",
            name: "Design systems",
            level: "Advanced",
            bucket: "core",
            categoryId: "cat-design",
          },
          {
            id: "skill-2",
            name: "SQL",
            level: "Intermediate",
            bucket: "secondary",
            categoryId: "missing",
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    const skillsSection = result.document.sections.find(
      (section) => section.type === "skills",
    );
    expect(skillsSection?.skillCategories).toEqual([
      { id: "cat-design", label: "Design", source: "user" },
      { id: "cat-data", label: "Data", source: "import", locked: true },
    ]);
    expect((skillsSection?.structuredContent as any[])?.[0]?.categoryId).toBe(
      "cat-design",
    );
    expect((skillsSection?.structuredContent as any[])?.[1]?.categoryId).toBeUndefined();
  });
});
