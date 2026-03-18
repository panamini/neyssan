import type { FormValues } from "../components/ProposalInputForm.schemas";

const CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE =
  "proposal_generation_provider_busy";
const CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE =
  "proposal_generation_provider_transport_error";
const CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE_PREFIX =
  "Proposal generation provider busy.";
const CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE_PREFIX =
  "Proposal generation provider transport error.";
const CONTROLLED_PROPOSAL_FINALIZATION_FAILURE_PREFIX =
  "Proposal generation failed closed during finalization.";
const FRIENDLY_PROVIDER_BUSY_MESSAGE =
  "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.";
const FRIENDLY_PROVIDER_TRANSPORT_ERROR_MESSAGE =
  "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.";
const FALLBACK_TO_CHATGPT_BUSY_MESSAGE =
  "Generated with ChatGPT because Mistral was temporarily busy.";
const FALLBACK_TO_CHATGPT_TRANSPORT_MESSAGE =
  "Generated with ChatGPT because the Mistral request could not be completed.";

export type ProposalGenerationFallbackInfo = {
  requestedModelType?: string | null;
  actualModelType?: string | null;
  fallbackTriggerCode?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getProposalGenerationFallbackDisclosureMessage(
  args: ProposalGenerationFallbackInfo,
): string | null {
  if (
    args.actualModelType !== "chatgpt" ||
    !args.requestedModelType ||
    args.requestedModelType === args.actualModelType
  ) {
    return null;
  }

  if (args.fallbackTriggerCode === CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE) {
    return FALLBACK_TO_CHATGPT_BUSY_MESSAGE;
  }

  if (
    args.fallbackTriggerCode === CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE
  ) {
    return FALLBACK_TO_CHATGPT_TRANSPORT_MESSAGE;
  }

  return null;
}

export function getProposalGenerationUiErrorMessage(args: {
  error: unknown;
  proposalType: FormValues["proposalType"];
  hasCandidateContext: boolean;
}): string {
  const errorData =
    isRecord(args.error) && isRecord(args.error.data) ? args.error.data : null;
  if (
    errorData?.code === CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE ||
    errorData?.message === FRIENDLY_PROVIDER_BUSY_MESSAGE
  ) {
    return FRIENDLY_PROVIDER_BUSY_MESSAGE;
  }
  if (
    errorData?.code === CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE ||
    errorData?.message === FRIENDLY_PROVIDER_TRANSPORT_ERROR_MESSAGE
  ) {
    return FRIENDLY_PROVIDER_TRANSPORT_ERROR_MESSAGE;
  }

  const rawMessage =
    args.error instanceof Error
      ? args.error.message
      : "Failed to generate proposal. Please try again.";
  if (
    rawMessage.includes(CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE) ||
    rawMessage.includes(CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE_PREFIX)
  ) {
    return FRIENDLY_PROVIDER_BUSY_MESSAGE;
  }
  if (
    rawMessage.includes(CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE) ||
    rawMessage.includes(
      CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE_PREFIX,
    )
  ) {
    return FRIENDLY_PROVIDER_TRANSPORT_ERROR_MESSAGE;
  }
  if (
    !rawMessage.includes(CONTROLLED_PROPOSAL_FINALIZATION_FAILURE_PREFIX)
  ) {
    return rawMessage;
  }

  if (args.proposalType === "cover_letter") {
    return args.hasCandidateContext
      ? "A grounded cover letter could not be generated from the current CV and job description. Review the active CV details or try a more specific role description."
      : "A grounded cover letter could not be generated from the job description alone. Add a CV or more concrete background details and try again.";
  }

  if (args.proposalType === "application_message") {
    return args.hasCandidateContext
      ? "A grounded application message could not be generated from the current CV and job description. Review the active CV details or try again."
      : "A grounded application message could not be generated from the current job description alone. Add a CV or more concrete background details and try again.";
  }

  return args.hasCandidateContext
    ? "A grounded proposal could not be generated from the current CV and job description. Review the active CV details or try again."
    : "A grounded proposal could not be generated from the current project description alone. Add more concrete background details and try again.";
}
