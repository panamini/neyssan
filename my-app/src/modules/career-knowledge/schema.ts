export type CareerKnowledgeRuleIdV1 = string;

export type CareerKnowledgeMarketV1 =
  | "global"
  | "us"
  | "uk"
  | "eu"
  | "france"
  | "canada"
  | "australia"
  | "other";

export type CareerKnowledgeDocumentKindV1 =
  | "resume"
  | "cv"
  | "cover_letter"
  | "application_packet";

export type CareerKnowledgeRuleCategoryV1 =
  | "ats"
  | "structure"
  | "claim_safety"
  | "source_truth"
  | "localization"
  | "tone"
  | "formatting"
  | "review_gate";

export type CareerKnowledgeSeverityV1 = "info" | "warning" | "blocker";

export type CareerKnowledgeRuleAppliesToV1 = Readonly<{
  documentKinds: readonly CareerKnowledgeDocumentKindV1[];
  sourceTypes?: readonly string[];
  candidateFactTypes?: readonly string[];
  artifactTypes?: readonly string[];
  languages?: readonly string[];
  targetRoles?: readonly string[];
  seniorities?: readonly string[];
}>;

export type CareerKnowledgeRuleV1 = Readonly<{
  id: CareerKnowledgeRuleIdV1;
  category: CareerKnowledgeRuleCategoryV1;
  documentKind: CareerKnowledgeDocumentKindV1;
  market: CareerKnowledgeMarketV1;
  severity: CareerKnowledgeSeverityV1;
  title: string;
  description: string;
  appliesTo: CareerKnowledgeRuleAppliesToV1;
  rationale: string;
  version: 1;
}>;

export type CareerKnowledgeResolveInputV1 = Readonly<{
  documentKind: CareerKnowledgeDocumentKindV1;
  market?: CareerKnowledgeMarketV1 | string;
  language?: string;
  targetRole?: string;
  seniority?: string;
  sourceTypes?: readonly string[];
  candidateFactTypes?: readonly string[];
  artifactType?: string;
}>;

export type CareerKnowledgeResolveResultV1 = Readonly<{
  rules: readonly CareerKnowledgeRuleV1[];
  blockedRuleIds: readonly CareerKnowledgeRuleIdV1[];
  warningRuleIds: readonly CareerKnowledgeRuleIdV1[];
  market: CareerKnowledgeMarketV1;
  version: 1;
}>;
