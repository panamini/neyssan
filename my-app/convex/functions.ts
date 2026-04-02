import { action, mutation, query } from './_generated/server';
import { v } from "convex/values";
import { internal } from './_generated/api';
import * as Monitoring from './monitoring';
import { generateProposalArgs, handleGenerateProposal } from "./generateProposalMutation";
import {
  parseStringArrayResult,
  runEditorAiTextPrompt,
  runStyleRoutingAiTextPrompt,
} from "./lib/editorAi";
import {
  buildLanguageSuggestionShortlist,
  buildSkillSuggestionShortlist,
} from "./lib/cvAiSuggestions";
import {
  suggestProposalStyleFromDescription,
  type ProposalStyleSuggestion,
  type VerbatiLayoutHint,
  type VerbatiStyleBundleId,
  type VerbatiTypographyHint,
} from "./lib/proposals/styleSuggestions";

export const trackError = mutation({
  args: {
    error: v.string()
  },
  handler: async (_ctx, args) => {
    return Monitoring.trackError(new Error(args.error));
  }
});

export const healthCheck = mutation({
  args: {},
  handler: async (ctx: any): Promise<{ status: string }> => {
    try {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'health_check',
        value: 1,
        metadata: {
          operation: 'health_check',
          status: 'success'
        },
        labels: {}
      });
      return { status: 'healthy' };
    } catch (error: any) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'error',
        value: 1,
        metadata: {
          error: 'Health check failed: ' + error.message,
          type: 'health_check',
          status: 'error'
        },
        labels: {}
      });
      return { status: 'unhealthy' };
    }
  }
});

export { default as createUserFromClient } from "./createUserFromClient";
export const generateProposal = action({
  args: generateProposalArgs,
  handler: handleGenerateProposal,
});

function parseStyleSuggestionResult(raw: string): ProposalStyleSuggestion | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned) as {
      bundleId?: string;
      overrides?: {
        layout?: string;
        typography?: string;
        palette?: string;
      };
    };
    const fallback = suggestProposalStyleFromDescription(cleaned);
    const bundleId = (
      ["minimal", "rounded", "editorial", "bold"] as VerbatiStyleBundleId[]
    ).includes(parsed.bundleId as VerbatiStyleBundleId)
      ? (parsed.bundleId as VerbatiStyleBundleId)
      : fallback.bundleId;

    return {
      bundleId,
      overrides: {
        layout: (
          ["swiss", "two-column", "editorial", "modernist", "quire"] as VerbatiLayoutHint[]
        ).includes(parsed.overrides?.layout as VerbatiLayoutHint)
          ? (parsed.overrides?.layout as VerbatiLayoutHint)
          : fallback.overrides.layout,
        typography: (
          ["signature", "engaging", "expert"] as VerbatiTypographyHint[]
        ).includes(parsed.overrides?.typography as VerbatiTypographyHint)
          ? (parsed.overrides?.typography as VerbatiTypographyHint)
          : fallback.overrides.typography,
        palette: (
          ["sauge", "ocre", "pierre", "bordeaux", "encre"] as const
        ).includes(parsed.overrides?.palette as any)
          ? (parsed.overrides?.palette as ProposalStyleSuggestion["overrides"]["palette"])
          : fallback.overrides.palette,
      },
      matchedKeywords: fallback.matchedKeywords,
    };
  } catch {
    return null;
  }
}

async function resolveStyleSuggestion(
  description: string,
): Promise<ProposalStyleSuggestion> {
  const fallback = suggestProposalStyleFromDescription(description);

  try {
    const raw = await runStyleRoutingAiTextPrompt({
      system:
        "You map a user's visual-style request to a constrained document style system. Return JSON only with keys bundleId and overrides. bundleId must be one of: minimal, rounded, editorial, bold. overrides may optionally include layout, typography, and palette. Use only these values. layout: swiss, two-column, editorial, modernist, quire. typography: signature, engaging, expert. palette: sauge, ocre, pierre, bordeaux, encre.",
      prompt: [
        "Map this style request into the closest canonical document style bundle.",
        "Prefer the bundle that best matches the user's intent, then add only necessary overrides.",
        "Return JSON only.",
        "",
        `Style request: ${description}`,
      ].join("\n"),
      maxOutputTokens: 220,
    });

    return parseStyleSuggestionResult(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export const suggestVerbatiStyle = action({
  args: {
    description: v.string(),
  },
  handler: async (_ctx, args) => {
    return resolveStyleSuggestion(args.description);
  },
});

export const suggestProposalStyle = action({
  args: {
    description: v.string(),
  },
  handler: async (_ctx, args) => {
    return resolveStyleSuggestion(args.description);
  },
});

const inlineEditorModeChoice = v.union(
  v.literal("make_human"),
  v.literal("make_clearer"),
  v.literal("make_persuasive"),
  v.literal("shorten"),
  v.literal("lengthen"),
  v.literal("fix_grammar"),
  v.literal("rewrite"),
  v.literal("expand"),
  v.literal("clarify"),
  v.literal("fix"),
  v.literal("tone"),
  v.literal("summarize"),
  v.literal("ask"),
  v.literal("custom"),
);

const cvSectionAiActionChoice = v.union(
  v.literal("rewrite_summary_from_profile"),
  v.literal("improve_summary_text"),
  v.literal("generate_skills_suggestions"),
  v.literal("generate_skills_from_experience"),
  v.literal("generate_language_suggestions"),
  v.literal("improve_experience_responsibilities"),
  v.literal("improve_experience_bullets"),
  v.literal("improve_achievement_line"),
);

const CV_SECTION_AI_ACTION_IDS = [
  "rewrite_summary_from_profile",
  "improve_summary_text",
  "generate_skills_suggestions",
  "generate_skills_from_experience",
  "generate_language_suggestions",
  "improve_experience_responsibilities",
  "improve_experience_bullets",
  "improve_achievement_line",
] as const;

const editorExperienceValidator = v.object({
  company: v.optional(v.string()),
  position: v.optional(v.string()),
  description: v.optional(v.string()),
  bullets: v.optional(v.array(v.string())),
});

const editorEducationValidator = v.object({
  institution: v.optional(v.string()),
  degree: v.optional(v.string()),
  fieldOfStudy: v.optional(v.string()),
  description: v.optional(v.string()),
});

const editorLanguageValidator = v.object({
  name: v.optional(v.string()),
  level: v.optional(v.string()),
});

export const transformEditorSelection = action({
  args: {
    mode: inlineEditorModeChoice,
    instruction: v.string(),
    selectedText: v.string(),
  },
  handler: async (_ctx, args) => {
    const prompt = [
      `Transformation mode: ${args.mode}`,
      `Instruction: ${args.instruction.trim()}`,
      "Rewrite the selected text only.",
      "Preserve the original language unless the instruction explicitly changes it.",
      "Return only the replacement text with no quotes, no markdown, and no commentary.",
      "",
      "Selected text:",
      args.selectedText,
    ].join("\n");

    const text = await runEditorAiTextPrompt({
      system:
        "You are editing a user's text selection in place. Return only the replacement text. Do not add explanations, code fences, or surrounding quotes.",
      prompt,
      maxOutputTokens: 500,
    });

    return { text };
  },
});

export const getCvAiCapabilities = query({
  args: {},
  returns: v.object({
    version: v.string(),
    supportedActions: v.array(cvSectionAiActionChoice),
  }),
  handler: async () => ({
    version: "2026-03-28-cv-ai-v11",
    supportedActions: [...CV_SECTION_AI_ACTION_IDS],
  }),
});

export const runCvSectionAiAction = action({
  args: {
    action: cvSectionAiActionChoice,
    existingText: v.optional(v.string()),
    existingItems: v.optional(v.array(v.string())),
    excludeItems: v.optional(v.array(v.string())),
    maxItems: v.optional(v.number()),
    summary: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experiences: v.optional(v.array(editorExperienceValidator)),
    educations: v.optional(v.array(editorEducationValidator)),
    languages: v.optional(v.array(editorLanguageValidator)),
  },
  handler: async (_ctx, args) => {
    const experiences = Array.isArray(args.experiences) ? args.experiences : [];
    const educations = Array.isArray(args.educations) ? args.educations : [];
    const languages = Array.isArray(args.languages) ? args.languages : [];
    const compactExperiences = experiences
      .map((item, index) =>
        [
          `Experience ${index + 1}:`,
          item.position ? `- Role: ${item.position}` : null,
          item.company ? `- Company: ${item.company}` : null,
          item.description ? `- Description: ${item.description}` : null,
          Array.isArray(item.bullets) && item.bullets.length > 0
            ? `- Bullets: ${item.bullets.join(" | ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n\n");
    const compactEducations = educations
      .map((item, index) =>
        [
          `Education ${index + 1}:`,
          item.degree ? `- Degree: ${item.degree}` : null,
          item.fieldOfStudy ? `- Field: ${item.fieldOfStudy}` : null,
          item.institution ? `- Institution: ${item.institution}` : null,
          item.description ? `- Description: ${item.description}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n\n");
    const compactLanguages = languages
      .map((item) =>
        [item.name?.trim(), item.level?.trim()].filter(Boolean).join(" - "),
      )
      .filter(Boolean)
      .join("\n");
    const skillShortlist = buildSkillSuggestionShortlist({
      experiences,
      educations,
      existingItems: args.existingItems,
      excludeItems: args.excludeItems,
      maxItems: args.maxItems,
    });
    const languageShortlist = buildLanguageSuggestionShortlist({
      summary: args.summary,
      experiences,
      educations,
      existingItems: args.existingItems,
      excludeItems: args.excludeItems,
      maxItems: args.maxItems,
    });
    const isListAction = (
      action: typeof args.action,
    ): action is
      | "generate_skills_suggestions"
      | "generate_skills_from_experience"
      | "generate_language_suggestions"
      | "improve_experience_responsibilities"
      | "improve_experience_bullets" =>
      action === "generate_skills_suggestions" ||
      action === "generate_skills_from_experience" ||
      action === "generate_language_suggestions" ||
      action === "improve_experience_responsibilities" ||
      action === "improve_experience_bullets";

    const actionPrompt = (() => {
      switch (args.action) {
        case "rewrite_summary_from_profile":
          return [
            "Task: draft the CV summary from the full profile evidence.",
            "Return only the rewritten summary text.",
            "Keep it concise, credible, and specific to the actual experience provided.",
            args.summary ? `Current summary:\n${args.summary}` : "Current summary: none.",
            args.skills?.length ? `Skills:\n- ${args.skills.join("\n- ")}` : "Skills: none.",
            compactExperiences ? `Experience evidence:\n${compactExperiences}` : "Experience evidence: none.",
            compactEducations ? `Education evidence:\n${compactEducations}` : "Education evidence: none.",
            compactLanguages ? `Languages:\n${compactLanguages}` : "Languages: none.",
          ].join("\n\n");
        case "improve_summary_text":
          return [
            "Task: improve the existing CV summary without inventing facts.",
            "Return only the improved summary text.",
            "Keep the same core meaning, but make it clearer, tighter, and more professional.",
            `Existing summary:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "generate_skills_suggestions":
        case "generate_skills_from_experience":
          return [
            "Task: suggest a focused CV skills shortlist backed by the resume evidence.",
            "Return JSON only: an array of short skill strings.",
            "Use concise professional labels. Prefer the recommended official labels when they fit the evidence.",
            "Do not include soft filler, duplicates, or tools not supported by the resume evidence.",
            skillShortlist.length
              ? `Recommended official labels:\n- ${skillShortlist.join("\n- ")}`
              : "Recommended official labels: none.",
            args.existingItems?.length
              ? `Already present:\n- ${args.existingItems.join("\n- ")}`
              : "Already present: none.",
            args.excludeItems?.length
              ? `Do not repeat in this batch:\n- ${args.excludeItems.join("\n- ")}`
              : "Do not repeat in this batch: none.",
            compactExperiences ? `Experience evidence:\n${compactExperiences}` : "Experience evidence: none.",
            compactEducations ? `Education evidence:\n${compactEducations}` : "Education evidence: none.",
          ].join("\n\n");
        case "generate_language_suggestions":
          return [
            "Task: suggest languages that are explicitly supported by the resume evidence.",
            "Return JSON only: an array of language names.",
            "Use canonical language names only. Do not return proficiency verbs such as 'write Hungarian' or 'understand spoken Korean'.",
            "Prefer the recommended official labels when they fit the evidence.",
            languageShortlist.length
              ? `Recommended official labels:\n- ${languageShortlist.join("\n- ")}`
              : "Recommended official labels: none.",
            args.existingItems?.length
              ? `Already present:\n- ${args.existingItems.join("\n- ")}`
              : "Already present: none.",
            args.excludeItems?.length
              ? `Do not repeat in this batch:\n- ${args.excludeItems.join("\n- ")}`
              : "Do not repeat in this batch: none.",
            args.summary ? `Summary/profile text:\n${args.summary}` : "Summary/profile text: none.",
            compactExperiences ? `Experience evidence:\n${compactExperiences}` : "Experience evidence: none.",
            compactEducations ? `Education evidence:\n${compactEducations}` : "Education evidence: none.",
          ].join("\n\n");
        case "improve_experience_responsibilities":
        case "improve_experience_bullets":
          return [
            "Task: improve the responsibilities for one CV role.",
            "Return JSON only: an array of concise bullet strings.",
            "Preserve factual scope. Improve clarity, specificity, and impact without inventing metrics or responsibilities.",
            `Existing role text:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "improve_achievement_line":
          return [
            "Task: improve one CV achievement line.",
            "Return only the rewritten achievement line.",
            "Keep it concise, factual, and stronger in phrasing without inventing metrics or claims.",
            `Existing achievement line:\n${args.existingText ?? ""}`,
          ].join("\n\n");
      }
    })();

    const raw = await runEditorAiTextPrompt({
      system:
        isListAction(args.action)
          ? "You generate structured CV improvements. Return only valid JSON arrays when requested."
          : "You improve CV sections. Return only the revised text with no commentary.",
      prompt: actionPrompt,
      maxOutputTokens: 700,
    });

    if (isListAction(args.action)) {
      return {
        kind: "list",
        items: parseStringArrayResult(raw),
      };
    }

    return {
      kind: "text",
      text: raw.trim(),
    };
  },
});

export const ping = mutation({
  args: {
    service: v.optional(v.string())
  },
  handler: async (ctx: any, args): Promise<{ pong: boolean; service: string | undefined }> => {
    try {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'ping',
        value: 1,
        metadata: {
          operation: 'ping',
          status: 'success'
        },
        labels: {}
      });
      return { pong: true, service: args.service };
    } catch (error: any) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'error',
        value: 1,
        metadata: {
          error: 'Ping failed: ' + error.message,
          type: 'ping',
          status: 'error'
        },
        labels: {}
      });
      return { pong: false, service: args.service };
    }
  }
});

export const getHealth = query({
  args: {},
  handler: async (ctx) => {
    try {
      const recentMetrics = await ctx.db
        .query('metrics')
        .withIndex('by_name_time', q => 
          q.eq('name', 'health_check')
           .gte('timestamp', Date.now() - 300000)
        )
        .collect();

      return {
        status: recentMetrics.length > 0 ? 'healthy' : 'unknown',
        lastCheck: recentMetrics[0]?.timestamp ?? null
      };
    } catch (error) {
      console.error('Health check query failed:', error);
      return { status: 'error', lastCheck: null };
    }
  }
});
