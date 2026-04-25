import { afterEach, describe, expect, it, vi } from "vitest";

import { create, getPublic } from "../proposalHandoffs";

describe("proposalHandoffs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("create returns an opaque handoff token and persists it with the handoff record", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const randomUuidSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomUuidSpy
      .mockReturnValueOnce("handoff_123")
      .mockReturnValueOnce("token_123");
    vi.spyOn(Date, "now").mockReturnValue(1234567890);

    const result = await create._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          insert,
        },
      } as any,
      {
        jobTitle: "Operations Associate",
        jobDescription: "Coordinate recurring launches and document handoffs.",
        sourceUrl: "https://example.com/jobs/123",
        platform: "linkedin",
      },
    );

    expect(result).toEqual({
      handoffId: "handoff_123",
      handoffToken: "token_123",
      createdAt: 1234567890,
    });
    expect(insert).toHaveBeenCalledWith(
      "proposalHandoffs",
      expect.objectContaining({
        handoffId: "handoff_123",
        handoffToken: "token_123",
        clerkId: "clerk_123",
      }),
    );
  });

  it("getPublic succeeds only when handoffId and token match a non-expired record", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);

    const result = await getPublic._handler(
      {
        db: {
          query: () => ({
            withIndex: () => ({
              unique: async () => ({
                handoffId: "handoff_123",
                handoffToken: "token_123",
                jobTitle: "Operations Associate",
                jobDescription:
                  "Coordinate recurring launches and keep handoffs clear.",
                sourceUrl: "https://example.com/jobs/123",
                platform: "linkedin",
                createdAt: 1000,
              }),
            }),
          }),
        },
      } as any,
      {
        handoffId: "handoff_123",
        handoffToken: "token_123",
      },
    );

    expect(result).toEqual({
      handoffId: "handoff_123",
      jobTitle: "Operations Associate",
      jobDescription:
        "Coordinate recurring launches and keep handoffs clear.",
      sourceUrl: "https://example.com/jobs/123",
      platform: "linkedin",
    });
  });

  it("getPublic fails closed when the token is wrong", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);

    const result = await getPublic._handler(
      {
        db: {
          query: () => ({
            withIndex: () => ({
              unique: async () => ({
                handoffId: "handoff_123",
                handoffToken: "token_123",
                jobTitle: "Operations Associate",
                jobDescription: "Coordinate recurring launches.",
                sourceUrl: "https://example.com/jobs/123",
                platform: "linkedin",
                createdAt: 1000,
              }),
            }),
          }),
        },
      } as any,
      {
        handoffId: "handoff_123",
        handoffToken: "wrong_token",
      },
    );

    expect(result).toBeNull();
  });

  it("getPublic fails closed when the handoff has expired", async () => {
    vi.spyOn(Date, "now").mockReturnValue(24 * 60 * 60 * 1000 + 2);

    const result = await getPublic._handler(
      {
        db: {
          query: () => ({
            withIndex: () => ({
              unique: async () => ({
                handoffId: "handoff_123",
                handoffToken: "token_123",
                jobTitle: "Operations Associate",
                jobDescription: "Coordinate recurring launches.",
                sourceUrl: "https://example.com/jobs/123",
                platform: "linkedin",
                createdAt: 1,
              }),
            }),
          }),
        },
      } as any,
      {
        handoffId: "handoff_123",
        handoffToken: "token_123",
      },
    );

    expect(result).toBeNull();
  });
});
