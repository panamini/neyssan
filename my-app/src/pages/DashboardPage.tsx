import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardTitle, IconButton, Pill } from "../components/ui";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { isQuickStartCompleted, markQuickStartCompleted } from "../lib/onboarding-state";
import { X } from "../lib/icons";

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
  const [showQuickStart, setShowQuickStart] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return !isQuickStartCompleted() && !readQuickStartDismissed();
  });

  const openQuickStart = React.useCallback(
    (resumeMode: "choice" | "upload-only" = "choice") => {
      void navigate(
        {
          pathname: location.pathname,
          search: location.search,
        },
        {
          state: createQuickStartLocationState(location.state, {
            resumeMode,
          }),
        },
      );
    },
    [location.pathname, location.search, location.state, navigate],
  );

  const closeQuickStartCard = React.useCallback(() => {
    dismissQuickStart();
    markQuickStartCompleted();
    setShowQuickStart(false);
  }, []);

  return (
    <main className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="dashboard-page__inner">
        <header className="dashboard-head">
          <div>
            <h1 id="dashboard-title" className="dashboard-head__title">
              Dashboard<span className="brand-period">.</span>
            </h1>
            <p className="dashboard-head__sub">
              Review the next application task and keep the CV-to-proposal flow moving.
            </p>
          </div>
          <div className="dashboard-head__actions">
            <Button
              variant="secondary"
              size="md"
              onClick={() => openQuickStart("upload-only")}
            >
              Import CV
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate("/proposal")}>
              New proposal
            </Button>
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
                number="✓"
                title="Import or build your CV"
                description="Use the CV forge as your profile source."
                action="Open"
                onAction={() => navigate("/cv")}
              />
              <QuickStartStep
                state="done"
                number="✓"
                title="Pick your style"
                description="Use the active document style defaults."
                action="Change"
                onAction={() => navigate("/style")}
              />
              <QuickStartStep
                state="active"
                number="3"
                title="Capture jobs"
                description="Install the extension or paste a URL in Jobs."
                action="Browse"
                onAction={() => navigate("/jobs")}
              />
              <QuickStartStep
                state="pending"
                number="4"
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
            Review match evidence before drafting.
          </h2>
          <p className="dash-next-action__copy">
            The next proposal should start from a checked job match and the current CV.
            Confirm the evidence first, then open the draft.
          </p>
          <div className="dash-next-action__bar">
            <Button size="lg" onClick={() => navigate("/jobs")}>
              Review match
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/proposal")}>
              Open draft
            </Button>
            <Pill tone="warning">2 watch-outs</Pill>
            <Pill tone="success">CV ready</Pill>
          </div>
        </section>

        <div className="dash-grid">
          <div className="dash-grid__main">
            <Card>
              <CardContent>
                <div className="dash-stats">
                  <DashboardStat value="14" label="Proposals sent (30d)" />
                  <DashboardStat value="3" label="Replies waiting" />
                  <DashboardStat value="28" label="Strong matches waiting" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardTitle>Recent activity</CardTitle>
              <CardContent>
                <div className="dash-list">
                  <ActivityRow
                    status="Sent"
                    tone="success"
                    title="Senior Frontend Engineer · Linear"
                    sub="Cover letter generated and exported."
                    time="2h ago"
                  />
                  <ActivityRow
                    status="Drafting"
                    tone="accent"
                    title="Staff Designer · Vercel"
                    sub="Verdict is worth a shot."
                    time="yesterday"
                  />
                  <ActivityRow
                    status="Saved"
                    tone="neutral"
                    title="Product Engineer · Stripe"
                    sub="Saved for later."
                    time="Mon"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="dash-grid__side" aria-label="Dashboard actions">
            <Card>
              <CardTitle>Quick actions</CardTitle>
              <CardContent className="dash-actions">
                <Button variant="secondary" onClick={() => openQuickStart("upload-only")}>
                  Import CV
                </Button>
                <Button variant="secondary" onClick={() => navigate("/jobs")}>
                  Capture jobs
                </Button>
                <Button variant="secondary" onClick={() => navigate("/proposal")}>
                  New proposal
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardTitle>Command palette</CardTitle>
              <CardContent>
                <p className="dash-tip">
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
  number,
  title,
  description,
  action,
  onAction,
  disabled = false,
}: {
  state: "done" | "active" | "pending";
  number: string;
  title: string;
  description: string;
  action: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="qstart__step" data-state={state}>
      <span className="qstart__step-num">{number}</span>
      <div className="qstart__step-body">
        <div className="qstart__step-title">{title}</div>
        <div className="qstart__step-desc">{description}</div>
      </div>
      <Button
        size="sm"
        variant={state === "active" ? "accent" : "ghost"}
        onClick={onAction}
        disabled={disabled}
      >
        {action}
      </Button>
    </div>
  );
}

function DashboardStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="dash-stat__num">{value}</div>
      <div className="dash-stat__label">{label}</div>
    </div>
  );
}

function ActivityRow({
  status,
  tone,
  title,
  sub,
  time,
}: {
  status: string;
  tone: "neutral" | "accent" | "success";
  title: string;
  sub: string;
  time: string;
}) {
  return (
    <div className="dash-row">
      <span className={`ds-status ds-status--${tone}`}>
        <span className="ds-status__dot" />
        {status}
      </span>
      <div>
        <div className="dash-row__title">{title}</div>
        <div className="dash-row__sub">{sub}</div>
      </div>
      <span className="dash-row__time">{time}</span>
    </div>
  );
}
