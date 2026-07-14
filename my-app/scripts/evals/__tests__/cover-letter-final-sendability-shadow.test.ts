import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CoverLetterFinalArtifactShadowPack } from "../cover-letter-final-artifact-attribution-shadow";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import {
  buildCoverLetterFinalSendabilityShadow,
  evaluateCoverLetterFinalSendability,
} from "../cover-letter-final-sendability-shadow";

const job = {
  title: "Customer Success Manager",
  description:
    "Own enterprise account health, lead quarterly business reviews, coordinate onboarding, and build reporting that supports retention and expansion.",
};

const profileEvidence = {
  name: "Priya Sharma",
  summary:
    "Customer success manager building retention through structured onboarding and proactive account management.",
  topSkills: [
    "Account management",
    "Customer onboarding",
    "Stakeholder communication",
    "Health-score reporting",
  ],
  recentExperience: [
    {
      company: "Lumio Health",
      position: "Customer Success Manager",
      highlights: [
        "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        "Managed a portfolio of 40+ enterprise accounts with quarterly business reviews.",
        "Built a customer health-score dashboard used by the CS team to prioritize at-risk accounts.",
      ],
    },
  ],
  standoutAchievements: [
    "Top-performing CSM two consecutive quarters based on NPS and retention metrics.",
  ],
};

const premiumReadyLetter = [
  "Dear Hiring Manager,",
  "For the Customer Success Manager role, Lumio Health's focus on enterprise account health, onboarding, and retention closely matches the work I have led for complex customer portfolios.",
  "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers. I also managed a portfolio of 40+ enterprise accounts through quarterly business reviews, keeping risks and next steps visible to stakeholders.",
  "That experience would help your Customer Success team connect health-score reporting with practical onboarding and account follow-through, so attention stays focused on retention and expansion rather than reactive escalation.",
  "I would welcome a conversation about bringing this retention-focused, evidence-led approach to your enterprise customers.",
  "Sincerely,\nPriya Sharma",
].join("\n\n");

const degradedLetter = [
  "Dear Hiring Manager,",
  "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
  "As a Customer Success Manager at Lumio Health, I managed a portfolio of 40+ enterprise accounts through quarterly business reviews and built a customer health-score dashboard.",
  "I would be glad to discuss the position further.",
  "Sincerely,\nPriya Sharma",
].join("\n\n");

async function buildSourcePack(): Promise<CoverLetterFinalArtifactShadowPack> {
  const buildVariant = (
    label: "A" | "B",
    letter: string,
  ): CoverLetterFinalArtifactShadowPack["entries"][number]["variantA"] => ({
    label,
    letter,
    wordCount: letter.split(/\s+/u).filter(Boolean).length,
    paragraphCount: letter.split(/\n\s*\n/gu).filter(Boolean).length,
  });
  const packBody: Omit<CoverLetterFinalArtifactShadowPack, "packHash"> = {
    version: "cover_letter_final_artifact_shadow_pack_v1",
    cohortId: "quality-eval-2e-final-artifact-attribution-shadow-v1",
    runId: "quality-cl-1-test",
    sourceRef: "3b1e518475148ca0d0db5933121af88afd111653",
    caseId: "blind-en-clean-engaging-direct",
    instructions: [],
    entries: Array.from({ length: 5 }, (_, index) => ({
      pairLabel: `PAIR-${String(index + 1).padStart(3, "0")}`,
      outputLanguage: "English",
      job,
      profileEvidence,
      variantA: buildVariant("A", premiumReadyLetter),
      variantB: buildVariant(
        "B",
        index === 2 ? premiumReadyLetter : degradedLetter,
      ),
      contentHandling: "synthetic_untrusted_text" as const,
    })),
  };
  return {
    ...packBody,
    packHash: await buildStableHash({
      namespace: "cover-letter-final-artifact-attribution-shadow",
      type: "blind-pack",
      version: 1,
      content: packBody,
    }),
  };
}

describe("QUALITY-CL-1 final-sendability shadow", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("classifies a complete final-visible letter as PREMIUM_READY", async () => {
    const result = await evaluateCoverLetterFinalSendability({
      content: premiumReadyLetter,
      outputLanguage: "English",
      job,
      profileEvidence,
    });

    expect(result.inputScope).toBe("final_visible_artifact_only");
    expect(result.verdict).toBe("PREMIUM_READY");
    expect(result.hardIssues).toEqual([]);
    expect(result.reviewIssues).toEqual([]);
    expect(result.stats.bodyParagraphCount).toBe(4);
    expect(result).not.toHaveProperty("content");
    expect(result).not.toHaveProperty("bodyParts");
  });

  it("hard-blocks visible section loss without consulting structured body parts", async () => {
    const result = await evaluateCoverLetterFinalSendability({
      content: degradedLetter,
      outputLanguage: "English",
      job,
      profileEvidence,
    });

    expect(result.verdict).toBe("HARD_BLOCKED");
    expect(result.hardIssues).toContain("visible_structure_loss_signature");
    expect(result.reviewIssues).toContain("generic_closing");
    expect(result.stats.bodyParagraphCount).toBe(3);
  });

  it.each([
    {
      name: "unreadable export text",
      content: `${premiumReadyLetter}\u0000`,
      outputLanguage: "English",
      expected: "unreadable_export",
    },
    {
      name: "wrong visible language",
      content: [
        "Bonjour,",
        "Je vous adresse ma candidature pour ce poste dans votre entreprise.",
        "Mon expérience en gestion de comptes soutient une intégration structurée.",
        "Cette expérience répond aux besoins de votre équipe et de vos clients.",
        "Je serais ravie d'échanger avec vous au sujet de cette candidature.",
        "Cordialement,\nPriya Sharma",
      ].join("\n\n"),
      outputLanguage: "English",
      expected: "wrong_language",
    },
    {
      name: "truncated final prose",
      content: premiumReadyLetter.replace(
        "I would welcome a conversation about bringing this retention-focused, evidence-led approach to your enterprise customers.",
        "I would bring this retention-focused approach and",
      ),
      outputLanguage: "English",
      expected: "truncated_or_fragmented",
    },
    {
      name: "invented numeric specificity",
      content: premiumReadyLetter.replace("18%", "73%"),
      outputLanguage: "English",
      expected: "unsupported_specificity",
    },
  ])("hard-blocks $name from final-visible evidence", async (testCase) => {
    const result = await evaluateCoverLetterFinalSendability({
      content: testCase.content,
      outputLanguage: testCase.outputLanguage,
      job,
      profileEvidence,
    });

    expect(result.verdict).toBe("HARD_BLOCKED");
    expect(result.hardIssues).toContain(testCase.expected);
  });

  it("keeps stylistic weaknesses in REVIEW_REQUIRED rather than a hard block", async () => {
    const reviewLetter = [
      "Dear Hiring Manager,",
      "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
      "Managed a portfolio of 40+ enterprise accounts with quarterly business reviews and built a customer health-score dashboard used by the CS team to prioritize at-risk accounts.",
      "That reporting keeps the CS team focused on retention and expansion.",
      "I bring experience in retention strategy, account management, and health-score reporting.",
      "I would be glad to discuss the position further.",
      "Sincerely,\nPriya Sharma",
    ].join("\n\n");
    const result = await evaluateCoverLetterFinalSendability({
      content: reviewLetter,
      outputLanguage: "English",
      job,
      profileEvidence,
    });

    expect(result.verdict).toBe("REVIEW_REQUIRED");
    expect(result.hardIssues).toEqual([]);
    expect(result.reviewIssues).toEqual(
      expect.arrayContaining(["abrupt_opening", "generic_closing"]),
    );
  });

  it("does not hard-block a substantive three-paragraph letter by count alone", async () => {
    const threeParagraphLetter = [
      "Dear Hiring Manager,",
      "For the Customer Success Manager role, your focus on enterprise account health and retention matches the customer portfolios I have supported.",
      "I improved 90-day retention by 18% through stronger onboarding checkpoints and managed 40+ enterprise accounts through quarterly business reviews, keeping account risks and follow-through visible.",
      "That experience would help your team connect health-score reporting with practical retention and expansion work, and I would welcome a conversation about contributing that approach.",
      "Sincerely,\nPriya Sharma",
    ].join("\n\n");
    const result = await evaluateCoverLetterFinalSendability({
      content: threeParagraphLetter,
      outputLanguage: "English",
      job,
      profileEvidence,
    });

    expect(result.verdict).toBe("REVIEW_REQUIRED");
    expect(result.hardIssues).not.toContain("visible_structure_loss_signature");
    expect(result.stats.bodyParagraphCount).toBe(3);
  });

  it("projects the blinded five-pair pack with exactly four hard blocks and no provider clues", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in QUALITY-CL-1");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await buildCoverLetterFinalSendabilityShadow({
      sourcePack: await buildSourcePack(),
    });
    const second = await buildCoverLetterFinalSendabilityShadow({
      sourcePack: await buildSourcePack(),
    });

    expect(first.summary).toEqual({
      totalVariants: 10,
      hardBlocked: 4,
      reviewRequired: 0,
      premiumReady: 6,
    });
    expect(first.entries).toHaveLength(5);
    expect(first.shadowHash).toBe(second.shadowHash);
    expect(first.providerCalls).toBe(0);
    expect(first.modelRepairs).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("Priya Sharma");
    expect(serialized).not.toMatch(
      /requestedModel|returnedModel|providerName|sdk|token|cost/u,
    );
  });

  it("rejects a non-exact public 2E pack before evaluation", async () => {
    const sourcePack = await buildSourcePack();
    const duplicatePairPack: CoverLetterFinalArtifactShadowPack = {
      ...sourcePack,
      entries: sourcePack.entries.map((entry, index) =>
        index === 4 ? { ...entry, pairLabel: "PAIR-004" } : entry,
      ),
    };

    await expect(
      buildCoverLetterFinalSendabilityShadow({
        sourcePack: duplicatePairPack,
      }),
    ).rejects.toThrow(
      "QUALITY-CL-1 requires one exact five-pair QUALITY-EVAL-2E public pack.",
    );
  });

  it("rejects public pack content that does not match its embedded hash", async () => {
    const sourcePack = await buildSourcePack();
    const driftedPack: CoverLetterFinalArtifactShadowPack = {
      ...sourcePack,
      entries: sourcePack.entries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              variantA: {
                ...entry.variantA,
                letter: `${entry.variantA.letter} Changed after hashing.`,
              },
            }
          : entry,
      ),
    };

    await expect(
      buildCoverLetterFinalSendabilityShadow({ sourcePack: driftedPack }),
    ).rejects.toThrow("QUALITY-CL-1 source public pack hash drifted.");
  });
});
