import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import type { CandidateFactV1 } from "../../candidate-evidence/schema";
import { listCareerKnowledgeRules } from "../../career-knowledge/resolver";
import { buildEvidenceGraph } from "../../evidence-graph/buildEvidenceGraph";
import type { EvidenceGraphBuildInputV1, JobDemandV1 } from "../../evidence-graph/schema";
import { buildResumeVariantPlan } from "../../resume-variant-plan/buildResumeVariantPlan";
import type { BuildResumeVariantPlanInputV1 } from "../../resume-variant-plan/schema";
import {
  assertReviewCockpitDoesNotContainGeneratedText,
  buildReviewCockpit,
  buildReviewCockpitHash,
  buildReviewCockpitItems,
  buildReviewCockpitSummary,
} from "../buildReviewCockpit";
import type { BuildReviewCockpitInputV1 } from "../schema";

const T = Date.UTC(2026, 5, 9);
const rules = () => listCareerKnowledgeRules();

function demand(overrides: Partial<JobDemandV1> = {}): JobDemandV1 {
  return {
    id: "demand:typescript",
    kind: "skill",
    label: "TypeScript",
    required: "required",
    source: "job",
    sourcePath: "job.requirements[0]",
    weight: 1,
    version: 1,
    ...overrides,
  };
}

function fact(overrides: Partial<CandidateFactV1> = {}): CandidateFactV1 {
  return {
    id: "candidate-fact:typescript",
    userId: "user_123",
    sourceDocumentId: "candidate-source-document:source_hash_a",
    sourcePath: "document.skills[0].name",
    sourceQuote: "TypeScript",
    factType: "skill",
    value: { name: "TypeScript" },
    normalizedText: "TypeScript",
    confidence: 0.96,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function evidenceInput(
  overrides: Partial<EvidenceGraphBuildInputV1> = {},
): EvidenceGraphBuildInputV1 {
  return {
    userId: "user_123",
    applicationContextId: "application-context:abc",
    demands: [demand()],
    candidateFacts: [fact()],
    careerKnowledgeRules: rules(),
    createdAt: T,
    ...overrides,
  };
}

async function planInput(
  overrides: Partial<BuildResumeVariantPlanInputV1> = {},
  evidenceOverrides: Partial<EvidenceGraphBuildInputV1> = {},
): Promise<BuildResumeVariantPlanInputV1> {
  const evidenceGraph = overrides.evidenceGraph ?? (await buildEvidenceGraph(evidenceInput(evidenceOverrides)));

  return {
    userId: "user_123",
    applicationContextId: "application-context:abc",
    targetDocumentKind: "resume",
    language: "en",
    market: "global",
    evidenceGraph,
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

async function cockpitInput(
  overrides: Partial<BuildReviewCockpitInputV1> = {},
  evidenceOverrides: Partial<EvidenceGraphBuildInputV1> = {},
  planOverrides: Partial<BuildResumeVariantPlanInputV1> = {},
): Promise<BuildReviewCockpitInputV1> {
  const sourcePlanInput = await planInput(planOverrides, evidenceOverrides);
  const resumeVariantPlan = overrides.resumeVariantPlan ?? (await buildResumeVariantPlan(sourcePlanInput));
  const evidenceGraph = overrides.evidenceGraph ?? sourcePlanInput.evidenceGraph;

  return {
    userId: "user_123",
    applicationContextId: "application-context:abc",
    evidenceGraph,
    resumeVariantPlan,
    createdAt: T,
    ...overrides,
  };
}

describe("review-cockpit model", () => {
  it("same input builds same ReviewCockpit hash", async () => {
    const input = await cockpitInput();
    const first = await buildReviewCockpit(input);
    const second = await buildReviewCockpit(input);

    expect(first.id).toBe(second.id);
    expect(first.id).toBe(`review-cockpit:${await buildReviewCockpitHash(input)}`);
    expect(first.id).toMatch(/^review-cockpit:[a-f0-9]{64}$/u);
  });

  it("mismatched EvidenceGraph userId throws", async () => {
    const input = await cockpitInput();
    const mismatched = {
      ...input,
      evidenceGraph: { ...input.evidenceGraph, userId: "other_user" },
    };

    await expect(buildReviewCockpit(mismatched)).rejects.toThrow(TypeError);
    await expect(buildReviewCockpit(mismatched)).rejects.toThrow(/userId must match EvidenceGraph/u);
  });

  it("mismatched ResumeVariantPlan userId throws", async () => {
    const input = await cockpitInput();
    const mismatched = {
      ...input,
      resumeVariantPlan: { ...input.resumeVariantPlan, userId: "other_user" },
    };

    await expect(buildReviewCockpit(mismatched)).rejects.toThrow(TypeError);
    await expect(buildReviewCockpit(mismatched)).rejects.toThrow(/userId must match ResumeVariantPlan/u);
  });

  it("model overload builds a stable ReviewCockpit hash", async () => {
    const model = await buildReviewCockpit(await cockpitInput());

    await expect(buildReviewCockpitHash(model)).resolves.toMatch(/^[a-f0-9]{64}$/u);
    await expect(buildReviewCockpitHash(model)).resolves.toBe(await buildReviewCockpitHash(model));
  });

  it("changed EvidenceGraph id, hash, or content changes cockpit hash", async () => {
    const input = await cockpitInput();
    const base = await buildReviewCockpitHash(input);

    await expect(
      buildReviewCockpitHash({ ...input, evidenceGraph: { ...input.evidenceGraph, id: "evidence-graph:changed" } }),
    ).resolves.not.toBe(base);
    await expect(
      buildReviewCockpitHash({
        ...input,
        evidenceGraph: { ...input.evidenceGraph, jobDemandGraphHash: "changed-job-demand-hash" },
      }),
    ).resolves.not.toBe(base);
    await expect(
      buildReviewCockpitHash({
        ...input,
        evidenceGraph: {
          ...input.evidenceGraph,
          missing: [
            ...input.evidenceGraph.missing,
            {
              id: "missing-evidence:extra",
              demandId: "demand:extra",
              label: "Extra",
              severity: "info" as const,
              reason: "No approved source-backed evidence matched this demand.",
              version: 1 as const,
            },
          ],
        },
      }),
    ).resolves.not.toBe(base);
  });

  it("changed ResumeVariantPlan id, hash, or content changes cockpit hash", async () => {
    const input = await cockpitInput();
    const base = await buildReviewCockpitHash(input);

    await expect(
      buildReviewCockpitHash({
        ...input,
        resumeVariantPlan: { ...input.resumeVariantPlan, id: "resume-variant-plan:changed" },
      }),
    ).resolves.not.toBe(base);
    await expect(
      buildReviewCockpitHash({
        ...input,
        resumeVariantPlan: { ...input.resumeVariantPlan, evidenceGraphHash: "changed-evidence-graph-hash" },
      }),
    ).resolves.not.toBe(base);
    await expect(
      buildReviewCockpitHash({
        ...input,
        resumeVariantPlan: {
          ...input.resumeVariantPlan,
          warnings: [
            ...input.resumeVariantPlan.warnings,
            {
              id: "resume-variant-plan-warning:manual-review",
              category: "other" as const,
              severity: "warning" as const,
              reason: "Manual review required before resume planning.",
              version: 1 as const,
            },
          ],
        },
      }),
    ).resolves.not.toBe(base);
  });

  it("blocked plan creates blocked cockpit status", async () => {
    const cockpit = await buildReviewCockpit(await cockpitInput({}, { candidateFacts: [] }));

    expect(cockpit.summary.status).toBe("blocked");
  });

  it("warning-only plan creates needs_review status", async () => {
    const cockpit = await buildReviewCockpit(
      await cockpitInput({}, { demands: [demand({ required: "preferred" })], candidateFacts: [] }),
    );

    expect(cockpit.summary.status).toBe("needs_review");
    expect(cockpit.summary.blockerCount).toBe(0);
  });

  it("no-warning plan creates ready status", async () => {
    const cockpit = await buildReviewCockpit(await cockpitInput());

    expect(cockpit.summary.status).toBe("ready");
    expect(cockpit.summary.warningCount).toBe(0);
    expect(cockpit.summary.blockerCount).toBe(0);
  });

  it("blocker warning increments blockerCount", async () => {
    const cockpit = await buildReviewCockpit(await cockpitInput({}, { candidateFacts: [] }));

    expect(cockpit.summary.blockerCount).toBeGreaterThan(0);
    expect(cockpit.items.some((item) => item.severity === "blocker")).toBe(true);
  });

  it("missing evidence becomes a cockpit item", async () => {
    const items = buildReviewCockpitItems(await cockpitInput({}, { candidateFacts: [] }));

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "missing_evidence",
          demandId: "demand:typescript",
          title: "Review missing evidence",
        }),
      ]),
    );
  });

  it("blocked claim becomes a cockpit item", async () => {
    const items = buildReviewCockpitItems(
      await cockpitInput({}, { candidateFacts: [fact({ reviewState: "pending" })] }),
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "blocked_claims",
          candidateFactId: "candidate-fact:typescript",
          severity: "blocker",
        }),
      ]),
    );
  });

  it("plan item needing review becomes a cockpit item", async () => {
    const items = buildReviewCockpitItems(
      await cockpitInput({}, { demands: [demand({ required: "preferred" })], candidateFacts: [] }),
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "plan_items",
          severity: "warning",
          title: "Plan item needs review",
        }),
      ]),
    );
  });

  it("allowed source-backed claim becomes a source-support item", async () => {
    const items = buildReviewCockpitItems(await cockpitInput());

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "source_support",
          allowedClaimId: "allowed-claim:candidate-fact:typescript",
          sourceFactIds: ["candidate-fact:typescript"],
          severity: "info",
        }),
      ]),
    );
  });

  it("item IDs and ordering are deterministic", async () => {
    const reactFact = fact({
      id: "candidate-fact:react",
      sourcePath: "document.skills[1].name",
      sourceQuote: "React",
      value: { name: "React" },
      normalizedText: "React",
    });
    const reactDemand = demand({ id: "demand:react", label: "React" });
    const first = await buildReviewCockpit(
      await cockpitInput({}, { demands: [reactDemand, demand()], candidateFacts: [reactFact, fact()] }),
    );
    const second = await buildReviewCockpit(
      await cockpitInput({}, { demands: [demand(), reactDemand], candidateFacts: [fact(), reactFact] }),
    );

    expect(first.id).toBe(second.id);
    expect(first.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
  });

  it("sourceFactIds, allowedClaimIds, and riskFlagIds are preserved", async () => {
    const sourceSupported = await buildReviewCockpit(await cockpitInput());
    const sourceItem = sourceSupported.items.find((item) => item.bucket === "source_support")!;

    expect(sourceItem.sourceFactIds).toEqual(["candidate-fact:typescript"]);
    expect(sourceItem.allowedClaimIds).toEqual(["allowed-claim:candidate-fact:typescript"]);

    const riskyInput = await cockpitInput({}, { candidateFacts: [fact({ visibility: "private" })] });
    const risky = await buildReviewCockpit(riskyInput);
    const riskFlagId = riskyInput.evidenceGraph.riskFlags[0]!.id;

    expect(risky.items.some((item) => item.riskFlagIds.includes(riskFlagId))).toBe(true);
  });

  it("no polished resume bullet text is produced", async () => {
    const cockpit = await buildReviewCockpit(await cockpitInput());
    const text = cockpit.items.flatMap((item) => [item.title, item.description]).join("\n");

    expect(text).not.toMatch(/increased revenue by 30%|world-class|proven track record/iu);
    expect(() => assertReviewCockpitDoesNotContainGeneratedText(cockpit)).not.toThrow();
  });

  it("no cover-letter text is produced", async () => {
    const cockpit = await buildReviewCockpit(await cockpitInput());
    const text = cockpit.items.flatMap((item) => [item.title, item.description]).join("\n");

    expect(text).not.toMatch(/dear hiring manager|excited to apply|sincerely/iu);
  });

  it("helpers do not mutate inputs", async () => {
    const input = await cockpitInput();
    const before = stableSerialize(input);

    buildReviewCockpitItems(input);
    buildReviewCockpitSummary(input);
    await buildReviewCockpit(input);
    await buildReviewCockpitHash(input);

    expect(stableSerialize(input)).toBe(before);
  });

  it("summary exposes expected counts", async () => {
    const summary = buildReviewCockpitSummary(await cockpitInput());

    expect(summary).toMatchObject({
      allowedClaimCount: 1,
      planItemCount: 1,
      warningCount: 0,
      missingEvidenceCount: 0,
      blockedClaimCount: 0,
      sourceFactCount: 1,
      riskFlagCount: 0,
      version: 1,
    });
  });
});
