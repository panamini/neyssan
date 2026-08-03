export async function resolveOwnedProposalJobId(
  ctx: {
    db: {
      normalizeId: (table: "jobs", id: string) => unknown;
      get: (id: unknown) => Promise<{ userId?: unknown } | null>;
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
  if (!job || String(job.userId) !== String(proposalUserId)) {
    throw new Error("Job not found");
  }

  return String(normalizedJobId);
}
