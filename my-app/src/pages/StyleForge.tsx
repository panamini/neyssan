import React from "react";
import { Check } from "lucide-react";

type LayoutTemplate = "swiss" | "two-column" | "editorial";
type TypographyStyle = "signature" | "engaging" | "expert";
type PaletteKey = "sauge" | "ocre" | "pierre" | "bordeaux" | "encre";

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
    titleStyle: { fontFamily: '"Fraunces", serif', fontSize: 18, fontWeight: 600, letterSpacing: "-.02em" },
    descriptionStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: "var(--tx)", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" },
  },
  {
    id: "engaging",
    name: "Engaging",
    description: "Warm and literary.",
    titleStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" },
    descriptionStyle: { fontFamily: '"Source Sans 3", sans-serif', fontSize: "var(--tx)", fontWeight: 400, lineHeight: 1.5 },
  },
  {
    id: "expert",
    name: "Expert",
    description: "Precise and technical.",
    titleStyle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, fontWeight: 500, letterSpacing: "-.01em" },
    descriptionStyle: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 300, lineHeight: 1.5 },
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

const sectionCardStyle: React.CSSProperties = {
  borderRadius: "var(--rl)",
  border: "1px solid var(--bo)",
  background: "var(--sfr)",
  boxShadow: "var(--sha)",
  overflow: "hidden",
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

const previewFrameStyle: React.CSSProperties = {
  borderRadius: "var(--rl)",
  border: "1px solid var(--bo)",
  background: "hsl(38,8%,78%)",
  padding: "var(--s4)",
  boxShadow: "var(--sha)",
};

const previewPaperBaseStyle: React.CSSProperties = {
  borderRadius: 2,
  border: "1px solid hsla(0,0%,0%,.06)",
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

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "var(--rp)",
        background: active ? "var(--ac)" : "transparent",
        border: active ? "1px solid var(--ac)" : "1px solid var(--bo)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--op)",
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
  const [layoutTemplate, setLayoutTemplate] = React.useState<LayoutTemplate>("swiss");
  const [typographyStyle, setTypographyStyle] = React.useState<TypographyStyle>("signature");
  const [palette, setPalette] = React.useState<PaletteKey>("sauge");

  const activePalette = paletteOptions.find((option) => option.id === palette) ?? paletteOptions[0];
  const previewTypography = React.useMemo(
    () => getPreviewTypography(typographyStyle, activePalette.accent),
    [typographyStyle, activePalette.accent],
  );

  const renderPreviewSection = React.useCallback(
    (section: typeof sampleSections[number], variant: "default" | "compact" = "default") => {
      const spacing = variant === "compact" ? 10 : 12;
      const titleStyle =
        typographyStyle === "expert"
          ? {
              ...previewTypography.sectionTitle,
              paddingLeft: 6,
              borderLeft: `2px solid ${activePalette.accent}`,
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
    [activePalette.accent, previewTypography, typographyStyle],
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
              background: activePalette.accent,
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
              background: activePalette.accent,
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
        <div style={{ height: 12, background: activePalette.accent }} />
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
  }, [activePalette.accent, layoutTemplate, previewTypography, renderPreviewSection, typographyStyle]);

  const letterPreview = React.useMemo(() => {
    const leadAccent =
      layoutTemplate === "editorial"
        ? { borderTop: `12px solid ${activePalette.accent}` }
        : layoutTemplate === "two-column"
          ? { borderLeft: `10px solid ${activePalette.accent}` }
          : { borderTop: `8px solid ${activePalette.accent}` };

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
  }, [activePalette.accent, layoutTemplate, previewTypography, typographyStyle]);

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
          padding: "var(--s8) var(--s7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s6)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
            gap: "var(--s7)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s5)" }}>
            <section style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>Layout</div>
              <div style={sectionBodyStyle}>
                {layoutOptions.map((option) => {
                  const active = option.id === layoutTemplate;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLayoutTemplate(option.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 1fr auto",
                        alignItems: "center",
                        gap: "var(--s3)",
                        padding: "var(--s3)",
                        borderRadius: "var(--rm)",
                        border: active ? "1px solid var(--ac)" : "1px solid var(--bo)",
                        background: active ? "var(--as)" : "var(--sfr)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all .12s var(--ez)",
                      }}
                    >
                      <div
                        style={{
                          height: 48,
                          borderRadius: "var(--rs)",
                          border: "1px solid var(--bo)",
                          background: "var(--sfr)",
                          padding: 5,
                          display: "flex",
                          flexDirection: option.id === "two-column" ? "row" : "column",
                          gap: 3,
                        }}
                      >
                        {option.id === "two-column" ? (
                          <>
                            <div style={{ width: "36%", borderRadius: "var(--rx)", background: activePalette.accent, opacity: 0.45 }} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                              <div style={{ height: 2, borderRadius: 2, background: "var(--bm)" }} />
                              <div style={{ height: 2, width: "65%", borderRadius: 2, background: "var(--bm)" }} />
                              <div style={{ height: 2, width: "80%", borderRadius: 2, background: "var(--bm)" }} />
                            </div>
                          </>
                        ) : option.id === "editorial" ? (
                          <>
                            <div style={{ height: "26%", borderRadius: "var(--rx)", background: activePalette.accent, opacity: 0.45 }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                              <div style={{ height: 2, borderRadius: 2, background: "var(--bm)" }} />
                              <div style={{ height: 2, width: "60%", borderRadius: 2, background: "var(--bm)" }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ height: 6, borderRadius: 2, background: activePalette.accent }} />
                            <div style={{ height: 2, width: "52%", borderRadius: 2, background: "var(--bm)" }} />
                            <div style={{ height: 2, width: "78%", borderRadius: 2, background: "var(--bm)" }} />
                          </>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)" }}>{option.name}</div>
                        <div style={{ fontSize: "var(--tx)", color: "var(--tm2)", marginTop: 3 }}>{option.description}</div>
                      </div>
                      <SelectionCheck active={active} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>Typography</div>
              <div style={sectionBodyStyle}>
                {typographyOptions.map((option) => {
                  const active = option.id === typographyStyle;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTypographyStyle(option.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        gap: "var(--s3)",
                        padding: "var(--s3)",
                        borderRadius: "var(--rm)",
                        border: active ? "1px solid var(--ac)" : "1px solid var(--bo)",
                        background: active ? "var(--as)" : "var(--sfr)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all .12s var(--ez)",
                      }}
                    >
                      <div>
                        <div style={{ ...option.titleStyle, color: "var(--ti)" }}>{option.name}</div>
                        <div style={{ ...option.descriptionStyle, color: "var(--tm2)", marginTop: 3 }}>{option.description}</div>
                      </div>
                      <SelectionCheck active={active} />
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>Colors</div>
              <div style={sectionBodyStyle}>
                <div
                  style={{
                    fontSize: "var(--tx)",
                    fontWeight: 500,
                    color: "var(--tg2)",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    textAlign: "center",
                  }}
                >
                  {activePalette.name}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--s3)" }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: "var(--s3)" }}>
                    {paletteOptions.slice(0, 3).map((option) => {
                      const active = option.id === palette;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPalette(option.id)}
                          title={option.name}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "var(--rp)",
                            border: active ? "2px solid var(--sfr)" : "1px solid transparent",
                            background: option.accent,
                            cursor: "pointer",
                            boxShadow: active ? `0 0 0 4px ${activePalette.accent}` : "none",
                            transition: "transform .12s var(--ezb), box-shadow .12s var(--ez)",
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "var(--s3)" }}>
                    {paletteOptions.slice(3).map((option) => {
                      const active = option.id === palette;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPalette(option.id)}
                          title={option.name}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "var(--rp)",
                            border: active ? "2px solid var(--sfr)" : "1px solid transparent",
                            background: option.accent,
                            cursor: "pointer",
                            boxShadow: active ? `0 0 0 4px ${activePalette.accent}` : "none",
                            transition: "transform .12s var(--ezb), box-shadow .12s var(--ez)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <p style={{ fontSize: "var(--tx)", color: "var(--tg2)", lineHeight: "var(--ls)" }}>
              PDF export — coming soon
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s6)", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "var(--tx)", fontWeight: 600, color: "var(--am)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: "var(--s3)" }}>
                CV Preview
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
