import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Button,
  Input,
  Menu,
} from "../components/ui";
import {
  DocumentSpecimenCard,
  type DocumentSpecimenTypeLabel,
} from "../components/library/DocumentSpecimenCard";
import { ProposalDocumentRenderer } from "../components/proposal-render/ProposalDocumentRenderer";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import ResumeTemplateRenderer from "../features/verbati/resume/ResumeTemplateRenderer";
import { resolveVerbatiStyle } from "../features/verbati/style";
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
import { buildStyledResumePrintSource } from "../lib/document-export-models";
import {
  resolvePreviewCanonicalAppearance,
  serializeProposalDocumentThemeVars,
} from "../lib/layout/documentAppearance";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import {
  buildWorkLibraryModel,
  type LibraryItem,
  type LibraryProposalRecord,
  type WorkTarget,
} from "../lib/application-library";
import {
  clearStoredProposalWorkspaceState,
  createProposalWorkspaceResetState,
  readStoredProposalComposeDraft,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { readStoredProposalOutputDraft } from "../lib/proposal-output-draft";
import {
  downloadLibraryItems,
  isLibraryItemDownloadable,
} from "../lib/library-download";
import {
  clearActiveLocalCvId,
  getLocalCvDocumentById,
} from "../lib/proposal-personalization";
import {
  Briefcase,
  DotsThree,
  ArrowSquareOut,
  Check,
  FilePdf,
  FilePlus,
  FileUser,
  List,
  SquaresFour,
  TrashSimple,
  Upload,
  X,
} from "../lib/icons";
import type { CvDocument } from "../types/cvDocument";
import { translateUi, type UiMessageKey } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";

const TYPE_FILTERS = ["all", "cvs", "proposals"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
type ViewMode = "grid" | "list";

type ListEntry = {
  item: LibraryItem;
};

const PROJECT_PREVIEW_BATCH_SIZE = 4;
const PROJECT_PREVIEW_BATCH_DELAY_MS = 80;

const PROJECTS_PROPOSAL_PREVIEW_STYLE = resolveVerbatiStyle({
  familyId: "workshop",
  typography: "geist-baskervville",
  palette: "sauge",
});

function typeLabelI18n(
  filter: TypeFilter,
  t: (key: UiMessageKey) => string,
): string {
  if (filter === "all") return t("projects.all");
  if (filter === "cvs") return t("projects.cvs");
  return t("projects.proposals");
}

function formatUpdatedLabel(value: number): string {
  if (!value || !Number.isFinite(value)) return "Updated recently";
  const elapsedMs = Math.max(0, Date.now() - value);
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  if (elapsedMs < hourMs) return "Updated just now";
  if (elapsedMs < dayMs) {
    const hours = Math.max(1, Math.floor(elapsedMs / hourMs));
    return `Updated ${hours}h ago`;
  }
  if (elapsedMs < weekMs) {
    const days = Math.max(1, Math.floor(elapsedMs / dayMs));
    return `Updated ${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (elapsedMs < monthMs) {
    const weeks = Math.max(1, Math.floor(elapsedMs / weekMs));
    return `Updated ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  return `Updated ${new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
}

function itemTypeLabel(item: LibraryItem): "CV" | "Proposal" {
  return item.type === "cv" ? "CV" : "Proposal";
}

function itemSpecimenTypeLabel(item: LibraryItem): DocumentSpecimenTypeLabel {
  if (item.type === "cv") return "CV";
  return item.linkedCvId ? "PACK" : "PROPOSAL";
}

function itemSourceId(item: LibraryItem): string {
  return item.id.slice(item.id.indexOf(":") + 1);
}

function useBatchedProjectPreviewLoader(items: LibraryItem[]) {
  const initialPreviewIds = React.useMemo(
    () => items.slice(0, PROJECT_PREVIEW_BATCH_SIZE).map((item) => item.id),
    [items],
  );
  const [loadedPreviewIds, setLoadedPreviewIds] = React.useState<Set<string>>(
    () => new Set(initialPreviewIds),
  );
  const loadedPreviewIdsRef = React.useRef(loadedPreviewIds);
  const pendingPreviewIdsRef = React.useRef<string[]>([]);
  const batchTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    loadedPreviewIdsRef.current = loadedPreviewIds;
  }, [loadedPreviewIds]);

  React.useEffect(() => {
    const availableIds = new Set(items.map((item) => item.id));
    pendingPreviewIdsRef.current = [];
    if (batchTimerRef.current !== null) {
      window.clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    setLoadedPreviewIds((previous) => {
      const next = new Set(initialPreviewIds);
      previous.forEach((id) => {
        if (availableIds.has(id)) next.add(id);
      });
      loadedPreviewIdsRef.current = next;
      return next;
    });
  }, [initialPreviewIds, items]);

  const schedulePreviewBatch = React.useCallback(() => {
    if (batchTimerRef.current !== null) return;
    batchTimerRef.current = window.setTimeout(() => {
      batchTimerRef.current = null;
      const batch = pendingPreviewIdsRef.current.splice(0, PROJECT_PREVIEW_BATCH_SIZE);
      if (batch.length > 0) {
        setLoadedPreviewIds((previous) => {
          const next = new Set(previous);
          batch.forEach((id) => next.add(id));
          loadedPreviewIdsRef.current = next;
          return next;
        });
      }
      if (pendingPreviewIdsRef.current.length > 0) {
        schedulePreviewBatch();
      }
    }, PROJECT_PREVIEW_BATCH_DELAY_MS);
  }, []);

  const requestPreview = React.useCallback(
    (itemId: string) => {
      if (
        loadedPreviewIdsRef.current.has(itemId) ||
        pendingPreviewIdsRef.current.includes(itemId)
      ) {
        return;
      }
      pendingPreviewIdsRef.current.push(itemId);
      schedulePreviewBatch();
    },
    [schedulePreviewBatch],
  );

  React.useEffect(
    () => () => {
      if (batchTimerRef.current !== null) {
        window.clearTimeout(batchTimerRef.current);
      }
    },
    [],
  );

  return { loadedPreviewIds, requestPreview };
}

function isLibrarySummaryOnlyCv(cv: CvDocument | null | undefined): boolean {
  return Boolean(
    (cv?.metadata as { librarySummaryOnly?: boolean } | undefined)
      ?.librarySummaryOnly,
  );
}

function hydrateLibraryCvDocument(cv: CvDocument): CvDocument {
  if (!isLibrarySummaryOnlyCv(cv)) {
    return cv;
  }

  const fullDocument = getLocalCvDocumentById(String(cv.id));
  return fullDocument && !isLibrarySummaryOnlyCv(fullDocument)
    ? fullDocument
    : cv;
}

function hydrateLibraryCvDocuments(cvs: CvDocument[]): CvDocument[] {
  return cvs.map(hydrateLibraryCvDocument);
}

function navigateTarget(
  target: WorkTarget,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (target.kind === "route") {
    void navigate(target.to);
  }
}

function proposalContext(item: LibraryItem): string {
  if (item.type === "cv") return "";
  const jobPart = item.jobId || item.jobTitle ? "Job linked" : "No job";
  const cvPart = item.linkedCvTitle
    ? `CV: ${item.linkedCvTitle}`
    : item.linkedCvId
      ? "CV linked"
      : "No CV linked";
  return `${jobPart} · ${cvPart}`;
}

function matchesType(typeFilter: TypeFilter, item: LibraryItem): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "cvs") return item.type === "cv";
  return item.type === "proposal";
}

function matchesSearch(query: string, item: LibraryItem): boolean {
  if (!query) return true;
  return [
    item.type,
    item.title,
    item.subtitle,
    item.jobTitle,
    item.linkedCvTitle,
    proposalContext(item),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function DocumentsPage(): JSX.Element {
  const navigate = useNavigate();
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const proposals = useQuery(
    api.proposalsPublic.default,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as LibraryProposalRecord[] | undefined;
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const { cvs, currentCvId, loadCv, deleteCv, hydrateCvDocument } = useCvLibrary();
  const urlTypeParam = searchParams.get("type");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(() =>
    urlTypeParam === "cvs" || urlTypeParam === "proposals" || urlTypeParam === "all"
      ? urlTypeParam
      : "all",
  );
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  const localOutputDraft = React.useMemo(() => readStoredProposalOutputDraft(), []);
  const localComposeDraft = React.useMemo(() => readStoredProposalComposeDraft(), []);

  React.useEffect(() => {
    const nextType =
      urlTypeParam === "cvs" || urlTypeParam === "proposals" || urlTypeParam === "all"
        ? urlTypeParam
        : "all";
    setTypeFilter(nextType);
  }, [urlTypeParam]);

  const updateTypeFilter = React.useCallback(
    (filter: TypeFilter) => {
      setTypeFilter(filter);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("type", filter);
        return next;
      });
    },
    [setSearchParams],
  );

  const hydratedCvs = React.useMemo(
    () => hydrateLibraryCvDocuments(cvs),
    [cvs],
  );

  const model = React.useMemo(
    () =>
      buildWorkLibraryModel({
        proposals,
        cvs: hydratedCvs,
        currentCvId,
        outputDraft: localOutputDraft,
        composeDraft: localComposeDraft,
      }),
    [currentCvId, hydratedCvs, localComposeDraft, localOutputDraft, proposals],
  );

  const openItem = React.useCallback(
    (item: LibraryItem) => {
      const id = itemSourceId(item);
      if (item.type === "cv") {
        loadCv(id);
      }
      navigateTarget(item.routeTarget, navigate);
    },
    [loadCv, navigate],
  );

  const performDeleteItem = React.useCallback(
    (item: LibraryItem) => {
      const id = itemSourceId(item);
      if (item.source === "local") {
        clearStoredProposalWorkspaceState();
        return;
      }
      if (item.type === "cv") {
        deleteCv(id);
        return;
      }
      if (!isConvexAuthenticated || isConvexAuthLoading) return;
      void deleteProposal({ id: id as Id<"proposals"> });
    },
    [deleteCv, deleteProposal, isConvexAuthLoading, isConvexAuthenticated],
  );

  const deleteItem = React.useCallback(
    (item: LibraryItem) => {
      const itemKind = item.type === "cv" ? "CV" : "proposal";
      if (!window.confirm(`Delete ${itemKind} "${item.title}"?`)) return;
      performDeleteItem(item);
      setSelectedIds((current) => {
        if (!current.has(item.id)) return current;
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    },
    [performDeleteItem],
  );

  const downloadItem = React.useCallback(async (item: LibraryItem) => {
    try {
      await downloadLibraryItems([item], { hydrateCvDocument });
    } catch (error) {
      console.warn("Failed to download library item", error);
    }
  }, [hydrateCvDocument]);

  const handleCreateProposal = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", { state: createProposalWorkspaceResetState() });
  }, [navigate]);

  const handleImportCv = React.useCallback(() => {
    void navigate("/cv", { state: { cvForgeAction: "importCv" } });
  }, [navigate]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = React.useMemo(
    () =>
      model.items.filter(
        (item) =>
          matchesType(typeFilter, item) && matchesSearch(normalizedSearch, item),
      ),
    [model.items, normalizedSearch, typeFilter],
  );

  const selectedItems = React.useMemo(
    () => model.items.filter((item) => selectedIds.has(item.id)),
    [model.items, selectedIds],
  );
  const selectedDownloadableCount = React.useMemo(
    () => selectedItems.filter(isLibraryItemDownloadable).length,
    [selectedItems],
  );

  const toggleSelected = React.useCallback((itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = React.useCallback(() => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}?`)) {
      return;
    }
    selectedItems.forEach(performDeleteItem);
    clearSelection();
  }, [clearSelection, performDeleteItem, selectedItems]);

  const downloadSelected = React.useCallback(async () => {
    if (selectedItems.length === 0) return;
    try {
      await downloadLibraryItems(selectedItems, { hydrateCvDocument });
    } catch (error) {
      console.warn("Failed to download selected library items", error);
    }
  }, [hydrateCvDocument, selectedItems]);

  const listEntries = React.useMemo<ListEntry[]>(
    () =>
      filteredItems.map((item) => ({
        item,
      })),
    [filteredItems],
  );
  const { loadedPreviewIds, requestPreview } =
    useBatchedProjectPreviewLoader(filteredItems);

  const authStatusMessage = !isLoaded || isConvexAuthLoading
    ? t("projects.loading")
    : !isSignedIn || !isConvexAuthenticated
      ? t("projects.signInHint")
      : null;

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-documents-page projects-page">
        <div className="dasti-page-header dasti-documents-page__head">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title page-head__title">
              {t("projects.title")}
            </h1>
            <p className="dasti-stack__subtitle page-head__sub">
              {t("projects.subtitle")}
            </p>
          </div>
          <div className="dasti-page-actions">
            <Button type="button" variant="secondary" size="md" onClick={handleImportCv}>
              Import CV
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => navigate("/jobs")}>
              Add job
            </Button>
            <Button type="button" variant="primary" size="md" onClick={handleCreateProposal}>
              New proposal
            </Button>
          </div>
        </div>

        <div className="dasti-documents-toolbar projects-toolbar">
          <div className="projects-filter-group" aria-label={t("projects.typeFilter")}>
            <span>{t("projects.type")}</span>
            <div className="library-tabs" role="tablist" aria-label={t("projects.type")}>
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === filter}
                  data-active={typeFilter === filter ? "true" : undefined}
                  onClick={() => updateTypeFilter(filter)}
                >
                  {typeLabelI18n(filter, t)}
                </button>
              ))}
            </div>
          </div>
          <div className="library-tabs projects-view-toggle" role="tablist" aria-label={t("projects.view")}>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "grid"}
              data-active={viewMode === "grid" ? "true" : undefined}
              onClick={() => setViewMode("grid")}
            >
              <SquaresFour size={14} aria-hidden="true" />
              {t("projects.grid")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              data-active={viewMode === "list" ? "true" : undefined}
              onClick={() => setViewMode("list")}
            >
              <List size={14} aria-hidden="true" />
              {t("projects.list")}
            </button>
          </div>
          <label className="dasti-documents-toolbar__search">
            <span className="sr-only">{t("projects.search")}</span>
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder={t("projects.search")}
              aria-label={t("projects.search")}
            />
          </label>
        </div>

        {authStatusMessage ? <p className="dasti-hint">{authStatusMessage}</p> : null}

        {viewMode === "grid" ? (
          filteredItems.length > 0 ? (
            <ProjectSection
              title={t("projects.recentWork")}
              items={filteredItems}
              renderItem={(item, index) => (
                <LibraryItemCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  previewLoaded={loadedPreviewIds.has(item.id)}
                  onRequestPreview={() => requestPreview(item.id)}
                  onOpen={() => openItem(item)}
                  onDelete={() => deleteItem(item)}
                  onDownload={() => downloadItem(item)}
                  onToggleSelected={() => toggleSelected(item.id)}
                />
              )}
            />
          ) : (
            <ProjectsEmptyState
              onImportCv={handleImportCv}
              onAddJob={() => navigate("/jobs")}
              onCreateProposal={handleCreateProposal}
            />
          )
        ) : listEntries.length > 0 ? (
          <ProjectsList
            entries={listEntries}
            selectedIds={selectedIds}
            onOpen={openItem}
            onDelete={deleteItem}
            onDownload={downloadItem}
            onToggleSelected={toggleSelected}
          />
        ) : (
          <ProjectsEmptyState
            onImportCv={handleImportCv}
            onAddJob={() => navigate("/jobs")}
            onCreateProposal={handleCreateProposal}
          />
        )}
        {selectedItems.length > 0 ? (
          <ProjectsBulkActionBar
            selectedCount={selectedItems.length}
            downloadableCount={selectedDownloadableCount}
            onClear={clearSelection}
            onOpen={() => openItem(selectedItems[0])}
            onDownload={downloadSelected}
            onDelete={deleteSelected}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProjectSection<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section className="projects-section" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <div className="projects-section__head">
        <h2 id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2>
        <p>{items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>
      <div className="dasti-documents-grid projects-grid">{items.map(renderItem)}</div>
    </section>
  );
}

function LibraryItemCard({
  item,
  selected,
  previewLoaded,
  onRequestPreview,
  onOpen,
  onDelete,
  onDownload,
  onToggleSelected,
}: {
  item: LibraryItem;
  selected: boolean;
  previewLoaded: boolean;
  onRequestPreview: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onToggleSelected: () => void;
}) {
  const typeLabel = itemTypeLabel(item);
  const specimenTypeLabel = itemSpecimenTypeLabel(item);
  const previewShellRef = React.useRef<HTMLButtonElement | null>(null);
  const shouldRenderPreview = previewLoaded || selected;

  React.useEffect(() => {
    if (previewLoaded) return;
    const node = previewShellRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      onRequestPreview();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRequestPreview();
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onRequestPreview, previewLoaded]);

  return (
    <DocumentSpecimenCard
      as="article"
      className="dasti-documents-card projects-card"
      typeChipClassName="projects-card__type"
      title={item.title}
      context=""
      updatedLabel={formatUpdatedLabel(item.updatedAt)}
      typeLabel={specimenTypeLabel}
      selected={selected}
      showUpdatedLabel={false}
      onCardClick={onOpen}
      previewRef={previewShellRef}
      onPreviewPointerEnter={onRequestPreview}
      onPreviewFocusCapture={onRequestPreview}
      onOpen={onOpen}
      actions={
        <span onClick={(event) => event.stopPropagation()}>
          <Menu
            ariaLabel={`More actions for ${item.title}`}
            align="end"
            sections={[
              {
                items: [
                  {
                    id: "download",
                    label: "Download PDF",
                    icon: <FilePdf size={14} aria-hidden="true" />,
                    disabled: !isLibraryItemDownloadable(item),
                    onSelect: onDownload,
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    icon: <TrashSimple size={14} aria-hidden="true" />,
                    tone: "danger",
                    onSelect: onDelete,
                  },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                className="dasti-documents-card__menu projects-card__menu"
                aria-label={`More actions for ${item.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <DotsThree size={16} aria-hidden="true" />
              </button>
            }
          />
        </span>
      }
      selector={
        <label className="projects-card__select">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${typeLabel.toLowerCase()} ${item.title}`}
            onChange={onToggleSelected}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <span className="projects-card__select-mark" aria-hidden="true">
            {selected ? <Check size={14} strokeWidth={2.2} /> : null}
          </span>
        </label>
      }
    >
      <LibraryDocumentPreview item={item} renderPreview={shouldRenderPreview} />
    </DocumentSpecimenCard>
  );
}

function ProjectsList({
  entries,
  selectedIds,
  onOpen,
  onDelete,
  onDownload,
  onToggleSelected,
}: {
  entries: ListEntry[];
  selectedIds: Set<string>;
  onOpen: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
  onDownload: (item: LibraryItem) => void;
  onToggleSelected: (itemId: string) => void;
}) {
  return (
    <div className="projects-list" role="table" aria-label="Projects list">
      <div className="projects-list__head" role="row">
        <span role="columnheader">Name</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Context</span>
        <span role="columnheader">Updated</span>
        <span role="columnheader">Action</span>
      </div>
      {entries.map((entry) => (
        <ProjectsListRow
          key={entry.item.id}
          item={entry.item}
          selected={selectedIds.has(entry.item.id)}
          onOpen={() => onOpen(entry.item)}
          onDelete={() => onDelete(entry.item)}
          onDownload={() => onDownload(entry.item)}
          onToggleSelected={() => onToggleSelected(entry.item.id)}
        />
      ))}
    </div>
  );
}

function ProjectsListRow({
  item,
  selected,
  onOpen,
  onDelete,
  onDownload,
  onToggleSelected,
}: {
  item: LibraryItem;
  selected: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onToggleSelected: () => void;
}) {
  const type = itemTypeLabel(item);
  const action = item.type === "proposal" ? "Continue" : "Open";
  const context = proposalContext(item);
  return (
    <div
      className="projects-list__row"
      role="row"
      tabIndex={0}
      aria-selected={selected}
      data-selected={selected ? "true" : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span role="cell" className="projects-list__name-cell">
        <label className="projects-list__select">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${type.toLowerCase()} ${item.title}`}
            onChange={onToggleSelected}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </label>
        <span>
          <strong>{item.title}</strong>
          <small>{item.subtitle ?? ""}</small>
        </span>
      </span>
      <span role="cell">{type}</span>
      <span role="cell">{context}</span>
      <span role="cell">{formatUpdatedLabel(item.updatedAt)}</span>
      <span role="cell" className="projects-list__actions">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {action}
        </Button>
        <span onClick={(event) => event.stopPropagation()}>
          <Menu
            ariaLabel={`More actions for ${item.title}`}
            align="end"
            sections={[
              {
                items: [
                  {
                    id: "download",
                    label: "Download PDF",
                    icon: <FilePdf size={14} aria-hidden="true" />,
                    disabled: !isLibraryItemDownloadable(item),
                    onSelect: onDownload,
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    icon: <TrashSimple size={14} aria-hidden="true" />,
                    tone: "danger",
                    onSelect: onDelete,
                  },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                className="dasti-documents-card__menu"
                aria-label={`More actions for ${item.title}`}
              >
                <DotsThree size={16} aria-hidden="true" />
              </button>
            }
          />
        </span>
      </span>
    </div>
  );
}

function ProjectsBulkActionBar({
  selectedCount,
  downloadableCount,
  onClear,
  onOpen,
  onDownload,
  onDelete,
}: {
  selectedCount: number;
  downloadableCount: number;
  onClear: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="projects-bulk-bar"
      role="status"
      aria-live="polite"
      aria-label={`${selectedCount} item${selectedCount === 1 ? "" : "s"} selected`}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection"
      >
        <X size={16} aria-hidden="true" />
      </Button>
      <span>
        {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="projects-bulk-bar__actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={selectedCount !== 1}
          title={
            selectedCount !== 1
              ? "Select one item to open."
              : "Open the selected item."
          }
          onClick={onOpen}
          iconLeft={<ArrowSquareOut size={15} aria-hidden="true" />}
        >
          Open
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={downloadableCount === 0}
          title={
            downloadableCount === 0
              ? "No selected items can be downloaded."
              : selectedCount > downloadableCount
                ? `${selectedCount - downloadableCount} selected item${
                    selectedCount - downloadableCount === 1 ? "" : "s"
                  } cannot be downloaded.`
                : "Download selected PDFs."
          }
          onClick={onDownload}
          iconLeft={<FilePdf size={15} aria-hidden="true" />}
        >
          Download
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          iconLeft={<TrashSimple size={15} aria-hidden="true" />}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function ProjectsEmptyState({
  onImportCv,
  onAddJob,
  onCreateProposal,
}: {
  onImportCv: () => void;
  onAddJob: () => void;
  onCreateProposal: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__title">NO WORK YET.</div>
      <div className="empty-state__desc">
        Import a CV. Add a job. Draft when ready.
      </div>
      <div className="projects-empty-actions">
        <Button type="button" variant="secondary" size="md" onClick={onImportCv}>
          <Upload size={16} aria-hidden="true" />
          Import CV
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onAddJob}>
          <Briefcase size={16} aria-hidden="true" />
          Add job
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onCreateProposal}>
          <FilePlus size={16} aria-hidden="true" />
          New proposal
        </Button>
      </div>
    </div>
  );
}

function LibraryDocumentPreview({
  item,
  renderPreview,
}: {
  item: LibraryItem;
  renderPreview: boolean;
}) {
  const context = proposalContext(item);
  if (!renderPreview) {
    return (
      <div
        className="library-doc-preview library-doc-preview--empty library-doc-preview--deferred"
        data-kind={item.type}
        aria-hidden="true"
      />
    );
  }

  if (item.type === "proposal") {
    return (
      <div
        className="library-doc-preview library-doc-preview--rendered"
        data-kind={item.type}
        aria-hidden="true"
      >
        <div className="library-doc-preview__document-scale">
          <ProposalDocumentRenderer
            content={item.content ?? item.subtitle ?? item.title}
            proposalType="cover_letter"
            templateId="workshop_proposal_margin"
            railTitle={item.title}
            railMeta={context}
            documentTitle={item.title}
            documentMeta={context}
            documentTypography={getProposalDocumentTypography(
              "direct",
              PROJECTS_PROPOSAL_PREVIEW_STYLE,
            )}
            pageWidth={A4_PAGE_WIDTH_PX}
            stylePreset={PROJECTS_PROPOSAL_PREVIEW_STYLE}
            documentThemeVars={serializeProposalDocumentThemeVars(
              resolvePreviewCanonicalAppearance(PROJECTS_PROPOSAL_PREVIEW_STYLE),
            )}
          />
        </div>
      </div>
    );
  }

  if (item.type === "cv" && item.cvDocument) {
    return <LibraryCvDocumentPreview item={item} />;
  }

  return (
    <div
      className="library-doc-preview library-doc-preview--empty"
      data-kind={item.type}
      aria-hidden="true"
    />
  );
}

function LibraryCvDocumentPreview({ item }: { item: LibraryItem }) {
  const cvDocument = item.cvDocument;
  const preview = React.useMemo(() => {
    if (!cvDocument || isLibrarySummaryOnlyCv(cvDocument)) return null;
    const source = buildStyledResumePrintSource({ currentCv: cvDocument });
    return source
      ? {
          data: source.resumeData,
          stylePreset: source.stylePreset,
          resumeTemplateId: source.resumeTemplateId,
          committedPages: source.committedPages?.slice(0, 1),
        }
      : null;
  }, [cvDocument]);

  if (!preview) {
    return (
      <div
        className="library-doc-preview library-doc-preview--empty"
        data-kind={item.type}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="library-doc-preview library-doc-preview--resume-rendered"
      data-kind={item.type}
      aria-hidden="true"
    >
      <div className="library-doc-preview__resume-scale">
        <ResumeTemplateRenderer
          data={preview.data}
          stylePreset={preview.stylePreset}
          resumeTemplateId={preview.resumeTemplateId}
          committedPages={preview.committedPages}
        />
      </div>
    </div>
  );
}

export default DocumentsPage;
