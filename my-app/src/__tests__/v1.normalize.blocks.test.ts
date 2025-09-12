import { describe, it, expect } from "vitest";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";

describe("v1 normalization - representative blocks and pruning", () => {
  it("creates or repurposes exactly one representative block per Experience item and prunes invalid linked blocks", () => {
    const input = {
      title: "Exp blocks",
      sections: [
        {
          type: "experience",
          // Two structured items with stable ids
          structuredContent: [
            {
              id: "exp-1",
              company: "Acme",
              position: "Developer",
              // Any ISO (precision not under test here); using full date for simplicity
              startDate: "2020-01-01T00:00:00.000Z",
              endDate: null,
            },
            {
              id: "exp-2",
              company: "Globex",
              position: "Lead",
              startDate: "2021-01-01T00:00:00.000Z",
              endDate: null,
            },
          ],
          // Pre-existing blocks:
          // - b1 already linked to exp-1 (should be preserved as the sole block for exp-1)
          // - b2 unlinked candidate whose title matches derived title for exp-2 -> should be repurposed & linked to exp-2
          // - b3 linked to a non-existent structured id 'ghost' -> should be pruned
          blocks: [
            {
              id: "b1",
              type: "text",
              title: "Acme", // derived title for exp-1 would be company ("Acme")
              content: {
                type: "doc",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Work at Acme" }] },
                ],
              },
              attributes: { linkedStructuredId: "exp-1" },
            },
            {
              id: "b2",
              type: "text",
              title: "Globex", // matches derived title for exp-2
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
              },
              // intentionally unlinked
            },
            {
              id: "b3",
              type: "text",
              title: "Ghost",
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "To prune" }] }],
              },
              attributes: { linkedStructuredId: "ghost" }, // invalid
            },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp blocks");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    expect(exp).toBeDefined();

    const blocks: Array<any> = Array.isArray(exp.blocks) ? exp.blocks : [];
    // Ghost should be pruned; unlinked b2 becomes linked to exp-2; resulting two linked blocks only.
    expect(blocks.length).toBe(2);

    const linkedIds = blocks
      .map((b: any) => b?.attributes?.linkedStructuredId)
      .filter((v: any) => typeof v === "string" && v.trim().length > 0);

    // Ensure we have one block per valid structured id
    expect(new Set(linkedIds)).toEqual(new Set(["exp-1", "exp-2"]));
    expect(linkedIds).toHaveLength(2);

    // Ensure no ghost link remains
    expect(blocks.some((b: any) => b?.attributes?.linkedStructuredId === "ghost")).toBe(false);
  });

  it("preserves unlinked user blocks when there is no matching structured item", () => {
    const input = {
      title: "Exp keep unlinked",
      sections: [
        {
          type: "experience",
          structuredContent: [
            {
              id: "exp-1",
              company: "Umbrella",
              position: "Engineer",
              startDate: "2022-01-01T00:00:00.000Z",
              endDate: null,
            },
          ],
          blocks: [
            // No previous linked block -> a representative one will be created or repurposed
            {
              id: "free-1",
              type: "text",
              title: "My free notes",
              content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Unlinked user notes" }] }] },
              // no attributes -> should remain unlinked
            },
          ],
        },
      ],
    };

    const res = normalizeAndValidateCvDocument(input, "Exp keep unlinked");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const doc: any = res.document;
    const exp = doc.sections.find((s: any) => s.type === "experience");
    expect(exp).toBeDefined();

    const blocks: Array<any> = Array.isArray(exp.blocks) ? exp.blocks : [];
    // Expect at least 2 blocks now: the original unlinked plus a representative linked for exp-1
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    const linkedIds = blocks
      .map((b: any) => b?.attributes?.linkedStructuredId)
      .filter((v: any) => typeof v === "string" && v.trim().length > 0);

    // Must have representative for exp-1
    expect(new Set(linkedIds)).toEqual(new Set(["exp-1"]));

    // The original unlinked "free-1" should still be present without link
    const free = blocks.find((b: any) => b?.id === "free-1");
    expect(free).toBeDefined();
    expect(free?.attributes?.linkedStructuredId).toBeUndefined();
  });
});