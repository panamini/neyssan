import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import {
  buildCandidateFactHash,
  buildCandidateImportBatchHash,
  buildCandidateSourceDocumentHash,
  buildCandidateSourceDocumentTextHash,
} from "../fingerprints";
import type { CandidateFactV1, CandidateImportBatchV1, CandidateSourceDocumentV1 } from "../schema";
import { assertFactUsesSourceMaterial, normalizeSourcePath, validateSourcePath } from "../sourcePaths";

const CREATED_AT_MS = Date.UTC(2026, 5, 9, 0, 0, 0, 0);

class UnsupportedValue {
  constructor(readonly label: string) {}
}

function buildSourceDocumentFixture(overrides: Partial<CandidateSourceDocumentV1> = {}): CandidateSourceDocumentV1 {
  return {
    id: "candidate-source-document:source_hash_a",
    userId: "user_123",
    sourceType: "pasted_text",
    title: "Pasted profile notes",
    originalFilename: "profile-notes.txt",
    mimeType: "text/plain",
    textHash: "text_hash_a",
    sourceHash: "source_hash_a",
    createdAt: CREATED_AT_MS,
    updatedAt: CREATED_AT_MS,
    reviewState: "pending",
    visibility: "private",
    version: 1,
    ...overrides,
  };
}

function buildFactFixture(overrides: Partial<CandidateFactV1> = {}): CandidateFactV1 {
  return {
    id: "candidate-fact:fact_hash_a",
    userId: "user_123",
    sourceDocumentId: "source_doc_123",
    sourcePath: "document.experience[1].responsibilityBullets[0]",
    sourceQuote: "Built reliable application workflows.",
    factType: "experience",
    value: { company: "Acme", responsibility: "Built reliable application workflows." },
    normalizedText: "Built reliable application workflows at Acme.",
    confidence: 0.91,
    reviewState: "pending",
    visibility: "private",
    createdAt: CREATED_AT_MS,
    updatedAt: CREATED_AT_MS,
    version: 1,
    ...overrides,
  };
}

describe("candidate-evidence kernel", () => {
  it("hashes the same source document content the same", async () => {
    const first = await buildCandidateSourceDocumentHash({
      userId: "user_123",
      sourceType: "pasted_text",
      text: "Built internal tools and customer-facing workflows.",
      title: "Profile notes",
      mimeType: "text/plain",
    });
    const second = await buildCandidateSourceDocumentHash({
      mimeType: "text/plain",
      title: "Profile notes",
      text: "Built internal tools and customer-facing workflows.",
      sourceType: "pasted_text",
      userId: "user_123",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes source document sourceHash when text changes", async () => {
    const baseHash = await buildCandidateSourceDocumentHash({
      userId: "user_123",
      sourceType: "markdown",
      text: "Led migration from legacy parser to structured profile data.",
    });
    const changedHash = await buildCandidateSourceDocumentHash({
      userId: "user_123",
      sourceType: "markdown",
      text: "Led migration from legacy parser to structured profile and proposal data.",
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("can separately build deterministic textHash values", async () => {
    await expect(buildCandidateSourceDocumentTextHash("same source text")).resolves.toBe(
      await buildCandidateSourceDocumentTextHash("same source text"),
    );
    await expect(buildCandidateSourceDocumentTextHash("changed source text")).resolves.not.toBe(
      await buildCandidateSourceDocumentTextHash("same source text"),
    );
  });

  it("hashes the same fact with the same sourcePath the same", async () => {
    const first = await buildCandidateFactHash({
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.skills[0].name",
      sourceQuote: "TypeScript",
      factType: "skill",
      value: { name: "TypeScript", level: "Advanced" },
      normalizedText: "TypeScript",
    });
    const second = await buildCandidateFactHash({
      normalizedText: "TypeScript",
      value: { level: "Advanced", name: "TypeScript" },
      factType: "skill",
      sourceQuote: "TypeScript",
      sourcePath: "document.skills[0].name",
      sourceDocumentId: "source_doc_123",
      userId: "user_123",
    });

    expect(first).toBe(second);
  });

  it("changes fact hash when sourcePath changes", async () => {
    const baseHash = await buildCandidateFactHash({
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.skills[0].name",
      factType: "skill",
      value: { name: "TypeScript" },
    });
    const changedHash = await buildCandidateFactHash({
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.skills[1].name",
      factType: "skill",
      value: { name: "TypeScript" },
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("changes fact hash when fact value changes", async () => {
    const baseHash = await buildCandidateFactHash({
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.languages[0]",
      factType: "language",
      value: { name: "English", level: "Fluent" },
    });
    const changedHash = await buildCandidateFactHash({
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.languages[0]",
      factType: "language",
      value: { name: "English", level: "Advanced" },
    });

    expect(changedHash).not.toBe(baseHash);
  });

  it("represents never_use visibility and all fact/source review states", () => {
    const neverUseFact = buildFactFixture({ visibility: "never_use" });
    const pendingFact = buildFactFixture({ reviewState: "pending" });
    const approvedFact = buildFactFixture({ reviewState: "approved" });
    const rejectedFact = buildFactFixture({ reviewState: "rejected" });
    const needsReviewFact = buildFactFixture({ reviewState: "needs_review" });
    const sourceStates = [
      buildSourceDocumentFixture({ reviewState: "pending" }),
      buildSourceDocumentFixture({ reviewState: "approved" }),
      buildSourceDocumentFixture({ reviewState: "rejected" }),
      buildSourceDocumentFixture({ reviewState: "archived" }),
    ];

    expect(neverUseFact.visibility).toBe("never_use");
    expect([pendingFact, approvedFact, rejectedFact, needsReviewFact].map((fact) => fact.reviewState)).toEqual([
      "pending",
      "approved",
      "rejected",
      "needs_review",
    ]);
    expect(sourceStates.map((source) => source.reviewState)).toEqual([
      "pending",
      "approved",
      "rejected",
      "archived",
    ]);
  });

  it("helpers do not mutate inputs", async () => {
    const sourceDocumentInput = {
      userId: "user_123",
      sourceType: "uploaded_cv" as const,
      text: "Original CV source text",
      title: "Original CV",
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
    };
    const factInput = {
      userId: "user_123",
      sourceDocumentId: "source_doc_123",
      sourcePath: "document.summary",
      sourceQuote: "Reliable product engineer.",
      factType: "identity" as const,
      value: { summary: "Reliable product engineer." },
      normalizedText: "Reliable product engineer.",
    };
    const batchInput = {
      userId: "user_123",
      sourceDocumentIds: ["source_doc_1", "source_doc_2"],
    };

    const beforeSourceDocument = stableSerialize(sourceDocumentInput);
    const beforeFact = stableSerialize(factInput);
    const beforeBatch = stableSerialize(batchInput);

    await buildCandidateSourceDocumentHash(sourceDocumentInput);
    await buildCandidateFactHash(factInput);
    await buildCandidateImportBatchHash(batchInput);

    expect(stableSerialize(sourceDocumentInput)).toBe(beforeSourceDocument);
    expect(stableSerialize(factInput)).toBe(beforeFact);
    expect(stableSerialize(batchInput)).toBe(beforeBatch);
    expect(batchInput.sourceDocumentIds).toEqual(["source_doc_1", "source_doc_2"]);
  });

  it("does not require or store generated polished text as a canonical fact", () => {
    const sourceFact = buildFactFixture({
      value: { responsibility: "Built reliable application workflows." },
      sourceQuote: "Built reliable application workflows.",
    });

    expect(sourceFact.sourcePath).toBe("document.experience[1].responsibilityBullets[0]");
    expect(sourceFact.sourceQuote).toBe("Built reliable application workflows.");
    expect(sourceFact.value).not.toHaveProperty("polishedText");
    expect(sourceFact.value).not.toHaveProperty("generatedText");
  });

  it("preserves sourceQuote and normalized sourcePath", async () => {
    const fact = buildFactFixture({
      sourcePath: normalizeSourcePath(" document.sections[ 0 ].structuredContent[ 2 ] "),
      sourceQuote: "Led migration work.",
    });

    expect(fact.sourcePath).toBe("document.sections[0].structuredContent[2]");
    expect(fact.sourceQuote).toBe("Led migration work.");
    await expect(
      buildCandidateFactHash({
        userId: fact.userId,
        sourceDocumentId: fact.sourceDocumentId,
        sourcePath: fact.sourcePath,
        sourceQuote: fact.sourceQuote,
        factType: fact.factType,
        value: fact.value,
      }),
    ).resolves.toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts simple deterministic source material paths", () => {
    expect(validateSourcePath("document.summary")).toBe(true);
    expect(validateSourcePath("document.sections[0].structuredContent[2]")).toBe(true);
    expect(validateSourcePath("document.experience[1].responsibilityBullets[0]")).toBe(true);
    expect(validateSourcePath("manual.identity.name")).toBe(true);
  });

  it("rejects generated artifact, proposal, cover-letter, and generated-resume source paths", () => {
    expect(validateSourcePath("")).toBe(false);
    expect(validateSourcePath("document.generatedResume.body")).toBe(false);
    expect(validateSourcePath("document.generated_resume.body")).toBe(false);
    expect(validateSourcePath("document.proposals[0].body")).toBe(false);
    expect(validateSourcePath("document.coverLetter.body")).toBe(false);
    expect(validateSourcePath("application.artifacts[0].content")).toBe(false);
    expect(validateSourcePath("document.summary\nmalicious")).toBe(false);
    expect(validateSourcePath("document.summary;drop")).toBe(false);
  });

  it("rejects generated artifact-like fact values before hashing", () => {
    expect(() =>
      assertFactUsesSourceMaterial({
        sourcePath: "document.summary",
        value: { polishedText: "World-class leader who transforms everything." },
      }),
    ).toThrow(/generated artifact field/);
    expect(() =>
      assertFactUsesSourceMaterial({
        sourcePath: "document.summary",
        value: { generatedResumeId: "artifact_123" },
      }),
    ).toThrow(/generated artifact field/);
  });

  it("hash helper rejects unsupported non-JSON-like fact values", async () => {
    await expect(
      buildCandidateFactHash({
        userId: "user_123",
        sourceDocumentId: "source_doc_123",
        sourcePath: "document.summary",
        factType: "summary" as never,
        value: new UnsupportedValue("class-instance"),
      }),
    ).rejects.toThrow(/plain objects/);
    await expect(
      buildCandidateFactHash({
        userId: "user_123",
        sourceDocumentId: "source_doc_123",
        sourcePath: "document.summary",
        factType: "other",
        value: new Map([["key", "value"]]),
      }),
    ).rejects.toThrow(/Map/);
    await expect(
      buildCandidateFactHash({
        userId: "user_123",
        sourceDocumentId: "source_doc_123",
        sourcePath: "document.summary",
        factType: "other",
        value: Promise.resolve("value"),
      }),
    ).rejects.toThrow(/Promise/);
  });

  it("represents import batch identity without persistence", async () => {
    const batch: CandidateImportBatchV1 = {
      id: "candidate-import-batch:batch_hash_a",
      userId: "user_123",
      sourceDocumentIds: ["source_doc_1", "source_doc_2"],
      status: "pending",
      createdAt: CREATED_AT_MS,
      updatedAt: CREATED_AT_MS,
      version: 1,
    };

    await expect(
      buildCandidateImportBatchHash({
        userId: batch.userId,
        sourceDocumentIds: batch.sourceDocumentIds,
      }),
    ).resolves.toBe(
      await buildCandidateImportBatchHash({
        userId: "user_123",
        sourceDocumentIds: ["source_doc_1", "source_doc_2"],
      }),
    );
  });
});
