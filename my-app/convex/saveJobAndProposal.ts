import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';

const savedProposalType = v.optional(
  v.union(
    v.literal("cover_letter"),
    v.literal("application_message"),
    v.literal("freelance_proposal"),
  ),
);

function buildProposalMetadata(args: {
  platform: string;
  url: string;
  description?: string;
  proposalType?: "cover_letter" | "application_message" | "freelance_proposal";
}) {
  return {
    platform: args.platform,
    jobId: args.url,
    tags: [],
    ...(args.description ? { sourceJobDescription: args.description } : {}),
    ...(args.proposalType ? { proposalType: args.proposalType } : {}),
  };
}

export const saveJobAndProposal = internalMutation({
  args: {
    jobData: v.object({
      platform: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      url: v.string(),
    }),
    proposalText: v.string(),
    proposalType: savedProposalType,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not logged in");

    let user = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      console.warn("User profile not found. Creating a new profile.");
      await ctx.runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });
      user = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
        .unique();
      if (!user) throw new Error("Failed to create user profile");
    }

    return ctx.db.insert("proposals", {
      userId: user._id,
      title: args.jobData.title,
      content: args.proposalText,
      status: "draft",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sections: [{ type: "text", content: args.proposalText }],
      metrics: { score: 0, confidence: 0 },
      metadata: buildProposalMetadata({
        platform: args.jobData.platform,
        url: args.jobData.url,
        description: args.jobData.description,
        proposalType: args.proposalType,
      }),
    });
  },
});

export default mutation({
  args: {
    jobData: v.object({
      platform: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      url: v.string(),
    }),
    proposalText: v.string(),
    proposalType: savedProposalType,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not logged in");

    const user = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    return ctx.db.insert("proposals", {
      userId: user._id,
      title: args.jobData.title,
      content: args.proposalText,
      status: "draft",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sections: [{ type: "text", content: args.proposalText }],
      metrics: { score: 0, confidence: 0 },
      metadata: buildProposalMetadata({
        platform: args.jobData.platform,
        url: args.jobData.url,
        description: args.jobData.description,
        proposalType: args.proposalType,
      }),
    });
  },
});
