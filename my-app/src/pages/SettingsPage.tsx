import React, { useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Check,
  ColorWheel,
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
import { ProposalColorPickerPopover } from "../components/ProposalColorPickerPopover";
import {
  VERBATI_FONT_PAIR_OPTIONS,
  type VerbatiFontPairId,
} from "../features/verbati/fontCatalog";
import {
  VERBATI_LAYOUT_OPTIONS,
  resolveVerbatiStyle,
  sanitizePersistedVerbatiStyle,
} from "../features/verbati/style";
import { getStyleFamilyDefinition } from "../lib/layout/styleFamilies";
import type {
  StyleFamilyId,
  VerbatiStylePreset,
} from "../features/verbati/types";
import {
  DEFAULT_PROPOSAL_SIGNATURE_SETTINGS,
  PROPOSAL_SIGNATURE_FONT_OPTIONS,
  resolveProposalSignatureRender,
  sanitizeProposalSignatureSettings,
  type ProposalSignatureSettings,
} from "../lib/proposal-signature-settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotIndex = 1 | 2 | 3;
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
  id: "auto" | "swiss" | "editorial" | "modernist" | "workshop";
  label: string;
  description: string;
  isAuto?: boolean;
};

const STYLE_OPTIONS = ([
  { id: "auto",     label: "Auto",      description: "Matches the look to the role.",                   isAuto: true },
  { id: "swiss", label: "Swiss", description: "Quiet Swiss grid. Serif-led rhythm." },
  { id: "editorial", label: "Editorial", description: "Editorial pacing. Rich reading voice." },
  { id: "modernist", label: "Mono", description: "Tight grid. Technical contrast." },
  { id: "workshop", label: "Workshop", description: "Workshop ATS. Paired margin twin." },
] satisfies StyleOption[]).filter(
  (option) =>
    option.id !== "workshop" ||
    VERBATI_LAYOUT_OPTIONS.some((layout) => layout.id === "workshop"),
);

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
  switch (stylePreset.layout) {
    case "editorial":
      return "editorial";
    case "modernist":
      return "modernist";
    case "workshop":
      return "workshop";
    default:
      return "swiss";
  }
}

function resolveStyleChoiceForLayout(
  layoutId: Exclude<StyleOption["id"], "auto">,
): ProposalStyleChoice {
  switch (layoutId) {
    case "editorial":
      return "warm";
    case "modernist":
      return "technical";
    case "workshop":
      return "balanced";
    case "swiss":
    default:
      return "balanced";
  }
}

function buildVerbatiStyleForLayout(args: {
  layoutId: Exclude<StyleOption["id"], "auto">;
  preset: PresetSlot;
}): VerbatiStylePreset {
  const family = getStyleFamilyDefinition(args.layoutId as StyleFamilyId);

  return resolveVerbatiStyle({
    familyId: args.layoutId as StyleFamilyId,
    layout: args.layoutId as StyleFamilyId,
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

function StyleTiltCard({
  option,
  active,
  onSelect,
}: {
  option: StyleOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="dasti-style-scene">
      {/* 25 invisible hotspot zones — siblings of the card for CSS :has() */}
      {/* Ghost sizer — invisible, stays in flow, gives the scene its height */}
      <div className="dasti-style-sizer" aria-hidden="true">
        <span className="dasti-settings-style-card__top">
          <span className="dasti-settings-style-card__label">{option.label}</span>
        </span>
        <span className="dasti-settings-style-card__description">{option.description}</span>
      </div>

      {/* Zone overlay — sits above card, drives CSS :has() tilt */}
      <div className="dasti-style-zones" aria-hidden="true" onClick={onSelect}>
        {ZONE_INDICES.map((n) => (
          <span key={n} className={`dasti-style-zone dasti-style-zone-${n}`} />
        ))}
      </div>

      {/* Actual card — absolute, never affects layout */}
      <button
        type="button"
        className={[
          "dasti-settings-style-card",
          active ? "dasti-settings-style-card--active" : "",
        ].filter(Boolean).join(" ")}
        aria-pressed={active}
        onClick={onSelect}
      >
        <span className="dasti-settings-style-card__top">
          <span className="dasti-settings-style-card__label">{option.label}</span>
          {active && (
            <span className="dasti-settings-style-card__indicator" aria-hidden="true">
              <Check size={10} strokeWidth={2.6} />
            </span>
          )}
        </span>
        <span className="dasti-settings-style-card__description">
          {option.description}
        </span>
      </button>
    </div>
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
      : PROPOSAL_STYLE_PREVIEW_DEFINITIONS[
          (
            styleOption.id === "editorial"
              ? "warm"
              : styleOption.id === "modernist"
                ? "technical"
                : "balanced"
          ) as keyof typeof PROPOSAL_STYLE_PREVIEW_DEFINITIONS
        ]
          ?? PROPOSAL_STYLE_PREVIEW_DEFINITIONS.balanced;

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
  onSetActive,
}: {
  slotIndex: SlotIndex;
  preset: PresetSlot;
  isEditing: boolean;
  isActive: boolean;
  onSelect: () => void;
  onSetActive: (e: React.MouseEvent) => void;
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
        ) : (
          <span
            className="dasti-settings-slot-card__set-default"
            role="button"
            tabIndex={0}
            onClick={onSetActive}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetActive(e as unknown as React.MouseEvent); } }}
            aria-label={`Set ${slotName} as default`}
          >
            Set default
          </span>
        )}
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
      <div className="dasti-settings-signature-grid">
        <button
          type="button"
          className={[
            "dasti-settings-signature-card",
            settings.mode === "auto" ? "dasti-settings-signature-card--active" : "",
          ].filter(Boolean).join(" ")}
          aria-pressed={settings.mode === "auto"}
          onClick={() => onChange(DEFAULT_PROPOSAL_SIGNATURE_SETTINGS)}
        >
          <span className="dasti-settings-signature-card__label">Auto</span>
          <span
            className="dasti-settings-signature-card__sample"
            style={{ fontFamily: bodyFontFamily }}
          >
            {SIGNATURE_SAMPLE_NAME}
          </span>
        </button>

        {PROPOSAL_SIGNATURE_FONT_OPTIONS.map((option) => {
          const active = settings.mode === "font" && settings.fontId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={[
                "dasti-settings-signature-card",
                active ? "dasti-settings-signature-card--active" : "",
              ].filter(Boolean).join(" ")}
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
              <span className="dasti-settings-signature-card__label">
                {option.label}
              </span>
              <span
                className="dasti-settings-signature-card__sample"
                style={{ fontFamily: option.fontFamily }}
              >
                {SIGNATURE_SAMPLE_NAME}
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

export function SettingsPage(): JSX.Element {
  const presetsQuery = useQuery(api.proposalSettings.getPresets);
  const savePreset = useMutation(api.proposalSettings.savePreset);
  const setActivePreset = useMutation(api.proposalSettings.setActivePreset);

  // Local state
  const [editingSlot, setEditingSlot] = React.useState<SlotIndex>(1);
  const [localPresets, setLocalPresets] = React.useState<Record<SlotIndex, PresetSlot>>({
    1: { ...EMPTY_PRESET },
    2: { ...EMPTY_PRESET, styleChoice: "balanced" },
    3: { ...EMPTY_PRESET, styleChoice: "warm" },
  });
  const [activeSlot, setActiveSlot] = React.useState<SlotIndex>(1);
  const [savedTick, setSavedTick] = React.useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const colorPickerAnchorRef = React.useRef<HTMLButtonElement>(null);
  const savedTickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = React.useRef(false);

  // Sync from server once
  React.useEffect(() => {
    if (!presetsQuery || hydrated.current) return;
    hydrated.current = true;

    const serverPreset = (raw: typeof presetsQuery.preset1): PresetSlot => {
      const rawRecord = raw as
        | (typeof raw & { signatureSettings?: unknown })
        | null
        | undefined;

      return {
        fontPairId:
          (raw?.fontPairId as VerbatiFontPairId | null) ?? DEFAULT_FONT_PAIR_ID,
        styleChoice: (raw?.styleChoice as ProposalStyleChoice) ?? "auto",
        paletteOverride: (raw?.paletteOverride as ProposalPaletteId | null) ?? null,
        accentHex: raw?.accentHex ?? null,
        verbatiStyle: sanitizePersistedVerbatiStyle(
          raw?.verbatiStyle as Partial<VerbatiStylePreset> | null | undefined,
        ) as StoredVerbatiStyle | null,
        voicePreset: (raw?.voicePreset as ToneId) ?? null,
        signatureSettings: sanitizeProposalSignatureSettings(
          rawRecord?.signatureSettings,
        ),
        name: raw?.name,
      };
    };

    setLocalPresets({
      1: serverPreset(presetsQuery.preset1),
      2: serverPreset(presetsQuery.preset2),
      3: serverPreset(presetsQuery.preset3),
    });
    setActiveSlot((presetsQuery.activeSlot as SlotIndex | null) ?? 1);
  }, [presetsQuery]);

  const flashSaved = React.useCallback(() => {
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

  // Update a field on the currently editing preset and debounce-save
  const updatePreset = React.useCallback(
    (patch: Partial<PresetSlot>) => {
      setLocalPresets((prev) => {
        const next = { ...prev, [editingSlot]: { ...prev[editingSlot], ...patch } };
        const nextSavedPreset = buildPresetSavePayload(next[editingSlot]);
        // debounce save
        if (saveDebounceRef.current !== null) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
          void savePreset({
            slot: editingSlot,
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
          }).then(() => flashSaved());
          saveDebounceRef.current = null;
        }, 400);
        return next;
      });
    },
    [editingSlot, flashSaved, savePreset],
  );

  const handleSetActive = React.useCallback(
    async (slot: SlotIndex) => {
      setActiveSlot(slot);
      await setActivePreset({ slot });
      flashSaved();
    },
    [flashSaved, setActivePreset],
  );

  const currentPreset = localPresets[editingSlot];
  const currentFontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((fontPair) => fontPair.id === currentPreset.fontPairId) ??
    DEFAULT_FONT_PAIR_OPTION;

  const selectedPaletteOption = currentPreset.paletteOverride
    ? PROPOSAL_PALETTE_OPTIONS.find((p) => p.id === currentPreset.paletteOverride) ?? null
    : null;

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
        </div>

        {/* ── 2-column builder ── */}
        <div className="dasti-settings-builder">

          {/* Left — slot rail + ingredient panel */}
          <div className="dasti-settings-builder__left">

            {/* Slot rail */}
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
                  onSetActive={(e) => { e.stopPropagation(); void handleSetActive(slot); }}
                />
              ))}
            </div>

            {/* Ingredient panel */}
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
                <div
                  className="dasti-settings-style-grid"
                  role="group"
                  aria-label="Layout"
                >
                  {STYLE_OPTIONS.map((option) => (
                    <StyleTiltCard
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
                <div
                  className="dasti-settings-section__row dasti-settings-section__row--palette"
                  role="group"
                  aria-label="Color"
                >
                  <button
                    type="button"
                    className={[
                      "dasti-settings-swatch dasti-settings-swatch--auto",
                      !currentPreset.paletteOverride && !currentPreset.accentHex
                        ? "dasti-settings-swatch--active"
                        : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={!currentPreset.paletteOverride && !currentPreset.accentHex}
                    onClick={() => updatePreset({ paletteOverride: null, accentHex: null })}
                    title="Auto. Follows the style."
                    aria-label="Automatic palette"
                  >
                    <Wand2 size={14} strokeWidth={1.9} aria-hidden="true" />
                  </button>

                  {PROPOSAL_PALETTE_OPTIONS.map((pal) => {
                    const active = currentPreset.paletteOverride === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        className={[
                          "dasti-settings-swatch",
                          active ? "dasti-settings-swatch--active" : "",
                        ].filter(Boolean).join(" ")}
                        aria-pressed={active}
                        onClick={() => updatePreset({ paletteOverride: pal.id as ProposalPaletteId, accentHex: null })}
                        title={pal.label}
                        aria-label={pal.label}
                        style={{ "--swatch-color": pal.color } as React.CSSProperties}
                      />
                    );
                  })}

                  <button
                    ref={colorPickerAnchorRef}
                    type="button"
                    className={[
                      "dasti-settings-swatch",
                      "dasti-settings-swatch--custom",
                      currentPreset.accentHex ? "" : "dasti-settings-swatch--icon",
                      currentPreset.accentHex ? "dasti-settings-swatch--active" : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={currentPreset.accentHex !== null}
                    onClick={() => setIsColorPickerOpen(true)}
                    title={currentPreset.accentHex ?? "Custom color"}
                    aria-label="Custom accent color"
                    style={
                      currentPreset.accentHex
                        ? ({ "--swatch-color": currentPreset.accentHex } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {!currentPreset.accentHex ? (
                      <ColorWheel size={16} className="dasti-settings-swatch__wheel" aria-hidden="true" />
                    ) : null}
                  </button>
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

          {/* Right — sticky hero preview */}
          <div className="dasti-settings-builder__right" aria-live="polite" aria-atomic="true">
            <div className="dasti-settings-builder__preview-label">
              {localPresets[editingSlot].name || DEFAULT_SLOT_NAMES[editingSlot]}
              {activeSlot === editingSlot && (
                <span className="dasti-settings-builder__active-badge" aria-label="Active default">
                  <Check size={10} strokeWidth={2.6} aria-hidden="true" />
                  Default
                </span>
              )}
            </div>
            <HeroPreview
              key={editingSlot}
              preset={currentPreset}
              slotName={currentPreset.name || DEFAULT_SLOT_NAMES[editingSlot]}
            />
            {activeSlot !== editingSlot && (
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

      <ProposalColorPickerPopover
        currentHex={currentPreset.accentHex}
        onHexChange={(hex) => {
          updatePreset({ accentHex: hex, paletteOverride: hex ? null : currentPreset.paletteOverride });
        }}
        anchorRef={colorPickerAnchorRef}
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        onClear={
          currentPreset.accentHex !== null
            ? () => updatePreset({ accentHex: null })
            : undefined
        }
      />
    </div>
  );
}
