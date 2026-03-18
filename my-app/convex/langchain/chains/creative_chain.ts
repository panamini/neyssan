import { type CreativeProposalParams, type ProposalResult } from '../types';
import { BaseProposalChain, type ChainConfig } from './base_chain';
import { PromptManager } from '../prompts/';
import { ModelAdapter } from '../models/model_adapter'; // Import ModelAdapter

export class CreativeProposalChain extends BaseProposalChain<CreativeProposalParams> {
    constructor(
        model: ModelAdapter, // Accept ModelAdapter
        promptManager: PromptManager,
        config?: ChainConfig
    ) {
        super(
            model,
            promptManager,
            'creative',
            config
        );
    }

  protected override getTags(params: CreativeProposalParams): string[] {
    return [
      `content:${params.contentType}`,
      `voice:${params.brandVoice}`,
      'type:creative'
    ].map(tag => tag.toLowerCase());
  }

  override async generate(params: CreativeProposalParams): Promise<ProposalResult> {
        const result = await super.generate(params);

        return {
            ...result,
            metrics: {
                ...result.metrics,
                duration: result.metrics.duration * 1.2,
            },
            metadata: {
                ...result.metadata,
            }
        };
    }
}
