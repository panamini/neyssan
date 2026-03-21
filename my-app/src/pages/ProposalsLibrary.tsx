import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FileText, Plus, X, Check } from "lucide-react";

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
      if (index === 0 && lines.length > 1 && shouldPreserveLeadBreak(lines[0])) {
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
  const proposals = useQuery(api.proposalsPublic.default as any, {});
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    if (!proposals) return [];
    return [...proposals].sort((a: any, b: any) => b._creationTime - a._creationTime);
  }, [proposals]);

  async function handleDelete(id: string) {
    try {
      await deleteProposal({ id });
    } catch {
      /* noop */
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        background: "var(--bg)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "var(--space-page-pad)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-page-stack)",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="dasti-stack">
            <div className="dasti-stack__eyebrow">
              Write
            </div>
            <h1 className="dasti-stack__title">
              All letters & proposals
            </h1>
          </div>
          <button
            onClick={() => void navigate("/proposal")}
            className="dasti-icon-button dasti-library-create-button"
            aria-label="Create new proposal"
            title="Create new proposal"
          >
            <Plus size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {/* Loading */}
        {proposals === undefined && (
          <div style={{ color: "var(--tg2)", fontSize: "var(--ts)", padding: "var(--s5) 0" }}>
            Loading…
          </div>
        )}

        {/* Empty */}
        {proposals !== undefined && sorted.length === 0 && (
          <div className="dasti-empty-state">
            <FileText size={32} strokeWidth={1.2} />
            <div className="dasti-empty-state__title">No letters or proposals yet</div>
            <p className="dasti-empty-state__subtitle">
              Generated drafts will appear here with their title, tone, and a readable excerpt.
            </p>
            <button
              onClick={() => void navigate("/proposal")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s2)",
                height: "var(--hm)",
                padding: "0 var(--s4)",
                borderRadius: "var(--rs)",
                border: "1px solid var(--ac)",
                background: "var(--ac)",
                color: "#fff",
                fontSize: "var(--ts)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s var(--ez)",
                fontFamily: "inherit",
              }}
            >
              <Plus size={14} />
              Write your first letter
            </button>
          </div>
        )}

        {/* Grid */}
        {sorted.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-card-grid)",
            }}
          >
            {sorted.map((p: any) => {
              const date = new Date(p._creationTime).toLocaleDateString("en-US", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              });
              const label = typeLabel(p.metadata?.proposalType);
              const tone = toneLabel(p.metadata?.voicePreset);
              const isConfirming = confirmingId === p._id;
              const snippet = buildProposalSnippet(p.content);

              return (
                <div
                  key={p._id}
                  className="card-group"
                  style={{ position: "relative" }}
                  onMouseLeave={() => { if (isConfirming) setConfirmingId(null); }}
                >
                  {/* Main card button */}
                  <button
                    onClick={() => void navigate(`/proposal?view=saved&id=${encodeURIComponent(p._id)}`)}
                    className="dasti-doc-card dasti-doc-card--library dasti-doc-card--proposal-library"
                    style={{ paddingRight: "var(--s6)" }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame dasti-doc-card__title-frame--top">
                          <h2 className="dasti-doc-card__title">{p.title ?? "Untitled"}</h2>
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
                      <span className="dasti-icon-confirm-tray__label">Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(p._id); }}
                        title="Confirm delete"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, border: "1px solid transparent", borderRadius: "var(--rx)",
                          background: "var(--erb)", cursor: "pointer", color: "var(--ert)", fontFamily: "inherit",
                          transition: "all .1s var(--ez)",
                        }}
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--er)"; b.style.color = "var(--op)"; b.style.borderColor = "transparent"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--erb)"; b.style.color = "var(--ert)"; b.style.borderColor = "transparent"; }}
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                        title="Cancel"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, border: "1px solid transparent", borderRadius: "var(--rx)",
                          background: "transparent", cursor: "pointer", color: "var(--tg2)", fontFamily: "inherit",
                          transition: "all .1s var(--ez)",
                        }}
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--sf2)"; b.style.color = "var(--ti)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingId(p._id); }}
                      className="card-delete-btn"
                      title="Delete"
                      aria-label="Delete"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        zIndex: 1,
                        width: 24,
                        height: 24,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--rs)",
                        border: "1px solid transparent",
                        background: "transparent",
                        color: "var(--tg2)",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "inherit",
                        transition: "background .1s var(--ez), color .1s var(--ez)",
                      }}
                      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--erb)"; b.style.color = "var(--ert)"; }}
                      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; }}
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
