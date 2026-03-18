import { describe, expect, it } from "vitest";
import { migrateLanguagesToEducation } from "../normalize_cv";
import type { ICVObject } from "../cvMapper";
import { buildTypedSectionsFromNormalized } from "../../../../src/utils/cv/mapping-utils";

const buildCv = (): ICVObject => ({
  name: null,
  contact: {},
  summary: null,
  experience: [],
  education: [],
  skills: null,
  languages: {
    text: "English, Spanish, Certified Protection Guard Program (CPOP), April 2022 — April 2022",
    confidence: 0.8,
  },
  languagesRaw: [
    "Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria",
    "April 2022 — April 2022",
    "English",
    "Spanish",
  ],
  achievements: null,
  projects: [],
  research: [],
  volunteer: [],
  references: [],
  other: [],
  raw: null,
  rawSections: null,
});

describe("languages to education migration end-to-end", () => {
  it("places migrated education tokens into sections", () => {
    const cv = buildCv();
    migrateLanguagesToEducation(cv);

    const normalized = {
      education: (cv.education ?? []).map((item) => ({ degree: item.content })),
      languagesText: cv.languages?.text ?? "",
      languagesRaw: cv.languagesRaw ?? [],
    } as any;

    const sections = buildTypedSectionsFromNormalized(normalized);
    const educationSection = sections.find((section) => section.type === "education");
    const languagesSection = sections.find((section) => section.type === "languages");

    expect(educationSection).toBeTruthy();
    const degrees = (educationSection!.structuredContent ?? []).map((item: any) => item.degree || "");
    expect(degrees).toContain(
      "Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria",
    );
    expect(degrees).toContain("April 2022 — April 2022");

    expect(languagesSection).toBeTruthy();
    const languageNames = (languagesSection!.structuredContent ?? []).map((item: any) => item.name);
    expect(languageNames).toEqual(["English", "Spanish"]);
  });

  it("is idempotent across repeated builds", () => {
    const cv = buildCv();
    migrateLanguagesToEducation(cv);

    const normalized = {
      education: (cv.education ?? []).map((item) => ({ degree: item.content })),
      languagesText: cv.languages?.text ?? "",
      languagesRaw: cv.languagesRaw ?? [],
    } as any;

    const sectionsFirst = buildTypedSectionsFromNormalized(normalized);
    const sectionsSecond = buildTypedSectionsFromNormalized(normalized);

    const getSnapshot = (sections: any[]) => {
      const education = sections.find((section) => section.type === "education")?.structuredContent ?? [];
      const languages = sections.find((section) => section.type === "languages")?.structuredContent ?? [];
      return {
        educationDegrees: education.map((item: any) => item.degree),
        languageNames: languages.map((item: any) => item.name),
      };
    };

    expect(getSnapshot(sectionsFirst)).toEqual(getSnapshot(sectionsSecond));
  });
});
