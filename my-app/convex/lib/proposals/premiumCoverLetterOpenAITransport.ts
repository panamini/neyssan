import type { ZodTypeAny } from "zod";

export type OpenAIResponsesJsonSchemaFormat = Readonly<{
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  strict: true;
}>;

export type OpenAIResponsesSchemaContract = Readonly<{
  name: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodTypeAny;
}>;

export type OpenAIResponsesProviderResponseMetadata = Readonly<{
  returnedModel: string | null;
  tokenUsage: Readonly<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }> | null;
}>;

export type OpenAIResponsesTransportDependencies = Readonly<{
  loadOpenAIModule?: () => Promise<unknown>;
  loadZodHelperModule?: () => Promise<unknown>;
  fetchImpl?: typeof fetch;
}>;

type OpenAIResponsesRequest = Readonly<{
  model: string;
  input: string;
  max_output_tokens?: number;
  reasoning: Readonly<{ effort: string }>;
  text: Readonly<{
    verbosity: "medium";
    format: OpenAIResponsesJsonSchemaFormat;
  }>;
}>;

export function buildOpenAIResponsesRequest(args: {
  prompt: string;
  writerModel: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens?: number;
  reasoningEffort: string;
}): OpenAIResponsesRequest {
  const format: OpenAIResponsesJsonSchemaFormat = {
    type: "json_schema",
    name: args.schemaName,
    schema: args.schema,
    strict: true,
  };

  return {
    model: args.writerModel,
    input: args.prompt,
    ...(args.maxOutputTokens !== undefined
      ? { max_output_tokens: args.maxOutputTokens }
      : {}),
    reasoning: {
      effort: args.reasoningEffort,
    },
    text: {
      verbosity: "medium",
      format,
    },
  };
}

function assertDirectJsonSchemaFormat(
  value: unknown,
): asserts value is OpenAIResponsesJsonSchemaFormat {
  if (
    !value ||
    typeof value !== "object" ||
    (value as any).type !== "json_schema" ||
    typeof (value as any).name !== "string" ||
    !Object.prototype.hasOwnProperty.call(value, "schema") ||
    (value as any).strict !== true ||
    Object.prototype.hasOwnProperty.call(value, "json_schema")
  ) {
    throw new Error(
      "OpenAI Responses JSON schema format must use the direct {type,name,schema,strict} shape.",
    );
  }
}

export function extractOpenAIJsonPayload(response: any): unknown {
  if (response?.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed;
  }

  const contentArrays = [
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.outputs) ? response.outputs : []),
  ]
    .flatMap((entry: any) =>
      Array.isArray(entry?.content) ? entry.content : entry ? [entry] : [],
    )
    .filter(Boolean);

  for (const item of contentArrays) {
    if (item?.json && typeof item.json === "object") {
      return item.json;
    }
    if (item?.parsed && typeof item.parsed === "object") {
      return item.parsed;
    }
    if (typeof item?.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {
        // Keep scanning: some envelopes include plain text alongside parseable content.
      }
    }
    if (typeof item?.output_text === "string") {
      try {
        return JSON.parse(item.output_text);
      } catch {
        // Keep scanning: some envelopes include plain text alongside parseable content.
      }
    }
  }

  if (typeof response?.output_text === "string") {
    try {
      return JSON.parse(response.output_text);
    } catch {
      // Fall through to other extraction attempts.
    }
  }

  const chatContent =
    response?.choices?.[0]?.message?.content ??
    response?.full_response?.choices?.[0]?.message?.content ??
    null;
  if (typeof chatContent === "string") {
    try {
      return JSON.parse(chatContent);
    } catch {
      // Fall through to the fenced JSON scan below.
    }
  }

  const serialized = JSON.stringify(response);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(serialized);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }
  throw new Error("Premium cover-letter response did not contain parsed JSON");
}

export function extractOpenAIProviderResponseMetadata(
  response: any,
): OpenAIResponsesProviderResponseMetadata {
  const usage = response?.usage ?? response?.usage_metadata ?? null;
  const inputTokens = usage?.input_tokens ?? usage?.promptTokens;
  const outputTokens = usage?.output_tokens ?? usage?.completionTokens;
  const totalTokens = usage?.total_tokens ?? usage?.totalTokens;
  const tokenUsage = [inputTokens, outputTokens, totalTokens].every(
    (value) => Number.isInteger(value) && value >= 0,
  )
    ? { inputTokens, outputTokens, totalTokens }
    : null;
  return {
    returnedModel: typeof response?.model === "string" ? response.model : null,
    tokenUsage,
  };
}

export async function generateOpenAIResponsesStructured(args: {
  apiKey: string;
  prompt: string;
  writerModel: string;
  responseFormat: OpenAIResponsesSchemaContract;
  signal?: AbortSignal;
  maxRetries?: number;
  maxOutputTokens?: number;
  reasoningEffort: string;
  onResponseMetadata?: (
    metadata: OpenAIResponsesProviderResponseMetadata,
  ) => void;
  dependencies?: OpenAIResponsesTransportDependencies;
}): Promise<unknown> {
  const requestBody = buildOpenAIResponsesRequest({
    prompt: args.prompt,
    writerModel: args.writerModel,
    schema: args.responseFormat.jsonSchema,
    schemaName: args.responseFormat.name,
    maxOutputTokens: args.maxOutputTokens,
    reasoningEffort: args.reasoningEffort,
  });
  const loadOpenAIModule =
    args.dependencies?.loadOpenAIModule ??
    (() => import("openai").catch(() => null));
  const openaiModule: any = await loadOpenAIModule();
  const OpenAI = openaiModule?.default ?? openaiModule?.OpenAI ?? null;

  if (OpenAI) {
    const client = new OpenAI({
      apiKey: args.apiKey,
      ...(args.maxRetries !== undefined ? { maxRetries: args.maxRetries } : {}),
    });
    const loadZodHelperModule =
      args.dependencies?.loadZodHelperModule ??
      (() => import("openai/helpers/zod").catch(() => null));
    const zodHelperModule: any = await loadZodHelperModule();
    const zodTextFormat = zodHelperModule?.zodTextFormat ?? null;

    if (typeof client.responses?.parse === "function" && zodTextFormat) {
      const parsedFormat = zodTextFormat(
        args.responseFormat.zodSchema,
        args.responseFormat.name,
      );
      assertDirectJsonSchemaFormat(parsedFormat);
      const response = await client.responses.parse(
        {
          ...requestBody,
          text: {
            ...requestBody.text,
            format: parsedFormat,
          },
        } as any,
        args.signal ? ({ signal: args.signal } as any) : undefined,
      );
      args.onResponseMetadata?.(
        extractOpenAIProviderResponseMetadata(response),
      );
      return args.responseFormat.zodSchema.parse(
        response?.output_parsed ?? extractOpenAIJsonPayload(response),
      );
    }

    const response = await client.responses.create(
      requestBody as any,
      args.signal ? ({ signal: args.signal } as any) : undefined,
    );
    args.onResponseMetadata?.(extractOpenAIProviderResponseMetadata(response));
    return args.responseFormat.zodSchema.parse(
      extractOpenAIJsonPayload(response),
    );
  }

  const fetchImpl = args.dependencies?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("OpenAI Responses transport requires fetch.");
  }
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    signal: args.signal,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI premium cover-letter request failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }
  const responseBody = await response.json();
  args.onResponseMetadata?.(
    extractOpenAIProviderResponseMetadata(responseBody),
  );
  return args.responseFormat.zodSchema.parse(
    extractOpenAIJsonPayload(responseBody),
  );
}
