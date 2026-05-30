import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userProfileMetadataValidator } from "./lib/userProfileMetadata";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

const proposalFormalityLevelChoice = v.union(
  v.literal("informal"),
  v.literal("neutral"),
  v.literal("formal"),
);

const proposalCreativityChoice = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

const proposalTemplateChoice = v.union(
  ...PROPOSAL_TEMPLATE_IDS.map((templateId) => v.literal(templateId)),
);

const proposalStyleLinkModeChoice = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

const proposalStyleChoiceChoice = v.union(
  v.literal("auto"),
  v.literal("formal"),
  v.literal("warm"),
  v.literal("technical"),
  v.literal("balanced"),
);

const proposalTemplateBundleChoice = v.union(
  v.literal("swiss_serif"),
  v.literal("swiss_mono"),
  v.literal("magazine_editorial"),
  v.literal("magazine_serif"),
  v.literal("grid_mono"),
  v.literal("quire_mono"),
);

const proposalTypographyOverrideChoice = v.union(
  v.literal("signature"),
  v.literal("engaging"),
  v.literal("expert"),
);

const proposalLayoutOverrideChoice = v.union(
  v.literal("swiss"),
  v.literal("editorial"),
  v.literal("modernist"),
  v.literal("quire"),
);

const proposalCharacterLimitModeChoice = v.union(
  v.literal("none"),
  v.literal("linkedin_note_200"),
  v.literal("linkedin_inmail_2000"),
  v.literal("indeed_cover_letter_4000"),
  v.literal("upwork_proposal_advisory"),
  v.literal("custom"),
);

const proposalClosingChoice = v.object({
  enabled: v.boolean(),
  signOff: v.string(),
  signatureName: v.string(),
  source: v.union(
    v.literal("settings"),
    v.literal("document"),
    v.literal("legacy"),
  ),
  handwrittenSignatureEnabled: v.optional(v.boolean()),
});

const canonicalJobParseStatusChoice = v.union(
  v.literal("imported"),
  v.literal("parsing"),
  v.literal("parsed"),
  v.literal("failed"),
);

const canonicalJobReviewStateChoice = v.union(
  v.literal("pending"),
  v.literal("needs_review"),
  v.literal("ready"),
);

const canonicalJobSourceSpanChoice = v.object({
  start: v.number(),
  end: v.number(),
});

const canonicalJobExtractionChoice = v.object({
  value: v.string(),
  confidence: v.number(),
  sourceSpan: v.union(canonicalJobSourceSpanChoice, v.null()),
});

const matchReadSynthesisStatusChoice = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("error"),
);

const jobExtractionShadowValidationStatusChoice = v.union(
  v.literal("valid"),
  v.literal("invalid_json"),
  v.literal("schema_invalid"),
  v.literal("empty_signal"),
  v.literal("low_confidence"),
);

const structuredMatchReviewLabelChoice = v.union(
  v.literal("good"),
  v.literal("acceptable but conservative"),
  v.literal("false weak"),
  v.literal("false strong"),
  v.literal("overmatched"),
  v.literal("undermatched"),
  v.literal("evidence missing"),
  v.literal("language issue"),
  v.literal("metadata leak"),
  v.literal("hard-gate issue"),
);

const structuredMatchReviewExtractionVerdictChoice = v.union(
  v.literal("good"),
  v.literal("too_vague"),
  v.literal("wrong_focus"),
  v.literal("noisy"),
  v.literal("incomplete"),
  v.literal("metadata_leak"),
  v.literal("wrong_language"),
);

const matchReadSynthesisChoice = v.object({
  cacheKey: v.string(),
  status: matchReadSynthesisStatusChoice,
  provider: v.string(),
  model: v.string(),
  computedAt: v.optional(v.number()),
  matched: v.optional(v.array(v.string())),
  missing: v.optional(v.array(v.string())),
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  estimatedCostUsd: v.optional(v.number()),
  error: v.optional(v.string()),
});

const proposalVerbatiStyleChoice = v.object({
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

const documentStyleSlotIdChoice = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const documentStyleSlotSourceChoice = v.union(
  v.literal("factory"),
  v.literal("settings"),
);

const documentAppearanceSnapshotChoice = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

const proposalPresetVerbatiStyleChoice = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.union(v.string(), v.null())),
  resumeTemplateId: v.optional(v.string()),
});

const proposalSignatureFontChoice = v.union(
  v.literal("chaumont"),
  v.literal("fd-garamond"),
  v.literal("parisienne"),
);

const proposalSignatureSettingsChoice = v.object({
  mode: v.union(v.literal("auto"), v.literal("font"), v.literal("image")),
  fontId: v.union(proposalSignatureFontChoice, v.null()),
  imageDataUrl: v.union(v.string(), v.null()),
});

const proposalPresetSlotChoice = v.object({
  fontPairId: v.union(v.string(), v.null()),
  styleChoice: proposalStyleChoiceChoice,
  paletteOverride: v.union(
    v.literal("terre"),
    v.literal("cobalt"),
    v.literal("ink"),
    v.literal("sauge"),
    v.literal("plum"),
    v.literal("ochre"),
    v.literal("ocre"),
    v.literal("pierre"),
    v.literal("bordeaux"),
    v.literal("encre"),
    v.null(),
  ),
  accentHex: v.union(v.string(), v.null()),
  verbatiStyle: v.optional(proposalPresetVerbatiStyleChoice),
  voicePreset: v.union(proposalVoicePresetChoice, v.null()),
  signatureSettings: v.optional(proposalSignatureSettingsChoice),
  name: v.optional(v.string()),
});

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  activeCvSnapshots: defineTable({
    clerkId: v.string(),
    title: v.string(),
    personalizationContext: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        summary: v.optional(v.string()),
        desiredPosition: v.optional(v.string()),
        topSkills: v.optional(v.array(v.string())),
        recentExperience: v.optional(
          v.array(
            v.object({
              company: v.optional(v.string()),
              position: v.optional(v.string()),
              highlights: v.optional(v.array(v.string())),
            }),
          ),
        ),
        standoutAchievements: v.optional(v.array(v.string())),
      }),
    ),
    updatedAt: v.optional(v.string()),
    syncedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  proposals: defineTable({
    userId: v.id("userProfiles"), // Changed to v.id("userProfiles") to reference userProfiles table
    jobId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    status: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      sourceJobTitle: v.optional(v.string()),
      sourceJobDescription: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      sourceCvId: v.optional(v.string()),
      planned_path: v.optional(v.string()),
      executed_path: v.optional(v.string()),
      fallback_reason: v.optional(v.string()),
      validator_outcome: v.optional(v.string()),
      save_outcome: v.optional(v.string()),
      requestedModelType: v.optional(v.string()),
      actualModelType: v.optional(v.string()),
      actualModelName: v.optional(v.string()),
      fallbackTriggerCode: v.optional(v.string()),
      voicePreset: v.optional(proposalVoicePresetChoice),
      requestedVoicePreset: v.optional(
        v.union(proposalVoicePresetChoice, v.null()),
      ),
      resolvedVoicePreset: v.optional(proposalVoicePresetChoice),
      autoToneDecisionVersion: v.optional(v.literal("v1")),
      autoToneReason: v.optional(v.string()),
      formalityLevel: v.optional(proposalFormalityLevelChoice),
      creativity: v.optional(proposalCreativityChoice),
      templateId: v.optional(proposalTemplateChoice),
      verbatiStyle: v.optional(proposalVerbatiStyleChoice),
      verbatiStyleSlotId: v.optional(documentStyleSlotIdChoice),
      verbatiStyleSlotSource: v.optional(documentStyleSlotSourceChoice),
      verbatiStyleSlotNameSnapshot: v.optional(v.string()),
      verbatiStyleBaseSnapshot: v.optional(documentAppearanceSnapshotChoice),
      documentStyleVersion: v.optional(v.literal(1)),
      styleLinkMode: v.optional(proposalStyleLinkModeChoice),
      styleChoice: v.optional(proposalStyleChoiceChoice),
      templateBundleId: v.optional(proposalTemplateBundleChoice),
      typographyOverride: v.optional(
        v.union(proposalTypographyOverrideChoice, v.null()),
      ),
      layoutOverride: v.optional(
        v.union(proposalLayoutOverrideChoice, v.null()),
      ),
      applicantName: v.optional(v.string()),
      applicantRole: v.optional(v.string()),
      applicantCompany: v.optional(v.string()),
      contactLine: v.optional(v.string()),
      letterDate: v.optional(v.string()),
      recipientDetails: v.optional(v.string()),
      headerShowSender: v.optional(v.boolean()),
      headerShowDate: v.optional(v.boolean()),
      headerShowSubject: v.optional(v.boolean()),
      headerShowRecipient: v.optional(v.boolean()),
      headerShowRecipientDetails: v.optional(v.boolean()),
      characterLimitMode: v.optional(
        v.union(proposalCharacterLimitModeChoice, v.null()),
      ),
      characterLimitValue: v.optional(v.union(v.number(), v.null())),
      closing: v.optional(proposalClosingChoice),
      proposalType: v.optional(
        v.union(
          v.literal("cover_letter"),
          v.literal("application_message"),
          v.literal("freelance_proposal"),
        ),
      ),
    }),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"])
    .index("by_job_and_status", ["jobId", "status"])
    .index("by_status", ["status"])
    .index("by_platform", ["metadata.platform"])
    .index("by_created", ["createdAt"])
    .index("by_user_and_status", ["userId", "status"]),

  proposalHandoffs: defineTable({
    handoffId: v.string(),
    handoffToken: v.string(),
    clerkId: v.string(),
    jobTitle: v.string(),
    jobDescription: v.string(),
    sourceUrl: v.optional(v.string()),
    platform: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_handoff_id", ["handoffId"])
    .index("by_clerk_id", ["clerkId"]),

  jobs: defineTable({
    userId: v.id("userProfiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
    importedAt: v.number(),
    lastOpenedAt: v.number(),
    sourceUrl: v.string(),
    sourceDomain: v.string(),
    sourceType: v.string(),
    applicationUrl: v.string(),
    dedupeKey: v.string(),
    parseVersion: v.string(),
    parseStatus: canonicalJobParseStatusChoice,
    reviewState: canonicalJobReviewStateChoice,
    title: v.string(),
    company: v.string(),
    location: v.string(),
    rawDescription: v.string(),
    rawLanguageDetected: v.string(),
    summary: v.string(),
    summaryExtraction: v.optional(canonicalJobExtractionChoice),
    responsibilities: v.array(v.string()),
    responsibilitiesExtraction: v.optional(
      v.array(canonicalJobExtractionChoice),
    ),
    keywords: v.array(v.string()),
    keywordsExtraction: v.optional(v.array(canonicalJobExtractionChoice)),
    mustHaves: v.array(v.string()),
    mustHavesExtraction: v.optional(v.array(canonicalJobExtractionChoice)),
    toneCues: v.array(v.string()),
    toneCuesExtraction: v.optional(v.array(canonicalJobExtractionChoice)),
    contacts: v.array(v.string()),
    lastResumeId: v.optional(v.union(v.string(), v.null())),
    lastResumeName: v.optional(v.union(v.string(), v.null())),
    matchReadSynthesis: v.optional(matchReadSynthesisChoice),
    isSample: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
    status: v.string(),
    archivedAt: v.optional(v.union(v.number(), v.null())),
    reviewItems: v.array(
      v.object({
        id: v.string(),
        fieldKey: v.string(),
        label: v.string(),
        reviewStatus: v.union(v.literal("pending"), v.literal("approved")),
        suggestedValue: v.any(),
        approvedValue: v.optional(v.any()),
        sourceText: v.string(),
        confidence: v.number(),
        updatedAt: v.number(),
      }),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_dedupe", ["userId", "dedupeKey"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  job_extraction_shadow: defineTable({
    job_id: v.id("jobs"),
    job_text_hash: v.string(),
    llm_raw_output: v.any(),
    llm_normalized_output: v.any(),
    validation_status: jobExtractionShadowValidationStatusChoice,
    fallback_used: v.boolean(),
    model: v.string(),
    prompt_version: v.string(),
    latency_ms: v.number(),
    model_confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.null(),
    ),
    final_confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.null(),
    ),
    created_at: v.number(),
  })
    .index("by_job_id", ["job_id"])
    .index("by_job_text_hash", ["job_text_hash"])
    .index("by_cache_identity", [
      "job_text_hash",
      "model",
      "prompt_version",
      "validation_status",
    ])
    .index("by_hash_status", ["job_text_hash", "validation_status"]),

  structured_match_reviews: defineTable({
    reviewerId: v.string(),
    reviewerEmail: v.union(v.string(), v.null()),
    jobId: v.string(),
    profileId: v.string(),
    resumeId: v.union(v.string(), v.null()),
    productionScore: v.union(v.number(), v.null()),
    productionTier: v.union(
      v.literal("strong"),
      v.literal("partial"),
      v.literal("weak"),
      v.literal("unknown"),
    ),
    structuredScore: v.union(v.number(), v.null()),
    structuredTier: v.union(
      v.literal("strong"),
      v.literal("partial"),
      v.literal("weak"),
      v.literal("unknown"),
      v.null(),
    ),
    matchedCount: v.number(),
    partialCount: v.number(),
    missingCount: v.number(),
    unknownCount: v.number(),
    hardGateMissingCount: v.number(),
    metadataLeakCount: v.number(),
    languagePreserved: v.boolean(),
    provenanceComplete: v.boolean(),
    reviewerLabel: structuredMatchReviewLabelChoice,
    notes: v.optional(v.string()),
    appGitCommitSha: v.string(),
    structuredScorerVersion: v.string(),
    extractionModel: v.string(),
    extractionPromptVersion: v.string(),
    extractionSummaryVerdict: v.optional(
      structuredMatchReviewExtractionVerdictChoice,
    ),
    extractionRequirementsVerdict: v.optional(
      structuredMatchReviewExtractionVerdictChoice,
    ),
    extractionKeywordsVerdict: v.optional(
      structuredMatchReviewExtractionVerdictChoice,
    ),
    reviewedAt: v.number(),
    scorerVersion: v.object({
      model: v.string(),
      promptVersion: v.string(),
    }),
    createdAt: v.number(),
  })
    .index("by_job_profile", ["jobId", "profileId"])
    .index("by_reviewer", ["reviewerId"])
    .index("by_created", ["createdAt"]),

  userProfiles: defineTable({
    // External canonical profile id (used by upsertProfile)
    profileId: v.optional(v.string()),
    clerkId: v.optional(v.string()),
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
    proposalVoicePreset: v.optional(proposalVoicePresetChoice),
    proposalTemplateId: v.optional(proposalTemplateChoice),
    proposalStyleChoice: v.optional(proposalStyleChoiceChoice),
    proposalPaletteOverride: v.optional(
      v.union(
        v.literal("terre"),
        v.literal("cobalt"),
        v.literal("ink"),
        v.literal("sauge"),
        v.literal("plum"),
        v.literal("ochre"),
        v.literal("ocre"),
        v.literal("pierre"),
        v.literal("bordeaux"),
        v.literal("encre"),
        v.null(),
      ),
    ),
    proposalAccentHex: v.optional(v.union(v.string(), v.null())),
    proposalFontPairId: v.optional(v.union(v.string(), v.null())),
    proposalDefaultContactEmail: v.optional(v.union(v.string(), v.null())),
    proposalDefaultContactPhone: v.optional(v.union(v.string(), v.null())),
    proposalDefaultContactLinkedin: v.optional(v.union(v.string(), v.null())),
    proposalDefaultContactWebsite: v.optional(v.union(v.string(), v.null())),
    proposalDefaultContactLocation: v.optional(v.union(v.string(), v.null())),
    proposalVerbatiStyle: v.optional(proposalPresetVerbatiStyleChoice),
    proposalSourceMode: v.optional(proposalStyleLinkModeChoice),
    proposalSignatureSettings: v.optional(proposalSignatureSettingsChoice),
    // Style preset slots (3-slot builder)
    proposalPreset1: v.optional(v.union(proposalPresetSlotChoice, v.null())),
    proposalPreset2: v.optional(v.union(proposalPresetSlotChoice, v.null())),
    proposalPreset3: v.optional(v.union(proposalPresetSlotChoice, v.null())),
    proposalActivePresetSlot: v.optional(
      v.union(v.literal(1), v.literal(2), v.literal(3)),
    ),
    defaultResumeId: v.optional(v.union(v.string(), v.null())),
    defaultResumeName: v.optional(v.union(v.string(), v.null())),
    // New optional profile fields for ingestion
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    experience: v.optional(
      v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          // Accept either string dates (ISO or human) or numeric timestamps
          startDate: v.optional(v.union(v.string(), v.number(), v.null())),
          endDate: v.optional(v.union(v.string(), v.number(), v.null())),
          description: v.optional(v.string()),
          current: v.optional(v.boolean()),
        }),
      ),
    ),
    education: v.optional(
      v.array(
        v.object({
          school: v.string(),
          degree: v.optional(v.string()),
          fieldOfStudy: v.optional(v.string()),
          startDate: v.optional(v.union(v.string(), v.number(), v.null())),
          endDate: v.optional(v.union(v.string(), v.number(), v.null())),
        }),
      ),
    ),

    // Additional optional fields added to support profile ingestion
    linkedIn: v.optional(v.string()),
    raw_text: v.optional(v.string()),
    // New dedicated fields for languages and contact
    languages: v.optional(v.array(v.string())),
    contact: v.optional(
      v.object({
        // Contact stored as optional phone/address fields (freeform strings)
        phone: v.optional(v.string()),
        address: v.optional(v.string()),
      }),
    ),
    metadata: v.optional(userProfileMetadataValidator),
    cvDocument: v.optional(v.any()),

    // Fields used by upsert logic
    idempotencyKeys: v.optional(v.array(v.string())),
    achievements: v.optional(v.array(v.string())),
  })
    .index("by_profileId", ["profileId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_clerk_updated_at", ["clerkId", "updatedAt"]),

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
    metadata: v.optional(
      v.object({
        operation: v.optional(v.string()),
        status: v.optional(v.string()),
        error: v.optional(v.string()),
        type: v.optional(v.string()),
        table: v.optional(v.string()),
        heapTotal: v.optional(v.number()),
        rss: v.optional(v.number()),
        functionType: v.optional(v.string()),
      }),
    ),
  }).index("by_name_time", ["name", "timestamp"]),

  alerts: defineTable({
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    metadata: v.object({}),
    resolved: v.boolean(),
    acknowledged: v.boolean(),
    timestamp: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_resolved", ["resolved"]),

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

  // New: LLM jobs queue table
  llmJobs: defineTable({
    profileId: v.id("userProfiles"),
    placeholderId: v.optional(v.union(v.string(), v.null())),
    status: v.string(), // queued, processing, finished, failed
    rawText: v.optional(v.string()),
    options: v.optional(v.any()),
    requestedBy: v.optional(v.string()), // clerkId or service id

    // Worker / lifecycle fields (optional)
    attempts: v.optional(v.number()),
    lockedBy: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    historyId: v.optional(v.id("llmHistory")),
    lastError: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // New: LLM history table to persist LLM responses and patches
  llmHistory: defineTable({
    profileId: v.id("userProfiles"),
    jobId: v.optional(v.string()),
    placeholderId: v.optional(v.union(v.string(), v.null())),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    full_response: v.optional(v.any()),
    patch: v.optional(v.any()),
    // New telemetry fields for post-mortem analysis
    provider_used: v.optional(v.union(v.string(), v.null())),
    sanitized_for_repair: v.optional(v.boolean()),
    repair_returned_provider_shape: v.optional(v.boolean()),
    // Allow nulls for confidence since some providers or code paths may set null.
    confidence: v.optional(v.union(v.number(), v.null())),
    merged: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_placeholder", ["placeholderId"])
    .index("by_job", ["jobId"])
    .index("by_created", ["createdAt"]),
});
