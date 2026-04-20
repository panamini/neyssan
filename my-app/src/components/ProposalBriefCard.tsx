import React from "react";
import { Link } from "react-router-dom";
import { ArrowSquareOut, ChevronDown } from "@/lib/icons";
import { getProposalSourceLabel } from "../lib/proposal-source-platforms";

type ProposalBriefReviewItem = {
  id: string;
  fieldKey: string;
  label: string;
  reviewStatus: string;
  suggestedValue: unknown;
  approvedValue?: unknown;
  sourceText: string;
};

type ProposalBriefLinkedProposal = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
};

type ProposalBriefCardProps = {
  documentTitle: string;
  jobDescription: string;
  onToggleBrief: () => void;
  variant?: "card" | "compact";
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  summaryText?: string | null;
  parseStatus?: string | null;
  trustState?: string | null;
  linkedOutputCount?: number;
  linkedProposals?: ProposalBriefLinkedProposal[];
  reviewItems?: ProposalBriefReviewItem[];
  onApproveReviewItem?: (item: ProposalBriefReviewItem) => Promise<void> | void;
  onSaveReviewItem?: (
    item: ProposalBriefReviewItem,
    nextValue: string | string[],
  ) => Promise<void> | void;
};

function formatReviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }

  return String(value ?? "").trim();
}

function resolveTrustLabel(args: {
  parseStatus?: string | null;
  trustState?: string | null;
}): string | null {
  if (args.trustState === "ready") {
    return "Ready";
  }

  if (args.trustState === "needs_review") {
    return "Needs review";
  }

  if (args.parseStatus === "parsed") {
    return "Parsed";
  }

  if (args.parseStatus === "failed") {
    return "Needs attention";
  }

  if (args.parseStatus === "parsing" || args.trustState === "pending") {
    return "Imported";
  }

  return null;
}

function resolveLinkedProposalHref(proposalId: string): string {
  return `/proposal?view=saved&id=${encodeURIComponent(proposalId)}`;
}

export function ProposalBriefCard({
  documentTitle,
  jobDescription,
  onToggleBrief,
  variant = "card",
  sourceUrl = null,
  sourcePlatform = null,
  summaryText = null,
  parseStatus = null,
  trustState = null,
  linkedOutputCount = 0,
  linkedProposals = [],
  reviewItems = [],
  onApproveReviewItem,
  onSaveReviewItem,
}: ProposalBriefCardProps): JSX.Element {
  const hasSummary = Boolean(jobDescription);
  const isCompact = variant === "compact";
  const sourceLabel = getProposalSourceLabel(sourcePlatform, sourceUrl);
  const trustLabel = resolveTrustLabel({ parseStatus, trustState });
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [draftValues, setDraftValues] = React.useState<Record<string, string>>(
    {},
  );
  const [resolvedItems, setResolvedItems] = React.useState<
    Record<string, { reviewStatus: string; approvedValue?: unknown }>
  >({});

  React.useEffect(() => {
    setEditingItemId(null);
    setDraftValues({});
    setResolvedItems({});
  }, [reviewItems]);

  const visibleReviewItems = reviewItems.map((item) => ({
    ...item,
    reviewStatus: resolvedItems[item.id]?.reviewStatus ?? item.reviewStatus,
    approvedValue: resolvedItems[item.id]?.approvedValue ?? item.approvedValue,
  }));

  return (
    <div
      className={[
        "dasti-proposal-sheet",
        "dasti-brief-card",
        isCompact ? "dasti-brief-card--compact" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "dasti-proposal-sheet__header",
          "dasti-proposal-sheet__header--brief",
          isCompact ? "dasti-proposal-sheet__header--brief-compact" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
          <div className="dasti-proposal-compose-shell__header-row">
            <h2 className="dasti-brief-card__document-title">
              {documentTitle || "Untitled Proposal"}
            </h2>
            <button
              type="button"
              className="dasti-brief-card__dismiss"
              onClick={onToggleBrief}
              aria-label="Expand"
            >
              <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>
          {sourceLabel ? (
            <div className="dasti-brief-card__source-row">
              <span className="dasti-brief-card__source-kicker">From</span>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="dasti-brief-card__source-link"
                  aria-label={`Open original job offer on ${sourceLabel}`}
                >
                  <span className="dasti-brief-card__source-link-label">{sourceLabel}</span>
                  <ArrowSquareOut size={12} strokeWidth={1.8} aria-hidden="true" />
                </a>
              ) : (
                <span className="dasti-brief-card__source-link-label">{sourceLabel}</span>
              )}
            </div>
          ) : null}
          {trustLabel || linkedOutputCount > 0 ? (
            <div className="dasti-brief-card__meta-row">
              {trustLabel ? (
                <span className="dasti-brief-card__pill">{trustLabel}</span>
              ) : null}
              {linkedOutputCount > 0 ? (
                <span className="dasti-brief-card__meta-copy">
                  {linkedOutputCount} linked proposal
                  {linkedOutputCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {hasSummary ? (
        <div className="dasti-brief-card__summary">
          <div className="dasti-brief-card__workspace">
            <div className="dasti-brief-card__review-column">
              {summaryText ? (
                <div className="dasti-brief-card__summary-block">
                  <div className="dasti-brief-card__summary-label">
                    Extracted summary
                  </div>
                  <p className="dasti-brief-card__summary-copy">{summaryText}</p>
                </div>
              ) : null}
              {linkedOutputCount > 0 ? (
                <div className="dasti-brief-card__summary-block">
                  <div className="dasti-brief-card__summary-label">
                    Linked documents
                  </div>
                  <div className="dasti-brief-card__linked-summary">
                    <p className="dasti-brief-card__summary-copy">
                      {linkedOutputCount} linked proposal
                      {linkedOutputCount === 1 ? "" : "s"}
                    </p>
                    {linkedProposals.length > 0 ? (
                      <div className="dasti-brief-card__linked-list">
                        {linkedProposals.map((proposal) => (
                          <Link
                            key={proposal.id}
                            to={resolveLinkedProposalHref(proposal.id)}
                            className="dasti-brief-card__linked-item"
                            aria-label={`Open linked proposal ${proposal.title}`}
                          >
                            <span className="dasti-brief-card__linked-copy">
                              <span className="dasti-brief-card__linked-title">
                                {proposal.title}
                              </span>
                              <span className="dasti-brief-card__linked-meta">
                                {proposal.status}
                              </span>
                            </span>
                            <span className="dasti-brief-card__linked-open">
                              Open
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {visibleReviewItems.length > 0 ? (
                <div className="dasti-brief-card__review-list">
                  {visibleReviewItems.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const currentValue = formatReviewValue(
                      item.approvedValue ?? item.suggestedValue,
                    );
                    const draftValue = draftValues[item.id] ?? currentValue;
                    const isApproved = item.reviewStatus === "approved";

                    return (
                      <div key={item.id} className="dasti-brief-card__review-item">
                        <div className="dasti-brief-card__review-head">
                          <div>
                            <div className="dasti-brief-card__review-label">
                              {item.label}
                            </div>
                            <div className="dasti-brief-card__review-state">
                              {isApproved ? "Approved" : "Needs review"}
                            </div>
                          </div>
                          <div className="dasti-brief-card__review-actions">
                            {!isApproved ? (
                              <button
                                type="button"
                                className="dasti-brief-card__action"
                                onClick={() => {
                                  setResolvedItems((current) => ({
                                    ...current,
                                    [item.id]: {
                                      reviewStatus: "approved",
                                      approvedValue:
                                        item.approvedValue ?? item.suggestedValue,
                                    },
                                  }));
                                  void onApproveReviewItem?.(item);
                                }}
                              >
                                Approve
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="dasti-brief-card__action dasti-brief-card__action--secondary"
                              onClick={() => {
                                setEditingItemId((current) =>
                                  current === item.id ? null : item.id,
                                );
                                setDraftValues((current) => ({
                                  ...current,
                                  [item.id]: current[item.id] ?? currentValue,
                                }));
                              }}
                            >
                              {isEditing ? "Close" : "Edit"}
                            </button>
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="dasti-brief-card__editor">
                            <textarea
                              className="dasti-brief-card__textarea"
                              value={draftValue}
                              onChange={(event) =>
                                setDraftValues((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="dasti-brief-card__action"
                              onClick={() => {
                                const nextValue = Array.isArray(item.suggestedValue)
                                  ? draftValue
                                      .split("\n")
                                      .map((entry) => entry.trim())
                                      .filter(Boolean)
                                  : draftValue.trim();
                                setResolvedItems((current) => ({
                                  ...current,
                                  [item.id]: {
                                    reviewStatus: "approved",
                                    approvedValue: nextValue,
                                  },
                                }));
                                setEditingItemId(null);
                                void onSaveReviewItem?.(item, nextValue);
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ) : null}
                        <div className="dasti-brief-card__review-source">
                          {item.sourceText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {jobDescription ? (
              <aside className="dasti-brief-card__source-dock">
                <div className="dasti-brief-card__summary-label">Raw source</div>
                <p className="dasti-brief-card__description">{jobDescription}</p>
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
