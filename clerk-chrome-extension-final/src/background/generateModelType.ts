export type ExtensionProposalType =
  | "technical"
  | "creative"
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

export type ExtensionModelType =
  | "chatgpt"
  | "mistral-small-latest"
  | "mistral-large-latest"
  | "mistral-agent";

export function resolveExtensionGenerateModelType(args: {
  requestedModelType?: ExtensionModelType;
  proposalType?: ExtensionProposalType;
  useCurrentCvContext?: boolean;
}): ExtensionModelType {
  if (args.requestedModelType) {
    return args.requestedModelType;
  }

  const proposalType = args.proposalType || "cover_letter";
  if (proposalType === "cover_letter" && !args.useCurrentCvContext) {
    return "chatgpt";
  }

  return "mistral-small-latest";
}
