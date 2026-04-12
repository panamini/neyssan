import { describe, expect, it } from "vitest";

import { buildCanonicalizeInput } from "../structuredUpload";
import { canonicalizeParserResult } from "../../lib/parsing/canonicalize";

describe("buildCanonicalizeInput", () => {
  it("preserves top-level sections for Farman app-side fallback recovery", () => {
    const payload = {
      sections: [
        {
          label: "BODY",
          content:
            "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        },
      ],
      rawSections: [
        {
          label: "EXPERIENCE",
          content:
            "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
            "Jan 1, 2016",
        },
      ],
      result: {
        normalized: {
          experience: [],
        },
      },
    } as any;

    const canonicalizeInput = buildCanonicalizeInput(payload);
    expect(canonicalizeInput.sections).toEqual(payload.sections);
    expect(canonicalizeInput.normalized?.sections).toEqual(payload.sections);

    const normalizedResult = canonicalizeParserResult(canonicalizeInput, {
      rawText: "",
      mode: "auto",
      parserUrl: "test://parser",
    });

    const experience = (normalizedResult.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
  });

  it("keeps normalized.sections as the canonical source for copied convenience arrays", () => {
    const payload = {
      sections: [
        { label: "EXPERIENCE", content: "legacy raw section that should not win" },
      ],
      result: {
        normalized: {
          experience: [],
          education: [],
          skills: [],
          sections: [
            {
              id: "sec-experience",
              title: "Experience",
              type: "experience",
              blocks: [],
              structuredContent: [
                {
                  id: "exp-1",
                  company: "Rendered Company",
                  position: "Rendered Role",
                  startDate: "2021-01-01",
                },
              ],
            },
            {
              id: "sec-education",
              title: "Education",
              type: "education",
              blocks: [],
              structuredContent: [
                {
                  id: "edu-1",
                  institution: "Rendered School",
                },
              ],
            },
            {
              id: "sec-skills",
              title: "Skills",
              type: "skills",
              blocks: [],
              structuredContent: [
                { id: "skill-1", name: "Python", level: "Advanced" },
              ],
            },
            {
              id: "sec-summary",
              title: "Summary",
              type: "summary",
              blocks: [],
              structuredContent: [
                {
                  id: "sum-1",
                  summary: "Rendered summary",
                },
              ],
            },
          ],
        },
      },
    } as any;

    const canonicalizeInput = buildCanonicalizeInput(payload);
    const normalizedResult = canonicalizeParserResult(canonicalizeInput, {
      rawText: "",
      mode: "auto",
      parserUrl: "test://parser",
    });

    const normalized = normalizedResult.normalized as any;
    expect(normalized.experience).toHaveLength(1);
    expect(normalized.experience[0]?.company).toBe("Rendered Company");
    expect(normalized.education).toHaveLength(1);
    expect(normalized.education[0]?.institution).toBe("Rendered School");
    expect(normalized.skills).toHaveLength(1);
    expect(normalized.skills[0]?.name).toBe("Python");
    expect(normalized.summary?.text).toBe("Rendered summary");
  });
});
