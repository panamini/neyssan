import React from "react";
import {
  Feather,
  FileUser,
  Paperclip,
  PanelLeftDashed,
  PenNib,
  Sunglasses,
  Wand2,
  X,
} from "@/lib/icons";
import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import type { FormValues } from "./ProposalInputForm.schemas";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";

type ProposalComposeToolbarProps = {
  value: FormValues["voicePreset"] | null;
  resolvedValue?: ProposalVoicePreset | null;
  onChange: (preset: FormValues["voicePreset"] | null) => void;
  onToggleCvPicker: () => void;
  onClearCv?: () => void;
  cvTitle: string | null;
  isCvPickerOpen: boolean;
  disabled?: boolean;
  compact?: boolean;
  collapsed?: boolean;
  anchored?: boolean;
  collapsedAnchor?: "shell" | "container";
  transitionState?: "entering" | "exiting";
  onCollapseCompose?: () => void;
  onRestoreCompose?: () => void;
};

type ToneOption = {
  id: FormValues["voicePreset"] | null;
  label: string;
  description: string;
  Icon: typeof Wand2;
};

const TONE_OPTIONS: ToneOption[] = [
  {
    id: null,
    label: getVoicePresetDisplayLabel(null),
    description: "System picks the tone.",
    Icon: Wand2,
  },
  {
    id: "signature",
    label: getVoicePresetDisplayLabel("signature"),
    description: "Calm and direct.",
    Icon: Feather,
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
    description: "Friendly and more human.",
    Icon: Sunglasses,
  },
];

function ToneTooltip({
  title,
  description = null,
  className,
}: {
  title: string;
  description?: React.ReactNode | null;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={[
        "dasti-compose-toolbar__tooltip",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <strong>{title}</strong>
      {description ? (
        <span className="dasti-compose-toolbar__tooltip-body">{description}</span>
      ) : null}
    </span>
  );
}

export function ProposalComposeToolbar({
  value,
  resolvedValue: _resolvedValue = null,
  onChange,
  onToggleCvPicker,
  onClearCv,
  cvTitle,
  isCvPickerOpen,
  disabled = false,
  compact = false,
  collapsed = false,
  anchored = false,
  collapsedAnchor = "shell",
  transitionState,
  onCollapseCompose,
  onRestoreCompose,
}: ProposalComposeToolbarProps): JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [isToneMenuOpen, setIsToneMenuOpen] = React.useState(false);

  const activeOption =
    TONE_OPTIONS.find((option) =>
      option.id === null ? value === null : option.id === value,
    ) ?? TONE_OPTIONS[0];

  React.useEffect(() => {
    if (!collapsed || !isToneMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target)) {
        setIsToneMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsToneMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [collapsed, isToneMenuOpen]);

  React.useEffect(() => {
    if (!collapsed) {
      setIsToneMenuOpen(false);
    }
  }, [collapsed]);

  const toggleToneMenu = React.useCallback(() => {
    if (disabled) return;
    if (collapsed) {
      setIsToneMenuOpen((current) => !current);
    }
  }, [collapsed, disabled]);

  const handleToneSelect = React.useCallback(
    (preset: FormValues["voicePreset"] | null) => {
      onChange(preset);
      setIsToneMenuOpen(false);
    },
    [onChange],
  );
  const handleClearCv = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClearCv?.();
    },
    [onClearCv],
  );
  const hasCollapseControl = Boolean(onCollapseCompose);

  return (
    <section
      ref={rootRef}
      className={[
        "dasti-compose-toolbar",
        anchored ? "dasti-compose-toolbar--anchored" : "",
        collapsed ? "dasti-compose-toolbar--collapsed" : "",
        collapsed && collapsedAnchor === "container"
          ? "dasti-compose-toolbar--collapsed-anchor-container"
          : "",
        transitionState ? `dasti-compose-toolbar--${transitionState}` : "",
        isToneMenuOpen ? "dasti-compose-toolbar--drawer-open" : "",
        compact ? "dasti-compose-toolbar--compact" : "",
        !collapsed && !hasCollapseControl
          ? "dasti-compose-toolbar--no-collapse-anchor"
          : "",
        disabled ? "dasti-compose-toolbar--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Proposal tone and CV toolbar"
    >
      {collapsed ? (
        <div className="dasti-compose-toolbar__collapsed-shell dasti-toolbar--surface-tooltips">
          <div className="dasti-compose-toolbar__collapsed-meta">
            <button
                type="button"
                className="dasti-compose-toolbar__icon-button dasti-compose-toolbar__icon-button--leading"
                onClick={onRestoreCompose}
                aria-label="Show compose panel"
                data-toolbar-tooltip="Show"
            >
              <PanelLeftDashed size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="dasti-compose-toolbar__tone-anchor">
              <button
                type="button"
                className={[
                  "dasti-compose-toolbar__tone-option",
                  "dasti-compose-toolbar__tone-option--collapsed",
                  "dasti-compose-toolbar__tone-option--active",
                  isToneMenuOpen
                    ? "dasti-compose-toolbar__tone-option--popover-open"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={toggleToneMenu}
                aria-expanded={isToneMenuOpen}
                aria-haspopup="dialog"
                aria-label={`Tone of voice ${activeOption.label}`}
                data-toolbar-tooltip={
                  isToneMenuOpen ? undefined : activeOption.label
                }
                disabled={disabled}
              >
                <activeOption.Icon size={15} strokeWidth={1.7} aria-hidden="true" />
              </button>

              {isToneMenuOpen ? (
                <div
                  className="dasti-compose-toolbar__tone-popover dasti-compose-toolbar__tone-popover--collapsed dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
                  role="dialog"
                  aria-label="Tone of voice"
                >
                  <div className="dasti-compose-toolbar__tone-list">
                    {TONE_OPTIONS.map((option) => {
                      const active =
                        option.id === null ? value === null : option.id === value;
                      return (
                        <button
                          key={option.id ?? "auto"}
                          type="button"
                          className={[
                            "dasti-compose-toolbar__tone-option",
                            "dasti-compose-toolbar__tone-option--drawer",
                            active ? "dasti-compose-toolbar__tone-option--active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => handleToneSelect(option.id)}
                          aria-pressed={active}
                          aria-label={option.label}
                          disabled={disabled}
                        >
                          <option.Icon size={15} strokeWidth={1.7} aria-hidden="true" />
                          <ToneTooltip
                            className="dasti-compose-toolbar__tooltip--drawer"
                            title={option.label}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </span>
          </div>
        </div>
      ) : (
        <div className="dasti-compose-toolbar__bar dasti-toolbar--surface-tooltips">
          {hasCollapseControl ? (
            <>
              <div
                className="dasti-compose-toolbar__group dasti-compose-toolbar__group--collapse"
                role="group"
                aria-label="Compose panel"
              >
                <button
                  type="button"
                  className="dasti-compose-toolbar__icon-button dasti-compose-toolbar__icon-button--leading"
                  onClick={onCollapseCompose}
                  aria-label="Hide compose panel"
                  data-toolbar-tooltip="Hide"
                >
                  <PanelLeftDashed size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              <span
                className="dasti-compose-toolbar__group-divider"
                aria-hidden="true"
              />
            </>
          ) : null}

          <div
            className="dasti-compose-toolbar__group dasti-compose-toolbar__group--cv"
            role="group"
            aria-label="Attached CV"
          >
            <div
              className={[
                "dasti-compose-toolbar__cv-shell",
                cvTitle ? "dasti-compose-toolbar__cv-shell--active" : "",
                isCvPickerOpen ? "dasti-compose-toolbar__cv-shell--open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {cvTitle && onClearCv ? (
                <>
                  <button
                    type="button"
                    className="dasti-compose-toolbar__cv-remove"
                    onClick={handleClearCv}
                    aria-label="Remove CV"
                    data-toolbar-tooltip="Remove CV"
                    disabled={disabled}
                  >
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <span
                    className="dasti-compose-toolbar__cv-divider"
                    aria-hidden="true"
                  />
                </>
              ) : null}

              <button
                type="button"
                className={[
                  "dasti-compose-toolbar__cv-chip",
                  cvTitle ? "dasti-compose-toolbar__cv-chip--active" : "",
                  isCvPickerOpen ? "dasti-compose-toolbar__cv-chip--open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onToggleCvPicker}
                aria-expanded={isCvPickerOpen}
                aria-haspopup="dialog"
                aria-label={
                  isCvPickerOpen
                    ? "Close CV picker"
                    : cvTitle
                      ? `Attached CV ${cvTitle}`
                      : "Attach CV"
                }
                data-toolbar-tooltip={
                  isCvPickerOpen
                    ? "Close CV picker"
                    : cvTitle
                      ? "Switch CV"
                      : "Attach CV"
                }
                disabled={disabled}
              >
                <span className="dasti-compose-toolbar__cv-icon" aria-hidden="true">
                  {cvTitle ? (
                    <FileUser size={15} strokeWidth={1.7} />
                  ) : (
                    <Paperclip size={15} strokeWidth={1.7} />
                  )}
                </span>
                <span className="dasti-compose-toolbar__cv-copy">
                  {cvTitle ?? "Attach CV"}
                </span>
              </button>
            </div>
          </div>

          <span
            className="dasti-compose-toolbar__group-divider dasti-compose-toolbar__group-divider--trailing"
            aria-hidden="true"
          />

          <div
            className="dasti-compose-toolbar__group dasti-compose-toolbar__group--tone"
            role="group"
            aria-label="Tone of voice"
          >
            <div className="dasti-compose-toolbar__tone-block">
              <div className="dasti-compose-toolbar__tone-row">
                {TONE_OPTIONS.map((option) => {
                  const active =
                    option.id === null ? value === null : option.id === value;
                  return (
                    <button
                      key={option.id ?? "auto"}
                      type="button"
                      className={[
                        "dasti-compose-toolbar__tone-option",
                        active ? "dasti-compose-toolbar__tone-option--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleToneSelect(option.id)}
                      aria-pressed={active}
                      aria-label={option.label}
                      data-toolbar-tooltip={option.label}
                      disabled={disabled}
                    >
                      <option.Icon size={15} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <div className="dasti-compose-toolbar__tone-meta">
                <span
                  className="dasti-compose-toolbar__tone-chip dasti-compose-toolbar__tone-chip--described"
                  data-toolbar-tooltip={activeOption.label}
                >
                  {activeOption.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProposalComposeToolbar;
