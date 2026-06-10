import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

import {
  applicationPackagePayloadValidator,
  applicationPackageStoredValidator,
  assertSameApplicationPackagePayload,
  buildApplicationPackageStorageRecord,
  getApplicationPackageHashFromId,
} from "./lib/applicationPackages";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function resolveListLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.max(1, Math.min(Math.floor(limit), MAX_LIST_LIMIT));
}

function sortLatestApplicationPackages<
  T extends { applicationPackageId: string; createdAt: number; updatedAt: number },
>(records: readonly T[]): T[] {
  return [...records].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
    return left.applicationPackageId.localeCompare(right.applicationPackageId);
  });
}

export const internalCreateOrReuseApplicationPackage = internalMutation({
  args: {
    applicationPackage: applicationPackagePayloadValidator,
  },
  returns: v.id("applicationPackages"),
  handler: async (ctx, args) => {
    const next = await buildApplicationPackageStorageRecord(args.applicationPackage);

    const existing = await ctx.db
      .query("applicationPackages")
      .withIndex("by_application_package_id", (q) =>
        q.eq("applicationPackageId", next.applicationPackageId),
      )
      .unique();

    if (existing) {
      assertSameApplicationPackagePayload(existing, next);
      return existing._id;
    }

    return await ctx.db.insert("applicationPackages", next);
  },
});

export const internalReadApplicationPackageById = internalQuery({
  args: {
    applicationPackageId: v.string(),
  },
  returns: v.union(v.null(), applicationPackageStoredValidator),
  handler: async (ctx, args) => {
    getApplicationPackageHashFromId(args.applicationPackageId);

    return await ctx.db
      .query("applicationPackages")
      .withIndex("by_application_package_id", (q) =>
        q.eq("applicationPackageId", args.applicationPackageId),
      )
      .unique();
  },
});

export const internalListApplicationPackagesByApplicationContext = internalQuery({
  args: {
    applicationContextId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationPackageStoredValidator),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("applicationPackages")
      .withIndex("by_application_context_id", (q) =>
        q.eq("applicationContextId", args.applicationContextId),
      )
      .take(resolveListLimit(args.limit));

    return sortLatestApplicationPackages(records);
  },
});

export const internalListApplicationPackagesByUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationPackageStoredValidator),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("applicationPackages")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .take(resolveListLimit(args.limit));

    return sortLatestApplicationPackages(records);
  },
});

export const internalListApplicationPackagesByUserAndApplicationContext = internalQuery({
  args: {
    userId: v.string(),
    applicationContextId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationPackageStoredValidator),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("applicationPackages")
      .withIndex("by_user_and_application_context", (q) =>
        q.eq("userId", args.userId).eq("applicationContextId", args.applicationContextId),
      )
      .take(resolveListLimit(args.limit));

    return sortLatestApplicationPackages(records);
  },
});

export const internalListLatestApplicationPackagesByApplicationContext = internalQuery({
  args: {
    applicationContextId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(applicationPackageStoredValidator),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("applicationPackages")
      .withIndex("by_application_context_id", (q) =>
        q.eq("applicationContextId", args.applicationContextId),
      )
      .take(resolveListLimit(args.limit));

    return sortLatestApplicationPackages(records);
  },
});
