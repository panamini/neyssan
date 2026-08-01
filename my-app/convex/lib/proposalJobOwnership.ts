export async function requireOwnedProposalJobId(
  ctx: any,
  clerkId: string,
  rawJobId: string,
): Promise<string> {
  const candidate = String(rawJobId ?? "").trim();
  if (!candidate) {
    throw new Error("Job not found");
  }

  const normalizedJobId = ctx.db.normalizeId("jobs", candidate);
  if (!normalizedJobId) {
    throw new Error("Job not found");
  }

  const job = await ctx.db.get(normalizedJobId);
  const linkedProfile = job?.userId ? await ctx.db.get(job.userId) : null;
  if (!job || !linkedProfile || linkedProfile.clerkId !== clerkId) {
    throw new Error("Job not found");
  }

  return String(normalizedJobId);
}

export async function requireOwnedStoredProposalJobId(
  ctx: any,
  clerkId: string,
  proposal: { jobId?: unknown },
): Promise<string | null> {
  const storedJobId =
    typeof proposal.jobId === "string" ? proposal.jobId.trim() : "";
  if (!storedJobId) return null;
  const normalizedJobId = ctx.db.normalizeId("jobs", storedJobId);
  if (!normalizedJobId) return null;
  const job = await ctx.db.get(normalizedJobId);
  if (!job) return null;
  const linkedProfile = job.userId ? await ctx.db.get(job.userId) : null;
  if (!linkedProfile || linkedProfile.clerkId !== clerkId) {
    throw new Error("Job not found");
  }
  return String(normalizedJobId);
}
