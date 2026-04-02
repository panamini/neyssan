import type { Id } from "../_generated/dataModel";

export type StoredUserProfile = {
  _id: Id<"userProfiles">;
  _creationTime: number;
  clerkId?: string;
  updatedAt?: number;
  createdAt?: number;
  version?: number;
  [key: string]: any;
};

function sortByRecency(left: StoredUserProfile, right: StoredUserProfile): number {
  const leftTs = left.updatedAt ?? left.createdAt ?? left._creationTime ?? 0;
  const rightTs = right.updatedAt ?? right.createdAt ?? right._creationTime ?? 0;
  return rightTs - leftTs;
}

export async function listProfilesForClerk(
  ctx: any,
  clerkId: string,
): Promise<StoredUserProfile[]> {
  const rows = await ctx.db
    .query("userProfiles")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .collect();

  return (rows as StoredUserProfile[]).sort(sortByRecency);
}

export async function getPrimaryProfileForClerk(
  ctx: any,
  clerkId: string,
): Promise<StoredUserProfile | null> {
  const profiles = await listProfilesForClerk(ctx, clerkId);
  return profiles[0] ?? null;
}
