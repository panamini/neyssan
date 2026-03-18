import { ChatMistralAI } from "@langchain/mistralai";
import { BaseMessage, HumanMessage, MessageContentComplex } from "@langchain/core/messages";
import type {
  ModelAdapter,
  ModelGenerationConfig,
  ModelInitConfig,
  ProposalDraft,
} from "./model_adapter.ts";
import { ModelGenerationError, ResultParsingError } from "./model_adapter";

/**
 * Mistral implementation of the model adapter
 */
export class MistralAdapter implements ModelAdapter {
  private model: ChatMistralAI;
  private modelName: string;

  constructor(config: ModelInitConfig & { modelName?: string }) {
    this.modelName = config.modelName || "mistral-small-latest";
    this.model = new ChatMistralAI({
      apiKey: config.apiKey,
      temperature: 0.7,
      maxTokens: 2048,
      modelName: this.modelName,
    });
  }

  /**
   * Generate text using Mistral
   */
  async generate(
    prompt: string | BaseMessage[],
    config: ModelGenerationConfig
  ): Promise<string> {
    try {
      // Configure model with provided settings
      if (config.temperature !== undefined) {
        this.model.temperature = config.temperature;
      }
      if (config.maxTokens !== undefined) {
        this.model.maxTokens = config.maxTokens;
      }
      if (config.topP !== undefined) {
        this.model.topP = config.topP;
      }
      if (config.frequencyPenalty !== undefined) {
        this.model.frequencyPenalty = config.frequencyPenalty;
      }
      if (config.presencePenalty !== undefined) {
        this.model.presencePenalty = config.presencePenalty;
      }

      // Handle different prompt types
      let messages: BaseMessage[];
      if (Array.isArray(prompt)) {
        messages = prompt;
      } else {
        messages = [new HumanMessage({ content: prompt })];
      }

      // Generate response
      const response = await this.model.invoke(messages);

      // Convert response content to string
      const content =
        typeof response.content === "string"
          ? response.content
          : Array.isArray(response.content)
          ? response.content.map((c: MessageContentComplex) =>
              c.type === "text" ? c.text : ""
            ).join(" ")
          : "";

      return content;
    } catch (error) {
      const enhancedError =
        error instanceof Error
          ? error
          : new Error("Unknown error during generation");

      console.error("Mistral generation failed:", {
        error: enhancedError.message,
        prompt: typeof prompt === "string" ? prompt.slice(0, 100) + "..." : "messages",
        config,
      });

      throw new ModelGenerationError(
        enhancedError.message,
        prompt,
        config
      );
    }
  }

  /**
   * Parse and validate the generated result
   */
  async parseResult(result: string): Promise<ProposalDraft> {
    try {
      // Parse the result as JSON
      const parsedResult = JSON.parse(result);

      // Extract tags from the content, if available, otherwise extract from the result string
      const tags = parsedResult.tags ? parsedResult.tags : this.extractTags(result);

      // Create proposal draft, using properties from the parsed JSON if available
      const draft: ProposalDraft = {
        content: parsedResult.content ?? result, // Fallback to the raw result if content is missing
        metadata: {
          tokens: parsedResult.metadata?.tokens ?? this.estimateTokens(result), // Fallback to estimation
          completionTime: parsedResult.metadata?.completionTime ?? Date.now(), // Fallback to current time
          modelName: parsedResult.metadata?.modelName ?? this.modelName, // Fallback to mistral model name
        },
        tags,
      };

      return draft;
    } catch (error) {
      throw new ResultParsingError(
        `Failed to parse result: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        result
      );
    }
  }

  /**
   * Extract tags from the generated content
   */
  private extractTags(content: string): string[] {
    const tags = new Set<string>();

    // Extract hashtags
    const hashtagRegex = /#[\w-]+/g;
    const hashtags = content.match(hashtagRegex) || [];
    hashtags.forEach(tag => tags.add(tag.slice(1)));

    // Extract key terms
    const keyTerms = [
      "technical",
      "creative",
      "implementation",
      "solution",
      "approach",
      "methodology",
    ];

    keyTerms.forEach(term => {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        tags.add(term);
      }
    });

    return Array.from(tags);
  }

  /**
   * Estimate token count for a string
   */
  public estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
