import React from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  Paperclip,
  Star,
} from "@/lib/icons";
import { ProposalBriefCard } from "../ProposalBriefCard";
import { MatchReadBlock } from "./MatchReadBlock";

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
  debugPanels?: React.ReactNode;
  onBackToJobs: () => void;
  onSetJobFavorite: (jobId: string, nextFavorite: boolean) => void;
  onOpenJobSource: (sourceUrl: string) => void;
  onToggleResumePicker: () => void;
  onAttachResumeToJob: (resumeId: string) => void;
  onDetachResumeFromJob: () => void;
  onCreateProposal: (jobId: string) => void;
  onRefreshSelectedJobMatch: () => void;
  onSaveField: (fieldKey: string, nextValue: string | string[]) => void;
  onApproveReviewItem: (item: any) => void;
  onSaveReviewItem: (item: any, nextValue: string | string[]) => void;
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
        !/\b\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago\b/i.test(part) &&
        !/\b\d+\s+people\s+clicked\s+apply\b/i.test(part) &&
        !/\b\d+\s+applicants?\b/i.test(part),
    );
  return locationParts.join(" · ") || normalizedValue;
}

function formatJobTitle(value: string): string {
  return String(value ?? "").trim().replace(/[:\s]+$/, "") || "Untitled job";
}

function resolveMatchTierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case "strong":
      return "Strong match";
    case "partial":
      return "Worth a shot";
    case "weak":
      return "Probably skip";
    default:
      return "Maybe";
  }
}

function resolveMatchTierTone(tier: string | null | undefined): string {
  switch (tier) {
    case "strong":
      return "strong";
    case "partial":
      return "worth";
    case "weak":
      return "skip";
    default:
      return "maybe";
  }
}

export function JobDetail({
  selectedJobId,
  selectedJobIsLoading,
  selectedJob,
  selectedJobMatchTier,
  selectedJobIsFavorite,
  selectedJobResumeDisplayName,
  selectedSourceLabel,
  isMobileJobsLayout,
  isResumePickerOpen,
  resumePickerRef,
  resumePickerOptions,
  debugPanels,
  onBackToJobs,
  onSetJobFavorite,
  onOpenJobSource,
  onToggleResumePicker,
  onAttachResumeToJob,
  onDetachResumeFromJob,
  onCreateProposal,
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
      <div className="dasti-empty-state dasti-empty-state--panel">
        <div className="dasti-empty-state__title">Loading job</div>
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
  const selectedJobResolvedMatchTier =
    selectedJobMatchTier ?? selectedJob.matchTier;
  const selectedJobVerdictLabel = resolveMatchTierLabel(
    selectedJobResolvedMatchTier,
  );
  const selectedJobVerdictTone = resolveMatchTierTone(
    selectedJobResolvedMatchTier,
  );

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
                    <span>{`From ${selectedSourceLabel}`}</span>
                    <ArrowSquareOut
                      size={13}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <span>{`From ${selectedSourceLabel}`}</span>
                )}
              </>
            ) : null}
            <span>·</span>
            <span
              className={`ds-verdict ds-verdict--${selectedJobVerdictTone} dasti-jobs-detail__verdict`}
            >
              <span className="ds-verdict__dot" aria-hidden="true" />
              {selectedJobVerdictLabel}
            </span>
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
            >
              <div
                ref={resumePickerRef}
                className="dasti-jobs-detail__resume-picker dasti-jobs-detail__header-resume"
              >
                <button
                  type="button"
                  className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--resume"
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
                className="dasti-jobs-detail__header-action dasti-jobs-detail__header-action--proposal"
                onClick={() => onCreateProposal(selectedJob.id)}
              >
                <span>Generate proposal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="dasti-jobs-detail__body">
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
            extractionUnavailable={selectedJob.visibleExtractionSource !== "llm"}
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
        <aside className="dasti-jobs-detail__match" aria-label="Match panel">
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
        </aside>
      </div>

      {debugPanels}
    </div>
  );
}
