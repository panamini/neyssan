import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off migration to populate missing display name on userProfiles.
 *
 * Strategy:
 * - For each document in userProfiles:
 *   - If `name` is missing/empty, attempt to find a matching users row (by clerkId)
 *     and use users.name if present.
 *   - Otherwise fall back to the profile email.
 *
 * Usage (dev):
 * 1. Start Convex local dev: `cd my-app && npx convex dev`
 * 2. In another terminal run:
 *    `cd my-app && npx convex run migrations.populateDisplayName`
 *
 * Usage (Convex Cloud):
 * - Use `npx convex run --deployment <deployment> migrations.populateDisplayName`
 *
 * NOTE: This is intended as a one-off migration. After verifying results you may
 * remove this file or keep it for audit (it is idempotent).
 */

export default mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Collect all userProfiles
    for await (const profile of ctx.db.query("userProfiles")) {
      try {
        // If name already present, skip
        if (profile.name && String(profile.name).trim().length > 0) {
          continue;
        }

        // Try to find a matching users entry by clerkId
        let displayName: string | null = null;

        try {
          const usersQuery = ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("clerkId"), profile.clerkId))
            .take(1);

          const users = await usersQuery;
          if (users && users.length > 0) {
            const u = users[0];
            if (u && u.name && String(u.name).trim().length > 0) {
              displayName = String(u.name).trim();
            }
          }
        } catch (err) {
          // ignore and fallback to email
        }

        // Fallback to email if no users.name found
        if (!displayName && profile.email) {
          displayName = String(profile.email).trim();
        }

        if (displayName) {
          await ctx.db.patch(profile._id, { name: displayName });
        }
      } catch (err) {
        // Log and continue with next profile
        console.error("Migration error for profile", profile._id, err);
      }
    }

    return null;
  },
});
