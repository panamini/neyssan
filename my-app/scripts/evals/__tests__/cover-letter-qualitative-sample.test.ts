import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  QUALITY_EVAL_2D_CASE_ID,
  QUALITY_EVAL_2D_COHORT_ID,
  QUALITY_EVAL_2D_WRITER_MODELS,
  buildCoverLetterQualitativeSampleArtifacts,
  buildCoverLetterQualitativeSampleCell,
  buildCoverLetterQualitativeSamplePlan,
  classifyCoverLetterQualitativeSampleOutcome,
  runCoverLetterQualitativeSampleCohort,
  writeCoverLetterQualitativeSampleArtifacts,
  writeCoverLetterQualitativeSampleCellEvidence,
  type CoverLetterQualitativeSampleCell,
} from "../cover-letter-qualitative-sample";
import { coverLetterBlindReviewCases } from "../cases/cover-letter/cases";

async function buildCell(
  writerModel: (typeof QUALITY_EVAL_2D_WRITER_MODELS)[number],
  status: CoverLetterQualitativeSampleCell["status"] = "FIRST_PASS_ACCEPTED",
): Promise<CoverLetterQualitativeSampleCell> {
  const provider =
    writerModel === "mistral-medium-latest" ? "mistral" : "openai";
  const schema = { type: "object", additionalProperties: false };
  return buildCoverLetterQualitativeSampleCell({
    caseId: QUALITY_EVAL_2D_CASE_ID,
    provider,
    requestedModel: writerModel,
    returnedModel: `${writerModel}-returned`,
    status,
    prompt: "same frozen production prompt",
    schema,
    transport: {
      serializedRequest: JSON.stringify({
        model: writerModel,
        prompt: "same frozen production prompt",
      }),
      systemPrompt: provider === "mistral" ? "return only json" : null,
      schemaTarget: schema,
      schemaEnforcementMode:
        provider === "mistral"
          ? "mistral_prompt_contract_with_local_parser"
          : "openai_responses_json_schema_strict",
      promptContract: "quality_eval_2d_shared_v1",
    },
    frozenConfig: {
      model: writerModel,
      reasoningEffort: "low",
      writerMaxOutputTokens: 2_048,
    },
    parsedCandidate: {
      version: "premium_writer_output_v1",
      bodyParts: {
        opening: { text: "I improved retention through clearer onboarding." },
        proofBlock: { text: "I managed enterprise accounts." },
        employerValueBlock: {
          text: "That discipline supports account health.",
        },
        closeLine: { text: "I would welcome a conversation." },
      },
    },
    finalizedLetter:
      status === "FIRST_PASS_ACCEPTED"
        ? "Dear Hiring Manager,\n\nA production-finalized synthetic letter."
        : null,
    diagnostics: {
      failureStage: status === "FIRST_PASS_REJECTED" ? "validation" : null,
      failureReason:
        status === "FIRST_PASS_REJECTED" ? "model_repair_required" : null,
      issues: status === "FIRST_PASS_REJECTED" ? ["greeting_leakage"] : [],
      modelRepairRequired:
        status === "FIRST_PASS_REJECTED"
          ? {
              stage: "writer_output_validation",
              issues: ["greeting_leakage"],
            }
          : null,
      finalization: null,
    },
    reasoningEffort: writerModel === "mistral-medium-latest" ? null : "low",
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    maxRepairs: 0,
    tokenUsage: { inputTokens: 3_000, outputTokens: 600, totalTokens: 3_600 },
    observedCostUpperBoundUsd: 0.033,
    sdkVersions: {
      openai: "4.104.0",
      mistral: "1.9.18",
      langchainMistral: "0.2.1",
    },
    artifactHash: status === "FIRST_PASS_ACCEPTED" ? "a".repeat(64) : null,
    provenanceHash: status === "FIRST_PASS_ACCEPTED" ? "b".repeat(64) : null,
  });
}

describe("QUALITY-EVAL-2D qualitative sample", () => {
  it("freezes one exact synthetic case across five exact writers", () => {
    const plan = buildCoverLetterQualitativeSamplePlan({
      cases: coverLetterBlindReviewCases,
    });

    expect(plan).toHaveLength(5);
    expect(plan.map((item) => item.benchmarkCase.id)).toEqual(
      Array(5).fill(QUALITY_EVAL_2D_CASE_ID),
    );
    expect(plan.map((item) => item.writerModel)).toEqual(
      QUALITY_EVAL_2D_WRITER_MODELS,
    );
  });

  it("records a post-provider first-pass rejection and continues later cells", async () => {
    const sampleCell = vi.fn(async (writerModel: string) =>
      buildCell(
        writerModel as (typeof QUALITY_EVAL_2D_WRITER_MODELS)[number],
        writerModel === "gpt-5.6-terra"
          ? "FIRST_PASS_REJECTED"
          : "FIRST_PASS_ACCEPTED",
      ),
    );

    const cells = await runCoverLetterQualitativeSampleCohort({
      writerModels: QUALITY_EVAL_2D_WRITER_MODELS,
      sampleCell,
    });

    expect(sampleCell).toHaveBeenCalledTimes(5);
    expect(cells).toHaveLength(5);
    expect(cells[2]).toMatchObject({
      requestedModel: "gpt-5.6-terra",
      status: "FIRST_PASS_REJECTED",
      diagnostics: { issues: ["greeting_leakage"] },
    });
    expect(cells[4]).toMatchObject({
      requestedModel: "mistral-medium-latest",
      status: "FIRST_PASS_ACCEPTED",
      promptHashScope: "effective_user_prompt",
      transport: {
        requestProjectionHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        systemPromptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        schemaEnforcementMode: "mistral_prompt_contract_with_local_parser",
        promptContract: "quality_eval_2d_shared_v1",
      },
    });
  });

  it("distinguishes explicit model rejection from systemic post-response failure", () => {
    expect(
      classifyCoverLetterQualitativeSampleOutcome({
        accepted: false,
        modelRepairRequired: null,
        failureStage: null,
        resultStatus: "generation_failed",
        artifactDecision: null,
      }),
    ).toBe("SYSTEMIC_FAILURE");
    expect(
      classifyCoverLetterQualitativeSampleOutcome({
        accepted: false,
        modelRepairRequired: {
          stage: "writer_output_validation",
          issues: ["greeting_leakage"],
        },
        failureStage: null,
        resultStatus: null,
        artifactDecision: null,
      }),
    ).toBe("FIRST_PASS_REJECTED");
    expect(
      classifyCoverLetterQualitativeSampleOutcome({
        accepted: false,
        modelRepairRequired: null,
        failureStage: null,
        resultStatus: "finalization_failed",
        artifactDecision: "rejected",
      }),
    ).toBe("FIRST_PASS_REJECTED");
  });

  it("aborts on systemic execution errors while retaining completed private evidence", async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "cover-letter-qualitative-abort-"),
    );
    const sampleCell = vi.fn(async (writerModel: string) => {
      if (writerModel === "mistral-medium-latest") {
        throw new Error("authentication failed");
      }
      return buildCell(
        writerModel as (typeof QUALITY_EVAL_2D_WRITER_MODELS)[number],
      );
    });

    await expect(
      runCoverLetterQualitativeSampleCohort({
        writerModels: QUALITY_EVAL_2D_WRITER_MODELS,
        sampleCell,
        onCompletedCell: ({ cell, index }) =>
          writeCoverLetterQualitativeSampleCellEvidence({
            outputDirectory,
            index,
            cell,
          }).then(() => undefined),
      }),
    ).rejects.toThrow("authentication failed");
    expect(sampleCell).toHaveBeenCalledTimes(5);
    expect(
      await readdir(path.join(outputDirectory, "private-evidence")),
    ).toEqual([
      "sample-cell-001.json",
      "sample-cell-002.json",
      "sample-cell-003.json",
      "sample-cell-004.json",
    ]);
  });

  it("aborts immediately when private evidence persistence fails", async () => {
    const sampleCell = vi.fn(async (writerModel: string) =>
      buildCell(writerModel as (typeof QUALITY_EVAL_2D_WRITER_MODELS)[number]),
    );

    await expect(
      runCoverLetterQualitativeSampleCohort({
        writerModels: QUALITY_EVAL_2D_WRITER_MODELS,
        sampleCell,
        onCompletedCell: async () => {
          throw new Error("private evidence write failed");
        },
      }),
    ).rejects.toThrow("private evidence write failed");
    expect(sampleCell).toHaveBeenCalledOnce();
  });

  it("builds an exact-set blind pack and private reveal without model leakage", async () => {
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (item) => item.id === QUALITY_EVAL_2D_CASE_ID,
    )!;
    const cells = await Promise.all(
      QUALITY_EVAL_2D_WRITER_MODELS.map((writerModel) =>
        buildCell(
          writerModel,
          writerModel === "gpt-5.6-terra"
            ? "FIRST_PASS_REJECTED"
            : "FIRST_PASS_ACCEPTED",
        ),
      ),
    );
    const blindingSecret = "a".repeat(64);
    const artifacts = await buildCoverLetterQualitativeSampleArtifacts({
      cohortId: QUALITY_EVAL_2D_COHORT_ID,
      runId: "quality-eval-2d-test",
      sourceRef: "c".repeat(40),
      benchmarkCase,
      cells,
      blindingSecret,
    });
    const differentlyBlinded = await buildCoverLetterQualitativeSampleArtifacts(
      {
        cohortId: QUALITY_EVAL_2D_COHORT_ID,
        runId: "quality-eval-2d-test",
        sourceRef: "c".repeat(40),
        benchmarkCase,
        cells,
        blindingSecret: "b".repeat(64),
      },
    );

    expect(artifacts.pack.entries).toHaveLength(5);
    expect(artifacts.revealMap.entries).toHaveLength(5);
    expect(
      artifacts.pack.entries.map((entry) => entry.blindLabel).sort(),
    ).toEqual(["CL-001", "CL-002", "CL-003", "CL-004", "CL-005"]);
    expect(
      artifacts.revealMap.entries.map((entry) => entry.requestedModel).sort(),
    ).toEqual([...QUALITY_EVAL_2D_WRITER_MODELS].sort());
    const serializedPack = JSON.stringify(artifacts.pack);
    for (const writerModel of QUALITY_EVAL_2D_WRITER_MODELS) {
      expect(serializedPack).not.toContain(writerModel);
    }
    for (const cell of cells) {
      expect(serializedPack).not.toContain(cell.promptHash);
      expect(serializedPack).not.toContain(cell.configHash);
    }
    expect(serializedPack).not.toContain(blindingSecret);
    expect(serializedPack).not.toMatch(
      /promptHash|configHash|reasoningEffort/iu,
    );
    expect(artifacts.pack.sharedRunContract).toEqual({
      schemaHash: cells[0]!.schemaHash,
      writerMaxOutputTokens: 2_048,
      providerMaxRetries: 0,
      maxRepairs: 0,
    });
    expect(artifacts.revealMap.blindingSecret).toBe(blindingSecret);
    expect(
      artifacts.revealMap.entries.map(({ blindLabel, requestedModel }) => ({
        blindLabel,
        requestedModel,
      })),
    ).not.toEqual(
      differentlyBlinded.revealMap.entries.map(
        ({ blindLabel, requestedModel }) => ({ blindLabel, requestedModel }),
      ),
    );
    expect(serializedPack).toContain("FIRST_PASS_REJECTED");
    expect(serializedPack).toContain("greeting_leakage");

    await expect(
      buildCoverLetterQualitativeSampleArtifacts({
        cohortId: QUALITY_EVAL_2D_COHORT_ID,
        runId: "quality-eval-2d-missing",
        sourceRef: "d".repeat(40),
        benchmarkCase,
        cells: cells.slice(0, 4),
      }),
    ).rejects.toThrow(/exact five-model sample/iu);
  });

  it("writes atomic private 0600 files under 0700 directories", async () => {
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (item) => item.id === QUALITY_EVAL_2D_CASE_ID,
    )!;
    const cells = await Promise.all(
      QUALITY_EVAL_2D_WRITER_MODELS.map((writerModel) =>
        buildCell(writerModel),
      ),
    );
    const artifacts = await buildCoverLetterQualitativeSampleArtifacts({
      cohortId: QUALITY_EVAL_2D_COHORT_ID,
      runId: "quality-eval-2d-permissions",
      sourceRef: "e".repeat(40),
      benchmarkCase,
      cells,
    });
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "cover-letter-qualitative-sample-"),
    );
    const written = await writeCoverLetterQualitativeSampleArtifacts({
      outputDirectory,
      ...artifacts,
    });

    for (const directory of [
      outputDirectory,
      path.dirname(written.packJsonPath),
      path.dirname(written.revealMapJsonPath),
    ]) {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
    }
    for (const filePath of Object.values(written)) {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
    expect(
      await readdir(path.dirname(written.packJsonPath)),
    ).not.toContainEqual(expect.stringMatching(/\.tmp$/u));
    expect(
      await readdir(path.dirname(written.revealMapJsonPath)),
    ).not.toContainEqual(expect.stringMatching(/\.tmp$/u));
    expect(await readFile(written.packMarkdownPath, "utf8")).not.toContain(
      "gpt-5.6-terra",
    );
    expect(await readFile(written.revealMapJsonPath, "utf8")).toContain(
      "gpt-5.6-luna",
    );
  });

  it("rejects symlinked private output directories before writing through them", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-qualitative-symlink-"),
    );
    try {
      const benchmarkCase = coverLetterBlindReviewCases.find(
        (item) => item.id === QUALITY_EVAL_2D_CASE_ID,
      )!;
      const cells = await Promise.all(
        QUALITY_EVAL_2D_WRITER_MODELS.map((writerModel) =>
          buildCell(writerModel),
        ),
      );
      const artifacts = await buildCoverLetterQualitativeSampleArtifacts({
        cohortId: QUALITY_EVAL_2D_COHORT_ID,
        runId: "quality-eval-2d-symlink-guard",
        sourceRef: "f".repeat(40),
        benchmarkCase,
        cells,
      });

      for (const directoryName of [
        "private-review",
        "private-reveal",
      ] as const) {
        const outputDirectory = path.join(root, `${directoryName}-output`);
        const redirectedDirectory = path.join(
          root,
          `${directoryName}-redirected`,
        );
        await mkdir(outputDirectory, { mode: 0o700 });
        await mkdir(redirectedDirectory, { mode: 0o755 });
        await chmod(redirectedDirectory, 0o755);
        await symlink(
          redirectedDirectory,
          path.join(outputDirectory, directoryName),
          "dir",
        );

        await expect(
          writeCoverLetterQualitativeSampleArtifacts({
            outputDirectory,
            ...artifacts,
          }),
        ).rejects.toThrow(/symlink output path/iu);
        if (directoryName === "private-reveal") {
          await expect(
            lstat(path.join(outputDirectory, "private-review")),
          ).rejects.toMatchObject({ code: "ENOENT" });
        }
        expect(await readdir(redirectedDirectory)).toEqual([]);
        expect((await stat(redirectedDirectory)).mode & 0o777).toBe(0o755);
      }

      const evidenceOutputDirectory = path.join(
        root,
        "private-evidence-output",
      );
      const redirectedEvidenceDirectory = path.join(
        root,
        "private-evidence-redirected",
      );
      await mkdir(evidenceOutputDirectory, { mode: 0o700 });
      await mkdir(redirectedEvidenceDirectory, { mode: 0o755 });
      await chmod(redirectedEvidenceDirectory, 0o755);
      await symlink(
        redirectedEvidenceDirectory,
        path.join(evidenceOutputDirectory, "private-evidence"),
        "dir",
      );

      await expect(
        writeCoverLetterQualitativeSampleCellEvidence({
          outputDirectory: evidenceOutputDirectory,
          index: 0,
          cell: cells[0]!,
        }),
      ).rejects.toThrow(/symlink output path/iu);
      expect(await readdir(redirectedEvidenceDirectory)).toEqual([]);
      expect((await stat(redirectedEvidenceDirectory)).mode & 0o777).toBe(
        0o755,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked output ancestor before creating the requested tree", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "cover-letter-qualitative-symlink-parent-"),
    );
    try {
      const benchmarkCase = coverLetterBlindReviewCases.find(
        (item) => item.id === QUALITY_EVAL_2D_CASE_ID,
      )!;
      const cells = await Promise.all(
        QUALITY_EVAL_2D_WRITER_MODELS.map((writerModel) =>
          buildCell(writerModel),
        ),
      );
      const artifacts = await buildCoverLetterQualitativeSampleArtifacts({
        cohortId: QUALITY_EVAL_2D_COHORT_ID,
        runId: "quality-eval-2d-symlink-parent-guard",
        sourceRef: "f".repeat(40),
        benchmarkCase,
        cells,
      });
      const redirectedRoot = path.join(root, "redirected-root");
      const symlinkedRoot = path.join(root, "symlinked-root");
      await mkdir(redirectedRoot, { mode: 0o755 });
      await symlink(redirectedRoot, symlinkedRoot, "dir");

      await expect(
        writeCoverLetterQualitativeSampleArtifacts({
          outputDirectory: path.join(symlinkedRoot, "new-output"),
          ...artifacts,
        }),
      ).rejects.toThrow(/symlink/iu);
      expect(await readdir(redirectedRoot)).toEqual([]);
      expect((await stat(redirectedRoot)).mode & 0o777).toBe(0o755);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
