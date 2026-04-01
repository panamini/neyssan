import React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Check,
  ColorWheel,
  PenNib,
  PenLine,
  Palette,
  Sun,
  Wand2,
} from "@/lib/icons";
import type { ProposalStyleChoice } from "../lib/proposal-style-choice";
import {
  PROPOSAL_AUTO_STYLE_PREVIEW,
  PROPOSAL_PALETTE_OPTIONS,
  PROPOSAL_STYLE_PREVIEW_DEFINITIONS,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import { ProposalColorPickerPopover } from "../components/ProposalColorPickerPopover";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToneOption = {
  id: "signature" | "expert" | "engaging" | null;
  label: string;
  description: string;
  Icon: typeof Wand2;
};

type StyleOption = {
  id: ProposalStyleChoice;
  label: string;
  description: string;
  preview: {
    headingFont: string;
    headingWeight: number;
    fontStyle?: "normal" | "italic";
    fontName: string;
    templateName: string;
  };
  isAuto?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_OPTIONS: ToneOption[] = [
  {
    id: null,
    label: getVoicePresetDisplayLabel(null),
    description: "Adapts to the role and context.",
    Icon: Wand2,
  },
  {
    id: "signature",
    label: getVoicePresetDisplayLabel("signature"),
    description: "Natural and credible.",
    Icon: PenLine,
  },
  {
    id: "expert",
    label: getVoicePresetDisplayLabel("expert"),
    description: "Precise and authoritative.",
    Icon: PenNib,
  },
  {
    id: "engaging",
    label: getVoicePresetDisplayLabel("engaging"),
    description: "Lively and interpersonal.",
    Icon: Sun,
  },
];

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Matches the look to the role.",
    preview: PROPOSAL_AUTO_STYLE_PREVIEW,
    isAuto: true,
  },
  {
    id: "balanced",
    label: "Swiss",
    description: "Quiet Swiss grid with a calmer serif-led rhythm.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.balanced,
  },
  {
    id: "warm",
    label: "Editorial",
    description: "Editorial pacing with a richer reading voice.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.warm,
  },
  {
    id: "technical",
    label: "Mono",
    description: "Tighter grid with a more technical contrast.",
    preview: PROPOSAL_STYLE_PREVIEW_DEFINITIONS.technical,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsPage(): JSX.Element {
  const settingsQuery = useQuery(api.proposalSettings.getCurrent);
  const updateSettings = useMutation(api.proposalSettings.setCurrent);

  // Local state mirrors the server values; we update optimistically
  const [localTone, setLocalTone] = React.useState<"signature" | "expert" | "engaging" | null>(null);
  const [localStyle, setLocalStyle] = React.useState<ProposalStyleChoice>("auto");
  const [localPalette, setLocalPalette] = React.useState<ProposalPaletteId | null>(null);
  const [localAccentHex, setLocalAccentHex] = React.useState<string | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const colorPickerAnchorRef = React.useRef<HTMLButtonElement>(null);

  const [savedTick, setSavedTick] = React.useState(false);
  const savedTickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server once loaded
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (!settingsQuery || hydrated.current) return;
    hydrated.current = true;

    // voicePreset from server: null savedVoicePreset = Auto
    const tone = (settingsQuery.savedVoicePreset ?? null) as "signature" | "expert" | "engaging" | null;
    setLocalTone(tone);
    setLocalStyle(
      settingsQuery.styleChoice === "formal"
        ? "balanced"
        : ((settingsQuery.styleChoice as ProposalStyleChoice | undefined) ?? "auto"),
    );
    const nextAccentHex =
      typeof settingsQuery.accentHex === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(settingsQuery.accentHex)
        ? settingsQuery.accentHex.toUpperCase()
        : null;
    setLocalAccentHex(nextAccentHex);
    setLocalPalette(
      nextAccentHex
        ? null
        : ((settingsQuery.paletteOverride as ProposalPaletteId | undefined) ?? null),
    );
  }, [settingsQuery]);

  const flashSaved = React.useCallback(() => {
    setSavedTick(true);
    if (savedTickTimeoutRef.current !== null) {
      clearTimeout(savedTickTimeoutRef.current);
    }
    savedTickTimeoutRef.current = setTimeout(() => {
      setSavedTick(false);
      savedTickTimeoutRef.current = null;
    }, 1600);
  }, []);

  React.useEffect(() => {
    return () => {
      if (savedTickTimeoutRef.current !== null) {
        clearTimeout(savedTickTimeoutRef.current);
      }
    };
  }, []);

  const handleToneChange = React.useCallback(
    async (tone: "signature" | "expert" | "engaging" | null) => {
      setLocalTone(tone);
      await updateSettings({ voicePreset: tone });
      flashSaved();
    },
    [flashSaved, updateSettings],
  );

  const handleStyleChange = React.useCallback(
    async (style: ProposalStyleChoice) => {
      setLocalStyle(style);
      await updateSettings({ styleChoice: style });
      flashSaved();
    },
    [flashSaved, updateSettings],
  );

  const handlePaletteChange = React.useCallback(
    async (palette: ProposalPaletteId | null) => {
      setLocalPalette(palette);
      setLocalAccentHex(null);
      await updateSettings({ paletteOverride: palette, accentHex: null });
      flashSaved();
    },
    [flashSaved, updateSettings],
  );

  const handleAccentHexChange = React.useCallback(
    async (accentHex: string | null) => {
      setLocalAccentHex(accentHex);
      if (accentHex !== null) {
        setLocalPalette(null);
      }
      await updateSettings({
        accentHex,
        paletteOverride: accentHex === null ? localPalette : null,
      });
      flashSaved();
    },
    [flashSaved, localPalette, updateSettings],
  );

  return (
    <div className="dasti-page-scroll" style={{ minWidth: 0 }}>
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "640px",
            "--page-shell-gap": "var(--layout-page-stack)",
          } as React.CSSProperties
        }
      >
        <section aria-label="Proposal defaults">
          <div className="dasti-settings-page">
            <div className="dasti-settings-page__header">
              <h1 className="dasti-settings-page__title">Proposal defaults</h1>
              <p className="dasti-settings-page__subtitle">
                Default tone, bundled direction, and palette applied when you start a new proposal.
              </p>
              {savedTick ? (
                <span className="dasti-settings-page__saved" aria-live="polite">
                  <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                  Saved
                </span>
              ) : null}
            </div>

            {/* ── Tone ── */}
            <div className="dasti-settings-section">
              <div className="dasti-settings-section__label">Default tone</div>
              <div className="dasti-settings-section__row" role="group" aria-label="Default tone">
                {TONE_OPTIONS.map((option) => {
                  const active = localTone === option.id;
                  return (
                    <button
                      key={option.id ?? "auto"}
                      type="button"
                      className={
                        active
                          ? "dasti-settings-pill dasti-settings-pill--active"
                          : "dasti-settings-pill"
                      }
                      aria-pressed={active}
                      onClick={() => { void handleToneChange(option.id); }}
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

            {/* ── Style ── */}
            <div className="dasti-settings-section">
              <div className="dasti-settings-section__label">Default style</div>
              <div className="dasti-settings-section__row" role="group" aria-label="Default style">
                {STYLE_OPTIONS.map((option) => {
                  const active = localStyle === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={
                        active
                          ? "dasti-settings-pill dasti-settings-pill--active"
                          : "dasti-settings-pill"
                      }
                      aria-pressed={active}
                      onClick={() => { void handleStyleChange(option.id); }}
                      title={option.description}
                    >
                      <span
                        className="dasti-settings-pill__icon dasti-settings-pill__icon--aa"
                        aria-hidden="true"
                        style={{
                          fontFamily: option.preview.headingFont,
                          fontWeight: option.preview.headingWeight,
                          fontStyle: option.preview.fontStyle ?? "normal",
                        }}
                      >
                        Aa
                        {option.isAuto ? (
                          <span className="dasti-settings-pill__icon-badge">
                            <Wand2 size={9} strokeWidth={1.8} />
                          </span>
                        ) : null}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Palette ── */}
            <div className="dasti-settings-section">
              <div className="dasti-settings-section__label">Default palette</div>
              <div
                className="dasti-settings-section__row dasti-settings-section__row--palette"
                role="group"
                aria-label="Default palette"
              >
                {/* Auto swatch */}
                <button
                  type="button"
                  className={
                    localPalette === null
                      && localAccentHex === null
                      ? "dasti-settings-swatch dasti-settings-swatch--auto dasti-settings-swatch--active"
                      : "dasti-settings-swatch dasti-settings-swatch--auto"
                  }
                  aria-pressed={localPalette === null && localAccentHex === null}
                  onClick={() => { void handlePaletteChange(null); }}
                  title="Auto — follows the style choice"
                  aria-label="Palette auto"
                >
                  <Palette size={12} strokeWidth={1.7} aria-hidden="true" />
                </button>

                {PROPOSAL_PALETTE_OPTIONS.map((pal) => {
                  const active = localPalette === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      className={
                        active
                          ? "dasti-settings-swatch dasti-settings-swatch--active"
                          : "dasti-settings-swatch"
                      }
                      aria-pressed={active}
                      onClick={() => { void handlePaletteChange(pal.id); }}
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
                    localAccentHex ? "" : "dasti-settings-swatch--icon",
                    localAccentHex ? "dasti-settings-swatch--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={localAccentHex !== null}
                  onClick={() => setIsColorPickerOpen(true)}
                  title={localAccentHex ?? "Custom color"}
                  aria-label="Custom accent color"
                  style={
                    localAccentHex
                      ? ({ "--swatch-color": localAccentHex } as React.CSSProperties)
                      : undefined
                  }
                >
                  {!localAccentHex ? (
                    <ColorWheel
                      size={16}
                      className="dasti-settings-swatch__wheel"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </div>
            </div>

          </div>
        </section>
      </div>
      <ProposalColorPickerPopover
        currentHex={localAccentHex}
        onHexChange={(hex) => {
          void handleAccentHexChange(hex);
        }}
        anchorRef={colorPickerAnchorRef}
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        onClear={
          localAccentHex !== null
            ? () => {
                void handleAccentHexChange(null);
              }
            : undefined
        }
      />
    </div>
  );
}
