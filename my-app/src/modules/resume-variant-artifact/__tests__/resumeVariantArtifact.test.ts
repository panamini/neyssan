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
import type { BuildResumeVariantArtifactInputV1, ResumeVariantArtifactV1 } from "../schema";

const T = Date.UTC(2026, 5, 9);

function graph(overrides: Partial<EvidenceGraphV1> = {}): EvidenceGraphV1 {
  return {
    id: "evidence-graph:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    jobDemandGraphHash: "job-hash-a",
    candidateEvidenceHash: "candidate-hash-a",
    careerKnowledgeHash: "rules-hash-a",
    demands: [{ id: "demand:typescript-required", kind: "skill", label: "TypeScript", required: "required", source: "job", sourcePath: "job.requirements[0]", version: 1 }],
    matches: [{ id: "evidence-match:typescript-direct", demandId: "demand:typescript-required", candidateFactId: "candidate-fact:typescript-skill", sourceDocumentId: "candidate-source-document:skills-source", sourcePath: "document.skills[0]", matchType: "direct", strength: "strong", reviewState: "accepted", reason: "Source-backed match.", version: 1 }],
    missing: [],
    riskFlags: [],
    allowedClaims: [{ id: "allowed-claim:typescript-skill", candidateFactIds: ["candidate-fact:typescript-skill"], claimType: "skill", text: "TypeScript", supportLevel: "strong", reviewState: "allowed", reason: "Approved source-backed fact.", version: 1 }],
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
    evidenceGraphHash: evidenceGraph.id.replace("evidence-graph:", ""),
    targetDocumentKind: "resume",
    language: "en",
    market: "global",
    items: [{ id: "resume-variant-plan-item:skills:typescript", section: "skills", action: "add_from_allowed_claim", priority: "required", reviewState: "pending", allowedClaimIds: ["allowed-claim:typescript-skill"], candidateFactIds: ["candidate-fact:typescript-skill"], evidenceMatchIds: ["evidence-match:typescript-direct"], demandIds: ["demand:typescript-required"], riskFlagIds: [], reason: "Use source-backed claim.", version: 1 }],
    warnings: [],
    blockedClaimIds: [],
    sourceFactIds: ["candidate-fact:typescript-skill"],
    allowedClaimIds: ["allowed-claim:typescript-skill"],
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
    items: [{ id: "review-cockpit-item:source-support:typescript", bucket: "source_support", title: "Allowed claim has source support", description: "Allowed claim has source-backed support.", severity: "info", planItemId: "resume-variant-plan-item:skills:typescript", allowedClaimId: "allowed-claim:typescript-skill", candidateFactId: "candidate-fact:typescript-skill", evidenceMatchId: "evidence-match:typescript-direct", demandId: "demand:typescript-required", sourceFactIds: ["candidate-fact:typescript-skill"], allowedClaimIds: ["allowed-claim:typescript-skill"], riskFlagIds: [], version: 1 }],
    createdAt: T,
    version: 1,
    ...overrides,
  };
}

function input(overrides: Partial<BuildResumeVariantArtifactInputV1> = {}): BuildResumeVariantArtifactInputV1 {
  const evidenceGraph = overrides.evidenceGraph ?? graph();
  const resumeVariantPlan = overrides.resumeVariantPlan ?? plan(evidenceGraph);
  const reviewCockpit = overrides.reviewCockpit ?? cockpit(evidenceGraph, resumeVariantPlan);
  return { userId: "user_123", applicationContextId: "application-context:abc", targetDocumentKind: "resume", language: "en", market: "global", evidenceGraph, resumeVariantPlan, reviewCockpit, createdAt: T, updatedAt: T, ...overrides };
}

function linkedInput(options: { evidenceGraph?: Partial<EvidenceGraphV1>; resumeVariantPlan?: Partial<ResumeVariantPlanV1>; reviewCockpit?: Partial<ReviewCockpitModelV1>; input?: Partial<BuildResumeVariantArtifactInputV1> } = {}): BuildResumeVariantArtifactInputV1 {
  const evidenceGraph = graph(options.evidenceGraph);
  const resumeVariantPlan = plan(evidenceGraph, options.resumeVariantPlan);
  const reviewCockpit = cockpit(evidenceGraph, resumeVariantPlan, options.reviewCockpit);
  return input({ evidenceGraph, resumeVariantPlan, reviewCockpit, ...options.input });
}

function mutateFirstSourceBackedItem(artifact: ResumeVariantArtifactV1, mutate: (item: ResumeVariantArtifactV1["sections"][number]["items"][number]) => ResumeVariantArtifactV1["sections"][number]["items"][number]): ResumeVariantArtifactV1 {
  return { ...artifact, sections: artifact.sections.map((section) => ({ ...section, items: section.items.map((item) => item.kind === "source_backed_claim" ? mutate(item) : item) })) };
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
    expect(collectResumeVariantArtifactSourceFactIds(first)).toEqual(["candidate-fact:typescript-skill"]);
    expect(collectResumeVariantArtifactAllowedClaimIds(first)).toEqual(["allowed-claim:typescript-skill"]);
    expect(collectResumeVariantArtifactEvidenceMatchIds(first)).toEqual(["evidence-match:typescript-direct"]);
    expect(collectResumeVariantArtifactDemandIds(first)).toEqual(["demand:typescript-required"]);
    expect(collectResumeVariantArtifactRiskFlagIds(first)).toEqual([]);
    expect(collectResumeVariantArtifactReviewItemIds(first)).toEqual(["review-cockpit-item:source-support:typescript"]);
  });

  it("preserves candidateFactId on ReviewCockpit-derived artifact items", async () => {
    const artifact = await buildResumeVariantArtifact(input());
    const reviewDerivedItem = artifact.sections.flatMap((section) => section.items).find((item) => item.reviewItemIds.includes("review-cockpit-item:source-support:typescript"));
    expect(reviewDerivedItem).toBeDefined();
    expect(reviewDerivedItem?.candidateFactId).toBe("candidate-fact:typescript-skill");
  });

  it("same source chain with different timestamps produces the same artifact hash", async () => {
    const source = input();
    const rebuiltLater = input({ createdAt: T + 10_000, updatedAt: T + 20_000 });
    await expect(buildResumeVariantArtifactHash(rebuiltLater)).resolves.toBe(await buildResumeVariantArtifactHash(source));
  });

  it("same source chain with different timestamps produces the same artifact ID", async () => {
    const source = input();
    const rebuiltLater = input({ createdAt: T + 10_000, updatedAt: T + 20_000 });
    await expect(buildResumeVariantArtifact(rebuiltLater)).resolves.toMatchObject({ id: (await buildResumeVariantArtifact(source)).id, createdAt: T + 10_000, updatedAt: T + 20_000 });
  });

  it("artifact-path hash is deterministic and ignores artifact metadata", async () => {
    const artifact = await buildResumeVariantArtifact(input());
    const first = await buildResumeVariantArtifactHash(artifact);
    await expect(buildResumeVariantArtifactHash(artifact)).resolves.toBe(first);
    await expect(buildResumeVariantArtifactHash({ ...artifact, id: "resume-variant-artifact:changed-metadata", createdAt: T + 30_000, updatedAt: T + 40_000 })).resolves.toBe(first);
  });

  it("changes hash when EvidenceGraph, ResumeVariantPlan, or ReviewCockpit changes", async () => {
    const base = await buildResumeVariantArtifactHash(input());
    await expect(buildResumeVariantArtifactHash(linkedInput({ evidenceGraph: { id: "evidence-graph:changed" } }))).resolves.not.toBe(base);
    await expect(buildResumeVariantArtifactHash(linkedInput({ resumeVariantPlan: { id: "resume-variant-plan:changed" } }))).resolves.not.toBe(base);
    await expect(buildResumeVariantArtifactHash(linkedInput({ reviewCockpit: { id: "review-cockpit:changed" } }))).resolves.not.toBe(base);
  });

  it("rejects mismatched user IDs across graph, plan, and cockpit", async () => {
    const source = input();
    for (const bad of [
      { ...source, evidenceGraph: { ...source.evidenceGraph, userId: "other" } },
      { ...source, resumeVariantPlan: { ...source.resumeVariantPlan, userId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, userId: "other" } },
    ]) await expect(buildResumeVariantArtifact(bad)).rejects.toThrow(TypeError);
  });

  it("rejects mismatched applicationContextId across graph, plan, and cockpit", async () => {
    const source = input();
    for (const bad of [
      { ...source, evidenceGraph: { ...source.evidenceGraph, applicationContextId: "other" } },
      { ...source, resumeVariantPlan: { ...source.resumeVariantPlan, applicationContextId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, applicationContextId: "other" } },
    ]) await expect(buildResumeVariantArtifact(bad)).rejects.toThrow(TypeError);
  });

  it("rejects mismatched source-chain IDs between plan, cockpit, and graph", async () => {
    const source = input();
    for (const bad of [
      { ...source, resumeVariantPlan: { ...source.resumeVariantPlan, evidenceGraphId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, evidenceGraphId: "other" } },
      { ...source, reviewCockpit: { ...source.reviewCockpit, resumeVariantPlanId: "other" } },
    ]) await expect(buildResumeVariantArtifact(bad)).rejects.toThrow(TypeError);
  });

  it("derives blocked, needs_review, and draft statuses", async () => {
    const blocked = linkedInput({ resumeVariantPlan: { blocked: true, blockedReason: "manual" }, reviewCockpit: { summary: { ...cockpit().summary, status: "blocked", blockerCount: 1 } } });
    const needsReview = linkedInput({ reviewCockpit: { summary: { ...cockpit().summary, status: "needs_review", warningCount: 1 } } });
    const emptyGraph = graph();
    const emptyPlan = plan(emptyGraph, { items: [], sourceFactIds: [], allowedClaimIds: [] });
    const draft = input({ evidenceGraph: emptyGraph, resumeVariantPlan: emptyPlan, reviewCockpit: cockpit(emptyGraph, emptyPlan, { items: [], summary: { ...cockpit().summary, allowedClaimCount: 0, planItemCount: 0, sourceFactCount: 0 } }) });
    await expect(buildResumeVariantArtifact(blocked)).resolves.toMatchObject({ status: "blocked" });
    await expect(buildResumeVariantArtifact(needsReview)).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildResumeVariantArtifact(draft)).resolves.toMatchObject({ status: "draft" });
  });

  it("preserves notice provenance for missing evidence, warnings, blockers, and risks", async () => {
    const evidenceGraph = graph({ riskFlags: [{ id: "risk:private-source-fact", category: "private_fact", severity: "blocker", candidateFactId: "candidate-fact:typescript-skill", reason: "Private fact excluded.", version: 1 }], blockedClaimIds: ["blocked-claim:candidate-fact:typescript-skill"] });
    const resumeVariantPlan = plan(evidenceGraph, { blocked: true, riskFlagIds: ["risk:private-source-fact"], warnings: [{ id: "warning:private-source-fact", category: "private_fact", severity: "blocker", riskFlagId: "risk:private-source-fact", candidateFactId: "candidate-fact:typescript-skill", reason: "Private fact.", version: 1 }], items: [{ ...plan(evidenceGraph).items[0]!, action: "block", riskFlagIds: ["risk:private-source-fact"] }] });
    const reviewCockpit = cockpit(evidenceGraph, resumeVariantPlan, { summary: { ...cockpit().summary, status: "blocked", blockerCount: 1, riskFlagCount: 1 }, items: [{ ...cockpit().items[0]!, severity: "blocker", riskFlagId: "risk:private-source-fact", riskFlagIds: ["risk:private-source-fact"] }] });
    const artifact = await buildResumeVariantArtifact(input({ evidenceGraph, resumeVariantPlan, reviewCockpit }));
    expect(artifact.status).toBe("blocked");
    expect(artifact.provenance.riskFlagIds).toEqual(["risk:private-source-fact"]);
    expect(artifact.sections.flatMap((section) => section.items).some((item) => item.kind === "risk_notice")).toBe(true);
    expect(artifact.warnings.length).toBeGreaterThan(0);
  });

  it("evidence assertion rejects source-backed items without allowed claims or source facts", async () => {
    const source = input();
    const artifact = await buildResumeVariantArtifact(source);
    const withoutClaim = mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, allowedClaimId: undefined, allowedClaimIds: [] }));
    const withoutFact = mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, candidateFactId: undefined, sourceFactIds: [] }));
    expect(() => assertResumeVariantArtifactEvidenceBacked(withoutClaim, source)).toThrow(TypeError);
    expect(() => assertResumeVariantArtifactEvidenceBacked(withoutFact, source)).toThrow(TypeError);
  });

  it("provenance consistency rejects unknown allowedClaimId, evidenceMatchId, riskFlagId, and demandId", async () => {
    const source = input();
    const artifact = await buildResumeVariantArtifact(source);
    for (const invalid of [
      mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, allowedClaimId: "allowed-claim:unknown", allowedClaimIds: ["allowed-claim:unknown"] })),
      mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, evidenceMatchId: "evidence-match:unknown", evidenceMatchIds: ["evidence-match:unknown"] })),
      mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, riskFlagId: "risk:unknown", riskFlagIds: ["risk:unknown"] })),
      mutateFirstSourceBackedItem(artifact, (item) => ({ ...item, demandId: "demand:unknown", demandIds: ["demand:unknown"] })),
    ]) expect(() => assertResumeVariantArtifactEvidenceBacked(invalid, source)).toThrow(TypeError);
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
