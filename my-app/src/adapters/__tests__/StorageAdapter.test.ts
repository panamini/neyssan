import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCvTemplateV1 } from "../../lib/cv-template";
import {
  ConvexStorageAdapter,
  mapPersistedProfileToCvDocument,
} from "../StorageAdapter";

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

  it("keeps import recovery session only in the embedded cvDocument payload", async () => {
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
    expect(payload.cvDocument.metadata.importRecoverySession).toEqual(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("strips authoritativeResume from backend metadata but keeps it in the runtime snapshot", async () => {
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
    expect(payload.cvDocument.metadata.authoritativeResume).toEqual(
      expect.objectContaining({
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: true,
        normalized: null,
      }),
    );

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

    expect(
      window.localStorage.getItem(`cv:${cv.id}`),
    ).toContain("Unauthorized Remote CV");
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
