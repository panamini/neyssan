import { useMemo, useState } from "react";

type ThemeMode = "accent-only" | "surfaces-text" | "global";

type FontPair = {
  id: string;
  label: string;
  headingFamily: string;
  bodyFamily: string;
  headingWeight: number;
  bodyWeight: number;
  editorialFamily: string;
  editorialWeight: number;
};

type PaletteOption = {
  id: string;
  label: string;
};

type ModeOption = {
  id: ThemeMode;
  label: string;
  description: string;
};

type ThemeVars = Record<string, string>;

type ThemeResult = {
  swatches: Array<{ hue: number; color: string }>;
  accent: ThemeVars;
  surfaces: ThemeVars;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(hue: number) {
  const value = hue % 360;
  return value < 0 ? value + 360 : value;
}

function hexToHsl(hex: string) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
  }

  return {
    h: wrapHue(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(wrapHue(h))}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`;
}

function hsla(h: number, s: number, l: number, a: number) {
  return `hsla(${Math.round(wrapHue(h))}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%, ${a})`;
}

function createHarmonySwatches(baseHue: number, type: string, dark: boolean) {
  const configs: Record<string, number[]> = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    "split-complementary": [0, 150, 210],
    tetradic: [0, 90, 180, 270],
    monochromatic: [0, 0, 0, 0],
  };

  const offsets = configs[type] ?? configs.complementary;

  return offsets.map((offset, index) => {
    const hue = wrapHue(baseHue + offset);
    const saturation = type === "monochromatic"
      ? clamp(28 + index * 12, 22, 72)
      : clamp(44 + (index % 2) * 10, 36, 72);
    const lightness = dark
      ? clamp(58 + (index % 2) * 8 - Math.floor(index / 2) * 3, 50, 76)
      : clamp(42 + (index % 2) * 8 - Math.floor(index / 2) * 2, 34, 64);

    return {
      hue,
      color: hsl(hue, saturation, lightness),
    };
  });
}

function buildThemeVars(
  baseHue: number,
  type: string,
  dark: boolean,
  saturationBias: number,
  lightnessBias: number
): ThemeResult {
  const swatches = createHarmonySwatches(baseHue, type, dark);
  const accentHue = swatches[0]?.hue ?? baseHue;
  const secondaryHue = swatches[1]?.hue ?? wrapHue(baseHue + 30);
  const tertiaryHue = swatches[2]?.hue ?? wrapHue(baseHue - 28);

  const accentSat = clamp((dark ? 52 : 46) + saturationBias, 18, 78);
  const accentHoverSat = clamp((dark ? 56 : 50) + saturationBias, 20, 82);
  const accentLight = clamp((dark ? 62 : 34) + lightnessBias, dark ? 36 : 20, dark ? 82 : 56);
  const accentHoverLight = clamp((dark ? 70 : 44) + lightnessBias, dark ? 42 : 24, dark ? 90 : 66);

  const accent = hsl(accentHue, accentSat, accentLight);
  const accentHover = hsl(accentHue, accentHoverSat, accentHoverLight);
  const accentSoft = dark
    ? hsl(secondaryHue, clamp(20 + saturationBias * 0.4, 8, 32), clamp(20 + lightnessBias * 0.4, 10, 30))
    : hsl(secondaryHue, clamp(20 + saturationBias * 0.4, 8, 34), clamp(88 + lightnessBias * 0.4, 76, 96));
  const onAccent = dark ? hsl(accentHue, 10, 8) : hsl(40, 20, 99);

  const canvas = dark
    ? hsl(baseHue, clamp(8 + saturationBias * 0.15, 2, 18), clamp(8 + lightnessBias, 4, 22))
    : hsl(baseHue, clamp(18 + saturationBias * 0.2, 6, 28), clamp(96 + lightnessBias, 86, 99));
  const surface = dark
    ? hsl(baseHue, clamp(8 + saturationBias * 0.12, 2, 16), clamp(11 + lightnessBias, 6, 24))
    : hsl(baseHue, clamp(14 + saturationBias * 0.18, 6, 24), clamp(93 + lightnessBias, 82, 98));
  const surfaceMuted = dark
    ? hsl(secondaryHue, clamp(8 + saturationBias * 0.16, 2, 18), clamp(16 + lightnessBias, 8, 28))
    : hsl(secondaryHue, clamp(14 + saturationBias * 0.2, 6, 26), clamp(88 + lightnessBias, 76, 96));
  const surfaceRaised = dark
    ? hsl(tertiaryHue, clamp(7 + saturationBias * 0.12, 2, 16), clamp(19 + lightnessBias, 10, 30))
    : hsl(tertiaryHue, clamp(16 + saturationBias * 0.18, 6, 26), clamp(99 + lightnessBias, 90, 100));

  const text = dark
    ? hsl(baseHue, clamp(12 + saturationBias * 0.12, 4, 22), clamp(88 + lightnessBias * 0.5, 72, 96))
    : hsl(baseHue, clamp(16 + saturationBias * 0.12, 4, 24), clamp(12 - lightnessBias * 0.4, 8, 24));
  const textMuted = dark
    ? hsl(baseHue, clamp(10 + saturationBias * 0.1, 4, 20), clamp(62 + lightnessBias * 0.45, 46, 78))
    : hsl(baseHue, clamp(10 + saturationBias * 0.1, 4, 20), clamp(42 - lightnessBias * 0.35, 28, 58));
  const textSubtle = dark
    ? hsl(baseHue, clamp(8 + saturationBias * 0.08, 2, 18), clamp(42 + lightnessBias * 0.4, 28, 62))
    : hsl(baseHue, clamp(8 + saturationBias * 0.08, 2, 18), clamp(62 - lightnessBias * 0.35, 42, 78));
  const border = dark
    ? hsla(baseHue, clamp(12 + saturationBias * 0.08, 2, 20), clamp(86 + lightnessBias * 0.3, 70, 96), 0.08)
    : hsla(baseHue, clamp(14 + saturationBias * 0.08, 2, 22), clamp(12 - lightnessBias * 0.2, 8, 20), 0.08);
  const borderStrong = dark
    ? hsla(baseHue, clamp(12 + saturationBias * 0.08, 2, 20), clamp(86 + lightnessBias * 0.3, 70, 96), 0.16)
    : hsla(baseHue, clamp(14 + saturationBias * 0.08, 2, 22), clamp(12 - lightnessBias * 0.2, 8, 20), 0.14);

  const successHue = wrapHue(baseHue + 110);
  const dangerHue = wrapHue(baseHue + 180);
  const warningHue = wrapHue(baseHue + 60);

  const successBg = dark
    ? hsl(successHue, clamp(20 + saturationBias * 0.25, 10, 34), clamp(14 + lightnessBias * 0.4, 8, 26))
    : hsl(successHue, clamp(28 + saturationBias * 0.25, 16, 46), clamp(92 + lightnessBias * 0.35, 82, 98));
  const successText = dark
    ? hsl(successHue, clamp(34 + saturationBias * 0.22, 18, 54), clamp(72 + lightnessBias * 0.35, 58, 86))
    : hsl(successHue, clamp(34 + saturationBias * 0.22, 18, 54), clamp(24 - lightnessBias * 0.2, 18, 34));
  const dangerBg = dark
    ? hsl(dangerHue, clamp(20 + saturationBias * 0.25, 10, 34), clamp(14 + lightnessBias * 0.4, 8, 26))
    : hsl(dangerHue, clamp(28 + saturationBias * 0.25, 16, 46), clamp(92 + lightnessBias * 0.35, 82, 98));
  const dangerText = dark
    ? hsl(dangerHue, clamp(34 + saturationBias * 0.22, 18, 54), clamp(72 + lightnessBias * 0.35, 58, 86))
    : hsl(dangerHue, clamp(34 + saturationBias * 0.22, 18, 54), clamp(24 - lightnessBias * 0.2, 18, 34));
  const warningBg = dark
    ? hsl(warningHue, clamp(20 + saturationBias * 0.25, 10, 34), clamp(14 + lightnessBias * 0.4, 8, 26))
    : hsl(warningHue, clamp(28 + saturationBias * 0.25, 16, 46), clamp(92 + lightnessBias * 0.35, 82, 98));
  const warningText = dark
    ? hsl(warningHue, clamp(34 + saturationBias * 0.22, 18, 54), clamp(72 + lightnessBias * 0.35, 58, 86))
    : hsl(warningHue, clamp(36 + saturationBias * 0.22, 18, 56), clamp(26 - lightnessBias * 0.2, 18, 36));

  return {
    swatches,
    accent: {
      "--accent": accent,
      "--accent-hover": accentHover,
      "--accent-soft": accentSoft,
      "--on-accent": onAccent,
      "--success-bg": successBg,
      "--success-text": successText,
      "--danger-bg": dangerBg,
      "--danger-text": dangerText,
      "--warning-bg": warningBg,
      "--warning-text": warningText,
    },
    surfaces: {
      "--canvas": canvas,
      "--surface": surface,
      "--surface-muted": surfaceMuted,
      "--surface-raised": surfaceRaised,
      "--text": text,
      "--text-muted": textMuted,
      "--text-subtle": textSubtle,
      "--border": border,
      "--border-strong": borderStrong,
    },
  };
}

export default function DastiShowcasePage() {
  const [radiusControl, setRadiusControl] = useState(6);
  const [radiusPanel, setRadiusPanel] = useState(12);
  const [radiusLarge, setRadiusLarge] = useState(18);
  const [radiusPill, setRadiusPill] = useState(999);
  const [dark, setDark] = useState(false);
  const [baseColor, setBaseColor] = useState("#3f8f74");
  const [paletteType, setPaletteType] = useState("analogous");
  const [themeMode, setThemeMode] = useState<ThemeMode>("global");
  const [globalHue, setGlobalHue] = useState(0);
  const [globalSaturation, setGlobalSaturation] = useState(0);
  const [globalLightness, setGlobalLightness] = useState(0);
  const [selectedPairId, setSelectedPairId] = useState("cormorant-source");

  const fontPairs: FontPair[] = [
    {
      id: "fraunces-syne",
      label: "Fraunces Bold / Syne Regular",
      headingFamily: '"Fraunces", serif',
      bodyFamily: '"Syne", system-ui, sans-serif',
      headingWeight: 700,
      bodyWeight: 400,
      editorialFamily: '"Fraunces", serif',
      editorialWeight: 700,
    },
    {
      id: "cormorant-source",
      label: "Cormorant Bold / Source Sans Regular",
      headingFamily: '"Cormorant Garamond", serif',
      bodyFamily: '"Source Sans 3", system-ui, sans-serif',
      headingWeight: 700,
      bodyWeight: 400,
      editorialFamily: '"Cormorant Garamond", serif',
      editorialWeight: 700,
    },
    {
      id: "brico-source",
      label: "Bricolage Grotesque / Source Sans",
      headingFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      bodyFamily: '"Source Sans 3", system-ui, sans-serif',
      headingWeight: 700,
      bodyWeight: 400,
      editorialFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      editorialWeight: 700,
    },
    {
      id: "fraunces-source-serif",
      label: "Fraunces / Source Serif",
      headingFamily: '"Fraunces", serif',
      bodyFamily: '"Source Serif 4", serif',
      headingWeight: 600,
      bodyWeight: 400,
      editorialFamily: '"Fraunces", serif',
      editorialWeight: 600,
    },
  ];

  const paletteOptions: PaletteOption[] = [
    { id: "complementary", label: "Complementary" },
    { id: "analogous", label: "Analogous" },
    { id: "triadic", label: "Triadic" },
    { id: "split-complementary", label: "Split-complementary" },
    { id: "tetradic", label: "Tetradic" },
    { id: "monochromatic", label: "Monochromatic" },
  ];

  const modeOptions: ModeOption[] = [
    {
      id: "accent-only",
      label: "Accent only",
      description: "Accent, hover, semantic feedback, and action colors update. Surfaces and text stay stable.",
    },
    {
      id: "surfaces-text",
      label: "Surface / text",
      description: "Canvas, surface, borders, and text colors update. Accent stays stable.",
    },
    {
      id: "global",
      label: "Global",
      description: "All color roles update together from the same palette engine.",
    },
  ];

  const selectedPair = useMemo(
    () => fontPairs.find((pair) => pair.id === selectedPairId) ?? fontPairs[0],
    [fontPairs, selectedPairId]
  );

  const baseHsl = useMemo(() => hexToHsl(baseColor), [baseColor]);
  const effectiveHue = useMemo(() => wrapHue(baseHsl.h + globalHue), [baseHsl.h, globalHue]);
  const theme = useMemo(
    () => buildThemeVars(effectiveHue, paletteType, dark, globalSaturation, globalLightness),
    [dark, effectiveHue, globalLightness, globalSaturation, paletteType]
  );

  const activeThemeVars = useMemo<ThemeVars>(() => {
    if (themeMode === "accent-only") return theme.accent;
    if (themeMode === "surfaces-text") return theme.surfaces;
    return { ...theme.surfaces, ...theme.accent };
  }, [theme, themeMode]);

  const radiusVars = useMemo<ThemeVars>(
  () => ({
    "--radius-sm": `${radiusControl}px`,
    "--radius-md": `${radiusPanel}px`,
    "--radius-lg": `${radiusLarge}px`,
    "--radius-pill": `${radiusPill}px`,

    "--radius-inline": `${Math.max(6, radiusControl)}px`,
    "--radius-item": `${Math.max(8, Math.min(radiusPanel, 12))}px`,
    "--radius-card": `${Math.max(14, Math.max(radiusPanel, 16))}px`,
    "--radius-surface": `${Math.max(radiusLarge, 18)}px`,
    "--radius-input-pillish": `${Math.min(24, Math.max(16, radiusPanel * 2))}px`,
  }),
  [radiusControl, radiusPanel, radiusLarge, radiusPill]
);

  const exportThemeCss = useMemo(() => {
    const entries = Object.entries({ ...activeThemeVars, ...radiusVars })
      .filter(([key, value]) => key.startsWith("--") && typeof value === "string")
      .sort(([a], [b]) => a.localeCompare(b));

    const lines = [
      "/* DASTI exported theme */",
      `/* mode: ${themeMode} */`,
      `/* palette: ${paletteType} */`,
      `/* base-color: ${baseColor.toUpperCase()} */`,
      `/* appearance: ${dark ? "dark" : "light"} */`,
      `/* hsl-adjust: hue ${globalHue}, saturation ${globalSaturation}, lightness ${globalLightness} */`,
      `/* radius-control: ${radiusControl}px */`,
      `/* radius-panel: ${radiusPanel}px */`,
      `/* radius-large: ${radiusLarge}px */`,
      `/* radius-pill: ${radiusPill}px */`,
      ":root {",
      ...entries.map(([key, value]) => `  ${key}: ${value};`),
      "}",
    ];

    return lines.join("\n");
  }, [
    activeThemeVars,
    baseColor,
    dark,
    globalHue,
    globalLightness,
    globalSaturation,
    paletteType,
    radiusControl,
    radiusLarge,
    radiusPanel,
    radiusPill,
    radiusVars,
    themeMode,
  ]);

  const handleCopyThemeCss = async () => {
    try {
      await navigator.clipboard.writeText(exportThemeCss);
    } catch (error) {
      console.error("Failed to copy theme CSS", error);
    }
  };

  const handleDownloadThemeCss = () => {
    const blob = new Blob([exportThemeCss], { type: "text/css;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dasti-theme-${themeMode}-${paletteType}-${dark ? "dark" : "light"}.css`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const spacing = [
    { name: "space-micro", value: "4px · optical only", width: 14, category: "exception" },
    { name: "space-1", value: "8px", width: 28, category: "core" },
    { name: "space-tight", value: "12px · dense UI only", width: 42, category: "exception" },
    { name: "space-2", value: "16px", width: 58, category: "core" },
    { name: "space-3", value: "24px", width: 86, category: "core" },
    { name: "space-4", value: "32px", width: 114, category: "core" },
    { name: "space-5", value: "48px", width: 156, category: "core" },
    { name: "space-6", value: "64px", width: 198, category: "core" },
  ];

  const surfaces = [
    { label: "Canvas", token: "--canvas", value: "var(--canvas)" },
    { label: "Surface", token: "--surface", value: "var(--surface)" },
    { label: "Surface muted", token: "--surface-muted", value: "var(--surface-muted)" },
    { label: "Surface raised", token: "--surface-raised", value: "var(--surface-raised)" },
    { label: "Text", token: "--text", value: "var(--text)" },
    { label: "Accent", token: "--accent", value: "var(--accent)" },
  ];

  const typeScale = [
    { name: "text-sm", size: "14px", line: "20px", sample: "Small body / helper / secondary UI" },
    { name: "text-base", size: "16px", line: "24px", sample: "Body default / cards / forms" },
    { name: "text-lg", size: "20px", line: "24px", sample: "Section title / compact heading" },
    { name: "text-xl", size: "24px", line: "32px", sample: "Editorial exception" },
    { name: "text-2xl", size: "32px", line: "40px", sample: "Display / modal heading" },
  ];

  const rules = [
    "No invented spacing values.",
    "Layout comes from container, stack, cluster, and grid.",
    "Cards use padding 16 or 24 only.",
    "Buttons use height 40 or 44 only.",
    "4px and 12px are controlled exceptions, not general spacing.",
    "Theme mode decides whether accent roles, surface/text roles, or all roles update.",
  ];

  const cards = [
    {
      title: "Locked card",
      eyebrow: "Rule",
      copy:
        "Cards only use shared spacing bands, shared radii, shared elevations, and centralized color roles. The goal is to remove accidental differences before they appear in product UI.",
      meta: "padding 16 or 24 · gap 16",
    },
    {
      title: "Primitive layout",
      eyebrow: "Composition",
      copy:
        "New screens should be composed from primitives, not one-off wrappers. Semantic sections may exist, but they do not invent new spacing or color logic.",
      meta: "container / stack / cluster / grid",
    },
    {
      title: "Mode-aware palette",
      eyebrow: "Palette",
      copy:
        "You can now decide whether palette changes affect only accent roles, only surfaces and text, or the whole theme at once. Semantic tones update with the selected mode.",
      meta: modeOptions.find((option) => option.id === themeMode)?.label ?? themeMode,
    },
  ];

  return (
    <div
      className={dark ? "theme-dark" : "theme-light"}
      style={{
        minHeight: "100vh",
        background: "var(--canvas)",
        color: "var(--text)",
        fontFamily: selectedPair.bodyFamily,
        ...activeThemeVars,
        ...radiusVars,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Syne:wght@400;700&family=Cormorant+Garamond:wght@600;700&family=Bricolage+Grotesque:wght@400;700&family=Source+Serif+4:wght@400;600&display=swap');

        :root {
          --space-micro: 4px;
          --space-1: 8px;
          --space-tight: 12px;
          --space-2: 16px;
          --space-3: 24px;
          --space-4: 32px;
          --space-5: 48px;
          --space-6: 64px;

          --text-sm: 14px;
          --text-base: 16px;
          --text-lg: 20px;
          --text-xl: 24px;
          --text-2xl: 32px;

          --lh-sm: 1.43;
          --lh-md: 1.5;
          --lh-lg: 1.2;
          --lh-xl: 1.25;
          --lh-ui-tight: 1.15;
          --lh-ui-compact: 1.2;
          --lh-heading-display: 1.1;

          --pad-optical-adjust: 2px;
          --pad-optical-16-top: calc(var(--space-2) + var(--pad-optical-adjust));
          --pad-optical-16-x: var(--space-2);
          --pad-optical-16-bottom: var(--space-2);

          --pad-optical-24-top: calc(var(--space-3) + var(--pad-optical-adjust));
          --pad-optical-24-x: var(--space-3);
          --pad-optical-24-bottom: var(--space-3);

          --radius-sm: 6px;
          --radius-md: 12px;
          --radius-lg: 18px;
          --radius-pill: 999px;

          --radius-inline: 8px;
          --radius-item: 12px;
          --radius-card: 16px;
          --radius-surface: var(--radius-lg);
          --radius-input-pillish: 24px;

          --control-md: 40px;
          --control-pill-sm: 30px;

          --font-ui-family: "Source Sans 3", system-ui, sans-serif;
          --font-ui-weight: 600;

          --duration-fast: 120ms;
          --ease-standard: cubic-bezier(.25,.1,.25,1);
          --shadow-sm: 0 1px 2px hsla(30,20%,8%,.05), 0 3px 10px hsla(30,20%,8%,.04);
          --shadow-md: 0 4px 14px hsla(30,20%,8%,.07), 0 10px 28px hsla(30,20%,8%,.05);

          --accent: hsl(155,22%,30%);
          --accent-hover: hsl(155,24%,44%);
          --accent-soft: hsl(155,18%,88%);
          --on-accent: hsl(40,20%,99%);
          --canvas: hsl(38,16%,95%);
          --surface: hsl(38,12%,93%);
          --surface-muted: hsl(36,14%,88%);
          --surface-raised: hsl(40,20%,99%);
          --text: hsl(30,12%,11%);
          --text-muted: hsl(30,8%,42%);
          --text-subtle: hsl(30,6%,62%);
          --border: hsla(30,12%,11%,.08);
          --border-strong: hsla(30,12%,11%,.13);
          --success-bg: hsl(152,16%,92%);
          --success-text: hsl(152,20%,22%);
          --danger-bg: hsl(4,22%,92%);
          --danger-text: hsl(4,26%,28%);
          --warning-bg: hsl(34,30%,92%);
          --warning-text: hsl(34,36%,26%);
          --container: 1180px;
        }

        .theme-light { color-scheme: light; }

        .theme-dark {
          color-scheme: dark;
          --canvas: hsl(80,5%,7%);
          --surface: hsl(80,5%,11%);
          --surface-muted: hsl(78,5%,16%);
          --surface-raised: hsl(75,5%,19%);
          --text: hsl(46,12%,86%);
          --text-muted: hsl(44,8%,60%);
          --text-subtle: hsl(42,6%,38%);
          --border: hsla(46,12%,86%,.08);
          --border-strong: hsla(46,12%,86%,.13);
          --success-bg: hsl(152,13%,13%);
          --success-text: hsl(152,22%,70%);
          --danger-bg: hsl(4,15%,13%);
          --danger-text: hsl(4,24%,70%);
          --warning-bg: hsl(36,13%,13%);
          --warning-text: hsl(36,26%,72%);
          --shadow-sm: 0 1px 3px hsla(0,0%,0%,.28), 0 4px 12px hsla(0,0%,0%,.22);
          --shadow-md: 0 4px 16px hsla(0,0%,0%,.36), 0 12px 30px hsla(0,0%,0%,.28);
        }

        * { box-sizing: border-box; }
        body { margin: 0; }

        .container {
          width: min(var(--container), calc(100vw - 64px));
          margin-inline: auto;
          padding: var(--space-4);
        }

        .layout-main {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          gap: var(--space-4);
          align-items: start;
        }

        .stack, .stack-sm, .stack-md, .stack-lg, .stack-xl {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .stack { gap: var(--space-3); }
        .stack-sm { gap: var(--space-2); }
        .stack-md { gap: var(--space-3); }
        .stack-lg { gap: var(--space-4); }
        .stack-xl { gap: var(--space-6); }

        .cluster, .cluster-sm, .cluster-lg {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }

        .cluster { gap: var(--space-2); }
        .cluster-sm { gap: var(--space-1); }
        .cluster-lg { gap: var(--space-3); }

        .grid, .grid-2, .grid-3, .grid-auto {
          display: grid;
          min-width: 0;
          gap: var(--space-3);
        }

        .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-auto { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }

        .surface {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-surface);
          box-shadow: var(--shadow-sm);
        }

        .optical-pad-16 {
          padding: var(--pad-optical-16-top) var(--pad-optical-16-x) var(--pad-optical-16-bottom);
        }

        .optical-pad-24 {
          padding: var(--pad-optical-24-top) var(--pad-optical-24-x) var(--pad-optical-24-bottom);
        }

        .sidebar-panel {
          position: sticky;
          top: var(--space-4);
        }

        .hero-layout {
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: var(--space-4);
          align-items: stretch;
        }

        .eyebrow {
          margin: 0;
          font-size: var(--text-sm);
          line-height: var(--lh-ui-tight);
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-hover);
          font-family: var(--font-ui-family);
        }

        .display {
          margin: 0;
          font-family: var(--font-heading-family, inherit);
          font-size: clamp(34px, 4.5vw, 48px);
          line-height: var(--lh-heading-display);
          font-weight: var(--font-heading-weight, 700);
          letter-spacing: -0.02em;
          max-width: 12ch;
          color: var(--text);
        }

        .section-title {
          margin: 0;
          font-family: var(--font-heading-family, inherit);
          font-size: var(--text-2xl);
          line-height: 1.12;
          font-weight: var(--font-heading-weight, 700);
          letter-spacing: -0.015em;
          color: var(--text);
        }

        .lead, .body-copy {
          margin: 0;
          font-size: var(--text-base);
          line-height: var(--lh-md);
          color: var(--text-muted);
          font-family: var(--font-body-family, inherit);
          font-weight: var(--font-body-weight, 400);
        }

        .support-copy {
          margin: 0;
          font-size: var(--text-sm);
          line-height: var(--lh-sm);
          color: var(--text-muted);
          max-width: 58ch;
          font-family: var(--font-body-family, inherit);
          font-weight: var(--font-body-weight, 400);
        }

        .mini-card-copy, .card-copy {
          margin: 0;
          font-size: var(--text-sm);
          line-height: var(--lh-sm);
          color: var(--text-muted);
          max-width: 58ch;
          font-family: var(--font-body-family, inherit);
          font-weight: var(--font-body-weight, 400);
        }

        .button {
          height: var(--control-md);
          padding-inline: calc(var(--space-2) + 2px);
          border-radius: var(--radius-inline);
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          line-height: var(--lh-ui-tight);
          font-weight: var(--font-ui-weight);
          font-family: var(--font-ui-family);
          cursor: pointer;
          transition:
            transform var(--duration-fast) var(--ease-standard),
            background var(--duration-fast) var(--ease-standard),
            color var(--duration-fast) var(--ease-standard),
            border-color var(--duration-fast) var(--ease-standard);
        }

        .button:hover { transform: translateY(-1px); }
        .button-primary { background: var(--accent); color: var(--on-accent); }
        .button-primary:hover { background: var(--accent-hover); }
        .button-secondary { background: var(--surface-raised); color: var(--text); border-color: var(--border-strong); }
        .button-secondary:hover { background: var(--surface-muted); }
        .button-ghost { background: transparent; color: var(--text); border-color: var(--border); }
        .button-ghost:hover { background: var(--surface-muted); }

        .theme-switch {
          min-height: var(--control-md);
          padding: 6px 10px 6px 8px;
          border-radius: var(--radius-input-pillish);
          border: 1px solid var(--border);
          background: var(--surface-raised);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          font-family: var(--font-ui-family);
          transition:
            background var(--duration-fast) var(--ease-standard),
            border-color var(--duration-fast) var(--ease-standard),
            transform var(--duration-fast) var(--ease-standard);
        }

        .theme-switch:hover {
          background: var(--surface-muted);
          transform: translateY(-1px);
        }

        .theme-switch-track {
          width: 38px;
          height: 22px;
          border-radius: var(--radius-input-pillish);
          background: var(--surface);
          border: 1px solid var(--border);
          position: relative;
          flex-shrink: 0;
        }

        .theme-switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: var(--radius-pill);
          background: var(--accent);
          transition: transform var(--duration-fast) var(--ease-standard);
        }

        .theme-dark .theme-switch-thumb { transform: translateX(16px); }

        .theme-switch-label, .control-label {
          font-size: var(--text-sm);
          line-height: var(--lh-ui-tight);
          font-weight: var(--font-ui-weight);
          color: var(--text-muted);
          font-family: var(--font-ui-family);
        }

        .font-select, .palette-select {
          height: var(--control-md);
          width: 100%;
          padding: 0 calc(var(--space-2) + 2px);
          border-radius: var(--radius-inline);
          border: 1px solid var(--border-strong);
          background: var(--surface-raised);
          color: var(--text);
          font-family: var(--font-ui-family);
          font-size: var(--text-sm);
          line-height: var(--lh-ui-tight);
          font-weight: 400;
          box-shadow: var(--shadow-sm);
          outline: none;
        }

        .color-input-row {
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: var(--space-2);
          align-items: center;
        }

        .color-picker {
          width: 52px;
          height: 40px;
          padding: 0;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-inline);
          background: var(--surface-raised);
          cursor: pointer;
        }

        .pill {
          min-height: var(--control-pill-sm);
          padding: 5px 10px 4px;
          border-radius: var(--radius-pill);
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          line-height: 1.1;
          color: var(--text-muted);
          background: var(--surface);
          border: 1px solid var(--border);
          font-family: var(--font-ui-family);
          font-weight: 600;
        }

        .preview-shell {
          background: linear-gradient(180deg, var(--surface), color-mix(in srgb, var(--surface-raised) 72%, var(--surface)));
        }

        .preview-window, .token-card, .mini-card, .palette-preview-card {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
        }

        .mini-card, .token-card, .palette-preview-card { box-shadow: var(--shadow-sm); }

        .mini-card-title, .card-title {
          margin: 0;
          font-family: var(--font-heading-family, inherit);
          font-size: var(--text-lg);
          line-height: var(--lh-lg);
          font-weight: var(--font-heading-weight, 700);
          letter-spacing: -0.008em;
          color: var(--text);
        }

        .card {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-sm);
          transition:
            transform var(--duration-fast) var(--ease-standard),
            border-color var(--duration-fast) var(--ease-standard),
            box-shadow var(--duration-fast) var(--ease-standard);
        }

        .card:hover {
          transform: translateY(-2px);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-md);
        }

        .card-eyebrow, .token-name, .token-value, .sample-meta, .card-meta {
          margin: 0;
          font-size: var(--text-sm);
          line-height: var(--lh-ui-compact);
          color: var(--text-subtle);
          font-family: var(--font-ui-family);
        }

        .card-eyebrow {
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-hover);
          font-weight: 700;
        }

        .token-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: var(--space-2);
          align-items: center;
          min-width: 0;
        }

        .token-swatch {
          width: 100%;
          height: 44px;
          border-radius: var(--radius-inline);
          border: 1px solid var(--border);
        }

        .space-bar {
          height: 14px;
          border-radius: var(--radius-pill);
          background: var(--accent);
          opacity: 0.92;
        }

        .type-sample {
          display: grid;
          gap: 2px;
          padding-block: var(--space-2);
          border-top: 1px solid var(--border);
        }

        .type-sample:first-child {
          border-top: 0;
          padding-top: 0;
        }

        .sample-line {
          margin: 0;
          color: var(--text);
        }

        .status {
          border-radius: var(--radius-inline);
          padding: 10px var(--space-3) 8px;
          font-size: var(--text-sm);
          line-height: var(--lh-ui-tight);
          font-weight: 600;
          font-family: var(--font-ui-family);
        }

        .status-ok { background: var(--success-bg); color: var(--success-text); }
        .status-er { background: var(--danger-bg); color: var(--danger-text); }
        .status-wa { background: var(--warning-bg); color: var(--warning-text); }

        .note {
          padding-left: var(--space-2);
          border-left: 2px solid var(--accent-soft);
        }

        .palette-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: var(--space-2);
        }

        .palette-button, .mode-button {
          border: 1px solid var(--border);
          background: var(--surface-raised);
          border-radius: var(--radius-item);
          padding: var(--space-1) var(--space-2);
          display: grid;
          gap: 10px;
          cursor: pointer;
          transition:
            border-color var(--duration-fast) var(--ease-standard),
            transform var(--duration-fast) var(--ease-standard),
            box-shadow var(--duration-fast) var(--ease-standard);
        }

        .palette-button:hover, .mode-button:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
        }

        .palette-button.active, .mode-button.active {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
        }

        .palette-swatch-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-micro);
        }

        .palette-swatch {
          height: 24px;
          border-radius: var(--radius-inline);
          border: 1px solid hsla(0,0%,100%,0.18);
        }

        .palette-button-label {
          margin: 0;
          color: var(--text-muted);
          font-family: var(--font-ui-family);
          font-size: 12px;
          line-height: var(--lh-ui-compact);
          font-weight: 600;
          text-align: left;
        }

        .slider-grid { display: grid; gap: var(--space-2); }

        .slider-row {
          display: grid;
          grid-template-columns: 54px 1fr 48px;
          gap: var(--space-2);
          align-items: center;
        }

        .slider-input {
          width: 100%;
          accent-color: var(--accent);
        }

        .slider-value {
          margin: 0;
          text-align: right;
          color: var(--text-subtle);
          font-family: var(--font-ui-family);
          font-size: 12px;
          line-height: var(--lh-ui-compact);
          font-weight: 600;
        }

        .slider-help {
          margin: 0;
          color: var(--text-subtle);
          font-family: var(--font-ui-family);
          font-size: 12px;
          line-height: var(--lh-ui-compact);
        }

        .radius-group {
          border: 1px solid var(--border);
          border-radius: var(--radius-item);
          background: var(--surface);
          padding: var(--space-tight);
        }

        .export-preview {
          width: 100%;
          min-height: 160px;
          padding: var(--pad-optical-16-top) var(--pad-optical-16-x) var(--pad-optical-16-bottom);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          background: var(--surface);
          color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          line-height: 1.33;
          resize: vertical;
        }

        @media (max-width: 1080px) {
          .layout-main { grid-template-columns: 1fr; }
          .sidebar-panel { position: static; }
        }

        @media (max-width: 980px) {
          .container {
            width: min(var(--container), calc(100vw - 32px));
            padding: var(--space-3);
          }

          .hero-layout, .grid-3, .grid-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <main
        className="container"
        style={{
          "--font-heading-family": selectedPair.headingFamily,
          "--font-body-family": selectedPair.bodyFamily,
          "--font-heading-weight": String(selectedPair.headingWeight),
          "--font-body-weight": String(selectedPair.bodyWeight),
          "--font-editorial-family": selectedPair.editorialFamily,
          "--font-editorial-weight": String(selectedPair.editorialWeight),
        } as React.CSSProperties}
      >
        <div className="layout-main">
          <aside className="surface sidebar-panel optical-pad-24 stack-md">
            <div className="stack-sm">
              <p className="eyebrow">Theme controls</p>
              <h2 className="section-title">Palette generator</h2>
              <p className="support-copy">Pick a base color, choose a harmony model, then decide whether the palette should update accent roles only, surface and text roles, or the whole theme.</p>
            </div>

            <div className="stack-sm">
              <label htmlFor="base-color" className="control-label">Base color</label>
              <div className="color-input-row">
                <input id="base-color" type="color" className="color-picker" value={baseColor} onChange={(event) => setBaseColor(event.target.value)} aria-label="Choose base color" />
                <div className="mini-card optical-pad-16 stack-sm">
                  <p className="mini-card-title">Selected base</p>
                  <p className="mini-card-copy">{baseColor.toUpperCase()} · H{Math.round(baseHsl.h)}°</p>
                </div>
              </div>
            </div>

            <div className="stack-sm">
              <label htmlFor="palette-type" className="control-label">Palette type</label>
              <select id="palette-type" className="palette-select" value={paletteType} onChange={(event) => setPaletteType(event.target.value)}>
                {paletteOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="stack-sm">
              <p className="control-label">Theme mode</p>
              <div className="stack-sm">
                {modeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mode-button${themeMode === option.id ? " active" : ""}`}
                    onClick={() => setThemeMode(option.id)}
                    aria-pressed={themeMode === option.id}
                  >
                    <p className="mini-card-title">{option.label}</p>
                    <p className="mini-card-copy">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="stack-sm">
              <p className="control-label">Global HSL adjustment</p>
              <div className="mini-card optical-pad-16 stack-sm">
                <div className="slider-grid">
                  <div className="slider-row">
                    <label htmlFor="hue-shift" className="control-label">Hue</label>
                    <input id="hue-shift" className="slider-input" type="range" min={-180} max={180} step={1} value={globalHue} onChange={(event) => setGlobalHue(Number(event.target.value))} />
                    <p className="slider-value">{globalHue}</p>
                  </div>
                  <div className="slider-row">
                    <label htmlFor="sat-shift" className="control-label">Sat</label>
                    <input id="sat-shift" className="slider-input" type="range" min={-30} max={30} step={1} value={globalSaturation} onChange={(event) => setGlobalSaturation(Number(event.target.value))} />
                    <p className="slider-value">{globalSaturation}</p>
                  </div>
                  <div className="slider-row">
                    <label htmlFor="light-shift" className="control-label">Light</label>
                    <input id="light-shift" className="slider-input" type="range" min={-20} max={20} step={1} value={globalLightness} onChange={(event) => setGlobalLightness(Number(event.target.value))} />
                    <p className="slider-value">{globalLightness}</p>
                  </div>
                </div>
                <div className="cluster">
                  <button type="button" className="button button-secondary" onClick={() => { setGlobalHue(0); setGlobalSaturation(0); setGlobalLightness(0); }}>
                    Reset sliders
                  </button>
                </div>
              </div>
            </div>

            <div className="stack-sm">
              <p className="control-label">Radius groups</p>
              <div className="mini-card optical-pad-16 stack-sm">
                <div className="radius-group stack-sm">
                  <p className="mini-card-title">Control radius</p>
                  <p className="slider-help">Buttons, selects, color picker, token swatches, status blocks.</p>
                  <div className="slider-row">
                    <label htmlFor="radius-control" className="control-label">Control</label>
                    <input id="radius-control" className="slider-input" type="range" min={0} max={24} step={1} value={radiusControl} onChange={(event) => setRadiusControl(Number(event.target.value))} />
                    <p className="slider-value">{radiusControl}px</p>
                  </div>
                </div>
                <div className="radius-group stack-sm">
                  <p className="mini-card-title">Panel radius</p>
                  <p className="slider-help">Cards, token cards, preview windows, mode buttons, palette buttons, export panel.</p>
                  <div className="slider-row">
                    <label htmlFor="radius-panel" className="control-label">Panel</label>
                    <input id="radius-panel" className="slider-input" type="range" min={0} max={32} step={1} value={radiusPanel} onChange={(event) => setRadiusPanel(Number(event.target.value))} />
                    <p className="slider-value">{radiusPanel}px</p>
                  </div>
                </div>
                <div className="radius-group stack-sm">
                  <p className="mini-card-title">Large surface radius</p>
                  <p className="slider-help">Main surfaces like the sidebar shell, hero surfaces, and large sections.</p>
                  <div className="slider-row">
                    <label htmlFor="radius-large" className="control-label">Large</label>
                    <input id="radius-large" className="slider-input" type="range" min={0} max={40} step={1} value={radiusLarge} onChange={(event) => setRadiusLarge(Number(event.target.value))} />
                    <p className="slider-value">{radiusLarge}px</p>
                  </div>
                </div>
                <div className="radius-group stack-sm">
                  <p className="mini-card-title">Pill radius</p>
                  <p className="slider-help">Pills, toggle track, and intentionally fully rounded controls.</p>
                  <div className="slider-row">
                    <label htmlFor="radius-pill" className="control-label">Pill</label>
                    <input id="radius-pill" className="slider-input" type="range" min={16} max={999} step={1} value={radiusPill} onChange={(event) => setRadiusPill(Number(event.target.value))} />
                    <p className="slider-value">{radiusPill}px</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="stack-sm">
              <p className="control-label">Palette previews</p>
              <div className="palette-grid">
                {paletteOptions.map((option) => {
                  const preview = createHarmonySwatches(effectiveHue, option.id, dark);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`palette-button${paletteType === option.id ? " active" : ""}`}
                      onClick={() => setPaletteType(option.id)}
                      aria-pressed={paletteType === option.id}
                    >
                      <div className="palette-swatch-row">
                        {preview.slice(0, 4).map((swatch, index) => (
                          <span key={`${option.id}-${index}`} className="palette-swatch" style={{ background: swatch.color }} />
                        ))}
                      </div>
                      <p className="palette-button-label">{option.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="stack-sm">
              <p className="control-label">Export current theme</p>
              <div className="mini-card optical-pad-16 stack-sm">
                <div className="cluster">
                  <button type="button" className="button button-secondary" onClick={handleCopyThemeCss}>Copy CSS</button>
                  <button type="button" className="button button-ghost" onClick={handleDownloadThemeCss}>Download .css</button>
                </div>
                <textarea className="export-preview" value={exportThemeCss} readOnly aria-label="Exported theme CSS" />
              </div>
            </div>

            <div className="stack-sm">
              <label htmlFor="font-pair-select" className="control-label">Typography pair</label>
              <select id="font-pair-select" className="font-select" value={selectedPairId} onChange={(event) => setSelectedPairId(event.target.value)} aria-label="Select typography pair">
                {fontPairs.map((pair) => (
                  <option key={pair.id} value={pair.id}>{pair.label}</option>
                ))}
              </select>
            </div>

            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <span className="theme-switch-label">Mode</span>
              <button type="button" className="theme-switch" onClick={() => setDark((value) => !value)} aria-pressed={dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
                <span className="theme-switch-track" aria-hidden="true"><span className="theme-switch-thumb" /></span>
                <span className="theme-switch-label">{dark ? "Dark" : "Light"}</span>
              </button>
            </div>
          </aside>

          <div className="stack-xl">
            <section className="hero-layout">
              <div className="surface optical-pad-24 stack-lg">
                <div className="stack-md">
                  <p className="eyebrow">DASTI / dynamic palette system</p>
                  <h1 className="display">One engine can update accent, surfaces, or the full theme.</h1>
                  <p className="lead">The palette system is now mode-aware. You can recolor only accent roles, only surfaces and text roles, or everything at once. Semantic feedback tones follow the active mode instead of staying frozen.</p>
                </div>
                <div className="cluster">
                  <button className="button button-primary">Primary action</button>
                  <button className="button button-secondary">Secondary action</button>
                </div>
                <div className="grid-3">
                  <div className="status status-ok">Success tone</div>
                  <div className="status status-er">Danger tone</div>
                  <div className="status status-wa">Warning tone</div>
                </div>
              </div>

              <div className="surface preview-shell optical-pad-24 stack-md">
                <div className="preview-window optical-pad-16 stack-md">
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <div className="cluster-sm">
                      <span className="pill">{paletteOptions.find((option) => option.id === paletteType)?.label}</span>
                      <span className="pill">{modeOptions.find((option) => option.id === themeMode)?.label}</span>
                    </div>
                    <span className="pill">{selectedPair.label}</span>
                  </div>
                  <div className="grid-2">
                    <div className="mini-card optical-pad-16 stack-sm">
                      <p className="mini-card-title">Theme mode</p>
                      <p className="mini-card-copy">{modeOptions.find((option) => option.id === themeMode)?.description}</p>
                    </div>
                    <div className="mini-card optical-pad-16 stack-sm">
                      <p className="mini-card-title">Semantic tones</p>
                      <p className="mini-card-copy">Success, danger, and warning now update from the generated palette whenever accent roles are in scope.</p>
                    </div>
                    <div className="mini-card optical-pad-16 stack-sm">
                      <p className="mini-card-title">Surface tuning</p>
                      <p className="mini-card-copy">Canvas, surface, border, and text roles can now be adjusted separately from the accent system.</p>
                    </div>
                    <div className="mini-card optical-pad-16 stack-sm">
                      <p className="mini-card-title">Global HSL</p>
                      <p className="mini-card-copy">Hue, saturation, and lightness sliders let you stress-test the full theme without changing component code.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="stack-lg">
              <div className="cluster-lg" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
                <div className="stack-sm">
                  <p className="eyebrow">Generated palette</p>
                  <h2 className="section-title">Harmony preview</h2>
                </div>
                <p className="support-copy">These swatches are generated from the selected harmony model and adjusted by the global HSL sliders. They feed the centralized theme roles instead of styling components directly.</p>
              </div>
              <div className="grid-auto">
                {theme.swatches.map((swatch, index) => (
                  <div key={`${paletteType}-${index}`} className="palette-preview-card optical-pad-16 stack-sm">
                    <div className="token-swatch" style={{ background: swatch.color }} />
                    <p className="mini-card-title">Swatch {index + 1}</p>
                    <p className="mini-card-copy">{swatch.color}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="stack-lg">
              <div className="cluster-lg" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
                <div className="stack-sm">
                  <p className="eyebrow">Component rules</p>
                  <h2 className="section-title">Locked examples</h2>
                </div>
                <p className="support-copy">The structure remains locked. Only role tokens move. That is what makes the palette system useful without making the system fragile.</p>
              </div>
              <div className="grid-3">
                {cards.map((card) => (
                  <article className="card optical-pad-24 stack-sm" key={card.title}>
                    <p className="card-eyebrow">{card.eyebrow}</p>
                    <h3 className="card-title">{card.title}</h3>
                    <p className="card-copy">{card.copy}</p>
                    <p className="card-meta">{card.meta}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="stack-lg">
              <div className="cluster-lg" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
                <div className="stack-sm">
                  <p className="eyebrow">Foundation validator</p>
                  <h2 className="section-title">Tokens and rhythm</h2>
                </div>
                <p className="support-copy">Typography can change at the pairing level, color can change at the palette and theme-mode level, but the structure stays stable because spacing, primitives, and component rules remain locked.</p>
              </div>
              <div className="grid-3">
                <div className="token-card optical-pad-16 stack-md">
                  <h3 className="card-title">Spacing</h3>
                  <div className="stack-sm">
                    {spacing.map((item) => (
                      <div className="token-row" key={item.name}>
                        <span className="token-name">{item.name}</span>
                        <div className="space-bar" style={{ width: `${item.width}px`, opacity: item.category === "exception" ? 0.55 : 0.92 }} />
                        <span className="token-value">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="token-card optical-pad-16 stack-md">
                  <h3 className="card-title">Color roles</h3>
                  <div className="stack-md">
                    {surfaces.map((item) => (
                      <div key={item.token} className="stack-sm">
                        <div className="token-swatch" style={{ background: item.value }} />
                        <div className="token-row">
                          <span className="token-name">{item.label}</span>
                          <div />
                          <span className="token-value">{item.token}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="token-card optical-pad-16 stack-md">
                  <h3 className="card-title">Type lock</h3>
                  <div>
                    {typeScale.map((item) => (
                      <div className="type-sample" key={item.name}>
                        <p
                          className="sample-line"
                          style={{
                            fontSize: item.size,
                            lineHeight: item.line,
                            fontFamily: item.name === "text-xl" || item.name === "text-2xl" ? "var(--font-editorial-family)" : "var(--font-body-family)",
                            fontWeight: item.name === "text-xl" || item.name === "text-2xl" ? "var(--font-editorial-weight)" : "var(--font-body-weight)",
                            letterSpacing: item.name === "text-xl" || item.name === "text-2xl" ? "-0.01em" : "0",
                          }}
                        >
                          {item.sample}
                        </p>
                        <p className="sample-meta">{item.name} · {item.size} / {item.line}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="surface optical-pad-24 stack-md">
              <p className="eyebrow">System test</p>
              <div className="note stack-sm">
                <h3 className="card-title" style={{ fontSize: "var(--text-xl)", lineHeight: "1.18" }}>
                  Can one palette engine recolor accent roles, surface roles, or the full product independently?
                </h3>
                <p className="body-copy">If the answer is yes, the color system is starting to behave like a real product foundation. Components stop owning colors directly and start consuming centralized, mode-aware roles.</p>
              </div>
              <div className="grid-2">
                {rules.map((rule) => (
                  <div key={rule} className="mini-card optical-pad-16 stack-sm">
                    <p className="mini-card-title">Rule</p>
                    <p className="mini-card-copy">{rule}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
///////////
apply those fixes:What is still not fully perfect
1. radius-item is derived a little too aggressively

You currently have:

"--radius-item": `${Math.max(radiusControl, radiusPanel)}px`,

Since radiusPanel is usually larger, radius-item will usually just become radiusPanel.

That means your “item” tier is not really a distinct density tier anymore. It is effectively tied to panel radius.

A cleaner mapping would be:

"--radius-item": `${Math.max(8, Math.min(radiusPanel, 12))}px`,

or just keep it tied to panel only if that is intentional.

This is not wrong, just a bit loose semantically.

2. radius-surface can collapse too close to card

You have:

"--radius-surface": `${Math.max(radiusLarge, radiusPanel)}px`,

This is reasonable, but if radiusLarge drops, surface can become visually too close to card. Again, not broken, just not perfectly tiered.

3. palette-button / mode-button padding is acceptable, not fully optically tuned

This is now:

padding: var(--space-1) var(--space-2);

That is clean and disciplined. It may be slightly less optically tuned than an asymmetric dense pattern, but it is system-safe.

I would keep it unless visual testing shows the content sits too high.

Tiny cleanup I’d still suggest

If you want the last polish, use this radiusVars instead:

const radiusVars = useMemo<ThemeVars>(
  () => ({
    "--radius-sm": `${radiusControl}px`,
    "--radius-md": `${radiusPanel}px`,
    "--radius-lg": `${radiusLarge}px`,
    "--radius-pill": `${radiusPill}px`,

    "--radius-inline": `${Math.max(6, radiusControl)}px`,
    "--radius-item": `${Math.max(8, Math.min(radiusPanel, 12))}px`,
    "--radius-card": `${Math.max(14, Math.max(radiusPanel, 16))}px`,
    "--radius-surface": `${Math.max(radiusLarge, 18)}px`,
    "--radius-input-pillish": `${Math.min(24, Math.max(16, radiusPanel * 2))}px`,
  }),
  [radiusControl, radiusPanel, radiusLarge, radiusPill]
);

That keeps the tiers more distinct.