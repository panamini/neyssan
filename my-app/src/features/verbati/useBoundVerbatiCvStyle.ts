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

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function buildBoundStyleKey(
  currentCv: CvDocument | null | undefined,
  stylePreset: VerbatiStylePreset,
): string {
  return [
    currentCv?.id ?? "no-cv",
    stylePreset.accentHex ?? "",
    stylePreset.familyId,
    stylePreset.layout,
    stylePreset.palette,
    stylePreset.resumeTemplateId ?? "",
    stylePreset.typography,
  ].join(":");
}

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
  const persistedStyleKey = React.useMemo(
    () => buildBoundStyleKey(currentCv, persistedStylePreset),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
    [
      currentCv?.id,
      persistedStylePreset.accentHex,
      persistedStylePreset.familyId,
      persistedStylePreset.layout,
      persistedStylePreset.palette,
      persistedStylePreset.resumeTemplateId,
      persistedStylePreset.typography,
    ],
  );
  const [localStyleState, setLocalStyleState] = React.useState(() => ({
    key: persistedStyleKey,
    stylePreset: persistedStylePreset,
  }));
  const stylePreset =
    localStyleState.key === persistedStyleKey
      ? localStyleState.stylePreset
      : persistedStylePreset;

  useIsomorphicLayoutEffect(() => {
    setLocalStyleState((current) => {
      if (
        current.key === persistedStyleKey &&
        stylesEqual(current.stylePreset, persistedStylePreset)
      ) {
        return current;
      }

      return {
        key: persistedStyleKey,
        stylePreset: persistedStylePreset,
      };
    });
  }, [persistedStyleKey]);

  const setStylePreset = React.useCallback<
    React.Dispatch<React.SetStateAction<VerbatiStylePreset>>
  >(
    (nextStylePreset) => {
      setLocalStyleState((current) => {
        const currentStylePreset =
          current.key === persistedStyleKey
            ? current.stylePreset
            : persistedStylePreset;
        const resolvedStylePreset =
          typeof nextStylePreset === "function"
            ? nextStylePreset(currentStylePreset)
            : nextStylePreset;

        return {
          key: persistedStyleKey,
          stylePreset: canonicalizeVisualStyle(resolvedStylePreset),
        };
      });
    },
    [persistedStyleKey, persistedStylePreset],
  );

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
