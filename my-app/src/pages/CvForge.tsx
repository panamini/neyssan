import React from "react";
import { useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { isQuickStartCompleted } from "../lib/onboarding-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { Check, Eye, EyeClosed, Palette } from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import ResumeExportControl from "../components/ResumeExportControl";
import type { ResumeExportRequest } from "../components/ResumeExportControl";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";
import type {
  ResumeActiveTarget,
  ResumeLinkIntent,
} from "../features/verbati/resumeLinking";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import { resolveVerbatiStyle } from "../features/verbati/style";
import {
  getProposalStyleDefinition,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import type { ProposalPaletteId } from "../lib/proposal-style-display";
import type { VerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { useToast } from "../components/ui/toast";
import {
  buildAuthoritativeResumeDebugSnapshot,
  buildAuthoritativeResumeExportModel,
  readAuthoritativeResumeFromCv,
} from "../lib/authoritative-resume";
import {
  downloadAuthoritativeResumeExport,
  downloadStandardResumeExport,
} from "../lib/cv-export";
import dbg from "../lib/cv-debug";
import {
  buildResumePrintDebugSnapshot,
  buildResumeExportSource,
  buildStyledResumePrintSource,
} from "../lib/document-export-models";
import {
  buildResumeTypographyAuditMetadata,
  readResumePreviewDebugCapture,
  setStyledResumeExportContext,
} from "../lib/document-export-debug";
import { exportDocumentFile } from "../lib/exportDocumentFile";

type CvForgeWorkspaceMode = "edit" | "preview";
type PresetSlotIndex = 1 | 2 | 3;
type SavedStylePresetSlot = {
  fontPairId: VerbatiFontPairId | null;
  styleChoice: ProposalStyleChoice;
  paletteOverride: ProposalPaletteId | null;
  accentHex: string | null;
  voicePreset: "signature" | "expert" | "engaging" | null;
  name?: string;
};

const CV_FORGE_WORKSPACE_MODE_STORAGE_KEY = "dasti:cv-forge-workspace-mode:v1";
const DEFAULT_PRESET_SLOT_NAMES: Record<PresetSlotIndex, string> = {
  1: "Style 1",
  2: "Style 2",
  3: "Style 3",
};

function readStoredCvForgeWorkspaceMode(): CvForgeWorkspaceMode {
  if (typeof window === "undefined") {
    return "edit";
  }

  return window.localStorage.getItem(CV_FORGE_WORKSPACE_MODE_STORAGE_KEY) ===
    "preview"
    ? "preview"
    : "edit";
}

function normalizePresetSlot(value: unknown): SavedStylePresetSlot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    fontPairId:
      typeof record.fontPairId === "string"
        ? (record.fontPairId as VerbatiFontPairId)
        : null,
    styleChoice:
      typeof record.styleChoice === "string"
        ? (record.styleChoice as ProposalStyleChoice)
        : "auto",
    paletteOverride:
      record.paletteOverride === "sauge" ||
      record.paletteOverride === "ocre" ||
      record.paletteOverride === "pierre" ||
      record.paletteOverride === "bordeaux" ||
      record.paletteOverride === "encre"
        ? (record.paletteOverride as ProposalPaletteId)
        : null,
    accentHex: typeof record.accentHex === "string" ? record.accentHex : null,
    voicePreset:
      record.voicePreset === "signature" ||
      record.voicePreset === "expert" ||
      record.voicePreset === "engaging"
        ? record.voicePreset
        : null,
    name: typeof record.name === "string" ? record.name : undefined,
  };
}

function buildStylePresetFromSettingsSlot(
  preset: SavedStylePresetSlot,
): VerbatiStylePreset {
  const baseStyle = getProposalStyleDefinition(preset.styleChoice).stylePreset;

  return resolveVerbatiStyle({
    ...baseStyle,
    typography: preset.fontPairId ?? baseStyle.typography,
    ...(preset.accentHex
      ? {
          palette: "custom" as const,
          accentHex: preset.accentHex,
        }
      : preset.paletteOverride
        ? { palette: preset.paletteOverride }
        : null),
  });
}

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { currentCv, importCv, cvs, isLibraryHydrated, lastLibraryFetchFailed } =
    useCvLibrary();
  const [quickStartCompleted] = React.useState(() =>
    isQuickStartCompleted(),
  );
  const [hasHandledQuickStartSession, setHasHandledQuickStartSession] =
    React.useState(false);
  // Auto-launch gate:
  // - authoritative source must be settled (isLibraryHydrated)
  // - the authoritative fetch must NOT have failed (transient error must not be
  //   treated as "new user empty library")
  // - user must genuinely have no CVs and no active CV
  // - user must not have explicitly skipped before
  // The completed flag is an input alongside data/hydration, not the authority.
  const shouldAutoLaunchQuickStart =
    isLibraryHydrated &&
    !lastLibraryFetchFailed &&
    cvs.length === 0 &&
    !currentCv &&
    !quickStartCompleted;
  const presetMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() =>
      readStoredCvForgeWorkspaceMode(),
    );
  React.useEffect(() => {
    if (!shouldAutoLaunchQuickStart || hasHandledQuickStartSession) {
      return;
    }

    setHasHandledQuickStartSession(true);
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state: createQuickStartLocationState(location.state),
      },
    );
  }, [
    hasHandledQuickStartSession,
    location.pathname,
    location.search,
    location.state,
    navigate,
    shouldAutoLaunchQuickStart,
  ]);
  const [resumeLinkIntent, setResumeLinkIntent] =
    React.useState<ResumeLinkIntent | null>(null);
  const [resumeActiveTarget, setResumeActiveTarget] =
    React.useState<ResumeActiveTarget | null>(null);

  const handleResumeLinkIntent = React.useCallback(
    (intent: ResumeLinkIntent) => {
      setResumeLinkIntent(intent);
      setResumeActiveTarget({
        sectionType: intent.sectionType,
        previewSectionType: intent.previewSectionType,
        itemId: intent.itemId,
        sectionId: intent.sectionId,
        source: intent.source,
      });
      if (workspaceMode === "preview" && !intent.shouldOpenModal) {
        setWorkspaceMode("edit");
      }
    },
    [workspaceMode],
  );

  const handleResumeLinkIntentHandled = React.useCallback(
    (requestId: string) => {
      setResumeLinkIntent((currentIntent) =>
        currentIntent?.requestId === requestId ? null : currentIntent,
      );
    },
    [],
  );
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    importCv,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const savedStylePresets = useQuery(api.proposalSettings.getPresets);
  const [isStylePresetMenuOpen, setIsStylePresetMenuOpen] =
    React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(
    null,
  );
  const { showToast } = useToast();
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );
  const isSplitCanvas = viewportWidth >= 1240;
  const editorGridMaxWidth =
    workspaceMode === "edit"
      ? "100%"
      : isSplitCanvas
        ? "1240px"
        : "var(--cv-editor-shell-max-width)";

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      CV_FORGE_WORKSPACE_MODE_STORAGE_KEY,
      workspaceMode,
    );
  }, [workspaceMode]);

  React.useEffect(() => {
    if (!isStylePresetMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !presetMenuRef.current?.contains(target)) {
        setIsStylePresetMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsStylePresetMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isStylePresetMenuOpen]);

  const authoritativeResume = React.useMemo(
    () => readAuthoritativeResumeFromCv(currentCv),
    [currentCv],
  );
  const authoritativeExportModel = React.useMemo(
    () => buildAuthoritativeResumeExportModel(authoritativeResume),
    [authoritativeResume],
  );
  const hasTrustedExport = authoritativeExportModel !== null;
  const exportStatusLabel = hasTrustedExport ? "ATS Ready" : "Standard Export";
  const exportStatusDescription = hasTrustedExport
    ? "Trusted Mistral v3"
    : "Not ATS-verified";

  const handleResumeExport = React.useCallback(
    async (request: ResumeExportRequest) => {
      dbg(
        "[CvForge] export authoritative snapshot",
        buildAuthoritativeResumeDebugSnapshot({
          authoritativeResume,
          metadataAuthoritativeResumePresent: Boolean(
            currentCv?.metadata?.authoritativeResume,
          ),
        }),
      );

      if (!currentCv) {
        showToast("Open or create a CV before exporting", {
          variant: "warning",
        });
        return;
      }

      const exportKey =
        request.format === "pdf" ? `pdf:${request.mode}` : request.format;
      setExportingFormat(exportKey);
      try {
        const exported =
          request.format === "pdf" || request.format === "docx"
            ? await (async () => {
                const source =
                  request.format === "pdf" && request.mode === "styled"
                    ? buildStyledResumePrintSource({
                        currentCv,
                        stylePreset,
                      })
                    : buildResumeExportSource({
                        currentCv,
                        authoritativeResume,
                      });

                if (!source) {
                  throw new Error("Resume export source is unavailable.");
                }

                if (
                  request.format === "pdf" &&
                  request.mode === "styled" &&
                  "renderSource" in source
                ) {
                  const previewCapture = readResumePreviewDebugCapture();
                  const exportContext = {
                    cvId: currentCv?.id ? String(currentCv.id) : null,
                    cvUrl:
                      typeof window !== "undefined"
                        ? window.location.href
                        : null,
                    rendererVariantId: source.rendererVariantId,
                    stylePreset: source.stylePreset,
                    previewCapture,
                    timestamp: Date.now(),
                  } as const;
                  setStyledResumeExportContext(exportContext);

                  dbg(
                    "[CvForge] styled resume export snapshot",
                    buildResumePrintDebugSnapshot({
                      stylePreset: source.stylePreset,
                      rendererVariantId: source.rendererVariantId,
                    }),
                  );
                }

                return exportDocumentFile({
                  kind: "resume",
                  format: request.format,
                  mode: request.format === "pdf" ? request.mode : undefined,
                  data: source,
                  stylePreset: stylePreset,
                  fileNameBase:
                    request.format === "docx"
                      ? "Resume - Editable"
                      : request.mode === "ats"
                        ? "Resume - ATS"
                        : "Resume - Styled",
                  metadata:
                    request.format === "pdf" && request.mode === "styled"
                      ? {
                          resumeTypographyAudit:
                            buildResumeTypographyAuditMetadata(
                              currentCv
                                ? {
                                    cvId: String(currentCv.id),
                                    cvUrl:
                                      typeof window !== "undefined"
                                        ? window.location.href
                                        : null,
                                    rendererVariantId: source.rendererVariantId,
                                    stylePreset: source.stylePreset,
                                    previewCapture:
                                      readResumePreviewDebugCapture(),
                                    timestamp: Date.now(),
                                  }
                                : null,
                            ),
                        }
                      : undefined,
                });
              })()
            : hasTrustedExport && authoritativeResume
              ? await downloadAuthoritativeResumeExport({
                  authoritativeResume,
                  format: request.format,
                })
              : await downloadStandardResumeExport({
                  document: currentCv,
                  format: request.format,
                });
        showToast(`Exported ${exported.filename}`, { variant: "success" });
      } catch (error) {
        console.error("[CvForge] export failed", error);
        showToast("Resume export failed", { variant: "error" });
      } finally {
        setExportingFormat(null);
      }
    },
    [authoritativeResume, currentCv, hasTrustedExport, showToast, stylePreset],
  );

  const stylePresetSlots = React.useMemo(
    () =>
      ([1, 2, 3] as const).map((slot) => {
        const rawPreset =
          slot === 1
            ? savedStylePresets?.preset1
            : slot === 2
              ? savedStylePresets?.preset2
              : savedStylePresets?.preset3;
        const preset = normalizePresetSlot(rawPreset);
        const nextStylePreset = preset
          ? buildStylePresetFromSettingsSlot(preset)
          : null;
        return {
          slot,
          label: preset?.name?.trim() || DEFAULT_PRESET_SLOT_NAMES[slot],
          preset,
          stylePreset: nextStylePreset,
          isActive:
            nextStylePreset !== null &&
            nextStylePreset.layout === stylePreset.layout &&
            nextStylePreset.typography === stylePreset.typography &&
            nextStylePreset.palette === stylePreset.palette &&
            String(nextStylePreset.accentHex ?? "") ===
              String(stylePreset.accentHex ?? ""),
        };
      }),
    [savedStylePresets, stylePreset],
  );
  const hasAnySavedStylePreset = stylePresetSlots.some(({ preset }) =>
    Boolean(preset),
  );
  const stylePresetToolbarLabel = hasAnySavedStylePreset
    ? "Open saved resume styles"
    : "Open resume style controls";
  const stylePresetToolbarTooltip = hasAnySavedStylePreset
    ? "Saved styles"
    : "Style controls";
  const stylePresetToolbarControl = (
    <div
      ref={presetMenuRef}
      className="dasti-import-dropdown dasti-cv-style-presets"
      data-open={isStylePresetMenuOpen ? "true" : "false"}
      style={{ flex: "0 0 auto" }}
    >
      <button
        type="button"
        className="dasti-icon-button"
        aria-label={stylePresetToolbarLabel}
        aria-expanded={
          hasAnySavedStylePreset ? isStylePresetMenuOpen : undefined
        }
        aria-haspopup={hasAnySavedStylePreset ? "menu" : undefined}
        data-toolbar-tooltip={stylePresetToolbarTooltip}
        onClick={() => {
          if (!hasAnySavedStylePreset) {
            setWorkspaceMode("preview");
            return;
          }
          setIsStylePresetMenuOpen((current) => !current);
        }}
      >
        <Palette size={16} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {isStylePresetMenuOpen ? (
        <div
          className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-cv-style-presets__menu"
          role="menu"
          aria-label="Saved resume styles"
        >
          {stylePresetSlots.map(
            ({ slot, label, preset, stylePreset: nextStyle, isActive }) => (
              <button
                key={slot}
                type="button"
                role="menuitemradio"
                className="dasti-cv-style-presets__option"
                disabled={!preset || !nextStyle}
                aria-checked={isActive}
                onClick={() => {
                  if (!nextStyle) {
                    return;
                  }
                  setStylePreset(nextStyle);
                  setIsStylePresetMenuOpen(false);
                }}
              >
                <span className="dasti-cv-style-presets__option-copy">
                  <span className="dasti-cv-style-presets__option-title">
                    {label}
                  </span>
                  <span className="dasti-cv-style-presets__option-description">
                    {preset
                      ? `${nextStyle ? nextStyle.layout : "swiss"} / ${preset.fontPairId ?? "default"}`
                      : "No saved style"}
                  </span>
                </span>
                {isActive ? (
                  <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );

  const editModeToggle = (
    <button
      type="button"
      className="dasti-icon-button"
      aria-label="Open resume preview"
      onClick={() => setWorkspaceMode("preview")}
      data-toolbar-tooltip="Switch to preview"
      data-no-pan="true"
    >
      <Eye size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );

  const previewModeLeadControl = (
    <button
      type="button"
      className="dasti-cv-workbench-toggle__button"
      aria-label="Back to resume editing"
      onClick={() => setWorkspaceMode("edit")}
      data-toolbar-tooltip="Back to edit"
      data-no-pan="true"
    >
      <EyeClosed size={15} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
  const resumeExportControl = (
    <ResumeExportControl
      exportingFormat={exportingFormat}
      menuLabel="More export formats"
      onExport={handleResumeExport}
      statusDescription={exportStatusDescription}
      statusLabel={exportStatusLabel}
      statusTone={hasTrustedExport ? "trusted" : "standard"}
    />
  );
  const cvWorkbenchShellStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: editorGridMaxWidth,
    marginInline: "auto",
  };

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className="dasti-page-shell dasti-page-shell--cv-forge"
        style={
          {
            "--page-shell-max-width": "100%",
            "--page-shell-gap": "var(--space-2)",
            "--page-shell-pad-top":
              workspaceMode === "preview" ? "0px" : "var(--space-2)",
            "--page-shell-pad-inline":
              workspaceMode === "preview" ? "0px" : "var(--space-4)",
            "--page-shell-pad-bottom": "var(--space-1)",
            "--cv-preview-toolbar-inset":
              workspaceMode === "preview" ? "var(--space-2)" : undefined,
            "--page-shell-pad-top-mobile":
              workspaceMode === "preview" ? "0px" : "var(--space-2)",
            "--page-shell-pad-inline-mobile":
              workspaceMode === "preview" ? "0px" : "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "var(--space-1)",
          } as React.CSSProperties
        }
      >
        {workspaceMode === "preview" ? (
          <>
            {currentCv ? (
              <div style={{ display: "none" }} aria-hidden="true">
                <ProfileReviewCard
                  cvId={requestedCvId}
                  exportingFormat={exportingFormat}
                  exportStatusDescription={exportStatusDescription}
                  exportStatusLabel={exportStatusLabel}
                  exportStatusTone={hasTrustedExport ? "trusted" : "standard"}
                  onRequestExport={handleResumeExport}
                  resumeLinkIntent={
                    resumeLinkIntent?.shouldOpenModal ? resumeLinkIntent : null
                  }
                  onResumeLinkIntentHandled={handleResumeLinkIntentHandled}
                  activeTarget={resumeActiveTarget}
                  onActiveTargetChange={setResumeActiveTarget}
                />
              </div>
            ) : null}
            <div className="dasti-cv-preview-workbench">
              <div className="dasti-cv-preview-workbench__main">
                <VerbatiCvPreviewPanel
                  layoutMode="stacked"
                  hostMode="workspace"
                  railLeadControl={previewModeLeadControl}
                  railTrailingControl={resumeExportControl}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
                  onLinkIntent={handleResumeLinkIntent}
                  activeTarget={resumeActiveTarget}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="dasti-cv-edit-workbench-shell"
              style={cvWorkbenchShellStyle}
            >
              <div
                className="dasti-grid-split"
                style={
                  {
                    "--grid-columns": isSplitCanvas
                      ? "minmax(0, 1fr) clamp(392px, 36vw, 468px)"
                      : "minmax(0, 1fr)",
                    "--grid-gap": "var(--layout-card-grid)",
                    "--grid-align": "start",
                  } as React.CSSProperties
                }
              >
                <ProfileReviewCard
                  cvId={requestedCvId}
                  exportingFormat={exportingFormat}
                  exportStatusDescription={exportStatusDescription}
                  exportStatusLabel={exportStatusLabel}
                  exportStatusTone={hasTrustedExport ? "trusted" : "standard"}
                  toolbarLeadControl={editModeToggle}
                  toolbarPrimaryControl={stylePresetToolbarControl}
                  onRequestExport={handleResumeExport}
                  resumeLinkIntent={resumeLinkIntent}
                  onResumeLinkIntentHandled={handleResumeLinkIntentHandled}
                  activeTarget={resumeActiveTarget}
                  onActiveTargetChange={setResumeActiveTarget}
                />
                <div
                  className={
                    isSplitCanvas
                      ? "dasti-cv-preview-panel-slot dasti-cv-preview-panel-slot--sticky"
                      : "dasti-cv-preview-panel-slot"
                  }
                >
                  <VerbatiCvPreviewPanel
                    layoutMode={isSplitCanvas ? "rail" : "stacked"}
                    hostMode="panel"
                    stylePreset={stylePreset}
                    onStylePresetChange={setStylePreset}
                    onLinkIntent={handleResumeLinkIntent}
                    activeTarget={resumeActiveTarget}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
