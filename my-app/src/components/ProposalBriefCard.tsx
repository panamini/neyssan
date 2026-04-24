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
  sourceJobTitle?: string | null;
  outputDocumentTitle?: string | null;
  jobId?: string | null;
  jobDescription: string;
  onToggleBrief?: () => void;
  variant?: "card" | "compact";
  hideRawSource?: boolean;
  focusMode?: boolean;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  summaryText?: string | null;
  visibleSummaryText?: string | null;
  requirements?: string[];
  visibleRequirements?: string[];
  keywords?: string[];
  visibleKeywords?: string[];
  extractionUnavailable?: boolean;
  parseStatus?: string | null;
  trustState?: string | null;
  linkedDocumentCount?: number;
  linkedProposals?: ProposalBriefLinkedProposal[];
  reviewItems?: ProposalBriefReviewItem[];
  onSaveField?: (
    fieldKey: string,
    nextValue: string | string[],
  ) => Promise<void> | void;
  onApproveReviewItem?: (item: ProposalBriefReviewItem) => Promise<void> | void;
  onSaveReviewItem?: (
    item: ProposalBriefReviewItem,
    nextValue: string | string[],
  ) => Promise<void> | void;
};

const SUMMARY_EDITOR_ID = "__summary__";

function formatReviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }

  return String(value ?? "").trim();
}

function formatReviewValueList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeComparableText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function resolveTrustLabel(args: {
  parseStatus?: string | null;
  trustState?: string | null;
}): string | null {
  if (args.parseStatus === "failed") {
    return "Needs attention";
  }

  if (args.trustState === "ready") {
    return "Ready";
  }

  if (args.trustState === "needs_review") {
    return "Needs review";
  }

  if (args.parseStatus === "parsed") {
    return "Parsed";
  }

  if (args.parseStatus === "parsing" || args.trustState === "pending") {
    return "Imported";
  }

  return null;
}

function resolveLinkedProposalHref(proposalId: string): string {
  return `/proposal?view=saved&id=${encodeURIComponent(proposalId)}`;
}

function resolveJobHref(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`;
}

export function resolveProposalBriefCardTitle(args: {
  sourceJobTitle?: string | null;
  outputDocumentTitle?: string | null;
}): string {
  return (
    args.outputDocumentTitle?.trim() ||
    args.sourceJobTitle?.trim() ||
    "Untitled Proposal"
  );
}

export function resolveProposalBriefCardDisplayContent(args: {
  summaryText?: string | null;
  visibleSummaryText?: string | null;
  requirements?: string[];
  visibleRequirements?: string[];
  keywords?: string[];
  visibleKeywords?: string[];
}): {
  summaryText: string | null | undefined;
  requirements: string[];
  keywords: string[];
} {
  return {
    summaryText: args.visibleSummaryText ?? args.summaryText,
    requirements: args.visibleRequirements ?? args.requirements ?? [],
    keywords: args.visibleKeywords ?? args.keywords ?? [],
  };
}

export function ProposalBriefCard({
  sourceJobTitle = null,
  outputDocumentTitle = null,
  jobId = null,
  jobDescription,
  onToggleBrief,
  variant = "card",
  hideRawSource = false,
  focusMode = false,
  sourceUrl = null,
  sourcePlatform = null,
  summaryText = null,
  visibleSummaryText = null,
  requirements = [],
  visibleRequirements,
  keywords = [],
  visibleKeywords,
  extractionUnavailable = false,
  parseStatus = null,
  trustState = null,
  linkedDocumentCount = 0,
  linkedProposals = [],
  reviewItems = [],
  onSaveField,
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
  }, [reviewItems, summaryText, visibleSummaryText]);

  const visibleReviewItems = extractionUnavailable
    ? []
    : reviewItems.map((item) => ({
        ...item,
        reviewStatus: resolvedItems[item.id]?.reviewStatus ?? item.reviewStatus,
        approvedValue: resolvedItems[item.id]?.approvedValue ?? item.approvedValue,
      }));
  const shouldRenderRawSourceDock =
    !hideRawSource && Boolean(jobDescription);
  const resolvedCardTitle = resolveProposalBriefCardTitle({
    sourceJobTitle,
    outputDocumentTitle,
  });
  const {
    summaryText: resolvedSummaryText,
  } = extractionUnavailable
    ? {
        summaryText: null,
        requirements: [],
        keywords: [],
      }
    : resolveProposalBriefCardDisplayContent({
        summaryText,
        visibleSummaryText,
        requirements,
        visibleRequirements,
        keywords,
        visibleKeywords,
      });
  const summaryValue = String(resolvedSummaryText ?? "").trim();
  const hasDuplicateSummaryReviewItem =
    summaryValue.length > 0 &&
    visibleReviewItems.some(
      (item) =>
        String(item.fieldKey ?? "") === "summary" &&
        normalizeComparableText(
          formatReviewValue(item.approvedValue ?? item.suggestedValue),
        ) === normalizeComparableText(summaryValue),
    );
  const shouldRenderExtractedSummary =
    Boolean(resolvedSummaryText) && !hasDuplicateSummaryReviewItem;
  const isSummaryEditing = editingItemId === SUMMARY_EDITOR_ID;
  const summaryDraft = draftValues[SUMMARY_EDITOR_ID] ?? summaryValue;

  if (focusMode) {
    return (
      <div
        className="dasti-brief-focus-strip"
        data-testid="proposal-brief-focus-strip"
      >
        {jobId ? (
          <Link
            to={resolveJobHref(jobId)}
            className="dasti-brief-focus-strip__action"
            aria-label="Open job"
          >
            Open job
          </Link>
        ) : null}
        {sourceLabel && sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="dasti-brief-focus-strip__action"
            aria-label={`Open original job offer on ${sourceLabel}`}
          >
            <span className="dasti-brief-focus-strip__label">{sourceLabel}</span>
            <ArrowSquareOut size={12} strokeWidth={1.8} aria-hidden="true" />
          </a>
        ) : null}
        {onToggleBrief ? (
          <button
            type="button"
            className="dasti-brief-focus-strip__expand"
            onClick={onToggleBrief}
            aria-label="Expand"
          >
            <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        "dasti-proposal-sheet",
        "dasti-brief-card",
        isCompact ? null : "dasti-brief-card--card",
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
              {resolvedCardTitle}
            </h2>
            {onToggleBrief ? (
              <button
                type="button"
                className="dasti-brief-card__dismiss"
                onClick={onToggleBrief}
                aria-label="Expand"
              >
                <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
              </button>
            ) : null}
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
          {trustLabel || linkedDocumentCount > 0 ? (
            <div className="dasti-brief-card__meta-row">
              {trustLabel ? (
                <span className="dasti-brief-card__pill">{trustLabel}</span>
              ) : null}
              {trustLabel ? (
                <span className="dasti-brief-card__meta-copy">
                  Review state: {trustLabel}
                </span>
              ) : null}
              {linkedDocumentCount > 0 ? (
                <span className="dasti-brief-card__meta-copy">
                  {linkedDocumentCount} linked document
                  {linkedDocumentCount === 1 ? "" : "s"}
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
              {trustLabel ? (
                <div className="dasti-brief-card__summary-block">
                  <div className="dasti-brief-card__summary-label">
                    Review state
                  </div>
                  <p className="dasti-brief-card__summary-copy">{trustLabel}</p>
                </div>
              ) : null}
              {extractionUnavailable ? (
                <div className="dasti-brief-card__review-item dasti-brief-card__review-item--unavailable">
                  <div className="dasti-brief-card__review-label">
                    EXTRACTION. PAUSED.
                  </div>
                  <p className="dasti-brief-card__summary-copy">
                    Job read is out of order.
                    <br />
                    Raw source stays intact.
                  </p>
                </div>
              ) : null}
              {shouldRenderExtractedSummary ? (
                <div className="dasti-brief-card__review-item">
                  <div className="dasti-brief-card__review-head">
                    <div>
                      <div className="dasti-brief-card__review-label">
                        Extracted summary
                      </div>
                    </div>
                    {onSaveField ? (
                      <div className="dasti-brief-card__review-actions">
                        <button
                          type="button"
                          className="dasti-brief-card__action dasti-brief-card__action--secondary"
                          aria-label={isSummaryEditing ? "Close summary editor" : "Edit summary"}
                          onClick={() => {
                            setEditingItemId((current) =>
                              current === SUMMARY_EDITOR_ID ? null : SUMMARY_EDITOR_ID,
                            );
                            setDraftValues((current) => ({
                              ...current,
                              [SUMMARY_EDITOR_ID]:
                                current[SUMMARY_EDITOR_ID] ?? summaryValue,
                            }));
                          }}
                        >
                          {isSummaryEditing ? "Close" : "Edit"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isSummaryEditing ? (
                    <div className="dasti-brief-card__editor">
                      <textarea
                        className="dasti-brief-card__textarea"
                        value={summaryDraft}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [SUMMARY_EDITOR_ID]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="dasti-brief-card__action"
                        aria-label="Save summary"
                        onClick={() => {
                          const nextValue = summaryDraft.trim();
                          setEditingItemId(null);
                          void onSaveField("summary", nextValue);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="dasti-brief-card__summary-copy">
                      {resolvedSummaryText}
                    </p>
                  )}
                </div>
              ) : null}
              {visibleReviewItems.length > 0 ? (
                <div className="dasti-brief-card__review-list">
                  {visibleReviewItems.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const currentValue = formatReviewValue(
                      item.approvedValue ?? item.suggestedValue,
                    );
                    const currentListValue = formatReviewValueList(
                      item.approvedValue ?? item.suggestedValue,
                    );
                    const draftValue = draftValues[item.id] ?? currentValue;
                    const isApproved = item.reviewStatus === "approved";
                    const fieldKey = String(item.fieldKey ?? "");

                    return (
                      <div
                        key={item.id}
                        className="dasti-brief-card__review-item"
                        data-state={isApproved ? "success" : "warning"}
                      >
                        <div className="dasti-brief-card__review-head">
                          <div>
                            <div className="dasti-brief-card__review-label">
                              {item.label}
                            </div>
                            <div
                              className={[
                                "dasti-brief-card__review-state",
                                "dasti-pill",
                                isApproved
                                  ? "dasti-pill--success"
                                  : "dasti-pill--warning",
                                isApproved
                                  ? "dasti-brief-card__review-state--approved"
                                  : "dasti-brief-card__review-state--pending",
                              ].join(" ")}
                            >
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
                                aria-label={
                                  isEditing ? `Close ${item.label} editor` : `Edit ${item.label}`
                                }
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
                              aria-label={`Save ${item.label}`}
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
                        {fieldKey === "mustHaves" || fieldKey === "requirements" ? (
                          <ul className="dasti-brief-card__review-bullets">
                            {currentListValue.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        ) : fieldKey === "keywords" ? (
                          <div className="dasti-brief-card__review-chips">
                            {currentListValue.map((entry) => (
                              <span key={entry} className="dasti-brief-card__review-chip">
                                {entry}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="dasti-brief-card__review-source">
                            {item.sourceText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {linkedDocumentCount > 0 ? (
                <div className="dasti-brief-card__summary-block">
                  <div className="dasti-brief-card__summary-label">
                    Linked documents
                  </div>
                  <div className="dasti-brief-card__linked-summary">
                    <p className="dasti-brief-card__summary-copy">
                      {linkedDocumentCount} linked document
                      {linkedDocumentCount === 1 ? "" : "s"}
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
            </div>
            {shouldRenderRawSourceDock ? (
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
