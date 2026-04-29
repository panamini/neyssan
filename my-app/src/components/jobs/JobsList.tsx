import React from "react";
import {
  DotsThree,
  FileText,
  ListMagnifyingGlass,
  Star,
} from "@/lib/icons";
import { LibraryFilterMenu } from "../LibraryFilterMenu";
import { Menu } from "../ui/menu";
import { formatUiDate } from "../../lib/ui-date";

type JobsListItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceType: string;
  sourceDomain: string;
  reviewState: string;
  matchTier: "strong" | "partial" | "weak" | "unknown";
  lastActivityAt: number;
  linkedDocumentCount: number;
};

type JobsSortOrder = "recent" | "oldest" | "title" | "company";
type JobsMatchFilter = "all" | "strong" | "partial" | "weak" | "unknown";
type JobsViewMode = "active" | "archived";

type JobsListProps = {
  jobsView: JobsViewMode;
  selectedJobId?: string;
  filteredJobs: JobsListItem[];
  displayedJobsCount: number;
  searchQuery: string;
  sortOrder: JobsSortOrder;
  matchFilter: JobsMatchFilter;
  hasDocsOnly: boolean;
  needsReviewOnly: boolean;
  favoritesOnly: boolean;
  remoteOnly: boolean;
  seniorOnly: boolean;
  optimisticActivityById: Record<string, number>;
  optimisticFavoriteById: Record<string, boolean>;
  optimisticReviewStateById: Record<string, string>;
  confirmingPermanentDeleteJobId: string | null;
  shouldRenderInlineDetailPane: boolean;
  renderSelectedJobDetail: () => JSX.Element | null;
  onSearchQueryChange: (value: string) => void;
  onSortOrderChange: (value: JobsSortOrder) => void;
  onMatchFilterChange: (value: JobsMatchFilter) => void;
  onHasDocsOnlyChange: (value: boolean) => void;
  onNeedsReviewOnlyChange: (value: boolean) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onRemoteOnlyChange: (value: boolean) => void;
  onSeniorOnlyChange: (value: boolean) => void;
  onViewChange: (view: JobsViewMode) => void;
  onSelectJob: (jobId: string) => void;
  onSetJobFavorite: (jobId: string, nextFavorite: boolean) => void;
  onOpenJobSource: (sourceUrl: string) => void;
  onArchiveJob: (jobId: string) => void;
  onDuplicateJob: (jobId: string) => void;
  onRestoreArchivedJob: (jobId: string) => void;
  onDeleteArchivedJob: (jobId: string) => void;
  onConfirmPermanentDeleteJobIdChange: (jobId: string | null) => void;
  onImportFirstJob: () => void;
  onAddFilter: () => void;
};

const JOBS_SORT_OPTIONS = [
  {
    value: "recent",
    label: "Recent activity",
    description: "Latest job activity first.",
  },
  {
    value: "oldest",
    label: "Oldest first",
    description: "Oldest saved first.",
  },
  { value: "title", label: "Title", description: "Alphabetical by role." },
  {
    value: "company",
    label: "Company",
    description: "Alphabetical by company.",
  },
] as const;

const JOBS_MATCH_FILTER_OPTIONS = [
  {
    value: "all",
    label: "Worth+ a shot",
    description: "Show every match tier.",
  },
  {
    value: "strong",
    label: "Strong match",
    description: "Highest-confidence matches.",
  },
  {
    value: "partial",
    label: "Worth a shot",
    description: "Some signals match.",
  },
  {
    value: "weak",
    label: "Probably skip",
    description: "Low-signal matches.",
  },
  {
    value: "unknown",
    label: "Maybe",
    description: "No resolved match tier.",
  },
] as const;

function resolveMatchTierLabel(tier: JobsListItem["matchTier"]): string {
  switch (tier) {
    case "strong":
      return "Strong match";
    case "partial":
      return "Worth a shot";
    case "weak":
      return "Probably skip";
    case "unknown":
      return "Maybe";
  }
}

function resolveLocationModeLabel(value: string): string {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || "Location unavailable";
}

function FilterChip({
  isActive,
  children,
  onClick,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={[
        "dasti-jobs-filter-chip",
        isActive ? "dasti-jobs-filter-chip--active" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function JobsList({
  jobsView,
  selectedJobId,
  filteredJobs,
  displayedJobsCount,
  searchQuery,
  sortOrder,
  matchFilter,
  hasDocsOnly,
  needsReviewOnly,
  favoritesOnly,
  remoteOnly,
  seniorOnly,
  optimisticActivityById,
  optimisticFavoriteById,
  optimisticReviewStateById,
  confirmingPermanentDeleteJobId,
  shouldRenderInlineDetailPane,
  renderSelectedJobDetail,
  onSearchQueryChange,
  onSortOrderChange,
  onMatchFilterChange,
  onHasDocsOnlyChange,
  onNeedsReviewOnlyChange,
  onFavoritesOnlyChange,
  onRemoteOnlyChange,
  onSeniorOnlyChange,
  onViewChange,
  onSelectJob,
  onSetJobFavorite,
  onOpenJobSource,
  onArchiveJob,
  onDuplicateJob,
  onRestoreArchivedJob,
  onDeleteArchivedJob,
  onConfirmPermanentDeleteJobIdChange,
  onImportFirstJob,
  onAddFilter,
}: JobsListProps): JSX.Element {
  return (
    <section className="dasti-jobs-list-pane" aria-label="Jobs list">
      <div className="dasti-jobs-toolbar">
        <label className="dasti-jobs-toolbar__search">
          <span className="sr-only">Search jobs</span>
          <span className="dasti-jobs-toolbar__search-icon" aria-hidden="true">
            <ListMagnifyingGlass size={14} strokeWidth={1.7} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search jobs"
            aria-label="Search jobs"
            className="dasti-select dasti-select--sm"
          />
        </label>
        <LibraryFilterMenu
          label="Sort jobs"
          value={sortOrder}
          options={JOBS_SORT_OPTIONS}
          onChange={onSortOrderChange}
        />
        <span className="dasti-jobs-toolbar__count">
          {filteredJobs.length === displayedJobsCount
            ? `${displayedJobsCount} jobs`
            : `${filteredJobs.length} of ${displayedJobsCount}`}
        </span>
      </div>

      <div
        className="dasti-jobs-filter-chips dasti-jobs-view-toggle"
        aria-label="Job views"
        role="group"
      >
        <button
          type="button"
          className={[
            "dasti-jobs-filter-chip",
            "dasti-jobs-view-toggle__button",
            jobsView === "active" ? "dasti-jobs-filter-chip--active" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={jobsView === "active"}
          onClick={() => onViewChange("active")}
        >
          Active
        </button>
        <button
          type="button"
          className={[
            "dasti-jobs-filter-chip",
            "dasti-jobs-view-toggle__button",
            jobsView === "archived" ? "dasti-jobs-filter-chip--active" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={jobsView === "archived"}
          onClick={() => onViewChange("archived")}
        >
          Archived
        </button>
      </div>

      {jobsView === "active" ? (
        <div className="dasti-jobs-filter-chips" aria-label="Job filters">
          <LibraryFilterMenu
            label="Match quality"
            value={matchFilter}
            options={JOBS_MATCH_FILTER_OPTIONS}
            onChange={onMatchFilterChange}
          />
          <div
            className="dasti-jobs-filter-cluster dasti-jobs-filter-cluster--attention"
            aria-label="Review state"
          >
            <FilterChip
              isActive={needsReviewOnly}
              onClick={() => onNeedsReviewOnlyChange(!needsReviewOnly)}
            >
              Needs review
            </FilterChip>
          </div>
          <div
            className="dasti-jobs-filter-cluster dasti-jobs-filter-cluster--utility"
            aria-label="Job utilities"
          >
            <FilterChip
              isActive={hasDocsOnly}
              onClick={() => onHasDocsOnlyChange(!hasDocsOnly)}
            >
              Has docs
            </FilterChip>
            <FilterChip
              isActive={favoritesOnly}
              onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            >
              Favorites
            </FilterChip>
            <FilterChip
              isActive={remoteOnly}
              onClick={() => onRemoteOnlyChange(!remoteOnly)}
            >
              Remote
            </FilterChip>
            <FilterChip
              isActive={seniorOnly}
              onClick={() => onSeniorOnlyChange(!seniorOnly)}
            >
              Senior
            </FilterChip>
            <button
              type="button"
              className="dasti-jobs-filter-chip"
              onClick={onAddFilter}
            >
              + filter
            </button>
          </div>
          <div
            className="dasti-jobs-filter-cluster dasti-jobs-filter-cluster--capture"
            aria-label="Job capture"
          >
            <button
              type="button"
              className="dasti-jobs-filter-chip"
              onClick={onImportFirstJob}
            >
              Paste URL
            </button>
            <button
              type="button"
              className="dasti-jobs-filter-chip"
              onClick={onImportFirstJob}
            >
              Capture with extension
            </button>
          </div>
        </div>
      ) : null}

      {filteredJobs.length === 0 ? (
        <div className="dasti-empty-state dasti-empty-state--panel">
          <FileText size={28} strokeWidth={1.2} aria-hidden="true" />
          <div className="dasti-empty-state__title">
            {jobsView === "archived" ? "No archived jobs" : "No jobs match this search"}
          </div>
          <p className="dasti-empty-state__subtitle">
            {jobsView === "archived" ? "Archive a job to see it here." : "Try a wider search."}
          </p>
        </div>
      ) : (
        <div className="dasti-jobs-list" role="list">
          {filteredJobs.map((job) => {
            const isActive = job.id === selectedJobId;
            const title = job.title.trim() || "Untitled job";
            const company = job.company.trim() || "Unknown company";
            const locationLabel = resolveLocationModeLabel(job.location);
            const lastActivityLabel =
              formatUiDate(optimisticActivityById[job.id] ?? job.lastActivityAt) ??
              "Recent";
            const reviewState =
              optimisticReviewStateById[job.id] ?? job.reviewState;
            const isFavorite =
              optimisticFavoriteById[job.id] ?? job.isFavorite;
            const matchLabel = resolveMatchTierLabel(job.matchTier);

            return (
              <div key={job.id} className="dasti-jobs-list-item" role="listitem">
                <article
                  className={[
                    "dasti-jobs-row",
                    isActive ? "dasti-jobs-row--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (jobsView === "active") {
                      onSelectJob(job.id);
                    }
                  }}
                >
                  <div className="dasti-jobs-row__copy">
                    <div className="dasti-jobs-row__title">
                      <span>{title}</span>
                      {job.isSample ? (
                        <span className="dasti-jobs-sample-badge">Sample</span>
                      ) : null}
                    </div>
                    <div className="dasti-jobs-row__company">
                      {company}
                      {` · ${locationLabel}`}
                    </div>
                    <div className="dasti-jobs-row__meta">
                      <span className="dasti-jobs-match-chip">{matchLabel}</span>
                      <span className="dasti-jobs-row__meta-pill">
                        <FileText size={12} strokeWidth={1.7} aria-hidden="true" />
                        <span>{job.linkedDocumentCount}</span>
                      </span>
                      <span>Last activity {lastActivityLabel}</span>
                      {reviewState === "needs_review" ? (
                        <span
                          className="dasti-jobs-review-dot"
                          aria-label="Needs review"
                          title="Needs review"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="dasti-jobs-row__controls">
                    <div className="dasti-jobs-row__favorite-slot">
                      {jobsView === "active" ? (
                        <button
                          type="button"
                          className="dasti-icon-button dasti-jobs-row__favorite"
                          aria-pressed={isFavorite}
                          aria-label={
                            isFavorite
                              ? `Remove ${title} from favorites`
                              : `Mark ${title} as favorite`
                          }
                          title={isFavorite ? "Remove from favorites" : "Mark favorite"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSetJobFavorite(job.id, !isFavorite);
                          }}
                        >
                          <Star
                            size={16}
                            strokeWidth={1.8}
                            weight={isFavorite ? "fill" : "regular"}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                    </div>
                    <div className="dasti-import-dropdown dasti-jobs-row__menu">
                      <Menu
                        ariaLabel={`Actions for ${title}`}
                        align="end"
                        sections={[
                          {
                            items:
                              jobsView === "active"
                                ? [
                                    {
                                      id: "open-source",
                                      label: "Open source",
                                      disabled: !job.sourceUrl,
                                      onSelect: () => onOpenJobSource(job.sourceUrl),
                                    },
                                    {
                                      id: "archive",
                                      label: "Archive",
                                      onSelect: () => onArchiveJob(job.id),
                                    },
                                    {
                                      id: "duplicate",
                                      label: "Duplicate",
                                      onSelect: () => onDuplicateJob(job.id),
                                    },
                                  ]
                                : confirmingPermanentDeleteJobId === job.id
                                  ? [
                                      {
                                        id: "restore",
                                        label: "Restore",
                                        onSelect: () => onRestoreArchivedJob(job.id),
                                      },
                                      {
                                        id: "confirm-delete",
                                        label: "Confirm",
                                        tone: "danger",
                                        onSelect: () => onDeleteArchivedJob(job.id),
                                      },
                                      {
                                        id: "cancel-delete",
                                        label: "Cancel",
                                        onSelect: () =>
                                          onConfirmPermanentDeleteJobIdChange(null),
                                      },
                                    ]
                                  : [
                                      {
                                        id: "restore",
                                        label: "Restore",
                                        onSelect: () => onRestoreArchivedJob(job.id),
                                      },
                                      {
                                        id: "delete-forever",
                                        label: "Delete forever",
                                        tone: "danger",
                                        onSelect: () =>
                                          onConfirmPermanentDeleteJobIdChange(job.id),
                                      },
                                    ],
                          },
                        ]}
                        trigger={
                          <button
                            type="button"
                            className="dasti-icon-button dasti-jobs-row__menu-trigger"
                            aria-label={`More actions for ${title}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DotsThree size={16} strokeWidth={1.7} aria-hidden="true" />
                          </button>
                        }
                      />
                    </div>
                  </div>
                </article>
                {shouldRenderInlineDetailPane && isActive ? (
                  <section
                    className="dasti-jobs-inline-detail"
                    aria-label="Selected job detail"
                  >
                    {renderSelectedJobDetail()}
                  </section>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
