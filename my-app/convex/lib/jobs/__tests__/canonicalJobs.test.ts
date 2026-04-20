import { describe, expect, it } from "vitest";

import {
  buildCanonicalJobDraftFromSource,
  resolveReviewItemsAfterFieldUpdate,
} from "../canonicalJobs";

describe("canonicalJobs", () => {
  it("builds a canonical job draft with review items for uncertain extracted fields", () => {
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
    expect(draft.reviewItems.length).toBeGreaterThan(0);
    expect(
      draft.reviewItems.some((item) => item.fieldKey === "responsibilities"),
    ).toBe(true);
  });

  it("resolves matching review items when the canonical field is edited directly", () => {
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
      fieldKey: "responsibilities",
      nextValue: [
        "Coordinate recurring launches",
        "Maintain documentation with structured handoffs",
      ],
      now: 1234,
    });

    const responsibilityItem = updated.find(
      (item) => item.fieldKey === "responsibilities",
    );

    expect(responsibilityItem?.reviewStatus).toBe("approved");
    expect(responsibilityItem?.approvedValue).toEqual([
      "Coordinate recurring launches",
      "Maintain documentation with structured handoffs",
    ]);
    expect(responsibilityItem?.updatedAt).toBe(1234);
  });
});
