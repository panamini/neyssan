export const PROPOSAL_GENERATION_QUALITY_MODES = [
  "baseline",
  "criteria_audit_shadow",
  "criteria_audit_live",
  "semantic_planner_shadow",
  "semantic_planner_live",
] as const;

export type ProposalGenerationQualityMode =
  (typeof PROPOSAL_GENERATION_QUALITY_MODES)[number];

export const DEFAULT_PROPOSAL_GENERATION_QUALITY_MODE: ProposalGenerationQualityMode =
  "baseline";

export function resolveProposalGenerationQualityMode(
  rawValue: string | null | undefined = process.env.PROPOSAL_GENERATION_QUALITY_MODE,
): ProposalGenerationQualityMode {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : "";
  return PROPOSAL_GENERATION_QUALITY_MODES.includes(
    normalized as ProposalGenerationQualityMode,
  )
    ? (normalized as ProposalGenerationQualityMode)
    : DEFAULT_PROPOSAL_GENERATION_QUALITY_MODE;
}

export function isProposalGenerationQualityShadowMode(
  mode: ProposalGenerationQualityMode,
): boolean {
  return (
    mode === "criteria_audit_shadow" || mode === "semantic_planner_shadow"
  );
}

export function isProposalGenerationQualityLiveMode(
  mode: ProposalGenerationQualityMode,
): boolean {
  return mode === "criteria_audit_live" || mode === "semantic_planner_live";
}
