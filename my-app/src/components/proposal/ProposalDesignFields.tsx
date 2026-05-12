import React from "react";
import { Check, ChevronDown } from "../../lib/icons";
import {
  CANONICAL_PROPOSAL_TEMPLATE_ID,
  getProposalTemplateDefinition,
  type ProposalTemplateId,
} from "../../../convex/lib/proposals/renderTemplates";
import {
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
  PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS,
  type ProposalTemplateBundleId,
} from "../../lib/proposal-template-bundles";
import {
  PROPOSAL_PALETTE_OPTIONS,
  type ProposalPaletteId,
} from "../../lib/proposal-style-display";
import {
  getVerbatiFontPairOption,
  type VerbatiFontPairId,
} from "../../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import { ProposalColorPickerPopover } from "../ProposalColorPickerPopover";
import { Menu } from "../ui/menu";

type ProposalRailStyleOption = {
  id: ProposalTemplateBundleId;
  label: string;
  description: string;
};

type ProposalRailLayoutOption = {
  id: ProposalTemplateId;
  eyebrow: string;
  label: string;
  description: string;
};

type ProposalRailAccentOption = {
  id: string;
  label: string;
  swatch: string;
  paletteOverride: ProposalPaletteId | null;
};

export const PROPOSAL_STYLE_OPTIONS: ProposalRailStyleOption[] = [
  {
    id: "swiss_serif",
    label: "Style 1",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "swiss_serif")
        ?.description ?? "Workshopped serif-led proposal style.",
  },
  {
    id: "magazine_editorial",
    label: "Style 2",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "magazine_editorial")
        ?.description ?? "Workshopped editorial proposal style.",
  },
  {
    id: "grid_mono",
    label: "Style 3",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "grid_mono")
        ?.description ?? "Workshopped technical proposal style.",
  },
];

const CANONICAL_PROPOSAL_TEMPLATE_DEFINITION =
  getProposalTemplateDefinition(CANONICAL_PROPOSAL_TEMPLATE_ID);

const PROPOSAL_LAYOUT_OPTIONS: ProposalRailLayoutOption[] = [
  {
    id: CANONICAL_PROPOSAL_TEMPLATE_ID,
    eyebrow: CANONICAL_PROPOSAL_TEMPLATE_DEFINITION.shortLabel,
    label: "Minimal",
    description: CANONICAL_PROPOSAL_TEMPLATE_DEFINITION.description,
  },
];

const PROPOSAL_STYLE_ACCENT_OPTIONS: ProposalRailAccentOption[] = [
  ...PROPOSAL_PALETTE_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    swatch: option.color,
    paletteOverride: option.id,
  })),
  { id: "custom", label: "Custom", swatch: "#8A8176", paletteOverride: null },
];

const PROPOSAL_CUSTOM_ACCENT_STARTER_HEX = "#8A8176";

const PROPOSAL_STYLE_FONT_PAIR_IDS: VerbatiFontPairId[] = [
  "geist-baskervville",
  "quiet-editorial",
  "soft-serif",
  "fd-garamond-geist",
  "ledger-sans",
  "mono-signal",
];

const PROPOSAL_STYLE_FONT_PAIR_OPTIONS = PROPOSAL_STYLE_FONT_PAIR_IDS.map((id) =>
  getVerbatiFontPairOption(id),
);

function normalizeRailAccentHex(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function railStylesEqual(
  first: Partial<VerbatiStylePreset> | null | undefined,
  second: Partial<VerbatiStylePreset> | null | undefined,
): boolean {
  return (
    first?.layout === second?.layout &&
    first?.typography === second?.typography &&
    first?.palette === second?.palette &&
    normalizeRailAccentHex(first?.accentHex) === normalizeRailAccentHex(second?.accentHex)
  );
}

function ProposalDesignFontPairMenu({
  value,
  onSelectFontPair,
}: {
  value: VerbatiStylePreset["typography"];
  onSelectFontPair: (fontPairId: VerbatiFontPairId) => void;
}): JSX.Element {
  const activeOption = getVerbatiFontPairOption(value);

  return (
    <Menu
      ariaLabel="Proposal font pair"
      menuClassName="dasti-proposal-font-menu"
      matchTriggerWidth
      sections={[
        {
          label: "Font pair",
          items: PROPOSAL_STYLE_FONT_PAIR_OPTIONS.map((option) => ({
            id: option.id,
            role: "menuitemradio" as const,
            selected: option.id === activeOption.id,
            label: (
              <span
                className="dasti-proposal-font-menu__sample"
                style={
                  {
                    "--proposal-font-pair-heading": option.headingFamily,
                    "--proposal-font-pair-body": option.bodyFamily,
                  } as React.CSSProperties
                }
              >
                <span className="dasti-proposal-font-menu__sample-title">
                  {option.headingLabel}
                </span>
                <span className="dasti-proposal-font-menu__sample-body">
                  {option.bodyLabel}
                </span>
              </span>
            ),
            ariaLabel: option.name,
            onSelect: () => onSelectFontPair(option.id),
          })),
        },
      ]}
      trigger={
        <button type="button" className="dasti-proposal-font-menu-trigger">
          <span
            className="dasti-proposal-font-menu-trigger__label"
            style={
              {
                "--proposal-font-pair-heading": activeOption.headingFamily,
                "--proposal-font-pair-body": activeOption.bodyFamily,
              } as React.CSSProperties
            }
          >
            <span>{activeOption.headingLabel}</span>
            <small>{activeOption.bodyLabel}</small>
          </span>
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      }
    />
  );
}

export type ProposalDesignFieldsProps = {
  proposalTemplateId?: ProposalTemplateId | null;
  onSelectProposalLayout?: (templateId: ProposalTemplateId) => void;
  stylePreset: VerbatiStylePreset;
  styleTemplateBundleBaseStyle?: VerbatiStylePreset | null;
  styleTemplateBundleId: ProposalTemplateBundleId | null;
  onSelectStyleBundle: (bundleId: ProposalTemplateBundleId) => void;
  onResetStyleBundle?: (bundleId: ProposalTemplateBundleId) => void;
  onSelectStyleTypography: (typography: VerbatiStylePreset["typography"]) => void;
  onSelectStylePalette: (palette: ProposalPaletteId) => void;
  onSelectStyleCustomAccent: (hex: string) => void;
  onClearStyleCustomAccent?: () => void;
  signaturePresent?: boolean;
  handwrittenSignatureAvailable?: boolean;
  handwrittenSignatureEnabled?: boolean;
  onChooseSignature?: () => void;
  onToggleSignature?: (enabled: boolean) => void;
  onToggleHandwrittenSignature?: (enabled: boolean) => void;
};

export function ProposalDesignFields({
  proposalTemplateId,
  onSelectProposalLayout,
  stylePreset,
  styleTemplateBundleBaseStyle,
  styleTemplateBundleId,
  onSelectStyleBundle,
  onResetStyleBundle,
  onSelectStyleTypography,
  onSelectStylePalette,
  onSelectStyleCustomAccent,
  onClearStyleCustomAccent,
  signaturePresent = false,
  handwrittenSignatureAvailable = false,
  handwrittenSignatureEnabled = false,
  onChooseSignature,
  onToggleSignature,
  onToggleHandwrittenSignature,
}: ProposalDesignFieldsProps): JSX.Element {
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] = React.useState(false);
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);

  const normalizeProposalTemplateBundleId = React.useCallback(
    (bundleId: ProposalTemplateBundleId | null | undefined): ProposalTemplateBundleId => {
      if (bundleId === "swiss_serif") return "swiss_serif";
      if (bundleId === "magazine_editorial" || bundleId === "magazine_serif") {
        return "magazine_editorial";
      }
      if (bundleId === "grid_mono" || bundleId === "swiss_mono") {
        return "grid_mono";
      }
      return "swiss_serif";
    },
    [],
  );
  const activeTemplateBundleId = normalizeProposalTemplateBundleId(
    styleTemplateBundleId ?? findProposalTemplateBundleIdByStylePreset(stylePreset),
  );
  const activeTemplateBundleDefinition =
    getProposalTemplateBundleDefinition(activeTemplateBundleId);
  const activeTemplateBundleBaseStyle =
    styleTemplateBundleBaseStyle ?? activeTemplateBundleDefinition.stylePreset;
  const resolvedProposalTemplateId =
    proposalTemplateId ?? CANONICAL_PROPOSAL_TEMPLATE_ID;
  const isActiveTemplateBundleCustomized = Boolean(
    !railStylesEqual(stylePreset, activeTemplateBundleBaseStyle),
  );
  const activeTemplateBundleLabel =
    PROPOSAL_STYLE_OPTIONS.find((option) => option.id === activeTemplateBundleId)
      ?.label ?? "Style";
  const activeAccentHex = normalizeRailAccentHex(stylePreset.accentHex);
  const fixedAccentHexMatch = PROPOSAL_STYLE_ACCENT_OPTIONS.some(
    (option) =>
      option.paletteOverride !== null &&
      stylePreset.palette === "custom" &&
      activeAccentHex === normalizeRailAccentHex(option.swatch),
  );
  const customAccentHex = stylePreset.palette === "custom" ? stylePreset.accentHex : null;
  const hasCustomAccentColor = normalizeRailAccentHex(customAccentHex) !== null;
  const isSeventhCustomToneSelected =
    stylePreset.palette === "custom" && hasCustomAccentColor && !fixedAccentHexMatch;
  const customAccentColor =
    isSeventhCustomToneSelected && customAccentHex
      ? customAccentHex
      : PROPOSAL_CUSTOM_ACCENT_STARTER_HEX;

  return (
    <section
      className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__style dasti-proposal-design-fields"
      data-rail-pane="style"
    >
      <div className="dasti-proposal-skeleton-rail__style-note">
        Style inherited from selected CV when available.
        <br />
        Default settings{" "}
        <a className="dasti-proposal-skeleton-rail__link" href="/settings?tab=docstyle">
          → Document style
        </a>
        .
      </div>
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Style</div>
      <div
        className="dasti-proposal-skeleton-rail__style-pills dasti-proposal-design-style-pills"
        aria-label="Proposal style presets"
      >
        {PROPOSAL_STYLE_OPTIONS.map((option) => {
          const isSelected = activeTemplateBundleId === option.id;
          const isCustomized = isSelected && isActiveTemplateBundleCustomized;

          return (
            <button
              key={option.id}
              type="button"
              aria-label={option.label}
              data-selected={isSelected ? "true" : undefined}
              aria-pressed={isSelected}
              title={option.description}
              onClick={() => {
                setIsCustomColorPickerOpen(false);
                onSelectStyleBundle(option.id);
              }}
            >
              {isCustomized ? (
                <span
                  className="dasti-proposal-design-style-card__custom-dot"
                  title="Customized"
                  aria-label="Customized"
                />
              ) : null}
              {option.label}
            </button>
          );
        })}
        {isActiveTemplateBundleCustomized && onResetStyleBundle ? (
          <button
            type="button"
            className="dasti-proposal-skeleton-rail__style-reset dasti-proposal-design-fields__reset"
            aria-label={`Reset ${activeTemplateBundleLabel}`}
            title={`Reset ${activeTemplateBundleLabel} to the current Settings color, font, and layout.`}
            onClick={() => {
              setIsCustomColorPickerOpen(false);
              onResetStyleBundle(activeTemplateBundleId);
            }}
          >
            Reset style
          </button>
        ) : null}
      </div>
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Typography</div>
      <ProposalDesignFontPairMenu
        value={stylePreset.typography}
        onSelectFontPair={(typography) => {
          setIsCustomColorPickerOpen(false);
          onSelectStyleTypography(typography);
        }}
      />
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Color</div>
      <div
        ref={customColorSurfaceRef}
        className="dasti-proposal-skeleton-rail__style-swatches"
        aria-label="Proposal accent colors"
      >
        {PROPOSAL_STYLE_ACCENT_OPTIONS.map((swatch) => {
          const isSelected =
            swatch.paletteOverride !== null
              ? stylePreset.palette === swatch.paletteOverride ||
                (stylePreset.palette === "custom" &&
                  activeAccentHex === normalizeRailAccentHex(swatch.swatch))
              : isSeventhCustomToneSelected;

          return swatch.paletteOverride ? (
            <button
              key={swatch.id}
              type="button"
              className="dasti-proposal-skeleton-rail__style-swatch"
              style={
                {
                  "--proposal-accent-swatch": swatch.swatch,
                } as React.CSSProperties
              }
              aria-label={`Use ${swatch.label} accent`}
              aria-pressed={isSelected}
              data-selected={isSelected ? "true" : undefined}
              onClick={() => {
                setIsCustomColorPickerOpen(false);
                onSelectStylePalette(swatch.paletteOverride);
              }}
            >
              {isSelected ? <Check size={12} strokeWidth={1.9} /> : null}
            </button>
          ) : (
            <button
              key={swatch.id}
              ref={customColorAnchorRef}
              type="button"
              className={[
                "dasti-proposal-skeleton-rail__style-swatch",
                "dasti-proposal-skeleton-rail__style-swatch--custom",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  "--proposal-accent-swatch": customAccentColor,
                } as React.CSSProperties
              }
              title={isSelected ? `Custom accent ${customAccentColor}` : "Open custom color picker"}
              aria-label="Open custom color picker"
              aria-pressed={isSelected}
              data-selected={isSelected ? "true" : undefined}
              onClick={() => setIsCustomColorPickerOpen(true)}
            >
              {isSelected ? <Check size={12} strokeWidth={1.9} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <ProposalColorPickerPopover
        currentHex={customAccentColor}
        anchorRef={customColorAnchorRef}
        surfaceAnchorRef={customColorSurfaceRef}
        horizontalAlign="center"
        isOpen={isCustomColorPickerOpen}
        onClose={() => setIsCustomColorPickerOpen(false)}
        onHexChange={onSelectStyleCustomAccent}
        onClear={
          isSeventhCustomToneSelected && onClearStyleCustomAccent
            ? () => {
                onClearStyleCustomAccent();
                setIsCustomColorPickerOpen(false);
              }
            : undefined
        }
      />
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Layout</div>
      <div className="dasti-proposal-skeleton-rail__style-pills" aria-label="Proposal layout presets">
        {PROPOSAL_LAYOUT_OPTIONS.map((option) => {
          const isSelected = resolvedProposalTemplateId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-label={`${option.label} layout`}
              data-selected={isSelected ? "true" : undefined}
              aria-pressed={isSelected}
              title={option.description}
              onClick={() => {
                setIsCustomColorPickerOpen(false);
                onSelectProposalLayout?.(option.id);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Signature</div>
      <div className="dasti-proposal-skeleton-rail__signature-toggles">
        <button
          type="button"
          role="switch"
          className={[
            "dasti-theme-switch",
            "settings-token-switch",
            "dasti-proposal-skeleton-rail__signature-toggle",
            signaturePresent
              ? "dasti-theme-switch--dark settings-token-switch--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={!onChooseSignature && !onToggleSignature}
          aria-label="Printed name"
          aria-checked={signaturePresent}
          title={
            signaturePresent
              ? "Printed name is enabled for this proposal. Click to hide it from this proposal."
              : "Insert the applicant printed name using your Settings name style."
          }
          onClick={() => {
            setIsCustomColorPickerOpen(false);
            if (signaturePresent && onToggleSignature) {
              onToggleSignature(false);
              return;
            }
            onChooseSignature?.();
          }}
        >
          <span className="dasti-theme-switch__rail" aria-hidden="true">
            <span className="dasti-theme-switch__thumb" />
          </span>
          <span className="dasti-theme-switch__label">Printed name</span>
        </button>
        <button
          type="button"
          role="switch"
          className={[
            "dasti-theme-switch",
            "settings-token-switch",
            "dasti-proposal-skeleton-rail__signature-toggle",
            handwrittenSignatureEnabled
              ? "dasti-theme-switch--dark settings-token-switch--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={
            !signaturePresent ||
            !handwrittenSignatureAvailable ||
            !onToggleHandwrittenSignature
          }
          aria-label="Signature"
          aria-checked={handwrittenSignatureEnabled}
          title={
            handwrittenSignatureAvailable
              ? "Place your Settings signature above the printed name."
              : "Add or draw a signature image in Settings to enable this option."
          }
          onClick={() => {
            setIsCustomColorPickerOpen(false);
            onToggleHandwrittenSignature?.(!handwrittenSignatureEnabled);
          }}
        >
          <span className="dasti-theme-switch__rail" aria-hidden="true">
            <span className="dasti-theme-switch__thumb" />
          </span>
          <span className="dasti-theme-switch__label">Signature</span>
        </button>
      </div>
    </section>
  );
}

export default ProposalDesignFields;
