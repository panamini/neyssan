export type DashboardProposalStatus =
  | "draft"
  | "saved"
  | "sent"
  | "exported"
  | "submitted"
  | string;

export type DashboardProposal = {
  _id?: string;
  id?: string;
  title?: string | null;
  content?: string | null;
  status?: DashboardProposalStatus | null;
  updatedAt?: number | null;
  createdAt?: number | null;
  _creationTime?: number | null;
  metadata?: {
    jobId?: string | null;
    sourceJobTitle?: string | null;
    sourceUrl?: string | null;
    sourceCvId?: string | null;
  } | null;
};

export type DashboardJob = {
  _id?: string;
  id: string;
  title: string;
  company?: string | null;
  status?: string | null;
  matchTier?: "strong" | "partial" | "weak" | "unknown" | string | null;
  matchRead?: {
    tier?: "strong" | "partial" | "weak" | "unknown" | string | null;
  } | null;
  matchReview?: {
    verdict?:
      | "strong_lead"
      | "possible_lead"
      | "probably_skip"
      | "not_enough_signal"
      | string
      | null;
  } | null;
  reviewState?: string | null;
  linkedDocumentCount?: number | null;
  updatedAt?: number | null;
  importedAt?: number | null;
  lastActivityAt?: number | null;
};

export type DashboardMetric = {
  id: "strong-matches";
  value: number;
  label: string;
  description: string;
  cta: string;
  href: string;
};

export type DashboardActivity = {
  id: string;
  status: "Sent" | "Drafting" | "Saved" | "Job";
  title: string;
  sub: string;
  href: string;
  timeValue: number;
};

export type DashboardCurrentWorkItem = {
  id: string;
  kind: "draft" | "cv" | "saved-proposal" | "job";
  title: string;
  sub: string;
  href: string;
  timeValue: number;
};

export type DashboardCapturedJobItem = {
  id: string;
  title: string;
  sub: string;
  status: "Strong" | "Worth a shot" | "Needs review" | "Maybe" | "Saved";
  href: string;
  timeValue: number;
};

export type DashboardNeedReviewItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  timeValue: number;
};

const SENT_STATUSES = new Set(["sent", "exported", "submitted"]);
const INACTIVE_JOB_STATUSES = new Set([
  "archived",
  "applied",
  "sent",
  "submitted",
]);

function getProposalId(proposal: DashboardProposal): string {
  return String(proposal._id ?? proposal.id ?? "");
}

function getProposalTime(proposal: DashboardProposal): number {
  return Number(
    proposal.updatedAt ?? proposal.createdAt ?? proposal._creationTime ?? 0,
  );
}

function getJobTime(job: DashboardJob): number {
  return Number(job.lastActivityAt ?? job.updatedAt ?? job.importedAt ?? 0);
}

export function hasMeaningfulProposalDraft(
  proposal: DashboardProposal | null | undefined,
): boolean {
  return Boolean(
    proposal &&
      proposal.status === "draft" &&
      String(proposal.content ?? "").trim().length > 0,
  );
}

export function findLatestProposalDraft(
  proposals: DashboardProposal[] | null | undefined,
): DashboardProposal | null {
  return [...(proposals ?? [])]
    .filter(hasMeaningfulProposalDraft)
    .sort((left, right) => getProposalTime(right) - getProposalTime(left))[0] ?? null;
}

export function isSentProposal(proposal: DashboardProposal): boolean {
  return SENT_STATUSES.has(String(proposal.status ?? "").toLowerCase());
}

export function isStrongOrWorthJob(job: DashboardJob): boolean {
  const status = String(job.status ?? "").toLowerCase();
  if (INACTIVE_JOB_STATUSES.has(status)) return false;

  const verdict = job.matchReview?.verdict;
  if (verdict === "strong_lead" || verdict === "possible_lead") {
    return true;
  }

  const tier = job.matchRead?.tier ?? job.matchTier;
  return tier === "strong" || tier === "partial";
}

export function getStrongOrWorthJobCount(jobs?: DashboardJob[] | null): number {
  return (jobs ?? []).filter(isStrongOrWorthJob).length;
}

function getJobMatchStatus(job: DashboardJob): DashboardCapturedJobItem["status"] {
  if (job.reviewState === "needs_review") return "Needs review";
  const verdict = job.matchReview?.verdict;
  const tier = job.matchRead?.tier ?? job.matchTier;
  if (verdict === "strong_lead" || tier === "strong") return "Strong";
  if (verdict === "possible_lead" || tier === "partial") return "Worth a shot";
  if (
    verdict === "probably_skip" ||
    verdict === "not_enough_signal" ||
    tier === "weak" ||
    tier === "unknown"
  ) {
    return "Maybe";
  }
  return "Saved";
}

function normalizeDraftTitle(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s*[·-]?\s*draft(?:\s+in\s+progress)?$/i, "")
    .trim();
}

export function getDraftDisplayTitle(
  proposal: DashboardProposal | null | undefined,
): string {
  const title = normalizeDraftTitle(proposal?.title);
  if (title && title.toLowerCase() !== "letter") {
    return `${title} · Draft`;
  }
  const sourceTitle = normalizeDraftTitle(proposal?.metadata?.sourceJobTitle);
  if (sourceTitle) {
    return `${sourceTitle} · Draft`;
  }
  return "Letter · Draft in progress";
}

export function getDraftHeroSubtitle(
  proposal: DashboardProposal | null | undefined,
  jobs?: DashboardJob[] | null,
): string {
  const linkedJobId = String(proposal?.metadata?.jobId ?? "");
  const linkedJob = linkedJobId
    ? (jobs ?? []).find(
        (job) => String(job.id ?? job._id ?? "") === linkedJobId,
      )
    : null;
  const linkedTitle =
    normalizeDraftTitle(linkedJob?.title) ||
    normalizeDraftTitle(proposal?.metadata?.sourceJobTitle);

  if (linkedTitle) {
    return `${linkedTitle} · Letter draft`;
  }

  return "Letter draft · Missing job context";
}

export function buildDashboardMetrics(args: {
  jobs?: DashboardJob[] | null;
}): DashboardMetric[] {
  const strongMatches = getStrongOrWorthJobCount(args.jobs);
  const metrics: DashboardMetric[] = [];

  if (strongMatches > 0) {
    metrics.push({
      id: "strong-matches",
      value: strongMatches,
      label: strongMatches === 1 ? "strong match" : "strong matches",
      description: "Captured jobs ready to review.",
      cta: "Review matches",
      href: "/jobs?match=worth_plus",
    });
  }

  return metrics;
}

export function buildDashboardNeedsReview(args: {
  proposals?: DashboardProposal[] | null;
  jobs?: DashboardJob[] | null;
}): DashboardNeedReviewItem[] {
  const proposalItems = (args.proposals ?? [])
    .filter(hasMeaningfulProposalDraft)
    .filter((proposal) => !proposal.metadata?.jobId || !proposal.metadata?.sourceCvId)
    .map((proposal) => {
      const id = getProposalId(proposal);
      const missingJob = !proposal.metadata?.jobId;
      return {
        id: `proposal-${id}`,
        title: proposal.title?.trim() || "Untitled draft",
        detail: missingJob
          ? "Draft missing job context."
          : "Draft missing attached CV.",
        href: id ? `/proposal?draftId=${encodeURIComponent(id)}` : "/proposal",
        timeValue: getProposalTime(proposal),
      };
    });

  const jobItems = (args.jobs ?? [])
    .filter((job) => job.reviewState === "needs_review" || isStrongOrWorthJob(job))
    .filter((job) => job.reviewState === "needs_review" || (job.linkedDocumentCount ?? 0) === 0)
    .map((job) => ({
      id: `job-${job.id}`,
      title: [job.title, job.company].filter(Boolean).join(" · "),
      detail:
        job.reviewState === "needs_review"
          ? "Job import needs review."
          : "Strong match has no proposal.",
      href: `/jobs/${encodeURIComponent(job.id)}`,
      timeValue: getJobTime(job),
    }));

  return [...proposalItems, ...jobItems]
    .sort((left, right) => right.timeValue - left.timeValue)
    .slice(0, 8);
}

export function buildDashboardCurrentWork(args: {
  proposals?: DashboardProposal[] | null;
  jobs?: DashboardJob[] | null;
  latestCv?: {
    id: string;
    title: string;
    updatedAt?: string;
    createdAt?: string;
  } | null;
}): DashboardCurrentWorkItem[] {
  const proposals = args.proposals ?? [];
  const latestDraft = findLatestProposalDraft(proposals);
  const latestSaved = [...proposals]
    .filter((proposal) => proposal.status === "saved")
    .sort((left, right) => getProposalTime(right) - getProposalTime(left))[0] ?? null;
  const latestJob = [...(args.jobs ?? [])]
    .sort((left, right) => getJobTime(right) - getJobTime(left))[0] ?? null;

  const items: DashboardCurrentWorkItem[] = [];
  if (latestDraft) {
    const id = getProposalId(latestDraft);
    items.push({
      id: `draft-${id}`,
      kind: "draft",
      title: getDraftDisplayTitle(latestDraft),
      sub: "Proposal draft in progress.",
      href: id && id !== "local" ? `/proposal?draftId=${encodeURIComponent(id)}` : "/proposal",
      timeValue: getProposalTime(latestDraft),
    });
  }
  if (args.latestCv) {
    items.push({
      id: `cv-${args.latestCv.id}`,
      kind: "cv",
      title: args.latestCv.title,
      sub: "Latest CV profile.",
      href: "/cv",
      timeValue:
        Date.parse(args.latestCv.updatedAt ?? args.latestCv.createdAt ?? "") || 0,
    });
  }
  if (latestSaved) {
    const id = getProposalId(latestSaved);
    items.push({
      id: `saved-${id}`,
      kind: "saved-proposal",
      title: latestSaved.title?.trim() || "Saved proposal",
      sub: "Saved to proposal library.",
      href: id ? `/proposal?view=saved&id=${encodeURIComponent(id)}` : "/proposals",
      timeValue: getProposalTime(latestSaved),
    });
  }
  if (latestJob) {
    items.push({
      id: `job-${latestJob.id}`,
      kind: "job",
      title: [latestJob.title, latestJob.company].filter(Boolean).join(" · "),
      sub: isStrongOrWorthJob(latestJob) ? "Captured job with match signal." : "Captured job.",
      href: `/jobs/${encodeURIComponent(latestJob.id)}`,
      timeValue: getJobTime(latestJob),
    });
  }

  return items.sort((left, right) => right.timeValue - left.timeValue).slice(0, 4);
}

export function buildDashboardCapturedJobs(args: {
  jobs?: DashboardJob[] | null;
}): DashboardCapturedJobItem[] {
  return [...(args.jobs ?? [])]
    .sort((left, right) => getJobTime(right) - getJobTime(left))
    .slice(0, 4)
    .map((job) => ({
      id: `job-${job.id}`,
      title: [job.title, job.company].filter(Boolean).join(" · "),
      sub:
        job.reviewState === "needs_review"
          ? "Import review needs attention."
          : isStrongOrWorthJob(job)
            ? "Ready to review."
            : getJobMatchStatus(job) === "Maybe"
              ? "Review if still relevant."
              : "Saved from captured jobs.",
      status: getJobMatchStatus(job),
      href: `/jobs/${encodeURIComponent(job.id)}`,
      timeValue: getJobTime(job),
    }));
}
