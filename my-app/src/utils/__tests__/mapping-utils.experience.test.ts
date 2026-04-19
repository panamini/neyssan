import { describe, expect, it } from "vitest";
import { buildTypedSectionsFromNormalized } from "../cv/mapping-utils";

describe("buildTypedSectionsFromNormalized experience", () => {
  it("preserves responsibilityBullets arrays from canonical input", () => {
    const sections = buildTypedSectionsFromNormalized({
      experience: [
        {
          id: "exp-1",
          company: "ACME",
          position: "Engineer",
          responsibilityBullets: ["Built internal tooling", "Mentored junior developers"],
          achievements: ["Reduced runtime by 30%"],
        },
      ],
    } as any);

    const experienceSection = sections.find((section) => section.type === "experience");
    expect(experienceSection).toBeTruthy();
    const structured = (experienceSection?.structuredContent ?? [])[0] as any;
    expect(structured).toBeTruthy();
    expect(structured.responsibilityBullets).toEqual([
      "Built internal tooling",
      "Mentored junior developers",
    ]);
    expect(typeof structured.responsibilities).toBe("string");
    expect(String(structured.responsibilities)).toContain("Built internal tooling");
  });

  it("does not resurrect cached bullets when responsibilities are explicitly empty", () => {
    const sections = buildTypedSectionsFromNormalized({
      experience: [
        {
          id: "exp-3",
          company: "Example",
          position: "Lead",
          responsibilities: "",
          responsibilityBullets: ["Stale cached bullet"],
        },
      ],
    } as any);

    const experienceSection = sections.find((section) => section.type === "experience");
    const structured = (experienceSection?.structuredContent ?? [])[0] as any;
    expect(structured.responsibilities).toBeNull();
    expect(structured.responsibilityBullets).toBeUndefined();
  });

  it("derives responsibilityBullets from newline and bullet-delimited text", () => {
    const sections = buildTypedSectionsFromNormalized({
      experience: [
        {
          id: "exp-2",
          company: "Example",
          position: "Lead",
          responsibilities: "• Automated release workflows\nIncreased coverage by 25%.",
        },
      ],
    } as any);

    const experienceSection = sections.find((section) => section.type === "experience");
    const structured = (experienceSection?.structuredContent ?? [])[0] as any;
    expect(structured.responsibilityBullets).toEqual([
      "Automated release workflows",
      "Increased coverage by 25%",
    ]);
  });
});
