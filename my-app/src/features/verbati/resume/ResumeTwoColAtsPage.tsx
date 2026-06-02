import React from "react";

import type { ResumeActiveTarget } from "../resumeLinking";
import type { ResumeData } from "./resume.types";
import type { ResumeTemplateDefinition } from "../../../lib/layout/resumeTemplates";
import {
  resolveWorkshopTwoColumnFragmentLane,
  type WorkshopResumeCommittedFragment,
  type WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import type { ResumeInlineEditing } from "./InlineEditableText";
import {
  renderSectionFragment,
  type ResumePaperAiState,
  type ResumeSectionActions,
} from "./ResumeOneColAtsPage";
import type { DocumentIconSettings } from "../../../lib/document-icons";

type ResumeTwoColAtsPageProps = {
  data: ResumeData;
  page: WorkshopResumeCommittedPage;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  documentIconSettings?: DocumentIconSettings | null;
};

function partitionTwoColumnFragments(
  fragments: WorkshopResumeCommittedFragment[],
): {
  header: WorkshopResumeCommittedFragment[];
  sidebar: WorkshopResumeCommittedFragment[];
  main: WorkshopResumeCommittedFragment[];
} {
  return fragments.reduce<{
    header: WorkshopResumeCommittedFragment[];
    sidebar: WorkshopResumeCommittedFragment[];
    main: WorkshopResumeCommittedFragment[];
  }>(
    (result, fragment) => {
      const lane = resolveWorkshopTwoColumnFragmentLane(fragment);
      if (lane === "header") {
        result.header.push(fragment);
      } else if (lane === "sidebar") {
        result.sidebar.push(fragment);
      } else {
        result.main.push(fragment);
      }
      return result;
    },
    { header: [], sidebar: [], main: [] },
  );
}

export function ResumeTwoColAtsPage({
  data,
  page,
  template,
  activeTarget = null,
  inlineEditing = null,
  sectionActions = null,
  paperAi = null,
  documentIconSettings = null,
}: ResumeTwoColAtsPageProps) {
  const { header, sidebar, main } = partitionTwoColumnFragments(page.fragments);
  const renderFragment = (fragment: WorkshopResumeCommittedFragment) => (
    <React.Fragment key={`${page.index}:${fragment.fragmentId}`}>
      {renderSectionFragment({
        fragment,
        data,
        activeTarget,
        template,
        inlineEditing,
        sectionActions,
        paperAi,
        documentIconSettings,
      })}
    </React.Fragment>
  );

  return (
    <div
      data-testid="resume-template-page"
      data-resume-template-layout="workshop-two-column"
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
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: "var(--body-row-gap)",
        alignContent: "start",
        alignItems: "start",
      }}
    >
      {header.length > 0 ? (
        <div style={{ display: "grid", gap: "var(--header-row-gap)", minWidth: 0 }}>
          {header.map(renderFragment)}
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--sidebar-width) var(--main-width)",
          columnGap: "var(--gutter-width)",
          alignItems: "start",
          minWidth: 0,
        }}
      >
        <aside
          data-resume-template-column="sidebar"
          style={{
            display: "grid",
            gap: "var(--body-row-gap)",
            alignContent: "start",
            minWidth: 0,
          }}
        >
          {sidebar.map(renderFragment)}
        </aside>
        <main
          data-resume-template-column="main"
          style={{
            display: "grid",
            gap: "var(--body-row-gap)",
            alignContent: "start",
            minWidth: 0,
          }}
        >
          {main.map(renderFragment)}
        </main>
      </div>
    </div>
  );
}

export default ResumeTwoColAtsPage;
