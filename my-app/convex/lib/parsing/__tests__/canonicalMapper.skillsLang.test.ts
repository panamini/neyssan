import { describe, expect, it } from "vitest";
import { mapParsedToStrict } from "../strictProfileAdapter";
import { mapStrictProfileToCanonical } from "../adapters/CanonicalMapper";
import { CanonicalCVSchema } from "../../../../src/schemas/canonicalCV.schema";

type Section = Parameters<typeof mapParsedToStrict>[0]["parsedSections"][number];

describe("mapStrictProfileToCanonical (skills & languages)", () => {
  it("captures education, skills, and languages with provenance", () => {
    const rawText = `
Jane Doe\nFull Stack Engineer\nSan Francisco, CA\nEmail: jane@example.com\nPhone: +1 555 444 3333\n\nEducation\nStanford University\nB.S. Computer Science\n2014 - 2018\nGPA: 3.8/4.0\n\nSkills\nTypeScript, React, GraphQL, Node.js\n\nLanguages\nEnglish (Native) • Spanish (Professional)\n`;

    const sections: Section[] = [
      {
        title: "Experience",
        content: "Full Stack Engineer at Example Corp\n2019 - Present\n- Built features",
        fieldKey: "experience",
        confidence: 0.85,
      },
      {
        title: "Education",
        content: "Stanford University\nB.S. Computer Science\n2014 - 2018\nGPA: 3.8/4.0",
        fieldKey: "education",
        confidence: 0.7,
      },
      {
        title: "Skills",
        content: "TypeScript, React, GraphQL",
        fieldKey: "skills",
        confidence: 0.65,
      },
      {
        title: "Languages",
        content: "English (Native) • Spanish (Professional)",
        fieldKey: "languages",
        confidence: 0.6,
      },
    ];

    const strict = mapParsedToStrict({
      rawText,
      parsedSections: sections,
      metadata: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+1 555 444 3333",
        linkedinUrl: null,
      },
      mappedCv: {
        experience: [
          {
            company: "Example Corp",
            position: "Full Stack Engineer",
            startDate: "2019",
            endDate: "Present",
            isCurrent: true,
            achievements: ["Built features"],
          },
        ],
        education: [
          {
            title: "Stanford University",
            content: "B.S. Computer Science\n2014 - 2018\nGPA: 3.8/4.0",
            confidence: 0.78,
          },
        ],
        skills: {
          text: "TypeScript, React, Node.js, GraphQL",
          confidence: 0.75,
        },
        languages: {
          text: "English (Native), Spanish (Professional)",
          confidence: 0.72,
        },
      },
    });

    const canonical = mapStrictProfileToCanonical(strict);

    expect(() => CanonicalCVSchema.parse(canonical)).not.toThrow();
    expect(canonical).toMatchSnapshot();
  });
});
