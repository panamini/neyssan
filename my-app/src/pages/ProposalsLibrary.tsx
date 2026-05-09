import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FileText, Plus, X, Check } from "@/lib/icons";
import { LibraryFilterMenu } from "../components/LibraryFilterMenu";
import { Input, ToneBadge, type ToneBadgeTone } from "../components/ui";
import { formatUiDate } from "../lib/ui-date";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import { clearActiveLocalCvId } from "../lib/proposal-personalization";

const PROPOSAL_TONE_FILTER_OPTIONS = [
  { value: "all", label: "All tones", description: "Show every saved tone." },
  {
    value: "engaging",
    label: "Warm",
    tone: "warm",
    description: "Approachable and personal.",
  },
  {
    value: "signature",
    label: "Natural",
    tone: "natural",
    description: "Conversational and credible.",
  },
  {
    value: "expert",
    label: "Formal",
    tone: "formal",
    description: "Composed and measured.",
  },
] as const;

const PROPOSAL_SORT_OPTIONS = [
  {
    value: "newest",
    label: "Newest first",
    description: "Recently saved first.",
  },
  { value: "oldest", label: "Oldest first", description: "Oldest saved first." },
  { value: "title", label: "Title", description: "Alphabetical by title." },
] as const;

function typeLabel(type?: string): string {
  if (type === "cover_letter") return "Letter";
  if (type === "freelance_proposal") return "Proposal";
  if (type === "application_message") return "Message";
  return "Letter";
}

function toneLabel(voicePreset?: string): string {
  return getVoicePresetDisplayLabel(
    voicePreset === "signature" ||
      voicePreset === "expert" ||
      voicePreset === "engaging" ||
      voicePreset === "direct" ||
      voicePreset === "storyteller"
      ? voicePreset
      : undefined,
  );
}

function toneBadgeTone(voicePreset?: string): ToneBadgeTone {
  if (voicePreset === "engaging" || voicePreset === "storyteller") {
    return "warm";
  }
  if (voicePreset === "expert") {
    return "formal";
  }
  return "natural";
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
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const proposals = useQuery(
    api.proposalsPublic.default,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  );
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const [confirmingId, setConfirmingId] =
    React.useState<Id<"proposals"> | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [toneFilter, setToneFilter] = React.useState("all");
  const [sortOrder, setSortOrder] = React.useState<
    "newest" | "oldest" | "title"
  >("newest");
  const statusFilter = React.useMemo(() => {
    const value = new URLSearchParams(location.search).get("status");
    return value === "sent" ? "sent" : "saved";
  }, [location.search]);

  const handleCreateProposal = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", {
      state: createProposalWorkspaceResetState(),
    });
  }, [navigate]);

  const filteredProposals = React.useMemo(() => {
    if (!proposals) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...proposals]
      .filter((proposal) =>
        statusFilter === "sent"
          ? proposal.status === "sent" ||
            proposal.status === "exported" ||
            proposal.status === "submitted"
          : proposal.status === "saved",
      )
      .filter((proposal) => {
        if (
          toneFilter !== "all" &&
          (proposal.metadata?.voicePreset ?? "signature") !== toneFilter
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          proposal.title,
          proposal.content,
          proposal.metadata?.sourceJobDescription,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortOrder === "oldest") {
          return a._creationTime - b._creationTime;
        }
        if (sortOrder === "title") {
          return (a.title ?? "").localeCompare(b.title ?? "");
        }
        return b._creationTime - a._creationTime;
      });
  }, [proposals, searchQuery, sortOrder, statusFilter, toneFilter]);

  const sorted = filteredProposals;
  const proposalCount = React.useMemo(
    () =>
      (proposals ?? []).filter((proposal) =>
        statusFilter === "sent"
          ? proposal.status === "sent" ||
            proposal.status === "exported" ||
            proposal.status === "submitted"
          : proposal.status === "saved",
      ).length,
    [proposals, statusFilter],
  );

  async function handleDelete(id: Id<"proposals">) {
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
      ? "Sign in to view saved cover letters."
      : null;
  const hasActiveLibraryFilters =
    searchQuery.trim().length > 0 || toneFilter !== "all";

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
            <h1 className="dasti-stack__title">All cover letters</h1>
          </div>
          <div className="dasti-page-actions">
            <button
              onClick={handleCreateProposal}
              className="dasti-icon-button dasti-library-create-button"
              aria-label="Create new cover letter"
              title="Create new cover letter"
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

        {!authStatusMessage && proposalCount > 0 && (
          <>
            <div className="dasti-proposal-library-utility-row">
              <label className="dasti-proposal-library-utility-row__search">
                <span className="sr-only">Search all cover letters</span>
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search all cover letters"
                  aria-label="Search all cover letters"
                  className="dasti-proposal-library-utility-row__input"
                />
              </label>
              <LibraryFilterMenu
                label="Filter all cover letters by tone"
                value={toneFilter}
                options={PROPOSAL_TONE_FILTER_OPTIONS}
                onChange={setToneFilter}
              />
              <LibraryFilterMenu
                label="Sort all cover letters"
                value={sortOrder}
                options={PROPOSAL_SORT_OPTIONS}
                onChange={setSortOrder}
              />
              <span className="dasti-proposal-library-utility-row__count">
                {sorted.length === proposalCount
                  ? `${proposalCount} ${statusFilter}`
                  : `${sorted.length} of ${proposalCount}`}
              </span>
            </div>
            {sorted.length === 0 ? (
              <div className="dasti-empty-state">
                <FileText size={32} strokeWidth={1.2} />
                <div className="dasti-empty-state__title">
                  No cover letters match this search
                </div>
                <p className="dasti-empty-state__subtitle">
                  Search checks the title, saved text, and imported job offer.
                </p>
              </div>
            ) : (
              <div className="dasti-grid-auto">
                {sorted.map((p) => {
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
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("view", "saved");
                      params.set("id", String(p._id));
                      void navigate(`/proposal?${params.toString()}`);
                    }}
                    className="ds-card dasti-doc-card dasti-doc-card--library dasti-doc-card--proposal-library"
                    data-interactive="true"
                    style={{ paddingRight: "var(--s6)" }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame dasti-doc-card__title-frame--top">
                          <h2 className="ds-card__title dasti-doc-card__title">
                            {p.title ?? "Untitled"}
                          </h2>
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
                          <span>{label}</span>
                          <span>·</span>
                          <ToneBadge tone={toneBadgeTone(p.metadata?.voicePreset)}>
                            {tone}
                          </ToneBadge>
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
                    <div
                      className="dasti-library-card-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
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
                    </div>
                  )}
                </div>
              );
                })}
              </div>
            )}
          </>
        )}

        {!authStatusMessage &&
        proposals !== undefined &&
        proposalCount === 0 ? (
          <div className="dasti-empty-state">
            <FileText size={32} strokeWidth={1.2} />
            <div className="dasti-empty-state__title">
              {statusFilter === "sent" ? "No sent cover letters yet" : "No cover letters yet"}
            </div>
            <p className="dasti-empty-state__subtitle">
              Generated drafts will appear here with their title, tone, and a readable excerpt.
            </p>
            <button
              onClick={handleCreateProposal}
              className="dasti-button dasti-button--primary dasti-button--pill"
            >
              <Plus size={14} />
              Write your first cover letter
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
