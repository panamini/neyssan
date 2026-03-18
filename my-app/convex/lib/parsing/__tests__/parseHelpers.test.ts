import { describe, it, expect } from "vitest";
import { extractLanguages, extractContactBlock } from "../../../utils/parseHelpers";

describe("parseHelpers.extractLanguages", () => {
  it("parses languages from a French heading block", () => {
    const text = `
PROFIL
Langues
- Français (natif)
- Anglais (courant)
- Espagnol
`;
    const langs = extractLanguages(text);
    expect(langs).toEqual(expect.arrayContaining(["Français", "Anglais", "Espagnol"]));
  });

  it("parses languages from an inline label", () => {
    const text = "Langues: English, French, German";
    const langs = extractLanguages(text);
    expect(langs).toEqual(expect.arrayContaining(["English", "French", "German"]));
  });

  it("returns empty when none found", () => {
    const text = "No languages here.";
    const langs = extractLanguages(text);
    expect(langs).toEqual([]);
  });
});

describe("parseHelpers.extractContactBlock", () => {
  it("finds phone and address from labeled blocks", () => {
    const text = `
Coordonnées:
Téléphone: +33 6 12 34 56 78
Adresse: 10 Rue de Test, 75001 Paris
`;
    const c = extractContactBlock(text);
    expect(c).toBeDefined();
    expect(c?.phone).toContain("+33");
    expect(c?.address).toContain("Rue de Test");
  });

  it("finds phone with varied formatting", () => {
    const text = "Contact: 01234 56789";
    const c = extractContactBlock(text);
    expect(c).toBeDefined();
    expect(c?.phone).toContain("01234");
  });

  it("returns undefined when no contact-like info", () => {
    const c = extractContactBlock("No contact info here.");
    expect(c).toBeUndefined();
  });
});