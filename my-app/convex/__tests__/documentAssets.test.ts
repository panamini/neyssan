import { describe, expect, it, vi } from "vitest";

import { generateUploadUrl } from "../documentAssets";

describe("documentAssets.generateUploadUrl", () => {
  it("requires an authenticated user and returns a storage upload URL", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue("https://upload.example.test/storage");

    await expect(
      generateUploadUrl._handler(
        {
          auth: {
            getUserIdentity: async () => null,
          },
          storage: {
            generateUploadUrl: generate,
          },
        } as any,
        {},
      ),
    ).rejects.toThrow(/Not authenticated/i);

    await expect(
      generateUploadUrl._handler(
        {
          auth: {
            getUserIdentity: async () => ({ subject: "clerk_123" }),
          },
          storage: {
            generateUploadUrl: generate,
          },
        } as any,
        {},
      ),
    ).resolves.toBe("https://upload.example.test/storage");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
