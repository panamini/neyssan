import { describe, expect, it } from "vitest";

import {
  CvDocumentSchemaStrict,
  SkillItemSchemaStrict,
} from "../cvDocument.schema";

describe("cvDocument skill categories schema", () => {
  it("round-trips skillCategories and categoryId in strict parsing", () => {
    expect(
      SkillItemSchemaStrict.parse({
        id: "skill-1",
        name: "Design systems",
        level: "Advanced",
        bucket: "core",
        categoryId: "cat-design",
      }),
    ).toMatchObject({
      categoryId: "cat-design",
      bucket: "core",
    });

    const parsed = CvDocumentSchemaStrict.parse({
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
          skillCategories: [
            { id: "cat-design", label: "Design", source: "user" },
          ],
          structuredContent: [
            {
              id: "skill-1",
              name: "Design systems",
              level: "Advanced",
              bucket: "core",
              categoryId: "cat-design",
            },
          ],
        },
      ],
    });

    expect(parsed.sections[0]?.skillCategories?.[0]).toEqual({
      id: "cat-design",
      label: "Design",
      source: "user",
    });
    expect((parsed.sections[0]?.structuredContent as any[])?.[0]?.categoryId).toBe(
      "cat-design",
    );
  });
});
