Convex Integration Strategy
// Align with existing LangChain services
interface ConvexIntegrationPoints {
  proposalService: "src/services/proposal-handler.ts";
  rateLimiting: "src/langchain/utils/metrics.ts";
  authSync: "src/config/env.ts → Clerk config";
}

// Required package additions (check if already present):
<ask_followup_question>
<question>Should I check package.json for existing Convex/Clerk dependencies before proposing installation commands?</question>
</ask_followup_question>

2. Schema Harmonization
```typescript
// Existing ProposalDraftSchema (from src/langchain/types.ts) needs:
- Convex ID field
- Clerk user relation
- Status enum expansion

3. Migration Path for Current Data
```typescript
// Current data flow adaptation:
LangChain Service → Convex Mutation → Clerk-augmented Storage
Instead of:
LangChain Service → Local Cache → External DB

4. Performance Monitoring Integration
```typescript
// Existing metrics.ts (src/langchain/utils/metrics.ts) requires:
- Convex operation timing instrumentation
- Clerk auth latency tracking
- Hybrid sync health checks

5. Security Validation Points
```typescript
// Audit required for:
- Clerk metadata validation in src/services/mcp-client.ts
- Convex auth rules vs existing role checks
- Rate limit alignment between LangChain cache and Convex

First implementation steps needed:
1. Create convex/ directory with schema definitions
2. Modify proposal-handler.ts to use Convex mutations
3. Add Convex-Clerk auth hooks
4. Update existing tests for Convex integration
