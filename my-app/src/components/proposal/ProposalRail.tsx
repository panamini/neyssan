import React from "react";
import {
  ArrowSquareOut,
  Briefcase,
  Check,
  ChevronDown,
  ColorWheel,
  FilePdf,
  FileUser,
  FloppyDisk,
  Plus,
  TrashSimple,
  X,
} from "../../lib/icons";
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
import { Button } from "../ui";
import { Menu, type MenuSection } from "../ui/menu";

type ProposalRailVariableField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

type ProposalRailCvOption = {
  id: string;
  title: string;
  description: string | null;
  selected: boolean;
};

type ProposalRailToneOption = {
  id: string | null;
  label: string;
  description: string;
  tone: "auto" | "warm" | "formal" | "natural";
  selected: boolean;
};

type ProposalRailLengthOption = {
  id: "short" | "medium" | "long";
  label: string;
  description: string;
  selected: boolean;
};

type ProposalRailTab = "draft" | "ask" | "header" | "style";

type ProposalRailStyleOption = {
  id: ProposalTemplateBundleId;
  label: string;
  description: string;
};

type ProposalRailAccentOption = {
  id: string;
  label: string;
  swatch: string;
  paletteOverride: ProposalPaletteId | null;
};

const PROPOSAL_STYLE_OPTIONS: ProposalRailStyleOption[] = [
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

export type ProposalRailJobMatchSummary = {
  label: string;
  tone: "strong" | "worth" | "maybe" | "skip";
  detail: string | null;
};

function ProposalRailFontPairMenu({
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

type ProposalRailProps = {
  jobTitle: string;
  company: string | null;
  location: string | null;
  jobHref: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  jobSummary: string | null;
  jobMatch: ProposalRailJobMatchSummary | null;
  sourceCvTitle: string | null;
  sourceCvMeta: string | null;
  draftTitle: string;
  draftTitlePlaceholder: string;
  onDraftTitleChange: (value: string) => void;
  onDraftTitleCommit: () => void;
  toneLabel: string;
  toneOptions: ProposalRailToneOption[];
  onSelectTone: (toneId: string | null) => void;
  lengthOptions: ProposalRailLengthOption[];
  onSelectLength: (lengthId: ProposalRailLengthOption["id"]) => void;
  stylePreset: VerbatiStylePreset;
  styleTemplateBundleId: ProposalTemplateBundleId | null;
  onSelectStyleBundle: (bundleId: ProposalTemplateBundleId) => void;
  onResetStyleBundle?: (bundleId: ProposalTemplateBundleId) => void;
  onSelectStyleTypography: (typography: VerbatiStylePreset["typography"]) => void;
  onSelectStylePalette: (palette: ProposalPaletteId) => void;
  onSelectStyleFixedAccent?: (hex: string) => void;
  onSelectStyleCustomAccent: (hex: string) => void;
  onClearStyleCustomAccent?: () => void;
  aiStream: React.ReactNode;
  variableFields: ProposalRailVariableField[];
  hasProposalContent: boolean;
  generateLabel: string;
  generateDisabled: boolean;
  generateState: "idle" | "loading" | "success" | "error";
  onGenerateDraft: () => void;
  onNewProposal?: () => void;
  onSaveToLibrary?: () => void;
  onDeleteProposal?: () => void;
  cvOptions: ProposalRailCvOption[];
  onSelectCv: (cvId: string) => void;
  onClearCv: () => void;
  onCreateCv: () => void;
  onImportCv: () => void;
  askAiValue: string;
  askAiBusy: boolean;
  askAiDisabled: boolean;
  askAiPlaceholder: string;
  askAiHint: string;
  onAskAiChange: (value: string) => void;
  onAskAiSubmit: () => void;
};

export function ProposalRail({
  jobTitle,
  company,
  location,
  jobHref,
  sourceLabel,
  sourceUrl,
  jobSummary,
  jobMatch,
  sourceCvTitle,
  sourceCvMeta,
  draftTitle,
  draftTitlePlaceholder,
  onDraftTitleChange,
  onDraftTitleCommit,
  toneLabel,
  toneOptions,
  onSelectTone,
  lengthOptions,
  onSelectLength,
  stylePreset,
  styleTemplateBundleId,
  onSelectStyleBundle,
  onResetStyleBundle,
  onSelectStyleTypography,
  onSelectStylePalette,
  onSelectStyleCustomAccent,
  onClearStyleCustomAccent,
  aiStream,
  variableFields,
  hasProposalContent,
  generateLabel,
  generateDisabled,
  generateState,
  onGenerateDraft,
  onNewProposal,
  onSaveToLibrary,
  onDeleteProposal,
  cvOptions,
  onSelectCv,
  onClearCv,
  onCreateCv,
  onImportCv,
  askAiValue,
  askAiBusy,
  askAiDisabled,
  askAiPlaceholder,
  askAiHint,
  onAskAiChange,
  onAskAiSubmit,
}: ProposalRailProps): JSX.Element {
  const [activeTab, setActiveTab] = React.useState<ProposalRailTab>("draft");
  const [jobContextOpen, setJobContextOpen] = React.useState(false);
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] = React.useState(false);
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const jobMeta = [company, location].filter(Boolean).join(" · ");
  const compactJobSummary = jobSummary?.trim() || jobMeta || null;
  const cvMenuSections = React.useMemo<MenuSection[]>(() => {
    const cvItems = cvOptions.map((option) => ({
      id: option.id,
      role: "menuitemradio" as const,
      selected: option.selected,
      label: option.title,
      onSelect: () => onSelectCv(option.id),
    }));

    return [
      {
        items: [
          {
            id: "create-cv",
            label: "Create new CV",
            icon: <FileUser size={15} strokeWidth={1.8} />,
            onSelect: onCreateCv,
          },
          {
            id: "import-cv",
            label: "Import PDF",
            icon: <FilePdf size={15} strokeWidth={1.8} />,
            onSelect: onImportCv,
          },
          ...(sourceCvTitle
            ? [
                {
                  id: "detach-cv",
                  label: "Remove attached CV",
                  icon: <X size={15} strokeWidth={1.9} />,
                  onSelect: onClearCv,
                },
              ]
            : []),
        ],
      },
      {
        label: "Pick a CV",
        items:
          cvItems.length > 0
            ? cvItems
            : [
                {
                  id: "no-cvs",
                  label: "No CVs available",
                  description: "Create or import a PDF first.",
                  disabled: true,
                },
              ],
      },
    ];
  }, [cvOptions, onClearCv, onCreateCv, onImportCv, onSelectCv, sourceCvTitle]);

  const selectedToneOption =
    toneOptions.find((option) => option.selected) ?? toneOptions[0] ?? null;
  const selectedLengthOption =
    lengthOptions.find((option) => option.selected) ?? lengthOptions[1] ?? lengthOptions[0] ?? null;

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
  const isActiveTemplateBundleCustomized = Boolean(
    styleTemplateBundleId &&
      !railStylesEqual(stylePreset, activeTemplateBundleDefinition.stylePreset),
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

  React.useEffect(() => {
    if (activeTab !== "style") {
      setIsCustomColorPickerOpen(false);
    }
  }, [activeTab]);

  const toneMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: "Tone",
        items: toneOptions.map((option) => ({
          id: option.id ?? "auto",
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          description: option.description,
          onSelect: () => onSelectTone(option.id),
        })),
      },
    ],
    [onSelectTone, toneOptions],
  );

  const lengthMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: "Length",
        items: lengthOptions.map((option) => ({
          id: option.id,
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          ariaLabel: `${option.label} proposal length`,
          onSelect: () => onSelectLength(option.id),
        })),
      },
    ],
    [lengthOptions, onSelectLength],
  );

  const renderLengthSelect = (size: "sm" | "md") => (
    <Menu
      ariaLabel="Length"
      align="start"
      side="bottom"
      matchTriggerWidth={size === "md"}
      sections={lengthMenuSections}
      trigger={
        <button
          type="button"
          id={size === "sm" ? "proposal-rail-ask-length" : "proposal-rail-draft-length"}
          className={`ds-btn ds-btn--${size} ds-btn--secondary dasti-proposal-skeleton-rail__length-select dasti-toolbar-tooltip-trigger--above`}
          data-toolbar-tooltip={selectedLengthOption?.description ?? "Proposal length"}
        >
          <span>{selectedLengthOption?.label ?? "Standard"}</span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
      }
    />
  );

  const renderToneSelect = (size: "sm" | "md") => (
    <Menu
      ariaLabel="Tone"
      align={size === "sm" ? "end" : "start"}
      side="bottom"
      matchTriggerWidth={size === "md"}
      sections={toneMenuSections}
      trigger={
        <button
          type="button"
          className={`ds-btn ds-btn--${size} ds-btn--secondary dasti-proposal-skeleton-rail__tone-select dasti-toolbar-tooltip-trigger--above`}
          data-toolbar-tooltip={selectedToneOption?.description ?? "Proposal tone"}
        >
          <span>{toneLabel}</span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
      }
    />
  );

  const renderVariableField = (field: ProposalRailVariableField) => (
    <label
      key={field.id}
      className={[
        "dasti-proposal-skeleton-rail__variable-field",
        field.multiline ? "dasti-proposal-skeleton-rail__variable-field--wide" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {field.multiline ? (
        <textarea
          className="ds-field ds-field--textarea"
          aria-label={field.label}
          value={field.value}
          placeholder={field.placeholder}
          onChange={(event) => field.onChange(event.target.value)}
          onBlur={field.onBlur}
        />
      ) : (
        <input
          className="ds-field"
          aria-label={field.label}
          value={field.value}
          placeholder={field.placeholder}
          onChange={(event) => field.onChange(event.target.value)}
          onBlur={field.onBlur}
        />
      )}
    </label>
  );

  const headingFieldGroups = [
    {
      id: "applicant",
      label: "Applicant details",
      fieldIds: ["applicant-name", "applicant-role", "contact-line"],
    },
    {
      id: "recipient",
      label: "Recipient details",
      fieldIds: ["recipient-details"],
    },
    {
      id: "letter-formulas",
      label: "Letter details",
      fieldIds: ["proposal-subject", "letter-date", "salutation"],
    },
  ]
    .map((group) => ({
      ...group,
      fields: group.fieldIds
        .map((fieldId) => variableFields.find((field) => field.id === fieldId))
        .filter((field): field is ProposalRailVariableField => Boolean(field)),
    }))
    .filter((group) => group.fields.length > 0);

  const groupedHeadingFieldIds = new Set(
    headingFieldGroups.flatMap((group) => group.fields.map((field) => field.id)),
  );
  const remainingHeadingFields = variableFields.filter(
    (field) => !groupedHeadingFieldIds.has(field.id),
  );

  return (
    <aside className="forge__rail dasti-proposal-skeleton-rail" aria-label="Proposal rail">
      <div className="dasti-proposal-skeleton-rail__tabs" role="tablist" aria-label="Proposal tools">
        {[
          ["draft", "Draft"],
          ["ask", "Ask"],
          ["header", "Heading"],
          ["style", "Style"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className="dasti-proposal-skeleton-rail__tab"
            data-active={activeTab === id ? "true" : undefined}
            onClick={() => setActiveTab(id as ProposalRailTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {aiStream ? <div className="dasti-proposal-skeleton-rail__process">{aiStream}</div> : null}

      {activeTab === "draft" ? (
        <>
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__job-context">
        <button
          type="button"
          className="dasti-proposal-skeleton-rail__summary-row dasti-proposal-skeleton-rail__summary-row--job"
          aria-expanded={jobContextOpen}
          aria-controls="proposal-rail-job-context"
          onClick={() => setJobContextOpen((current) => !current)}
        >
          <span className="dasti-proposal-skeleton-rail__summary-copy">
            <span className="forge__rail-label dasti-proposal-skeleton-rail__label">Job context</span>
            <span className="forge__rail-title dasti-proposal-skeleton-rail__title">
              {jobTitle || "Untitled job offer"}
            </span>
            {compactJobSummary ? (
              <span className="dasti-proposal-skeleton-rail__summary-text">
                {compactJobSummary}
              </span>
            ) : null}
          </span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
        {jobContextOpen ? (
          <div id="proposal-rail-job-context" className="dasti-proposal-skeleton-rail__drawer-body">
            {jobHref || sourceUrl ? (
              <div className="dasti-proposal-skeleton-rail__job-links">
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dasti-proposal-skeleton-rail__job-link"
                    aria-label={`Open original job offer${sourceLabel ? ` on ${sourceLabel}` : ""}`}
                    title={`Open original job offer${sourceLabel ? ` on ${sourceLabel}` : ""}`}
                  >
                    <span>Source</span>
                    <ArrowSquareOut className="dasti-proposal-skeleton-rail__link-icon" aria-hidden="true" />
                  </a>
                ) : null}
                {jobHref ? (
                  <a href={jobHref} className="dasti-proposal-skeleton-rail__job-link">
                    <span>Job page</span>
                    <Briefcase className="dasti-proposal-skeleton-rail__link-icon" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {jobMatch ? (
              <div className={`dasti-proposal-skeleton-rail__match dasti-proposal-skeleton-rail__match--${jobMatch.tone}`}>
                <span className="dasti-proposal-skeleton-rail__match-dot" aria-hidden="true" />
                <span>
                  <strong>{jobMatch.label}</strong>
                  {jobMatch.detail ? <small>{jobMatch.detail}</small> : null}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Draft</div>
        <div className="dasti-proposal-skeleton-rail__draft-setup">
          <div className="dasti-proposal-skeleton-rail__draft-setup-body">
            <label className="dasti-proposal-skeleton-rail__variable-field">
              <input
                className="ds-field"
                value={draftTitle}
                placeholder={draftTitlePlaceholder}
                title="Name this draft."
                onChange={(event) => onDraftTitleChange(event.target.value)}
                onBlur={onDraftTitleCommit}
                aria-label="Draft title"
              />
            </label>
            <div className="dasti-proposal-skeleton-rail__control-stack">
              <Menu
                ariaLabel={sourceCvTitle ? "Source CV" : "Pick a CV"}
                align="start"
                side="bottom"
                matchTriggerWidth
                sections={cvMenuSections}
                trigger={
                  <button
                    type="button"
                    className="ds-btn ds-btn--md ds-btn--secondary dasti-proposal-skeleton-rail__cv-button"
                    title="Choose the CV used for this draft."
                  >
                    <span>
                      <strong>{sourceCvTitle || "Pick a CV"}</strong>
                      {sourceCvMeta ? <small>{sourceCvMeta}</small> : null}
                    </span>
                    <span className="dasti-proposal-skeleton-rail__cv-caret" aria-hidden="true">
                      <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
                    </span>
                  </button>
                }
              />
            </div>
            <div className="dasti-proposal-skeleton-rail__control-stack">
              {renderToneSelect("md")}
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              title="Generate a draft from this job and CV."
              disabled={generateDisabled}
              data-state={generateState}
              onClick={onGenerateDraft}
            >
              {generateLabel}
            </Button>
            {onNewProposal || onSaveToLibrary || onDeleteProposal ? (
              <div
                className="dasti-proposal-skeleton-rail__draft-actions"
                role="group"
                aria-label="Draft actions"
              >
                {onNewProposal ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onNewProposal}
                    iconLeft={<Plus size={14} strokeWidth={1.8} />}
                  >
                    New proposal
                  </Button>
                ) : null}
                {onSaveToLibrary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSaveToLibrary}
                    disabled={!hasProposalContent}
                    aria-label="Save proposal to library"
                    title="Save proposal to library"
                    iconLeft={<FloppyDisk size={14} strokeWidth={1.8} />}
                  >
                    Save to library
                  </Button>
                ) : null}
                {onDeleteProposal ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteProposal}
                    disabled={!hasProposalContent}
                    iconLeft={<TrashSimple size={14} strokeWidth={1.8} />}
                  >
                    Delete proposal
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
        </>
      ) : null}

      {activeTab === "ask" ? (
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__ask-section dasti-toolbar--surface-tooltips">
        <div className="dasti-proposal-skeleton-rail__ask-header">
          <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Ask</div>
        </div>
        <div className="dasti-proposal-skeleton-rail__ask-hub">
          <label
            className="dasti-proposal-skeleton-rail__ask-field dasti-toolbar-tooltip-trigger--above"
            data-toolbar-tooltip="Describe the change you want to apply to the current draft."
          >
            <span className="sr-only">Ask AI</span>
            <textarea
              className="ds-field ds-field--textarea"
              value={askAiValue}
              placeholder={askAiPlaceholder}
              disabled={askAiDisabled || askAiBusy}
              onChange={(event) => onAskAiChange(event.target.value)}
            />
          </label>
          <div className="dasti-proposal-skeleton-rail__ask-controls">
            {renderLengthSelect("sm")}
            {renderToneSelect("sm")}
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          data-toolbar-tooltip={askAiHint}
          disabled={askAiDisabled || askAiBusy || !askAiValue.trim()}
          onClick={onAskAiSubmit}
        >
          {askAiBusy ? "Applying…" : "Send"}
        </Button>
      </section>
      ) : null}

      {activeTab === "style" ? (
        <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__style" data-rail-pane="style">
          <div className="dasti-proposal-skeleton-rail__style-note">
            Style inherited from selected CV when available.
            <br />
            Default settings{" "}
            <a className="dasti-proposal-skeleton-rail__link" href="/settings">
              → Document style
            </a>
            .
          </div>
          <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Template</div>
          <div className="dasti-proposal-skeleton-rail__style-pills" aria-label="Proposal style presets">
            {PROPOSAL_STYLE_OPTIONS.map((option) => {
              const isSelected = activeTemplateBundleId === option.id;
              const label =
                isSelected && isActiveTemplateBundleCustomized
                  ? `${option.label} · Custom`
                  : option.label;

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
                  {label}
                </button>
              );
            })}
            {isActiveTemplateBundleCustomized && onResetStyleBundle ? (
              <button
                type="button"
                className="dasti-proposal-skeleton-rail__style-reset"
                aria-label={`Reset ${activeTemplateBundleLabel}`}
                title={`Reset ${activeTemplateBundleLabel} to its original color, font, and layout.`}
                onClick={() => {
                  setIsCustomColorPickerOpen(false);
                  onResetStyleBundle(activeTemplateBundleId);
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
          <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Font pair</div>
          <ProposalRailFontPairMenu
            value={stylePreset.typography}
            onSelectFontPair={(typography) => {
              setIsCustomColorPickerOpen(false);
              onSelectStyleTypography(typography);
            }}
          />
          <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Accent</div>
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
                    isSelected ? "" : "dasti-proposal-skeleton-rail__style-swatch--icon",
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
                  {isSelected ? (
                    <Check size={12} strokeWidth={1.9} />
                  ) : (
                    <ColorWheel
                      className="dasti-proposal-skeleton-rail__style-swatch-wheel"
                      aria-hidden="true"
                    />
                  )}
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
        </section>
      ) : null}

      {activeTab === "header" ? (
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__header-details">
        <div className="dasti-proposal-skeleton-rail__summary-row">
          <span className="dasti-proposal-skeleton-rail__summary-copy">
            <span className="forge__rail-label dasti-proposal-skeleton-rail__label">Heading</span>
          </span>
        </div>
        <div className="dasti-proposal-skeleton-rail__drawer-body">
            {variableFields.length > 0 ? (
              <div className="dasti-proposal-skeleton-rail__variables">
                {headingFieldGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`dasti-proposal-skeleton-rail__variable-group dasti-proposal-skeleton-rail__variable-group--${group.id}`}
                  >
                    <div className="dasti-proposal-skeleton-rail__variable-group-title">
                      {group.label}
                    </div>
                    <div className="dasti-proposal-skeleton-rail__variable-group-fields">
                      {group.fields.map(renderVariableField)}
                    </div>
                  </div>
                ))}
                {remainingHeadingFields.length > 0 ? (
                  <div className="dasti-proposal-skeleton-rail__variable-group">
                    <div className="dasti-proposal-skeleton-rail__variable-group-title">
                      Other heading fields
                    </div>
                    <div className="dasti-proposal-skeleton-rail__variable-group-fields">
                      {remainingHeadingFields.map(renderVariableField)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="dasti-proposal-skeleton-rail__hint">
                Generate a draft to edit document header details here.
              </p>
            )}
          </div>
      </section>
      ) : null}
    </aside>
  );
}

export default ProposalRail;
