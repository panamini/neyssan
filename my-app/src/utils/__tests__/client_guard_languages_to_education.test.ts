import { describe, expect, it } from "vitest";
import { buildTypedSectionsFromNormalized } from "../cv/mapping-utils";

describe("client languages to education safeguard", () => {
  it("moves degree-like tokens into education when backend omitted entries", () => {
    const sections = buildTypedSectionsFromNormalized({
      education: [],
      languagesText: "English, Certified Protection Guard Program (CPOP)",
      languagesRaw: [
        "Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria",
        "English",
      ],
    });

    const educationSection = sections.find((section) => section.type === "education");
    const languagesSection = sections.find((section) => section.type === "languages");

    expect(educationSection).toBeTruthy();
    expect((educationSection!.structuredContent ?? []).length).toBeGreaterThan(0);
    const degrees = (educationSection!.structuredContent ?? []).map((item: any) => item.degree || "");
    expect(degrees[0]).toContain("Certified Protection Guard Program");

    expect(languagesSection).toBeTruthy();
    const languageNames = (languagesSection!.structuredContent ?? []).map((item: any) => item.name);
    expect(languageNames).toEqual(["English"]);
  });
});
