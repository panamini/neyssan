import type { TechnicalProposalParams, ProposalResult } from '../types';
import { BaseProposalChain, type ChainConfig } from './base_chain';
import { PromptManager } from '../prompts/';
import { ModelAdapter } from '../models/model_adapter'; // Import ModelAdapter

export class TechnicalProposalChain extends BaseProposalChain<TechnicalProposalParams> {
    constructor(
        model: ModelAdapter, // Accept ModelAdapter
        promptManager: PromptManager,
        config?: ChainConfig
    ) {
        super(
            model,
            promptManager,
            'technical',
            config
        );
    }

    protected getTags(params: TechnicalProposalParams): string[] {
        return [
            `expertise:${params.expertise ? params.expertise.join(', ') : 'unknown'}`,
            `scope:${params.scope}`,
            'type:technical'
        ].map(tag => tag.toLowerCase());
    }

    override async generate(params: TechnicalProposalParams): Promise<ProposalResult> {
        const result = await super.generate(params);

        return {
            ...result,
            metrics: {
                ...result.metrics,
                duration: result.metrics.duration * 1.5,
            },
            metadata: {
                ...result.metadata,
            }
        };
    }
}
