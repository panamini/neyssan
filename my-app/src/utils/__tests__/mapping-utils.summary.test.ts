import { describe, expect, it } from "vitest";
import { buildTypedSectionsFromNormalized } from "../cv/mapping-utils";

describe("buildTypedSectionsFromNormalized summary", () => {
  it("preserves summary text content", () => {
    const sections = buildTypedSectionsFromNormalized({
      summary: { text: "Seasoned engineer with a product focus." },
    } as any);

    const summarySection = sections.find((section) => section.type === "summary");
    expect(summarySection).toBeTruthy();
    const structured = summarySection?.structuredContent?.[0] as any;
    expect(structured).toBeTruthy();
    const doc = structured?.summary;
    expect(doc?.type).toBe("doc");
    const paragraph = doc?.content?.[0]?.content?.[0]?.text;
    expect(paragraph).toBe("Seasoned engineer with a product focus.");
  });
});
