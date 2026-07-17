import { describe, expect, it, vi } from "vitest";

import {
  buildCoverLetterSafeArmDiagnostic,
  COVER_LETTER_SAFE_ARM_LANGUAGE_CODES,
  COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES,
  createCoverLetterOpaqueArmIdBlindingKey,
  deriveCoverLetterOpaqueArmId,
  redactCoverLetterSafeArmDiagnosticInput,
  releaseCoverLetterOpaqueArmIdBlindingKey,
  validateCoverLetterSafeArmDiagnostic,
  type CoverLetterOpaqueArmIdBlindingKey,
  type CoverLetterSafeArmDiagnosticInput,
} from "../cover-letter-safe-arm-diagnostic";
import type { PremiumCoverLetterQualityShadowIssueCode } from "../../../convex/lib/proposals/premiumCoverLetter";
import type { ProposalDocumentLanguageCode } from "../../../convex/lib/proposals/proposalOutput";

const HASH = "a".repeat(64);
const SOURCE_REF = "b".repeat(40);

const ACTIVE_QUALITY_SHADOW_CODES: Record<
  PremiumCoverLetterQualityShadowIssueCode,
  true
> = {
  meta_prose: true,
  generic_tone: true,
  factual_inventory: true,
  weak_employer_argument: true,
  low_value_job_echo: true,
  low_specificity: true,
  too_verbose: true,
};

const ACTIVE_LANGUAGE_CODES: Record<ProposalDocumentLanguageCode, true> = {
  en: true,
  fr: true,
  es: true,
  de: true,
  it: true,
  pt: true,
  pl: true,
  nl: true,
  el: true,
  hu: true,
  lt: true,
  et: true,
  ru: true,
  ar: true,
};

function diagnosticInput(): CoverLetterSafeArmDiagnosticInput {
  return {
    version: "cover_letter_safe_arm_diagnostic_v1",
    identity: {
      runId: "quality-eval-5-local-test",
      fixtureId: "fixture-en-direct-001",
      opaqueArmId: `arm-${HASH}`,
      artifactHash: HASH,
      sourceRef: SOURCE_REF,
      promptContractHash: HASH,
      finalizerVersion: "premium_persistence_finalizer_v1",
      finalizerHash: HASH,
      extractorHash: HASH,
    },
    provenance: {
      artifactHash: "RETAINED",
      promptContractHash: "RETAINED",
      finalizer: "RETAINED",
      extractor: "RECOMPUTED_DETERMINISTICALLY",
      finalizerSignals: "RETAINED",
      qualityShadow: "RETAINED",
      structure: "RECOMPUTED_DETERMINISTICALLY",
      language: "RECOMPUTED_DETERMINISTICALLY",
      promptMarker: "RETAINED",
    },
    signals: {
      finalizer: {
        pathCode: "structured_repaired_success",
        repairCodes: ["structured_repair_applied", "bridge_sentence_removed"],
        finalizerPassed: true,
      },
      qualityShadow: {
        preCodes: ["generic_tone"],
        postCodes: [],
        prePassed: false,
        postPassed: true,
        preScore: 82,
        postScore: 100,
      },
      structure: {
        paragraphCount: 6,
        bodyParagraphCount: 4,
        closeCount: 1,
        bridgeCount: 1,
        proofCount: 2,
        codes: [
          "body_paragraph_count_available",
          "paragraph_count_available",
          "close_present",
          "bridge_present",
          "proof_present",
        ],
      },
      languageCode: "en",
      promptMarker: {
        markerCode: "present",
        hashStatus: "verified",
      },
    },
  };
}

describe("cover-letter safe arm diagnostics", () => {
  it("builds a stable allowlisted diagnostic with a sealed hash", async () => {
    const first = await buildCoverLetterSafeArmDiagnostic(diagnosticInput());
    const second = await buildCoverLetterSafeArmDiagnostic(diagnosticInput());

    expect(first).toEqual(second);
    expect(first.diagnosticHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.identity).toEqual(diagnosticInput().identity);
    expect(JSON.stringify(first)).not.toMatch(
      /raw-letter|private-prompt|reviewer-rationale|generator-model/u,
    );
    await expect(validateCoverLetterSafeArmDiagnostic(first)).resolves.toEqual(
      first,
    );
  });

  it("records unavailable evidence as missing instead of inferring it", async () => {
    const input = diagnosticInput();
    const diagnostic = await buildCoverLetterSafeArmDiagnostic({
      ...input,
      identity: {
        ...input.identity,
        artifactHash: null,
        promptContractHash: null,
        finalizerVersion: null,
        finalizerHash: null,
      },
      provenance: {
        ...input.provenance,
        artifactHash: "MISSING_NOT_RECONSTRUCTABLE",
        promptContractHash: "MISSING_NOT_RECONSTRUCTABLE",
        finalizer: "MISSING_NOT_RECONSTRUCTABLE",
        finalizerSignals: "MISSING_NOT_RECONSTRUCTABLE",
        qualityShadow: "MISSING_NOT_RECONSTRUCTABLE",
        structure: "MISSING_NOT_RECONSTRUCTABLE",
        language: "MISSING_NOT_RECONSTRUCTABLE",
        promptMarker: "MISSING_NOT_RECONSTRUCTABLE",
      },
      signals: {
        ...input.signals,
        finalizer: {
          pathCode: "missing",
          repairCodes: [],
          finalizerPassed: null,
        },
        qualityShadow: {
          preCodes: [],
          postCodes: [],
          prePassed: null,
          postPassed: null,
          preScore: null,
          postScore: null,
        },
        structure: {
          paragraphCount: null,
          bodyParagraphCount: null,
          closeCount: null,
          bridgeCount: null,
          proofCount: null,
          codes: ["counts_unavailable"],
        },
        languageCode: "unknown",
        promptMarker: {
          markerCode: "unavailable",
          hashStatus: "missing",
        },
      },
    });

    expect(diagnostic.identity.artifactHash).toBeNull();
    expect(diagnostic.provenance.finalizer).toBe("MISSING_NOT_RECONSTRUCTABLE");
    expect(diagnostic.signals.qualityShadow.postPassed).toBeNull();
    expect(diagnostic.signals.structure.codes).toEqual(["counts_unavailable"]);
  });

  it("covers every active quality-shadow issue code", () => {
    expect([...COVER_LETTER_SAFE_ARM_QUALITY_SHADOW_CODES].sort()).toEqual(
      Object.keys(ACTIVE_QUALITY_SHADOW_CODES).sort(),
    );
  });

  it("covers every active requested output language code", async () => {
    expect([...COVER_LETTER_SAFE_ARM_LANGUAGE_CODES].sort()).toEqual(
      Object.keys(ACTIVE_LANGUAGE_CODES).sort(),
    );
    for (const languageCode of Object.keys(
      ACTIVE_LANGUAGE_CODES,
    ) as ProposalDocumentLanguageCode[]) {
      const diagnostic = await buildCoverLetterSafeArmDiagnostic({
        ...diagnosticInput(),
        signals: { ...diagnosticInput().signals, languageCode },
      });
      expect(diagnostic.signals.languageCode).toBe(languageCode);
    }
  });

  it("derives an opaque arm id without exposing the arm key", async () => {
    const blindingKey = createCoverLetterOpaqueArmIdBlindingKey();
    const args = {
      runId: "quality-eval-5-local-test",
      fixtureId: "fixture-en-direct-001",
      armKey: "arm-a",
      blindingKey,
    };
    const armId = await deriveCoverLetterOpaqueArmId(args);

    expect(armId).toMatch(/^arm-[a-f0-9]{64}$/u);
    expect(armId).not.toContain("arm-a");
    expect(JSON.stringify(blindingKey)).toBe("{}");
    await expect(deriveCoverLetterOpaqueArmId(args)).resolves.toBe(armId);
    await expect(
      deriveCoverLetterOpaqueArmId({
        ...args,
        blindingKey: createCoverLetterOpaqueArmIdBlindingKey(),
      }),
    ).resolves.not.toBe(armId);
    for (const candidateArmKey of ["arm-a", "arm-b", "arm-c"]) {
      await expect(
        deriveCoverLetterOpaqueArmId({
          ...args,
          armKey: candidateArmKey,
          blindingKey: createCoverLetterOpaqueArmIdBlindingKey(),
        }),
      ).resolves.not.toBe(armId);
    }
  });

  it("releases a process-local blinding key and rejects reuse", async () => {
    const blindingKey = createCoverLetterOpaqueArmIdBlindingKey();
    const args = {
      runId: "quality-eval-5-local-test",
      fixtureId: "fixture-en-direct-001",
      armKey: "arm-a",
      blindingKey,
    };
    await expect(deriveCoverLetterOpaqueArmId(args)).resolves.toMatch(
      /^arm-[a-f0-9]{64}$/u,
    );

    releaseCoverLetterOpaqueArmIdBlindingKey(blindingKey);

    await expect(deriveCoverLetterOpaqueArmId(args)).rejects.toThrow(
      "safe arm diagnostic validation failed",
    );
    expect(() => releaseCoverLetterOpaqueArmIdBlindingKey(blindingKey)).toThrow(
      "safe arm diagnostic validation failed",
    );
    expect(() =>
      releaseCoverLetterOpaqueArmIdBlindingKey(
        structuredClone(
          createCoverLetterOpaqueArmIdBlindingKey(),
        ) as CoverLetterOpaqueArmIdBlindingKey,
      ),
    ).toThrow("safe arm diagnostic validation failed");
  });

  it("rejects missing, weak, and content-bearing arm-id secrets without echo", async () => {
    const sentinel = "private-arm-id-blinding-secret";
    const base = {
      runId: "quality-eval-5-local-test",
      fixtureId: "fixture-en-direct-001",
      armKey: "arm-a",
    };
    const invalidInputs = [
      base,
      { ...base, blindingKey: sentinel },
      { ...base, blindingKey: new Uint8Array(32) },
      { ...base, blindingKey: Object.freeze(Object.create(null)) },
      {
        ...base,
        blindingKey: structuredClone(createCoverLetterOpaqueArmIdBlindingKey()),
      },
      {
        ...base,
        blindingKey: createCoverLetterOpaqueArmIdBlindingKey(),
        secretRationale: sentinel,
      },
    ];

    for (const invalid of invalidInputs) {
      const error = await deriveCoverLetterOpaqueArmId(
        invalid as Parameters<typeof deriveCoverLetterOpaqueArmId>[0],
      ).catch((value: unknown) => value);
      expect(String(error)).toBe(
        "TypeError: safe arm diagnostic validation failed.",
      );
      expect(String(error)).not.toContain(sentinel);
    }
  });

  it("fails closed on unknown fields and content-bearing strings", async () => {
    const sentinel = "raw-letter-private-prompt-reviewer-rationale";
    const invalid = {
      ...diagnosticInput(),
      rawLetter: sentinel,
      prompt: sentinel,
      rationale: sentinel,
    };
    const outputMessages: string[] = [];
    const outputSpies = ["log", "warn", "error"].map((method) =>
      vi
        .spyOn(console, method as "log" | "warn" | "error")
        .mockImplementation((...args: unknown[]) => {
          outputMessages.push(args.map(String).join(" "));
        }),
    );

    await expect(buildCoverLetterSafeArmDiagnostic(invalid)).rejects.toThrow(
      "safe arm diagnostic validation failed",
    );
    expect(redactCoverLetterSafeArmDiagnosticInput(invalid)).toBeNull();
    expect(outputMessages).toEqual([]);
    expect(
      JSON.stringify(redactCoverLetterSafeArmDiagnosticInput(invalid)),
    ).not.toContain(sentinel);
    await expect(
      validateCoverLetterSafeArmDiagnostic({
        ...invalid,
        rawLetter: undefined,
        prompt: undefined,
        rationale: undefined,
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    for (const outputSpy of outputSpies) {
      expect(outputSpy).not.toHaveBeenCalled();
      outputSpy.mockRestore();
    }
  });

  it("rejects unknown diagnostic codes without echoing their values", async () => {
    const sentinel = "secret-unknown-quality-code";
    const invalid = {
      ...diagnosticInput(),
      signals: {
        ...diagnosticInput().signals,
        qualityShadow: {
          ...diagnosticInput().signals.qualityShadow,
          preCodes: [sentinel],
        },
      },
    };

    const error = await buildCoverLetterSafeArmDiagnostic(invalid).catch(
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).toBe(
      "TypeError: safe arm diagnostic validation failed.",
    );
    expect(String(error)).not.toContain(sentinel);
    expect(redactCoverLetterSafeArmDiagnosticInput(invalid)).toBeNull();
  });

  it("rejects tampered sealed diagnostics and invalid identity hashes", async () => {
    const diagnostic =
      await buildCoverLetterSafeArmDiagnostic(diagnosticInput());
    await expect(
      validateCoverLetterSafeArmDiagnostic({
        ...diagnostic,
        identity: { ...diagnostic.identity, artifactHash: "not-a-hash" },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      validateCoverLetterSafeArmDiagnostic({
        ...diagnostic,
        diagnosticHash: "c".repeat(64),
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
  });

  it("accepts active short source refs and rejects unsafe refs", async () => {
    for (const sourceRef of ["abcdef0", "bbd96b5c"] as const) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...diagnosticInput(),
          identity: { ...diagnosticInput().identity, sourceRef },
        }),
      ).resolves.toMatchObject({ identity: { sourceRef } });
    }
    for (const sourceRef of [
      "abcdef",
      "g".repeat(8),
      "b".repeat(41),
      "b".repeat(63),
      "../unsafe-ref",
    ]) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...diagnosticInput(),
          identity: { ...diagnosticInput().identity, sourceRef },
        }),
      ).rejects.toThrow("safe arm diagnostic validation failed");
    }
  });

  it.each([
    [
      "duplicate repair code",
      (input: CoverLetterSafeArmDiagnosticInput) => ({
        ...input,
        signals: {
          ...input.signals,
          finalizer: {
            ...input.signals.finalizer,
            repairCodes: [
              ...input.signals.finalizer.repairCodes,
              "bridge_sentence_removed",
            ],
          },
        },
      }),
    ],
    [
      "reordered structure codes",
      (input: CoverLetterSafeArmDiagnosticInput) => ({
        ...input,
        signals: {
          ...input.signals,
          structure: {
            ...input.signals.structure,
            codes: [...input.signals.structure.codes].reverse(),
          },
        },
      }),
    ],
  ] as const)("rejects %s in persisted diagnostics", async (_name, mutate) => {
    const diagnostic =
      await buildCoverLetterSafeArmDiagnostic(diagnosticInput());
    await expect(
      validateCoverLetterSafeArmDiagnostic(mutate(diagnostic)),
    ).rejects.toThrow("safe arm diagnostic validation failed");
  });

  it("enforces active quality-shadow pass and score semantics", async () => {
    const input = diagnosticInput();
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          qualityShadow: {
            ...input.signals.qualityShadow,
            prePassed: true,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          qualityShadow: {
            ...input.signals.qualityShadow,
            postPassed: false,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          qualityShadow: {
            ...input.signals.qualityShadow,
            preScore: 100,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          qualityShadow: {
            ...input.signals.qualityShadow,
            preScore: null,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          qualityShadow: {
            ...input.signals.qualityShadow,
            postCodes: [],
            postPassed: null,
            postScore: null,
          },
        },
      }),
    ).resolves.toBeDefined();
  });

  it("binds every structure code bidirectionally to its count state", async () => {
    const input = diagnosticInput();
    const codes = input.signals.structure.codes;
    const withoutCode = (
      code: (typeof input.signals.structure.codes)[number],
    ) => codes.filter((candidate) => candidate !== code);
    const contradictions = [
      {
        ...input.signals.structure,
        paragraphCount: null,
      },
      {
        ...input.signals.structure,
        codes: withoutCode("paragraph_count_available"),
      },
      {
        ...input.signals.structure,
        bodyParagraphCount: null,
      },
      {
        ...input.signals.structure,
        codes: withoutCode("body_paragraph_count_available"),
      },
      {
        ...input.signals.structure,
        closeCount: 0,
      },
      {
        ...input.signals.structure,
        codes: withoutCode("close_present"),
      },
      {
        ...input.signals.structure,
        bridgeCount: 0,
      },
      {
        ...input.signals.structure,
        codes: withoutCode("bridge_present"),
      },
      {
        ...input.signals.structure,
        proofCount: 0,
      },
      {
        ...input.signals.structure,
        codes: withoutCode("proof_present"),
      },
      {
        paragraphCount: null,
        bodyParagraphCount: null,
        closeCount: null,
        bridgeCount: null,
        proofCount: null,
        codes: [],
      },
      {
        ...input.signals.structure,
        codes: ["counts_unavailable" as const],
      },
      {
        ...input.signals.structure,
        paragraphCount: 1,
        bodyParagraphCount: 2,
      },
      {
        ...input.signals.structure,
        paragraphCount: null,
        codes: withoutCode("paragraph_count_available"),
      },
    ];

    for (const structure of contradictions) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...input,
          signals: { ...input.signals, structure },
        }),
      ).rejects.toThrow("safe arm diagnostic validation failed");
    }

    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          structure: {
            paragraphCount: 0,
            bodyParagraphCount: 0,
            closeCount: 0,
            bridgeCount: 0,
            proofCount: 0,
            codes: [
              "body_paragraph_count_available",
              "paragraph_count_available",
            ],
          },
        },
      }),
    ).resolves.toBeDefined();
  });

  it("binds each signal provenance to its exact missing sentinel", async () => {
    const input = diagnosticInput();
    const cases = [
      {
        name: "finalizerSignals",
        signal: {
          pathCode: "missing" as const,
          repairCodes: [],
          finalizerPassed: null,
        },
      },
      {
        name: "qualityShadow",
        signal: {
          preCodes: [],
          postCodes: [],
          prePassed: null,
          postPassed: null,
          preScore: null,
          postScore: null,
        },
      },
      {
        name: "structure",
        signal: {
          paragraphCount: null,
          bodyParagraphCount: null,
          closeCount: null,
          bridgeCount: null,
          proofCount: null,
          codes: ["counts_unavailable" as const],
        },
      },
      { name: "language", signal: "unknown" as const },
      {
        name: "promptMarker",
        signal: {
          markerCode: "unavailable" as const,
          hashStatus: "missing" as const,
        },
      },
    ] as const;

    for (const { name, signal } of cases) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...input,
          provenance: {
            ...input.provenance,
            [name]: "MISSING_NOT_RECONSTRUCTABLE",
          },
        }),
      ).rejects.toThrow("safe arm diagnostic validation failed");

      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...input,
          signals: { ...input.signals, [name]: signal },
        }),
      ).rejects.toThrow("safe arm diagnostic validation failed");
    }
  });

  it("enforces finalizer path, pass, and repair consistency", async () => {
    const input = diagnosticInput();
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          finalizer: {
            pathCode: "structured_success",
            repairCodes: [],
            finalizerPassed: false,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
    await expect(
      buildCoverLetterSafeArmDiagnostic({
        ...input,
        signals: {
          ...input.signals,
          finalizer: {
            pathCode: "structured_success",
            repairCodes: ["structured_repair_applied"],
            finalizerPassed: true,
          },
        },
      }),
    ).rejects.toThrow("safe arm diagnostic validation failed");
  });

  it("accepts only the active finalizer repair-path compatibility matrix", async () => {
    const allowed = [
      ["legacy_thin", ["bridge_sentence_removed"]],
      ["legacy_thin", ["last_grounded_sentence_removed"]],
      ["legacy_thin", ["quality_repair_attempted"]],
      ["legacy_thin", ["quality_repair_attempted", "quality_repair_accepted"]],
      ["legacy_thin", ["quality_repair_attempted", "quality_repair_rejected"]],
      ["structured_success", ["quality_repair_attempted"]],
      [
        "structured_success",
        ["quality_repair_attempted", "quality_repair_accepted"],
      ],
      [
        "structured_success",
        ["quality_repair_attempted", "quality_repair_rejected"],
      ],
      ["structured_repaired_success", ["bridge_sentence_removed"]],
      ["structured_repaired_success", ["last_grounded_sentence_removed"]],
      ["structured_repaired_success", ["structured_repair_applied"]],
      ["structured_repaired_success", ["quality_repair_attempted"]],
      [
        "structured_repaired_success",
        ["quality_repair_attempted", "quality_repair_accepted"],
      ],
      [
        "structured_repaired_success",
        ["quality_repair_attempted", "quality_repair_rejected"],
      ],
    ] as const;
    for (const [pathCode, repairCodes] of allowed) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...diagnosticInput(),
          signals: {
            ...diagnosticInput().signals,
            finalizer: {
              pathCode,
              repairCodes,
              finalizerPassed: true,
            },
          },
        }),
      ).resolves.toBeDefined();
    }

    for (const [pathCode, repairCodes] of [
      ["legacy_thin", ["structured_repair_applied"]],
      ["structured_success", ["bridge_sentence_removed"]],
      ["structured_success", ["last_grounded_sentence_removed"]],
      ["structured_success", ["structured_repair_applied"]],
      ["missing", ["quality_repair_attempted"]],
      ["legacy_thin", ["quality_repair_accepted"]],
      ["legacy_thin", ["quality_repair_rejected"]],
      [
        "legacy_thin",
        [
          "quality_repair_attempted",
          "quality_repair_accepted",
          "quality_repair_rejected",
        ],
      ],
    ] as const) {
      await expect(
        buildCoverLetterSafeArmDiagnostic({
          ...diagnosticInput(),
          signals: {
            ...diagnosticInput().signals,
            finalizer: {
              pathCode,
              repairCodes,
              finalizerPassed: true,
            },
          },
        }),
      ).rejects.toThrow("safe arm diagnostic validation failed");
    }
  });
});
