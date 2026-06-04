'use node';

import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { RegisteredAction } from "convex/server";

export const getUploadUrl: RegisteredAction<
  "public",
  Record<string, never>,
  Promise<{ url: string }>
> = action({
  handler: async ({ auth, storage }: ActionCtx): Promise<{ url: string }> => {
    const identity = await auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const url = await storage.generateUploadUrl();
    return { url };
  },
});
