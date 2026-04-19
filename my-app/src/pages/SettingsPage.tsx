import React, { useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Check,
  ColorWheel,
  PenNib,
  PenLine,
  Sun,
  Wand2,
} from "@/lib/icons";
import {
  PROPOSAL_PALETTE_OPTIONS,
  PROPOSAL_STYLE_PREVIEW_DEFINITIONS,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import { buildVerbatiStyleFromProposalSettings } from "../lib/proposal-style-choice";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import { ProposalColorPickerPopover } from "../components/ProposalColorPickerPopover";
import {
  VERBATI_FONT_PAIR_OPTIONS,
  type VerbatiFontPairId,
} from "../features/verbati/fontCatalog";
import {
  DEFAULT_VERBATI_STYLE,
  getStyleFamilyId,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import type {
  StyleFamilyId,
  VerbatiStylePreset,
} from "../features/verbati/types";
import {
  getStyleFamilyDisplayMetadata,
  listSelectableStyleFamilies,
  type StyleFamilyDefinition,
} from "../lib/layout/styleFamilies";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotIndex = 1 | 2 | 3;

type PresetSlot = {
  verbatiStyle: VerbatiStylePreset;
  voicePreset: "signature" | "expert" | "engaging" | null;
  name?: string;
};

type RawPresetSlot = {
  verbatiStyle?: Partial<VerbatiStylePreset> | null;
  fontPairId?: VerbatiFontPairId | null;
  styleChoice?: unknown;
  paletteOverride?: ProposalPaletteId | null;
  accentHex?: string | null;
  voicePreset?: "signature" | "expert" | "engaging" | null;
  name?: string;
} | null | undefined;

const DEFAULT_SLOT_NAMES: Record<SlotIndex, string> = {
  1: "Style 1",
  2: "Style 2",
  3: "Style 3",
};

const EMPTY_PRESET: PresetSlot = {
  verbatiStyle: DEFAULT_VERBATI_STYLE,
  voicePreset: null,
};

// ─── Tone options ──────────────────────────────────────────────────────────────

type ToneId = "signature" | "expert" | "engaging" | null;
const TONE_OPTIONS: { id: ToneId; label: string; description: string; Icon: typeof Wand2 }[] = [
  { id: null, label: getVoicePresetDisplayLabel(null), description: "Adapts to the role.", Icon: Wand2 },
  { id: "signature", label: getVoicePresetDisplayLabel("signature"), description: "Natural and credible.", Icon: PenLine },
  { id: "expert", label: getVoicePresetDisplayLabel("expert"), description: "Precise and authoritative.", Icon: PenNib },
  { id: "engaging", label: getVoicePresetDisplayLabel("engaging"), description: "Lively and interpersonal.", Icon: Sun },
];

function getSettingsPreviewVariant(
  style: VerbatiStylePreset,
): keyof typeof PROPOSAL_STYLE_PREVIEW_DEFINITIONS {
  switch (getStyleFamilyId(style)) {
    case "editorial":
      return "warm";
    case "modernist":
      return "technical";
    case "quire":
      return "formal";
    default:
      return "balanced";
  }
}

function normalizePresetSlot(raw: RawPresetSlot): PresetSlot {
  const verbatiStyle = buildVerbatiStyleFromProposalSettings({
    verbatiStyle: raw?.verbatiStyle ?? null,
    styleChoice: raw?.styleChoice,
    fontPairId: raw?.fontPairId,
    paletteOverride: raw?.paletteOverride ?? null,
    accentHex: raw?.accentHex ?? null,
  });

  return {
    verbatiStyle,
    voicePreset: raw?.voicePreset ?? null,
    name: raw?.name,
  };
}

function serializePresetSlot(preset: PresetSlot): {
  verbatiStyle: VerbatiStylePreset;
  voicePreset: "signature" | "expert" | "engaging" | null;
  name?: string;
} {
  return {
    verbatiStyle: serializeVerbatiStyle(preset.verbatiStyle),
    voicePreset: preset.voicePreset ?? null,
    ...(preset.name ? { name: preset.name } : {}),
  };
}

// ─── Layout style card — Pure CSS 5×5 hotspot tilt ────────────────────────────

const ZONE_INDICES = Array.from({ length: 25 }, (_, i) => i + 1);

function StyleTiltCard({
  option,
  active,
  onSelect,
}: {
  option: Pick<StyleFamilyDefinition, "id" | "label" | "description">;
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

function HeroPreview({ preset }: { preset: PresetSlot }) {
  const resolvedStyle = resolveVerbatiStyle(preset.verbatiStyle);
  const fontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === resolvedStyle.typography) ??
    VERBATI_FONT_PAIR_OPTIONS[0];
  const familyDisplay = getStyleFamilyDisplayMetadata(resolvedStyle.familyId);
  const paletteOption = PROPOSAL_PALETTE_OPTIONS.find(
    (p) => p.id === resolvedStyle.palette,
  );

  const accentColor =
    resolvedStyle.accentHex ??
    paletteOption?.color ??
    "color-mix(in srgb, var(--color-accent) 80%, white 20%)";

  const previewVariant = getSettingsPreviewVariant(resolvedStyle);
  const previewDef = PROPOSAL_STYLE_PREVIEW_DEFINITIONS[previewVariant];

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
      className={`dasti-settings-hero-preview dasti-settings-hero-preview--${previewVariant}`}
      style={{ "--hero-accent": accentColor } as React.CSSProperties}
    >
      <div className="dasti-settings-hero-preview__inner">
        <div className="dasti-settings-hero-preview__kicker" aria-hidden="true">
          {previewDef.templateName.toUpperCase()}
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
            {familyDisplay.label}
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
  const resolvedStyle = resolveVerbatiStyle(preset.verbatiStyle);
  const fontPair =
    VERBATI_FONT_PAIR_OPTIONS.find((f) => f.id === resolvedStyle.typography) ??
    VERBATI_FONT_PAIR_OPTIONS[0];
  const familyDisplay = getStyleFamilyDisplayMetadata(resolvedStyle.familyId);
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
        <span className="dasti-settings-slot-card__font-label">
          {familyDisplay.label}
        </span>
        <span className="dasti-settings-slot-card__font-sep" aria-hidden="true">/</span>
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
  const familyOptions = React.useMemo(() => listSelectableStyleFamilies(), []);

  // Local state
  const [editingSlot, setEditingSlot] = React.useState<SlotIndex>(1);
  const [localPresets, setLocalPresets] = React.useState<Record<SlotIndex, PresetSlot>>({
    1: { ...EMPTY_PRESET },
    2: { ...EMPTY_PRESET },
    3: {
      ...EMPTY_PRESET,
      verbatiStyle: resolveVerbatiStyle({
        familyId: "editorial",
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    },
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

    setLocalPresets({
      1: normalizePresetSlot(presetsQuery.preset1),
      2: normalizePresetSlot(presetsQuery.preset2),
      3: normalizePresetSlot(presetsQuery.preset3),
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
        if (saveDebounceRef.current !== null) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(() => {
          void savePreset({
            slot: editingSlot,
            preset: serializePresetSlot(next[editingSlot]),
          }).then(() => flashSaved());
          saveDebounceRef.current = null;
        }, 400);
        return next;
      });
    },
    [editingSlot, flashSaved, savePreset],
  );

  const updateVerbatiStyle = React.useCallback(
    (patch: Partial<VerbatiStylePreset>) => {
      updatePreset({
        verbatiStyle: resolveVerbatiStyle({
          ...localPresets[editingSlot].verbatiStyle,
          ...patch,
        }),
      });
    },
    [editingSlot, localPresets, updatePreset],
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
  const currentStyle = resolveVerbatiStyle(currentPreset.verbatiStyle);
  const currentFamilyDisplay = getStyleFamilyDisplayMetadata(currentStyle.familyId);

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
              Assemble up to 3 complete style presets. The active one is applied when you start a new proposal.
            </p>
          </div>
          {savedTick && (
            <span className="dasti-settings-page__saved" aria-live="polite">
              <Check size={12} strokeWidth={2.4} aria-hidden="true" />
              Saved
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
                  selectedId={currentStyle.typography as VerbatiFontPairId | null}
                  onChange={(id) => updateVerbatiStyle({ typography: id })}
                />
              </div>

              {/* Layout */}
              <div className="dasti-settings-appearance-group">
                <div className="dasti-settings-appearance-label">
                  Family
                </div>
                <div
                  className="dasti-settings-style-grid"
                  role="group"
                  aria-label="Style family"
                >
                  {familyOptions.map((option) => (
                    <StyleTiltCard
                      key={option.id}
                      option={option}
                      active={currentStyle.familyId === option.id}
                      onSelect={() =>
                        updateVerbatiStyle({
                          familyId: option.id,
                          layout: option.id,
                        })
                      }
                    />
                  ))}
                </div>
                <div className="dasti-settings-style-card__description">
                  Current family: {currentFamilyDisplay.label}
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
                      currentStyle.palette === "sauge" && !currentStyle.accentHex
                        ? "dasti-settings-swatch--active"
                        : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={currentStyle.palette === "sauge" && !currentStyle.accentHex}
                    onClick={() =>
                      updateVerbatiStyle({ palette: DEFAULT_VERBATI_STYLE.palette, accentHex: undefined })
                    }
                    title="Automatic — follows the selected style"
                    aria-label="Automatic palette"
                  >
                    <Wand2 size={14} strokeWidth={1.9} aria-hidden="true" />
                  </button>

                  {PROPOSAL_PALETTE_OPTIONS.map((pal) => {
                    const active = currentStyle.palette === pal.id && !currentStyle.accentHex;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        className={[
                          "dasti-settings-swatch",
                          active ? "dasti-settings-swatch--active" : "",
                        ].filter(Boolean).join(" ")}
                        aria-pressed={active}
                        onClick={() => updateVerbatiStyle({ palette: pal.id as ProposalPaletteId, accentHex: undefined })}
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
                      currentStyle.accentHex ? "" : "dasti-settings-swatch--icon",
                      currentStyle.accentHex ? "dasti-settings-swatch--active" : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={Boolean(currentStyle.accentHex)}
                    onClick={() => setIsColorPickerOpen(true)}
                    title={currentStyle.accentHex ?? "Custom color"}
                    aria-label="Custom accent color"
                    style={
                      currentStyle.accentHex
                        ? ({ "--swatch-color": currentStyle.accentHex } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {!currentStyle.accentHex ? (
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
        currentHex={currentStyle.accentHex ?? null}
        onHexChange={(hex) => {
          updateVerbatiStyle({
            palette: hex ? "custom" : DEFAULT_VERBATI_STYLE.palette,
            accentHex: hex ?? undefined,
          });
        }}
        anchorRef={colorPickerAnchorRef}
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        onClear={
          currentStyle.accentHex !== undefined
            ? () =>
                updateVerbatiStyle({
                  palette: DEFAULT_VERBATI_STYLE.palette,
                  accentHex: undefined,
                })
            : undefined
        }
      />
    </div>
  );
}
