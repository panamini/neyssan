import React from "react";

import type { ResumeData } from "./resume.types";
import type { ResumeTemplateDefinition } from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopResumeCommittedFragment,
  WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import {
  renderSectionFragment,
  type ResumePaperAiState,
  type ResumeSectionActions,
} from "./ResumeOneColAtsPage";
import type { ResumeActiveTarget } from "../resumeLinking";
import type { ResumeInlineEditing } from "./InlineEditableText";
import type { DocumentIconSettings } from "../../../lib/document-icons";
import type {
  DocumentIconOverrides,
  DocumentListItemIconOverrideTarget,
} from "../../../lib/document-icon-overrides";
import "./resume-maggie-letter.css";

type ResumeMaggieLetterPageProps = {
  data: ResumeData;
  page: WorkshopResumeCommittedPage;
  template: ResumeTemplateDefinition;
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  documentIconSettings?: DocumentIconSettings | null;
  documentIconOverrides?: DocumentIconOverrides | null;
  onDocumentListItemIconChange?: (
    target: DocumentListItemIconOverrideTarget,
    iconKey: string | null,
  ) => void;
};

function getMaggieFragmentLane(
  fragment: WorkshopResumeCommittedFragment,
): "header" | "main" | "sidebar" {
  if (fragment.kind === "profile" || fragment.kind === "summary") {
    return "header";
  }

  if (
    fragment.kind === "education" ||
    fragment.kind === "skills" ||
    fragment.kind === "languages" ||
    fragment.kind === "certifications" ||
    fragment.kind === "achievements" ||
    fragment.kind === "hobbies"
  ) {
    return "sidebar";
  }

  return "main";
}

function partitionFragments(fragments: WorkshopResumeCommittedFragment[]) {
  return fragments.reduce<{
    profile: Extract<
      WorkshopResumeCommittedFragment,
      { kind: "profile" }
    > | null;
    header: WorkshopResumeCommittedFragment[];
    main: WorkshopResumeCommittedFragment[];
    sidebar: WorkshopResumeCommittedFragment[];
  }>(
    (result, fragment) => {
      if (fragment.kind === "profile") {
        result.profile = fragment;
        return result;
      }

      const lane = getMaggieFragmentLane(fragment);
      if (lane === "header") {
        result.header.push(fragment);
        return result;
      }
      if (lane === "sidebar") {
        result.sidebar.push(fragment);
        return result;
      }
      result.main.push(fragment);
      return result;
    },
    { profile: null, header: [], main: [], sidebar: [] },
  );
}

export function ResumeMaggieLetterPage({
  data,
  page,
  template,
  activeTarget = null,
  inlineEditing = null,
  sectionActions = null,
  paperAi = null,
  documentIconSettings = null,
  documentIconOverrides = null,
  onDocumentListItemIconChange,
}: ResumeMaggieLetterPageProps) {
  const { profile, header, main, sidebar } = partitionFragments(page.fragments);
  const [activeListIconTarget, setActiveListIconTarget] =
    React.useState<DocumentListItemIconOverrideTarget | null>(null);
  const markerControls = React.useMemo(
    () => ({
      overrides: documentIconOverrides,
      activeTarget: activeListIconTarget,
      onOpenTarget: setActiveListIconTarget,
      onClose: () => setActiveListIconTarget(null),
      onChange: onDocumentListItemIconChange,
    }),
    [activeListIconTarget, documentIconOverrides, onDocumentListItemIconChange],
  );
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
        markerControls,
      })}
    </React.Fragment>
  );
  const contactItems = profile?.contact.length ? profile.contact : data.contact;

  return (
    <div
      data-testid="resume-template-page"
      data-resume-template-layout="maggie-letter"
      className="maggie-resume-page"
    >
      <header className="maggie-resume-header">
        <div className="maggie-resume-identity">
          <h1>{profile?.profile.name || data.name}</h1>
          {profile?.profile.title || data.title ? (
            <p>{profile?.profile.title || data.title}</p>
          ) : null}
        </div>
        <address className="maggie-resume-contact">
          {contactItems.map((item) => (
            <span key={`${item.label}:${item.value}`}>{item.value}</span>
          ))}
        </address>
      </header>
      {header.length > 0 ? (
        <div className="maggie-resume-header-extra">
          {header.map(renderFragment)}
        </div>
      ) : null}
      <div className="maggie-resume-body">
        <aside className="maggie-resume-sidebar">{sidebar.map(renderFragment)}</aside>
        <main className="maggie-resume-main">{main.map(renderFragment)}</main>
      </div>
    </div>
  );
}

export default ResumeMaggieLetterPage;
