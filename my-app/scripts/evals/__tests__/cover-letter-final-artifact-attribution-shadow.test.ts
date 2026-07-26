import {
  mkdir,
  mkdtemp,
  lstat,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  type PremiumWriterOutputV1,
} from "../../../convex/lib/proposals/premiumCoverLetter";
import {
  finalizePremiumCoverLetterPayloadForPersistence,
  inspectProposalFinalization,
} from "../../../convex/generateProposalMutation";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import {
  buildCoverLetterEvalFrozenConfig,
  generatePremiumCoverLetterBenchmarkLetter,
  resolveCoverLetterBenchmarkProductionInputs,
} from "../benchmark-cover-letter-writers";
import { coverLetterBlindReviewCases } from "../cases/cover-letter/cases";
import { buildCoverLetterEvalTransportMetadata } from "../cover-letter-eval-run-manifest";
import {
  buildCoverLetterFinalArtifactShadowArtifacts,
  loadCoverLetterFinalArtifactShadowCells,
  replayCoverLetterFinalArtifactShadow,
  writeCoverLetterFinalArtifactShadowArtifacts,
} from "../cover-letter-final-artifact-attribution-shadow";
import {
  QUALITY_EVAL_2D_CASE_ID,
  QUALITY_EVAL_2D_WRITER_MODELS,
  type CoverLetterQualitativeSampleCell,
  type CoverLetterQualitativeSampleWriterModel,
} from "../cover-letter-qualitative-sample";

const benchmarkCase = coverLetterBlindReviewCases.find(
  (candidate) => candidate.id === QUALITY_EVAL_2D_CASE_ID,
)!;

function buildWriterOutput(): PremiumWriterOutputV1 {
  return {
    version: "premium_writer_output_v1",
    bodyParts: {
      opening: {
        section: "opening",
        text: "At Lumio Health, I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        claimIds: ["claim_opening_001"],
        factIds: ["fact_experience_001_highlight_001"],
        demandIds: [],
      },
      proofBlock: {
        section: "proofBlock",
        text: "I managed a portfolio of 40+ enterprise accounts with quarterly business reviews. I also built a customer health-score dashboard used by the CS team to prioritize at-risk accounts.",
        claimIds: ["claim_proof_001"],
        factIds: [
          "fact_experience_001_highlight_002",
          "fact_experience_001_highlight_003",
        ],
        demandIds: [],
      },
      employerValueBlock: {
        section: "employerValueBlock",
        text: "That experience would support enterprise account health, onboarding, and reporting for the Customer Success Manager role.",
        claimIds: ["claim_employer_value_001"],
        factIds: [
          "fact_experience_001_highlight_003",
          "fact_experience_001_highlight_002",
          "fact_experience_001_highlight_001",
        ],
        demandIds: ["demand_core_001"],
      },
      closeLine: {
        section: "closeLine",
        text: "I would bring the same structured approach to retention, onboarding, and quarterly business reviews.",
        claimIds: ["claim_close_001"],
        factIds: [
          "fact_experience_001_highlight_001",
          "fact_experience_001_highlight_002",
          "fact_experience_001_highlight_003",
          "fact_experience_001_role",
        ],
        demandIds: [],
      },
    },
  };
}

function buildFallbackWriterOutput(): PremiumWriterOutputV1 {
  const output = buildWriterOutput();
  return {
    ...output,
    bodyParts: {
      ...output.bodyParts,
      closeLine: {
        ...output.bodyParts.closeLine,
        text: "I would welcome the opportunity to discuss my interest in the role.",
      },
    },
  };
}

async function hashQualitativeInput(args: {
  type: "writer-prompt" | "writer-schema" | "frozen-config";
  value: unknown;
}): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: args.type,
    version: 1,
    ...(args.type === "writer-prompt"
      ? { prompt: args.value }
      : args.type === "writer-schema"
        ? { schema: args.value }
        : { config: args.value }),
  });
}

async function buildAcceptedCell(
  requestedModel: CoverLetterQualitativeSampleWriterModel,
  writerOutput = buildWriterOutput(),
  writerPromptOverride?: string,
): Promise<CoverLetterQualitativeSampleCell> {
  const productionInputs = resolveCoverLetterBenchmarkProductionInputs({
    benchmarkCase,
  });
  const generation = await generatePremiumCoverLetterBenchmarkLetter({
    benchmarkCase,
    writerModel: requestedModel,
    apiKey: "",
    mistralApiKey: "",
    productionInputs,
    ...(writerPromptOverride ? { writerPromptOverride } : {}),
    writerOverride: async () => writerOutput,
  });
  expect(generation).not.toBeNull();
  const acceptedGeneration = generation!;
  const finalized = finalizePremiumCoverLetterPayloadForPersistence({
    payload: {
      content: acceptedGeneration.content,
      sections: acceptedGeneration.sections,
      bodyParts: acceptedGeneration.bodyParts,
      qualityShadow: acceptedGeneration.qualityShadow,
      qualityRepair: acceptedGeneration.qualityRepair,
      finalProvenance: acceptedGeneration.finalProvenance,
    },
    format: "cover_letter",
    outputLanguage: productionInputs.outputLanguage,
    candidateName: benchmarkCase.personalizationContext?.name,
    voicePreset: benchmarkCase.preset,
    hasCandidateContext: productionInputs.hasCandidateContext,
  });
  const trace = inspectProposalFinalization({
    content: acceptedGeneration.content,
    format: "cover_letter",
    outputLanguage: productionInputs.outputLanguage,
    candidateName: benchmarkCase.personalizationContext?.name,
    voicePreset: benchmarkCase.preset,
    noContextMode: false,
    requiresCandidateEvidence: true,
  });
  const frozenConfig = await buildCoverLetterEvalFrozenConfig({
    writerModel: requestedModel,
    benchmarkCase,
    productionInputs,
  });
  return {
    version: "cover_letter_qualitative_sample_cell_v1",
    caseId: QUALITY_EVAL_2D_CASE_ID,
    provider: requestedModel === "mistral-medium-latest" ? "mistral" : "openai",
    requestedModel,
    returnedModel: requestedModel,
    status: "FIRST_PASS_ACCEPTED",
    promptHash: await hashQualitativeInput({
      type: "writer-prompt",
      value: acceptedGeneration.prompt,
    }),
    promptHashScope: "effective_user_prompt",
    schemaHash: await hashQualitativeInput({
      type: "writer-schema",
      value: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
    }),
    configHash: await hashQualitativeInput({
      type: "frozen-config",
      value: frozenConfig,
    }),
    transport: await buildCoverLetterEvalTransportMetadata({
      serializedRequest: JSON.stringify({
        model: requestedModel,
        prompt: acceptedGeneration.prompt,
      }),
      systemPrompt:
        requestedModel === "mistral-medium-latest"
          ? "test Mistral system prompt"
          : null,
      schemaTarget: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
      schemaEnforcementMode:
        requestedModel === "mistral-medium-latest"
          ? "mistral_prompt_contract_with_local_parser"
          : "openai_responses_json_schema_strict",
      promptContract: writerPromptOverride
        ? "quality_eval_2d_shared_v1"
        : "provider_native_v1",
    }),
    parsedCandidate: writerOutput,
    finalizedLetter: finalized.content,
    diagnostics: {
      failureStage: null,
      failureReason: null,
      issues: [],
      modelRepairRequired: null,
      finalization: {
        acceptanceMode: trace.acceptanceMode,
        errorClass: "none",
        failureStage: trace.failureStage ?? null,
        selectedBodyCandidate: trace.cleanedBodySelection.selectedCandidate,
        substantiveBodyPassed: trace.substantiveBodyAssertion?.passed ?? null,
        removedBridgeSentenceCount:
          trace.finalSavedOutputBridgeCleanup?.removedSentenceTexts.length ?? 0,
        removedLastGroundedSentence:
          trace.finalSavedOutputBridgeCleanup?.removedLastGroundedSentence ??
          false,
      },
    },
    reasoningEffort: requestedModel === "mistral-medium-latest" ? null : "low",
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    maxRepairs: 0,
    tokenUsage: null,
    observedCostUpperBoundUsd: null,
    sdkVersions: {
      openai: "test",
      mistral: "test",
      langchainMistral: "test",
    },
    artifactHash: await buildStableHash({
      namespace: "test-quality-eval-2e",
      type: "baseline-artifact",
      version: 1,
      requestedModel,
      content: finalized.content,
    }),
    provenanceHash: null,
  };
}

async function buildFiveCells(
  useCanonicalPrompt = true,
): Promise<CoverLetterQualitativeSampleCell[]> {
  const canonicalGeneration = await generatePremiumCoverLetterBenchmarkLetter({
    benchmarkCase,
    writerModel: "gpt-5.5",
    apiKey: "",
    productionInputs: resolveCoverLetterBenchmarkProductionInputs({
      benchmarkCase,
    }),
    writerOverride: async () => buildWriterOutput(),
  });
  expect(canonicalGeneration).not.toBeNull();
  const canonicalPrompt = canonicalGeneration!.prompt;
  return Promise.all(
    QUALITY_EVAL_2D_WRITER_MODELS.map((model, index) =>
      buildAcceptedCell(
        model,
        index === 0 ? buildFallbackWriterOutput() : undefined,
        useCanonicalPrompt ? canonicalPrompt : undefined,
      ),
    ),
  );
}

describe("QUALITY-EVAL-2E final-artifact attribution shadow", () => {
  beforeEach(() => {
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "0");
    vi.stubEnv("cover_letter_premium_prompt_v2", "0");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "0");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "0");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("replays the exact five cells with byte-identical production baselines and no provider calls", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in QUALITY-EVAL-2E");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await replayCoverLetterFinalArtifactShadow({
      benchmarkCase,
      cells: await buildFiveCells(),
    });

    expect(result).toHaveLength(5);
    expect(result.every((entry) => entry.baseline.byteIdentical)).toBe(true);
    expect(result.every((entry) => entry.localWriterCallCount === 1)).toBe(
      true,
    );
    expect(result.every((entry) => entry.providerCallCount === 0)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retains offline replay compatibility for the already-paid provider-native evidence", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in QUALITY-EVAL-2E");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const legacyCells = (await buildFiveCells(false)).map((cell) => {
      const legacyCell: Partial<CoverLetterQualitativeSampleCell> = {
        ...cell,
      };
      delete legacyCell.promptHashScope;
      delete legacyCell.transport;
      return legacyCell as CoverLetterQualitativeSampleCell;
    });
    const result = await replayCoverLetterFinalArtifactShadow({
      benchmarkCase,
      cells: legacyCells,
    });

    expect(result).toHaveLength(5);
    expect(result.every((entry) => entry.baseline.byteIdentical)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves final-visible sections without a quality-shadow fallback", async () => {
    const result = await replayCoverLetterFinalArtifactShadow({
      benchmarkCase,
      cells: await buildFiveCells(),
    });

    expect(
      result.every(
        (entry) =>
          entry.sections.every(
            (section) =>
              section.production.status === "retained_exact" &&
              section.candidate.status === "retained_exact",
          ) &&
          entry.qualityShadowFallback.conditionTriggered === false &&
          entry.qualityShadowFallback.visibleStructureLoss === false &&
          entry.qualityShadowFallback.signatureObserved === false &&
          entry.qualityShadowFallback.diagnostic === "none",
      ),
    ).toBe(true);
    expect(
      result.every(
        (entry) =>
          entry.baseline.bodyParagraphCount >= 4 &&
          entry.baseline.structurePreserved &&
          entry.candidate.bodyParagraphCount >= 4 &&
          entry.candidate.structurePreserved,
      ),
    ).toBe(true);
  });

  it("builds stable blind A/B artifacts without model, provider, SDK, token, or cost clues", async () => {
    const cells = await buildFiveCells();
    const replay = await replayCoverLetterFinalArtifactShadow({
      benchmarkCase,
      cells,
    });
    const blindingSecret = "a".repeat(64);
    const first = await buildCoverLetterFinalArtifactShadowArtifacts({
      runId: "quality-eval-2e-test",
      sourceRef: "test-source",
      benchmarkCase,
      replay,
      blindingSecret,
    });
    const second = await buildCoverLetterFinalArtifactShadowArtifacts({
      runId: "quality-eval-2e-test",
      sourceRef: "test-source",
      benchmarkCase,
      replay,
      blindingSecret,
    });
    const permuted = await buildCoverLetterFinalArtifactShadowArtifacts({
      runId: "quality-eval-2e-test",
      sourceRef: "test-source",
      benchmarkCase,
      replay: [...replay].reverse(),
      blindingSecret,
    });
    const differentlyBlinded =
      await buildCoverLetterFinalArtifactShadowArtifacts({
        runId: "quality-eval-2e-test",
        sourceRef: "test-source",
        benchmarkCase,
        replay,
        blindingSecret: "b".repeat(64),
      });

    expect(first).toEqual(second);
    expect(first).toEqual(permuted);
    expect(first.pack.entries).toHaveLength(5);
    expect(
      new Set(first.pack.entries.map((entry) => entry.pairLabel)).size,
    ).toBe(5);
    const serializedPack = JSON.stringify(first.pack);
    for (const model of QUALITY_EVAL_2D_WRITER_MODELS) {
      expect(serializedPack).not.toContain(model);
    }
    expect(serializedPack).not.toMatch(
      /openai|mistral|sdk|token|cost|current|production|candidate/iu,
    );
    expect(serializedPack).not.toContain(blindingSecret);
    expect(first.revealMap.blindingSecret).toBe(blindingSecret);
    expect(first.revealMap.entries).toHaveLength(5);
    const recordedOnSideA = first.revealMap.entries.filter(
      (entry) => entry.variantA === "recorded_path",
    ).length;
    expect([2, 3]).toContain(recordedOnSideA);
    expect(
      first.revealMap.entries.map(
        ({ pairLabel, requestedModel, variantA }) => ({
          pairLabel,
          requestedModel,
          variantA,
        }),
      ),
    ).not.toEqual(
      differentlyBlinded.revealMap.entries.map(
        ({ pairLabel, requestedModel, variantA }) => ({
          pairLabel,
          requestedModel,
          variantA,
        }),
      ),
    );
    const sidesByModel = (
      revealMap: typeof first.revealMap,
    ): Array<Readonly<{ requestedModel: string; variantA: string }>> =>
      revealMap.entries
        .map(({ requestedModel, variantA }) => ({
          requestedModel,
          variantA,
        }))
        .sort((left, right) =>
          left.requestedModel.localeCompare(right.requestedModel),
        );
    expect(sidesByModel(first.revealMap)).not.toEqual(
      sidesByModel(differentlyBlinded.revealMap),
    );
    expect(
      first.revealMap.entries.every(
        (entry) => entry.returnedModel === entry.requestedModel,
      ),
    ).toBe(true);
    expect(first.diagnostics.entries).toHaveLength(5);
  });

  it("rejects missing, duplicate, rejected, and baseline-drifted cells", async () => {
    const cells = await buildFiveCells();
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: cells.slice(0, 4),
      }),
    ).rejects.toThrow(/exact five/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [cells[0]!, cells[0]!, ...cells.slice(2)],
      }),
    ).rejects.toThrow(/exact five/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [
          {
            ...cells[0]!,
            status: "FIRST_PASS_REJECTED",
            finalizedLetter: null,
          },
          ...cells.slice(1),
        ],
      }),
    ).rejects.toThrow(/FIRST_PASS_ACCEPTED/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [
          { ...cells[0]!, promptHash: "0".repeat(64) },
          ...cells.slice(1),
        ],
      }),
    ).rejects.toThrow(/prompt drifted/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [
          {
            ...cells[0]!,
            transport: {
              ...cells[0]!.transport!,
              promptContract: "provider_native_v1",
            },
          },
          ...cells.slice(1),
        ],
      }),
    ).rejects.toThrow(/one consistent prompt contract/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [
          {
            ...cells[0]!,
            finalizedLetter: `${cells[0]!.finalizedLetter}\nDRIFT`,
          },
          ...cells.slice(1),
        ],
      }),
    ).rejects.toThrow(/byte-identical/iu);
    await expect(
      replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: [
          {
            ...cells[0]!,
            finalizedLetter: `${cells[0]!.finalizedLetter}\n`,
          },
          ...cells.slice(1),
        ],
      }),
    ).rejects.toThrow(/byte-identical/iu);
  });

  it("loads exact private evidence and writes atomic 0700/0600 artifacts", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-final-artifact-shadow-"),
    );
    const sourceRunDirectory = path.join(root, "source-run");
    const inputDirectory = path.join(sourceRunDirectory, "private-evidence");
    const outputDirectory = path.join(root, "output");
    await mkdir(inputDirectory, { recursive: true, mode: 0o700 });
    const cells = await buildFiveCells();
    await Promise.all(
      cells.map((cell, index) =>
        writeFile(
          path.join(
            inputDirectory,
            `sample-cell-${String(index + 1).padStart(3, "0")}.json`,
          ),
          `${JSON.stringify(cell)}\n`,
          { mode: 0o600 },
        ),
      ),
    );
    const loaded = await loadCoverLetterFinalArtifactShadowCells({
      inputDirectory,
    });
    const replay = await replayCoverLetterFinalArtifactShadow({
      benchmarkCase,
      cells: loaded,
    });
    const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
      runId: "quality-eval-2e-permissions",
      sourceRef: "test-source",
      benchmarkCase,
      replay,
    });
    const inputNamesBefore = await readdir(inputDirectory);
    const inputSnapshotBefore = await Promise.all(
      inputNamesBefore.map(async (fileName) => {
        const filePath = path.join(inputDirectory, fileName);
        return {
          fileName,
          content: await readFile(filePath, "utf8"),
          mode: (await stat(filePath)).mode & 0o777,
        };
      }),
    );
    for (const overlappingOutputDirectory of [
      inputDirectory,
      sourceRunDirectory,
      path.join(inputDirectory, "nested-output"),
    ]) {
      await expect(
        writeCoverLetterFinalArtifactShadowArtifacts({
          inputDirectory,
          outputDirectory: overlappingOutputDirectory,
          ...artifacts,
        }),
      ).rejects.toThrow(/overlap/iu);
    }
    expect(await readdir(inputDirectory)).toEqual(inputNamesBefore);
    expect(await readdir(sourceRunDirectory)).toEqual(["private-evidence"]);
    expect(
      await Promise.all(
        inputNamesBefore.map(async (fileName) => {
          const filePath = path.join(inputDirectory, fileName);
          return {
            fileName,
            content: await readFile(filePath, "utf8"),
            mode: (await stat(filePath)).mode & 0o777,
          };
        }),
      ),
    ).toEqual(inputSnapshotBefore);

    const written = await writeCoverLetterFinalArtifactShadowArtifacts({
      inputDirectory,
      outputDirectory,
      ...artifacts,
    });

    expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700);
    for (const directory of [
      "private-review",
      "private-evidence",
      "private-reveal",
    ]) {
      expect(
        (await stat(path.join(outputDirectory, directory))).mode & 0o777,
      ).toBe(0o700);
    }
    for (const filePath of Object.values(written)) {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
    expect(await readdir(path.join(outputDirectory, "private-review"))).toEqual(
      ["final-artifact-shadow-pack.json", "final-artifact-shadow-pack.md"],
    );

    const extraPath = path.join(inputDirectory, "unexpected.txt");
    await writeFile(extraPath, "unexpected", { mode: 0o600 });
    await expect(
      loadCoverLetterFinalArtifactShadowCells({ inputDirectory }),
    ).rejects.toThrow(/exact five/iu);

    const symlinkOutput = path.join(root, "symlink-output");
    await symlink(outputDirectory, symlinkOutput, "dir");
    await expect(
      writeCoverLetterFinalArtifactShadowArtifacts({
        inputDirectory,
        outputDirectory: symlinkOutput,
        ...artifacts,
      }),
    ).rejects.toThrow(/symlink output path/iu);
    await rm(root, { recursive: true, force: true });
  });

  it("rejects output trees redirected into private evidence by a symlinked parent", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-final-artifact-symlink-parent-"),
    );
    try {
      const inputDirectory = path.join(root, "private-evidence");
      await mkdir(inputDirectory, { recursive: true, mode: 0o700 });
      const cells = await buildFiveCells();
      await Promise.all(
        cells.map((cell, index) =>
          writeFile(
            path.join(
              inputDirectory,
              `sample-cell-${String(index + 1).padStart(3, "0")}.json`,
            ),
            `${JSON.stringify(cell)}\n`,
            { mode: 0o600 },
          ),
        ),
      );
      const loaded = await loadCoverLetterFinalArtifactShadowCells({
        inputDirectory,
      });
      const replay = await replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells: loaded,
      });
      const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
        runId: "quality-eval-2e-symlink-parent-guard",
        sourceRef: "test-source",
        benchmarkCase,
        replay,
      });
      const inputNamesBefore = await readdir(inputDirectory);
      const symlinkedParent = path.join(root, "symlinked-parent");
      await symlink(inputDirectory, symlinkedParent, "dir");

      await expect(
        writeCoverLetterFinalArtifactShadowArtifacts({
          inputDirectory,
          outputDirectory: path.join(symlinkedParent, "redirected-output"),
          ...artifacts,
        }),
      ).rejects.toThrow(/symlink|overlap/iu);
      expect(await readdir(inputDirectory)).toEqual(inputNamesBefore);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a shared input/output ancestor that is nested below a symlink", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-final-artifact-shared-symlink-"),
    );
    try {
      const redirectedRoot = path.join(root, "redirected-root");
      const redirectedRun = path.join(redirectedRoot, "run");
      const inputDirectory = path.join(redirectedRun, "private-evidence");
      await mkdir(inputDirectory, { recursive: true, mode: 0o700 });
      const cells = await buildFiveCells();
      await Promise.all(
        cells.map((cell, index) =>
          writeFile(
            path.join(
              inputDirectory,
              `sample-cell-${String(index + 1).padStart(3, "0")}.json`,
            ),
            `${JSON.stringify(cell)}\n`,
            { mode: 0o600 },
          ),
        ),
      );
      const replay = await replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells,
      });
      const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
        runId: "quality-eval-2e-shared-symlink-ancestor",
        sourceRef: "test-source",
        benchmarkCase,
        replay,
      });
      const symlinkedRoot = path.join(root, "symlinked-root");
      await symlink(redirectedRoot, symlinkedRoot, "dir");

      await expect(
        writeCoverLetterFinalArtifactShadowArtifacts({
          inputDirectory: path.join(symlinkedRoot, "run", "private-evidence"),
          outputDirectory: path.join(symlinkedRoot, "run", "output"),
          ...artifacts,
        }),
      ).rejects.toThrow(/symlink/iu);
      expect(await readdir(redirectedRun)).toEqual(["private-evidence"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects case-variant output aliases that overlap private evidence", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-final-artifact-case-alias-"),
    );
    try {
      const actualTree = path.join(root, "CaseTree");
      const caseVariantTree = path.join(root, "casetree");
      const inputDirectory = path.join(actualTree, "private-evidence");
      await mkdir(inputDirectory, { recursive: true, mode: 0o700 });
      try {
        if (
          (await realpath(actualTree)) !== (await realpath(caseVariantTree))
        ) {
          return;
        }
      } catch {
        return;
      }
      const cells = await buildFiveCells();
      const replay = await replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells,
      });
      const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
        runId: "quality-eval-2e-case-alias-guard",
        sourceRef: "test-source",
        benchmarkCase,
        replay,
      });

      await expect(
        writeCoverLetterFinalArtifactShadowArtifacts({
          inputDirectory,
          outputDirectory: path.join(
            caseVariantTree,
            "private-evidence",
            "nested-output",
          ),
          ...artifacts,
        }),
      ).rejects.toThrow(/overlap/iu);
      expect(await readdir(inputDirectory)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preflights every private directory before writing any shadow artifact", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-final-artifact-preflight-"),
    );
    try {
      const inputDirectory = path.join(root, "input");
      await mkdir(inputDirectory, { mode: 0o700 });
      const cells = await buildFiveCells();
      const replay = await replayCoverLetterFinalArtifactShadow({
        benchmarkCase,
        cells,
      });
      const artifacts = await buildCoverLetterFinalArtifactShadowArtifacts({
        runId: "quality-eval-2e-private-tree-preflight",
        sourceRef: "test-source",
        benchmarkCase,
        replay,
      });

      for (const directoryName of [
        "private-evidence",
        "private-reveal",
      ] as const) {
        const outputDirectory = path.join(root, `${directoryName}-output`);
        const redirectedDirectory = path.join(
          root,
          `${directoryName}-redirected`,
        );
        await mkdir(outputDirectory, { mode: 0o700 });
        await mkdir(redirectedDirectory, { mode: 0o755 });
        await symlink(
          redirectedDirectory,
          path.join(outputDirectory, directoryName),
          "dir",
        );

        await expect(
          writeCoverLetterFinalArtifactShadowArtifacts({
            inputDirectory,
            outputDirectory,
            ...artifacts,
          }),
        ).rejects.toThrow(/symlink output path/iu);
        expect(await readdir(outputDirectory)).toEqual([directoryName]);
        await expect(
          lstat(path.join(outputDirectory, "private-review")),
        ).rejects.toMatchObject({ code: "ENOENT" });
        expect(await readdir(redirectedDirectory)).toEqual([]);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
