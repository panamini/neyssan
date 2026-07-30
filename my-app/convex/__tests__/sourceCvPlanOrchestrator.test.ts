import { describe, expect, it } from "vitest";

import type { CvDocument } from "../../src/types/cvDocument";
import { buildCandidateCvFacts } from "../../src/modules/candidate-evidence/candidateCvFacts";
import { buildCandidateCvItemReferences } from "../../src/modules/candidate-evidence/cvItemReferences";
import type {
  CandidateFactV1,
  CandidateSourceDocumentV1,
} from "../../src/modules/candidate-evidence/schema";
import { buildApplicationContextV1FromExistingData } from "../lib/applicationContextBuilder";
import {
  buildSourceCvPlanFromPersistence,
  type SourceCvPlanPersistencePortV1,
} from "../lib/sourceCvPlanOrchestrator";

const T = Date.UTC(2026, 6, 29);
const USER_ID = "user-owner";
const JOB_ID = "job-bakery-1";

function sourceCv(experienceText = "Customer service"): CvDocument {
  return {
    id: "cv-source-1",
    title: "Source CV",
    metadata: {
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "section-experience",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            id: "exp-bakery",
            company: "Bakery One",
            position: "Sales associate",
            startDate: "2024-01-01",
            responsibilityBullets: [experienceText],
          },
        ],
      },
    ],
  };
}

function profile(document: CvDocument, ownerId = USER_ID) {
  return {
    _id: ownerId,
    profileId: "profile-owner",
    email: "owner@example.test",
    name: "Owner",
    version: 1,
    createdAt: T,
    updatedAt: T,
    preferences: {
      writingStyle: "natural",
      tonePreference: "auto",
      autoSend: false,
    },
    cvDocument: document,
  };
}

function job(
  ownerId = USER_ID,
  rawDescription = "Customer service in a bakery.",
  mustHaves: readonly string[] = ["Customer service"],
  readiness: Readonly<{
    parseStatus?:
      | "imported"
      | "parsing"
      | "parsed"
      | "failed";
    reviewState?: "pending" | "needs_review" | "ready";
  }> = {},
) {
  return {
    _id: JOB_ID,
    userId: ownerId,
    parseStatus: readiness.parseStatus ?? "parsed",
    reviewState: readiness.reviewState ?? "ready",
    title: "Bakery sales associate",
    company: "Bakery One",
    sourceUrl: "https://example.test/jobs/bakery",
    rawDescription,
    responsibilities: ["Customer service"],
    keywords: [],
    mustHaves,
  };
}

function sourceDocument(): CandidateSourceDocumentV1 {
  return {
    id: "candidate-source-document:linked",
    userId: USER_ID,
    canonicalCvId: "cv-source-1",
    sourceType: "uploaded_cv",
    textHash: "text:linked",
    sourceHash: "source:linked",
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
}

async function factsFor(
  document: CvDocument,
  documentId: string,
): Promise<readonly CandidateFactV1[]> {
  return buildCandidateCvFacts({
    userId: USER_ID,
    sourceDocumentId: documentId,
    document,
    references: buildCandidateCvItemReferences(document),
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
  });
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture(overrides: {
  currentCv?: CvDocument;
  contextCv?: CvDocument;
  profileOwnerId?: string;
  jobOwnerId?: string;
  currentJobDescription?: string;
  currentMustHaves?: readonly string[];
  currentJobParseStatus?: "imported" | "parsing" | "parsed" | "failed";
  currentJobReviewState?: "pending" | "needs_review" | "ready";
} = {}) {
  const contextCv = overrides.contextCv ?? sourceCv();
  const currentCv = overrides.currentCv ?? contextCv;
  const contextJob = job();
  const currentJob = job(
    overrides.jobOwnerId,
    overrides.currentJobDescription ?? contextJob.rawDescription,
    overrides.currentMustHaves ?? contextJob.mustHaves,
    {
      parseStatus: overrides.currentJobParseStatus,
      reviewState: overrides.currentJobReviewState,
    },
  );
  const built = await buildApplicationContextV1FromExistingData({
    userId: USER_ID,
    job: contextJob,
    candidateProfile: profile(contextCv),
    now: T,
  });
  const linkedSource = sourceDocument();

  return {
    currentCv,
    context: built.context,
    currentProfile: profile(
      currentCv,
      overrides.profileOwnerId ?? USER_ID,
    ),
    currentJob,
    linkedSource,
    facts: await factsFor(currentCv, linkedSource.id),
  };
}

function makePersistence(
  value: Fixture,
  options: {
    leakContextAcrossUsers?: boolean;
    leakCandidateEvidenceScope?: boolean;
    forbidCandidateEvidenceReads?: boolean;
  } = {},
) {
  const operations: Array<{
    operation: string;
    scope: Record<string, string>;
  }> = [];
  const persistence: SourceCvPlanPersistencePortV1 = {
    async getApplicationContextForUser(scope) {
      operations.push({
        operation: "getApplicationContextForUser",
        scope: { ...scope },
      });
      if (
        scope.contextId !== value.context.id ||
        (!options.leakContextAcrossUsers && scope.userId !== value.context.userId)
      ) {
        return null;
      }
      return value.context;
    },
    async getUserProfileById(scope) {
      operations.push({
        operation: "getUserProfileById",
        scope: { ...scope },
      });
      return scope.userId === value.currentProfile._id
        ? value.currentProfile
        : null;
    },
    async getJobById(scope) {
      operations.push({ operation: "getJobById", scope: { ...scope } });
      return scope.jobId === value.currentJob._id ? value.currentJob : null;
    },
    async listSourceDocumentsForCanonicalCv(scope) {
      if (options.forbidCandidateEvidenceReads) {
        throw new Error("candidate evidence read was not expected");
      }
      operations.push({
        operation: "listSourceDocumentsForCanonicalCv",
        scope: { ...scope },
      });
      if (options.leakCandidateEvidenceScope) {
        return [value.linkedSource];
      }
      return scope.userId === value.linkedSource.userId &&
        scope.canonicalCvId === value.linkedSource.canonicalCvId
        ? [value.linkedSource]
        : [];
    },
    async listFactsForSourceDocument(scope) {
      if (options.forbidCandidateEvidenceReads) {
        throw new Error("candidate evidence read was not expected");
      }
      operations.push({
        operation: "listFactsForSourceDocument",
        scope: { ...scope },
      });
      if (options.leakCandidateEvidenceScope) {
        return value.facts;
      }
      return scope.userId === USER_ID &&
        scope.sourceDocumentId === value.linkedSource.id
        ? value.facts
        : [];
    },
  };
  return { operations, persistence };
}

function orchestratorInput(
  persistence: SourceCvPlanPersistencePortV1,
  value: Fixture,
  callerUserId = USER_ID,
) {
  return {
    persistence,
    callerUserId,
    applicationContextId: value.context.id,
    requestedJobId: JOB_ID,
    now: T,
  } as const;
}

describe("source CV plan orchestrator", () => {
  it("uses the attached canonical CV only for the current application without reading or mutating CandidateEvidence", async () => {
    const value = await fixture();
    const beforeCv = structuredClone(value.currentCv);
    const beforeFacts = structuredClone(value.facts);
    const { operations, persistence } = makePersistence(value, {
      forbidCandidateEvidenceReads: true,
    });

    const result = await buildSourceCvPlanFromPersistence({
      ...orchestratorInput(persistence, value),
      sourceAuthorization: "attached_source_cv",
    });

    expect(result.mode).toBe("auto_recommended");
    expect(result.plan.items.length).toBeGreaterThan(0);
    expect(
      result.plan.items.every((item) => item.reviewState === "pending"),
    ).toBe(true);
    expect(result.plan.sourceFactIds).toEqual([]);
    expect(
      result.plan.items.every(
        (item) =>
          item.action === "include" &&
          item.sourceCvItemReferenceIds?.length === 1 &&
          item.candidateFactIds.length === 0 &&
          item.allowedClaimIds.length === 0 &&
          item.evidenceMatchIds.length === 0,
      ),
    ).toBe(true);
    expect(
      operations.some((operation) =>
        operation.operation.startsWith("list"),
      ),
    ).toBe(false);
    expect(value.currentCv).toEqual(beforeCv);
    expect(value.facts).toEqual(beforeFacts);
  });

  it("returns a verified full-source-CV reference without a plan or CandidateEvidence reads", async () => {
    const value = await fixture();
    const beforeCv = structuredClone(value.currentCv);
    const { persistence } = makePersistence(value, {
      forbidCandidateEvidenceReads: true,
    });

    const result = await buildSourceCvPlanFromPersistence({
      ...orchestratorInput(persistence, value),
      mode: "full_source_cv",
      sourceAuthorization: "attached_source_cv",
    });

    expect(result).toMatchObject({
      mode: "full_source_cv",
      sourceCvId: value.currentCv.id,
      sourceCvContextHash: value.context.candidate.candidateHash,
      plan: null,
    });
    expect(value.currentCv).toEqual(beforeCv);
  });

  it("loads the owning context, current job/CV, and scoped facts into a pending plan without mutation", async () => {
    const value = await fixture();
    const beforeCv = JSON.stringify(value.currentCv);
    const beforeFixture = JSON.stringify(value);
    const { operations, persistence } = makePersistence(value);

    const result = await buildSourceCvPlanFromPersistence(
      orchestratorInput(persistence, value),
    );

    expect(result.mode).toBe("auto_recommended");
    expect(result.plan.items.length).toBeGreaterThan(0);
    expect(
      result.plan.items.every((item) => item.reviewState === "pending"),
    ).toBe(true);
    expect(operations).toContainEqual({
      operation: "getApplicationContextForUser",
      scope: { userId: USER_ID, contextId: value.context.id },
    });
    expect(operations).toContainEqual({
      operation: "listSourceDocumentsForCanonicalCv",
      scope: { userId: USER_ID, canonicalCvId: value.currentCv.id },
    });
    expect(operations).toContainEqual({
      operation: "listFactsForSourceDocument",
      scope: {
        userId: USER_ID,
        sourceDocumentId: value.linkedSource.id,
      },
    });
    expect(JSON.stringify(value.currentCv)).toBe(beforeCv);
    expect(JSON.stringify(value)).toBe(beforeFixture);
  });

  it("accepts a current MCP-safe context projection with canonical Job Brief demands", async () => {
    const value = await fixture();
    const built = await buildApplicationContextV1FromExistingData({
      userId: USER_ID,
      job: {
        _id: value.currentJob._id,
        rawDescription: value.currentJob.rawDescription,
        mustHaves: value.currentJob.mustHaves,
        responsibilities: value.currentJob.responsibilities,
        keywords: value.currentJob.keywords,
      },
      candidateProfile: value.currentProfile,
      now: T,
    });
    const projectedValue = {
      ...value,
      context: built.context,
    };
    const { persistence } = makePersistence(projectedValue);

    const result = await buildSourceCvPlanFromPersistence(
      orchestratorInput(persistence, projectedValue),
    );

    expect(result.mode).toBe("auto_recommended");
    expect(result.plan.items.length).toBeGreaterThan(0);
  });

  it("rejects a context returned outside the caller scope before loading profile or evidence", async () => {
    const value = await fixture();
    const { operations, persistence } = makePersistence(value, {
      leakContextAcrossUsers: true,
    });

    await expect(
      buildSourceCvPlanFromPersistence(
        orchestratorInput(persistence, value, "user-attacker"),
      ),
    ).rejects.toThrow(/ApplicationContext not found for caller/);

    expect(operations).toEqual([
      {
        operation: "getApplicationContextForUser",
        scope: {
          userId: "user-attacker",
          contextId: value.context.id,
        },
      },
    ]);
  });

  it("rejects a context bound to a different requested job before loading profile or evidence", async () => {
    const value = await fixture();
    const { operations, persistence } = makePersistence(value);

    await expect(
      buildSourceCvPlanFromPersistence({
        ...orchestratorInput(persistence, value),
        requestedJobId: "job-other",
      }),
    ).rejects.toThrow(/does not match requested job/);

    expect(operations).toEqual([
      {
        operation: "getApplicationContextForUser",
        scope: { userId: USER_ID, contextId: value.context.id },
      },
    ]);
  });

  it("keeps historical unbound contexts readable but refuses to compose from them", async () => {
    const value = await fixture();
    const { jobBriefHash: _jobBriefHash, ...historicalJob } = value.context.job;
    const historicalValue = {
      ...value,
      context: {
        ...value.context,
        job: historicalJob,
      },
    };
    const { operations, persistence } = makePersistence(historicalValue);

    await expect(
      buildSourceCvPlanFromPersistence(
        orchestratorInput(persistence, historicalValue),
      ),
    ).rejects.toThrow(/lacks a verified canonical Job Brief binding/);

    expect(operations).toEqual([
      {
        operation: "getApplicationContextForUser",
        scope: { userId: USER_ID, contextId: historicalValue.context.id },
      },
    ]);
  });

  it("rejects profile and job ownership mismatches before selecting candidate evidence", async () => {
    for (const value of [
      await fixture({ profileOwnerId: "user-attacker" }),
      await fixture({ jobOwnerId: "user-attacker" }),
    ]) {
      const { operations, persistence } = makePersistence(value);

      await expect(
        buildSourceCvPlanFromPersistence(
          orchestratorInput(persistence, value),
        ),
      ).rejects.toThrow(/owner profile|job owner/);

      expect(
        operations.some(
          (operation) =>
            operation.operation === "listSourceDocumentsForCanonicalCv",
        ),
      ).toBe(false);
    }
  });

  it.each(["imported", "parsing", "failed"] as const)(
    "rejects canonical Job Brief parse status %s before reconstruction or evidence reads",
    async (parseStatus) => {
      const value = await fixture({ currentJobParseStatus: parseStatus });
      const beforeFixture = JSON.stringify(value);
      const { operations, persistence } = makePersistence(value);

      await expect(
        buildSourceCvPlanFromPersistence(
          orchestratorInput(persistence, value),
        ),
      ).rejects.toThrow(/canonical Job Brief.*parsed.*ready/i);

      expect(
        operations.some(
          (operation) =>
            operation.operation === "listSourceDocumentsForCanonicalCv",
        ),
      ).toBe(false);
      expect(JSON.stringify(value)).toBe(beforeFixture);
    },
  );

  it.each(["pending", "needs_review"] as const)(
    "rejects canonical Job Brief review state %s before reconstruction or evidence reads",
    async (reviewState) => {
      const value = await fixture({ currentJobReviewState: reviewState });
      const beforeFixture = JSON.stringify(value);
      const { operations, persistence } = makePersistence(value);

      await expect(
        buildSourceCvPlanFromPersistence(
          orchestratorInput(persistence, value),
        ),
      ).rejects.toThrow(/canonical Job Brief.*parsed.*ready/i);

      expect(
        operations.some(
          (operation) =>
            operation.operation === "listSourceDocumentsForCanonicalCv",
        ),
      ).toBe(false);
      expect(JSON.stringify(value)).toBe(beforeFixture);
    },
  );

  it("rejects stale CV and job contexts before selecting candidate evidence", async () => {
    for (const value of [
      await fixture({
        contextCv: sourceCv(),
        currentCv: sourceCv("Changed customer support"),
      }),
      await fixture({
        currentJobDescription: "A materially changed job description.",
      }),
      await fixture({
        currentMustHaves: ["Customer service", "Weekend availability"],
      }),
    ]) {
      const beforeCv = JSON.stringify(value.currentCv);
      const { operations, persistence } = makePersistence(value);

      await expect(
        buildSourceCvPlanFromPersistence(
          orchestratorInput(persistence, value),
        ),
      ).rejects.toThrow(/stale/);

      expect(
        operations.some(
          (operation) =>
            operation.operation === "listSourceDocumentsForCanonicalCv",
        ),
      ).toBe(false);
      expect(JSON.stringify(value.currentCv)).toBe(beforeCv);
    }
  });

  it("defensively rejects candidate evidence returned outside user/CV scope", async () => {
    const value = await fixture();
    const crossCvSource = {
      ...value.linkedSource,
      canonicalCvId: "cv-other",
    };
    const leakingValue = { ...value, linkedSource: crossCvSource };
    const { persistence } = makePersistence(leakingValue, {
      leakCandidateEvidenceScope: true,
    });

    await expect(
      buildSourceCvPlanFromPersistence(
        orchestratorInput(persistence, leakingValue),
      ),
    ).rejects.toThrow(/outside the owning user\/CV scope/);
  });
});
