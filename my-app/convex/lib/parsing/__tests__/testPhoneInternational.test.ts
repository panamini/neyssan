import { describe, expect, it } from "vitest";

import { extractContactFromText } from "../contactExtractor";

describe("international phone normalization", () => {
  it("normalizes French numbers to E.164", () => {
    const input = "Téléphone : 06 12 34 56 78";
    const contact = extractContactFromText(input, "FR");

    expect(contact.phones).toBeDefined();
    expect(contact.phones?.[0]).toBe("+33612345678");
  });

  it("normalizes Spanish numbers to E.164", () => {
    const input = "Teléfono: 612 34 56 78";
    const contact = extractContactFromText(input, "ES");

    expect(contact.phones).toBeDefined();
    expect(contact.phones?.[0]).toBe("+34612345678");
  });
});
