import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { llmConfig } from "../../../config/llmConfig";
import type {
  ModelAdapter,
  ModelGenerationConfig,
  ModelInitConfig,
  ProposalDraft,
} from "./model_adapter.ts";
import { ModelGenerationError, ResultParsingError } from "./model_adapter";

function messageRole(message: BaseMessage): "system" | "assistant" | "user" {
  const type = message._getType();
  if (type === "system") return "system";
  if (type === "ai") return "assistant";
  return "user";
}

function messageText(message: BaseMessage): string {
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content);
}

function extractOpenAIResponseText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const text = output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .map((part: any) => {
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.output_text === "string") return part.output_text;
      return "";
    })
    .join(" ")
    .trim();

  if (text) return text;
  throw new Error("OpenAI proposal response returned no text");
}

export class OpenAIResponsesAdapter implements ModelAdapter {
  private apiKey: string;
  private modelName: string;

  constructor(config: ModelInitConfig) {
    this.apiKey = config.apiKey;
    this.modelName =
      config.modelName ??
      llmConfig.proposalModels?.openaiWriterModel ??
      process.env.OPENAI_PROPOSAL_MODEL ??
      "gpt-5.5";
  }

  getModelName(): string {
    return this.modelName;
  }

  async generate(
    prompt: string | BaseMessage[],
    config: ModelGenerationConfig,
  ): Promise<string> {
    try {
      const messages = Array.isArray(prompt)
        ? prompt
        : [new HumanMessage({ content: prompt })];
      const openaiModule: any = await import("openai").catch(() => null);
      const OpenAI = openaiModule?.default ?? openaiModule?.OpenAI ?? null;
      if (!OpenAI) {
        throw new Error("OpenAI SDK is not available");
      }

      const client = new OpenAI({ apiKey: this.apiKey });
      const response = await client.responses.create({
        model: this.modelName,
        input: messages.map((message) => ({
          role: messageRole(message),
          content: [{ type: "input_text", text: messageText(message) }],
        })),
        reasoning: {
          effort: llmConfig.proposalModels?.openaiWriterReasoningEffort ?? "low",
        },
        text: {
          verbosity: "medium",
        },
        ...(config.maxTokens !== undefined
          ? { max_output_tokens: config.maxTokens }
          : {}),
        ...(config.topP !== undefined ? { top_p: config.topP } : {}),
      } as any);

      return extractOpenAIResponseText(response);
    } catch (error) {
      const enhancedError =
        error instanceof Error
          ? error
          : new Error("Unknown error during OpenAI proposal generation");

      console.error("OpenAI proposal generation failed:", {
        error: enhancedError.message,
        prompt:
          typeof prompt === "string" ? `${prompt.slice(0, 100)}...` : "messages",
        config,
      });

      throw new ModelGenerationError(enhancedError.message, prompt, config);
    }
  }

  async parseResult(result: string): Promise<ProposalDraft> {
    try {
      const parsedResult = JSON.parse(result);
      return {
        content: parsedResult.content ?? result,
        metadata: {
          tokens: parsedResult.metadata?.tokens ?? this.estimateTokens(result),
          completionTime: parsedResult.metadata?.completionTime ?? Date.now(),
          modelName: parsedResult.metadata?.modelName ?? this.modelName,
        },
        tags: parsedResult.tags ?? [],
      };
    } catch (error) {
      throw new ResultParsingError(
        `Failed to parse result: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        result,
      );
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
