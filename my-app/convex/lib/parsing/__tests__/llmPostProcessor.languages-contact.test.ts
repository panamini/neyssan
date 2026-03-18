import { describe, it, expect } from "vitest";

const englishSample = `
### Contact
Phone: +33 6 12 34 56 78
Email: jane.doe@example.com
LinkedIn: https://linkedin.com/in/janedoe

### Languages
- English (Native)
- French (Professional)

### Summary
Experienced software engineer...
`;

const frenchSample = `
### Coordonnées
Téléphone : +33 6 98 76 54 32
Email : jean.dupont@example.fr
LinkedIn : https://linkedin.com/in/jeandupont

### Langues
- Français (Natif)
- Anglais (Professionnel)

### Résumé
Ingénieur logiciel expérimenté...
`;

describe("llmPostProcessor - languages and contact parsing", () => {
  it("parses languages and contact from English headers", async () => {
    const mod = await import("../llmPostProcessor");
    const { parseLLMSections, parseLLMMetadata } = mod;
    const sections = parseLLMSections(englishSample);
    expect(sections).toBeDefined();
    const fk = sections.sections.map(s => s.fieldKey);
    expect(fk).toContain("contact");
    expect(fk).toContain("languages");

    // Ensure languages section content is present and splitable
    const languagesSection = sections.sections.find(s => s.fieldKey === "languages");
    expect(languagesSection).toBeDefined();
    expect(languagesSection?.content).toContain("English");
    expect(languagesSection?.content).toContain("French");

    // Metadata extractor should pick up email and phone
    const metadata = parseLLMMetadata(englishSample);
    expect(metadata.email).toBeDefined();
    expect(metadata.email).toBe("jane.doe@example.com");
    expect(metadata.phone).toBeDefined();
    expect(metadata.phone).toContain("+33");
    expect(metadata.linkedinUrl).toBeDefined();
    expect(metadata.linkedinUrl).toContain("linkedin.com/in/janedoe");
  });

  it("parses languages and contact from French headers", async () => {
    const mod = await import("../llmPostProcessor");
    const { parseLLMSections, parseLLMMetadata } = mod;
    const sections = parseLLMSections(frenchSample);
    expect(sections).toBeDefined();
    const fk = sections.sections.map(s => s.fieldKey);
    expect(fk).toContain("contact");
    expect(fk).toContain("languages");

    const languagesSection = sections.sections.find(s => s.fieldKey === "languages");
    expect(languagesSection).toBeDefined();
    expect(languagesSection?.content).toContain("Français");
    expect(languagesSection?.content).toContain("Anglais");

    const metadata = parseLLMMetadata(frenchSample);
    expect(metadata.email).toBeDefined();
    expect(metadata.email).toBe("jean.dupont@example.fr");
    expect(metadata.phone).toBeDefined();
    expect(metadata.phone).toContain("+33");
    expect(metadata.linkedinUrl).toBeDefined();
    expect(metadata.linkedinUrl).toContain("linkedin.com/in/jeandupont");
  });
});