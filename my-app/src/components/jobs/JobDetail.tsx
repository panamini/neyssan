import React from "react";
import { ArrowLeft, ArrowSquareOut, Paperclip, Star } from "@/lib/icons";
import { ProposalBriefCard } from "../ProposalBriefCard";
import { MatchReadBlock } from "./MatchReadBlock";
import LoadingSpinner from "../LoadingSpinner";

type ResumePickerOption = {
  id: string;
  title: string;
  dateLabel: string | null;
};

type JobDetailProps = {
  selectedJobId?: string;
  selectedJobIsLoading: boolean;
  selectedJob: any;
  selectedJobMatchTier?: string | null;
  selectedJobIsFavorite: boolean;
  selectedJobResumeDisplayName: string | null;
  selectedSourceLabel: string | null;
  isMobileJobsLayout: boolean;
  isResumePickerOpen: boolean;
  resumePickerRef: React.RefObject<HTMLDivElement>;
  resumePickerOptions: ResumePickerOption[];
  canTailorResume: boolean;
  canUseFullSourceCv: boolean;
  tailoringUnavailableReason: string | null;
  tailoringActionPending: boolean;
  tailoringActionError: string | null;
  proposalActionDisabled: boolean;
  tailoringPanel?: React.ReactNode;
  handoffPanel?: React.ReactNode;
  debugPanels?: React.ReactNode;
  onBackToJobs: () => void;
  onSetJobFavorite: (jobId: string, nextFavorite: boolean) => void;
  onOpenJobSource: (sourceUrl: string) => void;
  onToggleResumePicker: () => void;
  onAttachResumeToJob: (resumeId: string) => void;
  onDetachResumeFromJob: () => void;
  onCreateProposal: (jobId: string) => void;
  onTailorResume: () => void;
  onUseFullSourceCv: () => void;
  onDismissJob: (jobId: string) => void;
  onRefreshSelectedJobMatch: () => void;
  onSaveField: (fieldKey: string, nextValue: string | string[]) => void;
  onApproveReviewItem: (item: any) => void;
  onSaveReviewItem: (item: any, nextValue: string | string[]) => void;
};

const JOB_ACTION_GROUP_STYLE: React.CSSProperties = {
  inlineSize: "100%",
  maxInlineSize: "100%",
  minInlineSize: "0px",
  boxSizing: "border-box",
};

const JOB_ACTION_CONTROL_STYLE: React.CSSProperties = {
  maxInlineSize: "100%",
  boxSizing: "border-box",
};

function resolveLocationModeLabel(value: string): string {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return "Location unavailable";
  }
  const locationParts = normalizedValue
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/\b\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago\b/i.test(
          part,
        ) &&
        !/\b\d+\s+people\s+clicked\s+apply\b/i.test(part) &&
        !/\b\d+\s+applicants?\b/i.test(part),
    );
  return locationParts.join(" · ") || normalizedValue;
}

function formatJobTitle(value: string): string {
  return (
    String(value ?? "")
      .trim()
      .replace(/[:\s]+$/, "") || "Untitled job"
  );
}

function resolveDetailStatusLabel(args: {
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

function formatLinkedDocumentCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return `${count} linked document${count === 1 ? "" : "s"}`;
}

function resolveCompensationLabel(job: any): string | null {
  const candidateValues = [
    job?.hourlyRate,
    job?.hourlySalary,
    job?.salaryHourly,
    job?.compensation,
    job?.salary,
    job?.payRange,
    job?.rate,
  ];
  const value = candidateValues
    .map((candidate) => String(candidate ?? "").trim())
    .find(Boolean);

  return value ?? null;
}

export function JobDetail({
  selectedJobId,
  selectedJobIsLoading,
  selectedJob,
  selectedJobIsFavorite,
  selectedJobResumeDisplayName,
  selectedSourceLabel,
  isMobileJobsLayout,
  isResumePickerOpen,
  resumePickerRef,
  resumePickerOptions,
  canTailorResume,
  canUseFullSourceCv,
  tailoringUnavailableReason,
  tailoringActionPending,
  tailoringActionError,
  proposalActionDisabled,
  tailoringPanel,
  handoffPanel,
  debugPanels,
  onBackToJobs,
  onSetJobFavorite,
  onOpenJobSource,
  onToggleResumePicker,
  onAttachResumeToJob,
  onDetachResumeFromJob,
  onCreateProposal,
  onTailorResume,
  onUseFullSourceCv,
  onDismissJob,
  onRefreshSelectedJobMatch,
  onSaveField,
  onApproveReviewItem,
  onSaveReviewItem,
}: JobDetailProps): JSX.Element | null {
  if (!selectedJobId) {
    return null;
  }

  if (selectedJobIsLoading) {
    return (
      <div
        className="dasti-empty-state dasti-empty-state--panel"
        role="status"
        aria-live="polite"
      >
        <div className="dasti-empty-state__title">Loading job</div>
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedJob) {
    return (
      <div className="dasti-empty-state dasti-empty-state--panel">
        <div className="dasti-empty-state__title">Job unavailable</div>
        <p className="dasti-empty-state__subtitle">
          Could not load this job. Open another.
        </p>
      </div>
    );
  }

  const selectedJobTitle = formatJobTitle(selectedJob.title);
  const detailStatusLabel = resolveDetailStatusLabel({
    parseStatus: selectedJob.parseStatus,
    trustState: selectedJob.reviewState,
  });
  const linkedDocumentLabel = formatLinkedDocumentCount(
    Number(selectedJob.linkedProposalCount ?? 0),
  );
  const compensationLabel = resolveCompensationLabel(selectedJob);

  return (
    <div className="dasti-jobs-detail">
      {isMobileJobsLayout ? (
        <div className="dasti-jobs-detail__mobile-back">
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--sm"
            onClick={onBackToJobs}
          >
            <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
            Back to jobs
          </button>
        </div>
      ) : null}
      <div className="dasti-jobs-detail__topline">
        <div className="dasti-jobs-detail__identity">
          <div className="dasti-jobs-detail__title">
            <span>{selectedJobTitle}</span>
            {selectedJob.isSample ? (
              <span className="dasti-jobs-sample-badge">Sample</span>
            ) : null}
          </div>
          <div className="dasti-jobs-detail__meta">
            <span>{selectedJob.company || "Unknown company"}</span>
            {compensationLabel ? (
              <>
                <span>·</span>
                <span>{compensationLabel}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{resolveLocationModeLabel(selectedJob.location)}</span>
            {selectedSourceLabel ? (
              <>
                <span>·</span>
                {selectedJob.sourceUrl ? (
                  <button
                    type="button"
                    className="dasti-jobs-detail__source-action"
                    aria-label={`Open original job offer on ${selectedSourceLabel}`}
                    title={`Open original job offer on ${selectedSourceLabel}`}
                    onClick={() => onOpenJobSource(selectedJob.sourceUrl)}
                  >
                    <span>Source</span>
                    <ArrowSquareOut
                      size={13}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <span>Source</span>
                )}
              </>
            ) : null}
          </div>
          <div className="dasti-jobs-detail__action-row">
            <button
              type="button"
              className="dasti-jobs-detail__meta-favorite-action"
              aria-pressed={selectedJobIsFavorite}
              aria-label="Favorite"
              title="Favorite"
              onClick={() => {
                onSetJobFavorite(selectedJob.id, !selectedJobIsFavorite);
              }}
            >
              <Star
                size={13}
                strokeWidth={1.8}
                weight={selectedJobIsFavorite ? "fill" : "regular"}
                aria-hidden="true"
              />
            </button>
            <div
              className="dasti-jobs-detail__header-actions"
              aria-label="Job actions"
              style={JOB_ACTION_GROUP_STYLE}
            >
              <div
                ref={resumePickerRef}
                className="dasti-jobs-detail__resume-picker dasti-jobs-detail__header-resume"
                style={JOB_ACTION_CONTROL_STYLE}
              >
                <button
                  type="button"
                  className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--resume"
                  style={JOB_ACTION_CONTROL_STYLE}
                  aria-controls={`job-resume-picker-${selectedJob.id}`}
                  aria-expanded={isResumePickerOpen}
                  aria-haspopup="dialog"
                  aria-label={
                    selectedJobResumeDisplayName
                      ? `Attached resume: ${selectedJobResumeDisplayName}`
                      : "Attach resume"
                  }
                  title={
                    selectedJobResumeDisplayName
                      ? `Attached resume: ${selectedJobResumeDisplayName}`
                      : "Attach resume"
                  }
                  onClick={onToggleResumePicker}
                >
                  <Paperclip size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span>{selectedJobResumeDisplayName ?? "Attach resume"}</span>
                </button>
                {isResumePickerOpen ? (
                  <div
                    id={`job-resume-picker-${selectedJob.id}`}
                    role="dialog"
                    aria-label="Attach resume"
                    className="dasti-jobs-detail__resume-popover dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
                  >
                    {selectedJobResumeDisplayName ? (
                      <button
                        type="button"
                        className="dasti-jobs-detail__resume-option dasti-jobs-detail__resume-option--detach dasti-proposal-chrome-option"
                        onClick={onDetachResumeFromJob}
                      >
                        <span className="dasti-jobs-detail__resume-option-title">
                          Remove attached resume
                        </span>
                      </button>
                    ) : null}
                    {resumePickerOptions.length === 0 ? (
                      <div className="dasti-jobs-detail__resume-empty">
                        No resumes yet. Create one in CvForge.
                      </div>
                    ) : (
                      <div className="dasti-jobs-detail__resume-popover-list">
                        {resumePickerOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={[
                              "dasti-jobs-detail__resume-option",
                              "dasti-proposal-chrome-option",
                              option.id === selectedJob.resumeId
                                ? "dasti-jobs-detail__resume-option--active dasti-proposal-chrome-option--active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={`Attach ${option.title}`}
                            onClick={() => onAttachResumeToJob(option.id)}
                          >
                            <span className="dasti-jobs-detail__resume-option-title">
                              {option.title}
                            </span>
                            {option.dateLabel ? (
                              <span className="dasti-jobs-detail__resume-option-meta">
                                {option.dateLabel}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--tailor"
                style={JOB_ACTION_CONTROL_STYLE}
                aria-describedby={
                  tailoringUnavailableReason
                    ? `job-tailoring-help-${selectedJob.id}`
                    : undefined
                }
                disabled={!canTailorResume}
                onClick={onTailorResume}
              >
                <span>
                  {tailoringActionPending
                    ? "Preparing…"
                    : "Tailor resume"}
                </span>
              </button>
              <button
                type="button"
                className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--full-resume"
                style={JOB_ACTION_CONTROL_STYLE}
                aria-label="Use my complete resume without tailoring"
                aria-describedby={
                  tailoringUnavailableReason
                    ? `job-tailoring-help-${selectedJob.id}`
                    : undefined
                }
                disabled={!canUseFullSourceCv}
                onClick={onUseFullSourceCv}
              >
                <span>Use my complete resume without tailoring</span>
              </button>
              <button
                type="button"
                className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--proposal"
                style={JOB_ACTION_CONTROL_STYLE}
                disabled={proposalActionDisabled}
                onClick={() => onCreateProposal(selectedJob.id)}
              >
                <span>Generate proposal</span>
              </button>
              <button
                type="button"
                className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--skip"
                style={JOB_ACTION_CONTROL_STYLE}
                aria-label="Skip and archive job"
                onClick={() => onDismissJob(selectedJob.id)}
              >
                <span>Skip</span>
              </button>
            </div>
            {tailoringUnavailableReason ? (
              <p
                id={`job-tailoring-help-${selectedJob.id}`}
                className="dasti-jobs-detail__tailoring-help"
              >
                {tailoringUnavailableReason}
              </p>
            ) : null}
            {tailoringActionError ? (
              <p
                className="dasti-jobs-detail__tailoring-error"
                role="alert"
              >
                {tailoringActionError}
              </p>
            ) : null}
            {detailStatusLabel || linkedDocumentLabel ? (
              <div className="dasti-jobs-detail__status-line">
                {detailStatusLabel ? <span>{detailStatusLabel}</span> : null}
                {detailStatusLabel && linkedDocumentLabel ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                {linkedDocumentLabel ? (
                  <span>{linkedDocumentLabel}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="dasti-jobs-detail__body">
        {selectedJob.matchRead ? (
          <MatchReadBlock
            matchRead={selectedJob.matchRead}
            matchReview={selectedJob.matchReview}
            visibleRequirements={selectedJob.visibleRequirements}
            jobTitle={selectedJob.title}
            jobCompany={selectedJob.company}
            jobLocation={selectedJob.location}
            onRefreshMatch={onRefreshSelectedJobMatch}
          />
        ) : null}
        {tailoringPanel}
        {handoffPanel}
        <div className="dasti-jobs-detail__content">
          <ProposalBriefCard
            sourceJobTitle={selectedJobTitle}
            outputDocumentTitle={null}
            jobDescription={selectedJob.rawDescription}
            showHeader={false}
            sourceUrl={selectedJob.sourceUrl}
            sourcePlatform={selectedJob.sourceType}
            summaryText={selectedJob.summary}
            visibleSummaryText={selectedJob.visibleSummary}
            requirements={selectedJob.mustHaves}
            visibleRequirements={selectedJob.visibleRequirements}
            keywords={selectedJob.keywords}
            visibleKeywords={selectedJob.visibleKeywords}
            extractionUnavailable={
              selectedJob.parseStatus === "failed" ||
              selectedJob.visibleExtractionSource === "empty"
            }
            parseStatus={selectedJob.parseStatus}
            trustState={selectedJob.reviewState}
            linkedDocumentCount={selectedJob.linkedProposalCount}
            linkedProposals={selectedJob.linkedProposals}
            reviewItems={selectedJob.reviewItems}
            onSaveField={onSaveField}
            onApproveReviewItem={onApproveReviewItem}
            onSaveReviewItem={onSaveReviewItem}
          />
        </div>
      </div>

      {debugPanels}
    </div>
  );
}
