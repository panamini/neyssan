import { action } from "./_generated/server";
import { v } from "convex/values";
import { ChatMistralAI } from "@langchain/mistralai";
import { internal } from "./_generated/api"; // Use internal instead of api
import type { UserProfile } from "./users";

const modelChoice = v.union(
  v.literal("chatgpt"),
  v.literal("mistral-large-latest"),
  v.literal("mistral-small-latest"),
  v.literal("mistral-agent")
);

export default action({
  args: {
    jobTitle: v.string(),
    jobDescription: v.string(),
    proposalType: v.union(v.literal("technical"), v.literal("creative")),
    formalityLevel: v.string(),
    creativity: v.string(),
    modelType: v.optional(modelChoice),
  },
  handler: async (ctx, args): Promise<{ proposalId: string; proposalContent: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    console.log("Identity in action:", identity);
    if (!identity) throw new Error("User not authenticated");

    let userProfile: UserProfile | null = await ctx.runQuery(internal.profiles.get);
    if (!userProfile) {
      console.warn("User profile not found. Creating a new profile.");
      await ctx.runMutation(internal.profiles.upsert, {
        preferences: {
          writingStyle: "professional",
          tonePreference: "formal",
          autoSend: false,
        },
      });
      userProfile = await ctx.runQuery(internal.profiles.get);
      if (!userProfile) throw new Error("Failed to create user profile");
    }

    const prompt = `Write a ${args.proposalType} proposal for "${args.jobTitle}". Job description: ${args.jobDescription}. Tone: ${args.formalityLevel}. Creativity level: ${args.creativity}.`;
    const modelType = args.modelType || "mistral-small-latest";
    let proposalContent: string;

    if (modelType.startsWith("mistral")) {
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (!mistralKey) throw new Error("Mistral API key not configured");
      const model = new ChatMistralAI({ apiKey: mistralKey, modelName: modelType });
      try {
        const response = await model.invoke([{ role: "user", content: prompt }]);
        proposalContent = typeof response.content === "string" ? response.content : "";
      } catch (e) {
        console.error("Mistral API error:", e);
        throw new Error("Failed to generate proposal—please try again.");
      }
    } else {
      throw new Error("Only Mistral supported in this example");
    }

    const proposalId: string = await ctx.runMutation(internal.proposals.storeProposal, {
      userId: userProfile._id,
      title: args.jobTitle,
      content: proposalContent,
      status: "pending",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sections: [{ type: "text", content: proposalContent }],
      metrics: {},
      metadata: { platform: "web", jobId: "N/A", tags: [`model:${modelType}`] },
    });

    return { proposalId, proposalContent };
  },
});