import { PromptManager } from "../prompts";
import { BaseProposalChain, type ChainConfig } from "./base_chain";
import { TechnicalProposalChain } from "./technical_chain";
import { CreativeProposalChain } from "./creative_chain"; // Import CreativeProposalChain
import { ModelAdapter } from "../models/model_adapter"; // Import ModelAdapter

export type ChainType = "technical" | "creative";

/**
 * Factory for creating proposal chains
 */
export class ChainFactory {
  constructor(
    private readonly modelAdapter: ModelAdapter, // Accept ModelAdapter
    private readonly promptManager: PromptManager,
    private readonly defaultConfig: Partial<ChainConfig> = {}
  ) {}

  /**
   * Creates a chain of the specified type
   */
  createChain(type: ChainType): BaseProposalChain<any> {
    const config: ChainConfig = {
      validateOutput: true,
      maxRetries: 3,
      timeout: 30000,
      ...this.defaultConfig,
    };

    switch (type) {
      case "technical":
        return new TechnicalProposalChain(
          this.modelAdapter, // Pass ModelAdapter
          this.promptManager,
          config
        );
      case "creative":
        return new CreativeProposalChain(
          this.modelAdapter, // Pass ModelAdapter
          this.promptManager,
          config
        );
      default:
        throw new Error(`Unknown chain type: ${type as string}`);
    }
  }
}

/**
 * Creates a chain factory
 */
export function createChainFactory(
  modelAdapter: ModelAdapter, // Accept ModelAdapter
  promptManager: PromptManager,
  config: Partial<ChainConfig> = {}
): ChainFactory {
  return new ChainFactory(modelAdapter, promptManager, config);
}
