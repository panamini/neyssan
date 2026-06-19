import { v } from "convex/values";

export const liveExternalActionIntegrationIdValidator = v.string();

export const liveExternalActionCategoryValidator = v.literal("apply_to_job");

export const liveExternalActionStateValidator = v.union(
  v.literal("reserved"),
  v.literal("dispatching"),
  v.literal("submitted"),
  v.literal("duplicate_accepted"),
  v.literal("rejected"),
  v.literal("submission_status_unknown"),
);

export const liveExternalActionFinalStateValidator = v.union(
  v.literal("submitted"),
  v.literal("duplicate_accepted"),
  v.literal("rejected"),
  v.literal("submission_status_unknown"),
);

export const liveExternalActionExecutionFields = {
  idempotencyKeyHash: v.string(),
  payloadFingerprint: v.string(),
  integrationId: liveExternalActionIntegrationIdValidator,
  actionCategory: liveExternalActionCategoryValidator,
  safeJobRef: v.string(),
  state: liveExternalActionStateValidator,
  safeProviderReceiptRef: v.optional(v.string()),
  safeFailureCode: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.literal(1),
};

export const liveExternalActionExecutionValidator = v.object(
  liveExternalActionExecutionFields,
);

export const liveExternalActionStoredExecutionValidator = v.object({
  _id: v.id("liveExternalActionExecutions"),
  _creationTime: v.number(),
  ...liveExternalActionExecutionFields,
});
