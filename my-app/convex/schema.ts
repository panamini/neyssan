import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  proposals: defineTable({
    userId: v.id("userProfiles"), // Changed to v.id("userProfiles") to reference userProfiles table
    title: v.string(),
    content: v.string(),
    status: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sections: v.array(v.object({
      type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
      content: v.string()
    })),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number())
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string()))
    })
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_platform", ["metadata.platform"])
    .index("by_created", ["createdAt"])
    .index("by_user_and_status", ["userId", "status"]),

  userProfiles: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    preferences: v.object({
      rateLimits: v.optional(v.any()),
      writingStyle: v.string(),
      tonePreference: v.string(),
      autoSend: v.boolean(),
    }),
    // New optional profile fields for ingestion
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience: v.optional(
      v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          startDate: v.optional(v.number()),
          endDate: v.optional(v.number()),
          description: v.optional(v.string()),
        })
      )
    ),
    education: v.optional(
      v.array(
        v.object({
          school: v.string(),
          degree: v.optional(v.string()),
          fieldOfStudy: v.optional(v.string()),
          startDate: v.optional(v.number()),
          endDate: v.optional(v.number()),
        })
      )
    ),
  }).index("by_clerk_id", ["clerkId"]),

  rateLimits: defineTable({
    userId: v.id("users"), // Changed to v.id("users") for proper referencing
    platform: v.string(),
    currentCount: v.number(),
    previousCount: v.number(),
    windowStart: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_platform", ["userId", "platform"])
    .index("by_window", ["windowStart"]),

  analytics: defineTable({
    metric: v.string(),
    value: v.number(),
    tags: v.array(v.string()),
    timestamp: v.number(),
  })
    .index("by_metric", ["metric"])
    .index("by_timestamp", ["timestamp"]),

  syncStatus: defineTable({
    lastSyncId: v.string(),
    lastSyncTime: v.number(),
    status: v.string(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_sync_time", ["lastSyncTime"]),

  metrics: defineTable({
    name: v.string(),
    value: v.number(),
    timestamp: v.number(),
    labels: v.object({}),
    metadata: v.optional(v.object({
      operation: v.optional(v.string()),
      status: v.optional(v.string()),
      error: v.optional(v.string()),
      type: v.optional(v.string()),
      table: v.optional(v.string()),
      heapTotal: v.optional(v.number()),
      rss: v.optional(v.number()),
      functionType: v.optional(v.string())
    }))
  })
    .index("by_name_time", ["name", "timestamp"]),

  alerts: defineTable({
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    metadata: v.object({}),
    resolved: v.boolean(),
    acknowledged: v.boolean(),
    timestamp: v.number(),
    resolvedAt: v.optional(v.number())
  })
  .index("by_resolved", ["resolved"]),

  // Adding sessions table
  sessions: defineTable({
    userId: v.id("users"),
    activeExpires: v.number(),
    idleExpires: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Adding authKeys table
  authKeys: defineTable({
    userId: v.id("users"),
    hashedPassword: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
