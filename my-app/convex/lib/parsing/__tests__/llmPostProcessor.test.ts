import { describe, it, expect } from "vitest";

const frenchSample = `
### Coordonnées
**Farid Saidani**
www.linkedin.com/in/farid-saidani-  Agent général chez MMA Assurances
b49a70305  (LinkedIn)  Limoges, Nouvelle-Aquitaine, France

### Principales compétences
- Assurances
- Business-to-Business (BtoB)
- Gestion des comptes

### Résumé
Professionnel dans le domaine de l'assurance, je suis Agent Général BtoB chez MMA...

### Expérience
**MMA Assurances**
Agent général
2020 - Présent (5 ans)

### Formation
NEOMA Business School
(1997 - 2001)
`;

describe("llmPostProcessor - French CV mapping", () => {
  it("maps French headers to canonical fieldKeys", async () => {
    const mod = await import("../llmPostProcessor");
    const { parseLLMSections } = mod;
    const res = parseLLMSections(frenchSample);
    expect(res.sections).toBeDefined();
    const mapping = res.sections.reduce<Record<string, string>>((acc, s) => {
      acc[s.title] = s.fieldKey;
      return acc;
    }, {});
    // Expect specific mappings to exist
    expect(Object.values(mapping)).toContain("contact");
    expect(Object.values(mapping)).toContain("skills");
    expect(Object.values(mapping)).toContain("introduction");
    expect(Object.values(mapping)).toContain("experience");
    expect(Object.values(mapping)).toContain("education");
  });
});