import { describe, expect, it } from "vitest";

import type { CvDocument } from "../../../types/cvDocument";
import { buildCandidateCvItemReferences } from "../cvItemReferences";

const BASE_CV: CvDocument = {
  id: "cv-source-1",
  title: "Source CV",
  metadata: {
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "section-experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: [
        {
          id: "exp-bakery",
          company: "Bakery One",
          position: "Sales associate",
          startDate: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "exp-service",
          company: "Service Two",
          position: "Customer service associate",
          startDate: "2022-01-01T00:00:00.000Z",
        },
      ],
    },
    {
      id: "section-education",
      title: "Education",
      type: "education",
      blocks: [],
      structuredContent: [
        {
          id: "edu-commerce",
          institution: "Lycée Example",
          degree: "Commerce",
        },
      ],
    },
    {
      id: "section-skills",
      title: "Skills",
      type: "skills",
      blocks: [],
      structuredContent: [
        {
          id: "skill-customer-service",
          name: "Customer service",
          level: "Advanced",
        },
        {
          id: "skill-checkout",
          name: "Checkout",
          level: "Intermediate",
        },
      ],
    },
  ],
};

describe("candidate CV item references", () => {
  it("keeps source paths distinct when stable ids resemble encoded delimiters", () => {
    const collisionCv: CvDocument = {
      ...BASE_CV,
      sections: [
        {
          ...BASE_CV.sections[0],
          structuredContent: [
            {
              id: "item/a",
              company: "Bakery One",
              position: "Sales associate",
              startDate: "2024-01-01T00:00:00.000Z",
            },
            {
              id: "item_2f_a",
              company: "Service Two",
              position: "Customer service associate",
              startDate: "2022-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    };

    const references = buildCandidateCvItemReferences(collisionCv);

    expect(references).toHaveLength(2);
    expect(new Set(references.map((reference) => reference.sourcePath)).size).toBe(
      2,
    );
  });

  it("keeps experience, education, and skill references stable across reorder and normal edits", () => {
    const before = buildCandidateCvItemReferences(BASE_CV);
    const editedAndReordered: CvDocument = {
      ...BASE_CV,
      sections: BASE_CV.sections.map((section) => {
        if (section.type === "experience") {
          const items = [...(section.structuredContent ?? [])] as Array<
            Record<string, unknown>
          >;
          return {
            ...section,
            structuredContent: [
              {
                ...items[1],
                position: "Senior customer service associate",
              },
              items[0],
            ] as typeof section.structuredContent,
          };
        }
        if (section.type === "skills") {
          const items = [...(section.structuredContent ?? [])];
          return {
            ...section,
            structuredContent: [items[1], items[0]] as typeof section.structuredContent,
          };
        }
        return section;
      }),
    };

    const after = buildCandidateCvItemReferences(editedAndReordered);

    expect(after.map((reference) => reference.id).sort()).toEqual(
      before.map((reference) => reference.id).sort(),
    );
    expect(
      after.find((reference) => reference.itemId === "exp-service"),
    ).toEqual(
      before.find((reference) => reference.itemId === "exp-service"),
    );
    expect(
      after.find((reference) => reference.itemId === "skill-checkout"),
    ).toEqual(
      before.find((reference) => reference.itemId === "skill-checkout"),
    );
  });

  it("does not mutate the source CvDocument", () => {
    const snapshot = JSON.stringify(BASE_CV);

    buildCandidateCvItemReferences(BASE_CV);

    expect(JSON.stringify(BASE_CV)).toBe(snapshot);
  });

  it("fails closed when active canonical item ids are absent instead of using reorder-unstable indexes", () => {
    const legacyCv: CvDocument = {
      ...BASE_CV,
      sections: BASE_CV.sections.map((section) =>
        section.type === "experience"
          ? {
              ...section,
              structuredContent: [
                {
                  company: "Legacy Bakery",
                  position: "Sales associate",
                  startDate: "2020-01-01T00:00:00.000Z",
                },
              ],
            }
          : section,
      ),
    };

    expect(() => buildCandidateCvItemReferences(legacyCv)).toThrow(
      /stable item id.*normalize and persist the source CV first/i,
    );
  });
});
