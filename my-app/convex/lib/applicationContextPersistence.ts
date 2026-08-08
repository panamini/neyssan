import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { ApplicationContextV1 } from "../../src/modules/application-harness/schema";

export async function persistApplicationContext(
  db: MutationCtx["db"],
  context: ApplicationContextV1,
): Promise<{
  contextStorageId: Id<"applicationContexts">;
  context: ApplicationContextV1;
  reused: boolean;
}> {
  const existingById = await db
    .query("applicationContexts")
    .withIndex("by_user_id", (q) =>
      q.eq("userId", context.userId).eq("id", context.id),
    )
    .unique();
  if (existingById) {
    if (existingById.contextHash !== context.contextHash) {
      throw new Error("ApplicationContext stable id collision");
    }
    return {
      contextStorageId: existingById._id,
      context: projectStoredApplicationContext(existingById),
      reused: true,
    };
  }

  const existingByHash = await db
    .query("applicationContexts")
    .withIndex("by_user_context_hash", (q) =>
      q.eq("userId", context.userId).eq("contextHash", context.contextHash),
    )
    .unique();
  if (existingByHash) {
    if (existingByHash.id !== context.id) {
      throw new Error(
        "ApplicationContext contextHash collision with different stable id",
      );
    }
    return {
      contextStorageId: existingByHash._id,
      context: projectStoredApplicationContext(existingByHash),
      reused: true,
    };
  }

  const contextForWrite = {
    ...context,
    job: { ...context.job },
    candidate: { ...context.candidate },
    sourceRefs: context.sourceRefs.map((sourceRef) => ({ ...sourceRef })),
  };
  const contextStorageId = await db.insert(
    "applicationContexts",
    contextForWrite,
  );
  return {
    contextStorageId,
    context: contextForWrite,
    reused: false,
  };
}

function projectStoredApplicationContext(
  context: Doc<"applicationContexts">,
): ApplicationContextV1 {
  return {
    id: context.id,
    userId: context.userId,
    job: { ...context.job },
    candidate: { ...context.candidate },
    settingsHash: context.settingsHash,
    contextHash: context.contextHash,
    reviewState: context.reviewState,
    sourceRefs: context.sourceRefs.map((sourceRef) => ({ ...sourceRef })),
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    version: context.version,
  };
}
