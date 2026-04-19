import type {
  ResumeAffiliationItem,
  ResumeCertificationItem,
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeHobbyItem,
  ResumeLanguage,
  ResumeProjectItem,
  ResumeSkillItem,
  ResumeTextListItem,
  ResumeTextSection,
} from "../../features/verbati/resume/resume.types";
import type { ResumePreviewSectionType } from "../../features/verbati/resumeLinking";
import type { ResumeTemplateDefinition } from "../layout/resumeTemplates";

type WorkshopEntryKind =
  | "profile"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "selected_projects"
  | "languages"
  | "certifications"
  | "achievements"
  | "affiliations"
  | "hobbies"
  | "additional_information";

export type WorkshopPlannerEntry =
  | {
      id: "profile";
      kind: "profile";
      estimatedHeight: number;
    }
  | {
      id: "summary";
      kind: "summary";
      estimatedHeight: number;
      text: string;
    }
  | {
      id: string;
      kind: "experience";
      estimatedHeight: number;
      item: ResumeExperienceItem;
    }
  | {
      id: string;
      kind: "education";
      estimatedHeight: number;
      item: ResumeEducationItem;
    }
  | {
      id: string;
      kind: "skills";
      estimatedHeight: number;
      item: ResumeSkillItem;
    }
  | {
      id: string;
      kind: "selected_projects";
      estimatedHeight: number;
      item: ResumeProjectItem;
    }
  | {
      id: string;
      kind: "languages";
      estimatedHeight: number;
      item: ResumeLanguage;
    }
  | {
      id: string;
      kind: "certifications";
      estimatedHeight: number;
      item: ResumeCertificationItem;
    }
  | {
      id: string;
      kind: "achievements";
      estimatedHeight: number;
      item: ResumeTextListItem;
    }
  | {
      id: string;
      kind: "affiliations";
      estimatedHeight: number;
      item: ResumeAffiliationItem;
    }
  | {
      id: string;
      kind: "hobbies";
      estimatedHeight: number;
      item: ResumeHobbyItem;
    }
  | {
      id: string;
      kind: "additional_information";
      estimatedHeight: number;
      item: ResumeTextSection;
    };

export type WorkshopPlannerSection = {
  key: string;
  kind: WorkshopEntryKind;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  title?: string;
  continued: boolean;
  entries: WorkshopPlannerEntry[];
};

export type WorkshopResumePagePlan = {
  index: number;
  estimatedHeight: number;
  entries: WorkshopPlannerEntry[];
  sections: WorkshopPlannerSection[];
};

export type WorkshopResumePlan = {
  pageCount: number;
  pages: WorkshopResumePagePlan[];
};

type PlannerSectionDefinition = {
  key: string;
  kind: WorkshopEntryKind;
  sectionType: ResumePreviewSectionType;
  sectionId?: string;
  title?: string;
  order: number;
  headerHeight: number;
  entries: WorkshopPlannerEntry[];
};

const BASE_SECTION_HEADER_HEIGHT = 8.5;

function estimateTextHeight(text: string, lineLength: number, lineHeight: number) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / lineLength) * lineHeight;
}

function estimateExperienceHeight(item: ResumeExperienceItem): number {
  return (
    12 +
    estimateTextHeight(`${item.role} ${item.company} ${item.location}`, 42, 2.1) +
    (item.description ? estimateTextHeight(item.description, 80, 2.6) : 0) +
    item.bullets.reduce(
      (sum, bullet) => sum + 3.2 + estimateTextHeight(bullet, 92, 1.8),
      0,
    )
  );
}

function estimateProjectHeight(item: ResumeProjectItem): number {
  return (
    10 +
    estimateTextHeight(`${item.name} ${item.meta}`, 54, 2.2) +
    estimateTextHeight(item.description, 96, 2.2)
  );
}

function estimateEducationHeight(item: ResumeEducationItem): number {
  return 7 + estimateTextHeight(`${item.degree} ${item.school} ${item.period}`, 56, 2);
}

function estimateCertificationHeight(item: ResumeCertificationItem): number {
  return (
    5.4 +
    estimateTextHeight(
      `${item.name} ${item.issuer ?? ""} ${item.meta ?? ""}`,
      64,
      1.8,
    )
  );
}

function estimateAffiliationHeight(item: ResumeAffiliationItem): number {
  return (
    5.6 +
    estimateTextHeight(
      `${item.organizationName} ${item.roleOrMembershipType ?? ""} ${item.dateRange ?? ""} ${item.notes ?? ""}`,
      68,
      1.9,
    )
  );
}

function buildPlannerSections(data: ResumeData): PlannerSectionDefinition[] {
  const sections: PlannerSectionDefinition[] = [];

  sections.push({
    key: "profile",
    kind: "profile",
    sectionType: "profile",
    sectionId: data.profileSectionId,
    order: -20,
    headerHeight: 0,
    entries: [
      {
        id: "profile",
        kind: "profile",
        estimatedHeight:
          26 +
          data.contact.length * 3.2 +
          data.metadata.length * 2.8 +
          (data.title.trim() ? 4 : 0),
      },
    ],
  });

  if (data.summary.trim()) {
    sections.push({
      key: "summary",
      kind: "summary",
      sectionType: "summary",
      sectionId: data.summarySectionId,
      title: "Summary",
      order: -10,
      headerHeight: 6,
      entries: [
        {
          id: "summary",
          kind: "summary",
          estimatedHeight: 8 + estimateTextHeight(data.summary, 118, 2.6),
          text: data.summary,
        },
      ],
    });
  }

  const itemSections: PlannerSectionDefinition[] = [
    {
      key: "experience",
      kind: "experience",
      sectionType: "experience",
      sectionId: data.sectionIdsByType?.experience?.[0] ?? data.experience[0]?.sectionId,
      title: "Experience",
      order: data.experience[0]?.sectionOrder ?? 20,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.experience.map((item) => ({
        id: item.id,
        kind: "experience",
        estimatedHeight: estimateExperienceHeight(item),
        item,
      })),
    },
    {
      key: "education",
      kind: "education",
      sectionType: "education",
      sectionId: data.sectionIdsByType?.education?.[0] ?? data.education[0]?.sectionId,
      title: "Education",
      order: data.education[0]?.sectionOrder ?? 30,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.education.map((item) => ({
        id: item.id,
        kind: "education",
        estimatedHeight: estimateEducationHeight(item),
        item,
      })),
    },
    {
      key: "skills",
      kind: "skills",
      sectionType: "skills",
      sectionId: data.sectionIdsByType?.skills?.[0] ?? data.skillItems[0]?.sectionId,
      title: "Skills",
      order: data.skillItems[0]?.sectionOrder ?? 40,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.skillItems.map((item) => ({
        id: item.id,
        kind: "skills",
        estimatedHeight: 4.1 + estimateTextHeight(item.name, 28, 1.2),
        item,
      })),
    },
    {
      key: "selected_projects",
      kind: "selected_projects",
      sectionType: "selected_projects",
      sectionId: data.sectionIdsByType?.projects?.[0] ?? data.projects[0]?.sectionId,
      title: "Selected projects",
      order: data.projects[0]?.sectionOrder ?? 50,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.projects.map((item) => ({
        id: item.id,
        kind: "selected_projects",
        estimatedHeight: estimateProjectHeight(item),
        item,
      })),
    },
    {
      key: "languages",
      kind: "languages",
      sectionType: "languages",
      sectionId: data.sectionIdsByType?.languages?.[0] ?? data.languages[0]?.sectionId,
      title: "Languages",
      order: data.languages[0]?.sectionOrder ?? 60,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.languages.map((item) => ({
        id: item.id,
        kind: "languages",
        estimatedHeight: 4.2 + estimateTextHeight(`${item.name} ${item.level}`, 28, 1.4),
        item,
      })),
    },
    {
      key: "certifications",
      kind: "certifications",
      sectionType: "certifications",
      sectionId:
        data.sectionIdsByType?.certifications?.[0] ?? data.certifications[0]?.sectionId,
      title: "Certifications",
      order: data.certifications[0]?.sectionOrder ?? 70,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.certifications.map((item) => ({
        id: item.id,
        kind: "certifications",
        estimatedHeight: estimateCertificationHeight(item),
        item,
      })),
    },
    {
      key: "achievements",
      kind: "achievements",
      sectionType: "achievements",
      sectionId:
        data.sectionIdsByType?.achievements?.[0] ?? data.achievementItems[0]?.sectionId,
      title: "Achievements",
      order: data.achievementItems[0]?.sectionOrder ?? 80,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.achievementItems.map((item) => ({
        id: item.id,
        kind: "achievements",
        estimatedHeight: 4.6 + estimateTextHeight(item.text, 96, 1.5),
        item,
      })),
    },
    {
      key: "affiliations",
      kind: "affiliations",
      sectionType: "affiliations",
      sectionId:
        data.sectionIdsByType?.affiliations?.[0] ?? data.affiliations[0]?.sectionId,
      title: "Affiliations",
      order: data.affiliations[0]?.sectionOrder ?? 90,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.affiliations.map((item) => ({
        id: item.id,
        kind: "affiliations",
        estimatedHeight: estimateAffiliationHeight(item),
        item,
      })),
    },
    {
      key: "hobbies",
      kind: "hobbies",
      sectionType: "hobbies",
      sectionId: data.sectionIdsByType?.hobbies?.[0] ?? data.hobbyItems[0]?.sectionId,
      title: "Hobbies",
      order: data.hobbyItems[0]?.sectionOrder ?? 100,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.hobbyItems.map((item) => ({
        id: item.id,
        kind: "hobbies",
        estimatedHeight: 4 + estimateTextHeight(item.name, 28, 1.2),
        item,
      })),
    },
    {
      key: "additional_information",
      kind: "additional_information",
      sectionType: "additional_information",
      sectionId: data.textSections[0]?.sectionId,
      title: data.textSections[0]?.sectionTitle ?? "Additional information",
      order: data.textSections[0]?.sectionOrder ?? 110,
      headerHeight: BASE_SECTION_HEADER_HEIGHT,
      entries: data.textSections.map((item) => ({
        id: item.id,
        kind:
          item.sectionType === "custom" ? "additional_information" : "additional_information",
        estimatedHeight: 8 + estimateTextHeight(item.text, 104, 2.2),
        item,
      })),
    },
  ];

  sections.push(
    ...itemSections
      .filter((section) => section.entries.length > 0)
      .sort((left, right) => left.order - right.order),
  );

  return sections;
}

export function planWorkshopResumePages(args: {
  data: ResumeData;
  template: ResumeTemplateDefinition;
}): WorkshopResumePlan {
  const pageHeightBudget = Math.max(args.template.preview.liveHeightMm - 8, 120);
  const pages: WorkshopResumePagePlan[] = [];
  const sections = buildPlannerSections(args.data);

  let currentPage: WorkshopResumePagePlan = {
    index: 0,
    estimatedHeight: 0,
    entries: [],
    sections: [],
  };

  const commitPage = () => {
    if (currentPage.entries.length === 0) {
      return;
    }

    pages.push(currentPage);
    currentPage = {
      index: pages.length,
      estimatedHeight: 0,
      entries: [],
      sections: [],
    };
  };

  sections.forEach((section) => {
    section.entries.forEach((entry, entryIndex) => {
      const isContinuation = entryIndex > 0;
      const needsHeader = section.title ? !currentPage.sections.some((item) => item.key === section.key) : false;
      const nextHeight =
        currentPage.estimatedHeight +
        (needsHeader ? section.headerHeight : 0) +
        entry.estimatedHeight;

      if (currentPage.entries.length > 0 && nextHeight > pageHeightBudget) {
        commitPage();
      }

      let pageSection = currentPage.sections.find((item) => item.key === section.key);
      if (!pageSection) {
        pageSection = {
          key: section.key,
          kind: section.kind,
          sectionType: section.sectionType,
          sectionId: section.sectionId,
          title: section.title,
          continued: isContinuation,
          entries: [],
        };
        currentPage.sections.push(pageSection);
        currentPage.estimatedHeight += section.title ? section.headerHeight : 0;
      }

      pageSection.entries.push(entry);
      currentPage.entries.push(entry);
      currentPage.estimatedHeight += entry.estimatedHeight;
    });
  });

  commitPage();

  return {
    pageCount: Math.max(1, pages.length),
    pages: pages.length > 0 ? pages : [currentPage],
  };
}
