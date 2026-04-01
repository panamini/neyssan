import React from "react";
import type { CvDocument } from "../../types/cvDocument";
import type { VerbatiStylePreset } from "./types";
import {
  getVerbatiStyleFromCv,
  serializeVerbatiStyle,
  stylesEqual,
} from "./style";

type UseBoundVerbatiCvStyleArgs = {
  currentCv: CvDocument | null | undefined;
  importCv: (doc: CvDocument) => Promise<void>;
  debounceMs?: number;
  logPrefix?: string;
};

type UseBoundVerbatiCvStyleResult = {
  stylePreset: VerbatiStylePreset;
  setStylePreset: React.Dispatch<React.SetStateAction<VerbatiStylePreset>>;
};

export function useBoundVerbatiCvStyle({
  currentCv,
  importCv,
  debounceMs = 700,
  logPrefix = "[useBoundVerbatiCvStyle]",
}: UseBoundVerbatiCvStyleArgs): UseBoundVerbatiCvStyleResult {
  const persistedStylePreset = React.useMemo(
    () => getVerbatiStyleFromCv(currentCv),
    [currentCv],
  );
  const [stylePreset, setStylePreset] = React.useState(persistedStylePreset);

  React.useEffect(() => {
    setStylePreset(persistedStylePreset);
  }, [
    currentCv?.id,
    persistedStylePreset.accentHex,
    persistedStylePreset.layout,
    persistedStylePreset.palette,
    persistedStylePreset.typography,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!currentCv || stylesEqual(stylePreset, persistedStylePreset)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextDoc: CvDocument = {
        ...currentCv,
        metadata: {
          ...currentCv.metadata,
          updatedAt: new Date().toISOString(),
          verbatiStyle: serializeVerbatiStyle(stylePreset),
        },
      };

      void importCv(nextDoc).catch((error) => {
        console.error(`${logPrefix} Failed to persist style preset`, error);
      });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentCv,
    debounceMs,
    importCv,
    logPrefix,
    persistedStylePreset,
    stylePreset,
  ]);

  return { stylePreset, setStylePreset };
}
