import React from "react";
import {
  Check,
  ColorWheel,
  Copy,
  CornersIn,
  Eye,
  Layout,
  MagnifyingGlass,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  TrashSimple,
  X,
} from "@/lib/icons";
import { ProposalColorPickerPopover } from "./ProposalColorPickerPopover";
import { Menu } from "./ui/menu";
import { SaveIndicator, type SaveStatus } from "./ui/SaveIndicator";
import { DOCUMENT_ZOOM_STEPS } from "../lib/document-stage";
import {
  PROPOSAL_PALETTE_OPTIONS,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import {
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_TYPOGRAPHY_OPTIONS,
} from "../features/verbati/style";
import type {
  VerbatiLayoutPreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";

type SavedProposalForgeToolbarPreviewProps = {
  mode: "preview" | "edit";
  onModeChange: (mode: "preview" | "edit") => void;
  showZoomControls: boolean;
  zoomIndex: number;
  onZoomIndexChange: (value: number) => void;
  onRefine: () => void;
  tonePendingRefresh?: boolean;
  onDelete: () => void;
  onCopy: () => void;
  copyFeedback: "idle" | "copied";
  isRegenerating: boolean;
  typographyValue: VerbatiTypographyPreset | null;
  onTypographyChange: (value: VerbatiTypographyPreset) => void;
  paletteOverride: ProposalPaletteId | null;
  onPaletteOverrideChange: (value: ProposalPaletteId | null) => void;
  customAccentHex: string | null;
  onCustomAccentHexChange: (hex: string | null) => void;
  resolvedPaletteId: ProposalPaletteId | null;
  layoutValue: VerbatiLayoutPreset | null;
  onLayoutChange: (value: VerbatiLayoutPreset) => void;
  saveStatus?: SaveStatus;
};

type DrawerId = "zoom" | "color" | null;

export function SavedProposalForgeToolbarPreview({
  mode,
  onModeChange,
  showZoomControls,
  zoomIndex,
  onZoomIndexChange,
  onRefine,
  tonePendingRefresh = false,
  onDelete,
  onCopy,
  copyFeedback,
  isRegenerating,
  typographyValue,
  onTypographyChange,
  paletteOverride,
  onPaletteOverrideChange,
  customAccentHex,
  onCustomAccentHexChange,
  resolvedPaletteId,
  layoutValue,
  onLayoutChange,
  saveStatus = "idle",
}: SavedProposalForgeToolbarPreviewProps): JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const colorButtonRef = React.useRef<HTMLButtonElement>(null);
  const colorDrawerRef = React.useRef<HTMLDivElement>(null);
  const [openDrawer, setOpenDrawer] = React.useState<DrawerId>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  const activeTypographyOption =
    VERBATI_TYPOGRAPHY_OPTIONS.find(
      (option) => option.id === typographyValue,
    ) ?? VERBATI_TYPOGRAPHY_OPTIONS[0];
  const activePaletteId = customAccentHex
    ? null
    : paletteOverride ?? resolvedPaletteId;
  const activePaletteOption =
    customAccentHex === null
      ? PROPOSAL_PALETTE_OPTIONS.find(
          (option) => option.id === activePaletteId,
        ) ?? null
      : null;
  const activeLayoutOption =
    VERBATI_LAYOUT_OPTIONS.find((option) => option.id === layoutValue) ??
    VERBATI_LAYOUT_OPTIONS[0];
  const showEditOnlyActions = mode === "edit";
  const hasOpenDrawer = openDrawer !== null || isColorPickerOpen;

  React.useEffect(() => {
    if (!hasOpenDrawer) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (isColorPickerOpen && openDrawer === "color") {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        setOpenDrawer(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isColorPickerOpen && openDrawer === "color") {
        return;
      }
      setOpenDrawer(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [hasOpenDrawer, isColorPickerOpen, openDrawer]);

  React.useEffect(() => {
    if (mode === "edit" && openDrawer === "zoom") {
      setOpenDrawer(null);
    }
  }, [mode, openDrawer]);

  React.useEffect(() => {
    if (openDrawer !== "color") {
      setIsColorPickerOpen(false);
    }
  }, [openDrawer]);

  const handleToggleDrawer = React.useCallback(
    (drawer: Exclude<DrawerId, null>) => {
      setOpenDrawer((current) => (current === drawer ? null : drawer));
    },
    [],
  );

  const handleDeleteConfirm = React.useCallback(() => {
    onDelete();
    setIsDeleteConfirming(false);
  }, [onDelete]);

  return (
    <div
      ref={rootRef}
      className="dasti-document-rail dasti-document-rail--detached dasti-toolbar--surface-tooltips dasti-saved-proposal-forge-toolbar-preview"
      data-mode={mode}
      data-no-pan="true"
      role="group"
      aria-label="Saved proposal forge toolbar preview"
    >
      <div className="dasti-document-rail__section dasti-document-rail__section--start">
        <button
          type="button"
          className={
            mode === "edit"
              ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
              : "dasti-icon-button dasti-proposal-mode-toggle"
          }
          onClick={() => onModeChange(mode === "preview" ? "edit" : "preview")}
          aria-pressed={mode === "edit"}
          aria-label={
            mode === "preview"
              ? "Switch to edit mode"
              : "Switch to preview mode"
          }
          data-toolbar-tooltip={
            mode === "preview" ? "Switch to edit" : "Switch to preview"
          }
          data-no-pan="true"
        >
          {mode === "preview" ? (
            <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>

        {showZoomControls ? (
          <>
            <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            <span
              className={[
                "dasti-doc-zoom-menu",
                "dasti-saved-proposal-forge-toolbar-preview__anchor",
                "dasti-saved-proposal-forge-toolbar-preview__anchor--zoom",
                openDrawer === "zoom" ? "dasti-doc-zoom-menu--open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={
                  zoomIndex === 1
                    ? "dasti-doc-zoom-fit dasti-doc-zoom-trigger"
                    : "dasti-doc-zoom-fit dasti-doc-zoom-trigger dasti-doc-zoom-trigger--active"
                }
                onClick={() => handleToggleDrawer("zoom")}
                aria-label="Open zoom controls"
                data-toolbar-tooltip={
                  openDrawer === "zoom" ? undefined : "Zoom"
                }
                aria-expanded={openDrawer === "zoom"}
                aria-haspopup="dialog"
              >
                <MagnifyingGlass
                  size={14}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              {openDrawer === "zoom" ? (
                <div
                  className="dasti-doc-zoom-bar dasti-doc-zoom-bar--popover dasti-saved-proposal-forge-toolbar-preview__drawer dasti-saved-proposal-forge-toolbar-preview__drawer--center dasti-saved-proposal-forge-toolbar-preview__drawer--zoom"
                  role="dialog"
                  aria-label="Zoom controls"
                >
                  <button
                    type="button"
                    className={
                      zoomIndex === 1
                        ? "dasti-doc-zoom-fit dasti-doc-zoom-fit--active"
                        : "dasti-doc-zoom-fit"
                    }
                    onClick={() => {
                      if (mode === "edit") return;
                      onZoomIndexChange(1);
                    }}
                    aria-label="Fit page"
                    data-toolbar-tooltip="Fit page"
                    disabled={mode === "edit"}
                  >
                    <CornersIn size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="dasti-icon-button"
                    onClick={() =>
                      onZoomIndexChange(Math.max(0, zoomIndex - 1))
                    }
                    disabled={mode === "edit" || zoomIndex === 0}
                    aria-label="Zoom out"
                    data-toolbar-tooltip="Zoom out"
                  >
                    <Minus size={14} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="dasti-icon-button"
                    onClick={() =>
                      onZoomIndexChange(
                        Math.min(DOCUMENT_ZOOM_STEPS.length - 1, zoomIndex + 1),
                      )
                    }
                    disabled={
                      mode === "edit" ||
                      zoomIndex === DOCUMENT_ZOOM_STEPS.length - 1
                    }
                    aria-label="Zoom in"
                    data-toolbar-tooltip="Zoom in"
                  >
                    <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </span>
          </>
        ) : null}

        {mode !== "edit" ? (
          <>
            <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider dasti-saved-proposal-forge-toolbar-preview__style-divider" />

            <span className="dasti-saved-proposal-forge-toolbar-preview__anchor dasti-saved-proposal-forge-toolbar-preview__anchor--layout">
              <Menu
                ariaLabel="Layout options"
                align="end"
                sections={[
                  {
                    items: VERBATI_LAYOUT_OPTIONS.map((option) => ({
                      id: option.id,
                      label: option.name,
                      description: option.description,
                      icon: <Layout size={14} strokeWidth={1.8} />,
                      role: "menuitemradio",
                      selected: option.id === activeLayoutOption.id,
                      onSelect: () => onLayoutChange(option.id),
                    })),
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    className="dasti-icon-button"
                    aria-label={`Layout ${activeLayoutOption.name}`}
                    data-toolbar-tooltip={activeLayoutOption.name}
                  >
                    <Layout size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                }
              />
            </span>

            <span className="dasti-saved-proposal-forge-toolbar-preview__anchor dasti-saved-proposal-forge-toolbar-preview__anchor--style">
              <Menu
                ariaLabel="Text styles"
                align="end"
                sections={[
                  {
                    items: VERBATI_TYPOGRAPHY_OPTIONS.map((option) => ({
                      id: option.id,
                      ariaLabel: option.name,
                      label: option.name,
                      icon: (
                        <span
                          className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--aa"
                          aria-hidden="true"
                          style={{
                            fontFamily: option.headingFamily,
                            fontWeight: option.id === "expert" ? 500 : 600,
                          }}
                        >
                          Aa
                        </span>
                      ),
                      role: "menuitemradio",
                      selected: typographyValue === option.id,
                      onSelect: () => onTypographyChange(option.id),
                    })),
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    className="dasti-artifact-inspector__action dasti-artifact-inspector__action--style-trigger"
                    aria-label="Open text styles"
                    data-toolbar-tooltip="Text"
                  >
                    <span
                      className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--aa"
                      aria-hidden="true"
                      style={{
                        fontFamily: activeTypographyOption.headingFamily,
                        fontWeight:
                          activeTypographyOption.id === "expert" ? 500 : 600,
                      }}
                    >
                      Aa
                    </span>
                  </button>
                }
              />
            </span>

            <span className="dasti-saved-proposal-forge-toolbar-preview__anchor dasti-saved-proposal-forge-toolbar-preview__anchor--color">
              <button
                ref={colorButtonRef}
                type="button"
                className={[
                  "dasti-artifact-inspector__action",
                  "dasti-artifact-inspector__action--color",
                  openDrawer === "color" || isColorPickerOpen
                    ? "dasti-artifact-inspector__action--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={openDrawer === "color" || isColorPickerOpen}
                aria-expanded={openDrawer === "color" || isColorPickerOpen}
                aria-haspopup="dialog"
                onClick={() => handleToggleDrawer("color")}
                aria-label="Color"
                data-toolbar-tooltip={
                  openDrawer === "color" || isColorPickerOpen
                    ? undefined
                    : "Colors"
                }
              >
                <span
                  className="dasti-artifact-inspector__icon"
                  aria-hidden="true"
                >
                  <span
                    className={[
                      "dasti-artifact-inspector__swatch",
                      "dasti-artifact-inspector__swatch--inline",
                      customAccentHex
                        ? "dasti-artifact-inspector__swatch--custom"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      customAccentHex
                        ? ({
                            "--swatch-color": customAccentHex,
                          } as React.CSSProperties)
                        : activePaletteOption
                          ? ({
                              "--swatch-color": activePaletteOption.color,
                            } as React.CSSProperties)
                          : undefined
                    }
                  />
                </span>
              </button>

              {openDrawer === "color" ? (
                <div
                  ref={colorDrawerRef}
                  className="dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack dasti-artifact-inspector__palette-drawer dasti-saved-proposal-forge-toolbar-preview__drawer dasti-saved-proposal-forge-toolbar-preview__drawer--center dasti-saved-proposal-forge-toolbar-preview__drawer--palette"
                  role="dialog"
                  aria-label="Color options"
                >
                  <div className="dasti-artifact-inspector__palette">
                    {PROPOSAL_PALETTE_OPTIONS.map((option) => {
                      const active = activePaletteId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={
                            active
                              ? "dasti-artifact-inspector__swatch dasti-artifact-inspector__swatch--active"
                              : "dasti-artifact-inspector__swatch"
                          }
                          aria-pressed={active}
                          aria-label={option.label}
                          onClick={() => {
                            setIsColorPickerOpen(false);
                            onCustomAccentHexChange(null);
                            onPaletteOverrideChange(
                              active && paletteOverride === option.id
                                ? null
                                : option.id,
                            );
                            setOpenDrawer(null);
                          }}
                          style={
                            {
                              "--swatch-color": option.color,
                            } as React.CSSProperties
                          }
                        />
                      );
                    })}

                    <button
                      type="button"
                      className={[
                        "dasti-artifact-inspector__swatch",
                        "dasti-artifact-inspector__swatch--custom",
                        customAccentHex
                          ? ""
                          : "dasti-artifact-inspector__swatch--icon",
                        customAccentHex
                          ? "dasti-artifact-inspector__swatch--active"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={customAccentHex !== null}
                      aria-label="Custom accent color"
                      onClick={() => {
                        setOpenDrawer("color");
                        setIsColorPickerOpen(true);
                      }}
                      style={
                        customAccentHex
                          ? ({
                              "--swatch-color": customAccentHex,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {!customAccentHex ? (
                        <ColorWheel
                          size={16}
                          className="dasti-artifact-inspector__swatch-wheel"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </div>
                </div>
              ) : null}
            </span>
          </>
        ) : null}
      </div>

      <div className="dasti-document-rail__section dasti-document-rail__section--center"></div>

      <div className="dasti-document-rail__section dasti-document-rail__section--end">
        {mode === "edit" && saveStatus !== "idle" ? (
          <>
            <SaveIndicator status={saveStatus} />
            <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
          </>
        ) : null}
        {showEditOnlyActions ? (
          <>
            <button
              type="button"
              className={[
                "dasti-icon-button",
                tonePendingRefresh ? "dasti-icon-button--pending" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                tonePendingRefresh
                  ? "Apply tone change"
                  : "Refine saved proposal"
              }
              data-toolbar-tooltip={
                isRegenerating
                  ? "Refining"
                  : tonePendingRefresh
                    ? "Apply tone change"
                    : "Refine"
              }
              style={{ opacity: isRegenerating ? 0.5 : 1 }}
              onClick={() => {
                setOpenDrawer(null);
                onRefine();
              }}
              disabled={isRegenerating}
            >
              <RotateCcw size={16} strokeWidth={1.5} />
            </button>
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            <div className="dasti-icon-cluster__divider" />

            {!isDeleteConfirming ? (
              <button
                type="button"
                className="dasti-icon-button"
                data-toolbar-tooltip="Delete"
                onClick={() => setIsDeleteConfirming(true)}
              >
                <TrashSimple size={16} strokeWidth={1.5} />
              </button>
            ) : (
              <span className="dasti-icon-cluster dasti-icon-cluster--tight">
                <button
                  type="button"
                  className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--confirm"
                  data-toolbar-tooltip="Confirm delete"
                  style={{
                    background: "var(--erb)",
                    color: "var(--ert)",
                  }}
                  onClick={handleDeleteConfirm}
                >
                  <Check size={12} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="dasti-icon-button dasti-icon-button--compact"
                  data-toolbar-tooltip="Cancel"
                  onClick={() => setIsDeleteConfirming(false)}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            )}
          </>
        ) : null}

        {showEditOnlyActions ? (
          <span className="dasti-proposal-sheet__action-slot">
            <button
              type="button"
              onClick={onCopy}
              aria-label={copyFeedback === "copied" ? "Copied" : "Copy"}
              className="dasti-icon-button"
              data-toolbar-tooltip={
                copyFeedback === "copied" ? "Copied" : "Copy"
              }
              style={{
                color: copyFeedback === "copied" ? "var(--ok)" : undefined,
              }}
            >
              {copyFeedback === "copied" ? (
                <Check size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </span>
        ) : null}
      </div>

      <ProposalColorPickerPopover
        currentHex={customAccentHex}
        onHexChange={onCustomAccentHexChange}
        anchorRef={colorButtonRef}
        surfaceAnchorRef={openDrawer === "color" ? colorDrawerRef : rootRef}
        horizontalAlign="start"
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        onClear={
          customAccentHex !== null
            ? () => {
                onCustomAccentHexChange(null);
              }
            : undefined
        }
      />
    </div>
  );
}
