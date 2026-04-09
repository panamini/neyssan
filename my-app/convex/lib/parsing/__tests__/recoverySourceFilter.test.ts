import { describe, expect, it } from "vitest";

import { buildImportRecoveryPayload } from "../importRecovery";
import { filterRecoverySourceSectionsForRedundantHeader } from "../recoverySourceFilter";

describe("filterRecoverySourceSectionsForRedundantHeader", () => {
  it("suppresses a short top BODY header block when it is fully redundant with normalized contact fields", () => {
    const result = filterRecoverySourceSectionsForRedundantHeader(
      [
        {
          label: "BODY",
          content: [
            "ROBERT COOPER",
            "SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442",
          ].join("\n"),
        },
        { label: "SUMMARY", content: "Safety conscious, attentive Security Guard." },
      ],
      {
        name: "Robert Cooper",
        desiredPosition: "Security Guard",
        contact: {
          phone: "3868683442",
          location: "Los Angeles, CA 90291, United States",
        },
      },
    );

    expect(result.suppressed).toBe(true);
    expect(result.sections).toEqual([
      { label: "SUMMARY", content: "Safety conscious, attentive Security Guard." },
    ]);
  });

  it("keeps BODY blocks that contain non-redundant narrative content", () => {
    const result = filterRecoverySourceSectionsForRedundantHeader(
      [
        {
          label: "BODY",
          content: [
            "ROBERT COOPER",
            "SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442",
            "Safety conscious, attentive Security Guard with eight years experience.",
          ].join("\n"),
        },
      ],
      {
        name: "Robert Cooper",
        desiredPosition: "Security Guard",
        contact: {
          phone: "3868683442",
          location: "Los Angeles, CA 90291, United States",
        },
      },
    );

    expect(result.suppressed).toBe(false);
    expect(result.sections).toHaveLength(1);
  });

  it("keeps non-first or non-BODY sections untouched", () => {
    const result = filterRecoverySourceSectionsForRedundantHeader(
      [
        { label: "SUMMARY", content: "Summary" },
        { label: "BODY", content: "ROBERT COOPER\n3868683442" },
      ],
      {
        name: "Robert Cooper",
        contact: { phone: "3868683442" },
      },
    );

    expect(result.suppressed).toBe(false);
    expect(result.sections).toHaveLength(2);
  });

  it("removes redundant Robert-style OCR header residue from recovery input", () => {
    const normalized = {
      name: "Robert Cooper",
      desiredPosition: "Security Guard",
      contact: {
        name: "Robert Cooper",
        desiredPosition: "Security Guard",
        phone: "3868683442",
        email: "email@email.com",
        location: "Los Angeles, CA 90291, United States",
      },
    };
    const sourceSections = [
      {
        label: "BODY",
        content: [
          "ROBERT",
          "ROBERT COOPER",
          "SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442",
          "email@email.com",
        ].join("\n"),
      },
      { label: "SUMMARY", content: "Safety conscious, attentive Security Guard." },
    ];

    const before = buildImportRecoveryPayload({
      sourceSections,
      fullResult: { normalized },
      context: { rawText: sourceSections.map((section) => section.content).join("\n\n"), mode: "ocr", parserUrl: "diagnostic://ocr" },
    });
    const filtered = filterRecoverySourceSectionsForRedundantHeader(sourceSections, normalized);
    const after = buildImportRecoveryPayload({
      sourceSections: filtered.sections,
      fullResult: { normalized },
      context: { rawText: sourceSections.map((section) => section.content).join("\n\n"), mode: "ocr", parserUrl: "diagnostic://ocr" },
    });

    expect(before?.items).toHaveLength(1);
    expect(before?.items[0]?.cleanedText).toContain("ROBERT COOPER");
    expect(filtered.suppressed).toBe(true);
    expect(after?.items).toHaveLength(0);
  });
});
