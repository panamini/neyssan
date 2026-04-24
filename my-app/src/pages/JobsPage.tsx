import React from "react";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardText,
  DotsThree,
  FileText,
  Paperclip,
  Star,
  X,
} from "@/lib/icons";
import { api } from "../../convex/_generated/api";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import { FirstRunPanel } from "../components/jobs/FirstRunPanel";
import { MatchReadBlock } from "../components/jobs/MatchReadBlock";
import { useToast } from "../components/ui/toast";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { getProposalSourceLabel } from "../lib/proposal-source-platforms";
import { clearActiveLocalCvId } from "../lib/proposal-personalization";
import { formatCvDisplayTitle } from "../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import type { CvDocument } from "../types/cvDocument";
import { formatUiDate } from "../lib/ui-date";

type JobsPageRouteParams = {
  jobId?: string;
};

function isJobsMatchInputDebugUiEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const debugWindow = window as Window & {
    __JOBS_MATCH_READ_DEBUG__?: boolean;
    __STRUCTURED_MATCH_READ_DEBUG__?: boolean;
  };
  return (
    debugWindow.__JOBS_MATCH_READ_DEBUG__ === true ||
    debugWindow.__STRUCTURED_MATCH_READ_DEBUG__ === true
  );
}

type JobsStructuredShadowSummary = {
  flagEnabled: boolean;
  internalViewer: boolean;
  uiEnabled: boolean;
  advisoryBetaEnabled: boolean;
  advisoryBetaViewer: boolean;
  status: "available" | "unavailable";
  reason: string | null;
  oldScore: number | null;
  oldTier: "strong" | "partial" | "weak" | "unknown";
  structuredScore: number | null;
  structuredTier: "strong" | "partial" | "weak" | "unknown" | null;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
  hardGateMissingCount: number;
  metadataLeakCount: number;
  languagePreserved: boolean;
  provenanceComplete: boolean;
  jobRequirementCount: number;
  jobConstraintCount: number;
  profileEvidenceCount: number;
  profileConstraintCount: number;
};

type JobsMatchInputDebugPayload = {
  jobId: string;
  lastResumeId: string | null;
  resolvedProfileId: string | null;
  profileSkills: string[];
  profileKeywords: string[];
  summary: string | null;
  experience: unknown[];
  raw_text: string | null;
  derivedKeywords: string[];
  matchReadFallback: string;
  score: number | null;
  matchedSignals: string[];
  missingSignals: string[];
  structuredShadowSummary?: JobsStructuredShadowSummary;
};

type JobsPageListItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  parseStatus: string;
  reviewState: string;
  matchTier: "strong" | "partial" | "weak" | "unknown";
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
};

type JobsPageReviewItem = {
  id: string;
  fieldKey: string;
  label: string;
  reviewStatus: string;
  suggestedValue: unknown;
  approvedValue?: unknown;
  sourceText: string;
  confidence: number;
  updatedAt: number;
};

type JobsPageLinkedProposal = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
};

type JobResumePickerOption = {
  id: string;
  title: string;
  dateLabel: string | null;
  dateSortValue: number;
};

type JobsPageDetail = {
  id: string;
  title: string;
  company: string;
  location: string;
  isSample: boolean;
  isFavorite: boolean;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  applicationUrl: string;
  parseStatus: string;
  reviewState: string;
  summary: string;
  visibleSummary?: string | null;
  visibleRequirements?: string[];
  visibleKeywords?: string[];
  visibleExtractionSource?: "llm" | "heuristic" | "empty";
  summaryExtraction?: {
    value: string;
    confidence: number;
    sourceSpan: {
      start: number;
      end: number;
    } | null;
  };
  rawDescription: string;
  responsibilities: string[];
  keywords: string[];
  mustHaves: string[];
  toneCues: string[];
  contacts: string[];
  status: string;
  resumeId?: string;
  resumeName?: string;
  resumeSource?: "job" | "default";
  matchRead: {
    tier: "strong" | "partial" | "weak" | "unknown";
    score: number | null;
    scoreVisible: boolean;
    confidence: "high" | "medium" | "low";
    matched: string[];
    missing: string[];
    basedOn: {
      profileId: string;
      profileLabel: string;
      jobId: string;
    };
    computedAt: number;
    method: "keyword-overlap" | "llm";
    fallback:
      | "none"
      | "profile_missing"
      | "profile_insufficient"
      | "parse_failed"
      | "requirements_missing";
  } | null;
  nextStepBlock: {
    headline: string;
    usesCohortData: boolean;
    actions: Array<"cover_letter" | "resume" | "save_for_later">;
  } | null;
  linkedProposalCount: number;
  linkedProposals: JobsPageLinkedProposal[];
  structuredShadowSummary?: JobsStructuredShadowSummary | null;
  reviewItems: JobsPageReviewItem[];
} | null;

type JobsSortOrder = "recent" | "oldest" | "title" | "company";
type JobsMatchFilter = "all" | "strong" | "partial" | "weak" | "unknown";
type JobsViewMode = "active" | "archived";

const STRUCTURED_MATCH_REVIEW_LABELS = [
  "good",
  "acceptable but conservative",
  "false weak",
  "false strong",
  "overmatched",
  "undermatched",
  "evidence missing",
  "language issue",
  "metadata leak",
  "hard-gate issue",
] as const;

const STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS = [
  "good",
  "too_vague",
  "wrong_focus",
  "noisy",
  "incomplete",
  "metadata_leak",
  "wrong_language",
] as const;

function isMissingJobsFunctionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Could not find public function") &&
    (message.includes("jobsPublic:loadForUser") ||
      message.includes("jobsPublic:listForUser") ||
      message.includes("jobsPublic:listArchivedForUser") ||
      message.includes("jobsPublic:getById"))
  );
}

function formatJobsDebugError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

function formatDebugScore(value: number | null): string {
  return value === null ? "null" : String(value);
}

function resolveJobsDebugPayload(
  payload: JobsMatchInputDebugPayload | null,
  serializedPayload?: string | null,
): JobsMatchInputDebugPayload | null {
  const rawPayload = payload as unknown;
  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload) as JobsMatchInputDebugPayload;
    } catch {
      return null;
    }
  }

  if (!payload?.structuredShadowSummary && serializedPayload) {
    try {
      return JSON.parse(serializedPayload) as JobsMatchInputDebugPayload;
    } catch {
      return payload;
    }
  }

  return payload;
}

function JobsStructuredShadowDebugBlock({
  payload,
  serializedPayload,
}: {
  payload: JobsMatchInputDebugPayload | null;
  serializedPayload: string | null;
}): JSX.Element | null {
  const resolvedPayload = resolveJobsDebugPayload(payload, serializedPayload);
  const summary = resolvedPayload?.structuredShadowSummary;
  if (!summary) {
    return null;
  }

  const matchedSignals = resolvedPayload?.matchedSignals ?? [];
  const missingSignals = resolvedPayload?.missingSignals ?? [];

  return (
    <section
      aria-label="Structured shadow comparison"
      data-testid="jobs-structured-shadow-debug"
      style={{
        border: "1px solid rgba(148, 163, 184, 0.35)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255, 255, 255, 0.62)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div className="dasti-empty-state__title">
          Structured shadow comparison
        </div>
        <span className="dasti-jobs-filter-chip">Internal debug only</span>
      </div>
      <p className="dasti-empty-state__subtitle" style={{ marginTop: 6 }}>
        Production score remains current match score
      </p>

      {summary.status === "unavailable" ? (
        <div className="dasti-empty-state__subtitle" style={{ marginTop: 10 }}>
          <strong>Unavailable reason:</strong> {summary.reason ?? "unknown"}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div>
            <div className="dasti-empty-state__subtitle">
              <strong>Old match</strong>
            </div>
            <div>score {formatDebugScore(summary.oldScore)}</div>
            <div>tier {summary.oldTier}</div>
            <div>matched {matchedSignals.length}</div>
            <div>missing {missingSignals.length}</div>
            {matchedSignals.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {matchedSignals.map((signal) => (
                  <li key={`matched-${signal}`}>{signal}</li>
                ))}
              </ul>
            ) : null}
            {missingSignals.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {missingSignals.map((signal) => (
                  <li key={`missing-${signal}`}>{signal}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <div className="dasti-empty-state__subtitle">
              <strong>Structured shadow</strong>
            </div>
            <div>score {formatDebugScore(summary.structuredScore)}</div>
            <div>tier {summary.structuredTier ?? "null"}</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              <span className="dasti-jobs-filter-chip">
                matched {summary.matchedCount}
              </span>
              <span className="dasti-jobs-filter-chip">
                partial {summary.partialCount}
              </span>
              <span className="dasti-jobs-filter-chip">
                missing {summary.missingCount}
              </span>
              <span className="dasti-jobs-filter-chip">
                unknown {summary.unknownCount}
              </span>
              <span className="dasti-jobs-filter-chip">
                metadata leaks {summary.metadataLeakCount}
              </span>
              <span className="dasti-jobs-filter-chip">
                {summary.provenanceComplete
                  ? "provenance complete"
                  : "provenance incomplete"}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function JobsStructuredShadowInternalPanel({
  jobId,
  summary,
}: {
  jobId: string;
  summary?: JobsStructuredShadowSummary | null;
}): JSX.Element | null {
  const recordStructuredMatchReview = useMutation(
    ((api as any).jobsPublic?.recordStructuredMatchReview ??
      "jobsPublic.recordStructuredMatchReview") as any,
  );
  const [reviewLabel, setReviewLabel] =
    React.useState<(typeof STRUCTURED_MATCH_REVIEW_LABELS)[number]>("good");
  const [summaryVerdict, setSummaryVerdict] =
    React.useState<(typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]>(
      "good",
    );
  const [requirementsVerdict, setRequirementsVerdict] =
    React.useState<(typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]>(
      "good",
    );
  const [keywordsVerdict, setKeywordsVerdict] =
    React.useState<(typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]>(
      "good",
    );
  const [notes, setNotes] = React.useState("");
  const [submitState, setSubmitState] = React.useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");

  React.useEffect(() => {
    setReviewLabel("good");
    setSummaryVerdict("good");
    setRequirementsVerdict("good");
    setKeywordsVerdict("good");
    setNotes("");
    setSubmitState("idle");
  }, [jobId]);

  if (
    !summary ||
    !summary.flagEnabled ||
    !summary.internalViewer ||
    !summary.uiEnabled ||
    summary.status !== "available"
  ) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("saving");
    void recordStructuredMatchReview({
      jobId,
      label: reviewLabel,
      extractionSummaryVerdict: summaryVerdict,
      extractionRequirementsVerdict: requirementsVerdict,
      extractionKeywordsVerdict: keywordsVerdict,
      notes,
    })
      .then(() => {
        setSubmitState("saved");
      })
      .catch(() => {
        setSubmitState("failed");
      });
  };

  return (
    <section
      aria-label="Structured shadow internal review"
      data-testid="jobs-structured-shadow-internal-panel"
      className="dasti-proposal-sheet"
    >
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">
            Internal review
          </div>
          <div className="dasti-empty-state__title">
            Structured match shadow
          </div>
          <p className="dasti-empty-state__subtitle">
            Production score remains the current match score.
          </p>
          <p className="dasti-empty-state__subtitle">
            Structured shadow is internal review only.
          </p>
        </div>
      </div>

      <div className="dasti-brief-card__summary">
        <div className="dasti-brief-card__summary-block">
          <div className="dasti-brief-card__summary-label">Current match</div>
          <div>score {formatDebugScore(summary.oldScore)}</div>
          <div>tier {summary.oldTier}</div>
        </div>

        <div className="dasti-brief-card__summary-block">
          <div className="dasti-brief-card__summary-label">
            Structured shadow
          </div>
          <div>score {formatDebugScore(summary.structuredScore)}</div>
          <div>tier {summary.structuredTier ?? "null"}</div>
          <div className="dasti-jobs-filter-chips" style={{ marginTop: 8 }}>
            <span className="dasti-jobs-filter-chip">
              matched {summary.matchedCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              partial {summary.partialCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              unknown {summary.unknownCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              hard-gate missing {summary.hardGateMissingCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              metadata leaks {summary.metadataLeakCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              {summary.languagePreserved
                ? "language preserved"
                : "language issue"}
            </span>
            <span className="dasti-jobs-filter-chip">
              {summary.provenanceComplete
                ? "provenance complete"
                : "provenance incomplete"}
            </span>
          </div>
        </div>
      </div>

      <form className="dasti-stack" onSubmit={handleSubmit}>
        <label className="dasti-jobs-toolbar__select">
          <span className="dasti-brief-card__summary-label">
            Reviewer label
          </span>
          <select
            className="dasti-select dasti-select--sm"
            aria-label="Reviewer label"
            value={reviewLabel}
            onChange={(event) =>
              setReviewLabel(
                event.target
                  .value as (typeof STRUCTURED_MATCH_REVIEW_LABELS)[number],
              )
            }
          >
            {STRUCTURED_MATCH_REVIEW_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div
          className="dasti-brief-card__summary"
          aria-label="Extraction verdicts"
        >
          <label className="dasti-jobs-toolbar__select">
            <span className="dasti-brief-card__summary-label">
              Summary verdict
            </span>
            <select
              className="dasti-select dasti-select--sm"
              aria-label="Summary verdict"
              value={summaryVerdict}
              onChange={(event) =>
                setSummaryVerdict(
                  event.target
                    .value as (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number],
                )
              }
            >
              {STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {verdict}
                </option>
              ))}
            </select>
          </label>
          <label className="dasti-jobs-toolbar__select">
            <span className="dasti-brief-card__summary-label">
              Requirements verdict
            </span>
            <select
              className="dasti-select dasti-select--sm"
              aria-label="Requirements verdict"
              value={requirementsVerdict}
              onChange={(event) =>
                setRequirementsVerdict(
                  event.target
                    .value as (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number],
                )
              }
            >
              {STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {verdict}
                </option>
              ))}
            </select>
          </label>
          <label className="dasti-jobs-toolbar__select">
            <span className="dasti-brief-card__summary-label">
              Keywords verdict
            </span>
            <select
              className="dasti-select dasti-select--sm"
              aria-label="Keywords verdict"
              value={keywordsVerdict}
              onChange={(event) =>
                setKeywordsVerdict(
                  event.target
                    .value as (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number],
                )
              }
            >
              {STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {verdict}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="dasti-jobs-toolbar__search">
          <span className="dasti-brief-card__summary-label">Review notes</span>
          <textarea
            className="dasti-select"
            aria-label="Review notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
        </label>
        <button
          type="submit"
          className="dasti-button dasti-button--pill dasti-button--sm"
          disabled={submitState === "saving"}
        >
          {submitState === "saving" ? "Logging review" : "Log review"}
        </button>
        {submitState === "saved" ? (
          <div className="dasti-empty-state__subtitle">Review logged.</div>
        ) : submitState === "failed" ? (
          <div className="dasti-empty-state__subtitle">Review logging failed.</div>
        ) : null}
      </form>
    </section>
  );
}

function JobsStructuredPreviewAdvisoryPanel({
  summary,
}: {
  summary?: JobsStructuredShadowSummary | null;
}): JSX.Element | null {
  if (
    !summary ||
    !summary.flagEnabled ||
    !summary.advisoryBetaEnabled ||
    !summary.advisoryBetaViewer ||
    summary.status !== "available"
  ) {
    return null;
  }

  return (
    <section
      aria-label="Structured preview"
      data-testid="jobs-structured-preview-advisory-panel"
      className="dasti-proposal-sheet"
    >
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">Advisory beta</div>
          <div className="dasti-empty-state__title">Structured preview</div>
          <p className="dasti-empty-state__subtitle">
            Experimental match read. Production score remains authoritative.
          </p>
        </div>
      </div>

      <div className="dasti-brief-card__summary">
        <div className="dasti-brief-card__summary-block">
          <div className="dasti-brief-card__summary-label">Current match</div>
          <div>score {formatDebugScore(summary.oldScore)}</div>
          <div>tier {summary.oldTier}</div>
        </div>

        <div className="dasti-brief-card__summary-block">
          <div className="dasti-brief-card__summary-label">
            Structured preview
          </div>
          <div>score {formatDebugScore(summary.structuredScore)}</div>
          <div>tier {summary.structuredTier ?? "null"}</div>
          <div className="dasti-jobs-filter-chips" style={{ marginTop: 8 }}>
            <span className="dasti-jobs-filter-chip">
              matched {summary.matchedCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              partial {summary.partialCount}
            </span>
            <span className="dasti-jobs-filter-chip">
              unknown {summary.unknownCount}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function JobsMatchInputDebugPanel({
  jobId,
  enabled,
  refreshKey,
}: {
  jobId: string;
  enabled: boolean;
  refreshKey: number;
}): JSX.Element | null {
  const convex = useConvex();
  const debugInspectMatchInputReference = React.useMemo(
    () =>
      ((api as any).jobsPublic?.debugInspectMatchInputByJobId ??
        "jobsPublic.debugInspectMatchInputByJobId") as any,
    [],
  );
  const [payload, setPayload] = React.useState<
    JobsMatchInputDebugPayload | null | undefined
  >(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">(
    "idle",
  );

  React.useEffect(() => {
    setIsDismissed(false);
    setCopyState("idle");
  }, [jobId]);

  React.useEffect(() => {
    if (!enabled || !jobId) {
      return;
    }

    let cancelled = false;
    setPayload(undefined);
    setError(null);

    void convex
      .query(debugInspectMatchInputReference, { jobId })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPayload((result ?? null) as JobsMatchInputDebugPayload | null);
      })
      .catch((queryError) => {
        if (cancelled) {
          return;
        }
        setError(formatJobsDebugError(queryError));
      });

    return () => {
      cancelled = true;
    };
  }, [convex, debugInspectMatchInputReference, enabled, jobId, refreshKey]);

  const serializedPayload = React.useMemo(() => {
    if (payload === undefined) {
      return null;
    }

    return JSON.stringify(payload, null, 2);
  }, [payload]);

  const handleCopy = React.useCallback(() => {
    const copyText = error ?? serializedPayload;
    if (!copyText || !navigator.clipboard?.writeText) {
      setCopyState("failed");
      return;
    }

    void navigator.clipboard
      .writeText(copyText)
      .then(() => {
        setCopyState("copied");
        window.setTimeout(() => {
          setCopyState("idle");
        }, 1800);
      })
      .catch(() => {
        setCopyState("failed");
      });
  }, [error, serializedPayload]);

  if (!enabled || !jobId || isDismissed) {
    return null;
  }

  return (
    <section
      className="dasti-empty-state dasti-empty-state--panel"
      aria-label="Match input debug"
      data-testid="jobs-match-input-debug-panel"
      style={{ alignItems: "stretch", gap: 12, padding: 16 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="dasti-empty-state__title">Debug: match input</div>
          <p className="dasti-empty-state__subtitle">
            Dev-only read-only output from <code>jobsPublic.debugInspectMatchInputByJobId</code>.
          </p>
        </div>
        <div
          className="dasti-jobs-empty-state__actions"
          style={{ marginLeft: "auto" }}
        >
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--sm"
            onClick={handleCopy}
            disabled={payload === undefined && !error}
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy JSON"}
          </button>
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--sm"
            onClick={() => setIsDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      </div>

      {error ? (
        <div className="dasti-empty-state__subtitle">
          <strong>Debug query error:</strong> {error}
        </div>
      ) : payload === undefined ? (
        <div className="dasti-empty-state__subtitle">Loading debug data…</div>
      ) : (
        <>
          <JobsStructuredShadowDebugBlock
            payload={payload}
            serializedPayload={serializedPayload}
          />
          <textarea
            readOnly
            value={serializedPayload ?? "null"}
            rows={18}
            aria-label="Match input debug output"
            onFocus={(event) => event.currentTarget.select()}
            style={{
              width: "100%",
              minHeight: 240,
              resize: "vertical",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              lineHeight: 1.5,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "rgba(15, 23, 42, 0.04)",
              color: "inherit",
            }}
          />
        </>
      )}
    </section>
  );
}

function JobsBackendUnavailable(): JSX.Element {
  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Jobs</h1>
            <p className="dasti-stack__subtitle dasti-jobs-page__subtitle">
              The local Convex jobs functions are unavailable, so the Jobs
              workspace cannot load yet.
            </p>
          </div>
        </div>

        <div className="dasti-empty-state dasti-jobs-empty-state">
          <ClipboardText size={34} strokeWidth={1.25} aria-hidden="true" />
          <div className="dasti-empty-state__title">
            Jobs backend is out of sync
          </div>
          <p className="dasti-empty-state__subtitle">
            Start or restart the local Convex dev server so
            `jobsPublic:loadForUser` and related jobs functions are registered.
          </p>
          <div className="dasti-jobs-empty-state__actions">
            <button
              type="button"
              className="dasti-button dasti-button--primary dasti-button--pill"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText("npm run dev:backend")
                  .catch(() => {});
              }}
            >
              Copy: npm run dev:backend
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--pill"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText("npx convex dev --local")
                  .catch(() => {});
              }}
            >
              Copy: npx convex dev --local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

class JobsPageRuntimeBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error !== null) {
      if (isMissingJobsFunctionError(this.state.error)) {
        return <JobsBackendUnavailable />;
      }
      throw this.state.error;
    }

    return this.props.children;
  }
}

function matchesListFilters(
  job: JobsPageListItem,
  matchFilter: JobsMatchFilter,
  hasDocsOnly: boolean,
  needsReviewOnly: boolean,
  favoritesOnly: boolean,
  optimisticReviewState?: string,
  optimisticFavorite?: boolean,
): boolean {
  const reviewState = optimisticReviewState ?? job.reviewState;
  const isFavorite = optimisticFavorite ?? job.isFavorite;
  if (matchFilter !== "all" && job.matchTier !== matchFilter) {
    return false;
  }
  if (hasDocsOnly && job.linkedDocumentCount === 0) {
    return false;
  }
  if (needsReviewOnly && reviewState !== "needs_review") {
    return false;
  }
  if (favoritesOnly && !isFavorite) {
    return false;
  }
  return true;
}

function resolveMatchTierLabel(tier: JobsPageListItem["matchTier"]): string {
  if (tier === "unknown") {
    return "—";
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function resolveLocationModeLabel(value: string): string {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || "Location unavailable";
}

function resolveOptimisticReviewState(
  currentReviewState: string,
  reviewItems: JobsPageReviewItem[],
): string {
  if (reviewItems.length === 0) {
    return currentReviewState;
  }
  return reviewItems.every((item) => item.reviewStatus === "approved")
    ? "ready"
    : "needs_review";
}

function applyApprovedValueToJob(
  current: JobsPageDetail,
  item: JobsPageReviewItem,
  nextValue: unknown,
): JobsPageDetail {
  return {
    ...current,
    [item.fieldKey]: nextValue,
  } as JobsPageDetail;
}

function buildProposalRoute(jobId: string): string {
  return `/proposal?jobId=${encodeURIComponent(jobId)}`;
}

function buildJobsRoute(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`;
}

function buildJobsListRoute(view: JobsViewMode): string {
  return view === "archived" ? "/jobs?view=archived" : "/jobs?view=list";
}

function formatJobsActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  const message = String(error ?? "").trim();
  return message || fallback;
}

function readCvPickerProfilePreview(
  cv: CvDocument,
): Record<string, unknown> | null {
  const profileSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => String(section.type) === "profile")
    : null;
  const profileEntry = Array.isArray(profileSection?.structuredContent)
    ? profileSection.structuredContent[0]
    : null;

  return profileEntry && typeof profileEntry === "object"
    ? (profileEntry as Record<string, unknown>)
    : null;
}

function readCvPickerString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toResumePickerTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortRelativeAge(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return "now";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}m`;
  }
  if (diffMs < day) {
    return `${Math.max(1, Math.floor(diffMs / hour))}h`;
  }

  return `${Math.max(1, Math.floor(diffMs / day))}d`;
}

function buildJobResumePickerOption(cv: CvDocument): JobResumePickerOption {
  const profilePreview = readCvPickerProfilePreview(cv);
  const profileName = readCvPickerString(profilePreview?.name);
  const desiredPosition =
    readCvPickerString(profilePreview?.desiredPosition) ??
    readCvPickerString(profilePreview?.title);
  const dateSource =
    typeof cv.metadata?.updatedAt === "string"
      ? cv.metadata.updatedAt
      : typeof cv.metadata?.createdAt === "string"
        ? cv.metadata.createdAt
        : undefined;
  const relativeAge = formatShortRelativeAge(dateSource);
  const exactDate = formatUiDate(dateSource);

  return {
    id: String(cv.id),
    title: formatCvDisplayTitle({
      title: String(cv.title ?? "Untitled CV"),
      profileName,
      desiredPosition,
      email: readCvPickerString(profilePreview?.email),
      phone: readCvPickerString(profilePreview?.phone),
      linkedin: readCvPickerString(profilePreview?.linkedin),
      website: readCvPickerString(profilePreview?.website),
      location: readCvPickerString(profilePreview?.location),
    }),
    dateLabel:
      relativeAge && exactDate
        ? `${relativeAge} · ${exactDate}`
        : relativeAge ?? exactDate ?? null,
    dateSortValue: toResumePickerTimestamp(dateSource),
  };
}

function JobsPageContent(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId: selectedJobId } = useParams<JobsPageRouteParams>();
  const { cvs } = useCvLibrary();
  const { showToast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const isJobsMatchInputDebugEnabled = isJobsMatchInputDebugUiEnabled();
  const holdListViewOpen = React.useMemo(
    () => new URLSearchParams(location.search).get("view") === "list",
    [location.search],
  );
  const jobsView = React.useMemo<JobsViewMode>(
    () =>
      new URLSearchParams(location.search).get("view") === "archived"
        ? "archived"
        : "active",
    [location.search],
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [matchFilter, setMatchFilter] = React.useState<JobsMatchFilter>("all");
  const [hasDocsOnly, setHasDocsOnly] = React.useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = React.useState(false);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<JobsSortOrder>("recent");
  const [optimisticActivityById, setOptimisticActivityById] = React.useState<
    Record<string, number>
  >({});
  const [optimisticReviewStateById, setOptimisticReviewStateById] =
    React.useState<Record<string, string>>({});
  const [optimisticFavoriteById, setOptimisticFavoriteById] = React.useState<
    Record<string, boolean>
  >({});
  const [optimisticSelectedJob, setOptimisticSelectedJob] =
    React.useState<JobsPageDetail>(null);
  const [isSeedingSample, setIsSeedingSample] = React.useState(false);
  const [firstRunError, setFirstRunError] = React.useState<string | null>(null);
  const lastMarkedJobIdRef = React.useRef<string | null>(null);
  const jobDecisionSessionRef = React.useRef<{
    jobId: string;
    openedAt: number;
    decisionRecorded: boolean;
  } | null>(null);
  const rowMenuRef = React.useRef<HTMLDivElement | null>(null);
  const resumePickerRef = React.useRef<HTMLDivElement | null>(null);
  const [openRowMenuJobId, setOpenRowMenuJobId] = React.useState<string | null>(
    null,
  );
  const [isResumePickerOpen, setIsResumePickerOpen] = React.useState(false);
  const [selectedJobRefreshKey, setSelectedJobRefreshKey] = React.useState(0);
  const [confirmingPermanentDeleteJobId, setConfirmingPermanentDeleteJobId] =
    React.useState<string | null>(null);
  const [duplicateTransition, setDuplicateTransition] = React.useState<{
    sourceJobId: string;
    activeJobIds: Set<string>;
  } | null>(null);

  const jobsListReference = React.useMemo(
    () =>
      ((api as any).jobsPublic?.listForUser ?? "jobsPublic.listForUser") as any,
    [],
  );
  const archivedJobsListReference = React.useMemo(
    () =>
      ((api as any).jobsPublic?.listArchivedForUser ??
        "jobsPublic.listArchivedForUser") as any,
    [],
  );
  const jobByIdReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const approveReviewItem = useMutation(
    ((api as any).jobsPublic?.approveReviewItem ??
      "jobsPublic.approveReviewItem") as any,
  );
  const seedSampleJob = useMutation(
    ((api as any).jobsPublic?.seedSampleJob ??
      "jobsPublic.seedSampleJob") as any,
  );
  const trackJobsEvent = useMutation(
    ((api as any).jobsPublic?.trackEvent ?? "jobsPublic.trackEvent") as any,
  );
  const markJobOpened = useMutation(
    ((api as any).jobsPublic?.markOpened ?? "jobsPublic.markOpened") as any,
  );
  const archiveJob = useMutation(
    ((api as any).jobsPublic?.archiveJob ?? "jobsPublic.archiveJob") as any,
  );
  const restoreArchivedJob = useMutation(
    ((api as any).jobsPublic?.restoreArchivedJob ??
      "jobsPublic.restoreArchivedJob") as any,
  );
  const deleteArchivedJob = useMutation(
    ((api as any).jobsPublic?.deleteArchivedJob ??
      "jobsPublic.deleteArchivedJob") as any,
  );
  const duplicateJob = useMutation(
    ((api as any).jobsPublic?.duplicateJob ?? "jobsPublic.duplicateJob") as any,
  );
  const updateJobField = useMutation(
    ((api as any).jobsPublic?.updateField ?? "jobsPublic.updateField") as any,
  );
  const setJobResume = useMutation(
    ((api as any).jobsPublic?.setResumeForJob ??
      "jobsPublic.setResumeForJob") as any,
  );
  const setJobFavorite = useMutation(
    ((api as any).jobsPublic?.setJobFavorite ??
      "jobsPublic.setJobFavorite") as any,
  );
  const jobs = useQuery(
    jobsListReference,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as JobsPageListItem[] | undefined;
  const archivedJobs = useQuery(
    archivedJobsListReference,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  ) as JobsPageListItem[] | undefined;
  const selectedJobRecord = useQuery(
    jobByIdReference,
    selectedJobId && isLoaded && isSignedIn && isConvexAuthenticated
      ? { jobId: selectedJobId, clientRefreshKey: selectedJobRefreshKey }
      : "skip",
  ) as JobsPageDetail | undefined;

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (!openRowMenuJobId) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !rowMenuRef.current?.contains(target)) {
        setOpenRowMenuJobId(null);
        setConfirmingPermanentDeleteJobId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenRowMenuJobId(null);
        setConfirmingPermanentDeleteJobId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openRowMenuJobId]);

  React.useEffect(() => {
    setOpenRowMenuJobId(null);
    setConfirmingPermanentDeleteJobId(null);
  }, [jobsView]);

  React.useEffect(() => {
    if (!isResumePickerOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !resumePickerRef.current?.contains(target)) {
        setIsResumePickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResumePickerOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isResumePickerOpen]);

  React.useEffect(() => {
    setIsResumePickerOpen(false);
  }, [selectedJobId]);

  React.useEffect(() => {
    if (selectedJobRecord === undefined) {
      return;
    }
    setOptimisticSelectedJob(selectedJobRecord);
    if (selectedJobRecord?.id) {
      setOptimisticReviewStateById((current) => ({
        ...current,
        [selectedJobRecord.id]: selectedJobRecord.reviewState,
      }));
    }
  }, [selectedJobRecord]);

  const displayedJobs = React.useMemo(() => {
    if (jobsView === "archived") {
      return archivedJobs;
    }

    if (duplicateTransition && duplicateTransition.sourceJobId === selectedJobId) {
      return (jobs ?? []).filter((job) =>
        duplicateTransition.activeJobIds.has(job.id),
      );
    }

    return jobs;
  }, [archivedJobs, duplicateTransition, jobs, jobsView, selectedJobId]);

  React.useEffect(() => {
    if (
      duplicateTransition &&
      selectedJobId &&
      selectedJobId !== duplicateTransition.sourceJobId
    ) {
      setDuplicateTransition(null);
    }
  }, [duplicateTransition, selectedJobId]);

  const filteredJobs = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const baseList = [...(displayedJobs ?? [])]
      .filter((job) => {
        if (jobsView === "archived") {
          return true;
        }
        return matchesListFilters(
          job,
          matchFilter,
          hasDocsOnly,
          needsReviewOnly,
          favoritesOnly,
          optimisticReviewStateById[job.id],
          optimisticFavoriteById[job.id],
        );
      })
      .filter((job) => {
        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          job.title,
          job.company,
          job.sourceDomain,
          job.sourceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      });

    baseList.sort((left, right) => {
      if (sortOrder === "oldest") {
        return (
          (optimisticActivityById[left.id] ?? left.lastActivityAt) -
          (optimisticActivityById[right.id] ?? right.lastActivityAt)
        );
      }
      if (sortOrder === "title") {
        return left.title.localeCompare(right.title);
      }
      if (sortOrder === "company") {
        return left.company.localeCompare(right.company);
      }
      return (
        (optimisticActivityById[right.id] ?? right.lastActivityAt) -
        (optimisticActivityById[left.id] ?? left.lastActivityAt)
      );
    });

    return baseList;
  }, [
    displayedJobs,
    jobsView,
    optimisticActivityById,
    optimisticFavoriteById,
    optimisticReviewStateById,
    favoritesOnly,
    hasDocsOnly,
    matchFilter,
    needsReviewOnly,
    searchQuery,
    sortOrder,
  ]);

  const isMobileJobsLayout = viewportWidth < 760;

  React.useEffect(() => {
    if (
      !selectedJobId &&
      jobsView === "active" &&
      filteredJobs.length > 0 &&
      !isMobileJobsLayout &&
      !holdListViewOpen
    ) {
      void navigate(buildJobsRoute(filteredJobs[0].id), { replace: true });
    }
  }, [
    filteredJobs,
    holdListViewOpen,
    isMobileJobsLayout,
    jobsView,
    navigate,
    selectedJobId,
  ]);

  React.useEffect(() => {
    if (!selectedJobId || !isLoaded || !isSignedIn || !isConvexAuthenticated) {
      return;
    }

    if (lastMarkedJobIdRef.current === selectedJobId) {
      return;
    }

    lastMarkedJobIdRef.current = selectedJobId;
    const now = Date.now();
    setOptimisticActivityById((current) => ({
      ...current,
      [selectedJobId]: now,
    }));
    void markJobOpened({ jobId: selectedJobId });
  }, [
    isConvexAuthenticated,
    isLoaded,
    isSignedIn,
    markJobOpened,
    selectedJobId,
  ]);

  const selectedJobSummary = React.useMemo(
    () =>
      selectedJobId
        ? (jobs ?? []).find((job) => job.id === selectedJobId) ?? null
        : null,
    [jobs, selectedJobId],
  );
  const selectedJob = optimisticSelectedJob ?? selectedJobRecord ?? null;
  const selectedJobIsLoading =
    Boolean(selectedJobId) &&
    selectedJobRecord === undefined &&
    optimisticSelectedJob === null;
  const resumePickerOptions = React.useMemo(
    () =>
      cvs
        .map((cv) => buildJobResumePickerOption(cv))
        .sort((left, right) => right.dateSortValue - left.dateSortValue),
    [cvs],
  );

  const recordJobDecision = React.useCallback(
    (outcome: "cover_letter" | "resume" | "bounce", jobId: string) => {
      const session = jobDecisionSessionRef.current;
      if (!session || session.jobId !== jobId || session.decisionRecorded) {
        return;
      }

      session.decisionRecorded = true;
      void trackJobsEvent({
        event: "job_decision_made",
        jobId,
        outcome,
        timeToDecisionMs: Math.max(0, Date.now() - session.openedAt),
        tier: selectedJob?.matchRead?.tier ?? "unknown",
      }).catch(() => {});
    },
    [selectedJob?.matchRead?.tier, trackJobsEvent],
  );

  React.useEffect(() => {
    if (!selectedJob?.id) {
      return undefined;
    }

    const openedAt = Date.now();
    jobDecisionSessionRef.current = {
      jobId: selectedJob.id,
      openedAt,
      decisionRecorded: false,
    };
    void trackJobsEvent({
      event: "job_opened",
      jobId: selectedJob.id,
      hasMatchRead: Boolean(selectedJob.matchRead),
      reviewState: selectedJob.reviewState,
    }).catch(() => {});

    return () => {
      const session = jobDecisionSessionRef.current;
      if (
        !session ||
        session.jobId !== selectedJob.id ||
        session.decisionRecorded
      ) {
        return;
      }

      session.decisionRecorded = true;
      void trackJobsEvent({
        event: "job_decision_made",
        jobId: selectedJob.id,
        outcome: "bounce",
        timeToDecisionMs: Math.max(0, Date.now() - session.openedAt),
        tier: selectedJob.matchRead?.tier ?? "unknown",
      }).catch(() => {});
    };
  }, [selectedJob?.id, selectedJob?.matchRead?.tier, trackJobsEvent]);

  const handleCreateProposal = React.useCallback(
    (jobId: string) => {
      recordJobDecision("cover_letter", jobId);
      clearActiveLocalCvId();
      startFreshProposalWorkspace();
      void navigate(buildProposalRoute(jobId), {
        state: createProposalWorkspaceResetState({
          entryIntent: "cover-letter-start",
        }),
      });
    },
    [navigate, recordJobDecision],
  );

  const handleImportFirstJob = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", {
      state: createProposalWorkspaceResetState({
        entryIntent: "cover-letter-start",
        jobImportFocus: "supported-sites",
      }),
    });
  }, [navigate]);

  const handleTrySampleJob = React.useCallback(async () => {
    setIsSeedingSample(true);
    setFirstRunError(null);

    try {
      const result = await seedSampleJob({});
      await navigate(buildJobsRoute(result.jobId));
    } catch (error) {
      setFirstRunError(
        error instanceof Error
          ? error.message
          : "Sample job could not be created.",
      );
    } finally {
      setIsSeedingSample(false);
    }
  }, [navigate, seedSampleJob]);

  const handleAttachResumeToJob = React.useCallback(
    async (resumeId: string) => {
      if (!selectedJob?.id) {
        return;
      }

      const selectedOption =
        resumePickerOptions.find((option) => option.id === resumeId) ?? null;
      const resumeName = selectedOption?.title ?? null;

      try {
        await setJobResume({
          jobId: selectedJob.id,
          resumeId,
          resumeName,
        });
        setSelectedJobRefreshKey((key) => key + 1);
        setOptimisticSelectedJob((current) =>
          current && current.id === selectedJob.id
            ? {
                ...current,
                resumeId,
                resumeName: resumeName ?? undefined,
                resumeSource: "job",
              }
            : current,
        );
        setIsResumePickerOpen(false);
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Could not attach the selected resume.",
          { variant: "error" },
        );
      }
    },
    [resumePickerOptions, selectedJob?.id, setJobResume, showToast],
  );

  const handleDetachResumeFromJob = React.useCallback(async () => {
    if (!selectedJob?.id) {
      return;
    }

    try {
      await setJobResume({
        jobId: selectedJob.id,
        resumeId: null,
        resumeName: null,
      });
      setSelectedJobRefreshKey((key) => key + 1);
      setOptimisticSelectedJob((current) =>
        current && current.id === selectedJob.id
          ? {
              ...current,
              resumeId: undefined,
              resumeName: undefined,
              resumeSource: undefined,
            }
          : current,
      );
      setIsResumePickerOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Detach failed. Try again.",
        { variant: "error" },
      );
    }
  }, [selectedJob?.id, setJobResume, showToast]);

  const handleSetJobFavorite = React.useCallback(
    async (jobId: string, nextFavorite: boolean) => {
      const previousFavorite =
        optimisticFavoriteById[jobId] ??
        (selectedJob?.id === jobId ? selectedJob.isFavorite : undefined) ??
        (jobs ?? []).find((job) => job.id === jobId)?.isFavorite ??
        false;

      setOptimisticFavoriteById((current) => ({
        ...current,
        [jobId]: nextFavorite,
      }));
      setOptimisticSelectedJob((current) =>
        current && current.id === jobId
          ? {
              ...current,
              isFavorite: nextFavorite,
            }
          : current,
      );

      try {
        await setJobFavorite({ jobId, isFavorite: nextFavorite });
      } catch (error) {
        setOptimisticFavoriteById((current) => ({
          ...current,
          [jobId]: previousFavorite,
        }));
        setOptimisticSelectedJob((current) =>
          current && current.id === jobId
            ? {
                ...current,
                isFavorite: previousFavorite,
              }
            : current,
        );
        showToast(
          error instanceof Error ? error.message : "Favorite update failed.",
          { variant: "error" },
        );
      }
    },
    [
      jobs,
      optimisticFavoriteById,
      selectedJob?.id,
      selectedJob?.isFavorite,
      setJobFavorite,
      showToast,
    ],
  );

  const handleApproveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        const nextReviewItems = current.reviewItems.map((reviewItem) =>
          reviewItem.id === item.id
            ? {
                ...reviewItem,
                reviewStatus: "approved",
                approvedValue:
                  reviewItem.approvedValue ?? reviewItem.suggestedValue,
              }
            : reviewItem,
        );
        const nextReviewState = resolveOptimisticReviewState(
          current.reviewState,
          nextReviewItems,
        );

        setOptimisticReviewStateById((prev) => ({
          ...prev,
          [current.id]: nextReviewState,
        }));

        return applyApprovedValueToJob(
          {
            ...current,
            reviewItems: nextReviewItems,
            reviewState: nextReviewState,
          },
          item,
          item.approvedValue ?? item.suggestedValue,
        );
      });

      if (!selectedJobId) {
        return;
      }

      await approveReviewItem({ jobId: selectedJobId, reviewItemId: item.id });
      void trackJobsEvent({
        event: "import_accepted",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
      }).catch(() => {});
    },
    [approveReviewItem, selectedJobId, trackJobsEvent],
  );

  const handleSaveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem, nextValue: string | string[]) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        const nextReviewItems = current.reviewItems.map((reviewItem) =>
          reviewItem.id === item.id
            ? {
                ...reviewItem,
                reviewStatus: "approved",
                approvedValue: nextValue,
              }
            : reviewItem,
        );
        const nextReviewState = resolveOptimisticReviewState(
          current.reviewState,
          nextReviewItems,
        );

        setOptimisticReviewStateById((prev) => ({
          ...prev,
          [current.id]: nextReviewState,
        }));

        return applyApprovedValueToJob(
          {
            ...current,
            reviewItems: nextReviewItems,
            reviewState: nextReviewState,
          },
          item,
          nextValue,
        );
      });

      if (!selectedJobId) {
        return;
      }

      await updateJobField({
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
        value: nextValue,
      });
      void trackJobsEvent({
        event: "field_corrected",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
        beforeConfidence: item.confidence,
      }).catch(() => {});
      void trackJobsEvent({
        event: "import_rejected",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
      }).catch(() => {});
    },
    [selectedJobId, trackJobsEvent, updateJobField],
  );

  const handleSaveField = React.useCallback(
    async (fieldKey: string, nextValue: string | string[]) => {
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [fieldKey]: nextValue,
        } as JobsPageDetail;
      });

      if (!selectedJobId) {
        return;
      }

      await updateJobField({
        jobId: selectedJobId,
        fieldKey,
        value: nextValue,
      });
      void trackJobsEvent({
        event: "field_corrected",
        jobId: selectedJobId,
        fieldKey,
        beforeConfidence:
          fieldKey === "summary"
            ? Number(selectedJob?.summaryExtraction?.confidence ?? 0.35)
            : 0,
      }).catch(() => {});
    },
    [selectedJob, selectedJobId, trackJobsEvent, updateJobField],
  );

  const handleOpenJobSource = React.useCallback((sourceUrl: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = String(sourceUrl ?? "").trim();
    if (!nextUrl) {
      return;
    }

    window.open(nextUrl, "_blank", "noopener");
  }, []);

  const handleArchiveJob = React.useCallback(
    async (jobId: string) => {
      try {
        await archiveJob({ jobId });
        if (selectedJobId === jobId) {
          await navigate(buildJobsListRoute("active"));
        }
      } catch (error) {
        showToast("Archive failed", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [archiveJob, navigate, selectedJobId, showToast],
  );

  const handleRestoreArchivedJob = React.useCallback(
    async (jobId: string) => {
      try {
        await restoreArchivedJob({ jobId });
        setOpenRowMenuJobId(null);
        setConfirmingPermanentDeleteJobId(null);
        await navigate(buildJobsListRoute("active"));
      } catch (error) {
        showToast("Restore failed", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [navigate, restoreArchivedJob, showToast],
  );

  const handleDeleteArchivedJob = React.useCallback(
    async (jobId: string) => {
      try {
        await deleteArchivedJob({ jobId });
        setOpenRowMenuJobId(null);
        setConfirmingPermanentDeleteJobId(null);
      } catch (error) {
        showToast("Delete failed", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [deleteArchivedJob, showToast],
  );

  const handleDuplicateJob = React.useCallback(
    async (jobId: string) => {
      setOpenRowMenuJobId(null);
      setConfirmingPermanentDeleteJobId(null);
      setDuplicateTransition({
        sourceJobId: jobId,
        activeJobIds: new Set((jobs ?? []).map((job) => job.id)),
      });

      try {
        const result = await duplicateJob({ jobId });
        await navigate(buildJobsRoute(result.jobId));
      } catch (error) {
        setDuplicateTransition(null);
        showToast("Duplicate failed", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [duplicateJob, jobs, navigate, showToast],
  );

  const authStatusMessage =
    !isLoaded || isConvexAuthLoading
      ? "Loading"
      : !isSignedIn || !isConvexAuthenticated
        ? "Sign in to see jobs."
        : null;
  const isJobsListLoading =
    !authStatusMessage &&
    isLoaded &&
    isSignedIn &&
    isConvexAuthenticated &&
    (jobs === undefined || archivedJobs === undefined);
  const hasActiveJobs = (jobs?.length ?? 0) > 0;
  const hasArchivedJobs = (archivedJobs?.length ?? 0) > 0;
  const hasJobs = hasActiveJobs || hasArchivedJobs;
  const selectedSourceLabel = getProposalSourceLabel(
    selectedJob?.sourceType ?? selectedJobSummary?.sourceType,
    selectedJob?.sourceUrl ?? selectedJobSummary?.sourceUrl,
  );
  const shouldShowListPane =
    jobsView === "archived" || !isMobileJobsLayout || !selectedJobId;
  const shouldShowDetailPane =
    jobsView === "active" && (!isMobileJobsLayout || Boolean(selectedJobId));

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title">Jobs</h1>
            <p className="dasti-stack__subtitle dasti-jobs-page__subtitle">
              Saved jobs. Review. Act.
            </p>
          </div>
        </div>

        {authStatusMessage ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            {authStatusMessage}
          </div>
        ) : null}

        {isJobsListLoading ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            Loading jobs
          </div>
        ) : null}

        {!authStatusMessage && !isJobsListLoading && !hasJobs ? (
          <FirstRunPanel
            onImportFirstJob={handleImportFirstJob}
            onTrySampleJob={handleTrySampleJob}
            isSeedingSample={isSeedingSample}
            errorMessage={firstRunError}
          />
        ) : null}

        {!authStatusMessage && !isJobsListLoading && hasJobs ? (
          <div
            className={[
              "dasti-jobs-layout",
              isMobileJobsLayout && selectedJobId
                ? "dasti-jobs-layout--mobile-detail"
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shouldShowListPane ? (
              <section className="dasti-jobs-list-pane" aria-label="Jobs list">
                <div className="dasti-jobs-toolbar">
                  <label className="dasti-jobs-toolbar__search">
                    <span className="sr-only">Search jobs</span>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search jobs"
                      aria-label="Search jobs"
                      className="dasti-select dasti-select--sm"
                    />
                  </label>
                  <label className="dasti-jobs-toolbar__select">
                    <span className="sr-only">Sort jobs</span>
                    <select
                      value={sortOrder}
                      onChange={(event) =>
                        setSortOrder(event.target.value as JobsSortOrder)
                      }
                      aria-label="Sort jobs"
                      className="dasti-select dasti-select--sm"
                    >
                      <option value="recent">Recent activity</option>
                      <option value="oldest">Oldest first</option>
                      <option value="title">Title</option>
                      <option value="company">Company</option>
                    </select>
                  </label>
                  <span className="dasti-jobs-toolbar__count">
                    {filteredJobs.length === (displayedJobs?.length ?? 0)
                      ? `${displayedJobs?.length ?? 0} jobs`
                      : `${filteredJobs.length} of ${displayedJobs?.length ?? 0}`}
                  </span>
                </div>
                <div className="dasti-jobs-filter-chips" aria-label="Job views">
                  <button
                    type="button"
                    className={[
                      "dasti-jobs-filter-chip",
                      jobsView === "active"
                        ? "dasti-jobs-filter-chip--active"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={jobsView === "active"}
                    onClick={() => void navigate(buildJobsListRoute("active"))}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={[
                      "dasti-jobs-filter-chip",
                      jobsView === "archived"
                        ? "dasti-jobs-filter-chip--active"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={jobsView === "archived"}
                    onClick={() =>
                      void navigate(buildJobsListRoute("archived"))
                    }
                  >
                    Archived
                  </button>
                </div>
                {jobsView === "active" ? (
                  <div
                    className="dasti-jobs-filter-chips"
                    aria-label="Job filters"
                  >
                    <button
                      type="button"
                      className={[
                        "dasti-jobs-filter-chip",
                        matchFilter === "all"
                          ? "dasti-jobs-filter-chip--active"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setMatchFilter("all")}
                    >
                      All tiers
                    </button>
                    {(["strong", "partial", "weak", "unknown"] as const).map(
                      (tier) => (
                        <button
                          key={tier}
                          type="button"
                          className={[
                            "dasti-jobs-filter-chip",
                            matchFilter === tier
                              ? "dasti-jobs-filter-chip--active"
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setMatchFilter(tier)}
                        >
                          {tier === "unknown"
                            ? "Match —"
                            : `Match ${resolveMatchTierLabel(tier)}`}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className={[
                        "dasti-jobs-filter-chip",
                        hasDocsOnly ? "dasti-jobs-filter-chip--active" : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setHasDocsOnly((current) => !current)}
                    >
                      Has docs
                    </button>
                    <button
                      type="button"
                      className={[
                        "dasti-jobs-filter-chip",
                        needsReviewOnly
                          ? "dasti-jobs-filter-chip--active"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setNeedsReviewOnly((current) => !current)}
                    >
                      Needs review
                    </button>
                    <button
                      type="button"
                      className={[
                        "dasti-jobs-filter-chip",
                        favoritesOnly ? "dasti-jobs-filter-chip--active" : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setFavoritesOnly((current) => !current)}
                    >
                      Favorites
                    </button>
                  </div>
                ) : null}

                {filteredJobs.length === 0 ? (
                  <div className="dasti-empty-state dasti-empty-state--panel">
                    <FileText size={28} strokeWidth={1.2} aria-hidden="true" />
                    <div className="dasti-empty-state__title">
                      {jobsView === "archived"
                        ? "No archived jobs"
                        : "No jobs match this search"}
                    </div>
                    <p className="dasti-empty-state__subtitle">
                      {jobsView === "archived"
                        ? "Archive a job to see it here."
                        : "Try a wider search."}
                    </p>
                  </div>
                ) : (
                  <div className="dasti-jobs-list" role="list">
                    {filteredJobs.map((job) => {
                      const isActive = job.id === selectedJobId;
                      const title = job.title.trim() || "Untitled job";
                      const company = job.company.trim() || "Unknown company";
                      const locationLabel = resolveLocationModeLabel(
                        job.location,
                      );
                      const lastActivityLabel =
                        formatUiDate(
                          optimisticActivityById[job.id] ?? job.lastActivityAt,
                        ) ?? "Recent";
                      const reviewState =
                        optimisticReviewStateById[job.id] ?? job.reviewState;
                      const isFavorite =
                        optimisticFavoriteById[job.id] ?? job.isFavorite;
                      const matchLabel = resolveMatchTierLabel(job.matchTier);
                      const isRowMenuOpen = openRowMenuJobId === job.id;

                      return (
                        <article
                          key={job.id}
                          className={[
                            "dasti-jobs-row",
                            isActive ? "dasti-jobs-row--active" : null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          role="listitem"
                          onClick={() => {
                            if (jobsView === "active") {
                              void navigate(buildJobsRoute(job.id));
                            }
                          }}
                        >
                          <div className="dasti-jobs-row__copy">
                            <div className="dasti-jobs-row__title">
                              <span>{title}</span>
                              {job.isSample ? (
                                <span className="dasti-jobs-sample-badge">
                                  Sample
                                </span>
                              ) : null}
                              {isFavorite ? (
                                <span className="dasti-jobs-sample-badge">
                                  Favorite
                                </span>
                              ) : null}
                            </div>
                            <div className="dasti-jobs-row__company">
                              {company}
                              {` · ${locationLabel}`}
                            </div>
                            <div className="dasti-jobs-row__meta">
                              <span className="dasti-jobs-match-chip">
                                {matchLabel}
                              </span>
                              <span className="dasti-jobs-row__meta-pill">
                                <FileText
                                  size={12}
                                  strokeWidth={1.7}
                                  aria-hidden="true"
                                />
                                <span>{job.linkedDocumentCount}</span>
                              </span>
                              <span>Last activity {lastActivityLabel}</span>
                              {reviewState === "needs_review" ? (
                                <span
                                  className="dasti-jobs-review-dot"
                                  aria-label="Needs review"
                                  title="Needs review"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="dasti-jobs-row__controls">
                            {jobsView === "active" ? (
                              <>
                                <button
                                  type="button"
                                  className="dasti-icon-button dasti-jobs-row__favorite"
                                  aria-pressed={isFavorite}
                                  aria-label={
                                    isFavorite
                                      ? `Remove ${title} from favorites`
                                      : `Mark ${title} as favorite`
                                  }
                                  title={
                                    isFavorite
                                      ? "Remove from favorites"
                                      : "Mark favorite"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleSetJobFavorite(
                                      job.id,
                                      !isFavorite,
                                    );
                                  }}
                                >
                                  <Star
                                    size={16}
                                    strokeWidth={1.8}
                                    weight={isFavorite ? "fill" : "regular"}
                                    aria-hidden="true"
                                  />
                                </button>
                              </>
                            ) : null}
                            <div
                              ref={isRowMenuOpen ? rowMenuRef : null}
                              className="dasti-import-dropdown dasti-jobs-row__menu"
                              data-open={isRowMenuOpen ? "true" : "false"}
                            >
                              <button
                                type="button"
                                className="dasti-icon-button dasti-jobs-row__menu-trigger"
                                aria-label={`More actions for ${title}`}
                                aria-expanded={isRowMenuOpen}
                                aria-haspopup="menu"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenRowMenuJobId((current) =>
                                    current === job.id ? null : job.id,
                                  );
                                }}
                              >
                                <DotsThree
                                  size={16}
                                  strokeWidth={1.7}
                                  aria-hidden="true"
                                />
                              </button>
                              {isRowMenuOpen ? (
                                <div
                                  className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-jobs-row__menu-surface"
                                  role="menu"
                                  aria-label={`Actions for ${title}`}
                                >
                                  {jobsView === "active" ? (
                                    <>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="dasti-cv-style-presets__option"
                                        disabled={!job.sourceUrl}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenRowMenuJobId(null);
                                          handleOpenJobSource(job.sourceUrl);
                                        }}
                                      >
                                        <span className="dasti-cv-style-presets__option-copy">
                                          <span className="dasti-cv-style-presets__option-title">
                                            Open source
                                          </span>
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="dasti-cv-style-presets__option"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenRowMenuJobId(null);
                                          void handleArchiveJob(job.id);
                                        }}
                                      >
                                        <span className="dasti-cv-style-presets__option-copy">
                                          <span className="dasti-cv-style-presets__option-title">
                                            Archive
                                          </span>
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="dasti-cv-style-presets__option"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenRowMenuJobId(null);
                                          void handleDuplicateJob(job.id);
                                        }}
                                      >
                                        <span className="dasti-cv-style-presets__option-copy">
                                          <span className="dasti-cv-style-presets__option-title">
                                            Duplicate
                                          </span>
                                        </span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="dasti-cv-style-presets__option"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleRestoreArchivedJob(job.id);
                                        }}
                                      >
                                        <span className="dasti-cv-style-presets__option-copy">
                                          <span className="dasti-cv-style-presets__option-title">
                                            Restore
                                          </span>
                                        </span>
                                      </button>
                                      {confirmingPermanentDeleteJobId ===
                                      job.id ? (
                                        <>
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="dasti-cv-style-presets__option"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void handleDeleteArchivedJob(
                                                job.id,
                                              );
                                            }}
                                          >
                                            <span className="dasti-cv-style-presets__option-copy">
                                              <span className="dasti-cv-style-presets__option-title">
                                                Confirm
                                              </span>
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="dasti-cv-style-presets__option"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setConfirmingPermanentDeleteJobId(
                                                null,
                                              );
                                            }}
                                          >
                                            <span className="dasti-cv-style-presets__option-copy">
                                              <span className="dasti-cv-style-presets__option-title">
                                                Cancel
                                              </span>
                                            </span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          role="menuitem"
                                          className="dasti-cv-style-presets__option"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setConfirmingPermanentDeleteJobId(
                                              job.id,
                                            );
                                          }}
                                        >
                                          <span className="dasti-cv-style-presets__option-copy">
                                            <span className="dasti-cv-style-presets__option-title">
                                              Delete forever
                                            </span>
                                          </span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {shouldShowDetailPane ? (
              <section
                className="dasti-jobs-detail-pane"
                aria-label="Job detail"
              >
                {!selectedJobId ? null : selectedJobIsLoading ? (
                  <div className="dasti-empty-state dasti-empty-state--panel">
                    <div className="dasti-empty-state__title">Loading job</div>
                  </div>
                ) : !selectedJob ? (
                  <div className="dasti-empty-state dasti-empty-state--panel">
                    <div className="dasti-empty-state__title">
                      Job unavailable
                    </div>
                    <p className="dasti-empty-state__subtitle">
                      Could not load this job. Open another.
                    </p>
                  </div>
                ) : (
                  <div className="dasti-jobs-detail">
                    {isMobileJobsLayout ? (
                      <div className="dasti-jobs-detail__mobile-back">
                        <button
                          type="button"
                          className="dasti-button dasti-button--pill dasti-button--sm"
                          onClick={() => void navigate("/jobs")}
                        >
                          <ArrowLeft
                            size={14}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                          Back to jobs
                        </button>
                      </div>
                    ) : null}
                    <div className="dasti-jobs-detail__topline">
                      <div className="dasti-jobs-detail__identity">
                        <div className="dasti-jobs-detail__title">
                          <span>{selectedJob.title || "Untitled job"}</span>
                          {selectedJob.isSample ? (
                            <span className="dasti-jobs-sample-badge">
                              Sample
                            </span>
                          ) : null}
                          {selectedJob.isFavorite ? (
                            <span className="dasti-jobs-sample-badge">
                              Favorite
                            </span>
                          ) : null}
                        </div>
                        <div className="dasti-jobs-detail__meta">
                          <span>
                            {selectedJob.company || "Unknown company"}
                          </span>
                          <>
                            <span>·</span>
                            <span>
                              {resolveLocationModeLabel(selectedJob.location)}
                            </span>
                          </>
                          {selectedSourceLabel ? (
                            <>
                              <span>·</span>
                              <span>{selectedSourceLabel}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="dasti-icon-button"
                        aria-pressed={selectedJob.isFavorite}
                        aria-label={
                          selectedJob.isFavorite
                            ? "Remove job from favorites"
                            : "Mark job as favorite"
                        }
                        title={
                          selectedJob.isFavorite
                            ? "Remove from favorites"
                            : "Mark favorite"
                        }
                        onClick={() => {
                          void handleSetJobFavorite(
                            selectedJob.id,
                            !selectedJob.isFavorite,
                          );
                        }}
                      >
                        <Star
                          size={17}
                          strokeWidth={1.8}
                          weight={selectedJob.isFavorite ? "fill" : "regular"}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="dasti-jobs-command-bar" aria-label="Job actions">
                      <div
                        ref={resumePickerRef}
                        className="dasti-jobs-detail__resume-picker dasti-jobs-command-bar__resume-picker"
                      >
                        <span className="dasti-jobs-command-bar__label">
                          Resume
                        </span>
                        <div
                          className={
                            selectedJob.resumeName
                              ? "styleforge-active-cv-control styleforge-active-cv-control--loaded dasti-jobs-command-bar__cv-control"
                              : "styleforge-active-cv-control styleforge-active-cv-control--ghost dasti-jobs-command-bar__cv-control"
                          }
                        >
                          <button
                            type="button"
                            className="styleforge-active-cv-control__icon-button"
                            aria-label={
                              selectedJob.resumeName
                                ? "Remove attached resume"
                                : "Attach resume"
                            }
                            onClick={() => {
                              if (selectedJob.resumeName) {
                                void handleDetachResumeFromJob();
                                return;
                              }
                              setIsResumePickerOpen((current) => !current);
                            }}
                          >
                            <span
                              className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--base"
                              aria-hidden
                            >
                              <Paperclip size={15} strokeWidth={1.8} />
                            </span>
                            {selectedJob.resumeName ? (
                              <span
                                className="styleforge-active-cv-control__icon styleforge-active-cv-control__icon--hover"
                                aria-hidden
                              >
                                <X size={15} strokeWidth={1.8} />
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className="styleforge-active-cv-control__body"
                            aria-controls={`job-resume-picker-${selectedJob.id}`}
                            aria-expanded={isResumePickerOpen}
                            aria-haspopup="dialog"
                            aria-label={
                              selectedJob.resumeName
                                ? `Attached resume: ${selectedJob.resumeName}`
                                : "Attach resume"
                            }
                            onClick={() => {
                              setIsResumePickerOpen((current) => !current);
                            }}
                          >
                            <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                              {selectedJob.resumeName ?? "Attach resume"}
                            </span>
                          </button>
                        </div>
                        {isResumePickerOpen ? (
                          <div
                            id={`job-resume-picker-${selectedJob.id}`}
                            role="dialog"
                            aria-label="Attach resume"
                            className="dasti-jobs-detail__resume-popover dasti-toolbar-drawer-surface"
                          >
                            {resumePickerOptions.length === 0 ? (
                              <div className="dasti-jobs-detail__resume-empty">
                                No resumes yet. Create one in CvForge.
                              </div>
                            ) : (
                              <div className="dasti-jobs-detail__resume-popover-list">
                                {resumePickerOptions.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={[
                                      "dasti-jobs-detail__resume-option",
                                      option.id === selectedJob.resumeId
                                        ? "dasti-jobs-detail__resume-option--active"
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    aria-label={`Attach ${option.title}`}
                                    onClick={() => {
                                      void handleAttachResumeToJob(option.id);
                                    }}
                                  >
                                    <span className="dasti-jobs-detail__resume-option-title">
                                      {option.title}
                                    </span>
                                    {option.dateLabel ? (
                                      <span className="dasti-jobs-detail__resume-option-meta">
                                        {option.dateLabel}
                                      </span>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="dasti-jobs-command-bar__actions">
                        <button
                          type="button"
                          className="dasti-button dasti-button--sm dasti-button--pill dasti-button--primary"
                          onClick={() => handleCreateProposal(selectedJob.id)}
                        >
                          Draft Proposal
                        </button>
                      </div>
                    </div>

                    {selectedJob.matchRead ? (
                      <MatchReadBlock
                        matchRead={selectedJob.matchRead}
                        visibleRequirements={selectedJob.visibleRequirements}
                        jobTitle={selectedJob.title}
                        jobCompany={selectedJob.company}
                        jobLocation={selectedJob.location}
                        onRefreshMatch={() => {
                          setSelectedJobRefreshKey((key) => key + 1);
                        }}
                      />
                    ) : null}

                    <JobsStructuredShadowInternalPanel
                      jobId={selectedJob.id}
                      summary={selectedJob.structuredShadowSummary}
                    />

                    <JobsStructuredPreviewAdvisoryPanel
                      summary={selectedJob.structuredShadowSummary}
                    />

                    {isJobsMatchInputDebugEnabled ? (
                      <JobsMatchInputDebugPanel
                        jobId={selectedJob.id}
                        enabled={isLoaded && isSignedIn && isConvexAuthenticated}
                        refreshKey={selectedJobRefreshKey}
                      />
                    ) : null}

                    <ProposalBriefCard
                      sourceJobTitle={selectedJob.title}
                      outputDocumentTitle={null}
                      jobDescription={selectedJob.rawDescription}
                      sourceUrl={selectedJob.sourceUrl}
                      sourcePlatform={selectedJob.sourceType}
                      summaryText={selectedJob.summary}
                      visibleSummaryText={selectedJob.visibleSummary}
                      requirements={selectedJob.mustHaves}
                      visibleRequirements={selectedJob.visibleRequirements}
                      keywords={selectedJob.keywords}
                      visibleKeywords={selectedJob.visibleKeywords}
                      extractionUnavailable={
                        selectedJob.visibleExtractionSource !== "llm"
                      }
                      parseStatus={selectedJob.parseStatus}
                      trustState={selectedJob.reviewState}
                      linkedDocumentCount={selectedJob.linkedProposalCount}
                      linkedProposals={selectedJob.linkedProposals}
                      reviewItems={selectedJob.reviewItems}
                      onSaveField={handleSaveField}
                      onApproveReviewItem={handleApproveReviewItem}
                      onSaveReviewItem={handleSaveReviewItem}
                    />
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function JobsPage(): JSX.Element {
  return (
    <JobsPageRuntimeBoundary>
      <JobsPageContent />
    </JobsPageRuntimeBoundary>
  );
}
