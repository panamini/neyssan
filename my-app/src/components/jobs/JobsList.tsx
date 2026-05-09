import React from "react";
import {
  DotsThree,
  FileText,
  ListMagnifyingGlass,
  Star,
  X,
} from "@/lib/icons";
import { LibraryFilterMenu } from "../LibraryFilterMenu";
import { Menu } from "../ui/menu";
import { formatUiDate } from "../../lib/ui-date";
import {
  PROPOSAL_EXTENSION_INSTALL_LINK,
  getProposalExtensionSourceLinks,
} from "../../lib/proposal-source-platforms";
import { resolveVisibleJobVerdict } from "../../lib/jobs/visibleJobVerdict";

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
  matchRead?: {
    tier: "strong" | "partial" | "weak" | "unknown";
  } | null;
  matchReview?: {
    verdict:
      | "strong_lead"
      | "possible_lead"
      | "probably_skip"
      | "not_enough_signal";
    score?: number | null;
  } | null;
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

function openExternalJobCaptureLink(href: string): void {
  if (typeof window === "undefined") return;
  window.open(href, "_blank", "noopener,noreferrer");
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
}: JobsListProps): JSX.Element {
  const jobsCountLabel =
    filteredJobs.length === displayedJobsCount
      ? `${displayedJobsCount} jobs`
      : `${filteredJobs.length} of ${displayedJobsCount}`;
  const addJobSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );

  return (
    <section className="dasti-jobs-list-pane jobs__list" aria-label="Jobs list">
      <div className="dasti-jobs-chrome">
        <div className="dasti-jobs-toolbar-stack">
          <div className="dasti-jobs-toolbar__search">
            <span className="sr-only">Search jobs</span>
            <span className="dasti-jobs-toolbar__search-icon" aria-hidden="true">
              <ListMagnifyingGlass size={16} strokeWidth={1.7} />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search jobs"
              aria-label="Search jobs"
              className="dasti-select dasti-select--sm"
            />
            {searchQuery ? (
              <button
                type="button"
                className="dasti-jobs-toolbar__clear"
                aria-label="Clear search"
                onClick={() => onSearchQueryChange("")}
              >
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ) : null}
            <span className="dasti-jobs-toolbar__count" aria-hidden="true">
              {jobsCountLabel}
            </span>
          </div>

          <div className="dasti-jobs-sort-row">
            <div className="dasti-jobs-sort-control">
              <LibraryFilterMenu
                label="Sort jobs"
                value={sortOrder}
                options={JOBS_SORT_OPTIONS}
                onChange={onSortOrderChange}
                align="start"
              />
            </div>
            <Menu
              ariaLabel="Add job"
              align="end"
              menuClassName="dasti-jobs-add-menu"
              sections={[
                {
                  label: "Primary",
                  items: [
                    {
                      id: "install-extension",
                      label: "Install Chrome extension",
                      onSelect: () =>
                        openExternalJobCaptureLink(
                          PROPOSAL_EXTENSION_INSTALL_LINK.href,
                        ),
                    },
                  ],
                },
                {
                  label: "Job boards",
                  items: addJobSourceLinks.map((link) => ({
                    id: link.key,
                    label: link.label,
                    onSelect: () => openExternalJobCaptureLink(link.href),
                  })),
                },
              ]}
              trigger={
                <button type="button" className="dasti-jobs-add-action">
                  + Add job
                </button>
              }
            />
          </div>
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
          <div
            className="dasti-jobs-filter-chips dasti-jobs-quick-filter-row"
            aria-label="Quick job filters"
          >
            <FilterChip
              isActive={matchFilter === "worth_plus"}
              onClick={() =>
                onMatchFilterChange(
                  matchFilter === "worth_plus" ? "all" : "worth_plus",
                )
              }
            >
              Worth a shot
            </FilterChip>
            <FilterChip
              isActive={needsReviewOnly}
              onClick={() => onNeedsReviewOnlyChange(!needsReviewOnly)}
            >
              New
            </FilterChip>
            <button
              type="button"
              className={[
                "dasti-jobs-filter-chip",
                "dasti-jobs-filter-chip--icon",
                favoritesOnly ? "dasti-jobs-filter-chip--active" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Favorites"
              aria-pressed={favoritesOnly}
              title="Favorites"
              onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            >
              <Star
                size={16}
                strokeWidth={1.8}
                weight={favoritesOnly ? "fill" : "regular"}
                aria-hidden="true"
              />
            </button>
            <Menu
              ariaLabel="Additional job filters"
              align="start"
              menuClassName="dasti-jobs-filter-menu"
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
                      id: "worth-it",
                      label: "Worth a shot",
                      role: "menuitemradio",
                      selected: matchFilter === "worth_plus",
                      onSelect: () => onMatchFilterChange("worth_plus"),
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
                {
                  label: "Job traits",
                  items: [
                    {
                      id: "remote",
                      label: "Remote",
                      role: "menuitemradio",
                      selected: remoteOnly,
                      onSelect: () => onRemoteOnlyChange(!remoteOnly),
                    },
                    {
                      id: "senior",
                      label: "Senior",
                      role: "menuitemradio",
                      selected: seniorOnly,
                      onSelect: () => onSeniorOnlyChange(!seniorOnly),
                    },
                  ],
                },
              ]}
              trigger={
                <button type="button" className="dasti-jobs-filter-chip">
                  + Filters
                </button>
              }
            />
          </div>
        ) : null}
      </div>

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
            const { label: matchLabel, tone: matchTone } =
              resolveVisibleJobVerdict({
                matchReview: job.matchReview,
                matchRead: job.matchRead,
                matchTier: job.matchTier,
              });

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
                    </div>
                    <div className="dasti-jobs-row__company">
                      <span>{company}</span>
                      <span>·</span>
                      <span>{locationLabel}</span>
                    </div>
                    <div className="dasti-jobs-row__footer">
                      <div className="dasti-jobs-row__meta">
                        <span className="dasti-jobs-row__meta-pill">
                          <span>{job.linkedDocumentCount}</span>
                        </span>
                        <span>Last activity {lastActivityLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="dasti-jobs-row__rail">
                    <span
                      className={`ds-verdict ds-verdict--${matchTone} dasti-jobs-match-chip`}
                    >
                      <span className="ds-verdict__dot" aria-hidden="true" />
                      {matchLabel}
                    </span>
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
                              <DotsThree
                                size={16}
                                strokeWidth={1.7}
                                aria-hidden="true"
                              />
                            </button>
                          }
                        />
                      </div>
                      {isFavorite ? (
                        <span
                          className="dasti-jobs-row__favorite-slot"
                          aria-label="Favorite"
                        >
                          <Star
                            size={13}
                            strokeWidth={1.8}
                            weight="fill"
                            aria-hidden="true"
                          />
                        </span>
                      ) : null}
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
