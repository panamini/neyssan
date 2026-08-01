import { describe, expect, it } from "vitest";

function indexedRows(rows: Array<Record<string, unknown>>) {
  return {
    withIndex(_indexName: string, buildIndex: (q: any) => unknown) {
      const filters: Array<[string, unknown]> = [];
      const q = {
        eq(field: string, value: unknown) {
          filters.push([field, value]);
          return q;
        },
      };
      buildIndex(q);
      const filtered = rows.filter((row) =>
        filters.every(([field, value]) => row[field] === value),
      );
      return {
        order(direction: "asc" | "desc") {
          const ordered = [...filtered].sort(
            (left, right) => Number(left.updatedAt ?? 0) - Number(right.updatedAt ?? 0),
          );
          if (direction === "desc") ordered.reverse();
          return {
            take: async (limit: number) => ordered.slice(0, limit),
          };
        },
      };
    },
  };
}

describe("bounded catalog summary reads", () => {
  it("returns at most 36 lightweight rows while heavy 500 Job / 100 CV fixtures remain untouched", async () => {
    const { listJobSummaries, listProfileSummaries } = await import("../../catalogsPublic");
    const touchedTables: string[] = [];
    const heavyProfiles = Array.from({ length: 100 }, (_, index) => ({
      _id: `profile_${index}`,
      clerkId: "clerk_owner",
      cvDocument: { sections: [{ text: "profile payload ".repeat(2_000) }] },
    }));
    const heavyJobs = Array.from({ length: 500 }, (_, index) => ({
      _id: `job_${index}`,
      userId: `profile_${index % 100}`,
      rawDescription: "job payload ".repeat(2_000),
      reviewItems: Array.from({ length: 20 }, () => ({ payload: "heavy" })),
    }));
    const heavyProposals = Array.from({ length: 200 }, (_, index) => ({
      _id: `proposal_${index}`,
      jobId: `job_${index % heavyJobs.length}`,
      content: "proposal payload ".repeat(2_000),
    }));
    const profileCatalog = heavyProfiles.map((profile, index) => ({
      _id: `profile_catalog_${index}`,
      profileId: profile._id,
      ownerClerkId: "clerk_owner",
      externalProfileId: `cv_${index}`,
      label: `CV ${index}`,
      updatedAt: index,
      profileCreatedAt: index,
      profileIdString: profile._id,
      version: 1,
    }));
    const jobCatalog = heavyJobs.map((job, index) => ({
      _id: `job_catalog_${index}`,
      jobId: job._id,
      profileId: job.userId,
      ownerClerkId: "clerk_owner",
      title: `Role ${index}`,
      company: "Acme",
      location: "Remote",
      isFavorite: false,
      isSample: false,
      archived: false,
      importedAt: index,
      updatedAt: index,
      lastOpenedAt: index,
      version: 1,
    }));
    const storage = new Map<string, Array<Record<string, unknown>>>([
      ["userProfiles", heavyProfiles],
      ["jobs", heavyJobs],
      ["proposals", heavyProposals],
      ["profileCatalog", profileCatalog],
      ["jobCatalog", jobCatalog],
    ]);

    const ctx = {
      auth: { getUserIdentity: async () => ({ subject: "clerk_owner" }) },
      db: {
        query(table: string) {
          touchedTables.push(table);
          if (table === "profileCatalog" || table === "jobCatalog") {
            return indexedRows(storage.get(table) ?? []);
          }
          throw new Error(`Source payload table touched: ${table}`);
        },
      },
    } as any;

    const profiles = await listProfileSummaries._handler(ctx, { limit: 500 });
    const jobs = await listJobSummaries._handler(ctx, { limit: 500, archived: false });

    expect(profiles).toHaveLength(36);
    expect(jobs).toHaveLength(36);
    expect(touchedTables).toEqual(["profileCatalog", "jobCatalog"]);
    expect(profiles.every((row: any) => row.cvDocument === undefined)).toBe(true);
    expect(jobs.every((row: any) => row.rawDescription === undefined)).toBe(true);
  });
});
