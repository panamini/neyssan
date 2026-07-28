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
const JOB_ONLY_TOO_THIN_MESSAGE =
  "A grounded cover letter could not be generated from the job description alone. Add a CV or more concrete background details and try again.";
const UNKNOWN_PROPOSAL_GENERATION_ERROR_MESSAGE =
  "Generation failed. Try again.";

export type ProposalGenerationFallbackInfo = {
  requestedModelType?: string | null;
  actualModelType?: string | null;
  actualModelName?: string | null;
  fallbackTriggerCode?: string | null;
  routing?: {
    attemptedPath?: string | null;
    plannedPath?: string | null;
    executedPath?: string | null;
    fallbackReason?: string | null;
    validatorOutcome?: string | null;
    saveOutcome?: string | null;
    premiumFailureStage?: string | null;
    premiumFailureReason?: string | null;
    premiumFailureContextClass?: string | null;
  } | null;
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

export function getProposalGenerationRoutingDisclosureMessage(
  args: ProposalGenerationFallbackInfo,
): string | null {
  const routing = args.routing;
  if (!routing) {
    return null;
  }

  const parts: string[] = [];
  if (routing.attemptedPath) {
    parts.push(`route ${routing.attemptedPath}`);
  }
  if (routing.plannedPath) {
    parts.push(`planned ${routing.plannedPath}`);
  }
  if (routing.executedPath) {
    parts.push(`executed ${routing.executedPath}`);
  }
  if (routing.validatorOutcome) {
    parts.push(`validator ${routing.validatorOutcome}`);
  }
  if (routing.saveOutcome) {
    parts.push(`save ${routing.saveOutcome}`);
  }
  if (routing.fallbackReason && routing.fallbackReason !== "not_applicable") {
    parts.push(`fallback ${routing.fallbackReason}`);
  }
  if (routing.premiumFailureStage || routing.premiumFailureReason) {
    parts.push(
      `premium failure ${[
        routing.premiumFailureStage,
        routing.premiumFailureReason,
      ]
        .filter(Boolean)
        .join(": ")}`,
    );
  }

  return parts.length > 0 ? `Generation routing: ${parts.join("; ")}.` : null;
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
      : UNKNOWN_PROPOSAL_GENERATION_ERROR_MESSAGE;
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
    return UNKNOWN_PROPOSAL_GENERATION_ERROR_MESSAGE;
  }

  if (args.proposalType === "cover_letter") {
    return args.hasCandidateContext
      ? "Cover letter not grounded in your resume and the job. Review your resume, or sharpen the role description."
      : JOB_ONLY_TOO_THIN_MESSAGE;
  }

  if (args.proposalType === "application_message") {
    return args.hasCandidateContext
      ? "Application message not grounded in your resume and the job. Review your resume, or try again."
      : JOB_ONLY_TOO_THIN_MESSAGE;
  }

  return args.hasCandidateContext
    ? "A grounded proposal could not be generated from the current CV and job description. Review the active CV details or try again."
    : "A grounded proposal could not be generated from the current project description alone. Add more concrete background details and try again.";
}
