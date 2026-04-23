import { describe, expect, it } from "vitest";

import {
  buildCanonicalJobDraftFromSource,
  flattenExtractionValues,
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
});
