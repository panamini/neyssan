import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { FileText, Plus, X, Check } from "@/lib/icons";
import { formatUiDate } from "../lib/ui-date";

function typeLabel(type?: string): string {
  if (type === "cover_letter") return "Letter";
  if (type === "freelance_proposal") return "Proposal";
  if (type === "application_message") return "Message";
  return "Letter";
}

function toneLabel(voicePreset?: string): string {
  if (voicePreset === "expert") return "Formal";
  if (voicePreset === "engaging") return "Warm";
  return "Balanced";
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

export function ProposalsLibrary(): JSX.Element {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  );
  const deleteProposal = useMutation(
    (api as any).deleteProposalPublic?.default,
  );
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    if (!proposals) return [];
    return [...proposals].sort(
      (a: any, b: any) => b._creationTime - a._creationTime,
    );
  }, [proposals]);

  async function handleDelete(id: string) {
    if (!isConvexAuthenticated || isConvexAuthLoading) {
      setConfirmingId(null);
      return;
    }
    try {
      await deleteProposal({ id });
    } catch {
      /* noop */
    } finally {
      setConfirmingId(null);
    }
  }

  const authStatusMessage = !isLoaded || isConvexAuthLoading
    ? "Loading…"
    : !isSignedIn || !isConvexAuthenticated
      ? "Sign in to view saved proposals."
      : null;

  return (
    <div className="dasti-page-scroll">
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "1100px",
            "--page-shell-gap": "var(--layout-page-stack)",
          } as React.CSSProperties
        }
      >
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <div className="dasti-stack__eyebrow">Write</div>
            <h1 className="dasti-stack__title">All letters & proposals</h1>
          </div>
          <div className="dasti-page-actions">
            <button
              onClick={() => void navigate("/proposal")}
              className="dasti-icon-button dasti-library-create-button"
              aria-label="Create new proposal"
              title="Create new proposal"
            >
              <Plus size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        {authStatusMessage && (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            {authStatusMessage}
          </div>
        )}

        {!authStatusMessage && proposals !== undefined && sorted.length === 0 && (
          <div className="dasti-empty-state">
            <FileText size={32} strokeWidth={1.2} />
            <div className="dasti-empty-state__title">
              No letters or proposals yet
            </div>
            <p className="dasti-empty-state__subtitle">
              Generated drafts will appear here with their title, tone, and a
              readable excerpt.
            </p>
            <button
              onClick={() => void navigate("/proposal")}
              className="dasti-button dasti-button--primary dasti-button--pill"
            >
              <Plus size={14} />
              Write your first letter
            </button>
          </div>
        )}

        {!authStatusMessage && sorted.length > 0 && (
          <div className="dasti-grid-auto">
            {sorted.map((p: any) => {
              const date = formatUiDate(p._creationTime) ?? "";
              const label = typeLabel(p.metadata?.proposalType);
              const tone = toneLabel(p.metadata?.voicePreset);
              const isConfirming = confirmingId === p._id;
              const snippet = buildProposalSnippet(p.content);

              return (
                <div
                  key={p._id}
                  className="card-group"
                  style={{ position: "relative" }}
                  onMouseLeave={() => {
                    if (isConfirming) setConfirmingId(null);
                  }}
                >
                  {/* Main card button */}
                  <button
                    onClick={() =>
                      void navigate(
                        `/proposal?view=saved&id=${encodeURIComponent(p._id)}`,
                      )
                    }
                    className="dasti-doc-card dasti-doc-card--library dasti-doc-card--proposal-library"
                    style={{ paddingRight: "var(--s6)" }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame dasti-doc-card__title-frame--top">
                          <h2 className="dasti-doc-card__title">
                            {p.title ?? "Untitled"}
                          </h2>
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
                          <span>{label}</span>
                          <span>·</span>
                          <span>{tone}</span>
                          <span>·</span>
                          <span className="dasti-doc-card__stamp">{date}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Delete — confirm overlay or X trigger */}
                  {isConfirming ? (
                    <div
                      className="dasti-icon-confirm-tray"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        zIndex: 2,
                      }}
                    >
                      <span className="dasti-icon-confirm-tray__label">
                        Delete?
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(p._id);
                        }}
                        title="Confirm delete"
                        className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--confirm"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingId(null);
                        }}
                        title="Cancel"
                        className="dasti-icon-button dasti-icon-button--compact"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(p._id);
                      }}
                      className="dasti-card-delete-button"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
