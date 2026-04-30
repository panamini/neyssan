import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isUiSafeVisibleJobExtraction,
  selectVisibleJobExtraction,
  type VisibleJobExtractionShadowRow,
} from "../visibleJobExtraction";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseOutput: NormalizedJobExtraction = {
  summary_short: "Coordonne les opérations terrain et les plannings d'équipe.",
  role_title_normalized: "Coordinateur Operations",
  requirements: [
    { value: "Coordination opérationnelle", type: "skill", required: true },
    { value: "Gestion de planning", type: "tool", required: true },
  ],
  keywords_canonical: ["coordination", "planning"],
  licenses_or_certifications: [],
  schedule_constraints: [],
  environment: {
    customer_facing: null,
    retail: null,
    physical_standing: null,
    onsite: null,
  },
  confidence: "medium",
};

const englishOutput: NormalizedJobExtraction = {
  summary_short: "Monitors hotel security systems and supports guest safety.",
  role_title_normalized: "Security Attendant",
  requirements: [
    { value: "Monitor CCTV, access control, and alarm systems", type: "skill", required: true },
    { value: "Document security incidents in detail", type: "skill", required: true },
    { value: "High school diploma or equivalent", type: "education", required: true },
  ],
  keywords_canonical: ["hotel security", "CCTV", "access control", "guest safety"],
  licenses_or_certifications: ["CT Guard Card"],
  schedule_constraints: ["Overnight shifts", "Weekends", "Holidays"],
  environment: {
    customer_facing: true,
    retail: null,
    physical_standing: true,
    onsite: true,
  },
  confidence: "high",
};

const spanishSecurityOutput: NormalizedJobExtraction = {
  summary_short:
    "Vigilancia y seguridad en hotel con atención a huéspedes y manejo de sistemas de monitoreo.",
  role_title_normalized: "Asistente de Seguridad",
  requirements: [
    { value: "Educación secundaria o equivalente", type: "education", required: true },
    {
      value: "Experiencia en gestión de sistemas de circuito cerrado de televisión (CCTV)",
      type: "experience",
      required: true,
    },
    {
      value: "Disponibilidad para trabajar en turnos nocturnos, fines de semana y festivos",
      type: "constraint",
      required: true,
    },
  ],
  keywords_canonical: ["seguridad hotelera", "monitoreo CCTV", "atención a huéspedes"],
  licenses_or_certifications: ["CT Guard Card"],
  schedule_constraints: ["turnos nocturnos", "fines de semana", "festivos"],
  environment: {
    customer_facing: true,
    retail: null,
    physical_standing: true,
    onsite: true,
  },
  confidence: "high",
};

const italianSecurityOutput: NormalizedJobExtraction = {
  ...englishOutput,
  summary_short:
    "Sicurezza alberghiera con gestione degli ospiti e monitoraggio dei sistemi.",
  role_title_normalized: "Addetto alla Sicurezza",
  requirements: [
    { value: "Esperienza nella gestione dei sistemi CCTV", type: "experience", required: true },
    { value: "Disponibilità a lavorare su turni e fine settimana", type: "constraint", required: true },
  ],
  keywords_canonical: ["sicurezza", "gestione ospiti", "turni"],
  schedule_constraints: ["turni", "fine settimana", "festivi"],
};

const portugueseSecurityOutput: NormalizedJobExtraction = {
  ...englishOutput,
  summary_short:
    "Segurança hoteleira com atendimento a hóspedes e monitoramento de sistemas.",
  role_title_normalized: "Assistente de Segurança",
  requirements: [
    { value: "Experiência em gestão de sistemas CCTV", type: "experience", required: true },
    { value: "Disponibilidade para trabalhar em turnos e fins de semana", type: "constraint", required: true },
  ],
  keywords_canonical: ["segurança", "hóspedes", "turnos"],
  schedule_constraints: ["turnos", "fins de semana", "feriados"],
};

const germanSecurityOutput: NormalizedJobExtraction = {
  ...englishOutput,
  summary_short:
    "Hotelsicherheit mit Betreuung von Gästen und Überwachung von Systemen.",
  role_title_normalized: "Sicherheitsmitarbeiter",
  requirements: [
    { value: "Erfahrung mit der Verwaltung von CCTV-Systemen", type: "experience", required: true },
    { value: "Verfügbarkeit für Schichten, Wochenenden und Feiertage", type: "constraint", required: true },
  ],
  keywords_canonical: ["Sicherheit", "Gäste", "Schichten"],
  schedule_constraints: ["Schichten", "Wochenenden", "Feiertage"],
};

const technicalEnglishOutput: NormalizedJobExtraction = {
  ...englishOutput,
  summary_short: "Builds SaaS reporting tools with React, SQL, and HIPAA-aware workflows.",
  requirements: [
    { value: "React and TypeScript application development", type: "skill", required: true },
    { value: "SQL data modeling for SaaS analytics", type: "tool", required: true },
    { value: "HIPAA-aware workflow implementation", type: "constraint", required: true },
  ],
  keywords_canonical: ["React", "SQL", "SaaS", "HIPAA", "API"],
  licenses_or_certifications: [],
  schedule_constraints: [],
};

function row(
  overrides: Partial<VisibleJobExtractionShadowRow> = {},
): VisibleJobExtractionShadowRow {
  return {
    llm_normalized_output: baseOutput,
    validation_status: "valid",
    fallback_used: false,
    model: "mistral-small-latest",
    prompt_version: "p9_v2",
    created_at: 100,
    ...overrides,
  };
}

function select(
  overrides: Partial<Parameters<typeof selectVisibleJobExtraction>[0]> = {},
) {
  return selectVisibleJobExtraction({
    flagEnabled: true,
    shadowRows: [row()],
    heuristic: {
      summary: "Heuristic summary",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    },
    rawLanguageDetected: "fr",
    model: "mistral-small-latest",
    promptVersion: "p9_v2",
    ...overrides,
  });
}

describe("selectVisibleJobExtraction", () => {
  it("returns current-policy valid non-fallback LLM output when the flag is on", () => {
    expect(select()).toEqual({
      source: "llm",
      summary: baseOutput.summary_short,
      requirements: ["Coordination opérationnelle", "Gestion de planning"],
      keywords: ["coordination", "planning"],
    });
  });

  it("selects the newest current-policy valid non-fallback row", () => {
    const newest = {
      ...baseOutput,
      summary_short: "Résumé LLM le plus récent.",
    };

    expect(
      select({
        shadowRows: [
          row({ created_at: 100 }),
          row({ created_at: 200, llm_normalized_output: newest }),
        ],
      }).summary,
    ).toBe("Résumé LLM le plus récent.");
  });

  it("falls back for old model rows", () => {
    expect(select({ shadowRows: [row({ model: "old-model" })] })).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("ignores mistral-small-latest rows when current policy is Ministral 3 3B", () => {
    expect(
      select({
        shadowRows: [row({ model: "mistral-small-latest" })],
        model: "ministral-3b-2512",
      }),
    ).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("ignores old p9_v1 rows under the current prompt version", () => {
    expect(
      select({ shadowRows: [row({ prompt_version: "p9_v1" })] }),
    ).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("falls back for invalid rows", () => {
    expect(
      select({ shadowRows: [row({ validation_status: "schema_invalid" })] }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back for fallback-used rows", () => {
    expect(select({ shadowRows: [row({ fallback_used: true })] })).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back for schema-invalid normalized output", () => {
    expect(
      select({ shadowRows: [row({ llm_normalized_output: { summary_short: "ok" } })] }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back when no shadow row exists", () => {
    expect(select({ shadowRows: [] })).toMatchObject({
      source: "heuristic",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    });
  });

  it("falls back when the LLM row is UI-unsafe", () => {
    expect(
      select({
        shadowRows: [
          row({
            llm_normalized_output: {
              ...baseOutput,
              summary_short: "Apply now at https://example.com/jobs",
            },
          }),
        ],
      }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("returns empty when heuristic display data is unavailable", () => {
    expect(
      select({
        flagEnabled: false,
        shadowRows: [],
        heuristic: { summary: "", requirements: [], keywords: [] },
      }),
    ).toEqual({
      source: "empty",
      summary: null,
      requirements: [],
      keywords: [],
    });
  });

  it("keeps a French fixture in French", () => {
    const result = select();

    expect(result.source).toBe("llm");
    expect(result.summary).toContain("Coordonne");
    expect(result.requirements.join(" ")).toContain("opérationnelle");
  });

  it("rejects obvious English translation for a French job", () => {
    expect(
      select({
        shadowRows: [
          row({
            llm_normalized_output: {
              ...baseOutput,
              summary_short: "The role will be responsible for team planning.",
            },
          }),
        ],
      }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("rejects Spanish LLM output for an English source job", () => {
    expect(
      select({
        rawLanguageDetected: "en",
        shadowRows: [row({ llm_normalized_output: spanishSecurityOutput })],
      }),
    ).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    });
  });

  it.each([
    ["Italian", italianSecurityOutput],
    ["Portuguese", portugueseSecurityOutput],
    ["German", germanSecurityOutput],
  ])("rejects %s LLM output for an English source job", (_language, output) => {
    expect(
      select({
        rawLanguageDetected: "en",
        shadowRows: [row({ llm_normalized_output: output })],
      }),
    ).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("accepts English LLM output for an English source job", () => {
    expect(
      select({
        rawLanguageDetected: "en",
        shadowRows: [row({ llm_normalized_output: englishOutput })],
      }),
    ).toEqual({
      source: "llm",
      summary: englishOutput.summary_short,
      requirements: [
        "Monitor CCTV, access control, and alarm systems",
        "Document security incidents in detail",
        "High school diploma or equivalent",
      ],
      keywords: ["hotel security", "CCTV", "access control", "guest safety"],
    });
  });

  it("accepts French LLM output for a French source job", () => {
    const result = select({
      rawLanguageDetected: "fr",
      shadowRows: [row({ llm_normalized_output: baseOutput })],
    });

    expect(result.source).toBe("llm");
    expect(result.summary).toBe(baseOutput.summary_short);
  });

  it.each([
    ["it", italianSecurityOutput],
    ["pt-BR", portugueseSecurityOutput],
    ["de", germanSecurityOutput],
  ])("accepts %s LLM output for a matching source job", (rawLanguageDetected, output) => {
    const result = select({
      rawLanguageDetected,
      shadowRows: [row({ llm_normalized_output: output })],
    });

    expect(result.source).toBe("llm");
    expect(result.summary).toBe(output.summary_short);
  });

  it("does not treat technical acronyms and named codes as wrong-language signals", () => {
    expect(
      select({
        rawLanguageDetected: "en",
        shadowRows: [row({ llm_normalized_output: technicalEnglishOutput })],
      }),
    ).toMatchObject({
      source: "llm",
      keywords: ["React", "SQL", "SaaS", "HIPAA", "API"],
    });
  });

  it("does not reject JavaScript skills as scraper metadata", () => {
    const juniorDeveloperOutput: NormalizedJobExtraction = {
      ...technicalEnglishOutput,
      summary_short:
        "Entry-level Junior Web Developer assisting in coding, design, and maintenance of websites with focus on UX and SEO.",
      role_title_normalized: "Junior Web Developer",
      requirements: [
        { value: "HTML, HTML5", type: "skill", required: true },
        { value: "CSS, CSS3", type: "skill", required: true },
        { value: "JavaScript", type: "skill", required: true },
        { value: "PHP", type: "skill", required: true },
        { value: "WordPress CMS framework", type: "tool", required: true },
      ],
      keywords_canonical: ["javascript", "php", "wordpress", "ux design"],
    };

    expect(
      select({
        rawLanguageDetected: "en",
        shadowRows: [row({ llm_normalized_output: juniorDeveloperOutput })],
      }),
    ).toMatchObject({
      source: "llm",
      requirements: expect.arrayContaining(["JavaScript"]),
      keywords: expect.arrayContaining(["javascript"]),
    });
  });
});

describe("isUiSafeVisibleJobExtraction", () => {
  it("rejects empty requirements when heuristic requirements exist", () => {
    expect(
      isUiSafeVisibleJobExtraction({
        output: { ...baseOutput, requirements: [] },
        heuristicRequirements: ["Heuristic requirement"],
      }),
    ).toBe(false);
  });
});
