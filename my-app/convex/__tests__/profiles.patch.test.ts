import { describe, expect, it, vi } from "vitest";

import {
  buildScoringProfileFieldsFromCvDocument,
  patch as patchProfile,
  resolvePatchProfileRow,
} from "../profiles";
import { buildMatchReadProfile, computeMatchRead } from "../lib/jobs/matchRead";

function makeMatchableCvDocument() {
  return {
    id: "cv_content",
    title: "Retail Design Resume",
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "summary",
        title: "Summary",
        type: "summary",
        blocks: [
          {
            id: "summary-block",
            type: "text",
            plainText:
              "Retail design specialist for Miami Design District stores.",
          },
        ],
        structuredContent: [
          {
            summary:
              "Retail design specialist for Miami Design District stores.",
          },
        ],
      },
      {
        id: "skills",
        title: "Skills",
        type: "skills",
        blocks: [],
        structuredContent: [
          { name: "Retail design", level: "Advanced" },
          { name: "Clienteling", level: "Advanced" },
        ],
      },
      {
        id: "experience",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            company: "Studio Store",
            position: "Store Designer",
            startDate: "2023",
            responsibilities:
              "Built part-time luxury retail displays and compensation dashboards.",
          },
        ],
      },
    ],
  };
}

function makePatchCtx(rows: any[]) {
  const insert = vi.fn(async (_table: string, doc: any) => {
    return doc.profileId;
  });
  const patch = vi.fn(async () => null);

  return {
    auth: {
      getUserIdentity: async () => ({
        subject: "clerk_123",
        email: "candidate@example.com",
        name: "Candidate",
      }),
    },
    db: {
      insert,
      patch,
      query(table: string) {
        expect(table).toBe("userProfiles");
        return {
          withIndex(_indexName: string, buildIndex: any) {
            const scope = {
              eq(_field: string, value: string) {
                return value;
              },
            };
            const profileId = buildIndex(scope);
            return {
              collect: async () =>
                rows.filter((row) => row.profileId === profileId),
            };
          },
        };
      },
    },
  };
}

describe("resolvePatchProfileRow", () => {
  it("prefers the caller-owned row when multiple rows share a profileId", () => {
    const owned = { clerkId: "clerk_123", marker: "owned" };
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(
      resolvePatchProfileRow([foreign, owned], "clerk_123"),
    ).toEqual(owned);
  });

  it("falls back to an unclaimed row when no owned row exists", () => {
    const unclaimed = { clerkId: undefined, marker: "unclaimed" };
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(
      resolvePatchProfileRow([foreign, unclaimed], "clerk_123"),
    ).toEqual(unclaimed);
  });

  it("returns null when only foreign-owned rows exist", () => {
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(resolvePatchProfileRow([foreign], "clerk_123")).toBeNull();
  });

  it("returns null for an empty candidate set", () => {
    expect(resolvePatchProfileRow([], "clerk_123")).toBeNull();
  });
});

describe("profiles.patch resume scoring sync", () => {
  it("extracts usable scoring fields from a saved cvDocument snapshot", () => {
    const fields = buildScoringProfileFieldsFromCvDocument(
      makeMatchableCvDocument(),
    );

    expect(fields.summary).toBe(
      "Retail design specialist for Miami Design District stores.",
    );
    expect(fields.skills).toEqual(["Retail design", "Clienteling"]);
    expect(fields.experience).toEqual([
      expect.objectContaining({
        company: "Studio Store",
        title: "Store Designer",
        description:
          "Built part-time luxury retail displays and compensation dashboards.",
      }),
    ]);
    expect(fields.raw_text).toContain("Miami Design District");
    expect(fields.raw_text).toContain("part-time luxury retail displays");
  });

  it("populates server scoring fields when creating a profile from patch-only CV save", async () => {
    const ctx = makePatchCtx([]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          cvDocument: makeMatchableCvDocument(),
        },
      },
    );

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "userProfiles",
      expect.objectContaining({
        profileId: "cv_content",
        clerkId: "clerk_123",
        summary: "Retail design specialist for Miami Design District stores.",
        skills: ["Retail design", "Clienteling"],
        raw_text: expect.stringContaining("Miami Design District"),
        keywords: expect.arrayContaining(["retail", "design", "miami"]),
        experience: [
          expect.objectContaining({
            company: "Studio Store",
            title: "Store Designer",
            description:
              "Built part-time luxury retail displays and compensation dashboards.",
          }),
        ],
      }),
    );
  });

  it("backfills empty existing profile rows from a later CV document save", async () => {
    const existing = {
      _id: "profile_doc_id",
      _creationTime: 100,
      profileId: "cv_content",
      clerkId: "clerk_123",
      email: "candidate@example.com",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
      skills: [],
      keywords: [],
      experience: [],
      raw_text: null,
      summary: null,
    };
    const ctx = makePatchCtx([existing]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          cvDocument: makeMatchableCvDocument(),
        },
      },
    );

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "profile_doc_id",
      expect.objectContaining({
        summary: "Retail design specialist for Miami Design District stores.",
        skills: ["Retail design", "Clienteling"],
        raw_text: expect.stringContaining("Miami Design District"),
        keywords: expect.arrayContaining(["retail", "design", "miami"]),
        experience: [
          expect.objectContaining({
            company: "Studio Store",
            title: "Store Designer",
          }),
        ],
      }),
    );
  });

  it("created profile scoring fields keep attached resume matching out of profile_missing", async () => {
    const ctx = makePatchCtx([]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          cvDocument: makeMatchableCvDocument(),
        },
      },
    );

    const insertedProfile = ctx.db.insert.mock.calls[0][1];
    const matchProfile = buildMatchReadProfile({
      ...insertedProfile,
      _id: "profile_doc_id",
    });
    const matchRead = computeMatchRead({
      now: 1234,
      profile: matchProfile,
      job: {
        id: "job_retail_design",
        parseStatus: "parsed",
        mustHavesExtraction: [
          { value: "Miami", confidence: 0.9, sourceSpan: null },
          { value: "Retail design", confidence: 0.9, sourceSpan: null },
        ],
        keywordsExtraction: [
          { value: "part-time", confidence: 0.8, sourceSpan: null },
        ],
      },
    });

    expect(matchRead.fallback).toBe("none");
    expect(matchRead.score).not.toBeNull();
    expect(matchRead.matched).toEqual(
      expect.arrayContaining(["Miami", "Retail design", "part-time"]),
    );
  });
});
