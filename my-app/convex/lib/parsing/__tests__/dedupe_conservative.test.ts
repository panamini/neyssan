import { describe, expect, it } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";

describe("canonicalizeParserResult conservative dedupe", () => {
  const context = {
    rawText: "",
    mode: "ocr",
    parserUrl: "test://parser",
  };

  it("merges exact duplicate experience entries and keeps the richer fields", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [
            {
              id: "exp-1",
              company: "Copwatch",
              position: "Security Guard",
              startDate: "2021-01-01",
              endDate: "2023-04-01",
              responsibilityBullets: ["Monitoring selected areas via CCTV app on smart devices."],
            },
            {
              id: "exp-2",
              company: "copwatch",
              position: "security guard",
              startDate: "2021-01-01",
              endDate: "2023-04-01",
              location: "San Antonio, TX",
              responsibilityBullets: ["Inspecting restrooms after closing time for unauthorized personnel."],
              achievements: ["Decreased theft of hotel items by 73%"],
            },
          ],
        },
      },
      context,
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(1);
    expect(experience[0].company).toMatch(/Copwatch/i);
    expect(experience[0].location).toBe("San Antonio, TX");
    expect(experience[0].responsibilityBullets).toEqual(
      expect.arrayContaining([
        "Monitoring selected areas via CCTV app on smart devices.",
        "Inspecting restrooms after closing time for unauthorized personnel.",
      ]),
    );
    expect(experience[0].achievements).toEqual(["Decreased theft of hotel items by 73%"]);
  });

  it("does not merge similar jobs when dates differ", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          experience: [
            {
              id: "exp-1",
              company: "Copwatch",
              position: "Security Guard",
              startDate: "2021-01-01",
              endDate: "2022-04-01",
              responsibilityBullets: ["Monitored access points."],
            },
            {
              id: "exp-2",
              company: "Copwatch",
              position: "Security Guard",
              startDate: "2022-05-01",
              endDate: "2023-04-01",
              responsibilityBullets: ["Handled incident reporting."],
            },
          ],
        },
      },
      context,
    );

    const experience = (result.normalized as any).experience;
    expect(experience).toHaveLength(2);
  });

  it("collapses repeated achievements to the fuller text", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          achievements: [
            { text: "Decreased theft of hotel items by 73%" },
            { text: "Decreased theft of hotel items by 73%." },
            { text: "Decreased theft of hotel items by 73% by improving access control across hotel floors." },
          ],
        },
      },
      context,
    );

    const achievements = (result.normalized as any).achievements;
    expect(achievements).toHaveLength(1);
    expect(achievements[0].text).toBe(
      "Decreased theft of hotel items by 73% by improving access control across hotel floors.",
    );
  });

  it("does not merge achievements when numeric content conflicts", () => {
    const result = canonicalizeParserResult(
      {
        normalized: {
          achievements: [
            { text: "Reduced costs by 20%" },
            { text: "Reduced costs by 30%" },
          ],
        },
      },
      context,
    );

    const achievements = (result.normalized as any).achievements;
    expect(achievements).toHaveLength(2);
    expect(achievements.map((entry: any) => entry.text)).toEqual(
      expect.arrayContaining(["Reduced costs by 20%", "Reduced costs by 30%"]),
    );
  });
});
