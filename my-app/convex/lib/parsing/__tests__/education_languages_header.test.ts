import { canonicalizeParserResult } from "../canonicalize";

describe("education extraction strips language headers", () => {
  it("drops stray LANGUAGES header from education entries", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          education: [
            {
              institution: "LANGUAGES Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria",
              degree: "",
              startDate: "2021-01-01",
              endDate: "2022-04-01",
            },
          ],
        },
      },
      {
        rawText: "",
        mode: "text",
        parserUrl: "test://parser",
      },
    );

    const education = (result.normalized as any).education;
    expect(Array.isArray(education)).toBe(true);
    expect(education).not.toHaveLength(0);
    const serialized = [education[0].degree, education[0].institution, education[0].summary]
      .filter(Boolean)
      .join(" ");
    expect(serialized).toContain(
      "Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria",
    );
    expect(education[0].institution).not.toMatch(/^LANGUAGES/i);
  });

  it("recovers multiple education entries from text with LANGUAGES prefix", () => {
    const rawText = `
EDUCATION
LANGUAGES Certified Protection Guard Program (CPOP), International Foundation for Protection Guards, Alexandria
January 2021 — April 2022
LANGUAGES Security Guard Certificate Program (SOCP), ASIS International, North Naples
April 2022 — April 2022
Course Curriculum: Law Enforcement Ethics; Foundations in Criminal Law; Report Writing; Criminal Profiling; Interviewing Techniques; Crisis Intervention.
LANGUAGES S.A.F.E. Approach Level II Training, Hawaii Western College
January 2015 — November 2019
`;
    const result = canonicalizeParserResult(
      {
        normalized: {
          education: [],
          rawText,
        },
        rawText,
      },
      {
        rawText,
        mode: "text",
        parserUrl: "test://parser",
      },
    );

    const education = (result.normalized as any).education;
    const labels = education.map((item: any) =>
      [item.degree, item.institution, item.summary].filter(Boolean).join(" "),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Certified Protection Guard Program (CPOP)"),
        expect.stringContaining("Security Guard Certificate Program (SOCP)"),
        expect.stringContaining("Course Curriculum: Law Enforcement Ethics"),
        expect.stringContaining("S.A.F.E. Approach Level II Training"),
        expect.stringContaining("Hawaii Western College"),
      ]),
    );
    labels.forEach((label) => {
      expect(label).not.toMatch(/\bLANGUAGES\b/i);
    });
  });
});
