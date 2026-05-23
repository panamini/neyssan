import type { CvSection } from "../../types/cvDocument";

export type ResumeCanonicalSectionType =
  | "profile"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "projects"
  | "achievements"
  | "certifications"
  | "affiliations"
  | "hobbies"
  | "additional_information"
  | "custom";

export type ResumePreviewAliasType =
  | "contact"
  | "notes"
  | "selected_projects";

export type ResumePreviewSectionType =
  | ResumeCanonicalSectionType
  | ResumePreviewAliasType;

export type ResumeLinkSource =
  | "preview-panel"
  | "preview-workspace"
  | "editor-focus"
  | "editor-hover"
  | "modal";

export type ResumeSurfaceMode = "modal" | "inline" | "alias";

export type ResumeSurfaceAuditRow = {
  previewFamily: ResumePreviewSectionType;
  currentRepoSurface: string;
  canonicalTargetSurface: string;
  sectionType: ResumeCanonicalSectionType;
  surfaceMode: ResumeSurfaceMode;
  itemLevel: boolean;
};

export type ResumeLinkIntent = {
  requestId: string;
  sectionType: ResumeCanonicalSectionType;
  previewSectionType?: ResumePreviewSectionType;
  itemId?: string;
  source: ResumeLinkSource;
  shouldOpenModal: boolean;
  sectionId?: string;
  sectionTitle?: string;
};

export type ResumeActiveTarget = {
  sectionType: ResumeCanonicalSectionType;
  previewSectionType?: ResumePreviewSectionType;
  itemId?: string;
  sectionId?: string;
  source: ResumeLinkSource;
};

export type SectionOpenRequest = {
  requestId: string;
  shouldOpenModal: boolean;
  itemId?: string;
  sectionType: ResumeCanonicalSectionType;
  previewSectionType?: ResumePreviewSectionType;
  sectionId: string;
  sectionTitle?: string;
};

export const RESUME_SURFACE_AUDIT_MATRIX: ResumeSurfaceAuditRow[] = [
  {
    previewFamily: "profile",
    currentRepoSurface: "ProfileModal",
    canonicalTargetSurface: "profile section modal",
    sectionType: "profile",
    surfaceMode: "modal",
    itemLevel: false,
  },
  {
    previewFamily: "contact",
    currentRepoSurface: "alias to profile",
    canonicalTargetSurface: "profile section modal",
    sectionType: "profile",
    surfaceMode: "alias",
    itemLevel: false,
  },
  {
    previewFamily: "notes",
    currentRepoSurface: "alias to profile metadata rows",
    canonicalTargetSurface: "profile section modal",
    sectionType: "profile",
    surfaceMode: "alias",
    itemLevel: false,
  },
  {
    previewFamily: "summary",
    currentRepoSurface: "SummaryModal",
    canonicalTargetSurface: "summary section modal",
    sectionType: "summary",
    surfaceMode: "modal",
    itemLevel: false,
  },
  {
    previewFamily: "experience",
    currentRepoSurface: "ExperienceModal",
    canonicalTargetSurface: "experience section modal",
    sectionType: "experience",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "education",
    currentRepoSurface: "EducationModal",
    canonicalTargetSurface: "education section modal",
    sectionType: "education",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "skills",
    currentRepoSurface: "SkillsModal",
    canonicalTargetSurface: "skills section modal",
    sectionType: "skills",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "languages",
    currentRepoSurface: "mixed inline SectionEditor flow with LanguagesModal support",
    canonicalTargetSurface: "languages section modal",
    sectionType: "languages",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "projects",
    currentRepoSurface: "ProjectsModal",
    canonicalTargetSurface: "projects section modal",
    sectionType: "projects",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "selected_projects",
    currentRepoSurface: "alias to projects",
    canonicalTargetSurface: "projects section modal",
    sectionType: "projects",
    surfaceMode: "alias",
    itemLevel: true,
  },
  {
    previewFamily: "achievements",
    currentRepoSurface: "mixed AchievementsBlock + AchievementsModal flow",
    canonicalTargetSurface: "achievements section modal owned by SectionEditor",
    sectionType: "achievements",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "certifications",
    currentRepoSurface: "CertificationModal",
    canonicalTargetSurface: "certifications section modal",
    sectionType: "certifications",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "affiliations",
    currentRepoSurface: "AffiliationModal via titled text section",
    canonicalTargetSurface: "affiliations section modal",
    sectionType: "affiliations",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "hobbies",
    currentRepoSurface: "HobbiesModal tag-list flow via titled text section",
    canonicalTargetSurface: "hobbies section tag-list modal",
    sectionType: "hobbies",
    surfaceMode: "modal",
    itemLevel: true,
  },
  {
    previewFamily: "additional_information",
    currentRepoSurface: "section-level rich text modal",
    canonicalTargetSurface: "additional information section modal",
    sectionType: "additional_information",
    surfaceMode: "modal",
    itemLevel: false,
  },
  {
    previewFamily: "custom",
    currentRepoSurface: "section-level rich text modal",
    canonicalTargetSurface: "custom text section modal",
    sectionType: "custom",
    surfaceMode: "modal",
    itemLevel: false,
  },
];

function normalizeText(value: string | undefined | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function buildResumeLinkRequestId(): string {
  return `resume-link-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolvePreviewSurfaceType(
  value: string | undefined | null,
): ResumePreviewSectionType | null {
  const normalizedValue = normalizeText(value);

  switch (normalizedValue) {
    case "profile":
    case "summary":
    case "experience":
    case "education":
    case "skills":
    case "languages":
    case "projects":
    case "achievements":
    case "certifications":
    case "affiliations":
    case "hobbies":
    case "additional_information":
    case "custom":
    case "contact":
    case "notes":
    case "selected_projects":
      return normalizedValue;
    case "selected_project":
      return "selected_projects";
    default:
      return null;
  }
}

export function normalizeTextSectionFamily(
  title: string | undefined | null,
): ResumeCanonicalSectionType {
  const normalizedTitle = normalizeText(title);

  if (normalizedTitle === "achievements") {
    return "achievements";
  }

  if (normalizedTitle === "languages") {
    return "languages";
  }

  if (normalizedTitle === "hobbies") {
    return "hobbies";
  }

  if (normalizedTitle === "affiliations") {
    return "affiliations";
  }

  if (normalizedTitle === "additional_information") {
    return "additional_information";
  }

  return "custom";
}

export function getCanonicalSectionType(
  section:
    | Pick<CvSection, "type" | "title">
    | { type?: string | null; title?: string | null }
    | null
    | undefined,
): ResumeCanonicalSectionType | null {
  if (!section) {
    return null;
  }

  const rawType = normalizeText(section.type ?? "");

  switch (rawType) {
    case "profile":
    case "summary":
    case "experience":
    case "education":
    case "skills":
    case "languages":
    case "projects":
    case "achievements":
    case "certifications":
      return rawType;
    case "text":
      return normalizeTextSectionFamily(section.title);
    default:
      return null;
  }
}

export function resolvePreviewSectionType(
  value: string | undefined | null,
): ResumeCanonicalSectionType | null {
  const normalizedValue = normalizeText(value);

  switch (normalizedValue) {
    case "profile":
    case "summary":
    case "experience":
    case "education":
    case "skills":
    case "languages":
    case "projects":
    case "achievements":
    case "certifications":
    case "affiliations":
    case "hobbies":
    case "additional_information":
    case "custom":
      return normalizedValue;
    case "contact":
    case "notes":
      return "profile";
    case "selected_projects":
    case "selected_project":
      return "projects";
    default:
      return null;
  }
}

export function isModalCanonicalSectionType(
  sectionType: ResumeCanonicalSectionType,
): boolean {
  return RESUME_SURFACE_AUDIT_MATRIX.some(
    (row) => row.sectionType === sectionType && row.surfaceMode === "modal",
  );
}

export function isItemLevelSectionType(
  sectionType: ResumeCanonicalSectionType,
): boolean {
  return RESUME_SURFACE_AUDIT_MATRIX.some(
    (row) => row.sectionType === sectionType && row.itemLevel,
  );
}

export function matchesResumeActiveTarget(args: {
  target: ResumeActiveTarget | null | undefined;
  sectionType: ResumeCanonicalSectionType;
  previewSectionType?: ResumePreviewSectionType | null;
  sectionId?: string | null;
  itemId?: string | null;
}): boolean {
  const { target, sectionType, previewSectionType, sectionId, itemId } = args;

  if (!target || target.sectionType !== sectionType) {
    return false;
  }

  const targetPreviewSectionType = resolvePreviewSurfaceType(
    target.previewSectionType ?? target.sectionType,
  );
  const currentPreviewSectionType = resolvePreviewSurfaceType(
    previewSectionType ?? sectionType,
  );

  if (
    targetPreviewSectionType &&
    currentPreviewSectionType &&
    targetPreviewSectionType !== currentPreviewSectionType
  ) {
    return false;
  }

  if (
    !target.previewSectionType &&
    currentPreviewSectionType &&
    currentPreviewSectionType !== sectionType
  ) {
    return false;
  }

  if (itemId) {
    return target.itemId === itemId;
  }

  if (sectionId) {
    return target.sectionId === sectionId && !target.itemId;
  }

  return !target.itemId;
}
