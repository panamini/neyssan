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
});
