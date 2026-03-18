import { describe, it, expect } from "vitest";
import { formatByPrecision, formatDateRange, parseIsoToParts, composeIsoFromParts, PRESENT_LABEL } from "./date-utils";
import type { DatePrecision } from "../types/cvDocument";

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
}

describe("date-utils: formatByPrecision", () => {
  it("formats year precision", () => {
    const yearIso = iso(2021, 1, 1);
    expect(formatByPrecision(yearIso, "year")).toBe("2021");
  });

  it("formats month precision", () => {
    const monthIso = iso(2021, 2, 1);
    expect(formatByPrecision(monthIso, "month")).toBe("Feb 2021");
  });

  it("formats day precision", () => {
    const dayIso = iso(2021, 2, 10);
    expect(formatByPrecision(dayIso, "day")).toBe("Feb 10, 2021");
  });

  it("infers precision when not provided", () => {
    const y = "2021-01-01T00:00:00.000Z";
    const m = "2021-05-01T00:00:00.000Z";
    const d = "2021-05-31T00:00:00.000Z";
    expect(formatByPrecision(y)).toBe("Jan 1, 2021"); // inferred 'day' via regex match (yyyy-mm-dd)
    expect(formatByPrecision(m)).toBe("May 1, 2021"); // inferred 'day' due to full ISO shape
    expect(formatByPrecision(d)).toBe("May 31, 2021");
  });

  it("returns empty string for invalid input", () => {
    expect(formatByPrecision(undefined)).toBe("");
    expect(formatByPrecision(null)).toBe("");
    expect(formatByPrecision("not-a-date" as unknown as string, "day")).toBe("");
  });
});

describe("date-utils: formatDateRange", () => {
  it("formats start — end respecting precision", () => {
    const start = iso(2021, 1, 1);
    const end = iso(2022, 5, 1);
    const out = formatDateRange(start, end, {
      startPrecision: "year",
      endPrecision: "month",
    });
    expect(out).toBe("2021 — May 2022");
  });

  it("shows Present when isCurrent is true and endDate is null", () => {
    const start = iso(2023, 1, 1);
    const out = formatDateRange(start, null, {
      startPrecision: "month",
      isCurrent: true,
    });
    expect(out).toBe(`Jan 2023 — ${PRESENT_LABEL}`);
  });

  it("omits end when unknown and not current", () => {
    const start = iso(2020, 7, 1);
    const out = formatDateRange(start, undefined, {
      startPrecision: "year",
      isCurrent: false,
    });
    expect(out).toBe("2020");
  });

  it("returns empty string when missing start date", () => {
    expect(formatDateRange(undefined, undefined, {})).toBe("");
  });
});

describe("date-utils: parseIsoToParts", () => {
  it("extracts y-m-d from ISO", () => {
    const parts = parseIsoToParts(iso(2021, 5, 10));
    expect(parts).toEqual({ year: "2021", month: "05", day: "10" });
  });

  it("returns empty parts for epoch sentinel", () => {
    const parts = parseIsoToParts("1970-01-01T00:00:00.000Z");
    expect(parts).toEqual({});
  });

  it("returns empty parts for invalid", () => {
    expect(parseIsoToParts("")).toEqual({});
    expect(parseIsoToParts(null)).toEqual({});
  });
});

describe("date-utils: composeIsoFromParts", () => {
  it("composes year precision", () => {
    const out = composeIsoFromParts({ year: "2019", precision: "year" as DatePrecision });
    expect(out.precision).toBe("year");
    expect(out.iso).toBe(iso(2019, 1, 1));
  });

  it("composes month precision", () => {
    const out = composeIsoFromParts({ year: "2020", month: "02", precision: "month" as DatePrecision });
    expect(out.precision).toBe("month");
    expect(out.iso).toBe(iso(2020, 2, 1));
  });

  it("composes day precision with clamp", () => {
    const out = composeIsoFromParts({ year: "2021", month: "02", day: "31", precision: "day" as DatePrecision });
    expect(out.precision).toBe("day");
    // Feb 31 clamps to Feb 28 (or 29 in leap years)
    const feb2021LastDay = new Date(Date.UTC(2021, 2, 0)).getUTCDate(); // 28
    expect(out.iso).toBe(iso(2021, 2, feb2021LastDay));
  });

  it("returns undefined for incomplete parts", () => {
    expect(composeIsoFromParts({})).toEqual({ iso: undefined, precision: undefined });
    expect(composeIsoFromParts({ year: "2021", precision: "day" as DatePrecision })).toEqual({ iso: iso(2021, 1, 1), precision: "year" });
  });
});