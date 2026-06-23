/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";

import type { ResumeData } from "./resume.types";
import type { ResumeTemplateDefinition } from "../../../lib/layout/resumeTemplates";
import type {
  WorkshopResumeCommittedFragment,
  WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import {
  renderSectionHeading,
  renderSectionFragment,
  type ResumePaperAiState,
  type ResumeSectionActions,
} from "./ResumeOneColAtsPage";
import { buildPreviewRegionAttrs } from "./resumePreviewRegions";
import type { ResumeActiveTarget } from "../resumeLinking";
import type { ResumeInlineEditing } from "./InlineEditableText";
import type { DocumentIconSettings } from "../../../lib/document-icons";
import type {
  DocumentIconOverrides,
  DocumentListItemIconOverrideTarget,
} from "../../../lib/document-icon-overrides";
import { groupResumeSkillsByCategory } from "./skillCategories";
import type { ResumeSkillCategory, ResumeSkillItem } from "./resume.types";

type ResumeSanatAsymmetricPageProps = {
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
      if (fragment.lane === "header") {
        result.header.push(fragment);
        return result;
      }
      if (fragment.lane === "sidebar") {
        result.sidebar.push(fragment);
        return result;
      }
      result.main.push(fragment);
      return result;
    },
    { profile: null, header: [], main: [], sidebar: [] },
  );
}

function SanatSkillLineItems({ skills }: { skills: string[] }) {
  const visibleSkills = React.useMemo(
    () => skills.map((skill) => skill.trim()).filter(Boolean),
    [skills],
  );
  const itemRefs = React.useRef(new Map<string, HTMLSpanElement>());
  const [sameLineSeparatorIndexes, setSameLineSeparatorIndexes] =
    React.useState<Set<number>>(
      () => new Set(visibleSkills.slice(1).map((_, index) => index + 1)),
    );

  const measureRows = React.useCallback(() => {
    const next = new Set<number>();
    visibleSkills.forEach((skill, index) => {
      if (index === 0) return;

      const currentNode = itemRefs.current.get(`${index}:${skill}`);
      const previousSkill = visibleSkills[index - 1]!;
      const previousNode = itemRefs.current.get(
        `${index - 1}:${previousSkill}`,
      );
      if (!currentNode || !previousNode) return;

      const currentTop = currentNode.getBoundingClientRect().top;
      const previousTop = previousNode.getBoundingClientRect().top;
      if (Math.abs(currentTop - previousTop) < 1) {
        next.add(index);
      }
    });

    setSameLineSeparatorIndexes((previous) => {
      const previousKey = Array.from(previous).sort().join("|");
      const nextKey = Array.from(next).sort().join("|");
      return previousKey === nextKey ? previous : next;
    });
  }, [visibleSkills]);

  React.useLayoutEffect(() => {
    measureRows();
  }, [measureRows]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const firstNode = visibleSkills[0]
      ? itemRefs.current.get(`0:${visibleSkills[0]}`)
      : null;
    const parentNode = firstNode?.parentElement ?? null;
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !parentNode
        ? null
        : new ResizeObserver(() => measureRows());

    if (resizeObserver && parentNode) {
      resizeObserver.observe(parentNode);
    }
    window.addEventListener("resize", measureRows);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureRows);
    };
  }, [measureRows, visibleSkills]);

  return (
    <>
      {visibleSkills.map((skill, index) => {
        const key = `${index}:${skill}`;
        return (
          <span
            key={key}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(key, node);
              } else {
                itemRefs.current.delete(key);
              }
            }}
            data-sanat-skill-item-wrap="true"
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: "0.45em",
            }}
          >
            {index > 0 && sameLineSeparatorIndexes.has(index) ? (
              <span
                aria-hidden="true"
                data-sanat-skill-separator="true"
                style={{ color: "var(--color-text-subtle)" }}
              >
                •
              </span>
            ) : null}
            <span>{skill}</span>
          </span>
        );
      })}
    </>
  );
}

function renderSkillFragment(
  fragment: Extract<WorkshopResumeCommittedFragment, { kind: "skills" }>,
  activeTarget?: ResumeActiveTarget | null,
  documentIconSettings?: DocumentIconSettings | null,
) {
  const categoryMap = new Map<string, ResumeSkillCategory>();
  const skillItems: ResumeSkillItem[] = fragment.items.map((item, index) => {
    if (item.categoryId && item.categoryLabel) {
      categoryMap.set(item.categoryId, {
        id: item.categoryId,
        label: item.categoryLabel,
        order: item.categoryOrder ?? index,
      });
    }
    return {
      id: item.id,
      name: item.name,
      sectionId: fragment.sectionId ?? "skills",
      sectionType: "skills",
      ...(item.level ? { level: item.level } : {}),
      ...(item.bucket ? { bucket: item.bucket } : {}),
      ...(item.categoryId ? { categoryId: item.categoryId } : {}),
      ...(item.categoryLabel ? { categoryLabel: item.categoryLabel } : {}),
      ...(typeof item.categoryOrder === "number"
        ? { categoryOrder: item.categoryOrder }
        : {}),
    };
  });
  const groups = groupResumeSkillsByCategory(
    skillItems,
    Array.from(categoryMap.values()),
  );
  const hasExplicitGroups = groups.some((group) => !group.uncategorized);

  return (
    <section
      key={fragment.fragmentId}
      className="sanat-section sanat-section--skills"
      {...buildPreviewRegionAttrs({
        sectionType: "skills",
        sectionId: fragment.sectionId,
        sectionTitle: fragment.title,
        activeTarget,
        surface: "section",
      })}
    >
      {renderSectionHeading({
        title: fragment.title ?? "Skills",
        continued: fragment.continued,
        sectionId: fragment.sectionId,
        sectionType: "skills",
        documentIconSettings,
      })}
      {hasExplicitGroups ? (
        <div className="sanat-skill-groups">
          {groups.map((group) => (
            <p className="sanat-skill-group" key={group.id}>
              {group.uncategorized ? null : <strong>{group.label}:</strong>}{" "}
              <SanatSkillLineItems
                skills={group.items.map((item) => item.name)}
              />
            </p>
          ))}
        </div>
      ) : (
        <p className="sanat-skill-prose">
          <SanatSkillLineItems
            skills={fragment.items.map((item) => item.name)}
          />
        </p>
      )}
    </section>
  );
}

export function ResumeSanatAsymmetricPage({
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
}: ResumeSanatAsymmetricPageProps) {
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
  const renderFragment = (fragment: WorkshopResumeCommittedFragment) => {
    if (fragment.kind === "skills") {
      return renderSkillFragment(fragment, activeTarget, documentIconSettings);
    }

    return (
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
  };

  return (
    <div
      data-testid="resume-template-page"
      data-resume-template-layout="sanat-asymmetric"
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
        gridTemplateRows:
          header.length > 0
            ? "auto auto minmax(0, 1fr)"
            : "auto minmax(0, 1fr)",
        gap: "calc(var(--body-row-gap) * 1.45)",
        alignContent: "start",
        alignItems: "start",
      }}
    >
      <header className="sanat-header">
        <div className="sanat-identity">
          <h1>{profile?.profile.name || data.name}</h1>
          {profile?.profile.title || data.title ? (
            <p>{profile?.profile.title || data.title}</p>
          ) : null}
        </div>
        <address className="sanat-contact">
          {(profile?.contact.length ? profile.contact : data.contact).map(
            (item) => (
              <span key={`${item.label}:${item.value}`}>{item.value}</span>
            ),
          )}
        </address>
      </header>
      {header.length > 0 ? (
        <div className="sanat-header-extra">{header.map(renderFragment)}</div>
      ) : null}
      <div className="sanat-content">
        <main className="sanat-main">{main.map(renderFragment)}</main>
        <aside className="sanat-sidebar">{sidebar.map(renderFragment)}</aside>
      </div>
    </div>
  );
}

export default ResumeSanatAsymmetricPage;
