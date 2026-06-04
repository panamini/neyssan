import React from "react";
import {
  DEFAULT_DOCUMENT_ICON_SETTINGS,
  getDocumentIcon,
  normalizeDocumentIconSettings,
  type DocumentIconColor,
  type DocumentIconSettings,
  type DocumentIconSizePt,
  type DocumentListMarkerType,
} from "../../lib/document-icons";

type BulletPresetId = "editorial-plus" | "classic-dot" | "minimal-dash";
type BulletControlTab = "presets" | "advanced";

type BulletMarkerOption = {
  id: string;
  label: string;
  markerType: DocumentListMarkerType;
  iconKey?: string;
  glyph?: string;
};

type BulletPreset = {
  id: BulletPresetId;
  title: string;
  marker: BulletMarkerOption;
  color: DocumentIconColor;
  sizePt: DocumentIconSizePt;
};

export type BulletStyleControlLabels = {
  label?: string;
  change?: string;
  presets?: string;
  advanced?: string;
  marker?: string;
  tone?: string;
  scale?: string;
};

export type BulletStyleControlProps = {
  settings: DocumentIconSettings | null | undefined;
  onChange: (settings: DocumentIconSettings) => void;
  labels?: BulletStyleControlLabels;
  className?: string;
  disabled?: boolean;
};

const BULLET_MARKER_OPTIONS: BulletMarkerOption[] = [
  { id: "dot", label: "Dot", markerType: "dot", glyph: "•" },
  { id: "dash", label: "Dash", markerType: "dash", glyph: "–" },
  { id: "check", label: "Check", markerType: "icon", iconKey: "check" },
  { id: "arrow", label: "Arrow", markerType: "icon", iconKey: "arrow-right" },
  { id: "plus", label: "Plus", markerType: "icon", iconKey: "plus" },
  { id: "diamond", label: "Diamond", markerType: "icon", iconKey: "diamond" },
  { id: "star", label: "Star", markerType: "icon", iconKey: "star" },
];

const BULLET_PRESETS: BulletPreset[] = [
  {
    id: "editorial-plus",
    title: "Editorial Plus",
    marker: BULLET_MARKER_OPTIONS[4],
    color: "accent",
    sizePt: 10,
  },
  {
    id: "classic-dot",
    title: "Classic Dot",
    marker: BULLET_MARKER_OPTIONS[0],
    color: "ink",
    sizePt: 10,
  },
  {
    id: "minimal-dash",
    title: "Minimal Dash",
    marker: BULLET_MARKER_OPTIONS[1],
    color: "muted",
    sizePt: 8,
  },
];

const TONE_OPTIONS: Array<{ id: DocumentIconColor; label: string }> = [
  { id: "ink", label: "Ink" },
  { id: "muted", label: "Muted" },
  { id: "accent", label: "Accent" },
];

const SCALE_OPTIONS: Array<{
  id: "small" | "medium" | "large";
  label: string;
  sizePt: DocumentIconSizePt;
}> = [
  { id: "small", label: "Small", sizePt: 8 },
  { id: "medium", label: "Medium", sizePt: 10 },
  { id: "large", label: "Large", sizePt: 12 },
];

function markerMatches(settings: DocumentIconSettings, marker: BulletMarkerOption): boolean {
  if (marker.markerType === "icon") {
    return (
      settings.listMarkerType === "icon" &&
      settings.defaultListMarkerKey === marker.iconKey
    );
  }

  return settings.listMarkerType === marker.markerType;
}

function getActivePreset(settings: DocumentIconSettings): BulletPreset | null {
  return (
    BULLET_PRESETS.find(
      (preset) =>
        markerMatches(settings, preset.marker) &&
        settings.color === preset.color &&
        settings.sizePt === preset.sizePt,
    ) ?? null
  );
}

function formatTone(color: DocumentIconColor): string {
  return TONE_OPTIONS.find((option) => option.id === color)?.label ?? "Accent";
}

function formatScale(sizePt: DocumentIconSizePt): string {
  return SCALE_OPTIONS.find((option) => option.sizePt === sizePt)?.label ?? "Medium";
}

function settingsForMarker(
  current: DocumentIconSettings,
  marker: BulletMarkerOption,
): DocumentIconSettings {
  const defaultMarkerKey =
    marker.iconKey ??
    (marker.markerType === "dot" ? "dot" : null) ??
    (marker.markerType === "dash" ? "minus" : null) ??
    current.defaultListMarkerKey ??
    DEFAULT_DOCUMENT_ICON_SETTINGS.defaultListMarkerKey;

  return normalizeDocumentIconSettings({
    ...current,
    listMarkerType: marker.markerType,
    defaultListMarkerKey: defaultMarkerKey,
  });
}

function settingsForPreset(
  current: DocumentIconSettings,
  preset: BulletPreset,
): DocumentIconSettings {
  return normalizeDocumentIconSettings({
    ...settingsForMarker(current, preset.marker),
    color: preset.color,
    sizePt: preset.sizePt,
  });
}

function BulletMarkerPreview({
  marker,
  className,
}: {
  marker: BulletMarkerOption;
  className?: string;
}): JSX.Element {
  const icon = marker.iconKey ? getDocumentIcon(marker.iconKey) : null;

  if (icon) {
    return (
      <span
        className={["bullet-style-control__marker-icon", className]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    );
  }

  return (
    <span
      className={["bullet-style-control__marker-glyph", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {marker.glyph}
    </span>
  );
}

function resolveMarker(settings: DocumentIconSettings): BulletMarkerOption {
  if (settings.listMarkerType === "icon") {
    return (
      BULLET_MARKER_OPTIONS.find(
        (option) => option.iconKey === settings.defaultListMarkerKey,
      ) ?? BULLET_MARKER_OPTIONS[4]
    );
  }

  return (
    BULLET_MARKER_OPTIONS.find(
      (option) => option.markerType === settings.listMarkerType,
    ) ?? BULLET_MARKER_OPTIONS[0]
  );
}

export function BulletStyleControl({
  settings,
  onChange,
  labels,
  className,
  disabled = false,
}: BulletStyleControlProps): JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<BulletControlTab>("presets");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const resolvedSettings = React.useMemo(
    () => normalizeDocumentIconSettings(settings),
    [settings],
  );
  const activePreset = getActivePreset(resolvedSettings);
  const currentMarker = resolveMarker(resolvedSettings);
  const controlLabel = labels?.label ?? "Bullets";
  const presetsLabel = labels?.presets ?? "Presets";
  const advancedLabel = labels?.advanced ?? "Advanced";

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const applySettings = React.useCallback(
    (nextSettings: DocumentIconSettings) => {
      onChange(normalizeDocumentIconSettings(nextSettings));
    },
    [onChange],
  );

  return (
    <div
      ref={rootRef}
      className={["bullet-style-control", className].filter(Boolean).join(" ")}
      data-testid="bullet-style-control"
    >
      <div className="bullet-style-control__label">{controlLabel}</div>
      <button
        type="button"
        className="bullet-style-control__summary"
        aria-label={`${controlLabel}: ${activePreset?.title ?? "Custom Bullet"}`}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          setActiveTab("presets");
          setIsOpen((value) => !value);
        }}
      >
        <span className="bullet-style-control__summary-left">
          <span
            className={`bullet-style-control__badge bullet-style-control__badge--${resolvedSettings.color}`}
          >
            <BulletMarkerPreview marker={currentMarker} />
          </span>
          <span className="bullet-style-control__summary-text">
            <strong>{activePreset?.title ?? "Custom Bullet"}</strong>
            <span>
              {formatTone(resolvedSettings.color)} • {formatScale(resolvedSettings.sizePt)}
            </span>
          </span>
        </span>
        <span className="bullet-style-control__change">
          {labels?.change ?? "Change"}
        </span>
      </button>

      {isOpen ? (
        <div
          className="bullet-style-control__popover"
          role="dialog"
          aria-label={controlLabel}
        >
          <div className="bullet-style-control__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "presets"}
              onClick={() => setActiveTab("presets")}
            >
              {presetsLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "advanced"}
              onClick={() => setActiveTab("advanced")}
            >
              {advancedLabel}
            </button>
          </div>

          {activeTab === "presets" ? (
            <div className="bullet-style-control__presets">
              {BULLET_PRESETS.map((preset) => {
                const isSelected = activePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="bullet-style-control__preset"
                    aria-label={preset.title}
                    data-selected={isSelected ? "true" : undefined}
                    aria-pressed={isSelected}
                    onClick={() => {
                      applySettings(settingsForPreset(resolvedSettings, preset));
                      setIsOpen(false);
                    }}
                  >
                    <span
                      className={`bullet-style-control__preset-badge bullet-style-control__badge--${preset.color}`}
                    >
                      <BulletMarkerPreview marker={preset.marker} />
                    </span>
                    <span className="bullet-style-control__preset-text">
                      <strong>{preset.title}</strong>
                      <span>
                        {formatTone(preset.color)} • {formatScale(preset.sizePt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bullet-style-control__advanced">
              <div className="bullet-style-control__block">
                <div className="bullet-style-control__block-title">
                  {labels?.marker ?? "Marker"}
                </div>
                <div className="bullet-style-control__marker-grid">
                  {BULLET_MARKER_OPTIONS.map((marker) => {
                    const isSelected = markerMatches(resolvedSettings, marker);
                    return (
                      <button
                        key={marker.id}
                        type="button"
                        aria-label={`${marker.label} marker`}
                        aria-pressed={isSelected}
                        data-selected={isSelected ? "true" : undefined}
                        onClick={() =>
                          applySettings(settingsForMarker(resolvedSettings, marker))
                        }
                      >
                        <BulletMarkerPreview marker={marker} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bullet-style-control__block">
                <div className="bullet-style-control__block-title">
                  {labels?.tone ?? "Tone"}
                </div>
                <div className="bullet-style-control__segments">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={`${option.label} tone`}
                      aria-pressed={resolvedSettings.color === option.id}
                      data-selected={
                        resolvedSettings.color === option.id ? "true" : undefined
                      }
                      onClick={() =>
                        applySettings({ ...resolvedSettings, color: option.id })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bullet-style-control__block">
                <div className="bullet-style-control__block-title">
                  {labels?.scale ?? "Scale"}
                </div>
                <div className="bullet-style-control__segments">
                  {SCALE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={`${option.label} scale`}
                      aria-pressed={resolvedSettings.sizePt === option.sizePt}
                      data-selected={
                        resolvedSettings.sizePt === option.sizePt ? "true" : undefined
                      }
                      onClick={() =>
                        applySettings({ ...resolvedSettings, sizePt: option.sizePt })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default BulletStyleControl;
