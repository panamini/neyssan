import { BaseMessage, HumanMessage } from "@langchain/core/messages";
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

function extractChatCompletionsText(response: any): string {
  const choices = Array.isArray(response?.choices) ? response.choices : [];
  const content = choices[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part: any) =>
        typeof part?.text === "string"
          ? part.text
          : typeof part?.content === "string"
            ? part.content
            : "",
      )
      .join(" ")
      .trim();
    if (joined) {
      return joined;
    }
  }

  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  throw new Error("Compatible chat proposal response returned no text");
}

export class OpenAICompatibleChatAdapter implements ModelAdapter {
  private readonly apiKey: string;
  private readonly url: string;
  private readonly modelName: string;
  private readonly providerName: string;

  constructor(config: ModelInitConfig & {
    url: string;
    providerName: string;
  }) {
    this.apiKey = config.apiKey;
    this.url = config.url;
    this.modelName =
      config.modelName ??
      (config.providerName === "qwen"
        ? "qwen3.6-plus"
        : config.providerName === "deepseek"
          ? "deepseek-v4-flash"
          : "unknown");
    this.providerName = config.providerName;
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

      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages.map((message) => ({
            role: messageRole(message),
            content: messageText(message),
          })),
          ...(config.maxTokens !== undefined
            ? { max_tokens: config.maxTokens }
            : {}),
          ...(config.topP !== undefined ? { top_p: config.topP } : {}),
          ...(config.temperature !== undefined
            ? { temperature: config.temperature }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `${this.providerName} compatible chat failed for ${this.modelName}: ${response.status} ${response.statusText} ${await response.text()}`,
        );
      }

      return extractChatCompletionsText(await response.json());
    } catch (error) {
      const enhancedError =
        error instanceof Error
          ? error
          : new Error("Unknown error during compatible chat generation");

      console.error(`${this.providerName} proposal generation failed:`, {
        error: enhancedError.message,
        url: this.url,
        model: this.modelName,
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
