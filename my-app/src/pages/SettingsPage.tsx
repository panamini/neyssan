import React, { useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  Check,
  Feather,
  FileImage,
  Pen,
  PenNib,
  Stamp,
  TrashSimple,
  Upload,
  Wand2,
} from "@/lib/icons";
import {
  getProposalStyleDefinition,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import {
  PROPOSAL_PALETTE_OPTIONS,
  PROPOSAL_STYLE_PREVIEW_DEFINITIONS,
  PROPOSAL_AUTO_STYLE_PREVIEW,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
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
import { useThemeMode, type ThemePreference } from "../lib/theme-mode";
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
};

type ProposalContactField = keyof ProposalContactSettings;

const PROPOSAL_CONTACT_FIELDS: Array<{
  id: ProposalContactField;
  label: string;
  type: React.HTMLInputTypeAttribute;
  placeholder: string;
  fallbackKey: "email" | "phone" | "location" | "linkedin" | "website";
}> = [
  {
    id: "proposalDefaultContactEmail",
    label: "Email",
    type: "email",
    placeholder: "name@example.com",
    fallbackKey: "email",
  },
  {
    id: "proposalDefaultContactPhone",
    label: "Phone",
    type: "tel",
    placeholder: "+33 6 00 00 00 00",
    fallbackKey: "phone",
  },
  {
    id: "proposalDefaultContactLocation",
    label: "Location",
    type: "text",
    placeholder: "Paris, France",
    fallbackKey: "location",
  },
  {
    id: "proposalDefaultContactLinkedin",
    label: "LinkedIn",
    type: "url",
    placeholder: "https://linkedin.com/in/name",
    fallbackKey: "linkedin",
  },
  {
    id: "proposalDefaultContactWebsite",
    label: "Website",
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

const DEFAULT_SLOT_NAMES: Record<SlotIndex, string> = {
  1: "Style 1",
  2: "Style 2",
  3: "Style 3",
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

const SETTINGS_THEME_OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const SETTINGS_ACCENT_OPTIONS: SettingsAccentOption[] = [
  ...PROPOSAL_PALETTE_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    swatch: option.color,
    paletteOverride: option.id,
    accentHex: null,
  })),
];

// ─── Tone options ──────────────────────────────────────────────────────────────

type ToneId = "signature" | "expert" | "engaging" | null;
const TONE_OPTIONS: Array<{
  id: ToneId;
  label: string;
  description: string;
  Icon: typeof Wand2;
}> = [
  {
    id: null,
    label: getVoicePresetDisplayLabel(null),
    description: "Adapts to the role.",
    Icon: Wand2,
  },
  {
    id: "engaging",
    label: getVoicePresetDisplayLabel("engaging"),
    description: "Approachable. Personal touches.",
    Icon: Feather,
  },
  {
    id: "signature",
    label: getVoicePresetDisplayLabel("signature"),
    description: "Conversational. Like you wrote it.",
    Icon: PenNib,
  },
  {
    id: "expert",
    label: getVoicePresetDisplayLabel("expert"),
    description: "Composed. Measured pacing.",
    Icon: Stamp,
  },
];

// ─── Style options ─────────────────────────────────────────────────────────────

type StyleOption = {
  id: "auto" | "workshop" | "workshop-twocol";
  label: string;
  description: string;
  isAuto?: boolean;
  resumeTemplateId?: ResumeTemplateId;
};

const STYLE_OPTIONS = ([
  { id: "auto", label: "Auto", description: "Matches the look to the role.", isAuto: true },
  {
    id: "workshop",
    label: "Workshop",
    description: "One-column Workshop ATS. Paired margin twin.",
    resumeTemplateId: WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  },
  {
    id: "workshop-twocol",
    label: "Workshop 2-col",
    description: "Two-column Workshop grid with 17/18-inspired rhythm.",
    resumeTemplateId: WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
  },
] satisfies StyleOption[]);

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

function resolvePresetLayoutSelection(
  preset: PresetSlot,
): StyleOption["id"] {
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
}): VerbatiStylePreset {
  const familyId: StyleFamilyId = "workshop";
  const family = getStyleFamilyDefinition(familyId);
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
        : { palette: family.defaultPalette }),
  });
}

function buildDefaultPresetSlot(slot: SlotIndex): PresetSlot {
  const factorySlot = getFactoryDocumentStyleSlot(slot);
  return {
    ...EMPTY_PRESET,
    fontPairId: factorySlot.appearance.typography,
    styleChoice: "balanced",
    paletteOverride: factorySlot.appearance.palette,
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
): PresetSlot {
  const layoutSelection = resolvePresetLayoutSelection(preset);
  const nextVerbatiStyle =
    layoutSelection === "auto"
      ? null
      : buildVerbatiStyleForLayout({
          layoutId: layoutSelection,
          preset,
        });

  return {
    ...preset,
    verbatiStyle:
      nextVerbatiStyle
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
  active,
  onSelect,
}: {
  option: StyleOption;
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
      <span className="layout-card__preview" data-layout={option.id} aria-hidden="true">
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
      <span className="layout-card__name">{option.label}</span>
    </button>
  );
}

// ─── Hero preview ──────────────────────────────────────────────────────────────

function HeroPreview({ preset, slotName }: { preset: PresetSlot; slotName: string }) {
  const fontPair = VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === preset.fontPairId)
    ?? DEFAULT_FONT_PAIR_OPTION;
  const styleOption =
    STYLE_OPTIONS.find((s) => s.id === resolvePresetLayoutSelection(preset)) ??
    STYLE_OPTIONS[0];
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find((p) => p.id === preset.paletteOverride);
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
    styleOption.id === "auto"
      ? PROPOSAL_AUTO_STYLE_PREVIEW
      : PROPOSAL_STYLE_PREVIEW_DEFINITIONS.balanced;

  const cardRef = useRef<HTMLElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const previewCard: HTMLElement = card;
    const MAX = 5;

    function move(clientX: number, clientY: number) {
      previewCard.classList.remove("is-resetting");
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = previewCard.getBoundingClientRect();
        const px = (clientX - r.left) / r.width;
        const py = (clientY - r.top) / r.height;
        const x = Math.min(Math.max(px, 0), 1);
        const y = Math.min(Math.max(py, 0), 1);
        previewCard.style.setProperty("--rx", `${((0.5 - y) * MAX * 2).toFixed(2)}deg`);
        previewCard.style.setProperty("--ry", `${((x - 0.5) * MAX * 2).toFixed(2)}deg`);
        previewCard.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        previewCard.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      });
    }

    function reset() {
      cancelAnimationFrame(rafRef.current);
      previewCard.classList.add("is-resetting");
      previewCard.style.setProperty("--rx", "0deg");
      previewCard.style.setProperty("--ry", "0deg");
      previewCard.style.setProperty("--mx", "50%");
      previewCard.style.setProperty("--my", "50%");
    }

    const onMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    previewCard.addEventListener("mousemove", onMove);
    previewCard.addEventListener("mouseleave", reset);
    return () => {
      previewCard.removeEventListener("mousemove", onMove);
      previewCard.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <article
      ref={cardRef}
      className={`dasti-settings-hero-preview dasti-settings-hero-preview--${styleOption.id}`}
      style={{ "--hero-accent": accentColor } as React.CSSProperties}
    >
      <div className="dasti-settings-hero-preview__inner">
        <div className="dasti-settings-hero-preview__kicker" aria-hidden="true">
          {styleOption.id === "auto"
            ? previewDef.templateName.toUpperCase()
            : getStyleFamilyDefinition(stylePreset.familyId ?? stylePreset.layout as StyleFamilyId).label.toUpperCase()}
        </div>
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
        <div className="dasti-settings-hero-preview__divider" aria-hidden="true" />
        <div
          className="dasti-settings-hero-preview__body-lines"
          aria-hidden="true"
          style={{ fontFamily: fontPair?.bodyFamily }}
        >
          <p className="dasti-settings-hero-preview__body-text">
            I am writing to express my interest in the position at your esteemed
            organisation, bringing relevant expertise and a strong record of achievement.
          </p>
        </div>
        <div className="dasti-settings-hero-preview__signature" aria-hidden="true">
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
            {styleOption.label}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Slot card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slotIndex,
  preset,
  isEditing,
  isActive,
  onSelect,
}: {
  slotIndex: SlotIndex;
  preset: PresetSlot;
  isEditing: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const fontPair = VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === preset.fontPairId)
    ?? DEFAULT_FONT_PAIR_OPTION;
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find((p) => p.id === preset.paletteOverride);
  const accentColor =
    preset.accentHex ??
    paletteOption?.color ??
    "color-mix(in srgb, var(--color-accent) 80%, white 20%)";
  const slotName = preset.name || DEFAULT_SLOT_NAMES[slotIndex];

  return (
    <button
      type="button"
      className={[
        "dasti-settings-slot-card",
        isEditing ? "dasti-settings-slot-card--editing" : "",
        isActive ? "dasti-settings-slot-card--active" : "",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-pressed={isEditing}
      title={`Edit ${slotName}`}
    >
      <div className="dasti-settings-slot-card__top">
        <span className="dasti-settings-slot-card__name">{slotName}</span>
        {isActive ? (
          <span className="dasti-settings-slot-card__active-badge" aria-label="Active default">
            <Check size={9} strokeWidth={2.6} aria-hidden="true" />
            Default
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
        <span className="dasti-settings-slot-card__font-sep" aria-hidden="true">/</span>
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
  return (
    <div className="dasti-settings-font-grid" role="group" aria-label="Font pair">
      {VERBATI_FONT_PAIR_OPTIONS.map((pair) => {
        const active = selectedId === pair.id;
        return (
          <button
            key={pair.id}
            type="button"
            className={[
              "dasti-settings-font-pair-card",
              active ? "dasti-settings-font-pair-card--active" : "",
            ].filter(Boolean).join(" ")}
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
              <span className="dasti-settings-font-pair-card__check" aria-hidden="true">
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

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
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
    SIGNATURE_IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight, 1),
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

function SignatureDrawingPad({
  onImageReady,
}: {
  onImageReady: (imageDataUrl: string) => void;
}) {
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
    context.lineWidth = 2.2;
    context.strokeStyle = "#20160f";
  }, []);

  React.useEffect(() => {
    syncCanvasScale();
  }, [syncCanvasScale]);

  const getPoint = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const finishDrawing = React.useCallback(() => {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (!canvas) return;

    try {
      onImageReady(canvas.toDataURL("image/png"));
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
        aria-label="Draw signature"
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
        className="dasti-settings-signature-clear"
        onClick={clearDrawing}
      >
        <TrashSimple size={12} strokeWidth={1.8} aria-hidden="true" />
        Clear drawing
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
          mode: "image",
          fontId: null,
          imageDataUrl,
        });
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Could not import this signature image.",
        );
      }
    },
    [onChange],
  );

  return (
    <div className="dasti-settings-signature" role="group" aria-label="Signature">
      <div className="sig-grid">
        <button
          type="button"
          className="sig-card"
          data-selected={settings.mode === "auto" ? "true" : "false"}
          aria-pressed={settings.mode === "auto"}
          onClick={() => onChange(DEFAULT_PROPOSAL_SIGNATURE_SETTINGS)}
        >
          <span
            className="sig-card__sig sig-card__sig--auto"
            style={{ fontFamily: bodyFontFamily }}
          >
            {SIGNATURE_SAMPLE_NAME}
          </span>
          <span className="sig-card__name">Auto — generated from your name</span>
        </button>

        {PROPOSAL_SIGNATURE_FONT_OPTIONS.map((option) => {
          const active = settings.mode === "font" && settings.fontId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className="sig-card"
              data-selected={active ? "true" : "false"}
              aria-label={`${option.label} signature`}
              aria-pressed={active}
              onClick={() =>
                onChange({
                  mode: "font",
                  fontId: option.id,
                  imageDataUrl: null,
                })
              }
            >
              <span
                className="sig-card__sig sig-card__sig--font"
                style={{ fontFamily: option.fontFamily }}
              >
                {SIGNATURE_SAMPLE_NAME}
              </span>
              <span className="sig-card__name">{option.label} — signature font</span>
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
          Import image
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
          Draw
          <SignatureDrawingPad
            onImageReady={(imageDataUrl) =>
              onChange({
                mode: "image",
                fontId: null,
                imageDataUrl,
              })
            }
          />
        </div>
      </div>

      <div className="dasti-settings-signature-current" aria-live="polite">
        <span className="dasti-settings-signature-current__label">
          Current signature
        </span>
        <span className="dasti-settings-signature-current__preview">
          {signatureRender.kind === "image" ? (
            <img src={signatureRender.imageDataUrl} alt="Selected signature" />
          ) : (
            <span style={{ fontFamily: signatureRender.fontFamily }}>
              {SIGNATURE_SAMPLE_NAME}
            </span>
          )}
        </span>
        {settings.mode === "image" ? (
          <button
            type="button"
            className="dasti-settings-signature-current__reset"
            onClick={() => onChange(DEFAULT_PROPOSAL_SIGNATURE_SETTINGS)}
          >
            <FileImage size={12} strokeWidth={1.8} aria-hidden="true" />
            Remove image
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

type SettingsTab =
  | "account"
  | "preferences"
  | "docstyle"
  | "voice"
  | "billing"
  | "team"
  | "danger";

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "docstyle", label: "Document style" },
  { id: "voice", label: "Voice & tone" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Team" },
  { id: "danger", label: "Danger zone" },
];

function normalizeSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value)
    ? (value as SettingsTab)
    : "account";
}

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeSettingsTab(searchParams.get("tab"));
  const { currentCvId } = useCvLibrary();
  const { preference: themePreference, setPreference: setThemePreference } = useThemeMode();
  const {
    preference: motionPreference,
    setPreference: setMotionPreference,
  } = useMotionPreference();
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
  const setCurrentProposalSettings = useMutation(api.proposalSettings.setCurrent);

  // Local state
  const [editingSlot, setEditingSlot] = React.useState<SlotIndex | null>(null);
  const [localPresets, setLocalPresets] = React.useState<Record<SlotIndex, PresetSlot>>({
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
  const savedTickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = React.useRef(false);
  const contactHydrated = React.useRef(false);

  // Sync from server once
  React.useEffect(() => {
    if (!presetsQuery || hydrated.current) return;
    hydrated.current = true;

    const serverPreset = (slot: SlotIndex, raw: typeof presetsQuery.preset1): PresetSlot => {
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
        accentHex: raw?.accentHex === undefined ? defaults.accentHex : raw.accentHex,
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

    const hydratedActiveSlot = (presetsQuery.activeSlot as SlotIndex | null) ?? 1;

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
    if (savedTickTimeoutRef.current !== null) clearTimeout(savedTickTimeoutRef.current);
    savedTickTimeoutRef.current = setTimeout(() => {
      setSavedTick(false);
      savedTickTimeoutRef.current = null;
    }, 1600);
  }, []);

  React.useEffect(() => {
    return () => {
      if (savedTickTimeoutRef.current !== null) clearTimeout(savedTickTimeoutRef.current);
      if (saveDebounceRef.current !== null) clearTimeout(saveDebounceRef.current);
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

  // Update a field on the currently editing preset and debounce-save
  const updatePreset = React.useCallback(
    (patch: Partial<PresetSlot>) => {
      setSaveError(null);
      setLocalPresets((prev) => {
        const targetSlot = editingSlot ?? activeSlot ?? 1;
        const next = { ...prev, [targetSlot]: { ...prev[targetSlot], ...patch } };
        const nextSavedPreset = buildPresetSavePayload(next[targetSlot]);
        // debounce save
        if (saveDebounceRef.current !== null) clearTimeout(saveDebounceRef.current);
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

  const effectiveEditingSlot = editingSlot ?? activeSlot ?? 1;
  const currentPreset = localPresets[effectiveEditingSlot];
  const currentFontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((fontPair) => fontPair.id === currentPreset.fontPairId) ??
    DEFAULT_FONT_PAIR_OPTION;
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

  const selectSettingsTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const accountDisplayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "Your account";
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "Not connected";

  return (
    <div className="dasti-page-scroll" style={{ minWidth: 0 }}>
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "1080px",
            "--page-shell-gap": "var(--s5)",
            "--page-shell-pad-top": "var(--s6)",
          } as React.CSSProperties
        }
      >
        <div className="dasti-settings-layout settings">
          <nav className="settings__nav" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="settings__nav-item"
                data-active={activeTab === tab.id ? "true" : "false"}
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => selectSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings__content">
            {activeTab === "docstyle" ? (
              <div className="settings__pane" data-pane="docstyle" data-active="true">
        {/* ── Header ── */}
        <div className="dasti-settings-builder-header">
          <div>
            <h1 className="dasti-settings-page__title">Style profiles</h1>
            <p className="dasti-settings-page__subtitle">
              Assemble up to 3 style presets. The active one applies to new cover letters.
            </p>
          </div>
          {savedTick && (
            <span className="dasti-settings-page__saved" aria-live="polite">
              <Check size={12} strokeWidth={2.4} aria-hidden="true" />
              Saved.
            </span>
          )}
          {saveError && (
            <span className="dasti-settings-page__saved" aria-live="assertive">
              {saveError}
            </span>
          )}
        </div>

        {/* ── 2-column builder ── */}
        <div className="dasti-settings-builder">

          {/* Left — ingredient panel */}
          <div className="dasti-settings-builder__left">
            <div className="dasti-settings-appearance-toolbar dasti-toolbar-drawer-surface">

              {/* Typography */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">Typography</div>
                <FontPairGrid
                  selectedId={currentPreset.fontPairId as VerbatiFontPairId | null}
                  onChange={(id) => updatePreset({ fontPairId: id })}
                />
              </div>

              {/* Signature */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">Signature</div>
                <SignatureSelector
                  settings={currentPreset.signatureSettings}
                  bodyFontFamily={currentFontPair?.bodyFamily ?? "inherit"}
                  onChange={(signatureSettings) =>
                    updatePreset({
                      signatureSettings: sanitizeProposalSignatureSettings(
                        signatureSettings,
                      ),
                    })
                  }
                />
              </div>

              {/* Layout */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">Layout</div>
                <div className="layout-grid" role="group" aria-label="Layout">
                  {STYLE_OPTIONS.map((option) => (
                    <SettingsLayoutCard
                      key={option.id}
                      option={option}
                      active={resolvePresetLayoutSelection(currentPreset) === option.id}
                      onSelect={() =>
                        updatePreset(
                          option.id === "auto"
                            ? {
                                styleChoice: "auto",
                                verbatiStyle: null,
                              }
                            : {
                                styleChoice: resolveStyleChoiceForLayout(option.id),
                                verbatiStyle: buildVerbatiStyleForLayout({
                                  layoutId: option.id,
                                  preset: currentPreset,
                                }),
                              },
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">Color</div>
                <div className="style-swatches" role="group" aria-label="Color">
                  {SETTINGS_ACCENT_OPTIONS.map((option) => {
                    const active = option.accentHex
                      ? currentPreset.accentHex === option.accentHex
                      : currentPreset.paletteOverride === option.paletteOverride;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="style-swatch"
                        data-selected={active ? "true" : "false"}
                        aria-label={option.label}
                        aria-pressed={active}
                        onClick={() =>
                          updatePreset({
                            paletteOverride: option.paletteOverride,
                            accentHex: option.accentHex,
                          })
                        }
                        title={option.label}
                        style={{ "--swatch-color": option.swatch } as React.CSSProperties}
                      >
                        <span className="style-swatch__chip" aria-hidden="true">
                          {active ? <Check size={13} strokeWidth={2.4} /> : null}
                        </span>
                        <span className="style-swatch__label">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tone */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">Default tone</div>
                <div
                  className="dasti-settings-section__row"
                  role="group"
                  aria-label="Default tone"
                >
                  {TONE_OPTIONS.map((option) => {
                    const active = currentPreset.voicePreset === option.id;
                    return (
                      <button
                        key={option.id ?? "auto"}
                        type="button"
                        className={[
                          "dasti-settings-pill",
                          active ? "dasti-settings-pill--active" : "",
                        ].filter(Boolean).join(" ")}
                        aria-pressed={active}
                        onClick={() => updatePreset({ voicePreset: option.id as ToneId })}
                        title={option.description}
                      >
                        {active ? (
                          <span className="dasti-settings-pill__check" aria-hidden="true">
                            <Check size={12} strokeWidth={2.4} />
                          </span>
                        ) : (
                          <span className="dasti-settings-pill__icon" aria-hidden="true">
                            <option.Icon size={13} strokeWidth={1.7} />
                          </span>
                        )}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right — sticky preset rail + hero preview */}
          <div className="dasti-settings-builder__right" aria-live="polite" aria-atomic="true">
            <div
              className="dasti-settings-slot-rail"
              role="group"
              aria-label="Style preset slots"
            >
              {([1, 2, 3] as SlotIndex[]).map((slot) => (
                <SlotCard
                  key={slot}
                  slotIndex={slot}
                  preset={localPresets[slot]}
                  isEditing={editingSlot === slot}
                  isActive={activeSlot === slot}
                  onSelect={() => setEditingSlot(slot)}
                />
              ))}
            </div>
            <div className="dasti-settings-builder__preview-label">
              {currentPreset.name || DEFAULT_SLOT_NAMES[effectiveEditingSlot]}
            </div>
            <HeroPreview
              key={effectiveEditingSlot}
              preset={currentPreset}
              slotName={currentPreset.name || DEFAULT_SLOT_NAMES[effectiveEditingSlot]}
            />
            {activeSlot !== null && editingSlot !== null && activeSlot !== editingSlot && (
              <button
                type="button"
                className="dasti-button dasti-button--sm dasti-settings-builder__set-default-btn"
                onClick={() => void handleSetActive(editingSlot)}
              >
                <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                Set as default
              </button>
            )}
          </div>
        </div>
              </div>
            ) : activeTab === "account" ? (
	              <div className="settings__pane" data-pane="account" data-active="true">
	                <div className="settings__group">
	                  <div className="settings__group-head">
	                    <div className="settings__group-title">Profile</div>
	                    <div className="settings__group-desc">
	                      Defaults come from your active CV profile. Add an override only when Proposal Forge should use something different.
	                    </div>
	                  </div>
	                  <div className="ds-field-group">
	                    <label className="ds-field-label" htmlFor="settings-full-name">Full name</label>
	                    <input id="settings-full-name" className="ds-field" value={isAuthReady ? accountDisplayName : "Checking account"} readOnly />
	                  </div>
	                  <div className="settings-contact-grid">
	                    {PROPOSAL_CONTACT_FIELDS.map((field) => {
	                      const fallbackValue =
	                        activeCvContactDefaults[field.fallbackKey] ??
	                        (field.id === "proposalDefaultContactEmail" ? accountEmail : null);
	                      const placeholder = fallbackValue || field.placeholder;
	
	                      return (
	                        <div className="ds-field-group" key={field.id}>
	                          <label className="ds-field-label" htmlFor={`settings-${field.fallbackKey}`}>
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
	                              persistContactField(field.id, event.currentTarget.value)
	                            }
	                          />
	                          <span className="settings-contact-default">
	                            CV default: {fallbackValue || "empty"}
	                          </span>
	                        </div>
	                      );
	                    })}
	                  </div>
	                </div>
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Connected accounts</div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">Google</div>
                      <div className="settings__row-desc">Used to sign in.</div>
                    </div>
                    {isSignedIn ? (
                      <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => navigate("/sign-out")}>Disconnect</button>
                    ) : (
                      <button type="button" className="ds-btn ds-btn--sm ds-btn--accent" onClick={() => navigate("/sign-in")}>Connect</button>
                    )}
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">LinkedIn</div>
                      <div className="settings__row-desc">Imports profile and applications.</div>
                    </div>
                    <button type="button" className="ds-btn ds-btn--sm ds-btn--accent">Connect</button>
                  </div>
                </div>
              </div>
            ) : activeTab === "preferences" ? (
              <div className="settings__pane" data-pane="preferences" data-active="true">
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Appearance</div>
                  </div>
	                  <div className="settings__row">
	                    <div>
	                      <div className="settings__row-label">Theme</div>
	                      <div className="settings__row-desc">Light or dark.</div>
	                    </div>
                    <div className="theme-switch" role="group" aria-label="Theme">
                      {SETTINGS_THEME_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={themePreference === option.id}
                          onClick={() => setThemePreference(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">Reduce motion</div>
                      <div className="settings__row-desc">Disable animations and transitions.</div>
                    </div>
                    <button
                      type="button"
                      className="settings-motion-toggle"
                      aria-pressed={motionPreference === "reduced"}
                      aria-label="Reduce motion"
                      onClick={() =>
                        setMotionPreference(
                          motionPreference === "reduced" ? "system" : "reduced",
                        )
                      }
                    >
                      <span className="settings-motion-toggle__check" aria-hidden="true">
                        {motionPreference === "reduced" ? (
                          <Check size={12} strokeWidth={2.4} />
                        ) : null}
                      </span>
                      Use reduce motion
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === "voice" ? (
              <div className="settings__pane" data-pane="voice" data-active="true">
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Default tone</div>
                    <div className="settings__group-desc">Used when generating new proposals. You can override per document.</div>
                  </div>
                  <div className="settings__tone-row">
                    <span className="ds-tone ds-tone--warm">Warm</span>
                    <span className="ds-tone ds-tone--formal">Formal</span>
                    <span className="ds-tone ds-tone--natural">Natural</span>
                  </div>
                </div>
              </div>
            ) : activeTab === "billing" ? (
              <div className="settings__pane" data-pane="billing" data-active="true">
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Plan</div>
                  </div>
                  <div className="settings__row">
                    <div>
                      <div className="settings__row-label">Pro · €12/mo</div>
                      <div className="settings__row-desc">Renews on May 28.</div>
                    </div>
                    <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary">Manage</button>
                  </div>
                </div>
              </div>
            ) : activeTab === "team" ? (
              <div className="settings__pane" data-pane="team" data-active="true">
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Members</div>
                  </div>
                  <div className="settings__placeholder">Solo workspace. Invite teammates from the dashboard.</div>
                </div>
              </div>
            ) : (
              <div className="settings__pane" data-pane="danger" data-active="true">
                <div className="settings__group">
                  <div className="settings__group-head">
                    <div className="settings__group-title">Delete account</div>
                    <div className="settings__group-desc">Removes all proposals, CVs, and account data. Cannot be undone.</div>
                  </div>
                  <div>
                    <button type="button" className="ds-btn ds-btn--md ds-btn--danger">Delete account</button>
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
