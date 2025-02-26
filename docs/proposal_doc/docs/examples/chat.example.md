import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const sendMessage = mutation({
  args: {
    user: v.string(),
    body: v.string(),
  },
  handler: async (ctx: MutationCtx, args: { user: string; body: string }) => {
    console.log("This TypeScript function is running on the server.");
    await ctx.db.insert("messages", {
      user: args.user,
      body: args.body,
    });
  },
});

export const getMessages = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const messages = await ctx.db
      .query("messages")
      .order("desc")
      .take(50)
      .collect();
    return messages.reverse();
  },
});
