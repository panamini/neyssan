import React from "react";
import "./resume-preview.css";

import { resumeLayoutSpec } from "./resume-layout.spec";
import type { ResumeData, ResumeLayoutVariantId } from "./resume.types";
import { VOLK_REGISTER_GRID } from "../volkGrid";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../../../lib/document-stage";
import { normalizeResumePreviewTokens } from "../../../lib/layout/documentTokenNormalizer";
import {
  serializeActiveResumePreviewDecorVars,
  serializeResumePreviewVars,
} from "../../../lib/layout/documentTokenSerializers";
import type { VerbatiStylePreset } from "../types";

type ResumePageMode = "comparison" | "comparisonAll" | ResumeLayoutVariantId;

type ResumePageProps = {
  data: ResumeData;
  mode?: ResumePageMode;
  comparisonVariantIds?: ResumeLayoutVariantId[];
  stylePreset?: VerbatiStylePreset | null;
  fitToken?: string;
  onSelectVariantId?: ((variantId: ResumeLayoutVariantId) => void) | undefined;
  userZoom?: number;
  stageLayout?: DocumentStageLayout;
};

type ResumeVariant =
  (typeof resumeLayoutSpec.variants)[keyof typeof resumeLayoutSpec.variants];

type ResumeLabeledValue = {
  label: string;
  value: string;
};

type ContactItemView = ResumeData["contact"][number] & {
  compact?: boolean;
};

const COMPACT_COMPARISON_BREAKPOINT = 1040;
const PREVIEW_MONO_FAMILY =
  '"SFMono-Regular", "IBM Plex Mono", Menlo, monospace';

const ResumeUserZoomContext = React.createContext(1);
const ResumeStageLayoutContext =
  React.createContext<DocumentStageLayout | null>(null);
const ResumeStylePresetContext = React.createContext<VerbatiStylePreset | null>(
  null,
);

type ComparisonCardCopy = {
  typography: string;
  color: string;
};

function useCompactComparison(isComparison: boolean) {
  const [isCompact, setIsCompact] = React.useState(() => {
    if (!isComparison || typeof window === "undefined") {
      return false;
    }

    return window.innerWidth <= COMPACT_COMPARISON_BREAKPOINT;
  });

  React.useEffect(() => {
    if (!isComparison) {
      setIsCompact(false);
      return;
    }

    const query = window.matchMedia(
      `(max-width: ${COMPACT_COMPARISON_BREAKPOINT}px)`,
    );

    const syncMode = (matches: boolean) => {
      setIsCompact(matches);
    };

    syncMode(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncMode(event.matches);
    };

    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [isComparison]);

  return isCompact;
}

function usePreviewScale() {
  const sharedStageLayout = React.useContext(ResumeStageLayoutContext);
  const userZoom = React.useContext(ResumeUserZoomContext);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    if (sharedStageLayout) {
      return undefined;
    }

    const stage = stageRef.current;
    if (!stage) return;
    const measureTarget =
      stage.closest<HTMLDivElement>(".dasti-doc-viewport--resume") ??
      stage.parentElement;

    const applyScale = () => {
      const measurementNode = measureTarget ?? stage;
      const styles = window.getComputedStyle(measurementNode);
      const availableWidth =
        measurementNode.clientWidth -
        Number.parseFloat(styles.paddingLeft || "0") -
        Number.parseFloat(styles.paddingRight || "0");
      if (!availableWidth) return;

      // Fit = fill the available WIDTH. A4 at fill-width is always taller
      // than the viewer shell, so including height in Math.min would always
      // pick the height constraint and leave the page narrower than the
      // viewport with large dark frames on both sides.
      const fitScale = Math.min(1, availableWidth / A4_PAGE_WIDTH_PX);
      const nextScale = fitScale * userZoom;
      setScale(nextScale > 0 ? nextScale : 1);
    };

    const resizeObserver = new ResizeObserver(applyScale);
    resizeObserver.observe(measureTarget ?? stage);
    window.addEventListener("resize", applyScale);
    applyScale();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", applyScale);
    };
  }, [sharedStageLayout, userZoom]);

  const resolvedScale = sharedStageLayout
    ? sharedStageLayout.pageWidth / A4_PAGE_WIDTH_PX
    : scale;

  return {
    stageRef,
    stageStyle: {
      "--preview-scale": resolvedScale,
      "--preview-stage-width": `${A4_PAGE_WIDTH_PX * resolvedScale}px`,
      "--preview-stage-height": `${A4_PAGE_HEIGHT_PX * resolvedScale}px`,
    } as React.CSSProperties,
  };
}

function useAutoFitPage(fitToken?: string) {
  void fitToken;
  const pageRef = React.useRef<HTMLElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  return { pageRef, innerRef };
}

/** Map a human-readable section title to a canonical section type for preview → editor linking. */
function normalizeSectionTitleToType(title: string): string {
  const lower = title.toLowerCase().trim();
  if (lower.includes("experience") || lower.includes("expérience"))
    return "experience";
  if (
    lower.includes("education") ||
    lower.includes("éducation") ||
    lower.includes("formation")
  )
    return "education";
  if (lower.includes("skill") || lower.includes("compétence")) return "skills";
  if (lower.includes("language") || lower.includes("langue"))
    return "languages";
  if (lower.includes("project") || lower.includes("projet")) return "projects";
  if (
    lower.includes("achievement") ||
    lower.includes("réalisation") ||
    lower.includes("award")
  )
    return "achievements";
  if (lower.includes("certification") || lower.includes("certification"))
    return "certifications";
  if (lower.includes("affiliation") || lower.includes("association"))
    return "affiliations";
  if (
    lower.includes("summary") ||
    lower.includes("profil") ||
    lower.includes("objective") ||
    lower.includes("about")
  )
    return "summary";
  return lower.replace(/\s+/g, "-");
}

function SidebarSection({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant: ResumeVariant;
}) {
  return (
    <section
      className={`sidebar-section sidebar-section--${variant.id}`}
      data-preview-section={normalizeSectionTitleToType(title)}
    >
      <h3 className={`sidebar-title sidebar-title--${variant.id}`}>{title}</h3>
      <div className={`sidebar-content sidebar-content--${variant.id}`}>
        {children}
      </div>
    </section>
  );
}

function MainSection({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant: ResumeVariant;
}) {
  return (
    <section
      className={`main-section main-section--${variant.id}`}
      data-preview-section={normalizeSectionTitleToType(title)}
    >
      <div className={`main-heading-row main-heading-row--${variant.id}`}>
        <h2 className={`main-heading main-heading--${variant.id}`}>{title}</h2>
        <div className={`main-heading-rule main-heading-rule--${variant.id}`} />
      </div>
      {children}
    </section>
  );
}

function HeaderMeta({
  items,
  variant,
}: {
  items: ResumeData["metadata"];
  variant: ResumeVariant;
}) {
  const visibleItems =
    variant.id === "robial"
      ? items.filter((item) => item.label.toLowerCase() !== "availability")
      : items;

  return (
    <dl
      className={`meta-grid meta-grid--${variant.id}`}
      aria-label="Resume metadata"
    >
      {visibleItems.map((item) => (
        <div key={item.label} className="meta-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function buildPageVars(
  variant: ResumeVariant,
  stylePreset?: VerbatiStylePreset | null,
): React.CSSProperties {
  const canonical = normalizeResumePreviewTokens(variant, stylePreset);

  return {
    ...serializeResumePreviewVars(canonical),
    ...serializeActiveResumePreviewDecorVars(canonical, variant.id),
  } as React.CSSProperties;
}

function findLabeledValue(
  items: Array<ResumeLabeledValue>,
  labels: string[],
): string | undefined {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const match = items.find((item) =>
    normalizedLabels.includes(item.label.toLowerCase()),
  );
  const value = String(match?.value ?? "").trim();
  return value || undefined;
}

function uniqueRows(
  rows: Array<ResumeLabeledValue | null>,
): ResumeLabeledValue[] {
  const seen = new Set<string>();
  const result: ResumeLabeledValue[] = [];

  for (const row of rows) {
    if (!row) continue;
    const label = String(row.label ?? "").trim();
    const value = String(row.value ?? "").trim();
    if (!label || !value) continue;
    const key = `${label.toLowerCase()}::${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label, value });
  }

  return result;
}

function buildVolkRegisterMetaItems(data: ResumeData): ResumeLabeledValue[] {
  return uniqueRows([...data.metadata, ...data.contact]).slice(0, 4);
}

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CV";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function PhotoOrInitials({
  src,
  name,
  style,
  imgStyle,
}: {
  src?: string;
  name: string;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          ...imgStyle,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, white 78%), rgba(255,255,255,0.88))",
        color: "var(--color-accent)",
        fontFamily: "var(--font-heading-family)",
        fontSize: "8mm",
        letterSpacing: "0.08em",
        fontWeight: 700,
        ...style,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function RobialPeriod({ period }: { period: string }) {
  const parts = period.split(/\s*[—–-]\s*/);

  if (parts.length === 2) {
    return (
      <span className="robial-period-stack robial-period-stack--no-sep">
        <span>{parts[0]}</span>
        <span>{parts[1]}</span>
      </span>
    );
  }

  return <span>{period}</span>;
}

function getRobialContactItems(
  contact: ResumeData["contact"],
): ContactItemView[] {
  return contact
    .filter((item) => {
      const normalizedLabel = item.label.toLowerCase();
      return normalizedLabel !== "web" && normalizedLabel !== "portfolio";
    })
    .map((item) => {
      const normalizedLabel = item.label.toLowerCase();

      if (normalizedLabel === "linkedin") {
        const handle =
          item.value
            .replace(/^https?:\/\/(www\.)?/i, "")
            .replace(/^linkedin\.com\/in\//i, "")
            .replace(/\/$/, "") || item.value;

        return {
          ...item,
          value: `in @${handle}`,
          compact: true,
        };
      }

      return {
        ...item,
        compact: false,
      };
    });
}

function getComparisonCardCopy(variant: ResumeVariant): ComparisonCardCopy {
  switch (variant.id) {
    case "swissminima":
      return {
        typography:
          "Oversized Swiss masthead, mono register labels, and a sharper editorial standfirst.",
        color:
          "Warm paper neutrals with a restrained rust accent and field-line discipline.",
      };
    case "volkregister":
      return {
        typography:
          "Register-led civic masthead, sender line microcopy, and an administrative rhythm rebuilt as a resume.",
        color:
          "Cream archival stock with civic red-orange anchors, fold-line traces, and a quieter paper field.",
      };
    case "robial":
      return {
        typography:
          "Serif headline, compact utility captions, structured date rail.",
        color: "Warm editorial neutrals with a sharper accent rule.",
      };
    case "editorialmag":
      return {
        typography:
          "Magazine-led feature hierarchy with a long reading column and a quieter support rail.",
        color:
          "Soft paper field with restrained contrast and more luxurious editorial whitespace.",
      };
    case "signalgrid":
      return {
        typography:
          "Modernist uppercase masthead, narrower signal rail, and a more explicit information ladder.",
        color:
          "Whiter paper neutrals with accent-driven rules instead of broad tinted surfaces.",
      };
    case "quire":
      return {
        typography:
          "Fraunces italic roles, monospace dates, and prose skills — typographic hierarchy without decorative noise.",
        color:
          "Warm paper surface with accent reduced to section marks and title label only.",
      };
    default:
      return {
        typography:
          "Editorial serif headline with restrained utility typography.",
        color: "Warm paper neutrals with one restrained accent.",
      };
  }
}

function ComparisonVariantCard({ variant }: { variant: ResumeVariant }) {
  const copy = getComparisonCardCopy(variant);

  return (
    <article className="resume-variant-card">
      <p className="resume-variant-card-label">{variant.label}</p>
      <h2 className="resume-variant-card-title">{variant.title}</h2>
      <p className="resume-variant-card-subtitle">{variant.subtitle}</p>

      <dl className="resume-variant-card-specs">
        <div>
          <dt>Typography</dt>
          <dd>{copy.typography}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd>{copy.color}</dd>
        </div>
      </dl>

      <ul
        className="resume-variant-card-chips"
        aria-label={`${variant.label} tags`}
      >
        {variant.chips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>
    </article>
  );
}

function PreviewFrame({
  variant,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  children,
}: {
  variant: ResumeVariant;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  const { stageRef, stageStyle } = usePreviewScale();
  const isInteractive = typeof onActivateComparison === "function";
  const lastTouchEndRef = React.useRef<number>(0);

  const handleActivateComparison = () => {
    onActivateComparison?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivateComparison();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }

    if (event.detail !== 0) {
      handleActivateComparison();
    }
  };

  const handleDoubleClick = () => {
    handleActivateComparison();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      handleActivateComparison();
    }
  };

  const handleTouchEnd = () => {
    const now = Date.now();

    if (now - lastTouchEndRef.current < 280) {
      handleActivateComparison();
    }

    lastTouchEndRef.current = now;
  };

  if (compactComparison && comparisonLabel) {
    return (
      <div
        className={`resume-variant-card-shell ${
          isInteractive ? "resume-variant-card-shell--clickable" : ""
        }`}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={
          isInteractive
            ? `Expand comparison and open ${variant.label} in large view`
            : undefined
        }
        onClick={isInteractive ? handleClick : undefined}
        onDoubleClick={isInteractive ? handleDoubleClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        onTouchStart={isInteractive ? handleTouchStart : undefined}
        onTouchEnd={isInteractive ? handleTouchEnd : undefined}
      >
        <ComparisonVariantCard variant={variant} />
      </div>
    );
  }

  return (
    <div
      className={`resume-page-frame ${
        isInteractive ? "resume-page-frame--clickable" : ""
      }`}
      style={stageStyle}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={
        isInteractive
          ? `Expand comparison and open ${variant.label} in large view`
          : undefined
      }
      onClick={isInteractive ? handleClick : undefined}
      onDoubleClick={isInteractive ? handleDoubleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      onTouchStart={isInteractive ? handleTouchStart : undefined}
      onTouchEnd={isInteractive ? handleTouchEnd : undefined}
    >
      {comparisonLabel ? (
        <div className="resume-frame-label" aria-hidden="true">
          {comparisonLabel}
        </div>
      ) : null}

      <div ref={stageRef} className="resume-page-stage" style={stageStyle}>
        {children}
      </div>
    </div>
  );
}

function ResumeFontDebugInheritProbe() {
  return (
    <span
      aria-hidden="true"
      data-font-probe="body-inherited"
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0,
        pointerEvents: "none",
        userSelect: "none",
        fontSize: "1px",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      Body font inheritance probe
    </span>
  );
}

const QUIRE_SIDEBAR_WIDTH = "var(--resume-preview-quire-sidebar-width)";
const QUIRE_SIDEBAR_BG = "var(--resume-preview-quire-sidebar-background)";
const QUIRE_SIDEBAR_LABEL_COLOR =
  "var(--resume-preview-quire-sidebar-label-color)";
const QUIRE_SIDEBAR_TEXT_PRIMARY =
  "var(--resume-preview-quire-sidebar-text-primary)";
const QUIRE_SIDEBAR_TEXT_SECONDARY =
  "var(--resume-preview-quire-sidebar-text-secondary)";
const QUIRE_SIDEBAR_ACCENT = "var(--resume-preview-quire-sidebar-accent)";
const QUIRE_MAIN_SECTION_HEADING: React.CSSProperties = {
  margin: 0,
  fontSize: "calc(var(--text-caption-size) + 0.05mm)",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.24em",
  color: "var(--color-accent)",
  paddingBottom: "calc(var(--sidebar-title-padding) + 0.1mm)",
  borderBottom: "var(--resume-preview-quire-main-rule)",
  marginBottom: "calc(var(--sidebar-title-margin) + 0.8mm)",
};
const QUIRE_SIDEBAR_SECTION_HEADING: React.CSSProperties = {
  margin: "0 0 var(--sidebar-title-margin)",
  fontSize: "calc(var(--text-caption-size) - 0.25mm)",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.28em",
  color: QUIRE_SIDEBAR_LABEL_COLOR,
  paddingBottom: "calc(var(--sidebar-title-padding) + 0.1mm)",
  borderBottom: "var(--resume-preview-quire-sidebar-rule)",
};

function QuirePage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);

  const email = findLabeledValue(data.contact, ["email"]);
  const phone = findLabeledValue(data.contact, ["phone"]);
  const location =
    findLabeledValue(data.metadata, ["location", "city", "based"]) ??
    findLabeledValue(data.contact, ["location", "city"]);
  const web = findLabeledValue(data.contact, ["web", "portfolio", "site"]);
  const headerContact = uniqueRows([
    phone ? { label: "phone", value: phone } : null,
    location ? { label: "location", value: location } : null,
    email ? { label: "email", value: email } : null,
    web ? { label: "web", value: web } : null,
  ]);

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          background: "var(--resume-preview-page-background)",
          border: "var(--resume-preview-page-border)",
          overflow: "hidden",
          fontFamily: "var(--font-body-family)",
          borderRadius: "var(--page-radius)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        {/* Full-height dark sidebar strip */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: QUIRE_SIDEBAR_WIDTH,
            background: QUIRE_SIDEBAR_BG,
            pointerEvents: "none",
          }}
        />

        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          {/* ── HEADER ── */}
          <header
            data-preview-section="profile"
            style={{
              display: "grid",
              gridTemplateColumns: `${QUIRE_SIDEBAR_WIDTH} 1fr`,
            }}
          >
            {/* Name + title on dark */}
            <div
              style={{
                padding:
                  "calc(var(--margin-top) - 9mm) calc(var(--margin-left) - 12mm) calc(var(--header-bottom-padding) + 2.5mm) calc(var(--margin-left) - 8mm)",
              }}
            >
              <h1
                data-font-probe="heading"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body-family)",
                  fontSize: "calc(var(--text-display-size) + 0.95mm)",
                  lineHeight: "var(--text-display-line)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: QUIRE_SIDEBAR_TEXT_PRIMARY,
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: "calc(var(--header-title-margin-top) + 1.3mm) 0 0",
                  fontSize: "calc(var(--text-body-size) - 0.55mm)",
                  lineHeight: "calc(var(--text-body-line) - 0.35)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: QUIRE_SIDEBAR_ACCENT,
                }}
              >
                {data.title}
              </p>
            </div>

            {/* Contact right-aligned on light */}
            <div
              style={{
                padding:
                  "calc(var(--margin-top) - 9mm) calc(var(--margin-right) - 15mm) calc(var(--header-bottom-padding) + 2.5mm) calc(var(--margin-left) - 10mm)",
                display: "grid",
                gap: "calc(var(--sidebar-content-gap) - 0.2mm)",
                justifyItems: "end",
                alignContent: "start",
                borderBottom:
                  "0.28mm solid color-mix(in srgb, var(--color-border-strong) 52%, transparent)",
              }}
            >
              {headerContact.map((item) => (
                <p
                  key={item.label}
                  style={{
                    margin: 0,
                    fontSize: "calc(var(--text-body-sm-size) - 0.33mm)",
                    lineHeight: "calc(var(--text-body-sm-line) - 0.15)",
                    color: "var(--color-text-muted)",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {item.value}
                </p>
              ))}
              {data.summary && (
                <p
                  data-font-probe="body"
                  style={{
                    margin: "calc(var(--header-row-gap) - 1.7mm) 0 0",
                    fontSize: "calc(var(--text-body-sm-size) - 0.43mm)",
                    lineHeight: "var(--text-body-line)",
                    color: "var(--color-text-muted)",
                    textAlign: "right",
                    maxWidth: "var(--header-summary-width)",
                    textWrap: "pretty",
                  }}
                >
                  {data.summary}
                </p>
              )}
            </div>
          </header>

          {/* ── BODY ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${QUIRE_SIDEBAR_WIDTH} 1fr`,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* LEFT SIDEBAR */}
            <aside
              style={{
                padding:
                  "calc(var(--header-bottom-padding) + 0.5mm) calc(var(--margin-left) - 12mm) calc(var(--margin-bottom) - 25mm) calc(var(--margin-left) - 8mm)",
                display: "grid",
                gap: "var(--sidebar-section-gap)",
                alignContent: "start",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {/* Education */}
              <section>
                <h2 style={QUIRE_SIDEBAR_SECTION_HEADING}>Education</h2>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--education-gap) - 1mm)",
                  }}
                >
                  {data.education.map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.72mm)",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-caption-size) - 0.15mm)",
                          color: QUIRE_SIDEBAR_ACCENT,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          fontFamily: PREVIEW_MONO_FAMILY,
                        }}
                      >
                        {item.period}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) - 0.3mm)",
                          color: QUIRE_SIDEBAR_TEXT_PRIMARY,
                          fontWeight: 600,
                          lineHeight: 1.22,
                        }}
                      >
                        {item.degree}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) - 0.65mm)",
                          color: QUIRE_SIDEBAR_TEXT_SECONDARY,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.school}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Skills */}
              <section>
                <h2 style={QUIRE_SIDEBAR_SECTION_HEADING}>Skills</h2>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "grid",
                    gap: "calc(var(--skill-gap) - 0.98mm)",
                  }}
                >
                  {data.skills.map((skill) => (
                    <li
                      key={skill}
                      style={{
                        position: "relative",
                        paddingLeft: "calc(var(--experience-bullets-padding) - 0.8mm)",
                        fontSize: "calc(var(--text-body-sm-size) - 0.41mm)",
                        color: QUIRE_SIDEBAR_TEXT_SECONDARY,
                        lineHeight: "calc(var(--text-body-sm-line) - 0.15)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "calc(var(--text-caption-size) - 0.95mm)",
                          width: "calc(var(--text-caption-size) - 1.1mm)",
                          height: "calc(var(--text-caption-size) - 1.1mm)",
                          borderRadius: "50%",
                          background: QUIRE_SIDEBAR_ACCENT,
                        }}
                      />
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Languages */}
              {data.languages.length > 0 && (
                <section>
                  <h2 style={QUIRE_SIDEBAR_SECTION_HEADING}>Languages</h2>
                  <div
                    style={{
                      display: "grid",
                      gap: "calc(var(--sidebar-content-gap) - 0.6mm)",
                    }}
                  >
                    {data.languages.map((lang) => (
                      <div
                        key={lang.name}
                        style={{
                          display: "grid",
                          gap: "calc(var(--experience-bullets-gap) - 0.9mm)",
                        }}
                      >
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) - 0.33mm)",
                          color: QUIRE_SIDEBAR_TEXT_PRIMARY,
                          fontWeight: 600,
                          }}
                        >
                          {lang.name}
                        </p>
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-caption-size) - 0.03mm)",
                          color: QUIRE_SIDEBAR_TEXT_SECONDARY,
                        }}
                        >
                          {lang.level}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </aside>

            {/* RIGHT MAIN */}
            <main
              style={{
                padding:
                  "calc(var(--header-bottom-padding) + 0.5mm) calc(var(--margin-right) - 15mm) calc(var(--margin-bottom) - 25mm) calc(var(--margin-left) - 10mm)",
                display: "grid",
                gap: "calc(var(--body-row-gap) - 2.4mm)",
                alignContent: "start",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {/* Experience */}
              <section>
                <h2 style={QUIRE_MAIN_SECTION_HEADING}>Experience</h2>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--main-section-gap) - 3mm)",
                  }}
                >
                  {data.experience.map((item) => (
                    <article
                      key={`${item.company}-${item.role}`}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.62mm)",
                        paddingTop: "calc(var(--experience-item-gap) - 2.5mm)",
                        borderTop:
                          "0.2mm solid color-mix(in srgb, var(--color-border) 78%, transparent)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "var(--experience-column-gap)",
                        }}
                      >
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-title-size) - 1.25mm)",
                          fontWeight: 700,
                          color: "var(--color-text)",
                          lineHeight: "var(--text-title-line)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          }}
                        >
                          {item.company}
                        </p>
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-caption-size) - 0.05mm)",
                          color: "var(--color-text-subtle)",
                          lineHeight: "var(--text-caption-line)",
                          flexShrink: 0,
                          fontFamily: PREVIEW_MONO_FAMILY,
                          letterSpacing: "0.04em",
                          }}
                        >
                          {item.period}
                        </p>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-size) - 0.53mm)",
                          fontStyle: "italic",
                          color:
                            "color-mix(in srgb, var(--color-accent) 72%, var(--color-text) 28%)",
                          lineHeight: "calc(var(--text-body-line) - 0.26)",
                          fontFamily: "var(--font-heading-family)",
                        }}
                      >
                        {item.role}
                        {item.location ? (
                          <span
                            style={{
                              fontStyle: "normal",
                              color: "var(--color-text-muted)",
                              fontSize: "calc(var(--text-body-sm-size) - 0.41mm)",
                            }}
                          >
                            {" · "}
                            {item.location}
                          </span>
                        ) : null}
                      </p>
                      <ul
                        style={{
                          margin: "calc(var(--experience-bullets-gap) + 0.1mm) 0 0",
                          padding: 0,
                          paddingLeft: "calc(var(--experience-bullets-padding) - 0.2mm)",
                          display: "grid",
                          gap: "calc(var(--experience-bullets-gap) - 0.42mm)",
                          listStyle: "disc",
                        }}
                      >
                        {item.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            style={{
                              fontSize: "calc(var(--text-body-sm-size) - 0.45mm)",
                              lineHeight: "calc(var(--text-body-line) - 0.04)",
                              color: "var(--color-text-muted)",
                              letterSpacing: "-0.003em",
                            }}
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>

              {/* Projects */}
              {data.projects.length > 0 && (
                <section>
                  <h2 style={QUIRE_MAIN_SECTION_HEADING}>Selected Projects</h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "calc(var(--project-gap) - 0.4mm)",
                    }}
                  >
                    {data.projects.map((project) => (
                      <article
                        key={project.name}
                        style={{
                          display: "grid",
                          gap: "calc(var(--experience-bullets-gap) - 0.62mm)",
                          paddingTop: "calc(var(--project-gap) - 1mm)",
                          borderTop:
                            "0.24mm solid color-mix(in srgb, var(--color-border) 82%, transparent)",
                        }}
                      >
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-size) - 0.6mm)",
                          fontWeight: 700,
                          color: "var(--color-text)",
                          lineHeight: "var(--text-caption-line)",
                          fontFamily: "var(--font-heading-family)",
                          fontStyle: "italic",
                          }}
                        >
                          {project.name}
                        </p>
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) - 0.65mm)",
                          color: "var(--color-accent)",
                          lineHeight: "var(--text-caption-line)",
                        }}
                        >
                          {project.meta}
                        </p>
                        <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) - 0.57mm)",
                          lineHeight: "calc(var(--text-body-line) - 0.06)",
                          color: "var(--color-text-muted)",
                        }}
                        >
                          {project.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </article>
    </PreviewFrame>
  );
}

function ClassicResumePage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const contactItems: ContactItemView[] =
    variant.id === "robial"
      ? getRobialContactItems(data.contact)
      : data.contact.map((item) => ({ ...item }));

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          background: "var(--paper)",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        <div ref={innerRef} className="resume-inner">
          <header className="resume-header" data-preview-section="profile">
            <div className="header-copy">
              <p className="eyebrow">Résumé</p>
              <h1 className="name" data-font-probe="heading">
                {data.name}
              </h1>
              <p className="title">{data.title}</p>
              <p className="summary" data-font-probe="body">
                {data.summary}
              </p>
            </div>
            <HeaderMeta items={data.metadata} variant={variant} />
          </header>

          <div className="resume-grid">
            <aside className="resume-sidebar">
              <SidebarSection title="Contact" variant={variant}>
                <ul
                  className={`compact-list ${
                    variant.id === "robial"
                      ? "compact-list--robial-contact"
                      : ""
                  }`}
                >
                  {contactItems.map((item) => (
                    <li
                      key={item.label}
                      className={
                        item.compact ? "compact-list-item--compact" : ""
                      }
                    >
                      {variant.id === "robial" ? null : (
                        <span className="label">{item.label}</span>
                      )}
                      <span className="value">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </SidebarSection>

              <SidebarSection title="Skills" variant={variant}>
                <ul className="skills-list">
                  {data.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </SidebarSection>

              <SidebarSection title="Languages" variant={variant}>
                <ul className="compact-list compact-list--languages">
                  {data.languages.map((language) => (
                    <li key={language.name}>
                      <span className="label">{language.name}</span>
                      <span className="value">{language.level}</span>
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            </aside>

            <div className="resume-divider" aria-hidden="true" />

            <main className="resume-main">
              <MainSection title="Experience" variant={variant}>
                <div className="experience-stack">
                  {data.experience.map((item) => (
                    <article
                      key={`${item.company}-${item.role}`}
                      className="experience-item"
                    >
                      <div
                        className={`experience-period ${
                          variant.id === "robial"
                            ? "experience-period--robial"
                            : ""
                        }`}
                      >
                        {variant.id === "robial" ? (
                          <RobialPeriod period={item.period} />
                        ) : (
                          item.period
                        )}
                      </div>{" "}
                      <div>
                        <h3 className="entry-title">{item.role}</h3>
                        <p className="entry-subtitle">
                          {item.company} · {item.location}
                        </p>
                        <ul className="bullet-list">
                          {item.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              </MainSection>

              <MainSection title="Selected projects" variant={variant}>
                <div className="projects-grid">
                  {data.projects.map((project) => (
                    <article
                      className={`project-card project-card--${variant.id}`}
                      key={project.name}
                    >
                      <h3 className="entry-title">{project.name}</h3>
                      <p className="entry-subtitle entry-subtitle--project">
                        {project.meta}
                      </p>
                      <p className="project-copy">{project.description}</p>
                    </article>
                  ))}
                </div>
              </MainSection>

              <MainSection title="Education" variant={variant}>
                <div className="education-stack">
                  {data.education.map((item) => (
                    <article
                      key={`${item.school}-${item.degree}`}
                      className="education-item"
                    >
                      <div>
                        <h3 className="entry-title">{item.degree}</h3>
                        <p className="entry-subtitle">{item.school}</p>
                      </div>
                      <p className="education-period">{item.period}</p>
                    </article>
                  ))}
                </div>
              </MainSection>
            </main>
          </div>
        </div>
      </article>
    </PreviewFrame>
  );
}

function SwissMinimaPage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const mergedMeta = [...data.metadata, ...data.contact];
  const email =
    findLabeledValue(data.contact, ["email"]) ??
    findLabeledValue(mergedMeta, ["email"]);
  const site =
    findLabeledValue(data.contact, ["web", "portfolio", "site"]) ??
    findLabeledValue(mergedMeta, ["web", "portfolio", "site"]);
  const phone =
    findLabeledValue(data.contact, ["phone"]) ??
    findLabeledValue(mergedMeta, ["phone"]);
  const topContact = [email, phone, site].filter((value): value is string =>
    Boolean(String(value ?? "").trim()),
  );
  const supportAchievements =
    data.achievements?.length && data.achievements.length > 0
      ? data.achievements.slice(0, 2)
      : data.projects.slice(0, 2).map((project) => project.description);
  const supportEducation = data.education[0];
  const supportSkills = data.skills.slice(0, 5).join(", ");

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          background: "var(--resume-preview-page-background)",
          borderColor: "var(--resume-preview-page-border-color)",
          borderWidth: "var(--resume-preview-page-border-width)",
          boxShadow: "var(--resume-preview-page-shadow)",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        <div
          style={{
            position: "absolute",
            inset: "var(--resume-preview-frame-inset)",
            border: "var(--resume-preview-frame-border)",
            pointerEvents: "none",
          }}
        />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            padding:
              "var(--margin-top) calc(var(--margin-left) - 1mm) var(--margin-top) var(--margin-left)",
            display: "grid",
            gridTemplateRows: "auto auto minmax(0, 1fr) auto",
            gap: "calc(var(--body-row-gap) - 3.8mm)",
          }}
        >
          <header
            data-preview-section="profile"
            style={{
              display: "grid",
              gap: "calc(var(--header-row-gap) - 0.8mm)",
              alignItems: "start",
              paddingBottom: "var(--header-bottom-padding)",
              borderBottom:
                "0.34mm solid color-mix(in srgb, var(--color-text) 28%, transparent)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              {topContact.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap:
                      "calc(var(--experience-bullets-gap) + 0.4mm) var(--experience-column-gap)",
                    marginBottom: "calc(var(--header-row-gap) - 0.8mm)",
                    color: "color-mix(in srgb, var(--color-text) 64%, transparent)",
                    fontSize: "var(--text-body-sm-size)",
                    lineHeight: 1.35,
                  }}
                >
                  {topContact.map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </div>
              ) : null}
              <h1
                data-font-probe="heading"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "var(--text-display-size)",
                  lineHeight: "var(--text-display-line)",
                  letterSpacing: "0.11em",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  maxWidth: "calc(var(--main-width) + var(--sidebar-width) - 10mm)",
                  color: "var(--color-text)",
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: "calc(var(--header-row-gap) - 0.8mm) 0 0",
                  maxWidth: "calc(var(--main-width) + 7mm)",
                  fontSize: "calc(var(--text-title-size) - 0.8mm)",
                  lineHeight: 1.38,
                  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                }}
              >
                {data.title}
              </p>
            </div>
          </header>

          <section
            style={{
              display: "grid",
              alignItems: "start",
            }}
          >
            <div>
              <p
                data-font-probe="body"
                style={{
                  margin: 0,
                  maxWidth: "var(--header-summary-width)",
                  fontFamily: "var(--font-body-family)",
                  fontSize: "calc(var(--text-title-size) + 0.9mm)",
                  lineHeight: 1.08,
                  letterSpacing: "0.03em",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "var(--color-text)",
                  display: "-webkit-box",
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {data.summary}
              </p>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gap: "calc(var(--body-row-gap) - 4.8mm)",
              alignContent: "start",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-caption-size)",
                  lineHeight: "var(--text-caption-line)",
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-body-family)",
                  fontWeight: 700,
                }}
              >
                Experience
              </p>
            </div>

            {data.experience.slice(0, 3).map((item, index) => (
              <article
                key={`${item.company}-${item.role}-${item.period}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) calc(var(--experience-date-column) + 21mm)",
                  gap: "calc(var(--experience-column-gap) + 1mm)",
                  alignItems: "start",
                  paddingTop: "calc(var(--experience-item-gap) - 2.2mm)",
                  borderTop:
                    "0.24mm solid color-mix(in srgb, var(--color-text) 24%, transparent)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      margin: "0 0 var(--experience-bullets-gap)",
                      fontFamily: "var(--font-heading-family)",
                      fontSize: "calc(var(--text-title-size) + 1.05mm)",
                      lineHeight: 1.02,
                      fontWeight: 800,
                      letterSpacing: "0.01em",
                      textTransform: "uppercase",
                      color: "var(--color-text)",
                    }}
                  >
                    {item.role}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "calc(var(--text-body-size) - 0.35mm)",
                      lineHeight: 1.28,
                      fontWeight: 700,
                      color: "var(--color-text)",
                    }}
                  >
                    {item.company}
                  </p>
                  <ul
                    style={{
                      margin: "var(--experience-bullets-gap) 0 0",
                      paddingLeft: "var(--experience-bullets-padding)",
                      display: "grid",
                      gap: "var(--experience-bullets-gap)",
                      color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                      fontSize: "calc(var(--text-body-sm-size) - 0.15mm)",
                      lineHeight: 1.44,
                    }}
                  >
                    {item.bullets.slice(0, 3).map((bullet, bulletIndex) => (
                      <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                    ))}
                  </ul>
                </div>
                <aside
                  style={{
                    paddingLeft: "calc(var(--experience-column-gap) - 1mm)",
                    borderLeft:
                      "0.32mm solid color-mix(in srgb, var(--color-text) 16%, transparent)",
                    display: "grid",
                    gap: "calc(var(--sidebar-content-gap) + 0.75mm)",
                  }}
                >
                  {uniqueRows([
                    { label: "period", value: item.period },
                    { label: "location", value: item.location },
                    { label: "company", value: item.company },
                  ]).map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.42mm)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "calc(var(--text-body-sm-size) + 0.25mm)",
                          lineHeight: 1.46,
                          color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
                          textTransform:
                            row.label === "company" ? "none" : "uppercase",
                          letterSpacing:
                            row.label === "company" ? "0" : "0.18em",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </aside>
              </article>
            ))}
          </section>

          <section
            style={{
              paddingTop: "calc(var(--main-section-gap) - 2.2mm)",
              borderTop:
                "0.42mm solid color-mix(in srgb, var(--color-text) 28%, transparent)",
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.25fr) minmax(0, 0.85fr) minmax(0, 0.9fr)",
              gap: "calc(var(--main-section-gap) - 4mm)",
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-caption-size) - 0.15mm)",
                  lineHeight: "var(--text-caption-line)",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Achievements
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--experience-bullets-padding)",
                  display: "grid",
                  gap: "calc(var(--experience-bullets-gap) - 0.4mm)",
                  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                  fontSize: "calc(var(--text-body-sm-size) - 0.4mm)",
                  lineHeight: 1.38,
                }}
              >
                {supportAchievements.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div
              style={{
                display: "grid",
                gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
                minWidth: 0,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-caption-size) - 0.15mm)",
                  lineHeight: "var(--text-caption-line)",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Education
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-body-sm-size) + 0.15mm)",
                  lineHeight: 1.5,
                  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                }}
              >
                {supportEducation ? (
                  <>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      {supportEducation.degree}
                    </span>
                    <span style={{ display: "block" }}>
                      {supportEducation.school}
                    </span>
                    <span style={{ display: "block" }}>
                      {supportEducation.period}
                    </span>
                  </>
                ) : (
                  "Education details pending."
                )}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
                minWidth: 0,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-caption-size) - 0.15mm)",
                  lineHeight: "var(--text-caption-line)",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Skills
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-body-sm-size) - 0.4mm)",
                  lineHeight: 1.42,
                  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                }}
              >
                {supportSkills || "Skills pending."}
              </p>
            </div>
          </section>
        </div>
      </article>
    </PreviewFrame>
  );
}

function VolkRegisterPage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const mergedMeta = [...data.metadata, ...data.contact];
  const email =
    findLabeledValue(data.contact, ["email"]) ??
    findLabeledValue(mergedMeta, ["email"]);
  const phone =
    findLabeledValue(data.contact, ["phone"]) ??
    findLabeledValue(mergedMeta, ["phone"]);
  const location =
    findLabeledValue(mergedMeta, ["location", "city", "base"]) ??
    data.experience[0]?.location;
  const website =
    findLabeledValue(data.contact, ["web", "portfolio", "site", "linkedin"]) ??
    findLabeledValue(mergedMeta, ["web", "portfolio", "site", "linkedin"]);
  const senderLine = [location, email, phone, website]
    .filter(Boolean)
    .join(" · ");
  const registerSkills = data.skills
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 3);
  const supportSkills = data.skills.slice(0, 10);
  const sectionStackGap = "calc(var(--body-row-gap) - 1.4mm)";
  const sectionHeadingGap = "calc(var(--main-heading-gap) - 0.8mm)";
  const bodyTextColor = "var(--resume-preview-volk-body-color)";
  const sectionHeadingStyle: React.CSSProperties = {
    margin: 0,
    color: "var(--color-accent)",
    fontFamily: "var(--font-heading-family)",
    fontSize: "var(--resume-preview-volk-section-heading-size)",
    lineHeight: "var(--resume-preview-volk-section-heading-line)",
    fontWeight: 800,
    textTransform: "lowercase",
  };

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          position: "relative",
          overflow: "hidden",
          background: "var(--resume-preview-page-background)",
          borderColor: "var(--resume-preview-page-border-color)",
          borderWidth: "var(--resume-preview-page-border-width)",
          boxShadow: "var(--resume-preview-page-shadow)",
          clipPath: "polygon(0 0, 100% 0, 100% 98.8%, 98.8% 100%, 0 100%)",
          fontFamily: "var(--font-heading-family)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "var(--resume-preview-volk-overlay-primary)",
            opacity: 0.95,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            pointerEvents: "none",
            background: "var(--resume-preview-volk-overlay-secondary)",
            mixBlendMode: "multiply",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "var(--volk-grid-left)",
              top: "var(--volk-grid-title-top)",
              width: "var(--volk-grid-header-width)",
              display: "grid",
              alignContent: "start",
              justifyItems: "start",
            }}
          >
            <h1
              style={{
                margin: 0,
                color: "var(--color-accent)",
                fontFamily: "var(--font-heading-family)",
                fontSize: "var(--resume-preview-volk-title-size)",
                lineHeight: "var(--resume-preview-volk-section-heading-line)",
                fontWeight: 800,
                letterSpacing: "-0.045em",
                whiteSpace: "nowrap",
                textTransform: "lowercase",
              }}
            >
              {data.name.toLowerCase()}
            </h1>
            <p
              style={{
                margin: "calc(var(--header-row-gap) - 0.8mm) 0 0",
                color: "var(--color-accent)",
                fontFamily: "var(--font-heading-family)",
                fontSize: "var(--resume-preview-volk-subtitle-size)",
                lineHeight: "var(--text-title-line)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                textTransform: "lowercase",
              }}
            >
              {data.title.toLowerCase()}
            </p>
            <p
              style={{
                margin: "calc(var(--header-row-gap) + 2.35mm) 0 0",
                color: "var(--color-accent)",
                fontFamily: "var(--font-heading-family)",
                fontSize: "var(--resume-preview-volk-meta-size)",
                lineHeight: "var(--text-body-line)",
                fontWeight: 800,
                letterSpacing: "0.005em",
              }}
            >
              {senderLine || "sender / contact details"}
            </p>
          </div>

          {registerSkills.map((skill, index) => (
            <div
              key={`${skill}-${index}`}
              style={{
                position: "absolute",
                left: `var(--volk-grid-meta-left-${index})`,
                top: "var(--volk-grid-meta-top)",
                display: "block",
                color: "var(--color-accent)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "var(--resume-preview-volk-meta-size)",
                  lineHeight: "var(--text-body-line)",
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  textTransform: "lowercase",
                }}
              >
                {skill.toLowerCase()}
              </p>
            </div>
          ))}

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "var(--volk-grid-dot-left)",
              top: "var(--volk-grid-dot-top)",
              width: "calc(var(--text-caption-size) - 1.1mm)",
              height: "calc(var(--text-caption-size) - 1.1mm)",
              borderRadius: "50%",
              background: "var(--color-accent)",
            }}
          />

          <div
            ref={innerRef}
            style={{
              position: "absolute",
              left: "var(--volk-grid-left)",
              top: "var(--volk-grid-subject-top)",
              width: "min(var(--volk-grid-body-width), 60ch)",
              bottom: "var(--volk-grid-bottom-margin)",
              overflow: "hidden",
            }}
          >
            <main
              style={{
                display: "grid",
                gap: sectionStackGap,
                alignContent: "start",
                maxWidth: "60ch",
              }}
            >
              <section
                style={{
                  display: "grid",
                  gap: sectionHeadingGap,
                  alignItems: "start",
                }}
              >
                <p style={sectionHeadingStyle}>summary</p>
                <p
                  data-font-probe="body"
                  style={{
                    margin: 0,
                    color: bodyTextColor,
                    fontFamily: "var(--font-heading-family)",
                    fontSize: "var(--resume-preview-volk-meta-size)",
                    lineHeight: "var(--text-body-line)",
                    textAlign: "left",
                  }}
                >
                  {data.summary}
                </p>
              </section>

              <section style={{ display: "grid", gap: sectionHeadingGap }}>
                <p style={sectionHeadingStyle}>experience</p>
                <div style={{ display: "grid", gap: "var(--experience-item-gap)" }}>
                  {data.experience.slice(0, 2).map((item, index) => (
                    <article
                      key={`${item.company}-${item.role}-${item.period}-${index}`}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.3mm)",
                        alignItems: "start",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: bodyTextColor,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "var(--resume-preview-volk-meta-size)",
                          lineHeight: "var(--text-body-line)",
                          fontWeight: 600,
                        }}
                      >
                        {item.role}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: bodyTextColor,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "var(--resume-preview-volk-meta-size)",
                          lineHeight: "var(--text-body-line)",
                          fontWeight: 500,
                        }}
                      >
                        {[item.company, item.period, item.location]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {item.bullets.slice(0, 2).map((bullet, bulletIndex) => (
                        <p
                          key={`${bullet}-${bulletIndex}`}
                          style={{
                            margin: 0,
                            color: bodyTextColor,
                            fontFamily: "var(--font-heading-family)",
                            fontSize: "var(--resume-preview-volk-meta-size)",
                            lineHeight: "var(--text-body-line)",
                            fontWeight: 400,
                          }}
                        >
                          {bullet}
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              </section>

              {data.education.length > 0 ? (
                <section style={{ display: "grid", gap: sectionHeadingGap }}>
                  <p style={sectionHeadingStyle}>education</p>
                  <div style={{ display: "grid", gap: "var(--education-gap)" }}>
                    {data.education.slice(0, 2).map((item) => (
                      <article
                        key={`${item.school}-${item.degree}`}
                        style={{
                          display: "grid",
                          gap: "calc(var(--experience-bullets-gap) - 0.57mm)",
                        }}
                      >
                        <p
                          style={{
                          margin: 0,
                          color: bodyTextColor,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "var(--resume-preview-volk-meta-size)",
                          lineHeight: "var(--text-body-line)",
                          fontWeight: 600,
                          }}
                        >
                          {item.degree}
                        </p>
                        <p
                          style={{
                          margin: 0,
                          color: bodyTextColor,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "var(--resume-preview-volk-meta-size)",
                          lineHeight: "var(--text-body-line)",
                          fontWeight: 500,
                          }}
                        >
                          {[item.school, item.period]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </main>
          </div>
        </div>
      </article>
    </PreviewFrame>
  );
}

function EditorialMagazinePage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const contactRows = data.contact.slice(0, 4);
  const metadataRows = data.metadata.slice(0, 3);
  const editorialSectionLabelSize = "var(--text-caption-size)";
  const editorialMetaLabelSize = "calc(var(--text-caption-size) - 0.15mm)";
  const editorialMetaGap = "calc(var(--experience-bullets-gap) - 0.6mm)";
  const editorialSectionGap = "calc(var(--main-section-gap) - 4.6mm)";
  const editorialStackGap = "calc(var(--body-row-gap) - 2.2mm)";
  const editorialEntryGap = "calc(var(--experience-item-gap) - 3.2mm)";
  const editorialCardGap = "calc(var(--project-gap) + 0.2mm)";
  const editorialMinorGap = "calc(var(--experience-bullets-gap) + 0.4mm)";
  const editorialBodyColor = "var(--color-text-muted)";
  const editorialSubtleColor = "var(--color-text-subtle)";
  const editorialDisplaySize = "calc(var(--text-display-size) + 6.2mm)";
  const editorialTitleSize = "calc(var(--text-title-size) - 0.35mm)";
  const editorialSubtitleSize = "calc(var(--text-body-size) + 0.45mm)";
  const editorialBodySize = "calc(var(--text-body-size) - 0.55mm)";
  const editorialBodySmSize = "calc(var(--text-body-sm-size) - 0.25mm)";

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          background:
            "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 94%, var(--sf1) 6%))" /* --paper base, faint sf1 tint toward foot */,
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            paddingTop: "var(--auto-margin-top)",
            paddingRight: "var(--auto-margin-right)",
            paddingBottom: "var(--auto-margin-bottom)",
            paddingLeft: "var(--auto-margin-left)",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            rowGap: "calc(var(--body-row-gap) - 0.8mm)",
          }}
        >
          <header
            data-preview-section="profile"
            style={{
              display: "grid",
              gap: "calc(var(--main-heading-gap) + 1.2mm)",
              paddingBottom: "var(--header-bottom-padding)",
              borderBottom:
                "0.34mm solid var(--resume-preview-editorial-rule-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "var(--experience-column-gap)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: editorialSectionLabelSize,
                  lineHeight: 1.15,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-body-family)",
                  fontWeight: 700,
                }}
              >
                Editorial resume / magazine cut / A4
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: editorialSectionLabelSize,
                  lineHeight: 1.15,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: editorialSubtleColor,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                {variant.label}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: "calc(var(--experience-item-gap) - 1.6mm)",
                maxWidth: "calc(var(--main-width) + var(--gutter-width) + 2.5mm)",
              }}
            >
              <h1
                data-font-probe="heading"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: editorialDisplaySize,
                  lineHeight: 0.92,
                  letterSpacing: "-0.055em",
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: editorialSubtitleSize,
                  lineHeight: 1.22,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                {data.title}
              </p>
              <p
                data-font-probe="body"
                style={{
                  margin: 0,
                  maxWidth: "calc(var(--main-width) + 8mm)",
                  fontSize: "calc(var(--text-body-size) + 0.1mm)",
                  lineHeight: 1.55,
                  color: editorialBodyColor,
                }}
              >
                {data.summary}
              </p>
            </div>
          </header>

          <div
            style={{
              minHeight: 0,
              display: "grid",
              gridTemplateColumns:
                "var(--main-width) var(--gutter-width) var(--sidebar-width)",
            }}
          >
            <main
              style={{
                minWidth: 0,
                display: "grid",
                gap: editorialStackGap,
                alignContent: "start",
              }}
            >
              <section style={{ display: "grid", gap: editorialSectionGap }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "calc(var(--experience-bullets-padding) - 1mm)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: editorialSectionLabelSize,
                      lineHeight: 1.15,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--color-accent)",
                      fontFamily: "var(--font-body-family)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Experience
                  </p>
                  <div
                    style={{
                      height: "calc(var(--page-radius) - 1.12mm)",
                      flex: 1,
                      background: "var(--resume-preview-editorial-rule-fill)",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: editorialCardGap }}>
                  {data.experience.slice(0, 3).map((item, index) => (
                    <article
                      key={`${item.company}-${item.role}-${item.period}-${index}`}
                      style={{
                        display: "grid",
                        gap: editorialEntryGap,
                        paddingTop: "calc(var(--experience-item-gap) - 1.8mm)",
                        borderTop:
                          "0.24mm solid var(--resume-preview-editorial-rule-color)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: "var(--experience-column-gap)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: editorialSectionLabelSize,
                              lineHeight: 1.15,
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              color: editorialSubtleColor,
                              fontFamily: "var(--font-body-family)",
                              fontWeight: 700,
                            }}
                          >
                            {item.company}
                          </p>
                          <h3
                            style={{
                              margin:
                                "calc(var(--experience-bullets-gap) - 0.1mm) 0 0",
                              fontFamily: "var(--font-heading-family)",
                              fontSize: "calc(var(--text-title-size) - 0.05mm)",
                              lineHeight: 1.02,
                              letterSpacing: "-0.04em",
                              fontWeight: 600,
                              color: "var(--color-text)",
                            }}
                          >
                            {item.role}
                          </h3>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: editorialSectionLabelSize,
                            lineHeight: 1.25,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: editorialSubtleColor,
                            fontFamily: "var(--font-body-family)",
                            textAlign: "right",
                          }}
                        >
                          {item.period}
                        </p>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: editorialBodySize,
                          lineHeight: 1.4,
                          color: "var(--color-accent)",
                          fontWeight: 600,
                        }}
                      >
                        {item.location}
                      </p>

                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "var(--experience-bullets-padding)",
                          display: "grid",
                          gap: "calc(var(--experience-bullets-gap) + 0.1mm)",
                          color: editorialBodyColor,
                          fontSize: editorialBodySize,
                          lineHeight: 1.48,
                        }}
                      >
                        {item.bullets.slice(0, 3).map((bullet, bulletIndex) => (
                          <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>

              <section style={{ display: "grid", gap: editorialSectionGap }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "calc(var(--experience-bullets-padding) - 1mm)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: editorialSectionLabelSize,
                      lineHeight: 1.15,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--color-accent)",
                      fontFamily: "var(--font-body-family)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Selected projects
                  </p>
                  <div
                    style={{
                      height: "calc(var(--page-radius) - 1.12mm)",
                      flex: 1,
                      background: "var(--resume-preview-editorial-rule-fill)",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: "var(--project-gap)" }}>
                  {data.projects.slice(0, 2).map((project, index) => (
                    <article
                      key={`${project.name}-${project.meta}-${index}`}
                      style={{
                        padding: "calc(var(--project-padding) + 1mm) 0 0",
                        borderTop:
                          "0.24mm solid var(--resume-preview-editorial-rule-color)",
                        display: "grid",
                        gap: editorialMinorGap,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: editorialTitleSize,
                          lineHeight: 1.04,
                          letterSpacing: "-0.03em",
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        {project.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: editorialSectionLabelSize,
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: editorialSubtleColor,
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {project.meta}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: editorialBodySize,
                          lineHeight: 1.5,
                          color: editorialBodyColor,
                        }}
                      >
                        {project.description}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </main>

            <div
              style={{
                borderRight:
                  "0.24mm solid var(--resume-preview-editorial-rule-color)",
              }}
            />

            <aside
              style={{
                minWidth: 0,
                paddingLeft: 0,
                display: "grid",
                gap: "calc(var(--body-row-gap) - 2.8mm)",
                alignContent: "start",
              }}
            >
              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) + 0.7mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: editorialSectionLabelSize,
                    lineHeight: 1.15,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-body-family)",
                    fontWeight: 700,
                  }}
                >
                  Contact
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--sidebar-content-gap) - 0.8mm)",
                  }}
                >
                  {contactRows.map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "grid", gap: editorialMetaGap }}
                    >
                      <span
                        style={{
                          fontSize: editorialMetaLabelSize,
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: editorialSubtleColor,
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: editorialBodySmSize,
                          lineHeight: 1.42,
                          color: editorialBodyColor,
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) + 0.7mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: editorialSectionLabelSize,
                    lineHeight: 1.15,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-body-family)",
                    fontWeight: 700,
                  }}
                >
                  Notes
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--sidebar-content-gap) - 0.8mm)",
                  }}
                >
                  {metadataRows.map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "grid", gap: editorialMetaGap }}
                    >
                      <span
                        style={{
                          fontSize: editorialMetaLabelSize,
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: editorialSubtleColor,
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: editorialBodySmSize,
                          lineHeight: 1.42,
                          color: editorialBodyColor,
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) + 0.7mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: editorialSectionLabelSize,
                    lineHeight: 1.15,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-body-family)",
                    fontWeight: 700,
                  }}
                >
                  Skills
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: editorialBodySmSize,
                    lineHeight: 1.5,
                    color: editorialBodyColor,
                  }}
                >
                  {data.skills.slice(0, 8).join(", ")}
                </p>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) + 0.7mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: editorialSectionLabelSize,
                    lineHeight: 1.15,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-body-family)",
                    fontWeight: 700,
                  }}
                >
                  Education
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--sidebar-content-gap) - 0.8mm)",
                  }}
                >
                  {data.education.slice(0, 2).map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{ display: "grid", gap: editorialMetaGap }}
                    >
                      <span
                        style={{
                          fontSize: editorialBodySmSize,
                          lineHeight: 1.34,
                          color: "var(--color-text)",
                          fontWeight: 600,
                        }}
                      >
                        {item.degree}
                      </span>
                      <span
                        style={{
                          fontSize: "calc(var(--text-body-sm-size) - 0.45mm)",
                          lineHeight: 1.4,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.school}
                      </span>
                      <span
                        style={{
                          fontSize: editorialMetaLabelSize,
                          lineHeight: 1.2,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: editorialSubtleColor,
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {item.period}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </article>
    </PreviewFrame>
  );
}

function SignalGridPage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const pageVars = buildPageVars(
    variant,
    React.useContext(ResumeStylePresetContext),
  );
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const sideMeta = uniqueRows(data.contact).slice(0, 3);
  const railSkills = data.skills.slice(0, 6);
  const projectCards = data.projects.slice(0, 2);
  const signalRailWidth = "calc(var(--sidebar-width) + 5mm)";
  const signalSectionLabelSize = "calc(var(--text-caption-size) - 0.05mm)";
  const signalSidebarLabelSize = "calc(var(--text-caption-size) - 0.15mm)";
  const signalSidebarTextSize = "calc(var(--text-body-sm-size) + 0.05mm)";
  const signalSidebarSubtextSize = "calc(var(--text-body-sm-size) - 0.15mm)";
  const signalNameSize = "calc(var(--text-display-size) + 7.8mm)";
  const signalTitleSize = "calc(var(--text-body-size) + 0.1mm)";
  const signalSummarySize = "calc(var(--text-body-size) + 0.05mm)";
  const signalRoleSize = "calc(var(--text-title-size) - 1.35mm)";
  const signalMetaSize = "calc(var(--text-body-sm-size) + 0.1mm)";

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
    >
      <article
        ref={pageRef}
        className={`resume-page resume-page--${variant.id}`}
        style={{
          ...pageVars,
          background:
            "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 96%, var(--sf1) 4%))" /* --paper base, barely-there sf1 tint */,
          borderColor: "var(--color-border)",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <ResumeFontDebugInheritProbe />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: `${signalRailWidth} minmax(0, 1fr)`,
            gap: "var(--gutter-width)",
            alignItems: "stretch",
          }}
        >
          <aside
            style={{
              minHeight: "100%",
              padding:
                "var(--margin-top) calc(var(--sidebar-content-gap) - 2.2mm) var(--margin-bottom)",
              display: "grid",
              alignContent: "start",
              gap: "calc(var(--sidebar-section-gap) - 0.4mm)",
              borderRadius: "8mm 0 18mm 0",
              background: "var(--resume-preview-signal-rail-background)",
              borderRight: "var(--resume-preview-signal-rail-border)",
            }}
          >
            <div
              style={{
                display: "grid",
                justifyItems: "center",
                gap: "calc(var(--experience-bullets-gap) + 1mm)",
              }}
            >
              <div
                style={{
                  width: "calc(var(--sidebar-width) - 13mm)",
                  height: "calc(var(--sidebar-width) - 13mm)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  border: "var(--resume-preview-signal-photo-border)",
                  boxShadow: "var(--resume-preview-signal-photo-shadow)",
                }}
              >
                <PhotoOrInitials name={data.name} src={data.photoUrl} />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "calc(var(--sidebar-section-gap) - 1.4mm)",
              }}
            >
              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) - 0.1mm)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--sidebar-content-gap) - 1.6mm)",
                  }}
                >
                  {sideMeta.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 1mm)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: signalSidebarTextSize,
                          lineHeight: 1.34,
                          color: "var(--color-text)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) - 0.1mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: signalSidebarLabelSize,
                    lineHeight: 1.2,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--color-text-subtle)",
                    fontWeight: 700,
                  }}
                >
                  Languages
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) - 0.37mm)",
                  }}
                >
                  {data.languages.slice(0, 3).map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.94mm)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: signalSidebarTextSize,
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: signalSidebarSubtextSize,
                          color: "var(--color-text-subtle)",
                        }}
                      >
                        {item.level}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "calc(var(--sidebar-title-margin) - 0.1mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: signalSidebarLabelSize,
                    lineHeight: 1.2,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--color-text-subtle)",
                    fontWeight: 700,
                  }}
                >
                  Skills
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) - 0.42mm)",
                  }}
                >
                  {railSkills.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontSize: "calc(var(--text-body-sm-size) - 0.05mm)",
                        lineHeight: 1.34,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <main
            style={{
              display: "grid",
              gap: "calc(var(--body-row-gap) - 2mm)",
              alignContent: "start",
              minWidth: 0,
              paddingTop: "var(--margin-top)",
              paddingRight: "var(--margin-right)",
              paddingBottom: "var(--margin-bottom)",
            }}
          >
            <header
              data-preview-section="profile"
              style={{
                display: "grid",
                gap: "calc(var(--main-heading-gap) - 0.2mm)",
                paddingBottom: "calc(var(--header-bottom-padding) - 0.6mm)",
                borderBottom: "var(--resume-preview-signal-rule)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "calc(var(--experience-bullets-gap) + 1mm)",
                }}
              >
                <h1
                  data-font-probe="heading"
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading-family)",
                    fontSize: signalNameSize,
                    lineHeight: 0.86,
                    letterSpacing: "0.05em",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "var(--color-text)",
                    maxWidth: "calc(var(--main-width) - 1mm)",
                  }}
                >
                  {data.name}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: signalTitleSize,
                    lineHeight: 1.3,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  {data.title}
                </p>
              </div>

              <p
                data-font-probe="body"
                style={{
                  margin: 0,
                  maxWidth: "calc(var(--main-width) - 17mm)",
                  paddingTop: "calc(var(--experience-bullets-gap) + 1mm)",
                  borderTop: "var(--resume-preview-signal-summary-rule)",
                  fontSize: signalSummarySize,
                  lineHeight: 1.56,
                  color: "var(--color-text)",
                }}
              >
                {data.summary}
              </p>
            </header>

            <section
              style={{
                display: "grid",
                gap: "calc(var(--main-heading-gap) - 0.4mm)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: signalSectionLabelSize,
                  lineHeight: 1.2,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Experience
              </p>
              <div style={{ display: "grid", gap: "var(--experience-item-gap)" }}>
                {data.experience.slice(0, 3).map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "var(--experience-date-column) minmax(0, 1fr)",
                      gap: "var(--experience-column-gap)",
                      alignItems: "start",
                      paddingTop: "calc(var(--experience-item-gap) - 1.8mm)",
                      borderTop:
                        "0.24mm solid color-mix(in srgb, var(--color-border-strong) 76%, transparent)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "calc(var(--text-caption-size) + 0.05mm)",
                        lineHeight: 1.35,
                        color: "var(--color-text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.16em",
                      }}
                    >
                      {item.period}
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) + 0.1mm)",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: signalRoleSize,
                          lineHeight: 1.14,
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.role}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) + 0.35mm)",
                          lineHeight: 1.42,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.company} / {item.location}
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "var(--experience-bullets-padding)",
                          display: "grid",
                          gap: "var(--experience-bullets-gap)",
                          fontSize: "calc(var(--text-body-sm-size) + 0.35mm)",
                          lineHeight: 1.5,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.bullets.slice(0, 3).map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gap: "calc(var(--main-section-gap) - 3mm)",
                paddingTop: "calc(var(--project-padding) + 0.8mm)",
                borderTop:
                  "0.24mm solid color-mix(in srgb, var(--color-border-strong) 76%, transparent)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "calc(var(--main-heading-gap) - 0.6mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: signalSectionLabelSize,
                    lineHeight: 1.2,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  Selected Projects
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "calc(var(--project-gap) - 0.4mm)",
                  }}
                >
                  {projectCards.map((item) => (
                    <article
                      key={item.name}
                      style={{
                        display: "grid",
                        gap: "var(--experience-bullets-gap)",
                        padding:
                          "calc(var(--skill-padding-block) + 1.05mm) calc(var(--skill-padding-inline) + 0.9mm)",
                        borderRadius: "calc(var(--skill-pad-inline) + 0.4mm)",
                        border: "var(--resume-preview-signal-card-border)",
                        background: "var(--resume-preview-signal-card-background)",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: signalMetaSize,
                          lineHeight: 1.2,
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.name}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "calc(var(--text-body-sm-size) + 0.1mm)",
                          lineHeight: 1.46,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "calc(var(--main-heading-gap) - 0.7mm)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: signalSectionLabelSize,
                    lineHeight: 1.2,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  Education
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "var(--education-gap) calc(var(--gutter-width) - 13mm)",
                  }}
                >
                  {data.education.slice(0, 2).map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.77mm)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading-family)",
                          fontSize: signalMetaSize,
                          lineHeight: 1.22,
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.degree}
                      </span>
                      <span
                        style={{
                          fontSize: signalSidebarTextSize,
                          lineHeight: 1.4,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.school}
                      </span>
                      <span
                        style={{
                          fontSize: signalSectionLabelSize,
                          lineHeight: 1.32,
                          color: "var(--color-text-subtle)",
                        }}
                      >
                        {item.period}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </article>
    </PreviewFrame>
  );
}

function ResumeVariantPage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  if (variant.id === "swissminima") {
    return (
      <SwissMinimaPage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "editorialmag") {
    return (
      <EditorialMagazinePage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "volkregister") {
    return (
      <VolkRegisterPage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "signalgrid") {
    return (
      <SignalGridPage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "quire") {
    return (
      <QuirePage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  return (
    <ClassicResumePage
      variant={variant}
      data={data}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
      fitToken={fitToken}
    />
  );
}

export default function ResumePage({
  data,
  mode = "comparison",
  comparisonVariantIds,
  stylePreset = null,
  fitToken,
  onSelectVariantId,
  userZoom = 1,
  stageLayout,
}: ResumePageProps) {
  const isComparisonMode = mode === "comparison" || mode === "comparisonAll";
  const [expandedComparison, setExpandedComparison] = React.useState(false);

  React.useEffect(() => {
    setExpandedComparison(false);
  }, [mode]);

  const compactViewport = useCompactComparison(isComparisonMode);
  const compactComparison =
    isComparisonMode && compactViewport && !expandedComparison;
  const expandedComparisonView = isComparisonMode && expandedComparison;
  const defaultComparisonVariantIds: ResumeLayoutVariantId[] =
    mode === "comparison"
      ? ["swissminima", "robial", "editorialmag", "signalgrid"]
      : mode === "comparisonAll"
        ? [
            "swissminima",
            "volkregister",
            "robial",
            "editorialmag",
            "signalgrid",
          ]
        : [mode];

  const resolvedVariantIds = isComparisonMode
    ? comparisonVariantIds?.length
      ? comparisonVariantIds
      : defaultComparisonVariantIds
    : [mode];

  const variants = resolvedVariantIds.map(
    (variantId) => resumeLayoutSpec.variants[variantId],
  );

  return (
    <ResumeStylePresetContext.Provider value={stylePreset}>
      <ResumeStageLayoutContext.Provider value={stageLayout ?? null}>
        <ResumeUserZoomContext.Provider value={userZoom}>
          <div
            className={`resume-preview-shell ${
              isComparisonMode ? "resume-preview-shell--comparison" : ""
            } ${!isComparisonMode ? "resume-preview-shell--single" : ""}`}
          >
            {expandedComparisonView ? (
              <div className="resume-preview-bar">
                <button
                  type="button"
                  className="resume-preview-back"
                  onClick={() => setExpandedComparison(false)}
                >
                  Back to overview
                </button>
              </div>
            ) : null}

            <div
              className={`resume-preview-grid ${
                isComparisonMode ? "resume-preview-grid--comparison" : ""
              } ${compactComparison ? "resume-preview-grid--compact" : ""} ${
                expandedComparisonView ? "resume-preview-grid--expanded" : ""
              }`}
            >
              {variants.map((variant) => (
                <ResumeVariantPage
                  key={variant.id}
                  variant={variant}
                  comparisonLabel={isComparisonMode ? variant.label : undefined}
                  compactComparison={compactComparison}
                  fitToken={`${fitToken ?? ""}:${variant.id}`}
                  onActivateComparison={
                    isComparisonMode && !expandedComparisonView
                      ? () => {
                          if (onSelectVariantId) {
                            onSelectVariantId(variant.id);
                            return;
                          }
                          setExpandedComparison(true);
                        }
                      : undefined
                  }
                  data={data}
                />
              ))}
            </div>
          </div>
        </ResumeUserZoomContext.Provider>
      </ResumeStageLayoutContext.Provider>
    </ResumeStylePresetContext.Provider>
  );
}
