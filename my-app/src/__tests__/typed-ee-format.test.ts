import { describe, it, expect } from "vitest";
import { formatRangeFromItem, composeIsoFromParts } from "../lib/date-utils";
import type { IExperienceItem, IEducationItem, DatePrecision } from "../types/cvDocument";

function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
}

describe("typed Experience/Education: formatRangeFromItem", () => {
  it("formats Experience month precision and closed range", () => {
    const start = composeIsoFromParts({ year: "2021", month: "01", precision: "month" as DatePrecision });
    const end = composeIsoFromParts({ year: "2022", month: "05", precision: "month" as DatePrecision });

    const exp: IExperienceItem = {
      id: "e1",
      company: "Acme",
      position: "Developer",
      startDate: start.iso!, // Jan 2021
      endDate: end.iso!,     // May 2022
      startDatePrecision: start.precision,
      endDatePrecision: end.precision,
      isCurrent: undefined,
      location: "Paris",
      achievements: [],
    };

    expect(formatRangeFromItem(exp)).toBe("Jan 2021 — May 2022");
  });

  it("formats Experience with Present (isCurrent = true) and hides end precision", () => {
    const start = composeIsoFromParts({ year: "2023", month: "01", precision: "month" as DatePrecision });

    const exp: IExperienceItem = {
      id: "e2",
      company: "Beta",
      position: "Lead",
      startDate: start.iso!, // Jan 2023
      endDate: null,
      startDatePrecision: start.precision,
      endDatePrecision: undefined,
      isCurrent: true,
      currentlyWorking: true,
      location: "Remote",
      achievements: [],
    };

    expect(formatRangeFromItem(exp)).toBe("Jan 2023 — Present");
  });

  it("infers year precision when only a year was composed", () => {
    const start = iso(2020, 1, 1); // day precision in ISO but function will format by provided precision when set
    const edu: IEducationItem = {
      id: "ed1",
      institution: "Uni X",
      degree: "BSc",
      startDate: start,
      startDatePrecision: "year",
      endDate: null,
      endDatePrecision: undefined,
      isCurrent: true,
      grade: "",
      description: undefined,
      fieldOfStudy: "CS",
    };
    expect(formatRangeFromItem(edu)).toBe("2020 — Present");
  });

  it("returns single start when end is unknown and not current", () => {
    const start = composeIsoFromParts({ year: "2018", month: "09", precision: "month" as DatePrecision });
    const exp: IExperienceItem = {
      id: "e3",
      company: "Gamma",
      position: "Engineer",
      startDate: start.iso!,
      endDate: undefined,
      startDatePrecision: start.precision,
      endDatePrecision: undefined,
      isCurrent: undefined,
      location: "",
      achievements: [],
    };
    expect(formatRangeFromItem(exp)).toBe("Sep 2018");
  });

  it("formats day precision start and end", () => {
    const exp: IExperienceItem = {
      id: "e4",
      company: "",
      position: "",
      startDate: iso(2021, 2, 10),
      endDate: iso(2021, 3, 5),
      startDatePrecision: "day",
      endDatePrecision: "day",
      isCurrent: false,
      location: "",
      achievements: [],
    };
    expect(formatRangeFromItem(exp)).toBe("Feb 10, 2021 — Mar 5, 2021");
  });
});