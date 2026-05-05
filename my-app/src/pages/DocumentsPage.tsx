import React from "react";
import { useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Card, CardBody, CardFooter, CardTitle, Input, Menu, Pill, type PillTone } from "../components/ui";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { formatCvDisplaySubtitle } from "../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  readStoredProposalComposeDraft,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { readStoredProposalOutputDraft } from "../lib/proposal-output-draft";
import { clearActiveLocalCvId } from "../lib/proposal-personalization";
import { DotsThree } from "../lib/icons";
import type { CvDocument } from "../types/cvDocument";

const DOCUMENT_TABS = ["all", "proposals", "cvs", "drafts"] as const;
type DocumentTab = (typeof DOCUMENT_TABS)[number];

type ProposalRecord = {
  _id: Id<"proposals">;
  _creationTime: number;
  title?: string;
  content?: string;
  status?: string;
  updatedAt?: number;
  metadata?: {
    voicePreset?: string | null;
    sourceJobDescription?: string | null;
  } | null;
};

type DocumentItem = {
  id: string;
  kind: "proposal" | "cv" | "draft";
  eyebrow: string;
  title: string;
  body: string;
  updatedAt: number;
  status: string;
  onOpen: () => void;
  onDelete?: () => void;
};

function normalizeTitle(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function textSnippet(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim().slice(0, 160) || fallback;
}

function cvUpdatedAt(cv: CvDocument): number {
  const value = cv.metadata?.updatedAt ?? cv.metadata?.createdAt;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function tabLabel(tab: DocumentTab): string {
  if (tab === "cvs") return "CVs";
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function documentStatusTone(item: DocumentItem, currentCvId: string | null): PillTone {
  if (item.kind === "draft") return "warning";
  if (item.kind === "cv") {
    return currentCvId === item.id ? "success" : "neutral";
  }
  return "neutral";
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
  if (elapsedMs < 12 * monthMs) {
    const months = Math.max(1, Math.floor(elapsedMs / monthMs));
    return `Updated ${months} ${months === 1 ? "month" : "months"} ago`;
  }
  return `Updated ${new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
}

export function DocumentsPage(): JSX.Element {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const proposals = useQuery(
    api.proposalsPublic.default,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as ProposalRecord[] | undefined;
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const { cvs, currentCvId, loadCv, deleteCv } = useCvLibrary();
  const [activeTab, setActiveTab] = React.useState<DocumentTab>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleCreateProposal = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", { state: createProposalWorkspaceResetState() });
  }, [navigate]);

  const handleImportCv = React.useCallback(() => {
    void navigate("/cv", { state: { cvForgeAction: "importCv" } });
  }, [navigate]);

  const items = React.useMemo<DocumentItem[]>(() => {
    const proposalItems = (proposals ?? [])
      .filter(
        (proposal) => proposal.status === "draft" || proposal.status === "saved",
      )
      .map<DocumentItem>((proposal) => {
        const isDraft = proposal.status === "draft";
        return {
          id: String(proposal._id),
          kind: isDraft ? "draft" : "proposal",
          eyebrow: isDraft ? "Draft" : "Proposal",
          title: normalizeTitle(
            proposal.title,
            isDraft ? "Draft proposal" : "Untitled proposal",
          ),
          body: textSnippet(
            proposal.content,
            isDraft
              ? "Generated draft saved to the library."
              : "Cover letter saved to the library.",
          ),
          updatedAt: proposal.updatedAt ?? proposal._creationTime,
          status: isDraft ? "Draft" : "Saved",
          onOpen: () =>
            navigate(
              isDraft
                ? `/proposal?draftId=${encodeURIComponent(String(proposal._id))}`
                : `/proposal?view=saved&id=${encodeURIComponent(String(proposal._id))}`,
            ),
          onDelete: () => {
            if (!isConvexAuthenticated || isConvexAuthLoading) return;
            void deleteProposal({ id: proposal._id });
          },
        };
      });

    const cvItems = cvs.map<DocumentItem>((cv) => ({
      id: String(cv.id),
      kind: "cv",
      eyebrow: "CV",
      title: normalizeTitle(cv.title, "Untitled CV"),
      body: formatCvDisplaySubtitle({ title: String(cv.title ?? "") }) ||
        "Resume variant kept in your CV library.",
      updatedAt: cvUpdatedAt(cv),
      status: currentCvId === String(cv.id) ? "Active" : "Saved",
      onOpen: () => {
        const opened = loadCv(String(cv.id));
        if (opened) {
          void navigate(`/cv?id=${encodeURIComponent(String(cv.id))}`);
          return;
        }
        void navigate(`/cv?id=${encodeURIComponent(String(cv.id))}`);
      },
      onDelete: () => deleteCv(String(cv.id)),
    }));

    const outputDraft = readStoredProposalOutputDraft();
    const composeDraft = readStoredProposalComposeDraft();
    const draftTitle = normalizeTitle(
      outputDraft?.proposalDocumentTitle ?? composeDraft?.jobTitle,
      "Proposal draft",
    );
    const draftContent = textSnippet(
      outputDraft?.proposalContent ?? composeDraft?.jobDescription,
      "Draft in progress.",
    );
    const draftItems: DocumentItem[] =
      outputDraft || composeDraft
        ? [
            {
              id: "proposal-draft",
              kind: "draft",
              eyebrow: "Draft",
              title: draftTitle,
              body: draftContent,
              updatedAt: Date.now(),
              status: "Drafting",
              onOpen: () => navigate("/proposal"),
            },
          ]
        : [];

    return [...draftItems, ...proposalItems, ...cvItems].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }, [cvs, currentCvId, deleteCv, deleteProposal, isConvexAuthLoading, isConvexAuthenticated, loadCv, navigate, proposals]);

  const filteredItems = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab === "proposals" && item.kind !== "proposal") return false;
      if (activeTab === "cvs" && item.kind !== "cv") return false;
      if (activeTab === "drafts" && item.kind !== "draft") return false;
      if (!normalizedQuery) return true;
      return [item.eyebrow, item.title, item.body, item.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeTab, items, searchQuery]);

  const authStatusMessage = !isLoaded || isConvexAuthLoading
    ? "Loading documents."
    : !isSignedIn || !isConvexAuthenticated
      ? "Sign in to sync saved proposals. Local CVs and drafts still appear here."
      : null;

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-documents-page">
        <div className="dasti-page-header dasti-documents-page__head">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title page-head__title">Documents</h1>
            <p className="dasti-stack__subtitle page-head__sub">Proposals, CVs, and drafts you have created.</p>
          </div>
          <div className="dasti-page-actions">
            <Button type="button" variant="secondary" size="md" onClick={handleImportCv}>
              Import CV
            </Button>
            <Button type="button" variant="primary" size="md" onClick={handleCreateProposal}>
              New proposal
            </Button>
          </div>
        </div>

        <div className="dasti-documents-toolbar">
          <div className="library-tabs" role="tablist" aria-label="Document type">
            {DOCUMENT_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                data-active={activeTab === tab ? "true" : undefined}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
          <label className="dasti-documents-toolbar__search">
            <span className="sr-only">Search documents</span>
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search documents"
              aria-label="Search documents"
            />
          </label>
        </div>

        {authStatusMessage ? <p className="dasti-hint">{authStatusMessage}</p> : null}

        {filteredItems.length > 0 ? (
          <div className="dasti-documents-grid" aria-label="Documents">
            {filteredItems.map((item) => (
              <Card key={`${item.kind}:${item.id}`} as="article" interactive className="dasti-documents-card">
                <div className="dasti-documents-card__top">
                  <span className="ds-card__eyebrow dasti-library-card__eyebrow">{item.eyebrow}</span>
                  <Menu
                    ariaLabel={`More actions for ${item.title}`}
                    align="end"
                    sections={[
                      {
                        items: [
                          { id: "open", label: "Open", onSelect: item.onOpen },
                          ...(item.onDelete
                            ? [{ id: "delete", label: "Delete", tone: "danger" as const, onSelect: item.onDelete }]
                            : []),
                        ],
                      },
                    ]}
                    trigger={
                      <button
                        type="button"
                        className="dasti-documents-card__menu"
                        aria-label={`More actions for ${item.title}`}
                        title={`More actions for ${item.title}`}
                      >
                        <DotsThree size={16} strokeWidth={1.7} aria-hidden="true" />
                      </button>
                    }
                  />
                </div>
                <button
                  type="button"
                  className="dasti-documents-card__surface"
                  onClick={item.onOpen}
                >
                  <CardTitle className="dasti-library-card__title">{item.title}</CardTitle>
                  <CardBody className="dasti-library-card__body">{item.body}</CardBody>
                </button>
                <CardFooter className="dasti-library-card__footer">
                  <span>{formatUpdatedLabel(item.updatedAt)}</span>
                  <Pill tone={documentStatusTone(item, currentCvId)}>{item.status}</Pill>
                </CardFooter>
              </Card>
            ))}
            <Card interactive className="dasti-documents-card dasti-documents-card--new">
              <button type="button" onClick={handleCreateProposal}>
                New document
              </button>
            </Card>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__title">No documents yet.</div>
            <div className="empty-state__desc">
              Import a CV or start a proposal. Both will appear here with drafts and saved documents.
            </div>
            <Button type="button" variant="primary" size="md" onClick={handleImportCv}>
              Import CV
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentsPage;
