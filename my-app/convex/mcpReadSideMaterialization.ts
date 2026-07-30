import type { ApplicationPackageV1 } from "../src/modules/application-package/schema";

import { buildApplicationPackageStorageRecord } from "./lib/applicationPackages";
import { buildApplicationContextV1FromExistingData } from "./lib/applicationContextBuilder";
import { buildStableHash } from "./lib/applicationHarnessHashes";

const HASH_NAMESPACE = "mcp-read-side-materialization";

type MaterializationSkipReason =
  | "proposal_missing_owner"
  | "proposal_missing_job"
  | "job_not_found"
  | "job_owner_mismatch"
  | "profile_not_found"
  | "materialization_failed";

type LooseRecord = Record<string, unknown>;

type MaterializationCtx = Readonly<{
  db: any;
}>;

export type StoredProposalForMcpReadSideMaterialization = LooseRecord & {
  _id?: unknown;
  userId?: unknown;
  jobId?: unknown;
  content?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  metadata?: unknown;
};

export type McpReadSideMaterializationResult = Readonly<
  | {
      status: "skipped";
      reason: MaterializationSkipReason;
      version: 1;
    }
  | {
      status: "materialized";
      applicationContextId: string;
      applicationPackageId: string;
      contextReused: boolean;
      packageReused: boolean;
      version: 1;
    }
>;

export async function materializeMcpReadSideForStoredProposal(
  ctx: MaterializationCtx,
  proposal: StoredProposalForMcpReadSideMaterialization,
): Promise<McpReadSideMaterializationResult> {
  const ownerId = readString(proposal.userId);
  if (!ownerId) {
    return skipped("proposal_missing_owner");
  }

  const jobStorageId = resolveJobStorageId(ctx, proposal);
  if (!jobStorageId) {
    await deleteMcpReadSidePackageForStoredProposal(ctx, proposal);
    return skipped("proposal_missing_job");
  }

  const [profile, job] = await Promise.all([
    ctx.db.get(ownerId),
    ctx.db.get(jobStorageId),
  ]);
  if (!profile) {
    await deleteMcpReadSidePackageForStoredProposal(ctx, proposal);
    return skipped("profile_not_found");
  }
  if (!job) {
    await deleteMcpReadSidePackageForStoredProposal(ctx, proposal);
    return skipped("job_not_found");
  }
  if (readString(job.userId) !== ownerId) {
    await deleteMcpReadSidePackageForStoredProposal(ctx, proposal);
    return skipped("job_owner_mismatch");
  }

  const now = Date.now();
  const context = await buildAndPersistApplicationContext(ctx, {
    ownerId,
    job,
    profile,
    proposal,
    now,
  });
  let applicationPackage: ApplicationPackageV1;
  let packageReused: boolean;
  try {
    applicationPackage = await buildSafeApplicationPackage({
      ownerId,
      applicationContextId: context.contextId,
      proposal,
      now,
    });
    packageReused = await createOrReuseApplicationPackage(ctx, applicationPackage);
  } catch (error) {
    await deleteApplicationContextIfUnreferenced(ctx, {
      applicationContextId: context.contextId,
      userId: ownerId,
    });
    throw error;
  }

  return {
    status: "materialized",
    applicationContextId: context.contextId,
    applicationPackageId: applicationPackage.id,
    contextReused: context.reused,
    packageReused,
    version: 1,
  };
}

export async function bestEffortMaterializeMcpReadSideForStoredProposal(
  ctx: MaterializationCtx,
  proposal: StoredProposalForMcpReadSideMaterialization,
): Promise<McpReadSideMaterializationResult> {
  try {
    return await materializeMcpReadSideForStoredProposal(ctx, proposal);
  } catch (error) {
    logBestEffortFailure("materialize", error);
    return skipped("materialization_failed");
  }
}

export async function deleteMcpReadSidePackageForStoredProposal(
  ctx: MaterializationCtx,
  proposal: StoredProposalForMcpReadSideMaterialization,
): Promise<boolean> {
  const applicationPackageId = await buildStableApplicationPackageId(proposal);
  if (!applicationPackageId) {
    return false;
  }

  const existing = await ctx.db
    .query("applicationPackages")
    .withIndex("by_application_package_id", (q: any) =>
      q.eq("applicationPackageId", applicationPackageId),
    )
    .unique?.();
  if (!existing) {
    return false;
  }

  const applicationContextId = readString(existing.applicationContextId);
  const userId = readString(existing.userId) ?? readString(proposal.userId);
  await ctx.db.delete(existing._id);
  if (applicationContextId && userId) {
    await deleteApplicationContextIfUnreferenced(ctx, {
      applicationContextId,
      userId,
    });
  }
  return true;
}

export async function bestEffortDeleteMcpReadSidePackageForStoredProposal(
  ctx: MaterializationCtx,
  proposal: StoredProposalForMcpReadSideMaterialization,
): Promise<boolean> {
  try {
    return await deleteMcpReadSidePackageForStoredProposal(ctx, proposal);
  } catch (error) {
    logBestEffortFailure("delete-package", error);
    return false;
  }
}

async function buildAndPersistApplicationContext(
  ctx: MaterializationCtx,
  input: Readonly<{
    ownerId: string;
    job: LooseRecord;
    profile: LooseRecord;
    proposal: StoredProposalForMcpReadSideMaterialization;
    now: number;
  }>,
): Promise<Readonly<{ contextId: string; reused: boolean }>> {
  const metadata = readRecord(input.proposal.metadata);
  const result = await buildApplicationContextV1FromExistingData({
    userId: input.ownerId,
    job: {
      _id: readString(input.job._id) ?? readString(input.proposal.jobId),
      rawDescription: readString(input.job.rawDescription) ?? "",
      mustHaves: input.job.mustHaves,
      responsibilities: input.job.responsibilities,
      keywords: input.job.keywords,
    },
    candidateProfile: {
      ...input.profile,
      _id: input.ownerId,
    },
    settings: {
      ...(readString(metadata?.resolvedLanguage) ?? readString(metadata?.requestedLanguage)
        ? {
            selectedLanguage:
              readString(metadata?.resolvedLanguage) ?? readString(metadata?.requestedLanguage),
          }
        : {}),
      ...(readString(metadata?.platform) ? { market: readString(metadata?.platform) } : {}),
    },
    now: input.now,
  });
  const contextForWrite = result.context;

  const existingById = await ctx.db
    .query("applicationContexts")
    .withIndex("by_user_id", (q: any) =>
      q.eq("userId", contextForWrite.userId).eq("id", contextForWrite.id),
    )
    .unique?.();
  if (existingById) {
    if (existingById.contextHash !== contextForWrite.contextHash) {
      throw new Error("MCP read-side materialization context stable id collision");
    }
    return { contextId: contextForWrite.id, reused: true };
  }

  const existingByHash = await ctx.db
    .query("applicationContexts")
    .withIndex("by_user_context_hash", (q: any) =>
      q.eq("userId", contextForWrite.userId).eq("contextHash", contextForWrite.contextHash),
    )
    .unique?.();
  if (existingByHash) {
    if (existingByHash.id !== contextForWrite.id) {
      throw new Error("MCP read-side materialization context hash collision");
    }
    return { contextId: contextForWrite.id, reused: true };
  }

  await ctx.db.insert("applicationContexts", contextForWrite);
  return { contextId: contextForWrite.id, reused: false };
}

async function buildSafeApplicationPackage(
  input: Readonly<{
    ownerId: string;
    applicationContextId: string;
    proposal: StoredProposalForMcpReadSideMaterialization;
    now: number;
  }>,
): Promise<ApplicationPackageV1> {
  const proposalId = readString(input.proposal._id) ?? "unknown-proposal";
  const proposalContentHash = await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "proposal-content-hash",
    version: 1,
    content: readExactString(input.proposal.content) ?? "",
    sections: readSafeSectionFingerprintInput(input.proposal.sections),
  });
  const applicationPackageId = await buildStableApplicationPackageId(input.proposal);
  const packageHash = applicationPackageId
    ? applicationPackageId.slice("application-package:".length)
    : await buildStableHash({
        namespace: HASH_NAMESPACE,
        type: "application-package-id",
        version: 1,
        userId: input.ownerId,
        proposalId,
      });
  const resumeVariantArtifactId = `resume-variant-artifact:${await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "resume-variant-artifact-ref",
    version: 1,
    packageHash,
  })}`;
  const coverLetterArtifactId = `cover-letter-artifact:${await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "cover-letter-artifact-ref",
    version: 1,
    packageHash,
  })}`;
  const resumeVariantContentHash = await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "resume-variant-artifact-content",
    version: 1,
    packageHash,
    proposalContentHash,
  });
  const coverLetterContentHash = await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "cover-letter-artifact-content",
    version: 1,
    packageHash,
    proposalContentHash,
  });
  const timestamp = input.now;

  return {
    id: applicationPackageId ?? `application-package:${packageHash}`,
    userId: input.ownerId,
    applicationContextId: input.applicationContextId,
    status: "needs_review",
    artifacts: [
      {
        id: resumeVariantArtifactId,
        kind: "resume_variant_artifact",
        contentHash: resumeVariantContentHash,
        status: "draft",
        version: 1,
      },
      {
        id: coverLetterArtifactId,
        kind: "cover_letter_artifact",
        contentHash: coverLetterContentHash,
        status: "needs_review",
        version: 1,
      },
    ],
    items: [
      {
        id: `application-package-item:${packageHash}:resume-variant-artifact`,
        kind: "resume_variant",
        artifactId: resumeVariantArtifactId,
        artifactContentHash: resumeVariantContentHash,
        status: "needs_review",
        label: "Resume variant requires review.",
        note: "Read-side package references a draft resume variant artifact without duplicating resume text.",
        sourceFactIds: [],
        allowedClaimIds: [],
        evidenceMatchIds: [],
        demandIds: [],
        riskFlagIds: [],
        reviewItemIds: [],
        version: 1,
      },
      {
        id: `application-package-item:${packageHash}:cover-letter-artifact`,
        kind: "cover_letter",
        artifactId: coverLetterArtifactId,
        artifactContentHash: coverLetterContentHash,
        status: "needs_review",
        label: "Cover letter requires review.",
        note: "Read-side package references a saved proposal artifact without duplicating proposal text.",
        sourceFactIds: [],
        allowedClaimIds: [],
        evidenceMatchIds: [],
        demandIds: [],
        riskFlagIds: [],
        reviewItemIds: [],
        version: 1,
      },
      {
        id: `application-package-item:${packageHash}:warning:application-package-requires-review`,
        kind: "warning",
        status: "notice",
        label: "Application package requires review.",
        note: "Manual handoff readiness remains blocked until a reviewed package exists.",
        sourceFactIds: [],
        allowedClaimIds: [],
        evidenceMatchIds: [],
        demandIds: [],
        riskFlagIds: [],
        reviewItemIds: [],
        version: 1,
      },
    ],
    warnings: [
      "resume_variant_artifact_draft",
      "cover_letter_artifact_needs_review",
      "application_package_requires_review_before_handoff",
    ],
    provenance: {
      applicationContextId: input.applicationContextId,
      resumeVariantArtifactId,
      coverLetterArtifactId,
      sourceFactIds: [],
      allowedClaimIds: [],
      evidenceMatchIds: [],
      demandIds: [],
      riskFlagIds: [],
      reviewItemIds: [],
      version: 1,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

async function createOrReuseApplicationPackage(
  ctx: MaterializationCtx,
  applicationPackage: ApplicationPackageV1,
): Promise<boolean> {
  const existing = await ctx.db
    .query("applicationPackages")
    .withIndex("by_application_package_id", (q: any) =>
      q.eq("applicationPackageId", applicationPackage.id),
    )
    .unique?.();
  if (existing) {
    const previousApplicationContextId = readString(existing.applicationContextId);
    const next = await buildApplicationPackageStorageRecord({
      ...applicationPackage,
      createdAt: readFiniteTimestamp(existing.createdAt) ?? applicationPackage.createdAt,
    });
    if (
      existing.contentHash !== next.contentHash ||
      existing.updatedAt !== next.updatedAt ||
      existing.applicationContextId !== next.applicationContextId
    ) {
      await ctx.db.patch(existing._id, next);
    }
    if (
      previousApplicationContextId &&
      previousApplicationContextId !== next.applicationContextId
    ) {
      await deleteApplicationContextIfUnreferenced(ctx, {
        applicationContextId: previousApplicationContextId,
        userId: next.userId,
      });
    }
    return true;
  }

  const next = await buildApplicationPackageStorageRecord(applicationPackage);
  await ctx.db.insert("applicationPackages", next);
  return false;
}

async function deleteApplicationContextIfUnreferenced(
  ctx: MaterializationCtx,
  input: Readonly<{
    applicationContextId: string;
    userId: string;
  }>,
): Promise<boolean> {
  const [referencingPackage, referencingRun, referencingArtifact] = await Promise.all([
    queryFirstByIndex(ctx, "applicationPackages", "by_application_context_id", (q: any) =>
      q.eq("applicationContextId", input.applicationContextId),
    ),
    queryFirstByIndex(ctx, "applicationRuns", "by_context", (q: any) =>
      q.eq("contextId", input.applicationContextId),
    ),
    queryFirstByIndex(ctx, "applicationArtifacts", "by_context", (q: any) =>
      q.eq("contextId", input.applicationContextId),
    ),
  ]);
  if (referencingPackage || referencingRun || referencingArtifact) {
    return false;
  }

  const context = await queryFirstByIndex(ctx, "applicationContexts", "by_user_id", (q: any) =>
    q.eq("userId", input.userId).eq("id", input.applicationContextId),
  );
  if (!context) {
    return false;
  }

  await ctx.db.delete(context._id);
  return true;
}

async function queryFirstByIndex(
  ctx: MaterializationCtx,
  tableName: string,
  indexName: string,
  buildQuery: (query: any) => unknown,
): Promise<LooseRecord | null> {
  const query = ctx.db.query(tableName).withIndex(indexName, buildQuery);
  if (typeof query.take === "function") {
    const rows = await query.take(1);
    return rows[0] ?? null;
  }
  if (typeof query.unique === "function") {
    return await query.unique();
  }

  return null;
}

function resolveJobStorageId(
  ctx: MaterializationCtx,
  proposal: StoredProposalForMcpReadSideMaterialization,
): unknown {
  const metadata = readRecord(proposal.metadata);
  const rawJobId = readString(proposal.jobId) ?? readString(metadata?.jobId);
  if (!rawJobId) {
    return null;
  }

  if (!ctx.db.normalizeId) {
    return rawJobId;
  }

  try {
    return ctx.db.normalizeId("jobs", rawJobId) ?? null;
  } catch {
    return null;
  }
}

async function buildStableApplicationPackageId(
  proposal: StoredProposalForMcpReadSideMaterialization,
): Promise<string | null> {
  const ownerId = readString(proposal.userId);
  const proposalId = readString(proposal._id);
  if (!ownerId || !proposalId) {
    return null;
  }

  const packageHash = await buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "application-package-id",
    version: 2,
    userId: ownerId,
    proposalId,
  });

  return `application-package:${packageHash}`;
}

function readSafeSectionFingerprintInput(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((section) => {
    const record = readRecord(section);
    return {
      type: readString(record?.type) ?? "unknown",
      content: readExactString(record?.content) ?? "",
    };
  });
}

function readExactString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function logBestEffortFailure(operation: "materialize" | "delete-package", error: unknown): void {
  console.warn("MCP read-side best-effort operation failed", {
    operation,
    errorName:
      error && typeof error === "object" && "name" in error
        ? readString((error as { name?: unknown }).name)
        : undefined,
    version: 1,
  });
}

function skipped(reason: MaterializationSkipReason): McpReadSideMaterializationResult {
  return { status: "skipped", reason, version: 1 };
}

function readRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return compact || undefined;
}

function readFiniteTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
