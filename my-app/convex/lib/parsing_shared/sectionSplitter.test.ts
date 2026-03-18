import { describe, it, expect } from "vitest";
import { splitSections } from "./sectionSplitter";

/**
 * Run with:
 *   npx vitest run my-app/convex/lib/parsing_shared/sectionSplitter.test.ts
 */

describe("splitSections", () => {
  it("splits a resume with explicit headings", () => {
    const rawText = `Jane Doe\nEXPERIENCE\nSenior Developer at XYZ Corp\nEDUCATION\nBSc Computer Science\nSKILLS\nTypeScript, React\n`;

    const sections = splitSections(rawText);
    expect(sections).toHaveLength(4);

    const [preface, experience, education, skills] = sections;

    expect(preface.normalizedHeading).toBe("preface");
    expect(preface.text).toBe("Jane Doe");
    expect(rawText.slice(preface.start, preface.end).trim()).toBe(preface.text);

    expect(experience.normalizedHeading).toBe("experience");
    expect(experience.text).toBe("Senior Developer at XYZ Corp");
    expect(rawText.slice(experience.start, experience.end).trim()).toBe(
      `${experience.heading}\n${experience.text}`
    );

    expect(education.normalizedHeading).toBe("education");
    expect(education.text).toBe("BSc Computer Science");
    expect(rawText.slice(education.start, education.end).trim()).toBe(
      `${education.heading}\n${education.text}`
    );

    expect(skills.normalizedHeading).toBe("skills");
    expect(skills.text).toBe("TypeScript, React");
    expect(rawText.slice(skills.start, skills.end).trim()).toBe(
      `${skills.heading}\n${skills.text}`
    );
  });

  it("returns a single PREFACE section when no headings are present", () => {
    const rawText = `Jane Doe\nSeasoned developer with 10+ years in full-stack engineering.`;
    const sections = splitSections(rawText);
    expect(sections).toHaveLength(1);

    const [preface] = sections;
    expect(preface.normalizedHeading).toBe("preface");
    expect(preface.text).toBe(rawText.trim());
    expect(rawText.slice(preface.start, preface.end).trim()).toBe(preface.text);
  });
});
