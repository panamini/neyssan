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
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import { DashboardPage } from "./pages/DashboardPage";
import { CvForge } from "./pages/CvForge";
import { CvsLibrary } from "./pages/CvsLibrary";
import { ProposalForge } from "./pages/ProposalForge";
import { JobsPage } from "./pages/JobsPage";
import { ProposalsLibrary } from "./pages/ProposalsLibrary";
import { DocumentsPage } from "./pages/DocumentsPage";
import { StyleForge } from "./pages/StyleForge";
import { TemplatesPage } from "./pages/TemplatesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignInPage } from "./pages/SignInPage";
import { SignOutPage } from "./pages/SignOutPage";
import { McpOAuthContinuationPage } from "./pages/McpOAuthContinuationPage";
import { ResumePrintPage } from "./pages/ResumePrintPage";
import { ProposalPrintPage } from "./pages/ProposalPrintPage";
import { ResumeFontParityHarnessPage } from "./pages/ResumeFontParityHarnessPage";
import { PdfRasterHarnessPage } from "./pages/PdfRasterHarnessPage";
import { McpSafeSummaryProofOperatorPage } from "./pages/McpSafeSummaryProofOperatorPage";
import { Sidebar } from "./components/Sidebar";
import { ForgeTemplatePanel } from "./components/ForgeTemplatePanel";
import { CommandPalette } from "./components/CommandPalette";
import { OnboardingReplay } from "./components/onboarding/OnboardingReplay";
import { QuickStartFlow } from "./components/onboarding/QuickStartFlow";
import { AppTopbar, TopbarTitleSync } from "./components/AppTopbar";
import { CvLibraryProvider } from "./contexts/CvLibraryContext";
import {
  ForgeTemplatePanelProvider,
  useForgeTemplatePanel,
} from "./contexts/ForgeTemplatePanelContext";
import {
  CvForgeTopbarProvider,
} from "./contexts/CvForgeTopbarContext";
import {
  ProposalForgeTopbarProvider,
} from "./contexts/ProposalForgeTopbarContext";
import { installStorageDiagnostics } from "./lib/storage-diagnostics";
import {
  clearQuickStartLocationState,
  readQuickStartRouteState,
} from "./lib/quick-start-routing";
import {
  applyMotionPreference,
  readStoredMotionPreference,
} from "./lib/motion-preference";
import { applyStoredUiLanguage } from "./lib/ui-preferences";
import {
  OPEN_ONBOARDING_REPLAY_EVENT,
  type OnboardingReplayTargetStep,
} from "./lib/onboarding-replay-event";
import { useThemeMode } from "./lib/theme-mode";

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
  return (
    <CvLibraryProvider>
      <ForgeTemplatePanelProvider>
        <CvForgeTopbarProvider>
          <ProposalForgeTopbarProvider>
            <AppShellFrame />
          </ProposalForgeTopbarProvider>
        </CvForgeTopbarProvider>
      </ForgeTemplatePanelProvider>
    </CvLibraryProvider>
  );
}

function AppShellFrame(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    open: forgePanelOpen,
    openMode: forgePanelOpenMode,
    closePanel: closeForgePanel,
  } = useForgeTemplatePanel();
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [onboardingReplayOpen, setOnboardingReplayOpen] = React.useState(false);
  const [onboardingReplayInitialStepId, setOnboardingReplayInitialStepId] =
    React.useState<OnboardingReplayTargetStep>("intro");
  const { toggle: toggleTheme } = useThemeMode();

  React.useEffect(() => {
    applyMotionPreference(readStoredMotionPreference());
    applyStoredUiLanguage();
  }, []);

  React.useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    installStorageDiagnostics();
  }, []);

  React.useEffect(() => {
    const handleOpenOnboardingReplay = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: OnboardingReplayTargetStep }>)
        .detail;
      setOnboardingReplayInitialStepId(detail?.stepId ?? "intro");
      setOnboardingReplayOpen(true);
    };

    window.addEventListener(
      OPEN_ONBOARDING_REPLAY_EVENT,
      handleOpenOnboardingReplay,
    );
    return () => {
      window.removeEventListener(
        OPEN_ONBOARDING_REPLAY_EVENT,
        handleOpenOnboardingReplay,
      );
    };
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

  React.useEffect(() => {
    closeForgePanel();
  }, [closeForgePanel, location.pathname]);

  const forgePanelDockableRoute =
    location.pathname === "/proposal" ||
    location.pathname === "/cv" ||
    location.pathname === "/settings";

  const forgePanelDocked =
    forgePanelOpen &&
    forgePanelOpenMode === "docked" &&
    forgePanelDockableRoute;

  return (
    <div
      className="app-shell"
      data-forge-panel-open={forgePanelOpen ? "true" : undefined}
      data-forge-panel-mode={forgePanelOpenMode}
      data-forge-panel-docked={forgePanelDocked ? "true" : undefined}
    >
      <Sidebar />
      <ForgeTemplatePanel />
      <div className="app-main">
        <ConvexStatusBanner />
        <TopbarTitleSync />
        <AppTopbar
          commandPaletteOpen={commandPaletteOpen}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
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
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/style" element={<StyleForge />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-out" element={<SignOutPage />} />
              <Route path="/oauth/continue" element={<McpOAuthContinuationPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </div>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onReplayOnboarding={() => {
          setOnboardingReplayInitialStepId("intro");
          setOnboardingReplayOpen(true);
        }}
        onToggleTheme={toggleTheme}
      />
      <OnboardingReplay
        open={onboardingReplayOpen}
        initialStepId={onboardingReplayInitialStepId}
        onClose={() => setOnboardingReplayOpen(false)}
        onNavigate={(to, options) => {
          void navigate(to, options);
        }}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
    </div>
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

  if (location.pathname === "/debug/mcp-safe-summary-proof-operator") {
    return <McpSafeSummaryProofOperatorPage />;
  }

  return <AppShell />;
}
