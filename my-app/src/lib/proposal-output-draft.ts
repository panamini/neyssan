import type { FormValues } from "../components/ProposalInputForm.schemas";
import type { Id } from "../../convex/_generated/dataModel";
import {
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import { sanitizePersistedVerbatiStyle } from "../features/verbati/style";
import { resolveVerbatiFontPairId } from "../features/verbati/fontCatalog";
import type { VerbatiStylePreset } from "../features/verbati/types";
import type { ProposalStyleLinkMode } from "./proposal-style-link";
import {
  resolveProposalStyleChoice,
  type ProposalStyleChoice,
} from "./proposal-style-choice";
import {
  isProposalPaletteId,
  type ProposalPaletteId,
} from "./proposal-style-display";
import {
  resolveProposalTemplateBundleId,
  type ProposalTemplateBundleId,
} from "./proposal-template-bundles";
import type {
  VerbatiLayoutPreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";
import type { ProposalCharacterLimitMode } from "../../convex/lib/proposals/generationControls";
import type { StoredProposalComposeDraft } from "./proposal-workspace-state";
import {
  sanitizeProposalClosingRef,
  type ProposalClosingRef,
} from "./proposal-closing";
import {
  DOCUMENT_STYLE_VERSION,
  isDocumentStyleSlotSource,
  resolveDocumentStyleSlotId,
  type DocumentAppearanceSnapshot,
  type DocumentStyleSlotSource,
} from "./document-style-slots";
import type { DocumentLanguage } from "./locale-registry";
import type {
  DocumentLanguagePreference,
  DocumentLanguageSource,
} from "./document-language";
import {
  normalizeDocumentDecoration,
  shouldPersistDocumentDecoration,
  type DocumentDecoration,
} from "./document-decoration";
import {
  normalizeDocumentIconSettings,
  type DocumentIconSettings,
} from "./document-icons";
import {
  normalizeProposalDocument,
  parseLegacyProposalDocument,
  type ProposalDocument,
} from "./proposal-document";

export const PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY =
  "dasti:proposal-output-draft:v1";
export const PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY =
  "dasti:proposal-output-draft:session:v1";
export const PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT =
  "dasti:proposal-output-draft-updated";

let preferSessionStorageForProposalOutputDraft = false;
let hasWarnedSessionFallbackForProposalOutputDraft = false;

export type StoredProposalOutputDraft = {
  proposalContent: string | null;
  proposalDocument?: ProposalDocument | null;
  proposalType: FormValues["proposalType"] | null;
  proposalVoicePreset: FormValues["voicePreset"] | null;
  proposalTemplateId: ProposalTemplateId | null;
  proposalVerbatiStyle: VerbatiStylePreset | null;
  documentDecoration?: DocumentDecoration | null;
  documentIconSettings?: DocumentIconSettings | null;
  verbatiStyleSlotId?: 1 | 2 | 3 | null;
  verbatiStyleSlotSource?: DocumentStyleSlotSource | null;
  verbatiStyleSlotNameSnapshot?: string | null;
  verbatiStyleBaseSnapshot?: DocumentAppearanceSnapshot | null;
  documentStyleVersion?: 1 | null;
  proposalStyleLinkMode: ProposalStyleLinkMode;
  proposalStyleChoice: ProposalStyleChoice;
  proposalApplicantName: string;
  proposalApplicantRole: string;
  proposalApplicantCompany?: string;
  proposalContactLine?: string;
  proposalLetterDate?: string;
  proposalRecipientDetails?: string;
  proposalHeaderShowSender?: boolean;
  proposalHeaderShowDate?: boolean;
  proposalHeaderShowSubject?: boolean;
  proposalHeaderShowRecipient?: boolean;
  proposalHeaderShowRecipientDetails?: boolean;
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
  proposalClosing?: ProposalClosingRef | null;
  characterLimitMode: ProposalCharacterLimitMode | null;
  characterLimitValue: number | null;
  requestedLanguage?: DocumentLanguagePreference | null;
  resolvedLanguage?: DocumentLanguage | null;
  languageSource?: DocumentLanguageSource;
  jobDetectedLanguage?: DocumentLanguage | null;
  sourceComposeDraft?: StoredProposalComposeDraft | null;
};

export type StoredProposalTextSection = {
  type: "text" | "code" | "image";
  content: string;
};

export function resolveProposalStoredText(input: {
  content?: string | null;
  sections?: StoredProposalTextSection[] | null;
}): string {
  const directContent =
    typeof input.content === "string" ? input.content.trim() : "";
  if (directContent) {
    return directContent;
  }

  const sections = Array.isArray(input.sections) ? input.sections : [];
  const sectionText = sections
    .filter(
      (section) =>
        section.type === "text" && typeof section.content === "string",
    )
    .map((section) => section.content.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return sectionText;
}

function normalizeDocumentAppearanceSnapshot(
  value: unknown,
): DocumentAppearanceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.layout !== "string" ||
    typeof candidate.typography !== "string" ||
    typeof candidate.palette !== "string"
  ) {
    return null;
  }

  return {
    ...(typeof candidate.familyId === "string"
      ? {
          familyId:
            candidate.familyId as DocumentAppearanceSnapshot["familyId"],
        }
      : null),
    layout: candidate.layout as DocumentAppearanceSnapshot["layout"],
    typography:
      candidate.typography as DocumentAppearanceSnapshot["typography"],
    palette: candidate.palette as DocumentAppearanceSnapshot["palette"],
    ...(typeof candidate.accentHex === "string"
      ? { accentHex: candidate.accentHex }
      : null),
  };
}

function sanitizeStoredDocumentDecoration(value: unknown): DocumentDecoration | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const decoration = normalizeDocumentDecoration(value);
  if (!shouldPersistDocumentDecoration(decoration)) return null;
  if (!decoration.assetId) return decoration;
  const {
    dataUrl: _dataUrl,
    resolvedUrl: _resolvedUrl,
    assetMissing: _assetMissing,
    ...durableDecoration
  } = decoration;
  return durableDecoration;
}

function normalizeStoredProposalComposeDraft(
  value: unknown,
): StoredProposalComposeDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<StoredProposalComposeDraft>;

  return {
    ...(typeof parsed.jobTitle === "string"
      ? { jobTitle: parsed.jobTitle }
      : null),
    ...(typeof parsed.jobDescription === "string"
      ? { jobDescription: parsed.jobDescription }
      : null),
    ...(typeof parsed.sourceUrl === "string" || parsed.sourceUrl === null
      ? { sourceUrl: parsed.sourceUrl ?? null }
      : null),
    ...(typeof parsed.platform === "string" || parsed.platform === null
      ? { platform: parsed.platform ?? null }
      : null),
    ...(typeof parsed.proposalType === "string"
      ? { proposalType: parsed.proposalType }
      : null),
    ...(typeof parsed.voicePreset === "string" || parsed.voicePreset === null
      ? { voicePreset: parsed.voicePreset ?? null }
      : null),
    ...(typeof parsed.toneTuning === "string" || parsed.toneTuning === null
      ? { toneTuning: parsed.toneTuning ?? null }
      : null),
    ...(typeof parsed.characterLimitMode === "string"
      ? { characterLimitMode: parsed.characterLimitMode }
      : null),
    ...(typeof parsed.characterLimitValue === "number" &&
    Number.isFinite(parsed.characterLimitValue)
      ? { characterLimitValue: parsed.characterLimitValue }
      : parsed.characterLimitValue === null
        ? { characterLimitValue: null }
        : null),
  };
}

function readProposalOutputDraftRaw(): string | null {
  if (typeof window === "undefined") return null;

  if (preferSessionStorageForProposalOutputDraft) {
    try {
      const sessionRaw = window.sessionStorage.getItem(
        PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      );
      if (sessionRaw) {
        return sessionRaw;
      }
    } catch {
      // Best-effort.
    }
  }

  try {
    const localRaw = window.localStorage.getItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
    );
    if (localRaw) {
      return localRaw;
    }
  } catch {
    // Best-effort.
  }

  try {
    return window.sessionStorage.getItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
    );
  } catch {
    return null;
  }
}

function removeStoredProposalOutputDraftRaw(): void {
  if (typeof window === "undefined") return;

  preferSessionStorageForProposalOutputDraft = false;
  hasWarnedSessionFallbackForProposalOutputDraft = false;

  try {
    window.localStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
  } catch {
    // Best-effort.
  }

  try {
    window.sessionStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

export function readStoredProposalOutputDraft(): StoredProposalOutputDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = readProposalOutputDraftRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProposalOutputDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      proposalContent:
        typeof parsed.proposalContent === "string"
          ? parsed.proposalContent
          : null,
      proposalDocument: normalizeProposalDocument(parsed.proposalDocument),
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
          ? sanitizePersistedVerbatiStyle(
              parsed.proposalVerbatiStyle as Partial<VerbatiStylePreset>,
            )
          : null,
      documentDecoration: sanitizeStoredDocumentDecoration(
        parsed.documentDecoration,
      ),
      documentIconSettings: normalizeDocumentIconSettings(
        parsed.documentIconSettings,
      ),
      verbatiStyleSlotId: resolveDocumentStyleSlotId(parsed.verbatiStyleSlotId),
      verbatiStyleSlotSource: isDocumentStyleSlotSource(
        parsed.verbatiStyleSlotSource,
      )
        ? parsed.verbatiStyleSlotSource
        : null,
      verbatiStyleSlotNameSnapshot:
        typeof parsed.verbatiStyleSlotNameSnapshot === "string"
          ? parsed.verbatiStyleSlotNameSnapshot
          : null,
      verbatiStyleBaseSnapshot: normalizeDocumentAppearanceSnapshot(
        parsed.verbatiStyleBaseSnapshot,
      ),
      documentStyleVersion:
        parsed.documentStyleVersion === DOCUMENT_STYLE_VERSION
          ? DOCUMENT_STYLE_VERSION
          : null,
      proposalStyleLinkMode:
        parsed.proposalStyleLinkMode === "proposal_local"
          ? "proposal_local"
          : "inherit_cv",
      proposalStyleChoice: resolveProposalStyleChoice(
        parsed.proposalStyleChoice,
      ),
      proposalApplicantName:
        typeof parsed.proposalApplicantName === "string"
          ? parsed.proposalApplicantName
          : "",
      proposalApplicantRole:
        typeof parsed.proposalApplicantRole === "string"
          ? parsed.proposalApplicantRole
          : "",
      proposalApplicantCompany:
        typeof parsed.proposalApplicantCompany === "string"
          ? parsed.proposalApplicantCompany
          : "",
      proposalContactLine:
        typeof parsed.proposalContactLine === "string"
          ? parsed.proposalContactLine
          : "",
      proposalLetterDate:
        typeof parsed.proposalLetterDate === "string"
          ? parsed.proposalLetterDate
          : "",
      proposalRecipientDetails:
        typeof parsed.proposalRecipientDetails === "string"
          ? parsed.proposalRecipientDetails
          : "",
      proposalHeaderShowSender:
        typeof parsed.proposalHeaderShowSender === "boolean"
          ? parsed.proposalHeaderShowSender
          : undefined,
      proposalHeaderShowDate:
        typeof parsed.proposalHeaderShowDate === "boolean"
          ? parsed.proposalHeaderShowDate
          : undefined,
      proposalHeaderShowSubject:
        typeof parsed.proposalHeaderShowSubject === "boolean"
          ? parsed.proposalHeaderShowSubject
          : undefined,
      proposalHeaderShowRecipient:
        typeof parsed.proposalHeaderShowRecipient === "boolean"
          ? parsed.proposalHeaderShowRecipient
          : undefined,
      proposalHeaderShowRecipientDetails:
        typeof parsed.proposalHeaderShowRecipientDetails === "boolean"
          ? parsed.proposalHeaderShowRecipientDetails
          : undefined,
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
      paletteOverride: isProposalPaletteId(parsed.paletteOverride)
        ? parsed.paletteOverride
        : null,
      customAccentHex:
        typeof parsed.customAccentHex === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(parsed.customAccentHex)
          ? parsed.customAccentHex
          : null,
      templateBundleId: resolveProposalTemplateBundleId(
        parsed.templateBundleId,
      ),
      typographyOverride:
        typeof parsed.typographyOverride === "string"
          ? resolveVerbatiFontPairId(parsed.typographyOverride)
          : null,
      layoutOverride:
        parsed.layoutOverride === "swiss" ||
        parsed.layoutOverride === "editorial" ||
        parsed.layoutOverride === "modernist"
          ? parsed.layoutOverride
          : null,
      proposalDocumentTitleManual: parsed.proposalDocumentTitleManual === true,
      proposalClosing: sanitizeProposalClosingRef(parsed.proposalClosing),
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
      requestedLanguage:
        typeof parsed.requestedLanguage === "string" ||
        parsed.requestedLanguage === null
          ? parsed.requestedLanguage
          : null,
      resolvedLanguage:
        typeof parsed.resolvedLanguage === "string" ||
        parsed.resolvedLanguage === null
          ? parsed.resolvedLanguage
          : null,
      languageSource:
        parsed.languageSource === "document-preference" ||
        parsed.languageSource === "job-detected" ||
        parsed.languageSource === "ui-fallback" ||
        parsed.languageSource === "default"
          ? parsed.languageSource
          : parsed.languageSource === "job"
            ? "job-detected"
          : undefined,
      jobDetectedLanguage:
        typeof parsed.jobDetectedLanguage === "string" ||
        parsed.jobDetectedLanguage === null
          ? parsed.jobDetectedLanguage
          : null,
      sourceComposeDraft: normalizeStoredProposalComposeDraft(
        parsed.sourceComposeDraft,
      ),
    };
  } catch {
    return null;
  }
}

function buildSanitizedStoredProposalOutputDraft(
  draft: StoredProposalOutputDraft,
): StoredProposalOutputDraft {
  const proposalContent =
    typeof draft.proposalContent === "string" ? draft.proposalContent : null;
  const proposalDocument =
    normalizeProposalDocument(draft.proposalDocument) ??
    (proposalContent
      ? parseLegacyProposalDocument({
          content: proposalContent,
          proposalType: draft.proposalType,
          closing: draft.proposalClosing,
        })
      : null);

  return {
    proposalContent,
    proposalDocument,
    proposalType:
      draft.proposalType === "cover_letter" ||
      draft.proposalType === "application_message" ||
      draft.proposalType === "freelance_proposal"
        ? draft.proposalType
        : null,
    proposalVoicePreset:
      typeof draft.proposalVoicePreset === "string"
        ? draft.proposalVoicePreset
        : null,
    proposalTemplateId:
      typeof draft.proposalTemplateId === "string"
        ? resolveProposalTemplateId(draft.proposalTemplateId)
        : null,
    proposalVerbatiStyle:
      draft.proposalVerbatiStyle &&
      typeof draft.proposalVerbatiStyle === "object"
        ? sanitizePersistedVerbatiStyle(
            draft.proposalVerbatiStyle as Partial<VerbatiStylePreset>,
          )
        : null,
    documentDecoration: sanitizeStoredDocumentDecoration(draft.documentDecoration),
    documentIconSettings: normalizeDocumentIconSettings(
      draft.documentIconSettings,
    ),
    verbatiStyleSlotId: resolveDocumentStyleSlotId(draft.verbatiStyleSlotId),
    verbatiStyleSlotSource: isDocumentStyleSlotSource(
      draft.verbatiStyleSlotSource,
    )
      ? draft.verbatiStyleSlotSource
      : null,
    verbatiStyleSlotNameSnapshot:
      typeof draft.verbatiStyleSlotNameSnapshot === "string"
        ? draft.verbatiStyleSlotNameSnapshot
        : null,
    verbatiStyleBaseSnapshot: normalizeDocumentAppearanceSnapshot(
      draft.verbatiStyleBaseSnapshot,
    ),
    documentStyleVersion:
      draft.documentStyleVersion === DOCUMENT_STYLE_VERSION
        ? DOCUMENT_STYLE_VERSION
        : null,
    proposalStyleLinkMode:
      draft.proposalStyleLinkMode === "proposal_local"
        ? "proposal_local"
        : "inherit_cv",
    proposalStyleChoice: resolveProposalStyleChoice(draft.proposalStyleChoice),
    proposalApplicantName:
      typeof draft.proposalApplicantName === "string"
        ? draft.proposalApplicantName
        : "",
    proposalApplicantRole:
      typeof draft.proposalApplicantRole === "string"
        ? draft.proposalApplicantRole
        : "",
    proposalApplicantCompany:
      typeof draft.proposalApplicantCompany === "string"
        ? draft.proposalApplicantCompany
        : "",
    proposalContactLine:
      typeof draft.proposalContactLine === "string"
        ? draft.proposalContactLine
        : "",
    proposalLetterDate:
      typeof draft.proposalLetterDate === "string"
        ? draft.proposalLetterDate
        : "",
    proposalRecipientDetails:
      typeof draft.proposalRecipientDetails === "string"
        ? draft.proposalRecipientDetails
        : "",
    proposalHeaderShowSender:
      typeof draft.proposalHeaderShowSender === "boolean"
        ? draft.proposalHeaderShowSender
        : undefined,
    proposalHeaderShowDate:
      typeof draft.proposalHeaderShowDate === "boolean"
        ? draft.proposalHeaderShowDate
        : undefined,
    proposalHeaderShowSubject:
      typeof draft.proposalHeaderShowSubject === "boolean"
        ? draft.proposalHeaderShowSubject
        : undefined,
    proposalHeaderShowRecipient:
      typeof draft.proposalHeaderShowRecipient === "boolean"
        ? draft.proposalHeaderShowRecipient
        : undefined,
    proposalHeaderShowRecipientDetails:
      typeof draft.proposalHeaderShowRecipientDetails === "boolean"
        ? draft.proposalHeaderShowRecipientDetails
        : undefined,
    proposalDocumentTitle:
      typeof draft.proposalDocumentTitle === "string"
        ? draft.proposalDocumentTitle
        : "",
    proposalDocumentMeta:
      typeof draft.proposalDocumentMeta === "string"
        ? draft.proposalDocumentMeta
        : "",
    generatedProposalId:
      typeof draft.generatedProposalId === "string"
        ? draft.generatedProposalId
        : null,
    proposalOutputMode:
      draft.proposalOutputMode === "edit" ? "edit" : "preview",
    paletteOverride: isProposalPaletteId(draft.paletteOverride)
      ? draft.paletteOverride
      : null,
    customAccentHex:
      typeof draft.customAccentHex === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(draft.customAccentHex)
        ? draft.customAccentHex
        : null,
    templateBundleId: resolveProposalTemplateBundleId(draft.templateBundleId),
    typographyOverride:
      typeof draft.typographyOverride === "string"
        ? resolveVerbatiFontPairId(draft.typographyOverride)
        : null,
    layoutOverride:
      draft.layoutOverride === "swiss" ||
      draft.layoutOverride === "editorial" ||
      draft.layoutOverride === "modernist"
        ? draft.layoutOverride
        : null,
    proposalDocumentTitleManual: draft.proposalDocumentTitleManual === true,
    proposalClosing: sanitizeProposalClosingRef(draft.proposalClosing),
    characterLimitMode:
      draft.characterLimitMode === "none" ||
      draft.characterLimitMode === "linkedin_note_200" ||
      draft.characterLimitMode === "linkedin_inmail_2000" ||
      draft.characterLimitMode === "indeed_cover_letter_4000" ||
      draft.characterLimitMode === "upwork_proposal_advisory" ||
      draft.characterLimitMode === "custom"
        ? draft.characterLimitMode
        : null,
    characterLimitValue:
      typeof draft.characterLimitValue === "number" &&
      Number.isFinite(draft.characterLimitValue)
        ? draft.characterLimitValue
        : null,
    requestedLanguage:
      typeof draft.requestedLanguage === "string" ||
      draft.requestedLanguage === null
        ? draft.requestedLanguage
        : null,
    resolvedLanguage:
      typeof draft.resolvedLanguage === "string" ||
      draft.resolvedLanguage === null
        ? draft.resolvedLanguage
        : null,
    languageSource:
      draft.languageSource === "document-preference" ||
      draft.languageSource === "job-detected" ||
      draft.languageSource === "ui-fallback" ||
      draft.languageSource === "default"
        ? draft.languageSource
        : undefined,
    jobDetectedLanguage:
      typeof draft.jobDetectedLanguage === "string" ||
      draft.jobDetectedLanguage === null
        ? draft.jobDetectedLanguage
        : null,
    sourceComposeDraft: normalizeStoredProposalComposeDraft(
      draft.sourceComposeDraft,
    ),
  };
}

export function writeStoredProposalOutputDraft(
  draft: StoredProposalOutputDraft | null,
): void {
  if (typeof window === "undefined") return;

  let nextRaw: string | null = null;
  let fallbackRaw: string | null = null;

  try {
    if (draft) {
      JSON.stringify(draft);
    }
  } catch (error) {
    console.warn(
      "[proposal-output-draft] Failed to serialize full output draft, retrying with a sanitized payload.",
      error,
    );
  }

  try {
    if (draft) {
      fallbackRaw = JSON.stringify(
        buildSanitizedStoredProposalOutputDraft(draft),
      );
      nextRaw = fallbackRaw;
    }
  } catch (error) {
    console.warn(
      "[proposal-output-draft] Failed to serialize sanitized output draft.",
      error,
    );
    return;
  }

  try {
    const currentRaw = readProposalOutputDraftRaw();

    if (currentRaw === nextRaw) {
      return;
    }

    if (!draft) {
      removeStoredProposalOutputDraftRaw();
    } else {
      if (preferSessionStorageForProposalOutputDraft) {
        const sessionRaw = fallbackRaw ?? nextRaw;
        if (sessionRaw === null) {
          return;
        }
        window.sessionStorage.setItem(
          PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
          sessionRaw,
        );
      } else {
        if (nextRaw === null) {
          return;
        }
        window.localStorage.setItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY, nextRaw);
        preferSessionStorageForProposalOutputDraft = false;
        hasWarnedSessionFallbackForProposalOutputDraft = false;
        try {
          window.sessionStorage.removeItem(
            PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
          );
        } catch {
          // Best-effort.
        }
      }
    }
  } catch (error) {
    try {
      const currentSessionRaw = window.sessionStorage.getItem(
        PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      );
      const sessionPayload = fallbackRaw ?? nextRaw;

      if (!draft || sessionPayload === null) {
        console.warn(
          "[proposal-output-draft] Failed to persist output draft.",
          error,
        );
        return;
      }

      if (currentSessionRaw === sessionPayload) {
        return;
      }

      window.sessionStorage.setItem(
        PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
        sessionPayload,
      );

      preferSessionStorageForProposalOutputDraft = true;
      if (!hasWarnedSessionFallbackForProposalOutputDraft) {
        console.warn(
          "[proposal-output-draft] Fell back to sessionStorage after localStorage persistence failed.",
          error,
        );
        hasWarnedSessionFallbackForProposalOutputDraft = true;
      }
    } catch (fallbackError) {
      console.warn(
        "[proposal-output-draft] Failed to persist output draft.",
        fallbackError,
      );
      return;
    }
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
