import React from "react";
import "./resume-preview.css";

import { resumeLayoutSpec } from "./resume-layout.spec";
import type { ResumeData, ResumeLayoutVariantId } from "./resume.types";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
} from "../../../lib/document-stage";

type ResumePageMode = "comparison" | "comparisonAll" | ResumeLayoutVariantId;

type ResumePageProps = {
  data: ResumeData;
  mode?: ResumePageMode;
  comparisonVariantIds?: ResumeLayoutVariantId[];
  fitToken?: string;
  onSelectVariantId?: ((variantId: ResumeLayoutVariantId) => void) | undefined;
  userZoom?: number;
  stageLayout?: DocumentStageLayout;
};

type ResumeVariant =
  (typeof resumeLayoutSpec.variants)[keyof typeof resumeLayoutSpec.variants];

type OnecolMetaItem = {
  label: string;
  value: string;
};

type ResumeLabeledValue = {
  label: string;
  value: string;
};

type ContactItemView = ResumeData["contact"][number] & {
  compact?: boolean;
};

type AutoFitLevel = "0" | "1" | "2" | "3" | "4";
const AUTO_FIT_LEVELS: AutoFitLevel[] = ["0", "1", "2", "3", "4"];

const COMPACT_COMPARISON_BREAKPOINT = 1040;

const ResumeUserZoomContext = React.createContext(1);
const ResumeStageLayoutContext = React.createContext<DocumentStageLayout | null>(
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
      const fitScale = Math.min(
        1,
        availableWidth / A4_PAGE_WIDTH_PX,
      );
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
  const pageRef = React.useRef<HTMLElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef<number | null>(null);

  const applyFit = React.useCallback(() => {
    const page = pageRef.current;
    const inner = innerRef.current;
    if (!page || !inner) return;

    const overflows = () => inner.scrollHeight > inner.clientHeight + 1;

    for (const fit of AUTO_FIT_LEVELS) {
      page.dataset.fit = fit;

      if (!overflows() || fit === AUTO_FIT_LEVELS[AUTO_FIT_LEVELS.length - 1]) {
        break;
      }
    }
  }, []);

  const scheduleFit = React.useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applyFit();
    });
  }, [applyFit]);

  React.useLayoutEffect(() => {
    const page = pageRef.current;
    const inner = innerRef.current;
    if (!page || !inner) return;

    const ro = new ResizeObserver(scheduleFit);
    const fonts = document.fonts;

    ro.observe(page);
    ro.observe(inner);
    window.addEventListener("resize", scheduleFit);

    if (fonts) {
      void fonts.ready.then(() => {
        scheduleFit();
      });
    }

    fonts?.addEventListener?.("loadingdone", scheduleFit);

    scheduleFit();

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      ro.disconnect();
      window.removeEventListener("resize", scheduleFit);
      fonts?.removeEventListener?.("loadingdone", scheduleFit);
    };
  }, [scheduleFit]);

  React.useLayoutEffect(() => {
    scheduleFit();
  }, [fitToken, scheduleFit]);

  return { pageRef, innerRef };
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
    <section className={`sidebar-section sidebar-section--${variant.id}`}>
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
    <section className={`main-section main-section--${variant.id}`}>
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

function OneColumnSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="onecol-section">
      <div className="onecol-section-rule" />
      <h2 className="onecol-section-title">{title}</h2>
      <div className="onecol-section-body">{children}</div>
    </section>
  );
}

function buildPageVars(variant: ResumeVariant): React.CSSProperties {
  return {
    "--page-width": resumeLayoutSpec.page.width,
    "--page-height": resumeLayoutSpec.page.height,
    "--page-radius": resumeLayoutSpec.page.borderRadius,
    "--margin-top": variant.margins.top,
    "--margin-right": variant.margins.right,
    "--margin-bottom": variant.margins.bottom,
    "--margin-left": variant.margins.left,
    "--sidebar-width": variant.columns.sidebar,
    "--gutter-width": variant.columns.gutter,
    "--main-width": variant.columns.main,
    "--header-row-gap": variant.header.rowGap,
    "--header-bottom-padding": variant.header.bottomPadding,
    "--header-summary-width": variant.header.summaryMaxWidth,
    "--header-title-margin-top": variant.header.titleMarginTop,
    "--body-row-gap": variant.body.rowGap,
    "--sidebar-right-padding": variant.body.sidebarRightPadding,
    "--main-left-padding": variant.body.mainLeftPadding,
    "--sidebar-section-gap": variant.sidebarSection.marginBottom,
    "--sidebar-title-margin": variant.sidebarSection.titleMarginBottom,
    "--sidebar-title-padding": variant.sidebarSection.titlePaddingBottom,
    "--sidebar-content-gap": variant.sidebarSection.contentGap,
    "--main-section-gap": variant.mainSection.marginBottom,
    "--main-heading-gap": variant.mainSection.headingGap,
    "--main-heading-margin": variant.mainSection.headingMarginBottom,
    "--experience-date-column": variant.experience.dateColumn,
    "--experience-column-gap": variant.experience.columnGap,
    "--experience-item-gap": variant.experience.itemGap,
    "--experience-org-margin": variant.experience.orgMarginBottom,
    "--experience-bullets-padding": variant.experience.bulletsPaddingLeft,
    "--experience-bullets-gap": variant.experience.bulletsGap,
    "--project-gap": variant.projects.cardGap,
    "--project-padding": variant.projects.cardPadding,
    "--education-gap": variant.education.itemGap,
    "--skill-gap": variant.skills.gap,
    "--skill-padding-inline": variant.skills.paddingInline,
    "--skill-padding-block": variant.skills.paddingBlock,
    "--display-size-adjust": variant.density.displaySizeAdjust,
    "--title-size-adjust": variant.density.titleSizeAdjust,
    "--body-size-adjust": variant.density.bodySizeAdjust,
    "--body-sm-size-adjust": variant.density.bodySmSizeAdjust,
    "--section-gap-adjust": variant.density.sectionGapAdjust,
    "--heading-margin-adjust": variant.density.headingMarginAdjust,
    "--bullet-gap-adjust": variant.density.bulletGapAdjust,
    "--project-gap-adjust": variant.density.projectGapAdjust,
    "--project-padding-adjust": variant.density.projectPaddingAdjust,
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

function getInterestItems(data: ResumeData, limit = 6): string[] {
  const shortText = (value: string) =>
    value.trim() && value.trim().length <= 36;
  const fromProjects = data.projects
    .map((project) => project.name)
    .filter((value): value is string => Boolean(value && shortText(value)));
  const fromSkills = data.skills.filter((value) => shortText(value));
  const fromAchievements = (data.achievements ?? []).filter((value) =>
    shortText(value),
  );
  const values = [...fromProjects, ...fromSkills, ...fromAchievements];
  return Array.from(new Set(values)).slice(0, limit);
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
    case "studiopop":
      return {
        typography:
          "Expressive serif hierarchy, portrait-led framing, and warmer creative section blocks.",
        color:
          "Playful paper tones with peach, blue-grey, and ochre accents around a soft photo stage.",
      };
    case "softribbon":
      return {
        typography:
          "Rounded premium headings, portrait ribbon framing, and a softer project-manager voice.",
        color:
          "Blush neutrals, soft shadowed pills, and a calmer pastel support field.",
      };
    case "slateprofile":
      return {
        typography:
          "Structured all-caps labelling, dark profile rail, and tighter corporate information hierarchy.",
        color:
          "Slate and pearl contrast with restrained blue-grey emphasis and stronger section zoning.",
      };
    case "onecol":
      return {
        typography:
          "Single-column editorial rhythm with quieter contact and date captions.",
        color:
          "Soft paper field with calmer accent contrast for long-form reading.",
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

const QUIRE_SIDEBAR_WIDTH = "57mm";
const QUIRE_SIDEBAR_BG =
  "color-mix(in srgb, var(--color-accent) 18%, #1a1a1a 82%)";
const QUIRE_SIDEBAR_RULE = "rgba(255,255,255,0.18)";
const QUIRE_SIDEBAR_LABEL_COLOR = "rgba(255,255,255,0.46)";
const QUIRE_SIDEBAR_TEXT_PRIMARY = "#ffffff";
const QUIRE_SIDEBAR_TEXT_SECONDARY = "rgba(255,255,255,0.62)";
const QUIRE_SIDEBAR_ACCENT =
  "color-mix(in srgb, var(--color-accent-soft) 80%, white 20%)";
const QUIRE_MAIN_SECTION_HEADING: React.CSSProperties = {
  margin: 0,
  fontSize: "2.3mm",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.24em",
  color: "var(--color-accent)",
  paddingBottom: "1.5mm",
  borderBottom:
    "0.26mm solid color-mix(in srgb, var(--color-border-strong) 58%, transparent)",
  marginBottom: "2.8mm",
};
const QUIRE_SIDEBAR_SECTION_HEADING: React.CSSProperties = {
  margin: "0 0 1.6mm",
  fontSize: "2mm",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.28em",
  color: QUIRE_SIDEBAR_LABEL_COLOR,
  paddingBottom: "1.3mm",
  borderBottom: `0.2mm solid ${QUIRE_SIDEBAR_RULE}`,
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);

  const email = findLabeledValue(data.contact, ["email"]);
  const phone = findLabeledValue(data.contact, ["phone"]);
  const location =
    findLabeledValue(data.metadata, ["location", "city", "based"]) ??
    findLabeledValue(data.contact, ["location", "city"]);
  const web = findLabeledValue(data.contact, ["web", "portfolio", "site"]);
  const headerContact = uniqueRows(
    [
      phone ? { label: "phone", value: phone } : null,
      location ? { label: "location", value: location } : null,
      email ? { label: "email", value: email } : null,
      web ? { label: "web", value: web } : null,
    ],
  );

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
          background: "var(--paper)", /* --paper (#faf9f5) = warm document sheet */
          border: "0.36mm solid rgba(0,0,0,0.15)",
          overflow: "hidden",
          fontFamily: "var(--font-body-family)",
          borderRadius: "var(--page-radius)",
        }}
        aria-label={variant.label}
      >
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
            style={{
              display: "grid",
              gridTemplateColumns: `${QUIRE_SIDEBAR_WIDTH} 1fr`,
            }}
          >
            {/* Name + title on dark */}
            <div style={{ padding: "13mm 8mm 8mm 12mm" }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body-family)",
                  fontSize: "11mm",
                  lineHeight: 0.94,
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
                  margin: "2.8mm 0 0",
                  fontSize: "2.8mm",
                  lineHeight: 1.15,
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
                padding: "13mm 13mm 8mm 10mm",
                display: "grid",
                gap: "1.4mm",
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
                    fontSize: "2.62mm",
                    lineHeight: 1.3,
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
                  style={{
                    margin: "1.8mm 0 0",
                    fontSize: "2.52mm",
                    lineHeight: 1.5,
                    color: "var(--color-text-muted)",
                    textAlign: "right",
                    maxWidth: "88mm",
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
                padding: "6mm 8mm 13mm 12mm",
                display: "grid",
                gap: "5mm",
                alignContent: "start",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {/* Education */}
              <section>
                <h2 style={QUIRE_SIDEBAR_SECTION_HEADING}>Education</h2>
                <div style={{ display: "grid", gap: "3mm" }}>
                  {data.education.map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{ display: "grid", gap: "0.4mm" }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.1mm",
                          color: QUIRE_SIDEBAR_ACCENT,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          fontFamily:
                            "SFMono-Regular, IBM Plex Mono, Menlo, monospace",
                        }}
                      >
                        {item.period}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.65mm",
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
                          fontSize: "2.3mm",
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
                    gap: "0.82mm",
                  }}
                >
                  {data.skills.map((skill) => (
                    <li
                      key={skill}
                      style={{
                        position: "relative",
                        paddingLeft: "2.8mm",
                        fontSize: "2.54mm",
                        color: "rgba(255,255,255,0.76)",
                        lineHeight: 1.3,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "1.3mm",
                          width: "0.9mm",
                          height: "0.9mm",
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
                  <div style={{ display: "grid", gap: "1.8mm" }}>
                    {data.languages.map((lang) => (
                      <div key={lang.name} style={{ display: "grid", gap: "0.22mm" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.62mm",
                            color: QUIRE_SIDEBAR_TEXT_PRIMARY,
                            fontWeight: 600,
                          }}
                        >
                          {lang.name}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.22mm",
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
                padding: "6mm 13mm 13mm 10mm",
                display: "grid",
                gap: "4.6mm",
                alignContent: "start",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {/* Experience */}
              <section>
                <h2 style={QUIRE_MAIN_SECTION_HEADING}>Experience</h2>
                <div style={{ display: "grid", gap: "3.6mm" }}>
                  {data.experience.map((item) => (
                    <article
                      key={`${item.company}-${item.role}`}
                      style={{
                        display: "grid",
                        gap: "0.5mm",
                        paddingTop: "2.5mm",
                        borderTop:
                          "0.2mm solid color-mix(in srgb, var(--color-border) 78%, transparent)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "4mm",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "3.1mm",
                            fontWeight: 700,
                            color: "var(--color-text)",
                            lineHeight: 1.1,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {item.company}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.2mm",
                            color: "var(--color-text-subtle)",
                            lineHeight: 1.2,
                            flexShrink: 0,
                            fontFamily:
                              "SFMono-Regular, IBM Plex Mono, Menlo, monospace",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {item.period}
                        </p>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.82mm",
                          fontStyle: "italic",
                          color:
                            "color-mix(in srgb, var(--color-accent) 72%, var(--color-text) 28%)",
                          lineHeight: 1.24,
                          fontFamily: "var(--font-heading-family)",
                        }}
                      >
                        {item.role}
                        {item.location ? (
                          <span
                            style={{
                              fontStyle: "normal",
                              color: "var(--color-text-muted)",
                              fontSize: "2.54mm",
                            }}
                          >
                            {" · "}
                            {item.location}
                          </span>
                        ) : null}
                      </p>
                      <ul
                        style={{
                          margin: "1.3mm 0 0",
                          padding: 0,
                          paddingLeft: "3.4mm",
                          display: "grid",
                          gap: "0.78mm",
                          listStyle: "disc",
                        }}
                      >
                        {item.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            style={{
                              fontSize: "2.5mm",
                              lineHeight: 1.46,
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
                      gap: "2.2mm",
                    }}
                  >
                    {data.projects.map((project) => (
                      <article
                        key={project.name}
                        style={{
                          display: "grid",
                          gap: "0.5mm",
                          paddingTop: "2.2mm",
                          borderTop:
                            "0.24mm solid color-mix(in srgb, var(--color-border) 82%, transparent)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.75mm",
                            fontWeight: 700,
                            color: "var(--color-text)",
                            lineHeight: 1.2,
                            fontFamily: "var(--font-heading-family)",
                            fontStyle: "italic",
                          }}
                        >
                          {project.name}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.3mm",
                            color: "var(--color-accent)",
                            lineHeight: 1.2,
                          }}
                        >
                          {project.meta}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "2.38mm",
                            lineHeight: 1.44,
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
  const pageVars = buildPageVars(variant);
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
        style={{ ...pageVars, background: "var(--paper)", fontFamily: "var(--font-body-family)" }}
        aria-label={variant.label}
      >
        <div ref={innerRef} className="resume-inner">
          <header className="resume-header">
            <div className="header-copy">
              <p className="eyebrow">Résumé</p>
              <h1 className="name">{data.name}</h1>
              <p className="title">{data.title}</p>
              <p className="summary">{data.summary}</p>
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

function OneColumnPage({
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);

  const emailItem = data.contact.find(
    (item) => item.label.toLowerCase() === "email",
  );

  const phoneItem = data.contact.find(
    (item) => item.label.toLowerCase() === "phone",
  );

  const portfolioItem =
    data.contact.find((item) => item.label.toLowerCase() === "web") ??
    data.contact.find((item) => item.label.toLowerCase() === "portfolio") ??
    data.metadata.find((item) => item.label.toLowerCase() === "portfolio");

  const onecolMetaItems: OnecolMetaItem[] = [
    phoneItem ? { label: "Phone", value: phoneItem.value } : null,
    emailItem ? { label: "Email", value: emailItem.value } : null,
    portfolioItem ? { label: "Portfolio", value: portfolioItem.value } : null,
  ].filter((item): item is OnecolMetaItem => item !== null);

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
        style={{ ...pageVars, background: "var(--paper)", fontFamily: "var(--font-body-family)" }}
        aria-label={variant.label}
      >
        <div ref={innerRef} className="resume-inner resume-inner--onecol">
          <header className="onecol-header">
            <div className="header-copy header-copy--onecol">
              <h1 className="name name--onecol">{data.name}</h1>
              <p className="title title--onecol">{data.title}</p>
              <p className="summary summary--onecol">{data.summary}</p>
            </div>

            <dl
              className="onecol-meta"
              aria-label="Resume metadata"
              style={{
                gridTemplateColumns: `repeat(${Math.max(
                  1,
                  onecolMetaItems.length,
                )}, minmax(0, 1fr))`,
              }}
            >
              {onecolMetaItems.map((item) => (
                <div key={item.label} className="onecol-meta-item">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <main className="onecol-main">
            <OneColumnSection title="Experience">
              <div className="onecol-experience-stack">
                {data.experience.map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    className="onecol-entry"
                  >
                    <div className="onecol-entry-head">
                      <div>
                        <div className="onecol-entry-eyebrow">
                          {item.company}
                        </div>
                        <h3 className="entry-title">{item.role}</h3>
                        <p className="entry-subtitle">{item.location}</p>
                      </div>
                      <p className="experience-period">{item.period}</p>
                    </div>

                    <ul className="bullet-list bullet-list--onecol">
                      {item.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </OneColumnSection>

            {!!data.achievements?.length && (
              <OneColumnSection title="Achievements">
                <ul className="bullet-list bullet-list--onecol bullet-list--achievements">
                  {data.achievements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </OneColumnSection>
            )}

            <OneColumnSection title="Education">
              <div className="education-stack education-stack--onecol">
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
            </OneColumnSection>

            <OneColumnSection title="Skills">
              <ul className="skills-list skills-list--onecol">
                {data.skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </OneColumnSection>

            <OneColumnSection title="Languages">
              <ul className="compact-list compact-list--languages compact-list--onecol">
                {data.languages.map((language) => (
                  <li key={language.name}>
                    <span className="label">{language.name}</span>
                    <span className="value">{language.level}</span>
                  </li>
                ))}
              </ul>
            </OneColumnSection>

            <div className="onecol-bottom-space" />
          </main>
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
  const pageVars = buildPageVars(variant);
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
          background: "var(--paper)", /* --paper (#faf9f5) = warm document sheet */
          borderColor: "rgba(17, 17, 17, 0.18)",
          borderWidth: "0.6mm",
          boxShadow: "0 5mm 14mm rgba(18, 12, 8, 0.08)",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <div
          style={{
            position: "absolute",
            inset: "12mm",
            border: "0.46mm solid rgba(17, 17, 17, 0.18)",
            pointerEvents: "none",
          }}
        />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            padding: "18mm 16mm 18mm 18mm",
            display: "grid",
            gridTemplateRows: "auto auto minmax(0, 1fr) auto",
            gap: "4.4mm",
          }}
        >
          <header
            style={{
              display: "grid",
              gap: "3.2mm",
              alignItems: "start",
              paddingBottom: "4.2mm",
              borderBottom: "0.34mm solid rgba(17, 17, 17, 0.28)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              {topContact.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.6mm 4mm",
                    marginBottom: "3.2mm",
                    color: "rgba(17, 17, 17, 0.64)",
                    fontSize: "2.7mm",
                    lineHeight: 1.35,
                  }}
                >
                  {topContact.map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </div>
              ) : null}
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "16.1mm",
                  lineHeight: 0.86,
                  letterSpacing: "0.11em",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  maxWidth: "130mm",
                  color: "#111111",
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: "3.2mm 0 0",
                  maxWidth: "112mm",
                  fontSize: "3.55mm",
                  lineHeight: 1.38,
                  color: "rgba(17, 17, 17, 0.72)",
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
                style={{
                  margin: 0,
                  maxWidth: "104mm",
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "5.25mm",
                  lineHeight: 1.08,
                  letterSpacing: "0.03em",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#111111",
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
            style={{ display: "grid", gap: "3.2mm", alignContent: "start" }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.2mm",
                  lineHeight: 1.15,
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
                  gridTemplateColumns: "minmax(0, 1fr) 39mm",
                  gap: "5mm",
                  alignItems: "start",
                  paddingTop: "2.8mm",
                  borderTop: "0.24mm solid rgba(17, 17, 17, 0.24)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      margin: "0 0 1.3mm",
                      fontSize: "5.4mm",
                      lineHeight: 1.02,
                      fontWeight: 800,
                      letterSpacing: "0.01em",
                      textTransform: "uppercase",
                      color: "#111111",
                    }}
                  >
                    {item.role}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "3mm",
                      lineHeight: 1.28,
                      fontWeight: 700,
                      color: "#111111",
                    }}
                  >
                    {item.company}
                  </p>
                  <ul
                    style={{
                      margin: "2.2mm 0 0",
                      paddingLeft: "4mm",
                      display: "grid",
                      gap: "1.2mm",
                      color: "rgba(17, 17, 17, 0.72)",
                      fontSize: "2.8mm",
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
                    paddingLeft: "3mm",
                    borderLeft: "0.32mm solid rgba(41, 34, 28, 0.16)",
                    display: "grid",
                    gap: "2.35mm",
                  }}
                >
                  {uniqueRows([
                    { label: "period", value: item.period },
                    { label: "location", value: item.location },
                    { label: "company", value: item.company },
                  ]).map((row) => (
                    <div
                      key={row.label}
                      style={{ display: "grid", gap: "0.7mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.9mm",
                          lineHeight: 1.46,
                          color: "rgba(17, 17, 17, 0.76)",
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
              paddingTop: "2.8mm",
              borderTop: "0.42mm solid rgba(17, 17, 17, 0.28)",
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.25fr) minmax(0, 0.85fr) minmax(0, 0.9fr)",
              gap: "3.2mm",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "1.4mm" }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: "2.1mm",
                  lineHeight: 1.2,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(17, 17, 17, 0.52)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Achievements
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "4mm",
                  display: "grid",
                  gap: "0.8mm",
                  color: "rgba(17, 17, 17, 0.72)",
                  fontSize: "2.55mm",
                  lineHeight: 1.38,
                }}
              >
                {supportAchievements.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: "grid", gap: "1.4mm", minWidth: 0 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: "2.1mm",
                  lineHeight: 1.2,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(17, 17, 17, 0.52)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Education
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.8mm",
                  lineHeight: 1.5,
                  color: "rgba(17, 17, 17, 0.72)",
                }}
              >
                {supportEducation ? (
                  <>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 700,
                        color: "#111111",
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
            <div style={{ display: "grid", gap: "1.4mm", minWidth: 0 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: "2.1mm",
                  lineHeight: 1.2,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "rgba(17, 17, 17, 0.52)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                Skills
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.55mm",
                  lineHeight: 1.42,
                  color: "rgba(17, 17, 17, 0.72)",
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const contactRows = data.contact.slice(0, 4);
  const metadataRows = data.metadata.slice(0, 3);

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
            "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 94%, var(--sf1) 6%))", /* --paper base, faint sf1 tint toward foot */
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
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
            rowGap: "6.6mm",
          }}
        >
          <header
            style={{
              display: "grid",
              gap: "4mm",
              paddingBottom: "5mm",
              borderBottom: "0.34mm solid rgba(32, 27, 22, 0.16)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "4mm",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "2.2mm",
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
                  fontSize: "2.2mm",
                  lineHeight: 1.15,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(32, 27, 22, 0.5)",
                  fontFamily: "var(--font-body-family)",
                }}
              >
                {variant.label}
              </p>
            </div>

            <div style={{ display: "grid", gap: "3.2mm", maxWidth: "124mm" }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "14.2mm",
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
                  fontSize: "3.8mm",
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
                style={{
                  margin: 0,
                  maxWidth: "112mm",
                  fontSize: "3.45mm",
                  lineHeight: 1.55,
                  color: "rgba(32, 27, 22, 0.76)",
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
              gridTemplateColumns: "104mm 17.5mm 36mm",
            }}
          >
            <main
              style={{
                minWidth: 0,
                display: "grid",
                gap: "5.2mm",
                alignContent: "start",
              }}
            >
              <section style={{ display: "grid", gap: "2.6mm" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3mm",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "2.2mm",
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
                      height: "0.28mm",
                      flex: 1,
                      background:
                        "linear-gradient(90deg, rgba(32, 27, 22, 0.28), transparent 78%)",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: "4.2mm" }}>
                  {data.experience.slice(0, 3).map((item, index) => (
                    <article
                      key={`${item.company}-${item.role}-${item.period}-${index}`}
                      style={{
                        display: "grid",
                        gap: "1.6mm",
                        paddingTop: "3mm",
                        borderTop: "0.24mm solid rgba(32, 27, 22, 0.12)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: "4mm",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "2.2mm",
                              lineHeight: 1.15,
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              color: "rgba(32, 27, 22, 0.48)",
                              fontFamily: "var(--font-body-family)",
                              fontWeight: 700,
                            }}
                          >
                            {item.company}
                          </p>
                          <h3
                            style={{
                              margin: "1mm 0 0",
                              fontFamily: "var(--font-heading-family)",
                              fontSize: "5mm",
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
                            fontSize: "2.2mm",
                            lineHeight: 1.25,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "rgba(32, 27, 22, 0.5)",
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
                          fontSize: "2.8mm",
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
                          paddingLeft: "4mm",
                          display: "grid",
                          gap: "1.1mm",
                          color: "rgba(32, 27, 22, 0.76)",
                          fontSize: "2.8mm",
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

              <section style={{ display: "grid", gap: "2.6mm" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3mm",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "2.2mm",
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
                      height: "0.28mm",
                      flex: 1,
                      background:
                        "linear-gradient(90deg, rgba(32, 27, 22, 0.28), transparent 78%)",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: "3.2mm" }}>
                  {data.projects.slice(0, 2).map((project, index) => (
                    <article
                      key={`${project.name}-${project.meta}-${index}`}
                      style={{
                        padding: "3mm 0 0",
                        borderTop: "0.24mm solid rgba(32, 27, 22, 0.12)",
                        display: "grid",
                        gap: "1.4mm",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "4.7mm",
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
                          fontSize: "2.2mm",
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "rgba(32, 27, 22, 0.52)",
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {project.meta}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.8mm",
                          lineHeight: 1.5,
                          color: "rgba(32, 27, 22, 0.76)",
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
              style={{ borderRight: "0.24mm solid rgba(32, 27, 22, 0.12)" }}
            />

            <aside
              style={{
                minWidth: 0,
                paddingLeft: "0mm",
                display: "grid",
                gap: "4.6mm",
                alignContent: "start",
              }}
            >
              <section style={{ display: "grid", gap: "2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.2mm",
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
                <div style={{ display: "grid", gap: "1.6mm" }}>
                  {contactRows.map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "grid", gap: "0.5mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.05mm",
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "rgba(32, 27, 22, 0.48)",
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: "2.7mm",
                          lineHeight: 1.42,
                          color: "rgba(32, 27, 22, 0.76)",
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ display: "grid", gap: "2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.2mm",
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
                <div style={{ display: "grid", gap: "1.6mm" }}>
                  {metadataRows.map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "grid", gap: "0.5mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.05mm",
                          lineHeight: 1.2,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "rgba(32, 27, 22, 0.48)",
                          fontFamily: "var(--font-body-family)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: "2.7mm",
                          lineHeight: 1.42,
                          color: "rgba(32, 27, 22, 0.76)",
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ display: "grid", gap: "2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.2mm",
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
                    fontSize: "2.7mm",
                    lineHeight: 1.5,
                    color: "rgba(32, 27, 22, 0.76)",
                  }}
                >
                  {data.skills.slice(0, 8).join(", ")}
                </p>
              </section>

              <section style={{ display: "grid", gap: "2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.2mm",
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
                <div style={{ display: "grid", gap: "1.6mm" }}>
                  {data.education.slice(0, 2).map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{ display: "grid", gap: "0.6mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.7mm",
                          lineHeight: 1.34,
                          color: "var(--color-text)",
                          fontWeight: 600,
                        }}
                      >
                        {item.degree}
                      </span>
                      <span
                        style={{
                          fontSize: "2.5mm",
                          lineHeight: 1.4,
                          color: "rgba(32, 27, 22, 0.68)",
                        }}
                      >
                        {item.school}
                      </span>
                      <span
                        style={{
                          fontSize: "2.05mm",
                          lineHeight: 1.2,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "rgba(32, 27, 22, 0.48)",
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

function StudioPopPage({
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const interestItems = getInterestItems(data, 5);

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
          background: "linear-gradient(180deg, #fffaf2 0%, #fff7ef 100%)",
          borderColor: "rgba(148, 112, 67, 0.14)",
          overflow: "hidden",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 76% 12%, rgba(240, 198, 210, 0.9) 0, rgba(240, 198, 210, 0.9) 10.5%, transparent 10.7%), radial-gradient(circle at 88% 18%, rgba(189, 206, 214, 0.88) 0, rgba(189, 206, 214, 0.88) 13.8%, transparent 14%), linear-gradient(140deg, rgba(136, 153, 181, 0.34) 0, rgba(136, 153, 181, 0.34) 4.5%, transparent 4.7%)",
            pointerEvents: "none",
          }}
        />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            padding: "18mm 18mm 18mm 18mm",
            display: "grid",
            gridTemplateColumns: "58mm minmax(0, 1fr)",
            columnGap: "10mm",
            minHeight: 0,
          }}
        >
          <aside
            style={{
              display: "grid",
              alignContent: "start",
              gap: "4.2mm",
              minWidth: 0,
            }}
          >
            <div style={{ display: "grid", gap: "3.2mm" }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "10.5mm",
                  lineHeight: 0.96,
                  letterSpacing: "-0.05em",
                  fontWeight: 500,
                  color: "#39322b",
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "3.2mm",
                  lineHeight: 1.35,
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                {data.title}
              </p>
            </div>

            <section style={{ display: "grid", gap: "1.7mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "4.1mm",
                  lineHeight: 1.08,
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Profile
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.85mm",
                  lineHeight: 1.55,
                  color: "rgba(57, 50, 43, 0.82)",
                }}
              >
                {data.summary}
              </p>
            </section>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "4mm",
                  lineHeight: 1.08,
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Languages
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.8mm",
                  lineHeight: 1.58,
                  color: "rgba(57, 50, 43, 0.82)",
                }}
              >
                {data.languages.length > 0
                  ? data.languages
                      .map(
                        (item) =>
                          `${item.name} ${item.level ? `| ${item.level}` : ""}`,
                      )
                      .join(" | ")
                  : "Languages pending."}
              </p>
            </section>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "4mm",
                  lineHeight: 1.08,
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Competences
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "3.5mm",
                  display: "grid",
                  gap: "0.8mm",
                  fontSize: "2.75mm",
                  lineHeight: 1.5,
                  color: "rgba(57, 50, 43, 0.82)",
                }}
              >
                {data.skills.slice(0, 6).map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </section>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "4mm",
                  lineHeight: 1.08,
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Coordonnees
              </p>
              <div style={{ display: "grid", gap: "1mm" }}>
                {data.contact.slice(0, 4).map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "3.2mm minmax(0, 1fr)",
                      gap: "1.4mm",
                      alignItems: "start",
                      fontSize: "2.75mm",
                      lineHeight: 1.48,
                      color: "rgba(57, 50, 43, 0.82)",
                    }}
                  >
                    <span
                      style={{ color: "var(--color-accent)", fontWeight: 700 }}
                    >
                      ●
                    </span>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <main
            style={{
              display: "grid",
              alignContent: "start",
              gap: "4.6mm",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 48mm",
                gap: "6mm",
                alignItems: "start",
              }}
            >
              <div />
              <div
                style={{
                  justifySelf: "end",
                  width: "46mm",
                  height: "41mm",
                  overflow: "hidden",
                  borderRadius: "14mm 0 14mm 14mm",
                  boxShadow: "0 4mm 12mm rgba(89, 67, 40, 0.12)",
                  background: "rgba(255,255,255,0.64)",
                }}
              >
                <PhotoOrInitials name={data.name} src={data.photoUrl} />
              </div>
            </div>

            <section style={{ display: "grid", gap: "2mm" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "5mm",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Parcours Universitaire
              </h2>
              <div style={{ display: "grid", gap: "3.2mm" }}>
                {data.education.slice(0, 2).map((item) => (
                  <article
                    key={`${item.school}-${item.degree}`}
                    style={{ display: "grid", gap: "1mm" }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "3.2mm",
                        lineHeight: 1.35,
                        color: "#39322b",
                        fontWeight: 700,
                      }}
                    >
                      {item.school}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.8mm",
                        lineHeight: 1.48,
                        color: "rgba(57, 50, 43, 0.82)",
                      }}
                    >
                      {item.degree}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.35mm",
                        lineHeight: 1.35,
                        color: "rgba(57, 50, 43, 0.6)",
                      }}
                    >
                      {item.period}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "2mm" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "5mm",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Carriere Professionnelle
              </h2>
              <div style={{ display: "grid", gap: "3.3mm" }}>
                {data.experience.slice(0, 3).map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    style={{
                      display: "grid",
                      gap: "1.1mm",
                      paddingTop: "2.8mm",
                      borderTop:
                        "0.24mm solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "3.1mm",
                        lineHeight: 1.32,
                        color: "#39322b",
                        fontWeight: 700,
                      }}
                    >
                      {item.role}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.8mm",
                        lineHeight: 1.45,
                        color: "rgba(57, 50, 43, 0.74)",
                      }}
                    >
                      {item.company} / {item.location}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.45mm",
                        lineHeight: 1.34,
                        color: "rgba(57, 50, 43, 0.56)",
                      }}
                    >
                      {item.period}
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "3.8mm",
                        display: "grid",
                        gap: "0.8mm",
                        fontSize: "2.7mm",
                        lineHeight: 1.48,
                        color: "rgba(57, 50, 43, 0.82)",
                      }}
                    >
                      {item.bullets.slice(0, 3).map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            {interestItems.length > 0 ? (
              <section style={{ display: "grid", gap: "1.8mm" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "4.4mm",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  Interests
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.7mm",
                    lineHeight: 1.54,
                    color: "rgba(57, 50, 43, 0.74)",
                  }}
                >
                  {interestItems.join(" / ")}
                </p>
              </section>
            ) : null}
          </main>
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const sideMeta = uniqueRows(data.contact).slice(0, 3);
  const railSkills = data.skills.slice(0, 6);
  const projectCards = data.projects.slice(0, 2);

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
            "linear-gradient(180deg, var(--paper), color-mix(in srgb, var(--paper) 96%, var(--sf1) 4%))", /* --paper base, barely-there sf1 tint */
          borderColor: "var(--color-border)",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "40mm minmax(0, 1fr)",
            gap: "17mm",
            alignItems: "stretch",
          }}
        >
          <aside
            style={{
              minHeight: "100%",
              padding: "17mm 4mm 35mm",
              display: "grid",
              alignContent: "start",
              gap: "4.2mm",
              borderRadius: "8mm 0 18mm 0",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-muted) 88%), color-mix(in srgb, var(--color-accent) 18%, var(--color-surface-muted) 82%))",
              borderRight:
                "0.24mm solid color-mix(in srgb, var(--color-border) 70%, transparent)",
            }}
          >
            <div
              style={{ display: "grid", justifyItems: "center", gap: "2mm" }}
            >
              <div
                style={{
                  width: "22mm",
                  height: "22mm",
                  borderRadius: "999px",
                  overflow: "hidden",
                  border:
                    "0.5mm solid color-mix(in srgb, var(--color-surface-raised) 86%, var(--color-accent) 14%)",
                  boxShadow:
                    "0 2mm 6mm color-mix(in srgb, var(--color-text) 6%, transparent)",
                }}
              >
                <PhotoOrInitials name={data.name} src={data.photoUrl} />
              </div>
            </div>

            <div style={{ display: "grid", gap: "3.2mm" }}>
              <section style={{ display: "grid", gap: "1.2mm" }}>
                <div style={{ display: "grid", gap: "0.8mm" }}>
                  {sideMeta.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      style={{ display: "grid", gap: "0.1mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.35mm",
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

              <section style={{ display: "grid", gap: "1.2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.05mm",
                    lineHeight: 1.2,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--color-text-subtle)",
                    fontWeight: 700,
                  }}
                >
                  Languages
                </p>
                <div style={{ display: "grid", gap: "0.75mm" }}>
                  {data.languages.slice(0, 3).map((item) => (
                    <div
                      key={item.name}
                      style={{ display: "grid", gap: "0.18mm" }}
                    >
                      <span
                        style={{
                          fontSize: "2.35mm",
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "2.15mm",
                          color: "var(--color-text-subtle)",
                        }}
                      >
                        {item.level}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ display: "grid", gap: "1.2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.05mm",
                    lineHeight: 1.2,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--color-text-subtle)",
                    fontWeight: 700,
                  }}
                >
                  Skills
                </p>
                <div style={{ display: "grid", gap: "0.7mm" }}>
                  {railSkills.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontSize: "2.25mm",
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
              gap: "5.4mm",
              alignContent: "start",
              minWidth: 0,
              paddingTop: "17mm",
              paddingRight: "17mm",
              paddingBottom: "35mm",
            }}
          >
            <header
              style={{
                display: "grid",
                gap: "2.6mm",
                paddingBottom: "4.4mm",
                borderBottom:
                  "0.34mm solid color-mix(in srgb, var(--color-accent) 16%, var(--color-border-strong) 84%)",
              }}
            >
              <div style={{ display: "grid", gap: "2mm" }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading-family)",
                    fontSize: "15.8mm",
                    lineHeight: 0.86,
                    letterSpacing: "0.05em",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "var(--color-text)",
                    maxWidth: "104mm",
                  }}
                >
                  {data.name}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: "3.1mm",
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
                style={{
                  margin: 0,
                  maxWidth: "88mm",
                  paddingTop: "2mm",
                  borderTop:
                    "0.6mm solid color-mix(in srgb, var(--color-accent) 62%, transparent)",
                  fontSize: "3.05mm",
                  lineHeight: 1.56,
                  color: "var(--color-text)",
                }}
              >
                {data.summary}
              </p>
            </header>

            <section style={{ display: "grid", gap: "2.4mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.15mm",
                  lineHeight: 1.2,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
              >
                Experience
              </p>
              <div style={{ display: "grid", gap: "3.6mm" }}>
                {data.experience.slice(0, 3).map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "19mm minmax(0, 1fr)",
                      gap: "4mm",
                      alignItems: "start",
                      paddingTop: "2.8mm",
                      borderTop:
                        "0.24mm solid color-mix(in srgb, var(--color-border-strong) 76%, transparent)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.25mm",
                        lineHeight: 1.35,
                        color: "var(--color-text-subtle)",
                        textTransform: "uppercase",
                        letterSpacing: "0.16em",
                      }}
                    >
                      {item.period}
                    </p>
                    <div style={{ display: "grid", gap: "0.9mm" }}>
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "3.7mm",
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
                          fontSize: "2.65mm",
                          lineHeight: 1.42,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.company} / {item.location}
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "3.8mm",
                          display: "grid",
                          gap: "0.8mm",
                          fontSize: "2.65mm",
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
                gap: "4.2mm",
                paddingTop: "2.8mm",
                borderTop:
                  "0.24mm solid color-mix(in srgb, var(--color-border-strong) 76%, transparent)",
              }}
            >
              <div style={{ display: "grid", gap: "2.2mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.15mm",
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
                    gap: "2.2mm",
                  }}
                >
                  {projectCards.map((item) => (
                    <article
                      key={item.name}
                      style={{
                        display: "grid",
                        gap: "0.8mm",
                        padding: "2.4mm",
                        borderRadius: "2.2mm",
                        border:
                          "0.22mm solid color-mix(in srgb, var(--color-border) 72%, transparent)",
                        background:
                          "color-mix(in srgb, var(--color-surface-muted) 52%, var(--color-surface-raised) 48%)",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "3.05mm",
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
                          fontSize: "2.4mm",
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

              <div style={{ display: "grid", gap: "2.1mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.15mm",
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
                    gap: "3.6mm 5mm",
                  }}
                >
                  {data.education.slice(0, 2).map((item) => (
                    <div
                      key={`${item.school}-${item.degree}`}
                      style={{ display: "grid", gap: "0.35mm" }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading-family)",
                          fontSize: "2.8mm",
                          lineHeight: 1.22,
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {item.degree}
                      </span>
                      <span
                        style={{
                          fontSize: "2.35mm",
                          lineHeight: 1.4,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.school}
                      </span>
                      <span
                        style={{
                          fontSize: "2.15mm",
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

function SoftRibbonPage({
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const interestItems = getInterestItems(data, 6);

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
          background: "linear-gradient(180deg, #fcf7f6 0%, #fffaf9 100%)",
          borderColor: "rgba(110, 95, 100, 0.12)",
          overflow: "hidden",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 82% 8%, color-mix(in srgb, var(--color-accent-soft) 72%, white 28%) 0, color-mix(in srgb, var(--color-accent-soft) 72%, white 28%) 8%, transparent 8.2%)",
            pointerEvents: "none",
          }}
        />
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            padding: "18mm",
            display: "grid",
            gridTemplateColumns: "60mm minmax(0, 1fr)",
            gap: "10mm",
          }}
        >
          <aside
            style={{
              borderRadius: "0 0 0 0",
              background:
                "linear-gradient(180deg, rgba(247, 238, 239, 0.96), rgba(244, 235, 236, 0.96))",
              padding: "10mm 7mm 8mm",
              display: "grid",
              gap: "3.6mm",
              alignContent: "start",
              minWidth: 0,
            }}
          >
            <div style={{ display: "grid", gap: "1.6mm" }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "9.8mm",
                  lineHeight: 0.94,
                  color: "var(--color-text)",
                  fontWeight: 600,
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.7mm",
                  lineHeight: 1.25,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color:
                    "color-mix(in srgb, var(--color-accent) 72%, var(--color-text) 28%)",
                  fontWeight: 700,
                }}
              >
                {data.title}
              </p>
            </div>

            <section style={{ display: "grid", gap: "1.3mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "3.2mm",
                  lineHeight: 1.3,
                  color: "var(--color-accent)",
                }}
              >
                Contact
              </p>
              <div style={{ display: "grid", gap: "0.9mm" }}>
                {data.contact.slice(0, 3).map((item) => (
                  <p
                    key={item.label}
                    style={{
                      margin: 0,
                      fontSize: "2.7mm",
                      lineHeight: 1.48,
                      color: "rgba(79, 71, 71, 0.72)",
                    }}
                  >
                    {item.value}
                  </p>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "1.3mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "3.2mm",
                  lineHeight: 1.3,
                  color: "var(--color-accent)",
                }}
              >
                Languages
              </p>
              <div style={{ display: "grid", gap: "0.9mm" }}>
                {data.languages.slice(0, 3).map((item) => (
                  <div
                    key={item.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18mm minmax(0, 1fr)",
                      gap: "1mm",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "2.65mm",
                        color: "var(--color-accent)",
                        fontWeight: 700,
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: "2.55mm",
                        color: "rgba(79, 71, 71, 0.58)",
                      }}
                    >
                      {item.level}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "1.3mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "3.2mm",
                  lineHeight: 1.3,
                  color: "var(--color-accent)",
                }}
              >
                Competences
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.65mm",
                  lineHeight: 1.58,
                  color: "rgba(79, 71, 71, 0.68)",
                }}
              >
                {data.skills.slice(0, 8).join(" / ")}
              </p>
            </section>

            {interestItems.length > 0 ? (
              <section style={{ display: "grid", gap: "1.3mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "3.2mm",
                    lineHeight: 1.3,
                    color: "var(--color-accent)",
                  }}
                >
                  Centres d’interet
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.65mm",
                    lineHeight: 1.58,
                    color: "rgba(79, 71, 71, 0.68)",
                  }}
                >
                  {interestItems.join(" / ")}
                </p>
              </section>
            ) : null}
          </aside>

          <main
            style={{
              display: "grid",
              alignContent: "start",
              gap: "4mm",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 42mm",
                gap: "6mm",
                alignItems: "start",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.7mm",
                    lineHeight: 1.55,
                    color: "rgba(79, 71, 71, 0.72)",
                  }}
                >
                  {data.summary}
                </p>
              </div>
              <div
                style={{
                  width: "38mm",
                  height: "38mm",
                  justifySelf: "end",
                  borderRadius: "50% 50% 42% 42%",
                  overflow: "hidden",
                  boxShadow: "0 4mm 10mm rgba(114, 97, 101, 0.14)",
                  border: "1.2mm solid rgba(255,255,255,0.88)",
                  background: "rgba(255,255,255,0.86)",
                }}
              >
                <PhotoOrInitials name={data.name} src={data.photoUrl} />
              </div>
            </div>

            <section style={{ display: "grid", gap: "2.4mm" }}>
              <div
                style={{
                  alignSelf: "start",
                  width: "fit-content",
                  padding: "2.1mm 8mm",
                  borderRadius: "999px",
                  background:
                    "color-mix(in srgb, var(--color-accent-soft) 74%, white 26%)",
                  color:
                    "color-mix(in srgb, var(--color-accent) 68%, var(--color-text) 32%)",
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "4mm",
                }}
              >
                Formations
              </div>
              <div style={{ display: "grid", gap: "3mm" }}>
                {data.education.slice(0, 3).map((item) => (
                  <article
                    key={`${item.school}-${item.degree}`}
                    style={{ display: "grid", gap: "0.9mm" }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.55mm",
                        color: "rgba(102, 93, 95, 0.62)",
                      }}
                    >
                      {item.period}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.9mm",
                        color: "var(--color-accent)",
                        fontWeight: 700,
                      }}
                    >
                      {item.degree}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.65mm",
                        color: "rgba(79, 71, 71, 0.72)",
                      }}
                    >
                      {item.school}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "2.4mm" }}>
              <div
                style={{
                  alignSelf: "start",
                  width: "fit-content",
                  padding: "2.1mm 8mm",
                  borderRadius: "999px",
                  background:
                    "color-mix(in srgb, var(--color-accent-soft) 74%, white 26%)",
                  color:
                    "color-mix(in srgb, var(--color-accent) 68%, var(--color-text) 32%)",
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "4mm",
                }}
              >
                Experiences Professionnelles
              </div>
              <div style={{ display: "grid", gap: "3.2mm" }}>
                {data.experience.slice(0, 3).map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    style={{ display: "grid", gap: "0.9mm" }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.55mm",
                        color: "rgba(102, 93, 95, 0.62)",
                      }}
                    >
                      {item.period}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.9mm",
                        color: "var(--color-accent)",
                        fontWeight: 700,
                      }}
                    >
                      {item.role}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.65mm",
                        color: "rgba(79, 71, 71, 0.72)",
                      }}
                    >
                      {item.company} / {item.location}
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "3.6mm",
                        display: "grid",
                        gap: "0.7mm",
                        fontSize: "2.55mm",
                        lineHeight: 1.48,
                        color: "rgba(79, 71, 71, 0.72)",
                      }}
                    >
                      {item.bullets.slice(0, 3).map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </main>
        </div>
      </article>
    </PreviewFrame>
  );
}

function SlateProfilePage({
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
  const pageVars = buildPageVars(variant);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const interestItems = getInterestItems(data, 5);

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
          background: "linear-gradient(180deg, #fbfbfc 0%, #f2f2f4 100%)",
          borderColor: "rgba(59, 67, 77, 0.18)",
          overflow: "hidden",
          fontFamily: "var(--font-body-family)",
        }}
        aria-label={variant.label}
      >
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            inset: 0,
            padding: "16mm",
            display: "grid",
            gridTemplateColumns: "52mm minmax(0, 1fr)",
            gap: "10mm",
          }}
        >
          <aside
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 68%, black 32%) 0%, color-mix(in srgb, var(--color-accent) 54%, black 46%) 100%)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: "0 0 28mm 0",
              padding: "8mm 6mm 8mm",
              display: "grid",
              gap: "4mm",
              alignContent: "start",
            }}
          >
            <div
              style={{
                width: "27mm",
                height: "27mm",
                borderRadius: "50%",
                overflow: "hidden",
                background: "rgba(255,255,255,0.18)",
                border: "1mm solid rgba(255,255,255,0.18)",
              }}
            >
              <PhotoOrInitials
                name={data.name}
                src={data.photoUrl}
                style={{ color: "white", background: "rgba(255,255,255,0.16)" }}
              />
            </div>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.5mm",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Coordonnees
              </p>
              <div style={{ display: "grid", gap: "1mm" }}>
                {data.contact.slice(0, 3).map((item) => (
                  <p
                    key={item.label}
                    style={{
                      margin: 0,
                      fontSize: "2.55mm",
                      lineHeight: 1.48,
                      color: "rgba(255,255,255,0.78)",
                    }}
                  >
                    {item.value}
                  </p>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.5mm",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Langues
              </p>
              <div style={{ display: "grid", gap: "0.8mm" }}>
                {data.languages.slice(0, 3).map((item) => (
                  <div
                    key={item.name}
                    style={{ display: "grid", gap: "0.3mm" }}
                  >
                    <span style={{ fontSize: "2.5mm", fontWeight: 700 }}>
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: "2.35mm",
                        color: "rgba(255,255,255,0.68)",
                      }}
                    >
                      {item.level}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "1.6mm" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.5mm",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Competences
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "2.5mm",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.74)",
                }}
              >
                {data.skills.slice(0, 7).join(" / ")}
              </p>
            </section>

            {interestItems.length > 0 ? (
              <section style={{ display: "grid", gap: "1.6mm" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.5mm",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Centres d’interet
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "2.5mm",
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.74)",
                  }}
                >
                  {interestItems.join(" / ")}
                </p>
              </section>
            ) : null}
          </aside>

          <main
            style={{
              display: "grid",
              alignContent: "start",
              gap: "4mm",
              minWidth: 0,
            }}
          >
            <header style={{ display: "grid", gap: "1.2mm" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "8.8mm",
                  lineHeight: 0.96,
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                }}
              >
                {data.name}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "3.4mm",
                  lineHeight: 1.25,
                  color:
                    "color-mix(in srgb, var(--color-accent) 72%, white 28%)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {data.title}
              </p>
            </header>

            <section style={{ display: "grid", gap: "1.9mm" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "4.6mm",
                  color: "var(--color-accent)",
                  fontWeight: 800,
                }}
              >
                Formation
              </h2>
              <div style={{ display: "grid", gap: "2.7mm" }}>
                {data.education.slice(0, 2).map((item) => (
                  <article
                    key={`${item.school}-${item.degree}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "19mm minmax(0, 1fr)",
                      gap: "3mm",
                      alignItems: "start",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.45mm",
                        lineHeight: 1.38,
                        color: "rgba(58, 64, 72, 0.58)",
                        textAlign: "right",
                      }}
                    >
                      {item.period}
                    </p>
                    <div style={{ display: "grid", gap: "0.8mm" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.8mm",
                          lineHeight: 1.35,
                          color: "var(--color-accent)",
                          fontWeight: 700,
                        }}
                      >
                        {item.degree}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.55mm",
                          lineHeight: 1.48,
                          color: "rgba(58, 64, 72, 0.7)",
                        }}
                      >
                        {item.school}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: "2mm" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "4.6mm",
                  color: "var(--color-accent)",
                  fontWeight: 800,
                }}
              >
                Experience Professionnelle
              </h2>
              <div style={{ display: "grid", gap: "3mm" }}>
                {data.experience.slice(0, 3).map((item) => (
                  <article
                    key={`${item.company}-${item.role}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "19mm minmax(0, 1fr)",
                      gap: "3mm",
                      alignItems: "start",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "2.45mm",
                        lineHeight: 1.38,
                        color: "rgba(58, 64, 72, 0.58)",
                        textAlign: "right",
                      }}
                    >
                      {item.period}
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gap: "0.9mm",
                        borderLeft:
                          "0.4mm solid color-mix(in srgb, var(--color-accent) 42%, transparent)",
                        paddingLeft: "3mm",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.9mm",
                          lineHeight: 1.35,
                          color: "var(--color-accent)",
                          fontWeight: 700,
                        }}
                      >
                        {item.role}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "2.55mm",
                          lineHeight: 1.48,
                          color: "rgba(58, 64, 72, 0.7)",
                        }}
                      >
                        {item.company} / {item.location}
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "3.6mm",
                          display: "grid",
                          gap: "0.7mm",
                          fontSize: "2.45mm",
                          lineHeight: 1.48,
                          color: "rgba(58, 64, 72, 0.74)",
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

  if (variant.id === "studiopop") {
    return (
      <StudioPopPage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "softribbon") {
    return (
      <SoftRibbonPage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "slateprofile") {
    return (
      <SlateProfilePage
        variant={variant}
        data={data}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
      />
    );
  }

  if (variant.id === "onecol") {
    return (
      <OneColumnPage
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
        ? ["swissminima", "robial", "editorialmag", "signalgrid"]
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
  );
}
