import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Example protected query
export const getProtectedData: any = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }
    // Your protected query logic here
    return { message: "This is protected data" };
  },
});

// Example protected mutation
export const updateProtectedData = mutation({
  args: { data: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }
    // Your protected mutation logic here
    return { message: "Data updated successfully", data: args.data };
  },
});
