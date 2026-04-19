import React from "react";

import type { ResumeActiveTarget } from "../resumeLinking";
import type { ResumeData } from "./resume.types";
import type { ResumeTemplateDefinition } from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopPlannerEntry,
  WorkshopResumePagePlan,
} from "../../../lib/resume/resumePagination";
import {
  PreviewItemRegion,
  PreviewSectionRegion,
  buildProjectPreviewFieldId,
} from "./resumePreviewRegions";

type ResumeOneColAtsPageProps = {
  data: ResumeData;
  page: WorkshopResumePagePlan;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
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
          fontSize: "calc(var(--text-title-size) - 0.95mm)",
          lineHeight: 1.1,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      {continued ? (
        <span
          style={{
            fontSize: "calc(var(--text-label-size) - 0.1mm)",
            lineHeight: 1.2,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-subtle)",
          }}
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

function renderEntry(args: {
  entry: WorkshopPlannerEntry;
  data: ResumeData;
  activeTarget?: ResumeActiveTarget | null;
}) {
  const { entry, data, activeTarget } = args;

  switch (entry.kind) {
    case "profile":
      return (
        <header
          key={entry.id}
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
                fontSize: "var(--text-display-size)",
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
                  fontSize: "calc(var(--text-body-size) + 0.1mm)",
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
                    fontSize: "var(--text-body-sm-size)",
                    lineHeight: "var(--text-body-sm-line)",
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
                      fontSize: "var(--text-label-size)",
                      lineHeight: "var(--text-label-line)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-text-subtle)",
                    }}
                  >
                    {item.label}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontSize: "var(--text-body-sm-size)",
                      lineHeight: "var(--text-body-sm-line)",
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
    case "summary":
      return (
        <PreviewItemRegion
          as="p"
          key={entry.id}
          sectionType="summary"
          sectionId={data.summarySectionId}
          sectionTitle="Summary"
          itemId={entry.id}
          activeTarget={activeTarget}
          surface="item"
          style={{
            margin: 0,
            fontSize: "var(--text-body-size)",
            lineHeight: "var(--text-body-line)",
            color: "var(--color-text)",
          }}
        >
          {entry.text}
        </PreviewItemRegion>
      );
    case "experience":
      return (
        <PreviewItemRegion
          as="article"
          key={entry.item.id}
          sectionType="experience"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Experience"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{
            display: "grid",
            gap: "1.8mm",
          }}
          data-preview-row-id={entry.item.id}
        >
          <div style={{ display: "grid", gap: "0.6mm" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "calc(var(--text-body-size) + 0.2mm)",
                lineHeight: 1.25,
                fontWeight: 700,
              }}
            >
              {entry.item.role}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-body-sm-size)",
                lineHeight: "var(--text-body-sm-line)",
                color: "var(--color-text-muted)",
              }}
            >
              {[entry.item.company, entry.item.location, entry.item.period]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {entry.item.description ? (
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-body-size)",
                lineHeight: "var(--text-body-line)",
              }}
            >
              {entry.item.description}
            </p>
          ) : null}
          <ul
            style={{
              margin: 0,
              paddingLeft: "4.5mm",
              display: "grid",
              gap: "1.2mm",
            }}
          >
            {entry.item.bullets.map((bullet) => (
              <li
                key={bullet}
                style={{
                  fontSize: "var(--text-body-size)",
                  lineHeight: "var(--text-body-line)",
                }}
              >
                {bullet}
              </li>
            ))}
          </ul>
        </PreviewItemRegion>
      );
    case "education":
      return (
        <PreviewItemRegion
          as="article"
          key={entry.item.id}
          sectionType="education"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Education"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ display: "grid", gap: "0.7mm" }}
          data-preview-row-id={entry.item.id}
        >
          <h3 style={{ margin: 0, fontSize: "var(--text-body-size)", fontWeight: 700 }}>
            {entry.item.degree}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-body-sm-size)",
              lineHeight: "var(--text-body-sm-line)",
              color: "var(--color-text-muted)",
            }}
          >
            {[entry.item.school, entry.item.period].filter(Boolean).join(" · ")}
          </p>
        </PreviewItemRegion>
      );
    case "skills":
      return (
        <PreviewItemRegion
          as="span"
          key={entry.item.id}
          sectionType="skills"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Skills"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "8mm",
            padding: "1.2mm 2.6mm",
            borderRadius: "999px",
            background: "var(--color-accent-soft)",
            fontSize: "var(--text-body-sm-size)",
            lineHeight: "var(--text-body-sm-line)",
          }}
        >
          {entry.item.name}
        </PreviewItemRegion>
      );
    case "selected_projects":
      return (
        <article
          key={entry.item.id}
          data-preview-row-id={entry.item.id}
          data-no-pan="true"
          style={{
            display: "grid",
            gap: "1mm",
            padding: "3mm 3.5mm",
            borderRadius: "3mm",
            background: "color-mix(in srgb, var(--color-surface-muted) 68%, white)",
          }}
        >
          <PreviewItemRegion
            as="h3"
            sectionType="selected_projects"
            sectionId={entry.item.sectionId}
            sectionTitle={entry.item.sectionTitle ?? "Selected projects"}
            itemId={buildProjectPreviewFieldId(entry.item.id, "name")}
            activeTarget={activeTarget}
            surface="item"
            style={{ margin: 0, fontSize: "var(--text-body-size)", fontWeight: 700 }}
          >
            {entry.item.name}
          </PreviewItemRegion>
          <PreviewItemRegion
            as="p"
            sectionType="selected_projects"
            sectionId={entry.item.sectionId}
            sectionTitle={entry.item.sectionTitle ?? "Selected projects"}
            itemId={buildProjectPreviewFieldId(entry.item.id, "meta")}
            activeTarget={activeTarget}
            surface="item"
            style={{
              margin: 0,
              fontSize: "var(--text-body-sm-size)",
              lineHeight: "var(--text-body-sm-line)",
              color: "var(--color-text-subtle)",
            }}
          >
            {entry.item.meta}
          </PreviewItemRegion>
          <PreviewItemRegion
            as="p"
            sectionType="selected_projects"
            sectionId={entry.item.sectionId}
            sectionTitle={entry.item.sectionTitle ?? "Selected projects"}
            itemId={buildProjectPreviewFieldId(entry.item.id, "description")}
            activeTarget={activeTarget}
            surface="item"
            style={{ margin: 0, fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
          >
            {entry.item.description}
          </PreviewItemRegion>
        </article>
      );
    case "languages":
      return (
        <PreviewItemRegion
          as="li"
          key={entry.item.id}
          sectionType="languages"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Languages"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
        >
          {entry.item.name} · {entry.item.level}
        </PreviewItemRegion>
      );
    case "certifications":
      return (
        <PreviewItemRegion
          as="li"
          key={entry.item.id}
          sectionType="certifications"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Certifications"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
        >
          {entry.item.name}
          {entry.item.meta ? ` · ${entry.item.meta}` : ""}
        </PreviewItemRegion>
      );
    case "achievements":
      return (
        <PreviewItemRegion
          as="li"
          key={entry.item.id}
          sectionType="achievements"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Achievements"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
        >
          {entry.item.text}
        </PreviewItemRegion>
      );
    case "affiliations":
      return (
        <PreviewItemRegion
          as="li"
          key={entry.item.id}
          sectionType="affiliations"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Affiliations"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
        >
          {[
            entry.item.organizationName,
            entry.item.roleOrMembershipType,
            entry.item.dateRange,
          ]
            .filter(Boolean)
            .join(" · ")}
        </PreviewItemRegion>
      );
    case "hobbies":
      return (
        <PreviewItemRegion
          as="li"
          key={entry.item.id}
          sectionType="hobbies"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle ?? "Hobbies"}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)" }}
        >
          {entry.item.name}
        </PreviewItemRegion>
      );
    case "additional_information":
      return (
        <PreviewItemRegion
          as="article"
          key={entry.item.id}
          sectionType="additional_information"
          sectionId={entry.item.sectionId}
          sectionTitle={entry.item.sectionTitle}
          itemId={entry.item.id}
          activeTarget={activeTarget}
          surface="item"
          style={{ display: "grid", gap: "1.4mm" }}
          data-preview-row-id={entry.item.id}
        >
          <h3 style={{ margin: 0, fontSize: "var(--text-body-size)", fontWeight: 700 }}>
            {entry.item.sectionTitle}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-body-size)",
              lineHeight: "var(--text-body-line)",
            }}
          >
            {entry.item.text}
          </p>
        </PreviewItemRegion>
      );
  }
}

export function ResumeOneColAtsPage({
  data,
  page,
  activeTarget = null,
}: ResumeOneColAtsPageProps) {
  return (
    <div
      data-testid="resume-template-page"
      style={{
        boxSizing: "border-box",
        width: "100%",
        minHeight: "100%",
        padding:
          "var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left)",
        background: "var(--paper)",
        color: "var(--color-text)",
        display: "grid",
        gap: "var(--body-row-gap)",
      }}
    >
      {page.sections.map((section) => (
        <React.Fragment key={`${page.index}:${section.key}`}>
          {section.title ? (
            <PreviewSectionRegion
              as="section"
              sectionType={section.sectionType}
              sectionId={section.sectionId}
              sectionTitle={section.title}
              activeTarget={activeTarget}
              surface="section"
              style={{ display: "grid", gap: "2.6mm" }}
            >
              {renderSectionHeading(section.title, section.continued)}
              {section.kind === "skills" ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.6mm",
                  }}
                >
                  {section.entries.map((entry) =>
                    renderEntry({ entry, data, activeTarget }),
                  )}
                </div>
              ) : section.kind === "languages" ||
                section.kind === "certifications" ||
                section.kind === "achievements" ||
                section.kind === "affiliations" ||
                section.kind === "hobbies" ? (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "4.5mm",
                    display: "grid",
                    gap: "1.2mm",
                  }}
                >
                  {section.entries.map((entry) =>
                    renderEntry({ entry, data, activeTarget }),
                  )}
                </ul>
              ) : (
                <div style={{ display: "grid", gap: "3mm" }}>
                  {section.entries.map((entry) =>
                    renderEntry({ entry, data, activeTarget }),
                  )}
                </div>
              )}
            </PreviewSectionRegion>
          ) : (
            section.entries.map((entry) => renderEntry({ entry, data, activeTarget }))
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ResumeOneColAtsPage;
