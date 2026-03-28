import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

const proposalFormalityLevelChoice = v.union(
  v.literal("informal"),
  v.literal("neutral"),
  v.literal("formal"),
);

const proposalCreativityChoice = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

const proposalTemplateChoice = v.union(
  ...PROPOSAL_TEMPLATE_IDS.map((templateId) => v.literal(templateId)),
);

const proposalVerbatiStyleChoice = v.object({
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

export const storeProposal = internalMutation({
  args: {
    userId: v.id("userProfiles"),
    title: v.string(),
    content: v.string(),
    status: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      sourceJobDescription: v.optional(v.string()),
      planned_path: v.optional(v.string()),
      executed_path: v.optional(v.string()),
      fallback_reason: v.optional(v.string()),
      validator_outcome: v.optional(v.string()),
      save_outcome: v.optional(v.string()),
      requestedModelType: v.optional(v.string()),
      actualModelType: v.optional(v.string()),
      fallbackTriggerCode: v.optional(v.string()),
      voicePreset: v.optional(proposalVoicePresetChoice),
      formalityLevel: v.optional(proposalFormalityLevelChoice),
      creativity: v.optional(proposalCreativityChoice),
      templateId: v.optional(proposalTemplateChoice),
      verbatiStyle: v.optional(proposalVerbatiStyleChoice),
      proposalType: v.optional(
        v.union(
          v.literal("cover_letter"),
          v.literal("application_message"),
          v.literal("freelance_proposal"),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("proposals", args);
  },
});

export const getProposal = internalQuery({
  args: {
    id: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const listUserProposals = internalQuery({
  args: {
    userId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const updateProposal = internalMutation({
  args: {
    id: v.id("proposals"),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      sourceJobDescription: v.optional(v.string()),
      planned_path: v.optional(v.string()),
      executed_path: v.optional(v.string()),
      fallback_reason: v.optional(v.string()),
      validator_outcome: v.optional(v.string()),
      save_outcome: v.optional(v.string()),
      requestedModelType: v.optional(v.string()),
      actualModelType: v.optional(v.string()),
      fallbackTriggerCode: v.optional(v.string()),
      voicePreset: v.optional(proposalVoicePresetChoice),
      formalityLevel: v.optional(proposalFormalityLevelChoice),
      creativity: v.optional(proposalCreativityChoice),
      templateId: v.optional(proposalTemplateChoice),
      verbatiStyle: v.optional(proposalVerbatiStyleChoice),
      proposalType: v.optional(
        v.union(
          v.literal("cover_letter"),
          v.literal("application_message"),
          v.literal("freelance_proposal"),
        ),
      ),
    }),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteProposal = internalMutation({
  args: {
    id: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    return ctx.db.delete(args.id);
  },
});
