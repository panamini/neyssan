import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { useCvForgeTopbarRegistration } from "../contexts/CvForgeTopbarContext";
import { useProposalForgeTopbarRegistration } from "../contexts/ProposalForgeTopbarContext";
import { IconButton, Menu } from "./ui";
import CvShareMenu from "./cv/CvShareMenu";
import DocumentTitleEditor from "./DocumentTitleEditor";
import {
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
  readStoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import {
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
  readStoredProposalOutputDraft,
} from "../lib/proposal-output-draft";
import { readStoredSavedProposalFixtures } from "../lib/proposal-saved-fixtures";
import { resolveCommandShortcutLabel } from "../lib/app-topbar";
import { translateUi } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";
import {
  ChevronDown,
  ClipboardText,
  Copy,
  DotsThree,
  FilePdf,
  FileText,
  FileUser,
  MagnifyingGlass,
  Plus,
  ShareFat,
  TrashSimple,
  Upload,
  User,
} from "../lib/icons";

function normalizeTitle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAccountInitial(user: ReturnType<typeof useUser>["user"]): string {
  const candidate =
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    "";
  return candidate.charAt(0).toUpperCase() || "U";
}

function useTopbarDocumentTitle(): string | null {
  const location = useLocation();
  const { currentCv, currentCvId, cvs } = useCvLibrary();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [composeDraftToken, setComposeDraftToken] = React.useState(0);
  const [outputDraftToken, setOutputDraftToken] = React.useState(0);
  const proposals = useQuery(
    api.proposalsPublic.default,
    isAuthenticated && !isLoading ? {} : "skip",
  );

  React.useEffect(() => {
    const handleComposeDraft = () => setComposeDraftToken((current) => current + 1);
    const handleOutputDraft = () => setOutputDraftToken((current) => current + 1);

    window.addEventListener(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT, handleComposeDraft);
    window.addEventListener(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT, handleOutputDraft);
    return () => {
      window.removeEventListener(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT, handleComposeDraft);
      window.removeEventListener(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT, handleOutputDraft);
    };
  }, []);

  return React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const pathname = location.pathname;
    const cvCount = (() => {
      const ids = new Set(cvs.map((cv) => String(cv.id)));
      if (currentCvId) {
        ids.add(String(currentCvId));
      } else if (currentCv?.id) {
        ids.add(String(currentCv.id));
      }
      return ids.size;
    })();
    const proposalCount =
      (proposals ?? readStoredSavedProposalFixtures()).filter(
        (proposal) =>
          proposal.status === "saved" || proposal.status === "draft",
      ).length;

    if (pathname === "/cv" || pathname === "/style") {
      return normalizeTitle(currentCv?.title) || null;
    }

    if (pathname === "/cvs" || pathname === "/documents") {
      return cvCount > 0 ? `All resumes (${cvCount})` : "All resumes";
    }

    if (pathname === "/proposal") {
      const selectedProposalId = normalizeTitle(params.get("id"));
      const selectedProposalTitle =
        selectedProposalId &&
        [...(proposals ?? []), ...readStoredSavedProposalFixtures()].find(
          (proposal) => String(proposal._id) === selectedProposalId,
        )?.title;
      const outputDraftTitle = normalizeTitle(
        readStoredProposalOutputDraft()?.proposalDocumentTitle,
      );
      const composeDraftTitle = normalizeTitle(
        readStoredProposalComposeDraft()?.jobTitle,
      );

      return (
        normalizeTitle(selectedProposalTitle) ||
        outputDraftTitle ||
        composeDraftTitle ||
        null
      );
    }

    if (pathname === "/proposals") {
      return proposalCount > 0
        ? `All proposals (${proposalCount})`
        : "All proposals";
    }

    if (pathname === "/templates") {
      return "Document templates";
    }

    if (pathname === "/settings") {
      return "Proposal defaults";
    }

    return null;
  }, [
    composeDraftToken,
    currentCv?.id,
    currentCv?.title,
    currentCvId,
    cvs,
    location.pathname,
    location.search,
    outputDraftToken,
    proposals,
  ]);
}

function useBrowserTitle(topbarDocumentTitle: string | null): void {
  const location = useLocation();

  React.useEffect(() => {
    const pathname = location.pathname;
    let pageTitle = "two weeks";

    if (pathname === "/cv") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · Resume · two weeks`
        : "Resume · two weeks";
    } else if (pathname === "/dashboard" || pathname === "/") {
      pageTitle = "Today · two weeks";
    } else if (pathname === "/cvs") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · two weeks`
        : "All resumes · two weeks";
    } else if (pathname === "/proposal") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · Cover letter · two weeks`
        : "Cover letter · two weeks";
    } else if (pathname === "/proposals") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · two weeks`
        : "All proposals · two weeks";
    } else if (pathname === "/documents") {
      pageTitle = "Projects · two weeks";
    } else if (pathname === "/templates") {
      pageTitle = "Templates · two weeks";
    } else if (pathname === "/settings") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · two weeks`
        : "Proposal defaults · two weeks";
    } else if (pathname.startsWith("/jobs")) {
      pageTitle = "Jobs · two weeks";
    } else if (pathname === "/style") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · Style Forge · two weeks`
        : "Style Forge · two weeks";
    }

    document.title = pageTitle;
  }, [location.pathname, topbarDocumentTitle]);
}

export function TopbarTitleSync(): null {
  const topbarDocumentTitle = useTopbarDocumentTitle();
  useBrowserTitle(topbarDocumentTitle);
  return null;
}

function resolvePageLabel(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "Today";
  if (pathname.startsWith("/jobs")) return "Jobs";
  if (pathname.startsWith("/proposal")) return "Proposal forge";
  if (pathname.startsWith("/cv")) return "CV forge";
  if (pathname.startsWith("/cvs")) return "CV library";
  if (pathname.startsWith("/documents")) return "Projects";
  if (pathname.startsWith("/proposals")) return "Projects";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/style")) return "Templates";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Today";
}

function resolveProposalStateLabel(
  state: string | null | undefined,
): string {
  if (state === "saving") return "Saving…";
  if (state === "error") return "Save error";
  if (state === "draft") return "Autosaved";
  return "Saved";
}

export function AppTopbar({
  commandPaletteOpen,
  onOpenCommandPalette,
}: {
  commandPaletteOpen: boolean;
  onOpenCommandPalette: () => void;
}): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const topbarDocumentTitle = useTopbarDocumentTitle();
  const cvTopbarRegistration = useCvForgeTopbarRegistration();
  const proposalTopbarRegistration = useProposalForgeTopbarRegistration();
  const { resolvedLanguage } = useUiLanguagePreference();
  const pageLabel = resolvePageLabel(location.pathname);
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const isAccountReady = isAuthLoaded !== false;
  const shortcutLabel = React.useMemo(
    () => resolveCommandShortcutLabel(window.navigator.platform),
    [],
  );
  const clerkUserButtonRef = React.useRef<HTMLDivElement | null>(null);
  const openCommandPaletteLabel = translateUi(
    resolvedLanguage,
    "topbar.openCommandPalette",
  );
  const searchOrRunCommandLabel = translateUi(
    resolvedLanguage,
    "topbar.searchOrRunCommand",
  );

  const handleProfile = React.useCallback(() => {
    const clerkTrigger =
      clerkUserButtonRef.current?.querySelector<HTMLButtonElement>("button");
    if (clerkTrigger) {
      clerkTrigger.click();
      return;
    }
    if (!isAccountReady) {
      return;
    }
    if (!isSignedIn) {
      void navigate("/sign-in");
    }
  }, [isAccountReady, isSignedIn, navigate]);
  const cvDocumentStateLabel = cvTopbarRegistration?.exporting
    ? "Exporting PDF"
    : cvTopbarRegistration?.hasCurrentCv
      ? "Autosaved"
      : "No CV";
  const cvPageCountLabel =
    typeof cvTopbarRegistration?.pageCount === "number" &&
    cvTopbarRegistration.pageCount >= 2
      ? `${cvTopbarRegistration.pageCount} pages`
      : null;
  const cvAtsAudit = cvTopbarRegistration?.atsAudit ?? null;
  const cvAtsBadge =
    cvAtsAudit === null
      ? null
      : cvAtsAudit.verdict === "blocked"
        ? {
            state: "danger" as const,
            tooltip: "ATS blocked",
          }
        : cvAtsAudit.verdict === "needs_review"
          ? {
              state: "warn" as const,
              tooltip: "ATS issues found",
            }
          : {
              state: "success" as const,
              tooltip: "ATS audit looks good",
            };
  const shouldShowImportReviewChip = Boolean(
    cvTopbarRegistration &&
      cvAtsBadge === null &&
      cvTopbarRegistration.importIssueCount > 0 &&
      !cvTopbarRegistration.importReviewBannerVisible,
  );
  const cvDocumentTitleMain =
    cvTopbarRegistration?.documentTitle?.trim() ||
    topbarDocumentTitle?.trim() ||
    "Untitled CV";
  const cvDocumentTitlePlaceholder =
    cvTopbarRegistration?.titlePlaceholder?.trim() || "Untitled CV";
  const cvDocumentIdentityLabel = cvDocumentTitleMain;
  const proposalDocumentTitleMain =
    proposalTopbarRegistration?.documentTitle?.trim() ||
    topbarDocumentTitle?.trim() ||
    "Untitled proposal";
  const proposalDocumentTitlePlaceholder =
    proposalTopbarRegistration?.titlePlaceholder?.trim() ||
    "Untitled proposal";
  const proposalDocumentIdentityLabel = proposalDocumentTitleMain;
  const proposalDocumentState =
    proposalTopbarRegistration?.documentState ?? "draft";
  const proposalDocumentStateLabel =
    resolveProposalStateLabel(proposalDocumentState);
  const isForgeDocumentRoute =
    location.pathname === "/cv" || location.pathname === "/proposal";
  const documentRoute =
    location.pathname === "/proposal"
      ? "proposal"
      : location.pathname === "/cv"
        ? "cv"
        : undefined;
  return (
    <header className="app-topbar" data-document-route={documentRoute}>
      <div className="app-topbar__identity">
        {isForgeDocumentRoute ? null : (
          <div className="app-topbar__crumb" aria-label="Breadcrumb">
            <span>twoweeks</span>
            <span className="app-topbar__crumb-sep">/</span>
            <strong className="app-topbar__crumb-current">{pageLabel}</strong>
          </div>
        )}
        {location.pathname === "/cv" ? (
          <div className="app-topbar__doc-identity-group">
            <div
              className="app-topbar__doc-identity"
              aria-label={cvDocumentIdentityLabel}
              title={cvDocumentIdentityLabel}
            >
              <span
                className="app-topbar__doc-state"
                data-state={
                  cvTopbarRegistration?.exporting
                    ? "exporting"
                    : cvTopbarRegistration?.hasCurrentCv
                      ? "saved"
                      : "missing"
                }
                aria-label={cvDocumentStateLabel}
                title={cvDocumentStateLabel}
              >
                <span
                  className="app-topbar__doc-dot"
                  data-pulsing={
                    cvTopbarRegistration?.exporting ? "true" : undefined
                  }
                  aria-hidden="true"
                />
                <FileText
                  className="app-topbar__icon"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
              <DocumentTitleEditor
                className="app-topbar__doc-title"
                documentTitle={cvDocumentTitleMain}
                titlePlaceholder={cvDocumentTitlePlaceholder}
                ariaLabel="CV title"
                onTitleCommit={(nextTitle) => {
                  cvTopbarRegistration?.onTitleCommit?.(nextTitle);
                }}
                disabled={
                  !cvTopbarRegistration?.hasCurrentCv ||
                  !cvTopbarRegistration.onTitleCommit
                }
              />
              <span className="app-topbar__doc-save-label">
                {cvDocumentStateLabel}
              </span>
              {cvPageCountLabel ? (
                <span className="app-topbar__doc-meta">
                  {cvPageCountLabel}
                </span>
              ) : null}
            </div>
            {cvTopbarRegistration ? (
              <>
                <span className="dasti-toolbar__divider app-topbar__doc-divider" aria-hidden="true" />
                <Menu
                  ariaLabel="Create CV"
                  align="start"
                  sections={[
                    {
                      items: [
                        {
                          id: "new-cv",
                          label: "New CV",
                          icon: (
                            <Plus className="app-topbar__icon" strokeWidth={1.8} />
                          ),
                          onSelect: cvTopbarRegistration.onNewCv,
                        },
                        {
                          id: "import-pdf",
                          label: "Import PDF",
                          icon: (
                            <Upload
                              className="app-topbar__icon"
                              strokeWidth={1.8}
                            />
                          ),
                          onSelect: cvTopbarRegistration.onImportCv,
                        },
                      ],
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="app-topbar__doc-action app-topbar__doc-action--new"
                      data-toolbar-tooltip="New"
                    >
                      <Plus
                        className="app-topbar__icon"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                      <span className="app-topbar__doc-action-label">New</span>
                      <ChevronDown
                        className="app-topbar__doc-action-caret app-topbar__icon--compact"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  }
                />
                <Menu
                  ariaLabel="Switch resume"
                  align="start"
                  menuClassName="app-topbar__doc-picker-menu"
                  sections={[
                    {
                      label: "Resumes",
                      items:
                        (cvTopbarRegistration.resumeOptions ?? []).length > 0
                          ? (cvTopbarRegistration.resumeOptions ?? []).map(
                              (option) => ({
                                id: option.id,
                                role: "menuitemradio" as const,
                                selected: option.selected,
                                label: option.title,
                                description:
                                  option.description ?? "Saved resume.",
                                onSelect: () =>
                                  cvTopbarRegistration.onPickResume?.(
                                    option.id,
                                  ),
                              }),
                            )
                          : [
                              {
                                id: "no-resumes",
                                label: "No resumes",
                                description: "Create or import a CV first.",
                                disabled: true,
                              },
                            ],
                    },
                    {
                      items: [
                        {
                          id: "open-cv-library",
                          label: "Open CV library",
                          icon: (
                            <FileUser
                              className="app-topbar__icon"
                              strokeWidth={1.8}
                            />
                          ),
                          onSelect: () => {
                            void navigate("/cvs");
                          },
                        },
                      ],
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="app-topbar__doc-picker"
                      aria-label="Switch resume"
                      data-toolbar-tooltip="Switch resume"
                    >
                      <FileUser
                        className="app-topbar__doc-picker-icon app-topbar__icon"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span className="app-topbar__doc-picker-label">
                        Resume
                      </span>
                      <ChevronDown
                        className="app-topbar__doc-picker-caret app-topbar__icon--compact"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  }
                />
                <Menu
                  ariaLabel="CV actions"
                  align="start"
                  sections={[
                    {
                      items: [
                        {
                          id: "duplicate-cv",
                          label: "Duplicate CV",
                          icon: <Copy className="app-topbar__icon" strokeWidth={1.8} />,
                          disabled: !cvTopbarRegistration.hasCurrentCv,
                          onSelect: cvTopbarRegistration.onDuplicateCv,
                        },
                        {
                          id: "delete-cv",
                          label: "Delete CV",
                          icon: (
                            <TrashSimple
                              className="app-topbar__icon"
                              strokeWidth={1.8}
                            />
                          ),
                          tone: "danger",
                          disabled: !cvTopbarRegistration.hasCurrentCv,
                          onSelect: cvTopbarRegistration.onDeleteCv,
                        },
                      ],
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="app-topbar__doc-action app-topbar__doc-action--more"
                      aria-label="CV actions"
                      data-toolbar-tooltip="CV actions"
                    >
                      <DotsThree
                        className="app-topbar__icon"
                        weight="bold"
                        aria-hidden="true"
                      />
                    </button>
                  }
                />
              </>
            ) : null}
          </div>
        ) : location.pathname === "/proposal" ? (
          <div className="app-topbar__doc-identity-group app-topbar__doc-identity-group--proposal">
            <div
              className="app-topbar__doc-identity"
              aria-label={proposalDocumentIdentityLabel}
              title={proposalDocumentIdentityLabel}
            >
              <span
                className="app-topbar__doc-state"
                data-state={proposalDocumentState}
                aria-label={proposalDocumentStateLabel}
                title={proposalDocumentStateLabel}
              >
                <span
                  className="app-topbar__doc-dot"
                  data-pulsing={
                    proposalDocumentState === "saving" ||
                    proposalDocumentState === "generating" ||
                    proposalDocumentState === "exporting"
                      ? "true"
                      : undefined
                  }
                  aria-hidden="true"
                />
                <FileText
                  className="app-topbar__icon"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
              <DocumentTitleEditor
                className="app-topbar__doc-title"
                documentTitle={proposalDocumentTitleMain}
                titlePlaceholder={proposalDocumentTitlePlaceholder}
                ariaLabel="Proposal title"
                onTitleCommit={(nextTitle) => {
                  proposalTopbarRegistration?.onTitleCommit(nextTitle);
                }}
                disabled={!proposalTopbarRegistration?.onTitleCommit}
              />
              <span className="app-topbar__doc-save-label">
                {proposalDocumentStateLabel}
              </span>
              {proposalTopbarRegistration?.lengthLabel ? (
                <span className="app-topbar__doc-meta">
                  {proposalTopbarRegistration.lengthLabel}
                </span>
              ) : null}
            </div>
            {proposalTopbarRegistration ? (
              <>
                <span className="dasti-toolbar__divider app-topbar__doc-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="app-topbar__doc-action app-topbar__doc-action--new app-topbar__doc-action--proposal-new"
                  data-has-content={
                    proposalTopbarRegistration.hasProposalContent ? "true" : undefined
                  }
                  data-has-job-context={
                    proposalTopbarRegistration.hasJobContext ? "true" : undefined
                  }
                  aria-label="New proposal"
                  onClick={proposalTopbarRegistration.onNewProposal}
                >
                  <Plus
                    className="app-topbar__icon"
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  <span className="app-topbar__doc-action-label">New</span>
                </button>
                <Menu
                  ariaLabel="Proposal actions"
                  align="start"
                  sections={[
                    {
                      items: [
                        {
                          id: "duplicate-proposal",
                          label: "Duplicate proposal",
                          icon: <Copy className="app-topbar__icon" strokeWidth={1.8} />,
                          disabled:
                            !proposalTopbarRegistration.hasProposalContent,
                          onSelect:
                            proposalTopbarRegistration.onDuplicateProposal,
                        },
                        {
                          id: "delete-proposal",
                          label: "Delete proposal",
                          icon: (
                            <TrashSimple
                              className="app-topbar__icon"
                              strokeWidth={1.8}
                            />
                          ),
                          tone: "danger",
                          disabled:
                            !proposalTopbarRegistration.hasProposalContent,
                          onSelect: proposalTopbarRegistration.onDeleteProposal,
                        },
                      ],
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      className="app-topbar__doc-action app-topbar__doc-action--more"
                      aria-label="Proposal actions"
                      data-toolbar-tooltip="Proposal actions"
                    >
                      <DotsThree
                        className="app-topbar__icon"
                        weight="bold"
                        aria-hidden="true"
                      />
                    </button>
                  }
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="app-topbar__spacer" />
      <div className="app-topbar__actions">
        <button
          type="button"
          className="app-topbar__cmdk"
          aria-label={openCommandPaletteLabel}
          aria-expanded={commandPaletteOpen}
          onClick={onOpenCommandPalette}
        >
          <MagnifyingGlass
            className="app-topbar__cmdk-icon app-topbar__icon"
            aria-hidden="true"
          />
          <span className="app-topbar__cmdk-label">
            {searchOrRunCommandLabel}
          </span>
          <span className="app-topbar__kbd">{shortcutLabel}</span>
        </button>
        <span
          className="dasti-toolbar__divider app-topbar__toolbar-divider app-topbar__toolbar-divider--actions"
          aria-hidden="true"
        />
        {location.pathname === "/cv" && cvTopbarRegistration ? (
          <>
            {shouldShowImportReviewChip ? (
              <button
                type="button"
                className="app-topbar__doc-health"
                data-state="warn"
                data-actionable="true"
                aria-label="Review needed"
                data-toolbar-tooltip="Open import review"
                onClick={cvTopbarRegistration.onOpenImportReview}
              >
                <span className="app-topbar__doc-health-mark" aria-hidden="true">
                  Review
                </span>
                <span className="app-topbar__doc-health-label">
                  Review needed
                </span>
              </button>
            ) : null}
            {cvAtsBadge ? (
              <button
                type="button"
                className="app-topbar__doc-health"
                data-state={cvAtsBadge.state}
                data-actionable="true"
                aria-label={cvAtsBadge.tooltip}
                data-toolbar-tooltip={cvAtsBadge.tooltip}
                onClick={cvTopbarRegistration.onOpenAtsAudit}
              >
                <span className="app-topbar__doc-health-mark" aria-hidden="true">
                  ATS
                </span>
              </button>
            ) : null}
            <CvShareMenu
              mode={cvTopbarRegistration.mode}
              hasCurrentCv={cvTopbarRegistration.hasCurrentCv}
              importIssueCount={cvTopbarRegistration.importIssueCount}
              exporting={cvTopbarRegistration.exporting}
              triggerClassName="dasti-icon-button app-topbar__share"
              showTriggerLabel
              onOpenImportReview={cvTopbarRegistration.onOpenImportReview}
              onExportPdf={cvTopbarRegistration.onExportPdf}
              onExportDocx={cvTopbarRegistration.onExportDocx}
            />
            <span
              className="dasti-toolbar__divider app-topbar__toolbar-divider app-topbar__toolbar-divider--actions"
              aria-hidden="true"
            />
          </>
        ) : null}
        {location.pathname === "/proposal" && proposalTopbarRegistration ? (
          <>
            <Menu
              ariaLabel="Share proposal"
              align="end"
              sections={[
                {
                  items: [
                    {
                      id: "copy-text",
                      label: "Copy text",
                      icon: (
                        <ClipboardText
                          className="app-topbar__icon"
                          strokeWidth={1.8}
                        />
                      ),
                      disabled: !proposalTopbarRegistration.hasProposalContent,
                      onSelect: proposalTopbarRegistration.onCopyText,
                    },
                    {
                      id: "download-pdf",
                      label: "Download PDF",
                      icon: (
                        <FilePdf
                          className="app-topbar__icon"
                          strokeWidth={1.8}
                        />
                      ),
                      disabled:
                        !proposalTopbarRegistration.hasProposalContent ||
                        proposalTopbarRegistration.exporting,
                      onSelect: () => proposalTopbarRegistration.onExportPdf("styled"),
                    },
                    {
                      id: "download-docx",
                      label: "Download DOCX",
                      icon: (
                        <FileText
                          className="app-topbar__icon"
                          strokeWidth={1.8}
                        />
                      ),
                      disabled:
                        !proposalTopbarRegistration.hasProposalContent ||
                        proposalTopbarRegistration.exporting,
                      onSelect: proposalTopbarRegistration.onExportDocx,
                    },
                    ...(proposalTopbarRegistration.savedShareAvailable &&
                    proposalTopbarRegistration.onShareSavedProposal
                      ? [
                          {
                            id: "share-link",
                            label: "Share link",
                            icon: (
                              <ShareFat
                                className="app-topbar__icon"
                                strokeWidth={1.8}
                              />
                            ),
                            disabled: !proposalTopbarRegistration.hasProposalContent,
                            onSelect:
                              proposalTopbarRegistration.onShareSavedProposal,
                          },
                        ]
                      : []),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="dasti-icon-button app-topbar__share"
                  aria-label="Share proposal"
                  data-toolbar-tooltip="Share"
                >
                  <ShareFat
                    className="app-topbar__icon"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="app-topbar__share-label">Share</span>
                </button>
              }
            />
            <span
              className="dasti-toolbar__divider app-topbar__toolbar-divider app-topbar__toolbar-divider--actions"
              aria-hidden="true"
            />
          </>
        ) : null}
        <IconButton
          className="app-topbar__account-button"
          label={
            !isAccountReady
              ? "Account loading"
              : isSignedIn
                ? "Open account menu"
                : "Sign in"
          }
          onClick={handleProfile}
          disabled={!isAccountReady}
        >
          {isSignedIn ? (
            <span className="app-topbar__account-initial" aria-hidden="true">
              {resolveAccountInitial(user)}
            </span>
          ) : (
            <User
              className="app-topbar__icon"
              aria-hidden="true"
            />
          )}
        </IconButton>
        <span className="app-topbar__profile-name" aria-hidden="true">
          {!isAccountReady
            ? "Account"
            : isSignedIn
              ? user?.firstName ?? user?.username ?? "Profile"
              : "Sign in"}
        </span>
        {isSignedIn ? (
          <div ref={clerkUserButtonRef} className="app-topbar__clerk-button">
            <UserButton afterSignOutUrl="/" />
          </div>
        ) : null}
      </div>
    </header>
  );
}
