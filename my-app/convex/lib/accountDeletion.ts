export async function assertAccountProfileWriteAllowed(
  ctx: any,
  clerkId: unknown,
): Promise<void> {
  const normalizedClerkId =
    typeof clerkId === "string" ? clerkId.trim() : "";
  if (!normalizedClerkId) return;

  const deletionState = await ctx.db
    .query("accountDeletionStates")
    .withIndex("by_clerk_id", (q: any) =>
      q.eq("clerkId", normalizedClerkId),
    )
    .unique();
  if (deletionState) {
    throw new Error("Account deletion prevents profile writes");
  }
}
