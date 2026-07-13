import { afterEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";

import type { PremiumCoverLetterFinalProvenance } from "../../../convex/lib/proposals/premiumCoverLetter";
import generationMutationSource from "../../../convex/generateProposalMutation.ts?raw";
import artifactSource from "../cover-letter-eval-artifact.ts?raw";
import {
  COVER_LETTER_EVAL_CONTRACT_VERSIONS,
  COVER_LETTER_EVAL_HASH_CONTRACT,
  buildCoverLetterEvalArtifactHash,
  prepareCoverLetterEvalArtifact,
  type CoverLetterEvalArtifactProjection,
  type CoverLetterEvalConfigVersions,
  type CoverLetterEvalFrozenConfig,
  type PrepareCoverLetterEvalArtifactArgs,
} from "../cover-letter-eval-artifact";

const CONFIG_VERSIONS: CoverLetterEvalConfigVersions = {
  generationControls: "generation_controls_v1",
  companyValues: "company_values_v1",
  writerSchema: "premium_writer_output_v1",
  cancellation: "proposal_cancellation_v1",
  finalizer: "premium_persistence_finalizer_v1",
};

const FROZEN_CONFIG: CoverLetterEvalFrozenConfig = {
  provider: "openai",
  model: "gpt-5.5",
  outputLanguage: "English",
  preset: "signature",
  proposalQualityMode: "baseline",
  hasCandidateContext: true,
  providerMaxRetries: 0,
  writerMaxOutputTokens: 2048,
  promptV2: false,
  qualityRepair: false,
  reasoningEffort: "low",
  generationControlsHash: "a".repeat(64),
  companyValuesHash: "b".repeat(64),
  writerSchemaHash: "c".repeat(64),
};

it("keeps the production finalizer runtime importable without Convex codegen", () => {
  const sourceFile = ts.createSourceFile(
    "generateProposalMutation.ts",
    generationMutationSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const runtimeGeneratedImports = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter((statement) =>
      /^\.\/_generated\/(?:server|api)$/u.test(
        (statement.moduleSpecifier as ts.StringLiteral).text,
      ),
    )
    .filter((statement) => !statement.importClause?.isTypeOnly)
    .map((statement) => statement.getText(sourceFile));

  expect(runtimeGeneratedImports).toEqual([]);
  expect(generationMutationSource).toMatch(/\bactionGeneric\b/u);
  expect(generationMutationSource).toMatch(/\banyApi\b/u);
});

function acceptedArgs(): PrepareCoverLetterEvalArtifactArgs {
  const opening =
    "Weekly QA reporting, field notes, and issue handoffs shaped the operating discipline behind my support work.";
  const proofBlock =
    "Those habits are useful where escalation records and follow-up notes need to stay clear across shifts.";
  const employerValueBlock =
    "That record discipline fits teams that need reliable support handoffs without losing context.";
  const closeLine = "I would be glad to discuss the position further.";
  const content = [
    "Dear Hiring Manager,",
    "",
    opening,
    "",
    proofBlock,
    "",
    employerValueBlock,
    "",
    closeLine,
    "",
    "Sincerely,",
    "Casey Reed",
  ].join("\n");
  const provenance: PremiumCoverLetterFinalProvenance = {
    version: "premium_cover_letter_final_provenance_v1",
    status: "validated_final_text",
    origin: "provider_reported",
    contextClass: "cv_direct",
    candidateFactIds: ["fact_cv_support_reporting"],
    verifiedCandidateFactIds: ["fact_cv_support_reporting"],
    candidateFacts: [
      {
        id: "fact_cv_support_reporting",
        section: "opening",
        text: "Completed weekly QA reports, field notes, and issue handoffs for support escalations.",
        source: "cv",
        metrics: [],
        entities: [],
      },
    ],
    sections: {
      opening: {
        section: "opening",
        text: opening,
        claimIds: ["claim_opening"],
        factIds: ["fact_cv_support_reporting"],
        demandIds: [],
        candidateFactIds: ["fact_cv_support_reporting"],
        verifiedCandidateFactIds: ["fact_cv_support_reporting"],
      },
      proofBlock: {
        section: "proofBlock",
        text: proofBlock,
        claimIds: ["claim_proof"],
        factIds: [],
        demandIds: [],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      employerValueBlock: {
        section: "employerValueBlock",
        text: employerValueBlock,
        claimIds: ["claim_employer_value"],
        factIds: [],
        demandIds: ["demand_core"],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      closeLine: {
        section: "closeLine",
        text: closeLine,
        claimIds: ["claim_close"],
        factIds: [],
        demandIds: [],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
    },
  };

  return {
    caseId: "synthetic-casey-support",
    payload: {
      content,
      sections: [{ type: "text", content }],
      bodyParts: { opening, proofBlock, employerValueBlock, closeLine },
      qualityShadow: {
        passed: false,
        score: 4,
        issues: ["generic_tone"],
      },
      finalProvenance: provenance,
    },
    outputLanguage: "English",
    candidateName: "Casey Reed",
    voicePreset: "signature",
    hasCandidateContext: true,
    configVersions: CONFIG_VERSIONS,
    frozenConfig: FROZEN_CONFIG,
  };
}

function rejectedArgs(): PrepareCoverLetterEvalArtifactArgs {
  const content = [
    "Dear Hiring Manager,",
    "",
    "The role requires reliable coordination and clear communication.",
    "",
    "The team values careful follow-through and professional support.",
    "",
    "I would welcome the chance to discuss the role.",
    "",
    "Sincerely,",
    "Casey Reed",
  ].join("\n");
  return {
    caseId: "synthetic-rejected-generic",
    payload: {
      content,
      sections: [{ type: "text", content }],
    },
    outputLanguage: "English",
    candidateName: "Casey Reed",
    voicePreset: "expert",
    hasCandidateContext: true,
    configVersions: CONFIG_VERSIONS,
    frozenConfig: { ...FROZEN_CONFIG, preset: "expert" },
  };
}

function withoutHash(
  artifact: Awaited<
    ReturnType<typeof prepareCoverLetterEvalArtifact>
  >["artifact"],
): CoverLetterEvalArtifactProjection {
  const { artifactHash: _artifactHash, ...projection } = artifact;
  return projection;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cover-letter eval artifact", () => {
  it("finalizes an accepted payload offline and hashes only the deterministic projection", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden in artifact preparation");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const firstResult = await prepareCoverLetterEvalArtifact(acceptedArgs());
    const secondResult = await prepareCoverLetterEvalArtifact(acceptedArgs());
    const first = firstResult.artifact;
    const second = secondResult.artifact;

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(first).toEqual(second);
    expect(firstResult.finalizedPayload).not.toBeNull();
    expect(firstResult.finalizedPayload?.content).toBe(first.finalContent);
    expect(firstResult.finalizedPayload?.sections).toEqual(first.sections);
    expect(first.decision).toBe("accepted");
    expect(first.finalContent).toContain("Weekly QA reporting");
    expect(first.sections).toEqual([
      { type: "text", content: first.finalContent },
    ]);
    expect(first.provenance).toMatchObject({
      version: "premium_cover_letter_final_provenance_v1",
      status: "validated_after_structured_repair",
      origin: "provider_reported",
      contextClass: "cv_direct",
      candidateFactIds: ["fact_cv_support_reporting"],
      verifiedCandidateFactIds: ["fact_cv_support_reporting"],
    });
    expect(first.provenanceHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.keys(first.provenance?.sections ?? {})).toEqual([
      "opening",
      "proofBlock",
      "employerValueBlock",
      "closeLine",
    ]);
    expect(first.hashContract).toEqual(COVER_LETTER_EVAL_HASH_CONTRACT);
    expect(first.contractVersions).toEqual(COVER_LETTER_EVAL_CONTRACT_VERSIONS);
    expect(first.configVersions).toEqual(CONFIG_VERSIONS);
    expect(first.frozenConfig).toEqual(FROZEN_CONFIG);
    expect(first.artifactHash).toMatch(/^[a-f0-9]{64}$/u);
    await expect(
      buildCoverLetterEvalArtifactHash(withoutHash(first)),
    ).resolves.toBe(first.artifactHash);

    const serialized = JSON.stringify(first);
    expect(serialized).toContain("fact_cv_support_reporting");
    expect(serialized).toContain("claim_opening");
    expect(serialized).toContain("demand_core");
    expect(serialized).not.toMatch(
      /jobDescription|rawCv|rawJob|providerEnvelope|rawResponse|requestId|runId|createdAt|updatedAt/iu,
    );
  });

  it("records a rejected finalization with closed diagnostic classes and no raw input", async () => {
    const firstResult = await prepareCoverLetterEvalArtifact(rejectedArgs());
    const secondResult = await prepareCoverLetterEvalArtifact(rejectedArgs());
    const first = firstResult.artifact;
    const second = secondResult.artifact;

    expect(first).toEqual(second);
    expect(firstResult.finalizedPayload).toBeNull();
    expect(first).toMatchObject({
      decision: "rejected",
      finalContent: null,
      sections: [],
      provenance: null,
      provenanceHash: null,
      diagnostics: {
        finalization: {
          errorClass: "proposal_finalization_error",
          failureStage: expect.any(String),
        },
      },
    });
    expect(JSON.stringify(first)).not.toContain(
      "The role requires reliable coordination and clear communication.",
    );
    expect(JSON.stringify(first)).not.toMatch(/candidate-backed evidence/iu);
  });

  it("preserves exact Unicode, line-ending, and section-order bytes in the hash", async () => {
    const base = withoutHash(
      (await prepareCoverLetterEvalArtifact(acceptedArgs())).artifact,
    );
    const withExactContent = (
      content: string,
    ): CoverLetterEvalArtifactProjection => ({
      ...base,
      finalContent: content,
      sections: [{ type: "text", content }],
    });

    const nfc = withExactContent("Résumé");
    const nfd = withExactContent("Re\u0301sume\u0301");
    await expect(buildCoverLetterEvalArtifactHash(nfc)).resolves.not.toBe(
      await buildCoverLetterEvalArtifactHash(nfd),
    );

    const lf = withExactContent("First line\nSecond line");
    const crlf = withExactContent("First line\r\nSecond line");
    await expect(buildCoverLetterEvalArtifactHash(lf)).resolves.not.toBe(
      await buildCoverLetterEvalArtifactHash(crlf),
    );

    const forward: CoverLetterEvalArtifactProjection = {
      ...base,
      sections: [
        { type: "text", content: "first" },
        { type: "text", content: "second" },
      ],
    };
    const reversed: CoverLetterEvalArtifactProjection = {
      ...base,
      sections: [...forward.sections].reverse(),
    };
    await expect(buildCoverLetterEvalArtifactHash(forward)).resolves.not.toBe(
      await buildCoverLetterEvalArtifactHash(reversed),
    );
  });

  it("binds every frozen generation configuration change into the artifact hash", async () => {
    const baseline = await prepareCoverLetterEvalArtifact(acceptedArgs());
    const changed = await prepareCoverLetterEvalArtifact({
      ...acceptedArgs(),
      frozenConfig: {
        ...FROZEN_CONFIG,
        model: "gpt-5.4",
      },
    });

    expect(changed.artifact.finalContent).toBe(baseline.artifact.finalContent);
    expect(changed.artifact.artifactHash).not.toBe(
      baseline.artifact.artifactHash,
    );
  });

  it("rejects unbounded identity/config fields and keeps the module side-effect free", async () => {
    await expect(
      prepareCoverLetterEvalArtifact({
        ...acceptedArgs(),
        caseId: "Case with private spaces",
      }),
    ).rejects.toThrow(/synthetic caseId/u);
    await expect(
      prepareCoverLetterEvalArtifact({
        ...acceptedArgs(),
        configVersions: {
          ...CONFIG_VERSIONS,
          rawPrompt: "not allowed",
        } as CoverLetterEvalConfigVersions,
      }),
    ).rejects.toThrow(/only version fields/u);

    expect(artifactSource).not.toMatch(
      /runMutation|ctx\.db|fetch\(|writeFile|mkdir|process\.env|Date\.now|Math\.random|randomUUID/iu,
    );
    expect(artifactSource).not.toMatch(
      /OPENAI_API_KEY|MISTRAL_API_KEY|Authorization/iu,
    );
  });
});
