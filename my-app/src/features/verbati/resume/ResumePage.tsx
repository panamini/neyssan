import React from "react";
import { X } from "@/lib/icons";
import "./resume-preview.css";

import { resumeLayoutSpec } from "./resume-layout-spec";
import {
  getResumeTemplateId,
  resolveVerbatiStyle,
} from "../style";
import type {
  ResumeData,
  ResumeLayoutVariantId,
  ResumeSkillItem,
} from "./resume.types";
import { groupResumeSkillsByCategory } from "./skillCategories";
import {
  resolvePreviewSectionType,
  type ResumeActiveTarget,
  type ResumeCanonicalSectionType,
  type ResumePreviewSectionType,
} from "../resumeLinking";
import { VOLK_REGISTER_GRID } from "../volkGrid";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import {
  A4_PAGE_HEIGHT_PX,
  MM_TO_PX,
} from "../../../lib/document-stage";
import {
  resolveDocumentPageSize,
  type DocumentPageSize,
} from "../../../lib/document-page-size";
import { normalizeResumePreviewTokens } from "../../../lib/layout/documentTokenNormalizer";
import { getResumeTemplateDefinition } from "../../../lib/layout/resumeTemplates";
import {
  serializeActiveResumePreviewDecorVars,
  serializeResumePreviewVars,
} from "../../../lib/layout/documentTokenSerializers";
import type { VerbatiStylePreset } from "../types";
import {
  InlineEditableText,
  type ResumeInlineEditing,
} from "./InlineEditableText";
import { PaperRichInlineEditor } from "./RichInlineEditor";
import {
  PreviewItemRegion,
  PreviewSectionRegion,
  buildPreviewRegionAttrs,
  buildProjectPreviewFieldId,
} from "./resumePreviewRegions";

type ResumePageMode = "comparison" | "comparisonAll" | ResumeLayoutVariantId;

type ResumePageProps = {
  data: ResumeData;
  mode?: ResumePageMode;
  comparisonVariantIds?: ResumeLayoutVariantId[];
  stylePreset?: VerbatiStylePreset | null;
  fitToken?: string;
  onSelectVariantId?: ((variantId: ResumeLayoutVariantId) => void) | undefined;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  userZoom?: number;
  stageLayout?: DocumentStageLayout;
  pageSize?: DocumentPageSize | null;
  onRemoveSection?:
    | ((section: {
        sectionId: string;
        sectionType: ResumeCanonicalSectionType;
        sectionTitle?: string;
        previewSectionType?: ResumePreviewSectionType;
      }) => void)
    | undefined;
  onPreviewMetricsChange?:
    | ((metrics: ResumePreviewMetrics) => void)
    | undefined;
};

type ResumeVariant =
  (typeof resumeLayoutSpec.variants)[keyof typeof resumeLayoutSpec.variants];

type ResumeLabeledValue = {
  label: string;
  value: string;
  itemId?: string;
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
const ResumePageSizeContext = React.createContext<DocumentPageSize>(
  resolveDocumentPageSize(),
);
const ResumeStylePresetContext = React.createContext<VerbatiStylePreset | null>(
  null,
);
const ResumeRemoveSectionContext = React.createContext<
  | ((
      section: {
        sectionId: string;
        sectionType: ResumeCanonicalSectionType;
        sectionTitle?: string;
        previewSectionType?: ResumePreviewSectionType;
      },
    ) => void)
  | null
>(null);

const REMOVABLE_PREVIEW_SECTION_TYPES = new Set<ResumeCanonicalSectionType>([
  "achievements",
  "languages",
  "projects",
  "certifications",
  "affiliations",
  "hobbies",
  "additional_information",
  "custom",
]);

type ComparisonCardCopy = {
  typography: string;
  color: string;
};

export type ResumePaginationPolicy = "full" | "one-page-priority";

export type ResumePaginationOptions = {
  policy: ResumePaginationPolicy;
  maxPages?: number;
  sectionPriorityRules?: ReadonlyArray<{
    sectionType: string;
    priority: number;
  }>;
};

export type ResumePaginationMeasuredBlock = {
  id: string;
  kind: string;
  pageStartHeightPx: number;
  continuedHeightPx: number;
  keepWithNext?: boolean;
  repeatOnPageStartId?: string;
};

export type ResumePaginationPlacement = {
  blockId: string;
  pageStart: boolean;
  repeated?: boolean;
};

export type ResumePaginationPage = {
  blocks: ResumePaginationPlacement[];
  usedHeightPx: number;
};

export type ResumePreviewMetrics = {
  pageCount: number;
  pageGapPx: number;
  stackHeightPx: number;
};

const SWISS_MINIMA_PAGE_GAP_PX = 3.6 * MM_TO_PX;
const DEFAULT_RESUME_PREVIEW_METRICS: ResumePreviewMetrics = {
  pageCount: 1,
  pageGapPx: 0,
  stackHeightPx: A4_PAGE_HEIGHT_PX,
};

export function paginateResumeBlocks(args: {
  blocks: ResumePaginationMeasuredBlock[];
  pageHeightPx: number;
  options: ResumePaginationOptions;
}): ResumePaginationPage[] {
  const { blocks, pageHeightPx, options } = args;

  if (blocks.length === 0) {
    return [];
  }

  if (options.policy !== "full") {
    // Reserved for a follow-up one-page-priority mode.
  }

  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const pages: ResumePaginationPage[] = [];
  let currentPage: ResumePaginationPage = {
    blocks: [],
    usedHeightPx: 0,
  };

  const startNewPage = () => {
    if (currentPage.blocks.length > 0) {
      pages.push(currentPage);
    }
    currentPage = {
      blocks: [],
      usedHeightPx: 0,
    };
  };

  const resolveHeightForPlacement = (
    block: ResumePaginationMeasuredBlock,
    pageStart: boolean,
  ) => (pageStart ? block.pageStartHeightPx : block.continuedHeightPx);

  const resolveRepeatedPrefix = (block: ResumePaginationMeasuredBlock) =>
    block.repeatOnPageStartId
      ? blockById.get(block.repeatOnPageStartId) ?? null
      : null;

  const resolvePlacementHeight = (
    page: ResumePaginationPage,
    block: ResumePaginationMeasuredBlock,
  ) => {
    const pageStart = page.blocks.length === 0;
    const repeatedPrefix = pageStart ? resolveRepeatedPrefix(block) : null;
    const prefixHeight = repeatedPrefix
      ? repeatedPrefix.pageStartHeightPx
      : 0;
    const blockHeight = resolveHeightForPlacement(
      block,
      pageStart && !repeatedPrefix,
    );

    return {
      pageStart,
      repeatedPrefix,
      heightPx: prefixHeight + blockHeight,
    };
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const nextBlock = blocks[index + 1];

    if (block.keepWithNext && nextBlock && currentPage.blocks.length > 0) {
      const currentPlacement = resolvePlacementHeight(currentPage, block);
      const nextHeight = resolveHeightForPlacement(nextBlock, false);

      if (
        currentPage.usedHeightPx + currentPlacement.heightPx + nextHeight >
        pageHeightPx
      ) {
        startNewPage();
      }
    }

    let placement = resolvePlacementHeight(currentPage, block);

    if (
      currentPage.blocks.length > 0 &&
      currentPage.usedHeightPx + placement.heightPx > pageHeightPx
    ) {
      startNewPage();
      placement = resolvePlacementHeight(currentPage, block);
    }

    if (placement.repeatedPrefix) {
      currentPage.blocks.push({
        blockId: placement.repeatedPrefix.id,
        pageStart: true,
        repeated: true,
      });
      currentPage.usedHeightPx += placement.repeatedPrefix.pageStartHeightPx;
    }

    currentPage.blocks.push({
      blockId: block.id,
      pageStart: placement.pageStart && !placement.repeatedPrefix,
    });
    currentPage.usedHeightPx += resolveHeightForPlacement(
      block,
      placement.pageStart && !placement.repeatedPrefix,
    );
  }

  if (currentPage.blocks.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

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

function usePreviewScale(args?: {
  pageCount?: number;
  pageGapPx?: number;
}) {
  const pageCount = Math.max(1, args?.pageCount ?? 1);
  const pageGapPx = Math.max(0, args?.pageGapPx ?? 0);
  const sharedStageLayout = React.useContext(ResumeStageLayoutContext);
  const pageSize = React.useContext(ResumePageSizeContext);
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

      // Fit = fill the available width. Tall documents at fill-width can be
      // taller than the viewer shell, so height is handled by the scroll owner.
      const fitScale = Math.min(1, availableWidth / pageSize.widthPx);
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
  }, [pageSize.widthPx, sharedStageLayout, userZoom]);

  const resolvedScale = sharedStageLayout
    ? sharedStageLayout.pageWidth / pageSize.widthPx
    : scale;
  const previewPageHeightPx = pageSize.heightPx * resolvedScale;
  const previewStackHeightPx =
    (pageSize.heightPx * pageCount +
      pageGapPx * Math.max(0, pageCount - 1)) *
    resolvedScale;
  const previewVars = {
    "--preview-scale": resolvedScale,
    "--preview-stage-width": `${pageSize.widthPx * resolvedScale}px`,
    "--preview-page-height": `${previewPageHeightPx}px`,
    "--preview-stack-height": `${previewStackHeightPx}px`,
    "--preview-page-gap": `${pageGapPx}px`,
  } as React.CSSProperties;

  return {
    stageRef,
    previewVars,
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

function getPrimarySectionId(
  data: ResumeData,
  sectionType: ResumeCanonicalSectionType,
): string | undefined {
  if (sectionType === "profile") return data.profileSectionId;
  if (sectionType === "summary") return data.summarySectionId;
  return data.sectionIdsByType?.[sectionType]?.[0];
}

function getSectionOrder(value: { sectionOrder?: number } | undefined): number {
  return typeof value?.sectionOrder === "number"
    ? value.sectionOrder
    : Number.MAX_SAFE_INTEGER;
}

function normalizeIdentityLine(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getRenderableIdentitySubtitle(
  name: string | undefined | null,
  title: string | undefined | null,
): string | null {
  const trimmedTitle = String(title ?? "").trim();
  if (!trimmedTitle) {
    return null;
  }

  return normalizeIdentityLine(name) === normalizeIdentityLine(trimmedTitle)
    ? null
    : trimmedTitle;
}

function resolvePreviewSectionRemoval(section: {
  sectionType?: ResumePreviewSectionType;
  sectionId?: string;
  sectionTitle?: string;
}): {
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  previewSectionType?: ResumePreviewSectionType;
} | null {
  const sectionId = String(section.sectionId ?? "").trim();
  const previewSectionType = section.sectionType;
  const canonicalSectionType = resolvePreviewSectionType(previewSectionType);

  if (
    !sectionId ||
    !canonicalSectionType ||
    !REMOVABLE_PREVIEW_SECTION_TYPES.has(canonicalSectionType)
  ) {
    return null;
  }

  return {
    sectionId,
    sectionType: canonicalSectionType,
    sectionTitle: section.sectionTitle,
    previewSectionType,
  };
}

function PreviewSectionDeleteButton({
  sectionType,
  sectionId,
  sectionTitle,
}: {
  sectionType?: ResumePreviewSectionType;
  sectionId?: string;
  sectionTitle?: string;
}) {
  const onRemoveSection = React.useContext(ResumeRemoveSectionContext);
  const removalTarget = React.useMemo(
    () =>
      resolvePreviewSectionRemoval({
        sectionType,
        sectionId,
        sectionTitle,
      }),
    [sectionId, sectionTitle, sectionType],
  );

  if (!onRemoveSection || !removalTarget) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={`Delete ${sectionTitle ?? "section"}`}
      title={`Delete ${sectionTitle ?? "section"}`}
      data-no-pan="true"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemoveSection(removalTarget);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={{
        marginInlineStart: "auto",
        inlineSize: "4.2mm",
        blockSize: "4.2mm",
        minInlineSize: "4.2mm",
        minBlockSize: "4.2mm",
        padding: 0,
        borderRadius: "999px",
        border:
          "0.2mm solid color-mix(in srgb, var(--color-text) 18%, transparent)",
        background:
          "color-mix(in srgb, var(--resume-preview-page-background, var(--paper)) 86%, transparent)",
        color: "color-mix(in srgb, var(--color-text) 64%, transparent)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    >
      <X size={10} strokeWidth={2.1} aria-hidden="true" />
    </button>
  );
}

function SidebarSection({
  title,
  children,
  variant,
  sectionType,
  sectionId,
  activeTarget,
}: {
  title: string;
  children: React.ReactNode;
  variant: ResumeVariant;
  sectionType?: ResumePreviewSectionType;
  sectionId?: string;
  activeTarget?: ResumeActiveTarget | null;
}) {
  return (
    <PreviewSectionRegion
      as="section"
      className={`sidebar-section sidebar-section--${variant.id}`}
      sectionType={sectionType ?? (normalizeSectionTitleToType(title) as ResumePreviewSectionType)}
      sectionId={sectionId}
      sectionTitle={title}
      activeTarget={activeTarget}
      surface="section"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.6mm",
        }}
      >
        <h3 className={`sidebar-title sidebar-title--${variant.id}`}>{title}</h3>
        <PreviewSectionDeleteButton
          sectionType={
            sectionType ??
            (normalizeSectionTitleToType(title) as ResumePreviewSectionType)
          }
          sectionId={sectionId}
          sectionTitle={title}
        />
      </div>
      <div className={`sidebar-content sidebar-content--${variant.id}`}>
        {children}
      </div>
    </PreviewSectionRegion>
  );
}

function getRenderableSkillItems(data: ResumeData): ResumeSkillItem[] {
  const primarySkillsSectionId = getPrimarySectionId(data, "skills") ?? "";
  return data.skillItems.length > 0
    ? data.skillItems
    : data.skills.map((skill, index) => ({
        id: `skills-fallback-${index}`,
        name: skill,
        sectionId: primarySkillsSectionId,
        sectionType: "skills" as const,
      }));
}

function renderSkillListItem({
  item,
  activeTarget,
  as = "li",
  style,
}: {
  item: ResumeSkillItem;
  activeTarget?: ResumeActiveTarget | null;
  as?: "li" | "span";
  style?: React.CSSProperties;
}) {
  return (
    <PreviewItemRegion
      as={as}
      key={item.id}
      sectionType="skills"
      sectionId={item.sectionId}
      sectionTitle="Skills"
      itemId={item.id}
      activeTarget={activeTarget}
      surface="item"
      style={style}
    >
      {item.name}
    </PreviewItemRegion>
  );
}

function ResumeSkillsList({
  data,
  activeTarget,
  className,
  itemAs = "li",
  itemStyle,
}: {
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  className?: string;
  itemAs?: "li" | "span";
  itemStyle?: React.CSSProperties;
}) {
  const skillItems = getRenderableSkillItems(data);
  const groups = groupResumeSkillsByCategory(skillItems, data.skillCategories);
  const hasExplicitGroups = groups.some((group) => !group.uncategorized);

  if (!hasExplicitGroups) {
    const Tag = itemAs === "li" ? "ul" : "div";
    return (
      <Tag className={className}>
        {skillItems.map((item) =>
          renderSkillListItem({ item, activeTarget, as: itemAs, style: itemStyle }),
        )}
      </Tag>
    );
  }

  return (
    <div className={className} data-resume-skill-groups="true">
      {groups.map((group) => (
        <div
          key={group.id}
          className="skills-list__group"
          style={{
            display: "grid",
            gap: "1mm",
          }}
        >
          {group.uncategorized ? null : (
            <h4
              className="skills-list__category"
              style={{
                margin: 0,
                fontSize: "calc(var(--text-body-sm-size) - 0.25mm)",
                fontWeight: 700,
                color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
              }}
            >
              {group.label}
            </h4>
          )}
          <div
            className="skills-list__items"
            style={{
              display: "grid",
              gap: "calc(var(--experience-bullets-gap) - 0.1mm)",
            }}
          >
            {group.items.map((item) =>
              renderSkillListItem({
                item,
                activeTarget,
                as: itemAs === "li" ? "span" : itemAs,
                style: itemStyle,
              }),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MainSection({
  title,
  children,
  variant,
  sectionType,
  sectionId,
  activeTarget,
}: {
  title: string;
  children: React.ReactNode;
  variant: ResumeVariant;
  sectionType?: ResumePreviewSectionType;
  sectionId?: string;
  activeTarget?: ResumeActiveTarget | null;
}) {
  return (
    <PreviewSectionRegion
      as="section"
      className={`main-section main-section--${variant.id}`}
      sectionType={sectionType ?? (normalizeSectionTitleToType(title) as ResumePreviewSectionType)}
      sectionId={sectionId}
      sectionTitle={title}
      activeTarget={activeTarget}
      surface="section"
    >
      <div className={`main-heading-row main-heading-row--${variant.id}`}>
        <h2 className={`main-heading main-heading--${variant.id}`}>{title}</h2>
        <div className={`main-heading-rule main-heading-rule--${variant.id}`} />
        <PreviewSectionDeleteButton
          sectionType={
            sectionType ??
            (normalizeSectionTitleToType(title) as ResumePreviewSectionType)
          }
          sectionId={sectionId}
          sectionTitle={title}
        />
      </div>
      {children}
    </PreviewSectionRegion>
  );
}

function HeaderMeta({
  items,
  variant,
  sectionType = "notes",
  sectionId,
  activeTarget,
}: {
  items: ResumeData["metadata"];
  variant: ResumeVariant;
  sectionType?: ResumePreviewSectionType;
  sectionId?: string;
  activeTarget?: ResumeActiveTarget | null;
}) {
  const visibleItems =
    variant.id === "robial"
      ? items.filter((item) => item.label.toLowerCase() !== "availability")
      : items;

  return (
    <PreviewSectionRegion
      as="dl"
      className={`meta-grid meta-grid--${variant.id}`}
      aria-label="Resume metadata"
      sectionType={sectionType}
      sectionId={sectionId ?? visibleItems[0]?.sectionId}
      sectionTitle="Metadata"
      activeTarget={activeTarget}
      surface="section"
    >
      {visibleItems.map((item) => (
        <PreviewItemRegion
          as="div"
          key={`${item.label}-${item.value}`}
          className="meta-item"
          sectionType={sectionType}
          sectionId={item.sectionId ?? sectionId ?? visibleItems[0]?.sectionId}
          sectionTitle="Metadata"
          itemId={item.itemId}
          activeTarget={activeTarget}
          surface="item"
        >
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </PreviewItemRegion>
      ))}
    </PreviewSectionRegion>
  );
}

function buildPageVars(
  variant: ResumeVariant,
  stylePreset?: VerbatiStylePreset | null,
  pageSize?: DocumentPageSize | null,
): React.CSSProperties {
  const normalizedStyle = resolveVerbatiStyle(stylePreset ?? null);
  const templateDefinition = getResumeTemplateDefinition(
    getResumeTemplateId(normalizedStyle),
  );
  const canonical = normalizeResumePreviewTokens({
    resumeTemplateId: templateDefinition.id,
    stylePreset: normalizedStyle,
    pageSize,
  });

  return {
    ...serializeResumePreviewVars(canonical),
    ...serializeActiveResumePreviewDecorVars(
      canonical,
      templateDefinition.decorVariantId,
    ),
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

function findLabeledItem<T extends ResumeLabeledValue>(
  items: T[],
  labels: string[],
): T | undefined {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  return items.find((item) =>
    normalizedLabels.includes(item.label.toLowerCase()),
  );
}

function uniqueRows(
  rows: Array<ResumeLabeledValue | null | undefined>,
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
    result.push({ ...row, label, value });
  }

  return result;
}

function normalizePreviewComparableValue(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildSwissHeaderContact(data: ResumeData): ResumeLabeledValue[] {
  const mergedMeta = [...data.metadata, ...data.contact];
  const email =
    findLabeledItem(data.contact, ["email"]) ??
    findLabeledItem(mergedMeta, ["email"]);
  const phone =
    findLabeledItem(data.contact, ["phone"]) ??
    findLabeledItem(mergedMeta, ["phone"]);
  const linkedin =
    findLabeledItem(data.contact, ["linkedin"]) ??
    findLabeledItem(mergedMeta, ["linkedin"]);
  const site =
    findLabeledItem(data.contact, ["web", "portfolio", "site"]) ??
    findLabeledItem(mergedMeta, ["web", "portfolio", "site"]);

  return uniqueRows([email, phone, linkedin, site]);
}

function buildSwissHeaderNotes(
  data: ResumeData,
  topContact: ResumeLabeledValue[],
): ResumeLabeledValue[] {
  const topContactItemIds = new Set(
    topContact
      .map((item) => normalizePreviewComparableValue(item.itemId ?? ""))
      .filter(Boolean),
  );
  const topContactValues = new Set(
    topContact
      .map((item) => normalizePreviewComparableValue(item.value))
      .filter(Boolean),
  );

  return uniqueRows(
    data.metadata.filter((item) => {
      const itemId = normalizePreviewComparableValue(item.itemId ?? "");
      const value = normalizePreviewComparableValue(item.value);
      if (itemId && topContactItemIds.has(itemId)) {
        return false;
      }
      if (value && topContactValues.has(value)) {
        return false;
      }
      return true;
    }),
  ).slice(0, 3);
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
          "Fraunces italic roles, monospace dates, and prose skills - typographic hierarchy without decorative noise.",
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
  pageCount = 1,
  pageGapPx = 0,
}: {
  variant: ResumeVariant;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  children: React.ReactNode;
  pageCount?: number;
  pageGapPx?: number;
}) {
  const { stageRef, previewVars } = usePreviewScale({
    pageCount,
    pageGapPx,
  });
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
      style={previewVars}
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

      <div
        ref={stageRef}
        className={`resume-page-stage ${
          pageCount > 1 ? "resume-page-stage--stacked" : ""
        }`}
        style={previewVars}
      >
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
  activeTarget = null,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
}) {
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
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
  const renderableTitle = getRenderableIdentitySubtitle(data.name, data.title);

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
              {renderableTitle ? (
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
                  {renderableTitle}
                </p>
              ) : null}
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
                <PreviewItemRegion
                  as="p"
                  key={`${item.label}-${item.value}`}
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
                  sectionType="contact"
                  sectionId={data.profileSectionId}
                  sectionTitle="Contact"
                  itemId={item.itemId}
                  activeTarget={activeTarget}
                  surface="item"
                >
                  {item.value}
                </PreviewItemRegion>
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
  activeTarget,
  inlineEditing,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
  const { pageRef, innerRef } = useAutoFitPage(fitToken);
  const contactItems: ContactItemView[] =
    variant.id === "robial"
      ? getRobialContactItems(data.contact)
      : data.contact.map((item) => ({ ...item }));
  const sidebarExtras = [
    data.hobbyItems.length > 0
      ? {
          key: "hobbies",
          order: getSectionOrder(data.hobbyItems[0]),
        }
      : null,
    data.certifications.length > 0
      ? {
          key: "certifications",
          order: getSectionOrder(data.certifications[0]),
        }
      : null,
    data.affiliations.length > 0
      ? {
          key: "affiliations",
          order: getSectionOrder(data.affiliations[0]),
        }
      : null,
  ]
    .filter(
      (
        value,
      ): value is {
        key: "hobbies" | "certifications" | "affiliations";
        order: number;
      } => Boolean(value),
    )
    .sort((left, right) => left.order - right.order);
  const orderedTextSections = [...data.textSections].sort(
    (left, right) => left.sectionOrder - right.sectionOrder,
  );
  const renderableTitle = getRenderableIdentitySubtitle(data.name, data.title);

  if (variant.id === "editorialsidebar") {
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
          <div
            ref={innerRef}
            className="resume-inner resume-inner--editorialsidebar"
            style={{
              display: "grid",
              gridTemplateRows: "auto 1fr",
              rowGap: "calc(var(--header-row-gap) + 2mm)",
              minHeight: "100%",
            }}
          >
            <PreviewSectionRegion
              as="header"
              className="resume-header resume-header--editorialsidebar"
              sectionType="profile"
              sectionId={data.profileSectionId}
              sectionTitle="Profile"
              activeTarget={activeTarget}
              surface="section"
              style={{
                display: "grid",
                gap: "var(--header-title-margin-top)",
                alignItems: "start",
                paddingBottom: 0,
                borderBottom: 0,
              }}
            >
              <h1
                className="name name--editorialsidebar"
                data-font-probe="heading"
                style={{
                  margin: 0,
                  maxWidth: "calc(var(--sidebar-width) + var(--gutter-width) + var(--main-width))",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-heading-family)",
                  fontSize: "calc(var(--text-display-size) + 2.2mm)",
                  lineHeight: 0.92,
                  fontWeight: 300,
                  letterSpacing: "-0.055em",
                }}
              >
                {data.name}
              </h1>
              {renderableTitle ? (
                <p
                  className="title title--editorialsidebar"
                  style={{
                    margin: 0,
                    maxWidth: "var(--main-width)",
                    color: "var(--color-accent)",
                    fontSize: "calc(var(--text-body-size) + 0.05mm)",
                    lineHeight: 1.25,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {renderableTitle}
                </p>
              ) : null}
            </PreviewSectionRegion>

            <div
              className="resume-grid resume-grid--editorialsidebar"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "var(--sidebar-width) var(--gutter-width) var(--main-width)",
                alignItems: "start",
                minWidth: 0,
              }}
            >
              <aside
                className="resume-sidebar resume-sidebar--editorialsidebar"
                style={{
                  gridColumn: 1,
                  display: "grid",
                  gap: "calc(var(--sidebar-section-gap) + 1.1mm)",
                  alignContent: "start",
                  minWidth: 0,
                  paddingRight: 0,
                }}
              >
                <SidebarSection
                  title="Contact"
                  variant={variant}
                  sectionType="contact"
                  sectionId={data.profileSectionId}
                  activeTarget={activeTarget}
                >
                  <ul className="compact-list compact-list--editorialsidebar-contact">
                    {contactItems.map((item) => (
                      <PreviewItemRegion
                        as="li"
                        key={`${item.label}-${item.value}`}
                        className={
                          item.compact ? "compact-list-item--compact" : ""
                        }
                        sectionType="contact"
                        sectionId={item.sectionId}
                        sectionTitle="Contact"
                        itemId={item.itemId}
                        activeTarget={activeTarget}
                        surface="item"
                      >
                        <span className="value">{item.value}</span>
                      </PreviewItemRegion>
                    ))}
                  </ul>
                </SidebarSection>

                <SidebarSection
                  title="Skills"
                  variant={variant}
                  sectionType="skills"
                  sectionId={getPrimarySectionId(data, "skills")}
                  activeTarget={activeTarget}
                >
                  <ResumeSkillsList
                    data={data}
                    activeTarget={activeTarget}
                    className="skills-list skills-list--editorialsidebar"
                  />
                </SidebarSection>

                {data.languages.length > 0 ? (
                  <SidebarSection
                    title="Languages"
                    variant={variant}
                    sectionType="languages"
                    sectionId={getPrimarySectionId(data, "languages")}
                    activeTarget={activeTarget}
                  >
                    <ul className="compact-list compact-list--languages">
                      {data.languages.map((language) => (
                        <PreviewItemRegion
                          as="li"
                          key={language.id}
                          sectionType="languages"
                          sectionId={language.sectionId}
                          sectionTitle="Languages"
                          itemId={language.id}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          <span className="label">{language.name}</span>
                          <span className="value">{language.level}</span>
                        </PreviewItemRegion>
                      ))}
                    </ul>
                  </SidebarSection>
                ) : null}

                {sidebarExtras.map((section) => {
                  if (section.key === "hobbies") {
                    return (
                      <SidebarSection
                        key={section.key}
                        title="Hobbies"
                        variant={variant}
                        sectionType="hobbies"
                        sectionId={getPrimarySectionId(data, "hobbies")}
                        activeTarget={activeTarget}
                      >
                        <div className="hobby-tag-list">
                          {data.hobbyItems.map((item) => (
                            <PreviewItemRegion
                              as="span"
                              key={item.id}
                              className="hobby-tag"
                              sectionType="hobbies"
                              sectionId={item.sectionId}
                              sectionTitle="Hobbies"
                              itemId={item.id}
                              activeTarget={activeTarget}
                              surface="item"
                            >
                              {item.name}
                            </PreviewItemRegion>
                          ))}
                        </div>
                      </SidebarSection>
                    );
                  }

                  if (section.key === "certifications") {
                    return (
                      <SidebarSection
                        key={section.key}
                        title="Certifications"
                        variant={variant}
                        sectionType="certifications"
                        sectionId={getPrimarySectionId(data, "certifications")}
                        activeTarget={activeTarget}
                      >
                        <ul className="compact-list">
                          {data.certifications.map((item) => (
                            <PreviewItemRegion
                              as="li"
                              key={item.id}
                              sectionType="certifications"
                              sectionId={item.sectionId}
                              sectionTitle="Certifications"
                              itemId={item.id}
                              activeTarget={activeTarget}
                              surface="item"
                            >
                              <span className="label">{item.name}</span>
                              <span className="value">
                                {[item.issuer, item.meta].filter(Boolean).join(" · ")}
                              </span>
                            </PreviewItemRegion>
                          ))}
                        </ul>
                      </SidebarSection>
                    );
                  }

                  return (
                    <SidebarSection
                      key={section.key}
                      title="Affiliations"
                      variant={variant}
                      sectionType="affiliations"
                      sectionId={getPrimarySectionId(data, "affiliations")}
                      activeTarget={activeTarget}
                    >
                      <ul className="compact-list">
                        {data.affiliations.map((item) => (
                          <PreviewItemRegion
                            as="li"
                            key={item.id}
                            sectionType="affiliations"
                            sectionId={item.sectionId}
                            sectionTitle="Affiliations"
                            itemId={item.id}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            <span className="label">{item.organizationName}</span>
                            <span className="value">
                              {[item.roleOrMembershipType, item.dateRange]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </PreviewItemRegion>
                        ))}
                      </ul>
                    </SidebarSection>
                  );
                })}
              </aside>

              <main
                className="resume-main resume-main--editorialsidebar"
                style={{
                  gridColumn: 3,
                  display: "grid",
                  gap: "calc(var(--main-section-gap) + 0.7mm)",
                  alignContent: "start",
                  minWidth: 0,
                }}
              >
                {data.summary ? (
                  <MainSection
                    title="Profile"
                    variant={variant}
                    sectionType="summary"
                    sectionId={data.summarySectionId ?? "summary"}
                    activeTarget={activeTarget}
                  >
                    {data.summaryRich ? (
                      <PaperRichInlineEditor
                        value={data.summary}
                        rich={data.summaryRich}
                        editable={Boolean(inlineEditing?.enabled)}
                        editTarget={{
                          sectionId: data.summarySectionId ?? "summary",
                          sectionType: "summary",
                          fieldPath: "structuredContent.0.summary",
                          fieldKind: "paragraph",
                        }}
                        onActivate={(target) => inlineEditing?.onActivate(target)}
                        onDeactivate={inlineEditing?.onDeactivate}
                        onDocChange={inlineEditing?.onFieldDocChange}
                        ariaLabel="Edit Summary"
                        style={{
                          margin: 0,
                          maxWidth: "var(--header-summary-width)",
                          fontSize: "var(--text-body-size)",
                          lineHeight: "var(--text-body-line)",
                          color: "var(--color-text)",
                        }}
                        previewAttrs={buildPreviewRegionAttrs({
                          sectionType: "summary",
                          sectionId: data.summarySectionId,
                          sectionTitle: "Summary",
                          activeTarget,
                          surface: "section",
                        })}
                      />
                    ) : (
                      <InlineEditableText
                        className="summary summary--editorialsidebar"
                        data-font-probe="body"
                        value={data.summary}
                        editable={Boolean(inlineEditing?.enabled)}
                        editTarget={{
                          sectionId: data.summarySectionId ?? "summary",
                          sectionType: "summary",
                          fieldPath: "structuredContent.0.summary",
                          fieldKind: "paragraph",
                        }}
                        onActivate={(target) => inlineEditing?.onActivate(target)}
                        onDeactivate={inlineEditing?.onDeactivate}
                        ariaLabel="Edit Summary"
                        onPlainTextChange={(text) =>
                          inlineEditing?.onSummaryChange(text)
                        }
                        {...buildPreviewRegionAttrs({
                          sectionType: "summary",
                          sectionId: data.summarySectionId,
                          sectionTitle: "Summary",
                          activeTarget,
                          surface: "section",
                        })}
                      />
                    )}
                  </MainSection>
                ) : null}

                <MainSection
                  title="Work"
                  variant={variant}
                  sectionType="experience"
                  sectionId={getPrimarySectionId(data, "experience")}
                  activeTarget={activeTarget}
                >
                  <div className="experience-stack experience-stack--editorialsidebar">
                    {data.experience.map((item) => (
                      <PreviewItemRegion
                        as="article"
                        key={item.id}
                        className="experience-item experience-item--editorialsidebar"
                        sectionType="experience"
                        sectionId={item.sectionId}
                        sectionTitle="Work"
                        itemId={item.id}
                        activeTarget={activeTarget}
                        surface="item"
                      >
                        <div>
                          <h3 className="entry-title entry-title--editorialsidebar">
                            {item.company ? (
                              <span className="entry-company">{item.company}</span>
                            ) : null}
                            {item.company && item.role ? (
                              <span className="entry-title-separator">, </span>
                            ) : null}
                            {item.role ? (
                              <span className="entry-role">{item.role}</span>
                            ) : null}
                          </h3>
                          <p className="entry-subtitle">
                            {[item.period, item.location].filter(Boolean).join(" · ")}
                          </p>
                          {item.bullets.filter((bullet) => bullet.trim()).length > 0 ? (
                            <ul className="bullet-list">
                              {item.bullets
                                .filter((bullet) => bullet.trim())
                                .map((bullet) => (
                                  <li key={bullet}>{bullet}</li>
                                ))}
                            </ul>
                          ) : null}
                        </div>
                      </PreviewItemRegion>
                    ))}
                  </div>
                </MainSection>

                {data.projects.length > 0 ? (
                  <MainSection
                    title="Selected projects"
                    variant={variant}
                    sectionType="selected_projects"
                    sectionId={getPrimarySectionId(data, "projects")}
                    activeTarget={activeTarget}
                  >
                    <div className="projects-grid">
                      {data.projects.map((project) => (
                        <article
                          className={`project-card project-card--${variant.id}`}
                          key={project.id}
                          data-preview-row-id={project.id}
                          data-no-pan="true"
                        >
                          <PreviewItemRegion
                            as="h3"
                            className="entry-title"
                            sectionType="selected_projects"
                            sectionId={project.sectionId}
                            sectionTitle="Selected projects"
                            itemId={buildProjectPreviewFieldId(project.id, "name")}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            {project.name}
                          </PreviewItemRegion>
                          <PreviewItemRegion
                            as="p"
                            className="entry-subtitle entry-subtitle--project"
                            sectionType="selected_projects"
                            sectionId={project.sectionId}
                            sectionTitle="Selected projects"
                            itemId={buildProjectPreviewFieldId(project.id, "meta")}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            {project.meta}
                          </PreviewItemRegion>
                          <PreviewItemRegion
                            as="p"
                            className="project-copy"
                            sectionType="selected_projects"
                            sectionId={project.sectionId}
                            sectionTitle="Selected projects"
                            itemId={buildProjectPreviewFieldId(
                              project.id,
                              "description",
                            )}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            {project.description}
                          </PreviewItemRegion>
                        </article>
                      ))}
                    </div>
                  </MainSection>
                ) : null}

                <MainSection
                  title="Education"
                  variant={variant}
                  sectionType="education"
                  sectionId={getPrimarySectionId(data, "education")}
                  activeTarget={activeTarget}
                >
                  <div className="education-stack">
                    {data.education.map((item) => (
                      <PreviewItemRegion
                        as="article"
                        key={item.id}
                        className="education-item"
                        sectionType="education"
                        sectionId={item.sectionId}
                        sectionTitle="Education"
                        itemId={item.id}
                        activeTarget={activeTarget}
                        surface="item"
                      >
                        <div>
                          <h3 className="entry-title">
                            {[item.school, item.degree].filter(Boolean).join(", ")}
                          </h3>
                          <p className="entry-subtitle">{item.period}</p>
                        </div>
                      </PreviewItemRegion>
                    ))}
                  </div>
                </MainSection>

                {data.achievementItems.length > 0 ? (
                  <MainSection
                    title="Achievements"
                    variant={variant}
                    sectionType="achievements"
                    sectionId={getPrimarySectionId(data, "achievements")}
                    activeTarget={activeTarget}
                  >
                    <ul className="bullet-list">
                      {data.achievementItems.map((item) => (
                        <PreviewItemRegion
                          as="li"
                          key={item.id}
                          sectionType="achievements"
                          sectionId={item.sectionId}
                          sectionTitle="Achievements"
                          itemId={item.id}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          {item.text}
                        </PreviewItemRegion>
                      ))}
                    </ul>
                  </MainSection>
                ) : null}

                {orderedTextSections.map((section) => (
                  <MainSection
                    key={section.id}
                    title={section.sectionTitle}
                    variant={variant}
                    sectionType={section.sectionType}
                    sectionId={section.sectionId}
                    activeTarget={activeTarget}
                  >
                    <InlineEditableText
                      className="project-copy"
                      value={section.text}
                      editable={Boolean(inlineEditing?.enabled)}
                      editTarget={{
                        sectionId: section.sectionId,
                        sectionType: section.sectionType,
                        fieldPath: "blocks.0.plainText",
                        fieldKind: "paragraph",
                      }}
                      onActivate={(target) => inlineEditing?.onActivate(target)}
                      onDeactivate={inlineEditing?.onDeactivate}
                      ariaLabel={`Edit ${section.sectionTitle}`}
                      onPlainTextChange={(text) =>
                        inlineEditing?.onTextSectionChange(section.sectionId, text)
                      }
                      {...buildPreviewRegionAttrs({
                        sectionType: section.sectionType,
                        sectionId: section.sectionId,
                        sectionTitle: section.sectionTitle,
                        itemId: section.id,
                        activeTarget,
                        surface: "item",
                      })}
                    />
                  </MainSection>
                ))}
              </main>
            </div>
          </div>
        </article>
      </PreviewFrame>
    );
  }

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
          <PreviewSectionRegion
            as="header"
            className="resume-header"
            sectionType="profile"
            sectionId={data.profileSectionId}
            sectionTitle="Profile"
            activeTarget={activeTarget}
            surface="section"
          >
            <div className="header-copy">
              <p className="eyebrow">Résumé</p>
              <h1 className="name" data-font-probe="heading">
                {data.name}
              </h1>
              {renderableTitle ? <p className="title">{renderableTitle}</p> : null}
              {data.summaryRich ? (
                <PaperRichInlineEditor
                  value={data.summary}
                  rich={data.summaryRich}
                  editable={Boolean(inlineEditing?.enabled)}
                  editTarget={{
                    sectionId: data.summarySectionId ?? "summary",
                    sectionType: "summary",
                    fieldPath: "structuredContent.0.summary",
                    fieldKind: "paragraph",
                  }}
                  onActivate={(target) => inlineEditing?.onActivate(target)}
                  onDeactivate={inlineEditing?.onDeactivate}
                  onDocChange={inlineEditing?.onFieldDocChange}
                  ariaLabel="Edit Summary"
                  style={{
                    margin: 0,
                    maxWidth: "var(--header-summary-width)",
                    fontSize: "var(--text-body-size)",
                    lineHeight: "var(--text-body-line)",
                    color: "var(--color-text)",
                  }}
                  previewAttrs={buildPreviewRegionAttrs({
                    sectionType: "summary",
                    sectionId: data.summarySectionId,
                    sectionTitle: "Summary",
                    activeTarget,
                    surface: "section",
                  })}
                />
              ) : (
                <InlineEditableText
                  className="summary"
                  data-font-probe="body"
                  value={data.summary}
                  editable={Boolean(inlineEditing?.enabled)}
                  editTarget={{
                    sectionId: data.summarySectionId ?? "summary",
                    sectionType: "summary",
                    fieldPath: "structuredContent.0.summary",
                    fieldKind: "paragraph",
                  }}
                  onActivate={(target) => inlineEditing?.onActivate(target)}
                  onDeactivate={inlineEditing?.onDeactivate}
                  ariaLabel="Edit Summary"
                  onPlainTextChange={(text) => inlineEditing?.onSummaryChange(text)}
                  {...buildPreviewRegionAttrs({
                    sectionType: "summary",
                    sectionId: data.summarySectionId,
                    sectionTitle: "Summary",
                    activeTarget,
                    surface: "section",
                  })}
                />
              )}
            </div>
            <HeaderMeta
              items={data.metadata}
              variant={variant}
              sectionType="notes"
              sectionId={data.profileSectionId}
              activeTarget={activeTarget}
            />
          </PreviewSectionRegion>

          <div className="resume-grid">
            <aside className="resume-sidebar">
              <SidebarSection
                title="Contact"
                variant={variant}
                sectionType="contact"
                sectionId={data.profileSectionId}
                activeTarget={activeTarget}
              >
                <ul
                  className={`compact-list ${
                    variant.id === "robial"
                      ? "compact-list--robial-contact"
                      : ""
                  }`}
                >
                  {contactItems.map((item) => (
                    <PreviewItemRegion
                      as="li"
                      key={`${item.label}-${item.value}`}
                      className={
                        item.compact ? "compact-list-item--compact" : ""
                      }
                      sectionType="contact"
                      sectionId={item.sectionId}
                      sectionTitle="Contact"
                      itemId={item.itemId}
                      activeTarget={activeTarget}
                      surface="item"
                    >
                      {variant.id === "robial" ? null : (
                        <span className="label">{item.label}</span>
                      )}
                      <span className="value">{item.value}</span>
                    </PreviewItemRegion>
                  ))}
                </ul>
              </SidebarSection>

              <SidebarSection
                title="Skills"
                variant={variant}
                sectionType="skills"
                sectionId={getPrimarySectionId(data, "skills")}
                activeTarget={activeTarget}
              >
                <ResumeSkillsList
                  data={data}
                  activeTarget={activeTarget}
                  className="skills-list"
                />
              </SidebarSection>

              <SidebarSection
                title="Languages"
                variant={variant}
                sectionType="languages"
                sectionId={getPrimarySectionId(data, "languages")}
                activeTarget={activeTarget}
              >
                <ul className="compact-list compact-list--languages">
                  {data.languages.map((language) => (
                    <PreviewItemRegion
                      as="li"
                      key={language.id}
                      sectionType="languages"
                      sectionId={language.sectionId}
                      sectionTitle="Languages"
                      itemId={language.id}
                      activeTarget={activeTarget}
                      surface="item"
                    >
                      <span className="label">{language.name}</span>
                      <span className="value">{language.level}</span>
                    </PreviewItemRegion>
                  ))}
                </ul>
              </SidebarSection>

              {sidebarExtras.map((section) => {
                if (section.key === "hobbies") {
                  return (
                    <SidebarSection
                      key={section.key}
                      title="Hobbies"
                      variant={variant}
                      sectionType="hobbies"
                      sectionId={getPrimarySectionId(data, "hobbies")}
                      activeTarget={activeTarget}
                    >
                      <div className="hobby-tag-list">
                        {data.hobbyItems.map((item) => (
                          <PreviewItemRegion
                            as="span"
                            key={item.id}
                            className="hobby-tag"
                            sectionType="hobbies"
                            sectionId={item.sectionId}
                            sectionTitle="Hobbies"
                            itemId={item.id}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            {item.name}
                          </PreviewItemRegion>
                        ))}
                      </div>
                    </SidebarSection>
                  );
                }

                if (section.key === "certifications") {
                  return (
                    <SidebarSection
                      key={section.key}
                      title="Certifications"
                      variant={variant}
                      sectionType="certifications"
                      sectionId={getPrimarySectionId(data, "certifications")}
                      activeTarget={activeTarget}
                    >
                      <ul className="compact-list">
                        {data.certifications.map((item) => (
                          <PreviewItemRegion
                            as="li"
                            key={item.id}
                            sectionType="certifications"
                            sectionId={item.sectionId}
                            sectionTitle="Certifications"
                            itemId={item.id}
                            activeTarget={activeTarget}
                            surface="item"
                          >
                            <span className="label">{item.name}</span>
                            <span className="value">
                              {[item.issuer, item.meta].filter(Boolean).join(" · ")}
                            </span>
                          </PreviewItemRegion>
                        ))}
                      </ul>
                    </SidebarSection>
                  );
                }

                return (
                  <SidebarSection
                    key={section.key}
                    title="Affiliations"
                    variant={variant}
                    sectionType="affiliations"
                    sectionId={getPrimarySectionId(data, "affiliations")}
                    activeTarget={activeTarget}
                  >
                    <ul className="compact-list">
                      {data.affiliations.map((item) => (
                        <PreviewItemRegion
                          as="li"
                          key={item.id}
                          sectionType="affiliations"
                          sectionId={item.sectionId}
                          sectionTitle="Affiliations"
                          itemId={item.id}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          <span className="label">{item.organizationName}</span>
                          <span className="value">
                            {[item.roleOrMembershipType, item.dateRange]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </PreviewItemRegion>
                      ))}
                    </ul>
                  </SidebarSection>
                );
              })}
            </aside>

            <div className="resume-divider" aria-hidden="true" />

            <main className="resume-main">
              <MainSection
                title="Experience"
                variant={variant}
                sectionType="experience"
                sectionId={getPrimarySectionId(data, "experience")}
                activeTarget={activeTarget}
              >
                <div className="experience-stack">
                  {data.experience.map((item) => (
                    <PreviewItemRegion
                      as="article"
                      key={item.id}
                      className="experience-item"
                      sectionType="experience"
                      sectionId={item.sectionId}
                      sectionTitle="Experience"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
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
                    </PreviewItemRegion>
                  ))}
                </div>
              </MainSection>

              {data.projects.length > 0 ? (
                <MainSection
                  title="Selected projects"
                  variant={variant}
                  sectionType="selected_projects"
                  sectionId={getPrimarySectionId(data, "projects")}
                  activeTarget={activeTarget}
                >
                  <div className="projects-grid">
                    {data.projects.map((project) => (
                      <article
                        className={`project-card project-card--${variant.id}`}
                        key={project.id}
                        data-preview-row-id={project.id}
                        data-no-pan="true"
                      >
                        <PreviewItemRegion
                          as="h3"
                          className="entry-title"
                          sectionType="selected_projects"
                          sectionId={project.sectionId}
                          sectionTitle="Selected projects"
                          itemId={buildProjectPreviewFieldId(project.id, "name")}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          {project.name}
                        </PreviewItemRegion>
                        <PreviewItemRegion
                          as="p"
                          className="entry-subtitle entry-subtitle--project"
                          sectionType="selected_projects"
                          sectionId={project.sectionId}
                          sectionTitle="Selected projects"
                          itemId={buildProjectPreviewFieldId(project.id, "meta")}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          {project.meta}
                        </PreviewItemRegion>
                        <PreviewItemRegion
                          as="p"
                          className="project-copy"
                          sectionType="selected_projects"
                          sectionId={project.sectionId}
                          sectionTitle="Selected projects"
                          itemId={buildProjectPreviewFieldId(
                            project.id,
                            "description",
                          )}
                          activeTarget={activeTarget}
                          surface="item"
                        >
                          {project.description}
                        </PreviewItemRegion>
                      </article>
                    ))}
                  </div>
                </MainSection>
              ) : null}

              <MainSection
                title="Education"
                variant={variant}
                sectionType="education"
                sectionId={getPrimarySectionId(data, "education")}
                activeTarget={activeTarget}
              >
                <div className="education-stack">
                  {data.education.map((item) => (
                    <PreviewItemRegion
                      as="article"
                      key={item.id}
                      className="education-item"
                      sectionType="education"
                      sectionId={item.sectionId}
                      sectionTitle="Education"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                    >
                      <div>
                        <h3 className="entry-title">{item.degree}</h3>
                        <p className="entry-subtitle">{item.school}</p>
                      </div>
                      <p className="education-period">{item.period}</p>
                    </PreviewItemRegion>
                  ))}
                </div>
              </MainSection>

              {data.achievementItems.length > 0 ? (
                <MainSection
                  title="Achievements"
                  variant={variant}
                  sectionType="achievements"
                  sectionId={getPrimarySectionId(data, "achievements")}
                  activeTarget={activeTarget}
                >
                  <ul className="bullet-list">
                    {data.achievementItems.map((item) => (
                      <PreviewItemRegion
                        as="li"
                        key={item.id}
                        sectionType="achievements"
                        sectionId={item.sectionId}
                        sectionTitle="Achievements"
                        itemId={item.id}
                        activeTarget={activeTarget}
                        surface="item"
                      >
                        {item.text}
                      </PreviewItemRegion>
                    ))}
                  </ul>
                </MainSection>
              ) : null}

              {orderedTextSections.map((section) => (
                <MainSection
                  key={section.id}
                  title={section.sectionTitle}
                  variant={variant}
                  sectionType={section.sectionType}
                  sectionId={section.sectionId}
                  activeTarget={activeTarget}
                >
                  <InlineEditableText
                    className="project-copy"
                    value={section.text}
                    editable={Boolean(inlineEditing?.enabled)}
                    editTarget={{
                      sectionId: section.sectionId,
                      sectionType: section.sectionType,
                      fieldPath: "blocks.0.plainText",
                      fieldKind: "paragraph",
                    }}
                    onActivate={(target) => inlineEditing?.onActivate(target)}
                    onDeactivate={inlineEditing?.onDeactivate}
                    ariaLabel={`Edit ${section.sectionTitle}`}
                    onPlainTextChange={(text) =>
                      inlineEditing?.onTextSectionChange(section.sectionId, text)
                    }
                    {...buildPreviewRegionAttrs({
                      sectionType: section.sectionType,
                      sectionId: section.sectionId,
                      sectionTitle: section.sectionTitle,
                      itemId: section.id,
                      activeTarget,
                      surface: "item",
                    })}
                  />
                </MainSection>
              ))}
            </main>
          </div>
        </div>
      </article>
    </PreviewFrame>
  );
}

type SwissMinimaSupportSection = {
  key: string;
  title: string;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  sectionOrder: number;
  content: React.ReactNode;
};

type SwissMinimaBlockKind =
  | "header"
  | "summary"
  | "experience-heading"
  | "experience-item"
  | "support-row";

type SwissMinimaBlockDefinition = {
  id: string;
  kind: SwissMinimaBlockKind;
  keepWithNext?: boolean;
  repeatOnPageStartId?: string;
  render: (args: { pageStart: boolean; measure: boolean }) => React.ReactNode;
};

function chunkSwissMinimaSupportRows(
  sections: SwissMinimaSupportSection[],
  rowSize = 3,
): SwissMinimaSupportSection[][] {
  const rows: SwissMinimaSupportSection[][] = [];

  for (let index = 0; index < sections.length; index += rowSize) {
    rows.push(sections.slice(index, index + rowSize));
  }

  return rows;
}

function SwissMinimaPage({
  variant,
  data,
  comparisonLabel,
  compactComparison,
  onActivateComparison,
  fitToken,
  activeTarget,
  inlineEditing,
  onPreviewMetricsChange,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  onPreviewMetricsChange?: ((metrics: ResumePreviewMetrics) => void) | undefined;
}) {
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const sharedStageLayout = React.useContext(ResumeStageLayoutContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
  const onRemoveSection = React.useContext(ResumeRemoveSectionContext);
  const { pageRef } = useAutoFitPage(fitToken);
  const topContact = buildSwissHeaderContact(data);
  const topNotes = buildSwissHeaderNotes(data, topContact);
  const renderableTitle = getRenderableIdentitySubtitle(data.name, data.title);
  const experienceSectionId = getPrimarySectionId(data, "experience");
  const measurementPageStartRefs = React.useRef<Record<string, HTMLDivElement | null>>(
    {},
  );
  const measurementContinuedRefs = React.useRef<Record<string, HTMLDivElement | null>>(
    {},
  );
  const measurementSignatureRef = React.useRef("");
  const [measurementVersion, setMeasurementVersion] = React.useState(0);
  const [measuredBlocks, setMeasuredBlocks] = React.useState<
    ResumePaginationMeasuredBlock[]
  >([]);
  const stackRef = React.useRef<HTMLDivElement | null>(null);

  const supportSections = React.useMemo<SwissMinimaSupportSection[]>(() => {
    const sections: Array<SwissMinimaSupportSection | null> = [
        data.projects.length > 0
          ? {
              key: "projects",
              title: "Selected Projects",
              sectionType: "selected_projects" as const,
              sectionId: getPrimarySectionId(data, "projects"),
              sectionOrder: getSectionOrder(data.projects[0]),
              content: (
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
                  }}
                >
                  {data.projects.map((item) => (
                    <div
                      key={item.id}
                      data-preview-row-id={item.id}
                      data-no-pan="true"
                      style={{
                        display: "grid",
                        gap: "var(--experience-bullets-gap)",
                      }}
                    >
                      <PreviewItemRegion
                        as="span"
                        sectionType="selected_projects"
                        sectionId={item.sectionId}
                        sectionTitle="Selected Projects"
                        itemId={buildProjectPreviewFieldId(item.id, "name")}
                        activeTarget={activeTarget}
                        surface="item"
                        style={{
                          fontWeight: 700,
                          color: "var(--color-text)",
                          fontSize: "calc(var(--text-body-sm-size) + 0.05mm)",
                        }}
                      >
                        {item.name}
                      </PreviewItemRegion>
                      {item.meta ? (
                        <PreviewItemRegion
                          as="span"
                          sectionType="selected_projects"
                          sectionId={item.sectionId}
                          sectionTitle="Selected Projects"
                          itemId={buildProjectPreviewFieldId(item.id, "meta")}
                          activeTarget={activeTarget}
                          surface="item"
                          style={{
                            color:
                              "color-mix(in srgb, var(--color-text) 56%, transparent)",
                            fontSize: "calc(var(--text-body-sm-size) - 0.3mm)",
                          }}
                        >
                          {item.meta}
                        </PreviewItemRegion>
                      ) : null}
                      <PreviewItemRegion
                        as="span"
                        sectionType="selected_projects"
                        sectionId={item.sectionId}
                        sectionTitle="Selected Projects"
                        itemId={buildProjectPreviewFieldId(
                          item.id,
                          "description",
                        )}
                        activeTarget={activeTarget}
                        surface="item"
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 72%, transparent)",
                          fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                          lineHeight: 1.38,
                        }}
                      >
                        {item.description}
                      </PreviewItemRegion>
                    </div>
                  ))}
                </div>
              ),
            }
          : null,
        data.education.length > 0
          ? {
              key: "education",
              title: "Education",
              sectionType: "education" as const,
              sectionId: getPrimarySectionId(data, "education"),
              sectionOrder: getSectionOrder(data.education[0]),
              content: (
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
                  }}
                >
                  {data.education.map((item) => (
                    <PreviewItemRegion
                      as="div"
                      key={item.id}
                      sectionType="education"
                      sectionId={item.sectionId}
                      sectionTitle="Education"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.3mm)",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, color: "var(--color-text)" }}
                      >
                        {item.degree}
                      </span>
                      <span
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 72%, transparent)",
                        }}
                      >
                        {item.school}
                      </span>
                      <span
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 56%, transparent)",
                          fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                        }}
                      >
                        {item.period}
                      </span>
                    </PreviewItemRegion>
                  ))}
                </div>
              ),
            }
          : null,
        (data.skillItems.length > 0 || data.skills.length > 0)
          ? {
              key: "skills",
              title: "Skills",
              sectionType: "skills" as const,
              sectionId: getPrimarySectionId(data, "skills"),
              sectionOrder: getSectionOrder(data.skillItems[0]),
              content: (
                <ResumeSkillsList
                  data={data}
                  activeTarget={activeTarget}
                  itemAs="span"
                  itemStyle={{
                    color:
                      "color-mix(in srgb, var(--color-text) 72%, transparent)",
                    fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                    lineHeight: 1.38,
                  }}
                  className="skills-list"
                />
              ),
            }
          : null,
        data.languages.length > 0
          ? {
              key: "languages",
              title: "Languages",
              sectionType: "languages" as const,
              sectionId: getPrimarySectionId(data, "languages"),
              sectionOrder: getSectionOrder(data.languages[0]),
              content: (
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) + 0.2mm)",
                  }}
                >
                  {data.languages.map((item) => (
                    <PreviewItemRegion
                      as="div"
                      key={item.id}
                      sectionType="languages"
                      sectionId={item.sectionId}
                      sectionTitle="Languages"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.5mm)",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, color: "var(--color-text)" }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 56%, transparent)",
                          fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                        }}
                      >
                        {item.level}
                      </span>
                    </PreviewItemRegion>
                  ))}
                </div>
              ),
            }
          : null,
        data.achievementItems.length > 0
          ? {
              key: "achievements",
              title: "Achievements",
              sectionType: "achievements" as const,
              sectionId: getPrimarySectionId(data, "achievements"),
              sectionOrder: getSectionOrder(data.achievementItems[0]),
              content: (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "var(--experience-bullets-padding)",
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) - 0.4mm)",
                    color:
                      "color-mix(in srgb, var(--color-text) 72%, transparent)",
                    fontSize: "calc(var(--text-body-sm-size) - 0.4mm)",
                    lineHeight: 1.38,
                  }}
                >
                  {data.achievementItems.map((item) => (
                    <PreviewItemRegion
                      as="li"
                      key={item.id}
                      sectionType="achievements"
                      sectionId={item.sectionId}
                      sectionTitle="Achievements"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                    >
                      {item.text}
                    </PreviewItemRegion>
                  ))}
                </ul>
              ),
            }
          : null,
        data.hobbyItems.length > 0
          ? {
              key: "hobbies",
              title: "Hobbies",
              sectionType: "hobbies" as const,
              sectionId: getPrimarySectionId(data, "hobbies"),
              sectionOrder: getSectionOrder(data.hobbyItems[0]),
              content: (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.6mm",
                  }}
                >
                  {data.hobbyItems.map((item) => (
                    <PreviewItemRegion
                      as="span"
                      key={item.id}
                      className="hobby-tag hobby-tag--editorial"
                      sectionType="hobbies"
                      sectionId={item.sectionId}
                      sectionTitle="Hobbies"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                    >
                      {item.name}
                    </PreviewItemRegion>
                  ))}
                </div>
              ),
            }
          : null,
        data.certifications.length > 0
          ? {
              key: "certifications",
              title: "Certifications",
              sectionType: "certifications" as const,
              sectionId: getPrimarySectionId(data, "certifications"),
              sectionOrder: getSectionOrder(data.certifications[0]),
              content: (
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) + 0.2mm)",
                  }}
                >
                  {data.certifications.map((item) => (
                    <PreviewItemRegion
                      as="div"
                      key={item.id}
                      sectionType="certifications"
                      sectionId={item.sectionId}
                      sectionTitle="Certifications"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.5mm)",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, color: "var(--color-text)" }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 56%, transparent)",
                          fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                        }}
                      >
                        {[item.issuer, item.meta].filter(Boolean).join(" · ")}
                      </span>
                    </PreviewItemRegion>
                  ))}
                </div>
              ),
            }
          : null,
        data.affiliations.length > 0
          ? {
              key: "affiliations",
              title: "Affiliations",
              sectionType: "affiliations" as const,
              sectionId: getPrimarySectionId(data, "affiliations"),
              sectionOrder: getSectionOrder(data.affiliations[0]),
              content: (
                <div
                  style={{
                    display: "grid",
                    gap: "calc(var(--experience-bullets-gap) + 0.2mm)",
                  }}
                >
                  {data.affiliations.map((item) => (
                    <PreviewItemRegion
                      as="div"
                      key={item.id}
                      sectionType="affiliations"
                      sectionId={item.sectionId}
                      sectionTitle="Affiliations"
                      itemId={item.id}
                      activeTarget={activeTarget}
                      surface="item"
                      style={{
                        display: "grid",
                        gap: "calc(var(--experience-bullets-gap) - 0.5mm)",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, color: "var(--color-text)" }}
                      >
                        {item.organizationName}
                      </span>
                      <span
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-text) 56%, transparent)",
                          fontSize: "calc(var(--text-body-sm-size) - 0.35mm)",
                        }}
                      >
                        {[item.roleOrMembershipType, item.dateRange]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </PreviewItemRegion>
                  ))}
                </div>
              ),
            }
          : null,
        ...data.textSections.map((section) => ({
          key: section.id,
          title: section.sectionTitle,
          sectionType: section.sectionType,
          sectionId: section.sectionId,
          sectionOrder: section.sectionOrder,
          content: (
            <InlineEditableText
              value={section.text}
              editable={Boolean(inlineEditing?.enabled)}
              editTarget={{
                sectionId: section.sectionId,
                sectionType: section.sectionType,
                fieldPath: "blocks.0.plainText",
                fieldKind: "paragraph",
              }}
              onActivate={(target) => inlineEditing?.onActivate(target)}
              onDeactivate={inlineEditing?.onDeactivate}
              ariaLabel={`Edit ${section.sectionTitle}`}
              onPlainTextChange={(text) =>
                inlineEditing?.onTextSectionChange(section.sectionId, text)
              }
              {...buildPreviewRegionAttrs({
                sectionType: section.sectionType,
                sectionId: section.sectionId,
                sectionTitle: section.sectionTitle,
                itemId: section.id,
                activeTarget,
                surface: "item",
              })}
              style={{
                margin: 0,
                color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                fontSize: "calc(var(--text-body-sm-size) - 0.3mm)",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap" as const,
              }}
            />
          ),
        })),
      ];

      return sections
        .filter(
          (
            value,
          ): value is SwissMinimaSupportSection => Boolean(value),
        )
        .sort((left, right) => left.sectionOrder - right.sectionOrder);
    },
    [
      activeTarget,
      data.achievementItems,
      data.affiliations,
      data.certifications,
      data.education,
      data.hobbyItems,
      data.languages,
      data.projects,
      data.skillItems,
      data.skills,
      data.textSections,
      inlineEditing,
      onRemoveSection,
    ],
  );
  const supportRows = React.useMemo(
    () => chunkSwissMinimaSupportRows(supportSections),
    [supportSections],
  );
  const pageContentHeightPx = React.useMemo(() => {
    const normalizedStyle = resolveVerbatiStyle(stylePreset ?? null);
    const templateDefinition = getResumeTemplateDefinition(
      getResumeTemplateId(normalizedStyle),
    );
    const canonical = normalizeResumePreviewTokens({
      resumeTemplateId: templateDefinition.id,
      stylePreset: normalizedStyle,
      pageSize,
    });
    return Math.max(
      1,
      Math.floor(
        (canonical.geometry.page.liveArea?.heightMm ?? pageSize.heightMm) *
          MM_TO_PX,
      ),
    );
  }, [pageSize, stylePreset, variant]);
  const swissMinimaPageStyle = React.useMemo(
    () =>
      ({
        ...pageVars,
        background: "var(--resume-preview-page-background)",
        borderColor: "var(--resume-preview-page-border-color)",
        borderWidth: "var(--resume-preview-page-border-width)",
        boxShadow: "var(--resume-preview-page-shadow)",
        fontFamily: "var(--font-body-family)",
      }) as React.CSSProperties,
    [pageVars],
  );

  React.useEffect(() => {
    let cancelled = false;

    if (!document.fonts?.ready) {
      return undefined;
    }

    void document.fonts.ready.then(() => {
      if (!cancelled) {
        setMeasurementVersion((current) => current + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [stylePreset, data]);

  const renderHeaderBlock = React.useCallback(
    () => (
      <PreviewSectionRegion
        as="header"
        style={{
          display: "grid",
          gap: "calc(var(--header-row-gap) - 0.8mm)",
          alignItems: "start",
          paddingBottom: "var(--header-bottom-padding)",
          borderBottom:
            "0.34mm solid color-mix(in srgb, var(--color-text) 28%, transparent)",
        }}
        sectionType="profile"
        sectionId={data.profileSectionId}
        sectionTitle="Profile"
        activeTarget={activeTarget}
        surface="section"
      >
        <div style={{ minWidth: 0 }}>
          {topContact.length > 0 ? (
            <PreviewSectionRegion
              as="div"
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
              sectionType="contact"
              sectionId={data.profileSectionId}
              sectionTitle="Contact"
              activeTarget={activeTarget}
              surface="section"
            >
              {topContact.map((item) => (
                <PreviewItemRegion
                  as="span"
                  key={`${item.label}-${item.value}`}
                  sectionType="contact"
                  sectionId={data.profileSectionId}
                  sectionTitle="Contact"
                  itemId={item.itemId}
                  activeTarget={activeTarget}
                  surface="item"
                >
                  {item.value}
                </PreviewItemRegion>
              ))}
            </PreviewSectionRegion>
          ) : null}
          {topNotes.length > 0 ? (
            <PreviewSectionRegion
              as="div"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap:
                  "calc(var(--experience-bullets-gap) + 0.25mm) var(--experience-column-gap)",
                marginBottom: "calc(var(--header-row-gap) - 0.3mm)",
                color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
                fontSize: "calc(var(--text-body-sm-size) - 0.1mm)",
                lineHeight: 1.35,
              }}
              sectionType="notes"
              sectionId={data.profileSectionId}
              sectionTitle="Metadata"
              activeTarget={activeTarget}
              surface="section"
            >
              {topNotes.map((item) => (
                <PreviewItemRegion
                  as="span"
                  key={`${item.label}-${item.value}`}
                  sectionType="notes"
                  sectionId={data.profileSectionId}
                  sectionTitle="Metadata"
                  itemId={item.itemId}
                  activeTarget={activeTarget}
                  surface="item"
                >
                  {item.label}: {item.value}
                </PreviewItemRegion>
              ))}
            </PreviewSectionRegion>
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
          {renderableTitle ? (
            <p
              style={{
                margin: "calc(var(--header-row-gap) - 0.8mm) 0 0",
                maxWidth: "calc(var(--main-width) + 7mm)",
                fontSize: "calc(var(--text-title-size) - 0.8mm)",
                lineHeight: 1.38,
                color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
              }}
            >
              {renderableTitle}
            </p>
          ) : null}
        </div>
      </PreviewSectionRegion>
    ),
    [
      activeTarget,
      data.name,
      data.profileSectionId,
      renderableTitle,
      topContact,
      topNotes,
    ],
  );

  const renderSummaryBlock = React.useCallback(
    () => (
      <PreviewSectionRegion
        as="section"
        style={{
          display: "grid",
          alignItems: "start",
        }}
        sectionType="summary"
        sectionId={data.summarySectionId}
        sectionTitle="Summary"
        activeTarget={activeTarget}
        surface="section"
      >
        <div>
          {data.summaryRich ? (
            <PaperRichInlineEditor
              value={data.summary}
              rich={data.summaryRich}
              editable={Boolean(inlineEditing?.enabled)}
              editTarget={{
                sectionId: data.summarySectionId ?? "summary",
                sectionType: "summary",
                fieldPath: "structuredContent.0.summary",
                fieldKind: "paragraph",
              }}
              onActivate={(target) => inlineEditing?.onActivate(target)}
              onDeactivate={inlineEditing?.onDeactivate}
              onDocChange={inlineEditing?.onFieldDocChange}
              ariaLabel="Edit Summary"
              style={{
                margin: 0,
                maxWidth: "var(--header-summary-width)",
                fontFamily: "var(--font-body-family)",
                color: "var(--color-text)",
              }}
              previewAttrs={buildPreviewRegionAttrs({
                sectionType: "summary",
                sectionId: data.summarySectionId,
                sectionTitle: "Summary",
                activeTarget,
                surface: "item",
              })}
            />
          ) : (
            <InlineEditableText
              data-font-probe="body"
              className="summary"
              value={data.summary}
              editable={Boolean(inlineEditing?.enabled)}
              editTarget={{
                sectionId: data.summarySectionId ?? "summary",
                sectionType: "summary",
                fieldPath: "structuredContent.0.summary",
                fieldKind: "paragraph",
              }}
              onActivate={(target) => inlineEditing?.onActivate(target)}
              onDeactivate={inlineEditing?.onDeactivate}
              ariaLabel="Edit Summary"
              onPlainTextChange={(text) => inlineEditing?.onSummaryChange(text)}
              {...buildPreviewRegionAttrs({
                sectionType: "summary",
                sectionId: data.summarySectionId,
                sectionTitle: "Summary",
                activeTarget,
                surface: "item",
              })}
              style={{
                margin: 0,
                fontFamily: "var(--font-body-family)",
                color: "var(--color-text)",
              }}
            />
          )}
        </div>
      </PreviewSectionRegion>
    ),
    [activeTarget, data.summary, data.summaryRich, data.summarySectionId, inlineEditing],
  );

  const renderExperienceHeadingBlock = React.useCallback(
    () => (
      <PreviewSectionRegion
        as="div"
        sectionType="experience"
        sectionId={experienceSectionId}
        sectionTitle="Experience"
        activeTarget={activeTarget}
        surface="section"
      >
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
      </PreviewSectionRegion>
    ),
    [activeTarget, experienceSectionId],
  );

  const renderExperienceItemBlock = React.useCallback(
    (item: ResumeData["experience"][number], index: number) => (
      <PreviewItemRegion
        as="article"
        key={item.id || `${item.company}-${item.role}-${item.period}-${index}`}
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
        sectionType="experience"
        sectionId={item.sectionId}
        sectionTitle="Experience"
        itemId={item.id}
        activeTarget={activeTarget}
        surface="item"
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
            {item.bullets.map((bullet, bulletIndex) => (
              <li key={`${item.id}-${bulletIndex}`}>{bullet}</li>
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
                  textTransform: row.label === "company" ? "none" : "uppercase",
                  letterSpacing: row.label === "company" ? "0" : "0.18em",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </aside>
      </PreviewItemRegion>
    ),
    [activeTarget],
  );

  const renderSupportRowBlock = React.useCallback(
    (sections: SwissMinimaSupportSection[], measure: boolean) => (
      <section
        style={{
          paddingTop: "calc(var(--main-section-gap) - 2.2mm)",
          borderTop:
            "0.42mm solid color-mix(in srgb, var(--color-text) 28%, transparent)",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "calc(var(--main-section-gap) - 4mm)",
          alignItems: "start",
        }}
      >
        {sections.map((section) => (
          <PreviewSectionRegion
            as="div"
            key={section.key}
            sectionType={section.sectionType}
            sectionId={section.sectionId}
            sectionTitle={section.title}
            activeTarget={activeTarget}
            surface="section"
            style={{
              display: "grid",
              gap: "calc(var(--experience-bullets-gap) + 0.3mm)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1.5mm",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "calc(var(--text-caption-size) - 0.15mm)",
                  lineHeight: "var(--text-caption-line)",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color:
                    "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  fontWeight: 700,
                  fontFamily: "var(--font-body-family)",
                }}
              >
                {section.title}
              </h4>
              {onRemoveSection && !measure ? (
                <PreviewSectionDeleteButton
                  sectionType={section.sectionType}
                  sectionId={section.sectionId}
                  sectionTitle={section.title}
                />
              ) : null}
            </div>
            {section.content}
          </PreviewSectionRegion>
        ))}
      </section>
    ),
    [activeTarget, onRemoveSection],
  );

  const blockDefinitions = React.useMemo<SwissMinimaBlockDefinition[]>(() => {
    const definitions: SwissMinimaBlockDefinition[] = [
      {
        id: "header",
        kind: "header",
        render: () => renderHeaderBlock(),
      },
    ];

    if (data.summary.trim()) {
      definitions.push({
        id: "summary",
        kind: "summary",
        render: ({ pageStart }) => (
          <div
            style={{
              paddingTop: pageStart ? 0 : "calc(var(--body-row-gap) - 3.8mm)",
            }}
          >
            {renderSummaryBlock()}
          </div>
        ),
      });
    }

    if (data.experience.length > 0) {
      definitions.push({
        id: "experience-heading",
        kind: "experience-heading",
        keepWithNext: true,
        render: ({ pageStart }) => (
          <div
            style={{
              paddingTop: pageStart ? 0 : "calc(var(--body-row-gap) - 3.8mm)",
            }}
          >
            {renderExperienceHeadingBlock()}
          </div>
        ),
      });

      data.experience.forEach((item, index) => {
        definitions.push({
          id: `experience-item:${item.id}`,
          kind: "experience-item",
          repeatOnPageStartId:
            index === 0 ? undefined : "experience-heading",
          render: ({ pageStart }) => (
            <div
              style={{
                paddingTop: pageStart ? 0 : "calc(var(--body-row-gap) - 4.8mm)",
              }}
            >
              {renderExperienceItemBlock(item, index)}
            </div>
          ),
        });
      });
    }

    supportRows.forEach((sections, index) => {
      definitions.push({
        id: `support-row:${index}`,
        kind: "support-row",
        render: ({ pageStart, measure }) => (
          <div
            style={{
              paddingTop: pageStart ? 0 : "calc(var(--body-row-gap) - 3.8mm)",
            }}
          >
            {renderSupportRowBlock(sections, measure)}
          </div>
        ),
      });
    });

    return definitions;
  }, [
    data.experience,
    data.summary,
    renderExperienceHeadingBlock,
    renderExperienceItemBlock,
    renderHeaderBlock,
    renderSummaryBlock,
    renderSupportRowBlock,
    supportRows,
  ]);
  const blockDefinitionMap = React.useMemo(
    () => new Map(blockDefinitions.map((block) => [block.id, block])),
    [blockDefinitions],
  );

  const setMeasurementRef = React.useCallback(
    (blockId: string, position: "page-start" | "continued") =>
      (node: HTMLDivElement | null) => {
        if (position === "page-start") {
          measurementPageStartRefs.current[blockId] = node;
          return;
        }

        measurementContinuedRefs.current[blockId] = node;
      },
    [],
  );

  React.useLayoutEffect(() => {
    const nextMeasuredBlocks = blockDefinitions.flatMap((block) => {
      const pageStartNode = measurementPageStartRefs.current[block.id];
      const continuedNode = measurementContinuedRefs.current[block.id];

      if (!pageStartNode || !continuedNode) {
        return [];
      }

      return [
        {
          id: block.id,
          kind: block.kind,
          keepWithNext: block.keepWithNext,
          repeatOnPageStartId: block.repeatOnPageStartId,
          pageStartHeightPx: Math.max(
            1,
            Math.ceil(pageStartNode.getBoundingClientRect().height),
          ),
          continuedHeightPx: Math.max(
            1,
            Math.ceil(continuedNode.getBoundingClientRect().height),
          ),
        } satisfies ResumePaginationMeasuredBlock,
      ];
    });

    if (nextMeasuredBlocks.length !== blockDefinitions.length) {
      return;
    }

    const nextSignature = JSON.stringify(
      nextMeasuredBlocks.map((block) => [
        block.id,
        block.pageStartHeightPx,
        block.continuedHeightPx,
      ]),
    );

    if (nextSignature === measurementSignatureRef.current) {
      return;
    }

    measurementSignatureRef.current = nextSignature;
    setMeasuredBlocks(nextMeasuredBlocks);
  }, [blockDefinitions, measurementVersion]);

  const plannedPages = React.useMemo(() => {
    if (measuredBlocks.length !== blockDefinitions.length) {
      return [
        {
          blocks: blockDefinitions.map((block, index) => ({
            blockId: block.id,
            pageStart: index === 0,
          })),
          usedHeightPx: 0,
        } satisfies ResumePaginationPage,
      ];
    }

    return paginateResumeBlocks({
      blocks: measuredBlocks,
      pageHeightPx: pageContentHeightPx,
      options: {
        policy: "full",
      },
    });
  }, [blockDefinitions, measuredBlocks, pageContentHeightPx]);

  const previewScale =
    sharedStageLayout && sharedStageLayout.pageWidth > 0
      ? sharedStageLayout.pageWidth / pageSize.widthPx
      : 1;
  const fallbackStackHeightPx = React.useMemo(
    () =>
      pageSize.heightPx * Math.max(1, plannedPages.length) +
      SWISS_MINIMA_PAGE_GAP_PX * Math.max(0, plannedPages.length - 1),
    [pageSize.heightPx, plannedPages.length],
  );

  React.useLayoutEffect(() => {
    if (!onPreviewMetricsChange) {
      return undefined;
    }

    const publishMetrics = () => {
      const measuredHeight = stackRef.current?.getBoundingClientRect().height;
      const stackHeightPx =
        measuredHeight && previewScale > 0
          ? measuredHeight / previewScale
          : fallbackStackHeightPx;

      onPreviewMetricsChange({
        pageCount: Math.max(1, plannedPages.length),
        pageGapPx: SWISS_MINIMA_PAGE_GAP_PX,
        stackHeightPx,
      });
    };

    publishMetrics();

    let frameId: number | null = window.requestAnimationFrame(() => {
      frameId = null;
      publishMetrics();
    });

    if (!stackRef.current || typeof ResizeObserver === "undefined") {
      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      publishMetrics();
    });
    resizeObserver.observe(stackRef.current);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [
    fallbackStackHeightPx,
    onPreviewMetricsChange,
    plannedPages.length,
    previewScale,
  ]);

  const renderPageBlock = React.useCallback(
    (placement: ResumePaginationPlacement, pageIndex: number, blockIndex: number) => {
      const block = blockDefinitionMap.get(placement.blockId);
      if (!block) {
        return null;
      }

      return (
        <div
          key={`${placement.blockId}:${pageIndex}:${blockIndex}:${placement.repeated ? "repeat" : "base"}`}
          data-resume-block-id={placement.blockId}
          data-resume-block-kind={block.kind}
          data-resume-block-page-start={placement.pageStart ? "true" : undefined}
          data-resume-block-repeated={placement.repeated ? "true" : undefined}
          style={{ minWidth: 0 }}
        >
          {block.render({ pageStart: placement.pageStart, measure: false })}
        </div>
      );
    },
    [blockDefinitionMap],
  );

  return (
    <PreviewFrame
      variant={variant}
      comparisonLabel={comparisonLabel}
      compactComparison={compactComparison}
      onActivateComparison={onActivateComparison}
      pageCount={plannedPages.length}
      pageGapPx={SWISS_MINIMA_PAGE_GAP_PX}
    >
      <div
        ref={stackRef}
        className="resume-page-stack"
        data-resume-page-stack="swissminima"
      >
        {plannedPages.map((page, pageIndex) => (
          <div
            key={`swissminima-page-shell-${pageIndex}`}
            className="resume-page-stack__page-shell"
          >
            <article
              ref={pageIndex === 0 ? pageRef : undefined}
              className={`resume-page resume-page--${variant.id}`}
              data-resume-page-index={pageIndex}
              style={swissMinimaPageStyle}
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
                className="resume-page__block-stack"
                style={{
                  position: "absolute",
                  inset: 0,
                  padding:
                    "var(--margin-top) calc(var(--margin-left) - 1mm) var(--margin-top) var(--margin-left)",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                {page.blocks.map((placement, blockIndex) =>
                  renderPageBlock(placement, pageIndex, blockIndex),
                )}
              </div>
            </article>
          </div>
        ))}
      </div>
      <div
        className="resume-page-measure-shell"
        aria-hidden="true"
        data-no-pan="true"
        {...({ inert: "" } as React.HTMLAttributes<HTMLDivElement> & {
          inert: string;
        })}
      >
        <article
          className={`resume-page resume-page--${variant.id} resume-page--measure`}
          data-resume-measure-page="true"
          style={swissMinimaPageStyle}
        >
          <div
            className="resume-page__measure-inner"
            style={{
              padding:
                "var(--margin-top) calc(var(--margin-left) - 1mm) var(--margin-top) var(--margin-left)",
              display: "grid",
              gap: "0",
            }}
          >
            {blockDefinitions.map((block) => (
              <React.Fragment key={`measure-${block.id}`}>
                <div
                  ref={setMeasurementRef(block.id, "page-start")}
                  data-resume-measure-id={block.id}
                  data-resume-measure-kind={block.kind}
                  data-resume-measure-position="page-start"
                >
                  {block.render({ pageStart: true, measure: true })}
                </div>
                <div
                  ref={setMeasurementRef(block.id, "continued")}
                  data-resume-measure-id={block.id}
                  data-resume-measure-kind={block.kind}
                  data-resume-measure-position="continued"
                >
                  {block.render({ pageStart: false, measure: true })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </article>
      </div>
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
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
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
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
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
  const renderableTitle = getRenderableIdentitySubtitle(data.name, data.title);

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
              {renderableTitle ? (
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
                  {renderableTitle}
                </p>
              ) : null}
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

              {data.projects.length > 0 ? (
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
              ) : null}
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
  const stylePreset = React.useContext(ResumeStylePresetContext);
  const pageSize = React.useContext(ResumePageSizeContext);
  const pageVars = buildPageVars(variant, stylePreset, pageSize);
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
  const renderableTitle = getRenderableIdentitySubtitle(data.name, data.title);

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
                {renderableTitle ? (
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
                    {renderableTitle}
                  </p>
                ) : null}
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
              {projectCards.length > 0 ? (
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
              ) : null}

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
  activeTarget,
  inlineEditing,
  onPreviewMetricsChange,
}: {
  variant: ResumeVariant;
  data: ResumeData;
  comparisonLabel?: string;
  compactComparison?: boolean;
  onActivateComparison?: (() => void) | undefined;
  fitToken?: string;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  onPreviewMetricsChange?: ((metrics: ResumePreviewMetrics) => void) | undefined;
}) {
  React.useEffect(() => {
    if (variant.id === "swissminima") {
      return;
    }

    onPreviewMetricsChange?.(DEFAULT_RESUME_PREVIEW_METRICS);
  }, [onPreviewMetricsChange, variant.id]);

  if (variant.id === "swissminima") {
    return (
      <SwissMinimaPage
        variant={variant}
        data={data}
        activeTarget={activeTarget}
        inlineEditing={inlineEditing}
        comparisonLabel={comparisonLabel}
        compactComparison={compactComparison}
        onActivateComparison={onActivateComparison}
        fitToken={fitToken}
        onPreviewMetricsChange={onPreviewMetricsChange}
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
        activeTarget={activeTarget}
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
      activeTarget={activeTarget}
      inlineEditing={inlineEditing}
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
  activeTarget = null,
  inlineEditing = null,
  userZoom = 1,
  stageLayout,
  pageSize = null,
  onRemoveSection,
  onPreviewMetricsChange,
}: ResumePageProps) {
  const resolvedPageSize = React.useMemo(
    () => resolveDocumentPageSize({ pageSize }),
    [pageSize],
  );
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
      <ResumePageSizeContext.Provider value={resolvedPageSize}>
        <ResumeStageLayoutContext.Provider value={stageLayout ?? null}>
          <ResumeUserZoomContext.Provider value={userZoom}>
            <ResumeRemoveSectionContext.Provider value={onRemoveSection ?? null}>
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
                    activeTarget={activeTarget}
                    inlineEditing={inlineEditing}
                    comparisonLabel={isComparisonMode ? variant.label : undefined}
                    compactComparison={compactComparison}
                    fitToken={`${fitToken ?? ""}:${variant.id}`}
                    onPreviewMetricsChange={
                      !isComparisonMode && variants.length === 1
                        ? onPreviewMetricsChange
                        : undefined
                    }
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
            </ResumeRemoveSectionContext.Provider>
          </ResumeUserZoomContext.Provider>
        </ResumeStageLayoutContext.Provider>
      </ResumePageSizeContext.Provider>
    </ResumeStylePresetContext.Provider>
  );
}
