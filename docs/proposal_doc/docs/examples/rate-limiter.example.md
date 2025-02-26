# Rate Limiter Example

This example shows how to use the @convex-dev/rate-limiter package in your Convex project.

## 1. Installation and Setup

First, ensure you have the package installed:
```bash
npm install @convex-dev/rate-limiter
```

Then configure it in your `convex/convex.config.ts`:
```typescript
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(rateLimiter);

export default app;
```

## 2. Usage Example

Here's how you would use the rate limiter in your Convex functions:

```typescript
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Initialize the rate limiter with your configuration
const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Global rate limit for API requests
  apiRequests: { 
    kind: "fixed window", 
    rate: 100, 
    period: MINUTE 
  },
  
  // Per-user rate limit for specific actions
  userActions: { 
    kind: "token bucket", 
    rate: 10, 
    period: MINUTE, 
    capacity: 3 
  },
  
  // Rate limit with sharding for high throughput
  highTraffic: { 
    kind: "token bucket", 
    rate: 40000, 
    period: MINUTE, 
    shards: 10 
  }
});

// Example usage in a mutation:
export const myMutation = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check global rate limit
    const globalStatus = await rateLimiter.limit(ctx, "apiRequests", { throws: true });
    
    // Check per-user rate limit
    const userStatus = await rateLimiter.limit(ctx, "userActions", { 
      key: args.userId,
      throws: true 
    });
    
    // Your mutation logic here
  }
});

// Example with reservation for scheduled tasks:
export const scheduledTask = internalAction({
  args: {
    skipCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.skipCheck) {
      const status = await rateLimiter.limit(ctx, "highTraffic", {
        reserve: true,
        throws: true,
      });
      if (status.retryAfter) {
        return ctx.scheduler.runAfter(
          status.retryAfter,
          internal.myNamespace.scheduledTask,
          { skipCheck: true }
        );
      }
    }
    // Task logic here
  },
});
```

## 3. Key Features

- **Fixed Window Algorithm**: Simple rate limiting based on fixed time windows
- **Token Bucket Algorithm**: More sophisticated approach allowing bursts while maintaining average rates
- **Sharding**: Scale your rate limits across multiple shards for high throughput
- **Reservation**: Reserve capacity for future use to avoid thundering herd problems
- **Per-key Limits**: Apply limits per user, per IP, or any other key
- **Transactional**: Rate limits are evaluated within your mutations' transactions

## 4. Best Practices

1. Use `fixed window` for simple global limits
2. Use `token bucket` for per-user limits where you want to allow occasional bursts
3. Add sharding when you expect high throughput
4. Use reservation for scheduled tasks to avoid retries
5. Always handle rate limit errors gracefully in your client code
