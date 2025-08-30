import React from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import InlineEditable from "./InlineEditable";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

export default function ProposalsList() {
  // Use a direct function reference (cast to any to avoid TS issues).
  const proposals = useQuery(api.proposalsPublic.default as any, {});
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const generateProposalAction = useAction(api.functions.generateProposal as any);
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);

  // Local state for optimistic UI updates and editing
  const [localProposals, setLocalProposals] = React.useState<any[] | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState<string>("");
  const [isRegenerating, setIsRegenerating] = React.useState<string | null>(null);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const { showToast } = useToast();

  // Helper to apply an updated proposal locally
  const applyLocalUpdate = (id: string, patch: Partial<any>) => {
    setLocalProposals((prev) =>
      prev ? prev.map((p) => (p._id === id ? { ...p, ...patch } : p)) : prev
    );
  };

  // Log proposals for debugging when the component mounts / updates.
  React.useEffect(() => {
    console.log("ProposalsList - proposals value:", proposals);
    if (proposals && !localProposals) setLocalProposals(proposals);
  }, [proposals]);

  // Helper to remove a proposal locally after delete
  const removeLocalProposal = (id: string) => {
    setLocalProposals((prev) => (prev ? prev.filter((p) => p._id !== id) : prev));
  };

  if (!proposals) return <div>Loading proposals…</div>;
  if (proposals.length === 0) return <div>No proposals yet.</div>;

  return (
    <div className="max-w-4xl p-4 mx-auto space-y-4">
      {proposals.map((p: any) => (
        <div key={p._id} className="p-4 border rounded">
          <h3 className="font-semibold">{p.title}</h3>
          <p className="text-sm text-muted">{new Date(p.updatedAt).toLocaleString()}</p>
          <div className="mt-2 whitespace-pre-wrap">
            {editingId === p._id ? (
              <InlineEditable
                value={editingContent}
                onChange={(html) => setEditingContent(html)}
                className="w-full p-0"
                placeholder="Edit proposal..."
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: p.content }} />
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={() => navigator.clipboard.writeText(p.content)} variant="success" size="sm">
              Copy
            </Button>

            {/* Regenerate */}
            <Button
              onClick={async () =>{
                if (isRegenerating) return;
                setIsRegenerating(p._id);
                try {
                  // Use title + content as inputs for a regeneration attempt
                  const res = await generateProposalAction({
                    jobTitle: p.title || "Untitled",
                    jobDescription: p.content || "",
                    proposalType: "technical",
                    formalityLevel: "neutral",
                    creativity: "medium",
                    modelType: "mistral-small-latest",
                  });
                  if (res && res.proposalContent) {
                    // Update the proposal on the server (optimistic)
                    applyLocalUpdate(p._id, { content: res.proposalContent, updatedAt: Date.now() });
                    try {
                      await updateProposal({
                        id: p._id,
                        content: res.proposalContent,
                        sections: [{ type: "text", content: res.proposalContent }],
                      });
                    } catch (err: any) {
                      console.warn("Failed to persist regenerated proposal:", err);
                      const msg = err?.message ?? String(err);
                      if (msg.includes("Proposal not found")) {
                        // Proposal was removed while regeneration was in-flight — remove it locally and notify the user.
                        removeLocalProposal(p._id);
                        showToast("The proposal was removed while regenerating and has been removed from your list.", { variant: "warning" });
                        // Exit early since there's nothing to persist.
                        setIsRegenerating(null);
                        return;
                      }
                    }
                  } else {
                    showToast("Regeneration returned no content", { variant: "warning" });
                  }
                } catch (err) {
                  console.error("Regenerate failed:", err);
                  showToast("Regeneration failed", { variant: "error" });
                } finally {
                  setIsRegenerating(null);
                }
              }}
              variant="success"
              size="sm"
            >
              {isRegenerating === p._id ? "Regenerating..." : "Regenerate"}</Button>

            {/* Edit (inline editor is shown in the proposal div above) */}
            {editingId === p._id ? (
              <>
                <Button
                  onClick={async () =>{
                    if (isUpdating) return;
                    setIsUpdating(p._id);
                    try {
                      await updateProposal({
                        id: p._id,
                        content: editingContent,
                        sections: [{ type: "text", content: editingContent }],
                      });
                      applyLocalUpdate(p._id, { content: editingContent, updatedAt: Date.now() });
                      setEditingId(null);
                    } catch (err: any) {
                      console.error("Update failed:", err);
                      const msg = err?.message ?? String(err);
                      if (msg.includes("Proposal not found")) {
                        // Proposal deleted while editing — remove locally and inform the user.
                        removeLocalProposal(p._id);
                        showToast("The proposal you were editing was deleted. It has been removed from the list.", { variant: "warning" });
                      } else {
                        showToast("Update failed", { variant: "error" });
                      }
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  variant="accent"
                  size="sm"
                >
                  {isUpdating === p._id ? "Saving..." : "Save"}</Button>
                <Button
                  onClick={() =>{
                    setEditingId(null);
                    setEditingContent(p.content || "");
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Cancel</Button>
              </>
            ) : (
              <Button
                onClick={() =>{
                  setEditingId(p._id);
                  setEditingContent(p.content || "");
                }}
                variant="warning"
                size="sm"
              >
                Edit</Button>
            )}

            <Button
              onClick={async () =>{
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
              variant="danger"
              size="sm"
            >
              Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
