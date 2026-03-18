"use node";

/* my-app/convex/actions/nerSmokeTest.ts
 * Simple smoke test action to call the spaCy NER service via nerClient.
 * It logs the entities and returns them for quick verification.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requestNER, isNEREnabled } from "../lib/parsing_shared/nerClient";

const SAMPLE = `John Doe\nSenior Software Engineer\nAcme Corp — San Francisco, CA\nJan 2020 - Jun 2023\nEmail: john.doe@example.com | Phone: (415) 555-1234\n`;

export const nerSmokeTest = action({
  args: { text: v.optional(v.string()) },
  returns: v.any(),
  handler: async (_ctx, { text }) => {
    const input = (text ?? SAMPLE).toString();

    if (!isNEREnabled()) {
      console.log("[nerSmokeTest] NER disabled or service URL not configured.");
      return { enabled: false, url: null, entities: [], layoutBlocks: [] };
    }

    const res = await requestNER(input, { layout: true, timeoutMs: 3000, retry: 1 });
    const entities = res?.entities ?? [];
    const blocks = res?.layout?.blocks ?? [];

    console.log("[nerSmokeTest] input length:", input.length);
    console.log("[nerSmokeTest] entities:", entities);
    console.log("[nerSmokeTest] layout blocks:", blocks.length);

    return {
      enabled: true,
      entitiesCount: entities.length,
      layoutBlocksCount: blocks.length,
      entities,
      sample: input.slice(0, 240),
    };
  },
});

