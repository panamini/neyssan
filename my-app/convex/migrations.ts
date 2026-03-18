
import { internal } from "./_generated/api";
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

// Your existing migration to update metrics labels
export const updateMetricsLabels = migrations.define({
  table: "metrics",
  migrateOne: async (_ctx, doc) => {
    if (!doc.labels) {
      return { labels: {} };
    }
    return {};
  },
});

// The new migration to rename rawText to raw_text
// The library's runner will handle iterating through all documents
export const renameRawText = migrations.define({
  table: "userProfiles",
  migrateOne: async (_ctx, doc) => {
    // Check if the document has the old 'rawText' field.
    // The 'in' operator is safe for checking unknown fields.
    if ("rawText" in doc && doc.rawText !== null && doc.rawText !== undefined) {
      // The `as string` cast is needed because the `doc` type doesn't know about `rawText`.
      const rawTextValue = doc.rawText as string;
      return {
        raw_text: rawTextValue,
        rawText: undefined, // This effectively deletes the field
      };
    }
    return {}; // Return an empty patch if no change is needed
  },
});

/**
 * Migration: Normalize llmJobs documents
 *
 * Purpose:
 * - Ensure historical / pre-existing documents in the `llmJobs` table have
 *   required fields with safe defaults so downstream workers can rely on them.
 * - Migrations should be idempotent: only touch documents that are missing fields.
 */
export const normalizeLlmJobs = migrations.define({
  table: "llmJobs",
  migrateOne: async (_ctx, doc) => {
    const patch: Record<string, unknown> = {};

    // Ensure timestamps exist
    if (!("createdAt" in doc) || doc.createdAt === undefined || doc.createdAt === null) {
      patch.createdAt = Date.now();
    }
    if (!("updatedAt" in doc) || doc.updatedAt === undefined || doc.updatedAt === null) {
      patch.updatedAt = patch.createdAt ?? Date.now();
    }

    // Ensure status has a sane default
    if (!("status" in doc) || doc.status === undefined || doc.status === null) {
      patch.status = "pending";
    }

    // Migrate legacy rawText -> raw_text if present
    if (!("raw_text" in doc) && "rawText" in doc && doc.rawText !== undefined) {
      patch.raw_text = (doc as any).rawText;
      patch.rawText = undefined;
    }

    // Ensure requestedBy shape exists (best-effort)
    if (!("requestedBy" in doc)) {
      patch.requestedBy = null;
    }

    // If no changes required, return empty patch
    if (Object.keys(patch).length === 0) return {};
    return patch;
  },
});

/**
 * Migration: Normalize llmHistory documents
 *
 * Purpose:
 * - Ensure historical / pre-existing documents in `llmHistory` have required
 *   fields and default values so analytics/merging code can operate safely.
 */
export const normalizeLlmHistory = migrations.define({
  table: "llmHistory",
  migrateOne: async (_ctx, doc) => {
    const patch: Record<string, unknown> = {};
 
    // Ensure createdAt timestamp exists
    if (!("createdAt" in doc) || doc.createdAt === undefined || doc.createdAt === null) {
      patch.createdAt = Date.now();
    }
 
    // Ensure merged flag exists
    if (!("merged" in doc) || doc.merged === undefined || doc.merged === null) {
      patch.merged = false;
    }
 
    // Ensure confidence exists (nullable numeric)
    if (!("confidence" in doc)) {
      patch.confidence = null;
    }
 
    // Ensure provider field exists (best-effort)
    if (!("provider" in doc)) {
      patch.provider = null;
    }
 
    // Ensure full_response exists (nullable)
    if (!("full_response" in doc)) {
      patch.full_response = null;
    }
 
    // New telemetry fields: set sensible defaults if missing so analytics code can rely on them.
    if (!("provider_used" in doc)) {
      patch.provider_used = null;
    }
    if (!("sanitized_for_repair" in doc)) {
      patch.sanitized_for_repair = false;
    }
    if (!("repair_returned_provider_shape" in doc)) {
      patch.repair_returned_provider_shape = false;
    }
 
    if (Object.keys(patch).length === 0) return {};
    return patch;
  },
});
//To see the status of all migrations, you can use the status command:
//npx convex run --component migrations lib:getStatus --watch

//npx convex run migrations:runAll
export const runAll = migrations.runner([
  internal.migrations.updateMetricsLabels,
  internal.migrations.renameRawText,
  internal.migrations.normalizeLlmJobs,
  internal.migrations.normalizeLlmHistory,
]);
// The runner will execute all migrations registered.
export const run = migrations.runner();
