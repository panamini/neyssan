import { describe, expect, it } from "vitest";
import { mapParsedToStrict } from "../strictProfileAdapter";
import { mapStrictProfileToCanonical } from "../adapters/CanonicalMapper";
import { CanonicalCVSchema } from "../../../../src/schemas/canonicalCV.schema";

type Section = Parameters<typeof mapParsedToStrict>[0]["parsedSections"][number];

const buildSections = (confidence = 0.85): Section[] => [
  {
    title: "Experience",
    content: "Senior Developer at Acme Corp\nJanuary 2020 — Present\n- Led core product migration",
    fieldKey: "experience",
    confidence,
  },
];

describe("mapStrictProfileToCanonical", () => {
  it("produces a canonical CV with telemetry and confidences", () => {
    const rawText = `
JANE DOE\nSenior Developer\nSan Francisco, CA\n📧 jane@example.com\n☎️ (555) 111-2222\n\nExperience\nSenior Developer at Acme Corp\nJanuary 2020 — Present\n- Led core product migration\n`;

    const strict = mapParsedToStrict({
      rawText,
      parsedSections: buildSections(),
      metadata: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+1 (555) 111-2222",
        linkedinUrl: "https://www.linkedin.com/in/janedoe",
      },
      mappedCv: {
        experience: [
          {
            company: "Acme Corp",
            position: "Senior Developer",
            startDate: "January 2020",
            endDate: "Present",
            isCurrent: true,
            achievements: ["Led core product migration"],
            responsibilities: ["Owns core platform roadmap"],
          },
        ],
      },
    });

    const canonical = mapStrictProfileToCanonical(strict);

    expect(() => CanonicalCVSchema.parse(canonical)).not.toThrow();
    expect(canonical).toMatchSnapshot();
  });

  it("handles empty arrays and missing data gracefully", () => {
    const strict = mapParsedToStrict({
      rawText: "Jane Doe\nEmail: jane@example.com",
      parsedSections: [],
      metadata: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: null,
        linkedinUrl: null,
      },
      mappedCv: null,
    });

    const canonical = mapStrictProfileToCanonical(strict);
    expect(() => CanonicalCVSchema.parse(canonical)).not.toThrow();
    expect(canonical.work).toEqual([]);
    expect(canonical.education).toEqual([]);
    expect(canonical.skills).toEqual([]);
    expect(canonical.languages).toEqual([]);
    expect(canonical.achievements).toEqual([]);
  });
});
