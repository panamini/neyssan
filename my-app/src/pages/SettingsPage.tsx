/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unused-vars, no-mixed-spaces-and-tabs -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
/* eslint-disable react-refresh/only-export-components -- Existing mixed component/helper exports are outside this release-gate cleanup; split exports in a focused follow-up. */
import React from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { useForgeTemplatePanel } from "../contexts/ForgeTemplatePanelContext";
import {
  Check,
  Eraser,
  Moon,
  Pen,
  Sun,
  TrashSimple,
  Upload,
} from "@/lib/icons";
import {
  getProposalStyleDefinition,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import {
  PROPOSAL_PALETTE_OPTIONS,
  PROPOSAL_STYLE_PREVIEW_DEFINITIONS,
  PROPOSAL_AUTO_STYLE_PREVIEW,
  isProposalPaletteId,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import {
  VERBATI_FONT_PAIR_OPTIONS,
  type VerbatiFontPairId,
} from "../features/verbati/fontCatalog";
import {
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
} from "../features/verbati/style";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  type ResumeTemplateId,
} from "../lib/layout/resumeTemplates";
import { getStyleFamilyDefinition } from "../lib/layout/styleFamilies";
import type {
  StyleFamilyId,
  VerbatiStylePreset,
} from "../features/verbati/types";
import { useMotionPreference } from "../lib/motion-preference";
import { useThemeMode } from "../lib/theme-mode";
import {
  UI_ACCENT_OPTIONS,
  UI_CUSTOM_ACCENT_STARTER_HEX,
  UI_LANGUAGE_OPTIONS,
  useUiAccentPreference,
  useUiLanguagePreference,
  type UiAccentId,
} from "../lib/ui-preferences";
import { translateUi, type UiMessageKey } from "../lib/i18n";
import {
  DOCUMENT_LANGUAGE_OPTIONS,
  useDocumentLanguagePreference,
} from "../lib/document-language";
import {
  DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
  PROPOSAL_SIGNATURE_FONT_OPTIONS,
  resolveProposalSignatureRender,
  sanitizeProposalSignatureSettings,
  type ProposalSignatureSettings,
} from "../lib/proposal-signature-settings";
import {
  getLocalPersonalizationSourceByCvId,
  getProposalApplicantHeaderData,
} from "../lib/proposal-personalization";
import { getFactoryDocumentStyleSlot } from "../lib/document-style-slots";
import { ProposalColorPickerPopover } from "../components/ProposalColorPickerPopover";
import type { ToneBadgeTone } from "../components/ui/tone-badge";
import { normalizeSettingsTab } from "../lib/settings-tabs";
import {
  PROPOSAL_LLM_MODEL_OPTIONS,
  useProposalLlmModelPreference,
} from "../lib/proposal-llm-preference";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotIndex = 1 | 2 | 3;

type SettingsAccentOption = {
  id: string;
  label: string;
  swatch: string;
  paletteOverride: ProposalPaletteId | null;
  accentHex: string | null;
};

type StoredVerbatiStyle = Omit<VerbatiStylePreset, "accentHex"> & {
  accentHex?: string | null;
};

type ToneId = "signature" | "expert" | "engaging" | null;

type PresetSlot = {
  fontPairId: VerbatiFontPairId | null;
  styleChoice: ProposalStyleChoice;
  paletteOverride: ProposalPaletteId | null;
  accentHex: string | null;
  verbatiStyle?: StoredVerbatiStyle | null;
  voicePreset: "signature" | "expert" | "engaging" | null;
  signatureSettings: ProposalSignatureSettings;
  name?: string;
};

type ProposalContactSettings = {
  proposalDefaultContactEmail?: string | null;
  proposalDefaultContactPhone?: string | null;
  proposalDefaultContactLinkedin?: string | null;
  proposalDefaultContactWebsite?: string | null;
  proposalDefaultContactLocation?: string | null;
  savedVoicePreset?: ToneId;
  signatureSettings?: ProposalSignatureSettings | null;
};

type ProposalContactField = Exclude<
  keyof ProposalContactSettings,
  "savedVoicePreset" | "signatureSettings"
>;

const PROPOSAL_CONTACT_FIELDS: Array<{
  id: ProposalContactField;
  labelKey: UiMessageKey;
  type: React.HTMLInputTypeAttribute;
  placeholder: string;
  fallbackKey: "email" | "phone" | "location" | "linkedin" | "website";
}> = [
  {
    id: "proposalDefaultContactEmail",
    labelKey: "settings.contact.email",
    type: "email",
    placeholder: "name@example.com",
    fallbackKey: "email",
  },
  {
    id: "proposalDefaultContactPhone",
    labelKey: "settings.contact.phone",
    type: "tel",
    placeholder: "+33 6 00 00 00 00",
    fallbackKey: "phone",
  },
  {
    id: "proposalDefaultContactLocation",
    labelKey: "settings.contact.location",
    type: "text",
    placeholder: "Paris, France",
    fallbackKey: "location",
  },
  {
    id: "proposalDefaultContactLinkedin",
    labelKey: "settings.contact.linkedin",
    type: "url",
    placeholder: "https://linkedin.com/in/name",
    fallbackKey: "linkedin",
  },
  {
    id: "proposalDefaultContactWebsite",
    labelKey: "settings.contact.website",
    type: "url",
    placeholder: "https://example.com",
    fallbackKey: "website",
  },
];

const EMPTY_PROPOSAL_CONTACT_FIELDS: Record<ProposalContactField, string> = {
  proposalDefaultContactEmail: "",
  proposalDefaultContactPhone: "",
  proposalDefaultContactLinkedin: "",
  proposalDefaultContactWebsite: "",
  proposalDefaultContactLocation: "",
};

function cleanSettingsInput(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const DEFAULT_SLOT_NAME_KEYS: Record<SlotIndex, UiMessageKey> = {
  1: "settings.style.slot1",
  2: "settings.style.slot2",
  3: "settings.style.slot3",
};

const DEFAULT_FONT_PAIR_ID = "geist-baskervville" as const;
const DEFAULT_FONT_PAIR_OPTION =
  VERBATI_FONT_PAIR_OPTIONS.find(
    (option) => option.id === DEFAULT_FONT_PAIR_ID,
  ) ?? VERBATI_FONT_PAIR_OPTIONS[0];

const EMPTY_PRESET: PresetSlot = {
  fontPairId: DEFAULT_FONT_PAIR_OPTION.id,
  styleChoice: "auto",
  paletteOverride: null,
  accentHex: null,
  voicePreset: null,
  signatureSettings: DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
};

const SETTINGS_ACCENT_OPTIONS: SettingsAccentOption[] = [
  ...PROPOSAL_PALETTE_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    swatch: option.color,
    paletteOverride: option.id,
    accentHex: null,
  })),
];

const SETTINGS_CUSTOM_ACCENT_STARTER_HEX = "#8A8176";
const SETTINGS_DOCKED_DRAWER_MIN_VIEWPORT_WIDTH = 1180;

function normalizeSettingsAccentHex(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function settingsToneBadgeTone(id: ToneId): ToneBadgeTone {
  if (id === "engaging") return "warm";
  if (id === "expert") return "formal";
  if (id === "signature") return "natural";
  return "auto";
}

// ─── Style options ─────────────────────────────────────────────────────────────

type StyleOption = {
  id: "auto" | "workshop" | "workshop-twocol";
  labelKey: UiMessageKey;
  isAuto?: boolean;
  resumeTemplateId?: ResumeTemplateId;
};

const STYLE_OPTIONS = [
  {
    id: "auto",
    labelKey: "settings.style.auto.label",
    isAuto: true,
  },
  {
    id: "workshop",
    labelKey: "settings.style.minimal.label",
    resumeTemplateId: WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  },
  {
    id: "workshop-twocol",
    labelKey: "settings.style.french.label",
    resumeTemplateId: WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  },
] satisfies StyleOption[];

type ToneOption = {
  id: ToneId;
  labelKey: UiMessageKey;
  descriptionKey: UiMessageKey;
};

const TONE_OPTIONS = [
  {
    id: null,
    labelKey: "settings.tone.auto.label",
    descriptionKey: "settings.tone.auto.description",
  },
  {
    id: "engaging",
    labelKey: "settings.tone.engaging.label",
    descriptionKey: "settings.tone.engaging.description",
  },
  {
    id: "signature",
    labelKey: "settings.tone.signature.label",
    descriptionKey: "settings.tone.signature.description",
  },
  {
    id: "expert",
    labelKey: "settings.tone.expert.label",
    descriptionKey: "settings.tone.expert.description",
  },
] satisfies ToneOption[];

function buildPresetSlotStylePreset(preset: PresetSlot): VerbatiStylePreset {
  const baseStyle = preset.verbatiStyle
    ? resolveVerbatiStyle(preset.verbatiStyle as Partial<VerbatiStylePreset>)
    : getProposalStyleDefinition(preset.styleChoice).stylePreset;

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

function resolvePresetPaletteSelection(
  preset: PresetSlot,
): ProposalPaletteId | null {
  if (preset.paletteOverride) {
    return preset.paletteOverride;
  }

  const stylePreset = buildPresetSlotStylePreset(preset);
  return stylePreset.palette !== "custom" &&
    isProposalPaletteId(stylePreset.palette)
    ? stylePreset.palette
    : null;
}

function resolvePresetLayoutSelection(preset: PresetSlot): StyleOption["id"] {
  if (!preset.verbatiStyle && preset.styleChoice === "auto") {
    return "auto";
  }

  const stylePreset = buildPresetSlotStylePreset(preset);
  if (stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID) {
    return "workshop-twocol";
  }
  return stylePreset.layout === "workshop" ? "workshop" : "auto";
}

function resolveStyleChoiceForLayout(
  layoutId: Exclude<StyleOption["id"], "auto">,
): ProposalStyleChoice {
  switch (layoutId) {
    case "workshop":
    case "workshop-twocol":
    default:
      return "balanced";
  }
}

function buildVerbatiStyleForLayout(args: {
  layoutId: Exclude<StyleOption["id"], "auto">;
  preset: PresetSlot;
  slot: SlotIndex;
}): VerbatiStylePreset {
  const familyId: StyleFamilyId = "workshop";
  const family = getStyleFamilyDefinition(familyId);
  const factorySlot = getFactoryDocumentStyleSlot(args.slot);
  const existingPalette =
    args.preset.verbatiStyle?.palette &&
    args.preset.verbatiStyle.palette !== "custom" &&
    isProposalPaletteId(args.preset.verbatiStyle.palette)
      ? args.preset.verbatiStyle.palette
      : factorySlot.appearance.palette;
  const resumeTemplateId =
    args.layoutId === "workshop-twocol"
      ? WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
      : WORKSHOP_RESUME_ONECOL_TEMPLATE_ID;

  return resolveVerbatiStyle({
    familyId,
    layout: familyId,
    resumeTemplateId,
    typography: args.preset.fontPairId ?? family.defaultTypography,
    ...(args.preset.accentHex
      ? {
          palette: "custom" as const,
          accentHex: args.preset.accentHex,
        }
      : args.preset.paletteOverride
        ? { palette: args.preset.paletteOverride }
        : { palette: existingPalette }),
  });
}

function buildDefaultPresetSlot(slot: SlotIndex): PresetSlot {
  const factorySlot = getFactoryDocumentStyleSlot(slot);
  return {
    ...EMPTY_PRESET,
    fontPairId: factorySlot.appearance.typography,
    styleChoice: "balanced",
    paletteOverride: isProposalPaletteId(factorySlot.appearance.palette)
      ? factorySlot.appearance.palette
      : null,
    accentHex: factorySlot.appearance.accentHex ?? null,
    signatureSettings: DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
    verbatiStyle: {
      ...resolveVerbatiStyle({
        ...factorySlot.appearance,
        resumeTemplateId: factorySlot.defaultCvTemplateId,
      }),
      accentHex: factorySlot.appearance.accentHex ?? null,
    },
    name: factorySlot.label,
  };
}

function buildPresetSavePayload(
  preset: PresetSlot,
  slot: SlotIndex,
): PresetSlot {
  const layoutSelection = resolvePresetLayoutSelection(preset);
  const nextVerbatiStyle =
    layoutSelection === "auto"
      ? null
      : buildVerbatiStyleForLayout({
          layoutId: layoutSelection,
          preset,
          slot,
        });

  return {
    ...preset,
    verbatiStyle: nextVerbatiStyle
      ? {
          ...nextVerbatiStyle,
          accentHex: nextVerbatiStyle.accentHex ?? null,
        }
      : null,
  };
}

// ─── Tilt hook ────────────────────────────────────────────────────────────────

// ─── Mini style preview helper ────────────────────────────────────────────────

function StyleMiniPreview({ styleId }: { styleId: StyleOption["id"] }) {
  return (
    <div
      className={`dasti-settings-style-card__mini dasti-settings-style-card__mini--${styleId}`}
      aria-hidden="true"
    >
      <span className="dasti-settings-style-card__mini-header" />
      <span className="dasti-settings-style-card__mini-title" />
      <span className="dasti-settings-style-card__mini-body dasti-settings-style-card__mini-body--primary" />
      <span className="dasti-settings-style-card__mini-body" />
      <span className="dasti-settings-style-card__mini-body" />
    </div>
  );
}

// ─── Layout style card — Pure CSS 5×5 hotspot tilt ────────────────────────────

const ZONE_INDICES = Array.from({ length: 25 }, (_, i) => i + 1);

function SettingsLayoutCard({
  option,
  label,
  active,
  onSelect,
}: {
  option: StyleOption;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="layout-card"
      data-selected={active ? "true" : "false"}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span
        className="layout-card__preview"
        data-layout={option.id}
        aria-hidden="true"
      >
        {option.id === "workshop" || option.id === "workshop-twocol" ? (
          <>
            <span className="layout-card__column">
              <span className="layout-card__line layout-card__line--title" />
              <span className="layout-card__line layout-card__line--short" />
              <span className="layout-card__line" />
              <span className="layout-card__line layout-card__line--med" />
            </span>
            <span className="layout-card__column layout-card__column--wide">
              <span className="layout-card__line layout-card__line--med" />
              <span className="layout-card__line" />
              <span className="layout-card__line layout-card__line--short" />
              <span className="layout-card__line" />
              <span className="layout-card__line layout-card__line--med" />
            </span>
          </>
        ) : (
          <>
            <span className="layout-card__line layout-card__line--title layout-card__line--med" />
            <span className="layout-card__line layout-card__line--short" />
            <span className="layout-card__line layout-card__line--accent" />
            <span className="layout-card__line" />
            <span className="layout-card__line layout-card__line--short" />
            <span className="layout-card__line layout-card__line--accent" />
            <span className="layout-card__line" />
            <span className="layout-card__line layout-card__line--med" />
          </>
        )}
      </span>
      <span className="layout-card__name">{label}</span>
    </button>
  );
}

// ─── Hero preview ──────────────────────────────────────────────────────────────

function HeroPreview({
  preset,
  slotName,
  styleLabel,
}: {
  preset: PresetSlot;
  slotName: string;
  styleLabel: string;
}) {
  const fontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === preset.fontPairId) ??
    DEFAULT_FONT_PAIR_OPTION;
  const layoutSelection = resolvePresetLayoutSelection(preset);
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find(
    (p) => p.id === preset.paletteOverride,
  );
  const stylePreset = buildPresetSlotStylePreset(preset);
  const signatureRender = resolveProposalSignatureRender({
    settings: preset.signatureSettings,
    bodyFontFamily: fontPair?.bodyFamily ?? "inherit",
  });

  const accentColor =
    preset.accentHex ??
    paletteOption?.color ??
    "color-mix(in srgb, var(--color-accent) 80%, white 20%)";

  const previewDef =
    layoutSelection === "auto"
      ? PROPOSAL_AUTO_STYLE_PREVIEW
      : PROPOSAL_STYLE_PREVIEW_DEFINITIONS.balanced;

  return (
    <article
      className={`dasti-settings-hero-preview dasti-settings-hero-preview--${layoutSelection}`}
      data-font-pair-id={fontPair.id}
      style={{ "--hero-accent": accentColor } as React.CSSProperties}
    >
      <div className="dasti-settings-hero-preview__inner">
        <div className="dasti-settings-hero-preview__heading-block">
          <h2
            className="dasti-settings-hero-preview__title"
            style={{
              fontFamily: fontPair?.headingFamily,
              fontWeight: previewDef.headingWeight,
              fontStyle: previewDef.fontStyle ?? "normal",
            }}
          >
            Protection Guard
          </h2>
          <p
            className="dasti-settings-hero-preview__subtitle"
            style={{ fontFamily: fontPair?.bodyFamily }}
          >
            Robert Cooper
          </p>
        </div>
        <div
          className="dasti-settings-hero-preview__divider"
          aria-hidden="true"
        />
        <div
          className="dasti-settings-hero-preview__body-lines"
          aria-hidden="true"
          style={{ fontFamily: fontPair?.bodyFamily }}
        >
          <p className="dasti-settings-hero-preview__body-text">
            I am writing to express my interest in the position at your esteemed
            organisation, bringing relevant expertise and a strong record of
            achievement.
          </p>
        </div>
        <div
          className="dasti-settings-hero-preview__signature"
          aria-hidden="true"
        >
          {signatureRender.kind === "image" ? (
            <img src={signatureRender.imageDataUrl} alt="" />
          ) : (
            <span style={{ fontFamily: signatureRender.fontFamily }}>
              {SIGNATURE_SAMPLE_NAME}
            </span>
          )}
        </div>
        <div className="dasti-settings-hero-preview__footer" aria-hidden="true">
          <span className="dasti-settings-hero-preview__chip">
            {fontPair?.headingLabel} / {fontPair?.bodyLabel}
          </span>
          <span className="dasti-settings-hero-preview__style-badge">
            {styleLabel}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Slot card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slotName,
  preset,
  isEditing,
  isActive,
  onSelect,
}: {
  slotName: string;
  preset: PresetSlot;
  isEditing: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const fontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === preset.fontPairId) ??
    DEFAULT_FONT_PAIR_OPTION;
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find(
    (p) => p.id === preset.paletteOverride,
  );
  const accentColor =
    preset.accentHex ??
    paletteOption?.color ??
    "color-mix(in srgb, var(--color-accent) 80%, white 20%)";

  return (
    <button
      type="button"
      className={[
        "dasti-settings-slot-card",
        isEditing ? "dasti-settings-slot-card--editing" : "",
        isActive ? "dasti-settings-slot-card--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      aria-pressed={isEditing}
      title={`${t("settings.editSlot")} ${slotName}`}
    >
      <div className="dasti-settings-slot-card__top">
        <span className="dasti-settings-slot-card__name">{slotName}</span>
        {isActive ? (
          <span
            className="dasti-settings-slot-card__active-badge"
            aria-label={t("settings.activeDefault")}
          >
            <Check size={9} strokeWidth={2.6} aria-hidden="true" />
            {t("settings.defaultBadge")}
          </span>
        ) : null}
      </div>

      <div className="dasti-settings-slot-card__meta">
        <span
          className="dasti-settings-slot-card__font-label"
          style={{ fontFamily: fontPair?.headingFamily, fontWeight: 700 }}
        >
          {fontPair?.headingLabel}
        </span>
        <span className="dasti-settings-slot-card__font-sep" aria-hidden="true">
          /
        </span>
        <span
          className="dasti-settings-slot-card__font-label"
          style={{ fontFamily: fontPair?.bodyFamily }}
        >
          {fontPair?.bodyLabel}
        </span>
      </div>
    </button>
  );
}

// ─── Font pair grid ─────────────────────────────────────────────────────────────

function FontPairGrid({
  selectedId,
  onChange,
}: {
  selectedId: VerbatiFontPairId | null;
  onChange: (id: VerbatiFontPairId) => void;
}) {
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  return (
    <div
      className="dasti-settings-font-grid"
      role="group"
      aria-label={t("settings.fontPair")}
    >
      {VERBATI_FONT_PAIR_OPTIONS.map((pair) => {
        const active = selectedId === pair.id;
        return (
          <button
            key={pair.id}
            type="button"
            className={[
              "dasti-settings-font-pair-card",
              active ? "dasti-settings-font-pair-card--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-font-pair-id={pair.id}
            aria-pressed={active}
            onClick={() => onChange(pair.id)}
          >
            <span
              className="dasti-settings-font-pair-card__heading"
              style={{ fontFamily: pair.headingFamily, fontWeight: 700 }}
            >
              {pair.headingLabel}
            </span>
            <span
              className="dasti-settings-font-pair-card__body"
              style={{ fontFamily: pair.bodyFamily }}
            >
              {pair.bodyLabel}
            </span>
            {active && (
              <span
                className="dasti-settings-font-pair-card__check"
                aria-hidden="true"
              >
                <Check size={10} strokeWidth={2.6} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Signature selector ───────────────────────────────────────────────────────

const SIGNATURE_SAMPLE_NAME = "robert cooper";
const SIGNATURE_IMAGE_MAX_SIDE = 520;
const SIGNATURE_DRAW_CROP_PADDING_PX = 12;
const SIGNATURE_DRAW_ALPHA_THRESHOLD = 8;

function getCanvasContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("jsdom")
  ) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

async function readSignatureImageFile(file: File): Promise<string> {
  if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type)) {
    throw new Error("Use a PNG, JPG, or WebP signature image.");
  }

  const sourceDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onerror = () => reject(new Error("Could not load the image."));
    nextImage.onload = () => resolve(nextImage);
    nextImage.src = sourceDataUrl;
  });

  const scale = Math.min(
    1,
    SIGNATURE_IMAGE_MAX_SIDE /
      Math.max(image.naturalWidth, image.naturalHeight, 1),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = getCanvasContext(canvas);
  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function cropSignatureCanvasToInkDataUrl(
  canvas: HTMLCanvasElement,
): string | null {
  const context = getCanvasContext(canvas);
  if (!context || canvas.width <= 0 || canvas.height <= 0) {
    return null;
  }

  let pixels: ImageData;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = pixels.data[(y * canvas.width + x) * 4 + 3];
      if (alpha <= SIGNATURE_DRAW_ALPHA_THRESHOLD) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const backingScale =
    canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  const padding = Math.max(
    2,
    Math.round(SIGNATURE_DRAW_CROP_PADDING_PX * backingScale),
  );
  const sourceX = Math.max(0, minX - padding);
  const sourceY = Math.max(0, minY - padding);
  const sourceRight = Math.min(canvas.width, maxX + padding + 1);
  const sourceBottom = Math.min(canvas.height, maxY + padding + 1);
  const sourceWidth = Math.max(1, sourceRight - sourceX);
  const sourceHeight = Math.max(1, sourceBottom - sourceY);
  const target = document.createElement("canvas");
  target.width = sourceWidth;
  target.height = sourceHeight;
  const targetContext = getCanvasContext(target);
  if (!targetContext) {
    return null;
  }

  targetContext.drawImage(
    canvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  try {
    return target.toDataURL("image/png");
  } catch {
    return null;
  }
}

function SignatureDrawingPad({
  onImageReady,
  initialImageDataUrl,
  clearLabel,
  canvasLabel,
}: {
  onImageReady: (imageDataUrl: string) => void;
  initialImageDataUrl?: string | null;
  clearLabel: string;
  canvasLabel: string;
}) {
  const STROKE_WIDTH = 4.0;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);

  const syncCanvasScale = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const nextWidth = Math.max(1, Math.round(rect.width * ratio));
    const nextHeight = Math.max(1, Math.round(rect.height * ratio));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const context = getCanvasContext(canvas);
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = STROKE_WIDTH;
    context.strokeStyle =
      getComputedStyle(canvas)
        .getPropertyValue("--signature-draw-ink")
        .trim() || "#20160f";
  }, []);

  React.useEffect(() => {
    syncCanvasScale();
  }, [syncCanvasScale]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas ? getCanvasContext(canvas) : null;
    if (!canvas || !context) {
      return;
    }

    syncCanvasScale();
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!initialImageDataUrl) {
      return;
    }

    const image = new Image();
    let cancelled = false;

    image.onload = () => {
      if (cancelled) return;
      const activeContext = getCanvasContext(canvas);
      if (!activeContext) return;
      activeContext.drawImage(
        image,
        0,
        0,
        Math.max(0, canvas.clientWidth),
        Math.max(0, canvas.clientHeight),
      );
    };
    image.src = initialImageDataUrl;

    return () => {
      cancelled = true;
    };
  }, [initialImageDataUrl, syncCanvasScale]);

  const getPoint = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const finishDrawing = React.useCallback(() => {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (!canvas) return;

    try {
      onImageReady(
        cropSignatureCanvasToInkDataUrl(canvas) ?? canvas.toDataURL("image/png"),
      );
    } catch {
      // Some test environments do not implement canvas serialization.
    }
  }, [onImageReady]);

  const clearDrawing = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = getCanvasContext(canvas);
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="dasti-settings-signature-draw">
      <canvas
        ref={canvasRef}
        className="dasti-settings-signature-canvas"
        aria-label={canvasLabel}
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          const point = getPoint(event);
          if (!canvas || !point) return;
          canvas.setPointerCapture(event.pointerId);
          syncCanvasScale();
          drawingRef.current = true;
          lastPointRef.current = point;
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          const canvas = canvasRef.current;
          const point = getPoint(event);
          const lastPoint = lastPointRef.current;
          if (!canvas || !point || !lastPoint) return;
          const context = getCanvasContext(canvas);
          if (!context) return;
          context.beginPath();
          context.moveTo(lastPoint.x, lastPoint.y);
          context.lineTo(point.x, point.y);
          context.stroke();
          lastPointRef.current = point;
        }}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
      <button
        type="button"
        className="dasti-settings-signature-action dasti-settings-signature-clear"
        onClick={clearDrawing}
      >
        <Eraser size={14} strokeWidth={1.8} aria-hidden="true" />
        {clearLabel}
      </button>
    </div>
  );
}

function SignatureSelector({
  settings,
  bodyFontFamily,
  onChange,
}: {
  settings: ProposalSignatureSettings;
  bodyFontFamily: string;
  onChange: (settings: ProposalSignatureSettings) => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const signatureRender = resolveProposalSignatureRender({
    settings,
    bodyFontFamily,
  });

  const chooseImageFile = React.useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      try {
        const imageDataUrl = await readSignatureImageFile(file);
        setError(null);
        onChange({
          mode: settings.mode === "font" ? "font" : "image",
          fontId: settings.mode === "font" ? settings.fontId : null,
          imageDataUrl,
        });
      } catch (nextError) {
        const nextMessage =
          nextError instanceof Error ? nextError.message : "";
        if (nextMessage === "Use a PNG, JPG, or WebP signature image.") {
          setError(t("settings.signature.usePngJpgWebp"));
          return;
        }
        if (nextMessage === "Could not read the image.") {
          setError(t("settings.signature.couldNotRead"));
          return;
        }
        if (nextMessage === "Could not load the image.") {
          setError(t("settings.signature.couldNotLoad"));
          return;
        }
        setError(t("settings.signature.couldNotImport"));
      }
    },
    [onChange, settings.fontId, settings.mode, t],
  );

  return (
    <div
      className="dasti-settings-signature"
      role="group"
      aria-label={t("settings.printedName")}
    >
      <div className="sig-grid">
        <button
          type="button"
          className="sig-card"
          data-selected={settings.mode === "auto" ? "true" : "false"}
          aria-pressed={settings.mode === "auto"}
          onClick={() =>
            onChange({
              ...DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
              imageDataUrl: settings.imageDataUrl,
            })
          }
        >
          <span
            className="sig-card__sig sig-card__sig--auto"
            style={{ fontFamily: bodyFontFamily }}
          >
            {SIGNATURE_SAMPLE_NAME}
          </span>
          <span className="sig-card__name">
            {t("settings.signature.autoGeneratedName")}
          </span>
        </button>

        {PROPOSAL_SIGNATURE_FONT_OPTIONS.map((option) => {
          const active =
            settings.mode === "font" && settings.fontId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className="sig-card"
              data-selected={active ? "true" : "false"}
              aria-label={`${option.label} ${t("settings.printedName")}`}
              aria-pressed={active}
              onClick={() =>
                onChange({
                  mode: "font",
                  fontId: option.id,
                  imageDataUrl: settings.imageDataUrl,
                })
              }
            >
              <span
                className="sig-card__sig sig-card__sig--font"
                style={{ fontFamily: option.fontFamily }}
              >
                {SIGNATURE_SAMPLE_NAME}
              </span>
              <span className="sig-card__name">
                {option.label} — {t("settings.signature.printedNameFont")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dasti-settings-signature-tools">
        <button
          type="button"
          className="dasti-settings-signature-tool"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
          {t("settings.signature.importImage")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            void chooseImageFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          hidden
        />

        <div className="dasti-settings-signature-tool dasti-settings-signature-tool--canvas">
          <Pen size={14} strokeWidth={1.8} aria-hidden="true" />
          {t("settings.signature.drawSignature")}
          <SignatureDrawingPad
            initialImageDataUrl={settings.imageDataUrl}
            clearLabel={t("settings.signature.clear")}
            canvasLabel={t("settings.signature.drawSignature")}
            onImageReady={(imageDataUrl) =>
              onChange({
                mode: settings.mode === "font" ? "font" : "image",
                fontId: settings.mode === "font" ? settings.fontId : null,
                imageDataUrl,
              })
            }
          />
        </div>
      </div>

      <div className="dasti-settings-signature-current" aria-live="polite">
        <span className="dasti-settings-signature-current__label">
          {t("settings.signature.currentPrintedName")}
        </span>
        <span className="dasti-settings-signature-current__preview">
          {signatureRender.kind === "image" ? (
            <img
              src={signatureRender.imageDataUrl}
              alt={t("settings.signature.currentPrintedName")}
            />
          ) : (
            <span style={{ fontFamily: signatureRender.fontFamily }}>
              {SIGNATURE_SAMPLE_NAME}
            </span>
          )}
        </span>
        {settings.imageDataUrl ? (
          <button
            type="button"
            className="dasti-settings-signature-action dasti-settings-signature-current__reset"
            onClick={() =>
              onChange({
                mode: settings.mode === "image" ? "auto" : settings.mode,
                fontId: settings.mode === "font" ? settings.fontId : null,
                imageDataUrl: null,
              })
            }
          >
            <TrashSimple size={14} strokeWidth={1.8} aria-hidden="true" />
            {t("settings.signature.removeImage")}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="dasti-settings-signature-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = normalizeSettingsTab(searchParams.get("tab"));
  const { currentCvId } = useCvLibrary();
  const {
    activeSurface: activeForgePanelSurface,
    dockedSurface: dockedForgePanelSurface,
    open: forgePanelOpen,
    openMode: forgePanelOpenMode,
    openSurface: openForgePanelSurface,
  } = useForgeTemplatePanel();
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const {
    mode: themeMode,
    preference: themePreference,
    setPreference: setThemePreference,
  } = useThemeMode();
  const { preference: motionPreference, setPreference: setMotionPreference } =
    useMotionPreference();
  const {
    language: uiLanguage,
    resolvedLanguage: resolvedUiLanguage,
    setLanguage: setUiLanguage,
  } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedUiLanguage, key),
    [resolvedUiLanguage],
  );
  const { language: documentLanguage, setLanguage: setDocumentLanguage } =
    useDocumentLanguagePreference();
  const { accent: uiAccent, setAccent: setUiAccent } = useUiAccentPreference();
  const { model: proposalLlmModel, setModel: setProposalLlmModel } =
    useProposalLlmModelPreference();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const isAuthReady = isAuthLoaded !== false;
  const presetsQuery = useQuery(
    api.proposalSettings.getPresets,
    isSignedIn ? {} : "skip",
  );
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isSignedIn ? {} : "skip",
  ) as ProposalContactSettings | undefined;
  const savePreset = useMutation(api.proposalSettings.savePreset);
  const setActivePreset = useMutation(api.proposalSettings.setActivePreset);
  const setCurrentProposalSettings = useMutation(
    api.proposalSettings.setCurrent,
  );

  // Local state
  const [editingSlot, setEditingSlot] = React.useState<SlotIndex | null>(null);
  const [localPresets, setLocalPresets] = React.useState<
    Record<SlotIndex, PresetSlot>
  >({
    1: buildDefaultPresetSlot(1),
    2: buildDefaultPresetSlot(2),
    3: buildDefaultPresetSlot(3),
  });
  const [activeSlot, setActiveSlot] = React.useState<SlotIndex | null>(null);
  const [savedTick, setSavedTick] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [contactFields, setContactFields] = React.useState<
    Record<ProposalContactField, string>
  >(EMPTY_PROPOSAL_CONTACT_FIELDS);
  const [defaultVoicePreset, setDefaultVoicePreset] =
    React.useState<ToneId>(null);
  const [canonicalSignatureSettings, setCanonicalSignatureSettings] =
    React.useState<ProposalSignatureSettings>(
      DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
    );
  const savedTickTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const saveDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const uiCustomColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const uiCustomColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const hydrated = React.useRef(false);
  const localPresetInteractionRef = React.useRef(false);
  const contactHydrated = React.useRef(false);
  const voiceHydrated = React.useRef(false);
  const signatureHydrated = React.useRef(false);
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] =
    React.useState(false);
  const [isUiCustomColorPickerOpen, setIsUiCustomColorPickerOpen] =
    React.useState(false);
  const styleOptions = React.useMemo(
    () =>
      STYLE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t],
  );
  const toneOptions = React.useMemo(
    () =>
      TONE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
        description: t(option.descriptionKey),
      })),
    [t],
  );
  const contactFieldOptions = React.useMemo(
    () =>
      PROPOSAL_CONTACT_FIELDS.map((field) => ({
        ...field,
        label: t(field.labelKey),
      })),
    [t],
  );

  React.useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Sync from server once
  React.useEffect(() => {
    if (!presetsQuery || hydrated.current || localPresetInteractionRef.current)
      return;
    hydrated.current = true;

    const serverPreset = (
      slot: SlotIndex,
      raw: typeof presetsQuery.preset1,
    ): PresetSlot => {
      const defaults = buildDefaultPresetSlot(slot);
      const rawRecord = raw as
        | (typeof raw & { signatureSettings?: unknown })
        | null
        | undefined;
      const sanitizedVerbatiStyle =
        raw?.verbatiStyle === undefined
          ? undefined
          : raw.verbatiStyle === null
            ? null
            : sanitizePersistedVerbatiStyle(
                raw.verbatiStyle as Partial<VerbatiStylePreset>,
              ) ?? undefined;

      return {
        fontPairId:
          raw?.fontPairId === undefined
            ? defaults.fontPairId
            : (raw.fontPairId as VerbatiFontPairId | null),
        styleChoice:
          raw?.styleChoice === undefined
            ? defaults.styleChoice
            : (raw.styleChoice as ProposalStyleChoice),
        paletteOverride:
          raw?.paletteOverride === undefined
            ? defaults.paletteOverride
            : (raw.paletteOverride as ProposalPaletteId | null),
        accentHex:
          raw?.accentHex === undefined ? defaults.accentHex : raw.accentHex,
        verbatiStyle:
          sanitizedVerbatiStyle === undefined
            ? defaults.verbatiStyle
            : (sanitizedVerbatiStyle as StoredVerbatiStyle | null),
        voicePreset:
          raw?.voicePreset === undefined
            ? defaults.voicePreset
            : (raw.voicePreset as ToneId),
        signatureSettings:
          rawRecord?.signatureSettings === undefined
            ? defaults.signatureSettings
            : sanitizeProposalSignatureSettings(rawRecord.signatureSettings),
        name: raw?.name === undefined ? defaults.name : raw.name,
      };
    };

    const hydratedActiveSlot =
      (presetsQuery.activeSlot as SlotIndex | null) ?? 1;

    setLocalPresets({
      1: serverPreset(1, presetsQuery.preset1),
      2: serverPreset(2, presetsQuery.preset2),
      3: serverPreset(3, presetsQuery.preset3),
    });
    setActiveSlot(hydratedActiveSlot);
    setEditingSlot(hydratedActiveSlot);
  }, [presetsQuery]);

  const flashSaved = React.useCallback(() => {
    setSaveError(null);
    setSavedTick(true);
    if (savedTickTimeoutRef.current !== null)
      clearTimeout(savedTickTimeoutRef.current);
    savedTickTimeoutRef.current = setTimeout(() => {
      setSavedTick(false);
      savedTickTimeoutRef.current = null;
    }, 1600);
  }, []);

  React.useEffect(() => {
    return () => {
      if (savedTickTimeoutRef.current !== null)
        clearTimeout(savedTickTimeoutRef.current);
      if (saveDebounceRef.current !== null)
        clearTimeout(saveDebounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (currentProposalSettings === undefined || contactHydrated.current) {
      return;
    }

    contactHydrated.current = true;
    setContactFields({
      proposalDefaultContactEmail:
        currentProposalSettings.proposalDefaultContactEmail ?? "",
      proposalDefaultContactPhone:
        currentProposalSettings.proposalDefaultContactPhone ?? "",
      proposalDefaultContactLinkedin:
        currentProposalSettings.proposalDefaultContactLinkedin ?? "",
      proposalDefaultContactWebsite:
        currentProposalSettings.proposalDefaultContactWebsite ?? "",
      proposalDefaultContactLocation:
        currentProposalSettings.proposalDefaultContactLocation ?? "",
    });
  }, [currentProposalSettings]);

  React.useEffect(() => {
    if (currentProposalSettings === undefined || voiceHydrated.current) {
      return;
    }

    voiceHydrated.current = true;
    setDefaultVoicePreset(currentProposalSettings.savedVoicePreset ?? null);
  }, [currentProposalSettings]);

  React.useEffect(() => {
    if (currentProposalSettings === undefined || signatureHydrated.current) {
      return;
    }

    signatureHydrated.current = true;
    setCanonicalSignatureSettings(
      sanitizeProposalSignatureSettings(
        currentProposalSettings.signatureSettings,
      ),
    );
  }, [currentProposalSettings]);

  // Update a field on the currently editing preset and debounce-save
  const updatePreset = React.useCallback(
    (patch: Partial<PresetSlot>) => {
      setSaveError(null);
      localPresetInteractionRef.current = true;
      setLocalPresets((prev) => {
        const targetSlot = editingSlot ?? activeSlot ?? 1;
        const next = {
          ...prev,
          [targetSlot]: { ...prev[targetSlot], ...patch },
        };
        const nextSavedPreset = buildPresetSavePayload(
          next[targetSlot],
          targetSlot,
        );
        // debounce save
        if (saveDebounceRef.current !== null)
          clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
          if (!isSignedIn) {
            setSaveError("Sign in to save document styles.");
            saveDebounceRef.current = null;
            return;
          }
          void savePreset({
            slot: targetSlot,
            preset: {
              ...nextSavedPreset,
              voicePreset: nextSavedPreset.voicePreset ?? null,
              styleChoice: nextSavedPreset.styleChoice,
              paletteOverride: nextSavedPreset.paletteOverride ?? null,
              accentHex: nextSavedPreset.accentHex ?? null,
              fontPairId: nextSavedPreset.fontPairId ?? null,
              signatureSettings: sanitizeProposalSignatureSettings(
                nextSavedPreset.signatureSettings,
              ),
              verbatiStyle: nextSavedPreset.verbatiStyle
                ? {
                    ...nextSavedPreset.verbatiStyle,
                    accentHex: nextSavedPreset.verbatiStyle.accentHex ?? null,
                  }
                : undefined,
            },
          })
            .then(() => flashSaved())
            .catch((error: unknown) => {
              const message =
                error instanceof Error && error.message
                  ? error.message
                  : "Could not save document style.";
              setSaveError(message);
            });
          saveDebounceRef.current = null;
        }, 400);
        return next;
      });
    },
    [activeSlot, editingSlot, flashSaved, isSignedIn, savePreset],
  );

  const updateCanonicalSignatureSettings = React.useCallback(
    (signatureSettings: ProposalSignatureSettings) => {
      const nextSignatureSettings =
        sanitizeProposalSignatureSettings(signatureSettings);
      signatureHydrated.current = true;
      setSaveError(null);
      setCanonicalSignatureSettings(nextSignatureSettings);

      if (!isSignedIn) {
        setSaveError("Sign in to save document styles.");
        return;
      }

      void setCurrentProposalSettings({
        signatureSettings: nextSignatureSettings,
      })
        .then(() => flashSaved())
        .catch((error: unknown) => {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Could not save document style.";
          setSaveError(message);
        });
    },
    [flashSaved, isSignedIn, setCurrentProposalSettings],
  );

  const handleSetActive = React.useCallback(
    async (slot: SlotIndex) => {
      setSaveError(null);
      if (!isSignedIn) {
        setSaveError("Sign in to save document styles.");
        return;
      }
      try {
        await setActivePreset({ slot });
        setActiveSlot(slot);
        flashSaved();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Could not set the default style.";
        setSaveError(message);
      }
    },
    [flashSaved, isSignedIn, setActivePreset],
  );

  const handleResetPresetToFactory = React.useCallback(
    (slot?: SlotIndex) => {
      const targetSlot = slot ?? editingSlot ?? activeSlot ?? 1;
      setIsCustomColorPickerOpen(false);
      localPresetInteractionRef.current = true;
      setEditingSlot(targetSlot);
      updatePreset(buildDefaultPresetSlot(targetSlot));
    },
    [activeSlot, editingSlot, updatePreset],
  );

  const effectiveEditingSlot = editingSlot ?? activeSlot ?? 1;
  const currentPreset = localPresets[effectiveEditingSlot];
  const currentCustomAccentHex = normalizeSettingsAccentHex(
    currentPreset.accentHex,
  );
  const customAccentColor =
    currentCustomAccentHex ?? SETTINGS_CUSTOM_ACCENT_STARTER_HEX;
  const uiCustomAccentColor =
    uiAccent.id === "custom"
      ? uiAccent.customHex
      : UI_CUSTOM_ACCENT_STARTER_HEX;
  const currentFontPair =
    VERBATI_FONT_PAIR_OPTIONS.find(
      (fontPair) => fontPair.id === currentPreset.fontPairId,
    ) ?? DEFAULT_FONT_PAIR_OPTION;
  const activeCvContactDefaults = React.useMemo(
    () =>
      getProposalApplicantHeaderData(
        getLocalPersonalizationSourceByCvId(currentCvId),
      ),
    [currentCvId],
  );

  const persistContactField = React.useCallback(
    (field: ProposalContactField, value: string) => {
      const cleanedValue = cleanSettingsInput(value);
      setContactFields((current) => ({
        ...current,
        [field]: cleanedValue,
      }));
      void setCurrentProposalSettings({
        [field]: cleanedValue || null,
      } as Partial<Record<ProposalContactField, string | null>>).then(() =>
        flashSaved(),
      );
    },
    [flashSaved, setCurrentProposalSettings],
  );

  const handleSetDefaultVoicePreset = React.useCallback(
    async (voicePreset: ToneId) => {
      setSaveError(null);
      setDefaultVoicePreset(voicePreset);
    if (!isSignedIn) {
      setSaveError(t("settings.voice.signInToSave"));
      return;
    }
    try {
      await setCurrentProposalSettings({ voicePreset });
      flashSaved();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("settings.voice.couldNotSave");
      setSaveError(message);
    }
  },
    [flashSaved, isSignedIn, setCurrentProposalSettings, t],
  );

  const accountDisplayName =
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    user?.username ??
    t("settings.account.yourAccount");
  const accountEmail =
    user?.primaryEmailAddress?.emailAddress ?? t("settings.account.notConnected");
  const isWideEnoughForSettingsDrawerDock =
    viewportWidth >= SETTINGS_DOCKED_DRAWER_MIN_VIEWPORT_WIDTH;
  const isSettingsDrawerDocked =
    forgePanelOpen &&
    forgePanelOpenMode === "docked" &&
    isWideEnoughForSettingsDrawerDock &&
    (activeForgePanelSurface === "settings" ||
      dockedForgePanelSurface === "settings");
  const interfaceLanguageLabel = translateUi(
    resolvedUiLanguage,
    "settings.interfaceLanguage",
  );
  const defaultDocumentLanguageLabel = translateUi(
    resolvedUiLanguage,
    "settings.defaultDocumentLanguage",
  );
  const documentLanguageAutoHelp = translateUi(
    resolvedUiLanguage,
    "settings.documentLanguageAutoHelp",
  );

  React.useEffect(() => {
    const isSettingsPanelActive =
      forgePanelOpen &&
      (activeForgePanelSurface === "settings" ||
        dockedForgePanelSurface === "settings");

    if (!isSettingsPanelActive || forgePanelOpenMode === "peek") {
      return;
    }

    const nextMode = isWideEnoughForSettingsDrawerDock ? "docked" : "overlay";
    if (forgePanelOpenMode === nextMode) {
      return;
    }

    openForgePanelSurface("settings", { mode: nextMode });
  }, [
    activeForgePanelSurface,
    dockedForgePanelSurface,
    forgePanelOpen,
    forgePanelOpenMode,
    isWideEnoughForSettingsDrawerDock,
    openForgePanelSurface,
  ]);

  return (
    <div className="dasti-page-scroll" style={{ minWidth: 0 }}>
      <div
        className="dasti-page-shell dasti-page-shell--settings"
        data-forge-drawer-docked={isSettingsDrawerDocked ? "true" : undefined}
        style={
          {
            "--page-shell-max-width": "1320px",
            "--page-shell-gap": "var(--s5)",
            "--page-shell-pad-top": "var(--s6)",
          } as React.CSSProperties
        }
      >
        <div
          className="dasti-settings-layout settings"
          data-forge-drawer-docked={isSettingsDrawerDocked ? "true" : undefined}
        >
          <div className="settings__content">
            {activeTab === "docstyle" ? (
              <div
                className="settings__pane"
                data-pane="docstyle"
                data-active="true"
              >
                {/* ── Style preset workspace ── */}
                <div className="dasti-settings-builder">
                  <div
                    className="dasti-settings-builder__slots"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <div className="dasti-settings-slot-picker__header">
                      <div>
                        <h1 className="dasti-settings-page__title">
                          {t("settings.styleProfiles.title")}
                        </h1>
                        <p className="dasti-settings-page__subtitle">
                          {t("settings.styleProfiles.subtitle")}
                        </p>
                      </div>
                      {savedTick && (
                        <span
                          className="dasti-settings-page__saved"
                          aria-live="polite"
                        >
                          <Check
                            size={12}
                            strokeWidth={2.4}
                            aria-hidden="true"
                          />
                          {t("settings.saved")}
                        </span>
                      )}
                      {saveError && (
                        <span
                          className="dasti-settings-page__saved"
                          aria-live="assertive"
                        >
                          {saveError}
                        </span>
                      )}
                    </div>
                    <div
                      className="dasti-settings-slot-rail"
                      role="group"
                      aria-label={t("settings.styleProfiles.slots")}
                    >
                      {([1, 2, 3] as SlotIndex[]).map((slot) => {
                        const isEditingSlot = editingSlot === slot;
                        const isActiveSlot = activeSlot === slot;
                        return (
                          <div className="dasti-settings-slot-stack" key={slot}>
                            <div
                              className="dasti-settings-slot-stack__actions"
                              aria-hidden={isEditingSlot ? undefined : "true"}
                            >
                              {isEditingSlot ? (
                                <>
                                  {!isActiveSlot ? (
                                    <button
                                      type="button"
                                      className="dasti-settings-slot-action dasti-settings-slot-action--default"
                                      onClick={() => void handleSetActive(slot)}
                                    >
                                      <Check
                                        size={12}
                                        strokeWidth={2.4}
                                        aria-hidden="true"
                                      />
                                      {t("settings.setAsDefault")}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="dasti-settings-slot-action"
                                    onClick={() =>
                                      handleResetPresetToFactory(slot)
                                    }
                                  >
                                    {t("settings.resetStyle")}{" "}
                                    {t(DEFAULT_SLOT_NAME_KEYS[slot])}
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <SlotCard
                              slotName={
                                localPresets[slot].name ||
                                t(DEFAULT_SLOT_NAME_KEYS[slot])
                              }
                              preset={localPresets[slot]}
                              isEditing={isEditingSlot}
                              isActive={isActiveSlot}
                              onSelect={() => {
                                localPresetInteractionRef.current = true;
                                setEditingSlot(slot);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="dasti-settings-style-editor">
                    {/* Left — ingredient panel */}
                    <div className="dasti-settings-builder__left">
                      <div className="dasti-settings-appearance-toolbar dasti-toolbar-drawer-surface dasti-settings-appearance-toolbar--v3">
                        {/* Font */}
                        <div className="dasti-settings-appearance-group dasti-settings-appearance-group--wide dasti-settings-appearance-group--typography">
                          <div className="dasti-settings-appearance-group__header">
                            <div className="dasti-settings-appearance-label">
                              {t("settings.font")}
                            </div>
                          </div>
                          <FontPairGrid
                            selectedId={
                              currentPreset.fontPairId as VerbatiFontPairId | null
                            }
                            onChange={(id) => updatePreset({ fontPairId: id })}
                          />
                        </div>

                        {/* Layout */}
                        <div className="dasti-settings-appearance-group dasti-settings-appearance-group--layout">
                          <div className="dasti-settings-appearance-group__header">
                            <div className="dasti-settings-appearance-label">
                              {t("settings.layout")}
                            </div>
                          </div>
                          <div
                            className="layout-grid"
                            role="group"
                            aria-label={t("settings.layout")}
                          >
                            {styleOptions.map((option) => (
                              <SettingsLayoutCard
                                key={option.id}
                                option={option}
                                label={option.label}
                                active={
                                  resolvePresetLayoutSelection(
                                    currentPreset,
                                  ) === option.id
                                }
                                onSelect={() =>
                                  updatePreset(
                                    option.id === "auto"
                                      ? {
                                          styleChoice: "auto",
                                          verbatiStyle: null,
                                        }
                                      : {
                                          styleChoice:
                                            resolveStyleChoiceForLayout(
                                              option.id,
                                            ),
                                          verbatiStyle:
                                            buildVerbatiStyleForLayout({
                                              layoutId: option.id,
                                              preset: currentPreset,
                                              slot: effectiveEditingSlot,
                                            }),
                                        },
                                  )
                                }
                              />
                            ))}
                          </div>
                        </div>

                        {/* Color */}
                        <div className="dasti-settings-appearance-group dasti-settings-appearance-group--color">
                          <div className="dasti-settings-appearance-group__header">
                            <div className="dasti-settings-appearance-label">
                              {t("settings.color")}
                            </div>
                          </div>
                          <div
                            ref={customColorSurfaceRef}
                            className="style-swatches"
                            role="group"
                            aria-label={t("settings.color")}
                          >
                            {SETTINGS_ACCENT_OPTIONS.map((option) => {
                              const selectedPalette =
                                resolvePresetPaletteSelection(currentPreset);
                              const active = option.accentHex
                                ? currentPreset.accentHex === option.accentHex
                                : selectedPalette === option.paletteOverride;

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  className="style-swatch"
                                  data-selected={active ? "true" : "false"}
                                  aria-label={option.label}
                                  aria-pressed={active}
                                  onClick={() => {
                                    setIsCustomColorPickerOpen(false);
                                    updatePreset({
                                      paletteOverride: option.paletteOverride,
                                      accentHex: option.accentHex,
                                    });
                                  }}
                                  title={option.label}
                                  style={
                                    {
                                      "--swatch-color": option.swatch,
                                    } as React.CSSProperties
                                  }
                                >
                                  <span
                                    className="style-swatch__chip"
                                    aria-hidden="true"
                                  >
                                    {active ? (
                                      <Check size={13} strokeWidth={2.4} />
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              ref={customColorAnchorRef}
                              type="button"
                              className="style-swatch style-swatch--custom"
                              data-selected={
                                currentCustomAccentHex ? "true" : "false"
                              }
                              aria-label={t("settings.openCustomColorPicker")}
                              aria-pressed={Boolean(currentCustomAccentHex)}
                              onClick={() => setIsCustomColorPickerOpen(true)}
                              title={
                                currentCustomAccentHex
                                  ? `${t("settings.customAccent")} ${customAccentColor}`
                                  : t("settings.openCustomColorPicker")
                              }
                              style={
                                {
                                  "--swatch-color": customAccentColor,
                                } as React.CSSProperties
                              }
                            >
                              <span
                                className="style-swatch__chip"
                                aria-hidden="true"
                              >
                                {currentCustomAccentHex ? (
                                  <Check size={13} strokeWidth={2.4} />
                                ) : null}
                              </span>
                            </button>
                          </div>
                          <ProposalColorPickerPopover
                            currentHex={customAccentColor}
                            anchorRef={customColorAnchorRef}
                            surfaceAnchorRef={customColorSurfaceRef}
                            horizontalAlign="center"
                            isOpen={isCustomColorPickerOpen}
                            onClose={() => setIsCustomColorPickerOpen(false)}
                            onHexChange={(hex) => {
                              updatePreset({
                                paletteOverride: null,
                                accentHex: hex,
                              });
                            }}
                          />
                        </div>

                        {/* Printed name */}
                        <div className="dasti-settings-appearance-group dasti-settings-appearance-group--signature">
                          <div className="dasti-settings-appearance-group__header">
                            <div className="dasti-settings-appearance-label">
                              {t("settings.printedName")}
                            </div>
                          </div>
                          <SignatureSelector
                            settings={canonicalSignatureSettings}
                            bodyFontFamily={
                              currentFontPair?.bodyFamily ?? "inherit"
                            }
                            onChange={updateCanonicalSignatureSettings}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right — live preview */}
                    <div className="dasti-settings-builder__right">
                      <div className="dasti-settings-builder__preview-label">
                        {currentPreset.name ||
                          t(DEFAULT_SLOT_NAME_KEYS[effectiveEditingSlot])}
                      </div>
                      <HeroPreview
                        key={effectiveEditingSlot}
                        preset={currentPreset}
                        slotName={
                          currentPreset.name ||
                          t(DEFAULT_SLOT_NAME_KEYS[effectiveEditingSlot])
                        }
                        styleLabel={
                          styleOptions.find(
                            (option) =>
                              option.id ===
                              resolvePresetLayoutSelection(currentPreset),
                          )?.label ?? t("settings.style.auto.label")
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "account" ? (
              <div
                className="settings__pane"
                data-pane="account"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.account.profile")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.account.profileDescription")}
                    </div>
                  </div>
                  <div className="ds-field-group">
                    <label
                      className="ds-field-label"
                      htmlFor="settings-full-name"
                    >
                      {t("settings.account.fullName")}
                    </label>
                    <input
                      id="settings-full-name"
                      className="ds-field"
                      value={
                        isAuthReady
                          ? accountDisplayName
                          : t("settings.account.checkingAccount")
                      }
                      readOnly
                    />
                  </div>
                  <div className="settings-contact-grid">
                    {contactFieldOptions.map((field) => {
                      const fallbackValue =
                        activeCvContactDefaults[field.fallbackKey] ??
                        (field.id === "proposalDefaultContactEmail"
                          ? accountEmail
                          : null);
                      const placeholder = fallbackValue || field.placeholder;

                      return (
                        <div className="ds-field-group" key={field.id}>
                          <label
                            className="ds-field-label"
                            htmlFor={`settings-${field.fallbackKey}`}
                          >
                            {field.label}
                          </label>
                          <input
                            id={`settings-${field.fallbackKey}`}
                            className="ds-field settings-contact-field"
                            type={field.type}
                            value={contactFields[field.id]}
                            placeholder={placeholder}
                            onChange={(event) => {
                              const nextValue = event.currentTarget.value;
                              setContactFields((current) => ({
                                ...current,
                                [field.id]: nextValue,
                              }));
                            }}
                            onBlur={(event) =>
                              persistContactField(
                                field.id,
                                event.currentTarget.value,
                              )
                            }
                          />
                          <span className="settings-contact-default">
                            {t("settings.account.cvDefault")}{" "}
                            {fallbackValue || t("settings.account.empty")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.account.connectedAccounts")}
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.account.google")}
                      </div>
                      <div className="settings__row-desc">
                        {t("settings.account.usedToSignIn")}
                      </div>
                    </div>
                    {isSignedIn ? (
                      <button
                        type="button"
                        className="ds-btn ds-btn--sm ds-btn--secondary"
                        onClick={() => navigate("/sign-out")}
                      >
                        {t("settings.account.disconnect")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ds-btn ds-btn--sm ds-btn--accent"
                        onClick={() => navigate("/sign-in")}
                      >
                        {t("settings.account.connect")}
                      </button>
                    )}
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.account.linkedin")}
                      </div>
                      <div className="settings__row-desc">
                        {t("settings.account.importsProfileAndApplications")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ds-btn ds-btn--sm ds-btn--accent"
                    >
                      {t("settings.account.connect")}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === "theme" ? (
              <div
                className="settings__pane"
                data-pane="theme"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.theme")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.themeDescription")}
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.appearance")}
                      </div>
                      <div className="settings__row-desc">
                        {t("settings.appearanceDescription")}
                      </div>
                    </div>
                    <div
                      className="settings-segmented"
                      role="group"
                      aria-label={t("settings.themeMode")}
                    >
                      <button
                        type="button"
                        className="settings-segmented__button"
                        data-active={
                          themePreference === "light" ? "true" : undefined
                        }
                        aria-pressed={themePreference === "light"}
                        onClick={() => setThemePreference("light")}
                      >
                        <Sun size={14} aria-hidden="true" />
                        {t("settings.themeMode.light")}
                      </button>
                      <button
                        type="button"
                        className="settings-segmented__button"
                        data-active={
                          themePreference === "dark" ? "true" : undefined
                        }
                        aria-pressed={themePreference === "dark"}
                        onClick={() => setThemePreference("dark")}
                      >
                        <Moon size={14} aria-hidden="true" />
                        {t("settings.themeMode.dark")}
                      </button>
                      <button
                        type="button"
                        className="settings-segmented__button"
                        data-active={
                          themePreference === "system" ? "true" : undefined
                        }
                        aria-pressed={themePreference === "system"}
                        onClick={() => setThemePreference("system")}
                      >
                        <span className="settings-segmented__system-dot" />
                        {t("settings.themeMode.system")}
                      </button>
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.accentColor")}
                      </div>
                      <div className="settings__row-desc">
                        {t("settings.accentColorDescription")}
                      </div>
                    </div>
                    <div
                      ref={uiCustomColorSurfaceRef}
                      className="settings-ui-accent-row"
                      role="group"
                      aria-label={t("settings.interfaceAccentColor")}
                    >
                      {UI_ACCENT_OPTIONS.map((option) => {
                        const active = uiAccent.id === option.id;
                        const isCustom = option.id === "custom";
                        const swatchColor = isCustom
                          ? uiCustomAccentColor
                          : option.swatch;
                        return (
                          <button
                            key={option.id}
                            ref={isCustom ? uiCustomColorAnchorRef : undefined}
                            type="button"
                            className={[
                              "settings-ui-accent",
                              isCustom ? "settings-ui-accent--custom" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-selected={active ? "true" : undefined}
                            aria-label={
                              isCustom
                                ? t("settings.openCustomColorPicker")
                                : option.label
                            }
                            aria-pressed={active}
                            title={option.label}
                            style={
                              {
                                "--settings-ui-accent-swatch": swatchColor,
                              } as React.CSSProperties
                            }
                            onClick={() => {
                              if (isCustom) {
                                setIsUiCustomColorPickerOpen(true);
                                return;
                              }

                              setIsUiCustomColorPickerOpen(false);
                              setUiAccent({
                                id: option.id as Exclude<UiAccentId, "custom">,
                              });
                            }}
                          >
                            <span
                              className="settings-ui-accent__swatch"
                              aria-hidden="true"
                            >
                              {active ? (
                                <Check
                                  size={13}
                                  strokeWidth={2.4}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </span>
                            <span className="settings-ui-accent__label">
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                      <ProposalColorPickerPopover
                        currentHex={uiCustomAccentColor}
                        anchorRef={uiCustomColorAnchorRef}
                        surfaceAnchorRef={uiCustomColorSurfaceRef}
                        horizontalAlign="center"
                        isOpen={isUiCustomColorPickerOpen}
                        onClose={() => setIsUiCustomColorPickerOpen(false)}
                        onHexChange={(hex) => {
                          setUiAccent({ id: "custom", customHex: hex });
                        }}
                      />
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.reduceMotion")}
                      </div>
                      <div className="settings__row-desc">
                        {t("settings.reduceMotionDescription")}
                      </div>
                    </div>
                    <span
                      className="settings-token-switch-shell"
                      data-toolbar-tooltip={
                        motionPreference === "reduced"
                          ? t("settings.useNormalMotion")
                          : t("settings.reduceInterfaceMotion")
                      }
                      data-toolbar-tooltip-placement="below"
                    >
                      <button
                        type="button"
                        className={[
                          "dasti-theme-switch",
                          "settings-token-switch",
                          motionPreference === "reduced"
                            ? "dasti-theme-switch--dark settings-token-switch--active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={motionPreference === "reduced"}
                        aria-label={t("settings.reduceMotion")}
                        onClick={() =>
                          setMotionPreference(
                            motionPreference === "reduced"
                              ? "system"
                              : "reduced",
                          )
                        }
                      >
                        <span
                          className="dasti-theme-switch__rail"
                          aria-hidden="true"
                        >
                          <span className="dasti-theme-switch__thumb" />
                        </span>
                        <span className="dasti-theme-switch__label">
                          {motionPreference === "reduced"
                            ? t("settings.reduced")
                            : t("settings.motion")}
                        </span>
                      </button>
                    </span>
                  </div>
                  <div className="settings-theme-preview" aria-hidden="true">
                    <span className="settings-theme-preview__dot" />
                    <span className="settings-theme-preview__line settings-theme-preview__line--strong" />
                    <span className="settings-theme-preview__line" />
                    <span className="settings-theme-preview__pill">
                      {t(`settings.themeMode.${themeMode}` as UiMessageKey)}
                    </span>
                  </div>
                </div>
              </div>
            ) : activeTab === "language" ? (
              <div
                className="settings__pane"
                data-pane="language"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.language")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.languageDescription")}
                    </div>
                  </div>
                  <div
                    className="settings-language-grid"
                    role="group"
                    aria-label={interfaceLanguageLabel}
                  >
                    {UI_LANGUAGE_OPTIONS.map((option) => {
                      const active = uiLanguage === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className="settings-language-card"
                          data-selected={active ? "true" : undefined}
                          aria-pressed={active}
                          onClick={() => setUiLanguage(option.id)}
                        >
                          <span className="settings-language-card__name">
                            {option.label}
                          </span>
                          <span className="settings-language-card__native">
                            {option.nativeLabel}
                          </span>
                          {active ? (
                            <Check
                              className="settings-language-card__check"
                              size={14}
                              strokeWidth={2.4}
                              aria-hidden="true"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.documentGeneration")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.documentGenerationDescription")}
                    </div>
                  </div>
                  <div
                    className="settings-language-grid settings-language-grid--documents"
                    role="group"
                    aria-label={defaultDocumentLanguageLabel}
                  >
	                    {DOCUMENT_LANGUAGE_OPTIONS.map((option) => {
	                      const active = documentLanguage === option.id;
	                      const optionCaption =
	                        option.id === "auto"
	                          ? documentLanguageAutoHelp
	                          : option.nativeLabel;
	                      return (
	                        <button
	                          key={option.id}
                          type="button"
                          className="settings-language-card"
                          data-selected={active ? "true" : undefined}
                          aria-pressed={active}
                          onClick={() => setDocumentLanguage(option.id)}
                        >
                          <span className="settings-language-card__name">
                            {option.label}
                          </span>
	                          <span className="settings-language-card__native">
	                            {optionCaption}
	                          </span>
                          {active ? (
                            <Check
                              className="settings-language-card__check"
                              size={14}
                              strokeWidth={2.4}
                              aria-hidden="true"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === "voice" ? (
              <div
                className="settings__pane"
                data-pane="voice"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">
                        {t("settings.letterModel")}
                      </div>
                    </div>
                    <div
                      className="settings-segmented settings-segmented--llm"
                      role="group"
                      aria-label={t("settings.letterModel")}
                    >
                      {PROPOSAL_LLM_MODEL_OPTIONS.map((option) => {
                        const active = proposalLlmModel === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="settings-segmented__button"
                            data-active={active ? "true" : undefined}
                            aria-pressed={active}
                            onClick={() => setProposalLlmModel(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.defaultTone")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.defaultToneDescription")}
                    </div>
                  </div>
                  <div
                    className="settings__tone-row settings__tone-row--selectable dasti-toolbar--surface-tooltips"
                    role="group"
                    aria-label={t("settings.defaultTone")}
                  >
                    {toneOptions.map((option) => {
                      const active = defaultVoicePreset === option.id;
                      return (
                        <button
                          key={option.id ?? "auto"}
                          type="button"
                          className={[
                            "settings__tone-option",
                            "ds-tone",
                            `ds-tone--${settingsToneBadgeTone(option.id)}`,
                            active ? "settings__tone-option--active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-pressed={active}
                          data-toolbar-tooltip={option.description}
                          onClick={() =>
                            void handleSetDefaultVoicePreset(option.id)
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === "billing" ? (
              <div
                className="settings__pane"
                data-pane="billing"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.plan")}
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">Pro · €12/mo</div>
                      <div className="settings__row-desc">
                        {t("settings.planRenewsOnMay28")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ds-btn ds-btn--sm ds-btn--secondary"
                    >
                      {t("settings.manage")}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === "team" ? (
              <div
                className="settings__pane"
                data-pane="team"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.members")}
                    </div>
                  </div>
                  <div className="settings__placeholder">
                    {t("settings.soloWorkspaceInviteTeammates")}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="settings__pane"
                data-pane="danger"
                data-active="true"
              >
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">
                      {t("settings.deleteAccountTitle")}
                    </div>
                    <div className="settings__group-desc">
                      {t("settings.deleteAccountDescription")}
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="ds-btn ds-btn--md ds-btn--danger"
                    >
                      {t("settings.deleteAccountAction")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
