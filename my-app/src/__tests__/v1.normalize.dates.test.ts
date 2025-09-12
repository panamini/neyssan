import { describe, it, expect } from "vitest";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";

describe("v1 normalization - date precision and Present semantics", () => {
  it("Experience: year-only and month precision are preserved", () => {
    const input = {
      title: "Exp dates",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-y", company: "Acme", position: "Dev", startDate: "2021", endDate: "2022" },
            { id: "exp-m", company: "Beta", position: "Lead", startDate: "2023-05", endDate: "2024-06" },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp dates");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    expect(exp).toBeDefined();
    const items = exp.structuredContent as any[];
    expect(items).toHaveLength(2);

    const yearOnly = items.find((i) => i.id === "exp-y");
    expect(typeof yearOnly.startDate).toBe("string");
    expect(yearOnly.startDatePrecision).toBe("year");
    expect(typeof yearOnly.endDate).toBe("string");
    expect(yearOnly.endDatePrecision).toBe("year");

    const monthPrec = items.find((i) => i.id === "exp-m");
    expect(typeof monthPrec.startDate).toBe("string");
    expect(monthPrec.startDatePrecision).toBe("month");
    expect(typeof monthPrec.endDate).toBe("string");
    expect(monthPrec.endDatePrecision).toBe("month");
  });

  it("Experience: day precision is preserved and normalized to UTC midnight", () => {
    const input = {
      title: "Exp day",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-d", company: "Zeta", position: "IC", startDate: "2021-05-10", endDate: "2022-02-03" },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp day");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    const item = (exp.structuredContent as any[])[0];
    expect(item.startDatePrecision).toBe("day");
    expect(item.endDatePrecision).toBe("day");
    // Ensure ISO string shape
    expect(item.startDate).toMatch(/T00:00:00\.000Z$/);
    expect(item.endDate).toMatch(/T00:00:00\.000Z$/);
  });

  it("Experience: Present semantics sets isCurrent, null endDate, and no endDatePrecision", () => {
    const input = {
      title: "Exp Present",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-present", company: "NowCorp", position: "Mgr", startDate: "2022-01", isCurrent: true },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp Present");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    const item = (exp.structuredContent as any[])[0];

    // startDatePrecision should be month for "2022-01"
    expect(item.startDatePrecision).toBe("month");

    // Present semantics
    expect(item.isCurrent === true || item.currentlyWorking === true).toBe(true);
    expect(item.endDate).toBeNull();
    expect(item.endDatePrecision).toBeUndefined();
  });

  it("Experience: does not infer Present when end date is empty and toggle is not set", () => {
    const input = {
      title: "Exp no inference",
      sections: [
        {
          type: "experience",
          structuredContent: [
            { id: "exp-unknown", company: "Foo", position: "Bar", startDate: "2020-01", endDate: "" },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp no inference");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    const item = (exp.structuredContent as any[])[0];

    // isCurrent should remain unset
    expect(item.isCurrent).toBeUndefined();
    // endDate may be null or undefined after normalization; ensure not marked Present
    expect(item.endDatePrecision).not.toBeUndefined(); // precision may be undefined; assertion of non-Present is above
  });

  it("Education: precision preserved and Present supported", () => {
    const input = {
      title: "Edu dates",
      sections: [
        {
          type: "education",
          structuredContent: [
            { id: "edu-y", institution: "Uni A", degree: "BSc", startDate: "2018", endDate: "2021" },
            { id: "edu-present", institution: "Uni B", degree: "MSc", startDate: "2022-09", isCurrent: true },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Edu dates");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const edu = doc.sections.find((s: any) => s.type === "education");
    expect(edu).toBeDefined();
    const items = edu.structuredContent as any[];
    expect(items).toHaveLength(2);

    const yearOnly = items.find((i) => i.id === "edu-y");
    expect(yearOnly.startDatePrecision).toBe("year");
    expect(yearOnly.endDatePrecision).toBe("year");

    const present = items.find((i) => i.id === "edu-present");
    expect(present.startDatePrecision).toBe("month");
    expect(present.isCurrent).toBe(true);
    expect(present.endDate).toBeNull();
    expect(present.endDatePrecision).toBeUndefined();
  });
});