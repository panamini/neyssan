'use node';

import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { RegisteredAction } from "convex/server";

export const getUploadUrl: RegisteredAction<
  "public",
  Record<string, never>,
  Promise<{ url: string }>
> = action({
  handler: async ({ storage }: ActionCtx): Promise<{ url: string }> => {
    const url = await storage.generateUploadUrl();
    return { url };
  },
});
