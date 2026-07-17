import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverLetterHumanReviewRecord } from "../benchmark-cover-letter-writers";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import {
  buildCoverLetterBlindReviewArtifacts,
  writeCoverLetterBlindReviewArtifacts,
} from "../cover-letter-blind-review";
import {
  buildCoverLetterSafeArmDiagnosticBundle,
  extractCoverLetterSafeArmDiagnostic,
  revealCompletedCoverLetterBlindReviewsWithSafeArmDiagnostics,
  validateCoverLetterSafeArmDiagnosticBundle,
  writeCoverLetterSafeArmDiagnosticBundle,
} from "../cover-letter-safe-arm-diagnostic-bundle";
import {
  buildCoverLetterSafeArmDiagnostic,
  createCoverLetterOpaqueArmIdBlindingKey,
  deriveCoverLetterOpaqueArmId,
  releaseCoverLetterOpaqueArmIdBlindingKey,
} from "../cover-letter-safe-arm-diagnostic";
import {
  COVER_LETTER_BLIND_REVIEW_COHORT_ID,
  coverLetterBlindReviewCases,
} from "../cases/cover-letter/cases";

const RUN_ID = "quality-eval-6-safe-diagnostic-test";
const SOURCE_REF = "0deb697ded4a081d01fdb17b80f2c7141e429b61";
const PRIVATE_SENTINEL =
  "raw-letter-prompt-rationale-provider-response-private-sentinel";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function hashCharacter(index: number): string {
  return "0123456789abcdef"[index % 16]!;
}

function makeHumanReviewRecords(): CoverLetterHumanReviewRecord[] {
  return coverLetterBlindReviewCases.map((benchmarkCase, index) => {
    const provider = index % 2 === 0 ? "openai" : "mistral";
    const writerModel =
      provider === "openai" ? "gpt-5.5" : "mistral-medium-latest";
    const bodyParts = {
      opening: `Opening ${index + 1} connects the candidate to the role.`,
      proofBlock:
        "The candidate improved a documented workflow and coordinated measurable delivery.",
      employerValueBlock:
        "That evidence supports reliable execution for the employer team and its priorities.",
      closeLine:
        "I would welcome a focused conversation about the team's immediate needs.",
    };
    const letter = [
      "Dear Hiring Manager,",
      bodyParts.opening,
      bodyParts.proofBlock,
      bodyParts.employerValueBlock,
      bodyParts.closeLine,
      "Sincerely,",
      benchmarkCase.personalizationContext.name ?? "Candidate",
    ].join("\n\n");
    const artifactHash = hashCharacter(index + 1).repeat(64);
    const provenanceHash = hashCharacter(index + 7).repeat(64);
    return {
      status: "human_review_pending",
      caseId: benchmarkCase.id,
      preset: benchmarkCase.preset,
      writerModel,
      outputLanguage: benchmarkCase.reviewMetadata!.requestedOutputLanguage,
      expectedContextClass: benchmarkCase.expectedContextClass,
      generation: {
        bodyParts,
        mode: "direct",
        evidenceUsed: [],
        omittedWeakEvidence: [],
        content: letter,
        sections: [{ type: "text", content: letter }],
        prompt: PRIVATE_SENTINEL,
        brief: {} as CoverLetterHumanReviewRecord["generation"]["brief"],
        contextClass: benchmarkCase.expectedContextClass,
      },
      artifact: {
        kind: "cover_letter_eval_artifact",
        version: 1,
        dataClass: "synthetic_fixture",
        caseId: benchmarkCase.id,
        decision: "accepted",
        finalContent: letter,
        sections: [{ type: "text", content: letter }],
        provenance: {
          version: "premium_cover_letter_final_provenance_v1",
          status: "validated_final_text",
          origin: "provider_normalized",
          contextClass: benchmarkCase.expectedContextClass,
          candidateFactIds: [],
          verifiedCandidateFactIds: [],
          candidateFacts: [],
          sections: {},
        } as CoverLetterHumanReviewRecord["artifact"]["provenance"],
        provenanceHash,
        diagnostics: {
          finalization: {
            acceptanceMode: "structured",
            errorClass: "none",
            failureStage: null,
            selectedBodyCandidate: "conservative",
            substantiveBodyPassed: true,
            removedBridgeSentenceCount: 0,
            removedLastGroundedSentence: false,
          },
          qualityShadow: {
            passed: true,
            score: 100,
            issueClasses: [],
          },
          qualityRepair: null,
        },
        configVersions: {
          generationControls: "generation_controls_v1",
          companyValues: "company_values_v1",
          writerSchema: "writer_schema_v1",
          cancellation: "cancellation_v1",
          finalizer: "premium_persistence_finalizer_v1",
        },
        frozenConfig:
          {} as CoverLetterHumanReviewRecord["artifact"]["frozenConfig"],
        contractVersions: {
          artifact: "cover_letter_eval_artifact_v1",
          projection: "cover_letter_eval_finalizer_projection_v1",
          productionFinalizer:
            "finalize_premium_cover_letter_payload_for_persistence_v1",
        },
        hashContract:
          {} as CoverLetterHumanReviewRecord["artifact"]["hashContract"],
        artifactHash,
      },
      diagnostics: {
        provider,
        contextClass: benchmarkCase.expectedContextClass,
        expectedContextClass: benchmarkCase.expectedContextClass,
        validationResult: "premium_validation_passed",
        telemetry: {
          attemptedPath: "premium path saved",
          premium_path_saved: true,
          premium_validation_passed: true,
          premium_quality_shadow_passed: true,
        },
        qualityShadow: { passed: true, score: 100, issues: [] },
        failureStage: null,
        failureReason: null,
        failureIssues: [],
      },
      manualReview: {
        humanTone: "unreviewed",
        noMetaProse: "unreviewed",
        persuasiveEmployerFacingArgument: "unreviewed",
        notFactualInventory: "unreviewed",
        specificity: "unreviewed",
        grounding: "unreviewed",
        economy: "unreviewed",
        commerciallyAcceptable: "unreviewed",
        reviewerNotes: "",
      },
      letter,
      runManifest: {
        version: "cover_letter_eval_run_manifest_entry_v1",
        caseId: benchmarkCase.id,
        provider,
        requestedModel: writerModel,
        returnedModel: writerModel,
        promptHash: hashCharacter(index + 2).repeat(64),
        promptHashScope: "effective_user_prompt",
        transport: {
          version: "cover_letter_eval_transport_metadata_v1",
          requestProjectionHash: hashCharacter(index + 3).repeat(64),
          requestProjectionByteLength: 100,
          requestProjectionScope:
            "application_controlled_request_projection_without_credentials_or_signal",
          systemPromptHash: null,
          schemaTargetHash: hashCharacter(index + 4).repeat(64),
          schemaEnforcementMode:
            provider === "openai"
              ? "openai_responses_json_schema_strict"
              : "mistral_prompt_contract_with_local_parser",
          promptContract: "provider_native_v1",
        },
        reasoningEffort: "low",
        writerMaxOutputTokens: 2_400,
        providerMaxRetries: 0,
        tokenUsage: null,
        observedCostUpperBoundUsd: null,
        sdkVersions: {
          openai: "test",
          mistral: "test",
          langchainMistral: "test",
        },
        artifactHash,
        provenanceHash,
      },
    };
  });
}

function completedReviewFor(args: {
  blindLabel: string;
  packHash: string;
  reviewerLanguages: readonly string[];
}) {
  return {
    blindLabel: args.blindLabel,
    packHash: args.packHash,
    reviewerLanguages: [...args.reviewerLanguages],
    reviewerLanguageCompetence: "native_or_professional_for_all" as const,
    relevanceToOffer: "pass" as const,
    factualGrounding: "pass" as const,
    evidencePrioritization: "pass" as const,
    credibility: "pass" as const,
    persuasion: "pass" as const,
    structure: "pass" as const,
    substance: "pass" as const,
    tone: "pass" as const,
    economy: "pass" as const,
    commercialAcceptability: "pass" as const,
    strengths: ["Grounded and specific."],
    mainWeakness: "The close could be shorter.",
    smallestUsefulRevision: "Shorten the close.",
    reviewerNotes: "",
  };
}

async function buildTestArtifacts() {
  const records = makeHumanReviewRecords();
  const blindingKey = createCoverLetterOpaqueArmIdBlindingKey();
  const opaqueArmBindings = await Promise.all(
    records.map(async (record) => ({
      caseId: record.caseId,
      writerModel: record.writerModel,
      opaqueArmId: await deriveCoverLetterOpaqueArmId({
        runId: RUN_ID,
        fixtureId: record.caseId,
        armKey: `${record.diagnostics.provider}:${record.writerModel}`,
        blindingKey,
      }),
    })),
  );
  releaseCoverLetterOpaqueArmIdBlindingKey(blindingKey);
  const blindArtifacts = await buildCoverLetterBlindReviewArtifacts({
    cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
    runId: RUN_ID,
    sourceRef: SOURCE_REF,
    cases: coverLetterBlindReviewCases,
    records,
    opaqueArmBindings,
  });
  const diagnostics = await Promise.all(
    records.map((record) => {
      const benchmarkCase = coverLetterBlindReviewCases.find(
        (item) => item.id === record.caseId,
      )!;
      const opaqueArmId = opaqueArmBindings.find(
        (binding) =>
          binding.caseId === record.caseId &&
          binding.writerModel === record.writerModel,
      )!.opaqueArmId;
      return extractCoverLetterSafeArmDiagnostic({
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        benchmarkCase,
        opaqueArmId,
        source: {
          caseId: record.caseId,
          outputLanguage: record.outputLanguage,
          artifact: record.artifact,
          bodyParts: record.generation.bodyParts,
          finalVisibleContent: record.letter,
          runManifest: record.runManifest!,
        },
      });
    }),
  );
  const diagnosticBundle = await buildCoverLetterSafeArmDiagnosticBundle({
    cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
    runId: RUN_ID,
    sourceRef: SOURCE_REF,
    diagnostics,
    ...blindArtifacts,
  });
  return { records, opaqueArmBindings, diagnosticBundle, ...blindArtifacts };
}

describe("cover-letter safe-arm diagnostic bundle", () => {
  it("seals allowlisted diagnostics outside the reviewer pack", async () => {
    const artifacts = await buildTestArtifacts();
    const serializedPack = JSON.stringify(artifacts.pack);
    const serializedRevealMap = JSON.stringify(artifacts.revealMap);
    const serializedBundle = JSON.stringify(artifacts.diagnosticBundle);

    expect(serializedPack).not.toContain("opaqueArmId");
    expect(serializedPack).not.toContain("safeArmDiagnostic");
    expect(serializedRevealMap).toContain("opaqueArmId");
    expect(serializedBundle).not.toContain(PRIVATE_SENTINEL);
    expect(serializedBundle).not.toMatch(
      /finalVisibleContent|finalizedLetter|writerModel|writerProvider|"prompt":|"rationale":|"providerResponse":/iu,
    );
    await expect(
      validateCoverLetterSafeArmDiagnosticBundle(artifacts.diagnosticBundle),
    ).resolves.toEqual(artifacts.diagnosticBundle);
  });

  it("joins diagnostics only after every blind review is complete", async () => {
    const artifacts = await buildTestArtifacts();
    const reviews = artifacts.pack.entries.map((entry) =>
      completedReviewFor({
        blindLabel: entry.blindLabel,
        packHash: artifacts.pack.packHash,
        reviewerLanguages: entry.requiredReviewerLanguages,
      }),
    );

    await expect(
      revealCompletedCoverLetterBlindReviewsWithSafeArmDiagnostics({
        pack: artifacts.pack,
        revealMap: artifacts.revealMap,
        reviews,
        diagnosticBundle: artifacts.diagnosticBundle,
      }),
    ).resolves.toHaveLength(artifacts.pack.entries.length);
    await expect(
      revealCompletedCoverLetterBlindReviewsWithSafeArmDiagnostics({
        pack: artifacts.pack,
        revealMap: artifacts.revealMap,
        reviews: reviews.slice(1),
        diagnosticBundle: artifacts.diagnosticBundle,
      }),
    ).rejects.toThrow(/missing/iu);
  });

  it("fails closed on incomplete bindings and tampered diagnostic joins", async () => {
    const records = makeHumanReviewRecords();
    await expect(
      buildCoverLetterBlindReviewArtifacts({
        cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        cases: coverLetterBlindReviewCases,
        records,
        opaqueArmBindings: [],
      }),
    ).rejects.toThrow(/incomplete/iu);

    const artifacts = await buildTestArtifacts();
    const reviews = artifacts.pack.entries.map((entry) =>
      completedReviewFor({
        blindLabel: entry.blindLabel,
        packHash: artifacts.pack.packHash,
        reviewerLanguages: entry.requiredReviewerLanguages,
      }),
    );
    const outputMessages: string[] = [];
    const outputSpies = ["log", "warn", "error"].map((method) =>
      vi
        .spyOn(console, method as "log" | "warn" | "error")
        .mockImplementation((...args: unknown[]) => {
          outputMessages.push(args.map(String).join(" "));
        }),
    );
    const tamperedBundle = {
      ...artifacts.diagnosticBundle,
      packHash: "f".repeat(64),
    };

    const error =
      await revealCompletedCoverLetterBlindReviewsWithSafeArmDiagnostics({
        pack: artifacts.pack,
        revealMap: artifacts.revealMap,
        reviews,
        diagnosticBundle: tamperedBundle,
      }).catch((value: unknown) => value);
    expect(String(error)).toBe(
      "TypeError: safe arm diagnostic bundle validation failed.",
    );
    expect(outputMessages).toEqual([]);
    for (const outputSpy of outputSpies) outputSpy.mockRestore();
  });

  it("rejects duplicate opaque arm ids before building reviewer artifacts", async () => {
    const records = makeHumanReviewRecords();
    const blindingKey = createCoverLetterOpaqueArmIdBlindingKey();
    const duplicateOpaqueArmId = await deriveCoverLetterOpaqueArmId({
      runId: RUN_ID,
      fixtureId: records[0]!.caseId,
      armKey: `${records[0]!.diagnostics.provider}:${records[0]!.writerModel}`,
      blindingKey,
    });
    releaseCoverLetterOpaqueArmIdBlindingKey(blindingKey);

    await expect(
      buildCoverLetterBlindReviewArtifacts({
        cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        cases: coverLetterBlindReviewCases,
        records,
        opaqueArmBindings: records.map((record) => ({
          caseId: record.caseId,
          writerModel: record.writerModel,
          opaqueArmId: duplicateOpaqueArmId,
        })),
      }),
    ).rejects.toThrow(/opaque-arm bindings are invalid/iu);
  });

  it("binds retained run-manifest identity to the accepted artifact", async () => {
    const record = makeHumanReviewRecords()[0]!;
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (item) => item.id === record.caseId,
    )!;
    const blindingKey = createCoverLetterOpaqueArmIdBlindingKey();
    const opaqueArmId = await deriveCoverLetterOpaqueArmId({
      runId: RUN_ID,
      fixtureId: record.caseId,
      armKey: `${record.diagnostics.provider}:${record.writerModel}`,
      blindingKey,
    });
    releaseCoverLetterOpaqueArmIdBlindingKey(blindingKey);
    const baseSource = {
      caseId: record.caseId,
      outputLanguage: record.outputLanguage,
      artifact: record.artifact,
      bodyParts: record.generation.bodyParts,
      finalVisibleContent: record.letter,
    };
    const mismatchedManifests = [
      { ...record.runManifest!, caseId: "different-case" },
      { ...record.runManifest!, artifactHash: "f".repeat(64) },
      { ...record.runManifest!, provenanceHash: "e".repeat(64) },
    ];

    for (const runManifest of mismatchedManifests) {
      await expect(
        extractCoverLetterSafeArmDiagnostic({
          runId: RUN_ID,
          sourceRef: SOURCE_REF,
          benchmarkCase,
          opaqueArmId,
          source: { ...baseSource, runManifest },
        }),
      ).rejects.toThrow(/safe arm diagnostic bundle validation failed/iu);
    }
  });

  it("rejects a consistently resealed but non-current extractor contract", async () => {
    const artifacts = await buildTestArtifacts();
    const diagnostics = await Promise.all(
      artifacts.diagnosticBundle.entries.map(
        async ({ diagnosticHash: _diagnosticHash, ...diagnostic }) =>
          buildCoverLetterSafeArmDiagnostic({
            ...diagnostic,
            identity: {
              ...diagnostic.identity,
              extractorHash: "f".repeat(64),
            },
          }),
      ),
    );

    await expect(
      buildCoverLetterSafeArmDiagnosticBundle({
        cohortId: COVER_LETTER_BLIND_REVIEW_COHORT_ID,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        diagnostics,
        pack: artifacts.pack,
        revealMap: artifacts.revealMap,
      }),
    ).rejects.toThrow(/safe arm diagnostic bundle validation failed/iu);

    const { bundleHash: _bundleHash, ...currentBody } =
      artifacts.diagnosticBundle;
    const wrongExtractorBody = {
      ...currentBody,
      extractorHash: "f".repeat(64),
      entries: diagnostics,
    };
    const wrongExtractorBundle = {
      ...wrongExtractorBody,
      bundleHash: await buildStableHash({
        namespace: "cover-letter-safe-arm-diagnostic",
        type: "bundle",
        version: 1,
        value: wrongExtractorBody,
      }),
    };
    await expect(
      validateCoverLetterSafeArmDiagnosticBundle(wrongExtractorBundle),
    ).rejects.toThrow(/safe arm diagnostic bundle validation failed/iu);
  });

  it("rejects consistently resealed entries from another run or source", async () => {
    const artifacts = await buildTestArtifacts();
    const identityOverrides = [
      { runId: "different-run", sourceRef: SOURCE_REF },
      { runId: RUN_ID, sourceRef: "f".repeat(40) },
    ];

    for (const identityOverride of identityOverrides) {
      const entries = await Promise.all(
        artifacts.diagnosticBundle.entries.map(
          async ({ diagnosticHash: _diagnosticHash, ...diagnostic }) =>
            buildCoverLetterSafeArmDiagnostic({
              ...diagnostic,
              identity: {
                ...diagnostic.identity,
                ...identityOverride,
              },
            }),
        ),
      );
      const { bundleHash: _bundleHash, ...currentBody } =
        artifacts.diagnosticBundle;
      const resealedBody = { ...currentBody, entries };
      const resealedBundle = {
        ...resealedBody,
        bundleHash: await buildStableHash({
          namespace: "cover-letter-safe-arm-diagnostic",
          type: "bundle",
          version: 1,
          value: resealedBody,
        }),
      };

      await expect(
        validateCoverLetterSafeArmDiagnosticBundle(resealedBundle),
      ).rejects.toThrow(/safe arm diagnostic bundle validation failed/iu);
    }
  });

  it("writes reveal-only diagnostics with private filesystem permissions", async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "cover-letter-safe-arm-bundle-"),
    );
    temporaryDirectories.push(outputDirectory);
    const artifacts = await buildTestArtifacts();
    const writtenBlind = await writeCoverLetterBlindReviewArtifacts({
      outputDirectory,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
    });
    const diagnosticPath = await writeCoverLetterSafeArmDiagnosticBundle({
      outputDirectory,
      bundle: artifacts.diagnosticBundle,
    });

    expect(path.dirname(diagnosticPath)).toBe(
      path.dirname(writtenBlind.revealMapJsonPath),
    );
    expect(path.dirname(diagnosticPath)).not.toBe(
      path.dirname(writtenBlind.packJsonPath),
    );
    expect((await stat(path.dirname(diagnosticPath))).mode & 0o777).toBe(0o700);
    expect((await stat(diagnosticPath)).mode & 0o777).toBe(0o600);
    expect((await stat(writtenBlind.revealMapJsonPath)).mode & 0o777).toBe(
      0o600,
    );
    expect(await readFile(diagnosticPath, "utf8")).not.toContain(
      PRIVATE_SENTINEL,
    );
  });
});
