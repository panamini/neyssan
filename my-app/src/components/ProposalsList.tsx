import React from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import InlineEditable from "./InlineEditable";
import { Button } from "./ui/button";
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

const PREVIEW_MAX_LENGTH = 180;

function getProposalPreview(content: string | undefined): string {
  if (!content) return "No preview available.";
  const plain = content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "No preview available.";
  if (plain.length <= PREVIEW_MAX_LENGTH) return plain;
  return `${plain.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

function inferSavedProposalType(
  content: string | undefined,
): SavedProposalType {
  if (!content) return "cover_letter";

  const normalized = content.trim();
  if (!normalized) return "cover_letter";

  if (/(^|\n)\s{0,3}(#|[-*]\s|\d+\.\s)/m.test(normalized)) {
    return "freelance_proposal";
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (/^(dear|hello|hi)\b/i.test(firstLine)) {
    return "cover_letter";
  }

  if (wordCount <= 120) {
    return "application_message";
  }

  return "cover_letter";
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

export default function ProposalsList() {
  const { isLoaded, isSignedIn } = useAuth();
  // Use a direct function reference (cast to any to avoid TS issues).
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn ? {} : "skip",
  );
  const deleteProposal = useMutation(
    (api as any).deleteProposalPublic?.default,
  );
  const generateProposalAction = useAction(
    api.functions.generateProposal as any,
  );
  const updateProposal = useMutation(
    (api as any).updateProposalPublic?.default,
  );

  // Local state for optimistic UI updates and editing
  const [localProposals, setLocalProposals] = React.useState<any[] | null>(
    null,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState<string>("");
  const [isRegenerating, setIsRegenerating] = React.useState<string | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const { showToast } = useToast();

  // Helper to apply an updated proposal locally
  const applyLocalUpdate = (id: string, patch: Partial<any>) => {
    setLocalProposals((prev) =>
      prev ? prev.map((p) => (p._id === id ? { ...p, ...patch } : p)) : prev,
    );
  };

  // Log proposals for debugging when the component mounts / updates.
  React.useEffect(() => {
    console.log("ProposalsList - proposals value:", proposals);
    if (proposals && !localProposals) setLocalProposals(proposals);
  }, [localProposals, proposals]);

  // Helper to remove a proposal locally after delete
  const removeLocalProposal = (id: string) => {
    setLocalProposals((prev) =>
      prev ? prev.filter((p) => p._id !== id) : prev,
    );
  };

  if (!isLoaded) return <div>Loading proposals…</div>;
  if (!isSignedIn) return <div>Sign in to view saved proposals.</div>;
  if (!proposals) return <div>Loading proposals…</div>;
  if (proposals.length === 0) return <div>No proposals yet.</div>;

  return (
    <div className="max-w-4xl p-4 mx-auto space-y-4">
      {proposals.map((p: any) => (
        <div key={p._id} className="p-4 border rounded">
          <h3 className="font-semibold">{p.title}</h3>
          <p className="text-sm text-muted">
            {new Date(p.updatedAt).toLocaleString()}
          </p>
          {getProposalGenerationFallbackDisclosureMessage({
            requestedModelType: p.metadata?.requestedModelType,
            actualModelType: p.metadata?.actualModelType,
            fallbackTriggerCode: p.metadata?.fallbackTriggerCode,
          }) ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {getProposalGenerationFallbackDisclosureMessage({
                requestedModelType: p.metadata?.requestedModelType,
                actualModelType: p.metadata?.actualModelType,
                fallbackTriggerCode: p.metadata?.fallbackTriggerCode,
              })}
            </p>
          ) : null}
          <div className="mt-2">
            {editingId === p._id ? (
              <InlineEditable
                value={editingContent}
                onChange={(html) => setEditingContent(html)}
                className="w-full p-0"
                placeholder="Edit proposal..."
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {getProposalPreview(p.content)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              onClick={() => navigator.clipboard.writeText(p.content)}
              size="sm"
              className="flex-1 min-w-[140px] sm:flex-none [background:var(--sfr)] border border-[color:var(--bm)] [color:var(--ti)] hover:[background:var(--sf2)]"
            >
              Copy
            </Button>

            {/* Regenerate */}
            <Button
              onClick={async () => {
                if (isRegenerating) return;
                setIsRegenerating(p._id);
                try {
                  const activeCvSource = getActiveLocalPersonalizationSource();
                  const sourceJobDescription =
                    getStoredRegenerateJobDescription(p);
                  if (!sourceJobDescription) {
                    showToast(
                      "Original job post is unavailable for this saved proposal.",
                      { variant: "warning" },
                    );
                    return;
                  }
                  const proposalType = getStoredProposalType(p);
                  const voicePreset = getStoredVoicePreset(p);
                  const jobTitle = resolveRegenerateJobTitle(
                    p.title,
                    proposalType,
                  );
                  const payload: RegeneratePayload = {
                    jobTitle,
                    jobDescription: sourceJobDescription,
                    proposalType,
                    voicePreset,
                    ...(p.metadata?.formalityLevel
                      ? { formalityLevel: p.metadata.formalityLevel }
                      : {}),
                    ...(p.metadata?.creativity
                      ? { creativity: p.metadata.creativity }
                      : {}),
                    modelType: "chatgpt",
                    ...buildAppProposalPersonalizationPayload(activeCvSource),
                  };
                  // Regenerate from the original saved job-post source instead
                  // of feeding the previous proposal body back into generation.
                  const res = await generateProposalAction(payload);
                  if (res && res.proposalContent) {
                    // Regeneration is create-only. The backend already stores the
                    // regenerated proposal as a new row, so the source snapshot
                    // must remain unchanged.
                  } else {
                    showToast("Regeneration returned no content", {
                      variant: "warning",
                    });
                  }
                } catch (err) {
                  console.error("Regenerate failed:", err);
                  showToast("Regeneration failed", { variant: "error" });
                } finally {
                  setIsRegenerating(null);
                }
              }}
              size="sm"
              className="flex-1 min-w-[140px] sm:flex-none [background:var(--sfr)] border border-[color:var(--bm)] [color:var(--ti)] hover:[background:var(--sf2)]"
            >
              {isRegenerating === p._id ? "Regenerating..." : "Regenerate"}
            </Button>

            {/* Edit (inline editor is shown in the proposal div above) */}
            {editingId === p._id ? (
              <>
                <Button
                  onClick={async () => {
                    if (isUpdating) return;
                    setIsUpdating(p._id);
                    try {
                      await updateProposal({
                        id: p._id,
                        content: editingContent,
                        sections: [{ type: "text", content: editingContent }],
                      });
                      applyLocalUpdate(p._id, {
                        content: editingContent,
                        updatedAt: Date.now(),
                      });
                      setEditingId(null);
                    } catch (err: any) {
                      console.error("Update failed:", err);
                      const msg = err?.message ?? String(err);
                      if (msg.includes("Proposal not found")) {
                        // Proposal deleted while editing — remove locally and inform the user.
                        removeLocalProposal(p._id);
                        showToast(
                          "The proposal you were editing was deleted. It has been removed from the list.",
                          { variant: "warning" },
                        );
                      } else {
                        showToast("Update failed", { variant: "error" });
                      }
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  variant="accent"
                  size="sm"
                  className="flex-1 min-w-[140px] sm:flex-none"
                >
                  {isUpdating === p._id ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setEditingContent(p.content || "");
                  }}
                  variant="secondary"
                  size="sm"
                  className="flex-1 min-w-[140px] sm:flex-none"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setEditingId(p._id);
                  setEditingContent(p.content || "");
                }}
                size="sm"
                className="flex-1 min-w-[140px] sm:flex-none bg-transparent [color:var(--tm2)] hover:[background:var(--sf2)] hover:[color:var(--ti)]"
              >
                Edit
              </Button>
            )}

            <Button
              onClick={async () => {
                if (!confirm("Delete this proposal?")) return;
                try {
                  await deleteProposal({ id: p._id });
                  removeLocalProposal(p._id);
                  console.log("Proposal deleted:", p._id);
                } catch (err) {
                  console.error("Failed to delete proposal:", err);
                  showToast("Failed to delete proposal", { variant: "error" });
                }
              }}
              size="sm"
              className="flex-1 min-w-[140px] sm:flex-none bg-transparent border-transparent [color:var(--tg2)] hover:[color:var(--ert)] hover:[background:var(--erb)] transition-colors duration-[120ms]"
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
