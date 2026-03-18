import { describe, expect, it } from "vitest";

import { FIELD_KEY_MAP, isPotentialHeader } from "../enhancedParser";
import { parseLLMSections } from "../llmPostProcessor";

describe("multilingual heading coverage", () => {
  it("includes FR/ES/DE synonyms in the shared field map", () => {
    expect(FIELD_KEY_MAP.experience).toContain("expérience professionnelle");
    expect(FIELD_KEY_MAP.experience).toContain("experiencia laboral");
    expect(FIELD_KEY_MAP.experience).toContain("berufserfahrung");

    expect(FIELD_KEY_MAP.education).toContain("formation");
    expect(FIELD_KEY_MAP.education).toContain("educación");
    expect(FIELD_KEY_MAP.education).toContain("bildung");

    expect(FIELD_KEY_MAP.languages).toContain("idiomas");
    expect(FIELD_KEY_MAP.languages).toContain("langues");
    expect(FIELD_KEY_MAP.languages).toContain("sprachkenntnisse");
  });

  it("maps FR/ES/DE headings to canonical buckets during LLM parsing", () => {
    const document = [
      "## Expérience Professionnelle",
      "Chef de projet chez Exemple SA",
      "",
      "## Educación",
      "Máster en Ingeniería",
      "",
      "## Kompetenzen",
      "- JavaScript\n- Gestion de projet",
      "",
      "## Idiomas",
      "Francés (C1), Español (B2)",
      "",
      "## Auszeichnungen",
      "- Prix de l'innovation 2023",
    ].join("\n");

    const sections = parseLLMSections(document).sections;
    const buckets = sections.map((section) => section.fieldKey);

    expect(buckets).toContain("experience");
    expect(buckets).toContain("education");
    expect(buckets).toContain("skills");
    expect(buckets).toContain("languages");
    expect(buckets).toContain("achievements");
  });

  it("identifies localized headings purely with heuristics", () => {
    const context = { previousLine: "", nextLine: "", lineIndex: 0 };
    expect(isPotentialHeader("Expérience Professionnelle", context)).toBe(true);
    expect(isPotentialHeader("Educación", context)).toBe(true);
    expect(isPotentialHeader("Sprachkenntnisse", context)).toBe(true);
  });
});
