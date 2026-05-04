import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCvTemplateV1 } from "../../../lib/cv-template";
import { useBoundVerbatiCvStyle } from "../useBoundVerbatiCvStyle";

describe("useBoundVerbatiCvStyle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("persists the exact valid style snapshot through the style-only callback", async () => {
    const currentCv = generateCvTemplateV1("Verbati Hook CV");
    const persistStyle = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useBoundVerbatiCvStyle({
        currentCv,
        persistStyle,
        debounceMs: 25,
      }),
    );

    act(() => {
      result.current.setStylePreset({
        layout: "editorial",
        palette: "custom",
        accentHex: "#AA7733",
        typography: "civic-correspondence",
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(30);
      await Promise.resolve();
    });

    expect(persistStyle).toHaveBeenCalledTimes(1);
    expect(persistStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: "editorial",
        layout: "editorial",
        palette: "custom",
        typography: "civic-correspondence",
        accentHex: "#aa7733",
      }),
    );
  });
});
