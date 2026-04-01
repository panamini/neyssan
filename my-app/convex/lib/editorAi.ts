import { llmConfig } from "../../config/llmConfig";

type HelperKind = "editor" | "styleRouting";

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
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Mistral helper action failed for ${args.model}: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return stripCodeFences(extractMistralText(await response.json()));
}

async function runHelperAiTextPrompt(args: {
  kind: HelperKind;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const maxOutputTokens = args.maxOutputTokens ?? 700;
  const helperModels = getHelperModelConfig(args.kind);
  const openAiKey = process.env.OPENAI_API_KEY;
  const mistralKey = llmConfig.mistralKey ?? process.env.MISTRAL_API_KEY;
  let lastError: Error | null = null;

  if (openAiKey) {
    try {
      return await requestOpenAiText({
        apiKey: openAiKey,
        model: helperModels.openaiPrimary,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens,
      });
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));

      if (
        helperModels.openaiFallback &&
        helperModels.openaiFallback !== helperModels.openaiPrimary &&
        /model_not_found/i.test(lastError.message)
      ) {
        try {
          return await requestOpenAiText({
            apiKey: openAiKey,
            model: helperModels.openaiFallback,
            system: args.system,
            prompt: args.prompt,
            maxOutputTokens,
          });
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
      return await requestMistralText({
        apiKey: mistralKey,
        model: helperModels.mistralPrimary,
        system: args.system,
        prompt: args.prompt,
        maxOutputTokens,
      });
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

export async function runEditorAiTextPrompt(args: {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<string> {
  return runHelperAiTextPrompt({
    kind: "editor",
    system: args.system,
    prompt: args.prompt,
    maxOutputTokens: args.maxOutputTokens,
  });
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
