import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import type { CoverLetterFinalArtifactShadowPack } from "../cover-letter-final-artifact-attribution-shadow";
import type { CoverLetterQualitativeSamplePack } from "../cover-letter-qualitative-sample";
import {
  buildCoverLetterStructureAwareFinalizerCanary,
  finalizeCoverLetterStructureAwareCandidate,
} from "../cover-letter-structure-aware-finalizer-canary";

const { TRUSTED_QUALITATIVE_PACK_HASH, TRUSTED_FINAL_ARTIFACT_PACK_HASH } =
  vi.hoisted(() => ({
    TRUSTED_QUALITATIVE_PACK_HASH:
      "2406c5e85f6bf5c9779180f86939cb3e14448da7e022b33c9aae85144bc06eae",
    TRUSTED_FINAL_ARTIFACT_PACK_HASH:
      "4bf698ea8166e721dc3c7e12b47b95e921f936cf6c4815878bebd08384ac8894",
  }));
const TRUSTED_SOURCE_REF = "07b2c3e136f4d9062dd28c90a22afbe257e68778";

vi.mock(
  "../../../src/modules/application-harness/fingerprints",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../src/modules/application-harness/fingerprints")
      >();
    return {
      ...actual,
      buildStableHash: async (
        args: Parameters<typeof actual.buildStableHash>[0],
      ) => {
        if (args.namespace === "cover-letter-qualitative-sample") {
          return TRUSTED_QUALITATIVE_PACK_HASH;
        }
        if (
          args.namespace === "cover-letter-final-artifact-attribution-shadow"
        ) {
          return TRUSTED_FINAL_ARTIFACT_PACK_HASH;
        }
        return actual.buildStableHash(args);
      },
    };
  },
);

const job = {
  title: "Customer Success Manager",
  description:
    "Own enterprise account health, lead quarterly business reviews, coordinate onboarding, and build reporting that supports retention and expansion.",
  sourceLanguage: "English" as const,
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

const candidateLetter = [
  "Dear Hiring Manager,",
  "For the Customer Success Manager role, your focus on enterprise account health and retention matches the customer portfolios I have supported.",
  "I improved 90-day retention by 18% through stronger onboarding checkpoints and managed 40+ enterprise accounts through quarterly business reviews, keeping account risks and follow-through visible.",
  "That experience would help your team connect health-score reporting with practical retention and expansion work.",
  "I would welcome a conversation about contributing that structured, retention-focused approach to your customers.",
  "Sincerely,\nPriya Sharma",
].join("\n\n");

const expectedBodyParts = {
  opening:
    "For the Customer Success Manager role, your focus on enterprise account health and retention matches the customer portfolios I have supported.",
  proofBlock:
    "I improved 90-day retention by 18% through stronger onboarding checkpoints and managed 40+ enterprise accounts through quarterly business reviews, keeping account risks and follow-through visible.",
  employerValueBlock:
    "That experience would help your team connect health-score reporting with practical retention and expansion work.",
  closeLine:
    "I would welcome a conversation about contributing that structured, retention-focused approach to your customers.",
} as const;

const parsedCandidate = {
  version: "premium_writer_output_v1",
  bodyParts: Object.fromEntries(
    Object.entries(expectedBodyParts).map(([section, text]) => [
      section,
      { section, text, claimIds: [], factIds: [], demandIds: [] },
    ]),
  ),
};

function buildBaseline(index: number): string {
  if (index === 4) {
    return [
      "Dear Hiring Manager,",
      "For the Customer Success Manager role, your retention priorities match the enterprise portfolios I have supported.",
      "I improved 90-day retention by 18% through stronger onboarding checkpoints and managed 40+ enterprise accounts through quarterly business reviews.",
      "That background would support practical account-health reporting and consistent follow-through for your team.",
      "I would welcome a conversation about bringing that approach to your customers.",
      "Sincerely,\nPriya Sharma",
    ].join("\n\n");
  }
  const proof = [
    "I improved 90-day retention by 18% through stronger onboarding checkpoints.",
    "I managed 40+ enterprise accounts through quarterly business reviews.",
    "I built a customer health-score dashboard for at-risk accounts.",
    "I coordinated onboarding checkpoints and account follow-through.",
  ][index]!;
  return [
    "Dear Hiring Manager,",
    proof,
    "Relevant background supports customer retention and account health.",
    "I would be glad to discuss the position further.",
    "Sincerely,\nPriya Sharma",
  ].join("\n\n");
}

async function buildReviewerSafePacks(
  options: Readonly<{ authoritative?: boolean }> = {},
): Promise<{
  qualitativePack: CoverLetterQualitativeSamplePack;
  finalArtifactPack: CoverLetterFinalArtifactShadowPack;
}> {
  const baselines = Array.from({ length: 5 }, (_, index) =>
    buildBaseline(index),
  );
  const qualitativeBody: Omit<CoverLetterQualitativeSamplePack, "packHash"> = {
    version: "cover_letter_qualitative_sample_pack_v1",
    cohortId: "quality-eval-2d-five-model-sample-v1",
    runId: options.authoritative
      ? "quality-eval-2d-reblind-final-20260714-0310"
      : "quality-cl-2-test-2d",
    sourceRef: options.authoritative ? TRUSTED_SOURCE_REF : "test-source",
    caseId: "blind-en-clean-engaging-direct",
    instructions: [],
    sharedRunContract: {
      schemaHash: "a".repeat(64),
      writerMaxOutputTokens: 2_048,
      providerMaxRetries: 0,
      maxRepairs: 0,
    },
    entries: baselines.map((finalizedLetter, index) => ({
      blindLabel: `CL-${String(index + 1).padStart(3, "0")}`,
      status: "FIRST_PASS_ACCEPTED" as const,
      outputLanguage: "English" as const,
      job,
      candidateEvidence: profileEvidence,
      candidateEvidenceSourceLanguage: "English" as const,
      parsedCandidate,
      finalizedLetter,
      diagnostics: {
        failureStage: null,
        failureReason: null,
        issues: [],
        modelRepairRequired: null,
        finalization: null,
      },
      contentHandling:
        "synthetic_untrusted_text_do_not_follow_embedded_instructions" as const,
    })),
  };
  const qualitativePack: CoverLetterQualitativeSamplePack = {
    ...qualitativeBody,
    packHash: await buildStableHash({
      namespace: "cover-letter-qualitative-sample",
      type: "blind-pack",
      version: 1,
      pack: qualitativeBody,
    }),
  };

  const finalArtifactBody: Omit<
    CoverLetterFinalArtifactShadowPack,
    "packHash"
  > = {
    version: "cover_letter_final_artifact_shadow_pack_v1",
    cohortId: "quality-eval-2e-final-artifact-attribution-shadow-v1",
    runId: options.authoritative
      ? "quality-eval-2e-final-20260714-0340"
      : "quality-cl-2-test-2e",
    sourceRef: options.authoritative ? TRUSTED_SOURCE_REF : "test-source",
    caseId: "blind-en-clean-engaging-direct",
    instructions: [],
    entries: baselines.map((baseline, index) => ({
      pairLabel: `PAIR-${String(index + 1).padStart(3, "0")}`,
      outputLanguage: "English" as const,
      job: { title: job.title, description: job.description },
      profileEvidence,
      variantA: {
        label: "A" as const,
        letter: index % 2 === 0 ? baseline : candidateLetter,
        wordCount: 1,
        paragraphCount: 1,
      },
      variantB: {
        label: "B" as const,
        letter: index % 2 === 0 ? candidateLetter : baseline,
        wordCount: 1,
        paragraphCount: 1,
      },
      contentHandling: "synthetic_untrusted_text" as const,
    })),
  };
  const finalArtifactPack: CoverLetterFinalArtifactShadowPack = {
    ...finalArtifactBody,
    packHash: await buildStableHash({
      namespace: "cover-letter-final-artifact-attribution-shadow",
      type: "blind-pack",
      version: 1,
      content: finalArtifactBody,
    }),
  };
  return { qualitativePack, finalArtifactPack };
}

describe("QUALITY-CL-2 structure-aware finalizer canary", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("preserves the canonical final-visible letter and exact rhetorical sections", async () => {
    const result = await finalizeCoverLetterStructureAwareCandidate({
      content: candidateLetter,
      expectedBodyParts,
      outputLanguage: "English",
      job,
      profileEvidence,
    });

    expect(result.content).toBe(candidateLetter);
    expect(result.sections).toEqual([
      { type: "text", content: candidateLetter },
    ]);
    expect(result.rhetoricalOrder).toEqual([
      "opening",
      "proofBlock",
      "employerValueBlock",
      "closeLine",
    ]);
    expect(result.visibleProvenance.inputScope).toBe(
      "final_visible_artifact_only",
    );
    expect(
      result.visibleProvenance.sections.map((section) => section.section),
    ).toEqual(result.rhetoricalOrder);
    expect(result.sendability.inputScope).toBe("final_visible_artifact_only");
    expect(result.sendability.verdict).not.toBe("HARD_BLOCKED");
    expect(result.providerCalls).toBe(0);
    expect(result.retries).toBe(0);
    expect(result.repairs).toBe(0);
  });

  it.each([
    {
      name: "section loss",
      content: candidateLetter.replace(
        /\n\nThat experience would help[^\n]+/u,
        "",
      ),
      expected: /exactly four final-visible body sections/iu,
    },
    {
      name: "truncated fragment",
      content: candidateLetter.replace(
        "I would welcome a conversation about contributing that structured, retention-focused approach to your customers.",
        "I would contribute that structured approach and",
      ),
      expected: /truncated or fragmented/iu,
    },
    {
      name: "structured metadata",
      content: candidateLetter.replace(
        "That experience would help your team",
        "claimIds: [claim_001]. That experience would help your team",
      ),
      expected: /metadata/iu,
    },
    {
      name: "quoted structured metadata",
      content: candidateLetter.replace(
        "That experience would help your team",
        '{"claimIds":["claim_001"]}. That experience would help your team',
      ),
      expected: /metadata/iu,
    },
    {
      name: "YAML structured metadata",
      content: candidateLetter.replace(
        "That experience would help your team",
        "claimIds:\n- claim_001\nThat experience would help your team",
      ),
      expected: /metadata/iu,
    },
    {
      name: "version-only structured metadata",
      content: candidateLetter.replace(
        "That experience would help your team",
        '"version":"premium_writer_output_v1". That experience would help your team',
      ),
      expected: /metadata/iu,
    },
    {
      name: "unreadable content",
      content: candidateLetter.replace(
        "retention matches",
        "retention\u0000 matches",
      ),
      expected: /unreadable/iu,
    },
    {
      name: "lone surrogate",
      content: candidateLetter.replace(
        "retention matches",
        "retention\ud800 matches",
      ),
      expected: /unreadable/iu,
    },
    {
      name: "DEL control",
      content: candidateLetter.replace(
        "retention matches",
        "retention\u007f matches",
      ),
      expected: /unreadable/iu,
    },
    {
      name: "C1 control",
      content: candidateLetter.replace(
        "retention matches",
        "retention\u0085 matches",
      ),
      expected: /unreadable/iu,
    },
  ])("fails closed on $name", async ({ content, expected }) => {
    await expect(
      finalizeCoverLetterStructureAwareCandidate({
        content,
        expectedBodyParts,
        outputLanguage: "English",
        job,
        profileEvidence,
      }),
    ).rejects.toThrow(expected);
  });

  it("fails closed when complete paragraphs are assigned to the wrong rhetorical roles", async () => {
    const paragraphs = candidateLetter.split("\n\n");
    const reordered = [
      paragraphs[0],
      paragraphs[2],
      paragraphs[1],
      paragraphs[3],
      paragraphs[4],
      paragraphs[5],
    ].join("\n\n");

    await expect(
      finalizeCoverLetterStructureAwareCandidate({
        content: reordered,
        expectedBodyParts,
        outputLanguage: "English",
        job,
        profileEvidence,
      }),
    ).rejects.toThrow(/reordered or misattributed/iu);
  });

  it("fails closed when a complete trusted sentence is deleted", async () => {
    const extendedExpectedBodyParts = {
      ...expectedBodyParts,
      proofBlock: `${expectedBodyParts.proofBlock} I also built a health-score dashboard for at-risk accounts.`,
    };

    await expect(
      finalizeCoverLetterStructureAwareCandidate({
        content: candidateLetter,
        expectedBodyParts: extendedExpectedBodyParts,
        outputLanguage: "English",
        job,
        profileEvidence,
      }),
    ).rejects.toThrow(/reordered or misattributed proofBlock/iu);
  });

  it("fails closed on a whitespace-only visible mutation", async () => {
    await expect(
      finalizeCoverLetterStructureAwareCandidate({
        content: candidateLetter.replace(
          "retention matches",
          "retention  matches",
        ),
        expectedBodyParts,
        outputLanguage: "English",
        job,
        profileEvidence,
      }),
    ).rejects.toThrow(/non-canonical or mutated final-visible content/iu);
  });

  it("finalizes deterministic five-cell candidates without provider calls", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in QUALITY-CL-2");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const first = await Promise.all(
      Array.from({ length: 5 }, () =>
        finalizeCoverLetterStructureAwareCandidate({
          content: candidateLetter,
          expectedBodyParts,
          outputLanguage: "English",
          job,
          profileEvidence,
        }),
      ),
    );
    const second = await Promise.all(
      Array.from({ length: 5 }, () =>
        finalizeCoverLetterStructureAwareCandidate({
          content: candidateLetter,
          expectedBodyParts,
          outputLanguage: "English",
          job,
          profileEvidence,
        }),
      ),
    );

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.every((entry) => entry.providerCalls === 0)).toBe(true);
    expect(first.every((entry) => entry.retries === 0)).toBe(true);
    expect(first.every((entry) => entry.repairs === 0)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(first)).not.toMatch(
      /gpt-|mistral|openai|requestedModel|returnedModel|providerName|sdk|token|cost|reveal/iu,
    );
  });

  it("builds the exact deterministic five-pack canary contract", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in QUALITY-CL-2");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const packs = await buildReviewerSafePacks({ authoritative: true });

    const first = await buildCoverLetterStructureAwareFinalizerCanary(packs);
    const second = await buildCoverLetterStructureAwareFinalizerCanary(packs);

    expect(first).toEqual(second);
    expect(first.entries).toHaveLength(5);
    expect(first.summary).toEqual({
      totalPairs: 5,
      trustedStructuredSectionTextPreservedCandidates: 5,
      baselineHardBlocked: 4,
      candidateHardBlocked: 0,
      candidateReviewRequired: 5,
      candidatePremiumReady: 0,
    });
    expect(
      first.entries.every(
        (entry) => entry.trustedStructuredSectionTextPreserved === true,
      ),
    ).toBe(true);
    expect(first.providerCalls).toBe(0);
    expect(first.retries).toBe(0);
    expect(first.repairs).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(first)).not.toMatch(
      /gpt-|mistral|openai|requestedModel|returnedModel|providerName|sdk|token|cost|reveal/iu,
    );
  });

  it("accepts only deterministic repetition cleanup between structured source and finalizer boundary", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstEntry = packs.qualitativePack.entries[0]!;
    const sourceBodyParts = firstEntry.parsedCandidate.bodyParts as Record<
      string,
      Readonly<{ section: string; text: string }>
    >;
    const opening = sourceBodyParts.opening!;
    const proofBlock = sourceBodyParts.proofBlock!;
    const stopwordVariant = opening.text
      .replace("For the ", "This ")
      .replace("your focus", "focus")
      .replace("I have supported", "I supported");
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: [
        {
          ...firstEntry,
          parsedCandidate: {
            ...firstEntry.parsedCandidate,
            bodyParts: {
              ...sourceBodyParts,
              proofBlock: {
                ...proofBlock,
                text: `${proofBlock.text} ${stopwordVariant}`,
              },
            },
          },
        },
        ...packs.qualitativePack.entries.slice(1),
      ],
    } as CoverLetterQualitativeSamplePack;

    const result = await buildCoverLetterStructureAwareFinalizerCanary({
      qualitativePack,
      finalArtifactPack: packs.finalArtifactPack,
    });

    expect(result.entries[0]!.structureAwareCanary.content).toBe(
      candidateLetter,
    );
  });

  it("mirrors production splitting before lowercase sentence starts", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstEntry = packs.qualitativePack.entries[0]!;
    const firstPair = packs.finalArtifactPack.entries[0]!;
    const sourceBodyParts = firstEntry.parsedCandidate.bodyParts as Record<
      string,
      Readonly<{ section: string; text: string }>
    >;
    const opening = sourceBodyParts.opening!;
    const proofBlock = sourceBodyParts.proofBlock!;
    const stopwordVariant = opening.text
      .replace("For the ", "This ")
      .replace("your focus", "focus")
      .replace("I have supported", "I supported");
    const lowercaseSentence =
      "a lowercase continuation remains visible after repetition cleanup.";
    const expectedProof = `${proofBlock.text} ${lowercaseSentence}`;
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: [
        {
          ...firstEntry,
          parsedCandidate: {
            ...firstEntry.parsedCandidate,
            bodyParts: {
              ...sourceBodyParts,
              proofBlock: {
                ...proofBlock,
                text: `${proofBlock.text} ${stopwordVariant} ${lowercaseSentence}`,
              },
            },
          },
        },
        ...packs.qualitativePack.entries.slice(1),
      ],
    } as CoverLetterQualitativeSamplePack;
    const expectedLetter = firstPair.variantB.letter.replace(
      proofBlock.text,
      expectedProof,
    );
    const finalArtifactPack = {
      ...packs.finalArtifactPack,
      entries: [
        {
          ...firstPair,
          variantB: { ...firstPair.variantB, letter: expectedLetter },
        },
        ...packs.finalArtifactPack.entries.slice(1),
      ],
    } as CoverLetterFinalArtifactShadowPack;

    const result = await buildCoverLetterStructureAwareFinalizerCanary({
      qualitativePack,
      finalArtifactPack,
    });
    expect(result.entries[0]!.structureAwareCanary.content).toBe(
      expectedLetter,
    );
  });

  it("preserves duplicates within one body part like production", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstEntry = packs.qualitativePack.entries[0]!;
    const firstPair = packs.finalArtifactPack.entries[0]!;
    const sourceBodyParts = firstEntry.parsedCandidate.bodyParts as Record<
      string,
      Readonly<{ section: string; text: string }>
    >;
    const proofBlock = sourceBodyParts.proofBlock!;
    const repeatedProof = `${proofBlock.text} ${proofBlock.text}`;
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: [
        {
          ...firstEntry,
          parsedCandidate: {
            ...firstEntry.parsedCandidate,
            bodyParts: {
              ...sourceBodyParts,
              proofBlock: { ...proofBlock, text: repeatedProof },
            },
          },
        },
        ...packs.qualitativePack.entries.slice(1),
      ],
    } as CoverLetterQualitativeSamplePack;
    const expectedLetter = firstPair.variantB.letter.replace(
      proofBlock.text,
      repeatedProof,
    );
    const finalArtifactPack = {
      ...packs.finalArtifactPack,
      entries: [
        {
          ...firstPair,
          variantB: { ...firstPair.variantB, letter: expectedLetter },
        },
        ...packs.finalArtifactPack.entries.slice(1),
      ],
    } as CoverLetterFinalArtifactShadowPack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack,
        finalArtifactPack,
      }),
    ).resolves.toMatchObject({ providerCalls: 0, retries: 0, repairs: 0 });
  });

  it("uses the production fallback when an entire body part repeats earlier text", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstEntry = packs.qualitativePack.entries[0]!;
    const firstPair = packs.finalArtifactPack.entries[0]!;
    const sourceBodyParts = firstEntry.parsedCandidate.bodyParts as Record<
      string,
      Readonly<{ section: string; text: string }>
    >;
    const opening = sourceBodyParts.opening!;
    const proofBlock = sourceBodyParts.proofBlock!;
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: [
        {
          ...firstEntry,
          parsedCandidate: {
            ...firstEntry.parsedCandidate,
            bodyParts: {
              ...sourceBodyParts,
              proofBlock: { ...proofBlock, text: opening.text },
            },
          },
        },
        ...packs.qualitativePack.entries.slice(1),
      ],
    } as CoverLetterQualitativeSamplePack;
    const expectedLetter = firstPair.variantB.letter.replace(
      proofBlock.text,
      opening.text,
    );
    const finalArtifactPack = {
      ...packs.finalArtifactPack,
      entries: [
        {
          ...firstPair,
          variantB: { ...firstPair.variantB, letter: expectedLetter },
        },
        ...packs.finalArtifactPack.entries.slice(1),
      ],
    } as CoverLetterFinalArtifactShadowPack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack,
        finalArtifactPack,
      }),
    ).resolves.toMatchObject({ providerCalls: 0, retries: 0, repairs: 0 });
  });

  it("rejects a finalizer-boundary variant that lost a unique trusted structured sentence", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstEntry = packs.qualitativePack.entries[0]!;
    const sourceBodyParts = firstEntry.parsedCandidate.bodyParts as Record<
      string,
      Readonly<{ section: string; text: string }>
    >;
    const proofBlock = sourceBodyParts.proofBlock!;
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: [
        {
          ...firstEntry,
          parsedCandidate: {
            ...firstEntry.parsedCandidate,
            bodyParts: {
              ...sourceBodyParts,
              proofBlock: {
                ...proofBlock,
                text: `${proofBlock.text} This unique trusted sentence must survive the finalizer boundary.`,
              },
            },
          },
        },
        ...packs.qualitativePack.entries.slice(1),
      ],
    } as CoverLetterQualitativeSamplePack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack,
        finalArtifactPack: packs.finalArtifactPack,
      }),
    ).rejects.toThrow(/deterministic trusted-source projection/iu);
  });

  it("accepts semantically identical reviewer context with different object key order", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstPair = packs.finalArtifactPack.entries[0]!;
    const reorderedProfileEvidence = Object.fromEntries(
      Object.entries(firstPair.profileEvidence).reverse(),
    ) as typeof firstPair.profileEvidence;
    const finalArtifactPack = {
      ...packs.finalArtifactPack,
      entries: [
        { ...firstPair, profileEvidence: reorderedProfileEvidence },
        ...packs.finalArtifactPack.entries.slice(1),
      ],
    } as CoverLetterFinalArtifactShadowPack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack: packs.qualitativePack,
        finalArtifactPack,
      }),
    ).resolves.toMatchObject({ providerCalls: 0, retries: 0, repairs: 0 });
  });

  it("fails closed on whitespace drift in the trusted finalizer-boundary variant", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const firstPair = packs.finalArtifactPack.entries[0]!;
    const finalArtifactPack = {
      ...packs.finalArtifactPack,
      entries: [
        {
          ...firstPair,
          variantB: {
            ...firstPair.variantB,
            letter: firstPair.variantB.letter.replace(
              "Customer Success Manager",
              "Customer  Success Manager",
            ),
          },
        },
        ...packs.finalArtifactPack.entries.slice(1),
      ],
    } as CoverLetterFinalArtifactShadowPack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack: packs.qualitativePack,
        finalArtifactPack,
      }),
    ).rejects.toThrow(/non-canonical or mutated final-visible content/iu);
  });

  it("rejects non-English packs outside the pinned five-cell cohort", async () => {
    const packs = await buildReviewerSafePacks({ authoritative: true });
    const qualitativePack = {
      ...packs.qualitativePack,
      entries: packs.qualitativePack.entries.map((entry) => ({
        ...entry,
        outputLanguage: "French" as const,
      })),
    } as CoverLetterQualitativeSamplePack;

    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        qualitativePack,
        finalArtifactPack: packs.finalArtifactPack,
      }),
    ).rejects.toThrow(/exact reviewer-safe five-cell/iu);
  });

  it("rejects self-consistent but non-authoritative reviewer-safe source packs", async () => {
    const packs = await buildReviewerSafePacks();
    await expect(
      buildCoverLetterStructureAwareFinalizerCanary({
        ...packs,
      }),
    ).rejects.toThrow(/exact reviewer-safe five-cell/iu);
  });
});
