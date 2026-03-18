'use node';

import { action } from "../_generated/server";

export const getUploadUrl = action(async ({ storage }) => {
  const url = await storage.generateUploadUrl();
  return { url };
});

