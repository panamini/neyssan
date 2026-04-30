import { action, mutation, query } from './_generated/server';
import { v } from "convex/values";
import { internal } from './_generated/api';
import * as Monitoring from './monitoring';
import { generateProposalArgs, handleGenerateProposal } from "./generateProposalMutation";
import {
  parseStringArrayResult,
  runEditorAiTextPrompt,
  runEditorSelectionTransform,
  runStyleRoutingAiTextPrompt,
} from "./lib/editorAi";
import {
  buildLanguageSuggestionShortlist,
  buildSkillSuggestionShortlist,
  filterHobbySuggestionItems,
  filterLanguageSuggestionItems,
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

function extractJsonObject(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function cleanCvAiRewriteText(value: unknown): string {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/^\s*(responsibilities?|skills?|technologies?|tools?)\s*:\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limitWords(value: string, maxWords: number): string {
  const words = cleanCvAiRewriteText(value).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;–-]\s*$/, "")}.`;
}

function buildCvResponsibilityResponseFormat(
  outputShape: "paragraph" | "list" | "mixed" | undefined,
) {
  if (outputShape === "paragraph") {
    return {
      type: "json_schema",
      json_schema: {
        name: "cv_experience_responsibility_paragraph",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["paragraph"],
          properties: {
            paragraph: { type: "string" },
          },
        },
      },
    };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: "cv_experience_responsibility_bullets",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["bullets"],
        properties: {
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  };
}

function parseExperienceResponsibilityResult(
  raw: string,
  outputShape: "paragraph" | "list" | "mixed" | undefined,
) {
  const jsonObject = extractJsonObject(raw);
  let parsed: { paragraph?: unknown; bullets?: unknown } | null = null;
  if (jsonObject) {
    try {
      parsed = JSON.parse(jsonObject) as {
        paragraph?: unknown;
        bullets?: unknown;
      };
    } catch {
      parsed = null;
    }
  }

  if (outputShape === "paragraph") {
    const paragraph =
      cleanCvAiRewriteText(parsed?.paragraph) ||
      (Array.isArray(parsed?.bullets)
        ? parsed.bullets.map(cleanCvAiRewriteText).filter(Boolean).join(" ")
        : "") ||
      cleanCvAiRewriteText(raw);

    return {
      kind: "text" as const,
      text: limitWords(paragraph, 42),
    };
  }

  const bullets = Array.isArray(parsed?.bullets)
    ? parsed.bullets.map((item) => limitWords(String(item ?? ""), 22)).filter(Boolean)
    : parseStringArrayResult(raw)
        .map((item) => limitWords(item, 22))
        .filter(Boolean);

  return {
    kind: "list" as const,
    items: bullets,
  };
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

const cvSectionAiActionChoice = v.union(
  v.literal("rewrite_summary_from_profile"),
  v.literal("improve_summary_text"),
  v.literal("generate_skills_suggestions"),
  v.literal("generate_skills_from_experience"),
  v.literal("generate_language_suggestions"),
  v.literal("generate_hobby_suggestions"),
  v.literal("improve_experience_responsibilities"),
  v.literal("improve_experience_bullets"),
  v.literal("improve_project_description"),
  v.literal("fix_education_entry"),
  v.literal("improve_achievement_line"),
  v.literal("improve_custom_text"),
);

const CV_SECTION_AI_ACTION_IDS = [
  "rewrite_summary_from_profile",
  "improve_summary_text",
  "generate_skills_suggestions",
  "generate_skills_from_experience",
  "generate_language_suggestions",
  "generate_hobby_suggestions",
  "improve_experience_responsibilities",
  "improve_experience_bullets",
  "improve_project_description",
  "fix_education_entry",
  "improve_achievement_line",
  "improve_custom_text",
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
    mode: v.string(),
    instruction: v.string(),
    selectedText: v.string(),
    jobContext: v.optional(
      v.object({
        jobId: v.string(),
        title: v.optional(v.union(v.string(), v.null())),
        company: v.optional(v.union(v.string(), v.null())),
        sourceLanguage: v.optional(v.union(v.string(), v.null())),
        visibleSummary: v.optional(v.union(v.string(), v.null())),
        visibleRequirements: v.optional(v.array(v.string())),
        visibleKeywords: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (_ctx, args) => {
    return runEditorSelectionTransform(args);
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
    instruction: v.optional(v.string()),
    existingItems: v.optional(v.array(v.string())),
    excludeItems: v.optional(v.array(v.string())),
    maxItems: v.optional(v.number()),
    outputShape: v.optional(
      v.union(
        v.literal("paragraph"),
        v.literal("list"),
        v.literal("mixed"),
        v.literal("empty"),
      ),
    ),
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
      summary: args.summary,
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
      | "generate_hobby_suggestions"
      | "improve_experience_responsibilities"
      | "improve_experience_bullets" =>
      action === "generate_skills_suggestions" ||
      action === "generate_skills_from_experience" ||
      action === "generate_language_suggestions" ||
      action === "generate_hobby_suggestions" ||
      (action === "improve_experience_responsibilities" &&
        (args.outputShape ?? "list") === "list") ||
      action === "improve_experience_bullets";

    const actionPrompt = (() => {
      switch (args.action) {
        case "rewrite_summary_from_profile":
          return [
            "Task: draft the CV summary from the full profile evidence.",
            "Return only the rewritten summary text.",
            "Keep it concise, credible, and specific to the actual experience provided.",
            args.instruction
              ? `User instruction:\n${args.instruction}`
              : "User instruction: none.",
            args.instruction
              ? "Follow the user instruction first. Use CV evidence when relevant."
              : "Use the CV evidence as the source of truth.",
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
            args.instruction
              ? `User instruction:\n${args.instruction}`
              : "User instruction: none.",
            args.instruction
              ? "Follow the user instruction first. Use CV evidence when relevant."
              : "Use the existing summary as the source of truth.",
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
            args.summary ? `Summary evidence:\n${args.summary}` : "Summary evidence: none.",
            compactExperiences ? `Experience evidence:\n${compactExperiences}` : "Experience evidence: none.",
            compactEducations ? `Education evidence:\n${compactEducations}` : "Education evidence: none.",
          ].join("\n\n");
        case "generate_language_suggestions":
          return [
            "Task: suggest languages that are explicitly supported by the resume evidence.",
            "Return JSON only: an array of language names.",
            "Use canonical language names only. Do not return proficiency verbs such as 'write Hungarian' or 'understand spoken Korean'.",
            "Do not infer spoken languages from programming languages. Java means the programming language unless the evidence explicitly says Javanese.",
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
        case "generate_hobby_suggestions":
          return [
            "Task: suggest concise CV hobby or interest tags.",
            "Return JSON only: an array of short hobby or interest strings.",
            "Only suggest non-work interests explicitly supported by the resume evidence. If there is no hobby or interest evidence, return [].",
            "Do not include professional skills, languages, protected characteristics, health status, politics, religion, family status, duplicates, or claims not supported by the evidence.",
            args.existingItems?.length
              ? `Already present:\n- ${args.existingItems.join("\n- ")}`
              : "Already present: none.",
            args.excludeItems?.length
              ? `Do not repeat in this batch:\n- ${args.excludeItems.join("\n- ")}`
              : "Do not repeat in this batch: none.",
            args.summary ? `Summary/profile text:\n${args.summary}` : "Summary/profile text: none.",
            args.skills?.length
              ? `Professional skills to exclude:\n- ${args.skills.join("\n- ")}`
              : "Professional skills to exclude: none.",
            compactExperiences ? `Experience evidence:\n${compactExperiences}` : "Experience evidence: none.",
            compactEducations ? `Education evidence:\n${compactEducations}` : "Education evidence: none.",
          ].join("\n\n");
        case "improve_experience_responsibilities":
          if (args.outputShape === "paragraph") {
            return [
              "Task: rewrite one CV responsibility paragraph.",
              "Return JSON only with shape {\"paragraph\": string}.",
              "Write one short ATS-ready resume paragraph, preferably one sentence and never more than 42 words.",
              "If the source is very short, only tighten it or extend it slightly with facts already present.",
              "Do not add skills, tools, metrics, responsibilities, markdown, bullets, labels, or commentary.",
              `Input JSON:\n${JSON.stringify({
                requestedShape: "paragraph",
                currentText: args.existingText ?? "",
              })}`,
            ].join("\n\n");
          }
          if (args.outputShape === "mixed") {
            return [
              "Task: rewrite one CV responsibility field while preserving a bullet-list result.",
              "Return JSON only with shape {\"bullets\": string[]}.",
              "Keep concise ATS-ready bullets. Prefer the same number of bullets as the source and never more than four.",
              "Do not add skills, tools, metrics, responsibilities, markdown, labels, or commentary.",
              `Input JSON:\n${JSON.stringify({
                requestedShape: "bullets",
                currentText: args.existingText ?? "",
              })}`,
            ].join("\n\n");
          }
          return [
            "Task: rewrite one CV responsibility bullet list.",
            "Return JSON only with shape {\"bullets\": string[]}.",
            "Keep concise ATS-ready bullets. Preserve bullet-list structure, prefer the same bullet count as the source, and never return more than four bullets.",
            "Do not add skills, tools, metrics, responsibilities, markdown, labels, or commentary.",
            `Input JSON:\n${JSON.stringify({
              requestedShape: "bullets",
              currentText: args.existingText ?? "",
            })}`,
          ].join("\n\n");
        case "improve_experience_bullets":
          return [
            "Task: improve the responsibility bullet list for one CV role.",
            "Return JSON only: an array of concise bullet strings.",
            "Preserve factual scope. Improve clarity, specificity, and impact without inventing metrics or responsibilities.",
            `Existing role text:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "improve_project_description":
          return [
            "Task: rewrite only one CV project description body.",
            "The input is the current description body only.",
            "Return only the replacement body text.",
            "Keep one short ATS-ready resume paragraph, preferably one sentence and never more than 42 words.",
            "Do not add project names, stack, technologies, field labels, markdown, headings, bullets, numbering, quotes, or commentary.",
            "Preserve factual scope. Improve clarity, specificity, and impact without inventing metrics, tools, or outcomes.",
            `Current description body:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "fix_education_entry":
          return [
            "Task: fix spelling, capitalization, and syntax for one CV education entry.",
            "Return exactly three plain-text lines in this format:",
            "Degree: <fixed degree or empty>",
            "School: <fixed school or empty>",
            "Field: <fixed field or empty>",
            "Do not add missing facts, dates, locations, honors, or new credentials.",
            `Existing education entry:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "improve_achievement_line":
          return [
            "Task: improve one CV achievement line.",
            "Return only the rewritten achievement line.",
            "Keep it as one short ATS-ready line, ideally under 18 words.",
            "Keep it factual and stronger in phrasing without inventing metrics or claims.",
            `Existing achievement line:\n${args.existingText ?? ""}`,
          ].join("\n\n");
        case "improve_custom_text":
          return [
            "Task: clean up one custom CV text section.",
            "Return only the replacement body text.",
            "Fix grammar and syntax, make it human, and make it a bit shorter for ATS readability.",
            args.instruction
              ? `User instruction:\n${args.instruction}`
              : "User instruction: none.",
            args.instruction
              ? "Follow the user instruction first while preserving the user's facts."
              : "Preserve the user's facts.",
            "Preserve facts. Do not add new claims, headings, bullets, markdown, quotes, or commentary.",
            `Existing section text:\n${args.existingText ?? ""}`,
          ].join("\n\n");
      }
    })();

    const shouldUseCvMistralModel =
      args.action === "rewrite_summary_from_profile" ||
      args.action === "improve_summary_text" ||
      args.action === "generate_skills_suggestions" ||
      args.action === "generate_skills_from_experience" ||
      args.action === "generate_language_suggestions" ||
      args.action === "generate_hobby_suggestions" ||
      args.action === "improve_experience_responsibilities" ||
      args.action === "improve_project_description" ||
      args.action === "fix_education_entry" ||
      args.action === "improve_achievement_line" ||
      args.action === "improve_custom_text";
    const isSuggestionAction =
      args.action === "generate_skills_suggestions" ||
      args.action === "generate_skills_from_experience" ||
      args.action === "generate_language_suggestions" ||
      args.action === "generate_hobby_suggestions";
    const raw = await runEditorAiTextPrompt({
      system:
        isListAction(args.action)
          ? "You generate structured CV improvements. Return only valid JSON arrays when requested."
          : "You improve CV sections. Return only the revised text with no commentary.",
      prompt: actionPrompt,
      maxOutputTokens: shouldUseCvMistralModel ? 260 : 700,
      providerPreference: shouldUseCvMistralModel ? "mistral_only" : "default",
      mistralModelOverride: shouldUseCvMistralModel
        ? isSuggestionAction
          ? process.env.MISTRAL_CV_LIST_MODEL ??
            process.env.MISTRAL_CV_SKILLS_MODEL ??
            "ministral-3b-2512"
          : process.env.MISTRAL_CV_TEXT_MODEL ??
            process.env.MISTRAL_CV_SUMMARY_MODEL ??
            "mistral-small-latest"
        : undefined,
      mistralResponseFormat:
        args.action === "improve_experience_responsibilities"
          ? buildCvResponsibilityResponseFormat(args.outputShape)
          : undefined,
    });

    if (args.action === "improve_experience_responsibilities") {
      return parseExperienceResponsibilityResult(raw, args.outputShape);
    }

    if (isListAction(args.action)) {
      const parsedItems = parseStringArrayResult(raw);
      if (args.action === "generate_language_suggestions") {
        return {
          kind: "list",
          items: filterLanguageSuggestionItems(parsedItems),
        };
      }
      if (args.action === "generate_hobby_suggestions") {
        return {
          kind: "list",
          items: filterHobbySuggestionItems({
            items: parsedItems,
            blockedItems: [
              ...(args.existingItems ?? []),
              ...(args.excludeItems ?? []),
              ...(args.skills ?? []),
            ],
          }),
        };
      }
      return {
        kind: "list",
        items: parsedItems,
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
