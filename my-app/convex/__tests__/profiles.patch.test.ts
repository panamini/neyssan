import { describe, expect, it, vi } from "vitest";

import {
  buildScoringProfileFieldsFromCvDocument,
  patch as patchProfile,
  resolvePatchProfileRow,
  saveProfile,
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

function makeSaveProfileCtx(
  rows: any[],
  identity: { subject: string; email?: string; name?: string } | null = {
    subject: "clerk_123",
    email: "candidate@example.com",
    name: "Candidate",
  },
) {
  const insert = vi.fn(async (_table: string, doc: any) => {
    rows.push({ _id: `profile_${rows.length + 1}`, ...doc });
    return rows.at(-1)._id;
  });
  const patch = vi.fn(async (id: string, next: any) => {
    const row = rows.find((candidate) => candidate._id === id);
    if (!row) throw new Error(`Missing profile ${id}`);
    Object.assign(row, next);
  });

  return {
    auth: {
      getUserIdentity: async () => identity,
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
              take: async (limit: number) =>
                rows
                  .filter((row) => row.profileId === profileId)
                  .slice(0, limit),
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

  it("refuses to select an unclaimed duplicate for an unauthenticated owned profile write", () => {
    const owned = { clerkId: "clerk_123", marker: "owned" };
    const unclaimed = { clerkId: undefined, marker: "unclaimed" };

    expect(resolvePatchProfileRow([unclaimed, owned], undefined)).toBeNull();
  });

  it("still allows an unauthenticated write to an entirely unclaimed profile", () => {
    const unclaimed = { clerkId: undefined, marker: "unclaimed" };

    expect(resolvePatchProfileRow([unclaimed], undefined)).toEqual(unclaimed);
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

  it("does not create a profile row for metadata-only style patches", async () => {
    const ctx = makePatchCtx([]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          metadata: {
            verbatiStyle: {
              layout: "workshop",
              typography: "geist-baskervville",
              palette: "sauge",
            },
            documentIcons: {
              listMarkerType: "dot",
              defaultListMarkerKey: "dot",
              sectionHeadingIconMode: "custom",
              sectionIconMap: {},
              color: "accent",
              sizePt: 8,
            },
            documentIconOverrides: {
              listItems: {
                "skills|skills|skill-1|item||0": "check",
              },
            },
          },
        },
      },
    );

    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("patches existing profile metadata-only style changes without cvDocument or metadata loss", async () => {
    const existing = {
      _id: "profile_doc_id",
      _creationTime: 100,
      profileId: "cv_content",
      clerkId: "clerk_123",
      email: "candidate@example.com",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
      skills: ["Existing skill"],
      keywords: ["existing"],
      experience: [],
      raw_text: "Existing raw text",
      summary: "Existing summary",
      metadata: {
        source: "legacy-import",
        importedAt: 123,
        confidence: 0.82,
        filename: "resume.pdf",
      },
      cvDocument: makeMatchableCvDocument(),
    };
    const ctx = makePatchCtx([existing]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          metadata: {
            verbatiStyle: {
              layout: "workshop",
              typography: "geist-baskervville",
              palette: "sauge",
            },
            documentIcons: {
              listMarkerType: "dot",
              defaultListMarkerKey: "dot",
              sectionHeadingIconMode: "custom",
              sectionIconMap: {},
              color: "accent",
              sizePt: 8,
            },
            documentIconOverrides: {
              listItems: {
                "skills|skills|skill-1|item||0": "check",
              },
            },
          },
        },
      },
    );

    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "profile_doc_id",
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "legacy-import",
          importedAt: 123,
          confidence: 0.82,
          filename: "resume.pdf",
          verbatiStyle: {
            layout: "workshop",
            typography: "geist-baskervville",
            palette: "sauge",
          },
          documentIcons: {
            listMarkerType: "dot",
            defaultListMarkerKey: "dot",
            sectionHeadingIconMode: "custom",
            sectionIconMap: {},
            color: "accent",
            sizePt: 8,
          },
          documentIconOverrides: {
            listItems: {
              "skills|skills|skill-1|item||0": "check",
            },
          },
        }),
      }),
    );
    expect(ctx.db.patch.mock.calls[0][1].cvDocument).toBeUndefined();
  });

  it("refreshes library summary fields when an existing CV document is autosaved", async () => {
    const existing = {
      _id: "profile_doc_id",
      _creationTime: 100,
      profileId: "cv_content",
      clerkId: "clerk_123",
      email: "candidate@example.com",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
      skills: ["Old library skill"],
      keywords: ["old"],
      experience: [
        {
          company: "Old Company",
          title: "Old Title",
          description: "Old library description",
        },
      ],
      raw_text: "Old library raw text",
      summary: "Old library summary",
      metadata: {
        source: "legacy-import",
      },
      cvDocument: {
        ...makeMatchableCvDocument(),
        sections: [],
      },
    };
    const ctx = makePatchCtx([existing]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          metadata: {
            verbatiStyle: {
              layout: "workshop",
              typography: "geist-baskervville",
              palette: "sauge",
            },
          },
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
        experience: [
          expect.objectContaining({
            company: "Studio Store",
            title: "Store Designer",
            description:
              "Built part-time luxury retail displays and compensation dashboards.",
          }),
        ],
        cvDocument: expect.objectContaining({
          id: "cv_content",
        }),
      }),
    );
  });

  it("strips legacy profileImage metadata from server-side patch writes", async () => {
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
      raw_text: "",
      summary: "",
      metadata: {
        source: "legacy-import",
        profileImage: {
          src: "data:image/jpeg;base64,OLD",
          fileName: "old.jpg",
        },
      },
    };
    const ctx = makePatchCtx([existing]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          metadata: {
            profileImage: {
              src: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
              fileName: "new.jpg",
            },
            verbatiStyle: {
              layout: "workshop",
              typography: "geist-baskervville",
              palette: "sauge",
            },
          },
        },
      },
    );

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "profile_doc_id",
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "legacy-import",
          verbatiStyle: {
            layout: "workshop",
            typography: "geist-baskervville",
            palette: "sauge",
          },
        }),
      }),
    );
    expect(ctx.db.patch.mock.calls[0][1].metadata.profileImage).toEqual({
      fileName: "new.jpg",
    });
    expect(
      JSON.stringify(ctx.db.patch.mock.calls[0][1].metadata),
    ).not.toContain("data:image");
  });

  it("strips decoration runtime image URLs from server-side patch writes while keeping asset metadata", async () => {
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
      raw_text: "",
      summary: "",
      metadata: {
        source: "legacy-import",
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_old",
          dataUrl: "data:image/jpeg;base64,OLD",
          resolvedUrl: "https://files.example.test/old",
          fileName: "old.jpg",
          mimeType: "image/jpeg",
          alt: "Old",
          sizePreset: 35,
          fit: "contain",
          placementMode: "custom",
          xMm: 17,
          yMm: 35,
        },
      },
    };
    const ctx = makePatchCtx([existing]);

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          metadata: {
            documentDecoration: {
              visible: true,
              source: "upload",
              assetId: "storage_new",
              dataUrl: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
              resolvedUrl: "https://files.example.test/new",
              fileName: "new.jpg",
              mimeType: "image/jpeg",
              alt: "New",
              sizePreset: "custom",
              customSizeMm: 44,
              fit: "cover",
              placementMode: "custom",
              xMm: 21,
              yMm: 39,
            },
          },
        },
      },
    );

    const writtenDecoration =
      ctx.db.patch.mock.calls[0][1].metadata.documentDecoration;
    expect(writtenDecoration).toMatchObject({
      visible: true,
      assetId: "storage_new",
      fileName: "new.jpg",
      mimeType: "image/jpeg",
      alt: "New",
      sizePreset: "custom",
      customSizeMm: 44,
      fit: "cover",
      placementMode: "custom",
      xMm: 21,
      yMm: 39,
    });
    expect(writtenDecoration.dataUrl).toBeUndefined();
    expect(writtenDecoration.resolvedUrl).toBeUndefined();
  });

  it("strips nested encoded cvDocument image data URLs from server-side patch writes", async () => {
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
      raw_text: "",
      summary: "",
    };
    const ctx = makePatchCtx([existing]);
    const dataUrl = `data:image/png;base64,${"A".repeat(680 * 1024)}`;

    await patchProfile._handler(
      ctx as any,
      {
        profileId: "cv_content",
        patch: {
          cvDocument: {
            id: "cv_content",
            title: "Nested image",
            metadata: {},
            sections: [
              {
                id: "image-section",
                type: "profile",
                title: "Profile",
                blocks: [
                  {
                    id: "image-block",
                    type: "image",
                    content: {
                      kind: "remirror_json",
                      version: 1,
                      json: JSON.stringify({
                        type: "doc",
                        content: [
                          {
                            type: "image",
                            attrs: { src: dataUrl, alt: "Nested" },
                          },
                        ],
                      }),
                    },
                  },
                ],
                structuredContent: [{ id: "profile", name: "Nested" }],
              },
            ],
          },
        },
      },
    );

    const cvDocument = ctx.db.patch.mock.calls[0][1].cvDocument;
    expect(JSON.stringify(cvDocument)).not.toContain("data:image");
    expect(cvDocument.sections[0].blocks).toEqual([]);
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

describe("profiles.saveProfile owner boundary", () => {
  it("rejects unauthenticated profile saves before insert or patch", async () => {
    const ctx = makeSaveProfileCtx([], null);

    await expect(
      saveProfile._handler(ctx as any, {
        profileId: "cv_content",
        profile: { email: "candidate@example.com", name: "Candidate" },
      }),
    ).rejects.toThrow(/Not authenticated/i);

    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("rejects saves to a profile owned by another Clerk subject", async () => {
    const existing = {
      _id: "profile_foreign",
      profileId: "cv_content",
      clerkId: "clerk_foreign",
      email: "foreign@example.com",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
      preferences: {
        autoSend: false,
        rateLimits: undefined,
        tonePreference: "neutral",
        writingStyle: "conversational",
      },
    };
    const ctx = makeSaveProfileCtx([existing]);

    await expect(
      saveProfile._handler(ctx as any, {
        profileId: "cv_content",
        profile: { name: "Intruder" },
      }),
    ).rejects.toThrow(/Not authorized/i);

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(existing.name).toBeUndefined();
  });

  it("claims unowned profile rows for the authenticated Clerk subject", async () => {
    const existing = {
      _id: "profile_unclaimed",
      profileId: "cv_content",
      clerkId: "",
      email: "",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
      preferences: {
        autoSend: false,
        rateLimits: undefined,
        tonePreference: "neutral",
        writingStyle: "conversational",
      },
    };
    const ctx = makeSaveProfileCtx([existing]);

    await saveProfile._handler(ctx as any, {
      profileId: "cv_content",
      profile: { name: "Candidate", email: "candidate@example.com" },
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "profile_unclaimed",
      expect.objectContaining({
        clerkId: "clerk_123",
        email: "candidate@example.com",
        name: "Candidate",
      }),
    );
  });

  it("creates new fallback profile rows under the authenticated Clerk subject", async () => {
    const rows: any[] = [];
    const ctx = makeSaveProfileCtx(rows);

    await saveProfile._handler(ctx as any, {
      profileId: "cv_content",
      profile: { name: "Candidate", email: "candidate@example.com" },
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "userProfiles",
      expect.objectContaining({
        profileId: "cv_content",
        clerkId: "clerk_123",
        email: "candidate@example.com",
        name: "Candidate",
      }),
    );
  });
});
