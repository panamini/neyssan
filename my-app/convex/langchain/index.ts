/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { BaseMessage } from "@langchain/core/messages";
import { ProposalCache } from "./utils/cache";
import { llmConfig } from "../../config/llmConfig";
import type {
  CreativeProposalParams,
  ProposalResult,
  TechnicalProposalParams,
} from "./types";
import { createPromptManager, PromptManager } from "./prompts";
import { OpenAIResponsesAdapter } from "./models/openai_responses_adapter";
import { MistralAdapter } from "./models/mistral_adapter";
import { OpenAICompatibleChatAdapter } from "./models/openai_compatible_chat_adapter";
import type {
  ModelAdapter,
  ModelGenerationConfig,
} from "./models/model_adapter";
import {
  createChainFactory,
  type ChainConfig,
  type ChainType,
} from "./chains/chain_factory";

interface ProposalServiceConfig {
  apiKey?: string;
  modelAdapter?: ModelAdapter;
  modelAdapters?: ModelAdapter[];
  maxTokens?: number;
  temperature?: number;
  organization?: string;
  modelName?: string;
  promptManager?: PromptManager;
}

function buildDefaultProposalAdapters(
  config: ProposalServiceConfig,
): ModelAdapter[] {
  const modelName = config.modelName ?? "chatgpt";

  if (modelName !== "chatgpt") {
    const mistralKey =
      llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? null;
    if (!mistralKey) {
      return [];
    }

    return [
      new MistralAdapter({
        apiKey: mistralKey,
        modelName,
      }),
    ];
  }

  const adapters: ModelAdapter[] = [];
  const openaiKey =
    config.apiKey ?? llmConfig.openaiKey ?? process.env.OPENAI_API_KEY ?? null;
  if (openaiKey) {
    adapters.push(
      new OpenAIResponsesAdapter({
        apiKey: openaiKey,
        modelName:
          llmConfig.proposalModels?.openaiWriterModel ?? "gpt-5.5",
      }),
    );
  }

  const mistralKey =
    llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? null;
  if (mistralKey) {
    adapters.push(
      new MistralAdapter({
        apiKey: mistralKey,
        modelName:
          llmConfig.proposalModels?.mistralFallbackModel ??
          "mistral-large-latest",
      }),
    );
  }

  const qwenKey = llmConfig.qwenKey ?? process.env.QWEN_API_KEY ?? null;
  const qwenUrl =
    llmConfig.qwenChatCompletionsUrl ??
    process.env.QWEN_CHAT_COMPLETIONS_URL ??
    null;
  if (qwenKey && qwenUrl) {
    adapters.push(
      new OpenAICompatibleChatAdapter({
        apiKey: qwenKey,
        url: qwenUrl,
        providerName: "qwen",
        modelName:
          llmConfig.proposalModels?.qwenFallbackModel ?? "qwen3.7-max",
      }),
    );
  }

  const deepseekKey =
    llmConfig.deepseekKey ?? process.env.DEEPSEEK_API_KEY ?? null;
  const deepseekUrl =
    llmConfig.deepseekChatCompletionsUrl ??
    process.env.DEEPSEEK_CHAT_COMPLETIONS_URL ??
    null;
  if (deepseekKey && deepseekUrl) {
    adapters.push(
      new OpenAICompatibleChatAdapter({
        apiKey: deepseekKey,
        url: deepseekUrl,
        providerName: "deepseek",
        modelName:
          llmConfig.proposalModels?.deepseekFallbackModel ??
          "deepseek-v4-flash",
      }),
    );
  }

  return adapters;
}

export class ProposalService {
  private readonly cache: ProposalCache;
  private readonly promptManager: PromptManager;
  private readonly chainConfig: Partial<ChainConfig>;
  private readonly modelAdapters: ModelAdapter[];

  constructor(config: ProposalServiceConfig) {
    this.promptManager = config.promptManager ?? createPromptManager();
    this.chainConfig = {
      validateOutput: true,
      maxRetries: 3,
      timeout: 30000,
      ...(config.temperature !== undefined
        ? { temperature: config.temperature }
        : {}),
      ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
    };

    if (config.modelAdapter) {
      this.modelAdapters = [config.modelAdapter];
    } else if (config.modelAdapters && config.modelAdapters.length > 0) {
      this.modelAdapters = config.modelAdapters;
    } else {
      this.modelAdapters = buildDefaultProposalAdapters(config);
    }

    if (this.modelAdapters.length === 0) {
      throw new Error("No proposal model adapters are configured");
    }

    this.cache = new ProposalCache();
  }

  private async generateWithFallbacks<TParams extends Record<string, any>>(
    type: ChainType,
    params: TParams,
  ): Promise<ProposalResult> {
    const failures: Array<{ modelName: string; error: string }> = [];

    for (const adapter of this.modelAdapters) {
      const modelName = adapter.getModelName?.() ?? "unknown";
      try {
        const chain = createChainFactory(
          adapter,
          this.promptManager,
          this.chainConfig,
        ).createChain(type);
        const startTime = Date.now();
        const result = await chain.generate(params);
        const endTime = Date.now();

        return {
          ...result,
          metadata: {
            ...(result.metadata ?? {}),
            completionTime: Number(endTime) - Number(startTime),
            modelName,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "unknown");
        failures.push({ modelName, error: message });
        console.warn("[ProposalService] proposal model attempt failed", {
          modelName,
          error: message,
          attempt: failures.length,
        });
      }
    }

    throw new Error(
      `Failed to generate proposal with all configured models: ${failures
        .map((failure) => `${failure.modelName}: ${failure.error}`)
        .join(" | ")}`,
    );
  }

  async generateTextWithFallbacks(
    prompt: string | BaseMessage[],
    config: Partial<ModelGenerationConfig> = {},
  ): Promise<{ text: string; modelName: string }> {
    const failures: Array<{ modelName: string; error: string }> = [];

    for (const adapter of this.modelAdapters) {
      const modelName = adapter.getModelName?.() ?? "unknown";
      try {
        const text = await adapter.generate(prompt, config as ModelGenerationConfig);
        return { text, modelName };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "unknown");
        failures.push({ modelName, error: message });
        console.warn("[ProposalService] proposal text model attempt failed", {
          modelName,
          error: message,
          attempt: failures.length,
        });
      }
    }

    throw new Error(
      `Failed to generate proposal text with all configured models: ${failures
        .map((failure) => `${failure.modelName}: ${failure.error}`)
        .join(" | ")}`,
    );
  }

  async generateTechnicalProposal(
    params: TechnicalProposalParams,
  ): Promise<ProposalResult> {
    const cacheKey = JSON.stringify({ type: "technical", params });
    return this.cache.get(cacheKey, async () => {
      try {
        return await this.generateWithFallbacks("technical", params);
      } catch (error) {
        console.error("Generation error:", error);
        throw error;
      }
    });
  }

  async generateCreativeProposal(
    params: CreativeProposalParams,
  ): Promise<ProposalResult> {
    const cacheKey = JSON.stringify({ type: "creative", params });

    return this.cache.get(cacheKey, async () => {
      try {
        return await this.generateWithFallbacks("creative", params);
      } catch (error) {
        console.error("Generation error:", error);
        throw error;
      }
    });
  }
}
