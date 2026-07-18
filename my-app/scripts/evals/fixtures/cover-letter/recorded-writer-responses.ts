import { z } from "zod";

import {
  PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA,
  PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
} from "../../../../convex/lib/proposals/premiumCoverLetter";
import { PROPOSAL_OUTPUT_LANGUAGES } from "../../../../convex/lib/proposals/proposalOutput";

export const COVER_LETTER_REPLAY_FIXTURE_VERSION =
  "cover_letter_replay_fixture_v1" as const;

const recordedWriterPromptHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const recordedWriterResponseSchema = z.discriminatedUnion("schemaId", [
  z
    .object({
      schemaId: z.literal("premium_writer_output_v1"),
      expectedWriterPromptHash: recordedWriterPromptHashSchema,
      payload: PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
    })
    .strict(),
  z
    .object({
      schemaId: z.literal("premium_cover_letter_body_parts"),
      expectedWriterPromptHash: recordedWriterPromptHashSchema,
      payload: PREMIUM_COVER_LETTER_BODY_PARTS_SCHEMA,
    })
    .strict(),
]);

export const recordedCoverLetterReplayFixtureSchema = z
  .object({
    version: z.literal(COVER_LETTER_REPLAY_FIXTURE_VERSION),
    fixtureDataClass: z.literal("synthetic"),
    fixtureProvenance: z.literal("authored_synthetic_case_v1"),
    id: z.string().min(1),
    sourceCaseId: z.string().min(1),
    writerProvider: z.enum(["openai", "mistral"]),
    writerModel: z.string().min(1),
    expectedArtifactHash: z.string().regex(/^[a-f0-9]{64}$/u),
    expectedProvenanceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    frozenConfig: z
      .object({
        outputLanguage: z.enum(PROPOSAL_OUTPUT_LANGUAGES),
        generationControlsBlock: z.literal(""),
        companyValuesPack: z.null(),
        proposalGenerationQualityMode: z.literal("baseline"),
        hasCandidateContext: z.literal(true),
        providerMaxRetries: z.literal(0),
        writerMaxOutputTokens: z.literal(2048),
        premiumPromptV2Enabled: z.literal(false),
        qualityRepairV1Enabled: z.literal(false),
        openAIWriterReasoningEffort: z.literal("low"),
        writerSchemaVersion: z.literal(
          "premium_writer_output_v1:premium_cover_letter_body_parts",
        ),
      })
      .strict(),
    responses: z.array(recordedWriterResponseSchema).min(1),
  })
  .strict();

export type RecordedCoverLetterReplayFixture = z.infer<
  typeof recordedCoverLetterReplayFixtureSchema
>;

const rawRecordedCoverLetterReplayFixtures = [
  {
    version: COVER_LETTER_REPLAY_FIXTURE_VERSION,
    fixtureDataClass: "synthetic",
    fixtureProvenance: "authored_synthetic_case_v1",
    id: "openai-clean-direct-v1",
    sourceCaseId: "clean-engaging-direct",
    writerProvider: "openai",
    writerModel: "gpt-5.5",
    expectedArtifactHash:
      "1460169306568ac30ab1560c91cd1ea0e219254ca8d815053add5c475f6432be",
    expectedProvenanceHash:
      "7730713dcf543c45e87f24cb581e7ea8eadb912947e86a7c811f127fede74e11",
    frozenConfig: {
      outputLanguage: "English",
      generationControlsBlock: "",
      companyValuesPack: null,
      proposalGenerationQualityMode: "baseline",
      hasCandidateContext: true,
      providerMaxRetries: 0,
      writerMaxOutputTokens: 2048,
      premiumPromptV2Enabled: false,
      qualityRepairV1Enabled: false,
      openAIWriterReasoningEffort: "low",
      writerSchemaVersion:
        "premium_writer_output_v1:premium_cover_letter_body_parts",
    },
    responses: [
      {
        schemaId: "premium_writer_output_v1",
        expectedWriterPromptHash:
          "eeaa255113162c1da0895cd3f730b170857d14c552fedb6b822da9c50e777331",
        payload: {
          version: "premium_writer_output_v1",
          bodyParts: {
            opening: {
              section: "opening",
              text: "At Lumio Health, I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
              claimIds: ["claim_opening_001"],
              factIds: ["fact_experience_001_highlight_001"],
              demandIds: ["demand_core_001"],
            },
            proofBlock: {
              section: "proofBlock",
              text: "I also managed a portfolio of more than 40 enterprise accounts with quarterly business reviews and built a customer health-score dashboard used to prioritize at-risk accounts.",
              claimIds: ["claim_proof_001"],
              factIds: [
                "fact_experience_001_highlight_002",
                "fact_experience_001_highlight_003",
              ],
              demandIds: [],
            },
            employerValueBlock: {
              section: "employerValueBlock",
              text: "That combination of structured onboarding, account review, and health reporting can support a customer success team focused on retention.",
              claimIds: ["claim_employer_value_001"],
              factIds: [
                "fact_experience_001_highlight_001",
                "fact_experience_001_highlight_002",
                "fact_experience_001_highlight_003",
              ],
              demandIds: ["demand_core_001"],
            },
            closeLine: {
              section: "closeLine",
              text: "I would bring the same retention focus and account discipline to your customer success team.",
              claimIds: ["claim_close_001"],
              factIds: [
                "fact_experience_001_highlight_001",
                "fact_experience_001_highlight_002",
              ],
              demandIds: [],
            },
          },
        },
      },
    ],
  },
  {
    version: COVER_LETTER_REPLAY_FIXTURE_VERSION,
    fixtureDataClass: "synthetic",
    fixtureProvenance: "authored_synthetic_case_v1",
    id: "mistral-adjacent-warehouse-v1",
    sourceCaseId: "adjacent-warehouse",
    writerProvider: "mistral",
    writerModel: "mistral-medium-latest",
    expectedArtifactHash:
      "e8672c1940aa68c96f3f43e2287614ff9af53c4a39e5a2b25b8f8bf504a51c06",
    expectedProvenanceHash:
      "28aa105abba0005c246cc5cbc91ecb9f7fc93e08442cab54a5e779a19ca61c99",
    frozenConfig: {
      outputLanguage: "English",
      generationControlsBlock: "",
      companyValuesPack: null,
      proposalGenerationQualityMode: "baseline",
      hasCandidateContext: true,
      providerMaxRetries: 0,
      writerMaxOutputTokens: 2048,
      premiumPromptV2Enabled: false,
      qualityRepairV1Enabled: false,
      openAIWriterReasoningEffort: "low",
      writerSchemaVersion:
        "premium_writer_output_v1:premium_cover_letter_body_parts",
    },
    responses: [
      {
        schemaId: "premium_writer_output_v1",
        expectedWriterPromptHash:
          "2f893c01a2d94278d3fe639bfa10656eb9d2b0a2176640b129460670f010f41a",
        payload: {
          version: "premium_writer_output_v1",
          bodyParts: {
            opening: {
              section: "opening",
              text: "At Northline Logistics, I reduced delayed-order escalations by 17% through tighter exception routing and follow-up.",
              claimIds: ["claim_opening_001"],
              factIds: ["fact_experience_001_highlight_003"],
              demandIds: ["demand_core_001"],
            },
            proofBlock: {
              section: "proofBlock",
              text: "I also owned dispatch handoffs, exception tracking, and daily shipment reporting across warehouse and transport teams, and built weekly backlog and on-time dashboards to surface bottlenecks.",
              claimIds: ["claim_proof_001"],
              factIds: [
                "fact_experience_001_highlight_001",
                "fact_experience_001_highlight_002",
              ],
              demandIds: [],
            },
            employerValueBlock: {
              section: "employerValueBlock",
              text: "That reporting and handoff discipline offers relevant preparation for coordinating implementation workflows and keeping cross-functional deliverables visible.",
              claimIds: ["claim_employer_value_001"],
              factIds: [
                "fact_experience_001_highlight_001",
                "fact_experience_001_highlight_002",
                "fact_experience_001_highlight_003",
              ],
              demandIds: ["demand_core_001"],
            },
            closeLine: {
              section: "closeLine",
              text: "I would bring the same structured follow-through and exception discipline to the implementation team.",
              claimIds: ["claim_close_001"],
              factIds: [
                "fact_experience_001_highlight_001",
                "fact_experience_001_highlight_002",
              ],
              demandIds: [],
            },
          },
        },
      },
    ],
  },
] as const;

export const RECORDED_COVER_LETTER_REPLAY_FIXTURES = z
  .array(recordedCoverLetterReplayFixtureSchema)
  .parse(rawRecordedCoverLetterReplayFixtures);
