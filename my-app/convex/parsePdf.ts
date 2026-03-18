"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { parsePdfBuffer } from "./utils/cv_parser";

/**
 * Node-runtime internal action that parses a base64 PDF and returns a normalized profile.
 * This runs in the Node runtime so it can safely use pdf-parse and other Node-only libs.
 */

export const parsePdf = internalAction({
  args: {
    pdfBase64: v.string(),
    filename: v.optional(v.string()),
  },
  returns: v.object({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience: v.optional(
      v.array(
        v.object({
          company: v.optional(v.string()),
          title: v.optional(v.string()),
          startDate: v.optional(v.union(v.string(), v.number(), v.null())),
          endDate: v.optional(v.union(v.string(), v.number(), v.null())),
          description: v.optional(v.string()),
        })
      )
    ),
    rawText: v.optional(v.string()),
    confidence: v.number(),
  }),
  handler: async (_ctx, args) => {
    const buffer = Buffer.from(args.pdfBase64, "base64");
    const parsed = await parsePdfBuffer(buffer);

    // Normalize nulls to undefined to satisfy Convex validators (no `null` allowed)
    const normalized = {
      name: parsed.name ?? undefined,
      email: parsed.email ?? undefined,
      summary: parsed.summary ?? undefined,
      skills: parsed.skills ?? undefined,
      experience: parsed.experience ?? undefined,
      rawText: parsed.rawText ?? undefined,
      confidence: parsed.confidence ?? 0,
    };

    return normalized;
  },
});
