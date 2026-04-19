import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCvTemplateV1 } from "../../../lib/cv-template";
import { useBoundVerbatiCvStyle } from "../useBoundVerbatiCvStyle";

describe("useBoundVerbatiCvStyle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("persists the exact valid style snapshot through importCv", async () => {
    const currentCv = generateCvTemplateV1("Verbati Hook CV");
    const importCv = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useBoundVerbatiCvStyle({
        currentCv,
        importCv,
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

    expect(importCv).toHaveBeenCalledTimes(1);
    expect(importCv).toHaveBeenCalledWith(
      expect.objectContaining({
        id: currentCv.id,
        metadata: expect.objectContaining({
          verbatiStyle: {
            layout: "editorial",
            palette: "custom",
            typography: "civic-correspondence",
            accentHex: "#aa7733",
          },
        }),
      }),
    );
  });
});
