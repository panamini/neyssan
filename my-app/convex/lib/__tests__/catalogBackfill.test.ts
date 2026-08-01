import { describe, expect, it } from "vitest";

type Row = Record<string, any> & { _id: string; _creationTime: number };

class CatalogMemoryDb {
  readonly tables = new Map<string, Row[]>();
  readonly pageSizes: Array<{ table: string; size: number }> = [];
  readonly deleteCalls: string[] = [];
  private nextId = 1;

  constructor(seed: Record<string, Row[]>) {
    for (const [table, rows] of Object.entries(seed)) {
      this.tables.set(table, rows.map((row) => ({ ...row })));
    }
  }

  async get(id: string) {
    for (const rows of this.tables.values()) {
      const found = rows.find((row) => row._id === id);
      if (found) return found;
    }
    return null;
  }

  async insert(table: string, value: Record<string, unknown>) {
    const id = `${table}_${this.nextId++}`;
    const rows = this.tables.get(table) ?? [];
    rows.push({ _id: id, _creationTime: this.nextId, ...value });
    this.tables.set(table, rows);
    return id;
  }

  async patch(id: string, value: Record<string, unknown>) {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, value);
        return;
      }
    }
    throw new Error(`Missing row ${id}`);
  }

  async delete(id: string) {
    this.deleteCalls.push(id);
    for (const [table, rows] of this.tables) {
      const next = rows.filter((row) => row._id !== id);
      if (next.length !== rows.length) {
        this.tables.set(table, next);
        return;
      }
    }
  }

  query(table: string) {
    const db = this;
    return {
      withIndex(indexName: string, buildIndex: (q: any) => unknown) {
        const filters: Array<[string, unknown]> = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push([field, value]);
            return q;
          },
          gt(field: string, value: unknown) {
            filters.push([`gt:${field}`, value]);
            return q;
          },
        };
        buildIndex(q);
        let rows = [...(db.tables.get(table) ?? [])].filter((row) =>
          filters.every(([field, value]) =>
            field.startsWith("gt:")
              ? row[field.slice(3)] > value
              : row[field] === value,
          ),
        );
        rows.sort((left, right) => left._creationTime - right._creationTime);
        if (indexName === "by_owner_primary") {
          rows.sort((left, right) =>
            left.updatedAt - right.updatedAt ||
            left.profileCreatedAt - right.profileCreatedAt ||
            String(left.profileIdString).localeCompare(String(right.profileIdString)),
          );
        }
        if (indexName === "by_owner_profile_id") {
          rows.sort((left, right) =>
            String(left.profileIdString).localeCompare(String(right.profileIdString)),
          );
        }
        const chain: any = {
          order(direction: "asc" | "desc") {
            if (direction === "desc") rows.reverse();
            return chain;
          },
          async unique() {
            if (rows.length > 1) throw new Error(`Expected unique ${table}.${indexName}`);
            return rows[0] ?? null;
          },
          async first() {
            return rows[0] ?? null;
          },
          async take(limit: number) {
            db.pageSizes.push({ table, size: limit });
            return rows.slice(0, limit);
          },
          async paginate(options: { cursor: string | null; numItems: number }) {
            db.pageSizes.push({ table, size: options.numItems });
            const offset = options.cursor ? Number(options.cursor) : 0;
            const page = rows.slice(offset, offset + options.numItems);
            const nextOffset = offset + page.length;
            return {
              page,
              isDone: nextOffset >= rows.length,
              continueCursor: String(nextOffset),
            };
          },
        };
        return chain;
      },
    };
  }
}

describe("finite catalog compatibility materialization", () => {
  it("does not invalidate ready materialization for an unchanged Profile but does for membership removal", async () => {
    const { ensureCatalogsForOwnerPage } = await import("../../catalogsPublic");
    const { syncProfileCatalogById } = await import("../profileCatalog");
    const profile = {
      _id: "profile_stable",
      _creationTime: 1,
      profileId: "cv_stable",
      clerkId: "clerk_owner",
      email: "owner@example.test",
      createdAt: 1,
      updatedAt: 10,
      version: 1,
    };
    const db = new CatalogMemoryDb({
      userProfiles: [profile],
      jobs: [],
      profileCatalog: [
        {
          _id: "profile_catalog_stable",
          _creationTime: 2,
          profileId: "profile_stable",
          profileIdString: "profile_stable",
          externalProfileId: "cv_stable",
          ownerClerkId: "clerk_owner",
          label: "cv_stable",
          updatedAt: 10,
          profileCreatedAt: 1,
          version: 1,
        },
      ],
      jobCatalog: [],
      catalogBackfillStates: [
        {
          _id: "catalog_state_stable",
          _creationTime: 3,
          ownerClerkId: "clerk_owner",
          status: "ready",
          phase: "ready",
          jobsTraversalVersion: 1,
          revision: 4,
          scanRevision: 4,
          updatedAt: 3,
          version: 1,
        },
      ],
    });
    const ctx = { db } as any;

    await syncProfileCatalogById(ctx, "profile_stable" as any);
    expect(db.tables.get("catalogBackfillStates")?.[0]?.revision).toBe(4);
    await expect(
      ensureCatalogsForOwnerPage(ctx, "clerk_owner"),
    ).resolves.toMatchObject({ status: "ready", processed: 0 });

    await db.patch("profile_stable", {
      profileId: "source-cv-variant:v1:job_1:cv_stable",
    });
    await syncProfileCatalogById(ctx, "profile_stable" as any);
    expect(db.tables.get("profileCatalog")).toHaveLength(0);
    expect(db.tables.get("catalogBackfillStates")?.[0]?.revision).toBe(5);
  });

  it("resumes after a ready owner claims a legacy Profile with existing Jobs", async () => {
    const { ensureCatalogsForOwnerPage } = await import("../../catalogsPublic");
    const { syncProfileCatalogById } = await import("../profileCatalog");
    const db = new CatalogMemoryDb({
      userProfiles: [
        {
          _id: "profile_claimed",
          _creationTime: 1,
          profileId: "cv_claimed",
          updatedAt: 1,
        },
      ],
      jobs: [
        {
          _id: "job_claimed",
          _creationTime: 2,
          userId: "profile_claimed",
          createdAt: 2,
          updatedAt: 2,
          title: "Legacy role",
          company: "Acme",
        },
      ],
      profileCatalog: [],
      jobCatalog: [],
      catalogBackfillStates: [
        {
          _id: "catalog_state",
          _creationTime: 3,
          ownerClerkId: "clerk_owner",
          status: "ready",
          phase: "ready",
          revision: 1,
          scanRevision: 1,
          updatedAt: 3,
          version: 1,
        },
      ],
    });
    const ctx = { db } as any;

    await db.patch("profile_claimed", {
      clerkId: "clerk_owner",
      updatedAt: 10,
    });
    await syncProfileCatalogById(ctx, "profile_claimed" as any);

    let result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    expect(result.status).toBe("running");

    let calls = 1;
    while (result.status !== "ready" && calls < 10) {
      result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
      calls += 1;
    }

    expect(result.status).toBe("ready");
    expect(db.tables.get("jobCatalog")).toHaveLength(1);
    expect(db.tables.get("jobCatalog")?.[0]?.jobId).toBe("job_claimed");

    const replay = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    expect(replay.status).toBe("ready");
    expect(db.tables.get("jobCatalog")).toHaveLength(1);
  });

  it("replays old rows idempotently and converges after an interleaved Profile promotion", async () => {
    const { ensureCatalogsForOwnerPage } = await import("../../catalogsPublic");
    const { syncProfileCatalogById } = await import("../profileCatalog");
    const profiles: Row[] = Array.from({ length: 100 }, (_, index) => ({
      _id: `profile_${index}`,
      _creationTime: index + 1,
      clerkId: "clerk_owner",
      profileId: `cv_${index}`,
      email: "owner@example.test",
      createdAt: index + 1,
      updatedAt: index + 1,
      version: 1,
      preferences: { writingStyle: "professional", tonePreference: "formal", autoSend: false },
      cvDocument: { title: `CV ${index}`, sections: [{ text: "heavy ".repeat(1_000) }] },
    }));
    const jobs: Row[] = Array.from({ length: 500 }, (_, index) => ({
      _id: `job_${index}`,
      _creationTime: 100 + index,
      userId: `profile_${index % profiles.length}`,
      createdAt: index,
      importedAt: index,
      updatedAt: index,
      lastOpenedAt: index,
      title: `Role ${index}`,
      company: "Acme",
      location: "Remote",
      sourceUrl: "",
      sourceDomain: "",
      sourceType: "manual",
      parseStatus: "parsed",
      reviewState: "ready",
      status: "active",
      rawDescription: "heavy job ".repeat(1_000),
    }));
    const db = new CatalogMemoryDb({
      userProfiles: profiles,
      jobs,
      profileCatalog: [],
      jobCatalog: [],
      catalogBackfillStates: [],
    });
    const ctx = { db } as any;

    let result: any = { status: "pending" };
    let calls = 0;
    while (result.status !== "ready" && calls < 250) {
      result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
      calls += 1;
      if (calls === 3) {
        await db.patch("profile_0", { updatedAt: 10_000 });
        await syncProfileCatalogById(ctx, "profile_0" as any);
      }
    }

    expect(result.status).toBe("ready");
    expect(calls).toBeLessThan(250);
    expect(db.tables.get("profileCatalog")).toHaveLength(100);
    expect(db.tables.get("jobCatalog")).toHaveLength(500);
    expect(new Set(db.tables.get("profileCatalog")!.map((row) => row.profileId)).size).toBe(100);
    expect(new Set(db.tables.get("jobCatalog")!.map((row) => row.jobId)).size).toBe(500);
    expect(Math.max(...db.pageSizes.map((entry) => entry.size))).toBeLessThanOrEqual(8);

    const replay = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    expect(replay.status).toBe("ready");
    expect(db.tables.get("profileCatalog")).toHaveLength(100);
    expect(db.tables.get("jobCatalog")).toHaveLength(500);
  });

  it("does not skip an unvisited Profile when its display recency changes during the Jobs phase", async () => {
    const { ensureCatalogsForOwnerPage } = await import("../../catalogsPublic");
    const { syncProfileCatalogById } = await import("../profileCatalog");
    const profiles: Row[] = [
      {
        _id: "profile_a",
        _creationTime: 1,
        clerkId: "clerk_owner",
        profileId: "cv_a",
        email: "owner@example.test",
        createdAt: 1,
        updatedAt: 10,
        version: 1,
      },
      {
        _id: "profile_b",
        _creationTime: 2,
        clerkId: "clerk_owner",
        profileId: "cv_b",
        email: "owner@example.test",
        createdAt: 2,
        updatedAt: 20,
        version: 1,
      },
    ];
    const jobs: Row[] = profiles.map((profile, index) => ({
      _id: `job_${index}`,
      _creationTime: 10 + index,
      userId: profile._id,
      createdAt: index,
      importedAt: index,
      updatedAt: index,
      lastOpenedAt: index,
      title: `Role ${index}`,
      company: "Acme",
    }));
    const db = new CatalogMemoryDb({
      userProfiles: profiles,
      jobs,
      profileCatalog: profiles.map((profile, index) => ({
        _id: `catalog_${index}`,
        _creationTime: 20 + index,
        profileId: profile._id,
        profileIdString: profile._id,
        externalProfileId: profile.profileId,
        ownerClerkId: "clerk_owner",
        label: profile.profileId,
        updatedAt: profile.updatedAt,
        profileCreatedAt: profile.createdAt,
        version: 1,
      })),
      jobCatalog: [
        {
          _id: "job_catalog_a",
          _creationTime: 30,
          jobId: "job_0",
          profileId: "profile_a",
          ownerClerkId: "clerk_owner",
        },
      ],
      catalogBackfillStates: [
        {
          _id: "catalog_state",
          _creationTime: 40,
          ownerClerkId: "clerk_owner",
          status: "running",
          phase: "jobs",
          profileCursor: "1",
          jobsTraversalVersion: 1,
          revision: 1,
          scanRevision: 1,
          updatedAt: 40,
          version: 1,
        },
      ],
      accountDeletionStates: [],
    });
    const ctx = { db } as any;

    await db.patch("profile_b", { updatedAt: 5 });
    await syncProfileCatalogById(ctx, "profile_b" as any);

    let result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    for (let calls = 0; result.status !== "ready" && calls < 10; calls += 1) {
      result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    }

    expect(result.status).toBe("ready");
    expect(db.tables.get("jobCatalog")?.map((row) => row.jobId).sort()).toEqual([
      "job_0",
      "job_1",
    ]);
  });

  it("restarts a legacy in-progress Jobs traversal before deriving a stable boundary", async () => {
    const { ensureCatalogsForOwnerPage } = await import("../../catalogsPublic");
    const profiles: Row[] = [
      {
        _id: "profile_a",
        _creationTime: 1,
        clerkId: "clerk_owner",
        profileId: "cv_a",
        createdAt: 1,
        updatedAt: 20,
      },
      {
        _id: "profile_b",
        _creationTime: 2,
        clerkId: "clerk_owner",
        profileId: "cv_b",
        createdAt: 2,
        updatedAt: 10,
      },
    ];
    const db = new CatalogMemoryDb({
      userProfiles: profiles,
      profileCatalog: profiles.map((profile, index) => ({
        _id: `catalog_${index}`,
        _creationTime: 10 + index,
        profileId: profile._id,
        profileIdString: profile._id,
        ownerClerkId: "clerk_owner",
        updatedAt: profile.updatedAt,
        profileCreatedAt: profile.createdAt,
        version: 1,
      })),
      jobs: profiles.map((profile, index) => ({
        _id: `legacy_job_${index}`,
        _creationTime: 20 + index,
        userId: profile._id,
        createdAt: index,
        importedAt: index,
        updatedAt: index,
        lastOpenedAt: index,
        title: `Legacy ${index}`,
        company: "Acme",
      })),
      jobCatalog: [],
      catalogBackfillStates: [
        {
          _id: "legacy_state",
          _creationTime: 30,
          ownerClerkId: "clerk_owner",
          status: "running",
          phase: "jobs",
          profileCursor: "1",
          currentProfileId: "profile_b",
          revision: 1,
          scanRevision: 1,
          updatedAt: 30,
          version: 1,
        },
      ],
      accountDeletionStates: [],
    });
    const ctx = { db } as any;

    let result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    expect(result).toEqual({ status: "running", phase: "jobs", processed: 0 });
    for (let calls = 0; result.status !== "ready" && calls < 10; calls += 1) {
      result = await ensureCatalogsForOwnerPage(ctx, "clerk_owner");
    }

    expect(result.status).toBe("ready");
    expect(db.tables.get("jobCatalog")?.map((row) => row.jobId).sort()).toEqual([
      "legacy_job_0",
      "legacy_job_1",
    ]);
  });

  it("hides summaries immediately and completes account deletion through bounded resumable pages", async () => {
    const { listJobSummaries, listProfileSummaries } = await import(
      "../../catalogsPublic"
    );
    const { createOrUpdateUser, deleteUser } = await import("../../users");
    const profiles: Row[] = Array.from({ length: 10 }, (_, index) => ({
      _id: `profile_${index}`,
      _creationTime: index + 1,
      clerkId: "clerk_deleted",
      profileId: `cv_${index}`,
      email: "deleted@example.test",
      createdAt: index + 1,
      updatedAt: index + 1,
      version: 1,
    }));
    const jobs: Row[] = profiles.flatMap((profile, profileIndex) =>
      Array.from({ length: 2 }, (_, jobIndex) => ({
        _id: `job_${profileIndex}_${jobIndex}`,
        _creationTime: 100 + profileIndex * 2 + jobIndex,
        userId: profile._id,
        createdAt: 1,
        importedAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1,
        title: "Role",
        company: "Acme",
      })),
    );
    const db = new CatalogMemoryDb({
      userProfiles: profiles,
      jobs,
      profileCatalog: profiles.map((profile, index) => ({
        _id: `profile_catalog_${index}`,
        _creationTime: 200 + index,
        profileId: profile._id,
        profileIdString: profile._id,
        ownerClerkId: "clerk_deleted",
        updatedAt: profile.updatedAt,
        profileCreatedAt: profile.createdAt,
        version: 1,
      })),
      jobCatalog: jobs.map((job, index) => ({
        _id: `job_catalog_${index}`,
        _creationTime: 300 + index,
        jobId: job._id,
        profileId: job.userId,
        ownerClerkId: "clerk_deleted",
      })),
      catalogBackfillStates: [
        {
          _id: "catalog_state",
          _creationTime: 400,
          ownerClerkId: "clerk_deleted",
          status: "ready",
          phase: "ready",
          revision: 1,
          scanRevision: 1,
          updatedAt: 400,
          version: 1,
        },
      ],
      accountDeletionStates: [],
    });
    const scheduled: Array<{ clerkId: string }> = [];
    const ctx = {
      auth: { getUserIdentity: async () => ({ subject: "clerk_deleted" }) },
      db,
      scheduler: {
        runAfter: async (
          _delay: number,
          _reference: unknown,
          args: { clerkId: string },
        ) => {
          scheduled.push(args);
        },
      },
    } as any;

    let previousDeleteCount = db.deleteCalls.length;
    await (deleteUser as any)._handler(ctx, { clerkId: "clerk_deleted" });
    expect(db.deleteCalls.length - previousDeleteCount).toBeLessThanOrEqual(8);
    await expect(
      (listProfileSummaries as any)._handler(ctx, {}),
    ).resolves.toEqual([]);
    await expect(
      (listJobSummaries as any)._handler(ctx, {}),
    ).resolves.toEqual([]);

    let invocations = 1;
    while (scheduled.length > 0 && invocations < 100) {
      const args = scheduled.shift()!;
      previousDeleteCount = db.deleteCalls.length;
      await (deleteUser as any)._handler(ctx, args);
      expect(db.deleteCalls.length - previousDeleteCount).toBeLessThanOrEqual(8);
      invocations += 1;
    }

    expect(invocations).toBeLessThan(100);
    expect(scheduled).toHaveLength(0);
    expect(db.tables.get("userProfiles")).toHaveLength(0);
    expect(db.tables.get("jobs")).toHaveLength(0);
    expect(db.tables.get("profileCatalog")).toHaveLength(0);
    expect(db.tables.get("jobCatalog")).toHaveLength(0);
    expect(db.tables.get("catalogBackfillStates")).toHaveLength(0);
    expect(db.tables.get("accountDeletionStates")).toEqual([
      expect.objectContaining({ clerkId: "clerk_deleted", status: "done" }),
    ]);

    await expect(
      (createOrUpdateUser as any)._handler(ctx, {
        clerkId: "clerk_deleted",
        email: "late@example.test",
        name: "Late event",
      }),
    ).resolves.toBeNull();
    expect(db.tables.get("userProfiles")).toHaveLength(0);

    await db.insert("userProfiles", {
      _id: "profile_late",
      clerkId: "clerk_deleted",
      profileId: "cv_late",
      email: "late@example.test",
      createdAt: 500,
      updatedAt: 500,
      version: 1,
    });
    await db.insert("profileCatalog", {
      profileId: "profile_late",
      profileIdString: "profile_late",
      ownerClerkId: "clerk_deleted",
      updatedAt: 500,
      profileCreatedAt: 500,
      version: 1,
    });

    await (deleteUser as any)._handler(ctx, { clerkId: "clerk_deleted" });
    while (scheduled.length > 0 && invocations < 110) {
      const args = scheduled.shift()!;
      await (deleteUser as any)._handler(ctx, args);
      invocations += 1;
    }

    expect(scheduled).toHaveLength(0);
    expect(db.tables.get("userProfiles")).toHaveLength(0);
    expect(db.tables.get("profileCatalog")).toHaveLength(0);
  });

  it("deletes a legacy orphan Job before discarding its last owner projection", async () => {
    const { deleteUser } = await import("../../users");
    const db = new CatalogMemoryDb({
      userProfiles: [
        {
          _id: "foreign_profile",
          _creationTime: 1,
          clerkId: "clerk_foreign",
          profileId: "cv_foreign",
          email: "foreign@example.test",
          createdAt: 1,
          updatedAt: 1,
          version: 1,
        },
      ],
      jobs: [
        {
          _id: "orphan_job",
          _creationTime: 1,
          userId: "missing_profile",
          createdAt: 1,
          importedAt: 1,
          updatedAt: 1,
          lastOpenedAt: 1,
          title: "Orphaned role",
          company: "Acme",
        },
        {
          _id: "foreign_job",
          _creationTime: 2,
          userId: "foreign_profile",
          createdAt: 2,
          importedAt: 2,
          updatedAt: 2,
          lastOpenedAt: 2,
          title: "Foreign role",
          company: "Elsewhere",
        },
      ],
      profileCatalog: [],
      jobCatalog: [
        {
          _id: "orphan_job_catalog",
          _creationTime: 2,
          jobId: "orphan_job",
          profileId: "missing_profile",
          ownerClerkId: "clerk_deleted",
        },
        {
          _id: "stale_foreign_job_catalog",
          _creationTime: 3,
          jobId: "foreign_job",
          profileId: "foreign_profile",
          ownerClerkId: "clerk_deleted",
        },
      ],
      catalogBackfillStates: [],
      accountDeletionStates: [
        {
          _id: "deletion_state",
          _creationTime: 4,
          clerkId: "clerk_deleted",
          status: "done",
          updatedAt: 3,
          version: 1,
        },
      ],
    });
    const scheduled: Array<{ clerkId: string }> = [];
    const ctx = {
      db,
      scheduler: {
        runAfter: async (
          _delay: number,
          _reference: unknown,
          args: { clerkId: string },
        ) => scheduled.push(args),
      },
    } as any;

    let invocations = 0;
    await (deleteUser as any)._handler(ctx, { clerkId: "clerk_deleted" });
    invocations += 1;
    while (scheduled.length > 0 && invocations < 10) {
      await (deleteUser as any)._handler(ctx, scheduled.shift()!);
      invocations += 1;
    }

    expect(invocations).toBeLessThan(10);
    expect(scheduled).toHaveLength(0);
    expect(db.tables.get("jobCatalog")).toHaveLength(0);
    expect(db.tables.get("jobs")?.map((job) => job._id)).toEqual([
      "foreign_job",
    ]);
    expect(db.tables.get("userProfiles")?.map((profile) => profile._id)).toEqual([
      "foreign_profile",
    ]);
    expect(db.tables.get("accountDeletionStates")).toEqual([
      expect.objectContaining({ clerkId: "clerk_deleted", status: "done" }),
    ]);
  });
});
