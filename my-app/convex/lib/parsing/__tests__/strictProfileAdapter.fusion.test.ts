import { describe, it, expect } from "vitest";
import { mapParsedToStrict } from "../strictProfileAdapter";
import * as Schema from "../../schemas/profileStrict.schema";
// Tolerant access to named export to satisfy TS in different module modes
const Strict: any = (Schema as unknown as { StrictProfileSchema: unknown } as any).StrictProfileSchema;

// Helpers to craft minimal inputs
function mkSections(confidence = 0.8) {
  return [
    {
      title: "Experience",
      content: "Security Guard at ADT Security\nJanuary 2021 — April 2022\n- Did things",
      fieldKey: "experience",
      confidence,
    },
  ];
}

describe("mapParsedToStrict - contacts fusion and sanitation", () => {
  it("prefers longest 10..16-digit phone number and rejects short-digit noise", () => {
    const rawText = `
ROBERT COOPER
SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 1515
DETAILS
1515 Pacific Ave
Los Angeles, CA 90291
United States
3868683442
email@email.com
`;
    const out = mapParsedToStrict({
      rawText,
      parsedSections: mkSections(0.8),
      metadata: { name: null, email: null, phone: null, linkedinUrl: null },
      mappedCv: null,
    });

    // Validated by Zod
    const parsed = Strict.parse(out);
    // Should not keep "1515" (short-digit noise); should pick the 10-digit number
    expect(parsed.phone && parsed.phone.replace(/\D/g, "").length).toBeGreaterThanOrEqual(10);
    expect(parsed.phone && parsed.phone.includes("1515")).toBeFalsy();
  });

  it("strips header link noise from location and avoids markdown artifacts", () => {
    const rawText = `
🔗 [LinkedIn](https://www.linkedin.com/in/robertcooper) | [Portfolio](https://example.com)
1515 Pacific Ave
Los Angeles, CA 90291, United States
email@email.com
`;
    const out = mapParsedToStrict({
      rawText,
      parsedSections: mkSections(0.8),
      metadata: { name: null, email: null, phone: null, linkedinUrl: null },
      mappedCv: null,
    });

    const parsed = Strict.parse(out);
    expect(parsed.location).toBeTruthy();
    expect(String(parsed.location)).not.toMatch(/LinkedIn|Portfolio|\[|\]\(|https?:\/\//i);
  });

  it("keeps a plausible ALL-CAPS name and does not confuse location with name", () => {
    const rawText = `
ROBERT COOPER
📍 Los Angeles, CA, United States
Details
email@email.com
`;
    const out = mapParsedToStrict({
      rawText,
      parsedSections: mkSections(0.8),
      metadata: { name: null, email: null, phone: null, linkedinUrl: null },
      mappedCv: null,
    });

    const parsed = Strict.parse(out);
    expect(parsed.name).toBe("ROBERT COOPER");
    expect(parsed.name?.toLowerCase()).not.toBe("los angeles, ca, united states");
  });
});

describe("mapParsedToStrict - experience normalization with FR/ES months and epoch guard", () => {
  it("normalizes localized months (FR/ES) to ISO or year-only and never emits epoch", () => {
    const rawText = `
Expérience
Responsable Recrutement
avril 2023 — présent
`;

    // Prefer mappedCv path; adapter will normalize start/end dates
    const mappedCv = {
      experience: [
        { company: "Cartier", position: "Responsable Recrutement", startDate: "avril 2023", endDate: "présent", isCurrent: true, achievements: [] },
        { company: "Dior", position: "Talents", startDate: "septiembre 2020", endDate: "enero 2021", isCurrent: false, achievements: [] },
        { company: "Misc", position: "Role", startDate: "2019", endDate: "2020", isCurrent: false, achievements: [] }, // year-only
      ],
    };

    const out = mapParsedToStrict({
      rawText,
      parsedSections: mkSections(0.7),
      metadata: { name: null, email: null, phone: null, linkedinUrl: null },
      mappedCv,
    });

    const parsed = Strict.parse(out);
    expect(parsed.experience.length).toBeGreaterThanOrEqual(3);

    const exps = parsed.experience as Array<{
      company: string;
      position: string;
      startDate: string | null;
      endDate: string | null;
      isCurrent: boolean;
      achievements: string[];
    }>;

    const cartier = exps.find((e) => e.company === "Cartier");
    expect(cartier?.startDate).toMatch(/^2023-04-/); // April normalized
    // present => null endDate
    expect(cartier?.endDate).toBeNull();

    const dior = exps.find((e) => e.company === "Dior");
    // 'septiembre' -> September, 'enero' -> January
    expect(dior?.startDate).toMatch(/^2020-09-/);
    expect(dior?.endDate).toMatch(/^2021-01-/);

    const misc = exps.find((e) => e.company === "Misc");
    // year-only retained as year string
    expect(misc?.startDate).toBe("2019");
    expect(misc?.endDate).toBe("2020");

    // Epoch guard: ensure no accidental 1970-01-01 unless explicitly provided
    for (const e of exps) {
      expect(e.startDate).not.toBe("1970-01-01");
      if (e.endDate) expect(e.endDate).not.toBe("1970-01-01");
    }
  });
});