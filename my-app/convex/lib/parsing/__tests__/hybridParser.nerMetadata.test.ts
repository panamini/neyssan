import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the NER client to return core contact entities so metadata should be filled
vi.mock("../../parsing_shared/nerClient", () => {
  return {
    requestNER: vi.fn().mockResolvedValue({
      entities: [
        { label: "NAME", text: "Jane Doe", start: 0, end: 8 },
        { label: "EMAIL", text: "jane.doe@example.com", start: 100, end: 120 },
        { label: "PHONE", text: "+1 415 555 0101", start: 130, end: 145 },
        { label: "ROLE", text: "Senior Engineer", start: 20, end: 35 },
        { label: "GPE", text: "San Francisco, CA", start: 60, end: 78 },
      ],
      layout: { blocks: [] },
    }),
    isNEREnabled: () => true,
  } as any;
});

import { parseCV } from "../hybridParser";

describe("hybridParser NER metadata fill", () => {
  beforeEach(() => {
    process.env.ENABLE_NER = "1";
  });

  it("populates metadata fields from NER when available", async () => {
    const raw = [
      "Resume",
      "Profile",
      // Intentionally avoid explicit email/phone tokens that regex would grab, to test NER fill path
      "Summary",
      "Experienced engineer building web apps.",
    ].join("\n");

    const res = await parseCV(raw, { returnMappedCV: true, mapperStrip: true });

    expect(res.metadata?.name).toBe("Jane Doe");
    expect(res.metadata?.email).toBe("jane.doe@example.com");
    expect(res.metadata?.phone).toMatch(/415/);
    // desiredPosition is optional; we map ROLE onto it in the enrichment step
    // hybridParser enriches metadata and returns it; strict mapping step can later consume cv._ner if needed
    // For parseCV result, we assert the enriched metadata is present
    // Location should be filled from GPE
    // Note: ParseResult.metadata does not include 'location' field (that mapping occurs in strict adapter),
    // so we only assert the fields present in ExtractedMetadata here.
    // The presence of _ner under cv enables strictProfileAdapter to fuse location.

    // Ensure _ner attached for downstream
    expect(res.cv && typeof res.cv === "object").toBe(true);
    expect((res.cv as any)._ner?.entities?.length).toBeGreaterThan(0);
  });
});

