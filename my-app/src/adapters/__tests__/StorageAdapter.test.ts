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
});
