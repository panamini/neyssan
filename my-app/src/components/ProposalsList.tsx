import React from "react";
import {
  ArrowsOutSimple,
  Check,
  CornersIn,
  RotateCcw,
  SquaresFour,
  Trash,
  X,
} from "@/lib/icons";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useToast } from "./ui/toast";
import ProposalDisplay from "./ProposalDisplay";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  buildAppProposalPersonalizationPayload,
  getActiveLocalPersonalizationSource,
  type ProposalGenerationPersonalizationPayload,
} from "../lib/proposal-personalization";
import { resolveRegeneratedProposalTitle } from "../../convex/lib/proposals/proposalOutput";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  type ProposalCreativityLevel,
  type ProposalFormalityLevel,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import {
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import { formatUiDate } from "../lib/ui-date";
import {
  resolveProposalStoredText,
  type StoredProposalTextSection,
} from "../lib/proposal-output-draft";
import { getVerbatiStyleFromCv } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { resolveProposalRenderState } from "../lib/proposal-render-state";

type SavedProposalType =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

type SavedProposalRecord = {
  _id: string;
  _creationTime: number;
  title?: string;
  content?: string;
  sections?: Array<{
    type?: string;
    content?: string;
  }>;
  metadata?: {
    sourceJobDescription?: string;
    proposalType?: SavedProposalType;
    requestedModelType?: string;
    actualModelType?: string;
    fallbackTriggerCode?: string;
    voicePreset?: ProposalVoicePreset;
    formalityLevel?: ProposalFormalityLevel;
    creativity?: ProposalCreativityLevel;
    templateId?: ProposalTemplateId;
    verbatiStyle?: Partial<VerbatiStylePreset>;
  };
};

type SavedProposalViewMode = "focused" | "stack" | "library";

type RegeneratePayload = {
  jobTitle: string;
  jobDescription: string;
  proposalType: SavedProposalType;
  voicePreset: ProposalVoicePreset;
  formalityLevel?: ProposalFormalityLevel;
  creativity?: ProposalCreativityLevel;
  modelType:
    | "chatgpt"
    | "mistral-small-latest"
    | "mistral-large-latest"
    | "mistral-agent";
} & ProposalGenerationPersonalizationPayload;

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

function buildProposalSnippet(value: unknown): string {
  if (typeof value !== "string") return "";
  const paragraphs = value
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph, index) => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

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
  return proposal.metadata?.voicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET;
}

function getStoredProposalRenderInput(proposal: SavedProposalRecord): {
  storedTemplateId?: ProposalTemplateId;
  storedStylePreset?: Partial<VerbatiStylePreset>;
} {
  return {
    storedTemplateId: proposal.metadata?.templateId,
    storedStylePreset: proposal.metadata?.verbatiStyle,
  };
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

const TONE_UI: Record<string, string> = {
  signature: "Balanced",
  expert: "Formal",
  engaging: "Warm",
};

const MOBILE_SAVED_PROPOSAL_MEDIA_QUERY = "(max-width: 820px)";
const PINCH_OVERVIEW_THRESHOLD = 0.88;
const PINCH_DETAIL_THRESHOLD = 1.12;

function toneLabel(preset: ProposalVoicePreset): string {
  return TONE_UI[preset] ?? preset;
}

function buildProposalMeta(proposal: SavedProposalRecord | null): string {
  if (!proposal) return "";

  const proposalDate = formatUiDate(proposal._creationTime) ?? "";

  return [
    typeLabel(getStoredProposalType(proposal)),
    toneLabel(getStoredVoicePreset(proposal)),
    proposalDate,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildFallbackInfo(proposal: SavedProposalRecord | null) {
  if (!proposal) return null;
  return {
    requestedModelType: proposal.metadata?.requestedModelType,
    actualModelType: proposal.metadata?.actualModelType,
    fallbackTriggerCode: proposal.metadata?.fallbackTriggerCode,
  };
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
}

const SECONDARY_PROPOSAL_PAGE_SIZE = 2;

export default function ProposalsList({
  selectedProposalId = null,
  onSelectedProposalIdChange,
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
  const [selectedOutputMode, setSelectedOutputMode] = React.useState<
    "preview" | "edit"
  >("preview");
  const [copied, setCopied] = React.useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const [savedViewMode, setSavedViewMode] =
    React.useState<SavedProposalViewMode>("stack");
  const [visibleSecondaryCount, setVisibleSecondaryCount] = React.useState(
    SECONDARY_PROPOSAL_PAGE_SIZE,
  );
  const [isSwitchingProposal, setIsSwitchingProposal] = React.useState(false);
  const [isMobileSavedViewport, setIsMobileSavedViewport] =
    React.useState(false);
  const [selectionRevealToken, setSelectionRevealToken] = React.useState(0);
  const [isSelectedCardSpotlit, setIsSelectedCardSpotlit] =
    React.useState(false);
  const [isSelectionPending, startSelectionTransition] = React.useTransition();
  const { showToast } = useToast();
  const activeCvStylePreset = React.useMemo(
    () => (currentCv ? getVerbatiStyleFromCv(currentCv) : null),
    [currentCv],
  );
  const showConvexAuthRequiredToast = React.useCallback(
    (actionLabel: string) => {
      showToast("Sign in required", {
        variant: "warning",
        description: `${actionLabel} is unavailable until saved proposals are authenticated.`,
      });
    },
    [showToast],
  );
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const gestureSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const selectedCardRef = React.useRef<HTMLDivElement | null>(null);
  const shouldRevealSelectedCardRef = React.useRef(false);
  const spotlightTimeoutRef = React.useRef<number | null>(null);

  const selectProposal = React.useCallback(
    (proposal: SavedProposalRecord | null, syncSelection: boolean) => {
      setSelectedId(proposal?._id ?? null);
      setEditTitle(proposal?.title ?? "");
      setEditContent(getProposalDisplayText(proposal));
      setSelectedOutputMode("preview");
      setIsConfirmingDelete(false);
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
      setLocalProposals(proposals);
    }
  }, [localProposals, proposals]);

  React.useEffect(() => {
    const list = localProposals ?? proposals;
    if (!list || list.length === 0) return;

    if (selectedProposalId) {
      const requested = list.find(
        (proposal) => proposal._id === selectedProposalId,
      );
      if (requested) {
        if (requested._id !== selectedId) {
          handleSelectProposal(requested, false);
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
    proposals,
    selectedId,
    selectedProposalId,
    selectProposal,
    onSelectedProposalIdChange,
  ]);

  const displayList = localProposals ?? proposals ?? [];
  const selected = displayList.find((p) => p._id === selectedId) ?? null;
  const resolveSavedProposalRenderState = React.useCallback(
    (proposal: SavedProposalRecord | null) => {
      if (!proposal) return null;

      return resolveProposalRenderState({
        ...getStoredProposalRenderInput(proposal),
        activeCvStylePreset,
      });
    },
    [activeCvStylePreset],
  );
  const selectedRenderState = React.useMemo(
    () => resolveSavedProposalRenderState(selected),
    [resolveSavedProposalRenderState, selected],
  );
  const proposalStack = React.useMemo(() => {
    if (!selected) return [];
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

  const toggleFocusView = React.useCallback(() => {
    setSavedViewMode((current) =>
      current === "focused" ? "stack" : "focused",
    );
  }, []);

  const toggleLibraryOverview = React.useCallback(() => {
    setSavedViewMode((current) =>
      current === "library" ? "stack" : "library",
    );
  }, []);

  React.useEffect(() => {
    if (!isSwitchingProposal) return;
    const rafId = window.requestAnimationFrame(() => {
      setIsSwitchingProposal(false);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isSwitchingProposal, selectedId]);

  React.useEffect(
    () => () => {
      if (spotlightTimeoutRef.current !== null) {
        window.clearTimeout(spotlightTimeoutRef.current);
      }
    },
    [],
  );

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
      target.focus({ preventScroll: true });
      setIsSelectedCardSpotlit(true);
      if (spotlightTimeoutRef.current !== null) {
        window.clearTimeout(spotlightTimeoutRef.current);
      }
      spotlightTimeoutRef.current = window.setTimeout(() => {
        setIsSelectedCardSpotlit(false);
      }, 1400);
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

  async function handleSaveDocument() {
    if (!selected || !selectedRenderState || isUpdating) return;
    if (!isConvexAuthenticated) {
      showConvexAuthRequiredToast("Save");
      return;
    }
    const trimmed = editContent.trim();
    const normalizedTitle =
      editTitle.trim() || selected.title || "Saved proposal";
    const titleChanged = normalizedTitle !== (selected.title ?? "");
    const contentChanged = trimmed !== (selected.content ?? "").trim();
    if (!titleChanged && !contentChanged) return;
    setIsUpdating(selected._id);
    try {
      await updateProposal({
        id: selected._id,
        title: normalizedTitle,
        ...(contentChanged
          ? {
              content: trimmed,
              sections: [{ type: "text", content: trimmed }],
            }
          : {}),
        metadata: {
          templateId: selectedRenderState.templateId,
          verbatiStyle: selectedRenderState.stylePreset,
        },
      });
      setEditTitle(normalizedTitle);
      applyLocalUpdate(selected._id, {
        title: normalizedTitle,
        ...(contentChanged ? { content: trimmed } : {}),
        metadata: {
          ...(selected.metadata ?? {}),
          templateId: selectedRenderState.templateId,
          verbatiStyle: selectedRenderState.stylePreset,
        },
      });
    } catch (err) {
      console.error("Update failed:", err);
      showToast("Update failed", { variant: "error" });
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleRegenerate() {
    if (!selected || !selectedRenderState || isRegenerating) return;
    if (!isConvexAuthenticated) {
      showConvexAuthRequiredToast("Regenerate");
      return;
    }
    setIsRegenerating(selected._id);
    try {
      const activeCvSource = getActiveLocalPersonalizationSource();
      const sourceJobDescription = getStoredRegenerateJobDescription(selected);
      if (!sourceJobDescription) {
        showToast("Original job post is unavailable for this saved proposal.", {
          variant: "warning",
        });
        return;
      }
      const proposalType = getStoredProposalType(selected);
      const voicePreset = getStoredVoicePreset(selected);
      const jobTitle = resolveRegenerateJobTitle(selected.title, proposalType);
      const payload: RegeneratePayload = {
        jobTitle,
        jobDescription: sourceJobDescription,
        proposalType,
        voicePreset,
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
        showToast("Regeneration returned no content", { variant: "warning" });
        return;
      }
      await updateProposal({
        id: res.proposalId,
        title: jobTitle,
        content: res.proposalContent,
        sections: [{ type: "text", content: res.proposalContent }],
        status: "saved",
        metadata: {
          templateId: selectedRenderState.templateId,
          verbatiStyle: selectedRenderState.stylePreset,
        },
      });
      const regeneratedRecord: SavedProposalRecord = {
        _id: String(res.proposalId),
        _creationTime: Date.now(),
        title: jobTitle,
        content: res.proposalContent,
        metadata: {
          ...(selected.metadata ?? {}),
          sourceJobDescription,
          proposalType,
          voicePreset,
          templateId: selectedRenderState.templateId,
          verbatiStyle: selectedRenderState.stylePreset,
          requestedModelType: res.requestedModelType,
          actualModelType: res.actualModelType,
          fallbackTriggerCode: res.fallbackTriggerCode,
        },
      };
      upsertLocalProposal(regeneratedRecord);
      selectProposal(regeneratedRecord, true);
      showToast("Proposal regenerated", {
        variant: "success",
        description: "A refreshed saved version is now in Proposal Library.",
      });
    } catch (err) {
      console.error("Regenerate failed:", err);
      showToast("Regeneration failed", { variant: "error" });
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
      showToast("Failed to delete proposal", { variant: "error" });
    }
  }

  const selectedHeaderTitle =
    editTitle.trim() || (selected?.title || "").trim();
  const selectedHeaderMeta = selected
    ? buildProposalMeta(selected) || "Saved proposal"
    : "";

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
        {isMobileSavedViewport ? (
          <div className="dasti-proposal-library-mobile-controls">
            <button
              type="button"
              title={
                isLibraryOverview
                  ? "Return to proposal stack"
                  : "Open proposal library overview"
              }
              aria-label={
                isLibraryOverview
                  ? "Return to proposal stack"
                  : "Open proposal library overview"
              }
              aria-pressed={isLibraryOverview}
              className={
                isLibraryOverview
                  ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
                  : "dasti-icon-button dasti-proposal-mode-toggle"
              }
              onClick={toggleLibraryOverview}
            >
              <SquaresFour size={16} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              title={
                isOutputFocused
                  ? "Return to card stack"
                  : "Focus selected proposal"
              }
              aria-label={
                isOutputFocused
                  ? "Return to card stack"
                  : "Focus selected proposal"
              }
              aria-pressed={isOutputFocused}
              className={
                isOutputFocused
                  ? "dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--active"
                  : "dasti-icon-button dasti-proposal-mode-toggle"
              }
              onClick={toggleFocusView}
            >
              {isOutputFocused ? (
                <CornersIn size={16} strokeWidth={1.7} />
              ) : (
                <ArrowsOutSimple size={16} strokeWidth={1.7} />
              )}
            </button>
          </div>
        ) : null}
        {selected ? (
          isLibraryOverview ? (
            <div className="dasti-proposal-library-overview">
              {visibleLibraryProposals.map((proposal) => {
                const snippet = buildProposalSnippet(proposal.content);
                const isSelectedCard = proposal._id === selected._id;

                return (
                  <button
                    key={proposal._id}
                    type="button"
                    className={[
                      "dasti-doc-card",
                      "dasti-doc-card--library",
                      "dasti-doc-card--proposal-library",
                      isSelectedCard ? "dasti-doc-card--selected" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      handleSelectProposal(proposal, true);
                      setSavedViewMode("stack");
                    }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame dasti-doc-card__title-frame--top">
                          <h3 className="dasti-doc-card__title">
                            {(proposal.title || "").trim() || "Saved proposal"}
                          </h3>
                        </div>
                      </div>
                      <div className="dasti-doc-card__body-band">
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
                      <div className="dasti-doc-card__footer dasti-doc-card__footer--stamp-only">
                        <div className="dasti-doc-card__footer-meta">
                          <span>
                            {buildProposalMeta(proposal) || "Saved proposal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div
                ref={selectedCardRef}
                tabIndex={-1}
                className={[
                  "dasti-proposal-library-card",
                  isSelectedCardSpotlit
                    ? "dasti-proposal-library-card--spotlit"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ProposalDisplay
                  proposalContent={editContent}
                  loading={isMainCardLoading}
                  error={null}
                  proposalType={getStoredProposalType(selected)}
                  voicePreset={getStoredVoicePreset(selected)}
                  templateId={selectedRenderState?.templateId ?? null}
                  stylePreset={selectedRenderState?.stylePreset ?? null}
                  fallbackInfo={buildFallbackInfo(selected)}
                  documentTitle={selectedHeaderTitle || "Saved proposal"}
                  documentMeta={selectedHeaderMeta}
                  documentTitleEditable={selectedOutputMode === "edit"}
                  onDocumentTitleChange={setEditTitle}
                  onDocumentTitleCommit={() => {
                    void handleSaveDocument();
                  }}
                  documentTitlePlaceholder="Saved proposal"
                  mode={selectedOutputMode}
                  onModeChange={setSelectedOutputMode}
                  showModeToggle
                  showZoomControls
                  zoomStorageKey={null}
                  size="default"
                  onCopy={() => {
                    void navigator.clipboard.writeText(editContent).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  copyFeedback={copied ? "copied" : "idle"}
                  onContentChange={setEditContent}
                  onContentCommit={() => {
                    void handleSaveDocument();
                  }}
                  actions={
                    <span className="dasti-icon-cluster dasti-icon-cluster--tight">
                      <button
                        type="button"
                        title={
                          isRegenerating === selected._id
                            ? "Refreshing…"
                            : "Refresh"
                        }
                        className="dasti-icon-button"
                        style={{
                          opacity: isRegenerating === selected._id ? 0.5 : 1,
                        }}
                        onClick={() => void handleRegenerate()}
                        disabled={Boolean(isRegenerating)}
                      >
                        <RotateCcw size={16} strokeWidth={1.5} />
                      </button>
                      <div className="dasti-icon-cluster__divider" />
                      {!isConfirmingDelete ? (
                        <button
                          type="button"
                          title="Delete"
                          className="dasti-icon-button"
                          onClick={() => setIsConfirmingDelete(true)}
                        >
                          <Trash size={16} strokeWidth={1.5} />
                        </button>
                      ) : (
                        <span className="dasti-icon-cluster">
                          <button
                            type="button"
                            title="Confirm delete"
                            className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--confirm"
                            style={{
                              background: "var(--erb)",
                              color: "var(--ert)",
                            }}
                            onMouseEnter={(e) => {
                              const button =
                                e.currentTarget as HTMLButtonElement;
                              button.style.background = "var(--er)";
                              button.style.color = "var(--op)";
                            }}
                            onMouseLeave={(e) => {
                              const button =
                                e.currentTarget as HTMLButtonElement;
                              button.style.background = "var(--erb)";
                              button.style.color = "var(--ert)";
                            }}
                            onClick={() => {
                              void handleDelete();
                              setIsConfirmingDelete(false);
                            }}
                          >
                            <Check size={12} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            className="dasti-icon-button dasti-icon-button--compact"
                            onClick={() => setIsConfirmingDelete(false)}
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        </span>
                      )}
                    </span>
                  }
                />
              </div>

              {!isOutputFocused
                ? visibleSecondaryProposals.map((proposal) => {
                    const proposalRenderState =
                      resolveSavedProposalRenderState(proposal);

                    return (
                      <div
                        key={proposal._id}
                        className="dasti-proposal-library-card dasti-proposal-library-card--secondary"
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
                          documentTitle={
                            (proposal.title || "").trim() || "Saved proposal"
                          }
                          documentMeta={
                            buildProposalMeta(proposal) || "Saved proposal"
                          }
                          mode="preview"
                          showModeToggle={false}
                          hideDocumentHeader
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
