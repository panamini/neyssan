import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateCvTemplateV1 } from "../../../lib/cv-template";
import { SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID } from "../../../lib/layout/resumeTemplates";
import type { CvDocument } from "../../../types/cvDocument";
import type { VerbatiStylePreset } from "../types";
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

  it("returns a restored CV template synchronously on the first render for a new CV", () => {
    const currentCv = generateCvTemplateV1("Sanat CV");
    const sanatCv: CvDocument = {
      ...currentCv,
      metadata: {
        ...currentCv.metadata,
        resumeTemplateId: SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "sauge",
          resumeTemplateId: SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
        },
        verbatiStyleBaseSnapshot: {
          familyId: "workshop",
          layout: "workshop",
          typography: "geist-baskervville",
          palette: "sauge",
          resumeTemplateId: SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
        },
      },
    };
    const renderSequence: Array<VerbatiStylePreset["resumeTemplateId"] | null> =
      [];
    const persistStyle = vi.fn().mockResolvedValue(undefined);

    function Probe({ cv }: { cv: CvDocument | null }) {
      const { stylePreset } = useBoundVerbatiCvStyle({
        currentCv: cv,
        persistStyle,
        debounceMs: 25,
      });
      renderSequence.push(stylePreset.resumeTemplateId ?? null);
      return null;
    }

    const { rerender } = render(<Probe cv={null} />);
    const beforeRestoreRenderCount = renderSequence.length;

    rerender(<Probe cv={sanatCv} />);

    expect(renderSequence[beforeRestoreRenderCount]).toBe(
      SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
    );
  });
});
