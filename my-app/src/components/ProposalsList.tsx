import React from "react";
import { Check, Copy, RotateCcw, Trash2 } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useToast } from "./ui/toast";
import {
  buildAppProposalPersonalizationPayload,
  getActiveLocalPersonalizationSource,
  type ProposalGenerationPersonalizationPayload,
} from "../lib/proposal-personalization";
import { getProposalGenerationFallbackDisclosureMessage } from "../lib/proposal-generation-ui";
import { resolveRegeneratedProposalTitle } from "../../convex/lib/proposals/proposalOutput";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  type ProposalCreativityLevel,
  type ProposalFormalityLevel,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";

type SavedProposalType =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

type SavedProposalRecord = {
  _id: string;
  _creationTime: number;
  title?: string;
  content?: string;
  metadata?: {
    sourceJobDescription?: string;
    proposalType?: SavedProposalType;
    requestedModelType?: string;
    actualModelType?: string;
    fallbackTriggerCode?: string;
    voicePreset?: ProposalVoicePreset;
    formalityLevel?: ProposalFormalityLevel;
    creativity?: ProposalCreativityLevel;
  };
};

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

function inferSavedProposalType(content: string | undefined): SavedProposalType {
  if (!content) return "cover_letter";
  const normalized = content.trim();
  if (!normalized) return "cover_letter";
  if (/(^|\n)\s{0,3}(#|[-*]\s|\d+\.\s)/m.test(normalized)) return "freelance_proposal";
  const lines = normalized.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (/^(dear|hello|hi)\b/i.test(firstLine)) return "cover_letter";
  if (wordCount <= 120) return "application_message";
  return "cover_letter";
}

function resolveRegenerateJobTitle(title: string | undefined, proposalType: SavedProposalType): string {
  return resolveRegeneratedProposalTitle({ currentTitle: title, format: proposalType });
}

function getStoredProposalType(proposal: SavedProposalRecord): SavedProposalType {
  return proposal.metadata?.proposalType ?? inferSavedProposalType(proposal.content);
}

function getStoredRegenerateJobDescription(proposal: SavedProposalRecord): string | null {
  const normalized = proposal.metadata?.sourceJobDescription?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getStoredVoicePreset(proposal: SavedProposalRecord): ProposalVoicePreset {
  return proposal.metadata?.voicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET;
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

function toneLabel(preset: ProposalVoicePreset): string {
  return TONE_UI[preset] ?? preset;
}

interface ProposalsListProps {
  selectedProposalId?: string | null;
  onSelectedProposalIdChange?: (id: string | null) => void;
}

export default function ProposalsList({
  selectedProposalId = null,
  onSelectedProposalIdChange,
}: ProposalsListProps) {
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const { isLoaded, isSignedIn } = useAuth();
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn ? {} : "skip",
  ) as SavedProposalRecord[] | undefined;
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const generateProposalAction = useAction(api.functions.generateProposal as any);
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);

  const [localProposals, setLocalProposals] = React.useState<SavedProposalRecord[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState<string>("");
  const [editContent, setEditContent] = React.useState<string>("");
  const [isRegenerating, setIsRegenerating] = React.useState<string | null>(null);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const { showToast } = useToast();
  const isCompactLibraryLayout = viewportWidth < 1180;
  const libraryPanelPadding = isCompactLibraryLayout ? "var(--s4)" : "var(--s5)";

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const selectProposal = React.useCallback(
    (proposal: SavedProposalRecord | null, syncSelection: boolean) => {
      setSelectedId(proposal?._id ?? null);
      setEditTitle(proposal?.title ?? "");
      setEditContent(proposal?.content ?? "");
      if (syncSelection) {
        onSelectedProposalIdChange?.(proposal?._id ?? null);
      }
    },
    [onSelectedProposalIdChange],
  );

  const applyLocalUpdate = (id: string, patch: Partial<SavedProposalRecord>) => {
    setLocalProposals((prev) =>
      prev ? prev.map((p) => (p._id === id ? { ...p, ...patch } : p)) : prev,
    );
  };

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
    if (proposals && !localProposals) setLocalProposals(proposals);
  }, [localProposals, proposals]);

  React.useEffect(() => {
    const list = localProposals ?? proposals;
    if (!list || list.length === 0) return;

    if (selectedProposalId) {
      const requested = list.find((proposal) => proposal._id === selectedProposalId);
      if (requested) {
        if (requested._id !== selectedId) {
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
  }, [localProposals, proposals, selectedId, selectedProposalId, selectProposal, onSelectedProposalIdChange]);

  const displayList = localProposals ?? proposals ?? [];
  const selected = displayList.find((p) => p._id === selectedId) ?? null;

  if (!isLoaded || !isSignedIn) {
    return (
      <div style={{ padding: "var(--s5)", color: "var(--tg2)", fontSize: "var(--ts)" }}>
        {!isLoaded ? "Loading…" : "Sign in to view saved proposals."}
      </div>
    );
  }
  if (!proposals) {
    return <div style={{ padding: "var(--s5)", color: "var(--tg2)", fontSize: "var(--ts)" }}>Loading proposals…</div>;
  }
  if (displayList.length === 0) {
    return <div style={{ padding: "var(--s5)", color: "var(--tg2)", fontSize: "var(--ts)" }}>No proposals yet.</div>;
  }

  const selDate = selected
    ? new Date(selected._creationTime).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "";
  const selType = selected ? typeLabel(getStoredProposalType(selected)) : "";
  const selTone = selected ? toneLabel(getStoredVoicePreset(selected)) : "";
  const selectedTypography = getProposalDocumentTypography(
    selected ? getStoredVoicePreset(selected) : null,
  );

  async function handleSaveContent() {
    if (!selected || isUpdating) return;
    const trimmed = editContent.trim();
    if (trimmed === (selected.content ?? "").trim()) return;
    setIsUpdating(selected._id);
    try {
      await updateProposal({ id: selected._id, content: trimmed, sections: [{ type: "text", content: trimmed }] });
      applyLocalUpdate(selected._id, { content: trimmed });
    } catch (err) {
      console.error("Update failed:", err);
      showToast("Update failed", { variant: "error" });
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleSaveTitle() {
    if (!selected || isUpdating) return;
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === (selected.title ?? "").trim()) return;
    setIsUpdating(selected._id);
    try {
      await updateProposal({ id: selected._id, title: trimmed });
      applyLocalUpdate(selected._id, { title: trimmed });
    } catch (err) {
      console.error("Title update failed:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleRegenerate() {
    if (!selected || isRegenerating) return;
    setIsRegenerating(selected._id);
    try {
      const activeCvSource = getActiveLocalPersonalizationSource();
      const sourceJobDescription = getStoredRegenerateJobDescription(selected);
      if (!sourceJobDescription) {
        showToast("Original job post is unavailable for this saved proposal.", { variant: "warning" });
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
        ...(selected.metadata?.formalityLevel ? { formalityLevel: selected.metadata.formalityLevel } : {}),
        ...(selected.metadata?.creativity ? { creativity: selected.metadata.creativity } : {}),
        modelType: "chatgpt",
        ...buildAppProposalPersonalizationPayload(activeCvSource),
      };
      const res = await generateProposalAction(payload);
      if (!res?.proposalContent) {
        showToast("Regeneration returned no content", { variant: "warning" });
      }
    } catch (err) {
      console.error("Regenerate failed:", err);
      showToast("Regeneration failed", { variant: "error" });
    } finally {
      setIsRegenerating(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!selected) return;
    setIsConfirmingDelete(false);
    try {
      await deleteProposal({ id: selected._id });
      removeLocalProposal(selected._id);
    } catch (err) {
      console.error("Failed to delete proposal:", err);
      showToast("Failed to delete proposal", { variant: "error" });
    }
  }

  const pSep: React.CSSProperties = {
    width: 3, height: 3, borderRadius: "50%", background: "var(--bm)", flexShrink: 0,
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isCompactLibraryLayout ? "minmax(0,1fr)" : "260px 1fr",
        gap: "var(--s5)",
        alignItems: "start",
        minWidth: 0,
      }}
    >
      {/* ── Left panel: .plib-panel — metadata ────────── */}
      <div
        style={{
          padding: libraryPanelPadding,
          borderRadius: "var(--rl)",
          border: "1px solid var(--bo)",
          background: "var(--sfr)",
          boxShadow: "var(--sha)",
          display: "grid",
          gap: "var(--s4)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Eyebrow */}
        <div style={{ fontSize: "var(--tx)", fontWeight: 600, color: "var(--am)", letterSpacing: ".14em", textTransform: "uppercase" }}>
          Details
        </div>

        {selected ? (
          <>
            {/* .p-title-edit */}
            <textarea
              aria-label="Proposal title"
              value={editTitle}
              rows={2}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => void handleSaveTitle()}
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "var(--tx2)",
                fontWeight: 600,
                letterSpacing: "-.02em",
                color: "var(--ti)",
                lineHeight: 1.22,
                border: "none",
                background: "transparent",
                width: "100%",
                outline: "none",
                resize: "none",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflow: "hidden",
              } as React.CSSProperties}
            />

            {/* .p-meta */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)", fontSize: "var(--tx)", color: "var(--tg2)", flexWrap: "wrap", minWidth: 0, lineHeight: 1.24 }}>
              <span>{selDate}</span>
              <span style={pSep} />
              <span>{selType}</span>
              <span style={pSep} />
              <span>{selTone}</span>
            </div>

            {/* Auto-saved indicator */}
            <span style={{ fontSize: "var(--tx)", color: "var(--ok)" }}>● Auto-saved</span>

            {/* Fallback disclosure */}
            {getProposalGenerationFallbackDisclosureMessage({
              requestedModelType: selected.metadata?.requestedModelType,
              actualModelType: selected.metadata?.actualModelType,
              fallbackTriggerCode: selected.metadata?.fallbackTriggerCode,
            }) ? (
              <p style={{ fontSize: "var(--tx)", color: "var(--tg2)", lineHeight: 1.5 }}>
                {getProposalGenerationFallbackDisclosureMessage({
                  requestedModelType: selected.metadata?.requestedModelType,
                  actualModelType: selected.metadata?.actualModelType,
                  fallbackTriggerCode: selected.metadata?.fallbackTriggerCode,
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ fontSize: "var(--ts)", color: "var(--tg2)" }}>Select a draft.</p>
        )}

      </div>

      {/* ── Right panel: .plib-panel — content ─────────── */}
      <div
        style={{
          padding: libraryPanelPadding,
          borderRadius: "var(--rl)",
          border: "1px solid var(--bo)",
          background: "var(--sfr)",
          boxShadow: "var(--sha)",
          display: "grid",
          gap: "var(--s4)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Header: eyebrow + action icons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "var(--tx)", fontWeight: 600, color: "var(--am)", letterSpacing: ".14em", textTransform: "uppercase" }}>
            Draft
          </div>
          {selected && (
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Copy — feedback "Copied" 1.5s (.cbtn/.cbtn-ok pattern) */}
              <button
                type="button"
                title={copied ? "Copied!" : "Copy"}
                className="dasti-icon-button"
                style={{ color: copied ? "var(--ok)" : undefined }}
                onClick={() => {
                  void navigator.clipboard.writeText(selected.content ?? "").then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check size={14} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.5} />}
              </button>
              {/* Regenerate */}
              <button
                type="button"
                title={isRegenerating === selected._id ? "Regenerating…" : "Regenerate"}
                className="dasti-icon-button"
                style={{ opacity: isRegenerating === selected._id ? 0.5 : 1 }}
                onClick={() => void handleRegenerate()}
                disabled={Boolean(isRegenerating)}
              >
                <RotateCcw size={16} strokeWidth={1.5} />
              </button>
              {/* Separator */}
              <div style={{ width: 1, height: 16, background: "var(--bo)", margin: "0 2px" }} />
              {/* Delete — inline confirmation */}
              {isConfirmingDelete ? (
                <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                  <span className="sb-doc-confirm__label" style={{ fontSize: "var(--tx)" }}>Delete?</span>
                  <button type="button" className="sb-doc-confirm__yes" onClick={() => void handleDeleteConfirm()}>Delete</button>
                  <button type="button" className="sb-doc-confirm__no" onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button
                  type="button"
                  title="Delete"
                  className="dasti-icon-button dasti-icon-button--danger"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* .p-body */}
        {selected ? (
          <textarea
            aria-label="Proposal content"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={() => void handleSaveContent()}
            placeholder="Content will appear here…"
            style={{
              fontFamily: selectedTypography.fontFamily,
              fontSize: selectedTypography.fontSize,
              lineHeight: selectedTypography.lineHeight,
              fontWeight: selectedTypography.fontWeight,
              letterSpacing: selectedTypography.letterSpacing,
              color: "var(--tm2)",
              border: "none",
              background: "transparent",
              width: "100%",
              maxWidth: "100%",
              outline: "none",
              minHeight: 260,
              resize: "vertical",
            }}
          />
        ) : (
          <p style={{ fontSize: "var(--ts)", color: "var(--tg2)" }}>Select a draft from the left panel.</p>
        )}
      </div>
    </div>
  );
}
