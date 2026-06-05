import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCvTemplateV1 } from "../../lib/cv-template";
import {
  ConvexStorageAdapter,
  mapPersistedProfileToCvDocument,
} from "../StorageAdapter";
import { convexClient } from "../../lib/convex-client";
import {
  encodeCvDocumentForConvex,
  getMaxNestingDepth,
  isPersistedRemirrorJson,
} from "../cvDocumentPersistence";
import { mapCvDocumentToResumeData } from "../../features/verbati/cvDocumentToResumeData";

vi.mock("../../lib/convex-client", () => ({
  convexClient: {
    query: vi.fn(async () => null),
  },
}));

function byteSize(value: unknown): number {
  return new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  ).length;
}

const richResponsibilitiesDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Led delivery", marks: [{ type: "bold" }] },
      ],
    },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Shipped resilient workflows",
                  marks: [{ type: "bold" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function buildRichCv() {
  const cv = generateCvTemplateV1("Rich Persistence CV");
  cv.sections = [
    {
      id: "summary-rich",
      type: "summary",
      title: "Summary",
      blocks: [],
      structuredContent: [
        {
          id: "summary-item",
          summary: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Bold summary",
                    marks: [{ type: "bold" }],
                  },
                ],
              },
            ],
          },
        },
      ],
    } as any,
    {
      id: "experience-rich",
      type: "experience",
      title: "Experience",
      blocks: [],
      structuredContent: [
        {
          id: "exp-rich",
          company: "Acme",
          position: "Lead",
          startDate: "2024-01-01",
          endDate: null,
          responsibilities: richResponsibilitiesDoc,
        },
      ],
    } as any,
    {
      id: "project-rich",
      type: "projects",
      title: "Projects",
      blocks: [],
      structuredContent: [
        {
          id: "project-item",
          name: "Project Atlas",
          description: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Project detail",
                    marks: [{ type: "italic" }],
                  },
                ],
              },
            ],
          },
        },
      ],
    } as any,
  ];
  return cv;
}

describe("StorageAdapter persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(convexClient.query).mockClear();
  });

  it("persists a full cvDocument snapshot when saving", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Persistence Test CV");

    await adapter.save(cv);

    expect(patchMutation).toHaveBeenCalledTimes(1);
    expect(patchMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: cv.id,
        patch: expect.objectContaining({
          cvDocument: expect.objectContaining({
            id: cv.id,
            title: "Persistence Test CV",
          }),
        }),
      }),
    );
  });

  it("encodes rich Remirror docs into Convex-safe shallow fields on save", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = buildRichCv();

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    const summary = payload.cvDocument.sections[0].structuredContent[0].summary;
    const responsibilities =
      payload.cvDocument.sections[1].structuredContent[0].responsibilities;
    const projectDescription =
      payload.cvDocument.sections[2].structuredContent[0].description;

    expect(isPersistedRemirrorJson(summary)).toBe(true);
    expect(isPersistedRemirrorJson(responsibilities)).toBe(true);
    expect(isPersistedRemirrorJson(projectDescription)).toBe(true);
    expect(summary.plainText).toBeUndefined();
    expect(responsibilities.plainText).toBeUndefined();
    expect(projectDescription.plainText).toBeUndefined();
    expect(responsibilities.json).toContain("bullet_list");
    expect(responsibilities.json).toContain("bold");
    expect(JSON.stringify(payload.cvDocument)).not.toContain('"type":"doc"');
    expect(JSON.stringify(payload.cvDocument)).not.toContain("<p");
    expect(getMaxNestingDepth(payload)).toBeLessThanOrEqual(16);
  });

  it("decodes persisted rich fields and still accepts old raw Remirror docs", () => {
    const cv = buildRichCv();
    const encoded = encodeCvDocumentForConvex(cv);

    const restored = mapPersistedProfileToCvDocument(
      { profileId: cv.id, cvDocument: encoded },
      cv.id,
    );
    const oldRawRestored = mapPersistedProfileToCvDocument(
      { profileId: cv.id, cvDocument: cv },
      cv.id,
    );

    expect(
      restored?.sections[1].structuredContent?.[0].responsibilities,
    ).toEqual(richResponsibilitiesDoc);
    expect(
      oldRawRestored?.sections[1].structuredContent?.[0].responsibilities,
    ).toEqual(richResponsibilitiesDoc);
  });

  it("renders rich summary, project description, and responsibility bullets after save/load", () => {
    const cv = buildRichCv();
    const restored = mapPersistedProfileToCvDocument(
      { profileId: cv.id, cvDocument: encodeCvDocumentForConvex(cv) },
      cv.id,
    );

    expect(restored).not.toBeNull();
    const resumeData = mapCvDocumentToResumeData(restored! as any);
    expect(resumeData.summary).toContain("Bold summary");
    expect(JSON.stringify(resumeData.experience)).toContain(
      "Shipped resilient workflows",
    );
    expect(JSON.stringify(resumeData.projects)).toContain("Project detail");
  });

  it("does not duplicate the CV sections beside the embedded cvDocument payload", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Payload Size Guard CV");

    await adapter.save(cv);

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.cvDocument.sections).toHaveLength(cv.sections.length);
    expect(payload.sections).toBeUndefined();
    expect(payload.title).toBeUndefined();
    expect(payload.id).toBeUndefined();
  });

  it("does not duplicate large decoration data URLs between profile metadata and embedded cvDocument", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Decorated Payload CV");
    const dataUrl = `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`;
    cv.metadata.documentDecoration = {
      visible: true,
      source: "upload",
      assetId: "storage_decoration_1",
      dataUrl,
      fileName: "large-mark.jpg",
      mimeType: "image/jpeg",
      alt: "Large mark",
      sizePreset: "custom",
      customSizeMm: 44,
      fit: "contain",
      placementMode: "custom",
      xMm: 17,
      yMm: 35,
    };

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    const topLevelDecoration = payload.metadata?.documentDecoration;
    const embeddedDecoration = payload.cvDocument?.metadata?.documentDecoration;
    expect(topLevelDecoration).toMatchObject({
      visible: true,
      source: "upload",
      assetId: "storage_decoration_1",
      fileName: "large-mark.jpg",
      mimeType: "image/jpeg",
      alt: "Large mark",
      sizePreset: "custom",
      customSizeMm: 44,
      fit: "contain",
      placementMode: "custom",
      xMm: 17,
      yMm: 35,
    });
    expect(topLevelDecoration?.dataUrl).toBeUndefined();
    expect((topLevelDecoration as any)?.resolvedUrl).toBeUndefined();
    expect(embeddedDecoration?.dataUrl).toBeUndefined();
    expect((embeddedDecoration as any)?.resolvedUrl).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("data:image");
    expect(byteSize(payload)).toBeLessThan(250 * 1024);
  });

  it("strips legacy profileImage data URLs from backend payloads and local durable cache", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Legacy Profile Image CV");
    const dataUrl = `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`;
    cv.metadata.profileImage = {
      src: dataUrl,
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    };

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.metadata?.profileImage).toEqual({
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    });
    expect(payload.cvDocument?.metadata?.profileImage).toEqual({
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    });
    expect(JSON.stringify(payload)).not.toContain("data:image");
    expect(byteSize(payload)).toBeLessThan(250 * 1024);

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(JSON.stringify(cachedDocument)).not.toContain("data:image");
    expect(cachedDocument.metadata.profileImage).toEqual({
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    });
  });

  it("strips nested cvDocument image data URLs from backend payloads and local durable cache", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Nested Runtime Image CV");
    const dataUrl = `data:image/png;base64,${"A".repeat(680 * 1024)}`;
    cv.sections = [
      {
        id: "profile-photo",
        type: "profile",
        title: "Profile",
        blocks: [
          {
            id: "profile-image-block",
            type: "image",
            content: {
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: {
                    src: dataUrl,
                    alt: "Inline import image",
                  },
                },
              ],
            },
          },
        ],
        structuredContent: [
          {
            id: "profile-photo-item",
            name: "Nested Runtime",
          },
        ],
      } as any,
    ];

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    expect(JSON.stringify(payload)).not.toContain("data:image");
    expect(payload.cvDocument.sections[0].blocks).toEqual([]);
    expect(byteSize(payload)).toBeLessThan(250 * 1024);

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(JSON.stringify(cachedDocument)).not.toContain("data:image");
    expect(
      cachedDocument.sections[0].blocks[0].content.content[0].attrs.src,
    ).toBeUndefined();
  });

  it("strips only image data while preserving structured editor content in durable snapshots", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = buildRichCv();
    cv.metadata.documentDecoration = {
      visible: true,
      source: "upload",
      assetId: "storage_editor_guard",
      dataUrl: "data:image/png;base64,AAAA",
      fileName: "mark.png",
      mimeType: "image/png",
      alt: "Mark",
      sizePreset: "custom",
      customSizeMm: 30,
      fit: "contain",
      placementMode: "custom",
      xMm: 10,
      yMm: 12,
    } as any;
    cv.sections[1].blocks = [
      {
        id: "experience-editor-block",
        type: "text",
        title: "Lead at Acme",
        content: richResponsibilitiesDoc,
        plainText: "Led delivery",
        attributes: { linkedStructuredId: "exp-rich" },
      } as any,
    ];

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    expect(JSON.stringify(payload)).not.toContain("data:image");
    expect(payload.cvDocument.sections[0].structuredContent[0].summary.json).toContain(
      "Bold summary",
    );
    expect(
      payload.cvDocument.sections[1].structuredContent[0].responsibilities.json,
    ).toContain("Shipped resilient workflows");

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(JSON.stringify(cachedDocument)).not.toContain("data:image");
    expect(cachedDocument.sections[1].blocks).toHaveLength(1);
    expect(
      cachedDocument.sections[0].structuredContent[0].summary.content[0]
        .content[0].text,
    ).toBe("Bold summary");
    expect(
      cachedDocument.sections[1].structuredContent[0].responsibilities.content[1]
        .content[0].content[0].content[0].text,
    ).toBe("Shipped resilient workflows");
  });

  it("strips representative blocks from structured sections in backend payloads while keeping the local snapshot", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Structured Block Duplicate CV");
    const duplicateText = "Delivered operational improvements. ".repeat(6000);
    cv.sections = [
      {
        id: "experience-structured",
        type: "experience",
        title: "Experience",
        blocks: [
          {
            id: "duplicate-block",
            type: "text",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: duplicateText }],
                },
              ],
            },
          },
        ],
        structuredContent: [
          {
            id: "exp-structured",
            company: "Acme",
            position: "Lead",
            startDate: "2024-01-01",
            endDate: null,
            responsibilities: duplicateText,
          },
        ],
      } as any,
    ];

    await adapter.save(cv);

    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.cvDocument.sections[0].structuredContent).toHaveLength(1);
    expect(payload.cvDocument.sections[0].blocks).toEqual([]);
    expect(byteSize(payload)).toBeLessThan(250 * 1024);

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(cachedDocument.sections[0].blocks).toHaveLength(1);
  });

  it("strips import recovery session from backend payloads while keeping the local runtime snapshot", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Recovery Persistence CV");
    cv.metadata.importRecoverySession = {
      status: "completed",
      updatedAt: new Date().toISOString(),
      overflowCount: 0,
      reviewLimit: 12,
      items: [
        {
          blockId: "recovery-1",
          rawText: "Recovered text",
          cleanedText: "Recovered text",
          displayTextSource: "cleaned",
          predictedSection: "summary",
          confidenceScore: "low",
          confidenceValue: 0.25,
          issueFlags: ["weakSectionMatch"],
          reviewStatus: "accepted",
          selectedSection: "summary",
          fragmentAssignments: [],
        },
      ],
      baseSectionsSnapshot: [],
    };

    await adapter.save(cv);

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.metadata.importRecoverySession).toBeUndefined();
    expect(payload.cvDocument.metadata.importRecoverySession).toBeUndefined();

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(cachedDocument.metadata.importRecoverySession).toEqual(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("strips authoritativeResume from backend payloads but keeps it in the runtime snapshot", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Trusted Runtime CV");
    cv.metadata.authoritativeResume = {
      source: "mistral_v3",
      trusted: false,
      fallbackToLegacy: true,
      normalized: null,
    };

    await expect(adapter.save(cv)).resolves.toBeUndefined();

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.metadata.authoritativeResume).toBeUndefined();
    expect(payload.cvDocument.metadata.authoritativeResume).toBeUndefined();

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(cachedDocument.metadata.authoritativeResume).toEqual(
      expect.objectContaining({
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: true,
        normalized: null,
      }),
    );
  });

  it("keeps a local snapshot and reports failure when remote save is unauthorized", async () => {
    const patchMutation = vi
      .fn()
      .mockRejectedValue(new Error("Not authorized to access this profile"));
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Unauthorized Remote CV");

    await expect(adapter.save(cv)).rejects.toThrow(
      /Not authorized to access this profile/i,
    );

    expect(window.localStorage.getItem(`cv:${cv.id}`)).toContain(
      "Unauthorized Remote CV",
    );
  });

  it("keeps a local snapshot and reports failure when Convex rejects an oversized remote value", async () => {
    const patchMutation = vi.fn().mockRejectedValue(
      new Error("Value is too large (1.04 MiB > maximum size 1 MiB)"),
    );
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Oversized Remote CV");

    await expect(adapter.save(cv)).rejects.toThrow(/Value is too large/i);

    expect(patchMutation).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(`cv:${cv.id}`)).toContain(
      "Oversized Remote CV",
    );
  });

  it("reports auth_not_ready for remote loads without treating it as not_found", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const loadFn = vi.fn().mockResolvedValue(null);
    const adapter = new ConvexStorageAdapter(patchMutation, loadFn, {
      canUseRemote: () => false,
    });

    await expect(adapter.loadRemoteState("cv_auth_pending")).resolves.toEqual({
      status: "auth_not_ready",
    });

    expect(loadFn).not.toHaveBeenCalled();
    expect(convexClient.query).not.toHaveBeenCalled();
  });

  it("keeps auth_not_ready remote loads separate from local fallback loads", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const loadFn = vi.fn().mockResolvedValue(null);
    const adapter = new ConvexStorageAdapter(patchMutation, loadFn, {
      canUseRemote: () => false,
    });
    const cv = generateCvTemplateV1("Auth Pending Local CV");
    window.localStorage.setItem(`cv:${cv.id}`, JSON.stringify(cv));

    await expect(adapter.load(cv.id)).resolves.toMatchObject({
      id: cv.id,
      title: "Auth Pending Local CV",
    });

    expect(loadFn).not.toHaveBeenCalled();
    expect(convexClient.query).not.toHaveBeenCalled();
  });

  it("prefers the embedded cvDocument snapshot on remote restore", () => {
    const cv = generateCvTemplateV1("Embedded Remote CV");

    const restored = mapPersistedProfileToCvDocument(
      {
        profileId: cv.id,
        cvDocument: cv,
        name: "Wrong Fallback Name",
      },
      cv.id,
    );

    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(cv.id);
    expect(restored?.title).toBe("Embedded Remote CV");
    expect(restored?.sections).toHaveLength(cv.sections.length);
  });

  it("overlays document decoration metadata without restoring runtime data URLs", () => {
    const cv = generateCvTemplateV1("Embedded Decorated CV");

    const restored = mapPersistedProfileToCvDocument(
      {
        profileId: cv.id,
        cvDocument: cv,
        metadata: {
          documentDecoration: {
            visible: true,
            source: "upload",
            dataUrl: "data:image/jpeg;base64,AAAA",
            fileName: "mark.jpg",
            mimeType: "image/jpeg",
            alt: "Mark",
            sizePreset: 35,
            fit: "contain",
            placementMode: "default",
            xMm: 17,
            yMm: 35,
          },
        },
      },
      cv.id,
    );

    expect(restored?.metadata.documentDecoration).toMatchObject({
      visible: true,
      fileName: "mark.jpg",
      mimeType: "image/jpeg",
    });
    expect(restored?.metadata.documentDecoration?.dataUrl).toBeUndefined();
    expect(JSON.stringify(restored)).not.toContain("data:image");
  });

  it("preserves resolved document decoration URLs in runtime state", async () => {
    const cv = generateCvTemplateV1("Remote Resolved Image CV");
    const adapter = new ConvexStorageAdapter(vi.fn(), async () =>
      mapPersistedProfileToCvDocument(
        {
          profileId: cv.id,
          cvDocument: cv,
          metadata: {
            documentDecoration: {
              visible: true,
              source: "upload",
              assetId: "storage_decoration_1",
              resolvedUrl: "https://files.example.test/storage_decoration_1",
              fileName: "mark.jpg",
              mimeType: "image/jpeg",
              sizePreset: 35,
              fit: "contain",
              placementMode: "default",
            },
          },
        },
        cv.id,
      ),
    );

    const loaded = await adapter.load(cv.id);

    expect(loaded?.metadata.documentDecoration).toMatchObject({
      assetId: "storage_decoration_1",
      resolvedUrl: "https://files.example.test/storage_decoration_1",
    });
    expect(JSON.stringify(loaded)).not.toContain("data:image");
  });

  it("prefers top-level resolved document decoration over stale embedded cvDocument metadata", () => {
    const cv = generateCvTemplateV1("Remote Decoration Mismatch CV");
    cv.metadata.documentDecoration = {
      visible: true,
      source: "upload",
      assetId: "stale_embedded_asset",
      fileName: "old-mark.jpg",
      mimeType: "image/jpeg",
      sizePreset: 35,
      fit: "contain",
      placementMode: "default",
    } as any;

    const restored = mapPersistedProfileToCvDocument(
      {
        profileId: cv.id,
        cvDocument: cv,
        metadata: {
          documentDecoration: {
            visible: true,
            source: "upload",
            assetId: "fresh_top_level_asset",
            resolvedUrl: "https://files.example.test/fresh_top_level_asset",
            fileName: "fresh-mark.jpg",
            mimeType: "image/jpeg",
            sizePreset: 35,
            fit: "contain",
            placementMode: "default",
          },
        },
      },
      cv.id,
    );

    expect(restored?.metadata.documentDecoration).toMatchObject({
      assetId: "fresh_top_level_asset",
      resolvedUrl: "https://files.example.test/fresh_top_level_asset",
      fileName: "fresh-mark.jpg",
    });
  });

  it("returns a runtime sanitized document when loading a remote profile with legacy image data", async () => {
    const cv = generateCvTemplateV1("Remote Legacy Image CV");
    cv.metadata.profileImage = {
      src: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    };
    const adapter = new ConvexStorageAdapter(vi.fn(), async () =>
      mapPersistedProfileToCvDocument(
        {
          profileId: cv.id,
          cvDocument: cv,
        },
        cv.id,
      ),
    );

    const loaded = await adapter.load(cv.id);

    expect(loaded).not.toBeNull();
    expect(JSON.stringify(loaded)).not.toContain("data:image");
    expect(loaded?.metadata.profileImage).toEqual({
      fileName: "legacy-headshot.jpg",
      size: "large",
      fit: "cover",
    });
  });

  it("falls back to profile-field reconstruction for older remote rows", () => {
    const restored = mapPersistedProfileToCvDocument(
      {
        profileId: "legacy-cv-id",
        name: "Legacy Candidate",
        summary: "Built resilient hiring workflows.",
        skills: ["Hiring", "Operations"],
      },
      "legacy-cv-id",
    );

    expect(restored).not.toBeNull();
    expect(restored?.id).toBe("legacy-cv-id");
    expect(restored?.title).toBe("Legacy Candidate");
    expect(
      restored?.sections.some((section) => section.type === "summary"),
    ).toBe(true);
  });

  it("keeps style-only backend payloads small even when runtime metadata has large import artifacts", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Oversized Style Save CV");
    const largeText = "x".repeat(650_000);
    cv.metadata.verbatiStyle = {
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
    };
    cv.metadata.authoritativeResume = {
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: { raw: largeText },
    } as any;
    cv.metadata.importRecoverySession = {
      status: "completed",
      updatedAt: new Date().toISOString(),
      overflowCount: 0,
      reviewLimit: 12,
      items: [],
      baseSectionsSnapshot: [
        {
          id: "large-snapshot",
          type: "text",
          title: "Large Snapshot",
          blocks: [
            {
              id: "large-block",
              type: "text",
              content: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: largeText }],
                  },
                ],
              },
            },
          ],
          structuredContent: null,
        },
      ],
    } as any;

    await expect(adapter.save(cv)).resolves.toBeUndefined();

    const payload = patchMutation.mock.calls[0][0].patch;
    const serializedPayload = JSON.stringify(payload);
    expect(payload.metadata.authoritativeResume).toBeUndefined();
    expect(payload.metadata.importRecoverySession).toBeUndefined();
    expect(payload.cvDocument.metadata.authoritativeResume).toBeUndefined();
    expect(payload.cvDocument.metadata.importRecoverySession).toBeUndefined();
    expect(serializedPayload.length).toBeLessThan(250_000);
    expect(payload.metadata.verbatiStyle).toEqual({
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
      resumeTemplateId: undefined,
    });

    const cachedDocument = JSON.parse(
      window.localStorage.getItem(`cv:${cv.id}`) as string,
    );
    expect(
      cachedDocument.metadata.authoritativeResume.normalized.raw,
    ).toHaveLength(650_000);
    expect(
      cachedDocument.metadata.importRecoverySession.baseSectionsSnapshot[0]
        .blocks[0].content.content[0].content[0].text,
    ).toHaveLength(650_000);
  });

  it("saves style-only metadata without sending cvDocument", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);

    await expect(
      adapter.saveMetadataPatch("styled-cv", {
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          palette: "bordeaux",
          typography: "soft-serif",
          accentHex: "#9a2d45",
          resumeTemplateId: "workshop_resume_onecol_ats",
        },
        verbatiStyleSlotId: 2,
        verbatiStyleSlotSource: "settings",
        verbatiStyleSlotNameSnapshot: "Style 2",
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          palette: "cobalt",
          typography: "civic-correspondence",
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
        documentStyleVersion: 1,
      } as any),
    ).resolves.toBeUndefined();

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.cvDocument).toBeUndefined();
    expect(payload.metadata.verbatiStyle).toEqual({
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
      resumeTemplateId: "workshop_resume_onecol_ats",
    });
    expect(payload.metadata).toMatchObject({
      resumeTemplateId: "workshop_resume_onecol_ats",
      verbatiStyleSlotId: 2,
      verbatiStyleSlotSource: "settings",
      verbatiStyleSlotNameSnapshot: "Style 2",
      verbatiStyleBaseSnapshot: {
        familyId: "workshop",
        layout: "workshop",
        palette: "cobalt",
        typography: "civic-correspondence",
        resumeTemplateId: "workshop_resume_twocol_ats",
      },
      documentStyleVersion: 1,
    });
  });

  it("saves document decoration metadata without sending cvDocument", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);

    await adapter.saveMetadataPatch("decorated-cv", {
      documentDecoration: {
        visible: true,
        source: "upload",
        assetId: "storage_decoration_2",
        dataUrl: `data:image/jpeg;base64,${"A".repeat(680 * 1024)}`,
        resolvedUrl: "https://files.example.test/mark.jpg",
        fileName: "mark.jpg",
        mimeType: "image/jpeg",
        alt: "Mark",
        sizePreset: "custom",
        customSizeMm: 48,
        fit: "contain",
        placementMode: "custom",
        xMm: 17,
        yMm: 35,
      } as any,
    } as any);

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.cvDocument).toBeUndefined();
    expect(payload.metadata.documentDecoration).toMatchObject({
      visible: true,
      assetId: "storage_decoration_2",
      fileName: "mark.jpg",
      mimeType: "image/jpeg",
      sizePreset: "custom",
      customSizeMm: 48,
      placementMode: "custom",
    });
    expect(payload.metadata.documentDecoration.dataUrl).toBeUndefined();
    expect(payload.metadata.documentDecoration.resolvedUrl).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("data:image");
  });

  it("reports unauthorized metadata-only decoration saves as remote failures", async () => {
    const patchMutation = vi
      .fn()
      .mockRejectedValue(new Error("Not authorized to access this profile"));
    const adapter = new ConvexStorageAdapter(patchMutation);

    await expect(
      adapter.saveMetadataPatch("decorated-cv", {
        documentDecoration: {
          visible: true,
          source: "upload",
          assetId: "storage_decoration_3",
          fileName: "mark.jpg",
          mimeType: "image/jpeg",
        } as any,
      } as any),
    ).rejects.toThrow(/Not authorized to access this profile/i);

    expect(patchMutation).toHaveBeenCalledWith({
      profileId: "decorated-cv",
      patch: {
        metadata: {
          documentDecoration: expect.objectContaining({
            assetId: "storage_decoration_3",
          }),
        },
      },
    });
  });

  it("preserves the selected resume template through metadata-only save and backend reload hydration", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);

    await adapter.saveMetadataPatch("styled-cv", {
      verbatiStyle: {
        familyId: "workshop",
        layout: "workshop",
        palette: "sauge",
        typography: "geist-baskervville",
        resumeTemplateId: "sanat_asymmetric_resume",
      },
    } as any);

    const backendMetadata = patchMutation.mock.calls[0][0].patch.metadata;
    const hydrated = mapPersistedProfileToCvDocument(
      {
        profileId: "styled-cv",
        name: "Styled Candidate",
        summary: "Summary",
        metadata: backendMetadata,
      },
      "styled-cv",
    );

    expect(backendMetadata.verbatiStyle.resumeTemplateId).toBe(
      "sanat_asymmetric_resume",
    );
    expect(backendMetadata.resumeTemplateId).toBe("sanat_asymmetric_resume");
    expect(hydrated?.metadata?.verbatiStyle?.resumeTemplateId).toBe(
      "sanat_asymmetric_resume",
    );
    expect(hydrated?.metadata?.resumeTemplateId).toBe(
      "sanat_asymmetric_resume",
    );
  });

  it("hydrates the latest metadata-only template selection ahead of a stale embedded cvDocument", async () => {
    const embeddedCv = generateCvTemplateV1("Stale Embedded CV");
    embeddedCv.id = "styled-cv";
    embeddedCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      palette: "sauge",
      typography: "geist-baskervville",
      resumeTemplateId: "workshop_resume_onecol_ats",
    };

    const hydrated = mapPersistedProfileToCvDocument(
      {
        profileId: "styled-cv",
        name: "Styled Candidate",
        summary: "Summary",
        metadata: {
          resumeTemplateId: "sanat_asymmetric_resume",
          verbatiStyle: {
            layout: "workshop",
            palette: "sauge",
            typography: "geist-baskervville",
          },
        },
        cvDocument: embeddedCv,
      },
      "styled-cv",
    );

    expect(hydrated?.metadata?.verbatiStyle?.resumeTemplateId).toBe(
      "sanat_asymmetric_resume",
    );
    expect(hydrated?.metadata?.resumeTemplateId).toBe(
      "sanat_asymmetric_resume",
    );
  });

  it("sends metadata.verbatiStyle through patch metadata and keeps it in cvDocument", async () => {
    const patchMutation = vi.fn().mockResolvedValue(undefined);
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Styled Persistence CV");
    cv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
      resumeTemplateId: "workshop_resume_onecol_ats",
    };

    await expect(adapter.save(cv)).resolves.toBeUndefined();

    expect(patchMutation).toHaveBeenCalledTimes(1);
    const payload = patchMutation.mock.calls[0][0].patch;
    expect(payload.metadata.verbatiStyle).toEqual({
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
      resumeTemplateId: "workshop_resume_onecol_ats",
    });
    expect(payload.cvDocument.metadata.verbatiStyle).toEqual({
      familyId: "workshop",
      layout: "workshop",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: "#9a2d45",
      resumeTemplateId: "workshop_resume_onecol_ats",
    });
  });

  it("preserves and canonicalizes legacy verbatiStyle metadata on fallback restore", () => {
    const restored = mapPersistedProfileToCvDocument(
      {
        profileId: "legacy-style-cv",
        name: "Legacy Styled Candidate",
        summary: "Summary",
        metadata: {
          source: "legacy-import",
          importedAt: 123,
          confidence: 0.82,
          filename: "resume.pdf",
          verbatiStyle: {
            layout: "playful-photo",
            palette: "bordeaux",
            typography: "engaging",
            accentHex: "#8f233b",
          },
        },
      },
      "legacy-style-cv",
    );

    expect(restored).not.toBeNull();
    expect(restored?.metadata.source).toBe("legacy-import");
    expect(restored?.metadata.verbatiStyle).toEqual({
      familyId: "two-column",
      layout: "two-column",
      palette: "bordeaux",
      typography: "soft-serif",
      accentHex: undefined,
    });
  });
});
