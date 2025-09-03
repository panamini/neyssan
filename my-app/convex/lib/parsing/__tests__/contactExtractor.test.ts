// my-app/convex/lib/parsing/__tests__/contactExtractor.test.ts
import { describe, it, expect } from "vitest";
import { extractContactFromText } from "../contactExtractor";

describe("contactExtractor - libphonenumber-js integration", () => {
  it("parses international numbers into E.164 and deduplicates", () => {
    const text = "Contact: +1 415-555-2671 or +14155552671 (same number). Email: foo@example.com. LinkedIn: https://linkedin.com/in/johndoe";
    const c = extractContactFromText(text);

    expect(c).toBeTruthy();
    expect(Array.isArray(c.emails || [])).toBe(true);
    expect((c.emails || [])[0]).toBe("foo@example.com");
    expect(Array.isArray(c.phones || [])).toBe(true);
    // E.164 normalized form should start with +
    expect((c.phones || []).length).toBeGreaterThanOrEqual(1);
    expect((c.phones || [])[0].startsWith("+")).toBeTruthy();
    expect(Array.isArray(c.linkedinUrls || [])).toBe(true);
    expect((c.linkedinUrls || [])[0]).toContain("linkedin.com");
  });

  it("parses national-format numbers using defaultCountry hint", () => {
    // French national mobile format
    const text = "Appelez-moi: 06 12 34 56 78";
    const c = extractContactFromText(text, "FR");

    expect(c).toBeTruthy();
    expect(Array.isArray(c.phones || [])).toBe(true);
    expect((c.phones || []).length).toBeGreaterThan(0);
    // Should be E.164 formatted and start with +33 for France
    expect((c.phones || [])[0].startsWith("+33")).toBeTruthy();
  });

  it("deduplicates multiple identical emails/phones and returns arrays", () => {
    const text = `
      Emails: alice@example.com, alice@example.com
      Phones: +44 7700 900123, +447700900123
      LinkedIn: https://linkedin.com/in/alice, https://linkedin.com/in/alice
    `;
    const c = extractContactFromText(text, "GB");

    expect(c).toBeTruthy();
    expect(c.emails?.length).toBe(1);
    expect(c.phones?.length).toBe(1);
    expect(c.linkedinUrls?.length).toBe(1);
  });

  it("returns empty arrays/undefined when nothing found", () => {
    const c = extractContactFromText("");
    expect(c).toBeTruthy();
    // No emails/phones/linkedinUrls found
    expect(c.emails).toBeUndefined();
    expect(c.phones).toBeUndefined();
    expect(c.linkedinUrls).toBeUndefined();
  });
});