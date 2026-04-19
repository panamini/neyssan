import { describe, expect, it } from "vitest";

import { normalizeAndValidateCvDocument } from "../normalize-cv";

describe("normalize-cv responsibility authority", () => {
  it("drops stale cached bullets when responsibilities are explicitly cleared", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv-responsibility-authority",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-1",
              company: "Northline",
              position: "Operations Lead",
              responsibilities: "",
              responsibilityBullets: ["Stale cached bullet"],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find(
      (section) => section.type === "experience",
    );
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];

    expect(normalizedItem?.responsibilities).toBeUndefined();
    expect(normalizedItem?.responsibilityBullets).toBeUndefined();
  });
});
