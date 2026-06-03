import type { ResumeCanonicalSectionType } from "../resumeLinking";

export type ResumeMetaItem = {
  label: string;
  value: string;
  itemId?: string;
  sectionId?: string;
  sectionType?: ResumeCanonicalSectionType;
  draftFieldKey?: string;
};

export type ResumeLinkedItemBase = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
};

export type WorkshopResponsibilityTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type WorkshopResponsibilityParagraphBlock = {
  kind: "paragraph";
  runs: WorkshopResponsibilityTextRun[];
};

export type WorkshopResponsibilityBulletListItem = {
  runs: WorkshopResponsibilityTextRun[];
};

export type WorkshopResponsibilityBulletListBlock = {
  kind: "bullet_list";
  items: WorkshopResponsibilityBulletListItem[];
};

export type WorkshopResponsibilityRichBlock =
  | WorkshopResponsibilityParagraphBlock
  | WorkshopResponsibilityBulletListBlock;

export type WorkshopResponsibilitiesRichContent = {
  blocks: WorkshopResponsibilityRichBlock[];
};

export type ResumeSkillItem = ResumeLinkedItemBase & {
  name: string;
  level?: string;
};

export type ResumeLanguage = {
  id: string;
  name: string;
  level: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
};

export type ResumeExperienceItem = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
  role: string;
  company: string;
  period: string;
  location: string;
  description?: string;
  bullets: string[];
  responsibilitiesRich?: WorkshopResponsibilitiesRichContent;
};

export type ResumeProjectItem = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
  name: string;
  meta: string;
  description: string;
  descriptionRich?: WorkshopResponsibilitiesRichContent;
};

export type ResumeEducationItem = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
  degree: string;
  fieldOfStudy?: string;
  grade?: string;
  school: string;
  period: string;
};

export type ResumeTextListItem = ResumeLinkedItemBase & {
  text: string;
};

export type ResumeHobbyItem = ResumeLinkedItemBase & {
  name: string;
};

export type ResumeCertificationItem = ResumeLinkedItemBase & {
  name: string;
  issuer?: string;
  meta?: string;
};

export type ResumeAffiliationItem = ResumeLinkedItemBase & {
  organizationName: string;
  roleOrMembershipType?: string;
  dateRange?: string;
  notes?: string;
};

export type ResumeTextSection = {
  id: string;
  sectionId: string;
  sectionType: Extract<
    ResumeCanonicalSectionType,
    "additional_information" | "custom"
  >;
  sectionTitle: string;
  sectionOrder: number;
  text: string;
};

export type ResumeData = {
  name: string;
  title: string;
  summary: string;
  summaryRich?: WorkshopResponsibilitiesRichContent;
  photoUrl?: string;
  metadata: ResumeMetaItem[];
  contact: ResumeMetaItem[];
  skills: string[];
  skillItems: ResumeSkillItem[];
  languages: ResumeLanguage[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  education: ResumeEducationItem[];
  achievements?: string[];
  achievementItems: ResumeTextListItem[];
  hobbies: string[];
  hobbyItems: ResumeHobbyItem[];
  certifications: ResumeCertificationItem[];
  affiliations: ResumeAffiliationItem[];
  textSections: ResumeTextSection[];
  profileSectionId?: string;
  summarySectionId?: string;
  sectionIdsByType?: Partial<Record<ResumeCanonicalSectionType, string[]>>;
  draftSectionIds?: string[];
};

export type ResumeLayoutVariantId =
  | "tschichold"
  | "golden"
  | "robial"
  | "swissminima"
  | "volkregister"
  | "editorialmag"
  | "editorialsidebar"
  | "signalgrid"
  | "quire";
