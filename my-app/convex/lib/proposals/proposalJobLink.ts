import type { MutationCtx } from "../../_generated/server";

export async function resolveOwnedProposalJobId(
  ctx: Pick<MutationCtx, "db">,
  proposalUserId: unknown,
  jobId: string | undefined,
): Promise<string | undefined> {
  if (jobId === undefined) {
    return undefined;
  }

  const normalizedJobId = ctx.db.normalizeId("jobs", jobId);
  if (!normalizedJobId) {
    throw new Error("Invalid jobId");
  }

  const job = await ctx.db.get(normalizedJobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const proposalProfileId =
    typeof proposalUserId === "string"
      ? ctx.db.normalizeId("userProfiles", proposalUserId)
      : null;
  const jobProfileId = job.userId;
  if (proposalProfileId && jobProfileId === proposalProfileId) {
    const ownerProfile = await ctx.db.get(jobProfileId);
    if (!ownerProfile) {
      throw new Error("Job not found");
    }
    return normalizedJobId;
  }

  if (!proposalProfileId) {
    throw new Error("Job not found");
  }

  const [proposalOwner, jobOwner] = await Promise.all([
    ctx.db.get(proposalProfileId),
    ctx.db.get(jobProfileId),
  ]);
  const proposalClerkId =
    typeof proposalOwner?.clerkId === "string"
      ? proposalOwner.clerkId.trim()
      : "";
  const jobClerkId =
    typeof jobOwner?.clerkId === "string" ? jobOwner.clerkId.trim() : "";
  if (!proposalClerkId || proposalClerkId !== jobClerkId) {
    throw new Error("Job not found");
  }

  return normalizedJobId;
}
