import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { useCvForgeTopbarRegistration } from "../contexts/CvForgeTopbarContext";
import { IconButton, Pill } from "./ui";
import CvShareMenu from "./cv/CvShareMenu";
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
import { FileText, MagnifyingGlass, User } from "../lib/icons";

function normalizeTitle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    const savedProposalCount =
      (proposals ?? readStoredSavedProposalFixtures()).filter(
        (proposal) => proposal.status === "saved",
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
      return savedProposalCount > 0
        ? `All cover letters (${savedProposalCount})`
        : "All cover letters";
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
      pageTitle = "Dashboard · two weeks";
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
        : "All cover letters · two weeks";
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
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  if (pathname.startsWith("/jobs")) return "Jobs";
  if (pathname.startsWith("/proposal")) return "Proposal forge";
  if (pathname.startsWith("/cv")) return "CV forge";
  if (pathname.startsWith("/cvs")) return "CV library";
  if (pathname.startsWith("/documents")) return "Projects";
  if (pathname.startsWith("/proposals")) return "Projects";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/style")) return "Templates";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

function useForgeContextLine(topbarDocumentTitle: string | null): {
  label: string;
  tone: "success" | "warning";
} | null {
  const location = useLocation();
  const title = topbarDocumentTitle?.trim();

  if (location.pathname === "/proposal") {
    return {
      label: title
        ? `${title} application package`
        : "Proposal draft application package",
      tone: "warning",
    };
  }

  if (location.pathname === "/cv") {
    return {
      label: title ? `${title} profile source` : "Active CV profile source",
      tone: "success",
    };
  }

  return null;
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
  const forgeContext = useForgeContextLine(topbarDocumentTitle);
  const cvTopbarRegistration = useCvForgeTopbarRegistration();
  const pageLabel = resolvePageLabel(location.pathname);
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const isAccountReady = isAuthLoaded !== false;
  const shortcutLabel = React.useMemo(
    () => resolveCommandShortcutLabel(window.navigator.platform),
    [],
  );
  const clerkUserButtonRef = React.useRef<HTMLDivElement | null>(null);

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
      ? "Saved"
      : "No CV";
  const cvPageCountLabel =
    typeof cvTopbarRegistration?.pageCount === "number" &&
    cvTopbarRegistration.pageCount >= 2
      ? `${cvTopbarRegistration.pageCount} pages`
      : null;
  const shouldShowImportReviewChip = Boolean(
    cvTopbarRegistration &&
      cvTopbarRegistration.importIssueCount > 0 &&
      !cvTopbarRegistration.importReviewBannerVisible,
  );
  return (
    <header className="app-topbar">
      <div className="app-topbar__identity">
        {forgeContext ? null : (
          <div className="app-topbar__crumb" aria-label="Breadcrumb">
            <span>twoweeks</span>
            <span className="app-topbar__crumb-sep">/</span>
            <strong className="app-topbar__crumb-current">{pageLabel}</strong>
          </div>
        )}
        {forgeContext && location.pathname === "/cv" ? (
          <div className="app-topbar__document">
            <span
              className="app-topbar__document-icon"
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
                className="app-topbar__document-dot"
                data-pulsing={
                  cvTopbarRegistration?.exporting ? "true" : undefined
                }
                aria-hidden="true"
              />
              <FileText size={15} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <strong>{forgeContext.label}</strong>
            {cvPageCountLabel ? (
              <span className="app-topbar__document-meta">
                {cvPageCountLabel}
              </span>
            ) : null}
          </div>
        ) : forgeContext ? (
          <div className="app-topbar__context">
            <span>Working on:</span>
            <strong>{forgeContext.label}</strong>
            <Pill tone={forgeContext.tone}>
              {forgeContext.tone === "warning" ? "Needs review" : "Ready"}
            </Pill>
          </div>
        ) : null}
      </div>
      <div className="app-topbar__spacer" />
      <button
        type="button"
        className="app-topbar__cmdk"
        aria-label="Open command palette"
        aria-expanded={commandPaletteOpen}
        onClick={onOpenCommandPalette}
      >
        <MagnifyingGlass
          className="app-topbar__cmdk-icon"
          size={15}
          aria-hidden="true"
        />
        <span className="app-topbar__cmdk-label">Search or run command</span>
        <span className="app-topbar__kbd">{shortcutLabel}</span>
      </button>
      {location.pathname === "/cv" && cvTopbarRegistration ? (
        <>
          {shouldShowImportReviewChip ? (
            <button
              type="button"
              className="dasti-cv-ats app-topbar__cv-ats"
              data-state="warn"
              data-actionable="true"
              aria-label="Review needed"
              data-toolbar-tooltip="Open import review"
              onClick={cvTopbarRegistration.onOpenImportReview}
            >
              <span className="dasti-cv-ats__mark" aria-hidden="true">
                Review
              </span>
              <span className="dasti-cv-ats__label">Review needed</span>
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
        </>
      ) : null}
      <IconButton
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
        <User size={16} aria-hidden="true" />
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
    </header>
  );
}
