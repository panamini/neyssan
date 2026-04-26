import React, { useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Check,
  ColorWheel,
  Feather,
  PenNib,
  Stamp,
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
  name?: string;
};

const DEFAULT_SLOT_NAMES: Record<SlotIndex, string> = {
  1: "Style 1",
  2: "Style 2",
  3: "Style 3",
};

const EMPTY_PRESET: PresetSlot = {
  fontPairId: VERBATI_FONT_PAIR_OPTIONS[0]?.id ?? null,
  styleChoice: "auto",
  paletteOverride: null,
  accentHex: null,
  voicePreset: null,
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

const STYLE_OPTIONS: StyleOption[] = [
  { id: "auto",     label: "Auto",      description: "Matches the look to the role.",                   isAuto: true },
  { id: "swiss", label: "Swiss", description: "Quiet Swiss grid. Serif-led rhythm." },
  { id: "editorial", label: "Editorial", description: "Editorial pacing. Rich reading voice." },
  { id: "modernist", label: "Mono", description: "Tight grid. Technical contrast." },
  { id: "workshop", label: "Workshop", description: "Workshop ATS. Paired margin twin." },
].filter(
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
    ?? VERBATI_FONT_PAIR_OPTIONS[0];
  const styleOption =
    STYLE_OPTIONS.find((s) => s.id === resolvePresetLayoutSelection(preset)) ??
    STYLE_OPTIONS[0];
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find((p) => p.id === preset.paletteOverride);
  const stylePreset = buildPresetSlotStylePreset(preset);

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
    const MAX = 5;

    function move(clientX: number, clientY: number) {
      card.classList.remove("is-resetting");
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (clientX - r.left) / r.width;
        const py = (clientY - r.top) / r.height;
        const x = Math.min(Math.max(px, 0), 1);
        const y = Math.min(Math.max(py, 0), 1);
        card.style.setProperty("--rx", `${((0.5 - y) * MAX * 2).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((x - 0.5) * MAX * 2).toFixed(2)}deg`);
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      });
    }

    function reset() {
      cancelAnimationFrame(rafRef.current);
      card.classList.add("is-resetting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--mx", "50%");
      card.style.setProperty("--my", "50%");
    }

    const onMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", reset);
    return () => {
      card.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseleave", reset);
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
    ?? VERBATI_FONT_PAIR_OPTIONS[0];
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

    const serverPreset = (raw: typeof presetsQuery.preset1): PresetSlot => ({
      fontPairId: (raw?.fontPairId as VerbatiFontPairId | null) ?? VERBATI_FONT_PAIR_OPTIONS[0]?.id ?? null,
      styleChoice: (raw?.styleChoice as ProposalStyleChoice) ?? "auto",
      paletteOverride: (raw?.paletteOverride as ProposalPaletteId | null) ?? null,
      accentHex: raw?.accentHex ?? null,
      verbatiStyle: sanitizePersistedVerbatiStyle(
        raw?.verbatiStyle as Partial<VerbatiStylePreset> | null | undefined,
      ) as StoredVerbatiStyle | null,
      voicePreset: (raw?.voicePreset as ToneId) ?? null,
      name: raw?.name,
    });

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
