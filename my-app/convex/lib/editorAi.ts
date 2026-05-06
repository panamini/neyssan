import {
  llmConfig,
  type HelperModelActionPolicy,
  type HelperModelRoute,
} from "../../config/llmConfig";
import {
  requireEditorAiActionDefinition,
  type AiActionId,
  type AiApplyMode,
  type AiOutputMode,
} from "./editorAiRulebook";
import {
  formatEditorAiJobContextForPrompt,
  requireSufficientEditorAiJobContext,
  type EditorAiJobContext,
} from "./editorAiJobContext";

type HelperKind = "editor" | "styleRouting";

export type EditorAiResult = {
  kind: "text";
  actionId: AiActionId;
  text: string;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  actualModelProvider?: string;
  actualModelName?: string;
  fallbackUsed?: boolean;
  variants: [];
};

type HelperAiTextPromptResult = {
  text: string;
  actualModelProvider?: string;
  actualModelName?: string;
  fallbackUsed?: boolean;
};

class UnconfiguredHelperRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnconfiguredHelperRouteError";
  }
}

function compactWhitespace(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractOpenAiText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const outputs = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
      if (typeof part?.output_text === "string" && part.output_text.trim()) {
        return part.output_text.trim();
      }
    }
  }

  const choices = Array.isArray(response?.choices) ? response.choices : [];
  const chatContent = choices[0]?.message?.content;
  if (typeof chatContent === "string" && chatContent.trim()) {
    return chatContent.trim();
  }

  throw new Error("OpenAI editor action returned no text");
}

function extractMistralText(response: any): string {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  throw new Error("Mistral editor action returned no text");
}

function getHelperModelConfig(kind: HelperKind): {
  openaiPrimary: string;
  openaiFallback: string;
  mistralPrimary: string;
  actions?: Record<string, HelperModelActionPolicy> | Partial<Record<string, HelperModelActionPolicy>>;
} {
  const helperConfig = llmConfig.helperModels?.[kind];

  if (helperConfig) {
    return helperConfig;
  }

  return {
    openaiPrimary: llmConfig.openaiModel ?? "gpt-5-mini",
    openaiFallback: llmConfig.openaiModel ?? "gpt-5-mini",
    mistralPrimary: llmConfig.mistralModel ?? "mistral-small-latest",
  };
}

async function requestOpenAiText(args: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: args.system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: args.prompt }],
        },
      ],
      max_output_tokens: args.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI helper action failed for ${args.model}: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return stripCodeFences(extractOpenAiText(await response.json()));
}

async function requestMistralText(args: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  responseFormat?: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
      max_tokens: args.maxOutputTokens,
      ...(args.responseFormat ? { response_format: args.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Mistral helper action failed for ${args.model}: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return stripCodeFences(extractMistralText(await response.json()));
}

async function requestOpenAiCompatibleChatText(args: {
  providerName: string;
  apiKey: string;
  url: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<string> {
  const thinking =
    args.providerName === "deepseek"
      ? ({ type: "disabled" as const })
      : undefined;

  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
      max_tokens: args.maxOutputTokens,
      ...(thinking ? { thinking } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `${args.providerName} helper action failed for ${args.model}: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return stripCodeFences(extractMistralText(await response.json()));
}

function resolveEditorActionPolicy(
  actionId: AiActionId | undefined,
): HelperModelActionPolicy | null {
  if (!actionId) return null;
  const helperModels = getHelperModelConfig("editor");
  return helperModels.actions?.[actionId] ?? null;
}

function getRouteCredentials(route: HelperModelRoute): {
  apiKey: string | null;
  url?: string | null;
} {
  if (route.provider === "mistral") {
    return { apiKey: llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY ?? null };
  }

  if (route.provider === "qwen") {
    return {
      apiKey: llmConfig.qwenKey ?? process.env.QWEN_API_KEY ?? null,
      url: process.env.QWEN_CHAT_COMPLETIONS_URL ?? llmConfig.qwenChatCompletionsUrl ?? null,
    };
  }

  if (route.provider === "deepseek") {
    return {
      apiKey: llmConfig.deepseekKey ?? process.env.DEEPSEEK_API_KEY ?? null,
      url:
        process.env.DEEPSEEK_CHAT_COMPLETIONS_URL ??
        llmConfig.deepseekChatCompletionsUrl ??
        null,
    };
  }

  if (route.provider === "openai") {
    return { apiKey: llmConfig.openaiKey ?? process.env.OPENAI_API_KEY ?? null };
  }

  return { apiKey: null };
}

async function runModelRoute(args: {
  route: HelperModelRoute;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  mistralResponseFormat?: Record<string, unknown>;
}): Promise<HelperAiTextPromptResult> {
  const credentials = getRouteCredentials(args.route);
  if (!credentials.apiKey) {
    throw new UnconfiguredHelperRouteError(
      `${args.route.provider} helper AI provider is not configured`,
    );
  }

  if (args.route.provider === "mistral") {
    return {
      text: await requestMistralText({
        apiKey: credentials.apiKey,
        model: args.route.model,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens: args.maxOutputTokens,
        responseFormat: args.mistralResponseFormat,
      }),
      actualModelProvider: args.route.provider,
      actualModelName: args.route.model,
      fallbackUsed: false,
    };
  }

  if (args.route.provider === "openai") {
    return {
      text: await requestOpenAiText({
        apiKey: credentials.apiKey,
        model: args.route.model,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens: args.maxOutputTokens,
      }),
      actualModelProvider: args.route.provider,
      actualModelName: args.route.model,
      fallbackUsed: false,
    };
  }

  if (args.route.provider === "qwen" || args.route.provider === "deepseek") {
    if (!credentials.url) {
      throw new UnconfiguredHelperRouteError(
        `${args.route.provider} helper AI chat completions URL is not configured`,
      );
    }
    return {
      text: await requestOpenAiCompatibleChatText({
        providerName: args.route.provider,
        apiKey: credentials.apiKey,
        url: credentials.url,
        model: args.route.model,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens: args.maxOutputTokens,
      }),
      actualModelProvider: args.route.provider,
      actualModelName: args.route.model,
      fallbackUsed: false,
    };
  }

  throw new Error(`Unsupported helper AI provider: ${args.route.provider}`);
}

async function runEditorActionRoute(args: {
  policy: HelperModelActionPolicy;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  mistralResponseFormat?: Record<string, unknown>;
}): Promise<HelperAiTextPromptResult> {
  let lastError: Error | null = null;
  const skippedRoutes: string[] = [];
  const attemptedRoutes: string[] = [];
  for (const [routeIndex, route] of [
    args.policy.primary,
    ...args.policy.fallbacks,
  ].entries()) {
    attemptedRoutes.push(`${route.provider}:${route.model}`);
    try {
      const result = await runModelRoute({
        route,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens: args.maxOutputTokens,
        mistralResponseFormat: args.mistralResponseFormat,
      });
      return {
        ...result,
        fallbackUsed: routeIndex > 0 || skippedRoutes.length > 0,
      };
    } catch (error) {
      const routeError =
        error instanceof Error ? error : new Error(String(error ?? ""));
      if (routeError instanceof UnconfiguredHelperRouteError) {
        skippedRoutes.push(`${route.provider}:${route.model}`);
        continue;
      }
      lastError = routeError;
    }
  }

  if (lastError) {
    throw new Error(
      `Editor action AI routing failed after trying ${attemptedRoutes.join(" -> ")}. Last configured route error: ${lastError.message}`,
    );
  }

  throw new Error(
    `No configured editor action AI provider is available. Skipped routes: ${skippedRoutes.join(" -> ") || "none"}`,
  );
}

async function runHelperAiTextPromptDetailed(args: {
  kind: HelperKind;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  providerPreference?: "default" | "mistral" | "mistral_only";
  mistralModelOverride?: string;
  mistralResponseFormat?: Record<string, unknown>;
  actionId?: AiActionId;
}): Promise<HelperAiTextPromptResult> {
  const maxOutputTokens = args.maxOutputTokens ?? 700;
  const helperModels = getHelperModelConfig(args.kind);
  const openAiKey = process.env.OPENAI_API_KEY;
  const mistralKey = llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY;
  const mistralModel = args.mistralModelOverride ?? helperModels.mistralPrimary;
  let lastError: Error | null = null;
  const editorActionPolicy =
    args.kind === "editor" && args.providerPreference !== "mistral" && args.providerPreference !== "mistral_only"
      ? resolveEditorActionPolicy(args.actionId)
      : null;

  if (editorActionPolicy) {
    return runEditorActionRoute({
      policy: editorActionPolicy,
      system: args.system,
      prompt: args.prompt,
      maxOutputTokens,
      mistralResponseFormat: args.mistralResponseFormat,
    });
  }

  if (
    (args.providerPreference === "mistral" ||
      args.providerPreference === "mistral_only") &&
    mistralKey
  ) {
    try {
      return {
        text: await requestMistralText({
          apiKey: mistralKey,
          model: mistralModel,
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens,
          responseFormat: args.mistralResponseFormat,
        }),
        actualModelProvider: "mistral",
        actualModelName: mistralModel,
        fallbackUsed: false,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));
    }
  }

  if (args.providerPreference === "mistral_only") {
    throw lastError ?? new Error("Mistral helper AI provider is not configured");
  }

  if (openAiKey) {
    try {
      return {
        text: await requestOpenAiText({
          apiKey: openAiKey,
          model: helperModels.openaiPrimary,
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens,
        }),
        actualModelProvider: "openai",
        actualModelName: helperModels.openaiPrimary,
        fallbackUsed: false,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));

      if (
        helperModels.openaiFallback &&
        helperModels.openaiFallback !== helperModels.openaiPrimary &&
        /model_not_found/i.test(lastError.message)
      ) {
        try {
          return {
            text: await requestOpenAiText({
              apiKey: openAiKey,
              model: helperModels.openaiFallback,
              system: args.system,
              prompt: args.prompt,
              maxOutputTokens,
            }),
            actualModelProvider: "openai",
            actualModelName: helperModels.openaiFallback,
            fallbackUsed: true,
          };
        } catch (fallbackError) {
          lastError =
            fallbackError instanceof Error
              ? fallbackError
              : new Error(String(fallbackError ?? ""));
        }
      }
    }
  }

  if (mistralKey) {
    try {
      return {
        text: await requestMistralText({
          apiKey: mistralKey,
          model: mistralModel,
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens,
          responseFormat: args.mistralResponseFormat,
        }),
        actualModelProvider: "mistral",
        actualModelName: mistralModel,
        fallbackUsed: Boolean(openAiKey),
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("No helper AI provider is configured");
}

async function runHelperAiTextPrompt(args: {
  kind: HelperKind;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  providerPreference?: "default" | "mistral" | "mistral_only";
  mistralModelOverride?: string;
  mistralResponseFormat?: Record<string, unknown>;
  actionId?: AiActionId;
}): Promise<string> {
  const result = await runHelperAiTextPromptDetailed(args);
  return result.text;
}

export async function runEditorAiTextPrompt(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  providerPreference?: "default" | "mistral" | "mistral_only";
  mistralModelOverride?: string;
  mistralResponseFormat?: Record<string, unknown>;
  actionId?: AiActionId;
}): Promise<string> {
  return runHelperAiTextPrompt({
    kind: "editor",
    system: args.system,
    prompt: args.prompt,
    maxOutputTokens: args.maxOutputTokens,
    providerPreference: args.providerPreference,
    mistralModelOverride: args.mistralModelOverride,
    mistralResponseFormat: args.mistralResponseFormat,
    actionId: args.actionId,
  });
}

export async function runEditorSelectionTransform(args: {
  mode: string;
  instruction: string;
  selectedText: string;
  jobContext?: EditorAiJobContext | null;
  runTextPrompt?: typeof runEditorAiTextPrompt;
}): Promise<EditorAiResult> {
  const actionDefinition = requireEditorAiActionDefinition(args.mode);
  const instruction = args.instruction.trim() || actionDefinition.instruction;
  const jobContext = actionDefinition.requiresJobContext
    ? requireSufficientEditorAiJobContext(args.jobContext)
    : null;
  const prompt = [
    `Transformation action: ${actionDefinition.id}`,
    `Instruction: ${instruction}`,
    ...(jobContext
      ? [
          "",
          "Compact job context:",
          formatEditorAiJobContextForPrompt(jobContext),
          "",
          "Tailor tone, emphasis, and wording to this job context only.",
          "Use the selected text as the only source of the user's factual evidence.",
          "Do not invent licenses, certifications, employers, degrees, metrics, seniority, tools, or experience.",
        ]
      : []),
    "Rewrite the selected text only.",
    "Preserve the original language unless the instruction explicitly changes it.",
    "Return only the replacement text with no quotes, no markdown, and no commentary.",
    "",
    "Selected text:",
    args.selectedText,
  ].join("\n");
  const runTextPrompt = args.runTextPrompt ?? runEditorAiTextPrompt;
  const promptArgs = {
    system:
      "You are editing a user's text selection in place. Return only the replacement text. Do not add explanations, code fences, or surrounding quotes.",
    prompt,
    maxOutputTokens: 500,
    providerPreference: "default" as const,
    actionId: actionDefinition.id,
  };
  const promptResult = args.runTextPrompt
    ? { text: await runTextPrompt(promptArgs) }
    : await runHelperAiTextPromptDetailed({
        kind: "editor",
        ...promptArgs,
      });

  return {
    kind: "text",
    actionId: actionDefinition.id,
    text: promptResult.text.trim(),
    applyMode: actionDefinition.applyMode,
    outputMode: actionDefinition.outputMode,
    actualModelProvider: promptResult.actualModelProvider,
    actualModelName: promptResult.actualModelName,
    fallbackUsed: promptResult.fallbackUsed,
    variants: [],
  };
}

export async function runStyleRoutingAiTextPrompt(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  return runHelperAiTextPrompt({
    kind: "styleRouting",
    system: args.system,
    prompt: args.prompt,
    maxOutputTokens: args.maxOutputTokens,
  });
}

export function parseStringArrayResult(value: string): string[] {
  const cleaned = stripCodeFences(value);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => compactWhitespace(String(item ?? "")))
        .filter(Boolean);
    }
  } catch {
    // Fall through to tolerant parsing.
  }

  return cleaned
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/, ""))
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
}
