import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCvTemplateV1 } from "../../lib/cv-template";
import {
  ConvexStorageAdapter,
  mapPersistedProfileToCvDocument,
} from "../StorageAdapter";
import {
  encodeCvDocumentForConvex,
  getMaxNestingDepth,
  isPersistedRemirrorJson,
} from "../cvDocumentPersistence";
import { mapCvDocumentToResumeData } from "../../features/verbati/cvDocumentToResumeData";

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

  it("keeps a local snapshot when remote save is unauthorized", async () => {
    const patchMutation = vi
      .fn()
      .mockRejectedValue(new Error("Not authorized to access this profile"));
    const adapter = new ConvexStorageAdapter(patchMutation);
    const cv = generateCvTemplateV1("Unauthorized Remote CV");

    await expect(adapter.save(cv)).resolves.toBeUndefined();

    expect(window.localStorage.getItem(`cv:${cv.id}`)).toContain(
      "Unauthorized Remote CV",
    );
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
    });
    expect(payload.metadata).toMatchObject({
      verbatiStyleSlotId: 2,
      verbatiStyleSlotSource: "settings",
      verbatiStyleSlotNameSnapshot: "Style 2",
      verbatiStyleBaseSnapshot: {
        familyId: "workshop",
        layout: "workshop",
        palette: "cobalt",
        typography: "civic-correspondence",
      },
      documentStyleVersion: 1,
    });
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
