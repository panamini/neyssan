import { ProposalCache } from './utils/cache';
import { llmConfig } from '../../config/llmConfig';
import type {
  TechnicalProposalParams,
  CreativeProposalParams,
  ProposalResult,
} from './types';
import { createPromptManager, PromptManager } from './prompts';
import { OpenAIResponsesAdapter } from './models/openai_responses_adapter';
import { MistralAdapter } from './models/mistral_adapter'; // Import MistralAdapter
import { ModelAdapter } from './models/model_adapter';
import { createChainFactory, ChainFactory, ChainType } from "./chains/chain_factory"; // Import ChainFactory

interface ProposalServiceConfig {
  apiKey?: string;
  modelAdapter?: ModelAdapter;
  maxTokens?: number;
  temperature?: number;
  organization?: string;
  modelName?: string; // Optional modelName - accept string
}

export class ProposalService {
  private cache: ProposalCache;
  private modelAdapter: ModelAdapter; // Model adapter instance
  private chainFactory: ChainFactory;
  private promptManager: PromptManager;

  constructor(config: ProposalServiceConfig) {
    if (config.modelAdapter) {
      this.modelAdapter = config.modelAdapter;
    } else if (!config.apiKey) {
      throw new Error('API key is required');
    } else {
      // Determine the model adapter based on config.modelName, default to mistral-small-latest
      switch (config.modelName) {
        case "chatgpt":
          this.modelAdapter = new OpenAIResponsesAdapter({
            apiKey: config.apiKey,
            modelName: llmConfig.proposalModels?.openaiWriterModel ?? "gpt-5.5",
          });
          break;
        case "mistral-large-latest":
        case "mistral-small-latest":
        case "mistral-agent":
        default:
          this.modelAdapter = new MistralAdapter({ apiKey: config.apiKey, modelName: config.modelName || "mistral-small-latest" });
          break;
      }
    }

    this.promptManager = createPromptManager();
    this.chainFactory = createChainFactory(this.modelAdapter, this.promptManager, {
        validateOutput: true,
        maxRetries: 3,
        timeout: 30000,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
    });
    this.cache = new ProposalCache();
  }

  async generateTechnicalProposal(
    params: TechnicalProposalParams
  ): Promise<ProposalResult> {
    const cacheKey = JSON.stringify(params);
    return this.cache.get(cacheKey, async () => {
      try {
        const startTime = Date.now();
        const chain = this.chainFactory.createChain("technical" as ChainType);
        const result = await chain.generate(params);
        const endTime = Date.now();

                return {
                    ...result,
                    metadata: {
                        ...result.metadata,
                        completionTime: Number(endTime) - Number(startTime),
                    }
                };
            } catch (error) {
                console.error('Generation error:', error);
                throw error;
            }
        });
    }

  async generateCreativeProposal(
    params: CreativeProposalParams
  ): Promise<ProposalResult> {
    const cacheKey = JSON.stringify(params);

    return this.cache.get(cacheKey, async () => {
      try {
        const startTime = Date.now();
        const chain = this.chainFactory.createChain("creative");
        const result = await chain.generate(params);
        const endTime = Date.now();

        return {
          ...result,
          metadata: {
            ...(result.metadata ?? {}), // Ensure metadata exists before spreading
            completionTime: Number(endTime) - Number(startTime),
          },
        };
      } catch (error) {
        console.error('Generation error:', error);
        throw error;
      }
    });
  }
}
