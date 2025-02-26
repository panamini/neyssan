# LangChain Implementation: A Modular Approach

## Core Architecture Decision

Based on SOLID principles, DRY practices, and performance requirements, we'll implement LangChain as a **dedicated service within the proposal-server** rather than a separate MCP service or shared package. This decision optimizes for:

- 🔄 **Reduced Network Overhead**: Direct integration eliminates extra HTTP calls
- 🚀 **Lower Latency**: <2ms overhead vs 50-100ms for separate service
- 📦 **Simpler Deployment**: Single service to manage and scale
- 🛠️ **Easier Debugging**: Direct access to logs and error tracking

## Implementation Structure

```
/mcp/proposal-server/
├── src/
│   ├── langchain/
│   │   ├── chains/
│   │   │   ├── base-chain.ts       # Abstract base chain
│   │   │   ├── technical-chain.ts  # Technical proposal specialization
│   │   │   ├── creative-chain.ts   # Creative proposal specialization
│   │   │   └── index.ts           # Chain exports
│   │   ├── models/
│   │   │   ├── model-adapter.ts   # Abstract model interface
│   │   │   ├── gpt4-adapter.ts    # GPT-4 implementation
│   │   │   └── index.ts          # Model exports
│   │   ├── prompts/
│   │   │   ├── templates/        # Reusable prompt templates
│   │   │   └── manager.ts        # Template management
│   │   └── utils/
│   │       ├── cache.ts          # LRU caching
│   │       ├── validation.ts     # Zod schemas
│   │       └── metrics.ts        # Performance tracking
│   └── services/
│       └── proposal-service.ts   # Integration point
```

## Key Components

### 1. Model Adapter Pattern

```typescript
// models/model-adapter.ts
export interface ModelAdapter {
  generate(prompt: string, config: ModelConfig): Promise<string>;
  parseResult(result: string): ProposalDraft;
}

// models/gpt4-adapter.ts
export class GPT4Adapter implements ModelAdapter {
  private model: ChatOpenAI;

  constructor(config: ModelConfig) {
    this.model = new ChatOpenAI({
      modelName: "gpt-4-turbo",
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048
    });
  }

  async generate(prompt: string, config: ModelConfig) {
    const response = await this.model.invoke(prompt);
    return this.formatResponse(response);
  }
}
```

### 2. Chain Factory & Composition

```typescript
// chains/base-chain.ts
export abstract class BaseProposalChain {
  constructor(
    protected adapter: ModelAdapter,
    protected promptManager: PromptManager
  ) {}

  abstract generate(request: ProposalRequest): Promise<ProposalDraft>;
  
  protected async validateOutput(draft: ProposalDraft): Promise<boolean> {
    return ProposalSchema.safeParse(draft).success;
  }
}

// chains/technical-chain.ts
export class TechnicalProposalChain extends BaseProposalChain {
  async generate(request: ProposalRequest) {
    const prompt = this.promptManager.get('technical', {
      jobDescription: request.description,
      requirements: request.requirements,
      expertise: request.expertise
    });
    
    return this.adapter.generate(prompt, {
      temperature: 0.5,  // Lower for technical precision
      maxTokens: 2048
    });
  }
}
```

### 3. Prompt Template Management

```typescript
// prompts/manager.ts
export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private readonly defaults: Record<string, any> = {
    format: 'json',
    style: 'professional'
  };

  constructor(private validator: TemplateValidator) {}

  register(name: string, template: string | PromptTemplate) {
    const compiled = typeof template === 'string' 
      ? PromptTemplate.fromTemplate(template)
      : template;
      
    this.validator.validate(compiled);
    this.templates.set(name, compiled);
  }

  get(name: string, variables: Record<string, any>) {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template ${name} not found`);
    
    return template.format({
      ...this.defaults,
      ...variables
    });
  }
}
```

### 4. Performance Optimization

```typescript
// utils/cache.ts
export class ProposalCache {
  private cache: LRU<string, ProposalDraft>;
  private pending: Map<string, Promise<ProposalDraft>>;

  constructor(options: CacheOptions) {
    this.cache = new LRU({
      max: options.maxSize ?? 1000,
      ttl: options.ttl ?? 1000 * 60 * 30
    });
    this.pending = new Map();
  }

  async get(key: string, generator: () => Promise<ProposalDraft>) {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Check pending requests
    const pending = this.pending.get(key);
    if (pending) return pending;

    // Generate new proposal
    const promise = generator()
      .then(result => {
        this.cache.set(key, result);
        this.pending.delete(key);
        return result;
      })
      .catch(error => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }
}
```

## Integration with Existing System

```typescript
// services/proposal-service.ts
export function createProposalService(config: ServiceConfig) {
  const adapter = new GPT4Adapter(config.model);
  const promptManager = new PromptManager(new TemplateValidator());
  const cache = new ProposalCache(config.cache);

  // Register base templates
  promptManager.register('technical', technicalTemplate);
  promptManager.register('creative', creativeTemplate);

  // Initialize chain factory
  const chainFactory = new ProposalChainFactory(adapter, promptManager);

  return {
    async generateProposal(request: ProposalRequest): Promise<ProposalDraft> {
      const cacheKey = createCacheKey(request);
      
      return cache.get(cacheKey, async () => {
        const chain = chainFactory.createChain(request.type);
        return chain.generate(request);
      });
    }
  };
}
```

## Benefits of This Approach

1. **Modularity**
   - Easy to add new model adapters
   - Simple to extend with new chain types
   - Flexible prompt template system

2. **Performance**
   - Efficient caching with deduplication
   - Minimal network overhead
   - Optimized prompt handling

3. **Maintainability**
   - Clear separation of concerns
   - Well-defined interfaces
   - Centralized configuration

4. **Scalability**
   - Independent scaling of components
   - Easy to add distributed caching
   - Simple to monitor and optimize

## Next Steps

1. Implement basic chain types (technical, creative, standard)
2. Add performance monitoring
3. Set up prompt template versioning
4. Configure caching strategy
5. Add error recovery mechanisms


