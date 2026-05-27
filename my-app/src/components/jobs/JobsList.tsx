import React from "react";
import {
  CaretCircleRight,
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
import { translateUi, type UiMessageKey } from "../../lib/i18n";
import { useUiLanguagePreference } from "../../lib/ui-preferences";

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
  isProposalSelectionMode?: boolean;
  onCancelProposalSelection?: () => void;
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

function resolveLocationModeLabel(
  value: string,
  t: (key: UiMessageKey) => string,
): string {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return t("jobs.locationUnavailable");
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
  isProposalSelectionMode = false,
  onCancelProposalSelection,
}: JobsListProps): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const jobsSortOptions = React.useMemo(
    () =>
      JOBS_SORT_OPTIONS.map((option) => ({
        ...option,
        label:
          option.value === "recent"
            ? t("jobs.recentActivity")
            : option.value === "oldest"
              ? t("filters.sortOldestFirst")
              : option.value === "title"
                ? t("filters.sortTitle")
                : t("jobs.company"),
        description:
          option.value === "recent"
            ? t("jobs.latestActivityFirst")
            : option.value === "oldest"
              ? t("filters.sortOldestSavedFirst")
              : option.value === "title"
                ? t("jobs.alphabeticalByRole")
                : t("jobs.alphabeticalByCompany"),
      })),
    [t],
  );
  const jobsCountLabel =
    filteredJobs.length === displayedJobsCount
      ? `${displayedJobsCount} ${t("jobs.count")}`
      : `${filteredJobs.length} of ${displayedJobsCount}`;
  const addJobSourceLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );

  return (
    <section className="dasti-jobs-list-pane jobs__list" aria-label={t("jobs.list")}>
      {isProposalSelectionMode ? (
        <div className="dasti-jobs-selection-banner">
          <div>
            <strong>{t("jobs.chooseForProposal")}</strong>
            <span>{t("jobs.chooseForProposalHelp")}</span>
          </div>
          <button
            type="button"
            className="dasti-button dasti-button--secondary dasti-button--sm"
            onClick={onCancelProposalSelection}
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : null}
      <div className="dasti-jobs-chrome">
        <div className="dasti-jobs-toolbar-stack">
          <div className="dasti-jobs-toolbar__search">
            <span className="sr-only">{t("jobs.search")}</span>
            <span className="dasti-jobs-toolbar__search-icon" aria-hidden="true">
              <ListMagnifyingGlass size={16} strokeWidth={1.7} />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={t("jobs.search")}
              aria-label={t("jobs.search")}
              className="dasti-select dasti-select--sm"
            />
            {searchQuery ? (
              <button
                type="button"
                className="dasti-jobs-toolbar__clear"
                aria-label={t("jobs.clearSearch")}
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
                label={t("jobs.sort")}
                value={sortOrder}
                options={jobsSortOptions}
                onChange={onSortOrderChange}
                align="start"
              />
            </div>
            <Menu
              ariaLabel={t("jobs.addJob")}
              align="end"
              menuClassName="dasti-jobs-add-menu"
              sections={[
                {
                  label: t("jobs.primary"),
                  items: [
                    {
                      id: "install-extension",
                      label: t("jobs.installChromeExtension"),
                      onSelect: () =>
                        openExternalJobCaptureLink(
                          PROPOSAL_EXTENSION_INSTALL_LINK.href,
                        ),
                    },
                  ],
                },
                {
                  label: t("jobs.jobBoards"),
                  items: addJobSourceLinks.map((link) => ({
                    id: link.key,
                    label: link.label,
                    onSelect: () => openExternalJobCaptureLink(link.href),
                  })),
                },
              ]}
              trigger={
                <button type="button" className="dasti-jobs-add-action">
                  + {t("jobs.addJob")}
                </button>
              }
            />
          </div>
        </div>

        <div
          className="dasti-jobs-filter-chips dasti-jobs-view-toggle"
          aria-label={t("jobs.views")}
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
            {t("jobs.active")}
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
            {t("jobs.archived")}
          </button>
        </div>

        {jobsView === "active" ? (
          <div
            className="dasti-jobs-filter-chips dasti-jobs-quick-filter-row"
            aria-label={t("jobs.quickFilters")}
          >
            <FilterChip
              isActive={matchFilter === "worth_plus"}
              onClick={() =>
                onMatchFilterChange(
                  matchFilter === "worth_plus" ? "all" : "worth_plus",
                )
              }
            >
              {t("jobs.worthAShot")}
            </FilterChip>
            <FilterChip
              isActive={needsReviewOnly}
              onClick={() => onNeedsReviewOnlyChange(!needsReviewOnly)}
            >
              {t("jobs.new")}
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
              aria-label={t("jobs.favorites")}
              aria-pressed={favoritesOnly}
              title={t("jobs.favorites")}
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
              ariaLabel={t("jobs.additionalFilters")}
              align="start"
              menuClassName="dasti-jobs-filter-menu"
              sections={[
                {
                  label: t("jobs.matchQuality"),
                  items: [
                    {
                      id: "all-match-tiers",
                      label: t("jobs.allMatchTiers"),
                      role: "menuitemradio",
                      selected: matchFilter === "all",
                      onSelect: () => onMatchFilterChange("all"),
                    },
                    {
                      id: "strong-match",
                      label: t("jobs.strongMatch"),
                      role: "menuitemradio",
                      selected: matchFilter === "strong",
                      onSelect: () => onMatchFilterChange("strong"),
                    },
                    {
                      id: "worth-it",
                      label: t("jobs.worthAShot"),
                      role: "menuitemradio",
                      selected: matchFilter === "worth_plus",
                      onSelect: () => onMatchFilterChange("worth_plus"),
                    },
                    {
                      id: "maybe",
                      label: t("jobs.maybe"),
                      role: "menuitemradio",
                      selected: matchFilter === "unknown",
                      onSelect: () => onMatchFilterChange("unknown"),
                    },
                    {
                      id: "probably-skip",
                      label: t("jobs.probablySkip"),
                      role: "menuitemradio",
                      selected: matchFilter === "weak",
                      onSelect: () => onMatchFilterChange("weak"),
                    },
                  ],
                },
                {
                  label: t("jobs.documents"),
                  items: [
                    {
                      id: "all-docs",
                      label: t("jobs.allDocuments"),
                      role: "menuitemradio",
                      selected: !hasDocsOnly && !noDocsOnly,
                      onSelect: () => {
                        onHasDocsOnlyChange(false);
                        onNoDocsOnlyChange(false);
                      },
                    },
                    {
                      id: "has-docs",
                      label: t("jobs.hasDocs"),
                      role: "menuitemradio",
                      selected: hasDocsOnly,
                      onSelect: () => onHasDocsOnlyChange(!hasDocsOnly),
                    },
                    {
                      id: "no-docs",
                      label: t("jobs.noDocs"),
                      role: "menuitemradio",
                      selected: noDocsOnly,
                      onSelect: () => onNoDocsOnlyChange(!noDocsOnly),
                    },
                  ],
                },
                {
                  label: t("jobs.traits"),
                  items: [
                    {
                      id: "remote",
                      label: t("jobs.remote"),
                      role: "menuitemradio",
                      selected: remoteOnly,
                      onSelect: () => onRemoteOnlyChange(!remoteOnly),
                    },
                    {
                      id: "senior",
                      label: t("jobs.senior"),
                      role: "menuitemradio",
                      selected: seniorOnly,
                      onSelect: () => onSeniorOnlyChange(!seniorOnly),
                    },
                  ],
                },
              ]}
              trigger={
                <button type="button" className="dasti-jobs-filter-chip">
                  + {t("jobs.filters")}
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
            {jobsView === "archived" ? t("jobs.noArchivedJobs") : t("jobs.noJobsMatch")}
          </div>
          <p className="dasti-empty-state__subtitle">
            {jobsView === "archived" ? t("jobs.archiveHint") : t("jobs.widerSearchHint")}
          </p>
        </div>
      ) : (
        <div className="dasti-jobs-list" role="list">
          {filteredJobs.map((job) => {
            const isActive = job.id === selectedJobId;
            const title = job.title.trim() || t("jobs.untitled");
            const company = job.company.trim() || t("jobs.unknownCompany");
            const locationLabel = resolveLocationModeLabel(job.location, t);
            const lastActivityLabel =
              formatUiDate(optimisticActivityById[job.id] ?? job.lastActivityAt) ??
              t("jobs.recent");
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
                          <span className="dasti-jobs-sample-badge">{t("jobs.sample")}</span>
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
                        <span>
                          {t("jobs.lastActivity")} {lastActivityLabel}
                        </span>
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
                    {isProposalSelectionMode ? (
                      <span className="dasti-jobs-row__select-hint">
                        {t("jobs.selectJob")}
                        <CaretCircleRight size={14} aria-hidden="true" />
                      </span>
                    ) : null}
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
                                          label: t("common.cancel"),
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
                                          closeOnSelect: false,
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
                          aria-label={t("jobs.favorite")}
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
