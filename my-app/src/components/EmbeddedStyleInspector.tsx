import React from "react";
import { ColorWheel, Layout, Wand2 } from "@/lib/icons";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import type { VerbatiStyleBundleId } from "../../convex/lib/proposals/styleSuggestions";
import { ProposalColorPickerPopover } from "./ProposalColorPickerPopover";
import {
  resolveVerbatiAccentHex,
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_PALETTE_OPTIONS,
  VERBATI_TYPOGRAPHY_OPTIONS,
} from "../features/verbati/style";
import {
  getVerbatiPaletteLabel,
  getVerbatiTypographyLabel,
  resolveVerbatiStyleBundleId,
  VERBATI_STYLE_BUNDLE_DEFINITIONS,
} from "../features/verbati/styleBundles";
import type {
  VerbatiLayoutPreset,
  VerbatiPalettePreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";

type EmbeddedStyleInspectorProps = {
  stylePreset: VerbatiStylePreset;
  templateId?: ProposalTemplateId | null;
  bundleOptions?: ReadonlyArray<{
    id: string;
    label: string;
    description: string;
    stylePreset: VerbatiStylePreset;
    templateId?: ProposalTemplateId | null;
  }>;
  activeBundleIdOverride?: string | null;
  readOnly?: boolean;
  readOnlyHint?: string | null;
  copyMode?: "default" | "title-only";
  controlMode?: "bundled" | "direct";
  showCustomizeControl?: boolean;
  showPromptControl?: boolean;
  onSelectBundle: (bundleId: VerbatiStyleBundleId) => void;
  onSelectLayout: (layout: VerbatiLayoutPreset) => void;
  onSelectTypography: (typography: VerbatiTypographyPreset) => void;
  onSelectPalette: (palette: Exclude<VerbatiPalettePreset, "custom">) => void;
  onSelectCustomAccent?: (hex: string) => void;
  onApplyCommand?: (
    command: string,
  ) => Promise<{ bundleId?: VerbatiStyleBundleId | null; label: string } | null>;
  isApplyingCommand?: boolean;
};

type DrawerId =
  | "bundle"
  | "customize"
  | "layout"
  | "typography"
  | "color"
  | "prompt";

function InspectorTooltip({
  title,
  description,
  className,
}: {
  title: string;
  description?: string | null;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={[
        "dasti-artifact-inspector__tooltip",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </span>
  );
}

export function EmbeddedStyleInspector({
  stylePreset,
  templateId = null,
  bundleOptions,
  activeBundleIdOverride,
  readOnly = false,
  readOnlyHint = null,
  copyMode = "default",
  controlMode = "bundled",
  showCustomizeControl = true,
  showPromptControl = true,
  onSelectBundle,
  onSelectLayout,
  onSelectTypography,
  onSelectPalette,
  onSelectCustomAccent,
  onApplyCommand,
  isApplyingCommand = false,
}: EmbeddedStyleInspectorProps): JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const colorGroupRef = React.useRef<HTMLDivElement>(null);
  const colorDrawerRef = React.useRef<HTMLDivElement>(null);
  const colorButtonRef = React.useRef<HTMLButtonElement>(null);
  const promptInputId = React.useId();
  const [activeDrawer, setActiveDrawer] = React.useState<DrawerId | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [confirmation, setConfirmation] = React.useState<string | null>(null);
  const resolvedBundleOptions = React.useMemo(
    () => bundleOptions ?? VERBATI_STYLE_BUNDLE_DEFINITIONS,
    [bundleOptions],
  );
  const activeBundleId = React.useMemo(
    () =>
      activeBundleIdOverride === undefined
        ? resolveVerbatiStyleBundleId({
            templateId,
            stylePreset,
          })
        : activeBundleIdOverride,
    [activeBundleIdOverride, stylePreset, templateId],
  );
  const activeAccentHex = React.useMemo(
    () => resolveVerbatiAccentHex(stylePreset),
    [stylePreset],
  );
  const customClearPalette = React.useMemo<Exclude<VerbatiPalettePreset, "custom">>(() => {
    if (stylePreset.palette !== "custom") {
      return stylePreset.palette;
    }

    const fallbackPalette = (
      activeBundleId
        ? resolvedBundleOptions.find((bundle) => bundle.id === activeBundleId)
            ?.stylePreset.palette
        : resolvedBundleOptions[0]?.stylePreset.palette
    ) as VerbatiPalettePreset;

    return (
      fallbackPalette === "custom"
        ? resolvedBundleOptions[0]?.stylePreset.palette ??
            VERBATI_STYLE_BUNDLE_DEFINITIONS[0].stylePreset.palette
        : fallbackPalette
    ) as Exclude<VerbatiPalettePreset, "custom">;
  }, [activeBundleId, resolvedBundleOptions, stylePreset.palette]);
  const activeTypographyOption = React.useMemo(
    () =>
      VERBATI_TYPOGRAPHY_OPTIONS.find(
        (option) => option.id === stylePreset.typography,
      ) ?? VERBATI_TYPOGRAPHY_OPTIONS[0],
    [stylePreset.typography],
  );
  const hasOpenDrawer = activeDrawer !== null || isColorPickerOpen;
  const isTitleOnlyCopy = copyMode === "title-only";
  const isDirectControlMode = controlMode === "direct";
  const useIconOnlyBundleDrawer = !isDirectControlMode && isTitleOnlyCopy;

  React.useEffect(() => {
    if (!activeDrawer) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target)) {
        if (isColorPickerOpen && activeDrawer === "color") {
          return;
        }
        setActiveDrawer(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isColorPickerOpen && activeDrawer === "color") {
          return;
        }
        setActiveDrawer(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeDrawer, isColorPickerOpen]);

  React.useEffect(() => {
    if (!confirmation) return undefined;

    const timeoutId = window.setTimeout(() => {
      setConfirmation(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [confirmation]);

  const toggleDrawer = React.useCallback(
    (drawer: DrawerId) => {
      if (readOnly) return;
      setIsColorPickerOpen(false);
      setActiveDrawer((current) => (current === drawer ? null : drawer));
    },
    [readOnly],
  );

  const handleColorTrigger = React.useCallback(() => {
    if (readOnly) return;
    setIsColorPickerOpen(false);
    setActiveDrawer((current) => (current === "color" ? null : "color"));
  }, [readOnly]);

  const handleApplyCommand = React.useCallback(async () => {
    const normalizedCommand = command.trim();
    if (!onApplyCommand || !normalizedCommand || readOnly) {
      return;
    }

    const result = await onApplyCommand(normalizedCommand);
    if (!result) return;

    setCommand("");
    setConfirmation(`Applied: ${result.label}`);
  }, [command, onApplyCommand, readOnly]);

  return (
    <div
      ref={rootRef}
      className={[
        "dasti-artifact-inspector",
        "dasti-artifact-inspector--header",
        "dasti-artifact-inspector--collapsed",
        "dasti-resume-style-inspector",
        "dasti-resume-style-inspector--icon-only",
        isTitleOnlyCopy ? "dasti-resume-style-inspector--title-only" : "",
        hasOpenDrawer ? "dasti-artifact-inspector--drawer-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Resume appearance controls"
    >
      {isDirectControlMode ? (
        <>
          <div
            className="dasti-artifact-inspector__group"
            role="group"
            aria-label="Text styles"
          >
            <span className="dasti-artifact-inspector__section-label">Text</span>
            <button
              type="button"
              className={[
                "dasti-artifact-inspector__action",
                "dasti-artifact-inspector__action--style-trigger",
                activeDrawer === "typography"
                  ? "dasti-artifact-inspector__action--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Open text styles"
              aria-expanded={activeDrawer === "typography"}
              aria-haspopup="dialog"
              onClick={() => toggleDrawer("typography")}
              disabled={readOnly}
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
              <span className="dasti-artifact-inspector__label">Text</span>
              {!hasOpenDrawer ? (
                <InspectorTooltip
                  className="dasti-artifact-inspector__tooltip--trigger"
                  title="Text"
                />
              ) : null}
            </button>

            {activeDrawer === "typography" ? (
              <div
                className="dasti-resume-style-inspector__drawer dasti-resume-style-inspector__drawer--layout dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
                role="dialog"
                aria-label="Text styles"
              >
                <div className="dasti-resume-style-inspector__layout-list">
                  {VERBATI_TYPOGRAPHY_OPTIONS.map((option) => {
                    const active = option.id === stylePreset.typography;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={[
                          "dasti-proposal-chrome-option",
                          "dasti-resume-style-inspector__layout-option",
                          active
                            ? "dasti-resume-style-inspector__layout-option--active dasti-proposal-chrome-option--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={active}
                        onClick={() => {
                          onSelectTypography(option.id);
                          setActiveDrawer(null);
                        }}
                        disabled={readOnly}
                      >
                        <span
                          className="dasti-resume-style-inspector__layout-title"
                          style={{
                            fontFamily: option.headingFamily,
                            fontWeight: option.id === "expert" ? 500 : 600,
                          }}
                        >
                          {option.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="dasti-artifact-inspector__group"
            role="group"
            aria-label="Layout"
          >
            <span className="dasti-artifact-inspector__section-label">Layout</span>
            <button
              type="button"
              className={[
                "dasti-artifact-inspector__action",
                activeDrawer === "layout"
                  ? "dasti-artifact-inspector__action--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Open layout controls"
              aria-expanded={activeDrawer === "layout"}
              aria-haspopup="dialog"
              onClick={() => toggleDrawer("layout")}
              disabled={readOnly}
            >
              <span
                className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--layout"
                aria-hidden="true"
              >
                <Layout size={14} strokeWidth={1.8} />
              </span>
              <span className="dasti-artifact-inspector__label">Layout</span>
              {!hasOpenDrawer ? (
                <InspectorTooltip
                  className="dasti-artifact-inspector__tooltip--trigger"
                  title="Layout"
                />
              ) : null}
            </button>

            {activeDrawer === "layout" ? (
              <div
                className="dasti-resume-style-inspector__drawer dasti-resume-style-inspector__drawer--layout dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
                role="dialog"
                aria-label="Layout controls"
              >
                <div className="dasti-resume-style-inspector__layout-list">
                  {VERBATI_LAYOUT_OPTIONS.map((option) => {
                    const active = option.id === stylePreset.layout;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={[
                          "dasti-proposal-chrome-option",
                          "dasti-resume-style-inspector__layout-option",
                          active
                            ? "dasti-resume-style-inspector__layout-option--active dasti-proposal-chrome-option--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={active}
                        onClick={() => {
                          onSelectLayout(option.id);
                          setActiveDrawer(null);
                        }}
                        disabled={readOnly}
                      >
                        <span className="dasti-resume-style-inspector__layout-title">
                          {option.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="dasti-artifact-inspector__group" role="group" aria-label="Style">
            <span className="dasti-artifact-inspector__section-label">Style</span>
            <button
              type="button"
              className={[
                "dasti-artifact-inspector__action",
                "dasti-artifact-inspector__action--style-trigger",
                activeDrawer === "bundle"
                  ? "dasti-artifact-inspector__action--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Open style presets"
              aria-expanded={activeDrawer === "bundle"}
              aria-haspopup="dialog"
              onClick={() => toggleDrawer("bundle")}
              disabled={readOnly}
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
              <span className="dasti-artifact-inspector__label">Style</span>
              {!hasOpenDrawer ? (
                <InspectorTooltip
                  className="dasti-artifact-inspector__tooltip--trigger"
                  title="Style"
                />
              ) : null}
            </button>

            {activeDrawer === "bundle" ? (
              <div
                className={[
                  useIconOnlyBundleDrawer
                    ? "dasti-artifact-inspector__style-drawer"
                    : "dasti-resume-style-inspector__drawer",
                  "dasti-proposal-chrome-drawer",
                  "dasti-proposal-chrome-drawer--stack",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="dialog"
                aria-label="Resume style presets"
              >
                {resolvedBundleOptions.map((bundle) => {
                  const active = bundle.id === activeBundleId;
                  const typographyOption =
                    VERBATI_TYPOGRAPHY_OPTIONS.find(
                      (option) => option.id === bundle.stylePreset.typography,
                    ) ?? activeTypographyOption;

                  if (useIconOnlyBundleDrawer) {
                    return (
                      <button
                        key={bundle.id}
                        type="button"
                        className={[
                          "dasti-artifact-inspector__action",
                          "dasti-artifact-inspector__action--drawer",
                          active
                            ? "dasti-artifact-inspector__action--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={active}
                        aria-label={bundle.label}
                        onClick={() => {
                          onSelectBundle(bundle.id);
                          setActiveDrawer(null);
                        }}
                        disabled={readOnly}
                      >
                        <span
                          className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--aa"
                          aria-hidden="true"
                          style={{
                            fontFamily: typographyOption.headingFamily,
                            fontWeight:
                              bundle.stylePreset.typography === "expert"
                                ? 500
                                : 600,
                          }}
                        >
                          Aa
                        </span>
                        <InspectorTooltip
                          className="dasti-artifact-inspector__tooltip--drawer"
                          title={bundle.label}
                          description={bundle.description}
                        />
                      </button>
                    );
                  }

                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      className={[
                        "dasti-proposal-chrome-option",
                        "dasti-resume-style-inspector__choice",
                        active ? "dasti-resume-style-inspector__choice--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={active}
                      onClick={() => {
                        onSelectBundle(bundle.id);
                        setActiveDrawer(null);
                      }}
                      disabled={readOnly}
                    >
                      <span
                        className="dasti-proposal-chrome-option__icon dasti-artifact-inspector__icon--aa"
                        aria-hidden="true"
                        style={{
                          fontFamily: typographyOption.headingFamily,
                          fontWeight:
                            bundle.stylePreset.typography === "expert" ? 500 : 600,
                        }}
                      >
                        Aa
                      </span>
                      <span className="dasti-proposal-chrome-option__copy">
                        <span className="dasti-proposal-chrome-option__title">
                          {bundle.label}
                        </span>
                        {!isTitleOnlyCopy ? (
                          <span className="dasti-proposal-chrome-option__description">
                            {bundle.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
                {readOnlyHint && !isTitleOnlyCopy ? (
                  <div className="dasti-resume-style-inspector__drawer-note">
                    {readOnlyHint}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {showCustomizeControl ? (
            <div
              className="dasti-artifact-inspector__group"
              role="group"
              aria-label="Customize"
            >
              <span className="dasti-artifact-inspector__section-label">Customize</span>
              <button
                type="button"
                className={[
                  "dasti-artifact-inspector__action",
                  activeDrawer === "customize"
                    ? "dasti-artifact-inspector__action--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label="Open layout and typography controls"
                aria-expanded={activeDrawer === "customize"}
                aria-haspopup="dialog"
                onClick={() => toggleDrawer("customize")}
                disabled={readOnly}
              >
                <span
                  className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--layout"
                  aria-hidden="true"
                >
                  <Layout size={14} strokeWidth={1.8} />
                </span>
                <span className="dasti-artifact-inspector__label">Refine</span>
                {!hasOpenDrawer ? (
                  <InspectorTooltip
                    className="dasti-artifact-inspector__tooltip--trigger"
                    title="Refine"
                  />
                ) : null}
              </button>

              {activeDrawer === "customize" ? (
                <div
                  className="dasti-resume-style-inspector__drawer dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
                  role="dialog"
                  aria-label="Layout and typography controls"
                >
                  <div className="dasti-resume-style-inspector__drawer-section">
                    <div className="dasti-resume-style-inspector__drawer-heading">
                      Layout
                    </div>
                    <div className="dasti-resume-style-inspector__choice-list">
                      {VERBATI_LAYOUT_OPTIONS.map((option) => {
                        const active = option.id === stylePreset.layout;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={[
                              "dasti-proposal-chrome-option",
                              "dasti-resume-style-inspector__choice",
                              active
                                ? "dasti-resume-style-inspector__choice--active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-pressed={active}
                            onClick={() => onSelectLayout(option.id)}
                            disabled={readOnly}
                          >
                            <span
                              className="dasti-proposal-chrome-option__icon dasti-artifact-inspector__icon--layout"
                              aria-hidden="true"
                            >
                              <Layout size={14} strokeWidth={1.8} />
                            </span>
                            <span className="dasti-proposal-chrome-option__copy">
                              <span className="dasti-proposal-chrome-option__title">
                                {option.name}
                              </span>
                              {!isTitleOnlyCopy ? (
                                <span className="dasti-proposal-chrome-option__description">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="dasti-resume-style-inspector__drawer-section">
                    <div className="dasti-resume-style-inspector__drawer-heading">
                      Typography
                    </div>
                    <div className="dasti-resume-style-inspector__choice-list">
                      {VERBATI_TYPOGRAPHY_OPTIONS.map((option) => {
                        const active = option.id === stylePreset.typography;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={[
                              "dasti-proposal-chrome-option",
                              "dasti-resume-style-inspector__choice",
                              active
                                ? "dasti-resume-style-inspector__choice--active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-pressed={active}
                            onClick={() => onSelectTypography(option.id)}
                            disabled={readOnly}
                          >
                            <span
                              className="dasti-proposal-chrome-option__icon dasti-artifact-inspector__icon--aa"
                              aria-hidden="true"
                              style={{
                                fontFamily: option.headingFamily,
                                fontWeight: option.id === "expert" ? 500 : 600,
                              }}
                            >
                              Aa
                            </span>
                            <span className="dasti-proposal-chrome-option__copy">
                              <span className="dasti-proposal-chrome-option__title">
                                {option.name}
                              </span>
                              {!isTitleOnlyCopy ? (
                                <span className="dasti-proposal-chrome-option__description">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div
        ref={colorGroupRef}
        className="dasti-artifact-inspector__group dasti-artifact-inspector__group--color"
        role="group"
        aria-label="Color"
      >
        <span className="dasti-artifact-inspector__section-label">Color</span>
        <button
          ref={colorButtonRef}
          type="button"
          className={[
            "dasti-artifact-inspector__action",
            "dasti-artifact-inspector__action--color",
            activeDrawer === "color" || isColorPickerOpen
              ? "dasti-artifact-inspector__action--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Open palette controls"
          aria-expanded={activeDrawer === "color" || isColorPickerOpen}
          aria-haspopup="dialog"
          onClick={handleColorTrigger}
          disabled={readOnly}
        >
          <span className="dasti-artifact-inspector__icon" aria-hidden="true">
            <span
              className={[
                "dasti-artifact-inspector__swatch",
                "dasti-artifact-inspector__swatch--inline",
                stylePreset.palette === "custom"
                  ? "dasti-artifact-inspector__swatch--custom"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--swatch-color": activeAccentHex } as React.CSSProperties}
            />
          </span>
          <span className="dasti-artifact-inspector__label">Color</span>
          {!hasOpenDrawer ? (
            <InspectorTooltip
              className="dasti-artifact-inspector__tooltip--trigger"
              title="Colors"
            />
          ) : null}
        </button>

        {activeDrawer === "color" ? (
          <div
            ref={colorDrawerRef}
            className="dasti-resume-style-inspector__drawer dasti-resume-style-inspector__drawer--palette dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
            role="dialog"
            aria-label="Palette options"
          >
            <div className="dasti-artifact-inspector__palette">
              {VERBATI_PALETTE_OPTIONS.map((option) => {
                const active =
                  stylePreset.palette !== "custom" &&
                  option.id === stylePreset.palette;
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
                    aria-label={`Use ${option.name}`}
                    onClick={() => {
                      onSelectPalette(option.id);
                      setIsColorPickerOpen(false);
                      setActiveDrawer(null);
                    }}
                    disabled={readOnly}
                    style={
                      { "--swatch-color": option.accentHex } as React.CSSProperties
                    }
                  />
                );
              })}

              {onSelectCustomAccent ? (
                <button
                  type="button"
                  className={[
                    "dasti-artifact-inspector__swatch",
                    "dasti-artifact-inspector__swatch--custom",
                    stylePreset.palette === "custom"
                      ? ""
                      : "dasti-artifact-inspector__swatch--icon",
                    stylePreset.palette === "custom"
                      ? "dasti-artifact-inspector__swatch--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={stylePreset.palette === "custom"}
                  aria-label="Choose a custom accent"
                  onClick={() => {
                    setActiveDrawer("color");
                    setIsColorPickerOpen(true);
                  }}
                  disabled={readOnly}
                  style={
                    stylePreset.palette === "custom"
                      ? ({ "--swatch-color": activeAccentHex } as React.CSSProperties)
                      : undefined
                  }
                >
                  {stylePreset.palette !== "custom" ? (
                    <ColorWheel
                      size={16}
                      className="dasti-artifact-inspector__swatch-wheel"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              ) : null}
            </div>
            {!isTitleOnlyCopy ? (
              <div className="dasti-resume-style-inspector__drawer-note">
                {stylePreset.palette === "custom"
                  ? `Custom accent ${activeAccentHex.toUpperCase()}`
                  : `${getVerbatiPaletteLabel(stylePreset.palette)} palette`}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {onApplyCommand && showPromptControl ? (
        <div className="dasti-artifact-inspector__group" role="group" aria-label="Prompt">
          <span className="dasti-artifact-inspector__section-label">Prompt</span>
          <button
            type="button"
            className={[
              "dasti-artifact-inspector__action",
              activeDrawer === "prompt"
                ? "dasti-artifact-inspector__action--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Describe a look"
            aria-expanded={activeDrawer === "prompt"}
            aria-haspopup="dialog"
            onClick={() => toggleDrawer("prompt")}
            disabled={readOnly}
          >
            <span className="dasti-artifact-inspector__icon" aria-hidden="true">
              <Wand2 size={15} strokeWidth={1.6} />
            </span>
            <span className="dasti-artifact-inspector__label">Prompt</span>
            {!hasOpenDrawer ? (
            <InspectorTooltip
              className="dasti-artifact-inspector__tooltip--trigger"
              title="Prompt"
            />
          ) : null}
        </button>

          {activeDrawer === "prompt" ? (
            <div
              className="dasti-resume-style-inspector__drawer dasti-resume-style-inspector__drawer--prompt dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
              role="dialog"
              aria-label="Describe a look"
            >
              <label
                className="dasti-resume-style-inspector__drawer-heading"
                htmlFor={promptInputId}
              >
                Describe a look
              </label>
              <div className="dasti-resume-style-inspector__prompt-row">
                <input
                  id={promptInputId}
                  type="text"
                  className="dasti-field dasti-field--sm"
                  value={command}
                  placeholder="Swiss, calmer serif, stronger contrast…"
                  onChange={(event) => setCommand(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleApplyCommand();
                    }
                  }}
                  disabled={readOnly || isApplyingCommand}
                />
                <button
                  type="button"
                  className="dasti-button dasti-button--primary dasti-button--sm"
                  onClick={() => {
                    void handleApplyCommand();
                  }}
                  disabled={
                    readOnly ||
                    isApplyingCommand ||
                    command.trim().length === 0
                  }
                >
                  {isApplyingCommand ? "Applying…" : "Apply"}
                </button>
              </div>
              {!isTitleOnlyCopy ? (
                <div className="dasti-resume-style-inspector__drawer-note">
                  {confirmation
                    ? confirmation
                    : readOnlyHint ??
                      `Current: ${getVerbatiTypographyLabel(
                        stylePreset.typography,
                      )} · ${
                        stylePreset.palette === "custom"
                          ? activeAccentHex.toUpperCase()
                          : getVerbatiPaletteLabel(stylePreset.palette)
                      }`}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ProposalColorPickerPopover
        currentHex={activeAccentHex}
        onHexChange={(hex) => {
          onSelectCustomAccent?.(hex);
        }}
        anchorRef={colorButtonRef}
        surfaceAnchorRef={activeDrawer === "color" ? colorDrawerRef : colorGroupRef}
        horizontalAlign="start"
        isOpen={Boolean(onSelectCustomAccent) && isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        onClear={
          stylePreset.palette === "custom"
            ? () => {
                onSelectPalette(customClearPalette);
              }
            : undefined
        }
      />
    </div>
  );
}

export default EmbeddedStyleInspector;
