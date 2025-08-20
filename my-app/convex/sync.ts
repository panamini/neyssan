import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
// import { createTimestamps, updateTimestamps } from "./types";
import { internal } from "./_generated/api";

// Define the return types for the internal mutations and queries
type _StartSyncResult = SyncRecord;
type _GetForSyncResult = any;

const PG_BATCH_SIZE = 1000;

/**
 * Interface for sync operation state
 */
// @ts-ignore
interface SyncState {
  lastSyncId: string;
  status: "in_progress" | "completed" | "failed";
}

/**
 * Interface for sync record
 */
interface SyncRecord {
  // _id: Id<"syncStatus">;
  _creationTime: number;
  lastSyncId: string;
  lastSyncTime: number;
  status: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get proposals ready for sync
 */
export const getForSync = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lastSync = await ctx.db
      .query("syncStatus")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .order("desc")
      .first();

    const query = ctx.db
      .query("proposals")
      .filter((q) =>
        lastSync
          ? q.gt(q.field("updatedAt"), lastSync.lastSyncTime)
          : q.gt(q.field("updatedAt"), 0)
      )
      .order("asc");

    if (args.limit) {
      return query.take(args.limit);
    }

    return query.collect();
  },
});

/**
 * Start a new sync operation
 */
export const startSync = internalMutation({
  args: {},
  handler: async (ctx): Promise<SyncRecord> => {
    // Check for existing in-progress sync
    const inProgress = await ctx.db
      .query("syncStatus")
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();

    if (inProgress) {
      throw new Error("Sync already in progress");
    }

    const now = Date.now();
    // const timestamps = createTimestamps();
    const lastSyncId = `sync_${now}`;

    // Create new sync record
    // const timestamps = createTimestamps();
    // const lastSyncId = `sync_${now}`;

    // Create new sync record
    await ctx.db.insert("syncStatus", {
      lastSyncId,
      lastSyncTime: now,
      status: "in_progress",
      // ...timestamps,
      // createdAt: now,
      // updatedAt: now,
      createdAt: 0,
      updatedAt: 0,
    });

    return {
      // _id: id,
      _creationTime: now,
      lastSyncId,
      lastSyncTime: now,
      status: "in_progress",
      // ...timestamps,
      createdAt: 0,
      updatedAt: 0,
    };
  },
});

/**
 * Update sync status
 */
export const updateSyncStatus = internalMutation({
  args: {
    syncId: v.string(),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sync = await ctx.db
      .query("syncStatus")
      .filter((q) => q.eq(q.field("lastSyncId"), args.syncId))
      .first();

    if (!sync) {
      throw new Error("Sync not found");
    }

    const patchObject: {
      status: string;
      updatedAt: number;
      error?: string;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.error !== undefined) {
      patchObject.error = args.error;
    }

    return ctx.db.patch(sync._id, patchObject);
  },
});

/**
 * Get sync status
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // TODO: Implement proper admin check
    const isAdmin = false;
    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const lastSync = await ctx.db
      .query("syncStatus")
      .order("desc")
      .first();

    if (!lastSync) {
      return {
        status: "never_run",
        lastSyncTime: null,
        error: null,
      };
    }

    return {
      status: lastSync.status,
      lastSyncTime: lastSync.lastSyncTime,
      error: lastSync.error,
    };
  },
});

/**
 * Run PostgreSQL sync
 * This action should be triggered periodically (e.g., via cron)
 */
export const runSync = action<Record<string, never>, void>({
  handler: async (ctx): Promise<void> => {
    // Initialize sync state
    let syncState: { lastSyncId: string; status: "in_progress" | "completed" | "failed" } | undefined;
    try {
      // Start sync and store the state
      const result = await ctx.runMutation(internal.sync.startSync);
      syncState = {
        lastSyncId: result.lastSyncId,
        status: "in_progress",
      };

      let hasMore = true;
      while (hasMore) {
        // Get batch of proposals
        const proposals = await ctx.runQuery(internal.sync.getForSync, {
          limit: PG_BATCH_SIZE,
        });
        hasMore = proposals.length === PG_BATCH_SIZE;

        if (proposals.length > 0) {
          // TODO: Implement actual PostgreSQL sync
          // For now, we just log the sync operation
          console.log(`Syncing ${proposals.length} proposals to PostgreSQL`);
        }
      }

      // Update sync status to completed
      await ctx.runMutation(internal.sync.updateSyncStatus, {
        syncId: syncState.lastSyncId,
        status: "completed",
      });
    } catch (error) {
      // Update sync status to failed if we have a sync state
      if (syncState) {
        await ctx.runMutation(internal.sync.updateSyncStatus, {
          syncId: syncState.lastSyncId,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      throw error;
    }
  },
});
