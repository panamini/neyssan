import type {
  PremiumCoverLetterContextClass,
  PremiumCoverLetterEligibility,
  PremiumCoverLetterPersonalizationContext,
  PremiumCoverLetterPreset,
} from "../../../../convex/lib/proposals/premiumCoverLetter";
import {
  PROPOSAL_OUTPUT_LANGUAGES,
  type ProposalOutputLanguage,
} from "../../../../convex/lib/proposals/proposalOutput";

export const COVER_LETTER_POLICY_SHADOW_COHORTS = [
  "direct",
  "adjacent",
  "distant",
  "cv_unusable",
  "no_cv",
] as const;

export type CoverLetterPolicyShadowCohort =
  (typeof COVER_LETTER_POLICY_SHADOW_COHORTS)[number];

export type CoverLetterPolicyShadowCase = {
  id: string;
  cohort: CoverLetterPolicyShadowCohort;
  outputLanguage: ProposalOutputLanguage;
  preset: PremiumCoverLetterPreset;
  jobTitle: string;
  jobDescription: string;
  personalizationContext: PremiumCoverLetterPersonalizationContext | null;
  expectedCurrentEligibility: {
    eligible: boolean;
    contextClass?: PremiumCoverLetterContextClass;
    reason?: PremiumCoverLetterEligibility["reason"];
  };
  expectedCandidateCohort:
    | "direct"
    | "adjacent"
    | "distant_cautious"
    | "cv_unusable_job_surface_only"
    | "no_cv_job_surface_only";
  expectedPlanningContextClass: PremiumCoverLetterContextClass;
};

export type CoverLetterPolicyShadowInsufficientCase = Omit<
  CoverLetterPolicyShadowCase,
  "cohort" | "expectedCandidateCohort" | "expectedPlanningContextClass"
> & {
  cohort: "insufficient_input";
  expectedCandidateCohort: "insufficient_input";
  expectedPlanningContextClass?: never;
};

type CohortFixture = Pick<
  CoverLetterPolicyShadowCase,
  | "cohort"
  | "jobTitle"
  | "jobDescription"
  | "personalizationContext"
  | "expectedCurrentEligibility"
  | "expectedCandidateCohort"
  | "expectedPlanningContextClass"
>;

const DIRECT_CONTEXT: PremiumCoverLetterPersonalizationContext = {
  name: "Amina Rahman",
  summary:
    "Revenue operations manager leading pipeline reporting and forecast reviews.",
  topSkills: ["Revenue operations", "Pipeline reporting", "Forecasting"],
  recentExperience: [
    {
      company: "Helix Cloud",
      position: "Revenue Operations Manager",
      highlights: [
        "Improved forecast accuracy by 19% after redesigning pipeline reporting workflows.",
        "Led weekly revenue operations reviews across sales and finance.",
      ],
    },
  ],
};

const ADJACENT_CONTEXT: PremiumCoverLetterPersonalizationContext = {
  name: "Leila Haddad",
  summary:
    "Operations coordinator supporting scheduling, documentation, and vendor follow-through.",
  topSkills: ["Scheduling", "Documentation", "Vendor follow-up"],
  recentExperience: [
    {
      company: "Nexa Services",
      position: "Operations Coordinator",
      highlights: [
        "Coordinated vendor follow-up and maintained weekly status reports.",
        "Documented service handoffs and escalated incomplete requests.",
      ],
    },
  ],
};

const DISTANT_CONTEXT: PremiumCoverLetterPersonalizationContext = {
  name: "Maya Chen",
  summary:
    "Retail supervisor handling store opening, cash reconciliation, and shift scheduling.",
  topSkills: ["Cash reconciliation", "Shift scheduling", "Customer service"],
  recentExperience: [
    {
      company: "North Market",
      position: "Retail Supervisor",
      highlights: [
        "Reduced checkout discrepancies by 12% through a revised till handoff checklist.",
        "Coordinated weekly schedules for a six-person retail team.",
      ],
    },
  ],
};

const COHORT_FIXTURES: readonly CohortFixture[] = [
  {
    cohort: "direct",
    jobTitle: "Revenue Operations Manager",
    jobDescription:
      "Lead revenue operations reporting and pipeline forecast reviews. Coordinate weekly sales and finance reporting.",
    personalizationContext: DIRECT_CONTEXT,
    expectedCurrentEligibility: {
      eligible: true,
      contextClass: "cv_direct",
    },
    expectedCandidateCohort: "direct",
    expectedPlanningContextClass: "cv_direct",
  },
  {
    cohort: "adjacent",
    jobTitle: "Procurement Analyst",
    jobDescription:
      "Coordinate vendor follow-up, maintain purchase status reports, and document supplier handoffs. Escalate incomplete requests.",
    personalizationContext: ADJACENT_CONTEXT,
    expectedCurrentEligibility: {
      eligible: true,
      contextClass: "cv_adjacent",
    },
    expectedCandidateCohort: "adjacent",
    expectedPlanningContextClass: "cv_adjacent",
  },
  {
    cohort: "distant",
    jobTitle: "Marine Biologist",
    jobDescription:
      "Conduct marine field sampling, analyze ocean specimens, and document laboratory findings. Maintain research records.",
    personalizationContext: DISTANT_CONTEXT,
    expectedCurrentEligibility: {
      eligible: false,
      reason: "unsupported_context_class",
    },
    expectedCandidateCohort: "distant_cautious",
    expectedPlanningContextClass: "cv_adjacent",
  },
  {
    cohort: "cv_unusable",
    jobTitle: "Office Coordinator",
    jobDescription:
      "Coordinate office scheduling, maintain service records, and follow up on supplier requests.",
    personalizationContext: { name: "Sophie Martin" },
    expectedCurrentEligibility: {
      eligible: true,
      contextClass: "no_cv",
    },
    expectedCandidateCohort: "cv_unusable_job_surface_only",
    expectedPlanningContextClass: "no_cv",
  },
  {
    cohort: "no_cv",
    jobTitle: "Office Coordinator",
    jobDescription:
      "Coordinate office scheduling, maintain service records, and follow up on supplier requests.",
    personalizationContext: null,
    expectedCurrentEligibility: {
      eligible: true,
      contextClass: "no_cv",
    },
    expectedCandidateCohort: "no_cv_job_surface_only",
    expectedPlanningContextClass: "no_cv",
  },
] as const;

const DISTANT_OFFER_BY_LANGUAGE: Record<
  ProposalOutputLanguage,
  Pick<CoverLetterPolicyShadowCase, "jobTitle" | "jobDescription">
> = {
  English: {
    jobTitle: "Marine Biologist",
    jobDescription:
      "Conduct marine field sampling, analyze ocean specimens, and document laboratory findings. Maintain research records.",
  },
  French: {
    jobTitle: "Biologiste marin",
    jobDescription:
      "Réaliser des prélèvements marins, analyser des spécimens océaniques et documenter les résultats de laboratoire. Tenir les dossiers de recherche.",
  },
  Spanish: {
    jobTitle: "Biólogo marino",
    jobDescription:
      "Realizar muestreos marinos de campo, analizar especímenes oceánicos y documentar los hallazgos de laboratorio. Mantener los registros de investigación.",
  },
  German: {
    jobTitle: "Meeresbiologe",
    jobDescription:
      "Marine Feldproben durchführen, Meeresproben analysieren und Laborergebnisse dokumentieren. Forschungsunterlagen pflegen.",
  },
  Italian: {
    jobTitle: "Biologo marino",
    jobDescription:
      "Eseguire campionamenti marini sul campo, analizzare campioni oceanici e documentare i risultati di laboratorio. Mantenere i registri di ricerca.",
  },
  Portuguese: {
    jobTitle: "Biólogo marinho",
    jobDescription:
      "Realizar amostragem marinha de campo, analisar espécimes oceânicos e documentar resultados laboratoriais. Manter os registos de investigação.",
  },
  Polish: {
    jobTitle: "Biolog morski",
    jobDescription:
      "Prowadzić terenowe pobieranie próbek morskich, analizować okazy oceaniczne i dokumentować wyniki laboratoryjne. Prowadzić dokumentację badań.",
  },
  Dutch: {
    jobTitle: "Marien bioloog",
    jobDescription:
      "Voer mariene veldbemonstering uit, analyseer oceaanmonsters en documenteer laboratoriumbevindingen. Houd onderzoeksgegevens bij.",
  },
  Greek: {
    jobTitle: "Θαλάσσιος βιολόγος",
    jobDescription:
      "Διεξαγωγή θαλάσσιας δειγματοληψίας πεδίου, ανάλυση ωκεάνιων δειγμάτων και τεκμηρίωση εργαστηριακών ευρημάτων. Τήρηση αρχείων έρευνας.",
  },
  Hungarian: {
    jobTitle: "Tengerbiológus",
    jobDescription:
      "Tengeri terepi mintavétel végzése, óceáni minták elemzése és a laboratóriumi eredmények dokumentálása. Kutatási nyilvántartások vezetése.",
  },
  Lithuanian: {
    jobTitle: "Jūrų biologas",
    jobDescription:
      "Atlikti jūrinius lauko mėginių ėmimus, analizuoti vandenyno mėginius ir dokumentuoti laboratorijos rezultatus. Tvarkyti tyrimų įrašus.",
  },
  Estonian: {
    jobTitle: "Merebioloog",
    jobDescription:
      "Teha merelisi väliproovivõtte, analüüsida ookeaniproove ja dokumenteerida laboritulemusi. Hallata uurimisandmeid.",
  },
  Russian: {
    jobTitle: "Морской биолог",
    jobDescription:
      "Проводить морской полевой отбор проб, анализировать океанические образцы и документировать лабораторные результаты. Вести исследовательские записи.",
  },
  Arabic: {
    jobTitle: "عالِم أحياء بحرية",
    jobDescription:
      "إجراء أخذ عينات ميدانية بحرية، وتحليل العينات المحيطية، وتوثيق النتائج المخبرية. حفظ سجلات البحث.",
  },
};

function languageId(language: ProposalOutputLanguage): string {
  return language.toLowerCase().replace(/[^a-z]+/g, "-");
}

export const COVER_LETTER_POLICY_SHADOW_CASES: readonly CoverLetterPolicyShadowCase[] =
  PROPOSAL_OUTPUT_LANGUAGES.flatMap((outputLanguage) =>
    COHORT_FIXTURES.map((fixture) => {
      const localizedDistantOffer =
        fixture.cohort === "distant"
          ? DISTANT_OFFER_BY_LANGUAGE[outputLanguage]
          : null;
      return {
        ...fixture,
        ...localizedDistantOffer,
        id: `policy-shadow-${fixture.cohort}-${languageId(outputLanguage)}`,
        outputLanguage,
        preset: "signature" as const,
      };
    }),
  );

export const COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES: readonly CoverLetterPolicyShadowInsufficientCase[] =
  PROPOSAL_OUTPUT_LANGUAGES.map((outputLanguage) => ({
    id: `policy-shadow-insufficient-${languageId(outputLanguage)}`,
    cohort: "insufficient_input",
    outputLanguage,
    preset: "signature",
    jobTitle: "",
    jobDescription: "",
    personalizationContext: null,
    expectedCurrentEligibility: {
      eligible: false,
      reason: "unsupported_context_class",
    },
    expectedCandidateCohort: "insufficient_input",
  }));
