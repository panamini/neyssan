import React from "react";
import type { CvDocument } from "../../types/cvDocument";
import type { VerbatiStylePreset } from "./types";
import { getVerbatiStyleFromCv, stylesEqual } from "./style";
import { canonicalizeVisualStyle } from "./styleState";

type UseBoundVerbatiCvStyleArgs = {
  currentCv: CvDocument | null | undefined;
  persistStyle: (style: VerbatiStylePreset) => Promise<void>;
  fallbackStylePreset?: VerbatiStylePreset | null;
  debounceMs?: number;
  logPrefix?: string;
};

type UseBoundVerbatiCvStyleResult = {
  stylePreset: VerbatiStylePreset;
  setStylePreset: React.Dispatch<React.SetStateAction<VerbatiStylePreset>>;
};

export function useBoundVerbatiCvStyle({
  currentCv,
  persistStyle,
  fallbackStylePreset = null,
  debounceMs = 700,
  logPrefix = "[useBoundVerbatiCvStyle]",
}: UseBoundVerbatiCvStyleArgs): UseBoundVerbatiCvStyleResult {
  const persistedStylePreset = React.useMemo(() => {
    const metadata = currentCv?.metadata as Record<string, unknown> | undefined;
    const hasStyleSignals = Boolean(
      metadata &&
        (metadata.verbatiStyle ||
          metadata.verbatiStyleBaseSnapshot ||
          metadata.verbatiStyleSlotId ||
          metadata.verbatiStyleSlotSource ||
          metadata.verbatiStyleSlotNameSnapshot),
    );

    if (!hasStyleSignals && fallbackStylePreset) {
      return canonicalizeVisualStyle(fallbackStylePreset);
    }

    return canonicalizeVisualStyle(getVerbatiStyleFromCv(currentCv));
  }, [currentCv, fallbackStylePreset]);
  const [stylePreset, setStylePreset] = React.useState(persistedStylePreset);

  React.useEffect(() => {
    setStylePreset(persistedStylePreset);
  }, [
    currentCv?.id,
    persistedStylePreset.accentHex,
    persistedStylePreset.layout,
    persistedStylePreset.palette,
    persistedStylePreset.resumeTemplateId,
    persistedStylePreset.typography,
  ]);

  React.useEffect(() => {
    const canonicalStylePreset = canonicalizeVisualStyle(stylePreset);

    if (typeof window === "undefined") {
      return;
    }

    if (!currentCv || stylesEqual(canonicalStylePreset, persistedStylePreset)) {
      return;
    }

    if (typeof persistStyle !== "function") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistStyle(canonicalStylePreset).catch((error) => {
        console.error(`${logPrefix} Failed to persist style preset`, error);
      });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentCv,
    debounceMs,
    persistStyle,
    logPrefix,
    persistedStylePreset,
    stylePreset,
  ]);

  return { stylePreset, setStylePreset };
}
