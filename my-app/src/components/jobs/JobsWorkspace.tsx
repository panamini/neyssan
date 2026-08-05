import React from "react";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardText } from "@/lib/icons";
import { api } from "../../../convex/_generated/api";
import { FirstRunPanel } from "./FirstRunPanel";
import {
  CvTailoringReviewPanel,
  type AutoCvTailoringReviewDtoV1,
  type CvTailoringReviewDtoV1,
} from "./CvTailoringReviewPanel";
import { JobDetail } from "./JobDetail";
import { JobsList } from "./JobsList";
import {
  ManualApplicationHandoffPanel,
  type ManualApplicationHandoffDeliveryContent,
  type ManualApplicationHandoffPanelState,
} from "./ManualApplicationHandoffPanel";
import { useToast } from "../ui/toast";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { useJobsQuery } from "../../hooks/useJobsQuery";
import { getProposalSourceLabel } from "../../lib/proposal-source-platforms";
import { clearActiveLocalCvId } from "../../lib/proposal-personalization";
import { formatCvDisplayTitle } from "../../lib/proposal-personalization";
import {
  createProposalWorkspaceResetState,
  startFreshProposalWorkspace,
} from "../../lib/proposal-workspace-state";
import { openOnboardingReplay } from "../../lib/onboarding-replay-event";
import type { CvDocument } from "../../types/cvDocument";
import { formatUiDate } from "../../lib/ui-date";
import {
  REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX,
  readReviewedSourceCvVariantBinding,
} from "../../lib/reviewed-source-cv-variant";
import { isClaimBackedResumeVariantPlanAction } from "../../modules/resume-variant-plan/planRules";
import { mapPersistedProfileToCvDocument } from "../../adapters/StorageAdapter";

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
  matchRead?: {
    tier: "strong" | "partial" | "weak" | "unknown";
  } | null;
  matchReview?: {
    verdict:
      | "strong_lead"
      | "possible_lead"
      | "probably_skip"
      | "not_enough_signal";
    score?: number | null;
  } | null;
  status: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  lastActivityAt: number;
  linkedDocumentCount: number;
  keywords?: string[];
  visibleKeywords?: string[];
  skills?: string[];
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
  resumeProposalAuthority?: "source" | "reviewed_ready" | "reviewed_invalid";
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
      | "requirements_missing"
      | "structured_pending";
  } | null;
  matchReview?: {
    verdict:
      | "strong_lead"
      | "possible_lead"
      | "probably_skip"
      | "not_enough_signal";
    score?: number | null;
    confidence: number;
    one_liner: string;
    why_this_may_interest_you: string[];
    watch_out: string[];
    suggested_next_step:
      | "apply"
      | "apply_if_requirement_true"
      | "improve_profile_first"
      | "skip"
      | "review_manually";
    missing_or_unclear_requirements: Array<{
      requirement: string;
      severity: "minor" | "important" | "blocking" | "unclear";
      reason: string;
    }>;
    evidence: Array<{
      job_signal: string;
      profile_signal: string;
      explanation: string;
    }>;
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

const JOBS_SPLIT_VIEW_COLLAPSE_WIDTH = 1024;

type JobsSortOrder = "recent" | "oldest" | "title" | "company";
type JobsMatchFilter =
  | "worth_plus"
  | "all"
  | "strong"
  | "partial"
  | "weak"
  | "unknown";
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

function isUnavailableJobError(error: unknown): boolean {
  const message = formatJobsDebugError(error);
  return /\bjob not found\b|\bjob unavailable\b/i.test(message);
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
    React.useState<
      (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]
    >("good");
  const [requirementsVerdict, setRequirementsVerdict] =
    React.useState<
      (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]
    >("good");
  const [keywordsVerdict, setKeywordsVerdict] =
    React.useState<
      (typeof STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS)[number]
    >("good");
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
          <div className="dasti-brief-card__summary-label">Internal review</div>
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
          <div className="dasti-empty-state__subtitle">
            Review logging failed.
          </div>
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
            Structured score is used when available. Missing extraction stays
            pending instead of using keyword fallback.
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
  const [copyState, setCopyState] = React.useState<
    "idle" | "copied" | "failed"
  >("idle");

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
            Dev-only read-only output from{" "}
            <code>jobsPublic.debugInspectMatchInputByJobId</code>.
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
              <span>Copy: npm run dev:backend</span>
              <span className="ds-btn__period" aria-hidden="true">
                .
              </span>
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

function JobsJobUnavailable(): JSX.Element {
  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        <div className="dasti-empty-state dasti-jobs-empty-state">
          <ClipboardText size={34} strokeWidth={1.25} aria-hidden="true" />
          <div className="dasti-empty-state__title">Job unavailable</div>
          <p className="dasti-empty-state__subtitle">
            This offer is no longer available for this account. Choose another
            offer from your Jobs list.
          </p>
          <a
            className="dasti-button dasti-button--primary dasti-button--pill"
            href="/jobs"
          >
            Back to jobs
          </a>
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
      if (isUnavailableJobError(this.state.error)) {
        return <JobsJobUnavailable />;
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
  noDocsOnly: boolean,
  needsReviewOnly: boolean,
  favoritesOnly: boolean,
  optimisticOpenedAt?: number,
  optimisticFavorite?: boolean,
): boolean {
  const openedAt = optimisticOpenedAt ?? job.lastOpenedAt;
  const isFavorite = optimisticFavorite ?? job.isFavorite;
  const verdict = job.matchReview?.verdict;
  const resolvedTier = job.matchRead?.tier ?? job.matchTier;
  const isStrongMatch = verdict === "strong_lead" || resolvedTier === "strong";
  const isWorthMatch =
    verdict === "possible_lead" || resolvedTier === "partial";
  if (matchFilter === "worth_plus" && !isStrongMatch && !isWorthMatch) {
    return false;
  }
  if (matchFilter === "strong" && !isStrongMatch) {
    return false;
  }
  if (matchFilter === "partial" && !isWorthMatch) {
    return false;
  }
  if (matchFilter === "weak" && resolvedTier !== "weak") {
    return false;
  }
  if (matchFilter === "unknown" && resolvedTier !== "unknown") {
    return false;
  }
  if (hasDocsOnly && job.linkedDocumentCount === 0) {
    return false;
  }
  if (noDocsOnly && job.linkedDocumentCount > 0) {
    return false;
  }
  if (needsReviewOnly && openedAt > 0) {
    return false;
  }
  if (favoritesOnly && !isFavorite) {
    return false;
  }
  return true;
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
  return `/proposal?jobId=${encodeURIComponent(jobId)}&drawer=proposal-draft`;
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

function readCvTailoringReviewResult(
  value: unknown,
  expectedMode: "auto_recommended" | "full_source_cv",
  expectedSourceCvId: string,
): CvTailoringReviewDtoV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const result = value as Record<string, unknown>;
  const sourceCv =
    result.sourceCv &&
    typeof result.sourceCv === "object" &&
    !Array.isArray(result.sourceCv)
      ? (result.sourceCv as Record<string, unknown>)
      : null;
  if (
    result.mode !== expectedMode ||
    sourceCv?.id !== expectedSourceCvId ||
    typeof sourceCv.contextHash !== "string"
  ) {
    return null;
  }
  if (expectedMode === "full_source_cv") {
    return result.plan === null ? (result as CvTailoringReviewDtoV1) : null;
  }
  const plan =
    result.plan &&
    typeof result.plan === "object" &&
    !Array.isArray(result.plan)
      ? (result.plan as Record<string, unknown>)
      : null;
  if (
    !plan ||
    typeof plan.id !== "string" ||
    typeof plan.blocked !== "boolean" ||
    !Array.isArray(plan.requiredDemandIds) ||
    !plan.requiredDemandIds.every((id) => typeof id === "string") ||
    !Array.isArray(plan.items) ||
    !Array.isArray(plan.warnings)
  ) {
    return null;
  }
  const itemsAreValid = plan.items.every((candidate) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      return false;
    }
    const item = candidate as Record<string, unknown>;
    return (
      typeof item.id === "string" &&
      typeof item.section === "string" &&
      typeof item.action === "string" &&
      typeof item.priority === "string" &&
      typeof item.reviewState === "string" &&
      typeof item.displayLabel === "string" &&
      typeof item.reason === "string" &&
      Array.isArray(item.demandIds) &&
      item.demandIds.every((id) => typeof id === "string") &&
      Array.isArray(item.sourceCvItemReferenceIds) &&
      item.sourceCvItemReferenceIds.every((id) => typeof id === "string")
    );
  });
  return itemsAreValid ? (result as CvTailoringReviewDtoV1) : null;
}

function formatCvTailoringError(error: unknown): string {
  const message = formatJobsActionError(
    error,
    "Resume tailoring failed. Try again.",
  );
  if (
    message === CV_TAILORING_BRIEF_CHANGED_MESSAGE ||
    message === CV_TAILORING_SOURCE_REVIEW_BRIEF_CHANGED_MESSAGE
  ) {
    return message;
  }
  return /stale|changed|expected plan/i.test(message)
    ? "This review changed. Reload recommendations and try again."
    : message;
}

function isCvTailoringReloadRequiredError(message: string | null): boolean {
  return Boolean(
    message &&
      /review changed|reload recommendations|stale|expected plan/i.test(
        message,
      ),
  );
}

const CV_TAILORING_SOURCE_CHANGED_MESSAGE =
  "Resume review reset. Prepare recommendations again for the attached resume.";
const CV_TAILORING_ATTACHMENT_UNCHANGED_MESSAGE =
  "The resume attachment was unchanged. Prepare recommendations again if needed.";
const CV_TAILORING_BRIEF_CHANGED_MESSAGE =
  "The Job Brief changed. Restore the complete resume and tailor again before generating a proposal.";
const CV_TAILORING_SOURCE_REVIEW_BRIEF_CHANGED_MESSAGE =
  "The Job Brief changed. Prepare recommendations again before tailoring.";
const CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE =
  "The tailored resume could not be loaded. Reload this job and try again.";
type ReviewedResumeHydration = Readonly<{
  key: string;
  status: "loading" | "ready" | "error";
}> | null;

type ReviewedResumeReadiness =
  | "source"
  | "derived_loading"
  | "derived_ready"
  | "derived_wrong_job"
  | "derived_unavailable"
  | "derived_invalidated";

type CvTailoringUiSnapshot = Readonly<{
  panelOpen: boolean;
  review: AutoCvTailoringReviewDtoV1 | null;
  selectedItemIds: Set<string>;
  busy: boolean;
  error: string | null;
  launcherError: string | null;
  materializedResumeName: string | null;
  materializedSourceCvId: string | null;
  reviewedResumeHydration: ReviewedResumeHydration;
  briefInvalidatedAttachmentKey: string | null;
}>;

function getMissingRequiredDemandIds(
  review: AutoCvTailoringReviewDtoV1,
  selectedItemIds: ReadonlySet<string>,
): string[] {
  const coveredDemandIds = new Set<string>();
  for (const item of review.plan.items) {
    if (
      !isClaimBackedResumeVariantPlanAction(item.action) ||
      item.reviewState === "rejected" ||
      (item.reviewState === "pending" && !selectedItemIds.has(item.id))
    ) {
      continue;
    }
    if (item.reviewState !== "accepted" && item.reviewState !== "pending") {
      continue;
    }
    for (const demandId of item.demandIds) {
      coveredDemandIds.add(demandId);
    }
  }
  return review.plan.requiredDemandIds.filter(
    (demandId) => !coveredDemandIds.has(demandId),
  );
}

function hasSelectedClaimBackedCvItem(
  review: AutoCvTailoringReviewDtoV1,
  selectedItemIds: ReadonlySet<string>,
): boolean {
  return review.plan.items.some(
    (item) =>
      isClaimBackedResumeVariantPlanAction(item.action) &&
      (item.reviewState === "accepted" ||
        (item.reviewState === "pending" && selectedItemIds.has(item.id))),
  );
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

function isHydratedCvLibraryDocument(cv: CvDocument): boolean {
  return (
    (cv.metadata as { librarySummaryOnly?: unknown } | undefined)
      ?.librarySummaryOnly !== true
  );
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
  const isReviewedVariant = readReviewedSourceCvVariantBinding(cv) !== null;
  const displayTitle = formatCvDisplayTitle({
    title: String(cv.title ?? "Untitled CV"),
    profileName,
    desiredPosition,
    email: readCvPickerString(profilePreview?.email),
    phone: readCvPickerString(profilePreview?.phone),
    linkedin: readCvPickerString(profilePreview?.linkedin),
    website: readCvPickerString(profilePreview?.website),
    location: readCvPickerString(profilePreview?.location),
  });

  return {
    id: String(cv.id),
    title: isReviewedVariant
      ? `Tailored resume · ${displayTitle}`
      : displayTitle,
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
  const convex = useConvex();
  const { jobId: selectedJobId } = useParams<JobsPageRouteParams>();
  const { cvs, hydrateCvDocument } = useCvLibrary();
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
  const isProposalSelectionMode = React.useMemo(
    () => new URLSearchParams(location.search).get("selectFor") === "proposal",
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
  const [matchFilter, setMatchFilter] = React.useState<JobsMatchFilter>(() => {
    const value = new URLSearchParams(location.search).get("match");
    return value === "worth_plus" ||
      value === "strong" ||
      value === "partial" ||
      value === "weak" ||
      value === "unknown"
      ? value
      : "all";
  });
  const [hasDocsOnly, setHasDocsOnly] = React.useState(false);
  const [noDocsOnly, setNoDocsOnly] = React.useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = React.useState(
    () => new URLSearchParams(location.search).get("needsReview") === "1",
  );
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [remoteOnly, setRemoteOnly] = React.useState(false);
  const [seniorOnly, setSeniorOnly] = React.useState(false);
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
  const resumePickerRef = React.useRef<HTMLDivElement | null>(null);
  const [isResumePickerOpen, setIsResumePickerOpen] = React.useState(false);
  const [selectedJobRefreshKey, setSelectedJobRefreshKey] = React.useState(0);
  const [cvTailoringPanelOpen, setCvTailoringPanelOpen] = React.useState(false);
  const [cvTailoringReview, setCvTailoringReview] =
    React.useState<AutoCvTailoringReviewDtoV1 | null>(null);
  const [cvTailoringSelectedItemIds, setCvTailoringSelectedItemIds] =
    React.useState<Set<string>>(() => new Set());
  const [cvTailoringBusy, setCvTailoringBusy] = React.useState(false);
  const [cvTailoringError, setCvTailoringError] = React.useState<string | null>(
    null,
  );
  const [cvTailoringLauncherError, setCvTailoringLauncherError] =
    React.useState<string | null>(null);
  const [materializedResumeName, setMaterializedResumeName] = React.useState<
    string | null
  >(null);
  const [materializedSourceCvId, setMaterializedSourceCvId] = React.useState<
    string | null
  >(null);
  const [reviewedResumeHydration, setReviewedResumeHydration] =
    React.useState<ReviewedResumeHydration>(null);
  const [briefInvalidatedAttachmentKey, setBriefInvalidatedAttachmentKey] =
    React.useState<string | null>(null);
  const cvTailoringRequestVersionRef = React.useRef(0);
  const reviewedResumeHydrationVersionRef = React.useRef(0);
  const reviewedResumeHydrationSuccessRef = React.useRef<{
    key: string;
    sourceCvId: string;
  } | null>(null);
  const proposalHandoffRequestVersionRef = React.useRef(0);
  const jobBriefMutationVersionRef = React.useRef(0);
  const jobBriefMutationRecoveryRef = React.useRef<{
    jobId: string;
    snapshot: CvTailoringUiSnapshot;
    previousJob: JobsPageDetail | null;
    pendingVersions: Set<number>;
    anySucceeded: boolean;
  } | null>(null);
  const selectedJobIdRef = React.useRef(selectedJobId);
  const selectedJobResumeIdRef = React.useRef<string | null>(null);
  selectedJobIdRef.current = selectedJobId;
  const [confirmingPermanentDeleteJobId, setConfirmingPermanentDeleteJobId] =
    React.useState<string | null>(null);
  const [duplicateTransition, setDuplicateTransition] = React.useState<{
    sourceJobId: string;
    activeJobIds: Set<string>;
  } | null>(null);

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
  const refreshStructuredMatch = useMutation(
    ((api as any).jobsPublic?.refreshStructuredMatch ??
      "jobsPublic.refreshStructuredMatch") as any,
  );
  const prepareCvTailoringReview = useMutation(
    ((api as any).jobsPublic?.prepareCvTailoringReview ??
      "jobsPublic.prepareCvTailoringReview") as any,
  );
  const submitCvTailoringReview = useMutation(
    ((api as any).jobsPublic?.submitCvTailoringReview ??
      "jobsPublic.submitCvTailoringReview") as any,
  );
  const materializeCvTailoringReview = useMutation(
    ((api as any).jobsPublic?.materializeCvTailoringReview ??
      "jobsPublic.materializeCvTailoringReview") as any,
  );
  const jobByIdReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const profileByIdReference = React.useMemo(
    () =>
      ((api as any).profilesPublic?.getByProfileId ??
        "profilesPublic.getByProfileId") as any,
    [],
  );
  const loadAuthoritativeCvDocumentById = React.useCallback(
    async (profileId: string): Promise<CvDocument | null> => {
      const result = await convex.query(profileByIdReference, { profileId });
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return null;
      }
      return mapPersistedProfileToCvDocument(
        result as Record<string, unknown>,
        profileId,
      );
    },
    [convex, profileByIdReference],
  );
  const manualApplicationHandoffQueryReference = React.useMemo(
    () =>
      ((api as any).manualApplicationHandoff?.getForJob ??
        "manualApplicationHandoff.getForJob") as any,
    [],
  );
  const prepareManualApplicationHandoff = useMutation(
    ((api as any).manualApplicationHandoff?.prepare ??
      "manualApplicationHandoff.prepare") as any,
  );
  const confirmManualApplicationHandoff = useMutation(
    ((api as any).manualApplicationHandoff?.confirm ??
      "manualApplicationHandoff.confirm") as any,
  );
  const loadManualApplicationHandoffDeliveryContent = useMutation(
    ((api as any).manualApplicationHandoff?.getDeliveryContentForHandoff ??
      "manualApplicationHandoff.getDeliveryContentForHandoff") as any,
  );
  const recordManualApplicationHandoffFileDownloadRequested = useMutation(
    ((api as any).manualApplicationHandoff?.recordFileDownloadRequested ??
      "manualApplicationHandoff.recordFileDownloadRequested") as any,
  );
  const recordManualApplicationHandoffDestinationOpenRequested = useMutation(
    ((api as any).manualApplicationHandoff?.recordDestinationOpenRequested ??
      "manualApplicationHandoff.recordDestinationOpenRequested") as any,
  );
  const reportManualApplicationHandoffOutcome = useMutation(
    ((api as any).manualApplicationHandoff?.reportOutcome ??
      "manualApplicationHandoff.reportOutcome") as any,
  );
  const {
    jobs,
    archivedJobs,
    selectedJobRecord: selectedJobRecordFromQuery,
  } = useJobsQuery({
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    isConvexAuthenticated,
    selectedJobId,
    selectedJobRefreshKey,
  });
  const selectedJobRecord = selectedJobRecordFromQuery as
    | JobsPageDetail
    | undefined;
  const manualApplicationHandoff = useQuery(
    manualApplicationHandoffQueryReference,
    selectedJobId && isLoaded && isSignedIn && isConvexAuthenticated
      ? { jobId: selectedJobId }
      : "skip",
  ) as ManualApplicationHandoffPanelState | undefined;
  const [
    manualApplicationHandoffDeliveryContent,
    setManualApplicationHandoffDeliveryContent,
  ] = React.useState<ManualApplicationHandoffDeliveryContent | null>(null);

  React.useEffect(() => {
    setManualApplicationHandoffDeliveryContent(null);
  }, [
    selectedJobId,
    manualApplicationHandoff?.handoffId,
    manualApplicationHandoff?.manifestDigest,
  ]);

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
    cvTailoringRequestVersionRef.current += 1;
    proposalHandoffRequestVersionRef.current += 1;
    setCvTailoringPanelOpen(false);
    setCvTailoringReview(null);
    setCvTailoringSelectedItemIds(new Set());
    setCvTailoringBusy(false);
    setCvTailoringError(null);
    setCvTailoringLauncherError(null);
    setMaterializedResumeName(null);
    setMaterializedSourceCvId(null);
    reviewedResumeHydrationVersionRef.current += 1;
    reviewedResumeHydrationSuccessRef.current = null;
    jobBriefMutationVersionRef.current += 1;
    jobBriefMutationRecoveryRef.current = null;
    setReviewedResumeHydration(null);
    setBriefInvalidatedAttachmentKey(null);
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

    if (
      duplicateTransition &&
      duplicateTransition.sourceJobId === selectedJobId
    ) {
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
          noDocsOnly,
          needsReviewOnly,
          favoritesOnly,
          optimisticActivityById[job.id],
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
          ...(job.skills ?? []),
          ...(job.keywords ?? []),
          ...(job.visibleKeywords ?? []),
          job.sourceDomain,
          job.sourceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .filter((job) => {
        if (
          remoteOnly &&
          !`${job.location} ${job.title}`.toLowerCase().includes("remote")
        ) {
          return false;
        }
        if (
          seniorOnly &&
          !`${job.title} ${job.company}`
            .toLowerCase()
            .match(/\bsenior\b|\bstaff\b|\blead\b/)
        ) {
          return false;
        }
        return true;
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
    favoritesOnly,
    hasDocsOnly,
    noDocsOnly,
    matchFilter,
    needsReviewOnly,
    remoteOnly,
    searchQuery,
    seniorOnly,
    sortOrder,
  ]);

  const isMobileJobsLayout = viewportWidth < JOBS_SPLIT_VIEW_COLLAPSE_WIDTH;

  React.useEffect(() => {
    if (
      !selectedJobId &&
      jobsView === "active" &&
      filteredJobs.length > 0 &&
      !isMobileJobsLayout &&
      !holdListViewOpen &&
      !isProposalSelectionMode
    ) {
      void navigate(buildJobsRoute(filteredJobs[0].id), { replace: true });
    }
  }, [
    filteredJobs,
    holdListViewOpen,
    isProposalSelectionMode,
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
  selectedJobResumeIdRef.current = selectedJob?.resumeId ?? null;
  const cvTailoringContextUnavailableReason = !selectedJob?.resumeId
    ? "Attach a resume to tailor it for this job."
    : selectedJob.resumeSource !== "job"
      ? "Attach this resume to this job before tailoring."
      : selectedJob.parseStatus !== "parsed" ||
          selectedJob.reviewState !== "ready"
        ? "Review the highlighted Job Brief details before tailoring."
        : null;
  const selectedJobIsReviewedVariant = Boolean(
    selectedJob?.resumeId?.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX),
  );
  const selectedJobAttachmentKey =
    selectedJob?.id && selectedJob.resumeId
      ? `${selectedJob.id}::${selectedJob.resumeId}`
      : null;
  const selectedJobAttachedCv = selectedJob?.resumeId
    ? cvs.find((cv) => String(cv.id) === selectedJob.resumeId) ?? null
    : null;
  const selectedJobReviewedVariantBinding = React.useMemo(
    () =>
      selectedJobAttachedCv
        ? readReviewedSourceCvVariantBinding(selectedJobAttachedCv)
        : null,
    [selectedJobAttachedCv],
  );
  const selectedJobReviewedResumeHydrationReady =
    reviewedResumeHydration?.key === selectedJobAttachmentKey &&
    reviewedResumeHydration.status === "ready";
  const selectedJobReviewedResumeReadiness: ReviewedResumeReadiness =
    !selectedJobIsReviewedVariant
      ? "source"
      : selectedJobAttachmentKey === briefInvalidatedAttachmentKey
        ? "derived_invalidated"
        : selectedJob?.resumeProposalAuthority === "reviewed_invalid"
          ? "derived_unavailable"
          : selectedJobReviewedVariantBinding &&
              selectedJobReviewedVariantBinding.jobId !== selectedJob?.id
            ? "derived_wrong_job"
            : selectedJob?.resumeProposalAuthority !== "reviewed_ready"
              ? "derived_loading"
              : selectedJobReviewedResumeHydrationReady
                ? "derived_ready"
                : reviewedResumeHydration?.key === selectedJobAttachmentKey &&
                    reviewedResumeHydration.status === "error"
                  ? "derived_unavailable"
                  : "derived_loading";
  const selectedJobReviewedResumeUnavailable =
    selectedJobReviewedResumeReadiness !== "source" &&
    selectedJobReviewedResumeReadiness !== "derived_ready";
  const hasActiveCvTailoringHandoff = Boolean(
    cvTailoringBusy ||
      cvTailoringPanelOpen ||
      cvTailoringReview ||
      materializedResumeName ||
      selectedJobIsReviewedVariant,
  );

  React.useEffect(() => {
    if (
      !selectedJob?.id ||
      !selectedJob.resumeId ||
      !selectedJobAttachmentKey ||
      !selectedJobIsReviewedVariant ||
      selectedJobReviewedResumeHydrationReady ||
      selectedJobAttachmentKey === briefInvalidatedAttachmentKey
    ) {
      return undefined;
    }

    const requestVersion = reviewedResumeHydrationVersionRef.current + 1;
    reviewedResumeHydrationVersionRef.current = requestVersion;
    const requestIsCurrent = () =>
      reviewedResumeHydrationVersionRef.current === requestVersion &&
      selectedJobIdRef.current === selectedJob.id &&
      selectedJobResumeIdRef.current === selectedJob.resumeId;
    const markHydrationFailed = () => {
      if (!requestIsCurrent()) {
        return;
      }
      const completedHydration = reviewedResumeHydrationSuccessRef.current;
      if (
        completedHydration?.key === selectedJobAttachmentKey &&
        (materializedSourceCvId === null ||
          completedHydration.sourceCvId === materializedSourceCvId)
      ) {
        return;
      }
      setReviewedResumeHydration({
        key: selectedJobAttachmentKey,
        status: "error",
      });
      setCvTailoringLauncherError(CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE);
    };
    setReviewedResumeHydration({
      key: selectedJobAttachmentKey,
      status: "loading",
    });
    setCvTailoringLauncherError((current) =>
      current === CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE ? null : current,
    );

    void hydrateCvDocument(selectedJob.resumeId)
      .then((hydratedCv) => {
        if (!requestIsCurrent()) {
          return;
        }
        const hydratedBinding = hydratedCv
          ? readReviewedSourceCvVariantBinding(hydratedCv)
          : null;
        if (
          !hydratedCv ||
          String(hydratedCv.id) !== selectedJob.resumeId ||
          !isHydratedCvLibraryDocument(hydratedCv) ||
          !hydratedBinding ||
          !hydratedBinding.reviewedPlanId ||
          hydratedBinding.jobId !== selectedJob.id ||
          (materializedSourceCvId !== null &&
            hydratedBinding.sourceCvId !== materializedSourceCvId)
        ) {
          markHydrationFailed();
          return;
        }
        reviewedResumeHydrationSuccessRef.current = {
          key: selectedJobAttachmentKey,
          sourceCvId: hydratedBinding.sourceCvId,
        };
        setReviewedResumeHydration({
          key: selectedJobAttachmentKey,
          status: "ready",
        });
      })
      .catch(markHydrationFailed);

    return () => {
      if (reviewedResumeHydrationVersionRef.current === requestVersion) {
        reviewedResumeHydrationVersionRef.current += 1;
      }
    };
  }, [
    briefInvalidatedAttachmentKey,
    hydrateCvDocument,
    materializedSourceCvId,
    selectedJob?.id,
    selectedJob?.resumeId,
    selectedJobAttachmentKey,
    selectedJobIsReviewedVariant,
    selectedJobReviewedResumeHydrationReady,
  ]);
  const cvTailoringUnavailableReason =
    cvTailoringContextUnavailableReason ??
    (selectedJobIsReviewedVariant
      ? "Restore the complete resume before tailoring again."
      : null);
  const selectedJobIsFavorite = selectedJob
    ? optimisticFavoriteById[selectedJob.id] ?? selectedJob.isFavorite
    : false;
  const selectedJobIsLoading =
    Boolean(selectedJobId) &&
    selectedJobRecord === undefined &&
    optimisticSelectedJob === null;
  const resumePickerOptions = React.useMemo(
    () =>
      cvs
        .filter((cv) => {
          if (!String(cv.id).startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX)) {
            return true;
          }
          const binding = readReviewedSourceCvVariantBinding(cv);
          return Boolean(binding && binding.jobId === selectedJob?.id);
        })
        .map((cv) => buildJobResumePickerOption(cv))
        .sort((left, right) => right.dateSortValue - left.dateSortValue),
    [cvs, selectedJob?.id],
  );
  const selectedJobResumeDisplayName = React.useMemo(() => {
    if (selectedJob?.resumeName) {
      return selectedJob.resumeName;
    }

    if (!selectedJob?.resumeId) {
      return null;
    }

    return (
      resumePickerOptions.find((option) => option.id === selectedJob.resumeId)
        ?.title ?? null
    );
  }, [resumePickerOptions, selectedJob?.resumeId, selectedJob?.resumeName]);

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

  const navigateToProposalWorkspace = React.useCallback(
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

  const loadAuthoritativeJobResumeId = React.useCallback(
    async (jobId: string): Promise<string | null> => {
      if (selectedJobIdRef.current === jobId) {
        return selectedJobResumeIdRef.current;
      }

      const result = await convex.query(jobByIdReference, { jobId });
      if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        (result as { id?: unknown }).id !== jobId
      ) {
        throw new Error("This job could not be loaded. Open it and try again.");
      }
      const resumeId = (result as { resumeId?: unknown }).resumeId;
      return typeof resumeId === "string" && resumeId.trim().length > 0
        ? resumeId
        : null;
    },
    [convex, jobByIdReference],
  );

  const ensureProposalResumeReady = React.useCallback(
    async (
      jobId: string,
      resumeId: string | null,
      options: { requireSourceCv?: boolean; requestVersion?: number } = {},
    ): Promise<boolean> => {
      const requestVersion =
        options.requestVersion ?? proposalHandoffRequestVersionRef.current + 1;
      if (options.requestVersion === undefined) {
        proposalHandoffRequestVersionRef.current = requestVersion;
      } else if (proposalHandoffRequestVersionRef.current !== requestVersion) {
        return false;
      }
      if (!resumeId) {
        return proposalHandoffRequestVersionRef.current === requestVersion;
      }

      const attachmentKey = `${jobId}::${resumeId}`;
      if (attachmentKey === briefInvalidatedAttachmentKey) {
        throw new Error(CV_TAILORING_BRIEF_CHANGED_MESSAGE);
      }

      const attachedCv = cvs.find((cv) => String(cv.id) === resumeId) ?? null;
      const initialBinding = attachedCv
        ? readReviewedSourceCvVariantBinding(attachedCv)
        : null;
      const isReviewedVariant =
        resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX) ||
        initialBinding !== null;
      if (
        options.requireSourceCv
          ? isReviewedVariant
          : isReviewedVariant &&
            initialBinding !== null &&
            initialBinding.jobId !== jobId
      ) {
        throw new Error(
          options.requireSourceCv
            ? "The original resume could not be loaded. Attach it again before continuing."
            : "This tailored resume belongs to another job. Restore the complete resume before continuing.",
        );
      }

      let hydratedCv = await hydrateCvDocument(resumeId);
      const hydratedLocalBinding = hydratedCv
        ? readReviewedSourceCvVariantBinding(hydratedCv)
        : null;
      if (isReviewedVariant && !hydratedLocalBinding) {
        hydratedCv = await loadAuthoritativeCvDocumentById(resumeId);
      }
      if (proposalHandoffRequestVersionRef.current !== requestVersion) {
        return false;
      }

      const currentResumeId = await loadAuthoritativeJobResumeId(jobId);
      if (proposalHandoffRequestVersionRef.current !== requestVersion) {
        return false;
      }
      if (currentResumeId !== resumeId) {
        return false;
      }

      const hydratedBinding = hydratedCv
        ? readReviewedSourceCvVariantBinding(hydratedCv)
        : null;
      const hydratedIsReviewedVariant =
        resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX) ||
        hydratedBinding !== null;
      if (
        !hydratedCv ||
        String(hydratedCv.id) !== resumeId ||
        !isHydratedCvLibraryDocument(hydratedCv) ||
        (options.requireSourceCv
          ? hydratedIsReviewedVariant
          : hydratedIsReviewedVariant &&
            (!hydratedBinding || hydratedBinding.jobId !== jobId))
      ) {
        throw new Error(
          options.requireSourceCv
            ? "The complete resume could not be loaded. Try again before continuing."
            : CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE,
        );
      }

      if (!options.requireSourceCv && hydratedIsReviewedVariant) {
        if (!hydratedBinding?.reviewedPlanId) {
          throw new Error(CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE);
        }
        let revalidatedMaterialization: Awaited<
          ReturnType<typeof materializeCvTailoringReview>
        >;
        try {
          revalidatedMaterialization = await materializeCvTailoringReview({
            jobId,
            expectedPlanId: hydratedBinding.reviewedPlanId,
          });
        } catch (error) {
          const message = formatJobsActionError(
            error,
            "The tailored resume could not be revalidated.",
          );
          if (
            /applicationcontext.*does not match|stale.*materialization|expected plan/i.test(
              message,
            )
          ) {
            throw new Error(CV_TAILORING_BRIEF_CHANGED_MESSAGE);
          }
          throw error;
        }
        if (proposalHandoffRequestVersionRef.current !== requestVersion) {
          return false;
        }
        const latestResumeId = await loadAuthoritativeJobResumeId(jobId);
        if (proposalHandoffRequestVersionRef.current !== requestVersion) {
          return false;
        }
        if (latestResumeId !== resumeId) {
          return false;
        }
        if (
          !revalidatedMaterialization ||
          revalidatedMaterialization.jobId !== jobId ||
          revalidatedMaterialization.resumeId !== resumeId ||
          revalidatedMaterialization.sourceCvId !== hydratedBinding.sourceCvId
        ) {
          throw new Error(CV_TAILORING_DERIVED_LOAD_FAILED_MESSAGE);
        }
      }

      return true;
    },
    [
      briefInvalidatedAttachmentKey,
      cvs,
      hydrateCvDocument,
      loadAuthoritativeCvDocumentById,
      loadAuthoritativeJobResumeId,
      materializeCvTailoringReview,
    ],
  );

  const handleCreateProposal = React.useCallback(
    async (jobId: string) => {
      const requestVersion = proposalHandoffRequestVersionRef.current + 1;
      proposalHandoffRequestVersionRef.current = requestVersion;
      try {
        const currentResumeId = await loadAuthoritativeJobResumeId(jobId);
        if (proposalHandoffRequestVersionRef.current !== requestVersion) {
          return;
        }
        if (
          !(await ensureProposalResumeReady(jobId, currentResumeId, {
            requestVersion,
          }))
        ) {
          return;
        }
        navigateToProposalWorkspace(jobId);
      } catch (error) {
        if (proposalHandoffRequestVersionRef.current !== requestVersion) {
          return;
        }
        const message = formatCvTailoringError(error);
        setCvTailoringLauncherError(message);
        showToast(message, { variant: "error" });
      }
    },
    [
      ensureProposalResumeReady,
      loadAuthoritativeJobResumeId,
      navigateToProposalWorkspace,
      showToast,
    ],
  );

  const invalidateCvTailoringForSourceChange = React.useCallback(() => {
    cvTailoringRequestVersionRef.current += 1;
    reviewedResumeHydrationVersionRef.current += 1;
    setCvTailoringPanelOpen(false);
    setCvTailoringReview(null);
    setCvTailoringSelectedItemIds(new Set());
    setCvTailoringBusy(false);
    setCvTailoringError(null);
    setCvTailoringLauncherError(CV_TAILORING_SOURCE_CHANGED_MESSAGE);
    setMaterializedResumeName(null);
    setMaterializedSourceCvId(null);
    reviewedResumeHydrationSuccessRef.current = null;
    setReviewedResumeHydration(null);
    setBriefInvalidatedAttachmentKey(null);
  }, []);

  const restoreCvTailoringUiSnapshot = React.useCallback(
    (snapshot: CvTailoringUiSnapshot) => {
      setCvTailoringPanelOpen(snapshot.panelOpen);
      setCvTailoringReview(snapshot.review);
      setCvTailoringSelectedItemIds(new Set(snapshot.selectedItemIds));
      setCvTailoringBusy(false);
      setCvTailoringError(snapshot.error);
      setCvTailoringLauncherError(snapshot.launcherError);
      setMaterializedResumeName(snapshot.materializedResumeName);
      setMaterializedSourceCvId(snapshot.materializedSourceCvId);
      setReviewedResumeHydration(
        snapshot.reviewedResumeHydration?.status === "loading"
          ? null
          : snapshot.reviewedResumeHydration,
      );
      setBriefInvalidatedAttachmentKey(snapshot.briefInvalidatedAttachmentKey);
    },
    [],
  );

  const restoreCvTailoringAfterAttachmentFailure = React.useCallback(
    (snapshot: CvTailoringUiSnapshot) => {
      if (snapshot.busy) {
        setCvTailoringPanelOpen(false);
        setCvTailoringReview(null);
        setCvTailoringSelectedItemIds(new Set());
        setCvTailoringBusy(false);
        setCvTailoringError(null);
        setCvTailoringLauncherError(CV_TAILORING_ATTACHMENT_UNCHANGED_MESSAGE);
        setMaterializedResumeName(null);
        setMaterializedSourceCvId(null);
        return;
      }
      restoreCvTailoringUiSnapshot(snapshot);
    },
    [restoreCvTailoringUiSnapshot],
  );

  const captureCvTailoringUiSnapshot = React.useCallback(
    (): CvTailoringUiSnapshot => ({
      panelOpen: cvTailoringPanelOpen,
      review: cvTailoringReview,
      selectedItemIds: new Set(cvTailoringSelectedItemIds),
      busy: cvTailoringBusy,
      error: cvTailoringError,
      launcherError: cvTailoringLauncherError,
      materializedResumeName,
      materializedSourceCvId,
      reviewedResumeHydration,
      briefInvalidatedAttachmentKey,
    }),
    [
      briefInvalidatedAttachmentKey,
      cvTailoringBusy,
      cvTailoringError,
      cvTailoringLauncherError,
      cvTailoringPanelOpen,
      cvTailoringReview,
      cvTailoringSelectedItemIds,
      materializedResumeName,
      materializedSourceCvId,
      reviewedResumeHydration,
    ],
  );

  const invalidateCvTailoringForBriefChange = React.useCallback(
    (jobId: string, resumeId: string, invalidateAttachedVariant: boolean) => {
      cvTailoringRequestVersionRef.current += 1;
      reviewedResumeHydrationVersionRef.current += 1;
      setCvTailoringPanelOpen(false);
      setCvTailoringReview(null);
      setCvTailoringSelectedItemIds(new Set());
      setCvTailoringBusy(false);
      setCvTailoringError(null);
      setCvTailoringLauncherError(
        invalidateAttachedVariant
          ? CV_TAILORING_BRIEF_CHANGED_MESSAGE
          : CV_TAILORING_SOURCE_REVIEW_BRIEF_CHANGED_MESSAGE,
      );
      setMaterializedResumeName(null);
      setMaterializedSourceCvId(null);
      reviewedResumeHydrationSuccessRef.current = null;
      setReviewedResumeHydration(null);
      setBriefInvalidatedAttachmentKey(
        invalidateAttachedVariant ? `${jobId}::${resumeId}` : null,
      );
    },
    [],
  );

  const handlePrepareCvTailoringReview = React.useCallback(async () => {
    const job = selectedJob;
    if (
      !job?.id ||
      !job.resumeId ||
      job.parseStatus !== "parsed" ||
      job.reviewState !== "ready"
    ) {
      return;
    }
    if (job.resumeSource !== "job") {
      setCvTailoringLauncherError(
        "Attach this resume to this job before tailoring.",
      );
      return;
    }
    if (job.resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX)) {
      setCvTailoringLauncherError(
        "Restore the complete resume before tailoring again.",
      );
      return;
    }
    const requestVersion = cvTailoringRequestVersionRef.current + 1;
    cvTailoringRequestVersionRef.current = requestVersion;
    const requestOwnsUi = () =>
      cvTailoringRequestVersionRef.current === requestVersion &&
      selectedJobIdRef.current === job.id;
    const requestIsCurrent = () =>
      requestOwnsUi() && selectedJobResumeIdRef.current === job.resumeId;
    setCvTailoringPanelOpen(true);
    setCvTailoringBusy(true);
    setCvTailoringError(null);
    setCvTailoringLauncherError(null);
    setMaterializedResumeName(null);
    setMaterializedSourceCvId(null);
    setBriefInvalidatedAttachmentKey(null);

    try {
      const result = await prepareCvTailoringReview({
        jobId: job.id,
        mode: "auto_recommended",
      });
      if (!requestIsCurrent()) {
        if (requestOwnsUi()) {
          invalidateCvTailoringForSourceChange();
        }
        return;
      }
      const review = readCvTailoringReviewResult(
        result,
        "auto_recommended",
        job.resumeId,
      );
      if (!review || review.mode !== "auto_recommended") {
        throw new Error(
          "The resume review response did not match the attached resume. Reload and try again.",
        );
      }
      setCvTailoringReview(review);
      setCvTailoringSelectedItemIds(
        new Set(
          review.plan.items
            .filter(
              (item) =>
                isClaimBackedResumeVariantPlanAction(item.action) &&
                (item.reviewState === "pending" ||
                  item.reviewState === "accepted"),
            )
            .map((item) => item.id),
        ),
      );
    } catch (error) {
      if (!requestIsCurrent()) {
        if (requestOwnsUi()) {
          invalidateCvTailoringForSourceChange();
        }
        return;
      }
      const message = formatCvTailoringError(error);
      if (cvTailoringReview) {
        setCvTailoringError(message);
      } else {
        setCvTailoringPanelOpen(false);
        setCvTailoringLauncherError(message);
      }
    } finally {
      if (requestIsCurrent()) {
        setCvTailoringBusy(false);
      } else if (requestOwnsUi()) {
        invalidateCvTailoringForSourceChange();
      }
    }
  }, [
    cvTailoringReview,
    invalidateCvTailoringForSourceChange,
    prepareCvTailoringReview,
    selectedJob,
  ]);

  const handleCloseCvTailoringReview = React.useCallback(() => {
    cvTailoringRequestVersionRef.current += 1;
    setCvTailoringPanelOpen(false);
    setCvTailoringReview(null);
    setCvTailoringSelectedItemIds(new Set());
    setCvTailoringBusy(false);
    setCvTailoringError(null);
    setMaterializedResumeName(null);
    setMaterializedSourceCvId(null);
  }, []);

  const handleToggleCvTailoringItem = React.useCallback(
    (itemId: string, checked: boolean) => {
      const item = cvTailoringReview?.plan.items.find(
        (candidate) => candidate.id === itemId,
      );
      if (
        !item ||
        item.reviewState !== "pending" ||
        !isClaimBackedResumeVariantPlanAction(item.action)
      ) {
        return;
      }
      setCvTailoringSelectedItemIds((current) => {
        const next = new Set(current);
        if (checked) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
      setCvTailoringError((current) =>
        isCvTailoringReloadRequiredError(current) ? current : null,
      );
    },
    [cvTailoringReview],
  );

  const handleCreateTailoredResume = React.useCallback(async () => {
    const job = selectedJob;
    const initialReview = cvTailoringReview;
    if (!job?.id || !job.resumeId || !initialReview) {
      return;
    }
    if (initialReview.sourceCv.id !== job.resumeId) {
      invalidateCvTailoringForSourceChange();
      return;
    }
    if (
      initialReview.plan.blocked ||
      initialReview.plan.items.length === 0 ||
      !hasSelectedClaimBackedCvItem(
        initialReview,
        cvTailoringSelectedItemIds,
      ) ||
      getMissingRequiredDemandIds(initialReview, cvTailoringSelectedItemIds)
        .length > 0
    ) {
      return;
    }

    let expectedResumeId = initialReview.sourceCv.id;
    const requestVersion = cvTailoringRequestVersionRef.current + 1;
    cvTailoringRequestVersionRef.current = requestVersion;
    const requestOwnsUi = () =>
      cvTailoringRequestVersionRef.current === requestVersion &&
      selectedJobIdRef.current === job.id;
    const requestIsCurrent = () =>
      requestOwnsUi() && selectedJobResumeIdRef.current === expectedResumeId;
    setCvTailoringBusy(true);
    setCvTailoringError(null);

    try {
      const pendingItems = initialReview.plan.items.filter(
        (item) =>
          item.reviewState === "pending" &&
          isClaimBackedResumeVariantPlanAction(item.action),
      );
      let reviewed = initialReview;
      if (pendingItems.length > 0) {
        const result = await submitCvTailoringReview({
          jobId: job.id,
          expectedPlanId: initialReview.plan.id,
          decisions: pendingItems.map((item) => ({
            planItemId: item.id,
            reviewState: cvTailoringSelectedItemIds.has(item.id)
              ? "accepted"
              : "rejected",
          })),
        });
        if (!requestIsCurrent()) {
          if (requestOwnsUi()) {
            invalidateCvTailoringForSourceChange();
          }
          return;
        }
        const submittedReview = readCvTailoringReviewResult(
          result,
          "auto_recommended",
          initialReview.sourceCv.id,
        );
        if (!submittedReview || submittedReview.mode !== "auto_recommended") {
          throw new Error(
            "The reviewed plan response was invalid. Reload recommendations.",
          );
        }
        reviewed = submittedReview;
        setCvTailoringReview(submittedReview);
        setCvTailoringSelectedItemIds(
          new Set(
            submittedReview.plan.items
              .filter((item) => item.reviewState === "accepted")
              .map((item) => item.id),
          ),
        );
      }

      const stillPending = reviewed.plan.items.some(
        (item) =>
          item.reviewState === "pending" &&
          isClaimBackedResumeVariantPlanAction(item.action),
      );
      if (
        reviewed.plan.blocked ||
        reviewed.plan.items.length === 0 ||
        !hasSelectedClaimBackedCvItem(
          reviewed,
          new Set(
            reviewed.plan.items
              .filter((item) => item.reviewState === "accepted")
              .map((item) => item.id),
          ),
        ) ||
        stillPending ||
        getMissingRequiredDemandIds(
          reviewed,
          new Set(
            reviewed.plan.items
              .filter((item) => item.reviewState === "accepted")
              .map((item) => item.id),
          ),
        ).length > 0
      ) {
        throw new Error(
          reviewed.plan.blockedReason ??
            "The review is not ready to create a resume. Reload recommendations.",
        );
      }

      const materialized = await materializeCvTailoringReview({
        jobId: job.id,
        expectedPlanId: reviewed.plan.id,
      });
      if (!requestOwnsUi()) {
        return;
      }
      if (
        !materialized ||
        materialized.jobId !== job.id ||
        materialized.sourceCvId !== reviewed.sourceCv.id ||
        typeof materialized.resumeId !== "string" ||
        typeof materialized.resumeName !== "string"
      ) {
        throw new Error(
          "The tailored resume response did not match this job. Reload and try again.",
        );
      }
      if (
        selectedJobResumeIdRef.current !== initialReview.sourceCv.id &&
        selectedJobResumeIdRef.current !== materialized.resumeId
      ) {
        invalidateCvTailoringForSourceChange();
        return;
      }
      recordJobDecision("resume", job.id);
      expectedResumeId = materialized.resumeId;
      selectedJobResumeIdRef.current = materialized.resumeId;
      setSelectedJobRefreshKey((key) => key + 1);
      setOptimisticSelectedJob((current) =>
        current && current.id === job.id
          ? {
              ...current,
              resumeId: materialized.resumeId,
              resumeName: materialized.resumeName,
              resumeSource: "job",
              resumeProposalAuthority: "reviewed_ready",
            }
          : current,
      );
      setMaterializedSourceCvId(materialized.sourceCvId);
      const materializedAttachmentKey = `${job.id}::${materialized.resumeId}`;
      setReviewedResumeHydration({
        key: materializedAttachmentKey,
        status: "loading",
      });
      setBriefInvalidatedAttachmentKey(null);
      const hydratedResume = await hydrateCvDocument(materialized.resumeId);
      if (!requestIsCurrent()) {
        if (requestOwnsUi()) {
          invalidateCvTailoringForSourceChange();
        }
        return;
      }
      const hydratedBinding = hydratedResume
        ? readReviewedSourceCvVariantBinding(hydratedResume)
        : null;
      if (
        !hydratedResume ||
        String(hydratedResume.id) !== materialized.resumeId ||
        !isHydratedCvLibraryDocument(hydratedResume) ||
        !hydratedBinding ||
        !hydratedBinding.reviewedPlanId ||
        hydratedBinding.jobId !== job.id ||
        hydratedBinding.sourceCvId !== materialized.sourceCvId
      ) {
        const completedHydration =
          reviewedResumeHydrationSuccessRef.current;
        if (
          completedHydration?.key === materializedAttachmentKey &&
          completedHydration.sourceCvId === materialized.sourceCvId
        ) {
          setMaterializedResumeName(materialized.resumeName);
          return;
        }
        setReviewedResumeHydration({
          key: materializedAttachmentKey,
          status: "error",
        });
        throw new Error(
          "The tailored resume was created but could not be loaded. Reload this job before continuing.",
        );
      }
      reviewedResumeHydrationSuccessRef.current = {
        key: materializedAttachmentKey,
        sourceCvId: hydratedBinding.sourceCvId,
      };
      reviewedResumeHydrationVersionRef.current += 1;
      setReviewedResumeHydration({
        key: materializedAttachmentKey,
        status: "ready",
      });
      setMaterializedResumeName(materialized.resumeName);
    } catch (error) {
      if (requestIsCurrent()) {
        setCvTailoringError(formatCvTailoringError(error));
      } else if (requestOwnsUi()) {
        invalidateCvTailoringForSourceChange();
      }
    } finally {
      if (requestOwnsUi()) {
        setCvTailoringBusy(false);
      }
    }
  }, [
    cvTailoringReview,
    cvTailoringSelectedItemIds,
    hydrateCvDocument,
    invalidateCvTailoringForSourceChange,
    materializeCvTailoringReview,
    recordJobDecision,
    selectedJob,
    submitCvTailoringReview,
  ]);

  const handleUseFullSourceCv = React.useCallback(async () => {
    const job = selectedJob;
    if (
      !job?.id ||
      !job.resumeId ||
      job.parseStatus !== "parsed" ||
      job.reviewState !== "ready"
    ) {
      return;
    }
    if (job.resumeSource !== "job") {
      setCvTailoringLauncherError(
        "Attach this resume to this job before tailoring.",
      );
      return;
    }
    let expectedResumeId = job.resumeId;
    const requestVersion = cvTailoringRequestVersionRef.current + 1;
    cvTailoringRequestVersionRef.current = requestVersion;
    const requestOwnsUi = () =>
      cvTailoringRequestVersionRef.current === requestVersion &&
      selectedJobIdRef.current === job.id;
    const requestIsCurrent = () =>
      requestOwnsUi() && selectedJobResumeIdRef.current === expectedResumeId;
    setCvTailoringBusy(true);
    setCvTailoringLauncherError(null);

    try {
      if (job.resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX)) {
        proposalHandoffRequestVersionRef.current += 1;
        const hydratedAttachedCv = await hydrateCvDocument(job.resumeId);
        if (!requestIsCurrent()) {
          if (requestOwnsUi()) {
            invalidateCvTailoringForSourceChange();
          }
          return;
        }
        const attachedBinding = hydratedAttachedCv
          ? readReviewedSourceCvVariantBinding(hydratedAttachedCv)
          : null;
        if (
          !hydratedAttachedCv ||
          String(hydratedAttachedCv.id) !== job.resumeId ||
          !isHydratedCvLibraryDocument(hydratedAttachedCv) ||
          !attachedBinding?.reviewedPlanId
        ) {
          throw new Error(
            "The original resume is unavailable. Attach it again before continuing.",
          );
        }
        if (attachedBinding.jobId !== job.id) {
          throw new Error(
            "This tailored resume belongs to another job. Restore the complete resume before continuing.",
          );
        }
        if (
          materializedSourceCvId !== null &&
          attachedBinding.sourceCvId !== materializedSourceCvId
        ) {
          throw new Error(
            "The original resume is unavailable. Attach it again before continuing.",
          );
        }
        const sourceCvId =
          materializedSourceCvId ?? attachedBinding.sourceCvId;
        let sourceCv =
          sourceCvId === null
            ? null
            : cvs.find((cv) => String(cv.id) === sourceCvId) ?? null;
        if (
          sourceCvId &&
          (!sourceCv || !isHydratedCvLibraryDocument(sourceCv))
        ) {
          const hydratedSourceCv = await hydrateCvDocument(sourceCvId);
          if (!requestIsCurrent()) {
            if (requestOwnsUi()) {
              invalidateCvTailoringForSourceChange();
            }
            return;
          }
          sourceCv = hydratedSourceCv;
        }
        if (
          !sourceCvId ||
          sourceCvId === job.resumeId ||
          !sourceCv ||
          String(sourceCv.id) !== sourceCvId ||
          !isHydratedCvLibraryDocument(sourceCv) ||
          sourceCvId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX) ||
          readReviewedSourceCvVariantBinding(sourceCv)
        ) {
          throw new Error(
            "The original resume is unavailable. Attach it again before continuing.",
          );
        }
        const sourceOption = buildJobResumePickerOption(sourceCv);
        await setJobResume({
          jobId: job.id,
          resumeId: sourceCvId,
          resumeName: sourceOption?.title ?? null,
        });
        if (!requestOwnsUi()) {
          return;
        }
        expectedResumeId = sourceCvId;
        selectedJobResumeIdRef.current = sourceCvId;
        if (!requestIsCurrent()) {
          invalidateCvTailoringForSourceChange();
          return;
        }
        setSelectedJobRefreshKey((key) => key + 1);
        setOptimisticSelectedJob((current) =>
          current && current.id === job.id
            ? {
                ...current,
                resumeId: sourceCvId,
                resumeName: sourceOption?.title,
                resumeSource: "job",
              }
            : current,
        );
        setCvTailoringPanelOpen(false);
        setCvTailoringReview(null);
        setCvTailoringSelectedItemIds(new Set());
        setCvTailoringError(null);
        setMaterializedResumeName(null);
        setMaterializedSourceCvId(null);
        reviewedResumeHydrationVersionRef.current += 1;
        setReviewedResumeHydration(null);
        setBriefInvalidatedAttachmentKey(null);
      }
      const result = await prepareCvTailoringReview({
        jobId: job.id,
        mode: "full_source_cv",
      });
      if (!requestIsCurrent()) {
        if (requestOwnsUi()) {
          invalidateCvTailoringForSourceChange();
        }
        return;
      }
      const review = readCvTailoringReviewResult(
        result,
        "full_source_cv",
        expectedResumeId,
      );
      if (!review || review.mode !== "full_source_cv") {
        throw new Error(
          "The complete resume response did not match the attached resume.",
        );
      }
      if (
        !(await ensureProposalResumeReady(job.id, expectedResumeId, {
          requireSourceCv: true,
        }))
      ) {
        return;
      }
      if (!requestIsCurrent()) {
        if (requestOwnsUi()) {
          invalidateCvTailoringForSourceChange();
        }
        return;
      }
      navigateToProposalWorkspace(job.id);
    } catch (error) {
      if (requestIsCurrent()) {
        setCvTailoringLauncherError(formatCvTailoringError(error));
      } else if (requestOwnsUi()) {
        invalidateCvTailoringForSourceChange();
      }
    } finally {
      if (requestIsCurrent()) {
        setCvTailoringBusy(false);
      } else if (requestOwnsUi()) {
        invalidateCvTailoringForSourceChange();
      }
    }
  }, [
    cvs,
    ensureProposalResumeReady,
    hydrateCvDocument,
    invalidateCvTailoringForSourceChange,
    materializedSourceCvId,
    navigateToProposalWorkspace,
    prepareCvTailoringReview,
    selectedJob,
    setJobResume,
  ]);

  const handleReloadCvTailoringReview = React.useCallback(async () => {
    const job = selectedJob;
    if (
      !job?.id ||
      !job.resumeId ||
      !job.resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX) ||
      materializedSourceCvId === null
    ) {
      await handlePrepareCvTailoringReview();
      return;
    }

    const resumeId = job.resumeId;
    const sourceCvId = materializedSourceCvId;
    const attachmentKey = `${job.id}::${resumeId}`;
    const requestVersion = cvTailoringRequestVersionRef.current + 1;
    cvTailoringRequestVersionRef.current = requestVersion;
    const requestIsCurrent = () =>
      cvTailoringRequestVersionRef.current === requestVersion &&
      selectedJobIdRef.current === job.id &&
      selectedJobResumeIdRef.current === resumeId;

    setCvTailoringBusy(true);
    setCvTailoringError(null);
    setCvTailoringLauncherError(null);
    setReviewedResumeHydration({ key: attachmentKey, status: "loading" });

    try {
      const hydratedResume = await hydrateCvDocument(resumeId);
      if (!requestIsCurrent()) {
        return;
      }
      const hydratedBinding = hydratedResume
        ? readReviewedSourceCvVariantBinding(hydratedResume)
        : null;
      if (
        !hydratedResume ||
        String(hydratedResume.id) !== resumeId ||
        !isHydratedCvLibraryDocument(hydratedResume) ||
        !hydratedBinding ||
        hydratedBinding.jobId !== job.id ||
        hydratedBinding.sourceCvId !== sourceCvId
      ) {
        throw new Error(
          "The tailored resume was created but could not be loaded. Reload this job before continuing.",
        );
      }

      setReviewedResumeHydration({ key: attachmentKey, status: "ready" });
      setMaterializedResumeName(job.resumeName ?? "Tailored resume");
    } catch (error) {
      if (!requestIsCurrent()) {
        return;
      }
      setReviewedResumeHydration({ key: attachmentKey, status: "error" });
      setCvTailoringError(formatCvTailoringError(error));
    } finally {
      if (requestIsCurrent()) {
        setCvTailoringBusy(false);
      }
    }
  }, [
    handlePrepareCvTailoringReview,
    hydrateCvDocument,
    materializedSourceCvId,
    selectedJob,
  ]);

  const handleRefreshSelectedJobMatch = React.useCallback(async () => {
    if (!selectedJob?.id) {
      return;
    }

    try {
      await refreshStructuredMatch({ jobId: selectedJob.id });
      setSelectedJobRefreshKey((key) => key + 1);
    } catch (error) {
      showToast("Match refresh failed.", { variant: "error" });
    }
  }, [refreshStructuredMatch, selectedJob?.id, showToast]);

  const handleImportFirstJob = React.useCallback(() => {
    openOnboardingReplay({ stepId: "jobs" });
  }, []);

  const handleTrySampleJob = React.useCallback(async () => {
    setIsSeedingSample(true);
    setFirstRunError(null);

    try {
      const result = await seedSampleJob({});
      await navigate(buildJobsRoute(result.jobId));
    } catch {
      setFirstRunError("Sample failed.");
    } finally {
      setIsSeedingSample(false);
    }
  }, [navigate, seedSampleJob]);

  const handleAttachResumeToJob = React.useCallback(
    async (resumeId: string) => {
      if (!selectedJob?.id) {
        return;
      }
      if (
        resumeId === selectedJob.resumeId &&
        selectedJob.resumeSource === "job"
      ) {
        setIsResumePickerOpen(false);
        return;
      }
      const selectedCv = cvs.find((cv) => String(cv.id) === resumeId) ?? null;
      if (resumeId.startsWith(REVIEWED_SOURCE_CV_VARIANT_ID_PREFIX)) {
        const binding = selectedCv
          ? readReviewedSourceCvVariantBinding(selectedCv)
          : null;
        if (!binding || binding.jobId !== selectedJob.id) {
          setCvTailoringLauncherError(
            "This tailored resume belongs to another job and cannot be attached here.",
          );
          setIsResumePickerOpen(false);
          return;
        }
      }
      const tailoringSnapshot = captureCvTailoringUiSnapshot();
      if (
        cvTailoringBusy ||
        cvTailoringPanelOpen ||
        cvTailoringReview ||
        materializedResumeName ||
        selectedJobIsReviewedVariant ||
        briefInvalidatedAttachmentKey !== null
      ) {
        invalidateCvTailoringForSourceChange();
      }

      const selectedOption =
        resumePickerOptions.find((option) => option.id === resumeId) ?? null;
      const resumeName = selectedOption?.title ?? null;

      try {
        proposalHandoffRequestVersionRef.current += 1;
        await setJobResume({
          jobId: selectedJob.id,
          resumeId,
          resumeName,
        });
        selectedJobResumeIdRef.current = resumeId;
        reviewedResumeHydrationVersionRef.current += 1;
        setReviewedResumeHydration(null);
        setBriefInvalidatedAttachmentKey(null);
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
        restoreCvTailoringAfterAttachmentFailure(tailoringSnapshot);
        showToast("Attach failed.", { variant: "error" });
      }
    },
    [
      cvTailoringBusy,
      cvTailoringPanelOpen,
      cvTailoringReview,
      briefInvalidatedAttachmentKey,
      captureCvTailoringUiSnapshot,
      cvs,
      invalidateCvTailoringForSourceChange,
      materializedResumeName,
      resumePickerOptions,
      restoreCvTailoringAfterAttachmentFailure,
      selectedJob?.resumeId,
      selectedJob?.resumeSource,
      selectedJob?.id,
      selectedJobIsReviewedVariant,
      setJobResume,
      showToast,
    ],
  );

  const handleDetachResumeFromJob = React.useCallback(async () => {
    if (!selectedJob?.id || !selectedJob.resumeId) {
      return;
    }
    proposalHandoffRequestVersionRef.current += 1;
    const tailoringSnapshot = captureCvTailoringUiSnapshot();
    if (
      cvTailoringBusy ||
      cvTailoringPanelOpen ||
      cvTailoringReview ||
      materializedResumeName ||
      selectedJobIsReviewedVariant ||
      briefInvalidatedAttachmentKey !== null
    ) {
      invalidateCvTailoringForSourceChange();
    }

    try {
      await setJobResume({
        jobId: selectedJob.id,
        resumeId: null,
        resumeName: null,
      });
      selectedJobResumeIdRef.current = null;
      reviewedResumeHydrationVersionRef.current += 1;
      setReviewedResumeHydration(null);
      setBriefInvalidatedAttachmentKey(null);
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
      restoreCvTailoringAfterAttachmentFailure(tailoringSnapshot);
      showToast("Detach failed.", { variant: "error" });
    }
  }, [
    cvTailoringBusy,
    cvTailoringPanelOpen,
    cvTailoringReview,
    briefInvalidatedAttachmentKey,
    captureCvTailoringUiSnapshot,
    invalidateCvTailoringForSourceChange,
    materializedResumeName,
    restoreCvTailoringAfterAttachmentFailure,
    selectedJob?.id,
    selectedJob?.resumeId,
    selectedJobIsReviewedVariant,
    setJobResume,
    showToast,
  ]);

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
        showToast("Favorite failed.", { variant: "error" });
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

  const beginJobBriefMutation = React.useCallback(() => {
    proposalHandoffRequestVersionRef.current += 1;
    const snapshot = captureCvTailoringUiSnapshot();
    const previousJob = selectedJob;
    const jobId = previousJob?.id ?? selectedJobIdRef.current ?? "";
    const version = jobBriefMutationVersionRef.current + 1;
    jobBriefMutationVersionRef.current = version;
    let recovery = jobBriefMutationRecoveryRef.current;
    if (
      !recovery ||
      recovery.jobId !== jobId ||
      recovery.pendingVersions.size === 0
    ) {
      recovery = {
        jobId,
        snapshot,
        previousJob,
        pendingVersions: new Set(),
        anySucceeded: false,
      };
      jobBriefMutationRecoveryRef.current = recovery;
    }
    recovery.pendingVersions.add(version);
    const invalidated = Boolean(
      recovery.pendingVersions.size === 1 &&
        hasActiveCvTailoringHandoff &&
        previousJob?.id &&
        previousJob.resumeId,
    );
    if (invalidated && previousJob?.id && previousJob.resumeId) {
      invalidateCvTailoringForBriefChange(
        previousJob.id,
        previousJob.resumeId,
        selectedJobIsReviewedVariant,
      );
    }
    return { version, recovery };
  }, [
    captureCvTailoringUiSnapshot,
    hasActiveCvTailoringHandoff,
    invalidateCvTailoringForBriefChange,
    selectedJob,
    selectedJobIsReviewedVariant,
  ]);

  const settleJobBriefMutation = React.useCallback(
    (
      mutation: ReturnType<typeof beginJobBriefMutation>,
      succeeded: boolean,
    ) => {
      const recovery = jobBriefMutationRecoveryRef.current;
      if (
        recovery !== mutation.recovery ||
        !recovery.pendingVersions.has(mutation.version)
      ) {
        return { recovery: mutation.recovery, shouldRestore: false };
      }
      recovery.pendingVersions.delete(mutation.version);
      recovery.anySucceeded ||= succeeded;
      const isSettled = recovery.pendingVersions.size === 0;
      const shouldRestore = isSettled && !recovery.anySucceeded;
      if (isSettled) {
        jobBriefMutationRecoveryRef.current = null;
      }
      return { recovery, shouldRestore };
    },
    [],
  );

  const restoreFailedJobBriefMutation = React.useCallback(
    (mutation: ReturnType<typeof beginJobBriefMutation>) => {
      const { recovery, shouldRestore } = settleJobBriefMutation(
        mutation,
        false,
      );
      const isCurrentJob = selectedJobIdRef.current === recovery.jobId;
      if (shouldRestore && isCurrentJob) {
        setOptimisticSelectedJob(recovery.previousJob);
        restoreCvTailoringUiSnapshot(recovery.snapshot);
      } else if (isCurrentJob) {
        setOptimisticSelectedJob(null);
        setSelectedJobRefreshKey((key) => key + 1);
      }
      if (shouldRestore && recovery.previousJob?.id) {
        setOptimisticReviewStateById((current) => ({
          ...current,
          [recovery.previousJob!.id]: recovery.previousJob!.reviewState,
        }));
      }
      showToast("Job Brief update failed.", { variant: "error" });
    },
    [restoreCvTailoringUiSnapshot, settleJobBriefMutation, showToast],
  );

  const handleApproveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem) => {
      if (!selectedJobId) {
        return;
      }
      const briefMutation = beginJobBriefMutation();
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

      try {
        await approveReviewItem({
          jobId: selectedJobId,
          reviewItemId: item.id,
          expectedSuggestedValue: item.suggestedValue,
        });
      } catch (error) {
        restoreFailedJobBriefMutation(briefMutation);
        throw error;
      }
      settleJobBriefMutation(briefMutation, true);
      void trackJobsEvent({
        event: "import_accepted",
        jobId: selectedJobId,
        fieldKey: item.fieldKey,
      }).catch(() => {});
    },
    [
      approveReviewItem,
      beginJobBriefMutation,
      restoreFailedJobBriefMutation,
      selectedJobId,
      settleJobBriefMutation,
      trackJobsEvent,
    ],
  );

  const handleSaveReviewItem = React.useCallback(
    async (item: JobsPageReviewItem, nextValue: string | string[]) => {
      if (!selectedJobId) {
        return;
      }
      const briefMutation = beginJobBriefMutation();
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

      try {
        await updateJobField({
          jobId: selectedJobId,
          fieldKey: item.fieldKey,
          value: nextValue,
        });
      } catch (error) {
        restoreFailedJobBriefMutation(briefMutation);
        throw error;
      }
      settleJobBriefMutation(briefMutation, true);
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
    [
      beginJobBriefMutation,
      restoreFailedJobBriefMutation,
      selectedJobId,
      settleJobBriefMutation,
      trackJobsEvent,
      updateJobField,
    ],
  );

  const handleSaveField = React.useCallback(
    async (fieldKey: string, nextValue: string | string[]) => {
      if (!selectedJobId) {
        return;
      }
      const briefMutation = beginJobBriefMutation();
      setOptimisticSelectedJob((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [fieldKey]: nextValue,
        } as JobsPageDetail;
      });

      try {
        await updateJobField({
          jobId: selectedJobId,
          fieldKey,
          value: nextValue,
        });
      } catch {
        restoreFailedJobBriefMutation(briefMutation);
        return;
      }
      settleJobBriefMutation(briefMutation, true);
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
    [
      beginJobBriefMutation,
      restoreFailedJobBriefMutation,
      selectedJob,
      selectedJobId,
      settleJobBriefMutation,
      trackJobsEvent,
      updateJobField,
    ],
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

  const handlePrepareManualApplicationHandoff = React.useCallback(
    async ({ jobId }: { jobId: string }) => {
      const applicationPackageId =
        manualApplicationHandoff?.applicationPackageId ?? "";
      if (!applicationPackageId) {
        throw new Error("Application package not ready");
      }
      await prepareManualApplicationHandoff({
        jobId,
        applicationPackageId,
      });
    },
    [
      manualApplicationHandoff?.applicationPackageId,
      prepareManualApplicationHandoff,
    ],
  );

  const handleConfirmManualApplicationHandoff = React.useCallback(
    async (args: {
      handoffId: string;
      manifestDigest: string;
      confirmationCopy: string;
    }) => {
      await confirmManualApplicationHandoff(args);
    },
    [confirmManualApplicationHandoff],
  );

  const handleLoadManualApplicationHandoffDeliveryContent = React.useCallback(
    async (args: { handoffId: string; manifestDigest: string }) => {
      const content = (await loadManualApplicationHandoffDeliveryContent(
        args,
      )) as ManualApplicationHandoffDeliveryContent | null;
      setManualApplicationHandoffDeliveryContent(content);
      return content;
    },
    [loadManualApplicationHandoffDeliveryContent],
  );

  const handleRecordManualApplicationHandoffFileDownloadRequested =
    React.useCallback(
      async (args: {
        handoffId: string;
        manifestDigest: string;
        artifactRef: string;
        artifactDigest: string;
      }) => {
        await recordManualApplicationHandoffFileDownloadRequested(args);
      },
      [recordManualApplicationHandoffFileDownloadRequested],
    );

  const handleRecordManualApplicationHandoffDestinationOpenRequested =
    React.useCallback(
      async (args: { handoffId: string; manifestDigest: string }) => {
        await recordManualApplicationHandoffDestinationOpenRequested(args);
      },
      [recordManualApplicationHandoffDestinationOpenRequested],
    );

  const handleReportManualApplicationHandoffOutcome = React.useCallback(
    async (args: {
      handoffId: string;
      manifestDigest: string;
      outcome:
        | "user_reported_submitted"
        | "user_reported_not_submitted"
        | "abandoned";
    }) => {
      await reportManualApplicationHandoffOutcome(args);
    },
    [reportManualApplicationHandoffOutcome],
  );

  const handleArchiveJob = React.useCallback(
    async (jobId: string) => {
      try {
        await archiveJob({ jobId });
        if (selectedJobId === jobId) {
          await navigate(buildJobsListRoute("active"));
        }
      } catch (error) {
        showToast("Archive failed.", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [archiveJob, navigate, selectedJobId, showToast],
  );

  const handleDismissJob = React.useCallback(
    async (jobId: string) => {
      recordJobDecision("bounce", jobId);
      await handleArchiveJob(jobId);
    },
    [handleArchiveJob, recordJobDecision],
  );

  const handleRestoreArchivedJob = React.useCallback(
    async (jobId: string) => {
      try {
        await restoreArchivedJob({ jobId });
        setConfirmingPermanentDeleteJobId(null);
        await navigate(buildJobsListRoute("active"));
      } catch (error) {
        showToast("Restore failed.", {
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
        setConfirmingPermanentDeleteJobId(null);
      } catch (error) {
        showToast("Delete failed.", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [deleteArchivedJob, showToast],
  );

  const handleDuplicateJob = React.useCallback(
    async (jobId: string) => {
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
        showToast("Duplicate failed.", {
          variant: "error",
          description: formatJobsActionError(error, "Try again."),
        });
      }
    },
    [duplicateJob, jobs, navigate, showToast],
  );

  const isAuthLoading = !isLoaded || isConvexAuthLoading;
  const authStatusMessage = isAuthLoading
    ? "Loading jobs"
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

  const renderSelectedJobDetail = (): JSX.Element | null => (
    <JobDetail
      selectedJobId={selectedJobId}
      selectedJobIsLoading={selectedJobIsLoading}
      selectedJob={selectedJob}
      selectedJobMatchTier={selectedJobSummary?.matchTier}
      selectedJobIsFavorite={selectedJobIsFavorite}
      selectedJobResumeDisplayName={selectedJobResumeDisplayName}
      selectedSourceLabel={selectedSourceLabel}
      isMobileJobsLayout={isMobileJobsLayout}
      isResumePickerOpen={isResumePickerOpen}
      resumePickerRef={resumePickerRef}
      resumePickerOptions={resumePickerOptions}
      canTailorResume={
        cvTailoringUnavailableReason === null && !cvTailoringBusy
      }
      canUseFullSourceCv={
        cvTailoringContextUnavailableReason === null && !cvTailoringBusy
      }
      tailoringUnavailableReason={cvTailoringUnavailableReason}
      tailoringActionPending={cvTailoringBusy}
      tailoringActionError={cvTailoringLauncherError}
      proposalActionDisabled={
        cvTailoringBusy || selectedJobReviewedResumeUnavailable
      }
      onBackToJobs={() => void navigate("/jobs")}
      onSetJobFavorite={(jobId, nextFavorite) => {
        void handleSetJobFavorite(jobId, nextFavorite);
      }}
      onOpenJobSource={handleOpenJobSource}
      onToggleResumePicker={() => setIsResumePickerOpen((current) => !current)}
      onAttachResumeToJob={(resumeId) => {
        void handleAttachResumeToJob(resumeId);
      }}
      onDetachResumeFromJob={() => {
        void handleDetachResumeFromJob();
      }}
      onCreateProposal={(jobId) => {
        void handleCreateProposal(jobId);
      }}
      onTailorResume={() => {
        void handlePrepareCvTailoringReview();
      }}
      onUseFullSourceCv={() => {
        void handleUseFullSourceCv();
      }}
      onDismissJob={(jobId) => {
        void handleDismissJob(jobId);
      }}
      onRefreshSelectedJobMatch={() => {
        void handleRefreshSelectedJobMatch();
      }}
      onSaveField={(fieldKey, nextValue) => {
        void handleSaveField(fieldKey, nextValue);
      }}
      onApproveReviewItem={(item) =>
        handleApproveReviewItem(item as JobsPageReviewItem)
      }
      onSaveReviewItem={(item, nextValue) =>
        handleSaveReviewItem(item as JobsPageReviewItem, nextValue)
      }
      tailoringPanel={
        cvTailoringPanelOpen && cvTailoringReview && selectedJob ? (
          <CvTailoringReviewPanel
            review={cvTailoringReview}
            selectedItemIds={cvTailoringSelectedItemIds}
            hasMissingRequiredDemandCoverage={
              getMissingRequiredDemandIds(
                cvTailoringReview,
                cvTailoringSelectedItemIds,
              ).length > 0
            }
            hasNoSelectedItems={
              cvTailoringReview.plan.items.length > 0 &&
              !hasSelectedClaimBackedCvItem(
                cvTailoringReview,
                cvTailoringSelectedItemIds,
              )
            }
            isBusy={cvTailoringBusy}
            errorMessage={cvTailoringError}
            materializedResumeName={materializedResumeName}
            onToggleItem={handleToggleCvTailoringItem}
            onCreate={() => {
              void handleCreateTailoredResume();
            }}
            onReload={() => {
              void handleReloadCvTailoringReview();
            }}
            onClose={handleCloseCvTailoringReview}
            onContinueToProposal={() => {
              void handleCreateProposal(selectedJob.id);
            }}
          />
        ) : null
      }
      handoffPanel={
        selectedJob ? (
          <ManualApplicationHandoffPanel
            jobId={selectedJob.id}
            applicationUrl={selectedJob.applicationUrl}
            handoff={manualApplicationHandoff ?? null}
            deliveryContent={manualApplicationHandoffDeliveryContent}
            onLoadDeliveryContent={
              handleLoadManualApplicationHandoffDeliveryContent
            }
            onPrepare={handlePrepareManualApplicationHandoff}
            onConfirm={handleConfirmManualApplicationHandoff}
            onRecordFileDownloadRequested={
              handleRecordManualApplicationHandoffFileDownloadRequested
            }
            onRecordDestinationOpenRequested={
              handleRecordManualApplicationHandoffDestinationOpenRequested
            }
            onReportOutcome={handleReportManualApplicationHandoffOutcome}
          />
        ) : null
      }
      debugPanels={
        <>
          <JobsStructuredShadowInternalPanel
            jobId={selectedJob?.id ?? ""}
            summary={selectedJob?.structuredShadowSummary}
          />
          <JobsStructuredPreviewAdvisoryPanel
            summary={selectedJob?.structuredShadowSummary}
          />
          {isJobsMatchInputDebugEnabled && selectedJob ? (
            <JobsMatchInputDebugPanel
              jobId={selectedJob.id}
              enabled={isLoaded && isSignedIn && isConvexAuthenticated}
              refreshKey={selectedJobRefreshKey}
            />
          ) : null}
        </>
      }
    />
  );

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-jobs-page">
        {isAuthLoading ? (
          <div className="dasti-empty-state" role="status" aria-live="polite">
            <div className="dasti-empty-state__title">Loading jobs</div>
          </div>
        ) : null}
        {authStatusMessage && !isAuthLoading ? (
          <div className="dasti-hint" style={{ padding: "var(--space-5) 0" }}>
            {authStatusMessage}
          </div>
        ) : null}

        {isJobsListLoading ? (
          <div className="dasti-empty-state" role="status" aria-live="polite">
            <div className="dasti-empty-state__title">Loading jobs</div>
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
              "jobs",
              isMobileJobsLayout && selectedJobId
                ? "dasti-jobs-layout--mobile-detail"
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shouldShowListPane ? (
              <JobsList
                jobsView={jobsView}
                selectedJobId={selectedJobId}
                filteredJobs={filteredJobs}
                displayedJobsCount={displayedJobs?.length ?? 0}
                searchQuery={searchQuery}
                sortOrder={sortOrder}
                matchFilter={matchFilter}
                hasDocsOnly={hasDocsOnly}
                noDocsOnly={noDocsOnly}
                needsReviewOnly={needsReviewOnly}
                favoritesOnly={favoritesOnly}
                remoteOnly={remoteOnly}
                seniorOnly={seniorOnly}
                optimisticActivityById={optimisticActivityById}
                optimisticFavoriteById={optimisticFavoriteById}
                confirmingPermanentDeleteJobId={confirmingPermanentDeleteJobId}
                onSearchQueryChange={setSearchQuery}
                onSortOrderChange={setSortOrder}
                onMatchFilterChange={setMatchFilter}
                onHasDocsOnlyChange={(value) => {
                  setHasDocsOnly(value);
                  if (value) setNoDocsOnly(false);
                }}
                onNoDocsOnlyChange={(value) => {
                  setNoDocsOnly(value);
                  if (value) setHasDocsOnly(false);
                }}
                onNeedsReviewOnlyChange={setNeedsReviewOnly}
                onFavoritesOnlyChange={setFavoritesOnly}
                onRemoteOnlyChange={setRemoteOnly}
                onSeniorOnlyChange={setSeniorOnly}
                onViewChange={(view) => void navigate(buildJobsListRoute(view))}
                onSelectJob={(jobId) => {
                  if (isProposalSelectionMode) {
                    void handleCreateProposal(jobId);
                    return;
                  }
                  void navigate(buildJobsRoute(jobId));
                }}
                isProposalSelectionMode={isProposalSelectionMode}
                onCancelProposalSelection={() => void navigate("/proposal")}
                onOpenJobSource={handleOpenJobSource}
                onArchiveJob={(jobId) => {
                  void handleArchiveJob(jobId);
                }}
                onDuplicateJob={(jobId) => {
                  void handleDuplicateJob(jobId);
                }}
                onRestoreArchivedJob={(jobId) => {
                  void handleRestoreArchivedJob(jobId);
                }}
                onDeleteArchivedJob={(jobId) => {
                  void handleDeleteArchivedJob(jobId);
                }}
                onConfirmPermanentDeleteJobIdChange={
                  setConfirmingPermanentDeleteJobId
                }
                onImportFirstJob={handleImportFirstJob}
              />
            ) : null}

            {shouldShowDetailPane ? (
              <section
                className="dasti-jobs-detail-pane jobs__detail"
                aria-label="Job detail"
              >
                {renderSelectedJobDetail()}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function JobsWorkspacePage(): JSX.Element {
  return (
    <JobsPageRuntimeBoundary>
      <JobsPageContent />
    </JobsPageRuntimeBoundary>
  );
}
