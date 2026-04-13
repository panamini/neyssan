export type ResumeMetaItem = {
  label: string;
  value: string;
};

export type ResumeLanguage = {
  name: string;
  level: string;
};

export type ResumeExperienceItem = {
  role: string;
  company: string;
  period: string;
  location: string;
  description?: string;
  bullets: string[];
};

export type ResumeProjectItem = {
  name: string;
  meta: string;
  description: string;
};

export type ResumeEducationItem = {
  degree: string;
  school: string;
  period: string;
};

export type ResumeData = {
  name: string;
  title: string;
  summary: string;
  photoUrl?: string;
  metadata: ResumeMetaItem[];
  contact: ResumeMetaItem[];
  skills: string[];
  languages: ResumeLanguage[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  education: ResumeEducationItem[];
  achievements?: string[];
  hobbies: string[];
};

export type ResumeLayoutVariantId =
  | "tschichold"
  | "golden"
  | "robial"
  | "onecol"
  | "swissminima"
  | "volkregister"
  | "editorialmag"
  | "signalgrid"
  | "studiopop"
  | "softribbon"
  | "slateprofile"
  | "quire";
