import React from "react";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useToast } from "./ui/toast";
import { ToneBadge, type ToneBadgeTone } from "./ui";
import { AUTH_REQUIRED_TOAST } from "../lib/toast-copy";
import ProposalDisplay from "./ProposalDisplay";
import { SavedProposalForgeToolbarPreview } from "./SavedProposalForgeToolbarPreview";
import type { SaveStatus } from "./ui/SaveIndicator";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  buildAppProposalPersonalizationPayload,
  getActiveLocalPersonalizationSource,
  getLocalCvDocumentById,
  type ProposalApplicantHeaderData,
  type ProposalGenerationPersonalizationPayload,
} from "../lib/proposal-personalization";
import { resolveRegeneratedProposalTitle } from "../../convex/lib/proposals/proposalOutput";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  type ProposalCreativityLevel,
  type ProposalFormalityLevel,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import { type ProposalCharacterLimitMode } from "../../convex/lib/proposals/generationControls";
import { type ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { formatUiDate } from "../lib/ui-date";
import {
  resolveProposalStoredText,
  type StoredProposalTextSection,
} from "../lib/proposal-output-draft";
import { readStoredSavedProposalFixtures } from "../lib/proposal-saved-fixtures";
import {
  getVerbatiStyleFromCv,
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import type {
  VerbatiLayoutPreset,
  VerbatiStylePreset,
  VerbatiTypographyPreset,
} from "../features/verbati/types";
import { resolveProposalRenderState } from "../lib/proposal-render-state";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import {
  getProposalBundleForDocumentStyleSlot,
  type DocumentStyleMetadata,
} from "../lib/document-style-slots";
import {
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../lib/proposal-template-bundles";
import {
  isProposalPaletteId,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import {
  buildProposalHeaderVisibilityFromContent,
  resolveProposalHeaderVisibility,
} from "../lib/proposal-header";
import {
  buildProposalApplicantHeaderFromMetadata,
  resolveProposalHeadingText,
} from "../lib/proposal-heading-state";
import type { ProposalSignatureSettings } from "../lib/proposal-signature-settings";
import {
  resolveProposalClosingRef,
  type ProposalClosingRef,
} from "../lib/proposal-closing";
import type { DocumentDecoration } from "../lib/document-decoration";

type SavedProposalLayoutId = Extract<
  VerbatiLayoutPreset,
  "swiss" | "editorial" | "modernist"
>;

type SavedProposalType =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

type SavedProposalRecord = {
  _id: string;
  _creationTime: number;
  status?: string;
  title?: string;
  content?: string;
  sections?: Array<{
    type?: string;
    content?: string;
  }>;
  metadata?: DocumentStyleMetadata & {
    sourceJobTitle?: string;
    sourceJobDescription?: string;
    proposalType?: SavedProposalType;
    requestedModelType?: string;
    actualModelType?: string;
    fallbackTriggerCode?: string;
    voicePreset?: ProposalVoicePreset;
    requestedVoicePreset?: ProposalVoicePreset | null;
    resolvedVoicePreset?: ProposalVoicePreset;
    formalityLevel?: ProposalFormalityLevel;
    creativity?: ProposalCreativityLevel;
    templateId?: ProposalTemplateId;
    verbatiStyle?: Partial<VerbatiStylePreset>;
    styleLinkMode?: "inherit_cv" | "proposal_local";
    sourceCvId?: string;
    templateBundleId?: ProposalTemplateBundleId;
    layoutOverride?: SavedProposalLayoutId | null;
    characterLimitMode?: ProposalCharacterLimitMode;
    characterLimitValue?: number | null;
    closing?: ProposalClosingRef;
    documentDecoration?: DocumentDecoration;
    applicantName?: string;
    applicantRole?: string;
    contactLine?: string;
    letterDate?: string;
    recipientDetails?: string;
    headerShowSender?: boolean;
    headerShowDate?: boolean;
    headerShowSubject?: boolean;
    headerShowRecipient?: boolean;
    headerShowRecipientDetails?: boolean;
  };
};

const PROPOSAL_SAVE_DEBOUNCE_MS =
  Number(
    (typeof globalThis !== "undefined" &&
      (globalThis as any).process?.env?.TEST_DEBOUNCE_MS) ??
      (typeof process !== "undefined"
        ? (process as any).env?.TEST_DEBOUNCE_MS
        : undefined),
  ) || 1000;

type SavedProposalViewMode = "focused" | "stack" | "library";

type RegeneratePayload = {
  jobTitle: string;
  jobDescription: string;
  proposalType: SavedProposalType;
  voicePreset: ProposalVoicePreset | null;
  formalityLevel?: ProposalFormalityLevel;
  creativity?: ProposalCreativityLevel;
  modelType:
    | "chatgpt"
    | "mistral-small-latest"
    | "mistral-large-latest"
    | "mistral-agent";
  characterLimitMode?: ProposalCharacterLimitMode;
  characterLimitValue?: number | null;
} & ProposalGenerationPersonalizationPayload;

function normalizeSavedBundleId(
  value: ProposalTemplateBundleId | null | undefined,
): ProposalTemplateBundleId | null {
  if (!value) return null;
  if (value === "grid_mono" || value === "swiss_mono") return "grid_mono";
  if (value === "magazine_editorial" || value === "magazine_serif") {
    return "magazine_editorial";
  }
  return "swiss_serif";
}

function normalizeAccentHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function normalizeSavedLayoutOverride(
  value: unknown,
): SavedProposalLayoutId | null {
  return value === "swiss" || value === "editorial" || value === "modernist"
    ? value
    : null;
}

function normalizeSavedTextValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveSavedHeaderVisibility(proposal: SavedProposalRecord | null) {
  return resolveProposalHeaderVisibility({
    ...buildProposalHeaderVisibilityFromContent(
      resolveProposalHeadingText(proposal?.metadata, "recipientDetails"),
    ),
    showSender: proposal?.metadata?.headerShowSender,
    showDate: proposal?.metadata?.headerShowDate,
    showSubject: proposal?.metadata?.headerShowSubject,
    showRecipient: proposal?.metadata?.headerShowRecipient,
    showRecipientDetails: proposal?.metadata?.headerShowRecipientDetails,
  });
}

function resolveSavedAppearanceState(proposal: SavedProposalRecord | null): {
  bundleId: ProposalTemplateBundleId | null;
  paletteOverride: ProposalPaletteId | null;
  customAccentHex: string | null;
  layoutOverride: SavedProposalLayoutId | null;
} {
  if (!proposal) {
    return {
      bundleId: null,
      paletteOverride: null,
      customAccentHex: null,
      layoutOverride: null,
    };
  }

  const storedStyle =
    proposal.metadata?.verbatiStyle ??
    proposal.metadata?.verbatiStyleBaseSnapshot ??
    null;
  const explicitBundleId =
    normalizeSavedBundleId(proposal.metadata?.templateBundleId) ??
    getProposalBundleForDocumentStyleSlot(
      proposal.metadata?.verbatiStyleSlotId,
    );
  const customAccentHex =
    storedStyle?.palette === "custom"
      ? normalizeAccentHex(storedStyle.accentHex)
      : null;
  const storedPalette = isProposalPaletteId(storedStyle?.palette)
    ? storedStyle.palette
    : null;
  const bundleDefaultPalette = explicitBundleId
    ? getProposalTemplateBundleDefinition(explicitBundleId).stylePreset.palette
    : null;

  return {
    bundleId: explicitBundleId,
    paletteOverride:
      customAccentHex ||
      !storedPalette ||
      storedPalette === bundleDefaultPalette
        ? null
        : storedPalette,
    customAccentHex,
    layoutOverride: normalizeSavedLayoutOverride(
      proposal.metadata?.layoutOverride,
    ),
  };
}

function resolveSavedSourceCvId(
  proposal: SavedProposalRecord | null,
): string | null {
  return normalizeSavedTextValue(proposal?.metadata?.sourceCvId) ?? null;
}

function resolveSavedSourceCvStylePreset(
  proposal: SavedProposalRecord | null,
  fallbackCvStylePreset: Partial<VerbatiStylePreset> | null,
): Partial<VerbatiStylePreset> | null {
  const sourceCvId = resolveSavedSourceCvId(proposal);
  if (sourceCvId) {
    const sourceCvDocument = getLocalCvDocumentById(sourceCvId);
    return sourceCvDocument ? getVerbatiStyleFromCv(sourceCvDocument) : null;
  }

  return fallbackCvStylePreset;
}

function buildSavedApplicantHeader(
  proposal: SavedProposalRecord | null,
): ProposalApplicantHeaderData | null {
  return buildProposalApplicantHeaderFromMetadata(proposal?.metadata);
}

function inferSavedProposalType(
  content: string | undefined,
): SavedProposalType {
  if (!content) return "cover_letter";
  const normalized = content.trim();
  if (!normalized) return "cover_letter";
  if (/(^|\n)\s{0,3}(#|[-*]\s|\d+\.\s)/m.test(normalized))
    return "freelance_proposal";
  const lines = normalized
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (/^(dear|hello|hi)\b/i.test(firstLine)) return "cover_letter";
  if (wordCount <= 120) return "application_message";
  return "cover_letter";
}

function shouldPreserveLeadBreak(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^(dear|hello|hi|greetings)\b/i.test(trimmed)) return true;
  return /[:,]$/.test(trimmed) && trimmed.split(/\s+/).length <= 6;
}

function isGenericSalutation(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^(dear|hello|hi|greetings|bonjour|bonsoir)\b[\s,!:-]*/i.test(trimmed);
}

function buildProposalSnippet(value: unknown): string {
  if (typeof value !== "string") return "";
  const paragraphs = value
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph, index) => {
      const rawLines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const lines =
        index === 0 && rawLines.length > 0 && isGenericSalutation(rawLines[0])
          ? rawLines.slice(1)
          : rawLines;

      if (lines.length === 0) return "";
      if (
        index === 0 &&
        lines.length > 1 &&
        shouldPreserveLeadBreak(lines[0])
      ) {
        const lead = lines[0];
        const remainder = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
        return remainder ? `${lead}\n${remainder}` : lead;
      }

      return lines.join(" ").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  if (paragraphs.length === 1) return paragraphs[0];
  return paragraphs.slice(0, 2).join("\n");
}

function resolveRegenerateJobTitle(
  title: string | undefined,
  proposalType: SavedProposalType,
): string {
  return resolveRegeneratedProposalTitle({
    currentTitle: title,
    format: proposalType,
  });
}

function getStoredProposalType(
  proposal: SavedProposalRecord,
): SavedProposalType {
  return (
    proposal.metadata?.proposalType ?? inferSavedProposalType(proposal.content)
  );
}

function getStoredRegenerateJobDescription(
  proposal: SavedProposalRecord,
): string | null {
  const normalized = proposal.metadata?.sourceJobDescription?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getStoredVoicePreset(
  proposal: SavedProposalRecord,
): ProposalVoicePreset {
  return (
    proposal.metadata?.resolvedVoicePreset ??
    proposal.metadata?.voicePreset ??
    DEFAULT_PROPOSAL_VOICE_PRESET
  );
}

function getStoredRequestedVoicePreset(
  proposal: SavedProposalRecord,
): ProposalVoicePreset | null {
  if (
    proposal.metadata &&
    Object.prototype.hasOwnProperty.call(
      proposal.metadata,
      "requestedVoicePreset",
    )
  ) {
    return proposal.metadata.requestedVoicePreset ?? null;
  }

  return proposal.metadata?.voicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET;
}

function getStoredProposalRenderInput(proposal: SavedProposalRecord): {
  storedTemplateId?: ProposalTemplateId;
  storedStylePreset?: Partial<VerbatiStylePreset>;
  storedStyleBaseSnapshot?: Partial<VerbatiStylePreset>;
  storedStyleSlotId?: unknown;
} {
  return {
    storedTemplateId: proposal.metadata?.templateId,
    storedStylePreset: proposal.metadata?.verbatiStyle,
    storedStyleBaseSnapshot: proposal.metadata?.verbatiStyleBaseSnapshot,
    storedStyleSlotId: proposal.metadata?.verbatiStyleSlotId,
  };
}

function hasSavedProposalArtifactSnapshot(
  proposal: SavedProposalRecord | null,
): boolean {
  return Boolean(
    proposal?.metadata?.verbatiStyle ||
      proposal?.metadata?.templateId ||
      proposal?.metadata?.verbatiStyleBaseSnapshot ||
      proposal?.metadata?.verbatiStyleSlotId,
  );
}

function serializeSavedProposalMetadataVerbatiStyle(
  style:
    | ReturnType<typeof resolveVerbatiStyle>
    | ReturnType<typeof serializeVerbatiStyle>
    | Partial<VerbatiStylePreset>
    | null
    | undefined,
): NonNullable<SavedProposalRecord["metadata"]>["verbatiStyle"] {
  if (!style) {
    return undefined;
  }

  const serializedStyle = serializeVerbatiStyle(resolveVerbatiStyle(style));

  return {
    layout: serializedStyle.layout,
    typography: serializedStyle.typography,
    palette: serializedStyle.palette,
    ...(serializedStyle.accentHex
      ? { accentHex: serializedStyle.accentHex }
      : null),
  };
}

function serializeSavedProposalLayoutOverride(
  value: VerbatiLayoutPreset | null | undefined,
): SavedProposalLayoutId | undefined {
  return value === "swiss" || value === "editorial" || value === "modernist"
    ? value
    : undefined;
}

function getProposalDisplayText(proposal: SavedProposalRecord | null): string {
  if (!proposal) return "";

  const normalizedSections: StoredProposalTextSection[] | undefined =
    proposal.sections?.flatMap((section) => {
      if (
        (section.type === "text" ||
          section.type === "code" ||
          section.type === "image") &&
        typeof section.content === "string"
      ) {
        return [{ type: section.type, content: section.content }];
      }

      return [];
    });

  return resolveProposalStoredText({
    content: proposal.content,
    sections: normalizedSections,
  });
}

function typeLabel(t: SavedProposalType): string {
  if (t === "cover_letter") return "Letter";
  if (t === "freelance_proposal") return "Proposal";
  return "Message";
}

const MOBILE_SAVED_PROPOSAL_MEDIA_QUERY = "(max-width: 820px)";
const PINCH_OVERVIEW_THRESHOLD = 0.88;
const PINCH_DETAIL_THRESHOLD = 1.12;

function toneLabel(preset: ProposalVoicePreset | null): string {
  return getVoicePresetDisplayLabel(preset);
}

function toneBadgeTone(preset: ProposalVoicePreset | null): ToneBadgeTone {
  if (preset === "engaging" || preset === "storyteller") {
    return "warm";
  }
  if (preset === "expert") {
    return "formal";
  }
  return "natural";
}

function buildProposalMeta(
  proposal: SavedProposalRecord | null,
  options?: { includeTone?: boolean },
): string {
  if (!proposal) return "";

  const proposalDate = formatUiDate(proposal._creationTime) ?? "";
  const includeTone = options?.includeTone ?? true;

  return [
    typeLabel(getStoredProposalType(proposal)),
    includeTone ? toneLabel(getStoredVoicePreset(proposal)) : null,
    proposalDate,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const [firstTouch, secondTouch] = [touches[0], touches[1]];
  const deltaX = firstTouch.clientX - secondTouch.clientX;
  const deltaY = firstTouch.clientY - secondTouch.clientY;
  return Math.hypot(deltaX, deltaY);
}

function stepSavedProposalViewMode(
  current: SavedProposalViewMode,
  direction: "overview" | "detail",
): SavedProposalViewMode {
  if (direction === "overview") {
    if (current === "focused") return "stack";
    if (current === "stack") return "library";
    return "library";
  }

  if (current === "library") return "stack";
  if (current === "stack") return "focused";
  return "focused";
}

interface ProposalsListProps {
  selectedProposalId?: string | null;
  onSelectedProposalIdChange?: (id: string | null) => void;
  onOpenDraftProposal?: (id: string) => void;
  signatureSettings?: ProposalSignatureSettings | null;
  savedViewActions?: React.ReactNode;
}

const SECONDARY_PROPOSAL_PAGE_SIZE = 2;

export default function ProposalsList({
  selectedProposalId = null,
  onSelectedProposalIdChange,
  onOpenDraftProposal,
  signatureSettings = null,
  savedViewActions = null,
}: ProposalsListProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const { currentCv } = useCvLibrary();
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as SavedProposalRecord[] | undefined;
  const fallbackProposals = React.useMemo(
    () =>
      !isLoaded || !isSignedIn || !isConvexAuthenticated
        ? readStoredSavedProposalFixtures().map(
            (proposal): SavedProposalRecord => ({
              ...proposal,
              _creationTime:
                proposal._creationTime ??
                proposal.updatedAt ??
                proposal.createdAt ??
                0,
              metadata: proposal.metadata as SavedProposalRecord["metadata"],
            }),
          )
        : [],
    [isConvexAuthenticated, isLoaded, isSignedIn],
  );
  const optimisticSavedProposal = React.useMemo<SavedProposalRecord | null>(
    () => null,
    [],
  );
  const savedProposals = React.useMemo(() => {
    const mergedProposals = new Map<string, SavedProposalRecord>();

    for (const proposal of proposals ?? fallbackProposals) {
      mergedProposals.set(String(proposal._id), proposal);
    }

    if (optimisticSavedProposal) {
      mergedProposals.set(
        String(optimisticSavedProposal._id),
        optimisticSavedProposal,
      );
    }

    return [...mergedProposals.values()]
      .filter(
        (proposal) =>
          proposal.status === "draft" || proposal.status === "saved",
      )
      .sort((left, right) => {
        const leftRank = left.status === "saved" ? 0 : 1;
        const rightRank = right.status === "saved" ? 0 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return (
          (right.updatedAt ?? right._creationTime ?? 0) -
          (left.updatedAt ?? left._creationTime ?? 0)
        );
      });
  }, [fallbackProposals, optimisticSavedProposal, proposals]);
  const deleteProposal = useMutation(
    (api as any).deleteProposalPublic?.default,
  );
  const generateProposalAction = useAction(
    api.functions.generateProposal as any,
  );
  const updateProposal = useMutation(
    (api as any).updateProposalPublic?.default,
  );

  const [localProposals, setLocalProposals] = React.useState<
    SavedProposalRecord[] | null
  >(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState<string>("");
  const [editContent, setEditContent] = React.useState<string>("");
  const [isRegenerating, setIsRegenerating] = React.useState<string | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [selectedSaveStatus, setSelectedSaveStatus] =
    React.useState<SaveStatus>("idle");
  const [selectedOutputMode, setSelectedOutputMode] = React.useState<
    "preview" | "edit"
  >("preview");
  const [isEditingSelectedTitle, setIsEditingSelectedTitle] =
    React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [savedViewMode, setSavedViewMode] =
    React.useState<SavedProposalViewMode>("stack");
  const [visibleSecondaryCount, setVisibleSecondaryCount] = React.useState(
    SECONDARY_PROPOSAL_PAGE_SIZE,
  );
  const [isSwitchingProposal, setIsSwitchingProposal] = React.useState(false);
  const [isMobileSavedViewport, setIsMobileSavedViewport] =
    React.useState(false);
  const [selectionRevealToken, setSelectionRevealToken] = React.useState(0);
  const [selectedStyleBundleId, setSelectedStyleBundleId] =
    React.useState<ProposalTemplateBundleId | null>(null);
  const [selectedPaletteOverride, setSelectedPaletteOverride] =
    React.useState<ProposalPaletteId | null>(null);
  const [selectedCustomAccentHex, setSelectedCustomAccentHex] = React.useState<
    string | null
  >(null);
  const [selectedLayoutOverride, setSelectedLayoutOverride] =
    React.useState<VerbatiLayoutPreset | null>(null);
  const [selectedTypographyOverride, setSelectedTypographyOverride] =
    React.useState<VerbatiTypographyPreset | null>(null);
  const [selectedRefineVoicePreset, setSelectedRefineVoicePreset] =
    React.useState<ProposalVoicePreset | null>(DEFAULT_PROPOSAL_VOICE_PRESET);
  const [selectedZoomIndex, setSelectedZoomIndex] = React.useState(1);
  const [isSelectionPending, startSelectionTransition] = React.useTransition();
  const { showToast } = useToast();
  const activeCvStylePreset = React.useMemo(
    () => (currentCv ? getVerbatiStyleFromCv(currentCv) : null),
    [currentCv],
  );
  const resolveSourceCvStyleForProposal = React.useCallback(
    (proposal: SavedProposalRecord | null) =>
      resolveSavedSourceCvStylePreset(proposal, activeCvStylePreset),
    [activeCvStylePreset],
  );
  const showConvexAuthRequiredToast = React.useCallback(
    (actionLabel: string) => {
      showToast(AUTH_REQUIRED_TOAST, {
        variant: "warning",
        description: `${actionLabel} is unavailable until saved proposals are authenticated.`,
      });
    },
    [showToast],
  );
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const gestureSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const selectedCardRef = React.useRef<HTMLDivElement | null>(null);
  const selectedTitleInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const shouldRevealSelectedCardRef = React.useRef(false);
  const selectedSaveTimeoutRef = React.useRef<number | null>(null);
  const pendingSelectedSavePromiseRef = React.useRef<Promise<void> | null>(
    null,
  );
  const pendingSelectedSaveSnapshotRef = React.useRef<{
    id: string;
    title: string;
    content: string;
    metadata: NonNullable<SavedProposalRecord["metadata"]>;
    token: string;
  } | null>(null);
  const lastPersistedSelectedTokenRef = React.useRef<string | null>(null);
  const selectedAutosavePrimedIdRef = React.useRef<string | null>(null);
  const isSavingSelectedProposalRef = React.useRef(false);

  const selectProposal = React.useCallback(
    (proposal: SavedProposalRecord | null, syncSelection: boolean) => {
      setSelectedId(proposal?._id ?? null);
      setEditTitle(proposal?.title ?? "");
      setEditContent(getProposalDisplayText(proposal));
      setSelectedOutputMode("preview");
      setIsEditingSelectedTitle(false);
      setCopied(false);
      if (syncSelection) {
        onSelectedProposalIdChange?.(proposal?._id ?? null);
      }
    },
    [onSelectedProposalIdChange],
  );
  const handleSelectProposal = React.useCallback(
    (proposal: SavedProposalRecord, syncSelection: boolean) => {
      shouldRevealSelectedCardRef.current = true;
      setSelectionRevealToken((current) => current + 1);
      setIsSwitchingProposal(true);
      startSelectionTransition(() => {
        selectProposal(proposal, syncSelection);
      });
    },
    [selectProposal],
  );

  const applyLocalUpdate = (
    id: string,
    patch: Partial<SavedProposalRecord>,
  ) => {
    setLocalProposals((prev) =>
      prev ? prev.map((p) => (p._id === id ? { ...p, ...patch } : p)) : prev,
    );
  };

  const upsertLocalProposal = React.useCallback(
    (nextProposal: SavedProposalRecord) => {
      setLocalProposals((prev) => {
        if (!prev) return [nextProposal];
        const existingIndex = prev.findIndex(
          (proposal) => proposal._id === nextProposal._id,
        );
        if (existingIndex >= 0) {
          return prev.map((proposal, index) =>
            index === existingIndex
              ? { ...proposal, ...nextProposal }
              : proposal,
          );
        }
        return [nextProposal, ...prev];
      });
    },
    [],
  );

  const removeLocalProposal = (id: string) => {
    setLocalProposals((prev) => {
      const next = prev ? prev.filter((p) => p._id !== id) : prev;
      // Auto-select another proposal after deletion
      if (selectedId === id && next && next.length > 0) {
        selectProposal(next[0], true);
      } else if (selectedId === id) {
        selectProposal(null, true);
      }
      return next;
    });
  };

  React.useEffect(() => {
    if (!proposals) {
      return;
    }

    if (localProposals === null || localProposals.length === 0) {
      setLocalProposals(savedProposals);
    }
  }, [localProposals, proposals, savedProposals]);

  React.useEffect(() => {
    const list = localProposals ?? savedProposals;
    if (!list || list.length === 0) return;

    if (selectedProposalId) {
      const requested = list.find(
        (proposal) => proposal._id === selectedProposalId,
      );
      if (requested) {
        if (requested._id !== selectedId) {
          // Route-driven hydration already has the target saved row; avoid
          // entering the switching skeleton state on reopen.
          selectProposal(requested, false);
        }
        return;
      }

      if (selectedId !== list[0]._id) {
        selectProposal(list[0], false);
      }
      onSelectedProposalIdChange?.(list[0]._id);
      return;
    }

    if (!selectedId) {
      selectProposal(list[0], true);
    }
  }, [
    handleSelectProposal,
    localProposals,
    savedProposals,
    selectedId,
    selectedProposalId,
    selectProposal,
    onSelectedProposalIdChange,
  ]);

  const displayList = localProposals ?? savedProposals;
  const draftProposalCount = displayList.filter(
    (proposal) => proposal.status === "draft",
  ).length;
  const savedProposalCount = displayList.filter(
    (proposal) => proposal.status === "saved",
  ).length;
  const selected = displayList.find((p) => p._id === selectedId) ?? null;
  const resolveSavedProposalRenderState = React.useCallback(
    (proposal: SavedProposalRecord | null) => {
      if (!proposal) return null;

      return resolveProposalRenderState({
        ...getStoredProposalRenderInput(proposal),
        activeCvStylePreset: hasSavedProposalArtifactSnapshot(proposal)
          ? undefined
          : resolveSourceCvStyleForProposal(proposal),
      });
    },
    [resolveSourceCvStyleForProposal],
  );
  const selectedSourceCvId = React.useMemo(
    () => resolveSavedSourceCvId(selected),
    [selected],
  );
  const selectedSourceCvTitle = React.useMemo(() => {
    if (!selectedSourceCvId) {
      return null;
    }

    return getLocalCvDocumentById(selectedSourceCvId)?.title ?? null;
  }, [selectedSourceCvId]);
  const selectedSourceCvStylePreset = React.useMemo(
    () => resolveSourceCvStyleForProposal(selected),
    [resolveSourceCvStyleForProposal, selected],
  );
  const selectedStoredAppearance = React.useMemo(
    () => resolveSavedAppearanceState(selected),
    [selected],
  );
  const selectedStoredRenderState = React.useMemo(() => {
    if (!selected) {
      return null;
    }

    return resolveProposalRenderState({
      ...getStoredProposalRenderInput(selected),
      activeCvStylePreset: hasSavedProposalArtifactSnapshot(selected)
        ? undefined
        : selectedSourceCvStylePreset,
    });
  }, [selected, selectedSourceCvStylePreset]);
  const selectedBaseStylePreset = React.useMemo(() => {
    if (!selected) return null;
    const hasPendingBundleOverride =
      selectedStyleBundleId !== null &&
      selectedStyleBundleId !== selectedStoredAppearance.bundleId;

    if (hasPendingBundleOverride) {
      return getProposalTemplateBundleDefinition(selectedStyleBundleId)
        .stylePreset;
    }
    return selectedStoredRenderState?.stylePreset ?? null;
  }, [
    selected,
    selectedStoredAppearance.bundleId,
    selectedStoredRenderState,
    selectedStyleBundleId,
  ]);
  const selectedEffectiveStylePreset = React.useMemo(() => {
    if (!selectedBaseStylePreset) return null;
    const nextStylePreset = {
      ...selectedBaseStylePreset,
      ...(selectedLayoutOverride
        ? {
            familyId: selectedLayoutOverride,
            layout: selectedLayoutOverride,
          }
        : null),
      ...(selectedTypographyOverride
        ? { typography: selectedTypographyOverride }
        : null),
    };
    if (selectedCustomAccentHex) {
      return resolveVerbatiStyle({
        ...nextStylePreset,
        palette: "custom" as const,
        accentHex: selectedCustomAccentHex,
      });
    }
    if (selectedPaletteOverride) {
      return resolveVerbatiStyle({
        ...nextStylePreset,
        palette: selectedPaletteOverride,
        accentHex: undefined,
      });
    }
    return resolveVerbatiStyle(nextStylePreset);
  }, [
    selectedBaseStylePreset,
    selectedCustomAccentHex,
    selectedLayoutOverride,
    selectedPaletteOverride,
    selectedTypographyOverride,
  ]);
  const selectedHasExplicitStyleEdit = React.useMemo(
    () =>
      selectedStyleBundleId !== selectedStoredAppearance.bundleId ||
      selectedPaletteOverride !== selectedStoredAppearance.paletteOverride ||
      selectedCustomAccentHex !== selectedStoredAppearance.customAccentHex ||
      selectedLayoutOverride !== selectedStoredAppearance.layoutOverride ||
      selectedTypographyOverride !== null,
    [
      selectedCustomAccentHex,
      selectedLayoutOverride,
      selectedPaletteOverride,
      selectedStoredAppearance.bundleId,
      selectedStoredAppearance.customAccentHex,
      selectedStoredAppearance.layoutOverride,
      selectedStoredAppearance.paletteOverride,
      selectedStyleBundleId,
      selectedTypographyOverride,
    ],
  );
  const selectedRenderState = React.useMemo(() => {
    if (!selected) return null;
    return resolveProposalRenderState({
      preferredStylePreset: selectedEffectiveStylePreset ?? undefined,
      preferredTemplateId:
        selectedHasExplicitStyleEdit && selectedEffectiveStylePreset
          ? getProposalTwinTemplateId(selectedEffectiveStylePreset)
          : undefined,
      storedStylePreset: selectedStoredRenderState?.stylePreset,
      storedTemplateId: selectedStoredRenderState?.templateId,
    });
  }, [
    selected,
    selectedEffectiveStylePreset,
    selectedHasExplicitStyleEdit,
    selectedStoredRenderState,
  ]);
  const selectedPersistMetadata = React.useMemo<NonNullable<
    SavedProposalRecord["metadata"]
  > | null>(() => {
    if (!selected || !selectedRenderState) {
      return null;
    }

    const nextMetadata: NonNullable<SavedProposalRecord["metadata"]> = {
      ...(selected.metadata ?? {}),
      sourceCvId: selectedSourceCvId ?? undefined,
    };

    if (selectedHasExplicitStyleEdit) {
      nextMetadata.templateId = selectedRenderState.templateId;
      nextMetadata.verbatiStyle = serializeSavedProposalMetadataVerbatiStyle(
        selectedRenderState.stylePreset,
      );
      nextMetadata.styleLinkMode = "proposal_local";

      if (selectedStyleBundleId) {
        nextMetadata.templateBundleId = selectedStyleBundleId;
      } else {
        delete nextMetadata.templateBundleId;
      }
      const layoutOverride = serializeSavedProposalLayoutOverride(
        selectedLayoutOverride,
      );
      if (layoutOverride) {
        nextMetadata.layoutOverride = layoutOverride;
      } else {
        delete nextMetadata.layoutOverride;
      }
    } else {
      nextMetadata.templateId =
        selected.metadata?.templateId ?? selectedRenderState.templateId;
      nextMetadata.verbatiStyle = serializeSavedProposalMetadataVerbatiStyle(
        selected.metadata?.verbatiStyle ?? selectedRenderState.stylePreset,
      );
      nextMetadata.styleLinkMode =
        selected.metadata?.styleLinkMode ??
        (selectedSourceCvId ? "inherit_cv" : "proposal_local");

      if (selected.metadata?.templateBundleId) {
        nextMetadata.templateBundleId = selected.metadata.templateBundleId;
      } else {
        delete nextMetadata.templateBundleId;
      }
      if (selected.metadata?.layoutOverride) {
        nextMetadata.layoutOverride = selected.metadata.layoutOverride;
      } else {
        delete nextMetadata.layoutOverride;
      }
    }

    const closing = resolveProposalClosingRef({
      closing: selected.metadata?.closing,
      content: editContent,
      proposalType: getStoredProposalType(selected),
      applicantName: buildSavedApplicantHeader(selected)?.name,
      voicePreset: getStoredVoicePreset(selected),
    });
    if (closing) {
      nextMetadata.closing = closing;
    }

    return nextMetadata;
  }, [
    editContent,
    selected,
    selectedHasExplicitStyleEdit,
    selectedLayoutOverride,
    selectedRenderState,
    selectedSourceCvId,
    selectedStyleBundleId,
    selectedTypographyOverride,
  ]);
  const buildSelectedProposalSaveSnapshot = React.useCallback(() => {
    if (!selected || !selectedPersistMetadata) {
      return null;
    }

    const trimmedContent = editContent.trim();
    if (!trimmedContent) {
      return null;
    }

    const normalizedTitle =
      editTitle.trim() || selected.title || "Saved proposal";
    return {
      id: selected._id,
      title: normalizedTitle,
      content: trimmedContent,
      metadata: selectedPersistMetadata,
      token: JSON.stringify({
        id: selected._id,
        title: normalizedTitle,
        content: trimmedContent,
        metadata: selectedPersistMetadata,
      }),
    };
  }, [editContent, editTitle, selected, selectedPersistMetadata]);
  const selectedSaveSnapshot = React.useMemo(
    () => buildSelectedProposalSaveSnapshot(),
    [buildSelectedProposalSaveSnapshot],
  );
  const proposalStack = React.useMemo(() => {
    if (!selected) return displayList;
    return [
      selected,
      ...displayList.filter((proposal) => proposal._id !== selected._id),
    ];
  }, [displayList, selected]);
  const visibleSecondaryProposals = React.useMemo(
    () => proposalStack.slice(1, 1 + visibleSecondaryCount),
    [proposalStack, visibleSecondaryCount],
  );
  const visibleLibraryProposals = React.useMemo(
    () => proposalStack.slice(0, 1 + visibleSecondaryCount),
    [proposalStack, visibleSecondaryCount],
  );
  const hasMoreSecondaryProposals =
    proposalStack.length - 1 > visibleSecondaryCount;
  const isOutputFocused = savedViewMode === "focused";
  const isLibraryOverview = savedViewMode === "library";
  const isMainCardLoading = isSwitchingProposal || isSelectionPending;

  React.useEffect(() => {
    setSelectedStyleBundleId(selectedStoredAppearance.bundleId);
    setSelectedPaletteOverride(selectedStoredAppearance.paletteOverride);
    setSelectedCustomAccentHex(selectedStoredAppearance.customAccentHex);
    setSelectedLayoutOverride(selectedStoredAppearance.layoutOverride);
    setSelectedTypographyOverride(null);
    setSelectedRefineVoicePreset(
      selected
        ? getStoredRequestedVoicePreset(selected)
        : DEFAULT_PROPOSAL_VOICE_PRESET,
    );
  }, [selected, selected?._id, selectedStoredAppearance]);

  React.useEffect(() => {
    setSelectedZoomIndex(1);
  }, [selected?._id]);

  const performSelectedProposalSave = React.useCallback(
    async (
      initialSnapshot: NonNullable<typeof selectedSaveSnapshot>,
      options?: { silent?: boolean },
    ) => {
      if (!isConvexAuthenticated) {
        if (!options?.silent) {
          showConvexAuthRequiredToast("Save");
        }
        return;
      }

      if (
        isSavingSelectedProposalRef.current &&
        pendingSelectedSavePromiseRef.current
      ) {
        pendingSelectedSaveSnapshotRef.current = initialSnapshot;
        return pendingSelectedSavePromiseRef.current;
      }

      const saveLoop = async () => {
        let nextSnapshot: typeof initialSnapshot | null = initialSnapshot;

        while (nextSnapshot) {
          pendingSelectedSaveSnapshotRef.current = null;
          isSavingSelectedProposalRef.current = true;
          setSelectedSaveStatus("saving");
          setIsUpdating(nextSnapshot.id);

          try {
            await updateProposal({
              id: nextSnapshot.id,
              title: nextSnapshot.title,
              content: nextSnapshot.content,
              sections: [{ type: "text", content: nextSnapshot.content }],
              metadata: nextSnapshot.metadata,
            });

            applyLocalUpdate(nextSnapshot.id, {
              title: nextSnapshot.title,
              content: nextSnapshot.content,
              metadata: nextSnapshot.metadata,
            });
            lastPersistedSelectedTokenRef.current = nextSnapshot.token;
            setSelectedSaveStatus("saved");
          } catch (error) {
            console.error("Saved proposal update failed:", error);
            setSelectedSaveStatus("error");
            throw error;
          } finally {
            isSavingSelectedProposalRef.current = false;
            setIsUpdating(null);
          }

          const queuedSnapshot = pendingSelectedSaveSnapshotRef.current as
            | typeof initialSnapshot
            | null;
          nextSnapshot =
            queuedSnapshot &&
            queuedSnapshot.token !== lastPersistedSelectedTokenRef.current
              ? queuedSnapshot
              : null;
        }
      };

      const pendingPromise = saveLoop();
      pendingSelectedSavePromiseRef.current = pendingPromise;

      try {
        await pendingPromise;
      } finally {
        if (pendingSelectedSavePromiseRef.current === pendingPromise) {
          pendingSelectedSavePromiseRef.current = null;
        }
      }
    },
    [
      applyLocalUpdate,
      isConvexAuthenticated,
      showConvexAuthRequiredToast,
      updateProposal,
    ],
  );
  const scheduleSelectedProposalSave = React.useCallback(
    (snapshot: NonNullable<typeof selectedSaveSnapshot>) => {
      if (selectedSaveTimeoutRef.current) {
        window.clearTimeout(selectedSaveTimeoutRef.current);
      }

      pendingSelectedSaveSnapshotRef.current = snapshot;
      setSelectedSaveStatus("saving");
      selectedSaveTimeoutRef.current = window.setTimeout(() => {
        selectedSaveTimeoutRef.current = null;
        const nextSnapshot = pendingSelectedSaveSnapshotRef.current;
        if (!nextSnapshot) {
          return;
        }
        void performSelectedProposalSave(nextSnapshot, { silent: true }).catch(
          () => {},
        );
      }, PROPOSAL_SAVE_DEBOUNCE_MS);
    },
    [performSelectedProposalSave],
  );
  const flushSelectedProposalSave = React.useCallback(async () => {
    if (selectedSaveTimeoutRef.current) {
      window.clearTimeout(selectedSaveTimeoutRef.current);
      selectedSaveTimeoutRef.current = null;
    }

    const snapshot =
      buildSelectedProposalSaveSnapshot() ??
      pendingSelectedSaveSnapshotRef.current;
    if (!snapshot) {
      return;
    }
    if (snapshot.token === lastPersistedSelectedTokenRef.current) {
      if (pendingSelectedSavePromiseRef.current) {
        await pendingSelectedSavePromiseRef.current;
      }
      return;
    }

    pendingSelectedSaveSnapshotRef.current = snapshot;
    await performSelectedProposalSave(snapshot);
  }, [buildSelectedProposalSaveSnapshot, performSelectedProposalSave]);

  React.useEffect(() => {
    return () => {
      if (selectedSaveTimeoutRef.current !== null) {
        window.clearTimeout(selectedSaveTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const nextSelectedId = selected?._id ?? null;
    if (selectedAutosavePrimedIdRef.current !== nextSelectedId) {
      selectedAutosavePrimedIdRef.current = nextSelectedId;
      lastPersistedSelectedTokenRef.current =
        selectedSaveSnapshot?.token ?? null;
      setSelectedSaveStatus("idle");
      return;
    }

    if (!isConvexAuthenticated) {
      setSelectedSaveStatus("idle");
      return;
    }

    if (!selectedSaveSnapshot) {
      if (selectedSaveStatus !== "error") {
        setSelectedSaveStatus("idle");
      }
      return;
    }

    if (selectedSaveSnapshot.token === lastPersistedSelectedTokenRef.current) {
      return;
    }

    scheduleSelectedProposalSave(selectedSaveSnapshot);
  }, [
    isConvexAuthenticated,
    scheduleSelectedProposalSave,
    selected?._id,
    selectedSaveSnapshot,
    selectedSaveStatus,
  ]);

  React.useEffect(() => {
    if (!isSwitchingProposal) return;
    const rafId = window.requestAnimationFrame(() => {
      setIsSwitchingProposal(false);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isSwitchingProposal, selectedId]);

  React.useEffect(() => {
    if (!shouldRevealSelectedCardRef.current) return;
    const target = selectedCardRef.current;
    if (!target) return;

    shouldRevealSelectedCardRef.current = false;
    const rafId = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [selectedId, selectionRevealToken]);

  React.useEffect(() => {
    setVisibleSecondaryCount(SECONDARY_PROPOSAL_PAGE_SIZE);
  }, [selectedId, displayList.length]);

  React.useEffect(() => {
    if (isOutputFocused || !hasMoreSecondaryProposals) return;
    const target = loadMoreSentinelRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setVisibleSecondaryCount((current) =>
          Math.min(
            current + SECONDARY_PROPOSAL_PAGE_SIZE,
            Math.max(0, proposalStack.length - 1),
          ),
        );
      },
      {
        rootMargin: "320px 0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreSecondaryProposals, isOutputFocused, proposalStack.length]);

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mediaQuery = window.matchMedia(MOBILE_SAVED_PROPOSAL_MEDIA_QUERY);
    const syncViewport = () => setIsMobileSavedViewport(mediaQuery.matches);
    syncViewport();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }
    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  React.useEffect(() => {
    if (!isMobileSavedViewport && savedViewMode === "library") {
      setSavedViewMode("stack");
    }
  }, [isMobileSavedViewport, savedViewMode]);

  React.useEffect(() => {
    if (!isMobileSavedViewport) return;
    const surface = gestureSurfaceRef.current;
    if (!surface) return;

    const pinchState = {
      startDistance: 0,
      stepped: false,
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      pinchState.startDistance = getTouchDistance(event.touches);
      pinchState.stepped = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchState.startDistance === 0) return;
      event.preventDefault();
      if (pinchState.stepped) return;
      const currentDistance = getTouchDistance(event.touches);
      if (!currentDistance) return;
      const scale = currentDistance / pinchState.startDistance;

      if (scale <= PINCH_OVERVIEW_THRESHOLD) {
        pinchState.stepped = true;
        setSavedViewMode((current) =>
          stepSavedProposalViewMode(current, "overview"),
        );
      } else if (scale >= PINCH_DETAIL_THRESHOLD) {
        pinchState.stepped = true;
        setSavedViewMode((current) =>
          stepSavedProposalViewMode(current, "detail"),
        );
      }
    };

    const resetPinch = () => {
      pinchState.startDistance = 0;
      pinchState.stepped = false;
    };

    surface.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    surface.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    surface.addEventListener("touchend", resetPinch);
    surface.addEventListener("touchcancel", resetPinch);

    return () => {
      surface.removeEventListener("touchstart", handleTouchStart);
      surface.removeEventListener("touchmove", handleTouchMove);
      surface.removeEventListener("touchend", resetPinch);
      surface.removeEventListener("touchcancel", resetPinch);
    };
  }, [isMobileSavedViewport]);

  async function handleSaveDocument() {
    if (!selected) return;

    try {
      await flushSelectedProposalSave();
      setEditTitle(
        (current) => current.trim() || selected.title || "Saved proposal",
      );
    } catch (err) {
      console.error("Saved proposal save failed:", err);
    }
  }

  React.useEffect(() => {
    if (!isEditingSelectedTitle) return;
    selectedTitleInputRef.current?.focus();
    selectedTitleInputRef.current?.select();
  }, [isEditingSelectedTitle]);

  async function handleRegenerate(
    nextVoicePreset?: ProposalVoicePreset | null,
  ) {
    if (!selected || !selectedRenderState || isRegenerating) return;
    if (!isConvexAuthenticated) {
      showConvexAuthRequiredToast("Refine");
      return;
    }
    setIsRegenerating(selected._id);
    try {
      const activeCvSource = getActiveLocalPersonalizationSource();
      const sourceJobDescription = getStoredRegenerateJobDescription(selected);
      if (!sourceJobDescription) {
        showToast("Job post unavailable.", {
          variant: "warning",
        });
        return;
      }
      const proposalType = getStoredProposalType(selected);
      const voicePreset =
        nextVoicePreset === undefined
          ? getStoredRequestedVoicePreset(selected)
          : nextVoicePreset;
      const jobTitle = resolveRegenerateJobTitle(selected.title, proposalType);
      const payload: RegeneratePayload = {
        jobTitle,
        jobDescription: sourceJobDescription,
        proposalType,
        voicePreset,
        characterLimitMode: selected.metadata?.characterLimitMode,
        characterLimitValue: selected.metadata?.characterLimitValue ?? null,
        ...(selected.metadata?.formalityLevel
          ? { formalityLevel: selected.metadata.formalityLevel }
          : {}),
        ...(selected.metadata?.creativity
          ? { creativity: selected.metadata.creativity }
          : {}),
        modelType: "chatgpt",
        ...buildAppProposalPersonalizationPayload(activeCvSource),
      };
      const res = await generateProposalAction(payload);
      if (!res?.proposalContent) {
        showToast("Nothing refined.", { variant: "warning" });
        return;
      }
      const nextMetadata: NonNullable<SavedProposalRecord["metadata"]> = {
        ...(selected.metadata ?? {}),
        sourceJobDescription,
        proposalType,
        requestedVoicePreset: voicePreset ?? null,
        templateId: selectedRenderState.templateId,
        verbatiStyle: serializeSavedProposalMetadataVerbatiStyle(
          selectedRenderState.stylePreset,
        ),
        requestedModelType: res.requestedModelType,
        actualModelType: res.actualModelType,
        fallbackTriggerCode: res.fallbackTriggerCode,
      };
      if (voicePreset) {
        nextMetadata.voicePreset = voicePreset;
        nextMetadata.resolvedVoicePreset = voicePreset;
      } else {
        delete nextMetadata.voicePreset;
        delete nextMetadata.resolvedVoicePreset;
      }
      const regeneratedClosing = resolveProposalClosingRef({
        closing: selected.metadata?.closing,
        content: res.proposalContent,
        proposalType,
        applicantName: nextMetadata.applicantName,
        voicePreset: voicePreset ?? nextMetadata.resolvedVoicePreset,
      });
      if (regeneratedClosing) {
        nextMetadata.closing = regeneratedClosing;
      }
      if (selectedStyleBundleId) {
        nextMetadata.templateBundleId = selectedStyleBundleId;
      } else {
        delete nextMetadata.templateBundleId;
      }
      const layoutOverride = serializeSavedProposalLayoutOverride(
        selectedLayoutOverride,
      );
      if (layoutOverride) {
        nextMetadata.layoutOverride = layoutOverride;
      } else {
        delete nextMetadata.layoutOverride;
      }
      await updateProposal({
        id: res.proposalId,
        title: jobTitle,
        content: res.proposalContent,
        sections: [{ type: "text", content: res.proposalContent }],
        status: "saved",
        metadata: nextMetadata,
      });
      const regeneratedRecord: SavedProposalRecord = {
        _id: String(res.proposalId),
        _creationTime: Date.now(),
        title: jobTitle,
        content: res.proposalContent,
        metadata: nextMetadata,
      };
      upsertLocalProposal(regeneratedRecord);
      selectProposal(regeneratedRecord, true);
      showToast("Refined.", {
        variant: "success",
        description: "A refreshed saved version is now in Proposal Library.",
      });
    } catch (err) {
      console.error("Regenerate failed:", err);
      showToast("Refine failed.", { variant: "error" });
    } finally {
      setIsRegenerating(null);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!isConvexAuthenticated) {
      showConvexAuthRequiredToast("Delete");
      return;
    }
    try {
      await deleteProposal({ id: selected._id });
      removeLocalProposal(selected._id);
    } catch (err) {
      console.error("Failed to delete proposal:", err);
      showToast("Delete failed.", { variant: "error" });
    }
  }

  const selectedHeaderTitle =
    editTitle.trim() || (selected?.title || "").trim();
  const selectedHeaderMetadataLine = React.useMemo(() => {
    if (!selected) {
      return "";
    }

    return (
      buildProposalMeta(selected, { includeTone: false }) || "Saved proposal"
    );
  }, [selected]);
  const selectedHeaderMeta = React.useMemo(() => {
    if (!selected) {
      return "";
    }

    return selectedHeaderMetadataLine;
  }, [selected, selectedHeaderMetadataLine]);
  const selectedTonePendingRefresh = selected
    ? selectedRefineVoicePreset !== getStoredRequestedVoicePreset(selected)
    : false;
  const selectedToneLabel = selected
    ? toneLabel(getStoredVoicePreset(selected))
    : "";
  const selectedApplicantHeader = React.useMemo(
    () => buildSavedApplicantHeader(selected),
    [selected],
  );
  const selectedHeaderVisibility = React.useMemo(
    () => resolveSavedHeaderVisibility(selected),
    [selected],
  );
  const selectedLayoutValue =
    selectedLayoutOverride ??
    selectedEffectiveStylePreset?.layout ??
    selectedBaseStylePreset?.layout ??
    "swiss";
  const selectedTypographyValue =
    selectedTypographyOverride ??
    selectedEffectiveStylePreset?.typography ??
    selectedBaseStylePreset?.typography ??
    "geist-baskervville";

  const selectedHeaderCard = selected ? (
    <div className="ds-card ds-card--muted dasti-proposal-library-info-card dasti-proposal-library-sidebar__heading">
      <div className="dasti-proposal-library-info-card__stack">
        <div className="dasti-proposal-library-sidebar__eyebrow-row">
          <div className="ds-card__eyebrow dasti-proposal-library-sidebar__eyebrow">
            Proposal Library
          </div>
          <span
            className="dasti-count-pill"
            aria-label={`${draftProposalCount} draft proposals and ${savedProposalCount} saved proposals`}
          >
            {draftProposalCount} draft · {savedProposalCount} saved
          </span>
        </div>
        {selectedOutputMode === "edit" || isEditingSelectedTitle ? (
          <textarea
            ref={selectedTitleInputRef}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            onBlur={() => {
              setIsEditingSelectedTitle(false);
              void handleSaveDocument();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.currentTarget as HTMLTextAreaElement).blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setEditTitle(selected?.title ?? "");
                setIsEditingSelectedTitle(false);
              }
            }}
            placeholder="Saved proposal"
            className="dasti-proposal-sheet__title-input dasti-proposal-library-info-card__title-input"
            aria-label="Proposal title"
            rows={2}
          />
        ) : selectedHeaderTitle ? (
          <h3 className="dasti-proposal-library-info-card__title-heading">
            <button
              type="button"
              className="ds-card__title dasti-proposal-sheet__title dasti-proposal-library-info-card__title dasti-proposal-library-info-card__title-button"
              onClick={() => setIsEditingSelectedTitle(true)}
              aria-label="Rename saved proposal"
            >
              {selectedHeaderTitle}
            </button>
          </h3>
        ) : null}
        <div className="ds-card__footer dasti-proposal-library-info-card__footer">
          {selectedHeaderMetadataLine ? (
            <div className="dasti-proposal-sheet__meta dasti-proposal-library-info-card__details">
              <span className="dasti-proposal-library-info-card__details-line">
                {selectedHeaderMetadataLine}
              </span>
            </div>
          ) : null}
          {selectedToneLabel ? (
            <div className="dasti-proposal-library-sidebar__tone-row">
              <ToneBadge
                tone={toneBadgeTone(
                  selected ? getStoredVoicePreset(selected) : null,
                )}
                className="dasti-proposal-tone-badge"
              >
                {selectedToneLabel}
              </ToneBadge>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;
  const shouldRenderSelectedSidebar = Boolean(
    selectedHeaderCard || savedViewActions,
  );
  const selectedForgeCloneToolbar = selected ? (
    <SavedProposalForgeToolbarPreview
      mode={selectedOutputMode}
      onModeChange={setSelectedOutputMode}
      showZoomControls={
        Boolean(editContent) &&
        selectedOutputMode !== "edit" &&
        (getStoredProposalType(selected) === "cover_letter" ||
          getStoredProposalType(selected) === "application_message" ||
          getStoredProposalType(selected) === "freelance_proposal")
      }
      zoomIndex={selectedZoomIndex}
      onZoomIndexChange={setSelectedZoomIndex}
      onRefine={() => {
        void handleRegenerate(selectedRefineVoicePreset);
      }}
      tonePendingRefresh={selectedTonePendingRefresh}
      onDelete={() => {
        void handleDelete();
      }}
      onCopy={() => {
        void navigator.clipboard.writeText(editContent).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      copyFeedback={copied ? "copied" : "idle"}
      isRegenerating={Boolean(isRegenerating)}
      typographyValue={selectedTypographyValue}
      onTypographyChange={(value) => {
        setSelectedTypographyOverride(
          value === (selectedStoredRenderState?.stylePreset.typography ?? null)
            ? null
            : value,
        );
      }}
      paletteOverride={selectedPaletteOverride}
      onPaletteOverrideChange={(value) => {
        setSelectedCustomAccentHex(null);
        setSelectedPaletteOverride(value);
      }}
      customAccentHex={selectedCustomAccentHex}
      onCustomAccentHexChange={(hex) => {
        setSelectedCustomAccentHex(hex);
        setSelectedPaletteOverride(null);
      }}
      resolvedPaletteId={
        selectedRenderState?.stylePreset.palette === "custom"
          ? null
          : selectedRenderState?.stylePreset.palette ?? null
      }
      layoutValue={selectedLayoutValue}
      onLayoutChange={(value) => {
        setSelectedLayoutOverride(
          value === (selectedStoredRenderState?.stylePreset.layout ?? null)
            ? null
            : value,
        );
      }}
      saveStatus={selectedSaveStatus}
    />
  ) : null;

  if (!isLoaded || isConvexAuthLoading) {
    return (
      <div
        style={{
          padding: "var(--s5)",
          color: "var(--tg2)",
          fontSize: "var(--ts)",
        }}
      >
        Loading…
      </div>
    );
  }
  if (!isSignedIn || !isConvexAuthenticated) {
    return (
      <div
        style={{
          padding: "var(--s5)",
          color: "var(--tg2)",
          fontSize: "var(--ts)",
        }}
      >
        Sign in to view saved proposals.
      </div>
    );
  }
  if (!proposals) {
    return (
      <div
        style={{
          padding: "var(--s5)",
          color: "var(--tg2)",
          fontSize: "var(--ts)",
        }}
      >
        Loading proposals…
      </div>
    );
  }
  if (displayList.length === 0) {
    return (
      <div
        style={{
          padding: "var(--s5)",
          color: "var(--tg2)",
          fontSize: "var(--ts)",
        }}
      >
        No proposals yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        gap: "var(--s3)",
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <div
        ref={gestureSurfaceRef}
        className={[
          "dasti-proposal-library-stack",
          isOutputFocused ? "dasti-proposal-library-stack--focused" : null,
          isLibraryOverview ? "dasti-proposal-library-stack--library" : null,
          isMobileSavedViewport
            ? "dasti-proposal-library-stack--gesture-enabled"
            : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {selected ? (
          isLibraryOverview ? (
            <div className="dasti-proposal-library-overview">
              {visibleLibraryProposals.map((proposal) => {
                const snippet = buildProposalSnippet(proposal.content);
                const isSelectedCard = proposal._id === selected._id;
                const isDraftProposal = proposal.status === "draft";
                const proposalToneLabel = toneLabel(
                  getStoredVoicePreset(proposal),
                );
                const openProposal = () => {
                  if (isDraftProposal && onOpenDraftProposal) {
                    onOpenDraftProposal(String(proposal._id));
                    return;
                  }
                  handleSelectProposal(proposal, true);
                  setSavedViewMode("stack");
                };

                return (
                  <article
                    key={proposal._id}
                    className={[
                      "dasti-doc-card",
                      "ds-card",
                      "dasti-doc-card--library",
                      "dasti-doc-card--proposal-library",
                      isSelectedCard
                        ? "ds-card--elevated dasti-doc-card--selected"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-interactive="true"
                  >
                    <button
                      type="button"
                      className="dasti-doc-card__surface"
                      onClick={openProposal}
                    >
                      <div className="dasti-doc-card__stack">
                        <div className="dasti-doc-card__header">
                          <div className="dasti-doc-card__title-frame dasti-doc-card__title-frame--top">
                            <h3 className="ds-card__title dasti-doc-card__title">
                              {(proposal.title || "").trim() ||
                                (isDraftProposal
                                  ? "Draft proposal"
                                  : "Saved proposal")}
                            </h3>
                            <span className="dasti-count-pill">
                              {isDraftProposal ? "Draft" : "Saved"}
                            </span>
                          </div>
                        </div>
                        <div className="ds-card__content dasti-doc-card__body-band">
                          <p
                            className={
                              snippet
                                ? "dasti-doc-card__snippet dasti-doc-card__snippet--library"
                                : "dasti-doc-card__snippet dasti-doc-card__snippet--library dasti-doc-card__snippet--muted"
                            }
                          >
                            {snippet || "Draft preview appears here."}
                          </p>
                        </div>
                        <div className="ds-card__footer dasti-doc-card__footer dasti-doc-card__footer--stamp-only">
                          <div className="dasti-doc-card__footer-meta">
                            <ToneBadge
                              tone={toneBadgeTone(
                                getStoredVoicePreset(proposal),
                              )}
                              className="dasti-proposal-tone-badge dasti-proposal-tone-badge--compact"
                            >
                              {proposalToneLabel}
                            </ToneBadge>
                            <span>
                              {buildProposalMeta(proposal, {
                                includeTone: false,
                              }) || "Saved proposal"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="dasti-doc-card__quick-actions">
                      <button
                        type="button"
                        className="dasti-doc-card__quick-action"
                        onClick={openProposal}
                      >
                        {isDraftProposal ? "Edit draft" : "Open"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <>
              <div
                className={[
                  "dasti-proposal-library-selected-shell",
                  shouldRenderSelectedSidebar
                    ? "dasti-proposal-library-selected-shell--with-sidebar"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {shouldRenderSelectedSidebar ? (
                  <aside className="dasti-proposal-library-selected-sidebar">
                    {savedViewActions ? (
                      <div className="dasti-proposal-library-sidebar__actions">
                        {savedViewActions}
                      </div>
                    ) : null}
                    {selectedHeaderCard}
                  </aside>
                ) : null}
                <div
                  ref={selectedCardRef}
                  tabIndex={-1}
                  className="ds-card ds-card--elevated dasti-proposal-library-card dasti-proposal-library-card--selected"
                >
                  <ProposalDisplay
                    proposalContent={editContent}
                    loading={isMainCardLoading}
                    error={null}
                    proposalType={getStoredProposalType(selected)}
                    voicePreset={getStoredVoicePreset(selected)}
                    templateId={selectedRenderState?.templateId ?? null}
                    stylePreset={selectedRenderState?.stylePreset ?? null}
                    signatureSettings={signatureSettings}
                    closing={resolveProposalClosingRef({
                      closing: selected?.metadata?.closing,
                      content: editContent,
                      proposalType: selected ? getStoredProposalType(selected) : null,
                      applicantName: selectedApplicantHeader?.name,
                      voicePreset: selected ? getStoredVoicePreset(selected) : null,
                    })}
                    documentDecoration={selected?.metadata?.documentDecoration ?? null}
                    railTitle={resolveProposalHeadingText(
                      selected?.metadata,
                      "applicantName",
                    )}
                    railMeta={resolveProposalHeadingText(
                      selected?.metadata,
                      "applicantRole",
                    )}
                    contactLine={resolveProposalHeadingText(
                      selected?.metadata,
                      "contactLine",
                    )}
                    letterDate={resolveProposalHeadingText(
                      selected?.metadata,
                      "letterDate",
                    )}
                    recipientDetails={resolveProposalHeadingText(
                      selected?.metadata,
                      "recipientDetails",
                    )}
                    applicantHeader={selectedApplicantHeader}
                    headerVisibility={selectedHeaderVisibility}
                    characterLimit={
                      selected?.metadata?.characterLimitValue ?? null
                    }
                    characterLimitAdvisory={false}
                    documentTitle={selectedHeaderTitle || "Saved proposal"}
                    documentMeta={selectedHeaderMeta}
                    showDocumentCaption={false}
                    mode={selectedOutputMode}
                    showModeToggle={false}
                    onModeChange={setSelectedOutputMode}
                    showZoomControls={false}
                    showPreviewParagraphActions={false}
                    zoomIndex={selectedZoomIndex}
                    onZoomIndexChange={setSelectedZoomIndex}
                    previewAnchor="body"
                    detachedActionHeader
                    documentHeaderMode="actions-only"
                    detachedActionHeaderSupplement={selectedForgeCloneToolbar}
                    onContentChange={setEditContent}
                    onContentCommit={() => {
                      void handleSaveDocument();
                    }}
                  />
                </div>
              </div>

              {!isOutputFocused
                ? visibleSecondaryProposals.map((proposal) => {
                    const proposalRenderState =
                      resolveSavedProposalRenderState(proposal);

                    return (
                      <div
                        key={proposal._id}
                        className="ds-card ds-card--muted dasti-proposal-library-card dasti-proposal-library-card--secondary"
                        data-interactive="true"
                        role="button"
                        tabIndex={0}
                        aria-label={`Open saved proposal ${proposal.title ?? ""}`}
                        onClick={() => handleSelectProposal(proposal, true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectProposal(proposal, true);
                          }
                        }}
                      >
                        <ProposalDisplay
                          proposalContent={getProposalDisplayText(proposal)}
                          loading={false}
                          error={null}
                          proposalType={getStoredProposalType(proposal)}
                          voicePreset={getStoredVoicePreset(proposal)}
                          templateId={proposalRenderState?.templateId ?? null}
                          stylePreset={proposalRenderState?.stylePreset ?? null}
                          signatureSettings={signatureSettings}
                          closing={resolveProposalClosingRef({
                            closing: proposal.metadata?.closing,
                            content: getProposalDisplayText(proposal),
                            proposalType: getStoredProposalType(proposal),
                            applicantName: buildSavedApplicantHeader(proposal)?.name,
                            voicePreset: getStoredVoicePreset(proposal),
                          })}
                          documentDecoration={proposal.metadata?.documentDecoration ?? null}
                          railTitle={resolveProposalHeadingText(
                            proposal.metadata,
                            "applicantName",
                          )}
                          railMeta={resolveProposalHeadingText(
                            proposal.metadata,
                            "applicantRole",
                          )}
                          contactLine={resolveProposalHeadingText(
                            proposal.metadata,
                            "contactLine",
                          )}
                          letterDate={resolveProposalHeadingText(
                            proposal.metadata,
                            "letterDate",
                          )}
                          recipientDetails={resolveProposalHeadingText(
                            proposal.metadata,
                            "recipientDetails",
                          )}
                          applicantHeader={buildSavedApplicantHeader(proposal)}
                          headerVisibility={resolveSavedHeaderVisibility(
                            proposal,
                          )}
                          documentTitle={
                            (proposal.title || "").trim() || "Saved proposal"
                          }
                          documentMeta={
                            buildProposalMeta(proposal) || "Saved proposal"
                          }
                          mode="preview"
                          showModeToggle={false}
                          hideDocumentHeader
                          showPreviewParagraphActions={false}
                          showPageCountBadge={false}
                          previewAnchor="body"
                          onPreviewInteract={() =>
                            handleSelectProposal(proposal, true)
                          }
                        />
                      </div>
                    );
                  })
                : null}
            </>
          )
        ) : (
          <p style={{ fontSize: "var(--ts)", color: "var(--tg2)" }}>
            Select a saved proposal to open it.
          </p>
        )}
        {!isOutputFocused && hasMoreSecondaryProposals ? (
          <div
            ref={loadMoreSentinelRef}
            aria-hidden="true"
            style={{ height: 1 }}
          />
        ) : null}
      </div>
    </div>
  );
}
