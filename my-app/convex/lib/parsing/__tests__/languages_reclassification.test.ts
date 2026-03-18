import { migrateLanguagesToEducation } from "../normalize_cv";
import type { ICVObject } from "../cvMapper";

function buildCvFixture(overrides: Partial<ICVObject> = {}): ICVObject {
  const base: ICVObject = {
    name: null,
    contact: {},
    summary: null,
    experience: [],
    education: [],
    skills: null,
    languages: null,
    languagesRaw: null,
    achievements: null,
    projects: [],
    research: [],
    volunteer: [],
    references: [],
    other: [],
    raw: null,
    rawSections: null,
  };
  return { ...base, ...overrides };
}

describe("migrateLanguagesToEducation", () => {
  it("moves degree-like tokens from languages into education", () => {
    const cv = buildCvFixture({
      languages: { text: "English, Spanish, Certified Protection Guard Program", confidence: 0.7 },
      languagesRaw: ["Certified Protection Guard Program", "English", "Spanish"],
    });

    migrateLanguagesToEducation(cv);

    expect(cv.languages?.text).toBe("English, Spanish");
    expect(cv.languagesRaw).toEqual(["English", "Spanish"]);
    expect(cv.education).toHaveLength(1);
    expect(cv.education?.[0].content.toLowerCase()).toContain("certified protection guard program");
  });

  it("moves month/year range tokens into education", () => {
    const cv = buildCvFixture({
      languages: { text: "German, April 2022 — April 2022", confidence: 0.6 },
      languagesRaw: ["April 2022 — April 2022", "German"],
    });

    migrateLanguagesToEducation(cv);
    migrateLanguagesToEducation(cv); // ensure idempotency

    expect(cv.languages?.text).toBe("German");
    expect(cv.languagesRaw).toEqual(["German"]);
    expect(cv.education).toHaveLength(1);
    expect(cv.education?.[0].content).toContain("April 2022 — April 2022");
  });
});
