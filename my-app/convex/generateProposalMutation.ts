// convex/generateProposalMutation.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { ProposalService } from "./langchain";
import { GPT4Adapter } from "./langchain/models/gpt4_adapter";
import { HumanMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";
import { Mistral } from "@mistralai/mistralai";
import { parseProposalContent } from "./langchain/types";

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
    agentId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: {
      jobTitle: string;
      jobDescription: string;
      proposalType: "technical" | "creative";
      formalityLevel: string;
      creativity: string;
      modelType?: "chatgpt" | "mistral-large-latest" | "mistral-small-latest" | "mistral-agent";
      agentId?: string;
    }
  ): Promise<{ proposalId: string; proposalContent: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("User not authenticated");
    }

    let userProfile = await ctx.runQuery(internal.profiles.get);
    if (!userProfile) {
      console.warn("User profile not found. Creating a new profile with default preferences.");
      await ctx.runMutation(internal.profiles.upsert, {
        preferences: {
          writingStyle: "professional",
          tonePreference: "formal",
          autoSend: false,
        },
      });
      userProfile = await ctx.runQuery(internal.profiles.get);
      if (!userProfile) {
        throw new ConvexError("Failed to create or retrieve user profile.");
      }
    }

    const prompt = `Write a ${args.proposalType} proposal for "${args.jobTitle}". Job description: ${args.jobDescription}. Tone: ${args.formalityLevel}. Creativity level: ${args.creativity}.`;
    const modelType = args.modelType || "mistral-small-latest";
    let proposalContent: string;

    let proposalId: string;

    // Development stub: when DEV_STUB env var is set, return a placeholder proposal
    // This allows frontend testing without LLM API keys.
    if (process.env.DEV_STUB === "true") {
      proposalContent = `DEV STUB PROPOSAL for "${args.jobTitle}"\n\nJob description:\n${args.jobDescription}\n\n---\nThis is a development placeholder proposal generated because DEV_STUB=true. Replace with a real LLM response in production.`;
      proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
        userId: userProfile._id,
        title: args.jobTitle,
        content: proposalContent,
        status: "pending",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sections: [{ type: "text", content: proposalContent }],
        metrics: {},
        metadata: {
          platform: "web",
          jobId: "DEV_STUB",
          tags: [`model:dev_stub`],
        },
      });
      return { proposalId, proposalContent };
    }

    try {
      if (modelType === "chatgpt") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new ConvexError("OpenAI API key is not configured");
        }
        
        const proposalService = new ProposalService({ apiKey, modelName: "chatgpt" });
        const gpt4Adapter = new GPT4Adapter({ apiKey });

        if (args.proposalType === "technical") {
          const tokenLimit = 3000;
          let jobDescription = args.jobDescription;
          const estimatedTokens = gpt4Adapter.estimateTokens(jobDescription);
          
          if (estimatedTokens > tokenLimit) {
            jobDescription = jobDescription.slice(
              0,
              Math.floor((jobDescription.length * tokenLimit) / estimatedTokens)
            );
            console.warn(
              `Job description truncated due to token limit. Original tokens: ${estimatedTokens}, New length: ${jobDescription.length}`
            );
          }

          const proposal = await proposalService.generateTechnicalProposal({
            jobTitle: args.jobTitle,
            jobDescription: jobDescription,
            requirements: ["Software Development"],
            expertise: ["Software Development"],
            tone: "technical",
            formalityLevel: args.formalityLevel,
            creativity: args.creativity,
          });
          proposalContent = proposal.content;
        } else {
          const proposal = await proposalService.generateCreativeProposal({
            jobDescription: args.jobDescription,
            creativeDirection: "",
          });
          proposalContent = proposal.content;
        }
      } else if (modelType === "mistral-large-latest" || modelType === "mistral-small-latest") {
        const mistralKey = process.env.MISTRAL_API_KEY;
        if (!mistralKey) {
          throw new ConvexError("Mistral API key is not configured");
        }
        const model = new ChatMistralAI({
          apiKey: mistralKey,
          modelName: modelType,
        });
        const response = await model.invoke([new HumanMessage(prompt)]);
        proposalContent =
          typeof response.content === "string"
            ? response.content
            : Array.isArray(response.content)
            ? response.content
                .map((c: any) => (c.type === "text" ? c.text : ""))
                .join(" ")
            : "";
      } else if (modelType === "mistral-agent") {
        const mistralKey = process.env.MISTRAL_API_KEY;
        if (!mistralKey) {
          throw new ConvexError("Mistral API key is not configured");
        }
        const mistralAgentId = process.env.MISTRAL_AGENT_ID;
        if (!mistralAgentId) {
          throw new ConvexError("Mistral agent ID is not configured");
        }
        const client = new Mistral({ apiKey: mistralKey });
        const agentResponse = await client.agents.complete({
          agentId: mistralAgentId,
          messages: [{ role: "user", content: prompt }],
        });
        if (
          !agentResponse.choices ||
          agentResponse.choices.length === 0 ||
          typeof agentResponse.choices[0].message.content !== "string"
        ) {
          throw new ConvexError("Invalid or empty response from Mistral agent");
        }
        proposalContent = agentResponse.choices[0].message.content;
      } else {
        throw new ConvexError("Invalid model type selected");
      }

      // Attempt a tolerant post-processing step: try to parse plain-text LLM output
      // into the structured Proposal schema. If parsing succeeds, use structured
      // content/sections; otherwise, fall back to raw content.
      try {
        const parsed = await parseProposalContent(proposalContent);
        if (parsed && parsed.content) {
          // Use parsed content and sections when available
          proposalContent = parsed.content;

          // Normalize sections to the expected literal union type for Convex.
          const sectionsForDb: { type: "text" | "code" | "image"; content: string }[] =
            (parsed.sections ?? []).map((s: any) => ({
              // default to "text" for tolerant parsing results
              type: ("text" as const),
              content: String(s.content ?? ""),
            }));

          // Normalize metrics to the small metrics shape used by the DB.
          // We map `duration` -> `score` and `success` -> `confidence` (heuristic).
          const metricsForDb: { score?: number; confidence?: number } = {};
          if (parsed.metrics) {
            if (typeof (parsed.metrics as any).duration === "number") {
              metricsForDb.score = (parsed.metrics as any).duration;
            }
            if (typeof (parsed.metrics as any).success === "boolean") {
              metricsForDb.confidence = (parsed.metrics as any).success ? 1 : 0;
            }
          }

          proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
            userId: userProfile._id,
            title: parsed.title ?? args.jobTitle,
            content: proposalContent,
            status: "pending",
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sections: sectionsForDb.length > 0 ? sectionsForDb : [{ type: "text", content: proposalContent }],
            metrics: metricsForDb,
            metadata: {
              platform: "web",
              jobId: "N/A",
              tags: [`model:${modelType}`, "parsed"],
            },
          });
        } else {
          throw new Error("Parsed proposal missing content");
        }
      } catch (parseErr) {
        console.warn("Tolerant parse failed, using raw content:", parseErr);
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: args.jobTitle,
          content: proposalContent,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: [{ type: "text", content: proposalContent }],
          metrics: {},
          metadata: {
            platform: "web",
            jobId: "N/A",
            tags: [`model:${modelType}`],
          },
        });
      }

      return { proposalId, proposalContent };
    } catch (error: any) {
      if (error.name === "ProposalParsingError" && error.rawContent) {
        console.warn("Using raw content due to parsing error:", error.message);
        proposalContent = error.rawContent;
        
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: args.jobTitle,
          content: proposalContent,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: [{ type: "text", content: proposalContent }],
          metrics: {},
          metadata: {
            platform: "web",
            jobId: "N/A",
            tags: [`model:${modelType}`, "parsing_error"],
          },
        });

        return { proposalId, proposalContent };
      }
      throw error;
    }
  },
});
