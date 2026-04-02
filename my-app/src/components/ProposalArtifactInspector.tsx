import React from "react";
import { ColorWheel } from "@/lib/icons";
import { ProposalColorPickerPopover } from "./ProposalColorPickerPopover";
import {
  PROPOSAL_PALETTE_OPTIONS,
  PROPOSAL_STYLE_PREVIEW_DEFINITIONS,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import type { ProposalTemplateBundleId } from "../lib/proposal-template-bundles";

type ProposalArtifactInspectorProps = {
  styleBundleId: ProposalTemplateBundleId | null;
  onStyleBundleChange: (bundleId: ProposalTemplateBundleId | null) => void;
  paletteOverride: ProposalPaletteId | null;
  onPaletteOverrideChange: (value: ProposalPaletteId | null) => void;
  customAccentHex: string | null;
  onCustomAccentHexChange: (hex: string | null) => void;
  resolvedPaletteId: ProposalPaletteId | null;
  hasGenerated: boolean;
  compact?: boolean;
  variant?: "rail" | "header";
};

const STYLE_OPTIONS: Array<{
  id: ProposalTemplateBundleId;
  label: string;
  description: string;
  preview: (typeof PROPOSAL_STYLE_PREVIEW_DEFINITIONS)["balanced"];
}> = [
  {
    id: "swiss_serif",
    label: "Swiss",
    description: "Calm grid. Easy to read.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.balanced,
  },
  {
    id: "magazine_editorial",
    label: "Editorial",
    description: "Open serif rhythm.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.warm,
  },
  {
    id: "grid_mono",
    label: "Mono",
    description: "Sharper mono contrast.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.technical,
  },
];

export function ProposalArtifactInspector({
  styleBundleId,
  onStyleBundleChange,
  paletteOverride,
  onPaletteOverrideChange,
  customAccentHex,
  onCustomAccentHexChange,
  resolvedPaletteId,
  hasGenerated,
  compact = false,
  variant = "rail",
}: ProposalArtifactInspectorProps): JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const colorGroupRef = React.useRef<HTMLDivElement>(null);
  const colorDrawerRef = React.useRef<HTMLDivElement>(null);
  const [isStyleDrawerOpen, setIsStyleDrawerOpen] = React.useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const [isColorDrawerOpen, setIsColorDrawerOpen] = React.useState(false);
  const colorPickerAnchorRef = React.useRef<HTMLButtonElement>(null);
  const activePaletteId = customAccentHex ? null : paletteOverride ?? resolvedPaletteId;
  const activePaletteOption =
    customAccentHex === null
      ? PROPOSAL_PALETTE_OPTIONS.find((option) => option.id === activePaletteId) ?? null
      : null;
  const activeStyleOption =
    STYLE_OPTIONS.find((option) => option.id === styleBundleId) ?? STYLE_OPTIONS[0];
  const hasOpenDrawer = isStyleDrawerOpen || isColorDrawerOpen || isColorPickerOpen;
  const isColorControlOpen =
    customAccentHex !== null ? isColorPickerOpen : isColorDrawerOpen;

  React.useEffect(() => {
    if (!isColorDrawerOpen && !isStyleDrawerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target)) {
        if (isColorPickerOpen && isColorDrawerOpen) {
          return;
        }
        setIsStyleDrawerOpen(false);
        setIsColorDrawerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isColorPickerOpen && isColorDrawerOpen) {
          return;
        }
        setIsStyleDrawerOpen(false);
        setIsColorDrawerOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isColorDrawerOpen, isColorPickerOpen, isStyleDrawerOpen]);

  const rootClass = [
    "dasti-artifact-inspector",
    "dasti-toolbar--surface-tooltips",
    variant === "header"
      ? "dasti-artifact-inspector--header"
      : "dasti-artifact-inspector--rail",
    hasGenerated
      ? "dasti-artifact-inspector--collapsed"
      : "dasti-artifact-inspector--expanded",
    hasOpenDrawer ? "dasti-artifact-inspector--drawer-open" : "",
    compact ? "dasti-artifact-inspector--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      role="group"
      aria-label="Document style inspector"
    >
      <div className="dasti-artifact-inspector__group" role="group" aria-label="Style">
        <span className="dasti-artifact-inspector__section-label">Style</span>
        <button
          type="button"
          className={[
            "dasti-artifact-inspector__action",
            "dasti-artifact-inspector__action--style-trigger",
            isStyleDrawerOpen ? "dasti-artifact-inspector__action--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={isStyleDrawerOpen}
          aria-expanded={isStyleDrawerOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setIsColorDrawerOpen(false);
            setIsStyleDrawerOpen((current) => !current);
          }}
          aria-label="Style"
          data-toolbar-tooltip={hasOpenDrawer ? undefined : "Style"}
        >
          <span
            className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--aa"
            aria-hidden="true"
            style={{
              fontFamily: activeStyleOption.preview.headingFont,
              fontWeight: activeStyleOption.preview.headingWeight,
              fontStyle: activeStyleOption.preview.fontStyle ?? "normal",
            }}
          >
            Aa
          </span>
        </button>

        {isStyleDrawerOpen ? (
          <div
            className="dasti-artifact-inspector__style-drawer dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
            role="dialog"
            aria-label="Style options"
          >
            {STYLE_OPTIONS.map((option) => {
              const active = styleBundleId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    "dasti-artifact-inspector__action",
                    "dasti-artifact-inspector__action--drawer",
                    active ? "dasti-artifact-inspector__action--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={active}
                  onClick={() => {
                    onStyleBundleChange(active ? null : option.id);
                    setIsStyleDrawerOpen(false);
                  }}
                  aria-label={option.label}
                  data-toolbar-tooltip={option.label}
                  data-toolbar-tooltip-placement="inline-end"
                >
                  <span
                    className="dasti-artifact-inspector__icon dasti-artifact-inspector__icon--aa"
                    aria-hidden="true"
                    style={{
                      fontFamily: option.preview.headingFont,
                      fontWeight: option.preview.headingWeight,
                      fontStyle: option.preview.fontStyle ?? "normal",
                    }}
                  >
                    Aa
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        ref={colorGroupRef}
        className="dasti-artifact-inspector__group dasti-artifact-inspector__group--color"
        role="group"
        aria-label="Color"
      >
        <span className="dasti-artifact-inspector__section-label">Color</span>
        <button
          ref={colorPickerAnchorRef}
          type="button"
          className={[
            "dasti-artifact-inspector__action",
            "dasti-artifact-inspector__action--color",
            isColorControlOpen ? "dasti-artifact-inspector__action--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={isColorControlOpen}
          aria-expanded={isColorControlOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setIsStyleDrawerOpen(false);
            if (customAccentHex !== null) {
              setIsColorDrawerOpen(false);
              setIsColorPickerOpen((current) => !current);
              return;
            }

            setIsColorPickerOpen(false);
            setIsColorDrawerOpen((current) => !current);
          }}
          aria-label="Color"
          data-toolbar-tooltip={hasOpenDrawer ? undefined : "Colors"}
        >
          <span className="dasti-artifact-inspector__icon" aria-hidden="true">
            <span
              className={[
                "dasti-artifact-inspector__swatch",
                "dasti-artifact-inspector__swatch--inline",
                customAccentHex ? "dasti-artifact-inspector__swatch--custom" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                customAccentHex
                  ? ({ "--swatch-color": customAccentHex } as React.CSSProperties)
                  : activePaletteOption
                    ? ({ "--swatch-color": activePaletteOption.color } as React.CSSProperties)
                    : undefined
              }
            />
          </span>
          <span className="dasti-artifact-inspector__label">Color</span>
        </button>

        {isColorDrawerOpen ? (
          <div
            ref={colorDrawerRef}
            className="dasti-artifact-inspector__palette-drawer dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
            role="dialog"
            aria-label="Color options"
          >
            <div className="dasti-artifact-inspector__palette">
              {PROPOSAL_PALETTE_OPTIONS.map((pal) => {
                const active = activePaletteId === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    className={
                      active
                        ? "dasti-artifact-inspector__swatch dasti-artifact-inspector__swatch--active"
                        : "dasti-artifact-inspector__swatch"
                    }
                    aria-pressed={active}
                    onClick={() => {
                      setIsColorPickerOpen(false);
                      onCustomAccentHexChange(null);
                      onPaletteOverrideChange(
                        active && paletteOverride === pal.id ? null : pal.id,
                      );
                      setIsColorDrawerOpen(false);
                    }}
                    aria-label={pal.label}
                    style={{ "--swatch-color": pal.color } as React.CSSProperties}
                  />
                );
              })}

              <button
                type="button"
                className={[
                  "dasti-artifact-inspector__swatch",
                  "dasti-artifact-inspector__swatch--custom",
                  customAccentHex ? "" : "dasti-artifact-inspector__swatch--icon",
                  customAccentHex ? "dasti-artifact-inspector__swatch--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={customAccentHex !== null}
                onClick={() => {
                  setIsColorDrawerOpen(true);
                  setIsColorPickerOpen(true);
                }}
                aria-label="Custom accent color"
                style={
                  customAccentHex
                    ? ({ "--swatch-color": customAccentHex } as React.CSSProperties)
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
      </div>

      <ProposalColorPickerPopover
        currentHex={customAccentHex}
        onHexChange={onCustomAccentHexChange}
        anchorRef={colorPickerAnchorRef}
        surfaceAnchorRef={isColorDrawerOpen ? colorDrawerRef : colorGroupRef}
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
