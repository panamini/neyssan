import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button, Card, Menu, Pill } from "../components/ui";
import { ProposalDocumentRenderer } from "../components/proposal-render/ProposalDocumentRenderer";
import ResumeTemplateRenderer from "../features/verbati/resume/ResumeTemplateRenderer";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  DotsThree,
  FilePdf,
  FilePlus,
  Layout,
  PencilLine,
  Target,
  TrashSimple,
  Upload,
} from "../lib/icons";
import { resolveVerbatiStyle } from "../features/verbati/style";
import {
  buildWorkLibraryModel,
  type LibraryProposalRecord,
  type LibraryItem,
  type WorkTarget,
} from "../lib/application-library";
import { readStoredProposalOutputDraft } from "../lib/proposal-output-draft";
import {
  clearStoredProposalWorkspaceState,
  createProposalWorkspaceResetState,
  readStoredProposalComposeDraft,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
import { buildStyledResumePrintSource } from "../lib/document-export-models";
import {
  resolvePreviewCanonicalAppearance,
  serializeProposalDocumentThemeVars,
} from "../lib/layout/documentAppearance";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import {
  downloadLibraryItems,
  isLibraryItemDownloadable,
} from "../lib/library-download";
import {
  clearActiveLocalCvId,
  getLocalCvDocumentById,
} from "../lib/proposal-personalization";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import type { CvDocument } from "../types/cvDocument";

const TODAY_PROPOSAL_PREVIEW_STYLE = resolveVerbatiStyle({
  familyId: "workshop",
  typography: "geist-baskervville",
  palette: "sauge",
});

function formatUpdatedLabel(value: number): string {
  if (!value) return "Recently updated";
  const elapsedMs = Math.max(0, Date.now() - value);
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  if (elapsedMs < hourMs) return "Updated just now";
  if (elapsedMs < dayMs) {
    const hours = Math.max(1, Math.floor(elapsedMs / hourMs));
    return `Updated ${hours}h ago`;
  }
  const days = Math.max(1, Math.floor(elapsedMs / dayMs));
  return `Updated ${days}d ago`;
}

function navigateTarget(
  target: WorkTarget,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (target.kind === "route") {
    navigate(target.to);
  }
}

function uniqueCvs(currentCv: CvDocument | null, cvs: CvDocument[]): CvDocument[] {
  const seen = new Set<string>();
  return [currentCv, ...cvs].filter((cv): cv is CvDocument => {
    if (!cv?.id || seen.has(String(cv.id))) return false;
    seen.add(String(cv.id));
    return true;
  });
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

function itemSourceId(item: LibraryItem): string {
  return item.id.slice(item.id.indexOf(":") + 1);
}

function itemActionLabel(item: LibraryItem): string {
  if (item.type === "cv") return "Open CV";
  if (item.type === "proposal") return "Continue";
  return "Open";
}

function itemTypeLabel(item: LibraryItem): "CV" | "Proposal" | "Job" {
  if (item.type === "cv") return "CV";
  if (item.type === "job") return "Job";
  return "Proposal";
}

function itemContextLabel(item: LibraryItem): string {
  if (item.type === "cv") return "CV profile";
  if (item.type === "job") return "Job";
  const jobPart = item.jobId || item.jobTitle ? "Job linked" : "No job";
  const cvPart = item.linkedCvTitle
    ? `CV: ${item.linkedCvTitle}`
    : item.linkedCvId
      ? "CV linked"
      : "No CV linked";
  return `${jobPart} · ${cvPart}`;
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const { currentCv, currentCvId, cvs, deleteCv } = useCvLibrary();
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const canQueryLiveData =
    isLoaded && Boolean(isSignedIn) && isConvexAuthenticated;
  const proposals = useQuery(
    api.proposalsPublic.default,
    canQueryLiveData ? {} : "skip",
  ) as LibraryProposalRecord[] | undefined;
  const localOutputDraft = React.useMemo(() => readStoredProposalOutputDraft(), []);
  const localComposeDraft = React.useMemo(() => readStoredProposalComposeDraft(), []);
  const cvRecords = React.useMemo(
    () => hydrateLibraryCvDocuments(uniqueCvs(currentCv, cvs)),
    [currentCv, cvs],
  );
  const model = React.useMemo(
    () =>
      buildWorkLibraryModel({
        proposals,
        cvs: cvRecords,
        currentCvId,
        outputDraft: localOutputDraft,
        composeDraft: localComposeDraft,
      }),
    [currentCvId, cvRecords, localComposeDraft, localOutputDraft, proposals],
  );

  const startNewProposal = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    navigate("/proposal", { state: createProposalWorkspaceResetState() });
  }, [navigate]);

  const importCv = React.useCallback(() => {
    navigate("/cv?cvForgeAction=importCv");
  }, [navigate]);

  const deleteItem = React.useCallback(
    (item: LibraryItem) => {
      if (!window.confirm(`Delete ${item.title}?`)) return;
      const id = itemSourceId(item);
      if (item.source === "local") {
        clearStoredProposalWorkspaceState();
        return;
      }
      if (item.type === "cv") {
        deleteCv(id);
        return;
      }
      if (!isConvexAuthenticated) return;
      void deleteProposal({ id: id as Id<"proposals"> });
    },
    [deleteCv, deleteProposal, isConvexAuthenticated],
  );

  const downloadItem = React.useCallback(async (item: LibraryItem) => {
    try {
      await downloadLibraryItems([item]);
    } catch (error) {
      console.warn("Failed to download library item", error);
    }
  }, []);

  const previewItems = model.items.filter(
    (item) => item.type === "proposal" || item.type === "cv",
  );
  const primaryContinueItem = previewItems[0] ?? null;
  const secondaryContinueItems = previewItems.slice(1, 3);
  const continueItemIds = new Set(
    [primaryContinueItem, ...secondaryContinueItems]
      .filter((item): item is LibraryItem => Boolean(item))
      .map((item) => item.id),
  );
  const recentItems = previewItems
    .filter((item) => !continueItemIds.has(item.id))
    .slice(0, 6);

  return (
    <main className="dashboard-page today-page" aria-labelledby="today-title">
      <div className="dashboard-page__inner today-page__inner">
        <header className="dashboard-head today-head">
          <div>
            <h1 id="today-title" className="dashboard-head__title page-head__title">
              Today
            </h1>
            <p className="dashboard-head__sub page-head__sub">
              Pick up the next proposal task and keep the work moving.
            </p>
          </div>
        </header>

        <section className="today-section" aria-labelledby="create-title">
          <SectionHeading
            id="create-title"
            title="Create"
            copy="Start a concrete workflow."
          />
          <div className="today-create-actions">
            <Button
              variant="secondary"
              onClick={importCv}
              iconLeft={<Upload size={16} aria-hidden="true" />}
            >
              Import CV
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/jobs")}
              iconLeft={<Target size={16} aria-hidden="true" />}
            >
              Add job
            </Button>
            <Button
              variant="secondary"
              onClick={startNewProposal}
              iconLeft={<PencilLine size={16} aria-hidden="true" />}
            >
              New proposal
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/templates")}
              iconLeft={<Layout size={16} aria-hidden="true" />}
            >
              Start from template
            </Button>
          </div>
        </section>

        <section className="today-section" aria-labelledby="continue-title">
          <SectionHeading
            id="continue-title"
            title="Continue"
            copy="Pick up the document you recognize."
          />
          {primaryContinueItem ? (
            <div className="today-preview-board">
              <WorkPreviewCard
                item={primaryContinueItem}
                variant="primary"
                onOpen={() => navigateTarget(primaryContinueItem.routeTarget, navigate)}
                onDelete={() => deleteItem(primaryContinueItem)}
                onDownload={() => downloadItem(primaryContinueItem)}
              />
              {secondaryContinueItems.length > 0 ? (
                <div className="today-preview-board__side">
                  {secondaryContinueItems.map((item) => (
                    <WorkPreviewCard
                      key={item.id}
                      item={item}
                      variant="secondary"
                      onOpen={() => navigateTarget(item.routeTarget, navigate)}
                      onDelete={() => deleteItem(item)}
                      onDownload={() => downloadItem(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="today-empty-work">
              <strong>No work yet.</strong>
              <span>Import a CV or start a proposal.</span>
              <div>
                <Button
                  variant="secondary"
                  onClick={importCv}
                  iconLeft={<Upload size={16} aria-hidden="true" />}
                >
                  Import CV
                </Button>
                <Button
                  variant="primary"
                  onClick={startNewProposal}
                  iconLeft={<FilePlus size={16} aria-hidden="true" />}
                >
                  New proposal
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="today-section" aria-labelledby="recent-work-title">
          <SectionHeading
            id="recent-work-title"
            title="Recent work"
            copy="Recent CVs and proposals."
          />
          {recentItems.length > 0 ? (
            <div className="today-recent-grid">
              {recentItems.map((item) => (
                    <WorkPreviewCard
                      key={item.id}
                      item={item}
                  variant="compact"
                  onOpen={() => navigateTarget(item.routeTarget, navigate)}
                  onDelete={() => deleteItem(item)}
                  onDownload={() => downloadItem(item)}
                    />
                  ))}
            </div>
          ) : (
            <p className="dash-tip">No recent work yet.</p>
          )}
        </section>

      </div>
    </main>
  );
}

function SectionHeading({
  id,
  title,
  copy,
}: {
  id: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="today-section__head">
      <h2 id={id}>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function WorkDocumentPreview({
  item,
  scale = "default",
}: {
  item: LibraryItem;
  scale?: "default" | "small";
}) {
  const context = itemContextLabel(item);
  if (item.type === "proposal") {
    return (
      <div
        className="work-doc-preview work-doc-preview--rendered"
        data-kind={item.type}
        data-scale={scale}
        aria-hidden="true"
      >
        <div className="work-doc-preview__document-scale">
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
              TODAY_PROPOSAL_PREVIEW_STYLE,
            )}
            pageWidth={A4_PAGE_WIDTH_PX}
            stylePreset={TODAY_PROPOSAL_PREVIEW_STYLE}
            documentThemeVars={serializeProposalDocumentThemeVars(
              resolvePreviewCanonicalAppearance(TODAY_PROPOSAL_PREVIEW_STYLE),
            )}
          />
        </div>
      </div>
    );
  }

  if (item.type === "cv" && item.cvDocument) {
    return <WorkCvDocumentPreview item={item} scale={scale} />;
  }

  return (
    <div
      className="work-doc-preview work-doc-preview--empty"
      data-kind={item.type}
      data-scale={scale}
      aria-hidden="true"
    />
  );
}

function WorkCvDocumentPreview({
  item,
  scale,
}: {
  item: LibraryItem;
  scale: "default" | "small";
}) {
  const cvDocument = item.cvDocument;
  const preview = React.useMemo(() => {
    if (!cvDocument) return null;
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
        className="work-doc-preview work-doc-preview--empty"
        data-kind={item.type}
        data-scale={scale}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="work-doc-preview work-doc-preview--resume-rendered"
      data-kind={item.type}
      data-scale={scale}
      aria-hidden="true"
    >
      <div className="work-doc-preview__resume-scale">
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

function WorkPreviewCard({
  item,
  variant,
  onOpen,
  onDelete,
  onDownload,
}: {
  item: LibraryItem;
  variant: "primary" | "secondary" | "compact";
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const label = itemTypeLabel(item);
  return (
    <Card interactive className="today-preview-card" data-variant={variant}>
      <div className="today-preview-card__menu">
        <Menu
          ariaLabel={`More actions for ${item.title}`}
          align="end"
          sections={[
            {
              items: [
                { id: "open", label: itemActionLabel(item), onSelect: onOpen },
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
      </div>
      <button type="button" className="today-preview-card__surface" onClick={onOpen}>
        <WorkDocumentPreview item={item} scale={variant === "compact" ? "small" : "default"} />
        <span className="today-preview-card__meta">
          <span className="ds-card__eyebrow">{label}</span>
          <strong>{item.title}</strong>
          <small>{itemContextLabel(item)}</small>
          <span className="today-preview-card__bottom">
            <span>{formatUpdatedLabel(item.updatedAt)}</span>
            <span>{itemActionLabel(item)}</span>
          </span>
        </span>
      </button>
    </Card>
  );
}

export default DashboardPage;
