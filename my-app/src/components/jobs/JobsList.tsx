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
type JobsMatchFilter =
  | "worth_plus"
  | "all"
  | "strong"
  | "partial"
  | "weak"
  | "unknown";
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
  noDocsOnly: boolean;
  needsReviewOnly: boolean;
  favoritesOnly: boolean;
  remoteOnly: boolean;
  seniorOnly: boolean;
  optimisticActivityById: Record<string, number>;
  optimisticFavoriteById: Record<string, boolean>;
  confirmingPermanentDeleteJobId: string | null;
  onSearchQueryChange: (value: string) => void;
  onSortOrderChange: (value: JobsSortOrder) => void;
  onMatchFilterChange: (value: JobsMatchFilter) => void;
  onHasDocsOnlyChange: (value: boolean) => void;
  onNoDocsOnlyChange: (value: boolean) => void;
  onNeedsReviewOnlyChange: (value: boolean) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onRemoteOnlyChange: (value: boolean) => void;
  onSeniorOnlyChange: (value: boolean) => void;
  onViewChange: (view: JobsViewMode) => void;
  onSelectJob: (jobId: string) => void;
  onOpenJobSource: (sourceUrl: string) => void;
  onArchiveJob: (jobId: string) => void;
  onDuplicateJob: (jobId: string) => void;
  onRestoreArchivedJob: (jobId: string) => void;
  onDeleteArchivedJob: (jobId: string) => void;
  onConfirmPermanentDeleteJobIdChange: (jobId: string | null) => void;
  onImportFirstJob: () => void;
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

function resolveMatchTierTone(
  tier: JobsListItem["matchTier"],
): "strong" | "worth" | "skip" | "maybe" {
  switch (tier) {
    case "strong":
      return "strong";
    case "partial":
      return "worth";
    case "weak":
      return "skip";
    case "unknown":
      return "maybe";
  }
}

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
  noDocsOnly,
  needsReviewOnly,
  favoritesOnly,
  remoteOnly,
  seniorOnly,
  optimisticActivityById,
  optimisticFavoriteById,
  confirmingPermanentDeleteJobId,
  onSearchQueryChange,
  onSortOrderChange,
  onMatchFilterChange,
  onHasDocsOnlyChange,
  onNoDocsOnlyChange,
  onNeedsReviewOnlyChange,
  onFavoritesOnlyChange,
  onRemoteOnlyChange,
  onSeniorOnlyChange,
  onViewChange,
  onSelectJob,
  onOpenJobSource,
  onArchiveJob,
  onDuplicateJob,
  onRestoreArchivedJob,
  onDeleteArchivedJob,
  onConfirmPermanentDeleteJobIdChange,
  onImportFirstJob,
}: JobsListProps): JSX.Element {
  return (
    <section className="dasti-jobs-list-pane jobs__list" aria-label="Jobs list">
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
          <FilterChip
            isActive={matchFilter === "worth_plus"}
            onClick={() =>
              onMatchFilterChange(
                matchFilter === "worth_plus" ? "all" : "worth_plus",
              )
            }
          >
            Worth+ a shot
          </FilterChip>
          <div
            className="dasti-jobs-filter-cluster dasti-jobs-filter-cluster--attention"
            aria-label="Review state"
          >
            <FilterChip
              isActive={needsReviewOnly}
              onClick={() => onNeedsReviewOnlyChange(!needsReviewOnly)}
            >
              Unviewed
            </FilterChip>
          </div>
          <div
            className="dasti-jobs-filter-cluster dasti-jobs-filter-cluster--utility"
            aria-label="Job utilities"
          >
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
            <Menu
              ariaLabel="Additional job filters"
              align="start"
              sections={[
                {
                  label: "Match quality",
                  items: [
                    {
                      id: "all-match-tiers",
                      label: "All match tiers",
                      role: "menuitemradio",
                      selected: matchFilter === "all",
                      onSelect: () => onMatchFilterChange("all"),
                    },
                    {
                      id: "strong-match",
                      label: "Strong match",
                      role: "menuitemradio",
                      selected: matchFilter === "strong",
                      onSelect: () => onMatchFilterChange("strong"),
                    },
                    {
                      id: "maybe",
                      label: "Maybe",
                      role: "menuitemradio",
                      selected: matchFilter === "unknown",
                      onSelect: () => onMatchFilterChange("unknown"),
                    },
                    {
                      id: "probably-skip",
                      label: "Probably skip",
                      role: "menuitemradio",
                      selected: matchFilter === "weak",
                      onSelect: () => onMatchFilterChange("weak"),
                    },
                  ],
                },
                {
                  label: "Documents",
                  items: [
                    {
                      id: "all-docs",
                      label: "All documents",
                      role: "menuitemradio",
                      selected: !hasDocsOnly && !noDocsOnly,
                      onSelect: () => {
                        onHasDocsOnlyChange(false);
                        onNoDocsOnlyChange(false);
                      },
                    },
                    {
                      id: "has-docs",
                      label: "Has docs",
                      role: "menuitemradio",
                      selected: hasDocsOnly,
                      onSelect: () => onHasDocsOnlyChange(!hasDocsOnly),
                    },
                    {
                      id: "no-docs",
                      label: "No docs",
                      role: "menuitemradio",
                      selected: noDocsOnly,
                      onSelect: () => onNoDocsOnlyChange(!noDocsOnly),
                    },
                  ],
                },
              ]}
              trigger={
                <button type="button" className="dasti-jobs-filter-chip">
                  + filter
                </button>
              }
            />
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
            const isFavorite =
              optimisticFavoriteById[job.id] ?? job.isFavorite;
            const matchLabel = resolveMatchTierLabel(job.matchTier);
            const matchTone = resolveMatchTierTone(job.matchTier);

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
                      <span className="dasti-jobs-row__title-copy">
                        <span>{title}</span>
                        {job.isSample ? (
                          <span className="dasti-jobs-sample-badge">Sample</span>
                        ) : null}
                      </span>
                      <span
                        className={`ds-verdict ds-verdict--${matchTone} dasti-jobs-match-chip`}
                      >
                        <span className="ds-verdict__dot" aria-hidden="true" />
                        {matchLabel}
                      </span>
                    </div>
                    <div className="dasti-jobs-row__company">
                      <span>{company}</span>
                      <span>·</span>
                      <span>{locationLabel}</span>
                      {isFavorite ? (
                        <span className="dasti-jobs-row__meta-favorite" aria-label="Favorite">
                          <Star size={13} strokeWidth={1.8} weight="fill" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                    <div className="dasti-jobs-row__meta">
                      <span className="dasti-jobs-row__meta-pill">
                        <FileText size={12} strokeWidth={1.7} aria-hidden="true" />
                        <span>{job.linkedDocumentCount}</span>
                      </span>
                      <span>Last activity {lastActivityLabel}</span>
                    </div>
                  </div>
                  <div className="dasti-jobs-row__controls">
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
