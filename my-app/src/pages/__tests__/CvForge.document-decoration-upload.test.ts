import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveActiveCvDocumentDecoration,
  uploadDocumentDecorationAsset,
} from "../CvForge";

describe("CvForge document decoration upload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the selected image to the generated upload URL and returns storageId", async () => {
    const generateUploadUrl = vi
      .fn()
      .mockResolvedValue("https://convex.example.test/api/storage/upload/abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ storageId: "storage_decoration_1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const file = new File(["image-bytes"], "mark.jpg", {
      type: "image/jpeg",
    });

    await expect(
      uploadDocumentDecorationAsset({
        generateUploadUrl,
        file,
        mimeType: "image/jpeg",
        debugContext: {
          routeProfileId: "cv_route",
          currentCvId: "cv_route",
        },
      }),
    ).resolves.toBe("storage_decoration_1");

    expect(generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://convex.example.test/api/storage/upload/abc",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: file,
      }),
    );
  });

  it("rejects instead of persisting metadata when upload response has no storageId", async () => {
    const generateUploadUrl = vi
      .fn()
      .mockResolvedValue("https://convex.example.test/api/storage/upload/abc");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      uploadDocumentDecorationAsset({
        generateUploadUrl,
        file: new File(["image-bytes"], "mark.jpg", { type: "image/jpeg" }),
      }),
    ).rejects.toThrow(/did not return a storage id/i);
  });

  it("prefers a renderable blob draft while upload metadata is resolving", () => {
    const active = resolveActiveCvDocumentDecoration({
      draft: {
        visible: true,
        source: "upload",
        assetId: "storage_decoration_1",
        resolvedUrl: "blob:http://localhost/preview-1",
        fileName: "mark.jpg",
        mimeType: "image/jpeg",
        sizePreset: 35,
        fit: "contain",
        placementMode: "default",
      } as any,
      persisted: {
        visible: true,
        source: "upload",
        assetId: "storage_decoration_1",
        fileName: "mark.jpg",
        mimeType: "image/jpeg",
        sizePreset: 35,
        fit: "contain",
        placementMode: "default",
      } as any,
    });

    expect(active?.resolvedUrl).toBe("blob:http://localhost/preview-1");
  });

  it("does not let an assetId-only draft hide a renderable persisted decoration", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const active = resolveActiveCvDocumentDecoration({
      draft: {
        visible: true,
        source: "upload",
        assetId: "storage_decoration_1",
        fileName: "mark.jpg",
        mimeType: "image/jpeg",
        sizePreset: 35,
        fit: "contain",
        placementMode: "default",
      } as any,
      persisted: {
        visible: true,
        source: "upload",
        assetId: "storage_decoration_1",
        resolvedUrl: "https://files.example.test/storage_decoration_1",
        fileName: "mark.jpg",
        mimeType: "image/jpeg",
        sizePreset: 35,
        fit: "contain",
        placementMode: "default",
      } as any,
    });

    expect(active?.resolvedUrl).toBe(
      "https://files.example.test/storage_decoration_1",
    );
  });
});
