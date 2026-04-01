import React from "react";
import EmbeddedStyleInspector from "../../components/EmbeddedStyleInspector";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { resumeMock } from "./resume/resume.mock";
import {
  getLayoutLabel,
  getVerbatiStyleFromCv,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
  VERBATI_LAYOUT_OPTIONS,
} from "./style";
import { getVerbatiStyleBundleDefinition } from "./styleBundles";
import { VerbatiResumePreview } from "./VerbatiResumePreview";
import {
  hasRenderableResumeData,
  mapCvDocumentToResumeData,
} from "./cvDocumentToResumeData";

type VerbatiCvPreviewPanelProps = {
  layoutMode?: "rail" | "stacked";
  hostMode?: "panel" | "workspace";
  railLeadControl?: React.ReactNode;
  stylePreset?: ReturnType<typeof getVerbatiStyleFromCv>;
  onStylePresetChange?: React.Dispatch<
    React.SetStateAction<ReturnType<typeof getVerbatiStyleFromCv>>
  >;
};

export function VerbatiCvPreviewPanel({
  layoutMode: _layoutMode = "stacked",
  hostMode = "panel",
  railLeadControl = null,
  stylePreset: controlledStylePreset,
  onStylePresetChange,
}: VerbatiCvPreviewPanelProps): JSX.Element {
  const { currentCv, importCv } = useCvLibrary();
  const persistedStylePreset = React.useMemo(
    () => getVerbatiStyleFromCv(currentCv),
    [currentCv],
  );
  const activeData = React.useMemo(
    () => (currentCv ? mapCvDocumentToResumeData(currentCv) : null),
    [currentCv],
  );
  const hasActiveResume = hasRenderableResumeData(activeData);
  const previewData = hasActiveResume ? (activeData ?? resumeMock) : resumeMock;
  const [uncontrolledStylePreset, setUncontrolledStylePreset] =
    React.useState(persistedStylePreset);
  const stylePreset = controlledStylePreset ?? uncontrolledStylePreset;
  const setStylePreset = onStylePresetChange ?? setUncontrolledStylePreset;
  const layoutOptions = React.useMemo(
    () => VERBATI_LAYOUT_OPTIONS.map((option) => option.id),
    [],
  );
  const activeLayoutIndex = React.useMemo(() => {
    const matchedIndex = layoutOptions.indexOf(stylePreset.layout);
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [layoutOptions, stylePreset.layout]);

  React.useEffect(() => {
    if (controlledStylePreset) {
      return;
    }

    setStylePreset(persistedStylePreset);
  }, [
    controlledStylePreset,
    currentCv?.id,
    persistedStylePreset.accentHex,
    persistedStylePreset.layout,
    persistedStylePreset.palette,
    persistedStylePreset.typography,
  ]);

  React.useEffect(() => {
    if (!currentCv || stylesEqual(stylePreset, persistedStylePreset)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextDoc = {
        ...currentCv,
        metadata: {
          ...currentCv.metadata,
          updatedAt: new Date().toISOString(),
          verbatiStyle: serializeVerbatiStyle(stylePreset),
        },
      };

      void importCv(nextDoc).catch((error) => {
        console.error(
          "[VerbatiCvPreviewPanel] Failed to persist style preset",
          error,
        );
      });
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentCv, importCv, persistedStylePreset, stylePreset]);

  const handleCycleLayout = React.useCallback(
    (direction: -1 | 1) => {
      const nextIndex =
        (activeLayoutIndex + direction + layoutOptions.length) %
        layoutOptions.length;
      const nextLayout = layoutOptions[nextIndex];
      setStylePreset((current) =>
        resolveVerbatiStyle({ ...current, layout: nextLayout }),
      );
    },
    [activeLayoutIndex, layoutOptions],
  );

  const previousLayoutLabel = React.useMemo(
    () =>
      getLayoutLabel(
        layoutOptions[
          (activeLayoutIndex - 1 + layoutOptions.length) % layoutOptions.length
        ],
      ),
    [activeLayoutIndex, layoutOptions],
  );
  const nextLayoutLabel = React.useMemo(
    () =>
      getLayoutLabel(
        layoutOptions[(activeLayoutIndex + 1) % layoutOptions.length],
      ),
    [activeLayoutIndex, layoutOptions],
  );

  const previewSurface = (
    <>
      {!hasActiveResume ? (
        <div
          style={{
            borderRadius: "var(--radius-card)",
            border: "1px solid color-mix(in srgb, var(--wa) 22%, transparent)",
            background: "var(--wab)",
            color: "var(--wat)",
            padding: "var(--s3) var(--s4)",
            fontSize: "var(--ts)",
            lineHeight: 1.55,
          }}
        >
          The active CV is still too sparse for a faithful render, so this panel
          is showing the Verbati sample document until profile, summary, or
          experience content is filled in.
        </div>
      ) : null}

      {hostMode === "workspace" ? (
        <div className="dasti-resume-preview-panel__surface dasti-resume-preview-panel__surface--workspace">
          <VerbatiResumePreview
            data={previewData}
            stylePreset={stylePreset}
            hostMode="workspace"
            railLeadControl={railLeadControl}
            railStartAddon={
              <EmbeddedStyleInspector
                stylePreset={stylePreset}
                copyMode="title-only"
                controlMode="direct"
                onSelectBundle={(bundleId) => {
                  const bundle = getVerbatiStyleBundleDefinition(bundleId);
                  setStylePreset(resolveVerbatiStyle(bundle.stylePreset));
                }}
                onSelectLayout={(layout) =>
                  setStylePreset((current) =>
                    resolveVerbatiStyle({ ...current, layout }),
                  )
                }
                onSelectTypography={(typography) =>
                  setStylePreset((current) =>
                    resolveVerbatiStyle({ ...current, typography }),
                  )
                }
                onSelectPalette={(palette) =>
                  setStylePreset((current) =>
                    resolveVerbatiStyle({
                      ...current,
                      palette,
                      accentHex: undefined,
                    }),
                  )
                }
                onSelectCustomAccent={(accentHex) =>
                  setStylePreset((current) =>
                    resolveVerbatiStyle({
                      ...current,
                      palette: "custom",
                      accentHex,
                    }),
                  )
                }
              />
            }
          />
        </div>
      ) : (
        <div className="dasti-stage-card dasti-stage-card--document dasti-stage-card--mini-render">
          <VerbatiResumePreview
            data={previewData}
            stylePreset={stylePreset}
            hostMode="panel"
            panelNavigation={{
              onPrevious: () => handleCycleLayout(-1),
              onNext: () => handleCycleLayout(1),
              previousLabel: `Show previous resume layout: ${previousLayoutLabel}`,
              nextLabel: `Show next resume layout: ${nextLayoutLabel}`,
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <section
      className={[
        "dasti-panel",
        "dasti-panel--spacious",
        "dasti-flow",
        "dasti-resume-preview-panel",
        hostMode === "workspace"
          ? "dasti-resume-preview-panel--workspace"
          : "dasti-resume-preview-panel--panel",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: "linear-gradient(180deg, var(--sfr), var(--sf1))",
      }}
    >
      {previewSurface}
    </section>
  );
}

export default VerbatiCvPreviewPanel;
