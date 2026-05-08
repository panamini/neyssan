import { describe, expect, it, vi } from "vitest";

import { getCurrent, setActivePreset } from "../proposalSettings";

function createCtx(user: Record<string, unknown> | null) {
  const replace = vi.fn();
  return {
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_1" }),
    },
    db: {
      replace,
      query: (table: string) => {
        if (table !== "userProfiles") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          withIndex: () => ({
            order: () => ({
              first: async () => user,
            }),
          }),
        };
      },
    },
    replace,
  } as any;
}

describe("proposalSettings voice authority", () => {
  it("uses the user-wide voice default instead of the active visual style slot voice", async () => {
    const result = await getCurrent._handler(
      createCtx({
        _id: "user_1",
        clerkId: "clerk_1",
        proposalVoicePreset: "engaging",
        proposalTemplateId: "editorial_wide",
        proposalActivePresetSlot: 2,
        proposalPreset2: {
          fontPairId: "quiet-editorial",
          styleChoice: "balanced",
          paletteOverride: "cobalt",
          accentHex: null,
          voicePreset: "expert",
          signatureSettings: {
            mode: "auto",
            fontId: null,
            imageDataUrl: null,
          },
          verbatiStyle: {
            familyId: "workshop",
            layout: "workshop",
            typography: "quiet-editorial",
            palette: "cobalt",
          },
        },
      }),
      {},
    );

    expect(result.savedVoicePreset).toBe("engaging");
    expect(result.voicePreset).toBe("engaging");
  });

  it("keeps the user-wide voice default when activating a visual style slot", async () => {
    const ctx = createCtx({
      _id: "user_1",
      _creationTime: 1,
      clerkId: "clerk_1",
      proposalVoicePreset: "engaging",
      proposalTemplateId: "editorial_wide",
      proposalActivePresetSlot: 1,
      proposalPreset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "cobalt",
        accentHex: null,
        voicePreset: "expert",
        signatureSettings: {
          mode: "auto",
          fontId: null,
          imageDataUrl: null,
        },
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "cobalt",
        },
      },
      updatedAt: 1,
      version: 1,
    });

    await setActivePreset._handler(ctx, { slot: 2 });

    expect(ctx.replace).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        proposalActivePresetSlot: 2,
        proposalVoicePreset: "engaging",
      }),
    );
  });
});
