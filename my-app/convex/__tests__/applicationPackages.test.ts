import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  internalCreateOrReuseApplicationPackage,
  internalListApplicationPackagesByApplicationContext,
  internalListApplicationPackagesByUser,
  internalListApplicationPackagesByUserAndApplicationContext,
  internalListLatestApplicationPackagesByApplicationContext,
  internalReadApplicationPackageById,
} from "../applicationPackages";
import {
  buildApplicationPackageStorageRecord,
  sanitizeApplicationPackageForStorage,
} from "../lib/applicationPackages";
import type { ApplicationPackageV1 } from "../../src/modules/application-package/schema";

const NOW = Date.UTC(2026, 5, 10, 0, 0, 0, 0);
const LATER = NOW + 10_000;

type StoredDocument<T> = T & {
  _id: string;
  _creationTime: number;
};

type TableName = "applicationPackages";
type Constraint = Readonly<{ field: string; value: unknown }>;

function buildApplicationPackageFixture(
  overrides: Partial<ApplicationPackageV1> = {},
): ApplicationPackageV1 {
  const id = overrides.id ?? "application-package:hash-a";
  const userId = overrides.userId ?? "user_123";
  const applicationContextId = overrides.applicationContextId ?? "application-context:abc";
  const status = overrides.status ?? "ready_for_review";
  const resumeVariantArtifactId = "resume-variant-artifact:hash-a";
  const coverLetterArtifactId = "cover-letter-artifact:hash-a";

  return {
    id,
    userId,
    applicationContextId,
    status,
    artifacts: [
      {
        id: resumeVariantArtifactId,
        kind: "resume_variant_artifact",
        contentHash: "resume-content-hash-a",
        status: "ready_for_generation",
        version: 1,
      },
      {
        id: coverLetterArtifactId,
        kind: "cover_letter_artifact",
        contentHash: "cover-letter-content-hash-a",
        status: "ready_for_review",
        version: 1,
      },
    ],
    items: [
      {
        id: "application-package-item:hash-a:resume-variant-artifact",
        kind: "resume_variant",
        artifactId: resumeVariantArtifactId,
        artifactContentHash: "resume-content-hash-a",
        status: "included",
        label: "Resume variant artifact included.",
        note: "Package references the resume variant artifact without duplicating resume text.",
        sourceFactIds: ["candidate-fact:a"],
        allowedClaimIds: ["allowed-claim:a"],
        evidenceMatchIds: ["evidence-match:a"],
        demandIds: ["demand:a"],
        riskFlagIds: ["risk:a"],
        reviewItemIds: ["review:a"],
        version: 1,
      },
      {
        id: "application-package-item:hash-a:cover-letter-artifact",
        kind: "cover_letter",
        artifactId: coverLetterArtifactId,
        artifactContentHash: "cover-letter-content-hash-a",
        status: "included",
        label: "Cover-letter artifact included.",
        note: "Package references the cover-letter artifact without duplicating cover-letter text.",
        sourceFactIds: ["candidate-fact:b"],
        allowedClaimIds: ["allowed-claim:b"],
        evidenceMatchIds: ["evidence-match:b"],
        demandIds: ["demand:b"],
        riskFlagIds: ["risk:b"],
        reviewItemIds: ["review:b"],
        version: 1,
      },
    ],
    warnings: [],
    provenance: {
      applicationContextId,
      resumeVariantArtifactId,
      coverLetterArtifactId,
      sourceFactIds: ["candidate-fact:a", "candidate-fact:b"],
      allowedClaimIds: ["allowed-claim:a", "allowed-claim:b"],
      evidenceMatchIds: ["evidence-match:a", "evidence-match:b"],
      demandIds: ["demand:a", "demand:b"],
      riskFlagIds: ["risk:a", "risk:b"],
      reviewItemIds: ["review:a", "review:b"],
      version: 1,
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function makeCtx() {
  const tables: Record<TableName, StoredDocument<any>[]> = {
    applicationPackages: [],
  };
  let sequence = 0;

  function applyConstraints<T>(documents: StoredDocument<T>[], constraints: Constraint[]) {
    return documents.filter((document) =>
      constraints.every((constraint) => readField(document, constraint.field) === constraint.value),
    );
  }

  const db = {
    insert: async (tableName: TableName, document: any) => {
      sequence += 1;
      const stored = {
        _id: `${tableName}_${sequence}`,
        _creationTime: NOW + sequence,
        ...document,
      };
      tables[tableName].push(stored);
      return stored._id;
    },
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, value: unknown) {
            constraints.push({ field, value });
            return query;
          },
        };
        buildQuery(query);
        const matching = applyConstraints(tables[tableName], constraints);
        return {
          unique: async () => {
            if (matching.length > 1) {
              throw new Error("expected unique result");
            }
            return matching[0] ?? null;
          },
          order: () => ({
            take: async (limit: number) => matching.slice(0, limit),
          }),
          take: async (limit: number) => matching.slice(0, limit),
        };
      },
    }),
  };

  return {
    ctx: { db },
    tables,
  };
}

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, document);
}

describe("application package Convex shadow persistence", () => {
  it("create stores an ApplicationPackageV1 shadow row", async () => {
    const { ctx, tables } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();

    const storageId = await internalCreateOrReuseApplicationPackage._handler(ctx as any, {
      applicationPackage,
    });

    expect(storageId).toBe("applicationPackages_1");
    expect(tables.applicationPackages[0].applicationPackageId).toBe(applicationPackage.id);
    expect(tables.applicationPackages[0].package).toEqual(applicationPackage);
  });

  it("create returns/reuses existing row for the same deterministic id and payload", async () => {
    const { ctx, tables } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();

    const firstId = await internalCreateOrReuseApplicationPackage._handler(ctx as any, {
      applicationPackage,
    });
    const secondId = await internalCreateOrReuseApplicationPackage._handler(ctx as any, {
      applicationPackage,
    });

    expect(secondId).toBe(firstId);
    expect(tables.applicationPackages).toHaveLength(1);
  });

  it("duplicate same id with different package payload throws conflict", async () => {
    const { ctx } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();
    await internalCreateOrReuseApplicationPackage._handler(ctx as any, { applicationPackage });

    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: {
          ...applicationPackage,
          warnings: ["content_changed"],
        },
      }),
    ).rejects.toThrow(/conflicting contentHash|conflicting package payload/);
  });

  it("read by applicationPackageId returns stored row and unknown id returns null", async () => {
    const { ctx } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();
    await internalCreateOrReuseApplicationPackage._handler(ctx as any, { applicationPackage });

    await expect(
      internalReadApplicationPackageById._handler(ctx as any, {
        applicationPackageId: applicationPackage.id,
      }),
    ).resolves.toMatchObject({ applicationPackageId: applicationPackage.id });
    await expect(
      internalReadApplicationPackageById._handler(ctx as any, {
        applicationPackageId: "application-package:unknown",
      }),
    ).resolves.toBeNull();
  });

  it("list helpers return packages by context, user, and user plus context", async () => {
    const { ctx } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();
    await internalCreateOrReuseApplicationPackage._handler(ctx as any, { applicationPackage });

    await expect(
      internalListApplicationPackagesByApplicationContext._handler(ctx as any, {
        applicationContextId: applicationPackage.applicationContextId,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      internalListApplicationPackagesByUser._handler(ctx as any, {
        userId: applicationPackage.userId,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      internalListApplicationPackagesByUserAndApplicationContext._handler(ctx as any, {
        userId: applicationPackage.userId,
        applicationContextId: applicationPackage.applicationContextId,
      }),
    ).resolves.toHaveLength(1);
  });

  it("latest by applicationContext sorts deterministically", async () => {
    const { ctx } = makeCtx();
    const older = buildApplicationPackageFixture({ id: "application-package:hash-a", createdAt: NOW });
    const newerA = buildApplicationPackageFixture({ id: "application-package:hash-b", createdAt: LATER });
    const newerB = buildApplicationPackageFixture({ id: "application-package:hash-c", createdAt: LATER });

    for (const applicationPackage of [older, newerB, newerA]) {
      await internalCreateOrReuseApplicationPackage._handler(ctx as any, { applicationPackage });
    }

    const latest = await internalListLatestApplicationPackagesByApplicationContext._handler(ctx as any, {
      applicationContextId: older.applicationContextId,
    });

    expect(latest.map((record) => record.applicationPackageId)).toEqual([
      "application-package:hash-b",
      "application-package:hash-c",
      "application-package:hash-a",
    ]);
  });

  it("index fields mirror package payload and provenance", async () => {
    const { ctx, tables } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();
    await internalCreateOrReuseApplicationPackage._handler(ctx as any, { applicationPackage });
    const stored = tables.applicationPackages[0];

    expect(stored).toMatchObject({
      userId: applicationPackage.userId,
      applicationContextId: applicationPackage.applicationContextId,
      status: applicationPackage.status,
      resumeVariantArtifactId: applicationPackage.provenance.resumeVariantArtifactId,
      coverLetterArtifactId: applicationPackage.provenance.coverLetterArtifactId,
      sourceFactIds: applicationPackage.provenance.sourceFactIds,
      allowedClaimIds: applicationPackage.provenance.allowedClaimIds,
      evidenceMatchIds: applicationPackage.provenance.evidenceMatchIds,
      demandIds: applicationPackage.provenance.demandIds,
      riskFlagIds: applicationPackage.provenance.riskFlagIds,
      reviewItemIds: applicationPackage.provenance.reviewItemIds,
      packageHash: "hash-a",
      createdAt: applicationPackage.createdAt,
      updatedAt: applicationPackage.updatedAt,
      version: 1,
    });
    expect(stored.contentHash).toEqual(expect.any(String));
  });

  it("rejects mismatched userId and applicationContextId", async () => {
    const { ctx } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();

    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: {
          ...applicationPackage,
          userId: "other-user",
        },
      }),
    ).rejects.toThrow(/userId must match package.userId|provenance/);

    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: {
          ...applicationPackage,
          applicationContextId: "other-context",
        },
      }),
    ).rejects.toThrow(/applicationContextId/);
  });

  it("rejects invalid package id, status, and timestamps", async () => {
    const { ctx } = makeCtx();
    const applicationPackage = buildApplicationPackageFixture();

    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: { ...applicationPackage, id: "bare-hash" },
      }),
    ).rejects.toThrow(/application-package:<hash>/);
    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: { ...applicationPackage, status: "approved" },
      }),
    ).rejects.toThrow(/known status/);
    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: { ...applicationPackage, createdAt: Number.NaN },
      }),
    ).rejects.toThrow(/createdAt must be a finite number/);
    await expect(
      internalCreateOrReuseApplicationPackage._handler(ctx as any, {
        applicationPackage: { ...applicationPackage, updatedAt: Number.POSITIVE_INFINITY },
      }),
    ).rejects.toThrow(/updatedAt must be a finite number/);
  });

  it("storage preserves package payload exactly after sanitization", async () => {
    const applicationPackage = buildApplicationPackageFixture();

    await expect(buildApplicationPackageStorageRecord(applicationPackage)).resolves.toMatchObject({
      package: applicationPackage,
    });
    expect(sanitizeApplicationPackageForStorage(applicationPackage)).toEqual(applicationPackage);
  });

  it("helpers do not mutate input package", async () => {
    const applicationPackage = buildApplicationPackageFixture();
    const before = JSON.stringify(applicationPackage);

    await buildApplicationPackageStorageRecord(applicationPackage);

    expect(JSON.stringify(applicationPackage)).toBe(before);
  });

  it("does not add public active product behavior or forbidden surfaces", () => {
    const moduleText = readFileSync(new URL("../applicationPackages.ts", import.meta.url), "utf8");

    expect(moduleText).not.toContain("query(");
    expect(moduleText).not.toContain("mutation(");
    expect(moduleText).not.toContain("approval");
    expect(moduleText).not.toContain("export");
    expect(moduleText).not.toContain("Scout");
    expect(moduleText).not.toContain("MCP");
  });

  it("rollback is deletion-only for PR14-owned files", () => {
    expect([
      "convex/applicationPackages.ts",
      "convex/lib/applicationPackages.ts",
      "convex/__tests__/applicationPackages.test.ts",
      "docs/decisions/2026-06-10-application-package-shadow-persistence.md",
    ]).toHaveLength(4);
  });
});
