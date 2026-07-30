import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import type { CandidateFactV1 } from "../../candidate-evidence/schema";
import { listCareerKnowledgeRules } from "../../career-knowledge/resolver";
import { buildEvidenceGraph } from "../../evidence-graph/buildEvidenceGraph";
import type {
  EvidenceGraphBuildInputV1,
  EvidenceGraphV1,
  JobDemandV1,
} from "../../evidence-graph/schema";
import {
  assertResumeVariantPlanDoesNotContainGeneratedText,
  assertResumeVariantPlanEvidenceBacked,
  buildResumeVariantPlan,
  buildResumeVariantPlanArtifactContent,
  buildResumeVariantPlanHash,
  buildResumeVariantPlanItems,
  buildResumeVariantPlanWarnings,
  collectResumeVariantPlanAllowedClaimIds,
  collectResumeVariantPlanRiskFlagIds,
  collectResumeVariantPlanSourceFactIds,
} from "../buildResumeVariantPlan";
import type { BuildResumeVariantPlanInputV1, ResumeVariantPlanV1 } from "../schema";

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

describe("resume-variant-plan artifact", () => {
  it("same input builds same ResumeVariantPlan hash", async () => {
    const input = await planInput();
    const first = await buildResumeVariantPlan(input);
    const second = await buildResumeVariantPlan(input);

    expect(first.id).toBe(second.id);
    expect(first.id).toBe(`resume-variant-plan:${await buildResumeVariantPlanHash(input)}`);
    expect(first.id).toMatch(/^resume-variant-plan:[a-f0-9]{64}$/u);
  });

  it("changed EvidenceGraph id, hash, or content changes plan hash", async () => {
    const input = await planInput();
    const base = await buildResumeVariantPlanHash(input);
    const changedId = { ...input.evidenceGraph, id: "evidence-graph:changed" };
    const changedContent = {
      ...input.evidenceGraph,
      allowedClaims: [
        ...input.evidenceGraph.allowedClaims,
        {
          ...input.evidenceGraph.allowedClaims[0]!,
          id: "allowed-claim:candidate-fact:extra",
          candidateFactIds: ["candidate-fact:extra"],
          text: "Extra",
          claimType: "skill" as const,
        },
      ],
    };

    await expect(buildResumeVariantPlanHash({ ...input, evidenceGraph: changedId })).resolves.not.toBe(
      base,
    );
    await expect(buildResumeVariantPlanHash({ ...input, evidenceGraph: changedContent })).resolves.not.toBe(
      base,
    );
  });

  it("targetDocumentKind is preserved", async () => {
    const plan = await buildResumeVariantPlan(await planInput({ targetDocumentKind: "cv" }));

    expect(plan.targetDocumentKind).toBe("cv");
  });

  it("approved allowed claim creates a pending plan item", async () => {
    const plan = await buildResumeVariantPlan(await planInput());

    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "skills",
          action: "add_from_allowed_claim",
          priority: "required",
          reviewState: "pending",
          allowedClaimIds: ["allowed-claim:candidate-fact:typescript"],
        }),
      ]),
    );
  });

  it("uses include only when an allowed fact is bound to a stable source CV item", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput({
        sourceCvId: "cv-source-1",
        sourceCvFactBindings: [
          {
            candidateFactId: "candidate-fact:typescript",
            sourceCvItemReferenceId:
              "candidate-cv-item:v1:cv-source-1:skill:section-skills:skill-typescript",
          },
        ],
      }),
    );

    expect(plan.sourceCvId).toBe("cv-source-1");
    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "include",
          reviewState: "pending",
          sourceCvItemReferenceIds: [
            "candidate-cv-item:v1:cv-source-1:skill:section-skills:skill-typescript",
          ],
        }),
      ]),
    );
  });

  it("fails closed on duplicate source CV fact bindings", async () => {
    const binding = {
      candidateFactId: "candidate-fact:typescript",
      sourceCvItemReferenceId:
        "candidate-cv-item:v1:cv-source-1:skill:section-skills:skill-typescript",
    };

    await expect(
      buildResumeVariantPlan(
        await planInput({
          sourceCvId: "cv-source-1",
          sourceCvFactBindings: [binding, binding],
        }),
      ),
    ).rejects.toThrow(/duplicate.*source CV fact binding/i);
  });

  it("plan item maps to allowedClaimIds and candidateFactIds", async () => {
    const plan = await buildResumeVariantPlan(await planInput());
    const item = plan.items.find((candidate) => candidate.allowedClaimIds.length > 0);

    expect(item).toMatchObject({
      allowedClaimIds: ["allowed-claim:candidate-fact:typescript"],
      candidateFactIds: ["candidate-fact:typescript"],
    });
  });

  it("plan item preserves demandIds and evidenceMatchIds where available", async () => {
    const input = await planInput();
    const plan = await buildResumeVariantPlan(input);
    const item = plan.items.find((candidate) => candidate.allowedClaimIds.length > 0)!;

    expect(item.demandIds).toEqual(["demand:typescript"]);
    expect(item.evidenceMatchIds).toEqual(input.evidenceGraph.matches.map((match) => match.id));
  });

  it("multi-fact allowed claim keeps only accepted matched facts on the plan item", async () => {
    const graph = await buildEvidenceGraph(evidenceInput());
    const evidenceGraph: EvidenceGraphV1 = {
      ...graph,
      allowedClaims: [
        {
          ...graph.allowedClaims[0]!,
          candidateFactIds: ["candidate-fact:typescript", "candidate-fact:unmatched"],
        },
      ],
    };
    const plan = await buildResumeVariantPlan(await planInput({ evidenceGraph }));
    const item = plan.items.find((candidate) => candidate.allowedClaimIds.length > 0)!;

    expect(item.candidateFactIds).toEqual(["candidate-fact:typescript"]);
    expect(() => assertResumeVariantPlanEvidenceBacked(plan, evidenceGraph)).not.toThrow();
  });

  it("missing evidence becomes a plan warning", async () => {
    const input = await planInput({}, { candidateFacts: [] });
    const warnings = buildResumeVariantPlanWarnings(input);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing_evidence",
          severity: "blocker",
          demandId: "demand:typescript",
        }),
      ]),
    );
  });

  it("blocker risk sets blocked true", async () => {
    const plan = await buildResumeVariantPlan(await planInput({}, { candidateFacts: [] }));

    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toContain("missing_evidence");
  });

  it("no blocker risk sets blocked false", async () => {
    const plan = await buildResumeVariantPlan(await planInput());

    expect(plan.blocked).toBe(false);
    expect(plan.blockedReason).toBeUndefined();
  });

  it("private_fact risk becomes a warning, not a claim-backed plan item", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput({}, { candidateFacts: [fact({ visibility: "private" })] }),
    );

    expect(plan.warnings.map((warning) => warning.category)).toContain("private_fact");
    expect(plan.items.filter((item) => item.allowedClaimIds.length > 0)).toHaveLength(0);
  });

  it("never_use_fact risk becomes a warning, not a claim-backed plan item", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput({}, { candidateFacts: [fact({ visibility: "never_use" })] }),
    );

    expect(plan.warnings.map((warning) => warning.category)).toContain("never_use_fact");
    expect(plan.items.filter((item) => item.allowedClaimIds.length > 0)).toHaveLength(0);
  });

  it("generated_text_as_fact risk becomes a warning, not a claim-backed plan item", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput(
        {},
        {
          candidateFacts: [
            fact({
              id: "candidate-fact:generated",
              value: { generatedText: "World-class TypeScript expert who transforms businesses." },
            }),
          ],
        },
      ),
    );

    expect(plan.warnings.map((warning) => warning.category)).toContain("generated_text_as_fact");
    expect(plan.items.filter((item) => item.allowedClaimIds.length > 0)).toHaveLength(0);
  });

  it("blockedClaimIds are carried forward", async () => {
    const input = await planInput({}, { candidateFacts: [fact({ reviewState: "pending" })] });
    const plan = await buildResumeVariantPlan(input);

    expect(plan.blockedClaimIds).toEqual(input.evidenceGraph.blockedClaimIds);
  });

  it("no plan item is created from blocked claims", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput({}, { candidateFacts: [fact({ reviewState: "pending" })] }),
    );

    expect(plan.items.filter((item) => item.allowedClaimIds.length > 0)).toHaveLength(0);
  });

  it("every include/emphasize/reorder/add_from_allowed_claim item is evidence-backed", async () => {
    const input = await planInput();
    const plan = await buildResumeVariantPlan(input);

    expect(() => assertResumeVariantPlanEvidenceBacked(plan, input.evidenceGraph)).not.toThrow();
  });

  it("helper fails deterministically if a plan item lacks evidence backing", async () => {
    const input = await planInput();
    const plan = await buildResumeVariantPlan(input);
    const bad: ResumeVariantPlanV1 = {
      ...plan,
      items: [{ ...plan.items.find((item) => item.allowedClaimIds.length > 0)!, allowedClaimIds: [] }],
    };

    expect(() => assertResumeVariantPlanEvidenceBacked(bad, input.evidenceGraph)).toThrow(
      /lacks allowedClaimIds/u,
    );
  });

  it("no polished resume bullet text is produced", async () => {
    const plan = await buildResumeVariantPlan(await planInput());

    expect(plan.items.map((item) => item.reason).join("\n")).not.toMatch(
      /increased revenue by 30%|world-class|proven track record/iu,
    );
    expect(() => assertResumeVariantPlanDoesNotContainGeneratedText(plan)).not.toThrow();
  });

  it("no cover-letter text is produced", async () => {
    const plan = await buildResumeVariantPlan(await planInput());

    expect([...plan.items.map((item) => item.reason), ...plan.warnings.map((warning) => warning.reason)].join("\n")).not.toMatch(
      /dear hiring manager|excited to apply|sincerely/iu,
    );
  });

  it("artifact content helper returns kind resume_variant_plan", async () => {
    const plan = await buildResumeVariantPlan(await planInput());

    expect(buildResumeVariantPlanArtifactContent(plan)).toMatchObject({
      kind: "resume_variant_plan",
      plan,
      version: 1,
    });
  });

  it("collectors return sorted sourceFactIds, allowedClaimIds, and riskFlagIds", async () => {
    const plan = await buildResumeVariantPlan(
      await planInput(
        {},
        {
          demands: [demand({ id: "demand:react", label: "React" }), demand()],
          candidateFacts: [
            fact({
              id: "candidate-fact:react",
              sourcePath: "document.skills[1].name",
              sourceQuote: "React",
              value: { name: "React" },
              normalizedText: "React",
            }),
            fact(),
          ],
        },
      ),
    );

    expect(collectResumeVariantPlanSourceFactIds(plan)).toEqual([
      "candidate-fact:react",
      "candidate-fact:typescript",
    ]);
    expect(collectResumeVariantPlanAllowedClaimIds(plan)).toEqual([
      "allowed-claim:candidate-fact:react",
      "allowed-claim:candidate-fact:typescript",
    ]);
    expect(collectResumeVariantPlanRiskFlagIds(plan)).toEqual([]);
  });

  it("helpers do not mutate inputs", async () => {
    const input = await planInput();
    const before = stableSerialize(input);

    buildResumeVariantPlanItems(input);
    buildResumeVariantPlanWarnings(input);
    await buildResumeVariantPlan(input);
    await buildResumeVariantPlanHash(input);

    expect(stableSerialize(input)).toBe(before);
  });

  it("output order is deterministic", async () => {
    const reactFact = fact({
      id: "candidate-fact:react",
      sourcePath: "document.skills[1].name",
      sourceQuote: "React",
      value: { name: "React" },
      normalizedText: "React",
    });
    const reactDemand = demand({ id: "demand:react", label: "React" });
    const first = await buildResumeVariantPlan(
      await planInput({}, { demands: [reactDemand, demand()], candidateFacts: [reactFact, fact()] }),
    );
    const second = await buildResumeVariantPlan(
      await planInput({}, { demands: [demand(), reactDemand], candidateFacts: [fact(), reactFact] }),
    );

    expect(first.id).toBe(second.id);
    expect(first.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
  });

  it("manual assertion blocks claim-backed items referencing private or generated facts", async () => {
    const graph = await buildEvidenceGraph(evidenceInput());
    const riskyGraph: EvidenceGraphV1 = {
      ...graph,
      riskFlags: [
        ...graph.riskFlags,
        {
          id: "evidence-graph-risk:private-fact:no-demand:candidate-fact:typescript:no-rule",
          category: "private_fact",
          severity: "blocker",
          candidateFactId: "candidate-fact:typescript",
          reason: "Private fact matches this demand.",
          version: 1,
        },
      ],
    };
    const plan = await buildResumeVariantPlan(await planInput({ evidenceGraph: graph }));

    expect(() => assertResumeVariantPlanEvidenceBacked(plan, riskyGraph)).toThrow(/excluded source fact/u);
  });
});
