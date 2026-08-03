export async function resolveOwnedProposalJobId(
  ctx: {
    db: {
      normalizeId: (table: "jobs", id: string) => string | null;
      get: (id: unknown) => Promise<{
        userId?: unknown;
        clerkId?: unknown;
      } | null>;
    };
  },
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
    typeof proposalUserId === "string" ? proposalUserId : "";
  const jobProfileId = typeof job.userId === "string" ? job.userId : "";
  if (proposalProfileId && jobProfileId === proposalProfileId) {
    const ownerProfile = await ctx.db.get(jobProfileId);
    if (!ownerProfile) {
      throw new Error("Job not found");
    }
    return normalizedJobId;
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
