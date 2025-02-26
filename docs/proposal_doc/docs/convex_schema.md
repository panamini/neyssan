We need to implement the following Convex components:

Schema Setup
// convex/schema.ts
- Define proposals table with fields:
  - content, status, userId, createdAt, updatedAt
  - metadata (platform, jobId, rateLimit)
- Define userProfiles table with fields:
  - clerkId, writingStyle, tonePreference, autoSend
- Set up indexes for efficient querying
Mutations
// convex/mutations.ts
- proposals:create
- proposals:update
- proposals:delete
- userProfiles:update
Queries
// convex/queries.ts
- proposals:list
- proposals:get
- proposals:getStats
- userProfiles:get
Actions
// convex/actions.ts
- syncProposals (for PostgreSQL sync)
- recordMetrics
- checkAlerts
Rate Limiting
// convex/rateLimits.ts
- checkRateLimit mutation
- getHourlyUsage query
- getPlatformLimit query
Would you like to proceed with implementing these components? Please toggle to Act mode and we can start with creating the schema definition file