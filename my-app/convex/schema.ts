import { defineSchema, defineTable } from "convex/server";
import baseSchema from "./_applicationHarnessBaseSchema";
import {
  applicationHarnessArtifactFields,
  applicationHarnessContextFields,
  applicationHarnessRunFields,
} from "./lib/applicationHarness";

type BaseSchemaDefinition = Readonly<{
  tables: Record<string, ReturnType<typeof defineTable>>;
}>;

const baseSchemaDefinition = baseSchema as unknown as BaseSchemaDefinition;

export default defineSchema({
  ...baseSchemaDefinition.tables,

  applicationContexts: defineTable(applicationHarnessContextFields)
    .index("by_context_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_user_id", ["userId", "id"])
    .index("by_context_hash", ["contextHash"])
    .index("by_user_context_hash", ["userId", "contextHash"])
    .index("by_job", ["job.jobId"])
    .index("by_user_job", ["userId", "job.jobId"])
    .index("by_updated", ["updatedAt"]),

  applicationRuns: defineTable(applicationHarnessRunFields)
    .index("by_run_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_user_id", ["userId", "id"])
    .index("by_context", ["contextId"])
    .index("by_user_context", ["userId", "contextId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_user_idempotency_key", ["userId", "idempotencyKey"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_operation", ["userId", "operation"])
    .index("by_updated", ["updatedAt"]),

  applicationArtifacts: defineTable(applicationHarnessArtifactFields)
    .index("by_artifact_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_user_id", ["userId", "id"])
    .index("by_context", ["contextId"])
    .index("by_user_context", ["userId", "contextId"])
    .index("by_run", ["runId"])
    .index("by_user_run", ["userId", "runId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_type", ["type"])
    .index("by_user_type", ["userId", "type"])
    .index("by_context_status", ["contextId", "status"])
    .index("by_updated", ["updatedAt"]),
});
