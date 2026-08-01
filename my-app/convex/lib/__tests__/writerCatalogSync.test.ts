import { describe, expect, it, vi } from "vitest";

import { createOrReuseFromSource } from "../../jobsPublic";
import { upsert } from "../../profiles";

describe("same-transaction catalog writer synchronization", () => {
  it("synchronizes generic Profile creation and Job creation for the authenticated owner", async () => {
    const insertedTables: string[] = [];
    const rows = new Map<string, any>();
    const ownerProfile = {
      _id: "profile_owner",
      _creationTime: 100,
      clerkId: "clerk_owner",
      email: "owner@example.test",
      createdAt: 100,
      updatedAt: 100,
      version: 1,
      preferences: { writingStyle: "professional", tonePreference: "formal", autoSend: false },
    };
    rows.set(ownerProfile._id, ownerProfile);

    const db = {
      normalizeId: (_table: string, id: string) => id,
      get: async (id: string) => rows.get(id) ?? null,
      insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
        insertedTables.push(table);
        const id = table === "userProfiles" ? "profile_created" : table === "jobs" ? "job_created" : `${table}_created`;
        rows.set(id, { _id: id, _creationTime: Date.now(), ...value });
        return id;
      }),
      patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
        rows.set(id, { ...(rows.get(id) ?? { _id: id, _creationTime: 1 }), ...value });
      }),
      query(table: string) {
        if (table === "userProfiles") {
          return {
            withIndex(_index: string, build: (q: any) => unknown) {
              const scope: Record<string, unknown> = {};
              const q = { eq(field: string, value: unknown) { scope[field] = value; return q; } };
              build(q);
              return { collect: async () => scope.clerkId === "clerk_new" ? [] : [ownerProfile] };
            },
          };
        }
        if (table === "activeCvSnapshots") {
          return { withIndex: (_index: string, build: (q: any) => unknown) => {
            const q = { eq() { return q; } }; build(q); return { unique: async () => null };
          } };
        }
        if (table === "jobs") {
          return { withIndex(index: string, build: (q: any) => unknown) {
            const q = { eq() { return q; } }; build(q);
            if (index === "by_user_updated") return { order: () => ({ collect: async () => [] }) };
            return { first: async () => null };
          } };
        }
        if (table === "profileCatalog" || table === "jobCatalog" || table === "catalogBackfillStates") {
          return { withIndex: (_index: string, build: (q: any) => unknown) => {
            const q = { eq() { return q; } }; build(q); return { unique: async () => null };
          } };
        }
        throw new Error(`Unexpected table ${table}`);
      },
      delete: vi.fn(async () => null),
    };

    await upsert._handler(
      {
        auth: { getUserIdentity: async () => ({ subject: "clerk_new", email: "new@example.test" }) },
        db,
      } as any,
      { preferences: { writingStyle: "professional", tonePreference: "formal", autoSend: false } },
    );

    await createOrReuseFromSource._handler(
      {
        auth: { getUserIdentity: async () => ({ subject: "clerk_owner", email: "owner@example.test" }) },
        db,
        scheduler: { runAfter: vi.fn(async () => null) },
      } as any,
      {
        title: "Role",
        rawDescription: "",
        sourceUrl: "https://example.test/jobs/role",
        sourceType: "manual",
      },
    );

    expect(insertedTables).toContain("profileCatalog");
    expect(insertedTables).toContain("jobCatalog");
  });
});
