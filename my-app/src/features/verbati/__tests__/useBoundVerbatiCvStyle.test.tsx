import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCvTemplateV1 } from "../../../lib/cv-template";
import { useBoundVerbatiCvStyle } from "../useBoundVerbatiCvStyle";

describe("useBoundVerbatiCvStyle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("persists canonicalized verbatiStyle metadata through importCv", async () => {
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
        layout: "swiss",
        palette: "bordeaux",
        typography: "engaging",
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
            layout: "swiss",
            palette: "bordeaux",
            typography: "soft-serif",
            accentHex: undefined,
          },
        }),
      }),
    );
  });
});
