import { describe, expect, it } from "vitest";

type Row = Record<string, any> & { _id: string; _creationTime: number };

class CatalogMemoryDb {
  readonly tables = new Map<string, Row[]>();
  readonly pageSizes: Array<{ table: string; size: number }> = [];
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
        };
        buildIndex(q);
        let rows = [...(db.tables.get(table) ?? [])].filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
        rows.sort((left, right) => left._creationTime - right._creationTime);
        if (indexName === "by_owner_primary") {
          rows.sort((left, right) =>
            left.updatedAt - right.updatedAt ||
            left.profileCreatedAt - right.profileCreatedAt ||
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
});
