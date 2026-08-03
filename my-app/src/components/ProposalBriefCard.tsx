import React from "react";
import { Link } from "react-router-dom";
import { ArrowSquareOut, ChevronDown, Pencil } from "@/lib/icons";
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
  showHeader?: boolean;
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
const REQUIREMENTS_EDITOR_ID = "__requirements__";
const KEYWORDS_EDITOR_ID = "__keywords__";
const EMPTY_STRINGS: string[] = [];
const EMPTY_REVIEW_ITEMS: ProposalBriefReviewItem[] = [];
const EMPTY_LINKED_PROPOSALS: ProposalBriefLinkedProposal[] = [];

function commitAfterReviewAction(
  action: () => Promise<void> | void,
  onSuccess: () => void,
  isCurrent: () => boolean,
): void {
  try {
    const result = action();
    if (result && typeof result.then === "function") {
      void result
        .then(() => {
          if (isCurrent()) {
            onSuccess();
          }
        })
        .catch(() => {});
      return;
    }
    if (isCurrent()) {
      onSuccess();
    }
  } catch {
    // The parent owns error messaging; keep the local item retryable.
  }
}

function formatReviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join("\n");
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
    return "Review needed";
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

function resolveReviewItemAnchorId(fieldKey: string): string | undefined {
  if (fieldKey === "summary") {
    return "job-summary";
  }
  if (fieldKey === "mustHaves" || fieldKey === "requirements") {
    return "job-requirements";
  }
  if (fieldKey === "keywords") {
    return "job-keywords";
  }
  return undefined;
}

function resolveSectionStatus(
  reviewStatus: string | null | undefined,
  isEdited: boolean,
): "validated" | "uncertain" | "edited" {
  if (isEdited) return "edited";
  const normalized = String(reviewStatus ?? "").toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "needs_review" ||
    normalized.includes("low") ||
    normalized.includes("confidence") ||
    normalized.includes("uncertain") ||
    normalized.includes("warning")
  ) {
    return "uncertain";
  }
  return "validated";
}

function SectionHeader({
  label,
  status,
  isEditing,
  canEdit,
  onToggleEdit,
}: {
  label: string;
  status: "validated" | "uncertain" | "edited";
  isEditing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
}): JSX.Element {
  const statusLabel =
    status === "uncertain"
      ? "Needs your review"
      : status === "edited"
        ? "Edited"
        : "Validated";

  return (
    <div className="dasti-brief-card__section-header">
      <span
        className={`dasti-brief-card__section-status dasti-brief-card__section-status--${status}`}
        title={statusLabel}
        aria-label={statusLabel}
      />
      <div className="ds-card__eyebrow dasti-brief-card__review-label">
        {label}
      </div>
      {canEdit ? (
        <button
          type="button"
          className="dasti-brief-card__section-edit"
          aria-label={isEditing ? `Close ${label} editor` : `Edit ${label}`}
          title={isEditing ? `Close ${label} editor` : `Edit ${label}`}
          onClick={onToggleEdit}
        >
          <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
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
  showHeader = true,
  onToggleBrief,
  variant = "card",
  hideRawSource = false,
  focusMode = false,
  sourceUrl = null,
  sourcePlatform = null,
  summaryText = null,
  visibleSummaryText = null,
  requirements = EMPTY_STRINGS,
  visibleRequirements,
  keywords = EMPTY_STRINGS,
  visibleKeywords,
  extractionUnavailable = false,
  parseStatus = null,
  trustState = null,
  linkedDocumentCount = 0,
  linkedProposals = EMPTY_LINKED_PROPOSALS,
  reviewItems = EMPTY_REVIEW_ITEMS,
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
  const [isPostingOpen, setIsPostingOpen] = React.useState(false);
  const activeJobIdRef = React.useRef(jobId);
  activeJobIdRef.current = jobId;

  React.useEffect(() => {
    setEditingItemId(null);
    setDraftValues({});
    setResolvedItems({});
  }, [jobId, reviewItems, summaryText, visibleSummaryText]);

  const visibleReviewItems = extractionUnavailable
    ? []
    : reviewItems.map((item) => ({
        ...item,
        reviewStatus: resolvedItems[item.id]?.reviewStatus ?? item.reviewStatus,
        approvedValue:
          resolvedItems[item.id]?.approvedValue ?? item.approvedValue,
      }));
  const shouldRenderRawSourceDock = !hideRawSource && Boolean(jobDescription);
  const resolvedCardTitle = resolveProposalBriefCardTitle({
    sourceJobTitle,
    outputDocumentTitle,
  });
  const {
    summaryText: resolvedSummaryText,
    requirements: resolvedRequirements,
    keywords: resolvedKeywords,
  } = extractionUnavailable
    ? {
        summaryText: null,
        requirements: EMPTY_STRINGS,
        keywords: EMPTY_STRINGS,
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
  const visibleReviewFieldKeys = new Set(
    visibleReviewItems.map((item) => String(item.fieldKey ?? "")),
  );
  const hasSummaryReviewItem = visibleReviewFieldKeys.has("summary");
  const hasRequirementsReviewItem =
    visibleReviewFieldKeys.has("mustHaves") ||
    visibleReviewFieldKeys.has("requirements");
  const hasKeywordsReviewItem = visibleReviewFieldKeys.has("keywords");
  const shouldRenderExtractedSummary =
    Boolean(resolvedSummaryText) && !hasSummaryReviewItem;
  const isSummaryEditing = editingItemId === SUMMARY_EDITOR_ID;
  const summaryDraft = draftValues[SUMMARY_EDITOR_ID] ?? summaryValue;
  const isRequirementsEditing = editingItemId === REQUIREMENTS_EDITOR_ID;
  const requirementsValue = resolvedRequirements.join("\n");
  const requirementsDraft =
    draftValues[REQUIREMENTS_EDITOR_ID] ?? requirementsValue;
  const isKeywordsEditing = editingItemId === KEYWORDS_EDITOR_ID;
  const keywordsValue = resolvedKeywords.join("\n");
  const keywordsDraft = draftValues[KEYWORDS_EDITOR_ID] ?? keywordsValue;
  const needsQuickCheck =
    !extractionUnavailable &&
    (trustState === "needs_review" ||
      visibleReviewItems.some((item) => item.reviewStatus === "pending"));

  if (focusMode) {
    return (
      <div
        className="dasti-brief-focus-strip"
        data-testid="proposal-brief-focus-strip"
      >
        {jobId ? (
          <Link
            to={resolveJobHref(jobId)}
            className="dasti-brief-focus-strip__action dasti-brief-focus-strip__action--job"
            aria-label="Back to job"
          >
            Back to job
          </Link>
        ) : null}
        {sourceLabel && sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="dasti-brief-focus-strip__action dasti-brief-focus-strip__action--source"
            aria-label={`Open original job offer on ${sourceLabel}`}
          >
            <span className="dasti-brief-focus-strip__label">
              {sourceLabel}
            </span>
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
      {showHeader || trustLabel || linkedDocumentCount > 0 || onToggleBrief ? (
        <div
          className={[
            "dasti-proposal-sheet__header",
            "dasti-proposal-sheet__header--brief",
            isCompact ? "dasti-proposal-sheet__header--brief-compact" : null,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showHeader ? (
            <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
              <div className="dasti-proposal-compose-shell__header-row">
                <h2 className="dasti-brief-card__document-title">
                  {resolvedCardTitle}
                </h2>
                {onToggleBrief ? (
                  <button
                    type="button"
                    className="dasti-icon-button dasti-brief-card__dismiss"
                    onClick={onToggleBrief}
                    aria-label="Expand"
                  >
                    <ChevronDown
                      size={14}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
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
                      <span className="dasti-brief-card__source-link-label">
                        {sourceLabel}
                      </span>
                      <ArrowSquareOut
                        size={12}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <span className="dasti-brief-card__source-link-label">
                      {sourceLabel}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {trustLabel || linkedDocumentCount > 0 ? (
            <div className="dasti-brief-card__meta-row">
              {trustLabel ? (
                <span className="dasti-brief-card__pill">{trustLabel}</span>
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
      ) : null}
      {hasSummary ? (
        <div className="dasti-brief-card__summary">
          <div className="dasti-brief-card__workspace">
            <div className="dasti-brief-card__review-column">
              {needsQuickCheck ? (
                <div className="ds-card ds-card--muted dasti-brief-card__review-item">
                  <div className="ds-card__eyebrow dasti-brief-card__review-label">
                    Quick check before tailoring
                  </div>
                  <p className="ds-card__body dasti-brief-card__summary-copy">
                    Confirm the highlighted details or edit anything that needs
                    a correction.
                  </p>
                </div>
              ) : null}
              {extractionUnavailable ? (
                <div className="ds-card ds-card--muted dasti-brief-card__review-item dasti-brief-card__review-item--unavailable">
                  <div className="ds-card__eyebrow dasti-brief-card__review-label">
                    EXTRACTION. PAUSED.
                  </div>
                  <p className="ds-card__body dasti-brief-card__summary-copy">
                    Job read is out of order.
                    <br />
                    Posting stays intact.
                  </p>
                </div>
              ) : null}
              {shouldRenderExtractedSummary ? (
                <div
                  className="ds-card dasti-brief-card__review-item"
                  id="job-summary"
                >
                  <SectionHeader
                    label="Summary"
                    status={resolveSectionStatus(trustState, false)}
                    isEditing={isSummaryEditing}
                    canEdit={Boolean(onSaveField)}
                    onToggleEdit={() => {
                      setEditingItemId((current) =>
                        current === SUMMARY_EDITOR_ID
                          ? null
                          : SUMMARY_EDITOR_ID,
                      );
                      setDraftValues((current) => ({
                        ...current,
                        [SUMMARY_EDITOR_ID]:
                          current[SUMMARY_EDITOR_ID] ?? summaryValue,
                      }));
                    }}
                  />
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
                        className="dasti-brief-card__action dasti-button dasti-button--sm dasti-button--pill dasti-button--accent"
                        aria-label="Save summary"
                        onClick={() => {
                          const nextValue = summaryDraft.trim();
                          setEditingItemId(null);
                          void onSaveField?.("summary", nextValue);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="ds-card__body dasti-brief-card__summary-copy">
                      {resolvedSummaryText}
                    </p>
                  )}
                </div>
              ) : null}
              {!extractionUnavailable &&
              (resolvedRequirements.length > 0 || Boolean(onSaveField)) &&
              !hasRequirementsReviewItem ? (
                <div
                  className="ds-card dasti-brief-card__review-item"
                  id="job-requirements"
                >
                  <SectionHeader
                    label="Requirements"
                    status={resolveSectionStatus(trustState, false)}
                    isEditing={isRequirementsEditing}
                    canEdit={Boolean(onSaveField)}
                    onToggleEdit={() => {
                      setEditingItemId((current) =>
                        current === REQUIREMENTS_EDITOR_ID
                          ? null
                          : REQUIREMENTS_EDITOR_ID,
                      );
                      setDraftValues((current) => ({
                        ...current,
                        [REQUIREMENTS_EDITOR_ID]:
                          current[REQUIREMENTS_EDITOR_ID] ?? requirementsValue,
                      }));
                    }}
                  />
                  {isRequirementsEditing ? (
                    <div className="dasti-brief-card__editor">
                      <textarea
                        className="dasti-brief-card__textarea"
                        value={requirementsDraft}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [REQUIREMENTS_EDITOR_ID]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="dasti-brief-card__action dasti-button dasti-button--sm dasti-button--pill dasti-button--accent"
                        aria-label="Save Requirements"
                        onClick={() => {
                          setEditingItemId(null);
                          void onSaveField?.(
                            "mustHaves",
                            formatReviewValueList(requirementsDraft),
                          );
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <ul className="dasti-brief-card__review-bullets">
                      {resolvedRequirements.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
              {!extractionUnavailable &&
              (resolvedKeywords.length > 0 || Boolean(onSaveField)) &&
              !hasKeywordsReviewItem ? (
                <div
                  className="ds-card dasti-brief-card__review-item"
                  id="job-keywords"
                >
                  <SectionHeader
                    label="Keywords"
                    status={resolveSectionStatus(trustState, false)}
                    isEditing={isKeywordsEditing}
                    canEdit={Boolean(onSaveField)}
                    onToggleEdit={() => {
                      setEditingItemId((current) =>
                        current === KEYWORDS_EDITOR_ID
                          ? null
                          : KEYWORDS_EDITOR_ID,
                      );
                      setDraftValues((current) => ({
                        ...current,
                        [KEYWORDS_EDITOR_ID]:
                          current[KEYWORDS_EDITOR_ID] ?? keywordsValue,
                      }));
                    }}
                  />
                  {isKeywordsEditing ? (
                    <div className="dasti-brief-card__editor">
                      <textarea
                        className="dasti-brief-card__textarea"
                        value={keywordsDraft}
                        onChange={(event) =>
                          setDraftValues((current) => ({
                            ...current,
                            [KEYWORDS_EDITOR_ID]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="dasti-brief-card__action dasti-button dasti-button--sm dasti-button--pill dasti-button--accent"
                        aria-label="Save Keywords"
                        onClick={() => {
                          setEditingItemId(null);
                          void onSaveField?.(
                            "keywords",
                            formatReviewValueList(keywordsDraft),
                          );
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="dasti-brief-card__review-chips">
                      {resolvedKeywords.map((entry) => (
                        <span
                          key={entry}
                          className="dasti-brief-card__review-chip"
                        >
                          {entry}
                        </span>
                      ))}
                    </div>
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
                    const isEdited =
                      resolvedItems[item.id]?.reviewStatus === "approved";
                    const sectionStatus = resolveSectionStatus(
                      item.reviewStatus,
                      isEdited,
                    );
                    const fieldKey = String(item.fieldKey ?? "");

                    return (
                      <div
                        key={item.id}
                        id={resolveReviewItemAnchorId(fieldKey)}
                        className="ds-card dasti-brief-card__review-item"
                        data-state={sectionStatus}
                      >
                        <SectionHeader
                          label={item.label}
                          status={sectionStatus}
                          isEditing={isEditing}
                          canEdit={true}
                          onToggleEdit={() => {
                            setEditingItemId((current) =>
                              current === item.id ? null : item.id,
                            );
                            setDraftValues((current) => ({
                              ...current,
                              [item.id]: current[item.id] ?? currentValue,
                            }));
                          }}
                        />
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
                              className="dasti-brief-card__action dasti-button dasti-button--sm dasti-button--pill dasti-button--accent"
                              aria-label={`Save ${item.label}`}
                              onClick={() => {
                                const actionJobId = jobId;
                                const nextValue = Array.isArray(
                                  item.suggestedValue,
                                )
                                  ? draftValue
                                      .split("\n")
                                      .map((entry) => entry.trim())
                                      .filter(Boolean)
                                  : draftValue.trim();
                                commitAfterReviewAction(
                                  () => onSaveReviewItem?.(item, nextValue),
                                  () => {
                                    setResolvedItems((current) => ({
                                      ...current,
                                      [item.id]: {
                                        reviewStatus: "approved",
                                        approvedValue: nextValue,
                                      },
                                    }));
                                    setEditingItemId(null);
                                  },
                                  () => activeJobIdRef.current === actionJobId,
                                );
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ) : null}
                        {fieldKey === "mustHaves" ||
                        fieldKey === "requirements" ? (
                          <ul className="dasti-brief-card__review-bullets">
                            {currentListValue.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        ) : fieldKey === "keywords" ? (
                          <div className="dasti-brief-card__review-chips">
                            {currentListValue.map((entry) => (
                              <span
                                key={entry}
                                className="dasti-brief-card__review-chip"
                              >
                                {entry}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="dasti-brief-card__review-source">
                            {currentValue}
                          </div>
                        )}
                        {item.reviewStatus === "pending" &&
                        onApproveReviewItem &&
                        !isEditing ? (
                          <button
                            type="button"
                            className="dasti-brief-card__action dasti-button dasti-button--sm dasti-button--pill dasti-button--accent"
                            aria-label={`Confirm ${item.label}`}
                            onClick={() => {
                              const actionJobId = jobId;
                              commitAfterReviewAction(
                                () => onApproveReviewItem(item),
                                () => {
                                  setResolvedItems((current) => ({
                                    ...current,
                                    [item.id]: {
                                      reviewStatus: "approved",
                                      approvedValue: item.suggestedValue,
                                    },
                                  }));
                                },
                                () => activeJobIdRef.current === actionJobId,
                              );
                            }}
                          >
                            Confirm
                          </button>
                        ) : null}
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
              <aside
                id="job-posting"
                className="dasti-brief-card__source-dock"
                data-expanded={isPostingOpen ? "true" : "false"}
              >
                <div className="dasti-brief-card__source-dock-head">
                  <div>
                    <div className="dasti-brief-card__summary-label">
                      Imported Posting
                    </div>
                    <p className="dasti-brief-card__source-dock-note">
                      Original text stays intact.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
                    onClick={() => setIsPostingOpen((current) => !current)}
                  >
                    {isPostingOpen ? "Close Posting" : "Open Posting"}
                  </button>
                </div>
                {isPostingOpen ? (
                  <p className="dasti-brief-card__description">
                    {jobDescription}
                  </p>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
