import { describe, expect, it } from "vitest";

import {
  buildCanonicalJobDraftFromSource,
  flattenExtractionValues,
  resolveReparsedCompany,
  resolveReparsedLocation,
  resolveReviewItemsAfterFieldUpdate,
} from "../canonicalJobs";

describe("canonicalJobs", () => {
  it("builds structured extraction records alongside legacy arrays", () => {
    const draft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      rawDescription:
        "Studio North is hiring an Operations Associate in Paris. Coordinate recurring launches, keep handoffs clear, and maintain documentation. Experience with Airtable and vendor follow-up preferred.",
      sourceUrl: "https://example.com/jobs/operations-associate",
      sourceType: "extension",
      sourceDomain: "example.com",
    });

    expect(draft.title).toBe("Operations Associate");
    expect(draft.parseStatus).toBe("parsed");
    expect(draft.reviewState).toBe("needs_review");
    expect(draft.summary).toContain("Operations Associate");
    expect(draft.summaryExtraction.value).toBe(draft.summary);
    expect(draft.summaryExtraction.confidence).toBeGreaterThan(0);
    expect(draft.responsibilitiesExtraction.length).toBeGreaterThan(0);
    expect(flattenExtractionValues(draft.responsibilitiesExtraction)).toEqual(
      draft.responsibilities,
    );
    expect(draft.keywordsExtraction.length).toBeGreaterThan(0);
    expect(draft.reviewItems.length).toBeGreaterThan(0);
    expect(
      draft.reviewItems.some((item) => item.fieldKey === "keywords"),
    ).toBe(true);
  });

  it("resolves matching low-confidence review items when the canonical field is edited directly", () => {
    const draft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      rawDescription:
        "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
      sourceUrl: "https://example.com/jobs/operations-associate",
      sourceType: "extension",
      sourceDomain: "example.com",
    });

    const updated = resolveReviewItemsAfterFieldUpdate({
      reviewItems: draft.reviewItems,
      fieldKey: "keywords",
      nextValue: [
        "operations associate",
        "documentation",
      ],
      now: 1234,
    });

    const keywordsItem = updated.find(
      (item) => item.fieldKey === "keywords",
    );

    expect(keywordsItem?.reviewStatus).toBe("approved");
    expect(keywordsItem?.approvedValue).toEqual([
      "operations associate",
      "documentation",
    ]);
    expect(keywordsItem?.updatedAt).toBe(1234);
  });

  it("treats regex-backed requirement extraction as high confidence and sentence fallback as low confidence", () => {
    const draft = buildCanonicalJobDraftFromSource({
      title: "Program Manager",
      rawDescription:
        "Manage launch timelines across teams. Required experience with Airtable and vendor operations.",
    });

    const mustHavesItem = draft.reviewItems.find(
      (item) => item.fieldKey === "mustHaves",
    );
    const responsibilitiesItem = draft.reviewItems.find(
      (item) => item.fieldKey === "responsibilities",
    );

    expect(draft.mustHavesExtraction[0]?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(mustHavesItem).toBeUndefined();
    expect(draft.responsibilitiesExtraction[0]?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(responsibilitiesItem).toBeUndefined();
  });

  it("degrades gracefully when the description is too short", () => {
    const draft = buildCanonicalJobDraftFromSource({
      title: "Coordinator",
      rawDescription: "Logistics support",
    });

    expect(draft.parseStatus).toBe("parsed");
    expect(draft.summary).toContain("Coordinator");
    expect(draft.summaryExtraction.confidence).toBeLessThan(0.5);
    expect(Array.isArray(draft.reviewItems)).toBe(true);
  });

  it("extracts office-based locations across supported languages", () => {
    const examples = [
      {
        title: "Operations Associate",
        rawDescription:
          "Studio North is hiring an Operations Associate in Paris. Coordinate recurring launches.",
        expectedLocation: "Paris",
      },
      {
        title: "Diseñador/A Gráfico",
        rawDescription:
          "Buscamos incorporar una persona creativa para liderar la identidad visual. Oficina en Las Rozas de Madrid. Requisitos adicionales incorporación inmediata.",
        expectedLocation: "Las Rozas de Madrid",
      },
      {
        title: "Chef de Projet",
        rawDescription:
          "Poste basé à Lyon avec coordination des équipes produit et opérations.",
        expectedLocation: "Lyon",
      },
      {
        title: "Projektmanager",
        rawDescription:
          "Standort in Berlin mit Verantwortung für operative Abläufe und Lieferanten.",
        expectedLocation: "Berlin",
      },
      {
        title: "Responsabile Operativo",
        rawDescription:
          "Ruolo con sede a Milano per coordinare i flussi interni e la documentazione.",
        expectedLocation: "Milano",
      },
      {
        title: "Coordenador de Operações",
        rawDescription:
          "Vaga com escritório em Lisboa para apoiar processos, documentação e equipas.",
        expectedLocation: "Lisboa",
      },
    ] as const;

    for (const example of examples) {
      const draft = buildCanonicalJobDraftFromSource({
        title: example.title,
        rawDescription: example.rawDescription,
      });

      expect(draft.location).toBe(example.expectedLocation);
    }
  });

  it("prefers structured company and location metadata when provided by the scraper", () => {
    const draft = buildCanonicalJobDraftFromSource({
      title: "Product Designer",
      company: "Acme Studio",
      location: "Paris, France",
      rawDescription:
        "Create polished product experiences and collaborate with engineering.",
      sourceUrl: "https://www.linkedin.com/jobs/view/product-designer",
      sourceType: "linkedin",
    });

    expect(draft.company).toBe("Acme Studio");
    expect(draft.location).toBe("Paris, France");
  });

  it("preserves a stored location when re-parse no longer finds a location cue", () => {
    const originalDraft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      rawDescription:
        "Studio North is hiring an Operations Associate in Paris. Coordinate recurring launches.",
    });
    const reparsedDraft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      rawDescription:
        "Studio North is hiring an Operations Associate. Coordinate recurring launches.",
    });

    expect(originalDraft.location).toBe("Paris");
    expect(reparsedDraft.location).toBe("");
    expect(
      resolveReparsedLocation({
        existingLocation: originalDraft.location,
        parsedLocation: reparsedDraft.location,
      }),
    ).toBe("Paris");
  });

  it("preserves a stored company when re-parse no longer finds a company cue", () => {
    const originalDraft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      company: "Studio North",
      rawDescription:
        "Coordinate recurring launches and keep handoffs clear.",
    });
    const reparsedDraft = buildCanonicalJobDraftFromSource({
      title: "Operations Associate",
      rawDescription:
        "Coordinate recurring launches and keep handoffs clear.",
    });

    expect(originalDraft.company).toBe("Studio North");
    expect(reparsedDraft.company).toBe("");
    expect(
      resolveReparsedCompany({
        existingCompany: originalDraft.company,
        parsedCompany: reparsedDraft.company,
      }),
    ).toBe("Studio North");
  });
});
