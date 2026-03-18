/* my-app/convex/lib/parsing/__tests__/nerFusion.integration.test.ts
   Purpose: Validate that mapParsedToStrict fuses NER (PER/GPE/LOC/DATE/ORG) from mappedCv._ner
   without requiring a live spaCy service. We simulate the _ner payload and assert overrides.
*/

import { describe, it, expect } from "vitest";
import { mapParsedToStrict } from "../../parsing/strictProfileAdapter";

describe("NER fusion in mapParsedToStrict (simulated _ner payload)", () => {
  it("prefers NER PER for name when LLM/heuristics are weak", () => {
    const rawText = [
      "JOHN DOE",
      "Security Professional",
      "Email: example(at)mail(dot)com",
      "Paris, France",
      "",
      "Experience",
      "- Worked at ACME",
    ].join("\n");

    const parsedSections = [
      { title: "Introduction", content: "Security Professional", fieldKey: "summary", confidence: 0.5 },
      { title: "Experience", content: "ACME Corp\nApril 2020 — Present", fieldKey: "experience", confidence: 0.5 },
    ];

    // Simulate NER shape as returned by the spaCy service
    const mappedCv = {
      _ner: {
        entities: [
          { label: "PER", text: "John Doe", start: 0, end: 8, score: 0.92 },
          { label: "GPE", text: "Paris", start: 60, end: 65, score: 0.88 },
          { label: "LOC", text: "France", start: 67, end: 73, score: 0.86 },
          { label: "ORG", text: "ACME Corp", start: 100, end: 109, score: 0.84 },
          { label: "DATE", text: "April 2020", start: 110, end: 120, score: 0.80 },
          { label: "DATE", text: "Present", start: 123, end: 130, score: 0.78 },
        ],
      },
    };

    const out = mapParsedToStrict({
      rawText,
      parsedSections,
      metadata: null, // no LLM metadata to bias name
      mappedCv,
    });

    // Expect NER-derived name and location chosen
    expect(out.name).toBe("John Doe");
    expect(out.location).toBe("Paris"); // first location token wins; adapter may choose earliest GPE/LOC

    // Confidences should be present (from nerConfBase scaling)
    expect(out.confidences.name).not.toBeNull();
    expect(out.confidences.location).not.toBeNull();
  });

  it("builds a minimal experience item from NER ORG + DATE when no mappedCv.experience and sections are weak", () => {
    const rawText = "Jane Smith — Data Analyst\nACME Corp — April 2019 — Present\n";
    const parsedSections = [
      { title: "Intro", content: "Data Analyst", fieldKey: "summary", confidence: 0.5 },
    ];

    const mappedCv = {
      _ner: {
        entities: [
          { label: "PER", text: "Jane Smith", start: 0, end: 10 },
          { label: "ORG", text: "ACME Corp", start: 14, end: 23 },
          { label: "DATE", text: "April 2019", start: 26, end: 36 },
          { label: "DATE", text: "Present", start: 40, end: 47 },
        ],
      },
    };

    const out = mapParsedToStrict({
      rawText,
      parsedSections,
      metadata: null,
      mappedCv,
    });

    // No mappedCv.experience provided and sections don't have a concrete parsable block;
    // fallback should create up to 1-2 items from ORG+DATE.
    expect(Array.isArray(out.experience)).toBe(true);
    expect(out.experience.length).toBeGreaterThan(0);
    const first = out.experience[0];
    expect(first.company).toBe("ACME Corp");
    // Dates may be normalized to ISO or year-only; start should be present
    expect(first.startDate).not.toBeNull();
    // isCurrent inferred from "Present"
    expect(first.isCurrent).toBe(true);
  });

  it("does not crash when _ner is malformed; gracefully ignores", () => {
    const out = mapParsedToStrict({
      rawText: "header\ncontent\n",
      parsedSections: [],
      metadata: null,
      mappedCv: { _ner: { entities: [{ bogus: true }] } }, // invalid shape on purpose
    });

    expect(out).toBeTruthy();
    // name/location remain null, no throw
    expect(out.name === null || typeof out.name === "string").toBe(true);
    expect(out.location === null || typeof out.location === "string").toBe(true);
  });
});