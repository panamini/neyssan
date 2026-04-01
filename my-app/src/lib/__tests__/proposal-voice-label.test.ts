import { describe, expect, it } from "vitest";

import { getVoicePresetDisplayLabel } from "../proposal-voice-label";

describe("getVoicePresetDisplayLabel", () => {
  it("maps proposal-facing voice labels consistently", () => {
    expect(getVoicePresetDisplayLabel(null)).toBe("Auto");
    expect(getVoicePresetDisplayLabel(undefined)).toBe("Auto");
    expect(getVoicePresetDisplayLabel("signature")).toBe("Natural");
    expect(getVoicePresetDisplayLabel("expert")).toBe("Formal");
    expect(getVoicePresetDisplayLabel("engaging")).toBe("Warm");
  });
});
