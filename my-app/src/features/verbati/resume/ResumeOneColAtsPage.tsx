import React from "react";

import type { ResumeActiveTarget } from "../resumeLinking";
import { buildResumeEducationDisplay } from "./resumeEducation";
import type {
  ResumeData,
  WorkshopResponsibilitiesRichContent,
  WorkshopResponsibilityTextRun,
} from "./resume.types";
import {
  resolveWorkshopPreviewLayoutContract,
  type ResumeTemplateDefinition,
} from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopCommittedResponsibilitiesRichContent,
  WorkshopExperienceContentBlock,
  WorkshopResumeCommittedFragment,
  WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import {
  PreviewItemRegion,
  PreviewSectionRegion,
  buildPreviewRegionAttrs,
  buildProjectPreviewFieldId,
} from "./resumePreviewRegions";
import {
  InlineEditableText,
  type InlineEditableTag,
  type ResumeInlineEditing,
} from "./InlineEditableText";

type InlinePreviewAttrs = Record<string, string | undefined>;

type ResumeOneColAtsPageProps = {
  data: ResumeData;
  page: WorkshopResumeCommittedPage;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
};

const experienceWrapStyle = {
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const,
};

const workshopLabelTextStyle = {
  fontSize: "var(--text-caption-size)",
  lineHeight: "var(--text-caption-line)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "var(--color-text-subtle)",
};

const workshopVisibleListStyle = {
  listStyleType: "disc" as const,
  listStylePosition: "outside" as const,
};

function formatMillimeters(value: number) {
  return `${value}mm`;
}

function buildAdjustedFontSize(args: {
  baseVar: "--text-display-size" | "--text-title-size" | "--text-body-size" | "--text-body-sm-size";
  adjustVar:
    | "--display-size-adjust"
    | "--title-size-adjust"
    | "--body-size-adjust"
    | "--body-sm-size-adjust";
  offsetMm?: number;
  offsetVar?:
    | "--workshop-section-title-reduction"
    | "--workshop-experience-heading-size-adjust";
  offsetOperator?: "+" | "-";
}) {
  if (args.offsetVar) {
    return `calc(var(${args.baseVar}) + var(${args.adjustVar}) ${args.offsetOperator ?? "+"} var(${args.offsetVar}))`;
  }

  const offsetMm = args.offsetMm ?? 0;
  if (offsetMm === 0) {
    return `calc(var(${args.baseVar}) + var(${args.adjustVar}))`;
  }

  return `calc(var(${args.baseVar}) + var(${args.adjustVar}) ${offsetMm < 0 ? "-" : "+"} ${formatMillimeters(Math.abs(offsetMm))})`;
}

const workshopDisplayFontSize = buildAdjustedFontSize({
  baseVar: "--text-display-size",
  adjustVar: "--display-size-adjust",
});
const workshopBodyFontSize = buildAdjustedFontSize({
  baseVar: "--text-body-size",
  adjustVar: "--body-size-adjust",
});
const workshopBodySmFontSize = buildAdjustedFontSize({
  baseVar: "--text-body-sm-size",
  adjustVar: "--body-sm-size-adjust",
});
const workshopCompactRowTextStyle = {
  fontSize: workshopBodySmFontSize,
  lineHeight: "var(--text-body-sm-line)",
};

function renderSectionHeading(title: string, continued: boolean) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "1.4mm",
        marginBottom: "var(--main-heading-margin)",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--heading-font, var(--font-heading-family))",
          fontSize: buildAdjustedFontSize({
            baseVar: "--text-title-size",
            adjustVar: "--title-size-adjust",
            offsetVar: "--workshop-section-title-reduction",
            offsetOperator: "-",
          }),
          lineHeight: "var(--text-title-line)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          color: "var(--color-accent)",
        }}
      >
        {title}
      </h2>
      {continued ? (
        <span
          style={workshopLabelTextStyle}
        >
          Continued
        </span>
      ) : null}
      <div
        style={{
          flex: 1,
          height: "0.35mm",
          background:
            "color-mix(in srgb, var(--color-accent) 58%, transparent)",
        }}
      />
    </div>
  );
}

function renderExperienceBlocks(args: {
  blocks: WorkshopExperienceContentBlock[];
  listGapMm: number;
}) {
  const nodes: React.ReactNode[] = [];
  let pendingBullets: WorkshopExperienceContentBlock[] = [];

  const flushBullets = () => {
    if (pendingBullets.length === 0) {
      return;
    }

    nodes.push(
      <ul
        key={`bullets-${nodes.length}`}
        style={{
          margin: 0,
          paddingLeft: "var(--flow-list-indent)",
          ...workshopVisibleListStyle,
          display: "grid",
          gap: formatMillimeters(args.listGapMm),
        }}
      >
        {pendingBullets.map((block) => (
          <li
            key={`${block.kind}-${block.text}`}
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
              ...experienceWrapStyle,
            }}
          >
            {block.text}
          </li>
        ))}
      </ul>,
    );
    pendingBullets = [];
  };

  args.blocks.forEach((block) => {
    if (block.kind === "bullet") {
      pendingBullets.push(block);
      return;
    }

    flushBullets();
    nodes.push(
      <p
        key={`${block.kind}-${block.text}`}
        style={{
          margin: 0,
          fontSize: workshopBodyFontSize,
          lineHeight: "var(--text-body-line)",
          ...experienceWrapStyle,
        }}
      >
        {block.text}
      </p>,
    );
  });

  flushBullets();

  return nodes;
}

function renderResponsibilityRun(
  run: WorkshopResponsibilityTextRun,
  key: string,
) {
  let content: React.ReactNode = run.text;

  if (run.underline) {
    content = <u>{content}</u>;
  }

  if (run.italic) {
    content = <em>{content}</em>;
  }

  if (run.bold) {
    content = <strong>{content}</strong>;
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
}

function renderResponsibilitiesRich(args: {
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent;
  listGapMm: number;
}) {
  return args.rich.blocks.map((block, blockIndex) => {
    if (block.kind === "paragraph") {
      return (
        <p
          key={`paragraph-${blockIndex}`}
          style={{
            margin: 0,
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            ...experienceWrapStyle,
          }}
        >
          {block.runs.map((run, runIndex) =>
            renderResponsibilityRun(run, `paragraph-${blockIndex}-run-${runIndex}`),
          )}
        </p>
      );
    }

    return (
      <ul
        key={`bullet-list-${blockIndex}`}
        style={{
          margin: 0,
          paddingLeft: "var(--flow-list-indent)",
          ...workshopVisibleListStyle,
          display: "grid",
          gap: formatMillimeters(args.listGapMm),
        }}
      >
        {block.items.map((item, itemIndex) => (
          <li
            key={`bullet-list-${blockIndex}-item-${itemIndex}`}
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
              ...experienceWrapStyle,
            }}
          >
            {item.runs.map((run, runIndex) =>
              renderResponsibilityRun(
                run,
                `bullet-list-${blockIndex}-item-${itemIndex}-run-${runIndex}`,
              ),
            )}
          </li>
        ))}
      </ul>
    );
  });
}

function responsibilitiesRichHasPartialContent(
  rich:
    | WorkshopResponsibilitiesRichContent
    | WorkshopCommittedResponsibilitiesRichContent,
) {
  return rich.blocks.some((block) => {
    if (block.kind === "paragraph") {
      return "partial" in block && block.partial === true;
    }

    return block.items.some((item) => "partial" in item && item.partial === true);
  });
}

function renderExperienceContent(args: {
  item: {
    id?: string;
    blocks: WorkshopExperienceContentBlock[];
    responsibilitiesRich?: WorkshopCommittedResponsibilitiesRichContent;
  };
  sectionId?: string;
  sectionType?: string;
  sectionTitle?: string;
  listGapMm: number;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  if (args.inlineEditing?.enabled) {
    let bulletIndex = 0;

    const nodes = args.item.blocks.map((block, blockIndex) => {
      const baseTarget = {
        sectionId: args.sectionId ?? "",
        sectionType: args.sectionType ?? "experience",
      };
      if (block.kind === "bullet") {
        const currentBulletIndex = bulletIndex;
        bulletIndex += 1;
        const editTarget = {
          ...baseTarget,
          fieldPath: `structuredContent.item:${args.item.id ?? ""}.responsibilityBullets.${currentBulletIndex}`,
          fieldKind: "bullet" as const,
          bulletIndex: currentBulletIndex,
        };

        return (
          <ul
            key={`editable-bullet-list-${blockIndex}`}
            style={{
              margin: 0,
              paddingLeft: "var(--flow-list-indent)",
              ...workshopVisibleListStyle,
              display: "grid",
              gap: formatMillimeters(args.listGapMm),
            }}
          >
            <li>
              <InlineEditableText
                as="span"
                value={block.text}
                editable
                editTarget={editTarget}
                onActivate={(target) => args.inlineEditing?.onActivate(target)}
                onDeactivate={args.inlineEditing?.onDeactivate}
                ariaLabel="Edit experience bullet"
                data-placeholder="Type an impact bullet..."
                onPlainTextChange={(text) =>
                  args.inlineEditing?.onFieldChange?.(editTarget, text)
                }
                data-preview-section={args.sectionType}
                data-preview-section-id={args.sectionId}
                data-preview-section-title={args.sectionTitle}
                data-preview-item-id={`${args.item.id ?? "experience"}-bullet-${currentBulletIndex}`}
                style={{
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                  ...experienceWrapStyle,
                }}
              />
            </li>
          </ul>
        );
      }

      const editTarget = {
        ...baseTarget,
        fieldPath: `structuredContent.item:${args.item.id ?? ""}.responsibilities`,
        fieldKind: "paragraph" as const,
      };

      return (
        <InlineEditableText
          key={`editable-experience-text-${blockIndex}`}
          value={block.text}
          editable
          editTarget={editTarget}
          onActivate={(target) => args.inlineEditing?.onActivate(target)}
          onDeactivate={args.inlineEditing?.onDeactivate}
          ariaLabel="Edit experience text"
          data-placeholder="Type an impact bullet..."
          onPlainTextChange={(text) =>
            args.inlineEditing?.onFieldChange?.(editTarget, text)
          }
          data-preview-section={args.sectionType}
          data-preview-section-id={args.sectionId}
          data-preview-section-title={args.sectionTitle}
          data-preview-item-id={`${args.item.id ?? "experience"}-text-${blockIndex}`}
          style={{
            margin: 0,
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            ...experienceWrapStyle,
          }}
        />
      );
    });

    nodes.push(
      <div key="editable-add-bullet">
        {renderInlineAddButton({
          inlineEditing: args.inlineEditing,
          sectionId: args.sectionId,
          sectionType: args.sectionType ?? "experience",
          itemKind: "bullet",
          parentItemId: args.item.id,
          label: "Add bullet",
        })}
      </div>,
    );

    return nodes;
  }

  const rich = args.item.responsibilitiesRich;
  if (!rich || rich.blocks.length === 0) {
    return renderExperienceBlocks({
      blocks: args.item.blocks,
      listGapMm: args.listGapMm,
    });
  }

  if (
    args.item.blocks.some((block) => block.partial === true) ||
    responsibilitiesRichHasPartialContent(rich)
  ) {
    return renderExperienceBlocks({
      blocks: args.item.blocks,
      listGapMm: args.listGapMm,
    });
  }

  return renderResponsibilitiesRich({
    rich,
    listGapMm: args.listGapMm,
  });
}

function renderInlineField(args: {
  as?: InlineEditableTag;
  value: string;
  editable: boolean;
  inlineEditing?: ResumeInlineEditing | null;
  editTarget: {
    sectionId: string;
    sectionType: string;
    fieldPath: string;
    fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
    itemIndex?: number;
    bulletIndex?: number;
    chipIndex?: number;
  };
  ariaLabel: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  previewAttrs?: InlinePreviewAttrs;
  preservePreviewItemId?: boolean;
}) {
  const previewAttrs = {
    ...(args.previewAttrs ?? {}),
  } as InlinePreviewAttrs;
  if (!args.preservePreviewItemId) {
    delete previewAttrs["data-preview-item-id"];
  }

  return (
    <InlineEditableText
      as={args.as}
      value={args.value}
      editable={args.editable}
      editTarget={args.editTarget}
      onActivate={(target) => args.inlineEditing?.onActivate(target)}
      onDeactivate={args.inlineEditing?.onDeactivate}
      ariaLabel={args.ariaLabel}
      data-placeholder={args.placeholder ?? ""}
      onPlainTextChange={(text) =>
        args.inlineEditing?.onFieldChange?.(args.editTarget, text)
      }
      {...previewAttrs}
      className={args.className}
      style={args.style}
    />
  );
}

function renderInlineAddButton(args: {
  inlineEditing?: ResumeInlineEditing | null;
  sectionId?: string;
  sectionType: string;
  itemKind: NonNullable<ResumeInlineEditing["onAddItem"]> extends (
    request: infer Request,
  ) => void
    ? Request extends { itemKind: infer Kind }
      ? Kind
      : never
    : never;
  label: string;
  parentItemId?: string;
}) {
  if (!args.inlineEditing?.enabled || !args.sectionId) {
    return null;
  }

  return (
    <button
      type="button"
      className="dasti-cv-paper-inline-add"
      data-paper-inline-add="true"
      data-paper-section-id={args.sectionId}
      data-paper-section-type={args.sectionType}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        args.inlineEditing?.onAddItem?.({
          sectionId: args.sectionId ?? "",
          sectionType: args.sectionType,
          itemKind: args.itemKind,
          parentItemId: args.parentItemId,
        });
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      + {args.label}
    </button>
  );
}

function renderProfileFragment(args: {
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const { data, activeTarget, inlineEditing } = args;
  const profileSectionId = data.profileSectionId ?? "profile";
  const editable = Boolean(inlineEditing?.enabled);
  const populatedProfileFieldKeys = new Set([
    ...data.contact.map((item) => String(item.itemId ?? item.label.toLowerCase())),
    ...data.metadata.map((item) => String(item.itemId ?? item.label.toLowerCase())),
  ]);
  const optionalContactFields = [
    { key: "email", label: "email" },
    { key: "phone", label: "phone" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "website", label: "website" },
    { key: "location", label: "location" },
  ].filter((item) => !populatedProfileFieldKeys.has(item.key));

  return (
    <header
      key="profile"
      data-preview-section="profile"
      style={{
        display: "grid",
        gap: "var(--header-row-gap)",
        paddingBottom: "var(--header-bottom-padding)",
        borderBottom:
          "0.3mm solid color-mix(in srgb, var(--color-accent) 42%, transparent)",
      }}
    >
      <div style={{ display: "grid", gap: "1.5mm" }}>
        {renderInlineField({
          as: "h1",
          value: data.name,
          editable,
          inlineEditing,
          editTarget: {
            sectionId: profileSectionId,
            sectionType: "profile",
            fieldPath: "structuredContent.0.name",
            fieldKind: "heading",
          },
          ariaLabel: "Edit name",
          placeholder: "Name",
          previewAttrs: buildPreviewRegionAttrs({
            sectionType: "profile",
            sectionId: profileSectionId,
            sectionTitle: "Profile",
            activeTarget,
            surface: "item",
          }),
          style: {
            margin: 0,
            fontFamily: "var(--heading-font, var(--font-heading-family))",
            fontSize: workshopDisplayFontSize,
            lineHeight: "var(--text-display-line)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          },
        })}
        {data.title || editable ? (
          renderInlineField({
            value: data.title,
            editable,
            inlineEditing,
            editTarget: {
              sectionId: profileSectionId,
              sectionType: "profile",
              fieldPath: "structuredContent.0.desiredPosition",
              fieldKind: "meta",
            },
            ariaLabel: "Edit title",
            placeholder: "Target title",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "profile",
              sectionId: profileSectionId,
              sectionTitle: "Profile",
              activeTarget,
              surface: "item",
            }),
            style: {
              margin: 0,
              fontSize: buildAdjustedFontSize({
                baseVar: "--text-body-size",
                adjustVar: "--body-size-adjust",
                offsetMm: 0.1,
              }),
              lineHeight: "var(--text-body-line)",
              color: "var(--color-text-muted)",
            },
          })
        ) : null}
      </div>
      {data.contact.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "1.1mm",
          }}
        >
          {data.contact.map((item) => (
            <React.Fragment key={item.itemId ?? item.label}>
              {renderInlineField({
              as: "p",
              value: item.value,
              editable,
              inlineEditing,
              editTarget: {
                sectionId: item.sectionId ?? profileSectionId,
                sectionType: "profile",
                fieldPath: `structuredContent.0.${item.itemId ?? item.label.toLowerCase()}`,
                fieldKind: "meta",
              },
              ariaLabel: `Edit ${item.label}`,
              placeholder: item.label,
              previewAttrs: buildPreviewRegionAttrs({
                sectionType: "contact",
                sectionId: item.sectionId ?? profileSectionId,
                sectionTitle: "Contact",
                itemId: item.itemId,
                activeTarget,
                surface: "item",
              }),
              style: {
                margin: 0,
                fontSize: "var(--text-meta-size)",
                lineHeight: "var(--text-meta-line)",
                color: "var(--color-text-muted)",
              },
            })}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {data.metadata.length > 0 ? (
        <PreviewSectionRegion
          as="dl"
          sectionType="notes"
          sectionId={data.profileSectionId}
          sectionTitle="Metadata"
          activeTarget={activeTarget}
          surface="section"
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(32mm, 1fr))",
            gap: "2.4mm 4mm",
          }}
        >
          {data.metadata.map((item) => (
            <PreviewItemRegion
              as="div"
              key={item.itemId ?? item.label}
              sectionType="notes"
              sectionId={item.sectionId ?? data.profileSectionId}
              sectionTitle="Metadata"
              itemId={item.itemId}
              activeTarget={activeTarget}
              surface="item"
              style={{ display: "grid", gap: "0.5mm" }}
            >
              <dt
                style={{
                  margin: 0,
                  ...workshopLabelTextStyle,
                }}
              >
                {item.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                }}
              >
                {renderInlineField({
                  as: "span",
                  value: item.value,
                  editable,
                  inlineEditing,
                  editTarget: {
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionType: "profile",
                    fieldPath: `structuredContent.0.${item.itemId ?? item.label.toLowerCase()}`,
                    fieldKind: "meta",
                  },
                  ariaLabel: `Edit ${item.label}`,
                  placeholder: item.label,
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "notes",
                    sectionId: item.sectionId ?? profileSectionId,
                    sectionTitle: "Metadata",
                    itemId: item.itemId,
                    activeTarget,
                    surface: "item",
                  }),
                  style: {
                    fontSize: "var(--text-meta-size)",
                    lineHeight: "var(--text-meta-line)",
                  },
                })}
              </dd>
            </PreviewItemRegion>
          ))}
        </PreviewSectionRegion>
      ) : null}
      {editable && optionalContactFields.length > 0 ? (
        <div
          data-paper-profile-contact-add="true"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.4mm 2.2mm",
          }}
        >
          {optionalContactFields.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dasti-cv-paper-inline-add"
              data-paper-inline-add="true"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                inlineEditing?.onAddItem?.({
                  sectionId: profileSectionId,
                  sectionType: "profile",
                  itemKind: "profile-contact",
                  parentItemId: item.key,
                });
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              + {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function renderFragmentContent(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const { fragment, data, activeTarget, inlineEditing } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);

  switch (fragment.kind) {
    case "profile":
      return renderProfileFragment({ data, activeTarget, inlineEditing });
    case "summary":
      {
        const editTarget = {
          sectionId: fragment.sectionId ?? data.summarySectionId ?? "summary",
          sectionType: "summary",
          fieldPath: "structuredContent.0.summary",
          fieldKind: "paragraph" as const,
        };
      return (
        <InlineEditableText
          key={fragment.fragmentId}
          value={fragment.text}
          editable={Boolean(inlineEditing?.enabled)}
          editTarget={editTarget}
          onActivate={(target) => inlineEditing?.onActivate(target)}
          onDeactivate={inlineEditing?.onDeactivate}
          ariaLabel="Edit Summary"
          data-placeholder="Write summary..."
          onPlainTextChange={(text) =>
            inlineEditing?.onFieldChange
              ? inlineEditing.onFieldChange(editTarget, text)
              : inlineEditing?.onSummaryChange(text)
          }
          {...buildPreviewRegionAttrs({
            sectionType: "summary",
            sectionId: fragment.sectionId ?? data.summarySectionId,
            sectionTitle: fragment.title ?? "Summary",
            itemId: "summary",
            activeTarget,
            surface: "item",
          })}
          style={{
            margin: 0,
            maxWidth: "var(--header-summary-width)",
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            color: "var(--color-text)",
          }}
        />
      );
      }
    case "experience":
      return [
        ...fragment.items.map((item) => {
        const itemFieldPath = (field: string) =>
          `structuredContent.item:${item.id}.${field}`;
        return (
          <PreviewItemRegion
            as="article"
            key={`${fragment.fragmentId}:${item.id}:${item.continued ? "continued" : "initial"}`}
            sectionType="experience"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Experience"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              display: "grid",
              gap: formatMillimeters(workshopLayout.experienceBlockGapMm),
            }}
            data-preview-row-id={item.id}
          >
            <div
              style={{
                display: "grid",
                gap: formatMillimeters(workshopLayout.experienceMetaGapMm),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "1.2mm",
                  flexWrap: "wrap",
                }}
              >
                {renderInlineField({
                  as: "h3",
                  value: item.role,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "experience",
                    fieldPath: itemFieldPath("position"),
                    fieldKind: "heading",
                  },
                  ariaLabel: "Edit experience title",
                  placeholder: "Job title",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "experience",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Experience",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                  style: {
                    margin: 0,
                    fontFamily: "var(--heading-font, var(--font-heading-family))",
                    fontSize: buildAdjustedFontSize({
                      baseVar: "--text-body-size",
                      adjustVar: "--body-size-adjust",
                      offsetVar: "--workshop-experience-heading-size-adjust",
                    }),
                    lineHeight: "var(--workshop-experience-heading-line-height)",
                    fontWeight: 700,
                  },
                })}
                {item.continued ? (
                  <span
                    style={workshopLabelTextStyle}
                  >
                    Continued
                  </span>
                ) : null}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                  color: "var(--color-text-muted)",
                  ...experienceWrapStyle,
                }}
              >
                {renderInlineField({
                  as: "span",
                  value: item.company,
                  editable: Boolean(inlineEditing?.enabled),
                  inlineEditing,
                  editTarget: {
                    sectionId: fragment.sectionId ?? "",
                    sectionType: "experience",
                    fieldPath: itemFieldPath("company"),
                    fieldKind: "meta",
                  },
                  ariaLabel: "Edit company",
                  placeholder: "Company",
                  previewAttrs: buildPreviewRegionAttrs({
                    sectionType: "experience",
                    sectionId: fragment.sectionId,
                    sectionTitle: fragment.title ?? "Experience",
                    itemId: item.id,
                    activeTarget,
                    surface: "item",
                  }),
                })}
                {item.location || inlineEditing?.enabled ? " · " : null}
                {item.location || inlineEditing?.enabled
                  ? renderInlineField({
                      as: "span",
                      value: item.location,
                      editable: Boolean(inlineEditing?.enabled),
                      inlineEditing,
                      editTarget: {
                        sectionId: fragment.sectionId ?? "",
                        sectionType: "experience",
                        fieldPath: itemFieldPath("location"),
                        fieldKind: "meta",
                      },
                      ariaLabel: "Edit location",
                      placeholder: "Location",
                      previewAttrs: buildPreviewRegionAttrs({
                        sectionType: "experience",
                        sectionId: fragment.sectionId,
                        sectionTitle: fragment.title ?? "Experience",
                        itemId: item.id,
                        activeTarget,
                        surface: "item",
                      }),
                    })
                  : null}
                {item.period ? " · " : null}
                {item.period}
              </p>
            </div>
            {renderExperienceContent({
              item,
              sectionId: fragment.sectionId,
              sectionType: "experience",
              sectionTitle: fragment.title ?? "Experience",
              listGapMm: workshopLayout.listGapMm,
              inlineEditing,
            })}
          </PreviewItemRegion>
        );
        }),
        <div key={`${fragment.fragmentId}:add-experience`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "experience",
            itemKind: "experience",
            label: "Add experience",
          })}
        </div>,
      ];
    case "education":
      return [
        ...fragment.items.map((item) => {
        const educationDisplay = buildResumeEducationDisplay(item);
        const itemFieldPath = (field: string) =>
          `structuredContent.item:${item.id}.${field}`;
        return (
          <PreviewItemRegion
            as="article"
            key={item.id}
            sectionType="education"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Education"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              display: "grid",
              gap: "var(--education-gap)",
            }}
            data-preview-row-id={item.id}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--heading-font, var(--font-heading-family))",
                fontSize: workshopBodyFontSize,
                fontWeight: 700,
              }}
            >
              {renderInlineField({
                as: "span",
                value: item.degree || educationDisplay.title,
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "education",
                  fieldPath: itemFieldPath("degree"),
                  fieldKind: "heading",
                  },
                ariaLabel: "Edit education degree",
                placeholder: "Degree",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "education",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Education",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
              })}
              {item.fieldOfStudy ? ", " : null}
              {item.fieldOfStudy
                ? renderInlineField({
                    as: "span",
                    value: item.fieldOfStudy,
                    editable: Boolean(inlineEditing?.enabled),
                    inlineEditing,
                    editTarget: {
                      sectionId: fragment.sectionId ?? "",
                      sectionType: "education",
                      fieldPath: itemFieldPath("fieldOfStudy"),
                      fieldKind: "heading",
                    },
                    ariaLabel: "Edit field of study",
                    placeholder: "Field of study",
                    previewAttrs: buildPreviewRegionAttrs({
                      sectionType: "education",
                      sectionId: fragment.sectionId,
                      sectionTitle: fragment.title ?? "Education",
                      itemId: item.id,
                      activeTarget,
                      surface: "item",
                    }),
                  })
                : null}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-meta-size)",
                lineHeight: "var(--text-meta-line)",
                color: "var(--color-text-muted)",
              }}
            >
              {renderInlineField({
                as: "span",
                value: item.school || educationDisplay.previewMeta,
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "education",
                  fieldPath: itemFieldPath("institution"),
                  fieldKind: "meta",
                },
                ariaLabel: "Edit school",
                placeholder: "School",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "education",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Education",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
              })}
              {item.period ? " · " : null}
              {item.period}
            </p>
          </PreviewItemRegion>
        );
        }),
        <div key={`${fragment.fragmentId}:add-education`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "education",
            itemKind: "education",
            label: "Add education",
          })}
        </div>,
      ];
    case "skills":
      return [
        ...fragment.items.map((item, itemIndex) => (
        <React.Fragment key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.name,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "skills",
              fieldPath: `structuredContent.item:${item.id}.name`,
              fieldKind: "chip",
              chipIndex: itemIndex,
            },
            ariaLabel: "Edit skill",
            placeholder: "Add skill",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "skills",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Skills",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: {
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--skill-pad-block) var(--skill-pad-inline)",
            borderRadius: "999px",
            background: "var(--color-accent-soft)",
            fontSize: workshopBodySmFontSize,
            lineHeight: "var(--text-body-sm-line)",
            },
          })}
        </React.Fragment>
        )),
        <React.Fragment key={`${fragment.fragmentId}:add-skill`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "skills",
            itemKind: "skill",
            label: "Add skill",
          })}
        </React.Fragment>,
      ];
    case "selected_projects":
      return [
        ...fragment.items.map((item) => (
        <article
          key={item.id}
          style={{
            display: "grid",
            gap: "var(--project-gap)",
            padding: "var(--project-padding)",
            borderRadius: "4mm",
            background: "color-mix(in srgb, var(--color-accent-soft) 72%, white 28%)",
          }}
        >
          <PreviewItemRegion
            as="div"
            sectionType="selected_projects"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Selected projects"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              display: "grid",
              gap: formatMillimeters(workshopLayout.compactMetaGapMm),
            }}
          >
            {renderInlineField({
              as: "h3",
              value: item.name,
              editable: Boolean(inlineEditing?.enabled),
              inlineEditing,
              editTarget: {
                sectionId: fragment.sectionId ?? "",
                sectionType: "projects",
                fieldPath: `structuredContent.item:${item.id}.name`,
                fieldKind: "heading",
              },
              ariaLabel: "Edit project name",
              placeholder: "Project name",
              previewAttrs: buildPreviewRegionAttrs({
                sectionType: "selected_projects",
                sectionId: fragment.sectionId,
                sectionTitle: fragment.title ?? "Selected projects",
                itemId: item.id,
                activeTarget,
                surface: "item",
              }),
              style: {
                margin: 0,
                fontFamily: "var(--heading-font, var(--font-heading-family))",
                fontSize: workshopBodyFontSize,
                fontWeight: 700,
              },
            })}
            {item.meta || inlineEditing?.enabled ? (
              renderInlineField({
                value: item.meta,
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "projects",
                  fieldPath: `structuredContent.item:${item.id}.meta`,
                  fieldKind: "meta",
                },
                ariaLabel: "Edit project meta",
                placeholder: "Project context",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "selected_projects",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Selected projects",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
                style: {
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                  color: "var(--color-text-muted)",
                },
              })
            ) : null}
          </PreviewItemRegion>
          {renderInlineField({
            value: item.description,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "projects",
              fieldPath: `structuredContent.item:${item.id}.description`,
              fieldKind: "paragraph",
            },
            ariaLabel: "Edit project description",
            placeholder: "Project details",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "selected_projects",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Selected projects",
              itemId: buildProjectPreviewFieldId(item.id, "description"),
              activeTarget,
              surface: "item",
            }),
            style: {
              margin: 0,
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            },
          })}
        </article>
        )),
        <div key={`${fragment.fragmentId}:add-project`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "projects",
            itemKind: "project",
            label: "Add project",
          })}
        </div>,
      ];
    case "languages":
      return [
        ...fragment.items.map((item) => (
        <li key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.name,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "languages",
              fieldPath: `structuredContent.item:${item.id}.name`,
              fieldKind: "chip",
            },
            ariaLabel: "Edit language",
            placeholder: "Add language",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "languages",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Languages",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: workshopCompactRowTextStyle,
          })}
          {item.level || inlineEditing?.enabled ? " · " : null}
          {item.level || inlineEditing?.enabled
            ? renderInlineField({
                as: "span",
                value: item.level,
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "languages",
                  fieldPath: `structuredContent.item:${item.id}.level`,
                  fieldKind: "meta",
                },
                ariaLabel: "Edit language level",
                placeholder: "Level",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "languages",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Languages",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
                style: workshopCompactRowTextStyle,
              })
            : null}
        </li>
        )),
        <li key={`${fragment.fragmentId}:add-language`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "languages",
            itemKind: "language",
            label: "Add language",
          })}
        </li>,
      ];
    case "certifications":
      return [
        ...fragment.items.map((item) => (
        <li key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.name,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "certifications",
              fieldPath: `structuredContent.item:${item.id}.certificationName`,
              fieldKind: "paragraph",
            },
            ariaLabel: "Edit certification",
            placeholder: "Certification",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "certifications",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Certifications",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: {
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            },
          })}
          {item.issuer || inlineEditing?.enabled ? " · " : null}
          {item.issuer || inlineEditing?.enabled
            ? renderInlineField({
                as: "span",
                value: item.issuer ?? "",
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "certifications",
                  fieldPath: `structuredContent.item:${item.id}.issuingOrganization`,
                  fieldKind: "meta",
                },
                ariaLabel: "Edit certification issuer",
                placeholder: "Issuer",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "certifications",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Certifications",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
                style: {
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                },
              })
            : null}
          {item.meta ? ` · ${item.meta}` : null}
        </li>
        )),
        <li key={`${fragment.fragmentId}:add-certification`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "certifications",
            itemKind: "certification",
            label: "Add certification",
          })}
        </li>,
      ];
    case "achievements":
      return [
        ...fragment.items.map((item) => (
        <li key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.text,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "achievements",
              fieldPath: `structuredContent.item:${item.id}.text`,
              fieldKind: "paragraph",
            },
            ariaLabel: "Edit achievement",
            placeholder: "Add achievement",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "achievements",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Achievements",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: {
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            },
          })}
        </li>
        )),
        <li key={`${fragment.fragmentId}:add-achievement`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "achievements",
            itemKind: "achievement",
            label: "Add achievement",
          })}
        </li>,
      ];
    case "affiliations":
      return [
        ...fragment.items.map((item) => (
        <li key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.organizationName,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "affiliations",
              fieldPath: `structuredContent.item:${item.id}.organizationName`,
              fieldKind: "paragraph",
            },
            ariaLabel: "Edit affiliation organization",
            placeholder: "Organization",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "affiliations",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Affiliations",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: {
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            },
          })}
          {item.roleOrMembershipType || inlineEditing?.enabled ? " · " : null}
          {item.roleOrMembershipType || inlineEditing?.enabled
            ? renderInlineField({
                as: "span",
                value: item.roleOrMembershipType ?? "",
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "affiliations",
                  fieldPath: `structuredContent.item:${item.id}.roleOrMembershipType`,
                  fieldKind: "meta",
                },
                ariaLabel: "Edit affiliation role",
                placeholder: "Role",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "affiliations",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Affiliations",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
                style: {
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                },
              })
            : null}
          {item.dateRange ? ` · ${item.dateRange}` : null}
          {item.notes || inlineEditing?.enabled ? " · " : null}
          {item.notes || inlineEditing?.enabled
            ? renderInlineField({
                as: "span",
                value: item.notes ?? "",
                editable: Boolean(inlineEditing?.enabled),
                inlineEditing,
                editTarget: {
                  sectionId: fragment.sectionId ?? "",
                  sectionType: "affiliations",
                  fieldPath: `structuredContent.item:${item.id}.notes`,
                  fieldKind: "paragraph",
                },
                ariaLabel: "Edit affiliation notes",
                placeholder: "Notes",
                previewAttrs: buildPreviewRegionAttrs({
                  sectionType: "affiliations",
                  sectionId: fragment.sectionId,
                  sectionTitle: fragment.title ?? "Affiliations",
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                }),
                style: {
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                },
              })
            : null}
        </li>
        )),
        <li key={`${fragment.fragmentId}:add-affiliation`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "affiliations",
            itemKind: "affiliation",
            label: "Add affiliation",
          })}
        </li>,
      ];
    case "hobbies":
      return [
        ...fragment.items.map((item, itemIndex) => (
        <li key={item.id}>
          {renderInlineField({
            as: "span",
            value: item.name,
            editable: Boolean(inlineEditing?.enabled),
            inlineEditing,
            editTarget: {
              sectionId: fragment.sectionId ?? "",
              sectionType: "hobbies",
              fieldPath: `structuredContent.item:${item.id}.name`,
              fieldKind: "chip",
              chipIndex: itemIndex,
            },
            ariaLabel: "Edit hobby",
            placeholder: "Add hobby",
            previewAttrs: buildPreviewRegionAttrs({
              sectionType: "hobbies",
              sectionId: fragment.sectionId,
              sectionTitle: fragment.title ?? "Hobbies",
              itemId: item.id,
              activeTarget,
              surface: "item",
            }),
            preservePreviewItemId: true,
            style: workshopCompactRowTextStyle,
          })}
        </li>
        )),
        <li key={`${fragment.fragmentId}:add-hobby`}>
          {renderInlineAddButton({
            inlineEditing,
            sectionId: fragment.sectionId,
            sectionType: "hobbies",
            itemKind: "hobby",
            label: "Add hobby",
          })}
        </li>,
      ];
    case "additional_information":
      return fragment.items.map((item) => (
        (() => {
          const resolvedSectionId = item.sectionId ?? fragment.sectionId ?? "";
          const resolvedSectionType = item.sectionType ?? fragment.sectionType;
          const resolvedSectionTitle =
            item.sectionTitle || fragment.title || "Additional information";
          const editTarget = {
            sectionId: resolvedSectionId,
            sectionType: resolvedSectionType,
            fieldPath: "blocks.0.plainText",
            fieldKind: "paragraph" as const,
          };

          return (
            <PreviewItemRegion
              as="article"
              key={item.id}
              sectionType={fragment.sectionType}
              sectionId={fragment.sectionId}
              sectionTitle={fragment.title ?? "Additional information"}
              itemId={item.id}
              activeTarget={activeTarget}
              surface="item"
              style={{ display: "grid", gap: "0.8mm" }}
            >
              {item.sectionTitle && item.sectionTitle !== fragment.title ? (
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--heading-font, var(--font-heading-family))",
                    fontSize: workshopBodyFontSize,
                    fontWeight: 700,
                  }}
                >
                  {item.sectionTitle}
                </h3>
              ) : null}
              <InlineEditableText
                value={item.text}
                editable={Boolean(inlineEditing?.enabled)}
                editTarget={editTarget}
                onActivate={(target) => inlineEditing?.onActivate(target)}
                onDeactivate={inlineEditing?.onDeactivate}
                ariaLabel={`Edit ${resolvedSectionTitle}`}
                onPlainTextChange={(text) =>
                  inlineEditing?.onFieldChange
                    ? inlineEditing.onFieldChange(editTarget, text)
                    : inlineEditing?.onTextSectionChange(resolvedSectionId, text)
                }
                {...buildPreviewRegionAttrs({
                  sectionType: resolvedSectionType,
                  sectionId: resolvedSectionId,
                  sectionTitle: resolvedSectionTitle,
                  itemId: item.id,
                  activeTarget,
                  surface: "item",
                })}
                style={{
                  margin: 0,
                  fontSize: workshopBodyFontSize,
                  lineHeight: "var(--text-body-line)",
                }}
              />
            </PreviewItemRegion>
          );
        })()
      ));
  }
}

function renderSectionFragment(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
  inlineEditing?: ResumeInlineEditing | null;
}) {
  const { fragment, data, activeTarget, inlineEditing } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);
  if (!fragment.title) {
    return renderFragmentContent({
      fragment,
      data,
      activeTarget,
      template: args.template,
      inlineEditing,
    });
  }

  const content =
    fragment.kind === "skills" ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--skill-gap)",
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
        })}
      </div>
    ) : fragment.kind === "languages" ||
      fragment.kind === "certifications" ||
      fragment.kind === "achievements" ||
      fragment.kind === "affiliations" ||
      fragment.kind === "hobbies" ? (
      <ul
        style={{
          margin: 0,
          paddingLeft: "var(--flow-list-indent)",
          ...workshopVisibleListStyle,
          display: "grid",
          gap: formatMillimeters(workshopLayout.listGapMm),
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
        })}
      </ul>
    ) : (
      <div
        style={{
          display: "grid",
          gap: formatMillimeters(workshopLayout.sectionContentGapMm),
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
          inlineEditing,
        })}
      </div>
    );

  return (
    <PreviewSectionRegion
      as="section"
      sectionType={fragment.sectionType}
      sectionId={fragment.sectionId}
      sectionTitle={fragment.title}
      activeTarget={activeTarget}
      surface="section"
      style={{
        display: "grid",
        gap: formatMillimeters(workshopLayout.sectionShellGapMm),
      }}
    >
      {renderSectionHeading(fragment.title, fragment.continued)}
      {content}
    </PreviewSectionRegion>
  );
}

export function ResumeOneColAtsPage({
  data,
  page,
  template,
  activeTarget = null,
  inlineEditing = null,
}: ResumeOneColAtsPageProps) {
  return (
    <div
      data-testid="resume-template-page"
      style={{
        boxSizing: "border-box",
        width: "100%",
        minHeight: "100%",
        fontFamily: "var(--body-font, var(--font-body-family))",
        padding:
          "var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left)",
        background: "var(--paper)",
        color: "var(--color-text)",
        display: "grid",
        gap: "var(--body-row-gap)",
        alignContent: "start",
        alignItems: "start",
      }}
    >
      {page.fragments.map((fragment) => (
        <React.Fragment key={`${page.index}:${fragment.fragmentId}`}>
          {renderSectionFragment({
            fragment,
            data,
            activeTarget,
            template,
            inlineEditing,
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ResumeOneColAtsPage;
