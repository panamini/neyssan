import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useConvexAuth, useQuery } from "convex/react";
import { Button, Card, CardContent, CardTitle, IconButton, Pill } from "../components/ui";
import { api } from "../../convex/_generated/api";
import { isQuickStartCompleted, markQuickStartCompleted } from "../lib/onboarding-state";
import {
  BookmarkSimple,
  Check,
  Command,
  FilePlus,
  FileText,
  Highlighter,
  PencilLine,
  Target,
  Upload,
  X,
} from "../lib/icons";
import {
  buildDashboardCapturedJobs,
  buildDashboardCurrentWork,
  buildDashboardMetrics,
  buildDashboardNeedsReview,
  findLatestProposalDraft,
  getDraftHeroSubtitle,
  type DashboardCapturedJobItem,
  type DashboardCurrentWorkItem,
  type DashboardMetric,
  type DashboardNeedReviewItem,
} from "../lib/dashboard-metrics";
import { readStoredProposalOutputDraft } from "../lib/proposal-output-draft";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import {
  clearActiveLocalCvId,
  listLocalCvPickerOptions,
} from "../lib/proposal-personalization";

const QUICK_START_DISMISSED_KEY = "twoweeks:dashboard-quick-start-dismissed";

function readQuickStartDismissed(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(QUICK_START_DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

function dismissQuickStart(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(QUICK_START_DISMISSED_KEY, "1");
  } catch {
    /* noop */
  }
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const [showQuickStart, setShowQuickStart] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return !isQuickStartCompleted() && !readQuickStartDismissed();
  });
  const canQueryLiveData =
    isLoaded && Boolean(isSignedIn) && isConvexAuthenticated;
  const proposals = useQuery(
    api.proposalsPublic.default,
    canQueryLiveData ? {} : "skip",
  );
  const jobs = useQuery(
    ((api as any).jobsPublic?.listForUser ?? "jobsPublic.listForUser") as any,
    canQueryLiveData ? {} : "skip",
  );
  const localOutputDraft = React.useMemo(() => readStoredProposalOutputDraft(), []);
  const proposalDrafts = React.useMemo(
    () =>
      [
        ...(Array.isArray(proposals) ? proposals : []),
        ...(String(localOutputDraft?.proposalContent ?? "").trim()
          ? [
              {
                ...localOutputDraft,
                id: "local",
                title: localOutputDraft.proposalDocumentTitle,
                content: localOutputDraft.proposalContent,
                status: "draft",
                updatedAt: Date.now(),
                metadata: {
                  jobId: localOutputDraft.sourceComposeDraft?.jobTitle
                    ? "local-compose-job"
                    : null,
                  sourceCvId: null,
                },
              },
            ]
          : []),
      ],
    [localOutputDraft, proposals],
  );
  const latestDraft = React.useMemo(
    () => findLatestProposalDraft(proposalDrafts),
    [proposalDrafts],
  );
  const metrics = React.useMemo(
    () =>
      buildDashboardMetrics({
        jobs: Array.isArray(jobs) ? jobs : [],
      }),
    [jobs],
  );
  const latestCv = React.useMemo(() => listLocalCvPickerOptions()[0] ?? null, []);
  const needsReviewItems = React.useMemo(
    () =>
      buildDashboardNeedsReview({
        proposals: proposalDrafts,
        jobs: Array.isArray(jobs) ? jobs : [],
      }),
    [jobs, proposalDrafts],
  );
  const visibleNeedsReviewItems = React.useMemo(
    () => needsReviewItems.slice(0, 2),
    [needsReviewItems],
  );
  const currentWorkItems = React.useMemo(
    () =>
      buildDashboardCurrentWork({
        proposals: Array.isArray(proposals) ? proposals : proposalDrafts,
        jobs: Array.isArray(jobs) ? jobs : [],
        latestCv,
      }),
    [jobs, latestCv, proposalDrafts, proposals],
  );
  const capturedJobItems = React.useMemo(
    () =>
      buildDashboardCapturedJobs({
        jobs: Array.isArray(jobs) ? jobs : [],
      }),
    [jobs],
  );
  const liveDataLoading =
    isLoaded && Boolean(isSignedIn) && (isConvexAuthLoading || proposals === undefined || jobs === undefined);
  const latestDraftJobId = String(latestDraft?.metadata?.jobId ?? "");
  const hasReviewableDraftJob =
    latestDraftJobId.length > 0 && latestDraftJobId !== "local-compose-job";
  const latestDraftLabel = latestDraft
    ? getDraftHeroSubtitle(latestDraft, Array.isArray(jobs) ? jobs : [])
    : "Letter draft · Missing job context";
  const nextBestActionTitle = latestDraft
    ? latestDraftLabel === "Letter draft · Missing job context"
      ? "Add job context."
      : "Continue draft."
    : "Write first proposal";

  const closeQuickStartCard = React.useCallback(() => {
    dismissQuickStart();
    markQuickStartCompleted();
    setShowQuickStart(false);
  }, []);

  const importCvFromPdf = React.useCallback(() => {
    void navigate("/cv?cvForgeAction=importCv");
  }, [navigate]);

  const startProposalQuickStart = React.useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("templateId")) {
      params.set("templateId", "minimal");
    }
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate(
      {
        pathname: "/proposal",
        search: params.toString() ? `?${params.toString()}` : "",
      },
      {
        state: createProposalWorkspaceResetState(),
      },
    );
  }, [location.search, navigate]);

  const openDraftOrStartProposal = React.useCallback(() => {
    if (latestDraft) {
      const draftId = String(latestDraft._id ?? latestDraft.id ?? "");
      void navigate(draftId && draftId !== "local" ? `/proposal?draftId=${encodeURIComponent(draftId)}` : "/proposal");
      return;
    }

    startProposalQuickStart();
  }, [latestDraft, navigate, startProposalQuickStart]);

  return (
    <main className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="dashboard-page__inner">
        <header className="dashboard-head">
          <div>
            <h1 id="dashboard-title" className="dashboard-head__title page-head__title">
              Dashboard
            </h1>
            <p className="dashboard-head__sub page-head__sub">
              Review the next application task and keep the CV-to-proposal flow moving.
            </p>
          </div>
        </header>

        {showQuickStart ? (
          <section className="qstart" aria-labelledby="quick-start-title">
            <div className="qstart__head">
              <div>
                <h2 id="quick-start-title" className="qstart__title">
                  Quick start
                </h2>
                <p className="qstart__sub">
                  Four steps until your first cover letter is ready to review.
                </p>
              </div>
              <div className="qstart__progress">
                <span>2 of 4</span>
                <div className="qstart__progress-bar" aria-hidden="true">
                  <span />
                </div>
                <IconButton
                  label="Dismiss quick start"
                  variant="ghost"
                  onClick={closeQuickStartCard}
                >
                  <X size={14} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
            <div className="qstart__list">
              <QuickStartStep
                state="done"
                icon={<Check size={14} aria-hidden="true" />}
                title="Import or build your CV"
                description="Use the CV forge as your profile source."
                action="Open"
                onAction={() => navigate("/cv")}
              />
              <QuickStartStep
                state="done"
                icon={<Check size={14} aria-hidden="true" />}
                title="Pick your style"
                description="Use the active document style defaults."
                action="Change"
                onAction={() => navigate("/style")}
              />
              <QuickStartStep
                state="active"
                icon={<Target size={14} aria-hidden="true" />}
                title="Capture jobs"
                description="Install the extension or pick an existing job in Jobs."
                action="Open jobs"
                onAction={() => navigate("/jobs")}
              />
              <QuickStartStep
                state="pending"
                icon={<FilePlus size={14} aria-hidden="true" />}
                title="Generate your first proposal"
                description="Pick a job and review the tailored draft."
                action="Locked"
                disabled
              />
            </div>
          </section>
        ) : null}

        <section className="dash-next-action" aria-labelledby="next-best-action">
          <div className="dash-next-action__label">Next best action</div>
          <h2 id="next-best-action" className="dash-next-action__title">
            {nextBestActionTitle}
          </h2>
          <p className="dash-next-action__copy">
            {latestDraft
              ? latestDraftLabel
              : "Start with a job or blank letter."}
          </p>
          <div className="dash-next-action__bar">
            <Button
              size="lg"
              onClick={openDraftOrStartProposal}
              iconLeft={
                latestDraft ? (
                  <FileText size={16} aria-hidden="true" />
                ) : (
                  <FilePlus size={16} aria-hidden="true" />
                )
              }
            >
              {latestDraft ? "Open draft" : "Start proposal"}
            </Button>
            {hasReviewableDraftJob ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate(`/jobs/${encodeURIComponent(latestDraftJobId)}`)}
                iconLeft={<Target size={16} aria-hidden="true" />}
              >
                Review match
              </Button>
            ) : null}
            {needsReviewItems[0] ? <Pill tone="warning">Blocked</Pill> : null}
          </div>
        </section>

        <div className="dash-grid">
          <div className="dash-grid__main">
            {metrics.length > 0 ? (
              <Card>
                <CardContent>
                  <div className="dash-action-cards">
                    {metrics.map((metric) => (
                      <DashboardActionCard
                        key={metric.id}
                        metric={metric}
                        onClick={() => navigate(metric.href)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardTitle>Captured jobs</CardTitle>
              <CardContent>
                {capturedJobItems.length > 0 ? (
                  <div className="dash-list">
                    {capturedJobItems.map((item) => (
                      <CapturedJobRow
                        key={item.id}
                        item={item}
                        onClick={() => navigate(item.href)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="dash-tip">
                    {liveDataLoading ? "Loading captured jobs…" : "No captured jobs yet."}
                  </p>
                )}
                <div className="dash-card-footer">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("/jobs")}
                    iconLeft={<Target size={14} aria-hidden="true" />}
                  >
                    Review all jobs
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardTitle>Current work</CardTitle>
              <CardContent>
                {currentWorkItems.length > 0 ? (
                  <div className="dash-list">
                    {currentWorkItems.map((item) => (
                      <CurrentWorkRow
                        key={item.id}
                        item={item}
                        onClick={() => navigate(item.href)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="dash-tip">No active proposal, CV, or captured job work yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardTitle>Blocked</CardTitle>
              <CardContent>
                {visibleNeedsReviewItems.length > 0 ? (
                  <>
                    <p className="dash-section-note">
                      {needsReviewItems.length === 1
                        ? "1 needs context. Start here."
                        : `${needsReviewItems.length} need context. Start with these.`}
                    </p>
                    <div className="dash-list">
                      {visibleNeedsReviewItems.map((item) => (
                        <NeedsReviewRow
                          key={item.id}
                          item={item}
                          onClick={() => navigate(item.href)}
                        />
                      ))}
                    </div>
                    <div className="dash-card-footer">
                      <Button
                        size="sm"
                        onClick={() => navigate(needsReviewItems[0].href)}
                        iconLeft={<Highlighter size={14} aria-hidden="true" />}
                      >
                        Resolve next
                      </Button>
                      {needsReviewItems.length > visibleNeedsReviewItems.length ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate("/jobs?needsReview=1")}
                        >
                          View all
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="dash-tip">No proposal or job blockers detected.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="dash-grid__side" aria-label="Dashboard actions">
            <Card>
              <CardTitle>Quick actions</CardTitle>
              <CardContent className="dash-actions">
                <Button
                  variant="secondary"
                  onClick={importCvFromPdf}
                  iconLeft={<Upload size={16} aria-hidden="true" />}
                >
                  Import CV
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/jobs")}
                  iconLeft={<Target size={16} aria-hidden="true" />}
                >
                  Review jobs
                </Button>
                <Button
                  variant="secondary"
                  onClick={startProposalQuickStart}
                  iconLeft={<PencilLine size={16} aria-hidden="true" />}
                >
                  New proposal
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardTitle>Command palette</CardTitle>
              <CardContent>
                <p className="dash-tip">
                  <Command size={15} aria-hidden="true" />{" "}
                  Press Cmd/Ctrl+K to create, navigate, toggle theme, or replay onboarding.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function QuickStartStep({
  state,
  icon,
  title,
  description,
  action,
  onAction,
  disabled = false,
}: {
  state: "done" | "active" | "pending";
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="qstart__step" data-state={state}>
      <span className="qstart__step-num">{icon}</span>
      <div className="qstart__step-body">
        <div className="qstart__step-title">{title}</div>
        <div className="qstart__step-desc">{description}</div>
      </div>
      <Button
        size="sm"
        variant={state === "active" ? "secondary" : "ghost"}
        onClick={onAction}
        disabled={disabled}
      >
        {action}
      </Button>
    </div>
  );
}

function DashboardActionCard({
  metric,
  onClick,
}: {
  metric: DashboardMetric;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dash-action-card" onClick={onClick}>
      <div className="dash-action-card__top">
        <Target size={16} aria-hidden="true" />
        <div className="dash-stat__num">{metric.value}</div>
        <div className="dash-stat__label">{metric.label}</div>
      </div>
      <div className="dash-stat__desc">{metric.description}</div>
      <span className="dash-action-card__cta">{metric.cta}</span>
    </button>
  );
}

function CurrentWorkRow({
  item,
  onClick,
}: {
  item: DashboardCurrentWorkItem;
  onClick: () => void;
}) {
  const tone =
    item.kind === "draft"
      ? "warning"
      : item.kind === "saved-proposal"
      ? "success"
      : "neutral";
  const Icon =
    item.kind === "draft"
      ? PencilLine
      : item.kind === "cv"
        ? Upload
        : item.kind === "saved-proposal"
          ? BookmarkSimple
          : Target;

  return (
    <button type="button" className="dash-row" onClick={onClick}>
      <span className={`ds-status ds-status--${tone}`}>
        <Icon size={14} aria-hidden="true" />
        {item.kind === "draft"
          ? "Draft"
          : item.kind === "cv"
            ? "CV"
            : item.kind === "saved-proposal"
              ? "Saved"
              : "Job"}
      </span>
      <div>
        <div className="dash-row__title">{item.title}</div>
        <div className="dash-row__sub">{item.sub}</div>
      </div>
    </button>
  );
}

function CapturedJobRow({
  item,
  onClick,
}: {
  item: DashboardCapturedJobItem;
  onClick: () => void;
}) {
  const tone = item.status === "Needs review" ? "warning" : "neutral";

  return (
    <button type="button" className="dash-row" onClick={onClick}>
      <span className={`ds-status ds-status--${tone}`}>
        {item.status === "Saved" ? (
          <BookmarkSimple size={14} aria-hidden="true" />
        ) : (
          <Target size={14} aria-hidden="true" />
        )}
        {item.status}
      </span>
      <div>
        <div className="dash-row__title">{item.title}</div>
        <div className="dash-row__sub">{item.sub}</div>
      </div>
    </button>
  );
}

function NeedsReviewRow({
  item,
  onClick,
}: {
  item: DashboardNeedReviewItem;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dash-row" onClick={onClick}>
      <span className="ds-status ds-status--warning">
        <PencilLine size={14} aria-hidden="true" />
        Blocked
      </span>
      <div>
        <div className="dash-row__title">{item.title}</div>
        <div className="dash-row__sub">{item.detail}</div>
      </div>
    </button>
  );
}
