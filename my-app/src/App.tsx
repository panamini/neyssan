import "./styles/globals.css";

import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import { CvForge } from "./pages/CvForge";
import { CvsLibrary } from "./pages/CvsLibrary";
import { ProposalForge } from "./pages/ProposalForge";
import { JobsPage } from "./pages/JobsPage";
import { ProposalsLibrary } from "./pages/ProposalsLibrary";
import { StyleForge } from "./pages/StyleForge";
import { SettingsPage } from "./pages/SettingsPage";
import { SignInPage } from "./pages/SignInPage";
import { SignOutPage } from "./pages/SignOutPage";
import { ResumePrintPage } from "./pages/ResumePrintPage";
import { ProposalPrintPage } from "./pages/ProposalPrintPage";
import { ResumeFontParityHarnessPage } from "./pages/ResumeFontParityHarnessPage";
import { PdfRasterHarnessPage } from "./pages/PdfRasterHarnessPage";
import { Sidebar } from "./components/Sidebar";
import { QuickStartFlow } from "./components/onboarding/QuickStartFlow";
import { CvLibraryProvider } from "./contexts/CvLibraryContext";
import { installStorageDiagnostics } from "./lib/storage-diagnostics";
import { useCvLibrary } from "./contexts/CvLibraryContext";
import { api } from "../convex/_generated/api";
import {
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
  readStoredProposalComposeDraft,
} from "./lib/proposal-workspace-state";
import {
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
  readStoredProposalOutputDraft,
} from "./lib/proposal-output-draft";
import { readStoredSavedProposalFixtures } from "./lib/proposal-saved-fixtures";
import {
  clearQuickStartLocationState,
  readQuickStartRouteState,
} from "./lib/quick-start-routing";

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

    if (pathname === "/cvs") {
      return cvCount > 0 ? `All resumes (${cvCount})` : "All resumes";
    }

    if (pathname === "/proposal") {
      const selectedProposalId = normalizeTitle(params.get("id"));
      const selectedProposalTitle =
        selectedProposalId &&
        [...(proposals ?? []), ...readStoredSavedProposalFixtures()]
          .find((proposal) => String(proposal._id) === selectedProposalId)
          ?.title;
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
      pageTitle = topbarDocumentTitle ? `${topbarDocumentTitle} · Resume · two weeks` : "Resume · two weeks";
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
    } else if (pathname === "/settings") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · two weeks`
        : "Proposal defaults · two weeks";
    } else if (pathname === "/style") {
      pageTitle = topbarDocumentTitle ? `${topbarDocumentTitle} · Style Forge · two weeks` : "Style Forge · two weeks";
    }

    document.title = pageTitle;
  }, [location.pathname, topbarDocumentTitle]);
}

const SHOW_TOPBAR = false;

function TopbarTitleSync(): null {
  const topbarDocumentTitle = useTopbarDocumentTitle();
  useBrowserTitle(topbarDocumentTitle);
  return null;
}

/**
 * Topbar — h:54px (--hdr), wordmark only.
 */
function Topbar() {
  const topbarDocumentTitle = useTopbarDocumentTitle();

  return (
    <header
      style={{
        height: "var(--hdr)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(var(--space-3), 4vw, var(--space-7))",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-canvas)",
        boxShadow: "0 1px 0 var(--color-border), var(--shadow-sm)",
        position: "relative",
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-3)",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading-family)",
            fontSize: "var(--tm)",
            fontWeight: "var(--font-heading-weight)",
            letterSpacing: "var(--tracking-display)",
            color: "var(--ti)",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          two weeks
        </span>
        {topbarDocumentTitle ? (
          <>
            <span
              aria-hidden="true"
              style={{
                color: "var(--color-text-subtle)",
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              &gt;
            </span>
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--ts)",
                fontWeight: 500,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={topbarDocumentTitle}
            >
              {topbarDocumentTitle}
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}

/**
 * AppShell — structure exacte du squelette dasti-v16 :
 *   <div class="app">           flex-row h:100vh overflow:hidden
 *     <aside class="sb">        sidebar h:100vh
 *     <div class="page-area">   flex:1 flex-col overflow:hidden
 *       <header class="top">    topbar 54px
 *       <div class="pscroll">   flex:1 overflow:hidden → pages gèrent leur scroll
 *
 * CvLibraryProvider ici pour que Sidebar ait accès au contexte CV
 * depuis n'importe quelle route.
 */
function AppShell(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    installStorageDiagnostics();
  }, []);

  const quickStartRouteState = React.useMemo(
    () => readQuickStartRouteState(location.state),
    [location.state],
  );

  const closeQuickStart = React.useCallback(() => {
    const clearedQuickStartState = clearQuickStartLocationState(location.state);
    const nextState =
      clearedQuickStartState &&
      typeof clearedQuickStartState === "object" &&
      !Array.isArray(clearedQuickStartState)
        ? { ...clearedQuickStartState }
        : clearedQuickStartState;

    if (nextState && typeof nextState === "object" && !Array.isArray(nextState)) {
      delete nextState.proposalEntryIntent;
      delete nextState.jobImportFocus;
    }

    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state: nextState,
      },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  return (
    <CvLibraryProvider>
      {/* .app — flex row, h:100vh overflow:hidden */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--ti)",
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
        }}
      >
        {/* Sidebar — h:100vh depuis le parent flex */}
        <Sidebar />

        {/* .page-area — flex:1, flex-col */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
            position: "relative",
          }}
        >
          <ConvexStatusBanner />
          <TopbarTitleSync />
          {SHOW_TOPBAR ? <Topbar /> : null}

          {/* .pscroll — flex:1 overflow:hidden, chaque page gère son propre scroll */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {quickStartRouteState.isOpen ? (
              <QuickStartFlow
                onExit={closeQuickStart}
                initialCreateType={quickStartRouteState.createType}
                resumeMode={quickStartRouteState.resumeMode}
                returnTarget={quickStartRouteState.returnTarget}
              />
            ) : (
              <Routes>
                <Route path="/cv" element={<CvForge />} />
                <Route path="/cvs" element={<CvsLibrary />} />
                <Route path="/proposal" element={<ProposalForge />} />
                <Route path="/proposal-next" element={<Navigate to="/proposal" replace />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:jobId" element={<JobsPage />} />
                <Route path="/proposals" element={<ProposalsLibrary />} />
                <Route path="/style" element={<StyleForge />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-out" element={<SignOutPage />} />
                <Route path="/" element={<Navigate to="/cv" replace />} />
                <Route path="*" element={<Navigate to="/cv" replace />} />
              </Routes>
            )}
          </div>
        </div>
      </div>
    </CvLibraryProvider>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

function AppRouter(): JSX.Element {
  const location = useLocation();

  if (location.pathname.startsWith("/sign-in")) {
    return <SignInPage />;
  }

  if (location.pathname === "/sign-out") {
    return <SignOutPage />;
  }

  if (location.pathname === "/print/resume") {
    return <ResumePrintPage />;
  }

  if (location.pathname === "/print/proposal") {
    return <ProposalPrintPage />;
  }

   if (location.pathname === "/debug/resume-font-parity") {
    return <ResumeFontParityHarnessPage />;
  }

  if (location.pathname === "/debug/pdf-raster") {
    return <PdfRasterHarnessPage />;
  }

  return <AppShell />;
}
