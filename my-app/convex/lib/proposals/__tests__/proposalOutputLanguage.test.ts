import { describe, expect, it } from "vitest";
import {
  buildProposalOutputLanguageInstruction,
  getCoverLetterClosingInstruction,
  getCoverLetterSalutationInstruction,
  getDeterministicCopyLanguage,
  resolveProposalOutputLanguageFromCode,
  resolveProposalPlannerOutputLanguageFromCode,
} from "../proposalOutput";
import {
  applyDeterministicProposalBoundaries,
  getDeterministicProposalRenderPolicy,
} from "../proposalRenderer";
import { getDeterministicInterestOnlyRepairSentence } from "../proposalEnforcement";
import { renderPremiumCoverLetter } from "../premiumCoverLetter";

describe("proposal output language", () => {
  it("maps document language codes to writer and planner language contracts", () => {
    expect(resolveProposalOutputLanguageFromCode("fr")).toBe("French");
    expect(resolveProposalOutputLanguageFromCode("ru")).toBe("Russian");
    expect(resolveProposalOutputLanguageFromCode("ar")).toBe("Arabic");
    expect(resolveProposalPlannerOutputLanguageFromCode("de")).toBe("de");
    expect(resolveProposalPlannerOutputLanguageFromCode("ga")).toBeNull();
    expect(getDeterministicCopyLanguage("en")).toBe("en");
    expect(getDeterministicCopyLanguage("French")).toBe("fr");
    expect(getDeterministicCopyLanguage("ru")).toBeNull();
  });

  it("builds explicit non-UI language instructions for generated documents", () => {
    expect(buildProposalOutputLanguageInstruction("Russian")).toContain(
      "Write the generated text in Russian.",
    );
    expect(buildProposalOutputLanguageInstruction("Arabic")).toContain(
      "Use natural right-to-left Arabic prose",
    );
  });

  it("keeps English and French deterministic cover-letter boundary copy unchanged", () => {
    expect(
      getDeterministicProposalRenderPolicy({
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toMatchObject({
      salutation: "Dear Hiring Manager,",
      signOff: "Sincerely,",
      finalSentence:
        "I would welcome the opportunity to discuss the position further.",
      includeCandidateNameLine: true,
    });

    expect(
      getDeterministicProposalRenderPolicy({
        format: "cover_letter",
        outputLanguage: "French",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toMatchObject({
      salutation: "Madame, Monsieur,",
      signOff:
        "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      finalSentence:
        "Je serais disponible pour échanger davantage au sujet du poste.",
      includeCandidateNameLine: true,
    });
  });

  it("does not inject English deterministic copy for Russian or Arabic documents", () => {
    const russian = applyDeterministicProposalBoundaries({
      body: "Сгенерированный текст остается как есть.",
      format: "cover_letter",
      outputLanguage: "Russian",
      voicePreset: "signature",
      noContextMode: false,
      candidateName: "Alex Martin",
    });
    const arabic = renderPremiumCoverLetter({
      outputLanguage: "Arabic",
      candidateName: "Alex Martin",
      bodyParts: {
        opening: "نص عربي تجريبي.",
        proofBlock: "يبقى النص من النموذج.",
        employerValueBlock: "",
        closeLine: "",
      },
    }).content;

    expect(russian).not.toContain("Dear Hiring Manager");
    expect(russian).not.toContain("Sincerely");
    expect(russian).not.toContain("I would welcome");
    expect(arabic).not.toContain("Dear Hiring Manager");
    expect(arabic).not.toContain("Sincerely");
    expect(arabic).not.toContain("I would welcome");
    expect(getDeterministicInterestOnlyRepairSentence("Russian")).toBeNull();
  });

  it("uses model instructions, not English examples, for non-deterministic cover-letter boundaries", () => {
    expect(getCoverLetterSalutationInstruction("German")).toBe(
      "Start with a professional salutation in German.",
    );
    expect(getCoverLetterSalutationInstruction("German")).not.toContain("Dear");
    expect(getCoverLetterClosingInstruction("German")).toBe(
      "End with a simple professional closing in German, and the candidate name on the final line.",
    );
    expect(getCoverLetterClosingInstruction("German")).not.toContain(
      "Sincerely",
    );
  });
});
