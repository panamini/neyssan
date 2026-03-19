import React from "react";
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
  signature: "Neutre",
  expert: "Formel",
  engaging: "Chaleureux",
};

function toneLabel(preset: ProposalVoicePreset): string {
  return TONE_UI[preset] ?? preset;
}

/* ── .ib button style ─────────────────────────────────── */
const ibStyle: React.CSSProperties = {
  width: "var(--hs)",
  height: "var(--hs)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--rs)",
  border: "1px solid transparent",
  color: "var(--tm2)",
  background: "transparent",
  cursor: "pointer",
  transition: "all .12s var(--ez)",
};

export default function ProposalsList() {
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
  const { showToast } = useToast();

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
        setSelectedId(next[0]._id);
        setEditTitle(next[0].title ?? "");
        setEditContent(next[0].content ?? "");
      } else if (selectedId === id) {
        setSelectedId(null);
        setEditTitle("");
        setEditContent("");
      }
      return next;
    });
  };

  React.useEffect(() => {
    if (proposals && !localProposals) setLocalProposals(proposals);
  }, [localProposals, proposals]);

  // Auto-select first proposal
  React.useEffect(() => {
    const list = localProposals ?? proposals;
    if (list && list.length > 0 && !selectedId) {
      setSelectedId(list[0]._id);
      setEditTitle(list[0].title ?? "");
      setEditContent(list[0].content ?? "");
    }
  }, [localProposals, proposals, selectedId]);

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
    ? new Date(selected._creationTime).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "";
  const selType = selected ? typeLabel(getStoredProposalType(selected)) : "";
  const selTone = selected ? toneLabel(getStoredVoicePreset(selected)) : "";

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

  async function handleDelete() {
    if (!selected) return;
    if (!confirm("Delete this proposal?")) return;
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
        gridTemplateColumns: "260px 1fr",
        gap: "var(--s5)",
        alignItems: "start",
        minWidth: 0,
      }}
    >
      {/* ── Left panel: .plib-panel — metadata ────────── */}
      <div
        style={{
          padding: "var(--s5)",
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
          Document
        </div>

        {selected ? (
          <>
            {/* .p-title-edit */}
            <textarea
              value={editTitle}
              rows={2}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => void handleSaveTitle()}
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-.02em",
                color: "var(--ti)",
                lineHeight: 1.35,
                border: "none",
                background: "transparent",
                width: "100%",
                outline: "none",
                resize: "none",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                overflow: "hidden",
                fontFamily: '"Fraunces", serif',
              } as React.CSSProperties}
            />

            {/* .p-meta */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)", fontSize: "var(--tx)", color: "var(--tg2)", flexWrap: "wrap", minWidth: 0 }}>
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
          <p style={{ fontSize: "var(--ts)", color: "var(--tg2)" }}>Select a document.</p>
        )}

        {/* Proposal list */}
        {displayList.length > 1 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s1)",
              borderTop: "1px solid var(--bo)",
              paddingTop: "var(--s3)",
            }}
          >
            {displayList.map((p) => {
              const isActive = p._id === selectedId;
              const d = new Date(p._creationTime).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
              return (
                <div
                  key={p._id}
                  onClick={() => { setSelectedId(p._id); setEditTitle(p.title ?? ""); setEditContent(p.content ?? ""); }}
                  style={{
                    padding: "var(--s2) var(--s3)",
                    borderRadius: "var(--rs)",
                    cursor: "pointer",
                    background: isActive ? "var(--as)" : "transparent",
                    border: isActive ? "1px solid var(--ac)" : "1px solid transparent",
                    transition: "all .12s var(--ez)",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--sf2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isActive ? "var(--as)" : "transparent"; }}
                >
                  <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title ?? "Untitled"}</div>
                  <div style={{ fontSize: "var(--tx)", color: "var(--tg2)" }}>{d}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right panel: .plib-panel — content ─────────── */}
      <div
        style={{
          padding: "var(--s5)",
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
            Content
          </div>
          {selected && (
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Copy */}
              <button
                type="button"
                title="Copy"
                style={ibStyle}
                onClick={() => void navigator.clipboard.writeText(selected.content ?? "")}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ti)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--tm2)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="5" y="5" width="9" height="9" rx="2" />
                  <path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                </svg>
              </button>
              {/* Regenerate */}
              <button
                type="button"
                title={isRegenerating === selected._id ? "Regenerating…" : "Regenerate"}
                style={{ ...ibStyle, opacity: isRegenerating === selected._id ? 0.5 : 1 }}
                onClick={() => void handleRegenerate()}
                disabled={Boolean(isRegenerating)}
                onMouseEnter={(e) => { if (!isRegenerating) { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ti)"; } }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--tm2)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 6A6 6 0 1 0 14 9" />
                  <path d="M13.5 2v4h-4" />
                </svg>
              </button>
              {/* Separator */}
              <div style={{ width: 1, height: 16, background: "var(--bo)", margin: "0 2px" }} />
              {/* Delete — danger on hover */}
              <button
                type="button"
                title="Delete"
                style={ibStyle}
                onClick={() => void handleDelete()}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--erb)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ert)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--tm2)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* .p-body */}
        {selected ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={() => void handleSaveContent()}
            placeholder="Content will appear here…"
            style={{
              fontFamily: '"Source Serif 4", serif',
              fontSize: 14,
              lineHeight: 1.82,
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
          <p style={{ fontSize: "var(--ts)", color: "var(--tg2)" }}>Select a document from the left panel.</p>
        )}
      </div>
    </div>
  );
}
