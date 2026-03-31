import type { FormValues } from "../components/ProposalInputForm.schemas";
import type { Id } from "../../convex/_generated/dataModel";
import {
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import {
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import type { ProposalStyleLinkMode } from "./proposal-style-link";
import {
  resolveProposalStyleChoice,
  type ProposalStyleChoice,
} from "./proposal-style-choice";
import type { ProposalPaletteId } from "./proposal-style-display";
import {
  resolveProposalTemplateBundleId,
  type ProposalTemplateBundleId,
} from "./proposal-template-bundles";
import type {
  VerbatiLayoutPreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";
import type { ProposalCharacterLimitMode } from "../../convex/lib/proposals/generationControls";

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
  proposalStyleLinkMode: ProposalStyleLinkMode;
  proposalStyleChoice: ProposalStyleChoice;
  proposalApplicantName: string;
  proposalApplicantRole: string;
  proposalDocumentTitle: string;
  proposalDocumentMeta: string;
  generatedProposalId: Id<"proposals"> | null;
  proposalOutputMode: "preview" | "edit";
  paletteOverride: ProposalPaletteId | null;
  customAccentHex: string | null;
  templateBundleId: ProposalTemplateBundleId | null;
  typographyOverride: VerbatiTypographyPreset | null;
  layoutOverride: Extract<
    VerbatiLayoutPreset,
    "swiss" | "editorial" | "modernist"
  > | null;
  proposalDocumentTitleManual: boolean;
  characterLimitMode: ProposalCharacterLimitMode | null;
  characterLimitValue: number | null;
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
          ? parsed.proposalVoicePreset
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
      proposalStyleLinkMode:
        parsed.proposalStyleLinkMode === "proposal_local"
          ? "proposal_local"
          : "inherit_cv",
      proposalStyleChoice: resolveProposalStyleChoice(parsed.proposalStyleChoice),
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
      paletteOverride:
        parsed.paletteOverride === "sauge" ||
        parsed.paletteOverride === "ocre" ||
        parsed.paletteOverride === "pierre" ||
        parsed.paletteOverride === "bordeaux" ||
        parsed.paletteOverride === "encre"
          ? parsed.paletteOverride
          : null,
      customAccentHex:
        typeof parsed.customAccentHex === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(parsed.customAccentHex)
          ? parsed.customAccentHex
          : null,
      templateBundleId: resolveProposalTemplateBundleId(parsed.templateBundleId),
      typographyOverride:
        parsed.typographyOverride === "signature" ||
        parsed.typographyOverride === "engaging" ||
        parsed.typographyOverride === "expert"
          ? parsed.typographyOverride
          : null,
      layoutOverride:
        parsed.layoutOverride === "swiss" ||
        parsed.layoutOverride === "editorial" ||
        parsed.layoutOverride === "modernist"
          ? parsed.layoutOverride
          : null,
      proposalDocumentTitleManual: parsed.proposalDocumentTitleManual === true,
      characterLimitMode:
        parsed.characterLimitMode === "none" ||
        parsed.characterLimitMode === "linkedin_note_200" ||
        parsed.characterLimitMode === "linkedin_inmail_2000" ||
        parsed.characterLimitMode === "indeed_cover_letter_4000" ||
        parsed.characterLimitMode === "upwork_proposal_advisory" ||
        parsed.characterLimitMode === "custom"
          ? parsed.characterLimitMode
          : null,
      characterLimitValue:
        typeof parsed.characterLimitValue === "number" &&
        Number.isFinite(parsed.characterLimitValue)
          ? parsed.characterLimitValue
          : null,
    };
  } catch {
    return null;
  }
}

export function writeStoredProposalOutputDraft(
  draft: StoredProposalOutputDraft | null,
): void {
  if (typeof window === "undefined") return;

  try {
    if (!draft) {
      window.localStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
    }
  } catch {
    // Storage full or blocked — keep in-memory state intact.
  }

  window.dispatchEvent(new Event(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT));
}

export function updateStoredProposalOutputDraft(
  updater: (
    current: StoredProposalOutputDraft | null,
  ) => StoredProposalOutputDraft | null,
): void {
  writeStoredProposalOutputDraft(updater(readStoredProposalOutputDraft()));
}
