import React from "react";
import { useQuery } from "convex/react";
import { useLocation } from "react-router-dom";
import { Check, Eye, FilePdf, Palette, X } from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import { resolveVerbatiStyle } from "../features/verbati/style";
import {
  printFirstMatchingNodeAsPdf,
  type DocumentExportCloneContext,
} from "../lib/document-export";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../lib/document-stage";
import {
  getProposalStyleDefinition,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import type { ProposalPaletteId } from "../lib/proposal-style-display";
import type { VerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";

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

function getExportCloneNode(
  root: HTMLElement,
  selector: string,
): HTMLElement | null {
  if (root.matches(selector)) {
    return root;
  }

  return root.querySelector<HTMLElement>(selector);
}

function normalizeResumeExportClone({
  clonedNode,
}: DocumentExportCloneContext): void {
  const pageWidth = `${A4_PAGE_WIDTH_PX}px`;
  const pageHeight = `${A4_PAGE_HEIGHT_PX}px`;
  const nodes = [
    clonedNode,
    getExportCloneNode(clonedNode, ".resume-page-frame"),
    getExportCloneNode(clonedNode, ".resume-page-stage"),
  ].filter((node): node is HTMLElement => Boolean(node));

  for (const node of nodes) {
    node.style.setProperty("--preview-scale", "1");
    node.style.setProperty("--preview-stage-width", pageWidth);
    node.style.setProperty("--preview-stage-height", pageHeight);
    node.style.width = pageWidth;
    node.style.minWidth = pageWidth;
    node.style.maxWidth = pageWidth;
    node.style.height = pageHeight;
    node.style.minHeight = pageHeight;
    node.style.maxHeight = pageHeight;
    node.style.overflow = "visible";
  }

  const page = getExportCloneNode(clonedNode, ".resume-page");
  if (page) {
    page.style.transform = "none";
    page.style.transformOrigin = "top left";
    page.style.width = pageWidth;
    page.style.minWidth = pageWidth;
    page.style.maxWidth = pageWidth;
    page.style.height = pageHeight;
    page.style.minHeight = pageHeight;
    page.style.maxHeight = pageHeight;
  }
}

function normalizePresetSlot(
  value: unknown,
): SavedStylePresetSlot | null {
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
    accentHex:
      typeof record.accentHex === "string" ? record.accentHex : null,
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
  const { search } = useLocation();
  const { currentCv, importCv } = useCvLibrary();
  const presetMenuRef = React.useRef<HTMLDivElement | null>(null);
  const cvPreviewExportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() =>
      readStoredCvForgeWorkspaceMode(),
    );
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    importCv,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const savedStylePresets = useQuery(api.proposalSettings.getPresets);
  const [isStylePresetMenuOpen, setIsStylePresetMenuOpen] = React.useState(
    false,
  );
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

  const exportCurrentCvAsPdf = React.useCallback(() => {
    printFirstMatchingNodeAsPdf({
      container: cvPreviewExportRef.current,
      selectors: [".resume-page-stage", ".resume-page-frame"],
      title: currentCv?.title || "Resume",
      prepareClone: normalizeResumeExportClone,
    });
  }, [currentCv?.title]);

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
          label:
            preset?.name?.trim() || DEFAULT_PRESET_SLOT_NAMES[slot],
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
  const hasAnySavedStylePreset = stylePresetSlots.some(({ preset }) => Boolean(preset));
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
        aria-label="Open saved resume styles"
        aria-expanded={isStylePresetMenuOpen}
        aria-haspopup="menu"
        data-toolbar-tooltip="Saved styles"
        disabled={!hasAnySavedStylePreset}
        onClick={() => setIsStylePresetMenuOpen((current) => !current)}
      >
        <Palette size={16} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {isStylePresetMenuOpen ? (
        <div
          className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-cv-style-presets__menu"
          role="menu"
          aria-label="Saved resume styles"
        >
          {stylePresetSlots.map(({ slot, label, preset, stylePreset: nextStyle, isActive }) => (
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
          ))}
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
      <X size={15} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
  const previewModePdfControl = (
    <button
      type="button"
      className="dasti-icon-button"
      aria-label="Export CV as PDF"
      onClick={exportCurrentCvAsPdf}
      data-toolbar-tooltip="Export PDF"
      data-no-pan="true"
    >
      <FilePdf size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
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
              workspaceMode === "preview"
                ? "0px"
                : "var(--space-2)",
            "--page-shell-pad-inline-mobile":
              workspaceMode === "preview" ? "0px" : "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "var(--space-1)",
          } as React.CSSProperties
        }
      >
        {workspaceMode === "preview" ? (
          <>
            <div className="dasti-cv-preview-workbench">
              <div
                className="dasti-cv-preview-workbench__main"
                ref={cvPreviewExportRef}
              >
                <VerbatiCvPreviewPanel
                  layoutMode="stacked"
                  hostMode="workspace"
                  railLeadControl={previewModeLeadControl}
                  railTrailingControl={previewModePdfControl}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
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
                  toolbarLeadControl={editModeToggle}
                  toolbarPrimaryControl={stylePresetToolbarControl}
                  onRequestExport={exportCurrentCvAsPdf}
                />
                <div
                  className={
                    isSplitCanvas
                      ? "dasti-cv-preview-panel-slot dasti-cv-preview-panel-slot--sticky"
                      : "dasti-cv-preview-panel-slot"
                  }
                  ref={cvPreviewExportRef}
                >
                  <VerbatiCvPreviewPanel
                    layoutMode={isSplitCanvas ? "rail" : "stacked"}
                    hostMode="panel"
                    stylePreset={stylePreset}
                    onStylePresetChange={setStylePreset}
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
