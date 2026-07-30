import { describe, expect, it } from "vitest";

import { buildCandidateCvItemReferences } from "../../src/modules/candidate-evidence/cvItemReferences";
import type { JobDemandV1 } from "../../src/modules/evidence-graph/schema";
import {
  buildSourceCvApplicationComposition,
  type AutoRecommendedSourceCvApplicationCompositionResultV1,
} from "../../src/modules/application-harness/sourceCvApplicationComposition";
import type { ApplicationContextV1 } from "../../src/modules/application-harness/schema";
import type { CvDocument } from "../../src/types/cvDocument";
import type { MutationCtx } from "../_generated/server";
import * as jobsPublic from "../jobsPublic";
import {
  loadPersistedSourceCvPlanReview,
  reviewAndPersistSourceCvPlan,
} from "../lib/sourceCvPlanReviewPersistence";

const INTERNAL_ONLY_SOURCE_CV_PLAN_HANDLERS = [
  "prepareSourceCvVariantPlanForReview",
  "prepareAttachedSourceCvVariantPlanReview",
  "reviewSourceCvVariantPlan",
] as const;
const T = Date.UTC(2026, 6, 29);
const USER_ID = "user-owner";
const JOB_ID = "job-bakery-1";

type StoredRow = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function sourceCv(options: { includeInventorySkill?: boolean } = {}): CvDocument {
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
            responsibilityBullets: ["Customer service"],
          },
        ],
      },
      ...(options.includeInventorySkill
        ? [
            {
              id: "section-skills",
              title: "Skills",
              type: "skills" as const,
              blocks: [],
              structuredContent: [
                {
                  id: "skill-inventory",
                  name: "Inventory",
                  level: "Advanced",
                },
              ],
            },
          ]
        : []),
    ],
  };
}

function applicationContext(): ApplicationContextV1 {
  return {
    id: "application-context:job-source-cv",
    userId: USER_ID,
    job: {
      jobId: JOB_ID,
      rawTextHash: "job-brief-hash",
    },
    candidate: {
      sourceKind: "cv",
      cvId: "cv-source-1",
      candidateHash: "candidate-hash",
    },
    settingsHash: "settings-hash",
    contextHash: "context-hash",
    reviewState: "approved",
    sourceRefs: [
      {
        sourceType: "cv",
        sourceId: "cv-source-1",
        sourceHash: "candidate-hash",
      },
    ],
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
}

function demands(
  options: { includeInventorySkill?: boolean } = {},
): readonly JobDemandV1[] {
  return [
    {
      id: "demand:customer-service",
      kind: "skill",
      label: "Customer service",
      required: "required",
      source: "job",
      sourcePath: "job.mustHaves",
      version: 1,
    },
    ...(options.includeInventorySkill
      ? [
          {
            id: "demand:inventory",
            kind: "skill" as const,
            label: "Inventory",
            required: "preferred" as const,
            source: "job" as const,
            sourcePath: "job.niceToHaves",
            version: 1 as const,
          },
        ]
      : []),
  ];
}

async function compositionFixture(
  options: { includeInventorySkill?: boolean } = {},
): Promise<{
  composition: AutoRecommendedSourceCvApplicationCompositionResultV1;
  context: ApplicationContextV1;
}> {
  const context = applicationContext();
  const document = sourceCv(options);
  const references = buildCandidateCvItemReferences(document);
  const composition = await buildSourceCvApplicationComposition({
    mode: "auto_recommended",
    callerUserId: USER_ID,
    applicationContext: context,
    sourceCv: document,
    sourceDocumentId: "candidate-source-document:source-cv-1",
    demands: demands(options),
    authorizedCvItemReferenceIds: references.map((reference) => reference.id),
    careerKnowledgeRules: [],
    createdAt: T,
    updatedAt: T,
  });
  if (composition.mode !== "auto_recommended") {
    throw new Error("Expected automatic source CV composition");
  }
  return { composition, context };
}

function readPath(row: StoredRow, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }, row);
}

function makeDatabase(context: ApplicationContextV1): {
  db: MutationCtx["db"];
  artifacts: StoredRow[];
  writes: string[];
} {
  const artifacts: StoredRow[] = [];
  const writes: string[] = [];
  const tables: Record<string, StoredRow[]> = {
    applicationContexts: [
      {
        ...context,
        _id: "application-context-storage",
        _creationTime: T,
      },
    ],
    applicationArtifacts: artifacts,
  };
  const database = {
    query(table: string) {
      return {
        withIndex(
          _indexName: string,
          buildIndex: (q: {
            eq(field: string, value: unknown): unknown;
          }) => unknown,
        ) {
          const scope: Record<string, unknown> = {};
          const q = {
            eq(field: string, value: unknown) {
              scope[field] = value;
              return q;
            },
          };
          buildIndex(q);
          const rows = (tables[table] ?? []).filter((row) =>
            Object.entries(scope).every(
              ([field, value]) => readPath(row, field) === value,
            ),
          );
          return {
            unique: async () => {
              if (rows.length > 1) {
                throw new Error(`Expected unique ${table} row`);
              }
              return rows[0] ?? null;
            },
          };
        },
      };
    },
    async insert(table: string, value: Record<string, unknown>) {
      const rows = tables[table] ?? (tables[table] = []);
      const id = `${table}-storage-${rows.length + 1}`;
      rows.push({ ...value, _id: id, _creationTime: T });
      writes.push(`insert:${table}`);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const [table, rows] of Object.entries(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...value };
          writes.push(`patch:${table}`);
          return;
        }
      }
      throw new Error(`Missing row to patch: ${id}`);
    },
  };

  return {
    db: database as unknown as MutationCtx["db"],
    artifacts,
    writes,
  };
}

describe("persisted source CV plan review wiring", () => {
  it.each(INTERNAL_ONLY_SOURCE_CV_PLAN_HANDLERS)(
    "does not publicly export %s",
    (handlerName) => {
      expect(jobsPublic).not.toHaveProperty(handlerName);
    },
  );

  it.each(["accepted", "rejected"] as const)(
    "persists a pending-to-%s decision and reloads the reviewed internal plan",
    async (reviewState) => {
      const { composition, context } = await compositionFixture();
      const compositionBefore = structuredClone(composition);
      const { db, artifacts, writes } = makeDatabase(context);
      const selectedItem = composition.plan.items[0];

      expect(selectedItem?.reviewState).toBe("pending");
      await expect(
        loadPersistedSourceCvPlanReview(db, composition, JOB_ID),
      ).resolves.toBe(composition);

      const reviewed = await reviewAndPersistSourceCvPlan({
        db,
        composition,
        requestedJobId: JOB_ID,
        expectedPlanId: composition.plan.id,
        decisions: [
          {
            planItemId: selectedItem.id,
            reviewState,
          },
        ],
        updatedAt: T + 100,
      });

      expect(reviewed.plan.id).not.toBe(composition.plan.id);
      expect(reviewed.plan.items[0]?.reviewState).toBe(reviewState);
      expect(writes).toEqual(["insert:applicationArtifacts"]);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.userId).toBe(USER_ID);
      expect(artifacts[0]?.contextId).toBe(context.id);
      expect(artifacts[0]?.provenance).toMatchObject({
        jobId: JOB_ID,
        cvId: composition.sourceCvId,
      });

      const resumed = await loadPersistedSourceCvPlanReview(
        db,
        composition,
        JOB_ID,
      );
      expect(resumed.plan).toEqual(reviewed.plan);
      expect(composition).toEqual(compositionBefore);
    },
  );

  it("treats an equivalent stale replay as desired-state idempotent without another write", async () => {
    const { composition, context } = await compositionFixture();
    const { db, writes } = makeDatabase(context);
    const selectedItem = composition.plan.items[0];
    const decision = {
      planItemId: selectedItem.id,
      reviewState: "accepted" as const,
    };

    const reviewed = await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: composition.plan.id,
      decisions: [decision],
      updatedAt: T + 100,
    });
    const writesAfterFirstReview = [...writes];

    const replayed = await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: composition.plan.id,
      decisions: [decision],
      updatedAt: T + 200,
    });

    expect(replayed).toEqual(reviewed);
    expect(writes).toEqual(writesAfterFirstReview);
  });

  it("applies pending decisions from a cumulative submission while treating matching reviewed decisions as no-ops", async () => {
    const { composition, context } = await compositionFixture({
      includeInventorySkill: true,
    });
    const { db, writes } = makeDatabase(context);
    const [firstItem, secondItem] = composition.plan.items;
    if (!firstItem || !secondItem) {
      throw new Error("Expected two selectable source CV plan items");
    }

    const firstReview = await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: composition.plan.id,
      decisions: [
        {
          planItemId: firstItem.id,
          reviewState: "accepted",
        },
      ],
      updatedAt: T + 100,
    });
    const writesAfterFirstReview = [...writes];

    const cumulativeReview = await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: firstReview.plan.id,
      decisions: [
        {
          planItemId: firstItem.id,
          reviewState: "accepted",
        },
        {
          planItemId: secondItem.id,
          reviewState: "accepted",
        },
      ],
      updatedAt: T + 200,
    });

    expect(cumulativeReview.plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstItem.id,
          reviewState: "accepted",
        }),
        expect.objectContaining({
          id: secondItem.id,
          reviewState: "accepted",
        }),
      ]),
    );
    expect(writes).toEqual([
      ...writesAfterFirstReview,
      "patch:applicationArtifacts",
    ]);
  });

  it("fails closed when a cumulative submission conflicts with an already reviewed decision", async () => {
    const { composition, context } = await compositionFixture({
      includeInventorySkill: true,
    });
    const { db, writes } = makeDatabase(context);
    const [firstItem, secondItem] = composition.plan.items;
    if (!firstItem || !secondItem) {
      throw new Error("Expected two selectable source CV plan items");
    }

    const firstReview = await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: composition.plan.id,
      decisions: [
        {
          planItemId: firstItem.id,
          reviewState: "accepted",
        },
      ],
      updatedAt: T + 100,
    });
    const writesAfterFirstReview = [...writes];

    await expect(
      reviewAndPersistSourceCvPlan({
        db,
        composition,
        requestedJobId: JOB_ID,
        expectedPlanId: firstReview.plan.id,
        decisions: [
          {
            planItemId: firstItem.id,
            reviewState: "rejected",
          },
          {
            planItemId: secondItem.id,
            reviewState: "accepted",
          },
        ],
        updatedAt: T + 200,
      }),
    ).rejects.toThrow(/not selectable/);
    expect(writes).toEqual(writesAfterFirstReview);
  });

  it("fails closed on a conflicting stale replay without another write", async () => {
    const { composition, context } = await compositionFixture();
    const { db, writes } = makeDatabase(context);
    const selectedItem = composition.plan.items[0];

    await reviewAndPersistSourceCvPlan({
      db,
      composition,
      requestedJobId: JOB_ID,
      expectedPlanId: composition.plan.id,
      decisions: [
        {
          planItemId: selectedItem.id,
          reviewState: "accepted",
        },
      ],
      updatedAt: T + 100,
    });
    const writesAfterFirstReview = [...writes];

    await expect(
      reviewAndPersistSourceCvPlan({
        db,
        composition,
        requestedJobId: JOB_ID,
        expectedPlanId: composition.plan.id,
        decisions: [
          {
            planItemId: selectedItem.id,
            reviewState: "rejected",
          },
        ],
        updatedAt: T + 200,
      }),
    ).rejects.toThrow(/stale ResumeVariantPlan review/);
    expect(writes).toEqual(writesAfterFirstReview);
  });

  it("fails closed on a mismatched review context without persisting an artifact", async () => {
    const { composition, context } = await compositionFixture();
    const mismatchedContext = {
      ...context,
      job: {
        ...context.job,
        jobId: "job-other",
      },
    };
    const { db, artifacts, writes } = makeDatabase(mismatchedContext);

    await expect(
      loadPersistedSourceCvPlanReview(db, composition, JOB_ID),
    ).rejects.toThrow(/context does not match the current composition/);
    await expect(
      reviewAndPersistSourceCvPlan({
        db,
        composition,
        requestedJobId: JOB_ID,
        expectedPlanId: composition.plan.id,
        decisions: [
          {
            planItemId: composition.plan.items[0].id,
            reviewState: "accepted",
          },
        ],
        updatedAt: T + 100,
      }),
    ).rejects.toThrow(/context does not match the current composition/);

    expect(artifacts).toEqual([]);
    expect(writes).toEqual([]);
  });
});
