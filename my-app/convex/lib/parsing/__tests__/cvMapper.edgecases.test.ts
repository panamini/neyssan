// my-app/convex/lib/parsing/__tests__/cvMapper.edgecases.test.ts
import { describe, it, expect } from "vitest";
import { mapSectionsToCV } from "../cvMapper";

describe("mapSectionsToCV edge cases", () => {
  it("merges multi-language lists from different section formats", () => {
    const sections = [
      { title: "Languages", content: "English, Français, Español", fieldKey: "languages", confidence: 0.9 },
      { title: "Langues", content: "Deutsch\nItaliano", fieldKey: "languages", confidence: 0.8 }
    ] as any;

    const cv = mapSectionsToCV(sections, {});

    expect(cv.languages).not.toBeNull();
    // canonicalized (English) names must appear in the joined text
    expect(cv.languages?.text).toContain("English");
    expect(cv.languages?.text).toContain("French");
    expect(cv.languages?.text).toContain("German");
    // we also preserve original/raw tokens for localized spellings
    expect(cv.languagesRaw).not.toBeNull();
    expect(cv.languagesRaw?.includes("Français")).toBeTruthy();
    expect(cv.languagesRaw?.includes("Deutsch")).toBeTruthy();
    // confidence averaged
    expect(cv.languages?.confidence).toBeCloseTo((0.9 + 0.8) / 2, 5);
  });

  it("aggregates fragmented contact info across multiple contact sections", () => {
    const sections = [
      { title: "Contact - email", content: "Email: foo.bar@example.com", fieldKey: "contact", confidence: 0.6 },
      { title: "Contact - phone", content: "Phone: +33123456789", fieldKey: "contact", confidence: 0.7 },
      { title: "Contact - link", content: "LinkedIn: https://linkedin.com/in/foobar", fieldKey: "contact", confidence: 0.5 }
    ] as any;

    const cv = mapSectionsToCV(sections, { name: "Foo Bar" });

    expect(cv.contact?.email).toBe("foo.bar@example.com");
    expect(cv.contact?.phone).toBe("+33123456789");
    expect(cv.contact?.linkedinUrl).toBe("https://linkedin.com/in/foobar");
    expect(cv.name).toBe("Foo Bar");
  });

  it("computes average confidence for low-confidence merged singular fields", () => {
    const sections = [
      { title: "Summary A", content: "A brief intro A.", fieldKey: "summary", confidence: 0.2 },
      { title: "Summary B", content: "A brief intro B.", fieldKey: "summary", confidence: 0.3 }
    ] as any;

    const cv = mapSectionsToCV(sections, {});

    expect(cv.summary).not.toBeNull();
    expect(cv.summary?.text).toContain("A brief intro A");
    expect(cv.summary?.text).toContain("A brief intro B");
    expect(cv.summary?.confidence).toBeCloseTo((0.2 + 0.3) / 2, 5);
  });

  it("places unknown fieldKeys into other bucket", () => {
    const sections = [
      { title: "Hobbies", content: "Chess, Hiking", fieldKey: "hobbies", confidence: 0.8 }
    ] as any;

    const cv = mapSectionsToCV(sections, {});

    expect(cv.other.length).toBeGreaterThan(0);
    expect(cv.other[0].content).toContain("Chess");
  });
});