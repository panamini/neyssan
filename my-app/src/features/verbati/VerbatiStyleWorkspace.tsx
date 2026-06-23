/* eslint-disable @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
import {
  Check,
  Pencil,
  ReadCvLogo,
  SquaresFour,
  BracketsSquare,
  X,
} from "@/lib/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import {
  buildActiveCvSnapshotFromCvDocument,
  formatCvDisplaySubtitle,
} from "../../lib/proposal-personalization";
import { resumeMock } from "./resume/resume.mock";
import {
  DEFAULT_VERBATI_STYLE,
  getLayoutLabel,
  getVerbatiStyleFromCv,
  resolveVerbatiAccentHex,
  stylesEqual,
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_PALETTE_OPTIONS,
  VERBATI_TYPOGRAPHY_OPTIONS,
} from "./style";
import type { VerbatiPreviewSource, VerbatiStylePreset } from "./types";
import { VerbatiResumePreview } from "./VerbatiResumePreview";
import {
  hasRenderableResumeData,
} from "./cvDocumentToResumeData";
import { buildCanonicalResumeRenderModelFromCv } from "../../lib/buildCanonicalResumeRenderModel";
import {
  MAGGIE_LETTER_RESUME_TEMPLATE_ID,
  SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID,
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
} from "../../lib/layout/resumeTemplates";
import { formatUiDate } from "../../lib/ui-date";
import { VerbatiProposalWorkspace } from "./VerbatiProposalWorkspace";

type StyleForgeRenderMode = "resume" | "proposal";

const STYLE_FORGE_RENDER_MODE_STORAGE_KEY = "dasti:style-forge-render-mode:v1";

function readStoredStyleForgeRenderMode(): StyleForgeRenderMode {
  if (typeof window === "undefined") {
    return "resume";
  }

  const storedValue = window.localStorage.getItem(
    STYLE_FORGE_RENDER_MODE_STORAGE_KEY,
  );

  return storedValue === "proposal" ? "proposal" : "resume";
}

function useResponsiveWorkspaceBreakpoint(): boolean {
  const [isNarrow, setIsNarrow] = React.useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 1180,
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1180);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return isNarrow;
}

function cardButtonStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: "var(--radius-card)",
    border: active
      ? "1px solid color-mix(in srgb, var(--color-text) 18%, var(--color-border-strong) 82%)"
      : "1px solid var(--color-border)",
    background: active
      ? "color-mix(in srgb, var(--color-surface-muted) 88%, var(--color-text) 12%)"
      : "var(--sfr)",
    padding: "var(--s4)",
    boxShadow: active
      ? "inset 0 1px 0 color-mix(in srgb, white 12%, transparent), inset 0 0 0 1px color-mix(in srgb, black 10%, transparent)"
      : "none",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: "6px",
    minHeight: 108,
    transition:
      "border-color .14s var(--ez), box-shadow .14s var(--ez), transform .14s var(--ez)",
  };
}

function topbarButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: "var(--hs)",
    padding: "0 var(--s3)",
    borderRadius: "var(--radius-control)",
    border: active
      ? "1px solid color-mix(in srgb, var(--color-text) 18%, var(--color-border-strong) 82%)"
      : "1px solid var(--color-border-strong)",
    background: active
      ? "color-mix(in srgb, var(--color-surface-muted) 86%, var(--color-text) 14%)"
      : "var(--sfr)",
    color: active ? "var(--color-text)" : "var(--tm2)",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: active
      ? "inset 0 1px 0 color-mix(in srgb, white 10%, transparent), inset 0 0 0 1px color-mix(in srgb, black 10%, transparent)"
      : "none",
  };
}

function iconButtonStyle(): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "var(--radius-inline)",
    border: "1px solid var(--color-border-strong)",
    background: "var(--sfr)",
    color: "var(--tm2)",
    cursor: "pointer",
  };
}

function formatActiveCvLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "Switch active CV";
  }
  if (normalized.length <= 18) {
    return normalized;
  }
  return `${normalized.slice(0, 17).trimEnd()}…`;
}

function getActiveColorCardShadow(accentHex: string): string {
  return `inset 0 1px 0 color-mix(in srgb, white 54%, transparent), 0 10px 30px color-mix(in srgb, ${accentHex} 9%, transparent), var(--shadow-sm)`;
}

export function VerbatiStyleWorkspace(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const isNarrow = useResponsiveWorkspaceBreakpoint();
  const {
    cvs,
    currentCv,
    currentCvId,
    saveCurrentCvStyleOnly,
    isLoading,
    loadCv,
  } = useCvLibrary();

  const activeResumeData = React.useMemo(
    () => (currentCv ? buildCanonicalResumeRenderModelFromCv(currentCv) : null),
    [currentCv],
  );
  const hasActiveResume = hasRenderableResumeData(activeResumeData);
  const persistedStyle = React.useMemo(
    () => getVerbatiStyleFromCv(currentCv),
    [currentCv],
  );

  const [stylePreset, setStylePreset] =
    React.useState<VerbatiStylePreset>(persistedStyle);
  const [renderMode, setRenderMode] = React.useState<StyleForgeRenderMode>(() =>
    readStoredStyleForgeRenderMode(),
  );
  const [previewSource, setPreviewSource] =
    React.useState<VerbatiPreviewSource>(hasActiveResume ? "active" : "sample");
  const [compareLayouts, setCompareLayouts] = React.useState(false);
  const [showPresetPanels, setShowPresetPanels] = React.useState(
    () => !isNarrow,
  );
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [pendingStyleCvId, setPendingStyleCvId] = React.useState<string | null>(
    currentCvId,
  );
  const [isPreviewPending, startPreviewTransition] = React.useTransition();
  const lastInitializedCvIdRef = React.useRef<string | null>(currentCvId);
  const lastBreakpointRef = React.useRef(isNarrow);
  const requestedStyleCvIdRef = React.useRef<string | null>(null);
  const customToneInputRef = React.useRef<HTMLInputElement | null>(null);
  const customToneHoverTimerRef = React.useRef<number | null>(null);
  const previewStylePreset = React.useDeferredValue(stylePreset);

  const selectedCvIdFromQuery = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get("id");
    return value ? value.trim() : "";
  }, [location.search]);

  const cvOptions = React.useMemo(() => {
    return [...cvs]
      .sort((left, right) => {
        const leftTime = new Date(
          left.metadata?.updatedAt ?? left.metadata?.createdAt ?? 0,
        ).getTime();
        const rightTime = new Date(
          right.metadata?.updatedAt ?? right.metadata?.createdAt ?? 0,
        ).getTime();
        return rightTime - leftTime;
      })
      .map((cv) => {
        const snapshot = buildActiveCvSnapshotFromCvDocument(cv);
        return {
          id: String(cv.id),
          title: snapshot.title || cv.title || "Resume",
          subtitle:
            formatCvDisplaySubtitle({
              title: snapshot.title,
              profileName: snapshot.personalizationContext?.name,
              desiredPosition: snapshot.personalizationContext?.desiredPosition,
            }) || "Draft resume",
          updatedAt: cv.metadata?.updatedAt,
          createdAt: cv.metadata?.createdAt,
          isActive: String(cv.id) === currentCvId,
        };
      });
  }, [currentCvId, cvs]);

  React.useEffect(() => {
    if (lastBreakpointRef.current === isNarrow) {
      return;
    }
    lastBreakpointRef.current = isNarrow;
    setShowPresetPanels(!isNarrow);
  }, [isNarrow]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      STYLE_FORGE_RENDER_MODE_STORAGE_KEY,
      renderMode,
    );
  }, [renderMode]);

  React.useEffect(() => {
    if (lastInitializedCvIdRef.current === currentCvId) {
      return;
    }

    lastInitializedCvIdRef.current = currentCvId;
    setStylePreset(getVerbatiStyleFromCv(currentCv));
    setPreviewSource(
      hasRenderableResumeData(activeResumeData) ? "active" : "sample",
    );
    setCompareLayouts(false);
  }, [activeResumeData, currentCv, currentCvId]);

  React.useEffect(() => {
    if (!hasActiveResume && previewSource === "active") {
      setPreviewSource("sample");
    }
  }, [hasActiveResume, previewSource]);

  React.useEffect(() => {
    if (!selectedCvIdFromQuery) {
      if (
        currentCvId &&
        location.search !== `?id=${encodeURIComponent(currentCvId)}`
      ) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
        navigate(`/style?id=${encodeURIComponent(currentCvId)}`, {
          replace: true,
        });
      }
      return;
    }

    if (currentCvId === selectedCvIdFromQuery) {
      requestedStyleCvIdRef.current = null;
      if (
        location.search !== `?id=${encodeURIComponent(selectedCvIdFromQuery)}`
      ) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
        navigate(`/style?id=${encodeURIComponent(selectedCvIdFromQuery)}`, {
          replace: true,
        });
      }
      return;
    }

    if (requestedStyleCvIdRef.current === selectedCvIdFromQuery) {
      return;
    }

    const exists = cvs.some((cv) => String(cv.id) === selectedCvIdFromQuery);
    if (!exists) return;

    requestedStyleCvIdRef.current = selectedCvIdFromQuery;
    loadCv(selectedCvIdFromQuery);
  }, [
    currentCvId,
    cvs,
    loadCv,
    location.search,
    navigate,
    selectedCvIdFromQuery,
  ]);

  React.useEffect(() => {
    if (!currentCv || stylesEqual(previewStylePreset, persistedStyle)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentCvStyleOnly(previewStylePreset).catch((error) => {
        console.error(
          "[VerbatiStyleWorkspace] Failed to persist style preset",
          error,
        );
      });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentCv, persistedStyle, previewStylePreset, saveCurrentCvStyleOnly]);

  React.useEffect(() => {
    setPendingStyleCvId(currentCvId);
  }, [currentCvId]);

  const handleConfirmPendingCv = React.useCallback(
    (id: string) => {
      const nextId = id.trim();
      if (!nextId) return;
      requestedStyleCvIdRef.current = nextId;
      setPendingStyleCvId(nextId);
      setIsCvPickerOpen(false);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
      navigate(`/style?id=${encodeURIComponent(nextId)}`);
      loadCv(nextId);
    },
    [loadCv, navigate],
  );

  const handleOpenCvEditor = React.useCallback(
    (id: string | null) => {
      if (id) {
        loadCv(id);
        setIsCvPickerOpen(false);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
        navigate(`/cv?id=${encodeURIComponent(id)}`);
        return;
      }

      if (currentCvId) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
        navigate(`/cv?id=${encodeURIComponent(currentCvId)}`);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Existing fire-and-forget async call is preserved for this release-gate cleanup.
      navigate("/cv");
    },
    [currentCvId, loadCv, navigate],
  );

  const handleOpenCvPicker = React.useCallback(() => {
    setPendingStyleCvId(currentCvId);
    setIsCvPickerOpen(true);
  }, [currentCvId]);

  const handleConfirmSelectedCv = React.useCallback(() => {
    if (!pendingStyleCvId) return;
    handleConfirmPendingCv(pendingStyleCvId);
  }, [handleConfirmPendingCv, pendingStyleCvId]);

  const handleEditSelectedCv = React.useCallback(() => {
    if (!pendingStyleCvId) {
      handleOpenCvEditor(currentCvId);
      return;
    }
    handleOpenCvEditor(pendingStyleCvId);
  }, [currentCvId, handleOpenCvEditor, pendingStyleCvId]);

  const queueStylePreset = React.useCallback(
    (updater: (previous: VerbatiStylePreset) => VerbatiStylePreset) => {
      startPreviewTransition(() => {
        setStylePreset(updater);
      });
    },
    [],
  );

  const previewData =
    previewSource === "active" && hasActiveResume && activeResumeData
      ? activeResumeData
      : resumeMock;
  const activeAccent = resolveVerbatiAccentHex(stylePreset);
  const showActiveCvOption = Boolean(currentCv && hasActiveResume);
  const isLoadedCvPreview = previewSource === "active" && hasActiveResume;

  const openCustomTonePicker = React.useCallback((hoverIntent = false) => {
    const input = customToneInputRef.current;
    if (!input) return;

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      if (hoverIntent) {
        return;
      }
    }

    if (!hoverIntent) {
      input.click();
    }
  }, []);

  const clearCustomToneHoverIntent = React.useCallback(() => {
    if (customToneHoverTimerRef.current !== null) {
      window.clearTimeout(customToneHoverTimerRef.current);
      customToneHoverTimerRef.current = null;
    }
  }, []);

  const queueCustomToneHoverIntent = React.useCallback(() => {
    clearCustomToneHoverIntent();
    customToneHoverTimerRef.current = window.setTimeout(() => {
      openCustomTonePicker(true);
      customToneHoverTimerRef.current = null;
    }, 80);
  }, [clearCustomToneHoverIntent, openCustomTonePicker]);

  React.useEffect(
    () => () => {
      if (customToneHoverTimerRef.current !== null) {
        window.clearTimeout(customToneHoverTimerRef.current);
      }
    },
    [],
  );

  const applyCustomAccent = React.useCallback((nextAccentHex: string) => {
    setStylePreset((previous) => ({
      ...previous,
      palette: "custom",
      accentHex: nextAccentHex,
    }));
  }, []);

  const handleToggleActivePreview = React.useCallback(() => {
    if (isLoadedCvPreview) {
      setPreviewSource("sample");
      return;
    }

    if (showActiveCvOption) {
      setPreviewSource("active");
      return;
    }

    handleOpenCvPicker();
  }, [handleOpenCvPicker, isLoadedCvPreview, showActiveCvOption]);

  const controlsColumn = (
    <aside
      className="dasti-flow"
      style={
        { "--flow-gap": "var(--layout-panel-stack)" } as React.CSSProperties
      }
    >
      <section
        className="dasti-panel dasti-panel--spacious"
        style={{
          gap: "var(--s4)",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div
            style={{
              fontSize: "var(--tx)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--am)",
              fontWeight: 700,
            }}
          >
            Layout
          </div>
          <div
            style={{
              fontFamily: '"Baskervville", serif',
              fontSize: "var(--tl)",
              lineHeight: 1.08,
              color: "var(--ti)",
            }}
          >
            Choose the base resume structure.
          </div>
        </div>

        <div style={{ display: "grid", gap: "var(--s3)" }}>
          {VERBATI_LAYOUT_OPTIONS.map((option) => {
            const optionTemplateId =
              option.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID;
            const displayName =
              optionTemplateId === SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID
                ? "Sanat"
                : optionTemplateId === MAGGIE_LETTER_RESUME_TEMPLATE_ID
                ? "Maggie"
                : optionTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
                ? "French"
                : "Minimal";
            const displayDescription =
              optionTemplateId === SANAT_ASYMMETRIC_RESUME_TEMPLATE_ID
                ? "An asymmetric editorial CV with category-ready skills."
                : optionTemplateId === MAGGIE_LETTER_RESUME_TEMPLATE_ID
                ? "A native US Letter resume with compact editorial lanes."
                : optionTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
                ? "A structured two-column CV with clear sections and hierarchy."
                : "A clean one-column CV that works well with recruiters and application systems.";
            const active = option.resumeTemplateId
              ? option.resumeTemplateId ===
                  (stylePreset.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID)
              : option.id === stylePreset.layout && !stylePreset.resumeTemplateId;
            return (
              <button
                key={`${option.id}:${option.resumeTemplateId ?? "default"}`}
                type="button"
                onClick={() => {
                  queueStylePreset((previous) => ({
                    ...previous,
                    familyId: option.id,
                    layout: option.id,
                    ...(option.resumeTemplateId
                      ? { resumeTemplateId: option.resumeTemplateId }
                      : { resumeTemplateId: undefined }),
                  }));
                  setCompareLayouts(false);
                }}
                className={
                  active
                    ? "styleforge-choice-card styleforge-choice-card--active"
                    : "styleforge-choice-card"
                }
                style={cardButtonStyle(active)}
              >
                <div
                  style={{
                    fontSize: "var(--tb)",
                    fontWeight: 600,
                    color: active
                      ? "color-mix(in srgb, var(--ti) 84%, black 16%)"
                    : "var(--ti)",
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: "var(--ts)",
                    color: active
                      ? "color-mix(in srgb, var(--ti) 70%, var(--tm2) 30%)"
                      : "var(--tm2)",
                    lineHeight: 1.55,
                  }}
                >
                  {displayDescription}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="dasti-panel dasti-panel--spacious"
        style={{
          gap: "var(--s4)",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div
            style={{
              fontSize: "var(--tx)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--am)",
              fontWeight: 700,
            }}
          >
            Typography
          </div>
          <div
            style={{
              fontFamily: '"Baskervville", serif',
              fontSize: "var(--tl)",
              lineHeight: 1.08,
              color: "var(--ti)",
            }}
          >
            Set the document voice.
          </div>
        </div>

        <div style={{ display: "grid", gap: "var(--s3)" }}>
          {VERBATI_TYPOGRAPHY_OPTIONS.map((option) => {
            const active = option.id === stylePreset.typography;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  queueStylePreset((previous) => ({
                    ...previous,
                    typography: option.id,
                  }))
                }
                className={
                  active
                    ? "styleforge-choice-card styleforge-choice-card--active"
                    : "styleforge-choice-card"
                }
                style={cardButtonStyle(active)}
              >
                <div
                  style={{
                    fontFamily: option.headingFamily,
                    fontSize: "var(--tm)",
                    fontWeight: 600,
                    color: active
                      ? "color-mix(in srgb, var(--ti) 84%, black 16%)"
                      : "var(--ti)",
                  }}
                >
                  {option.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--ts)",
                    color: active
                      ? "color-mix(in srgb, var(--ti) 70%, var(--tm2) 30%)"
                      : "var(--tm2)",
                    lineHeight: 1.55,
                  }}
                >
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="dasti-panel dasti-panel--spacious"
        style={{
          gap: "var(--s4)",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div
            style={{
              fontSize: "var(--tx)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--am)",
              fontWeight: 700,
            }}
          >
            Colour
          </div>
          <div
            style={{
              fontFamily: '"Baskervville", serif',
              fontSize: "var(--tl)",
              lineHeight: 1.08,
              color: "var(--ti)",
            }}
          >
            Accent palette with a safe advanced override.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "var(--s2)",
          }}
        >
          {VERBATI_PALETTE_OPTIONS.map((option) => {
            const active =
              stylePreset.palette !== "custom" &&
              option.id === stylePreset.palette;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  queueStylePreset((previous) => ({
                    ...previous,
                    palette: option.id,
                    accentHex: undefined,
                  }))
                }
                title={option.name}
                className={
                  active
                    ? "styleforge-palette-swatch styleforge-palette-swatch--active"
                    : "styleforge-palette-swatch"
                }
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "50%",
                  border: active
                    ? "3px solid var(--sfr)"
                    : "1px solid transparent",
                  background: option.accentHex,
                  boxShadow: active
                    ? `0 0 0 2px ${option.accentHex}, var(--sha)`
                    : "var(--sha)",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>

        <div
          className="styleforge-active-color-card"
          style={{
            boxShadow: getActiveColorCardShadow(activeAccent),
          }}
        >
          <div className="styleforge-active-color-card__stack">
            <div className="styleforge-active-color-card__eyebrow">
              Active Color
            </div>
            <div className="styleforge-active-color-card__hex">
              {activeAccent.toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            className="styleforge-color-wheel styleforge-active-color-card__swatch"
            onMouseEnter={queueCustomToneHoverIntent}
            onMouseLeave={clearCustomToneHoverIntent}
            onFocus={() => openCustomTonePicker(true)}
            onClick={(event) => {
              event.preventDefault();
              openCustomTonePicker(false);
            }}
            aria-label="Open custom color picker"
            title="Open custom color picker"
            style={{
              background: activeAccent,
              boxShadow: `0 0 0 1px ${activeAccent}, 0 12px 26px color-mix(in srgb, ${activeAccent} 22%, transparent)`,
            }}
          >
            <input
              ref={customToneInputRef}
              type="color"
              value={activeAccent}
              onInput={(event) => {
                applyCustomAccent(event.currentTarget.value);
              }}
              onChange={(event) => {
                applyCustomAccent(event.currentTarget.value);
              }}
              aria-label="Choose a custom color"
              tabIndex={-1}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            clearCustomToneHoverIntent();
            queueStylePreset(() => DEFAULT_VERBATI_STYLE);
          }}
          style={topbarButtonStyle(false)}
        >
          Reset to default style
        </button>
      </section>
    </aside>
  );

  const renderModeSwitch = (
    <div
      style={{
        display: "inline-flex",
        gap: "var(--s2)",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => setRenderMode("resume")}
        style={topbarButtonStyle(renderMode === "resume")}
        aria-pressed={renderMode === "resume"}
      >
        Resume render
      </button>
      <button
        type="button"
        onClick={() => setRenderMode("proposal")}
        style={topbarButtonStyle(renderMode === "proposal")}
        aria-pressed={renderMode === "proposal"}
      >
        Proposal render
      </button>
    </div>
  );

  const previewColumn = (
    <section
      className="dasti-flow"
      style={
        {
          "--flow-gap": "var(--layout-panel-stack)",
          alignContent: "start",
        } as React.CSSProperties
      }
    >
      <div
        className="dasti-panel dasti-panel--spacious"
        style={{
          gap: "var(--s3)",
        }}
      >
        <div className="dasti-page-header">
          <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--tx)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--am)",
                fontWeight: 700,
              }}
            >
              Preview
            </div>
            <div
              style={{
                fontFamily: '"Baskervville", serif',
                fontSize: "var(--tx2)",
                lineHeight: 1.04,
                color: "var(--ti)",
              }}
            >
              {compareLayouts
                ? "Tap a layout to expand it, then scroll to compare the others."
                : `${getLayoutLabel(stylePreset.layout)} with the ${
                    stylePreset.typography
                  } voice.`}
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--tm2)",
                lineHeight: 1.6,
                maxWidth: 720,
              }}
            >
              {previewSource === "active" && hasActiveResume
                ? `Previewing the active CV${currentCv?.title ? `: ${currentCv.title}` : ""}.`
                : "Previewing the Verbati sample document until the active CV is available or complete enough."}
            </p>
          </div>

          <div className="dasti-page-actions">
            {renderModeSwitch}
            <div
              className={
                isLoadedCvPreview
                  ? "styleforge-active-cv-control styleforge-active-cv-control--loaded"
                  : "styleforge-active-cv-control styleforge-active-cv-control--ghost"
              }
            >
              <button
                type="button"
                onClick={handleToggleActivePreview}
                className="styleforge-active-cv-control__icon-button"
                aria-label={
                  isLoadedCvPreview
                    ? "Close current CV preview"
                    : showActiveCvOption
                      ? "Return to active CV preview"
                      : "Choose active CV"
                }
                title={
                  isLoadedCvPreview
                    ? "Close current CV preview"
                    : showActiveCvOption
                      ? "Return to active CV preview"
                      : "Choose active CV"
                }
              >
                <span
                  className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--base"
                  aria-hidden
                >
                  <ReadCvLogo size={15} strokeWidth={1.5} />
                </span>
                {isLoadedCvPreview ? (
                  <span
                    className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--hover"
                    aria-hidden
                  >
                    <X size={15} strokeWidth={1.8} />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={handleOpenCvPicker}
                className="styleforge-active-cv-control__body"
                title={currentCv?.title ?? "Switch active CV"}
              >
                <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                  {formatActiveCvLabel(currentCv?.title ?? null)}
                </span>
              </button>
            </div>
            {isNarrow ? (
              <button
                type="button"
                onClick={() => setShowPresetPanels((value) => !value)}
                style={topbarButtonStyle(showPresetPanels)}
              >
                {showPresetPanels ? "Hide presets" : "Open presets"}
              </button>
            ) : null}
            <div
              style={{
                padding: "var(--s2) var(--s3)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-border)",
                background: "var(--sf1)",
                color: "var(--tm2)",
                fontSize: "var(--ts)",
              }}
            >
              {stylePreset.typography}
            </div>
            <div
              style={{
                padding: "var(--s2) var(--s3)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-border)",
                background: "var(--sf1)",
                color: "var(--tm2)",
                fontSize: "var(--ts)",
              }}
            >
              {stylePreset.palette === "custom"
                ? "custom color"
                : stylePreset.palette}
            </div>
            {isPreviewPending ? (
              <span
                style={{
                  padding: "var(--s2) var(--s3)",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--color-border)",
                  background: "var(--sf1)",
                  color: "var(--tm2)",
                  fontSize: "var(--tx)",
                }}
              >
                Updating preview…
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="dasti-stage-card dasti-stage-card--document styleforge-stage-card">
        <button
          type="button"
          onClick={() => setCompareLayouts((value) => !value)}
          className="dasti-icon-button styleforge-stage-card__toggle"
          aria-label={
            compareLayouts ? "Switch to single layout" : "Switch to overview"
          }
          aria-pressed={compareLayouts}
          title={
            compareLayouts ? "Switch to single layout" : "Switch to overview"
          }
        >
          {compareLayouts ? (
            <BracketsSquare size={16} strokeWidth={1.7} aria-hidden />
          ) : (
            <SquaresFour size={16} strokeWidth={1.7} aria-hidden />
          )}
        </button>
        <VerbatiResumePreview
          data={previewData}
          stylePreset={previewStylePreset}
          compareLayouts={compareLayouts}
          onSelectComparisonLayout={(layout) => {
            queueStylePreset((previous) => ({
              ...previous,
              layout,
            }));
            setCompareLayouts(false);
          }}
        />
      </div>
    </section>
  );

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "1480px",
            "--page-shell-gap": "var(--layout-panel-stack)",
          } as React.CSSProperties
        }
      >
        <Dialog
          open={isCvPickerOpen}
          onClose={() => {
            setPendingStyleCvId(currentCvId);
            setIsCvPickerOpen(false);
          }}
          title="Choose active CV"
          className="max-w-3xl"
        >
          <DialogContent className="space-y-3">
            <p
              style={{
                margin: 0,
                color: "var(--tm2)",
                lineHeight: 1.6,
              }}
            >
              Select the CV that StyleForge should style in place. The selected
              document stays inside this workspace and becomes the active
              renderer source.
            </p>
            {cvOptions.length === 0 ? (
              <div
                style={{
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border)",
                  background: "var(--sf1)",
                  padding: "var(--s4)",
                  color: "var(--tm2)",
                }}
              >
                No CVs found yet. Create one in CvForge first, then return here
                to style it.
              </div>
            ) : (
              <div
                className="dasti-grid-auto"
                style={
                  {
                    "--grid-min-col": "260px",
                    "--grid-gap": "var(--space-3)",
                    maxHeight: "58vh",
                    overflowY: "auto",
                  } as React.CSSProperties
                }
              >
                {cvOptions.map((option) => {
                  const isSelected =
                    option.id === (pendingStyleCvId ?? currentCvId);
                  const stamp =
                    formatUiDate(option.updatedAt) ??
                    formatUiDate(option.createdAt) ??
                    "No date";

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPendingStyleCvId(option.id)}
                      className={
                        isSelected
                          ? "ds-card ds-card--elevated dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--cv-library dasti-doc-card--selected"
                          : "ds-card dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--cv-library"
                      }
                      data-interactive="true"
                      aria-pressed={isSelected}
                    >
                      <div className="dasti-doc-card__stack">
                        <div className="dasti-doc-card__header">
                          <div className="dasti-doc-card__title-frame">
                            <h3 className="ds-card__title dasti-doc-card__title">
                              {option.title}
                            </h3>
                          </div>
                        </div>
                        <div className="ds-card__body dasti-doc-card__meta">
                          {option.subtitle}
                        </div>
                        <div className="ds-card__footer dasti-doc-card__footer dasti-doc-card__footer--chooser">
                          <div className="dasti-doc-card__stamp">{stamp}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div
              className="dasti-cluster"
              style={
                {
                  "--cluster-gap": "var(--space-2)",
                  justifyContent: "flex-end",
                  paddingTop: "var(--space-2)",
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="dasti-button dasti-button--secondary dasti-button--sm"
                onClick={handleEditSelectedCv}
                disabled={!pendingStyleCvId}
              >
                <Pencil size={15} strokeWidth={1.6} aria-hidden />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="dasti-button dasti-button--accent dasti-button--sm"
                onClick={handleConfirmSelectedCv}
                disabled={!pendingStyleCvId}
              >
                <Check size={16} strokeWidth={1.9} aria-hidden />
                <span>Confirm</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {!showActiveCvOption ? (
          renderMode === "resume" ? (
            <div
              style={{
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--wa) 20%, transparent)",
                background: "var(--wab)",
                color: "var(--wat)",
                padding: "var(--s3) var(--s4)",
                lineHeight: 1.6,
              }}
            >
              {currentCv
                ? "The active CV exists but it still lacks enough identity or section content for a faithful render, so StyleForge is showing the sample document."
                : "No active CV is loaded yet. StyleForge is showing the sample document until a CV is opened or created."}
            </div>
          ) : null
        ) : null}

        {renderMode === "resume" ? (
          <>
            <div
              className="dasti-grid-split"
              style={
                {
                  "--grid-columns": isNarrow ? "1fr" : "360px minmax(0, 1fr)",
                  "--grid-gap": "var(--layout-split-gap)",
                  "--grid-align": "start",
                } as React.CSSProperties
              }
            >
              {isNarrow ? (
                <>
                  {previewColumn}
                  {showPresetPanels ? controlsColumn : null}
                </>
              ) : (
                <>
                  {controlsColumn}
                  {previewColumn}
                </>
              )}
            </div>

            {isLoading ? (
              <div
                style={{
                  fontSize: "var(--tx)",
                  color: "var(--tm2)",
                  textAlign: "right",
                  paddingBottom: "var(--s5)",
                }}
              >
                Loading CV library…
              </div>
            ) : null}
          </>
        ) : (
          <VerbatiProposalWorkspace
            isNarrow={isNarrow}
            stylePreset={previewStylePreset}
            renderModeSwitch={renderModeSwitch}
          />
        )}
      </div>
    </div>
  );
}
