import { LRUCache } from "lru-cache";
import type { ProposalResult } from '../types';

export interface CacheOptions {
  max?: number;
  ttl?: number;
}

const DEFAULT_OPTIONS: Required<CacheOptions> = {
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
};

export class ProposalCache {
  private cache: LRUCache<string, ProposalResult>;

  constructor(options: CacheOptions = {}) {
    this.cache = new LRUCache<string, ProposalResult>({
      max: options.max ?? DEFAULT_OPTIONS.max,
      ttl: options.ttl ?? DEFAULT_OPTIONS.ttl,
    });
  }

  async get(
    key: string,
    generator: () => Promise<ProposalResult>
  ): Promise<ProposalResult> {
    const cached = this.cache.get(key);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          fromCache: true,
        },
      };
    }

    const result = await generator();
    
    // Ensure all required fields are present before caching
    const completeResult: ProposalResult = {
      title: result.title,
      content: result.content,
      sections: result.sections || [],
      metrics: {
        duration: result.metrics?.duration || 0,
        success: result.metrics?.success || true,
      },
      metadata: {
        modelName: result.metadata?.modelName || 'unknown',
        tokens: result.metadata?.tokens || 0,
        completionTime: result.metadata?.completionTime || 0,
      },
      tags: result.tags || [],
    };

    this.cache.set(key, completeResult);
    return completeResult;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
    };
  }
}
