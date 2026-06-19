import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { listProfilesForClerk } from "./lib/userProfiles";
import {
  assertManualApplicationHandoffStorageIsRedacted,
  assertSafeHash,
  assertSafeRef,
  buildManualApplicationHandoffConfirmationCopy,
  buildManualApplicationHandoffId,
  buildManualApplicationHandoffManifestDigest,
  readManualApplicationHandoffServerConfigStatus,
  validateManualApplicationDestination,
  type ManualApplicationHandoffEventKind,
  type ManualApplicationHandoffEvidence,
  type ManualApplicationHandoffManifestInput,
  type ManualApplicationHandoffState,
} from "./lib/manualApplicationHandoff";

const HANDOFF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type OwnerJob = Readonly<{
  normalizedJobId: string;
  ownerProfileId: string;
  job: Record<string, any>;
}>;

type StoredPackage = Readonly<Record<string, any>>;
type StoredHandoff = Readonly<Record<string, any>>;

const handoffViewValidator = v.any();

export const getForJob = query({
  args: {
    jobId: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    const config = readManualApplicationHandoffServerConfigStatus();
    const ownerJob = await requireOwnerJob(ctx, args.jobId);
    const current = await findLatestHandoffForJob(
      ctx,
      ownerJob.ownerProfileId,
      ownerJob.normalizedJobId,
    );

    if (!config.enabled) {
      return buildHandoffView({
        status: "disabled",
        config,
        ownerJob,
        handoff: null,
      });
    }

    if (!current) {
      const applicationPackage = await findLatestReadyPackageForJob(
        ctx,
        ownerJob.ownerProfileId,
        ownerJob.normalizedJobId,
      );
      return buildHandoffView({
        status: "not_started",
        config,
        ownerJob,
        handoff: null,
        applicationPackage,
      });
    }

    return buildHandoffView({
      status: current.state,
      config,
      ownerJob,
      handoff: current,
    });
  },
});

export const prepare = mutation({
  args: {
    jobId: v.string(),
    applicationPackageId: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    const now = Date.now();
    const ownerJob = await requireOwnerJob(ctx, args.jobId);
    const applicationPackage = await requireReadyApplicationPackage({
      ctx,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      applicationPackageId: args.applicationPackageId,
    });
    const destination = await validateManualApplicationDestination(
      ownerJob.job.applicationUrl,
    );
    const manifest = buildManifestInput({
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      applicationPackage,
      destination,
    });
    const manifestDigest =
      await buildManualApplicationHandoffManifestDigest(manifest);
    const handoffId = await buildManualApplicationHandoffId({
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      applicationPackageId: args.applicationPackageId,
      manifestDigest,
    });
    const handoffDoc = {
      handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      applicationPackageId: args.applicationPackageId,
      applicationContextId: applicationPackage.applicationContextId,
      resumeVariantArtifactId: applicationPackage.resumeVariantArtifactId,
      coverLetterArtifactId: applicationPackage.coverLetterArtifactId,
      manifestDigest,
      manifestVersion: 1 as const,
      state: "handoff_prepared" as const,
      destinationOrigin: destination.destinationOrigin,
      destinationHostname: destination.destinationHostname,
      destinationUrlHash: destination.destinationUrlHash,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + HANDOFF_TTL_MS,
      version: 1 as const,
    };
    assertManualApplicationHandoffStorageIsRedacted(handoffDoc, "handoff");

    const existing = await getHandoffById(ctx, handoffId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        state: "handoff_prepared",
        manifestDigest,
        destinationOrigin: destination.destinationOrigin,
        destinationHostname: destination.destinationHostname,
        destinationUrlHash: destination.destinationUrlHash,
        confirmationDigest: undefined,
        confirmedAt: undefined,
        updatedAt: now,
        expiresAt: now + HANDOFF_TTL_MS,
      });
    } else {
      await ctx.db.insert("manualApplicationHandoffs", handoffDoc);
    }

    await appendEvent(ctx, {
      handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: "manual_handoff.prepared",
      evidence: "twoweeks_prepared",
      stateAfter: "handoff_prepared",
      manifestDigest,
      applicationPackageId: args.applicationPackageId,
      applicationContextId: applicationPackage.applicationContextId,
      destinationOrigin: destination.destinationOrigin,
      destinationHostname: destination.destinationHostname,
      destinationUrlHash: destination.destinationUrlHash,
      occurredAt: now,
    });

    return buildHandoffView({
      status: "handoff_prepared",
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff: handoffDoc,
      applicationPackage,
    });
  },
});

export const confirm = mutation({
  args: {
    handoffId: v.string(),
    manifestDigest: v.string(),
    confirmationCopy: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    const now = Date.now();
    const { ownerJob, handoff, applicationPackage } =
      await requireFreshOwnedHandoff(ctx, {
        handoffId: args.handoffId,
        manifestDigest: args.manifestDigest,
      });
    if (handoff.state !== "handoff_prepared") {
      throw new Error("Manual application handoff must be prepared before confirmation");
    }
    const expectedCopy = buildManualApplicationHandoffConfirmationCopy(
      args.manifestDigest,
    );
    if (args.confirmationCopy !== expectedCopy) {
      throw new Error("Manual application handoff confirmation copy mismatch");
    }
    const confirmationDigest = await buildManualApplicationHandoffManifestDigest({
      ...buildManifestInput({
        ownerProfileId: ownerJob.ownerProfileId,
        jobId: ownerJob.normalizedJobId,
        applicationPackage,
        destination: {
          destinationOrigin: handoff.destinationOrigin,
          destinationHostname: handoff.destinationHostname,
          destinationUrlHash: handoff.destinationUrlHash,
        },
      }),
      contentHash: applicationPackage.contentHash,
    });

    await ctx.db.patch(handoff._id, {
      state: "handoff_confirmed",
      confirmationDigest,
      confirmedAt: now,
      updatedAt: now,
    });
    await appendEvent(ctx, {
      handoffId: handoff.handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: "manual_handoff.confirmed",
      evidence: "user_interaction_observed",
      stateAfter: "handoff_confirmed",
      manifestDigest: args.manifestDigest,
      applicationPackageId: handoff.applicationPackageId,
      applicationContextId: handoff.applicationContextId,
      occurredAt: now,
    });

    return buildHandoffView({
      status: "handoff_confirmed",
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff: { ...handoff, state: "handoff_confirmed", updatedAt: now },
      applicationPackage,
    });
  },
});

export const recordCopySucceeded = mutation({
  args: {
    handoffId: v.string(),
    manifestDigest: v.string(),
    answerRef: v.string(),
    answerDigest: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    assertSafeRef(args.answerRef, "answerRef");
    assertSafeHash(args.answerDigest, "answerDigest");
    const { ownerJob, handoff, applicationPackage } =
      await requireConfirmedUsableHandoff(ctx, args);
    const now = Date.now();
    await appendEvent(ctx, {
      handoffId: handoff.handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: "manual_handoff.copy_succeeded",
      evidence: "user_interaction_observed",
      stateAfter: handoff.state,
      manifestDigest: args.manifestDigest,
      applicationPackageId: handoff.applicationPackageId,
      applicationContextId: handoff.applicationContextId,
      answerRef: args.answerRef,
      answerDigest: args.answerDigest,
      occurredAt: now,
    });
    return buildHandoffView({
      status: handoff.state,
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff,
      applicationPackage,
    });
  },
});

export const recordFileDownloadRequested = mutation({
  args: {
    handoffId: v.string(),
    manifestDigest: v.string(),
    artifactRef: v.string(),
    artifactDigest: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    assertSafeRef(args.artifactRef, "artifactRef");
    assertSafeHash(args.artifactDigest, "artifactDigest");
    const { ownerJob, handoff, applicationPackage } =
      await requireConfirmedUsableHandoff(ctx, args);
    const now = Date.now();
    await appendEvent(ctx, {
      handoffId: handoff.handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: "manual_handoff.file_download_requested",
      evidence: "user_interaction_observed",
      stateAfter: handoff.state,
      manifestDigest: args.manifestDigest,
      applicationPackageId: handoff.applicationPackageId,
      applicationContextId: handoff.applicationContextId,
      artifactRef: args.artifactRef,
      artifactDigest: args.artifactDigest,
      occurredAt: now,
    });
    return buildHandoffView({
      status: handoff.state,
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff,
      applicationPackage,
    });
  },
});

export const recordDestinationOpenRequested = mutation({
  args: {
    handoffId: v.string(),
    manifestDigest: v.string(),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    const { ownerJob, handoff, applicationPackage } =
      await requireConfirmedUsableHandoff(ctx, args);
    const now = Date.now();
    await ctx.db.patch(handoff._id, {
      state: "destination_open_requested",
      updatedAt: now,
    });
    await appendEvent(ctx, {
      handoffId: handoff.handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: "manual_handoff.destination_open_requested",
      evidence: "user_interaction_observed",
      stateAfter: "destination_open_requested",
      manifestDigest: args.manifestDigest,
      applicationPackageId: handoff.applicationPackageId,
      applicationContextId: handoff.applicationContextId,
      destinationOrigin: handoff.destinationOrigin,
      destinationHostname: handoff.destinationHostname,
      destinationUrlHash: handoff.destinationUrlHash,
      occurredAt: now,
    });
    return buildHandoffView({
      status: "destination_open_requested",
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff: {
        ...handoff,
        state: "destination_open_requested",
        updatedAt: now,
      },
      applicationPackage,
    });
  },
});

export const reportOutcome = mutation({
  args: {
    handoffId: v.string(),
    manifestDigest: v.string(),
    outcome: v.union(
      v.literal("user_reported_submitted"),
      v.literal("user_reported_not_submitted"),
      v.literal("abandoned"),
    ),
  },
  returns: handoffViewValidator,
  handler: async (ctx, args) => {
    assertEnabled();
    const { ownerJob, handoff, applicationPackage } =
      await requireFreshOwnedHandoff(ctx, args);
    if (
      handoff.state !== "handoff_confirmed" &&
      handoff.state !== "destination_open_requested"
    ) {
      throw new Error("Manual application handoff must be confirmed before outcome report");
    }
    const now = Date.now();
    await ctx.db.patch(handoff._id, {
      state: args.outcome,
      updatedAt: now,
    });
    await appendEvent(ctx, {
      handoffId: handoff.handoffId,
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      eventKind: `manual_handoff.${args.outcome}` as ManualApplicationHandoffEventKind,
      evidence: "user_reported",
      stateAfter: args.outcome,
      manifestDigest: args.manifestDigest,
      applicationPackageId: handoff.applicationPackageId,
      applicationContextId: handoff.applicationContextId,
      occurredAt: now,
    });
    return buildHandoffView({
      status: args.outcome,
      config: readManualApplicationHandoffServerConfigStatus(),
      ownerJob,
      handoff: { ...handoff, state: args.outcome, updatedAt: now },
      applicationPackage,
    });
  },
});

function assertEnabled(): void {
  if (!readManualApplicationHandoffServerConfigStatus().enabled) {
    throw new Error("Manual application handoff disabled");
  }
}

async function requireOwnerJob(ctx: any, jobId: string): Promise<OwnerJob> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Not authenticated");
  }
  const normalizedJobId = ctx.db.normalizeId("jobs", jobId);
  if (!normalizedJobId) {
    throw new Error("Job not found");
  }
  const profiles = await listProfilesForClerk(ctx, identity.subject);
  if (profiles.length === 0) {
    throw new Error("User profile not found");
  }
  const job = await ctx.db.get(normalizedJobId);
  const ownerProfile = job
    ? profiles.find((profile) => String(profile._id) === String(job.userId))
    : null;
  if (!job || !ownerProfile || job.archivedAt !== null && job.archivedAt !== undefined) {
    throw new Error("Job not found");
  }
  return {
    normalizedJobId,
    ownerProfileId: String(ownerProfile._id),
    job,
  };
}

async function requireReadyApplicationPackage(args: {
  ctx: any;
  ownerProfileId: string;
  jobId: string;
  applicationPackageId: string;
}): Promise<StoredPackage> {
  const applicationPackage = await getApplicationPackageById(
    args.ctx,
    args.applicationPackageId,
  );
  if (!applicationPackage) {
    throw new Error("Application package not found");
  }
  if (applicationPackage.userId !== args.ownerProfileId) {
    throw new Error("Application package not found");
  }
  if (applicationPackage.status !== "ready_for_review") {
    throw new Error("Application package must be ready_for_review");
  }
  const context = await args.ctx.db
    .query("applicationContexts")
    .withIndex("by_user_id", (q: any) =>
      q
        .eq("userId", args.ownerProfileId)
        .eq("id", applicationPackage.applicationContextId),
    )
    .unique();
  if (!context || String(context.job?.jobId ?? "") !== args.jobId) {
    throw new Error("Application package context does not match job");
  }
  return applicationPackage;
}

async function requireFreshOwnedHandoff(
  ctx: any,
  args: { handoffId: string; manifestDigest: string },
): Promise<{
  ownerJob: OwnerJob;
  handoff: StoredHandoff;
  applicationPackage: StoredPackage;
}> {
  assertSafeRef(args.handoffId, "handoffId");
  assertSafeHash(args.manifestDigest, "manifestDigest");
  const handoff = await getHandoffById(ctx, args.handoffId);
  if (!handoff) {
    throw new Error("Manual application handoff not found");
  }
  const ownerJob = await requireOwnerJob(ctx, handoff.jobId);
  if (handoff.ownerProfileId !== ownerJob.ownerProfileId) {
    throw new Error("Manual application handoff not found");
  }
  const applicationPackage = await requireReadyApplicationPackage({
    ctx,
    ownerProfileId: ownerJob.ownerProfileId,
    jobId: ownerJob.normalizedJobId,
    applicationPackageId: handoff.applicationPackageId,
  });
  const destination = {
    destinationOrigin: handoff.destinationOrigin,
    destinationHostname: handoff.destinationHostname,
    destinationUrlHash: handoff.destinationUrlHash,
  };
  const manifestDigest = await buildManualApplicationHandoffManifestDigest(
    buildManifestInput({
      ownerProfileId: ownerJob.ownerProfileId,
      jobId: ownerJob.normalizedJobId,
      applicationPackage,
      destination,
    }),
  );
  if (
    manifestDigest !== handoff.manifestDigest ||
    args.manifestDigest !== handoff.manifestDigest
  ) {
    throw new Error("Manual application handoff stale digest");
  }
  return { ownerJob, handoff, applicationPackage };
}

async function requireConfirmedUsableHandoff(
  ctx: any,
  args: { handoffId: string; manifestDigest: string },
) {
  const result = await requireFreshOwnedHandoff(ctx, args);
  if (
    result.handoff.state !== "handoff_confirmed" &&
    result.handoff.state !== "destination_open_requested"
  ) {
    throw new Error("Manual application handoff must be confirmed");
  }
  return result;
}

async function getApplicationPackageById(
  ctx: any,
  applicationPackageId: string,
): Promise<StoredPackage | null> {
  return await ctx.db
    .query("applicationPackages")
    .withIndex("by_application_package_id", (q: any) =>
      q.eq("applicationPackageId", applicationPackageId),
    )
    .unique();
}

async function getHandoffById(
  ctx: any,
  handoffId: string,
): Promise<StoredHandoff | null> {
  return await ctx.db
    .query("manualApplicationHandoffs")
    .withIndex("by_handoff_id", (q: any) => q.eq("handoffId", handoffId))
    .unique();
}

async function findLatestHandoffForJob(
  ctx: any,
  ownerProfileId: string,
  jobId: string,
): Promise<StoredHandoff | null> {
  const rows = await ctx.db
    .query("manualApplicationHandoffs")
    .withIndex("by_owner_job_updated", (q: any) =>
      q.eq("ownerProfileId", ownerProfileId).eq("jobId", jobId),
    )
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

async function findLatestReadyPackageForJob(
  ctx: any,
  ownerProfileId: string,
  jobId: string,
): Promise<StoredPackage | undefined> {
  const contexts = await ctx.db
    .query("applicationContexts")
    .withIndex("by_user_job", (q: any) =>
      q.eq("userId", ownerProfileId).eq("job.jobId", jobId),
    )
    .order("desc")
    .take(10);
  const packages: StoredPackage[] = [];
  for (const context of contexts) {
    const rows = await ctx.db
      .query("applicationPackages")
      .withIndex("by_user_and_application_context", (q: any) =>
        q
          .eq("userId", ownerProfileId)
          .eq("applicationContextId", context.id),
      )
      .take(10);
    packages.push(
      ...rows.filter((row: StoredPackage) => row.status === "ready_for_review"),
    );
  }
  return packages.sort((left, right) => {
    const leftTs = Number(left.createdAt ?? left.updatedAt ?? 0);
    const rightTs = Number(right.createdAt ?? right.updatedAt ?? 0);
    if (rightTs !== leftTs) return rightTs - leftTs;
    return String(left.applicationPackageId).localeCompare(
      String(right.applicationPackageId),
    );
  })[0];
}

function buildManifestInput(args: {
  ownerProfileId: string;
  jobId: string;
  applicationPackage: StoredPackage;
  destination: {
    destinationOrigin: string;
    destinationHostname: string;
    destinationUrlHash: string;
  };
}): ManualApplicationHandoffManifestInput {
  const resumeArtifact =
    args.applicationPackage.pkg?.artifacts?.find(
      (artifact: any) => artifact.id === args.applicationPackage.resumeVariantArtifactId,
    ) ?? {};
  const coverLetterArtifact =
    args.applicationPackage.pkg?.artifacts?.find(
      (artifact: any) => artifact.id === args.applicationPackage.coverLetterArtifactId,
    ) ?? {};
  return {
    ownerProfileId: args.ownerProfileId,
    jobId: args.jobId,
    applicationPackageId: args.applicationPackage.applicationPackageId,
    applicationContextId: args.applicationPackage.applicationContextId,
    packageHash: args.applicationPackage.packageHash,
    ...(args.applicationPackage.contentHash
      ? { contentHash: args.applicationPackage.contentHash }
      : {}),
    resumeVariantArtifactId: args.applicationPackage.resumeVariantArtifactId,
    ...(resumeArtifact.contentHash
      ? { resumeVariantArtifactContentHash: resumeArtifact.contentHash }
      : {}),
    coverLetterArtifactId: args.applicationPackage.coverLetterArtifactId,
    ...(coverLetterArtifact.contentHash
      ? { coverLetterArtifactContentHash: coverLetterArtifact.contentHash }
      : {}),
    destinationOrigin: args.destination.destinationOrigin,
    destinationHostname: args.destination.destinationHostname,
    destinationUrlHash: args.destination.destinationUrlHash,
  };
}

async function appendEvent(
  ctx: any,
  event: {
    handoffId: string;
    ownerProfileId: string;
    jobId: string;
    eventKind: ManualApplicationHandoffEventKind;
    evidence: ManualApplicationHandoffEvidence;
    stateAfter: ManualApplicationHandoffState;
    manifestDigest?: string;
    applicationPackageId?: string;
    applicationContextId?: string;
    artifactRef?: string;
    artifactDigest?: string;
    answerRef?: string;
    answerDigest?: string;
    destinationOrigin?: string;
    destinationHostname?: string;
    destinationUrlHash?: string;
    occurredAt: number;
  },
) {
  const eventDoc = {
    ...event,
    version: 1 as const,
  };
  assertManualApplicationHandoffStorageIsRedacted(eventDoc, "handoff event");
  await ctx.db.insert("manualApplicationHandoffEvents", eventDoc);
}

function buildHandoffView(args: {
  status: string;
  config: ReturnType<typeof readManualApplicationHandoffServerConfigStatus>;
  ownerJob: OwnerJob;
  handoff: StoredHandoff | null;
  applicationPackage?: StoredPackage;
}) {
  const handoff = args.handoff;
  const manifestDigest = handoff?.manifestDigest ?? null;
  const canUseConfirmedPackage =
    handoff?.state === "handoff_confirmed" ||
    handoff?.state === "destination_open_requested";
  return {
    status: args.status,
    persistedState: handoff?.state ?? null,
    enabled: args.config.enabled,
    config: args.config,
    canPrepare:
      args.config.enabled &&
      Boolean(args.applicationPackage?.applicationPackageId) &&
      Boolean(args.ownerJob.job.applicationUrl),
    canConfirm: handoff?.state === "handoff_prepared",
    canUseConfirmedPackage,
    handoffId: handoff?.handoffId ?? null,
    applicationPackageId:
      handoff?.applicationPackageId ??
      args.applicationPackage?.applicationPackageId ??
      null,
    applicationContextId:
      handoff?.applicationContextId ??
      args.applicationPackage?.applicationContextId ??
      null,
    resumeVariantArtifactId:
      handoff?.resumeVariantArtifactId ??
      args.applicationPackage?.resumeVariantArtifactId ??
      null,
    coverLetterArtifactId:
      handoff?.coverLetterArtifactId ??
      args.applicationPackage?.coverLetterArtifactId ??
      null,
    manifestDigest,
    requiredConfirmationCopy: manifestDigest
      ? buildManualApplicationHandoffConfirmationCopy(manifestDigest)
      : null,
    destinationOrigin:
      handoff?.destinationOrigin ??
      safeOriginFromApplicationUrl(args.ownerJob.job.applicationUrl),
    destinationHostname:
      handoff?.destinationHostname ??
      safeHostnameFromApplicationUrl(args.ownerJob.job.applicationUrl),
    applicationUrl: args.config.enabled
      ? String(args.ownerJob.job.applicationUrl ?? "")
      : "",
    approvedAnswers: [],
    downloadableArtifacts: buildDownloadableArtifacts(args.applicationPackage, handoff),
    providerVerified: false,
    version: 1,
  };
}

function buildDownloadableArtifacts(
  applicationPackage: StoredPackage | undefined,
  handoff: StoredHandoff | null,
) {
  if (!applicationPackage || !handoff) return [];
  return [
    {
      artifactRef: applicationPackage.resumeVariantArtifactId,
      label: "Resume variant",
      filename: "resume-variant-handoff.md",
      mimeType: "text/markdown",
      text: buildArtifactDownloadText("Resume variant", applicationPackage),
      artifactDigest: handoff.manifestDigest,
    },
    {
      artifactRef: applicationPackage.coverLetterArtifactId,
      label: "Cover letter",
      filename: "cover-letter-handoff.md",
      mimeType: "text/markdown",
      text: buildArtifactDownloadText("Cover letter", applicationPackage),
      artifactDigest: handoff.manifestDigest,
    },
  ];
}

function buildArtifactDownloadText(label: string, applicationPackage: StoredPackage): string {
  return [
    `${label} handoff reference`,
    "",
    `Application package: ${applicationPackage.applicationPackageId}`,
    `Application context: ${applicationPackage.applicationContextId}`,
    `Package digest: ${applicationPackage.contentHash ?? applicationPackage.packageHash}`,
  ].join("\n");
}

function safeOriginFromApplicationUrl(applicationUrl: unknown): string | null {
  try {
    return new URL(String(applicationUrl ?? "")).origin;
  } catch {
    return null;
  }
}

function safeHostnameFromApplicationUrl(applicationUrl: unknown): string | null {
  try {
    return new URL(String(applicationUrl ?? "")).hostname.toLowerCase();
  } catch {
    return null;
  }
}
