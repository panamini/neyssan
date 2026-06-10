import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import type { ResumeVariantArtifactV1 } from "../../resume-variant-artifact/schema";
import {
  assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText,
  buildCoverLetterArtifact,
  buildCoverLetterArtifactContent,
  buildCoverLetterArtifactContentHash,
  buildCoverLetterArtifactHash,
  buildCoverLetterArtifactText,
  collectCoverLetterArtifactAllowedClaimIds,
  collectCoverLetterArtifactDemandIds,
  collectCoverLetterArtifactEvidenceMatchIds,
  collectCoverLetterArtifactReviewItemIds,
  collectCoverLetterArtifactRiskFlagIds,
  collectCoverLetterArtifactSourceFactIds,
} from "../buildCoverLetterArtifact";
import type { BuildCoverLetterArtifactInputV1, CoverLetterArtifactV1 } from "../schema";

const T = Date.UTC(2026, 5, 10);

function resumeVariantArtifact(overrides: Partial<ResumeVariantArtifactV1> = {}): ResumeVariantArtifactV1 {
  return {
    id: "resume-variant-artifact:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    targetDocumentKind: "resume",
    language: "en",
    market: "global",
    status: "ready_for_generation",
    sections: [],
    warnings: [],
    provenance: {
      applicationContextId: "application-context:abc",
      evidenceGraphId: "evidence-graph:hash-a",
      evidenceGraphHash: "hash-a",
      resumeVariantPlanId: "resume-variant-plan:hash-a",
      resumeVariantPlanHash: "hash-a",
      reviewCockpitId: "review-cockpit:hash-a",
      sourceFactIds: ["candidate-fact:b", "candidate-fact:a", "candidate-fact:a"],
      allowedClaimIds: ["allowed-claim:b", "allowed-claim:a", "allowed-claim:a"],
      evidenceMatchIds: ["evidence-match:b", "evidence-match:a", "evidence-match:a"],
      demandIds: ["demand:b", "demand:a", "demand:a"],
      riskFlagIds: ["risk:b", "risk:a", "risk:a"],
      reviewItemIds: ["review:b", "review:a", "review:a"],
      version: 1,
    },
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function input(overrides: Partial<BuildCoverLetterArtifactInputV1> = {}): BuildCoverLetterArtifactInputV1 {
  const resumeArtifact = overrides.resumeVariantArtifact ?? resumeVariantArtifact();
  return {
    userId: resumeArtifact.userId,
    applicationContextId: resumeArtifact.applicationContextId,
    resumeVariantArtifact: resumeArtifact,
    sourceText: "Dear Hiring Manager,\n\nI am excited to apply.",
    sourceKind: "manual_text",
    format: "plain_text",
    sourceMetadata: {
      sourceId: "source:manual-a",
      proposalId: "proposal:a",
      generatorInputHash: "generator-input-hash-a",
      sourceLabel: "Manual source A",
    },
    language: "en",
    market: "global",
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

function withArtifactText(artifact: CoverLetterArtifactV1, sourceText: string): CoverLetterArtifactV1 {
  return { ...artifact, text: { ...artifact.text, value: sourceText, characterCount: sourceText.length } };
}

describe("cover letter artifact", () => {
  it("builds deterministic artifact content with exact text metrics and inherited provenance", async () => {
    const source = input();
    const first = await buildCoverLetterArtifact(source);
    const second = await buildCoverLetterArtifact(source);
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(`cover-letter-artifact:${await buildCoverLetterArtifactHash(source)}`);
    expect(first.status).toBe("ready_for_review");
    expect(buildCoverLetterArtifactContent(first)).toEqual({ kind: "cover_letter_artifact", artifact: first, version: 1 });
    expect(first.text.value).toBe(source.sourceText);
    expect(first.text.textHash).toBeTruthy();
    expect(first.text.paragraphCount).toBe(2);
    expect(first.text.characterCount).toBe(source.sourceText.length);
    expect(first.provenance.applicationContextId).toBe(source.applicationContextId);
    expect(first.provenance.resumeVariantArtifactId).toBe(source.resumeVariantArtifact.id);
    expect(first.provenance.evidenceGraphId).toBe(source.resumeVariantArtifact.provenance.evidenceGraphId);
    expect(first.provenance.resumeVariantArtifactContentHash).toBeTruthy();
  });

  it("preserves leading whitespace, trailing whitespace, blank lines, and markdown characters", async () => {
    const exact = "  **Dear team**\n\n\n- item\n\n_Final line_  \n";
    const artifact = await buildCoverLetterArtifact(input({ sourceText: exact, format: "markdown" }));
    expect(artifact.text.value).toBe(exact);
    expect(artifact.text.characterCount).toBe(exact.length);
    expect(artifact.text.paragraphCount).toBe(3);
  });

  it("keeps identity hash and artifact ID stable when only timestamps change", async () => {
    const source = input();
    const later = input({ createdAt: T + 10_000, updatedAt: T + 20_000 });
    const hash = await buildCoverLetterArtifactHash(source);
    await expect(buildCoverLetterArtifactHash(later)).resolves.toBe(hash);
    await expect(buildCoverLetterArtifact(later)).resolves.toMatchObject({ id: `cover-letter-artifact:${hash}`, createdAt: T + 10_000, updatedAt: T + 20_000 });
  });

  it("changes identity hash when supplied text, source kind, format, or source metadata changes", async () => {
    const hash = await buildCoverLetterArtifactHash(input());
    await expect(buildCoverLetterArtifactHash(input({ sourceText: "Changed" }))).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactHash(input({ sourceKind: "imported_text" }))).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactHash(input({ format: "markdown" }))).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactHash(input({ sourceMetadata: { sourceLabel: "Different" } }))).resolves.not.toBe(hash);
  });

  it("builds deterministic content hash that ignores id and timestamps", async () => {
    const artifact = await buildCoverLetterArtifact(input());
    const hash = await buildCoverLetterArtifactContentHash(artifact);
    await expect(buildCoverLetterArtifactContentHash(artifact)).resolves.toBe(hash);
    await expect(buildCoverLetterArtifactContentHash({ ...artifact, id: "cover-letter-artifact:changed", createdAt: T + 10_000, updatedAt: T + 20_000 })).resolves.toBe(hash);
  });

  it("changes content hash when meaningful content changes", async () => {
    const artifact = await buildCoverLetterArtifact(input());
    const hash = await buildCoverLetterArtifactContentHash(artifact);
    await expect(buildCoverLetterArtifactContentHash(withArtifactText(artifact, "Changed"))).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactContentHash({ ...artifact, status: "needs_review" })).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactContentHash({ ...artifact, warnings: ["cover_letter_source_unknown"] })).resolves.not.toBe(hash);
    await expect(buildCoverLetterArtifactContentHash({ ...artifact, provenance: { ...artifact.provenance, evidenceGraphId: "evidence-graph:changed" } })).resolves.not.toBe(hash);
  });

  it("changes text hash when text, format, or source kind changes", async () => {
    const base = await buildCoverLetterArtifactText(input());
    const changedText = await buildCoverLetterArtifactText(input({ sourceText: "Changed" }));
    const changedFormat = await buildCoverLetterArtifactText(input({ format: "markdown" }));
    const changedSourceKind = await buildCoverLetterArtifactText(input({ sourceKind: "imported_text" }));
    expect(changedText.textHash).not.toBe(base.textHash);
    expect(changedFormat.textHash).not.toBe(base.textHash);
    expect(changedSourceKind.textHash).not.toBe(base.textHash);
  });

  it("derives blocked, draft, needs_review, and ready_for_review statuses", async () => {
    await expect(buildCoverLetterArtifact(input({ resumeVariantArtifact: resumeVariantArtifact({ status: "blocked" }) }))).resolves.toMatchObject({ status: "blocked", blockedReason: "resume_variant_artifact_blocked" });
    await expect(buildCoverLetterArtifact(input({ sourceText: "   " }))).resolves.toMatchObject({ status: "draft" });
    await expect(buildCoverLetterArtifact(input({ resumeVariantArtifact: resumeVariantArtifact({ status: "needs_review" }) }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildCoverLetterArtifact(input({ resumeVariantArtifact: resumeVariantArtifact({ status: "draft" }) }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildCoverLetterArtifact(input())).resolves.toMatchObject({ status: "ready_for_review" });
  });

  it("rejects invalid consistency and input values", async () => {
    await expect(buildCoverLetterArtifact(input({ userId: "other" }))).rejects.toThrow(TypeError);
    await expect(buildCoverLetterArtifact(input({ applicationContextId: "other" }))).rejects.toThrow(TypeError);
    await expect(buildCoverLetterArtifact(input({ sourceKind: "generated_now" as BuildCoverLetterArtifactInputV1["sourceKind"] }))).rejects.toThrow(TypeError);
    await expect(buildCoverLetterArtifact(input({ format: "html" as BuildCoverLetterArtifactInputV1["format"] }))).rejects.toThrow(TypeError);
    await expect(buildCoverLetterArtifact(input({ createdAt: Number.NaN }))).rejects.toThrow(TypeError);
    await expect(buildCoverLetterArtifact(input({ updatedAt: Number.POSITIVE_INFINITY }))).rejects.toThrow(TypeError);
  });

  it("copies provenance arrays from ResumeVariantArtifact and exposes sorted unique collectors", async () => {
    const source = input();
    const artifact = await buildCoverLetterArtifact(source);
    expect(artifact.provenance.sourceFactIds).toEqual(source.resumeVariantArtifact.provenance.sourceFactIds);
    expect(artifact.provenance.allowedClaimIds).toEqual(source.resumeVariantArtifact.provenance.allowedClaimIds);
    expect(artifact.provenance.evidenceMatchIds).toEqual(source.resumeVariantArtifact.provenance.evidenceMatchIds);
    expect(artifact.provenance.demandIds).toEqual(source.resumeVariantArtifact.provenance.demandIds);
    expect(artifact.provenance.riskFlagIds).toEqual(source.resumeVariantArtifact.provenance.riskFlagIds);
    expect(artifact.provenance.reviewItemIds).toEqual(source.resumeVariantArtifact.provenance.reviewItemIds);
    expect(artifact.provenance.sourceFactIds).not.toBe(source.resumeVariantArtifact.provenance.sourceFactIds);
    expect(collectCoverLetterArtifactSourceFactIds(artifact)).toEqual(["candidate-fact:a", "candidate-fact:b"]);
    expect(collectCoverLetterArtifactAllowedClaimIds(artifact)).toEqual(["allowed-claim:a", "allowed-claim:b"]);
    expect(collectCoverLetterArtifactEvidenceMatchIds(artifact)).toEqual(["evidence-match:a", "evidence-match:b"]);
    expect(collectCoverLetterArtifactDemandIds(artifact)).toEqual(["demand:a", "demand:b"]);
    expect(collectCoverLetterArtifactRiskFlagIds(artifact)).toEqual(["risk:a", "risk:b"]);
    expect(collectCoverLetterArtifactReviewItemIds(artifact)).toEqual(["review:a", "review:b"]);
  });

  it("does not mutate the input resume artifact", async () => {
    const source = input();
    const before = stableSerialize(source.resumeVariantArtifact);
    await buildCoverLetterArtifact(source);
    expect(stableSerialize(source.resumeVariantArtifact)).toBe(before);
  });

  it("ignores supplied text in generated-text guard but rejects generated-looking metadata and warnings", async () => {
    const artifact = await buildCoverLetterArtifact(input());
    expect(() => assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText(artifact)).not.toThrow();
    expect(() => assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText({ ...artifact, sourceMetadata: { sourceLabel: "Dear Hiring Manager", version: 1 } })).toThrow(/outside artifact\.text\.value/u);
    expect(() => assertCoverLetterArtifactNoGeneratedTextOutsideSuppliedText({ ...artifact, warnings: ["I am excited to apply"] })).toThrow(/outside artifact\.text\.value/u);
  });

  it("does not import generation, Proposal Forge, LLM, or premium cover-letter code", () => {
    const moduleText = ["../buildCoverLetterArtifact.ts", "../artifactRules.ts", "../schema.ts"]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");
    expect(moduleText).not.toMatch(/premiumCoverLetter|Proposal Forge|ProposalForge|LLM|Mistral|OpenAI|langchain|generatePremiumCoverLetter/u);
  });
});
