import React from "react";
import { ArrowLeft, ArrowRight, ReadCvLogo } from "@/lib/icons";
import EmbeddedStyleInspector from "../../components/EmbeddedStyleInspector";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { resumeMock } from "./resume/resume.mock";
import {
  getVerbatiStyleFromCv,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
} from "./style";
import {
  getVerbatiStyleBundleDefinition,
  resolveVerbatiStyleBundleId,
  VERBATI_STYLE_BUNDLE_DEFINITIONS,
} from "./styleBundles";
import { VerbatiResumePreview } from "./VerbatiResumePreview";
import {
  hasRenderableResumeData,
  mapCvDocumentToResumeData,
} from "./cvDocumentToResumeData";
import type { VerbatiPreviewSource } from "./types";

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
  const [previewSource, setPreviewSource] =
    React.useState<VerbatiPreviewSource>(() =>
      hasActiveResume ? "active" : "sample",
    );
  const [uncontrolledStylePreset, setUncontrolledStylePreset] =
    React.useState(persistedStylePreset);
  const stylePreset = controlledStylePreset ?? uncontrolledStylePreset;
  const setStylePreset = onStylePresetChange ?? setUncontrolledStylePreset;
  const lastResolvedCvIdRef = React.useRef<string | null>(
    currentCv?.id ? String(currentCv.id) : null,
  );
  const previewData =
    previewSource === "active" && hasActiveResume && activeData
      ? activeData
      : resumeMock;
  const isActivePreview = previewSource === "active" && hasActiveResume;
  const activeBundleId = React.useMemo(() => {
    const exactBundleId = resolveVerbatiStyleBundleId({
      stylePreset,
    });
    if (exactBundleId) {
      return exactBundleId;
    }

    const nearestBundle =
      VERBATI_STYLE_BUNDLE_DEFINITIONS.find(
        (bundle) =>
          bundle.stylePreset.layout === stylePreset.layout &&
          bundle.stylePreset.typography === stylePreset.typography,
      ) ??
      VERBATI_STYLE_BUNDLE_DEFINITIONS.find(
        (bundle) => bundle.stylePreset.layout === stylePreset.layout,
      ) ??
      VERBATI_STYLE_BUNDLE_DEFINITIONS[0];

    return nearestBundle?.id ?? null;
  }, [stylePreset]);
  const activeBundleIndex = React.useMemo(() => {
    const matchedIndex = VERBATI_STYLE_BUNDLE_DEFINITIONS.findIndex(
      (bundle) => bundle.id === activeBundleId,
    );
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [activeBundleId]);

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
    const nextCvId = currentCv?.id ? String(currentCv.id) : null;

    if (lastResolvedCvIdRef.current !== nextCvId) {
      lastResolvedCvIdRef.current = nextCvId;
      setPreviewSource(hasActiveResume ? "active" : "sample");
      return;
    }

    if (!hasActiveResume && previewSource === "active") {
      setPreviewSource("sample");
    }
  }, [currentCv?.id, hasActiveResume, previewSource]);

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

  const handleCycleBundle = React.useCallback(
    (direction: -1 | 1) => {
      const nextIndex =
        (activeBundleIndex +
          direction +
          VERBATI_STYLE_BUNDLE_DEFINITIONS.length) %
        VERBATI_STYLE_BUNDLE_DEFINITIONS.length;
      const nextBundle = VERBATI_STYLE_BUNDLE_DEFINITIONS[nextIndex];
      if (!nextBundle) {
        return;
      }

      setStylePreset(resolveVerbatiStyle(nextBundle.stylePreset));
    },
    [activeBundleIndex, setStylePreset],
  );
  const previousBundleLabel = React.useMemo(
    () =>
      VERBATI_STYLE_BUNDLE_DEFINITIONS[
        (activeBundleIndex - 1 + VERBATI_STYLE_BUNDLE_DEFINITIONS.length) %
          VERBATI_STYLE_BUNDLE_DEFINITIONS.length
      ]?.label ?? "Previous style",
    [activeBundleIndex],
  );
  const nextBundleLabel = React.useMemo(
    () =>
      VERBATI_STYLE_BUNDLE_DEFINITIONS[
        (activeBundleIndex + 1) % VERBATI_STYLE_BUNDLE_DEFINITIONS.length
      ]?.label ?? "Next style",
    [activeBundleIndex],
  );
  const handleWorkspaceStyleCycleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleCycleBundle(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleCycleBundle(1);
      }
    },
    [handleCycleBundle],
  );
  const workspaceStyleCycleControls =
    hostMode === "workspace" ? (
      <div
        className="dasti-resume-style-cycle"
        role="group"
        aria-label="Switch resume styles"
        onKeyDown={handleWorkspaceStyleCycleKeyDown}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--proposal-chrome-tight-gap)",
          flex: "0 0 auto",
        }}
      >
        <button
          type="button"
          className="dasti-icon-button"
          onClick={() => handleCycleBundle(-1)}
          aria-label={`Show previous resume style: ${previousBundleLabel}`}
          data-toolbar-tooltip={previousBundleLabel}
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dasti-icon-button"
          onClick={() => handleCycleBundle(1)}
          aria-label={`Show next resume style: ${nextBundleLabel}`}
          data-toolbar-tooltip={nextBundleLabel}
        >
          <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    ) : null;
  const workspacePreviewSourceControl =
    hostMode === "workspace" ? (
      <div
        className={
          isActivePreview
            ? "styleforge-active-cv-control styleforge-active-cv-control--loaded"
            : "styleforge-active-cv-control styleforge-active-cv-control--ghost"
        }
      >
        <button
          type="button"
          className="styleforge-active-cv-control__icon-button"
          onClick={() =>
            setPreviewSource((current) =>
              current === "active" ? "sample" : "active",
            )
          }
          aria-label={
            isActivePreview
              ? "Switch to sample preview"
              : hasActiveResume
                ? "Switch to active CV preview"
                : "Active CV preview unavailable"
          }
          title={
            isActivePreview
              ? "Preview the sample CV"
              : hasActiveResume
                ? "Preview the active CV"
                : "Active CV preview unavailable"
          }
          disabled={!isActivePreview && !hasActiveResume}
        >
          <span
            className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--base"
            aria-hidden
          >
            <ReadCvLogo size={15} strokeWidth={1.5} />
          </span>
        </button>
        <button
          type="button"
          className="styleforge-active-cv-control__body"
          onClick={() =>
            setPreviewSource((current) =>
              current === "active" ? "sample" : "active",
            )
          }
          aria-label={
            isActivePreview
              ? "Previewing active CV"
              : hasActiveResume
                ? "Previewing sample CV"
                : "Previewing sample CV because the active CV is unavailable"
          }
          title={
            isActivePreview
              ? currentCv?.title ?? "Active CV"
              : "Verbati sample CV"
          }
          disabled={!isActivePreview && !hasActiveResume}
        >
          <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
            {isActivePreview ? currentCv?.title ?? "Active CV" : "Sample CV"}
          </span>
        </button>
      </div>
    ) : null;

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
              <>
                {workspacePreviewSourceControl}
                {workspacePreviewSourceControl ? (
                  <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
                ) : null}
                {workspaceStyleCycleControls}
                {workspaceStyleCycleControls ? (
                  <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
                ) : null}
                <EmbeddedStyleInspector
                  stylePreset={stylePreset}
                  copyMode="title-only"
                  bundleOptions={VERBATI_STYLE_BUNDLE_DEFINITIONS}
                  activeBundleIdOverride={activeBundleId}
                  showCustomizeControl={false}
                  showPromptControl={false}
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
              </>
            }
          />
        </div>
      ) : (
        <div className="dasti-stage-card dasti-stage-card--document dasti-stage-card--mini-render">
          <VerbatiResumePreview
            data={previewData}
            stylePreset={stylePreset}
            hostMode="panel"
          />
        </div>
      )}
    </>
  );

  return (
    <section
      className={[
        "dasti-panel",
        "dasti-flow",
        "dasti-resume-preview-panel",
        hostMode === "panel" ? "dasti-panel--spacious" : "",
        hostMode === "workspace"
          ? "dasti-resume-preview-panel--workspace"
          : "dasti-resume-preview-panel--panel",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background:
          "linear-gradient(180deg, var(--sf2), color-mix(in srgb, var(--sf1) 88%, var(--bg) 12%))",
      }}
    >
      {previewSurface}
    </section>
  );
}

export default VerbatiCvPreviewPanel;
