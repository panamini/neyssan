export type JobDemandKindV1 =
  | "skill"
  | "experience"
  | "education"
  | "language"
  | "certification"
  | "domain"
  | "responsibility"
  | "seniority"
  | "location"
  | "availability"
  | "other";

export type JobDemandRequiredStateV1 = "required" | "preferred" | "unknown";

export type JobDemandSourceV1 = "job" | "application_context";

export type JobDemandV1 = Readonly<{
  id: string;
  kind: JobDemandKindV1;
  label: string;
  required: JobDemandRequiredStateV1;
  source: JobDemandSourceV1;
  sourcePath?: string;
  weight?: number;
  version: 1;
}>;
