import type { StyleFamilyId } from "../../features/verbati/types";

export const RESUME_TEMPLATE_IDS = [
  "swiss_resume_legacy",
  "two_column_resume_legacy",
  "workshop_resume_onecol_ats",
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];

export type ResumeTemplateDefinition = {
  id: ResumeTemplateId;
  familyId: StyleFamilyId;
  label: string;
  shell: "legacy-preview" | "future-workshop";
};

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId =
  "swiss_resume_legacy";

export const RESUME_TEMPLATE_DEFINITIONS: readonly ResumeTemplateDefinition[] = [
  {
    id: "swiss_resume_legacy",
    familyId: "swiss",
    label: "Swiss legacy preview",
    shell: "legacy-preview",
  },
  {
    id: "two_column_resume_legacy",
    familyId: "two-column",
    label: "Two-column legacy preview",
    shell: "legacy-preview",
  },
  {
    id: "workshop_resume_onecol_ats",
    familyId: "workshop",
    label: "Workshop one-column ATS",
    shell: "future-workshop",
  },
] as const;

export function getResumeTemplateDefinition(
  templateId: ResumeTemplateId | null | undefined,
): ResumeTemplateDefinition {
  return (
    RESUME_TEMPLATE_DEFINITIONS.find(
      (definition) => definition.id === templateId,
    ) ?? RESUME_TEMPLATE_DEFINITIONS[0]
  );
}
