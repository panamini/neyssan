/* eslint-disable @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
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
 * 1. Start Convex local dev: `cd my-app && npm run dev`
 * 2. In another terminal run:
 *    `cd my-app && npx convex run populateDisplayName`
 *
 * Usage (Convex Cloud):
 * - Use: `npx convex run --deployment <deployment-name> populateDisplayName`
 *
 * NOTE: This is intended as a one-off migration. After verifying results you may
 * remove this file or keep it for audit (it is idempotent).
 */

export default mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const profile of ctx.db.query("userProfiles")) {
      try {
        if (profile.name && String(profile.name).trim().length > 0) {
          continue;
        }

        let displayName: string | null = null;

        try {
          const users = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("clerkId"), profile.clerkId))
            .take(1);

          if (users && users.length > 0) {
            const u = users[0];
            if (u && u.name && String(u.name).trim().length > 0) {
              displayName = String(u.name).trim();
            }
          }
        } catch (_err) {
          // ignore and fallback to email
        }

        if (!displayName && profile.email) {
          displayName = String(profile.email).trim();
        }

        if (displayName) {
          await ctx.db.patch(profile._id, { name: displayName });
        }
      } catch (err) {
        console.error("Migration error for profile", profile._id, err);
      }
    }

    return null;
  },
});
