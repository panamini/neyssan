import React from "react";
import {
  ArrowCounterClockwise,
  Check,
  ChevronDown,
  FileImage,
  ImagesSquare,
  PenNib,
  RotateCcw,
  TrashSimple,
  Upload,
  User,
} from "../../lib/icons";
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
import {
  applyDocumentDecorationSizePreset,
  createDefaultDocumentDecoration,
  DOCUMENT_DECORATION_SIZE_PRESETS,
  DOCUMENT_DECORATION_UPLOAD_ACCEPT,
  getDocumentDecorationRenderedSizeMm,
  normalizeDocumentDecoration,
  readDocumentDecorationUpload,
  removeDocumentDecorationAsset,
  resetDocumentDecorationPlacement,
  resolveTemplateDocumentDecoration,
  type DocumentDecoration,
} from "../../lib/document-decoration";

type ProposalRailStyleOption = {
  id: ProposalTemplateBundleId;
  label: string;
  compactLabel: string;
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
    compactLabel: "S1",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "swiss_serif")
        ?.description ?? "Workshopped serif-led proposal style.",
  },
  {
    id: "magazine_editorial",
    label: "Style 2",
    compactLabel: "S2",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "magazine_editorial")
        ?.description ?? "Workshopped editorial proposal style.",
  },
  {
    id: "grid_mono",
    label: "Style 3",
    compactLabel: "S3",
    description:
      PROPOSAL_TEMPLATE_BUNDLE_DEFINITIONS.find((definition) => definition.id === "grid_mono")
        ?.description ?? "Workshopped technical proposal style.",
  },
];

const CANONICAL_PROPOSAL_TEMPLATE_DEFINITION =
  getProposalTemplateDefinition(CANONICAL_PROPOSAL_TEMPLATE_ID);
const EDITORIAL_PROPOSAL_TEMPLATE_DEFINITION =
  getProposalTemplateDefinition("editorial_wide");

const PROPOSAL_LAYOUT_OPTIONS: ProposalRailLayoutOption[] = [
  {
    id: CANONICAL_PROPOSAL_TEMPLATE_ID,
    eyebrow: CANONICAL_PROPOSAL_TEMPLATE_DEFINITION.shortLabel,
    label: "Minimal",
    description: CANONICAL_PROPOSAL_TEMPLATE_DEFINITION.description,
  },
  {
    id: "editorial_wide",
    eyebrow: EDITORIAL_PROPOSAL_TEMPLATE_DEFINITION.shortLabel,
    label: "Editorial",
    description: EDITORIAL_PROPOSAL_TEMPLATE_DEFINITION.description,
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
const DOCUMENT_DECORATION_SIZE_LABELS = {
  18: "Small",
  35: "Medium",
  52: "Large",
} as const;

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
  documentDecoration?: DocumentDecoration | null;
  onDocumentDecorationChange?: (decoration: DocumentDecoration) => void;
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
  documentDecoration,
  onDocumentDecorationChange,
  onChooseSignature,
  onToggleSignature,
  onToggleHandwrittenSignature,
}: ProposalDesignFieldsProps): JSX.Element {
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] = React.useState(false);
  const [documentDecorationUploadError, setDocumentDecorationUploadError] =
    React.useState<string | null>(null);
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const decorationUploadInputId = React.useId();

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
  const canResetStyleBundle =
    isActiveTemplateBundleCustomized && Boolean(onResetStyleBundle);
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
  const resolvedDocumentDecoration = resolveTemplateDocumentDecoration(
    documentDecoration ?? createDefaultDocumentDecoration(),
    resolvedProposalTemplateId,
  );
  const hasDocumentDecorationAsset = Boolean(
    resolvedDocumentDecoration.dataUrl || resolvedDocumentDecoration.assetId,
  );
  const renderedDocumentDecorationSizeMm = getDocumentDecorationRenderedSizeMm(
    resolvedDocumentDecoration,
  );
  const updateDocumentDecoration = React.useCallback(
    (nextDecoration: DocumentDecoration) => {
      setDocumentDecorationUploadError(null);
      onDocumentDecorationChange?.(normalizeDocumentDecoration(nextDecoration));
    },
    [onDocumentDecorationChange],
  );
  const handleDocumentDecorationUpload = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = "";
      if (!file) return;
      setDocumentDecorationUploadError(null);
      void readDocumentDecorationUpload(file)
        .then((uploadedDecoration) => {
          onDocumentDecorationChange?.(
            normalizeDocumentDecoration({
              ...uploadedDecoration,
              sizePreset: resolvedDocumentDecoration.sizePreset,
              customSizeMm: resolvedDocumentDecoration.customSizeMm,
              fit: resolvedDocumentDecoration.fit,
              placementMode: resolvedDocumentDecoration.placementMode,
              xMm: resolvedDocumentDecoration.xMm,
              yMm: resolvedDocumentDecoration.yMm,
              visible: true,
            }),
          );
        })
        .catch((error: unknown) => {
          setDocumentDecorationUploadError(
            error instanceof Error ? error.message : "Could not upload this image.",
          );
        });
    },
    [onDocumentDecorationChange, resolvedDocumentDecoration],
  );

  return (
    <section
      className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__style dasti-proposal-design-fields"
      data-rail-pane="style"
    >
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Style</div>
      <div
        className={[
          "dasti-proposal-skeleton-rail__style-pills",
          "dasti-proposal-design-style-pills",
          canResetStyleBundle ? "dasti-proposal-design-style-pills--with-reset" : null,
        ]
          .filter(Boolean)
          .join(" ")}
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
              <span className="dasti-proposal-design-style-pills__label dasti-proposal-design-style-pills__label--full">
                {option.label}
              </span>
              <span className="dasti-proposal-design-style-pills__label dasti-proposal-design-style-pills__label--compact">
                {option.compactLabel}
              </span>
            </button>
          );
        })}
        {canResetStyleBundle && onResetStyleBundle ? (
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
            <ArrowCounterClockwise
              className="dasti-proposal-design-style-pills__reset-icon"
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="dasti-proposal-design-style-pills__reset-label">
              Reset
            </span>
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
      <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Decorations</div>
      <div className="dasti-proposal-design-fields__decorations">
        <div className="dasti-proposal-design-fields__decoration-actions">
          <button
            type="button"
            role="switch"
            className={[
              "dasti-theme-switch",
              "settings-token-switch",
              "dasti-proposal-skeleton-rail__signature-toggle",
              "dasti-proposal-design-fields__decoration-toggle",
              resolvedDocumentDecoration.visible
                ? "dasti-theme-switch--dark settings-token-switch--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
            aria-label="Show image"
            aria-checked={resolvedDocumentDecoration.visible}
            title={
              hasDocumentDecorationAsset
                ? "Show or hide the uploaded document decoration."
                : "Upload a decoration image before showing it."
            }
            onClick={() => {
              updateDocumentDecoration({
                ...resolvedDocumentDecoration,
                visible: !resolvedDocumentDecoration.visible,
              });
            }}
          >
            <ImagesSquare size={14} strokeWidth={1.8} aria-hidden="true" />
            <span className="dasti-theme-switch__rail" aria-hidden="true">
              <span className="dasti-theme-switch__thumb" />
            </span>
            <span className="dasti-theme-switch__label">Show image</span>
          </button>
          <label
            className="dasti-proposal-design-fields__upload"
            htmlFor={decorationUploadInputId}
            title="Upload a PNG, JPG, or SVG decoration."
          >
            <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
            <span className="dasti-proposal-design-fields__upload-label dasti-proposal-design-fields__upload-label--full">
              Upload image
            </span>
            <span className="dasti-proposal-design-fields__upload-label dasti-proposal-design-fields__upload-label--compact">
              Upload
            </span>
            <input
              id={decorationUploadInputId}
              className="dasti-proposal-design-fields__upload-input"
              type="file"
              aria-label="Upload decoration image"
              accept={DOCUMENT_DECORATION_UPLOAD_ACCEPT}
              disabled={!onDocumentDecorationChange}
              onChange={handleDocumentDecorationUpload}
            />
          </label>
          <button
            type="button"
            className="dasti-proposal-design-fields__reset dasti-proposal-design-fields__decoration-remove"
            aria-label="Remove image"
            title="Remove image"
            disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
            onClick={() => {
              setDocumentDecorationUploadError(null);
              onDocumentDecorationChange?.(
                removeDocumentDecorationAsset(resolvedDocumentDecoration),
              );
            }}
          >
            <TrashSimple size={13} strokeWidth={1.8} aria-hidden="true" />
            <span className="dasti-proposal-design-fields__decoration-remove-label">
              Remove
            </span>
          </button>
        </div>
        <div className="dasti-proposal-design-fields__decoration-meta">
          {resolvedDocumentDecoration.dataUrl ? (
            <img
              className="dasti-proposal-design-fields__decoration-thumb"
              src={resolvedDocumentDecoration.dataUrl}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <FileImage size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span>{resolvedDocumentDecoration.fileName ?? "No image"}</span>
        </div>
        <div className="dasti-proposal-design-fields__decoration-control">
          <div
            className="dasti-proposal-skeleton-rail__style-pills dasti-proposal-design-fields__decoration-pills dasti-proposal-design-fields__decoration-pills--size"
            aria-label="Decoration size"
          >
            {DOCUMENT_DECORATION_SIZE_PRESETS.map((sizePreset) => {
              const isSelected = resolvedDocumentDecoration.sizePreset === sizePreset;
              const sizeLabel = DOCUMENT_DECORATION_SIZE_LABELS[sizePreset];
              return (
                <button
                  key={sizePreset}
                  type="button"
                  aria-label={`${sizeLabel}, ${sizePreset} mm`}
                  aria-pressed={isSelected}
                  data-selected={isSelected ? "true" : undefined}
                  title={`${sizeLabel} (${sizePreset} mm)`}
                  disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
                  onClick={() => {
                    updateDocumentDecoration(
                      applyDocumentDecorationSizePreset(
                        resolvedDocumentDecoration,
                        sizePreset,
                      ),
                    );
                  }}
                >
                  {sizeLabel}
                </button>
              );
            })}
            <button
              className="dasti-proposal-design-fields__decoration-custom-size"
              type="button"
              aria-label={
                resolvedDocumentDecoration.sizePreset === "custom"
                  ? `Custom, ${renderedDocumentDecorationSizeMm} mm`
                  : "Custom size"
              }
              title={`Custom (${renderedDocumentDecorationSizeMm} mm)`}
              aria-pressed={resolvedDocumentDecoration.sizePreset === "custom"}
              data-selected={
                resolvedDocumentDecoration.sizePreset === "custom" ? "true" : undefined
              }
              disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
              onClick={() => {
                updateDocumentDecoration({
                  ...resolvedDocumentDecoration,
                  sizePreset: "custom",
                  customSizeMm: renderedDocumentDecorationSizeMm,
                });
              }}
            >
              Custom
            </button>
          </div>
        </div>
        <div
          className="dasti-proposal-skeleton-rail__style-pills dasti-proposal-design-fields__decoration-pills dasti-proposal-design-fields__decoration-pills--fit"
          aria-label="Decoration fit"
        >
          {(["contain", "cover"] as const).map((fit) => {
            const isSelected = resolvedDocumentDecoration.fit === fit;
            return (
              <button
                key={fit}
                type="button"
                aria-label={fit === "contain" ? "Contain" : "Cover"}
                aria-pressed={isSelected}
                data-selected={isSelected ? "true" : undefined}
                disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
                onClick={() => {
                  updateDocumentDecoration({
                    ...resolvedDocumentDecoration,
                    fit,
                  });
                }}
              >
                {fit === "contain" ? "Contain" : "Cover"}
              </button>
            );
          })}
          <button
            type="button"
            className="dasti-proposal-design-fields__reset"
            aria-label="Reset position"
            title="Reset position"
            disabled={!hasDocumentDecorationAsset || !onDocumentDecorationChange}
            onClick={() => {
              updateDocumentDecoration(
                resetDocumentDecorationPlacement(resolvedDocumentDecoration),
              );
            }}
          >
            <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
            Reset
          </button>
        </div>
        {documentDecorationUploadError ? (
          <p
            className="dasti-proposal-design-fields__decoration-error"
            role="alert"
          >
            {documentDecorationUploadError}
          </p>
        ) : null}
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
          <User
            className="dasti-proposal-skeleton-rail__signature-icon"
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className="dasti-theme-switch__rail" aria-hidden="true">
            <span className="dasti-theme-switch__thumb" />
          </span>
          <span className="dasti-theme-switch__label dasti-proposal-skeleton-rail__signature-label dasti-proposal-skeleton-rail__signature-label--full">
            Printed name
          </span>
          <span className="dasti-theme-switch__label dasti-proposal-skeleton-rail__signature-label dasti-proposal-skeleton-rail__signature-label--compact">
            Name
          </span>
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
          <PenNib
            className="dasti-proposal-skeleton-rail__signature-icon"
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className="dasti-theme-switch__rail" aria-hidden="true">
            <span className="dasti-theme-switch__thumb" />
          </span>
          <span className="dasti-theme-switch__label dasti-proposal-skeleton-rail__signature-label dasti-proposal-skeleton-rail__signature-label--full">
            Signature
          </span>
          <span className="dasti-theme-switch__label dasti-proposal-skeleton-rail__signature-label dasti-proposal-skeleton-rail__signature-label--compact">
            Sign
          </span>
        </button>
      </div>
    </section>
  );
}

export default ProposalDesignFields;
