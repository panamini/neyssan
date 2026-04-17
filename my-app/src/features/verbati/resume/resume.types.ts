import type { ResumeCanonicalSectionType } from "../resumeLinking";

export type ResumeMetaItem = {
  label: string;
  value: string;
  itemId?: string;
  sectionId?: string;
  sectionType?: ResumeCanonicalSectionType;
};

export type ResumeLinkedItemBase = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
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
};

export type ResumeEducationItem = {
  id: string;
  sectionId: string;
  sectionType: ResumeCanonicalSectionType;
  sectionTitle?: string;
  sectionOrder?: number;
  degree: string;
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
};

export type ResumeLayoutVariantId =
  | "tschichold"
  | "golden"
  | "robial"
  | "swissminima"
  | "volkregister"
  | "editorialmag"
  | "signalgrid"
  | "quire";
