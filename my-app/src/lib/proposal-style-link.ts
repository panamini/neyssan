export const PROPOSAL_STYLE_LINK_MODES = [
  "inherit_cv",
  "proposal_local",
] as const;

export type ProposalStyleLinkMode =
  (typeof PROPOSAL_STYLE_LINK_MODES)[number];

export function resolveProposalStyleLinkMode(
  value: string | null | undefined,
): ProposalStyleLinkMode {
  return value === "proposal_local" ? "proposal_local" : "inherit_cv";
}
