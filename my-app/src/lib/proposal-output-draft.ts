import type { FormValues } from "../components/ProposalInputForm.schemas";
import {
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import {
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";

export const PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY =
  "dasti:proposal-output-draft:v1";
export const PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT =
  "dasti:proposal-output-draft-updated";

export type StoredProposalOutputDraft = {
  proposalContent: string | null;
  proposalType: FormValues["proposalType"] | null;
  proposalVoicePreset: FormValues["voicePreset"] | null;
  proposalTemplateId: ProposalTemplateId | null;
  proposalVerbatiStyle: VerbatiStylePreset | null;
  proposalApplicantName: string;
  proposalApplicantRole: string;
  proposalDocumentTitle: string;
  proposalDocumentMeta: string;
  generatedProposalId: string | null;
  proposalOutputMode: "preview" | "edit";
};

export type StoredProposalTextSection = {
  type: "text" | "code" | "image";
  content: string;
};

export function resolveProposalStoredText(input: {
  content?: string | null;
  sections?: StoredProposalTextSection[] | null;
}): string {
  const directContent = typeof input.content === "string" ? input.content.trim() : "";
  if (directContent) {
    return directContent;
  }

  const sections = Array.isArray(input.sections) ? input.sections : [];
  const sectionText = sections
    .filter((section) => section.type === "text" && typeof section.content === "string")
    .map((section) => section.content.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return sectionText;
}

export function readStoredProposalOutputDraft(): StoredProposalOutputDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProposalOutputDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      proposalContent:
        typeof parsed.proposalContent === "string"
          ? parsed.proposalContent
          : null,
      proposalType:
        parsed.proposalType === "cover_letter" ||
        parsed.proposalType === "application_message" ||
        parsed.proposalType === "freelance_proposal"
          ? parsed.proposalType
          : null,
      proposalVoicePreset:
        typeof parsed.proposalVoicePreset === "string"
          ? (parsed.proposalVoicePreset as FormValues["voicePreset"])
          : null,
      proposalTemplateId:
        typeof parsed.proposalTemplateId === "string"
          ? resolveProposalTemplateId(parsed.proposalTemplateId)
          : null,
      proposalVerbatiStyle:
        parsed.proposalVerbatiStyle &&
        typeof parsed.proposalVerbatiStyle === "object"
          ? serializeVerbatiStyle(
              resolveVerbatiStyle(
                parsed.proposalVerbatiStyle as Partial<VerbatiStylePreset>,
              ),
            )
          : null,
      proposalApplicantName:
        typeof parsed.proposalApplicantName === "string"
          ? parsed.proposalApplicantName
          : "",
      proposalApplicantRole:
        typeof parsed.proposalApplicantRole === "string"
          ? parsed.proposalApplicantRole
          : "",
      proposalDocumentTitle:
        typeof parsed.proposalDocumentTitle === "string"
          ? parsed.proposalDocumentTitle
          : "",
      proposalDocumentMeta:
        typeof parsed.proposalDocumentMeta === "string"
          ? parsed.proposalDocumentMeta
          : "",
      generatedProposalId:
        typeof parsed.generatedProposalId === "string"
          ? parsed.generatedProposalId
          : null,
      proposalOutputMode:
        parsed.proposalOutputMode === "edit" ? "edit" : "preview",
    };
  } catch {
    return null;
  }
}
