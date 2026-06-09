import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import type { EvidenceGraphV1 } from "../../evidence-graph/schema";
import type { ResumeVariantPlanV1 } from "../../resume-variant-plan/schema";
import type { ReviewCockpitModelV1 } from "../../review-cockpit/schema";
import {
  assertResumeVariantArtifactDoesNotContainGeneratedText,
  assertResumeVariantArtifactEvidenceBacked,
  buildResumeVariantArtifact,
  buildResumeVariantArtifactContent,
  buildResumeVariantArtifactHash,
  collectResumeVariantArtifactAllowedClaimIds,
  collectResumeVariantArtifactDemandIds,
  collectResumeVariantArtifactEvidenceMatchIds,
  collectResumeVariantArtifactReviewItemIds,
  collectResumeVariantArtifactRiskFlagIds,
  collectResumeVariantArtifactSourceFactIds,
} from "../buildResumeVariantArtifact";

const T = Date.UTC(2026, 5, 9);

function graph(overrides: Partial<EvidenceGraphV1> = {}): EvidenceGraphV1 {
  return {
    id: "evidence-graph:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    jobDemandGraphHash: "job-hash",
    candidateEvidenceHash: "candidate-hash",
    careerKnowledgeHash: "rules-hash",
    demands: [{ id: "demand:typescript", kind: "skill", label: "TypeScript", required: "required", source: "job", sourcePath: "job.requirements[0]", version: 1 }],
    matches: [{ id: "evidence-match:1", demandId: "demand:typescript", candidateFactId: "candidate-fact:typescript", sourceDocumentId: "candidate-source-document:1", sourcePath: "document.skills[0]", matchType: "direct", strength: "strong", reviewState: "accepted", reason: "Source-backed match.", version: 1 }],
    missing: [],
    riskFlags: [],
    allowedClaims: [{ id: "allowed-claim:typescript", candidateFactIds: ["candidate-fact:typescript"], claimType: "skill", text: "TypeScript", supportLevel: "strong", reviewState: "allowed", reason: "Approved source-backed fact.", version: 1 }],
    blockedClaimIds: [],
    createdAt: T,
    version: 1,
    ...overrides,
  };
}

function plan(evidenceGraph = graph(), overrides: Partial<ResumeVariantPlanV1> = {}): ResumeVariantPlanV1 {
  return {
    id: "resume-variant-plan:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    evidenceGraphId: evidenceGraph.id,
    evidenceGraphHash: "hash-a",
    targetDocumentKind: "resume",
    language: "en",
    market: "global",
    items: [{ id: "resume-variant-plan-item:skills:typescript", section: "skills", action: "add_from_allowed_claim", priority: "required", reviewState: "pending", allowedClaimIds: ["allowed-claim:typescript"], candidateFactIds: ["candidate-fact:typescript"], evidenceMatchIds: ["evidence-match:1"], demandIds: ["demand:typescript"], riskFlagIds: [], reason: "Use source-backed claim.", version: 1 }],
    warnings: [],
    blockedClaimIds: [],
    sourceFactIds: ["candidate-fact:typescript"],
    allowedClaimIds: ["allowed-claim:typescript"],
    riskFlagIds: [],
    blocked: false,
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function cockpit(evidenceGraph = graph(), resumeVariantPlan = plan(evidenceGraph), overrides: Partial<ReviewCockpitModelV1> = {}): ReviewCockpitModelV1 {
  return {
    id: "review-cockpit:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    evidenceGraphId: evidenceGraph.id,
    resumeVariantPlanId: resumeVariantPlan.id,
    summary: { status: "ready", allowedClaimCount: 1, planItemCount: 1, warningCount: 0, blockerCount: 0, missingEvidenceCount: 0, blockedClaimCount: 0, sourceFactCount: 1, riskFlagCount: 0, reason: "Ready for review.", version: 1 },
    items: [{ id: "review-cockpit-item:source-support:typescript", bucket: "source_support", title: "Allowed claim has source support", description: "Allowed claim has source-backed support.", severity: "info", planItemId: "resume-variant-plan-item:skills:typescript", allowedClaimId: "allowed-claim:typescript", candidateFactId: "candidate-fact:typescript", evidenceMatchId: "evidence-match:1", demandId: "demand:typescript", sourceFactIds: ["candidate-fact:typescript"], allowedClaimIds: ["allowed-claim:typescript"], riskFlagIds: [], version: 1 }],
    createdAt: T,
    version: 1,
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  const evidenceGraph = graph();
  const resumeVariantPlan = plan(evidenceGraph);
  const reviewCockpit = cockpit(evidenceGraph, resumeVariantPlan);
  return { userId: "user_123", applicationContextId: "application-context:abc", targetDocumentKind: "resume" as const, language: "en", market: "global", evidenceGraph, resumeVariantPlan, reviewCockpit, createdAt: T, updatedAt: T, ...overrides };
}

describe("resume variant artifact", () => {
  it("builds deterministic ID, content, source-backed item, provenance, and sorted collectors", async () => {
    const source = input();
    const first = await buildResumeVariantArtifact(source);
    const second = await buildResumeVariantArtifact(source);

    expect(first.id).toBe(second.id);
    expect(first.id).toBe(`resume-variant-artifact:${await buildResumeVariantArtifactHash(source)}`);
    expect(first.status).toBe("ready_for_generation");
    expect(buildResumeVariantArtifactContent(first).kind).toBe("resume_variant_artifact");
    expect(first.sections.map((section) => section.kind)).toEqual(["skills"]);
    expect(first.sections[0]!.items.some((item) => item.kind === "source_backed_claim")).toBe(true);
    expect(collectResumeVariantArtifactSourceFactIds(first)).toEqual(["candidate-fact:typescript"]);
    expect(collectResumeVariantArtifactAllowedClaimIds(first)).toEqual(["allowed-claim:typescript"]);
    expect(collectResumeVariantArtifactEvidenceMatchIds(first)).toEqual(["evidence-match:1"]);
    expect(collectResumeVariantArtifactDemandIds(first)).toEqual(["demand:typescript"]);
    expect(collectResumeVariantArtifactRiskFlagIds(first)).toEqual([]);
    expect(collectResumeVariantArtifactReviewItemIds(first)).toEqual(["review-cockpit-item:source-support:typescript"]);
  });

  it("changes hash when EvidenceGraph, ResumeVariantPlan, or ReviewCockpit changes", async () => {
    const source = input();
    const base = await buildResumeVariantArtifactHash(source);

    await expect(buildResumeVariantArtifactHash({ ...source, evidenceGraph: { ...source.evidenceGraph, id: "evidence-graph:changed" } })).resolves.not.toBe(base);
    await expect(buildResumeVariantArtifactHash({ ...source, resumeVariantPlan: { ...source.resumeVariantPlan, id: "resume-variant-plan:changed" } })).resolves.not.toBe(base);
    await expect(buildResumeVariantArtifactHash({ ...source, reviewCockpit: { ...source.reviewCockpit, id: "review-cockpit:changed" } })).resolves.not.toBe(base);
  });

  it("rejects inconsistent user, context, and source-chain IDs", async () => {
    const source = input();
    const cases = [
      { ...source, evidenceGraph: { ...source.evidenceGraph, userId: "other" } },
      { ...source, resumeVariantPlan: { ...source.resumeVariantPlan, userId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, userId: "other" } },
      { ...source, evidenceGraph: { ...source.evidenceGraph, applicationContextId: "other" } },
      { ...source, resumeVariantPlan: { ...source.resumeVariantPlan, evidenceGraphId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, evidenceGraphId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, resumeVariantPlanId: "other" } },
    ];

    for (const bad of cases) {
      await expect(buildResumeVariantArtifact(bad)).rejects.toThrow(TypeError);
    }
  });

  it("derives blocked, needs_review, and draft statuses", async () => {
    const blockedPlan = await buildResumeVariantArtifact(input({ resumeVariantPlan: plan(graph(), { blocked: true, blockedReason: "manual" }), reviewCockpit: cockpit(graph(), plan(graph(), { blocked: true })) }));
    const needsReview = await buildResumeVariantArtifact(input({ reviewCockpit: cockpit(graph(), plan(graph()), { summary: { ...cockpit().summary, status: "needs_review", warningCount: 1 } }) }));
    const emptyPlan = plan(graph(), { items: [], sourceFactIds: [], allowedClaimIds: [] });
    const draft = await buildResumeVariantArtifact(input({ resumeVariantPlan: emptyPlan, reviewCockpit: cockpit(graph(), emptyPlan, { items: [], summary: { ...cockpit().summary, allowedClaimCount: 0, planItemCount: 0, sourceFactCount: 0 } }) }));

    expect(blockedPlan.status).toBe("blocked");
    expect(needsReview.status).toBe("needs_review");
    expect(draft.status).toBe("draft");
  });

  it("preserves notice provenance for missing evidence, warnings, blockers, and risks", async () => {
    const evidenceGraph = graph({ riskFlags: [{ id: "risk:private", category: "private_fact", severity: "blocker", candidateFactId: "candidate-fact:typescript", reason: "Private fact excluded.", version: 1 }], blockedClaimIds: ["blocked-claim:candidate-fact:typescript"] });
    const resumeVariantPlan = plan(evidenceGraph, { blocked: true, riskFlagIds: ["risk:private"], warnings: [{ id: "warning:private", category: "private_fact", severity: "blocker", riskFlagId: "risk:private", candidateFactId: "candidate-fact:typescript", reason: "Private fact.", version: 1 }], items: [{ ...plan(evidenceGraph).items[0]!, action: "block", riskFlagIds: ["risk:private"] }] });
    const reviewCockpit = cockpit(evidenceGraph, resumeVariantPlan, { summary: { ...cockpit().summary, status: "blocked", blockerCount: 1, riskFlagCount: 1 }, items: [{ ...cockpit().items[0]!, severity: "blocker", riskFlagId: "risk:private", riskFlagIds: ["risk:private"] }] });
    const artifact = await buildResumeVariantArtifact(input({ evidenceGraph, resumeVariantPlan, reviewCockpit }));

    expect(artifact.status).toBe("blocked");
    expect(artifact.provenance.riskFlagIds).toEqual(["risk:private"]);
    expect(artifact.sections.flatMap((section) => section.items).some((item) => item.kind === "risk_notice")).toBe(true);
    expect(artifact.warnings.length).toBeGreaterThan(0);
  });

  it("evidence assertion rejects source-backed items without allowed claims or source facts", async () => {
    const source = input();
    const artifact = await buildResumeVariantArtifact(source);
    const withoutClaim = { ...artifact, sections: artifact.sections.map((section) => ({ ...section, items: section.items.map((item) => item.kind === "source_backed_claim" ? { ...item, allowedClaimIds: [], allowedClaimId: undefined } : item) })) };
    const withoutFact = { ...artifact, sections: artifact.sections.map((section) => ({ ...section, items: section.items.map((item) => item.kind === "source_backed_claim" ? { ...item, sourceFactIds: [], candidateFactId: undefined } : item) })) };

    expect(() => assertResumeVariantArtifactEvidenceBacked(withoutClaim, source)).toThrow(TypeError);
    expect(() => assertResumeVariantArtifactEvidenceBacked(withoutFact, source)).toThrow(TypeError);
  });

  it("does not generate polished resume or cover-letter text and does not mutate inputs", async () => {
    const source = input();
    const before = stableSerialize(source);
    const artifact = await buildResumeVariantArtifact(source);
    const text = stableSerialize(artifact);

    expect(text).not.toMatch(/increased revenue by 30%|world-class|dear hiring manager|excited to apply|sincerely/iu);
    expect(() => assertResumeVariantArtifactDoesNotContainGeneratedText(artifact)).not.toThrow();
    expect(stableSerialize(source)).toBe(before);
    expect(text).not.toMatch(/premiumCoverLetter|Proposal Forge|CV Forge|activeCvSnapshots|userProfiles|jobs behavior/u);
  });
});
