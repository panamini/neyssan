import React from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

type LayoutTemplate = "swiss" | "two-column" | "editorial";
type TypographyStyle = "signature" | "engaging" | "expert";
type PaletteKey = "sauge" | "ocre" | "pierre" | "bordeaux" | "encre";
type PaletteChoice = PaletteKey | "custom";

const layoutOptions: Array<{
  id: LayoutTemplate;
  name: string;
  description: string;
}> = [
  { id: "swiss", name: "Swiss Minima", description: "Single column" },
  { id: "two-column", name: "Two Column", description: "Accent sidebar" },
  { id: "editorial", name: "Editorial", description: "Wide topband" },
];

const typographyOptions: Array<{
  id: TypographyStyle;
  name: string;
  description: string;
  titleStyle: React.CSSProperties;
  descriptionStyle: React.CSSProperties;
}> = [
  {
    id: "signature",
    name: "Signature",
    description: "Calm and clear.",
    titleStyle: { fontFamily: '"Fraunces", serif', fontSize: 18, lineHeight: "var(--ls)", fontWeight: 600, letterSpacing: "-.02em" },
    descriptionStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: "var(--tx)", lineHeight: "var(--lx)", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" },
  },
  {
    id: "engaging",
    name: "Engaging",
    description: "Warm and literary.",
    titleStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 17, lineHeight: "var(--ls)", fontWeight: 600, letterSpacing: "-.01em" },
    descriptionStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: "var(--tx)", fontWeight: 400, lineHeight: "var(--lx)" },
  },
  {
    id: "expert",
    name: "Expert",
    description: "Precise and technical.",
    titleStyle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, lineHeight: "var(--lx)", fontWeight: 500, letterSpacing: "-.01em" },
    descriptionStyle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 300, lineHeight: "var(--lx)" },
  },
];

const paletteOptions: Array<{
  id: PaletteKey;
  name: string;
  accent: string;
}> = [
  { id: "sauge", name: "Sage", accent: "hsl(155,22%,30%)" },
  { id: "ocre", name: "Ochre", accent: "hsl(34,38%,36%)" },
  { id: "pierre", name: "Stone", accent: "hsl(220,14%,34%)" },
  { id: "bordeaux", name: "Bordeaux", accent: "hsl(348,22%,34%)" },
  { id: "encre", name: "Ink", accent: "hsl(200,18%,28%)" },
];
const PALETTE_SWATCH_SIZE = 20;
const PALETTE_RING_RADIUS = 32;
const PALETTE_HEX_CENTER = PALETTE_RING_RADIUS + PALETTE_SWATCH_SIZE / 2;
const PALETTE_HEX_SIZE = PALETTE_HEX_CENTER * 2;
const paletteHexPoints: Array<{ id: PaletteChoice; angle: number }> = [
  { id: "sauge", angle: -90 },
  { id: "ocre", angle: -30 },
  { id: "pierre", angle: 30 },
  { id: "custom", angle: 90 },
  { id: "bordeaux", angle: 150 },
  { id: "encre", angle: 210 },
];

const sectionCardStyle: React.CSSProperties = {
  overflow: "hidden",
};

const floatingSectionCardStyle: React.CSSProperties = {
  ...sectionCardStyle,
  overflow: "visible",
  position: "relative",
  zIndex: 2,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "var(--s4) var(--s5) 0",
  fontFamily: '"Fraunces", serif',
  fontSize: "var(--tm)",
  fontWeight: 600,
  letterSpacing: "-.01em",
  color: "var(--ti)",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: "var(--s4) var(--s5) var(--s5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s3)",
};

// Optical spacing here is intentionally local: Layout, Typography, and Colors
// use different type scales, so one global title/subtitle gap reads unevenly.

const previewFrameStyle: React.CSSProperties = {
  borderRadius: "var(--rl)",
  border: "1px solid var(--bo)",
  background: "hsl(38,8%,78%)",
  padding: "var(--s4)",
  boxShadow: "var(--sha)",
};

const previewPaperBaseStyle: React.CSSProperties = {
  borderRadius: 2,
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "hsla(0,0%,0%,.06)",
  borderRightWidth: 1,
  borderRightStyle: "solid",
  borderRightColor: "hsla(0,0%,0%,.06)",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "hsla(0,0%,0%,.06)",
  borderLeftWidth: 1,
  borderLeftStyle: "solid",
  borderLeftColor: "hsla(0,0%,0%,.06)",
  boxShadow: "var(--shb)",
  overflow: "hidden",
  minHeight: 360,
  position: "relative",
  isolation: "isolate",
};

const sampleSections = [
  {
    label: "Profile",
    body: "Talent professional specialising in electrical control systems and calm cross-functional delivery.",
  },
  {
    label: "Experience",
    title: "Production Supervisor",
    meta: "Lakshmi Electrical · 2020–2024",
    body: "Managed wire harness assembly for automotive OEMs and improved production consistency across shifts.",
  },
  {
    label: "Skills",
    body: "Lean manufacturing, electrical systems, QA handoff, team coordination.",
  },
];

const COLOR_WHEEL_SIZE = 112;
const COLOR_WHEEL_RADIUS = COLOR_WHEEL_SIZE / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function componentToHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const v = clamp(value, 0, 1);
  const chroma = v * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (segment >= 0 && segment < 1) {
    r = chroma;
    g = x;
  } else if (segment < 2) {
    r = x;
    g = chroma;
  } else if (segment < 3) {
    g = chroma;
    b = x;
  } else if (segment < 4) {
    g = x;
    b = chroma;
  } else if (segment < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const match = v - chroma;
  return `#${componentToHex((r + match) * 255)}${componentToHex((g + match) * 255)}${componentToHex((b + match) * 255)}`.toLowerCase();
}

function hsvToRgb(hue: number, saturation: number, value: number) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const v = clamp(value, 0, 1);
  const chroma = v * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (segment >= 0 && segment < 1) {
    r = chroma;
    g = x;
  } else if (segment < 2) {
    r = x;
    g = chroma;
  } else if (segment < 3) {
    g = chroma;
    b = x;
  } else if (segment < 4) {
    g = x;
    b = chroma;
  } else if (segment < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const match = v - chroma;
  return {
    r: Math.round((r + match) * 255),
    g: Math.round((g + match) * 255),
    b: Math.round((b + match) * 255),
  };
}

function hexToRgb(hex: string) {
  const normalized = String(hex ?? "").trim().replace("#", "");
  const safeHex = normalized.length === 6 ? normalized : "7a7870";
  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16),
  };
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) hue += 360;

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function getColorFromWheelPoint(x: number, y: number) {
  const dx = x - COLOR_WHEEL_RADIUS;
  const dy = y - COLOR_WHEEL_RADIUS;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > COLOR_WHEEL_RADIUS) return null;

  const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const saturation = clamp(distance / COLOR_WHEEL_RADIUS, 0, 1);
  return hsvToHex(hue, saturation, 1);
}

function getWheelHandlePosition(hex: string) {
  const { h, s } = hexToHsv(hex);
  const angle = (h * Math.PI) / 180;
  const radius = COLOR_WHEEL_RADIUS * s;

  return {
    left: COLOR_WHEEL_RADIUS + Math.cos(angle) * radius,
    top: COLOR_WHEEL_RADIUS + Math.sin(angle) * radius,
  };
}

function paintColorWheel(canvas: HTMLCanvasElement) {
  const dpr = typeof window === "undefined" ? 1 : Math.max(window.devicePixelRatio || 1, 1);
  const size = COLOR_WHEEL_SIZE;
  const pixelSize = Math.round(size * dpr);
  const radius = pixelSize / 2;

  canvas.width = pixelSize;
  canvas.height = pixelSize;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const context = canvas.getContext("2d");
  if (!context) return;

  const image = context.createImageData(pixelSize, pixelSize);
  const data = image.data;

  for (let y = 0; y < pixelSize; y += 1) {
    for (let x = 0; x < pixelSize; x += 1) {
      const dx = x + 0.5 - radius;
      const dy = y + 0.5 - radius;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const offset = (y * pixelSize + x) * 4;

      if (distance > radius) {
        data[offset + 3] = 0;
        continue;
      }

      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const saturation = clamp(distance / radius, 0, 1);
      const { r, g, b } = hsvToRgb(hue, saturation, 1);

      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }

  context.clearRect(0, 0, pixelSize, pixelSize);
  context.putImageData(image, 0, 0);
}

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "var(--rp)",
        background: active ? "var(--ti)" : "transparent",
        border: active ? "1px solid var(--ti)" : "1px solid var(--bo)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--bg)" : "var(--ti)",
        flexShrink: 0,
      }}
    >
      {active ? <Check size={10} strokeWidth={2.4} /> : null}
    </div>
  );
}

function getPreviewTypography(style: TypographyStyle, accent: string) {
  const ink = "#1a1916";
  const muted = "#7a7870";
  const meta = "#9a9890";
  const body = "#3a3832";
  const onAccent = "hsl(40,20%,99%)";
  const onAccentMuted = "hsla(40,20%,99%,.74)";

  if (style === "engaging") {
    return {
      paperBackground: "#ffffff",
      name: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 20, fontWeight: 650, letterSpacing: "-.02em", lineHeight: 1.08, color: ink },
      role: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 11, fontWeight: 500, fontStyle: "italic", lineHeight: 1.5, color: muted },
      meta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, color: muted },
      sectionTitle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 12, fontWeight: 650, lineHeight: 1.3, letterSpacing: ".04em", textTransform: "uppercase" as const, color: accent },
      body: { fontFamily: '"Fraunces", serif', fontSize: 12, lineHeight: 1.82, fontWeight: 300, color: body },
      itemTitle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 12.5, lineHeight: 1.35, fontWeight: 650, color: ink },
      itemMeta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, fontWeight: 400, color: meta },
      sidebarName: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 14, fontWeight: 650, lineHeight: 1.15, color: onAccent },
      sidebarRole: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 9.5, fontWeight: 500, lineHeight: 1.4, color: onAccentMuted },
      headerName: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 18, fontWeight: 650, letterSpacing: "-.02em", color: onAccent },
      headerRole: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 9.5, fontWeight: 500, lineHeight: 1.4, color: onAccentMuted },
      letterMeta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, color: meta },
      letterBody: { fontFamily: '"Fraunces", serif', fontSize: 13, lineHeight: 1.92, fontWeight: 300, color: "#2e2c28" },
      letterSignature: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 15, fontWeight: 650, letterSpacing: ".01em", color: ink },
    };
  }

  if (style === "expert") {
    return {
      paperBackground: "#ffffff",
      name: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: ink },
      role: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, fontWeight: 400, letterSpacing: ".07em", textTransform: "uppercase" as const, lineHeight: 1.55, color: muted },
      meta: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, color: meta },
      sectionTitle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase" as const, lineHeight: 1.4, color: accent },
      body: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, lineHeight: 1.7, fontWeight: 300, color: body },
      itemTitle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, lineHeight: 1.45, fontWeight: 500, color: ink },
      itemMeta: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, color: meta },
      sidebarName: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 500, lineHeight: 1.3, color: onAccent },
      sidebarRole: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 8.5, fontWeight: 400, letterSpacing: ".08em", textTransform: "uppercase" as const, lineHeight: 1.45, color: onAccentMuted },
      headerName: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 500, letterSpacing: ".04em", color: onAccent },
      headerRole: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 8.5, fontWeight: 400, letterSpacing: ".08em", textTransform: "uppercase" as const, lineHeight: 1.45, color: onAccentMuted },
      letterMeta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, color: meta },
      letterBody: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, lineHeight: 1.75, fontWeight: 300, color: "#2e2c28" },
      letterSignature: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 500, color: ink },
    };
  }

  return {
    paperBackground: "#ffffff",
    name: { fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.12, color: ink },
    role: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: ".09em", textTransform: "uppercase" as const, lineHeight: 1.45, color: accent },
    meta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, color: muted },
    sectionTitle: { fontFamily: '"Fraunces", serif', fontSize: 12, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.35, color: accent },
    body: { fontFamily: '"Source Serif 4", serif', fontSize: 11.5, lineHeight: 1.72, color: body },
    itemTitle: { fontFamily: '"Fraunces", serif', fontSize: 11.5, lineHeight: 1.38, fontWeight: 600, color: ink },
    itemMeta: { fontFamily: '"Source Serif 4", serif', fontSize: 10, color: meta },
    sidebarName: { fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.18, color: onAccent },
    sidebarRole: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const, lineHeight: 1.35, color: onAccentMuted },
    headerName: { fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 600, letterSpacing: "-.02em", color: onAccent },
    headerRole: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" as const, lineHeight: 1.35, color: onAccentMuted },
    letterMeta: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 10, color: meta },
    letterBody: { fontFamily: '"Source Serif 4", serif', fontSize: 12.75, lineHeight: 1.78, color: "#2e2c28" },
    letterSignature: { fontFamily: '"Fraunces", serif', fontSize: 16, fontWeight: 600, letterSpacing: "-.02em", color: ink },
  };
}

export function StyleForge(): JSX.Element {
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [layoutTemplate, setLayoutTemplate] = React.useState<LayoutTemplate>("swiss");
  const [typographyStyle, setTypographyStyle] = React.useState<TypographyStyle>("signature");
  const [palette, setPalette] = React.useState<PaletteChoice>("sauge");
  const [customAccent, setCustomAccent] = React.useState<string>("#7a7870");
  const [isCustomPickerOpen, setIsCustomPickerOpen] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const wheelRef = React.useRef<HTMLDivElement | null>(null);
  const wheelCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const draggingWheelRef = React.useRef(false);

  const activePalette = paletteOptions.find((option) => option.id === palette);
  const activeAccent = activePalette?.accent ?? customAccent;
  const activePaletteLabel = activePalette?.name.toLowerCase() ?? customAccent.toLowerCase();
  const isCompactStyleLayout = viewportWidth < 1180;
  const wheelHandle = React.useMemo(() => getWheelHandlePosition(customAccent), [customAccent]);
  const pickerAnchor = isCustomPickerOpen && pickerRef.current
    ? pickerRef.current.getBoundingClientRect()
    : null;
  const previewTypography = React.useMemo(
    () => getPreviewTypography(typographyStyle, activeAccent),
    [typographyStyle, activeAccent],
  );

  const updateCustomAccentFromPoint = React.useCallback((clientX: number, clientY: number) => {
    const wheelRect = wheelRef.current?.getBoundingClientRect();
    if (!wheelRect) return;

    const nextColor = getColorFromWheelPoint(clientX - wheelRect.left, clientY - wheelRect.top);
    if (!nextColor) return;

    setCustomAccent(nextColor);
    setPalette("custom");
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!isCustomPickerOpen) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingWheelRef.current) return;
      updateCustomAccentFromPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      draggingWheelRef.current = false;
    };

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (pickerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsCustomPickerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCustomPickerOpen(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointerdown", handlePointerDownOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointerdown", handlePointerDownOutside);
      window.removeEventListener("keydown", handleEscape);
      draggingWheelRef.current = false;
    };
  }, [isCustomPickerOpen, updateCustomAccentFromPoint]);

  React.useEffect(() => {
    if (!isCustomPickerOpen || !wheelCanvasRef.current) return;
    paintColorWheel(wheelCanvasRef.current);
  }, [isCustomPickerOpen]);

  const swatchBaseStyle: React.CSSProperties = React.useMemo(
    () => ({
      width: PALETTE_SWATCH_SIZE,
      height: PALETTE_SWATCH_SIZE,
      borderRadius: "var(--rp)",
      boxSizing: "border-box",
      transition: "transform .12s var(--ezb), box-shadow .12s var(--ez), background .12s var(--ez)",
    }),
    [],
  );

  const renderPreviewSection = React.useCallback(
    (section: typeof sampleSections[number], variant: "default" | "compact" = "default") => {
      const spacing = variant === "compact" ? 10 : 12;
      const titleStyle =
        typographyStyle === "expert"
          ? {
              ...previewTypography.sectionTitle,
              paddingLeft: 6,
              borderLeftWidth: 2,
              borderLeftStyle: "solid" as const,
              borderLeftColor: activeAccent,
            }
          : previewTypography.sectionTitle;

      return (
        <div key={section.label} style={{ display: "grid", gap: 4 }}>
          <div style={titleStyle}>{section.label}</div>
          {section.title ? <div style={previewTypography.itemTitle}>{section.title}</div> : null}
          {section.meta ? <div style={{ ...previewTypography.itemMeta, marginBottom: 1 }}>{section.meta}</div> : null}
          <div style={{ ...previewTypography.body, marginTop: section.title ? 1 : 0 }}>{section.body}</div>
          <div style={{ height: spacing === 10 ? 0 : 0 }} />
        </div>
      );
    },
    [activeAccent, previewTypography, typographyStyle],
  );

  const cvPreview = React.useMemo(() => {
    if (layoutTemplate === "two-column") {
      return (
        <div
          style={{
            ...previewPaperBaseStyle,
            background: previewTypography.paperBackground,
            display: "grid",
            gridTemplateColumns: "132px 1fr",
          }}
        >
          <div
            style={{
              background: activeAccent,
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <div style={previewTypography.sidebarName}>Board Ramanathapuram</div>
              <div style={{ ...previewTypography.sidebarRole, marginTop: 4 }}>Production Supervisor · EEE Engineer</div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div
                style={{
                  fontFamily: '"Source Sans 3", sans-serif',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "hsla(40,20%,99%,.62)",
                }}
              >
                Contact
              </div>
              <div
                style={{
                  fontFamily: '"Source Sans 3", sans-serif',
                  fontSize: 10,
                  lineHeight: 1.6,
                  color: "hsla(40,20%,99%,.88)",
                }}
              >
                kaviyarajan@live.com
                <br />
                +91 9894
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "18px 22px",
              background: previewTypography.paperBackground,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {sampleSections.map((section) => renderPreviewSection(section, "compact"))}
          </div>
        </div>
      );
    }

    if (layoutTemplate === "editorial") {
      return (
        <div
          style={{
            ...previewPaperBaseStyle,
            background: previewTypography.paperBackground,
          }}
        >
          <div
            style={{
              background: activeAccent,
              padding: "18px 26px",
            }}
          >
            <div style={previewTypography.headerName}>Board Ramanathapuram</div>
            <div style={{ ...previewTypography.headerRole, marginTop: 4 }}>Production Supervisor · EEE Engineer</div>
          </div>
          <div
            style={{
              padding: "18px 26px 20px",
              background: previewTypography.paperBackground,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {sampleSections.map((section) => renderPreviewSection(section, "compact"))}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          ...previewPaperBaseStyle,
          background: previewTypography.paperBackground,
        }}
      >
        <div style={{ height: 12, background: activeAccent }} />
        <div
          style={{
            padding: typographyStyle === "expert" ? "24px 28px" : "28px 32px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={previewTypography.name}>Board Ramanathapuram</div>
          <div style={{ ...previewTypography.role, marginTop: 2, marginBottom: 12 }}>Production Supervisor · EEE Engineer</div>
          <div
            style={{
              ...previewTypography.meta,
              display: "flex",
              gap: 12,
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: "1px solid #e8e5e0",
            }}
          >
            <span>kaviyarajan@live.com</span>
            <span>+91 9894</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sampleSections.map((section) => renderPreviewSection(section))}
          </div>
        </div>
      </div>
    );
  }, [activeAccent, layoutTemplate, previewTypography, renderPreviewSection, typographyStyle]);

  const letterPreview = React.useMemo(() => {
    const leadAccent =
      layoutTemplate === "editorial"
        ? {
            borderTopWidth: 12,
            borderTopStyle: "solid" as const,
            borderTopColor: activeAccent,
          }
        : layoutTemplate === "two-column"
          ? {
              borderLeftWidth: 10,
              borderLeftStyle: "solid" as const,
              borderLeftColor: activeAccent,
            }
          : {
              borderTopWidth: 8,
              borderTopStyle: "solid" as const,
              borderTopColor: activeAccent,
            };

    return (
      <div
        style={{
          ...previewPaperBaseStyle,
          ...leadAccent,
          minHeight: 260,
          background: previewTypography.paperBackground,
          padding: typographyStyle === "expert" ? "24px 28px" : "28px 32px",
        }}
      >
        <div style={{ ...previewTypography.letterMeta, marginBottom: 14 }}>Cover letter · 18/03/2026</div>
        <div style={{ ...previewTypography.letterBody, marginBottom: 12 }}>Dear hiring team,</div>
        <div style={{ ...previewTypography.letterBody, marginBottom: 12 }}>
          I am writing to show how the selected style changes hierarchy, rhythm, and tone while keeping the same proposal content intact.
        </div>
        <div style={{ ...previewTypography.letterBody, marginBottom: 12 }}>
          The preview now follows the chosen document voice and the selected layout more closely, especially for name treatment, section rhythm, and accent placement.
        </div>
        <div style={{ ...previewTypography.letterBody, marginBottom: 0 }}>Kind regards,</div>
        <div style={{ ...previewTypography.letterSignature, marginTop: 14 }}>Board Ramanathapuram</div>
      </div>
    );
  }, [activeAccent, layoutTemplate, previewTypography, typographyStyle]);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        background: "var(--bg)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "var(--space-page-pad)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-page-stack)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompactStyleLayout
              ? "minmax(0, 1fr)"
              : "minmax(260px, 320px) minmax(0, 1fr)",
            gap: "var(--space-split-gap-wide)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-panel-stack)" }}>
            <section className="dasti-surface-panel" style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>Layout</div>
              <div style={sectionBodyStyle}>
                {layoutOptions.map((option) => {
                  const active = option.id === layoutTemplate;
                  const optionAccent = active ? "var(--tm2)" : "var(--bm)";
                  const previewSurface = active ? "var(--sf1)" : "var(--sfr)";
                  const previewLine = active ? "var(--tm2)" : "var(--bm)";
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLayoutTemplate(option.id)}
                      className={active ? "dasti-selection-card dasti-selection-card--active" : "dasti-selection-card"}
                      style={{
                        gridTemplateColumns: "72px 1fr auto",
                      }}
                    >
                      <div
                        style={{
                          height: 48,
                          borderRadius: "var(--rs)",
                          border: active ? "1px solid var(--fr)" : "1px solid var(--bo)",
                          background: previewSurface,
                          padding: 5,
                          display: "flex",
                          flexDirection: option.id === "two-column" ? "row" : "column",
                          gap: 3,
                        }}
                      >
                        {option.id === "two-column" ? (
                          <>
                            <div style={{ width: "36%", borderRadius: "var(--rx)", background: optionAccent }} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                              <div style={{ height: 2, borderRadius: 2, background: previewLine }} />
                              <div style={{ height: 2, width: "65%", borderRadius: 2, background: previewLine }} />
                              <div style={{ height: 2, width: "80%", borderRadius: 2, background: previewLine }} />
                            </div>
                          </>
                        ) : option.id === "editorial" ? (
                          <>
                            <div style={{ height: "26%", borderRadius: "var(--rx)", background: optionAccent }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                              <div style={{ height: 2, borderRadius: 2, background: previewLine }} />
                              <div style={{ height: 2, width: "60%", borderRadius: 2, background: previewLine }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ height: 6, borderRadius: 2, background: optionAccent }} />
                            <div style={{ height: 2, width: "52%", borderRadius: 2, background: previewLine }} />
                            <div style={{ height: 2, width: "78%", borderRadius: 2, background: previewLine }} />
                          </>
                        )}
                      </div>
                      <div className="dasti-selection-card__stack">
                        <div className="dasti-selection-card__title">{option.name}</div>
                        <div className="dasti-selection-card__subtitle">{option.description}</div>
                      </div>
                      <SelectionCheck active={active} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="dasti-surface-panel" style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>Typography</div>
              <div style={sectionBodyStyle}>
                {typographyOptions.map((option) => {
                  const active = option.id === typographyStyle;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTypographyStyle(option.id)}
                      className={active ? "dasti-selection-card dasti-selection-card--active" : "dasti-selection-card"}
                      style={{
                        gridTemplateColumns: "1fr auto",
                      }}
                    >
                      <div className="dasti-selection-card__stack dasti-selection-card__stack--airy">
                        <div style={{ ...option.titleStyle, color: "var(--ti)" }}>{option.name}</div>
                        <div style={{ ...option.descriptionStyle, color: "var(--tm2)" }}>{option.description}</div>
                      </div>
                      <SelectionCheck active={active} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="dasti-surface-panel" style={floatingSectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>Colors</div>
                <div
                  style={{
                    fontFamily: '"Source Sans 3", sans-serif',
                    fontSize: "var(--tx)",
                    lineHeight: "var(--lx)",
                    fontWeight: 500,
                    color: "var(--tm2)",
                    letterSpacing: "0",
                    textTransform: "none",
                    marginTop: 0,
                  }}
                >
                  {activePaletteLabel}
                </div>
              </div>
              <div style={sectionBodyStyle}>
                <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <div
                    style={{
                      position: "relative",
                      width: PALETTE_HEX_SIZE,
                      height: PALETTE_HEX_SIZE,
                    }}
                  >
                    {paletteHexPoints.map((entry) => {
                      const angle = (entry.angle * Math.PI) / 180;
                      const left = PALETTE_HEX_CENTER + Math.cos(angle) * PALETTE_RING_RADIUS;
                      const top = PALETTE_HEX_CENTER + Math.sin(angle) * PALETTE_RING_RADIUS;

                      if (entry.id === "custom") {
                        return (
                          <div
                            key="custom"
                            ref={pickerRef}
                            style={{
                              position: "absolute",
                              left,
                              top,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <button
                              type="button"
                              title={palette === "custom" ? customAccent.toLowerCase() : "custom"}
                              className="styleforge-palette-swatch"
                              onClick={() => setIsCustomPickerOpen((open) => !open)}
                              style={{
                                ...swatchBaseStyle,
                                border: palette === "custom" ? "2px solid var(--sfr)" : "1px solid transparent",
                                background: palette === "custom" ? customAccent : "var(--sf2)",
                                boxShadow:
                                  palette === "custom"
                                    ? `0 0 0 4px ${customAccent}`
                                    : "none",
                              }}
                            />
                          </div>
                        );
                      }

                      const option = paletteOptions.find((paletteOption) => paletteOption.id === entry.id);
                      if (!option) return null;
                      const active = option.id === palette;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPalette(option.id)}
                          title={option.name}
                          className="styleforge-palette-swatch"
                          style={{
                            position: "absolute",
                            left,
                            top,
                            transform: "translate(-50%, -50%)",
                            ...swatchBaseStyle,
                            border: active ? "2px solid var(--sfr)" : "1px solid transparent",
                            background: option.accent,
                            boxShadow: active ? `0 0 0 4px ${option.accent}` : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
            {isCustomPickerOpen && pickerAnchor && typeof document !== "undefined"
              ? createPortal(
                  <div
                    ref={popoverRef}
                    className="styleforge-color-popover"
                    role="dialog"
                    aria-label="Custom color picker"
                    style={{
                      position: "fixed",
                      top: pickerAnchor.top,
                      left: pickerAnchor.left + pickerAnchor.width / 2,
                      transform: "translate(-50%, calc(-100% - var(--s3)))",
                      padding: "var(--s3)",
                      borderRadius: "var(--rl)",
                      border: "1px solid var(--bo)",
                      background: "var(--sfr)",
                      boxShadow: "var(--shc), inset 0 1px 0 var(--bm)",
                      backdropFilter: "blur(18px) saturate(1.08)",
                      WebkitBackdropFilter: "blur(18px) saturate(1.08)",
                      overflow: "visible",
                      isolation: "isolate",
                      zIndex: 240,
                    }}
                  >
                    <div
                      ref={wheelRef}
                      className="styleforge-color-wheel"
                      role="slider"
                      aria-label="Choose custom accent color"
                      aria-valuetext={customAccent.toLowerCase()}
                      tabIndex={0}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        draggingWheelRef.current = true;
                        event.currentTarget.focus();
                        updateCustomAccentFromPoint(event.clientX, event.clientY);
                      }}
                      onKeyDown={(event) => {
                        const current = hexToHsv(customAccent);
                        let nextHue = current.h;
                        let nextSaturation = current.s;

                        if (event.key === "ArrowLeft") nextHue = current.h - 6;
                        if (event.key === "ArrowRight") nextHue = current.h + 6;
                        if (event.key === "ArrowUp") nextSaturation = clamp(current.s + 0.05, 0, 1);
                        if (event.key === "ArrowDown") nextSaturation = clamp(current.s - 0.05, 0, 1);

                        if (nextHue !== current.h || nextSaturation !== current.s) {
                          event.preventDefault();
                          setCustomAccent(hsvToHex(nextHue, nextSaturation, 1));
                          setPalette("custom");
                        }
                      }}
                      style={{
                        position: "relative",
                        width: COLOR_WHEEL_SIZE,
                        height: COLOR_WHEEL_SIZE,
                        borderRadius: "50%",
                        border: "1px solid var(--bo)",
                        overflow: "hidden",
                        isolation: "isolate",
                        background: "var(--sfr)",
                        boxShadow: "inset 0 1px 0 var(--bm), var(--sha)",
                        outline: "none",
                      }}
                    >
                      <canvas
                        ref={wheelCanvasRef}
                        aria-hidden
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                        }}
                      />
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,.08)",
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: wheelHandle.left - 6,
                          top: wheelHandle.top - 6,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: customAccent,
                          border: "1.5px solid var(--sfr)",
                          boxShadow: "0 0 0 1px var(--bm), var(--sha)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>,
                  document.body,
                )
              : null}

            <p style={{ fontSize: "var(--tx)", color: "var(--tg2)", lineHeight: "var(--ls)" }}>
              PDF export — coming soon
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s6)", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "var(--tx)", fontWeight: 600, color: "var(--am)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: "var(--s3)" }}>
                Resume Preview
              </div>
              <div style={previewFrameStyle}>{cvPreview}</div>
            </div>

            <div>
              <div style={{ fontSize: "var(--tx)", fontWeight: 600, color: "var(--am)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: "var(--s3)" }}>
                Letter Preview
              </div>
              <div style={previewFrameStyle}>{letterPreview}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
