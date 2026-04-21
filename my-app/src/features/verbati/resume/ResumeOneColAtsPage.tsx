import React from "react";

import type { ResumeActiveTarget } from "../resumeLinking";
import type { ResumeData } from "./resume.types";
import {
  resolveWorkshopPreviewLayoutContract,
  type ResumeTemplateDefinition,
} from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopExperienceContentBlock,
  WorkshopResumeCommittedFragment,
  WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import {
  PreviewItemRegion,
  PreviewSectionRegion,
  buildProjectPreviewFieldId,
} from "./resumePreviewRegions";

type ResumeOneColAtsPageProps = {
  data: ResumeData;
  page: WorkshopResumeCommittedPage;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
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
            "color-mix(in srgb, var(--color-border-strong) 58%, transparent)",
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

function renderProfileFragment(args: {
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
}) {
  const { data, activeTarget } = args;

  return (
    <header
      key="profile"
      data-preview-section="profile"
      style={{
        display: "grid",
        gap: "var(--header-row-gap)",
        paddingBottom: "var(--header-bottom-padding)",
        borderBottom:
          "0.3mm solid color-mix(in srgb, var(--color-border-strong) 58%, transparent)",
      }}
    >
      <div style={{ display: "grid", gap: "1.5mm" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--heading-font, var(--font-heading-family))",
            fontSize: workshopDisplayFontSize,
            lineHeight: "var(--text-display-line)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {data.name}
        </h1>
        {data.title ? (
          <p
            style={{
              margin: 0,
              fontSize: buildAdjustedFontSize({
                baseVar: "--text-body-size",
                adjustVar: "--body-size-adjust",
                offsetMm: 0.1,
              }),
              lineHeight: "var(--text-body-line)",
              color: "var(--color-text-muted)",
            }}
          >
            {data.title}
          </p>
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
            <PreviewItemRegion
              as="p"
              key={`${item.label}-${item.value}`}
              sectionType="contact"
              sectionId={item.sectionId ?? data.profileSectionId}
              sectionTitle="Contact"
              itemId={item.itemId}
              activeTarget={activeTarget}
              surface="item"
              style={{
                margin: 0,
                fontSize: "var(--text-meta-size)",
                lineHeight: "var(--text-meta-line)",
                color: "var(--color-text-muted)",
              }}
            >
              {item.value}
            </PreviewItemRegion>
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
              key={`${item.label}-${item.value}`}
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
                {item.value}
              </dd>
            </PreviewItemRegion>
          ))}
        </PreviewSectionRegion>
      ) : null}
    </header>
  );
}

function renderFragmentContent(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
}) {
  const { fragment, data, activeTarget } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);

  switch (fragment.kind) {
    case "profile":
      return renderProfileFragment({ data, activeTarget });
    case "summary":
      return (
        <PreviewItemRegion
          as="p"
          key={fragment.fragmentId}
          sectionType="summary"
          sectionId={fragment.sectionId ?? data.summarySectionId}
          sectionTitle={fragment.title ?? "Summary"}
          itemId="summary"
          activeTarget={activeTarget}
          surface="item"
          style={{
            margin: 0,
            maxWidth: "var(--header-summary-width)",
            fontSize: workshopBodyFontSize,
            lineHeight: "var(--text-body-line)",
            color: "var(--color-text)",
          }}
        >
          {fragment.text}
        </PreviewItemRegion>
      );
    case "experience":
      return fragment.items.map((item) => (
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
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--heading-font, var(--font-heading-family))",
                  fontSize: buildAdjustedFontSize({
                    baseVar: "--text-body-size",
                    adjustVar: "--body-size-adjust",
                    offsetVar: "--workshop-experience-heading-size-adjust",
                  }),
                  lineHeight: "var(--workshop-experience-heading-line-height)",
                  fontWeight: 700,
                }}
              >
                {item.role}
              </h3>
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
              {[item.company, item.location, item.period].filter(Boolean).join(" · ")}
            </p>
          </div>
          {renderExperienceBlocks({
            blocks: item.blocks,
            listGapMm: workshopLayout.listGapMm,
          })}
        </PreviewItemRegion>
      ));
    case "education":
      return fragment.items.map((item) => (
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
            {item.degree}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-meta-size)",
              lineHeight: "var(--text-meta-line)",
              color: "var(--color-text-muted)",
            }}
          >
            {[item.school, item.period].filter(Boolean).join(" · ")}
          </p>
        </PreviewItemRegion>
      ));
    case "skills":
      return fragment.items.map((item) => (
        <PreviewItemRegion
          as="span"
          key={item.id}
          sectionType="skills"
          sectionId={fragment.sectionId}
          sectionTitle={fragment.title ?? "Skills"}
          itemId={item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--skill-pad-block) var(--skill-pad-inline)",
            borderRadius: "999px",
            background: "var(--color-accent-soft)",
            fontSize: workshopBodySmFontSize,
            lineHeight: "var(--text-body-sm-line)",
          }}
        >
          {item.name}
        </PreviewItemRegion>
      ));
    case "selected_projects":
      return fragment.items.map((item) => (
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
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--heading-font, var(--font-heading-family))",
                fontSize: workshopBodyFontSize,
                fontWeight: 700,
              }}
            >
              {item.name}
            </h3>
            {item.meta ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-meta-size)",
                  lineHeight: "var(--text-meta-line)",
                  color: "var(--color-text-muted)",
                }}
              >
                {item.meta}
              </p>
            ) : null}
          </PreviewItemRegion>
          <PreviewItemRegion
            as="p"
            sectionType="selected_projects"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Selected projects"}
            itemId={buildProjectPreviewFieldId(item.id, "description")}
            activeTarget={activeTarget}
            surface="item"
            style={{
              margin: 0,
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {item.description}
          </PreviewItemRegion>
        </article>
      ));
    case "languages":
      return fragment.items.map((item) => (
        <li key={item.id}>
          <PreviewItemRegion
            as="span"
            sectionType="languages"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Languages"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {[item.name, item.level].filter(Boolean).join(" · ")}
          </PreviewItemRegion>
        </li>
      ));
    case "certifications":
      return fragment.items.map((item) => (
        <li key={item.id}>
          <PreviewItemRegion
            as="span"
            sectionType="certifications"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Certifications"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {[item.name, item.issuer, item.meta].filter(Boolean).join(" · ")}
          </PreviewItemRegion>
        </li>
      ));
    case "achievements":
      return fragment.items.map((item) => (
        <li key={item.id}>
          <PreviewItemRegion
            as="span"
            sectionType="achievements"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Achievements"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {item.text}
          </PreviewItemRegion>
        </li>
      ));
    case "affiliations":
      return fragment.items.map((item) => (
        <li key={item.id}>
          <PreviewItemRegion
            as="span"
            sectionType="affiliations"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Affiliations"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {[
              item.organizationName,
              item.roleOrMembershipType,
              item.dateRange,
              item.notes,
            ]
              .filter(Boolean)
              .join(" · ")}
          </PreviewItemRegion>
        </li>
      ));
    case "hobbies":
      return fragment.items.map((item) => (
        <li key={item.id}>
          <PreviewItemRegion
            as="span"
            sectionType="hobbies"
            sectionId={fragment.sectionId}
            sectionTitle={fragment.title ?? "Hobbies"}
            itemId={item.id}
            activeTarget={activeTarget}
            surface="item"
            style={{
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {item.name}
          </PreviewItemRegion>
        </li>
      ));
    case "additional_information":
      return fragment.items.map((item) => (
        <PreviewItemRegion
          as="article"
          key={item.id}
          sectionType="additional_information"
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
          <p
            style={{
              margin: 0,
              fontSize: workshopBodyFontSize,
              lineHeight: "var(--text-body-line)",
            }}
          >
            {item.text}
          </p>
        </PreviewItemRegion>
      ));
  }
}

function renderSectionFragment(args: {
  fragment: WorkshopResumeCommittedFragment;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
  template: ResumeTemplateDefinition;
}) {
  const { fragment, data, activeTarget } = args;
  const workshopLayout = resolveWorkshopPreviewLayoutContract(args.template);
  if (!fragment.title) {
    return renderFragmentContent({
      fragment,
      data,
      activeTarget,
      template: args.template,
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
          display: "grid",
          gap: formatMillimeters(workshopLayout.listGapMm),
        }}
      >
        {renderFragmentContent({
          fragment,
          data,
          activeTarget,
          template: args.template,
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
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ResumeOneColAtsPage;
