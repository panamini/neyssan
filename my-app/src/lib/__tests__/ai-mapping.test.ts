import { describe, it, expect } from "vitest";
import {
  detectPresent,
  parseHumanDateToken,
  mapDateRangeToIsoPrecision,
  mapAiExperience,
  mapAiEducation,
} from "../ai-mapping";

describe("ai-mapping: helpers", () => {
  it("detectPresent matches present/current/now variants", () => {
    expect(detectPresent("Present")).toBe(true);
    expect(detectPresent("present")).toBe(true);
    expect(detectPresent("current")).toBe(true);
    expect(detectPresent("now")).toBe(true);
    expect(detectPresent("present.")).toBe(true);
    expect(detectPresent("present)")).toBe(true);
    expect(detectPresent("2021")).toBe(false);
    expect(detectPresent("")).toBe(false);
    expect(detectPresent(null as unknown as string)).toBe(false);
  });

  it("parseHumanDateToken supports YYYY, YYYY-MM, MM/YYYY, Mon YYYY, Month D, YYYY and YYYY-MM-DD", () => {
    expect(parseHumanDateToken("2021")).toEqual({ year: "2021", precision: "year" });

    expect(parseHumanDateToken("2021-05")).toEqual({ year: "2021", month: "05", precision: "month" });
    expect(parseHumanDateToken("2021/06")).toEqual({ year: "2021", month: "06", precision: "month" });

    expect(parseHumanDateToken("07/2022")).toEqual({ year: "2022", month: "07", precision: "month" });

    expect(parseHumanDateToken("Jan 2023")).toEqual({ year: "2023", month: "01", precision: "month" });
    expect(parseHumanDateToken("December 2020")).toEqual({ year: "2020", month: "12", precision: "month" });

    expect(parseHumanDateToken("Jan 3 2020")).toEqual({ year: "2020", month: "01", day: "03", precision: "day" });
    expect(parseHumanDateToken("March 12, 2019")).toEqual({ year: "2019", month: "03", day: "12", precision: "day" });

    expect(parseHumanDateToken("2021-05-10")).toEqual({ year: "2021", month: "05", day: "10", precision: "day" });
    expect(parseHumanDateToken("2021/05/10")).toEqual({ year: "2021", month: "05", day: "10", precision: "day" });

    // Unknown strings -> empty parts
    expect(parseHumanDateToken("unknown")).toEqual({});
  });

  it("mapDateRangeToIsoPrecision composes ISO + precision and handles Present", () => {
    // year -> month
    const r1 = mapDateRangeToIsoPrecision("2021", "2022-05");
    expect(typeof r1.startIso).toBe("string");
    expect(r1.startPrecision).toBe("year");
    expect(typeof r1.endIso).toBe("string");
    expect(r1.endPrecision).toBe("month");
    expect(r1.isCurrent).toBeUndefined();

    // month -> Present
    const r2 = mapDateRangeToIsoPrecision("Jan 2023", "Present");
    expect(typeof r2.startIso).toBe("string");
    expect(r2.startPrecision).toBe("month");
    expect(r2.endIso).toBeNull();
    expect(r2.endPrecision).toBeUndefined();
    expect(r2.isCurrent).toBe(true);

    // day -> day
    const r3 = mapDateRangeToIsoPrecision("2021-05-10", "2021-06-11");
    expect(r3.startPrecision).toBe("day");
    expect(r3.endPrecision).toBe("day");
    expect(String(r3.startIso)).toMatch(/T00:00:00\.000Z$/);
    expect(String(r3.endIso)).toMatch(/T00:00:00\.000Z$/);
  });
});

describe("ai-mapping: mapAiExperience", () => {
  it("maps minimal AI experience entries with Present semantics and responsibilities", () => {
    const input = [
      {
        company: "Acme",
        role: "Developer",
        start: "Jan 2020",
        end: "Present",
        responsibilities: "Built features",
      },
      {
        company: "Globex",
        position: "Lead",
        startDate: "2021-05",
        endDate: "2022-06",
        responsibilities: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Led team" }] }] },
        achievements: ["Award A", "Award B"],
      },
    ];
    const out = mapAiExperience(input);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);

    const a = out[0];
    expect(a.company).toBe("Acme");
    expect(a.position).toBe("Developer");
    expect(a.startDatePrecision).toBe("month");
    expect(a.isCurrent).toBe(true);
    expect(a.endDate).toBeNull();
    expect(a.endDatePrecision).toBeUndefined();
    expect(typeof a.startDate).toBe("string");
    // responsibilities doc
    expect((a.responsibilities as any)?.type).toBe("doc");

    const b = out[1];
    expect(b.company).toBe("Globex");
    expect(b.position).toBe("Lead");
    expect(b.startDatePrecision).toBe("month");
    expect(b.endDatePrecision).toBe("month");
    expect(Array.isArray(b.achievements)).toBe(true);
    expect(b.achievements).toEqual(["Award A", "Award B"]);
    expect((b.responsibilities as any)?.type).toBe("doc");
  });

  it("applies epoch sentinel when start date missing to satisfy strict schema", () => {
    const input = [{ company: "NoStart", position: "X" }];
    const out = mapAiExperience(input);
    expect(out[0].company).toBe("NoStart");
    expect(out[0].startDate).toMatch(/1970-01-01T00:00:00\.000Z/);
  });
});

describe("ai-mapping: mapAiEducation", () => {
  it("maps education entries with precision and Present semantics", () => {
    const input = [
      { institution: "Uni A", degree: "BSc", fieldOfStudy: "CS", start: "2018", end: "2021" },
      { institution: "Uni B", degree: "MSc", fieldOfStudy: "AI", startDate: "2022-09", end: "Present", description: "Thesis work" },
    ];
    const out = mapAiEducation(input);
    expect(out).toHaveLength(2);

    const a = out[0];
    expect(a.institution).toBe("Uni A");
    expect(a.startDatePrecision).toBe("year");
    expect(a.endDatePrecision).toBe("year");

    const b = out[1];
    expect(b.institution).toBe("Uni B");
    expect(b.startDatePrecision).toBe("month");
    expect(b.isCurrent).toBe(true);
    expect(b.endDate).toBeNull();
    expect(b.endDatePrecision).toBeUndefined();
    expect((b.description as any)?.type).toBe("doc");
  });
});