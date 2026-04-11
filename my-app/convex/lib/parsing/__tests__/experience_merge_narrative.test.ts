import { canonicalizeParserResult } from "../canonicalize";

describe("canonicalizeExperience narrative merge", () => {
  it("merges narrative rows into the preceding experience entry", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [
            {
              id: "exp-1",
              company: "ADT Security",
              position: "Security Guard",
              startDate: "2021-01-01",
              endDate: "2023-04-01",
              responsibilities: "Maintaining environments by monitoring the grounds and equipment controls.",
              responsibilityBullets: [
                "Maintaining environments by monitoring the grounds and equipment controls.",
              ],
            },
            {
              id: "exp-2",
              company: "",
              position: "Experience",
              location: "",
              responsibilities:
                "Responsible for completing reports by recording information, observations, occurrences and surveillance activities, including interviewing of witnesses and acquiring signatures.",
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

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    const [first] = experience;
    expect(first.company).toBe("ADT Security");
    expect(first.responsibilityBullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Maintaining environments by monitoring the grounds and equipment controls"),
        "Responsible for completing reports by recording information, observations, occurrences and surveillance activities, including interviewing of witnesses and acquiring signatures",
      ]),
    );
  });

  it("prefers the stronger later Farman narrative line during raw-section fallback", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText: "",
        },
        rawSections: [
          {
            label: "EXPERIENCE",
            content: [
              "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator",
              "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
            ].join("\n"),
          },
        ],
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect(experience[0].responsibilityBullets).toEqual([
      "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
    ]);
  });

  it("prefers fuller source text over a weak single-line raw-section fallback for Farman", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          raw:
            "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
            "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
          rawText:
            "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
            "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        },
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator",
          },
        ],
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });

  it("uses top-level rawText before experience fallback decides on a weak Farman raw-section", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
        },
        rawText:
          "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
          "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator",
          },
        ],
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });

  it("uses fuller body raw-sections when experience raw-section is weak for Farman", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
        },
        rawSections: [
          {
            label: "BODY",
            content:
              "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
          },
          {
            label: "EXPERIENCE",
            content:
              "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator",
          },
        ],
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });

  it("treats split duplicated Farman narrative fields as weak raw-section fallback", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText:
            "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        },
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              " One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
              "Jan 1, 2016",
          },
        ],
      },
      {
        rawText:
          "Presently working in CBRE through Strabag as a BMS Operator in Metlife Gurgaon. From 01stjanuary 2016 to till date.",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });

  it("uses top-level sections content when weak Farman raw-sections need override", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
        },
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
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });

  it("recovers bullet-prefixed Farman narrative lines from app-side source text", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [],
          rawText:
            "- Presently working in CBRE through Strabag as a BMS Operator and posted at a site MetLife global operation support Sec. 135 Noida. From 01stjanuary 2016 to till date.",
          raw:
            "- Presently working in CBRE through Strabag as a BMS Operator and posted at a site MetLife global operation support Sec. 135 Noida. From 01stjanuary 2016 to till date.",
        },
        rawSections: [
          {
            label: "EXPERIENCE",
            content:
              "One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator\n" +
              "Jan 1, 2016",
          },
        ],
      },
      {
        rawText: "",
        mode: "auto",
        parserUrl: "test://parser",
      },
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0]).toEqual(
      expect.objectContaining({
        company: "CBRE through Strabag",
        position: "BMS Operator",
        startDate: "2016-01-01",
        isCurrent: true,
      }),
    );
    expect((result.normalized as any).experienceDiagnostics).toEqual(
      expect.objectContaining({
        source: "text_fallback",
      }),
    );
  });
});
