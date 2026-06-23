/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { ChatPromptTemplate, BasePromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { parseProposalContent, ProposalParsingError, InvalidMessageTypeError, ProposalSchema } from '../types';
import type { ProposalResult } from '../types';
import { PromptManager } from '../prompts/index';
import { ModelAdapter } from '../models/model_adapter';
import { ModelGenerationConfig } from "../models/model_adapter"; // Import ModelGenerationConfig


export interface ChainConfig extends Partial<ModelGenerationConfig>{
  validateOutput: boolean;
  maxRetries: number;
  timeout: number;
}

export abstract class BaseProposalChain<TParams extends Record<string, any>> {
  protected modelAdapter: ModelAdapter; // Use ModelAdapter
  protected parser: JsonOutputParser;
  protected prompt: BasePromptTemplate | undefined;
  protected config?: ChainConfig;

  constructor(
    model: ModelAdapter, // Accept ModelAdapter
    protected promptManager: PromptManager,
    protected templateName: string,
    config?: ChainConfig
  ) {
    this.prompt = undefined;
    this.config = config;
    this.modelAdapter = model; // Store the ModelAdapter

    this.parser = new JsonOutputParser();
  }

  protected abstract getTags(params: TParams): string[];

  protected async parseResponse(response: BaseMessage): Promise<ProposalResult> {
    if (!(response instanceof AIMessage)) {
      throw new InvalidMessageTypeError(response._getType());
    }

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Parse and validate
    // const jsonContent = await this.parser.invoke(content); //Remove JSON parsing
    const result = await parseProposalContent(content); // Pass raw content

    // Additional schema validation
    const validationResult = ProposalSchema.safeParse(result);
    if (!validationResult.success) {
      throw new ProposalParsingError(
        "Generated proposal failed schema validation",
        content // Use raw content for error message
      );
    }

    return result;
  }

  async generate(params: TParams): Promise<ProposalResult> {
    try {
      const formattedPrompt = await this.promptManager.get(this.templateName, params);
      this.prompt = ChatPromptTemplate.fromTemplate(formattedPrompt);

      const promptValue = await this.prompt.formatPromptValue({
        ...params,
      });
      const messages = promptValue.toChatMessages();

      // Use the model adapter to generate text, passing only relevant config
      const generatedText = await this.modelAdapter.generate(messages, this.config ?? {});
      const result = await this.parseResponse(new AIMessage(generatedText)); // Use AIMessage constructor

      // Add generated tags
      return {
        ...result,
        tags: this.getTags(params),
      };

    } catch (error) {
      if (error instanceof ProposalParsingError) {
        throw error;
      }
      throw new Error(`Failed to generate proposal: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
