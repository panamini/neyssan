# Job Proposal Generator Testing Plan

## 1. Environment Setup

### 1.1 Dependencies
```bash
# Install core dependencies
npm install

# Install required MCP SDK
npm install @modelcontextprotocol/sdk

# Install development dependencies
npm install --save-dev @types/jest jest ts-jest
```

### 1.2 TypeScript Configuration
```typescript
// tsconfig.json updates
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### 1.3 Environment Configuration
```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  MCP_SERVER_URL: z.string().url(),
  MCP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export const validateEnv = () => envSchema.parse(process.env);
```

## 2. MCP Server Setup with LangChain Integration

### 2.1 Server Structure
```
/Users/pana/Documents/Cline/MCP/job-proposal-server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── services/
    │   ├── scraping.ts
    │   ├── proposal.ts
    │   └── langchain/
    │       ├── chains.ts
    │       ├── prompts.ts
    │       └── models.ts
    └── types/
        └── index.ts
```

### 2.2 LangChain Dependencies
```bash
# Install LangChain and related packages
npm install langchain @langchain/openai zod-to-json-schema
```

### 2.3 LangChain Configuration
```typescript
// src/services/langchain/models.ts
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";

export function createProposalChain() {
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo",
    temperature: 0.7
  });

  const template = PromptTemplate.fromTemplate(`
    Job Description: {jobDescription}
    Client Requirements: {requirements}
    Tone: {tone}
    Writing Style: {writingStyle}

    Generate a professional job proposal that:
    1. Addresses the client's specific needs
    2. Highlights relevant experience
    3. Maintains the specified tone
    4. Uses the provided writing style
  `);

  return new LLMChain({
    llm: model,
    prompt: template
  });
}
```

### 2.4 Implementation Tasks
1. Create scraping service
2. Implement proposal generation with LangChain
   - Set up proposal chain templates
   - Implement tone modifiers
   - Add context handling for user profiles
3. Set up error handling with proper retry mechanisms
4. Configure environment variables (including OPENAI_API_KEY)
5. Implement caching for API responses

## 3. Testing Components

### 3.1 Unit Tests
```typescript
// src/__tests__/tone-service.test.ts
import { createToneService } from '@/services/tone-service';
import { ToneSettings } from '@/types';

describe('ToneService', () => {
  const toneService = createToneService();
  
  test('analyzeTone returns valid metrics', async () => {
    const settings: ToneSettings = {
      type: 'formal',
      level: 3
    };
    
    const result = toneService.analyzeTone('Test content', settings);
    expect(result).toHaveProperty('readabilityScore');
  });
});
```

### 3.2 Integration Tests
```typescript
// src/__tests__/integration/job-processing.test.ts
import { createApplication } from '@/index';
import { JobCaptureRequest, UserProfile } from '@/types';

describe('Job Processing Integration', () => {
  const app = createApplication({
    mcpServerUrl: process.env.MCP_SERVER_URL!,
    mcpApiKey: process.env.MCP_API_KEY!,
    defaultToneSettings: {
      type: 'formal',
      level: 3
    }
  });

  test('processes job successfully', async () => {
    const request: JobCaptureRequest = {
      url: 'https://www.upwork.com/jobs/test',
      platform: 'upwork',
      userToken: 'test-token'
    };

    const profile: UserProfile = {/* test profile data */};
    
    const result = await app.processJob(request, profile);
    expect(result).toHaveProperty('content');
  });
});
```

## 4. Test Data

### 4.1 User Profile Template
```typescript
const testUserProfile: UserProfile = {
  id: 'test-user-1',
  writingStyle: {
    commonPhrases: [
      'Looking forward to discussing',
      'Based on my experience'
    ],
    sentenceLength: 15,
    formalityLevel: 4
  },
  tonePreference: {
    type: 'formal',
    level: 4
  },
  autoSend: false,
  successfulProposals: []
};
```

### 4.2 Sample Job Data
```typescript
const testJobUrls = {
  upwork: 'https://www.upwork.com/jobs/typescript-developer-needed',
  linkedin: 'https://www.linkedin.com/jobs/view/test-job',
  fiverr: 'https://www.fiverr.com/gigs/test-gig'
};
```

## 5. Testing Steps

### 5.1 Basic System Test
1. Verify MCP server connection
2. Test environment configuration
3. Validate type safety with Zod

### 5.2 Job Processing Test
1. Test URL support detection
2. Verify job data scraping
3. Check proposal generation
4. Validate tone analysis

### 5.3 Performance Test
1. Measure response times
2. Test error handling
3. Verify retry mechanisms

## 6. Error Scenarios to Test

### 6.1 Network Errors
- MCP server unavailable
- Job URL unreachable
- Rate limiting scenarios

### 6.2 Validation Errors
- Invalid job URLs
- Malformed user profiles
- Incorrect tone settings

### 6.3 Processing Errors
- Unsupported platforms
- Content extraction failures
- Proposal generation failures

## 7. Commands Reference

```bash
# Start MCP server
cd /Users/pana/Documents/Cline/MCP/job-proposal-server
npm start

# Run tests
npm test

# Test specific component
npm test -- -t "ToneService"

# Run with coverage
npm test -- --coverage
```

## 8. Environment Variables Template

```bash
# .env.template
MCP_SERVER_URL=http://localhost:3000
MCP_API_KEY=your-api-key
NODE_ENV=development
OPENAI_API_KEY=your-openai-api-key
LANGCHAIN_TRACING=true # for development debugging
LANGCHAIN_API_KEY=your-langchain-api-key # if using hosted service
```

## 9. Phase 2 Testing Components

### 9.1 Database Integration Tests
```typescript
// src/__tests__/integration/database.test.ts
import { createProposalRepository } from '@/services/database';
import { GeneratedProposal } from '@/types';

describe('Proposal Repository', () => {
  const repository = createProposalRepository();

  test('saves and retrieves proposals', async () => {
    const proposal: GeneratedProposal = {
      id: 'test-1',
      content: 'Test proposal content',
      jobId: 'job-1',
      platform: 'upwork',
      createdAt: new Date(),
      status: 'draft'
    };

    await repository.save(proposal);
    const retrieved = await repository.findById(proposal.id);
    expect(retrieved).toEqual(proposal);
  });

  test('updates proposal status', async () => {
    await repository.updateStatus('test-1', 'sent');
    const updated = await repository.findById('test-1');
    expect(updated.status).toBe('sent');
  });
});
```

### 9.2 Auto-Send Implementation Tests
```typescript
// src/__tests__/integration/auto-send.test.ts
import { createAutoSendService } from '@/services/auto-send';
import { PlatformType, GeneratedProposal } from '@/types';

describe('Auto-Send Service', () => {
  const autoSendService = createAutoSendService();

  test('sends proposal to platform', async () => {
    const proposal: GeneratedProposal = {
      id: 'test-2',
      content: 'Auto-send test content',
      jobId: 'job-2',
      platform: 'upwork',
      createdAt: new Date(),
      status: 'draft'
    };

    const result = await autoSendService.send(proposal);
    expect(result.status).toBe('sent');
  });

  test('handles rate limiting', async () => {
    // Test rapid submission attempts
    const proposals = Array(5).fill(null).map((_, i) => ({
      id: `test-${i + 3}`,
      content: `Proposal ${i + 1}`,
      jobId: `job-${i + 3}`,
      platform: 'upwork' as PlatformType,
      createdAt: new Date(),
      status: 'draft'
    }));

    const results = await Promise.all(
      proposals.map(p => autoSendService.send(p))
    );
    expect(results.every(r => r.status === 'sent')).toBe(true);
  });
});
```

### 9.3 Chrome Extension Tests
```typescript
// src/__tests__/extension/content.test.ts
import { createJobCapture } from '@/extension/content';
import { JobCaptureRequest } from '@/types';

describe('Chrome Extension Job Capture', () => {
  const jobCapture = createJobCapture();

  test('captures job details from Upwork', async () => {
    // Mock DOM content
    document.body.innerHTML = `
      <div class="job-title">TypeScript Developer Needed</div>
      <div class="job-description">Looking for expert...</div>
    `;

    const captured = await jobCapture.extractJobDetails();
    expect(captured).toMatchObject({
      title: 'TypeScript Developer Needed',
      description: expect.any(String)
    });
  });

  test('detects platform automatically', () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.upwork.com/jobs/123' }
    });

    const platform = jobCapture.detectPlatform();
    expect(platform).toBe('upwork');
  });
});
```

### 9.4 Integration Testing Utilities
```typescript
// src/__tests__/utils/test-helpers.ts
import { GeneratedProposal, UserProfile } from '@/types';

export function createTestProposal(overrides = {}): GeneratedProposal {
  return {
    id: 'test-' + Date.now(),
    content: 'Default test content',
    jobId: 'job-' + Date.now(),
    platform: 'upwork',
    createdAt: new Date(),
    status: 'draft',
    ...overrides
  };
}

export function createTestProfile(overrides = {}): UserProfile {
  return {
    id: 'user-' + Date.now(),
    writingStyle: {
      commonPhrases: ['Test phrase'],
      sentenceLength: 15,
      formalityLevel: 3
    },
    tonePreference: {
      type: 'formal',
      level: 3
    },
    autoSend: false,
    successfulProposals: [],
    ...overrides
  };
}

export const mockPlatformAPI = {
  submit: jest.fn().mockResolvedValue({ success: true }),
  getRateLimit: jest.fn().mockResolvedValue({ remaining: 10 })
};
```

## Next Steps

### Phase 1: Core Implementation
1. Set up the MCP server with LangChain integration
2. Configure environment variables (including API keys)
3. Run basic connectivity tests (both MCP and LangChain)
4. Test proposal generation with different prompts and settings
5. Execute core test suite:
   - Prompt template variations
   - Different tone settings
   - Error handling scenarios
   - API rate limiting tests
6. Review and refine error handling
7. Optimize prompt engineering

### Phase 2: Extended Functionality
1. Implement database integration
   - Set up proposal storage
   - Implement retrieval and updates
   - Test data persistence
2. Add auto-send capability
   - Platform-specific submission logic
   - Rate limiting handling
   - Status tracking
3. Develop Chrome extension
   - Job detail extraction
   - Platform detection
   - UI components
4. Comprehensive testing
   - End-to-end flows
   - Performance monitoring
   - Error scenarios

### Phase 3: Optimization
1. Implement caching strategies
2. Add monitoring and logging
3. Performance optimization
4. User feedback integration

Note: Toggle to Act mode once ready to implement this testing plan.
