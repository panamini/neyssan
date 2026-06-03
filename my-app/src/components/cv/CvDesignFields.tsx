import React from "react";
import { Check, ChevronDown } from "@/lib/icons";
import { Menu } from "../ui";
import {
  getVerbatiFontPairOption,
  type VerbatiFontPairId,
} from "../../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import { PROPOSAL_PALETTE_OPTIONS } from "../../lib/proposal-style-display";
import { ProposalColorPickerPopover } from "../ProposalColorPickerPopover";
import {
  EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID,
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
} from "../../lib/layout/resumeTemplates";
import type {
  DocumentIconColor,
  DocumentIconSettings,
  DocumentIconSizePt,
  SectionHeadingIconMode,
} from "../../lib/document-icons";
import {
  DEFAULT_DOCUMENT_ICON_SETTINGS,
  normalizeDocumentIconSettings,
} from "../../lib/document-icons";
import { DocumentIconPicker } from "../document-icons/DocumentIconPicker";

export type CvAccentChoice =
  | "terre"
  | "ink"
  | "cobalt"
  | "sauge"
  | "plum"
  | "ochre";

type CvDesignFieldsProps = {
  stylePreset: VerbatiStylePreset;
  selectedStyleSlot: 1 | 2 | 3 | null;
  selectedStyleSlotIsCustom?: boolean;
  onSelectStyleSlot: (slot: 1 | 2 | 3) => void;
  onResetStyleSlot?: () => void;
  onSelectTemplate: (
    template:
      | "workshop-onecol"
      | "workshop-twocol"
      | "editorial-sidebar"
      | "editorial"
      | "minimal"
      | "classic",
  ) => void;
  onSelectFontPair: (fontPairId: VerbatiFontPairId) => void;
  onSelectAccent: (accent: CvAccentChoice) => void;
  onSelectCustomAccent: (hex: string) => void;
  documentIconSettings?: DocumentIconSettings;
  onDocumentIconSettingsChange?: (settings: DocumentIconSettings) => void;
  sectionIconTargets?: Array<{ id: string; title: string; type?: string | null }>;
};

const FONT_PAIR_IDS: VerbatiFontPairId[] = [
  "geist-baskervville",
  "mono-signal",
  "fd-garamond-geist",
  "ledger-sans",
];

const FONT_PAIR_OPTIONS = FONT_PAIR_IDS.map((id) => getVerbatiFontPairOption(id));

const ACCENT_OPTIONS: Array<{
  id: CvAccentChoice;
  label: string;
  palette: VerbatiStylePreset["palette"];
  accentHex: string;
}> = PROPOSAL_PALETTE_OPTIONS.map((option) => ({
  id: option.id as CvAccentChoice,
  label: option.label,
  palette: option.id,
  accentHex: option.color,
}));

const CV_CUSTOM_ACCENT_STARTER_HEX = "#8A8176";
const SECTION_ICON_MODE_OPTIONS: Array<{
  id: SectionHeadingIconMode;
  label: string;
}> = [
  { id: "none", label: "None" },
  { id: "auto", label: "Auto" },
  { id: "custom", label: "Custom" },
];
const DOCUMENT_ICON_COLOR_OPTIONS: Array<{
  id: DocumentIconColor;
  label: string;
}> = [
  { id: "ink", label: "Ink" },
  { id: "muted", label: "Muted" },
  { id: "accent", label: "Accent" },
];
const DOCUMENT_ICON_SIZE_OPTIONS: Array<{
  id: "small" | "medium" | "large";
  label: string;
  sizePt: DocumentIconSizePt;
}> = [
  { id: "small", label: "Small", sizePt: 8 },
  { id: "medium", label: "Medium", sizePt: 10 },
  { id: "large", label: "Large", sizePt: 12 },
];

function normalizeCvAccentHex(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function FontPairMenu({
  value,
  onSelectFontPair,
}: {
  value: VerbatiFontPairId;
  onSelectFontPair: (fontPairId: VerbatiFontPairId) => void;
}): JSX.Element {
  const activeOption = getVerbatiFontPairOption(value);

  return (
    <Menu
      ariaLabel="Font pair"
      menuClassName="dasti-cv-font-menu"
      matchTriggerWidth
      sections={[
        {
          label: "Font pair",
          items: FONT_PAIR_OPTIONS.map((option) => ({
            id: option.id,
            role: "menuitemradio" as const,
            selected: option.id === activeOption.id,
            label: (
              <span
                className="dasti-cv-font-menu__sample"
                style={
                  {
                    "--cv-font-pair-heading": option.headingFamily,
                    "--cv-font-pair-body": option.bodyFamily,
                  } as React.CSSProperties
                }
              >
                <span className="dasti-cv-font-menu__sample-title">
                  {option.headingLabel}
                </span>
                <span className="dasti-cv-font-menu__sample-body">
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
        <button type="button" className="dasti-cv-font-menu-trigger">
          <span
            className="dasti-cv-font-menu-trigger__label"
            style={
              {
                "--cv-font-pair-heading": activeOption.headingFamily,
                "--cv-font-pair-body": activeOption.bodyFamily,
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

export function CvDesignFields({
  stylePreset,
  selectedStyleSlot,
  selectedStyleSlotIsCustom = false,
  onSelectStyleSlot,
  onResetStyleSlot,
  onSelectTemplate,
  onSelectFontPair,
  onSelectAccent,
  onSelectCustomAccent,
  documentIconSettings = DEFAULT_DOCUMENT_ICON_SETTINGS,
  onDocumentIconSettingsChange,
  sectionIconTargets = [],
}: CvDesignFieldsProps): JSX.Element {
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] =
    React.useState(false);
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const activeAccent = ACCENT_OPTIONS.find((option) => {
    if (option.palette === stylePreset.palette) return !stylePreset.accentHex;
    return (
      stylePreset.palette === "custom" &&
      normalizeCvAccentHex(stylePreset.accentHex) ===
        normalizeCvAccentHex(option.accentHex)
    );
  });
  const customAccentHex =
    stylePreset.palette === "custom"
      ? normalizeCvAccentHex(stylePreset.accentHex)
      : null;
  const fixedAccentHexMatch = ACCENT_OPTIONS.some(
    (option) =>
      stylePreset.palette === "custom" &&
      customAccentHex === normalizeCvAccentHex(option.accentHex),
  );
  const isCustomAccentSelected =
    Boolean(customAccentHex) && !fixedAccentHexMatch;
  const customAccentColor =
    isCustomAccentSelected && customAccentHex
      ? customAccentHex
      : CV_CUSTOM_ACCENT_STARTER_HEX;
  const resolvedDocumentIconSettings = React.useMemo(
    () => normalizeDocumentIconSettings(documentIconSettings),
    [documentIconSettings],
  );
  const updateDocumentIconSettings = React.useCallback(
    (patch: Partial<DocumentIconSettings>) => {
      onDocumentIconSettingsChange?.({
        ...resolvedDocumentIconSettings,
        ...patch,
      });
    },
    [onDocumentIconSettingsChange, resolvedDocumentIconSettings],
  );
  const visibleSectionIconTargets =
    sectionIconTargets.length > 0
      ? sectionIconTargets
      : [
          { id: "summary", title: "Summary", type: "summary" },
          { id: "experience", title: "Experience", type: "experience" },
          { id: "education", title: "Education", type: "education" },
          { id: "skills", title: "Skills", type: "skills" },
          { id: "languages", title: "Languages", type: "languages" },
        ];

  return (
    <section className="dasti-cv-rail-pane" data-rail-pane="style">
      <div className="dasti-cv-style-note">
        Default settings{" "}
        <a className="dasti-cv-rail-link" href="/settings?tab=docstyle">
          Document style
        </a>
        .
      </div>
      <div className="dasti-cv-rail-label">Style</div>
      <div className="dasti-cv-style-pills dasti-cv-style-pills--slots" aria-label="CV style presets">
        {([1, 2, 3] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            data-selected={selectedStyleSlot === slot ? "true" : undefined}
            aria-pressed={selectedStyleSlot === slot}
            onClick={() => onSelectStyleSlot(slot)}
          >
            {`Style ${slot}`}
            {selectedStyleSlot === slot && selectedStyleSlotIsCustom ? (
              <span
                className="dasti-cv-style-pills__custom-dot"
                title="Customized"
                aria-label="Customized"
              />
            ) : null}
          </button>
        ))}
      {selectedStyleSlot && selectedStyleSlotIsCustom && onResetStyleSlot ? (
        <button
          type="button"
          className="dasti-cv-rail-secondary-action dasti-cv-style-pills__reset"
          aria-label={`Reset Style ${selectedStyleSlot}`}
          onClick={onResetStyleSlot}
        >
          Reset style
        </button>
      ) : null}
      </div>
      <div className="dasti-cv-rail-label">Template</div>
      <div className="dasti-cv-style-pills">
        <button
          type="button"
          data-selected={
            stylePreset.layout === "workshop" &&
            (stylePreset.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID) ===
              WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
              ? "true"
              : undefined
          }
          aria-pressed={
            stylePreset.layout === "workshop" &&
            (stylePreset.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID) ===
              WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
          }
          onClick={() => onSelectTemplate("workshop-onecol")}
        >
          Minimal
        </button>
        <button
          type="button"
          data-selected={
            stylePreset.layout === "workshop" &&
            stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
              ? "true"
              : undefined
          }
          aria-pressed={
            stylePreset.layout === "workshop" &&
            stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
          }
          onClick={() => onSelectTemplate("workshop-twocol")}
        >
          French
        </button>
        <button
          type="button"
          data-selected={
            stylePreset.layout === "workshop" &&
            stylePreset.resumeTemplateId ===
              EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID
              ? "true"
              : undefined
          }
          aria-pressed={
            stylePreset.layout === "workshop" &&
            stylePreset.resumeTemplateId ===
              EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID
          }
          onClick={() => onSelectTemplate("editorial-sidebar")}
        >
          Editorial Sidebar
        </button>
      </div>
      <div className="dasti-cv-rail-label">Font pair</div>
      <FontPairMenu
        value={stylePreset.typography as VerbatiFontPairId}
        onSelectFontPair={onSelectFontPair}
      />
      <div className="dasti-cv-rail-label">Accent</div>
      <div
        ref={customColorSurfaceRef}
        className="dasti-cv-style-swatches"
        aria-label="Accent colors"
      >
        {ACCENT_OPTIONS.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            className={`dasti-cv-style-swatch dasti-cv-style-swatch--${swatch.id}`}
            style={
              {
                "--cv-accent-swatch": swatch.accentHex,
              } as React.CSSProperties
            }
            aria-label={`Use ${swatch.label} accent`}
            aria-pressed={activeAccent?.id === swatch.id}
            data-selected={activeAccent?.id === swatch.id ? "true" : undefined}
            onClick={() => {
              setIsCustomColorPickerOpen(false);
              onSelectAccent(swatch.id);
            }}
          >
            {activeAccent?.id === swatch.id ? (
              <Check size={12} strokeWidth={1.9} />
            ) : null}
          </button>
        ))}
        <button
          ref={customColorAnchorRef}
          type="button"
          className={[
            "dasti-cv-style-swatch",
            "dasti-cv-style-swatch--custom",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              "--cv-accent-swatch": customAccentColor,
            } as React.CSSProperties
          }
          aria-label="Open custom color picker"
          aria-pressed={isCustomAccentSelected}
          data-selected={isCustomAccentSelected ? "true" : undefined}
          title={
            isCustomAccentSelected
              ? `Custom accent ${customAccentColor}`
              : "Open custom color picker"
          }
          onClick={() => setIsCustomColorPickerOpen(true)}
        >
          {isCustomAccentSelected ? (
            <Check size={12} strokeWidth={1.9} aria-hidden="true" />
          ) : null}
        </button>
      </div>
      <ProposalColorPickerPopover
        currentHex={customAccentColor}
        anchorRef={customColorAnchorRef}
        surfaceAnchorRef={customColorSurfaceRef}
        horizontalAlign="center"
        isOpen={isCustomColorPickerOpen}
        onClose={() => setIsCustomColorPickerOpen(false)}
        onHexChange={onSelectCustomAccent}
      />
      <div className="dasti-cv-rail-label">List marker</div>
      <DocumentIconPicker
        label="List icon"
        selectedIconKey={resolvedDocumentIconSettings.defaultListMarkerKey}
        onChange={(iconKey) =>
          updateDocumentIconSettings({
            defaultListMarkerKey: iconKey,
          })
        }
      />
      <div className="dasti-cv-rail-label">Section icons</div>
      <div className="dasti-cv-style-pills" aria-label="Section heading icons">
        {SECTION_ICON_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-selected={
              resolvedDocumentIconSettings.sectionHeadingIconMode === option.id
                ? "true"
                : undefined
            }
            aria-pressed={
              resolvedDocumentIconSettings.sectionHeadingIconMode === option.id
            }
            onClick={() => updateDocumentIconSettings({ sectionHeadingIconMode: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {resolvedDocumentIconSettings.sectionHeadingIconMode === "custom" ? (
        <div className="dasti-cv-section-icon-map" aria-label="Custom section icons">
          {visibleSectionIconTargets.map((section) => {
            const mapKey = section.type || section.title.toLowerCase();
            return (
              <div key={section.id} className="dasti-cv-section-icon-map__row">
                <div className="dasti-cv-section-icon-map__label">{section.title}</div>
                <DocumentIconPicker
                  label={`${section.title} icon`}
                  selectedIconKey={resolvedDocumentIconSettings.sectionIconMap?.[mapKey]}
                  onChange={(iconKey) =>
                    updateDocumentIconSettings({
                      sectionHeadingIconMode: "custom",
                      sectionIconMap: {
                        ...(resolvedDocumentIconSettings.sectionIconMap ?? {}),
                        [mapKey]: iconKey,
                      },
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="dasti-cv-style-pills" aria-label="Icon color">
        {DOCUMENT_ICON_COLOR_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-selected={
              resolvedDocumentIconSettings.color === option.id ? "true" : undefined
            }
            aria-pressed={resolvedDocumentIconSettings.color === option.id}
            onClick={() => updateDocumentIconSettings({ color: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="dasti-cv-style-pills" aria-label="Icon size">
        {DOCUMENT_ICON_SIZE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-selected={
              resolvedDocumentIconSettings.sizePt === option.sizePt ? "true" : undefined
            }
            aria-pressed={resolvedDocumentIconSettings.sizePt === option.sizePt}
            onClick={() => updateDocumentIconSettings({ sizePt: option.sizePt })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default CvDesignFields;
