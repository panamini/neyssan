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
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import { DashboardPage } from "./pages/DashboardPage";
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
import { CommandPalette } from "./components/CommandPalette";
import { OnboardingReplay } from "./components/onboarding/OnboardingReplay";
import { QuickStartFlow } from "./components/onboarding/QuickStartFlow";
import { IconButton, Pill } from "./components/ui";
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
import { resolveCommandShortcutLabel } from "./lib/app-topbar";
import { useThemeMode } from "./lib/theme-mode";
import { User } from "./lib/icons";

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
    } else if (pathname === "/settings") {
      pageTitle = topbarDocumentTitle
        ? `${topbarDocumentTitle} · two weeks`
        : "Proposal defaults · two weeks";
    } else if (pathname.startsWith("/jobs")) {
      pageTitle = "Jobs · two weeks";
    } else if (pathname === "/style") {
      pageTitle = topbarDocumentTitle ? `${topbarDocumentTitle} · Style Forge · two weeks` : "Style Forge · two weeks";
    }

    document.title = pageTitle;
  }, [location.pathname, topbarDocumentTitle]);
}

function TopbarTitleSync(): null {
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
  if (pathname.startsWith("/proposals")) return "Documents";
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

function AppTopbar({
  commandPaletteOpen,
  onOpenCommandPalette,
  onToggleTheme,
  themeMode,
}: {
  commandPaletteOpen: boolean;
  onOpenCommandPalette: () => void;
  onToggleTheme: () => void;
  themeMode: "light" | "dark";
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const topbarDocumentTitle = useTopbarDocumentTitle();
  const forgeContext = useForgeContextLine(topbarDocumentTitle);
  const pageLabel = resolvePageLabel(location.pathname);
  const { isSignedIn } = useAuth();
  const { user } = useUser();
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
    if (!isSignedIn) {
      void navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);

  return (
    <header className="app-topbar">
      <div className="app-topbar__identity">
        <div className="app-topbar__crumb" aria-label="Breadcrumb">
          <span>twoweeks</span>
          <span className="app-topbar__crumb-sep">/</span>
          <strong className="app-topbar__crumb-current">{pageLabel}</strong>
        </div>
        {forgeContext ? (
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
        aria-expanded={commandPaletteOpen}
        onClick={onOpenCommandPalette}
      >
        <span>Search or run command</span>
        <span className="app-topbar__kbd">{shortcutLabel}</span>
      </button>
      <div className="app-theme-switch" role="group" aria-label="Theme">
        <button
          type="button"
          aria-pressed={themeMode === "light"}
          onClick={() => {
            if (themeMode === "dark") onToggleTheme();
          }}
        >
          Light
        </button>
        <button
          type="button"
          aria-pressed={themeMode === "dark"}
          onClick={() => {
            if (themeMode === "light") onToggleTheme();
          }}
        >
          Dark
        </button>
      </div>
      <IconButton
        label={isSignedIn ? "Open account menu" : "Sign in"}
        onClick={handleProfile}
      >
        <User size={16} aria-hidden="true" />
      </IconButton>
      <span className="app-topbar__profile-name" aria-hidden="true">
        {isSignedIn ? user?.firstName ?? user?.username ?? "Profile" : "Sign in"}
      </span>
      {isSignedIn ? (
        <div ref={clerkUserButtonRef} className="app-topbar__clerk-button">
          <UserButton afterSignOutUrl="/" />
        </div>
      ) : null}
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
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [onboardingReplayOpen, setOnboardingReplayOpen] = React.useState(false);
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();

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
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <ConvexStatusBanner />
          <TopbarTitleSync />
          <AppTopbar
            commandPaletteOpen={commandPaletteOpen}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onToggleTheme={toggleTheme}
            themeMode={themeMode}
          />

          <div className="app-pages">
            {quickStartRouteState.isOpen ? (
              <QuickStartFlow
                onExit={closeQuickStart}
                initialCreateType={quickStartRouteState.createType}
                resumeMode={quickStartRouteState.resumeMode}
                returnTarget={quickStartRouteState.returnTarget}
              />
            ) : (
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/cv" element={<CvForge />} />
                <Route path="/cvs" element={<CvsLibrary />} />
                <Route path="/proposal" element={<ProposalForge />} />
                <Route path="/proposal-next" element={<Navigate to="/proposal" replace />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:jobId" element={<JobsPage />} />
                <Route path="/proposals" element={<ProposalsLibrary />} />
                <Route path="/style" element={<StyleForge />} />
                <Route path="/templates" element={<Navigate to="/style" replace />} />
                <Route path="/documents" element={<Navigate to="/proposals" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-out" element={<SignOutPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            )}
          </div>
        </div>
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onReplayOnboarding={() => setOnboardingReplayOpen(true)}
          onToggleTheme={toggleTheme}
        />
        <OnboardingReplay
          open={onboardingReplayOpen}
          onClose={() => setOnboardingReplayOpen(false)}
          onNavigate={(to) => navigate(to)}
        />
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
