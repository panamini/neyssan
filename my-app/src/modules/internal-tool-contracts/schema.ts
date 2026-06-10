export type InternalToolEffectV1 = "read_only" | "pure_compute";

export type InternalToolRiskLevelV1 = "low" | "medium" | "blocked";

export type InternalToolInputKindV1 =
  | "application_context_ref"
  | "evidence_graph_ref"
  | "resume_variant_plan_ref"
  | "review_cockpit_ref"
  | "resume_variant_artifact_ref"
  | "cover_letter_artifact_ref"
  | "application_package_ref"
  | "application_package_content"
  | "tool_contract_ref";

export type InternalToolOutputKindV1 =
  | "application_context_summary"
  | "evidence_graph_summary"
  | "resume_variant_plan_summary"
  | "review_cockpit_summary"
  | "resume_variant_artifact_summary"
  | "cover_letter_artifact_summary"
  | "application_package_summary"
  | "application_package_validation"
  | "tool_contract_summary";

export type InternalToolIdV1 =
  | "application_context.describe"
  | "evidence_graph.summarize"
  | "resume_variant_plan.summarize"
  | "review_cockpit.summarize"
  | "resume_variant_artifact.summarize"
  | "cover_letter_artifact.summarize"
  | "application_package.summarize"
  | "application_package.validate"
  | "internal_tool_contracts.list"
  | "internal_tool_contracts.describe";

export type InternalToolContractStatusV1 = "active" | "draft" | "blocked";

export type InternalToolParameterV1 = Readonly<{
  name: string;
  kind: InternalToolInputKindV1;
  required: boolean;
  description: string;
  version: 1;
}>;

export type InternalToolResultShapeV1 = Readonly<{
  kind: InternalToolOutputKindV1;
  description: string;
  version: 1;
}>;

export type InternalToolContractV1 = Readonly<{
  id: InternalToolIdV1;
  title: string;
  description: string;
  effect: InternalToolEffectV1;
  riskLevel: InternalToolRiskLevelV1;
  status: InternalToolContractStatusV1;
  input: readonly InternalToolParameterV1[];
  output: InternalToolResultShapeV1;
  requiresApproval: boolean;
  forbiddenUntil?: string;
  version: 1;
}>;

export type InternalToolContractRegistryV1 = Readonly<{
  contracts: readonly InternalToolContractV1[];
  contractIds: readonly InternalToolIdV1[];
  version: 1;
}>;

export type InternalToolContractContentV1 = Readonly<{
  kind: "internal_tool_contracts";
  registry: InternalToolContractRegistryV1;
  version: 1;
}>;
